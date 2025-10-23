const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const { Membership } = require('../models/Membership');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all payments
router.get('/', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';
    const memberId = req.query.memberId || '';

    let query = {};
    if (status) {
      query.status = status;
    }
    if (memberId) {
      query.member = memberId;
    }

    const payments = await Payment.find(query)
      .populate('member', 'firstName lastName email phone')
      .populate('membership')
      .populate('processedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
});

// Create new payment
router.post('/', auth, adminAuth, [
  body('membershipId').isMongoId().withMessage('Valid membership ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'online', 'stripe']).withMessage('Valid payment method is required'),
  body('description').optional().trim()
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

    const { membershipId, amount, paymentMethod, description, notes, transactionId } = req.body;

    // Check if membership exists
    const membership = await Membership.findById(membershipId)
      .populate('member');
    
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found'
      });
    }

    // Check if payment amount exceeds remaining amount
    if (amount > membership.remainingAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount cannot exceed remaining amount'
      });
    }

    // Create new payment
    const payment = new Payment({
      membership: membershipId,
      member: membership.member._id,
      amount,
      paymentMethod,
      description,
      notes,
      transactionId,
      status: 'completed',
      processedBy: req.user.userId
    });

    await payment.save();

    // Update membership paid amount and remaining amount
    membership.paidAmount += amount;
    membership.remainingAmount -= amount;
    
    // If fully paid, mark membership as active
    if (membership.remainingAmount <= 0) {
      membership.status = 'active';
    }
    
    await membership.save();

    // Populate payment details
    await payment.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'membership' },
      { path: 'processedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating payment'
    });
  }
});

// Get payment by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('member', 'firstName lastName email phone')
      .populate('membership')
      .populate('processedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment'
    });
  }
});

// Update payment status (Admin only)
router.put('/:id/status', auth, adminAuth, [
  body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Valid status is required')
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

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    ).populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'membership' },
      { path: 'processedBy', select: 'firstName lastName' }
    ]);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payment status'
    });
  }
});

// Get payments by member
router.get('/member/:memberId', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const payments = await Payment.find({ member: req.params.memberId })
      .populate('membership')
      .populate('processedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { payments }
    });

  } catch (error) {
    console.error('Get member payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching member payments'
    });
  }
});

// Get payment statistics
router.get('/stats/summary', auth, adminAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Today's payments
    const todayPayments = await Payment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(today.setHours(0, 0, 0, 0)),
            $lt: new Date(today.setHours(23, 59, 59, 999))
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // This month's payments
    const monthPayments = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // This year's payments
    const yearPayments = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Payment method breakdown
    const paymentMethodStats = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        today: todayPayments[0] || { count: 0, totalAmount: 0 },
        month: monthPayments[0] || { count: 0, totalAmount: 0 },
        year: yearPayments[0] || { count: 0, totalAmount: 0 },
        paymentMethods: paymentMethodStats
      }
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment statistics'
    });
  }
});

module.exports = router;

