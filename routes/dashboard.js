const express = require('express');
const { GymSession } = require('../models/GymSession');
const { Membership } = require('../models/Membership');
const Payment = require('../models/Payment');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Check-in member
router.post('/checkin', auth, async (req, res) => {
  try {
    const { memberId } = req.body;

    // Check if member has active membership
    const activeMembership = await Membership.findOne({
      member: memberId,
      status: 'active',
      endDate: { $gt: new Date() }
    });

    if (!activeMembership) {
      return res.status(400).json({
        success: false,
        message: 'Member does not have an active membership'
      });
    }

    // Check if member is already checked in
    const existingSession = await GymSession.findOne({
      member: memberId,
      checkOutTime: { $exists: false }
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'Member is already checked in'
      });
    }

    // Create new gym session
    const session = new GymSession({
      member: memberId,
      checkInTime: new Date()
    });

    await session.save();

    res.status(201).json({
      success: true,
      message: 'Member checked in successfully',
      data: { session }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
});

// Check-out member
router.post('/checkout', auth, async (req, res) => {
  try {
    const { memberId } = req.body;

    // Find active session
    const session = await GymSession.findOne({
      member: memberId,
      checkOutTime: { $exists: false }
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Member is not checked in'
      });
    }

    // Update session with checkout time
    session.checkOutTime = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Member checked out successfully',
      data: { session }
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-out'
    });
  }
});

// Get current gym sessions
router.get('/sessions/current', auth, async (req, res) => {
  try {
    const sessions = await GymSession.find({
      checkOutTime: { $exists: false }
    })
    .populate('member', 'firstName lastName email phone')
    .sort({ checkInTime: -1 });

    res.json({
      success: true,
      data: { sessions }
    });

  } catch (error) {
    console.error('Get current sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching current sessions'
    });
  }
});

// Get gym session history
router.get('/sessions/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const memberId = req.query.memberId || '';

    let query = {};
    if (memberId) {
      query.member = memberId;
    }

    const sessions = await GymSession.find(query)
      .populate('member', 'firstName lastName email phone')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limit);

    const total = await GymSession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session history'
    });
  }
});

// Get member's membership status
router.get('/membership-status/:memberId', auth, async (req, res) => {
  try {
    const membership = await Membership.findOne({
      member: req.params.memberId,
      status: 'active'
    })
    .populate('plan')
    .populate('member', 'firstName lastName email phone');

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    // Check if membership is expired
    const isExpired = new Date() > membership.endDate;
    if (isExpired) {
      membership.status = 'expired';
      await membership.save();
    }

    res.json({
      success: true,
      data: { membership }
    });

  } catch (error) {
    console.error('Get membership status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching membership status'
    });
  }
});

// Get member's payment history
router.get('/payment-history/:memberId', auth, async (req, res) => {
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
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment history'
    });
  }
});

// Get today's statistics
router.get('/today-stats', auth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Today's check-ins
    const todayCheckIns = await GymSession.countDocuments({
      checkInTime: { $gte: startOfDay, $lte: endOfDay }
    });

    // Currently in gym
    const currentlyInGym = await GymSession.countDocuments({
      checkOutTime: { $exists: false }
    });

    // Today's revenue
    const todayRevenue = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        checkIns: todayCheckIns,
        currentlyInGym,
        revenue: todayRevenue[0] || { total: 0, count: 0 }
      }
    });

  } catch (error) {
    console.error('Get today stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching today\'s statistics'
    });
  }
});

module.exports = router;

