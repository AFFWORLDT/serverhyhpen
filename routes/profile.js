const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { createCloudinaryStorage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();

// Configure Cloudinary for file uploads
const upload = createCloudinaryStorage('profiles', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880); // 5MB

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure profileImage is included in response (even if null)
    const userData = user.toObject();
    if (!userData.profileImage) {
      userData.profileImage = null;
    }

    res.json({
      success: true,
      data: { user: userData }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('phone').optional().isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10-15 digits'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Please select a valid gender'),
  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.zipCode').optional().trim(),
  body('address.country').optional().trim(),
  body('emergencyContact.name').optional().trim(),
  body('emergencyContact.phone').optional().trim(),
  body('emergencyContact.relationship').optional().trim(),
  body('profileImage').optional().isString(),
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

    const allowedFields = [
      'firstName', 'lastName', 'phone', 'dateOfBirth', 'gender',
      'address', 'emergencyContact', 'profileImage' 
    ];

    // Role-specific fields
    if (req.user.role === 'trainer') {
      allowedFields.push('specialization', 'experience', 'certification', 'hourlyRate');
    }
    if (req.user.role === 'staff') {
      allowedFields.push('position', 'department', 'workSchedule');
    }

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Upload profile image
router.post('/profile/image', auth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile image from Cloudinary if exists
    if (user.profileImage) {
      try {
        await deleteImage(user.profileImage);
      } catch (deleteError) {
        console.log('Old image deletion warning:', deleteError.message);
        // Continue even if old image deletion fails
      }
    }

    // Update user with new Cloudinary URL
    user.profileImage = req.file.secure_url || req.file.url;
    await user.save();

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profileImage: user.profileImage,
        publicId: req.file.public_id,
        width: req.file.width,
        height: req.file.height,
        format: req.file.format
      }
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: error.message
    });
  }
});

// Delete user account
router.delete('/profile', auth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for account deletion'
      });
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify password
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }
    
    // Check if user has active memberships, sessions, or payments
    const TrainingSession = require('../models/TrainingSession');
    const Membership = require('../models/Membership');
    const Payment = require('../models/Payment');
    
    const activeSessions = await TrainingSession.countDocuments({
      $or: [
        { member: user._id, status: { $in: ['scheduled', 'in_progress'] } },
        { trainer: user._id, status: { $in: ['scheduled', 'in_progress'] } }
      ]
    });
    
    const activeMemberships = await Membership.countDocuments({
      member: user._id,
      status: 'active'
    });
    
    if (activeSessions > 0 || activeMemberships > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account with active sessions or memberships. Please cancel them first.'
      });
    }
    
    // Delete profile image from Cloudinary if exists
    if (user.profileImage) {
      try {
        await deleteImage(user.profileImage);
      } catch (deleteError) {
        console.log('Image deletion warning:', deleteError.message);
      }
    }

    // Soft delete - set isActive to false
    user.isActive = false;
    user.email = `${user.email}_deleted_${Date.now()}`;
    user.profileImage = null;
    await user.save();
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match');
    }
    return true;
  })
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

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let stats = {};

    if (userRole === 'member') {
      // Member-specific stats
      const GymSession = require('../models/GymSession');
      const Membership = require('../models/Membership');
      
      const [sessionCount, activeMembership] = await Promise.all([
        GymSession.countDocuments({ memberId: userId }),
        Membership.findOne({ memberId: userId, status: 'active' })
      ]);

      stats = {
        totalSessions: sessionCount,
        activeMembership: !!activeMembership,
        membershipExpiry: activeMembership?.endDate || null
      };
    } else if (userRole === 'trainer') {
      // Trainer-specific stats
      const TrainingSession = require('../models/TrainingSession');
      const Class = require('../models/Class');
      
      const [sessionCount, classCount] = await Promise.all([
        TrainingSession.countDocuments({ trainerId: userId }),
        Class.countDocuments({ trainerId: userId })
      ]);

      stats = {
        totalSessions: sessionCount,
        totalClasses: classCount,
        averageRating: req.user.average_rating || 0
      };
    } else if (userRole === 'staff') {
      // Staff-specific stats
      const CalendarEvent = require('../models/CalendarEvent');
      
      const eventCount = await CalendarEvent.countDocuments({
        $or: [
          { createdBy: userId },
          { assignedTo: userId }
        ]
      });

      stats = {
        totalEvents: eventCount
      };
    }

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    });
  }
});

module.exports = router;
