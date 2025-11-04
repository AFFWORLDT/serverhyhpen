const express = require('express');
const mongoose = require('mongoose');
const { GymSession } = require('../models/GymSession');
const User = require('../models/User');
const { auth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');

const router = express.Router();
const SMTPSettings = require('../models/SMTPSettings');
const Email = require('../utils/email');

// Helpers
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id || '');
const getEffectiveMemberId = (req, providedId) => {
  // Prefer explicit providedId; if invalid/missing and caller is a member, fallback to authenticated user id
  if (providedId && providedId !== 'undefined' && isValidObjectId(providedId)) return providedId;
  if (req.user && req.user.role === 'member' && isValidObjectId(req.user.userId)) {
    return req.user.userId;
  }
  return null;
};

// Enhanced QR Code validation and automatic check-in with session management
router.post('/qr-checkin', auth, async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR code data is required'
      });
    }

    // Parse QR code data with better error handling
    let parsedData;
    try {
      // Handle both string and object formats
      if (typeof qrData === 'string') {
        parsedData = JSON.parse(qrData);
      } else if (typeof qrData === 'object') {
        parsedData = qrData;
      } else {
        throw new Error('Invalid QR data type');
      }
    } catch (error) {
      console.error('QR data parsing error:', error);
      console.error('QR data received:', qrData);
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format',
        error: error.message
      });
    }

    // Validate QR code structure for member self-check-in
    if (parsedData.type !== 'member_self_checkin' || !parsedData.memberId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code type or missing member ID'
      });
    }

    // For persistent QR codes, skip timestamp validation
    if (!parsedData.persistent && parsedData.timestamp) {
      const qrAge = Date.now() - parsedData.timestamp;
      if (qrAge > 5 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          message: 'QR code has expired. Please generate a new one.'
        });
      }
    }

    // Find member
    const member = await User.findById(parsedData.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check if member is already checked in
    const activeSession = await GymSession.findOne({
      member: parsedData.memberId,
      checkOutTime: { $exists: false }
    }).populate('member', 'firstName lastName email phone');

    if (activeSession) {
      // Member is already checked in - show helpful information
      const checkInTime = new Date(activeSession.checkInTime);
      const currentTime = new Date();
      const durationMinutes = Math.floor((currentTime - checkInTime) / (1000 * 60));
      const durationHours = Math.floor(durationMinutes / 60);
      const remainingMinutes = durationMinutes % 60;

      return res.status(200).json({
        success: true,
        action: 'already_checked_in',
        message: `${member.firstName} ${member.lastName} is already checked in`,
        data: {
          session: activeSession,
          member: member,
          checkInTime: checkInTime,
          currentTime: currentTime,
          duration: {
            hours: durationHours,
            minutes: remainingMinutes,
            totalMinutes: durationMinutes
          },
          message: `Already checked in for ${durationHours}h ${remainingMinutes}m`,
          canCheckout: true,
          checkoutMessage: `Would you like to check ${member.firstName} out?`
        }
      });
    }

    // Create new session with proper time recording
    const checkInTime = new Date();
    const session = new GymSession({
      member: parsedData.memberId,
      checkInTime: checkInTime,
      notes: parsedData.persistent ? 'Persistent QR Code Check-in' : 'QR Code Check-in',
      checkedInBy: req.user.userId,
      sessionType: 'qr_checkin'
    });

    await session.save();
    await session.populate('member', 'firstName lastName email phone');

    // Send check-in notification email if SMTP configured
    try {
      if (session.member?.email) {
        const html = Email.templates.checkinConfirmationTemplate({
          firstName: session.member.firstName,
          checkInTime: new Date(session.checkInTime).toLocaleTimeString()
        });
        await Email.sendEmail({ 
          to: session.member.email, 
          subject: `Check-in Confirmed - ${session.member.firstName}`, 
          html 
        });
      }
    } catch (e) {
      console.error('Check-in email error:', e.message);
    }

    res.json({
      success: true,
      action: 'checkin',
      message: `QR check-in successful for ${member.firstName} ${member.lastName}`,
      data: {
        session: session,
        member: member,
        checkInTime: checkInTime,
        message: `Welcome ${member.firstName}! Checked in at ${checkInTime.toLocaleTimeString()}`
      }
    });

  } catch (error) {
    console.error('QR check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'QR check-in failed',
      error: error.message
    });
  }
});

// Generate persistent QR code data for member (doesn't expire)
router.get('/qr-data/:memberId', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Create persistent QR data for member self-check-in/check-out
    const qrData = {
      type: 'member_self_checkin',
      action: 'toggle', // toggle between check-in and check-out
      memberId: memberId,
      gymId: 'hypgym_dubai',
      memberName: `${member.firstName} ${member.lastName}`,
      memberEmail: member.email,
      memberPhone: member.phone,
      // No timestamp - this QR code is persistent
      persistent: true,
      // Add instructions for the system
      instructions: 'Scan this QR code to check-in or check-out automatically'
    };

    res.json({
      success: true,
      data: {
        qrData: JSON.stringify(qrData),
        member: member,
        persistent: true
      }
    });

  } catch (error) {
    console.error('QR data generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR data',
      error: error.message
    });
  }
});

// Get attendance analytics and insights (Luxury Feature)
router.get('/analytics', auth, async (req, res) => {
  try {
    const { period = '30d', startDate, endDate } = req.query;
    
    // Calculate date range
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.checkInTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateFilter.checkInTime = { $gte: start };
    }

    // Total check-ins
    const totalCheckins = await GymSession.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);

    // Daily attendance trend
    const dailyAttendance = await GymSession.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$checkInTime' },
            month: { $month: '$checkInTime' },
            day: { $dayOfMonth: '$checkInTime' }
          },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Peak hours analysis
    const peakHours = await GymSession.aggregate([
      { $match: dateFilter },
      { $group: { _id: { $hour: '$checkInTime' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Most active members
    const topMembers = await GymSession.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$member', count: { $sum: 1 }, totalDuration: { $sum: '$duration' } } },
      { $sort: { count: -1 } },
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

    // Weekly patterns
    const weeklyPatterns = await GymSession.aggregate([
      { $match: dateFilter },
      { $group: { _id: { $dayOfWeek: '$checkInTime' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Average session duration
    const avgSessionDuration = await GymSession.aggregate([
      { $match: { ...dateFilter, duration: { $exists: true } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]);

    // Monthly growth
    const monthlyGrowth = await GymSession.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$checkInTime' },
            month: { $month: '$checkInTime' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalCheckins: totalCheckins[0]?.total || 0,
        dailyAttendance,
        peakHours,
        topMembers,
        weeklyPatterns,
        avgSessionDuration: avgSessionDuration[0]?.avgDuration || 0,
        monthlyGrowth,
        period,
        dateRange: {
          start: dateFilter.checkInTime?.$gte || new Date(),
          end: dateFilter.checkInTime?.$lte || new Date()
        }
      }
    });

  } catch (error) {
    console.error('Attendance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance analytics'
    });
  }
});

// Get attendance insights and predictions (Luxury Feature)
router.get('/insights', auth, async (req, res) => {
  try {
    // Get last 6 months data for predictions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Monthly attendance trends
    const monthlyTrend = await GymSession.aggregate([
      { $match: { checkInTime: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$checkInTime' },
            month: { $month: '$checkInTime' }
          },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Calculate growth rate
    const growthRate = monthlyTrend.length > 1 ? 
      ((monthlyTrend[monthlyTrend.length - 1].count - monthlyTrend[monthlyTrend.length - 2].count) / 
       monthlyTrend[monthlyTrend.length - 2].count * 100) : 0;

    // Busiest days of the week
    const busiestDays = await GymSession.aggregate([
      { $match: { checkInTime: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dayOfWeek: '$checkInTime' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Attendance patterns by hour
    const hourlyPatterns = await GymSession.aggregate([
      { $match: { checkInTime: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $hour: '$checkInTime' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Member retention analysis
    const retentionAnalysis = await GymSession.aggregate([
      { $match: { checkInTime: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: '$member',
          totalSessions: { $sum: 1 },
          firstSession: { $min: '$checkInTime' },
          lastSession: { $max: '$checkInTime' }
        }
      },
      {
        $project: {
          daysSinceFirst: {
            $divide: [
              { $subtract: [new Date(), '$firstSession'] },
              1000 * 60 * 60 * 24
            ]
          },
          daysSinceLast: {
            $divide: [
              { $subtract: [new Date(), '$lastSession'] },
              1000 * 60 * 60 * 24
            ]
          },
          totalSessions: 1
        }
      },
      {
        $group: {
          _id: null,
          avgSessionsPerMember: { $avg: '$totalSessions' },
          avgDaysSinceLastVisit: { $avg: '$daysSinceLast' },
          totalActiveMembers: { $sum: 1 }
        }
      }
    ]);

    // Attendance forecast
    const forecast = monthlyTrend.length >= 3 ? 
      monthlyTrend[monthlyTrend.length - 1].count + (growthRate / 100 * monthlyTrend[monthlyTrend.length - 1].count) : 0;

    res.json({
      success: true,
      data: {
        monthlyTrend,
        growthRate: Math.round(growthRate * 100) / 100,
        busiestDays,
        hourlyPatterns,
        retentionAnalysis: retentionAnalysis[0] || {},
        forecast: Math.round(forecast),
        insights: {
          trend: growthRate > 0 ? 'Growing' : growthRate < 0 ? 'Declining' : 'Stable',
          recommendation: growthRate > 10 ? 'Excellent attendance! Consider expanding capacity.' : 
                          growthRate < -10 ? 'Attendance declining. Review member engagement.' : 
                          'Steady attendance. Focus on member retention.'
        }
      }
    });

  } catch (error) {
    console.error('Attendance insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance insights'
    });
  }
});

// Get member attendance heatmap (Luxury Feature)
router.get('/heatmap/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const start = new Date();
    start.setDate(start.getDate() - days);

    // Get member's attendance data
    const attendanceData = await GymSession.aggregate([
      { 
        $match: { 
          member: new mongoose.Types.ObjectId(memberId),
          checkInTime: { $gte: start }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$checkInTime' },
            month: { $month: '$checkInTime' },
            day: { $dayOfMonth: '$checkInTime' },
            hour: { $hour: '$checkInTime' }
          },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    // Create heatmap data structure
    const heatmapData = [];
    for (let i = 0; i < 24; i++) {
      heatmapData[i] = [];
      for (let j = 0; j < days; j++) {
        heatmapData[i][j] = 0;
      }
    }

    // Populate heatmap data
    attendanceData.forEach(entry => {
      const hour = entry._id.hour;
      const dayIndex = Math.floor((new Date(entry._id.year, entry._id.month - 1, entry._id.day) - start) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < days) {
        heatmapData[hour][dayIndex] = entry.count;
      }
    });

    res.json({
      success: true,
      data: {
        heatmapData,
        period,
        memberId,
        totalSessions: attendanceData.reduce((sum, entry) => sum + entry.count, 0)
      }
    });

  } catch (error) {
    console.error('Attendance heatmap error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance heatmap'
    });
  }
});

/**
 * @swagger
 * /checkin/checkin:
 *   post:
 *     summary: Check-in member to gym
 *     tags: [Check-in]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId:
 *                 type: string
 *                 description: Member ID (optional for members)
 *     responses:
 *       200:
 *         description: Check-in successful
 *       400:
 *         description: Already checked in or error
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// Check-in endpoint
router.post('/checkin', auth, async (req, res) => {
  try {
    const { memberId, notes } = req.body;
    const userId = req.user.userId;

    const effectiveMemberId = getEffectiveMemberId(req, memberId);
    if (!effectiveMemberId) {
      return res.status(400).json({ success: false, message: 'Invalid or missing memberId' });
    }

    // Verify member exists and is active
    const member = await User.findById(effectiveMemberId);
    if (!member || member.role !== 'member' || !member.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or inactive'
      });
    }

    // Check if member already has an active session
    const activeSession = await GymSession.findOne({
      member: effectiveMemberId,
      checkOutTime: null
    });

    if (activeSession) {
      // Member is already checked in - show helpful information instead of error
      const checkInTime = new Date(activeSession.checkInTime);
      const currentTime = new Date();
      const durationMinutes = Math.floor((currentTime - checkInTime) / (1000 * 60));
      const durationHours = Math.floor(durationMinutes / 60);
      const remainingMinutes = durationMinutes % 60;

      return res.status(200).json({
        success: true,
        action: 'already_checked_in',
        message: `${member.firstName} ${member.lastName} is already checked in`,
        data: {
          session: activeSession,
          member: member,
          checkInTime: checkInTime,
          currentTime: currentTime,
          duration: {
            hours: durationHours,
            minutes: remainingMinutes,
            totalMinutes: durationMinutes
          },
          message: `Already checked in for ${durationHours}h ${remainingMinutes}m`,
          canCheckout: true,
          checkoutMessage: `Would you like to check ${member.firstName} out?`
        }
      });
    }

    // Create new session
    const session = new GymSession({
      member: effectiveMemberId,
      checkInTime: new Date(),
      notes: notes || '',
      checkedInBy: userId
    });

    await session.save();

    // Populate member details
    await session.populate('member', 'firstName lastName email phone');

    // Send check-out summary email if SMTP configured
    try {
      if (session.member?.email) {
        const html = Email.templates.checkoutSummaryTemplate({
          firstName: session.member.firstName,
          checkOutTime: new Date(session.checkOutTime).toLocaleTimeString(),
          duration: session.duration
        });
        await Email.sendEmail({ 
          to: session.member.email, 
          subject: `Check-out Summary - ${session.member.firstName}`, 
          html 
        });
      }
    } catch (e) {
      console.error('Check-out email error:', e.message);
    }

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
    let { memberId } = req.params;
    memberId = getEffectiveMemberId(req, memberId);
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Invalid or missing memberId' });
    }

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
    let { memberId } = req.params;
    memberId = getEffectiveMemberId(req, memberId);
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Invalid or missing memberId' });
    }
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
