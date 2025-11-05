const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /trainers/list:
 *   get:
 *     summary: Get simple list of trainers
 *     tags: [Trainers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trainers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     trainers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 */
// Get all trainers - simple list (for dropdowns)
router.get('/list', auth, async (req, res) => {
  try {
    const includeWorkingHours = req.query.includeWorkingHours === 'true';
    const selectFields = includeWorkingHours 
      ? 'firstName lastName email phone specialization workingHours'
      : 'firstName lastName email phone specialization';
    
    const trainers = await User.find({ role: 'trainer' })
      .select(selectFields)
      .sort({ firstName: 1 });
    
    res.json({
      success: true,
      data: { trainers }
    });
  } catch (error) {
    console.error('Error fetching trainers list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainers'
    });
  }
});

/**
 * @swagger
 * /trainers:
 *   get:
 *     summary: Get all trainers with details
 *     tags: [Trainers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of trainers
 */
// Get all trainers (accessible by admin, trainers, and staff for assignment purposes)
router.get('/', auth, async (req, res) => {
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

    const includeWorkingHours = req.query.includeWorkingHours === 'true';

    const trainers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Ensure workingHours are included if requested, or add empty object
    const trainersWithWorkingHours = trainers.map(t => {
      const trainerObj = t.toObject();
      if (includeWorkingHours) {
        trainerObj.workingHours = trainerObj.workingHours || {};
      } else {
        trainerObj.workingHours = {};
      }
      return trainerObj;
    });

    res.json({
      success: true,
      data: {
        trainers: trainersWithWorkingHours,
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

// Get trainer availability hours - when trainer is available for appointments
router.get('/:id/working-hours', auth, async (req, res) => {
  try {
    const trainer = await User.findById(req.params.id)
      .select('workingHours firstName lastName role');
    
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // Check if requesting own availability hours or admin
    if (trainer._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this trainer\'s availability hours'
      });
    }

    res.json({
      success: true,
      data: {
        trainer: {
          _id: trainer._id,
          firstName: trainer.firstName,
          lastName: trainer.lastName
        },
        workingHours: trainer.workingHours || {}
      }
    });
  } catch (error) {
    console.error('Error fetching trainer availability hours:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching availability hours'
    });
  }
});

// Update trainer availability hours - when trainer is available for appointments
router.put('/:id/working-hours', auth, adminOrTrainerAuth, [
  body('workingHours').isObject().withMessage('Working hours must be an object'),
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

    const trainer = await User.findById(req.params.id);
    
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    // Check if updating own availability hours or admin
    if (trainer._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trainer\'s availability hours'
      });
    }

    const { workingHours } = req.body;

    // Validate working hours structure
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      if (workingHours[day]) {
        if (workingHours[day].enabled !== undefined) {
          trainer.workingHours[day].enabled = workingHours[day].enabled;
        }
        if (workingHours[day].startTime) {
          trainer.workingHours[day].startTime = workingHours[day].startTime;
        }
        if (workingHours[day].endTime) {
          trainer.workingHours[day].endTime = workingHours[day].endTime;
        }
      }
    }

    await trainer.save();

    res.json({
      success: true,
      message: 'Availability hours updated successfully',
      data: {
        workingHours: trainer.workingHours
      }
    });
  } catch (error) {
    console.error('Error updating trainer availability hours:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating availability hours'
    });
  }
});

// Check if time is within trainer availability hours - MUST come before /:id route
router.post('/:id/check-availability', auth, async (req, res) => {
  try {
    const { startTime, endTime, date } = req.body;

    if (!startTime || !endTime || !date) {
      return res.status(400).json({
        success: false,
        message: 'Start time, end time, and date are required'
      });
    }

    const trainer = await User.findById(req.params.id)
      .select('workingHours firstName lastName role');
    
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    const appointmentDate = new Date(date);
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][appointmentDate.getDay()];
    const dayHours = trainer.workingHours?.[dayName] || { enabled: false };

    if (!dayHours.enabled) {
      return res.json({
        success: true,
        data: {
          available: false,
          reason: 'Trainer does not work on this day'
        }
      });
    }

    // Convert times to minutes for comparison
    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const appointmentStart = timeToMinutes(startTime);
    const appointmentEnd = timeToMinutes(endTime);
    const workStart = timeToMinutes(dayHours.startTime);
    const workEnd = timeToMinutes(dayHours.endTime);

    const available = appointmentStart >= workStart && appointmentEnd <= workEnd;

    res.json({
      success: true,
        data: {
          available,
          reason: available 
            ? 'Within availability hours' 
            : `Outside availability hours (${dayHours.startTime} - ${dayHours.endTime})`,
          workingHours: {
            startTime: dayHours.startTime,
            endTime: dayHours.endTime
          }
        }
    });
  } catch (error) {
    console.error('Error checking trainer availability:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking availability'
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

    // Ensure workingHours is included
    const trainerObj = trainer.toObject();
    trainerObj.workingHours = trainerObj.workingHours || {};

    res.json({
      success: true,
      data: { trainer: trainerObj }
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

    // Get creator info
    const creator = await User.findById(req.user.userId);
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'System';
    const creationMethod = req.user.role === 'admin' ? 'manual' : req.user.role === 'trainer' ? 'manual' : 'api';

    // Create new trainer with creator tracking
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
      isActive: true,
      createdBy: req.user.userId,
      createdByName: creatorName,
      creationMethod: creationMethod
    });

    await trainer.save();

    // Send account creation email to trainer
    try {
      const Email = require('../utils/email');
      const SMTPSettings = require('../models/SMTPSettings');
      
      // Try to use SMTP settings first
      const smtpSettings = await SMTPSettings.findOne({ isActive: true });
      
      if (smtpSettings) {
        const emailHtml = Email.templates.trainerAccountCreatedTemplate({
          firstName: trainer.firstName,
          lastName: trainer.lastName,
          email: trainer.email,
          password: password, // Include password in email
          specialization: trainer.specialization,
          hourlyRate: trainer.hourlyRate,
          loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000/login',
          createdByName: creatorName
        });
        
        await smtpSettings.sendEmail(
          trainer.email,
          `Welcome to Hyphen Wellness Trainer Team, ${trainer.firstName}!`,
          emailHtml
        );
        console.log(`✅ Trainer account creation email sent to ${trainer.email}`);
      } else {
        // Fallback to direct email sending
        const emailHtml = Email.templates.trainerAccountCreatedTemplate({
          firstName: trainer.firstName,
          lastName: trainer.lastName,
          email: trainer.email,
          password: password,
          specialization: trainer.specialization,
          hourlyRate: trainer.hourlyRate,
          loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000/login',
          createdByName: creatorName
        });
        
        await Email.sendEmail({
          to: trainer.email,
          subject: `Welcome to Hyphen Wellness Trainer Team, ${trainer.firstName}!`,
          html: emailHtml
        });
        console.log(`✅ Trainer account creation email sent to ${trainer.email}`);
      }
    } catch (emailError) {
      console.error('Error sending trainer account creation email:', emailError);
      // Don't fail the request if email fails
    }

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

// Get trainer statistics (Admin or Trainer can view own stats)
router.get('/:id/stats', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const trainerId = req.params.id;
    
    // If user is trainer, only allow viewing own stats
    if (req.user.role === 'trainer' && trainerId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own statistics'
      });
    }

    const trainer = await User.findById(trainerId);
    
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    const TrainingSession = require('../models/TrainingSession');
    
    // Get actual training session stats
    const totalSessions = await TrainingSession.countDocuments({ trainer: trainerId });
    const completedSessions = await TrainingSession.countDocuments({ 
      trainer: trainerId, 
      status: 'completed' 
    });
    const scheduledSessions = await TrainingSession.countDocuments({ 
      trainer: trainerId, 
      status: 'scheduled' 
    });
    const cancelledSessions = await TrainingSession.countDocuments({ 
      trainer: trainerId, 
      status: 'cancelled' 
    });
    
    // Get assigned members count
    const totalClients = await User.countDocuments({ 
      role: 'member', 
      assignedTrainer: trainerId 
    });
    
    // Get monthly revenue (completed sessions this month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySessions = await TrainingSession.countDocuments({
      trainer: trainerId,
      status: 'completed',
      session_start_time: { $gte: startOfMonth }
    });
    const monthlyRevenue = monthlySessions * (trainer.hourlyRate || 0);
    
    // Get average rating from completed sessions
    const ratingStats = await TrainingSession.aggregate([
      { 
        $match: { 
          trainer: trainer._id, 
          status: 'completed', 
          live_rating: { $exists: true, $ne: null } 
        } 
      },
      { 
        $group: { 
          _id: null, 
          avgRating: { $avg: '$live_rating' },
          totalRatings: { $sum: 1 }
        } 
      }
    ]);
    
    const averageRating = ratingStats.length > 0 ? ratingStats[0].avgRating : trainer.average_rating || 0;
    const totalRatings = ratingStats.length > 0 ? ratingStats[0].totalRatings : trainer.total_reviews || 0;

    res.json({
      success: true,
      data: {
        trainer: {
          id: trainer._id,
          name: `${trainer.firstName} ${trainer.lastName}`,
          specialization: trainer.specialization,
          experience: trainer.experience,
          hourlyRate: trainer.hourlyRate
        },
        stats: {
          totalSessions,
          completedSessions,
          scheduledSessions,
          cancelledSessions,
          totalClients,
          monthlyRevenue,
          averageRating: Math.round(averageRating * 10) / 10,
          totalRatings
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

// Get comprehensive trainer analytics
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const Appointment = require('../models/Appointment');
    
    // Overview metrics
    const totalTrainers = await User.countDocuments({ role: 'trainer' });
    const activeTrainers = await User.countDocuments({ role: 'trainer', isActive: true });
    
    // Get all trainer client counts
    const trainerClientCounts = await User.aggregate([
      { $match: { role: 'member', assignedTrainer: { $exists: true } } },
      { $group: { _id: '$assignedTrainer', count: { $sum: 1 } } }
    ]);
    const totalClients = trainerClientCounts.reduce((sum, t) => sum + t.count, 0);
    
    // Session statistics
    const sessionStats = await Appointment.aggregate([
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);
    const totalSessions = sessionStats[0]?.totalSessions || 0;
    const completedSessions = sessionStats[0]?.completedSessions || 0;
    
    // Revenue calculation (assuming average $50 per session)
    const totalRevenue = completedSessions * 50;
    
    // Average rating
    const trainers = await User.find({ role: 'trainer' }).select('average_rating');
    const avgRating = trainers.length > 0
      ? trainers.reduce((sum, t) => sum + (t.average_rating || 0), 0) / trainers.length
      : 0;
    
    // Top performers - with client and session counts
    const trainerPerformance = await Promise.all(
      (await User.find({ role: 'trainer' }).limit(10).lean()).map(async (trainer) => {
        const clientCount = await User.countDocuments({ 
          role: 'member', 
          assignedTrainer: trainer._id 
        });
        
        const sessionCount = await Appointment.countDocuments({
          staff: trainer._id,
          status: 'completed'
        });
        
        return {
          ...trainer,
          clientCount,
          sessionCount
        };
      })
    );
    
    // Sort by session count
    trainerPerformance.sort((a, b) => b.sessionCount - a.sessionCount);
    const topPerformers = trainerPerformance.slice(0, 3);
    
    // All trainers performance data
    const allTrainersPerformance = trainerPerformance.map((trainer, idx) => ({
      ...trainer,
      rank: idx + 1
    }));
    
    // Client satisfaction (mocked for now - can be replaced with real feedback)
    const clientSatisfaction = trainers.map(t => ({
      trainer: `${t.firstName} ${t.lastName}`,
      rating: t.average_rating || 5.0,
      reviews: Math.floor(Math.random() * 50) + 10
    }));
    
    // Revenue by trainer
    const revenueByTrainer = await Promise.all(
      trainers.map(async (trainer) => {
        const sessions = await Appointment.countDocuments({
          staff: trainer._id,
          status: 'completed'
        });
        return {
          trainer: `${trainer.firstName} ${trainer.lastName}`,
          revenue: sessions * (trainer.hourlyRate || 50),
          sessions
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        overview: {
          totalTrainers,
          activeTrainers,
          totalClients,
          totalSessions,
          completedSessions,
          totalRevenue,
          avgRating
        },
        topPerformers,
        performance: allTrainersPerformance,
        revenue: revenueByTrainer,
        clientSatisfaction
      }
    });
  } catch (error) {
    console.error('Error fetching trainer analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Bulk operations - Activate/Deactivate trainers
router.post('/bulk-action', auth, adminAuth, async (req, res) => {
  try {
    const { action, trainerIds } = req.body;

    if (!action || !trainerIds || !Array.isArray(trainerIds)) {
      return res.status(400).json({
        success: false,
        message: 'Action and trainerIds array are required'
      });
    }

    let updateData = {};
    if (action === 'activate') {
      updateData = { isActive: true };
    } else if (action === 'deactivate') {
      updateData = { isActive: false };
    } else if (action === 'delete') {
      await User.deleteMany({ _id: { $in: trainerIds }, role: 'trainer' });
      return res.json({
        success: true,
        message: `${trainerIds.length} trainers deleted successfully`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: trainerIds }, role: 'trainer' },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} trainers ${action}d successfully`
    });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action',
      error: error.message
    });
  }
});

// Export trainers data as CSV
router.get('/export', auth, adminAuth, async (req, res) => {
  try {
    const trainers = await User.find({ role: 'trainer' })
      .select('firstName lastName email phone specialization experience certification hourlyRate average_rating isActive createdAt')
      .lean();

    // Get client counts
    const trainersWithClients = await Promise.all(
      trainers.map(async (trainer) => {
        const clientCount = await User.countDocuments({ 
          role: 'member', 
          assignedTrainer: trainer._id 
        });
        return { ...trainer, clientCount };
      })
    );

    // Create CSV header
    const csvHeader = 'First Name,Last Name,Email,Phone,Specialization,Experience (years),Certification,Hourly Rate,Avg Rating,Clients,Active,Joined Date\n';
    
    // Create CSV rows
    const csvRows = trainersWithClients.map(trainer => {
      return [
        trainer.firstName || '',
        trainer.lastName || '',
        trainer.email || '',
        trainer.phone || '',
        trainer.specialization || '',
        trainer.experience || 0,
        trainer.certification || '',
        trainer.hourlyRate || 0,
        (trainer.average_rating || 0).toFixed(1),
        trainer.clientCount || 0,
        trainer.isActive ? 'Yes' : 'No',
        new Date(trainer.createdAt).toLocaleDateString()
      ].map(field => `"${field}"`).join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=trainers-export-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting trainers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export trainers',
      error: error.message
    });
  }
});

module.exports = router;




