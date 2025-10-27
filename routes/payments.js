const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const { Membership } = require('../models/Membership');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');

const router = express.Router();

// Get payment analytics and insights (Luxury Feature)
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const { period = '30d', startDate, endDate } = req.query;
    
    // Calculate date range
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateFilter.createdAt = { $gte: start };
    }

    // Total revenue
    const totalRevenue = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Revenue by payment method
    const revenueByMethod = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // Daily revenue trend
    const dailyRevenue = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top paying members
    const topMembers = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: '$member',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          lastPayment: { $max: '$createdAt' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'member'
        }
      },
      { $unwind: '$member' }
    ]);

    // Payment status distribution
    const statusDistribution = await Payment.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Monthly growth
    const monthlyGrowth = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        revenueByMethod,
        dailyRevenue,
        topMembers,
        statusDistribution,
        monthlyGrowth,
        period,
        dateRange: {
          start: dateFilter.createdAt?.$gte || new Date(),
          end: dateFilter.createdAt?.$lte || new Date()
        }
      }
    });

  } catch (error) {
    console.error('Payment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment analytics'
    });
  }
});

// Get payment insights and predictions (Luxury Feature)
router.get('/insights', auth, adminAuth, async (req, res) => {
  try {
    // Get last 6 months data for predictions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Monthly revenue trend
    const monthlyTrend = await Payment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate growth rate
    const growthRate = monthlyTrend.length > 1 ? 
      ((monthlyTrend[monthlyTrend.length - 1].revenue - monthlyTrend[monthlyTrend.length - 2].revenue) / 
       monthlyTrend[monthlyTrend.length - 2].revenue * 100) : 0;

    // Average transaction value
    const avgTransactionValue = await Payment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$amount' } } }
    ]);

    // Peak payment hours
    const peakHours = await Payment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'completed' } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Payment method preferences
    const methodPreferences = await Payment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: 'completed' } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { count: -1 } }
    ]);

    // Revenue forecast (simple linear regression)
    const forecast = monthlyTrend.length >= 3 ? 
      monthlyTrend[monthlyTrend.length - 1].revenue + (growthRate / 100 * monthlyTrend[monthlyTrend.length - 1].revenue) : 0;

    res.json({
      success: true,
      data: {
        monthlyTrend,
        growthRate: Math.round(growthRate * 100) / 100,
        avgTransactionValue: Math.round((avgTransactionValue[0]?.avg || 0) * 100) / 100,
        peakHours,
        methodPreferences,
        forecast: Math.round(forecast * 100) / 100,
        insights: {
          trend: growthRate > 0 ? 'Growing' : growthRate < 0 ? 'Declining' : 'Stable',
          recommendation: growthRate > 10 ? 'Excellent growth! Consider expanding.' : 
                          growthRate < -10 ? 'Revenue declining. Review strategy.' : 
                          'Steady performance. Maintain current approach.'
        }
      }
    });

  } catch (error) {
    console.error('Payment insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment insights'
    });
  }
});

// Generate payment report (Luxury Feature)
router.post('/report', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json', includeCharts = true } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const dateFilter = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Comprehensive report data
    const reportData = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          avgTransactionValue: { $avg: '$amount' },
          minTransaction: { $min: '$amount' },
          maxTransaction: { $max: '$amount' }
        }
      }
    ]);

    const revenueByMethod = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const dailyBreakdown = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const topMembers = await Payment.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      { $group: { _id: '$member', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'member'
        }
      },
      { $unwind: '$member' }
    ]);

    const report = {
      period: { startDate, endDate },
      summary: reportData[0] || {},
      revenueByMethod,
      dailyBreakdown,
      topMembers,
      generatedAt: new Date(),
      generatedBy: req.user.userId
    };

    if (format === 'pdf') {
      // TODO: Implement PDF generation
      res.json({
        success: true,
        message: 'PDF report generation not yet implemented',
        data: report
      });
    } else {
      res.json({
        success: true,
        data: report
      });
    }

  } catch (error) {
    console.error('Payment report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating payment report'
    });
  }
});

// Get payment trends and forecasting (Luxury Feature)
router.get('/trends', auth, adminAuth, async (req, res) => {
  try {
    const { period = '12m' } = req.query;
    const months = period === '6m' ? 6 : period === '12m' ? 12 : 24;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Monthly revenue trends
    const monthlyTrends = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
          avgValue: { $avg: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Seasonal patterns
    const seasonalPatterns = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      { $group: { _id: { $month: '$createdAt' }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Payment method trends
    const methodTrends = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      {
        $group: {
          _id: {
            method: '$paymentMethod',
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate growth metrics
    const currentMonth = monthlyTrends[monthlyTrends.length - 1];
    const previousMonth = monthlyTrends[monthlyTrends.length - 2];
    const growthRate = previousMonth ? 
      ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100) : 0;

    res.json({
      success: true,
      data: {
        monthlyTrends,
        seasonalPatterns,
        methodTrends,
        growthRate: Math.round(growthRate * 100) / 100,
        period,
        insights: {
          bestMonth: seasonalPatterns.reduce((max, current) => 
            current.revenue > max.revenue ? current : max, seasonalPatterns[0]),
          worstMonth: seasonalPatterns.reduce((min, current) => 
            current.revenue < min.revenue ? current : min, seasonalPatterns[0]),
          trend: growthRate > 5 ? 'Strong Growth' : growthRate > 0 ? 'Moderate Growth' : 
                 growthRate > -5 ? 'Stable' : 'Declining'
        }
      }
    });

  } catch (error) {
    console.error('Payment trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment trends'
    });
  }
});

// Get all payments
router.get('/', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
router.post('/', auth, adminOrTrainerOrStaffAuth, [
  body('membershipId').optional().isMongoId().withMessage('Valid membership ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'online', 'stripe']).withMessage('Valid payment method is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    console.log('🔍 Payment creation request:', req.body);
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { membershipId, amount, paymentMethod, description, notes, transactionId, memberId } = req.body;
    console.log('🔍 Extracted data:', { membershipId, amount, paymentMethod, description, notes, transactionId, memberId });

    let membership = null;
    let member = null;

    // If membershipId is provided, validate it
    if (membershipId) {
      membership = await Membership.findById(membershipId)
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

      member = membership.member._id;
    } else if (memberId) {
      // If no membershipId but memberId is provided, validate member
      member = await User.findById(memberId);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either membershipId or memberId is required'
      });
    }

    // Create new payment
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const payment = new Payment({
      membership: membershipId || null,
      member: member,
      amount,
      paymentMethod,
      description,
      notes,
      transactionId,
      receiptNumber,
      status: 'completed',
      processedBy: req.user.userId
    });

    await payment.save();

    // Update membership paid amount and remaining amount (only if membership exists)
    if (membership) {
      membership.paidAmount += amount;
      membership.remainingAmount -= amount;
      
      // If fully paid, mark membership as active
      if (membership.remainingAmount <= 0) {
        membership.status = 'active';
      }
      
      await membership.save();
    }

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
router.get('/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
router.get('/member/:memberId', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
