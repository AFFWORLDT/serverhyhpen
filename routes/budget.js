const express = require('express');
const { body, validationResult } = require('express-validator');
const BudgetRequest = require('../models/BudgetRequest');
const Department = require('../models/Department');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /budget/requests:
 *   get:
 *     summary: Get all budget requests
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/requests', auth, async (req, res) => {
  try {
    const { status, department, fiscalYear } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (department) filter.department = department;
    if (fiscalYear) filter.fiscalYear = fiscalYear;

    const requests = await BudgetRequest.find(filter)
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName')
      .populate('reviews.reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    console.error('Error fetching budget requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget requests'
    });
  }
});

/**
 * @swagger
 * /budget/requests:
 *   post:
 *     summary: Create budget request
 *     description: Department managers can request budget allocation
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - department
 *               - totalAmount
 *               - justification
 *             properties:
 *               department:
 *                 type: string
 *               fiscalYear:
 *                 type: string
 *               budgetType:
 *                 type: string
 *                 enum: [initial, supplementary, revision]
 *               totalAmount:
 *                 type: number
 *                 minimum: 0
 *               breakdown:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     category:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *               justification:
 *                 type: string
 *                 minLength: 20
 *     responses:
 *       201:
 *         description: Budget request created
 */
router.post('/requests', auth, [
  body('department').isMongoId(),
  body('totalAmount').isNumeric(),
  body('justification').trim().isLength({ min: 20 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const request = new BudgetRequest({
      ...req.body,
      requestedBy: req.user.userId,
      fiscalYear: req.body.fiscalYear || new Date().getFullYear().toString()
    });

    await request.save();

    res.status(201).json({
      success: true,
      message: 'Budget request created successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Error creating budget request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create budget request'
    });
  }
});

/**
 * @swagger
 * /budget/requests/{id}/approve:
 *   post:
 *     summary: Approve budget request
 *     tags: [Finance]
 */
router.post('/requests/:id/approve', auth, adminAuth, [
  body('comment').optional()
], async (req, res) => {
  try {
    const request = await BudgetRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Budget request not found'
      });
    }

    request.status = 'approved';
    request.approvedBy = req.user.userId;
    request.approvedAt = new Date();
    
    // Update department budget
    const department = await Department.findById(request.department);
    if (department) {
      department.budget.total = (department.budget.total || 0) + request.totalAmount;
      department.budget.allocated = (department.budget.allocated || 0) + request.totalAmount;
      department.budget.remaining = department.budget.total - department.budget.spent;
      await department.save();
    }

    await request.save();

    res.json({
      success: true,
      message: 'Budget request approved and allocated to department',
      data: { request }
    });
  } catch (error) {
    console.error('Error approving budget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve budget request'
    });
  }
});

/**
 * @swagger
 * /budget/requests/{id}/reject:
 *   post:
 *     summary: Reject budget request
 *     tags: [Finance]
 */
router.post('/requests/:id/reject', auth, adminAuth, [
  body('rejectionReason').trim().isLength({ min: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const request = await BudgetRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Budget request not found'
      });
    }

    request.status = 'rejected';
    request.rejectionReason = req.body.rejectionReason;
    await request.save();

    res.json({
      success: true,
      message: 'Budget request rejected',
      data: { request }
    });
  } catch (error) {
    console.error('Error rejecting budget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject budget request'
    });
  }
});

// Budget Overview
router.get('/overview', auth, adminAuth, async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    const year = fiscalYear || new Date().getFullYear().toString();

    // Get all departments
    const departments = await Department.find().populate('manager', 'firstName lastName');
    
    // Get all budget requests for the year
    const requests = await BudgetRequest.find({ fiscalYear: year })
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName');

    // Calculate totals
    const totalBudget = departments.reduce((sum, d) => sum + (d.budget?.total || 0), 0);
    const totalSpent = departments.reduce((sum, d) => sum + (d.budget?.spent || 0), 0);
    const totalRequests = requests.length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const pendingRequests = requests.filter(r => r.status === 'submitted' || r.status === 'under_review').length;

    const overview = {
      fiscalYear: year,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      utilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      totalRequests,
      approvedRequests,
      pendingRequests,
      departments: departments.map(d => ({
        name: d.name,
        code: d.code,
        budget: d.budget,
        manager: d.manager,
        staffCount: d.totalStaff || 0
      })),
      recentRequests: requests.slice(0, 10)
    };

    res.json({
      success: true,
      data: { overview }
    });
  } catch (error) {
    console.error('Error fetching budget overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget overview'
    });
  }
});

/**
 * @swagger
 * /budget/departments:
 *   get:
 *     summary: Get all departments with budget summary
 *     tags: [Finance]
 */
router.get('/departments', auth, async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('manager', 'firstName lastName')
      .select('name code budget manager totalStaff');

    const budgetSummary = departments.map(dept => ({
      department: dept.name,
      code: dept.code,
      manager: dept.manager,
      totalBudget: dept.budget?.total || 0,
      allocated: dept.budget?.allocated || 0,
      spent: dept.budget?.spent || 0,
      remaining: dept.budget?.remaining || 0,
      utilization: dept.budget?.total ? Math.round((dept.budget.spent / dept.budget.total) * 100) : 0,
      staffCount: dept.totalStaff || 0
    }));

    res.json({
      success: true,
      data: { departments: budgetSummary }
    });
  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget summary'
    });
  }
});

module.exports = router;

