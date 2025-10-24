const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { Membership } = require('../models/Membership');
const Programme = require('../models/Programme');
const TrainingSession = require('../models/TrainingSession');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all members (Admin/Trainer only) or own data (Member)
router.get('/', auth, async (req, res) => {
  try {
    // If user is member, only return their own data
    if (req.user.role === 'member') {
      const member = await User.findById(req.user.userId).select('-password');
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }
      
      return res.json({
        success: true,
        data: {
          members: [member],
          total: 1,
          active: member.isActive ? 1 : 0,
          newThisMonth: 0
        }
      });
    }
    
    // For Admin/Trainer - get all members
    if (!['admin', 'trainer'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Trainer privileges required.'
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = { role: 'member' };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const members = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching members'
    });
  }
});

// Get member by ID
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching member with ID:', req.params.id);
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    const member = await User.findById(req.params.id)
      .select('-password');

    console.log('Found member:', member);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    if (member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      data: { member }
    });

  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching member',
      error: error.message
    });
  }
});

// Create new member (Admin only)
router.post('/', auth, adminAuth, [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('dateOfBirth').isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Please select a valid gender')
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

    const { firstName, lastName, email, phone, password, dateOfBirth, gender, address, emergencyContact } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new member
    const member = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      role: 'member'
    });

    await member.save();

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: {
        member: {
          id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          dateOfBirth: member.dateOfBirth,
          gender: member.gender,
          role: member.role
        }
      }
    });

  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating member'
    });
  }
});

// Update member (Admin only)
router.put('/:id', auth, adminAuth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other'])
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

    const allowedUpdates = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'emergencyContact', 'isActive'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Check if email is being updated and if it's already taken
    if (updates.email) {
      const existingUser = await User.findOne({ 
        email: updates.email, 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }
    }

    const member = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!member || member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: { member }
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating member'
    });
  }
});

// Deactivate member (Admin only)
router.put('/:id/deactivate', auth, adminAuth, async (req, res) => {
  try {
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!member || member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Member deactivated successfully',
      data: { member }
    });

  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating member'
    });
  }
});

// Reactivate member (Admin only)
router.put('/:id/reactivate', auth, adminAuth, async (req, res) => {
  try {
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!member || member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Member reactivated successfully',
      data: { member }
    });

  } catch (error) {
    console.error('Reactivate member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reactivating member'
    });
  }
});

// Get member's membership history
router.get('/:id/memberships', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const memberships = await Membership.find({ member: req.params.id })
      .populate('plan')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { memberships }
    });

  } catch (error) {
    console.error('Get member memberships error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching member memberships'
    });
  }
});

// Assign programme to member (Trainer/Admin only)
router.post('/:id/assign-programme', auth, adminOrTrainerAuth, [
  body('programme_id').isMongoId().withMessage('Invalid programme ID'),
  body('start_date').optional().isISO8601().withMessage('Please provide a valid start date')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { programme_id, start_date } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    const member = await User.findById(id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Check if user can update this member
    if (req.user.role === 'trainer' && member.assignedTrainer?.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own assigned members'
      });
    }
    
    const programme = await Programme.findById(programme_id);
    
    if (!programme) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found'
      });
    }
    
    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (programme.duration_in_weeks * 7));
    
    member.assignedProgramme = programme_id;
    member.programmeStartDate = startDate;
    member.programmeEndDate = endDate;
    member.assignedTrainer = req.user.userId;
    
    await member.save();
    
    await member.populate([
      { path: 'assignedTrainer', select: 'firstName lastName email' },
      { path: 'assignedProgramme', select: 'name description duration_in_weeks' }
    ]);
    
    res.json({
      success: true,
      message: 'Programme assigned successfully',
      data: { member }
    });
  } catch (error) {
    console.error('Error assigning programme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign programme',
      error: error.message
    });
  }
});

// Get member sessions
router.get('/:id/sessions', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, start_date, end_date } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    const member = await User.findById(id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Check if user can view this member's sessions
    if (req.user.role === 'trainer' && member.assignedTrainer?.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own assigned members\' sessions'
      });
    }
    
    const filter = { member: id };
    
    if (status) {
      filter.status = status;
    }
    
    if (start_date || end_date) {
      filter.session_start_time = {};
      if (start_date) {
        filter.session_start_time.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.session_start_time.$lte = new Date(end_date);
      }
    }
    
    const sessions = await TrainingSession.find(filter)
      .populate('trainer', 'firstName lastName email')
      .populate('programme', 'name description')
      .sort({ session_start_time: -1 });
    
    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error fetching member sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member sessions',
      error: error.message
    });
  }
});

// Get member statistics
router.get('/:id/stats', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    const member = await User.findById(id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Check if user can view this member's stats
    if (req.user.role === 'trainer' && member.assignedTrainer?.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own assigned members\' statistics'
      });
    }
    
    const totalSessions = await TrainingSession.countDocuments({ member: id });
    const completedSessions = await TrainingSession.countDocuments({ 
      member: id, 
      status: 'completed' 
    });
    const averageRating = await TrainingSession.aggregate([
      { $match: { member: mongoose.Types.ObjectId(id), status: 'completed', live_rating: { $exists: true } } },
      { $group: { _id: null, avgRating: { $avg: '$live_rating' } } }
    ]);
    
    const recentSessions = await TrainingSession.find({ member: id })
      .populate('trainer', 'firstName lastName')
      .populate('programme', 'name')
      .sort({ session_start_time: -1 })
      .limit(5);
    
    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        averageRating: averageRating.length > 0 ? Math.round(averageRating[0].avgRating * 10) / 10 : 0,
        recentSessions
      }
    });
  } catch (error) {
    console.error('Error fetching member stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member statistics',
      error: error.message
    });
  }
});

// Get member statistics overview
router.get('/stats/overview', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'trainer') {
      filter.assignedTrainer = req.user.userId;
    }
    
    const totalMembers = await User.countDocuments({ ...filter, role: 'member', isActive: true });
    
    const fitnessLevelStats = await User.aggregate([
      { $match: { ...filter, role: 'member', isActive: true } },
      { $group: { _id: '$fitnessLevel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const programmeStats = await User.aggregate([
      { $match: { ...filter, role: 'member', isActive: true } },
      { $group: { 
        _id: { $ifNull: ['$assignedProgramme', 'unassigned'] }, 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } }
    ]);
    
    const trainerStats = await User.aggregate([
      { $match: { ...filter, role: 'member', isActive: true } },
      { $group: { _id: '$assignedTrainer', count: { $sum: 1 } } },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'trainer'
      }},
      { $unwind: '$trainer' },
      { $project: {
        trainerName: { $concat: ['$trainer.firstName', ' ', '$trainer.lastName'] },
        count: 1
      }},
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalMembers,
        fitnessLevelStats,
        programmeStats,
        trainerStats
      }
    });
  } catch (error) {
    console.error('Error fetching member stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member statistics',
      error: error.message
    });
  }
});

module.exports = router;
