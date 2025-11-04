const express = require('express');
const { body, validationResult } = require('express-validator');
const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /payroll:
 *   get:
 *     summary: Get all payroll records
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff
 *         schema:
 *           type: string
 *         description: Filter by staff ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of payroll records
 */
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { staff, status } = req.query;
    let filter = {};

    if (staff) filter.staff = staff;
    if (status) filter.status = status;

    const payrolls = await Payroll.find(filter)
      .populate('staff', 'firstName lastName email')
      .sort({ payPeriod: -1 });

    res.json({
      success: true,
      data: { payrolls }
    });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payroll records'
    });
  }
});

/**
 * @swagger
 * /payroll:
 *   post:
 *     summary: Create payroll record
 *     description: Admin creates payroll with auto-calculated gross/net salary
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
 *               - staff
 *               - baseSalary
 *               - payPeriod
 *             properties:
 *               staff:
 *                 type: string
 *                 description: Staff MongoDB ID
 *               baseSalary:
 *                 type: number
 *                 minimum: 0
 *               allowances:
 *                 type: object
 *                 properties:
 *                   housing:
 *                     type: number
 *                   transport:
 *                     type: number
 *                   medical:
 *                     type: number
 *               deductions:
 *                 type: object
 *                 properties:
 *                   tax:
 *                     type: number
 *                   insurance:
 *                     type: number
 *                   loan:
 *                     type: number
 *               payPeriod:
 *                 type: object
 *                 properties:
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *     responses:
 *       201:
 *         description: Payroll created with auto-calculated amounts
 */
router.post('/', auth, adminAuth, [
  body('staff').isMongoId(),
  body('baseSalary').isNumeric(),
  body('payPeriod.startDate').isISO8601(),
  body('payPeriod.endDate').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const payroll = new Payroll(req.body);
    await payroll.save();

    res.status(201).json({
      success: true,
      message: 'Payroll created successfully',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error creating payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payroll'
    });
  }
});

/**
 * @swagger
 * /payroll/process-monthly:
 *   post:
 *     summary: Process payroll for all staff (monthly)
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 */
router.post('/process-monthly', auth, adminAuth, [
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2020 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { month, year } = req.body;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all active staff
    const staff = await User.find({ 
      role: { $in: ['staff', 'trainer'] },
      isActive: true 
    });

    const payrolls = [];

    for (const member of staff) {
      // Check if payroll already exists
      const existing = await Payroll.findOne({
        staff: member._id,
        'payPeriod.startDate': startDate
      });

      if (existing) continue;

      const payroll = new Payroll({
        staff: member._id,
        payPeriod: {
          startDate,
          endDate
        },
        baseSalary: member.baseSalary || 3000,
        paymentDate: new Date(year, month, 25),
        status: 'pending'
      });

      await payroll.save();
      payrolls.push(payroll);
    }

    res.json({
      success: true,
      message: `Payroll processed for ${payrolls.length} staff members`,
      data: { payrolls }
    });
  } catch (error) {
    console.error('Error processing payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payroll'
    });
  }
});

// Get payroll statistics (must come before /:id)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const payrolls = await Payroll.find(filter)
      .populate('staff', 'firstName lastName');

    const stats = {
      total: payrolls.length,
      totalGrossSalary: payrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0),
      totalNetSalary: payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0),
      totalDeductions: payrolls.reduce((sum, p) => {
        const deductions = p.deductions || {};
        return sum + (deductions.tax || 0) + (deductions.insurance || 0) + (deductions.loan || 0) + (deductions.other || 0);
      }, 0),
      totalAllowances: payrolls.reduce((sum, p) => {
        const allowances = p.allowances || {};
        return sum + (allowances.housing || 0) + (allowances.transport || 0) + (allowances.medical || 0) + (allowances.other || 0);
      }, 0),
      byStatus: {},
      pending: payrolls.filter(p => p.status === 'pending').length,
      processed: payrolls.filter(p => p.status === 'processed').length,
      paid: payrolls.filter(p => p.status === 'paid').length
    };

    payrolls.forEach(p => {
      stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching payroll stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payroll statistics'
    });
  }
});

// Get single payroll record
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('staff', 'firstName lastName email phone')
      .populate('department', 'name code');
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    res.json({
      success: true,
      data: { payroll }
    });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payroll record'
    });
  }
});

// Update payroll record
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Can't update if already paid
    if (payroll.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid payroll record'
      });
    }

    Object.assign(payroll, req.body, { updatedAt: Date.now() });
    await payroll.save();

    res.json({
      success: true,
      message: 'Payroll updated successfully',
      data: { payroll }
    });
  } catch (error) {
    console.error('Error updating payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payroll'
    });
  }
});

// Delete payroll record
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Can't delete if already paid
    if (payroll.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid payroll record'
      });
    }

    await Payroll.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Payroll deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payroll'
    });
  }
});

module.exports = router;

