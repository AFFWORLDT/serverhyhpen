const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, adminAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const User = require('../models/User');

// Support Ticket Schema (we'll add this to a separate model file)
const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['general', 'billing', 'technical', 'membership', 'equipment'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resolvedAt: {
    type: Date
  },
  notes: [{
    text: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Clear any existing model to avoid conflicts
if (mongoose.models.SupportTicket) {
  delete mongoose.models.SupportTicket;
}
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

// Get my support tickets (any authenticated user) - MUST BE BEFORE /:id route
router.get('/tickets/my-tickets', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { createdBy: req.user.userId };
    if (status) {
      query.status = status;
    }

    const tickets = await SupportTicket.find(query)
      .populate('memberId', 'firstName lastName email')
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
    console.error('Get my support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support tickets',
      error: error.message
    });
  }
});

// Get all support tickets (admin/staff/trainer)
router.get('/tickets', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority, category } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tickets = await SupportTicket.find(query)
      .populate('memberId', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
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
      message: 'Failed to fetch support tickets'
    });
  }
});

// Get single support ticket
router.get('/tickets/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('memberId', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('notes.createdBy', 'firstName lastName email');

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
      message: 'Failed to fetch support ticket'
    });
  }
});

// Create new support ticket
router.post('/tickets', auth, adminOrTrainerOrStaffAuth, [
  body('memberId').isMongoId().withMessage('Valid member ID is required'),
  body('subject').isLength({ min: 1, max: 200 }).withMessage('Subject must be between 1 and 200 characters'),
  body('description').isLength({ min: 1, max: 1000 }).withMessage('Description must be between 1 and 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('category').optional().isIn(['general', 'billing', 'technical', 'membership', 'equipment']).withMessage('Invalid category')
], async (req, res) => {
  try {
    console.log('Support ticket creation route reached');
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { memberId, subject, description, priority = 'medium', category = 'general' } = req.body;

    console.log('Creating support ticket with data:', {
      memberId,
      subject,
      description,
      priority,
      category,
      createdBy: req.user.userId,
      user: req.user
    });

    // Verify member exists
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const ticket = new SupportTicket({
      memberId,
      subject,
      description,
      priority,
      category,
      createdBy: req.user.userId
    });

    await ticket.save();

    // Populate the response
    await ticket.populate('memberId', 'firstName lastName email phone');
    await ticket.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support ticket'
    });
  }
});

// Update ticket status
router.put('/tickets/:id/status', auth, adminOrTrainerOrStaffAuth, [
  body('status').isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status')
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

    const { status } = req.body;
    const updateData = { status };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('memberId', 'firstName lastName email phone')
     .populate('assignedTo', 'firstName lastName email')
     .populate('createdBy', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    res.json({
      success: true,
      message: 'Ticket status updated successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status'
    });
  }
});

// Assign ticket
router.put('/tickets/:id/assign', auth, adminOrTrainerOrStaffAuth, [
  body('assignedTo').isMongoId().withMessage('Valid user ID is required')
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

    const { assignedTo } = req.body;

    // Verify assigned user exists and is staff
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || assignedUser.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found or not a staff member'
      });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { assignedTo },
      { new: true }
    ).populate('memberId', 'firstName lastName email phone')
     .populate('assignedTo', 'firstName lastName email')
     .populate('createdBy', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign ticket'
    });
  }
});

// Add note to ticket
router.post('/tickets/:id/notes', auth, adminOrTrainerOrStaffAuth, [
  body('text').isLength({ min: 1, max: 500 }).withMessage('Note must be between 1 and 500 characters')
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

    const { text } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: {
            text,
            createdBy: req.user.userId
          }
        }
      },
      { new: true }
    ).populate('memberId', 'firstName lastName email phone')
     .populate('assignedTo', 'firstName lastName email')
     .populate('createdBy', 'firstName lastName email')
     .populate('notes.createdBy', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    res.json({
      success: true,
      message: 'Note added successfully',
      data: { ticket }
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note'
    });
  }
});

// Delete support ticket
router.delete('/tickets/:id', auth, adminAuth, async (req, res) => {
  try {
    const ticket = await SupportTicket.findByIdAndDelete(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    res.json({
      success: true,
      message: 'Support ticket deleted successfully'
    });
  } catch (error) {
    console.error('Delete support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete support ticket'
    });
  }
});

// Get support ticket analytics
router.get('/analytics', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery = {};

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const analytics = await SupportTicket.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          inProgressTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          closedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          },
          highPriorityTickets: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          urgentTickets: {
            $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
          }
        }
      }
    ]);

    const categoryStats = await SupportTicket.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await SupportTicket.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalTickets: 0,
          openTickets: 0,
          inProgressTickets: 0,
          resolvedTickets: 0,
          closedTickets: 0,
          highPriorityTickets: 0,
          urgentTickets: 0
        },
        categoryStats,
        priorityStats
      }
    });
  } catch (error) {
    console.error('Get support analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support analytics'
    });
  }
});

// Create support ticket for self (any authenticated user)
router.post('/tickets/my-ticket', auth, [
  body('subject').isLength({ min: 1, max: 200 }).withMessage('Subject must be between 1 and 200 characters'),
  body('description').isLength({ min: 1, max: 1000 }).withMessage('Description must be between 1 and 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('category').optional().isIn(['general', 'billing', 'technical', 'membership', 'equipment', 'schedule', 'trainer']).withMessage('Invalid category')
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

    const { subject, description, priority = 'medium', category = 'general' } = req.body;

    const ticket = new SupportTicket({
      memberId: req.user.userId,  // User creating ticket for themselves
      subject,
      description,
      priority,
      category,
      createdBy: req.user.userId
    });

    await ticket.save();

    // Populate the response
    await ticket.populate('memberId', 'firstName lastName email phone');
    await ticket.populate('createdBy', 'firstName lastName email');

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

// Get my support tickets (any authenticated user)
router.get('/tickets/my-tickets', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { createdBy: req.user.userId };
    if (status) {
      query.status = status;
    }

    const tickets = await SupportTicket.find(query)
      .populate('memberId', 'firstName lastName email')
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
    console.error('Get my support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support tickets',
      error: error.message
    });
  }
});

module.exports = router;
