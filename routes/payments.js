const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const { Membership } = require('../models/Membership');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');

const router = express.Router();
const SMTPSettings = require('../models/SMTPSettings');
const Email = require('../utils/email');

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
      // Implement PDF generation using pdfGenerator
      const { generateReceiptPDF } = require('../utils/pdfGenerator');
      const CompanySettings = require('../models/CompanySettings');
      
      try {
        const companySettings = await CompanySettings.findOne() || new CompanySettings();
        
        // Create a receipt-like object from report data
        const receiptData = {
          receiptNumber: `RPT-${Date.now()}`,
          paymentDate: new Date(),
          amount: report.totalRevenue,
          paymentMethod: 'report',
          member: { firstName: 'Report', lastName: 'Summary' },
          description: `Payment Report - ${period}`
        };
        
        const pdfBuffer = await generateReceiptPDF(receiptData, null, companySettings);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Payment-Report-${Date.now()}.pdf`);
        res.send(pdfBuffer);
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        res.status(500).json({
          success: false,
          message: 'Failed to generate PDF report',
          data: report
        });
      }
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

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of payments
 */
// Get all payments
// Get all payments (Admin/Staff only - Trainers cannot see payments)
router.get('/', auth, async (req, res) => {
  // Only admin and staff can access payment information
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Payment information is confidential.'
    });
  }
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';
    const memberId = req.query.memberId || '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let query = {};
    if (status) {
      query.status = status;
    }
    if (memberId) {
      query.member = memberId;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const payments = await Payment.find(query)
      .populate('member', 'firstName lastName email phone profileImage')
      .populate('membership', 'plan name status')
      .populate('processedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use .lean() for better performance

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

    // Send receipt email if SMTP is configured
    try {
      if (payment.member?.email) {
        const html = Email.templates.paymentReceiptTemplate({
          firstName: payment.member.firstName,
          receiptNumber: payment.receiptNumber,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          date: new Date(payment.createdAt).toLocaleString()
        });
        await Email.sendEmail({ 
          to: payment.member.email, 
          subject: `Payment Receipt - ${payment.receiptNumber}`, 
          html 
        });
      }
    } catch (e) {
      console.error('Payment receipt email error:', e.message);
    }

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
// Get payment by ID (Admin/Staff only - Trainers cannot see payments)
router.get('/:id', auth, async (req, res) => {
  // Only admin and staff can access payment information
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Payment information is confidential.'
    });
  }
  try {
    const payment = await Payment.findById(req.params.id)
        .populate('member', 'firstName lastName email phone profileImage')
      .populate('membership')
      .populate('processedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // If PDF requested
    if (req.query.format === 'pdf') {
      const { generateReceiptPDF } = require('../utils/pdfGenerator');
      const CompanySettings = require('../models/CompanySettings');
      
      const companySettings = await CompanySettings.findOne() || new CompanySettings();
      const pdfBuffer = await generateReceiptPDF(payment, null, companySettings);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Payment-${payment._id}.pdf`);
      res.send(pdfBuffer);
      return;
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

    // Send refund email if status is refunded
    if (status === 'refunded' && payment.member?.email) {
      try {
        const html = Email.templates.refundProcessedTemplate({
          firstName: payment.member.firstName,
          refundAmount: payment.amount,
          originalPaymentDate: new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          refundDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          receiptNumber: payment.receiptNumber,
          reason: notes || 'Refund processed'
        });
        await Email.sendEmail({
          to: payment.member.email,
          subject: `Refund Processed - ${payment.receiptNumber}`,
          html
        });
      } catch (e) {
        console.error('Refund email error:', e.message);
      }
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

// Get payments by member (Members can view their own, Admin/Staff can view any)
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Authorization: Members can only view their own payments, admin/staff can view any
    if (req.user.role === 'member' && req.user.userId.toString() !== memberId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own payments.'
      });
    }
    
    // Trainers cannot view payments
    if (req.user.role === 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Payment information is confidential.'
      });
    }

    const payments = await Payment.find({ member: memberId })
      .populate('member', 'firstName lastName email phone profileImage')
      .populate('membership', 'plan name status')
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
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Today's payments
    const todayPayments = await Payment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfToday,
            $lte: endOfToday
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

    // Pending payments count
    const pendingCount = await Payment.countDocuments({ status: 'pending' });

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
        pending: pendingCount,
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

// Generate invoice (Admin only)
router.post('/:id/invoice', auth, adminAuth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
        .populate('member', 'firstName lastName email phone profileImage')
      .populate('membership')
      .populate('processedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${payment._id.toString().slice(-6)}`;

    // Send invoice email
    try {
      if (payment.member?.email) {
        const html = Email.templates.invoiceGeneratedTemplate({
          firstName: payment.member.firstName,
          invoiceNumber,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          description: payment.description || 'Gym Membership Payment',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          invoiceDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        });
        await Email.sendEmail({
          to: payment.member.email,
          subject: `Invoice ${invoiceNumber} - Payment Required`,
          html
        });
      }
    } catch (e) {
      console.error('Invoice email error:', e.message);
    }

    res.json({
      success: true,
      message: 'Invoice generated and sent successfully',
      data: { invoiceNumber, payment }
    });

  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating invoice'
    });
  }
});

// Process refund (Admin only)
router.post('/:id/refund', auth, adminAuth, [
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('reason').optional().trim().isLength({ min: 5 }).withMessage('Reason must be at least 5 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, reason } = req.body;

    const payment = await Payment.findById(req.params.id)
        .populate('member', 'firstName lastName email phone profileImage')
      .populate('membership')
      .populate('processedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const refundAmount = amount || payment.amount;

    // Update payment status to refunded
    payment.status = 'refunded';
    payment.notes = reason || 'Refund processed';
    await payment.save();

    // Send refund email
    try {
      if (payment.member?.email) {
        const html = Email.templates.refundProcessedTemplate({
          firstName: payment.member.firstName,
          refundAmount,
          originalPaymentDate: new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          refundDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          receiptNumber: payment.receiptNumber,
          reason: reason || 'Refund processed'
        });
        await Email.sendEmail({
          to: payment.member.email,
          subject: `Refund Processed - ${payment.receiptNumber}`,
          html
        });
      }
    } catch (e) {
      console.error('Refund email error:', e.message);
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { payment, refundAmount }
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund'
    });
  }
});

module.exports = router;
