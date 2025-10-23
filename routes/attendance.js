const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');

// Get attendance for an event
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check access permissions
    const hasAccess = 
      event.createdBy.toString() === req.user.userId ||
      event.assignedTo.some(user => user.toString() === req.user.userId) ||
      req.user.role === 'admin' ||
      req.user.role === 'staff';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const attendance = await Attendance.find({ event: req.params.eventId })
      .populate('user', 'firstName lastName email role')
      .populate('markedBy', 'firstName lastName email')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        event: {
          id: event._id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          type: event.type
        },
        attendance
      }
    });
  } catch (error) {
    console.error('Get event attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance'
    });
  }
});

// Get attendance for a user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { startDate, endDate, status, page = 1, limit = 50 } = req.query;
    
    const query = { user: req.params.userId };
    
    if (startDate && endDate) {
      query.markedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    
    const attendance = await Attendance.find(query)
      .populate('event', 'title startTime endTime type')
      .populate('markedBy', 'firstName lastName email')
      .sort({ markedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(query);

    res.json({
      success: true,
      data: {
        attendance,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get user attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user attendance'
    });
  }
});

// Mark attendance
router.post('/mark', auth, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Invalid status')
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

    const { eventId, userId, status, notes, location } = req.body;

    // Check if event exists
    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check permissions
    const canMarkAttendance = 
      req.user.role === 'admin' ||
      req.user.role === 'staff' ||
      event.createdBy.toString() === req.user.userId ||
      event.assignedTo.some(user => user.toString() === req.user.userId);

    if (!canMarkAttendance) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if attendance already exists
    let attendance = await Attendance.findOne({ event: eventId, user: userId });
    
    if (attendance) {
      // Update existing attendance
      attendance.status = status;
      attendance.notes = notes || attendance.notes;
      attendance.location = location || attendance.location;
      attendance.markedBy = req.user.userId;
      attendance.markedAt = new Date();
      attendance.isManual = true;

      if (status === 'present' && !attendance.checkInTime) {
        attendance.checkInTime = new Date();
      }
    } else {
      // Create new attendance record
      attendance = new Attendance({
        event: eventId,
        user: userId,
        status,
        notes,
        location,
        markedBy: req.user.userId,
        markedAt: new Date(),
        isManual: true,
        checkInTime: status === 'present' ? new Date() : null
      });
    }

    await attendance.save();

    // Populate the attendance record
    await attendance.populate([
      { path: 'user', select: 'firstName lastName email role' },
      { path: 'markedBy', select: 'firstName lastName email' },
      { path: 'event', select: 'title startTime endTime type' }
    ]);

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance'
    });
  }
});

// Check in/out
router.post('/checkin', auth, [
  body('eventId').isMongoId().withMessage('Valid event ID is required')
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

    const { eventId, location } = req.body;
    const userId = req.user.userId;

    // Check if event exists
    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is assigned to this event
    const isAssigned = 
      event.createdBy.toString() === userId ||
      event.assignedTo.some(user => user.toString() === userId);

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this event'
      });
    }

    // Find or create attendance record
    let attendance = await Attendance.findOne({ event: eventId, user: userId });
    
    if (!attendance) {
      attendance = new Attendance({
        event: eventId,
        user: userId,
        status: 'pending',
        location: location || '',
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      });
    }

    const now = new Date();
    
    if (!attendance.checkInTime) {
      // Check in
      attendance.checkInTime = now;
      attendance.status = 'present';
      attendance.location = location || attendance.location;
      
      // Check if late
      if (now > event.startTime) {
        attendance.status = 'late';
      }
      
      await attendance.save();
      
      await attendance.populate([
        { path: 'user', select: 'firstName lastName email role' },
        { path: 'event', select: 'title startTime endTime type' }
      ]);

      res.json({
        success: true,
        message: 'Checked in successfully',
        data: {
          attendance,
          action: 'checkin',
          isLate: attendance.status === 'late'
        }
      });
    } else if (!attendance.checkOutTime) {
      // Check out
      attendance.checkOutTime = now;
      await attendance.save();
      
      await attendance.populate([
        { path: 'user', select: 'firstName lastName email role' },
        { path: 'event', select: 'title startTime endTime type' }
      ]);

      res.json({
        success: true,
        message: 'Checked out successfully',
        data: {
          attendance,
          action: 'checkout',
          duration: attendance.duration
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Already checked out'
      });
    }
  } catch (error) {
    console.error('Check in/out error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process check in/out'
    });
  }
});

// Bulk mark attendance
router.post('/bulk', auth, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('attendance').isArray().withMessage('Attendance array is required')
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

    const { eventId, attendance: attendanceData } = req.body;

    // Check if event exists
    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check permissions
    const canMarkAttendance = 
      req.user.role === 'admin' ||
      req.user.role === 'staff' ||
      event.createdBy.toString() === req.user.userId;

    if (!canMarkAttendance) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const results = [];
    
    for (const item of attendanceData) {
      const { userId, status, notes } = item;
      
      let attendance = await Attendance.findOne({ event: eventId, user: userId });
      
      if (attendance) {
        attendance.status = status;
        attendance.notes = notes || attendance.notes;
        attendance.markedBy = req.user.userId;
        attendance.markedAt = new Date();
        attendance.isManual = true;
      } else {
        attendance = new Attendance({
          event: eventId,
          user: userId,
          status,
          notes,
          markedBy: req.user.userId,
          markedAt: new Date(),
          isManual: true
        });
      }
      
      await attendance.save();
      results.push(attendance);
    }

    res.json({
      success: true,
      message: 'Bulk attendance marked successfully',
      data: results
    });
  } catch (error) {
    console.error('Bulk mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark bulk attendance'
    });
  }
});

// Get attendance statistics
router.get('/stats/:userId', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { user: req.params.userId };
    
    if (startDate && endDate) {
      query.markedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalEvents = await Attendance.countDocuments(query);
    
    const statusCounts = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      pending: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    const attendanceRate = totalEvents > 0 ? 
      ((statusCounts.present + statusCounts.late) / totalEvents * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        totalEvents,
        statusCounts,
        attendanceRate: parseFloat(attendanceRate)
      }
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance statistics'
    });
  }
});

module.exports = router;
