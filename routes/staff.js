const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all staff members with advanced filtering
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const department = req.query.department || '';
    const position = req.query.position || '';
    const status = req.query.status || '';
    const gender = req.query.gender || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const minSalary = req.query.minSalary ? parseFloat(req.query.minSalary) : null;
    const maxSalary = req.query.maxSalary ? parseFloat(req.query.maxSalary) : null;
    const hireDateFrom = req.query.hireDateFrom || '';
    const hireDateTo = req.query.hireDateTo || '';
    const skills = req.query.skills ? req.query.skills.split(',') : [];
    const performanceRating = req.query.performanceRating ? parseFloat(req.query.performanceRating) : null;
    const createdBy = req.query.createdBy || '';

    let query = { role: 'staff' };
    
    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by department
    if (department) {
      query.department = department;
    }

    // Filter by position
    if (position) {
      query.position = position;
    }

    // Filter by status
    if (status) {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    // Filter by gender
    if (gender) {
      query.gender = gender;
    }

    // Filter by salary range
    if (minSalary !== null || maxSalary !== null) {
      query.salary = {};
      if (minSalary !== null) query.salary.$gte = minSalary;
      if (maxSalary !== null) query.salary.$lte = maxSalary;
    }

    // Filter by hire date range
    if (hireDateFrom || hireDateTo) {
      query.hireDate = {};
      if (hireDateFrom) query.hireDate.$gte = new Date(hireDateFrom);
      if (hireDateTo) query.hireDate.$lte = new Date(hireDateTo);
    }

    // Filter by skills
    if (skills.length > 0) {
      query.skills = { $in: skills };
    }

    // Filter by performance rating
    if (performanceRating !== null) {
      query.average_rating = { $gte: performanceRating };
    }

    // Filter by creator
    if (createdBy) {
      if (createdBy === 'System') {
        query.createdByName = { $exists: false };
      } else if (createdBy === 'Admin') {
        query.createdByName = { $regex: 'Admin', $options: 'i' };
      } else if (createdBy === 'Manual') {
        query.creationMethod = 'manual';
      } else {
        query.createdByName = { $regex: createdBy, $options: 'i' };
      }
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder;

    const staff = await User.find(query)
      .select('-password')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(); // Use .lean() for better performance

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        staff,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff'
    });
  }
});

// Get comprehensive staff analytics
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const totalStaff = await User.countDocuments({ role: 'staff' });
    const activeStaff = await User.countDocuments({ role: 'staff', isActive: true });
    const inactiveStaff = totalStaff - activeStaff;
    
    // Department distribution
    const departmentStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Position distribution
    const positionStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true } },
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Gender distribution
    const genderStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true } },
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    // Salary statistics
    const salaryStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true, salary: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgSalary: { $avg: '$salary' },
          minSalary: { $min: '$salary' },
          maxSalary: { $max: '$salary' },
          totalPayroll: { $sum: '$salary' }
        }
      }
    ]);

    // Performance ratings
    const performanceStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true, average_rating: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$average_rating' },
          minRating: { $min: '$average_rating' },
          maxRating: { $max: '$average_rating' }
        }
      }
    ]);

    // Recent hires (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentHires = await User.countDocuments({
      role: 'staff',
      hireDate: { $gte: sixMonthsAgo }
    });

    // Staff turnover (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const turnoverStats = await User.aggregate([
      {
        $match: {
          role: 'staff',
          updatedAt: { $gte: twelveMonthsAgo },
          isActive: false
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalStaff,
          activeStaff,
          inactiveStaff,
          recentHires,
          retentionRate: totalStaff > 0 ? ((totalStaff - inactiveStaff) / totalStaff * 100).toFixed(1) : 0
        },
        departmentStats,
        positionStats,
        genderStats,
        salaryStats: salaryStats[0] || { avgSalary: 0, minSalary: 0, maxSalary: 0, totalPayroll: 0 },
        performanceStats: performanceStats[0] || { avgRating: 0, minRating: 0, maxRating: 0 },
        turnoverStats
      }
    });

  } catch (error) {
    console.error('Get staff analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff analytics'
    });
  }
});

// Get staff insights and trends
router.get('/insights', auth, adminAuth, async (req, res) => {
  try {
    // Monthly hiring trends (last 12 months)
    const monthlyHiringTrends = await User.aggregate([
      {
        $match: {
          role: 'staff',
          hireDate: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$hireDate' },
            month: { $month: '$hireDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    // Top performing departments by average rating
    const topDepartments = await User.aggregate([
      {
        $match: {
          role: 'staff',
          isActive: true,
          average_rating: { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$department',
          avgRating: { $avg: '$average_rating' },
          count: { $sum: 1 }
        }
      },
      { $sort: { avgRating: -1 } },
      { $limit: 5 }
    ]);

    // Salary distribution by department
    const salaryByDepartment = await User.aggregate([
      {
        $match: {
          role: 'staff',
          isActive: true,
          salary: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$department',
          avgSalary: { $avg: '$salary' },
          minSalary: { $min: '$salary' },
          maxSalary: { $max: '$salary' },
          count: { $sum: 1 }
        }
      },
      { $sort: { avgSalary: -1 } }
    ]);

    // Skills analysis
    const skillsAnalysis = await User.aggregate([
      {
        $match: {
          role: 'staff',
          isActive: true,
          skills: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$skills' },
      {
        $group: {
          _id: '$skills',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Age distribution
    const ageDistribution = await User.aggregate([
      {
        $match: {
          role: 'staff',
          isActive: true,
          dateOfBirth: { $exists: true }
        }
      },
      {
        $addFields: {
          age: {
            $divide: [
              { $subtract: [new Date(), '$dateOfBirth'] },
              365 * 24 * 60 * 60 * 1000
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 25, 30, 35, 40, 45, 50, 55, 60, 100],
          default: '60+',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        monthlyHiringTrends,
        topDepartments,
        salaryByDepartment,
        skillsAnalysis,
        ageDistribution
      }
    });

  } catch (error) {
    console.error('Get staff insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff insights'
    });
  }
});

// Get staff performance metrics
router.get('/performance', auth, adminAuth, async (req, res) => {
  try {
    const staffId = req.query.staffId;
    
    if (staffId) {
      // Individual staff performance
      const staffMember = await User.findById(staffId).select('-password');
      if (!staffMember || staffMember.role !== 'staff') {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      // Calculate performance metrics
      const performanceMetrics = {
        currentRating: staffMember.average_rating || 0,
        totalReviews: staffMember.total_reviews || 0,
        lastReviewDate: staffMember.last_review_date || null,
        goalsCompleted: staffMember.goals_completed || 0,
        goalsTotal: staffMember.goals_total || 0,
        trainingHours: staffMember.training_hours || 0,
        certifications: staffMember.certifications || [],
        achievements: staffMember.achievements || []
      };

      res.json({
        success: true,
        data: { performanceMetrics }
      });
    } else {
      // Overall performance metrics
      const performanceOverview = await User.aggregate([
        {
          $match: {
            role: 'staff',
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$average_rating' },
            totalReviews: { $sum: '$total_reviews' },
            avgGoalsCompleted: { $avg: '$goals_completed' },
            totalTrainingHours: { $sum: '$training_hours' }
          }
        }
      ]);

      // Top performers
      const topPerformers = await User.find({
        role: 'staff',
        isActive: true,
        average_rating: { $gte: 4.0 }
      })
      .select('firstName lastName department position average_rating')
      .sort({ average_rating: -1 })
      .limit(10);

      res.json({
        success: true,
        data: {
          performanceOverview: performanceOverview[0] || {
            avgRating: 0,
            totalReviews: 0,
            avgGoalsCompleted: 0,
            totalTrainingHours: 0
          },
          topPerformers
        }
      });
    }

  } catch (error) {
    console.error('Get staff performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff performance'
    });
  }
});

// Get staff member by ID
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const staffMember = await User.findById(req.params.id)
      .select('-password');

    if (!staffMember || staffMember.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      data: { staffMember }
    });

  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff member'
    });
  }
});

// Create new staff member (Admin only)
router.post('/', auth, adminAuth, [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('position').trim().isLength({ min: 2 }).withMessage('Position must be at least 2 characters'),
  body('department').trim().isLength({ min: 2 }).withMessage('Department must be at least 2 characters'),
  body('salary').isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
  body('hireDate').isISO8601().withMessage('Please provide a valid hire date')
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
      position,
      department,
      salary,
      hireDate,
      address,
      emergencyContact,
      employeeId,
      workSchedule
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if employee ID already exists
    if (employeeId) {
      const existingEmployee = await User.findOne({ employeeId });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists'
        });
      }
    }

    // Create new staff member
    const staffMember = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      role: 'staff',
      position,
      department,
      salary,
      hireDate,
      employeeId,
      workSchedule,
      // Creation tracking
      createdBy: req.user.userId,
      createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim(),
      creationMethod: 'manual',
      isActive: true
    });

    await staffMember.save();

    // Send account creation email to staff member
    try {
      const Email = require('../utils/email');
      const SMTPSettings = require('../models/SMTPSettings');
      
      // Try to use SMTP settings first
      const smtpSettings = await SMTPSettings.findOne({ isActive: true });
      
      if (smtpSettings) {
        const emailHtml = Email.templates.staffAccountCreatedTemplate({
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          email: staffMember.email,
          password: password, // Include password in email
          position: staffMember.position,
          department: staffMember.department,
          employeeId: staffMember.employeeId,
          loginUrl: process.env.FRONTEND_URL || 'https://hyphendubai.vercel.app/login',
          createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim()
        });
        
        await smtpSettings.sendEmail(
          staffMember.email,
          `Welcome to Hyphen Gym Staff Team, ${staffMember.firstName}!`,
          emailHtml
        );
        console.log(`✅ Staff account creation email sent to ${staffMember.email}`);
      } else {
        // Fallback to direct email sending
        const emailHtml = Email.templates.staffAccountCreatedTemplate({
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          email: staffMember.email,
          password: password,
          position: staffMember.position,
          department: staffMember.department,
          employeeId: staffMember.employeeId,
          loginUrl: process.env.FRONTEND_URL || 'https://hyphendubai.vercel.app/login',
          createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim()
        });
        
        await Email.sendEmail({
          to: staffMember.email,
          subject: `Welcome to Hyphen Gym Staff Team, ${staffMember.firstName}!`,
          html: emailHtml
        });
        console.log(`✅ Staff account creation email sent to ${staffMember.email}`);
      }
    } catch (emailError) {
      console.error('Error sending staff account creation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: {
        staffMember: {
          id: staffMember._id,
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          email: staffMember.email,
          phone: staffMember.phone,
          dateOfBirth: staffMember.dateOfBirth,
          gender: staffMember.gender,
          role: staffMember.role,
          position: staffMember.position,
          department: staffMember.department,
          salary: staffMember.salary,
          hireDate: staffMember.hireDate,
          employeeId: staffMember.employeeId
        }
      }
    });

  } catch (error) {
    console.error('Create staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating staff member'
    });
  }
});

// Update staff member (Admin only)
router.put('/:id', auth, adminAuth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('position').optional().trim().isLength({ min: 2 }),
  body('department').optional().trim().isLength({ min: 2 }),
  body('salary').optional().isFloat({ min: 0 }),
  body('hireDate').optional().isISO8601()
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
      'address', 'emergencyContact', 'isActive', 'position', 'department', 
      'salary', 'hireDate', 'employeeId', 'workSchedule'
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

    // Check if employee ID is being updated and if it's already taken
    if (updates.employeeId) {
      const existingEmployee = await User.findOne({ 
        employeeId: updates.employeeId, 
        _id: { $ne: req.params.id } 
      });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID is already taken by another staff member'
        });
      }
    }

    const staffMember = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!staffMember || staffMember.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: { staffMember }
    });

  } catch (error) {
    console.error('Update staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating staff member'
    });
  }
});

// Deactivate staff member (Admin only)
router.put('/:id/deactivate', auth, adminAuth, async (req, res) => {
  try {
    const staffMember = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!staffMember || staffMember.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member deactivated successfully',
      data: { staffMember }
    });

  } catch (error) {
    console.error('Deactivate staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating staff member'
    });
  }
});

// Reactivate staff member (Admin only)
router.put('/:id/reactivate', auth, adminAuth, async (req, res) => {
  try {
    const staffMember = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!staffMember || staffMember.role !== 'staff') {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member reactivated successfully',
      data: { staffMember }
    });

  } catch (error) {
    console.error('Reactivate staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reactivating staff member'
    });
  }
});

// Get staff by department
router.get('/department/:department', auth, adminAuth, async (req, res) => {
  try {
    const staff = await User.find({ 
      role: 'staff', 
      department: req.params.department,
      isActive: true 
    })
    .select('-password')
    .sort({ firstName: 1 });

    res.json({
      success: true,
      data: { staff }
    });

  } catch (error) {
    console.error('Get staff by department error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff by department'
    });
  }
});

module.exports = router;
