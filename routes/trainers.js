const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all trainers
router.get('/', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = { role: 'trainer' };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }

    const trainers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        trainers,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get trainers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trainers'
    });
  }
});

// Get trainer by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const trainer = await User.findById(req.params.id)
      .select('-password');

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    res.json({
      success: true,
      data: { trainer }
    });

  } catch (error) {
    console.error('Get trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trainer'
    });
  }
});

// Create new trainer (Admin only)
router.post('/', auth, adminAuth, [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('dateOfBirth').isISO8601().withMessage('Please provide a valid date of birth'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Please select a valid gender'),
  body('specialization').trim().isLength({ min: 2 }).withMessage('Specialization must be at least 2 characters'),
  body('experience').isInt({ min: 0 }).withMessage('Experience must be a positive number'),
  body('certification').optional().trim(),
  body('hourlyRate').isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number')
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
      firstName, 
      lastName, 
      email, 
      phone, 
      password, 
      dateOfBirth, 
      gender, 
      specialization,
      experience,
      certification,
      hourlyRate,
      address,
      emergencyContact
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new trainer
    const trainer = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      role: 'trainer',
      specialization,
      experience,
      certification,
      hourlyRate,
      isActive: true
    });

    await trainer.save();

    res.status(201).json({
      success: true,
      message: 'Trainer created successfully',
      data: {
        trainer: {
          id: trainer._id,
          firstName: trainer.firstName,
          lastName: trainer.lastName,
          email: trainer.email,
          phone: trainer.phone,
          dateOfBirth: trainer.dateOfBirth,
          gender: trainer.gender,
          role: trainer.role,
          specialization: trainer.specialization,
          experience: trainer.experience,
          certification: trainer.certification,
          hourlyRate: trainer.hourlyRate
        }
      }
    });

  } catch (error) {
    console.error('Create trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating trainer'
    });
  }
});

// Update trainer (Admin only)
router.put('/:id', auth, adminAuth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('specialization').optional().trim().isLength({ min: 2 }),
  body('experience').optional().isInt({ min: 0 }),
  body('certification').optional().trim(),
  body('hourlyRate').optional().isFloat({ min: 0 })
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

    const allowedUpdates = [
      'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 
      'address', 'emergencyContact', 'isActive', 'specialization', 
      'experience', 'certification', 'hourlyRate'
    ];
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

    const trainer = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    res.json({
      success: true,
      message: 'Trainer updated successfully',
      data: { trainer }
    });

  } catch (error) {
    console.error('Update trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating trainer'
    });
  }
});

// Deactivate trainer (Admin only)
router.put('/:id/deactivate', auth, adminAuth, async (req, res) => {
  try {
    const trainer = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    res.json({
      success: true,
      message: 'Trainer deactivated successfully',
      data: { trainer }
    });

  } catch (error) {
    console.error('Deactivate trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating trainer'
    });
  }
});

// Reactivate trainer (Admin only)
router.put('/:id/reactivate', auth, adminAuth, async (req, res) => {
  try {
    const trainer = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    res.json({
      success: true,
      message: 'Trainer reactivated successfully',
      data: { trainer }
    });

  } catch (error) {
    console.error('Reactivate trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reactivating trainer'
    });
  }
});

// Get trainer's schedule (if schedule system exists)
router.get('/:id/schedule', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const trainer = await User.findById(req.params.id);
    
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // For now, return empty schedule - can be extended with actual schedule system
    res.json({
      success: true,
      data: {
        trainer: {
          id: trainer._id,
          name: `${trainer.firstName} ${trainer.lastName}`,
          specialization: trainer.specialization
        },
        schedule: []
      }
    });

  } catch (error) {
    console.error('Get trainer schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trainer schedule'
    });
  }
});

// Get trainer statistics
router.get('/:id/stats', auth, adminAuth, async (req, res) => {
  try {
    const trainer = await User.findById(req.params.id);
    
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // Basic stats - can be extended with actual training session data
    res.json({
      success: true,
      data: {
        trainer: {
          id: trainer._id,
          name: `${trainer.firstName} ${trainer.lastName}`,
          specialization: trainer.specialization,
          experience: trainer.experience
        },
        stats: {
          totalSessions: 0,
          totalClients: 0,
          monthlyRevenue: 0,
          rating: 0
        }
      }
    });

  } catch (error) {
    console.error('Get trainer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trainer statistics'
    });
  }
});

module.exports = router;


