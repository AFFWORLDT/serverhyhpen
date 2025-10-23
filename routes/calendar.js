const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const CalendarEvent = require('../models/CalendarEvent');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

// Get all calendar events with filters
router.get('/', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      type, 
      category, 
      userId, 
      status,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    // Date range filter
    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // User-specific events
    if (userId) {
      query.$or = [
        { createdBy: userId },
        { assignedTo: userId }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Role-based access control
    if (req.user.role === 'member') {
      query.$or = [
        { createdBy: req.user.userId },
        { assignedTo: req.user.userId },
        { visibility: 'public' }
      ];
    } else if (req.user.role === 'trainer') {
      query.$or = [
        { createdBy: req.user.userId },
        { assignedTo: req.user.userId },
        { category: { $in: ['trainer', 'global'] } },
        { visibility: 'public' }
      ];
    } else if (req.user.role === 'staff') {
      query.$or = [
        { createdBy: req.user.userId },
        { assignedTo: req.user.userId },
        { category: { $in: ['staff', 'global'] } },
        { visibility: 'public' }
      ];
    }

    const skip = (page - 1) * limit;
    
    const events = await CalendarEvent.find(query)
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('relatedEntity')
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CalendarEvent.countDocuments(query);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar events'
    });
  }
});

// Get single calendar event
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('relatedEntity');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }

    // Check access permissions
    const hasAccess = 
      event.createdBy._id.toString() === req.user.userId ||
      event.assignedTo.some(user => user._id.toString() === req.user.userId) ||
      event.visibility === 'public' ||
      req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar event'
    });
  }
});

// Create new calendar event
router.post('/', auth, [
  body('title').notEmpty().withMessage('Title is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('type').isIn(['class', 'training_session', 'staff_meeting', 'maintenance', 'event', 'holiday', 'personal']).withMessage('Invalid event type'),
  body('category').isIn(['hr', 'member', 'trainer', 'staff', 'global']).withMessage('Invalid category')
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

    const {
      title,
      description,
      startTime,
      endTime,
      type,
      category,
      assignedTo,
      location,
      color,
      isRecurring,
      recurringPattern,
      isAllDay,
      reminder,
      tags,
      visibility,
      relatedEntity,
      relatedEntityType
    } = req.body;

    // Validate time range
    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    const event = new CalendarEvent({
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      type,
      category,
      createdBy: req.user.userId,
      assignedTo: assignedTo || [],
      location,
      color,
      isRecurring,
      recurringPattern,
      isAllDay,
      reminder,
      tags,
      visibility,
      relatedEntity,
      relatedEntityType
    });

    await event.save();

    // Populate the created event
    await event.populate([
      { path: 'createdBy', select: 'firstName lastName email role' },
      { path: 'assignedTo', select: 'firstName lastName email role' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create calendar event'
    });
  }
});

// Update calendar event
router.put('/:id', auth, [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('startTime').optional().isISO8601().withMessage('Valid start time is required'),
  body('endTime').optional().isISO8601().withMessage('Valid end time is required')
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

    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }

    // Check permissions
    const canEdit = 
      event.createdBy.toString() === req.user.userId ||
      req.user.role === 'admin' ||
      (req.user.role === 'staff' && event.category === 'staff');

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate time range if both times are provided
    if (req.body.startTime && req.body.endTime) {
      if (new Date(req.body.startTime) >= new Date(req.body.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'End time must be after start time'
        });
      }
    }

    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate([
      { path: 'createdBy', select: 'firstName lastName email role' },
      { path: 'assignedTo', select: 'firstName lastName email role' }
    ]);

    res.json({
      success: true,
      message: 'Calendar event updated successfully',
      data: updatedEvent
    });
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update calendar event'
    });
  }
});

// Delete calendar event
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }

    // Check permissions
    const canDelete = 
      event.createdBy.toString() === req.user.userId ||
      req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete related attendance records
    await Attendance.deleteMany({ event: req.params.id });

    await CalendarEvent.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Calendar event deleted successfully'
    });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete calendar event'
    });
  }
});

// Get events for specific user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {
      $or: [
        { createdBy: req.params.userId },
        { assignedTo: req.params.userId }
      ]
    };

    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const events = await CalendarEvent.find(query)
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .sort({ startTime: 1 });

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get user events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user events'
    });
  }
});

// Get upcoming events
router.get('/upcoming/:userId', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const events = await CalendarEvent.find({
      $or: [
        { createdBy: req.params.userId },
        { assignedTo: req.params.userId }
      ],
      startTime: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    })
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .sort({ startTime: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming events'
    });
  }
});

module.exports = router;
