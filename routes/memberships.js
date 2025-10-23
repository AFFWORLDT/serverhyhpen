const express = require('express');
const { body, validationResult } = require('express-validator');
const { MembershipPlan, Membership } = require('../models/Membership');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all membership plans
router.get('/plans', auth, async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ isActive: true })
      .sort({ price: 1 });

    res.json({
      success: true,
      data: { plans }
    });

  } catch (error) {
    console.error('Get membership plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership plans'
    });
  }
});

// Create membership plan (Admin only)
router.post('/plans', auth, adminAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Plan name must be at least 2 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 month'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('features').isArray().withMessage('Features must be an array')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, duration, price, features, maxMembers } = req.body;

    const plan = new MembershipPlan({
      name,
      description,
      duration,
      price,
      features,
      maxMembers
    });

    await plan.save();

    res.status(201).json({
      success: true,
      message: 'Membership plan created successfully',
      data: { plan }
    });

  } catch (error) {
    console.error('Create membership plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating membership plan'
    });
  }
});

// Update membership plan (Admin only)
router.put('/plans/:id', auth, adminAuth, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('duration').optional().isInt({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }),
  body('features').optional().isArray()
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = ['name', 'description', 'duration', 'price', 'features', 'maxMembers', 'isActive'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const plan = await MembershipPlan.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Membership plan updated successfully',
      data: { plan }
    });

  } catch (error) {
    console.error('Update membership plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating membership plan'
    });
  }
});

// Get all memberships
router.get('/', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';

    let query = {};
    if (status) {
      query.status = status;
    }

    const memberships = await Membership.find(query)
      .populate('member', 'firstName lastName email phone')
      .populate('plan')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Membership.countDocuments(query);

    res.json({
      success: true,
      data: {
        memberships,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get memberships error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching memberships'
    });
  }
});

// Create new membership (Admin only)
router.post('/', auth, adminAuth, [
  body('memberId').isMongoId().withMessage('Valid member ID is required'),
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'online']).withMessage('Valid payment method is required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('paidAmount').isFloat({ min: 0 }).withMessage('Paid amount must be a positive number')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { memberId, planId, paymentMethod, totalAmount, paidAmount, notes, autoRenew } = req.body;

    // Check if member exists
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check if plan exists
    const plan = await MembershipPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found or inactive'
      });
    }

    // Check if member already has an active membership
    const existingMembership = await Membership.findOne({
      member: memberId,
      status: 'active'
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: 'Member already has an active membership'
      });
    }

    // Create new membership
    const membership = new Membership({
      member: memberId,
      plan: planId,
      paymentMethod,
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      notes,
      autoRenew: autoRenew || false
    });

    await membership.save();

    // Populate the membership with member and plan details
    await membership.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'plan' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Membership created successfully',
      data: { membership }
    });

  } catch (error) {
    console.error('Create membership error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating membership'
    });
  }
});

// Get membership by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id)
      .populate('member', 'firstName lastName email phone')
      .populate('plan');

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found'
      });
    }

    res.json({
      success: true,
      data: { membership }
    });

  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership'
    });
  }
});

// Update membership status (Admin only)
router.put('/:id/status', auth, adminAuth, [
  body('status').isIn(['active', 'expired', 'cancelled', 'suspended']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status, notes } = req.body;

    const membership = await Membership.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    ).populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'plan' }
    ]);

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found'
      });
    }

    res.json({
      success: true,
      message: 'Membership status updated successfully',
      data: { membership }
    });

  } catch (error) {
    console.error('Update membership status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating membership status'
    });
  }
});

// Renew membership (Admin only)
router.post('/:id/renew', auth, adminAuth, [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'online']).withMessage('Valid payment method is required'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('paidAmount').isFloat({ min: 0 }).withMessage('Paid amount must be a positive number')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { planId, paymentMethod, totalAmount, paidAmount, notes, autoRenew } = req.body;

    // Get existing membership
    const existingMembership = await Membership.findById(req.params.id);
    if (!existingMembership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found'
      });
    }

    // Check if plan exists
    const plan = await MembershipPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found or inactive'
      });
    }

    // Create new membership (renewal)
    const membership = new Membership({
      member: existingMembership.member,
      plan: planId,
      paymentMethod,
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      notes,
      autoRenew: autoRenew || false
    });

    await membership.save();

    // Populate the membership with member and plan details
    await membership.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'plan' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Membership renewed successfully',
      data: { membership }
    });

  } catch (error) {
    console.error('Renew membership error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while renewing membership'
    });
  }
});

module.exports = router;

