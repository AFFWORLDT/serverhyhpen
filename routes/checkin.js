const express = require('express');
const mongoose = require('mongoose');
const { GymSession } = require('../models/GymSession');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Check-in endpoint
router.post('/checkin', auth, async (req, res) => {
  try {
    const { memberId, notes } = req.body;
    const userId = req.user.userId;

    // Verify member exists and is active
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member' || !member.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or inactive'
      });
    }

    // Check if member already has an active session
    const activeSession = await GymSession.findOne({
      member: memberId,
      checkOutTime: null
    });

    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: 'Member already has an active session'
      });
    }

    // Create new session
    const session = new GymSession({
      member: memberId,
      checkInTime: new Date(),
      notes: notes || '',
      checkedInBy: userId
    });

    await session.save();

    // Populate member details
    await session.populate('member', 'firstName lastName email phone');

    res.json({
      success: true,
      message: 'Check-in successful',
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

// Check-out endpoint
router.post('/checkout/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    const userId = req.user.userId;

    // Find the session
    const session = await GymSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Session already checked out'
      });
    }

    // Calculate duration
    const checkInTime = new Date(session.checkInTime);
    const checkOutTime = new Date();
    const duration = Math.round((checkOutTime - checkInTime) / (1000 * 60)); // in minutes

    // Update session
    session.checkOutTime = checkOutTime;
    session.duration = duration;
    session.notes = session.notes + (notes ? ` | Check-out: ${notes}` : '');
    session.checkedOutBy = userId;

    await session.save();

    // Populate member details
    await session.populate('member', 'firstName lastName email phone');

    res.json({
      success: true,
      message: 'Check-out successful',
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

// Get active sessions
router.get('/active', auth, async (req, res) => {
  try {
    const activeSessions = await GymSession.find({
      checkOutTime: null
    }).populate('member', 'firstName lastName email phone')
      .populate('checkedInBy', 'firstName lastName')
      .sort({ checkInTime: -1 });

    res.json({
      success: true,
      data: { sessions: activeSessions }
    });

  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active sessions'
    });
  }
});

// Get member's current session
router.get('/member/:memberId/current', auth, async (req, res) => {
  try {
    const { memberId } = req.params;

    const currentSession = await GymSession.findOne({
      member: memberId,
      checkOutTime: null
    }).populate('member', 'firstName lastName email phone')
      .populate('checkedInBy', 'firstName lastName');

    res.json({
      success: true,
      data: { session: currentSession }
    });

  } catch (error) {
    console.error('Get current session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching current session'
    });
  }
});

// Get session history for a member
router.get('/member/:memberId/history', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sessions = await GymSession.find({
      member: memberId
    }).populate('member', 'firstName lastName email phone')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limit);

    const total = await GymSession.countDocuments({ member: memberId });

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

// Get today's sessions
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySessions = await GymSession.find({
      checkInTime: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('member', 'firstName lastName email phone')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName')
      .sort({ checkInTime: -1 });

    // Calculate stats
    const totalSessions = todaySessions.length;
    const activeSessions = todaySessions.filter(s => !s.checkOutTime).length;
    const completedSessions = todaySessions.filter(s => s.checkOutTime).length;
    const totalDuration = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    res.json({
      success: true,
      data: {
        sessions: todaySessions,
        stats: {
          total: totalSessions,
          active: activeSessions,
          completed: completedSessions,
          totalDuration
        }
      }
    });

  } catch (error) {
    console.error('Get today sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching today sessions'
    });
  }
});

// Force checkout (admin only)
router.post('/force-checkout/:sessionId', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const { sessionId } = req.params;
    const { reason } = req.body;

    const session = await GymSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Session already checked out'
      });
    }

    // Force checkout
    const checkInTime = new Date(session.checkInTime);
    const checkOutTime = new Date();
    const duration = Math.round((checkOutTime - checkInTime) / (1000 * 60));

    session.checkOutTime = checkOutTime;
    session.duration = duration;
    session.notes = session.notes + ` | Force checkout: ${reason || 'No reason provided'}`;
    session.checkedOutBy = req.user.userId;

    await session.save();

    await session.populate('member', 'firstName lastName email phone');

    res.json({
      success: true,
      message: 'Force checkout successful',
      data: { session }
    });

  } catch (error) {
    console.error('Force checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during force checkout'
    });
  }
});

module.exports = router;


