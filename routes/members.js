const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { Membership } = require('../models/Membership');
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

module.exports = router;
