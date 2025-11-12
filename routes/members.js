const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const { Membership } = require('../models/Membership');
const Programme = require('../models/Programme');
const TrainingSession = require('../models/TrainingSession');
const MemberPackage = require('../models/MemberPackage');
const Appointment = require('../models/Appointment');
const { auth, adminAuth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const Email = require('../utils/email');
const { createCloudinaryStorage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();

// Configure Cloudinary for profile image uploads
const upload = createCloudinaryStorage('profiles', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880); // 5MB

/**
 * @swagger
 * /members:
 *   get:
 *     summary: Get all members or own data
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *     responses:
 *       200:
 *         description: List of members
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
 *                     members:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *       403:
 *         description: Access denied
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// Get all members (Admin/Trainer/Staff) or own data (Member)
router.get('/', auth, async (req, res) => {
  try {
    // If user is member, only return their own data
    if (req.user.role === 'member') {
      const member = await User.findById(req.user.userId)
        .select('-password')
        .populate('assignedTrainer', 'firstName lastName email phone specialization profileImage');
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
    
    // For Admin/Trainer/Staff - get all members
    if (!['admin', 'trainer', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin, Trainer, or Staff privileges required.'
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
      .limit(limit)
      .lean(); // Use .lean() for better performance

    const total = await User.countDocuments(query);

    // Calculate stats across ALL members (not just paginated ones)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const activeMembers = await User.countDocuments({ ...query, isActive: true });
    const newThisMonth = await User.countDocuments({ 
      ...query, 
      createdAt: { $gte: startOfMonth } 
    });

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        },
        stats: {
          total,
          active: activeMembers,
          newThisMonth
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

// Assign trainer to member (Admin only)
router.post('/:id/assign-trainer', auth, adminAuth, [
  body('trainerId').isMongoId().withMessage('Valid trainerId is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { id } = req.params;
    const { trainerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid member ID' });
    }

    const member = await User.findById(id);
    if (!member || member.role !== 'member') {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const trainer = await User.findById(trainerId);
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(400).json({ success: false, message: 'Trainer not found' });
    }

    member.assignedTrainer = trainerId;
    await member.save();

    await member.populate({ path: 'assignedTrainer', select: 'firstName lastName email phone specialization profileImage' });

    // Send trainer assignment email
    try {
      if (member.email && member.assignedTrainer) {
        const html = Email.templates.trainerAssignedTemplate({
          firstName: member.firstName,
          trainerName: `${member.assignedTrainer.firstName} ${member.assignedTrainer.lastName}`,
          trainerEmail: member.assignedTrainer.email,
          trainerPhone: member.assignedTrainer.phone || 'N/A',
          specialization: member.assignedTrainer.specialization || 'General Fitness',
          assignmentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        });
        await Email.sendEmail({
          to: member.email,
          subject: `Your Personal Trainer Assignment - ${member.assignedTrainer.firstName} ${member.assignedTrainer.lastName}`,
          html
        });
      }
    } catch (e) {
      console.error('Trainer assignment email error:', e.message);
    }

    res.json({ success: true, message: 'Trainer assigned successfully', data: { member } });
  } catch (error) {
    console.error('Assign trainer error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign trainer' });
  }
});

// Get trainer's members (Trainer only)
router.get('/trainer/my-members', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ success: false, message: 'Trainer role required' });
    }

    const members = await User.find({ role: 'member', assignedTrainer: req.user.userId })
      .select('firstName lastName email phone fitnessLevel assignedProgramme programmeEndDate');

    res.json({ success: true, data: { members } });
  } catch (error) {
    console.error('Get trainer members error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trainer members' });
  }
});

// Get members assigned to a specific trainer (Admin or Trainer)
router.get('/trainer/:trainerId/assigned', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { trainerId } = req.params;
    
    // Trainers can only view their own assigned members
    if (req.user.role === 'trainer' && req.user.userId.toString() !== trainerId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only view your own assigned members' 
      });
    }

    const members = await User.find({ role: 'member', assignedTrainer: trainerId })
      .select('firstName lastName email phone fitnessLevel assignedProgramme programmeEndDate membershipStatus')
      .populate('assignedProgramme', 'name description');

    res.json({ success: true, data: { members, total: members.length } });
  } catch (error) {
    console.error('Get trainer assigned members error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assigned members' });
  }
});

// Membership summary
router.get('/:id/membership/summary', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid member ID' });
    }
    if (req.user.role === 'member' && req.user.userId.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    const member = await User.findById(id).select('membershipValidityStart membershipValidityEnd sessionsTotal sessionsUsed assignedTrainer');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    const now = new Date();
    const activeWindow = member.membershipValidityStart && member.membershipValidityEnd && now >= new Date(member.membershipValidityStart) && now <= new Date(member.membershipValidityEnd);
    const exhausted = (member.sessionsUsed || 0) >= (member.sessionsTotal || 0);
    const status = !member.membershipValidityEnd ? 'inactive' : (!activeWindow ? 'expired' : (exhausted ? 'exhausted' : 'active'));
    res.json({ success: true, data: {
      sessionsTotal: member.sessionsTotal || 0,
      sessionsUsed: member.sessionsUsed || 0,
      remaining: Math.max(0, (member.sessionsTotal || 0) - (member.sessionsUsed || 0)),
      validityStart: member.membershipValidityStart,
      validityEnd: member.membershipValidityEnd,
      status,
      assignedTrainer: member.assignedTrainer
    }});
  } catch (error) {
    console.error('Membership summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch membership summary' });
  }
});

// Upload member profile image (Admin only) - MUST BE BEFORE /:id ROUTE
router.post('/:id/profile-image', auth, adminAuth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { id } = req.params;
    
    // Validate ObjectId
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

    if (member.role !== 'member') {
      return res.status(400).json({
        success: false,
        message: 'User is not a member'
      });
    }

    // Delete old profile image from Cloudinary if exists
    if (member.profileImage) {
      try {
        await deleteImage(member.profileImage);
      } catch (deleteError) {
        console.log('Old image deletion warning:', deleteError.message);
        // Continue even if old image deletion fails
      }
    }

    // Update member with new Cloudinary URL
    member.profileImage = req.file.secure_url || req.file.url;
    await member.save();

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profileImage: member.profileImage,
        publicId: req.file.public_id,
        width: req.file.width,
        height: req.file.height,
        format: req.file.format
      }
    });
  } catch (error) {
    console.error('Upload member profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: error.message
    });
  }
});

// Get member by ID (Members can view their own, Admin/Staff/Trainer can view any)
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('Fetching member with ID:', req.params.id);
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    // Authorization: Members can only view their own data
    if (req.user.role === 'member' && req.user.userId.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own data.'
      });
    }
    
    const member = await User.findById(req.params.id)
      .select('-password')
      .populate('assignedTrainer', 'firstName lastName email phone specialization profileImage');

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

// Create new member (Admin or Trainer)
router.post('/', auth, adminOrTrainerAuth, [
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

    // Get creator info
    const creator = await User.findById(req.user.userId);
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'System';
    const creationMethod = req.user.role === 'admin' ? 'manual' : req.user.role === 'trainer' ? 'manual' : 'api';

    // Create new member with creator tracking
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
      role: 'member',
      createdBy: req.user.userId,
      createdByName: creatorName,
      creationMethod: creationMethod
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
router.put('/:id', auth, adminOrTrainerOrStaffAuth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('profileImage').optional().isString(),
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

    const allowedUpdates = ['firstName', 'lastName', 'profileImage', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'emergencyContact', 'isActive', 'createdAt'];
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      profileImage: req.body.profileImage,
      email: req.body.email,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
    };

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

    // Send account deactivated email
    try {
      const html = Email.templates.accountDeactivatedTemplate({
        firstName: member.firstName,
        reason: req.body.reason || 'Account deactivated by administrator'
      });
      await Email.sendEmail({
        to: member.email,
        subject: 'Account Deactivated - Hyphen Wellness',
        html
      });
    } catch (e) {
      console.error('Account deactivation email error:', e.message);
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

    // Send account activated email
    try {
      const html = Email.templates.accountActivatedTemplate({
        firstName: member.firstName
      });
      await Email.sendEmail({
        to: member.email,
        subject: 'Account Activated - Hyphen Wellness',
        html
      });
    } catch (e) {
      console.error('Account activation email error:', e.message);
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
router.get('/:id/memberships', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    // Return packages instead of memberships - packages ARE memberships
    const packages = await MemberPackage.find({ member: req.params.id })
      .populate('package', 'name sessions pricePerSession totalPrice validityMonths features')
      .populate('assignedTrainer', 'firstName lastName email profileImage')
      .populate('purchasedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { memberships: packages } // Keep 'memberships' key for backward compatibility
    });

  } catch (error) {
    console.error('Get member packages (memberships) error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching member packages'
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
      { path: 'assignedTrainer', select: 'firstName lastName email phone specialization' },
      { path: 'assignedProgramme', select: 'name description duration_in_weeks' }
    ]);
    
    // Send programme assigned email
    try {
      const html = Email.templates.programmeAssignedTemplate({
        firstName: member.firstName,
        programmeName: programme.name,
        trainerName: member.assignedTrainer ? `${member.assignedTrainer.firstName} ${member.assignedTrainer.lastName}` : null,
        duration: `${programme.duration_in_weeks} weeks`,
        sessions: programme.sessionCount || programme.duration_in_weeks * 2,
        description: programme.description
      });
      await Email.sendEmail({
        to: member.email,
        subject: 'Training Programme Assigned - Hyphen Wellness',
        html
      });
    } catch (e) {
      console.error('Programme assignment email error:', e.message);
    }
    
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
router.get('/:id/sessions', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
      .populate('trainer', 'firstName lastName email profileImage')
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
router.get('/:id/stats', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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
      .populate('trainer', 'firstName lastName profileImage')
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
router.get('/stats/overview', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
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

// Get comprehensive member analytics
router.get('/analytics', auth, adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    // Overview metrics
    const totalMembers = await User.countDocuments({ role: 'member' });
    const activeMembers = await User.countDocuments({ role: 'member', isActive: true });
    const inactiveMembers = totalMembers - activeMembers;
    
    const newThisMonth = await User.countDocuments({ 
      role: 'member', 
      createdAt: { $gte: firstDayOfMonth } 
    });
    
    const newLastMonth = await User.countDocuments({ 
      role: 'member', 
      createdAt: { $gte: firstDayOfLastMonth, $lte: lastDayOfLastMonth } 
    });

    // Calculate growth rate
    const growthRate = newLastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth * 100) : 0;

    // Calculate retention and churn
    const activeLastMonth = await User.countDocuments({
      role: 'member',
      createdAt: { $lt: firstDayOfMonth },
      isActive: true
    });
    const totalLastMonth = await User.countDocuments({
      role: 'member',
      createdAt: { $lt: firstDayOfMonth }
    });
    const retentionRate = totalLastMonth > 0 ? (activeLastMonth / totalLastMonth * 100) : 0;
    const churnRate = 100 - retentionRate;

    // Demographics - Gender
    const genderStats = await User.aggregate([
      { $match: { role: 'member' } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
      { $project: { 
        _id: 1, 
        count: 1, 
        percentage: { $multiply: [{ $divide: ['$count', totalMembers] }, 100] }
      }}
    ]);

    // Demographics - Age groups
    const ageStats = await User.aggregate([
      { $match: { role: 'member', dateOfBirth: { $exists: true } } },
      { 
        $addFields: { 
          age: { 
            $floor: { 
              $divide: [
                { $subtract: [new Date(), '$dateOfBirth'] },
                365.25 * 24 * 60 * 60 * 1000
              ]
            }
          }
        }
      },
      { $group: { _id: '$age', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Package analytics
    const activePackages = await MemberPackage.find({ status: 'active' }).populate('member package');
    const expiredPackages = await MemberPackage.find({ status: 'completed' }).populate('member package');
    const expiringSoon = await MemberPackage.find({
      status: 'active',
      validityEnd: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    }).populate('member package');

    const totalRevenue = activePackages.reduce((sum, pkg) => sum + (pkg.package?.price || 0), 0) +
                         expiredPackages.reduce((sum, pkg) => sum + (pkg.package?.price || 0), 0);

    // Engagement analytics
    const thirtyDaysAppointments = await Appointment.aggregate([
      {
        $match: {
          startDate: { $gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$client',
          sessionCount: { $sum: 1 }
        }
      }
    ]);

    let highlyActive = 0;
    let moderate = 0;
    let lowActivity = 0;
    
    thirtyDaysAppointments.forEach(member => {
      if (member.sessionCount >= 10) highlyActive++;
      else if (member.sessionCount >= 4) moderate++;
      else lowActivity++;
    });

    const atRisk = activeMembers - (highlyActive + moderate + lowActivity);
    const avgSessionsPerMember = thirtyDaysAppointments.length > 0
      ? thirtyDaysAppointments.reduce((sum, m) => sum + m.sessionCount, 0) / thirtyDaysAppointments.length
      : 0;

    // Trends - Last 6 months signups
    const signupTrends = await User.aggregate([
      { $match: { role: 'member', createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
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
          total: totalMembers,
          active: activeMembers,
          inactive: inactiveMembers,
          newThisMonth,
          newLastMonth,
          churnRate,
          retentionRate,
          growthRate
        },
        demographics: {
          byGender: genderStats,
          byAge: ageStats,
          byLocation: []
        },
        packages: {
          active: activePackages,
          expired: expiredPackages,
          expiringSoon,
          totalRevenue
        },
        engagement: {
          highlyActive,
          moderate,
          lowActivity,
          atRisk,
          avgSessionsPerMember
        },
        trends: {
          signups: signupTrends,
          checkIns: [],
          revenue: []
        }
      }
    });
  } catch (error) {
    console.error('Error fetching member analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Bulk operations - Activate/Deactivate members
router.post('/bulk-action', auth, adminAuth, async (req, res) => {
  try {
    const { action, memberIds } = req.body;

    if (!action || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message: 'Action and memberIds array are required'
      });
    }

    let updateData = {};
    if (action === 'activate') {
      updateData = { isActive: true };
    } else if (action === 'deactivate') {
      updateData = { isActive: false };
    } else if (action === 'delete') {
      await User.deleteMany({ _id: { $in: memberIds }, role: 'member' });
      return res.json({
        success: true,
        message: `${memberIds.length} members deleted successfully`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: memberIds }, role: 'member' },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} members ${action}d successfully`
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

// Export members data as CSV
router.get('/export', auth, adminAuth, async (req, res) => {
  try {
    const members = await User.find({ role: 'member' })
      .select('firstName lastName email phone gender dateOfBirth address isActive createdAt')
      .populate('assignedTrainer', 'firstName lastName profileImage')
      .lean();

    // Create CSV header
    const csvHeader = 'First Name,Last Name,Email,Phone,Gender,Date of Birth,City,Active,Trainer,Joined Date\n';
    
    // Create CSV rows
    const csvRows = members.map(member => {
      return [
        member.firstName || '',
        member.lastName || '',
        member.email || '',
        member.phone || '',
        member.gender || '',
        member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : '',
        member.address?.city || '',
        member.isActive ? 'Yes' : 'No',
        member.assignedTrainer ? `${member.assignedTrainer.firstName} ${member.assignedTrainer.lastName}` : '',
        new Date(member.createdAt).toLocaleDateString()
      ].map(field => `"${field}"`).join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=members-export-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export members',
      error: error.message
    });
  }
});

module.exports = router;
