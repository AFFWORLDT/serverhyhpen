const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all staff members
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const department = req.query.department || '';

    let query = { role: 'staff' };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } }
      ];
    }

    if (department) {
      query.department = department;
    }

    const staff = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
      isActive: true
    });

    await staffMember.save();

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

// Get staff statistics
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalStaff = await User.countDocuments({ role: 'staff' });
    const activeStaff = await User.countDocuments({ role: 'staff', isActive: true });
    
    const departmentStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    const positionStats = await User.aggregate([
      { $match: { role: 'staff', isActive: true } },
      { $group: { _id: '$position', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalStaff,
        activeStaff,
        departmentStats,
        positionStats
      }
    });

  } catch (error) {
    console.error('Get staff stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff statistics'
    });
  }
});

module.exports = router;
