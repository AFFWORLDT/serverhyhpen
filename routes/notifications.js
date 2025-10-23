const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

// Notification Model (simplified for now)
const Notification = require('../models/Notification');

const router = express.Router();

// Get all notifications for user
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    let query = { 
      $or: [
        { recipient: req.user.userId },
        { recipientType: req.user.role },
        { recipientType: 'all' }
      ]
    };

    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ ...query, read: false });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// Get notification by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('sender', 'firstName lastName email');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user has access to this notification
    const hasAccess = 
      notification.recipient.toString() === req.user.userId ||
      notification.recipientType === req.user.role ||
      notification.recipientType === 'all';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this notification'
      });
    }

    // Mark as read if not already read
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.json({
      success: true,
      data: { notification }
    });

  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification'
    });
  }
});

// Create new notification (Admin only)
router.post('/', auth, adminAuth, [
  body('title').trim().isLength({ min: 2 }).withMessage('Title must be at least 2 characters'),
  body('message').trim().isLength({ min: 5 }).withMessage('Message must be at least 5 characters'),
  body('type').isIn(['info', 'warning', 'success', 'error', 'announcement']).withMessage('Valid type is required'),
  body('recipientType').isIn(['all', 'admin', 'trainer', 'member', 'staff']).withMessage('Valid recipient type is required')
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

    const { 
      title, 
      message, 
      type, 
      recipientType, 
      recipient,
      priority,
      expiresAt,
      actionUrl,
      actionText
    } = req.body;

    // Create new notification
    const notification = new Notification({
      title,
      message,
      type,
      recipientType,
      recipient: recipientType === 'specific' ? recipient : null,
      sender: req.user.userId,
      priority: priority || 'normal',
      expiresAt,
      actionUrl,
      actionText,
      read: false
    });

    await notification.save();

    // Populate the created notification
    await notification.populate('sender', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating notification'
    });
  }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user has access to this notification
    const hasAccess = 
      notification.recipient.toString() === req.user.userId ||
      notification.recipientType === req.user.role ||
      notification.recipientType === 'all';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this notification'
      });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const query = { 
      $or: [
        { recipient: req.user.userId },
        { recipientType: req.user.role },
        { recipientType: 'all' }
      ],
      read: false
    };

    await Notification.updateMany(query, {
      read: true,
      readAt: new Date()
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking all notifications as read'
    });
  }
});

// Delete notification (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification'
    });
  }
});

// Send notification to specific user (Admin only)
router.post('/send-to-user', auth, adminAuth, [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('title').trim().isLength({ min: 2 }).withMessage('Title must be at least 2 characters'),
  body('message').trim().isLength({ min: 5 }).withMessage('Message must be at least 5 characters'),
  body('type').isIn(['info', 'warning', 'success', 'error', 'announcement']).withMessage('Valid type is required')
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

    const { 
      userId, 
      title, 
      message, 
      type, 
      priority,
      actionUrl,
      actionText
    } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create notification
    const notification = new Notification({
      title,
      message,
      type,
      recipientType: 'specific',
      recipient: userId,
      sender: req.user.userId,
      priority: priority || 'normal',
      actionUrl,
      actionText,
      read: false
    });

    await notification.save();

    // Populate the created notification
    await notification.populate([
      { path: 'sender', select: 'firstName lastName email' },
      { path: 'recipient', select: 'firstName lastName email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: { notification }
    });

  } catch (error) {
    console.error('Send notification to user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending notification'
    });
  }
});

// Get notification statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ read: false });
    
    const typeStats = await Notification.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const recipientTypeStats = await Notification.aggregate([
      { $group: { _id: '$recipientType', count: { $sum: 1 } } }
    ]);

    // Recent notifications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentNotifications = await Notification.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      data: {
        totalNotifications,
        unreadNotifications,
        recentNotifications,
        typeStats,
        recipientTypeStats
      }
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification statistics'
    });
  }
});

module.exports = router;

