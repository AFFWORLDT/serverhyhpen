const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const Email = require('../utils/email');

// Classes Model (simplified for now)
const Class = require('../models/Class');

const router = express.Router();

// Get all classes
router.get('/', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const type = req.query.type || '';
    const status = req.query.status || '';

    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { instructor: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    const classes = await Class.find(query)
      .populate('trainer', 'firstName lastName email phone profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use .lean() for better performance

    const total = await Class.countDocuments(query);

    res.json({
      success: true,
      data: {
        classes,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes'
    });
  }
});

// Get class by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('trainer', 'firstName lastName email phone')
        .populate('members', 'firstName lastName email phone profileImage');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      data: { class: classData }
    });

  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching class'
    });
  }
});

// Create new class (Admin only)
router.post('/', auth, adminAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Class name must be at least 2 characters'),
  body('type').trim().isLength({ min: 2 }).withMessage('Class type must be at least 2 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('trainer').isMongoId().withMessage('Valid trainer ID is required'),
  body('maxCapacity').isInt({ min: 1 }).withMessage('Max capacity must be at least 1'),
  body('duration').isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('schedule').isArray().withMessage('Schedule must be an array'),
  body('equipment').optional().isArray()
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
      name, 
      type, 
      description, 
      trainer, 
      maxCapacity, 
      duration, 
      price, 
      schedule,
      equipment,
      requirements,
      difficulty,
      location
    } = req.body;

    // Check if trainer exists and is active
    const trainerExists = await User.findById(trainer);
    if (!trainerExists || trainerExists.role !== 'trainer' || !trainerExists.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trainer selected'
      });
    }

    // Check if class name already exists
    const existingClass = await Class.findOne({ name });
    if (existingClass) {
      return res.status(400).json({
        success: false,
        message: 'Class with this name already exists'
      });
    }

    // Create new class
    const classData = new Class({
      name,
      type,
      description,
      trainer,
      maxCapacity,
      duration,
      price,
      schedule,
      equipment,
      requirements,
      difficulty,
      location,
      status: 'active',
      members: []
    });

    await classData.save();

    // Populate the created class
    await classData.populate('trainer', 'firstName lastName email phone');

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: { class: classData }
    });

  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating class'
    });
  }
});

// Update class (Admin only)
router.put('/:id', auth, adminAuth, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('type').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('trainer').optional().isMongoId(),
  body('maxCapacity').optional().isInt({ min: 1 }),
  body('duration').optional().isInt({ min: 15 }),
  body('price').optional().isFloat({ min: 0 }),
  body('schedule').optional().isArray(),
  body('equipment').optional().isArray()
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
      'name', 'type', 'description', 'trainer', 'maxCapacity', 'duration', 
      'price', 'schedule', 'equipment', 'requirements', 'difficulty', 
      'location', 'status'
    ];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Check if trainer is being updated
    if (updates.trainer) {
      const trainerExists = await User.findById(updates.trainer);
      if (!trainerExists || trainerExists.role !== 'trainer' || !trainerExists.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid trainer selected'
        });
      }
    }

    // Check if class name is being updated and if it's already taken
    if (updates.name) {
      const existingClass = await Class.findOne({ 
        name: updates.name, 
        _id: { $ne: req.params.id } 
      });
      if (existingClass) {
        return res.status(400).json({
          success: false,
          message: 'Class name is already taken by another class'
        });
      }
    }

    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('trainer', 'firstName lastName email phone');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    res.json({
      success: true,
      message: 'Class updated successfully',
      data: { class: classData }
    });

  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating class'
    });
  }
});

// Delete class (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('members', 'firstName lastName email')
      .populate('trainer', 'firstName lastName email');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Send class cancellation emails to all enrolled members
    if (classData.members && classData.members.length > 0) {
      const emailPromises = classData.members.map(async (member) => {
        if (member.email) {
          try {
            const html = Email.templates.classCancelledTemplate({
              firstName: member.firstName,
              className: classData.name,
              classType: classData.type,
              cancellationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
              reason: 'Class cancelled by admin'
            });
            await Email.sendEmail({
              to: member.email,
              subject: `${classData.name} Class Has Been Cancelled`,
              html
            });
          } catch (e) {
            console.error(`Error sending cancellation email to ${member.email}:`, e.message);
          }
        }
      });
      await Promise.all(emailPromises);
    }

    await Class.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });

  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting class'
    });
  }
});

// Add member to class (Admin/Trainer)
router.post('/:id/members', auth, adminOrTrainerAuth, [
  body('memberId').isMongoId().withMessage('Valid member ID is required')
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

    const { memberId } = req.body;

    // Check if class exists
    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if member exists and is active
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member' || !member.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member selected'
      });
    }

    // Check if class is at capacity
    if (classData.members.length >= classData.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Class is at maximum capacity'
      });
    }

    // Check if member is already enrolled
    if (classData.members.includes(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'Member is already enrolled in this class'
      });
    }

    // Add member to class
    classData.members.push(memberId);
    await classData.save();

    // Populate the updated class
    await classData.populate([
      { path: 'trainer', select: 'firstName lastName email phone' },
      { path: 'members', select: 'firstName lastName email phone' }
    ]);

    // Send class enrollment email
    try {
      if (member.email) {
        const html = Email.templates.classEnrolledTemplate({
          firstName: member.firstName,
          className: classData.name,
          classType: classData.type,
          trainerName: classData.trainer ? `${classData.trainer.firstName} ${classData.trainer.lastName}` : 'TBA',
          schedule: classData.schedule || [],
          location: classData.location || 'Main Gym',
          startDate: classData.schedule?.[0]?.startTime || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        });
        await Email.sendEmail({
          to: member.email,
          subject: `You're Enrolled in ${classData.name}`,
          html
        });
      }
    } catch (e) {
      console.error('Class enrollment email error:', e.message);
    }

    res.json({
      success: true,
      message: 'Member added to class successfully',
      data: { class: classData }
    });

  } catch (error) {
    console.error('Add member to class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding member to class'
    });
  }
});

// Remove member from class (Admin/Trainer)
router.delete('/:id/members/:memberId', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Get member before removal
    const member = await User.findById(req.params.memberId);
    
    // Remove member from class
    classData.members = classData.members.filter(
      memberId => memberId.toString() !== req.params.memberId
    );
    await classData.save();

    // Populate the updated class
    await classData.populate([
      { path: 'trainer', select: 'firstName lastName email phone' },
      { path: 'members', select: 'firstName lastName email phone' }
    ]);

    // Send class cancellation email if member exists
    if (member && member.email) {
      try {
        const html = Email.templates.classCancelledTemplate({
          firstName: member.firstName,
          className: classData.name,
          classType: classData.type,
          cancellationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          reason: 'Removed from class'
        });
        await Email.sendEmail({
          to: member.email,
          subject: `You've Been Removed from ${classData.name}`,
          html
        });
      } catch (e) {
        console.error('Class cancellation email error:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Member removed from class successfully',
      data: { class: classData }
    });

  } catch (error) {
    console.error('Remove member from class error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing member from class'
    });
  }
});

// Get classes by trainer
router.get('/trainer/:trainerId', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const classes = await Class.find({ trainer: req.params.trainerId })
      .populate('trainer', 'firstName lastName email phone')
        .populate('members', 'firstName lastName email phone profileImage')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { classes }
    });

  } catch (error) {
    console.error('Get classes by trainer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes by trainer'
    });
  }
});

// Get classes by type
router.get('/type/:type', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const classes = await Class.find({ 
      type: req.params.type,
      status: 'active'
    })
    .populate('trainer', 'firstName lastName email phone')
    .sort({ name: 1 });

    res.json({
      success: true,
      data: { classes }
    });

  } catch (error) {
    console.error('Get classes by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes by type'
    });
  }
});

// Get class statistics
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalClasses = await Class.countDocuments();
    const activeClasses = await Class.countDocuments({ status: 'active' });
    
    const typeStats = await Class.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const trainerStats = await Class.aggregate([
      { $lookup: { from: 'users', localField: 'trainer', foreignField: '_id', as: 'trainerInfo' } },
      { $unwind: '$trainerInfo' },
      { $group: { _id: '$trainerInfo.firstName', count: { $sum: 1 } } }
    ]);

    // Calculate total enrollment
    const totalEnrollment = await Class.aggregate([
      { $group: { _id: null, total: { $sum: { $size: '$members' } } } }
    ]);

    res.json({
      success: true,
      data: {
        totalClasses,
        activeClasses,
        totalEnrollment: totalEnrollment[0]?.total || 0,
        typeStats,
        trainerStats
      }
    });

  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching class statistics'
    });
  }
});

module.exports = router;
