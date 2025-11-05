const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const MemberPackage = require('../models/MemberPackage');
const Payment = require('../models/Payment');
const { GymSession } = require('../models/GymSession');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Total members (count all members, not just active ones)
    const totalMembers = await User.countDocuments({ role: 'member' });
    const activeMembers = await User.countDocuments({ role: 'member', isActive: true });
    const newMembersThisMonth = await User.countDocuments({
      role: 'member',
      createdAt: { $gte: startOfMonth }
    });

    // Active packages (packages ARE memberships)
    const activePackages = await MemberPackage.countDocuments({ status: 'active' });
    const expiredPackages = await MemberPackage.countDocuments({ status: 'expired' });

    // Revenue statistics
    const todayRevenue = await Payment.aggregate([
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
          total: { $sum: '$amount' }
        }
      }
    ]);

    const monthRevenue = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const yearRevenue = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Gym sessions today
    const todaySessions = await GymSession.countDocuments({
      checkInTime: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999))
      }
    });

    // Pending payments
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      data: {
        members: {
          total: totalMembers,
          newThisMonth: newMembersThisMonth
        },
        memberships: {
          active: activePackages,
          expired: expiredPackages
        },
        revenue: {
          today: todayRevenue[0]?.total || 0,
          month: monthRevenue[0]?.total || 0,
          year: yearRevenue[0]?.total || 0
        },
        sessions: {
          today: todaySessions
        },
        payments: {
          pending: pendingPayments
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics'
    });
  }
});

// Get recent activities
router.get('/activities', auth, adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Recent members
    const recentMembers = await User.find({ role: 'member' })
      .select('firstName lastName email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent payments
    const recentPayments = await Payment.find({ status: 'completed' })
      .populate('member', 'firstName lastName')
      .select('amount paymentMethod createdAt receiptNumber')
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent packages (packages ARE memberships)
    const recentPackages = await MemberPackage.find()
      .populate('member', 'firstName lastName email profileImage')
      .populate('package', 'name sessions totalPrice')
      .select('status validityStart validityEnd createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      data: {
        recentMembers,
        recentPayments,
        recentMemberships: recentPackages // Keep key name for backward compatibility
      }
    });

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent activities'
    });
  }
});

// Get revenue chart data
router.get('/revenue-chart', auth, adminAuth, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const revenueData = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
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
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: { revenueData }
    });

  } catch (error) {
    console.error('Get revenue chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching revenue chart data'
    });
  }
});

// Get package chart data (packages ARE memberships)
router.get('/membership-chart', auth, adminAuth, async (req, res) => {
  try {
    const packageStats = await MemberPackage.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const packagePlanStats = await MemberPackage.aggregate([
      {
        $lookup: {
          from: 'packages',
          localField: 'package',
          foreignField: '_id',
          as: 'packageDetails'
        }
      },
      {
        $unwind: '$packageDetails'
      },
      {
        $group: {
          _id: '$packageDetails.name',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statusStats: packageStats,
        planStats: packagePlanStats
      }
    });

  } catch (error) {
    console.error('Get membership chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership chart data'
    });
  }
});

// Create admin user (only for initial setup)
router.post('/create-admin', [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists'
      });
    }

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create admin user
    const admin = new User({
      firstName,
      lastName,
      email,
      password,
      role: 'admin',
      dateOfBirth: new Date('1990-01-01'), // Default date
      gender: 'other' // Default gender
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role
        }
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating admin user'
    });
  }
});

module.exports = router;

