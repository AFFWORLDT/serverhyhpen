const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// System Settings Schema
const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String },
  category: { type: String, default: 'general' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// Help & Support Schema
const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['technical', 'billing', 'general', 'feature_request', 'bug_report'], required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  responses: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

// FAQ Schema
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, required: true },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FAQ = mongoose.model('FAQ', faqSchema);

// SYSTEM SETTINGS API

// Get all system settings (Admin only)
router.get('/settings', auth, adminAuth, async (req, res) => {
  try {
    const { category } = req.query;
    
    const query = {};
    if (category) {
      query.category = category;
    }

    const settings = await SystemSettings.find(query).sort({ category: 1, key: 1 });

    res.json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings',
      error: error.message
    });
  }
});

// Update system setting (Admin only)
router.put('/settings/:key', auth, adminAuth, [
  body('value').notEmpty().withMessage('Value is required'),
  body('description').optional().trim()
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

    const { key } = req.params;
    const { value, description } = req.body;

    const setting = await SystemSettings.findOneAndUpdate(
      { key },
      { 
        value, 
        description: description || undefined,
        updatedBy: req.user.userId,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'System setting updated successfully',
      data: { setting }
    });
  } catch (error) {
    console.error('Update system setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system setting',
      error: error.message
    });
  }
});

// Get user preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await mongoose.model('User').findById(req.user.userId).select('preferences');
    
    res.json({
      success: true,
      data: { 
        preferences: user.preferences || {
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            sms: false
          },
          language: 'en',
          timezone: 'Asia/Dubai'
        }
      }
    });
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user preferences',
      error: error.message
    });
  }
});

// Update user preferences
router.put('/preferences', auth, [
  body('theme').optional().isIn(['light', 'dark']).withMessage('Theme must be light or dark'),
  body('language').optional().isIn(['en', 'ar']).withMessage('Language must be en or ar'),
  body('timezone').optional().isString().withMessage('Timezone must be a string'),
  body('notifications.email').optional().isBoolean().withMessage('Email notifications must be boolean'),
  body('notifications.push').optional().isBoolean().withMessage('Push notifications must be boolean'),
  body('notifications.sms').optional().isBoolean().withMessage('SMS notifications must be boolean')
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

    const user = await mongoose.model('User').findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.preferences = {
      ...user.preferences,
      ...req.body
    };

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });
  } catch (error) {
    console.error('Update user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

// SUPPORT TICKETS API

// Create support ticket
router.post('/support/tickets', auth, [
  body('subject').trim().isLength({ min: 5 }).withMessage('Subject must be at least 5 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').isIn(['technical', 'billing', 'general', 'feature_request', 'bug_report']).withMessage('Please select a valid category'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Please select a valid priority')
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

    const ticketData = {
      ...req.body,
      userId: req.user.userId
    };

    const ticket = new SupportTicket(ticketData);
    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support ticket',
      error: error.message
    });
  }
});

// Get user's support tickets
router.get('/support/tickets', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.userId };
    if (status) {
      query.status = status;
    }

    const tickets = await SupportTicket.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support tickets',
      error: error.message
    });
  }
});

// Get support ticket by ID
router.get('/support/tickets/:id', auth, async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      userId: req.user.userId
    }).populate('assignedTo', 'firstName lastName email')
      .populate('responses.userId', 'firstName lastName email role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Get support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support ticket',
      error: error.message
    });
  }
});

// Add response to support ticket
router.post('/support/tickets/:id/response', auth, [
  body('message').trim().isLength({ min: 5 }).withMessage('Message must be at least 5 characters')
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

    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    const response = {
      userId: req.user.userId,
      message: req.body.message,
      isAdmin: req.user.role === 'admin'
    };

    ticket.responses.push(response);
    ticket.updatedAt = new Date();
    await ticket.save();

    res.json({
      success: true,
      message: 'Response added successfully',
      data: { response }
    });
  } catch (error) {
    console.error('Add ticket response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: error.message
    });
  }
});

// FAQ API

// Get FAQs
router.get('/faq', async (req, res) => {
  try {
    const { category, search } = req.query;

    const query = { isActive: true };
    
    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const faqs = await FAQ.find(query).sort({ order: 1, createdAt: -1 });

    res.json({
      success: true,
      data: { faqs }
    });
  } catch (error) {
    console.error('Get FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ',
      error: error.message
    });
  }
});

// Create FAQ (Admin only)
router.post('/faq', auth, adminAuth, [
  body('question').trim().isLength({ min: 5 }).withMessage('Question must be at least 5 characters'),
  body('answer').trim().isLength({ min: 10 }).withMessage('Answer must be at least 10 characters'),
  body('category').trim().isLength({ min: 2 }).withMessage('Category is required')
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

    const faq = new FAQ(req.body);
    await faq.save();

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: { faq }
    });
  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message
    });
  }
});

// ANALYTICS & REPORTS API

// Get system analytics (Admin only)
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const User = mongoose.model('User');
    const GymSession = mongoose.model('GymSession');
    const Membership = mongoose.model('Membership');
    const Payment = mongoose.model('Payment');

    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    const [
      totalUsers,
      activeMembers,
      totalSessions,
      totalRevenue,
      newUsers,
      activeSessions
    ] = await Promise.all([
      User.countDocuments(),
      Membership.countDocuments({ status: 'active' }),
      GymSession.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      GymSession.countDocuments({ 
        checkInTime: { $gte: startDate, $lte: endDate },
        checkOutTime: { $exists: false }
      })
    ]);

    const analytics = {
      overview: {
        totalUsers,
        activeMembers,
        totalSessions,
        totalRevenue: totalRevenue[0]?.total || 0,
        newUsers,
        activeSessions
      },
      period: {
        start: startDate,
        end: endDate,
        label: period
      }
    };

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

module.exports = router;
