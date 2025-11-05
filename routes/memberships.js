const express = require('express');
const { body, validationResult } = require('express-validator');
const { MembershipPlan, Membership } = require('../models/Membership');
const MemberPackage = require('../models/MemberPackage');
const Package = require('../models/Package');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const Email = require('../utils/email');

const router = express.Router();

// Get membership analytics and insights (Luxury Feature)
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

    // Total memberships sold
    const totalMemberships = await Membership.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);

    // Revenue by membership type
    const revenueByType = await Membership.aggregate([
      { $match: { ...dateFilter, status: 'active' } },
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData'
        }
      },
      { $unwind: '$planData' },
      { $group: { _id: '$planData.name', total: { $sum: '$planData.price' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // Membership status distribution
    const statusDistribution = await Membership.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Monthly membership growth
    const monthlyGrowth = await Membership.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top membership plans
    const topPlans = await Membership.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData'
        }
      },
      { $unwind: '$planData' },
      { $group: { _id: '$planData.name', count: { $sum: 1 }, revenue: { $sum: '$planData.price' } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Membership retention rate
    const retentionRate = await Membership.aggregate([
      { $match: { ...dateFilter, status: 'active' } },
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData'
        }
      },
      { $unwind: '$planData' },
      {
        $group: {
          _id: '$planData.name',
          total: { $sum: 1 },
          renewed: {
            $sum: {
              $cond: [
                { $gt: ['$renewalDate', new Date()] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          retentionRate: {
            $multiply: [
              { $divide: ['$renewed', '$total'] },
              100
            ]
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalMemberships: totalMemberships[0]?.total || 0,
        revenueByType,
        statusDistribution,
        monthlyGrowth,
        topPlans,
        retentionRate,
        period,
        dateRange: {
          start: dateFilter.createdAt?.$gte || new Date(),
          end: dateFilter.createdAt?.$lte || new Date()
        }
      }
    });

  } catch (error) {
    console.error('Membership analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership analytics'
    });
  }
});

// Get membership insights and predictions (Luxury Feature)
router.get('/insights', auth, adminAuth, async (req, res) => {
  try {
    // Get last 6 months data for predictions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Monthly membership trends
    const monthlyTrend = await Membership.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate growth rate
    const growthRate = monthlyTrend.length > 1 ? 
      ((monthlyTrend[monthlyTrend.length - 1].count - monthlyTrend[monthlyTrend.length - 2].count) / 
       monthlyTrend[monthlyTrend.length - 2].count * 100) : 0;

    // Popular membership times
    const popularTimes = await Membership.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Membership plan preferences
    const planPreferences = await Membership.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData'
        }
      },
      { $unwind: '$planData' },
      { $group: { _id: '$planData.name', count: { $sum: 1 }, revenue: { $sum: '$planData.price' } } },
      { $sort: { count: -1 } }
    ]);

    // Churn analysis
    const churnAnalysis = await Membership.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    // Revenue forecast
    const forecast = monthlyTrend.length >= 3 ? 
      monthlyTrend[monthlyTrend.length - 1].count + (growthRate / 100 * monthlyTrend[monthlyTrend.length - 1].count) : 0;

    res.json({
      success: true,
      data: {
        monthlyTrend,
        growthRate: Math.round(growthRate * 100) / 100,
        popularTimes,
        planPreferences,
        churnAnalysis,
        forecast: Math.round(forecast),
        insights: {
          trend: growthRate > 0 ? 'Growing' : growthRate < 0 ? 'Declining' : 'Stable',
          recommendation: growthRate > 10 ? 'Excellent growth! Consider expanding plans.' : 
                          growthRate < -10 ? 'Membership declining. Review pricing strategy.' : 
                          'Steady performance. Focus on retention.'
        }
      }
    });

  } catch (error) {
    console.error('Membership insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership insights'
    });
  }
});

// Get membership tiers and benefits (Luxury Feature)
router.get('/tiers', auth, async (req, res) => {
  try {
    const tiers = [
      {
        name: 'Bronze',
        level: 1,
        color: '#CD7F32',
        benefits: ['Basic gym access', 'Locker room access', 'Basic equipment'],
        priceRange: { min: 100, max: 200 },
        icon: '🥉'
      },
      {
        name: 'Silver',
        level: 2,
        color: '#C0C0C0',
        benefits: ['All Bronze benefits', 'Group classes', 'Personal trainer consultation', 'Sauna access'],
        priceRange: { min: 200, max: 400 },
        icon: '🥈'
      },
      {
        name: 'Gold',
        level: 3,
        color: '#FFD700',
        benefits: ['All Silver benefits', 'Premium equipment', 'Nutrition consultation', 'Spa access'],
        priceRange: { min: 400, max: 600 },
        icon: '🥇'
      },
      {
        name: 'Platinum',
        level: 4,
        color: '#E5E4E2',
        benefits: ['All Gold benefits', 'VIP lounge', 'Concierge service', 'Guest passes'],
        priceRange: { min: 600, max: 800 },
        icon: '💎'
      },
      {
        name: 'Diamond',
        level: 5,
        color: '#B9F2FF',
        benefits: ['All Platinum benefits', 'Private training', 'Exclusive events', 'Priority booking'],
        priceRange: { min: 800, max: 1200 },
        icon: '💠'
      }
    ];

    res.json({
      success: true,
      data: { tiers }
    });

  } catch (error) {
    console.error('Membership tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership tiers'
    });
  }
});

// Upgrade membership tier (Luxury Feature)
router.post('/upgrade', auth, adminAuth, [
  body('memberId').isMongoId().withMessage('Valid member ID is required'),
  body('newTier').isIn(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']).withMessage('Valid tier is required'),
  body('reason').optional().trim()
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

    const { memberId, newTier, reason } = req.body;

    // Find member
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get old tier for comparison
    const oldTier = member.membershipType || 'bronze';

    // Update member's membership tier
    member.membershipType = newTier.toLowerCase();
    member.membershipNotes = reason || `Upgraded to ${newTier} tier`;
    await member.save();

    // Send membership upgraded email
    try {
      if (member.email) {
        const html = Email.templates.membershipUpgradedTemplate({
          firstName: member.firstName,
          oldPlan: oldTier.charAt(0).toUpperCase() + oldTier.slice(1),
          newPlan: newTier,
          upgradeDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          priceDifference: 0 // Can be calculated if needed
        });
        await Email.sendEmail({
          to: member.email,
          subject: `Congratulations! Your Membership Has Been Upgraded to ${newTier}`,
          html
        });
      }
    } catch (e) {
      console.error('Membership upgraded email error:', e.message);
    }

    // Log the upgrade
    console.log(`Member ${member.firstName} ${member.lastName} upgraded to ${newTier} tier`);

    res.json({
      success: true,
      message: `Member successfully upgraded to ${newTier} tier`,
      data: { member }
    });

  } catch (error) {
    console.error('Membership upgrade error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while upgrading membership'
    });
  }
});

// Get membership loyalty points (Luxury Feature)
router.get('/loyalty/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Calculate loyalty points based on membership duration and payments
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Calculate points (simplified logic)
    const membershipDuration = member.membershipStartDate ? 
      Math.floor((new Date() - new Date(member.membershipStartDate)) / (1000 * 60 * 60 * 24 * 30)) : 0;
    
    const basePoints = membershipDuration * 100; // 100 points per month
    const tierMultiplier = {
      'bronze': 1,
      'silver': 1.2,
      'gold': 1.5,
      'platinum': 2,
      'diamond': 3
    };
    
    const totalPoints = Math.floor(basePoints * (tierMultiplier[member.membershipType] || 1));
    const nextTierPoints = Math.ceil(totalPoints * 1.5);

    res.json({
      success: true,
      data: {
        currentPoints: totalPoints,
        tier: member.membershipType,
        nextTierPoints,
        membershipDuration,
        benefits: [
          'Free guest passes',
          'Priority booking',
          'Exclusive events',
          'Personal training discounts'
        ]
      }
    });

  } catch (error) {
    console.error('Loyalty points error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loyalty points'
    });
  }
});

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
router.post('/plans', auth, adminOrTrainerOrStaffAuth, [
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

// Get member's own memberships (allow members to access their own data)
router.get('/my-memberships', auth, async (req, res) => {
  try {
    const memberId = req.user.userId;
    
    // Return packages instead of memberships - packages ARE memberships
    const packages = await MemberPackage.find({ member: memberId })
      .populate('package', 'name sessions pricePerSession totalPrice validityMonths features')
      .populate('assignedTrainer', 'firstName lastName email profileImage')
      .populate('purchasedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { memberships: packages } // Keep 'memberships' key for backward compatibility
    });

  } catch (error) {
    console.error('Get my packages (memberships) error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching packages'
    });
  }
});

// Get all memberships
router.get('/', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
router.post('/', auth, adminOrTrainerOrStaffAuth, [
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

    // Calculate end date based on plan duration
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.duration);

    // Create new membership
    const membership = new Membership({
      member: memberId,
      plan: planId,
      startDate,
      endDate,
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

    // Send membership assigned email
    try {
      if (membership.member?.email) {
        const html = Email.templates.membershipAssignedTemplate({
          firstName: membership.member.firstName,
          membershipName: membership.plan?.name || 'Membership Plan',
          startDate: membership.startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          endDate: membership.endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          price: membership.totalAmount,
          features: membership.plan?.features || []
        });
        await Email.sendEmail({
          to: membership.member.email,
          subject: `Welcome! Your ${membership.plan?.name || 'Membership'} is Active`,
          html
        });
      }
    } catch (e) {
      console.error('Membership assigned email error:', e.message);
    }

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
router.get('/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
router.put('/:id/status', auth, adminOrTrainerOrStaffAuth, [
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

    // Get old membership for comparison
    const oldMembership = await Membership.findById(req.params.id)
      .populate('member', 'firstName lastName email phone')
      .populate('plan');

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

    // Send membership cancelled email if status is cancelled
    if (status === 'cancelled' && membership.member?.email) {
      try {
        const html = Email.templates.membershipCancelledTemplate({
          firstName: membership.member.firstName,
          membershipName: membership.plan?.name || 'Membership Plan',
          cancellationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          reason: notes || 'Cancelled by admin'
        });
        await Email.sendEmail({
          to: membership.member.email,
          subject: `Your ${membership.plan?.name || 'Membership'} Has Been Cancelled`,
          html
        });
      } catch (e) {
        console.error('Membership cancelled email error:', e.message);
      }
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
router.post('/:id/renew', auth, adminOrTrainerOrStaffAuth, [
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

    // Send membership renewed email
    try {
      if (membership.member?.email) {
        const html = Email.templates.membershipRenewedTemplate({
          firstName: membership.member.firstName,
          membershipName: membership.plan?.name || 'Membership Plan',
          newEndDate: membership.endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          price: membership.totalAmount
        });
        await Email.sendEmail({
          to: membership.member.email,
          subject: `Your ${membership.plan?.name || 'Membership'} Has Been Renewed`,
          html
        });
      }
    } catch (e) {
      console.error('Membership renewed email error:', e.message);
    }

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
