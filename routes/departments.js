const express = require('express');
const { body, validationResult } = require('express-validator');
const Department = require('../models/Department');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /departments:
 *   get:
 *     summary: Get all departments
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments with budget info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     departments:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/', auth, async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('manager', 'firstName lastName email')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: { departments }
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments'
    });
  }
});

/**
 * @swagger
 * /departments:
 *   post:
 *     summary: Create new department
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *               manager:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department created
 */
router.post('/', auth, adminAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Department name required'),
  body('code').trim().isLength({ min: 2 }).withMessage('Department code required'),
  body('budget').optional().isNumeric().withMessage('Budget must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, code, description, budget, manager } = req.body;

    // Check if code already exists
    const existing = await Department.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Department code already exists'
      });
    }

    const departmentData = {
      name,
      code: code.toUpperCase(),
      description,
      manager
    };

    if (budget) {
      departmentData.budget = {
        total: budget,
        allocated: 0,
        spent: 0,
        remaining: budget
      };
    }

    const department = new Department(departmentData);
    await department.save();

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department }
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create department'
    });
  }
});

// Get single department
router.get('/:id', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('manager', 'firstName lastName email')
      .populate({
        path: 'totalStaff',
        select: 'firstName lastName role department'
      });
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Get staff count in this department
    const staffCount = await User.countDocuments({ department: department.code });
    department.totalStaff = staffCount;

    res.json({
      success: true,
      data: { department }
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department'
    });
  }
});

// Update department
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, description, budget, manager } = req.body;
    
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    if (name) department.name = name;
    if (description) department.description = description;
    if (manager) department.manager = manager;

    if (budget !== undefined) {
      department.budget.total = budget;
      department.budget.remaining = budget - department.budget.spent;
    }

    await department.save();

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department }
    });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department'
    });
  }
});

// Delete department
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete department'
    });
  }
});

/**
 * @swagger
 * /departments/{id}/budget:
 *   post:
 *     summary: Allocate budget to department
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/budget', auth, adminAuth, [
  body('amount').isNumeric().withMessage('Amount must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { amount } = req.body;
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    department.budget.total += amount;
    department.budget.allocated += amount;
    department.budget.remaining += amount;
    
    await department.save();

    res.json({
      success: true,
      message: 'Budget allocated successfully',
      data: { department }
    });
  } catch (error) {
    console.error('Error allocating budget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to allocate budget'
    });
  }
});

module.exports = router;

