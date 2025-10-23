const express = require('express');
const mongoose = require('mongoose');
const { GymSession } = require('../models/GymSession');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all sessions with pagination and filters
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { status, memberId, trainerId, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (status === 'active') {
      filter.checkOutTime = null;
    } else if (status === 'completed') {
      filter.checkOutTime = { $ne: null };
    }
    
    if (memberId) {
      filter.member = memberId;
    }
    
    if (trainerId) {
      filter.trainer = trainerId;
    }
    
    if (startDate || endDate) {
      filter.checkInTime = {};
      if (startDate) {
        filter.checkInTime.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.checkInTime.$lte = new Date(endDate);
      }
    }
    
    const sessions = await GymSession.find(filter)
      .populate('member', 'firstName lastName email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GymSession.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
    
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sessions'
    });
  }
});

// Get session by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await GymSession.findById(id)
      .populate('member', 'firstName lastName email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName');
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      data: { session }
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session'
    });
  }
});

// Create new session (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { memberId, trainerId, notes } = req.body;
    
    // Verify member exists
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Check if member already has an active session
    const activeSession = await GymSession.findOne({
      member: memberId,
      checkOutTime: null
    });
    
    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: 'Member already has an active session'
      });
    }
    
    // Verify trainer exists (if provided)
    let trainer = null;
    if (trainerId) {
      trainer = await User.findById(trainerId);
      if (!trainer || trainer.role !== 'trainer') {
        return res.status(404).json({
          success: false,
          message: 'Trainer not found'
        });
      }
    }
    
    // Create new session
    const session = new GymSession({
      member: memberId,
      trainer: trainerId || null,
      checkInTime: new Date(),
      notes: notes || '',
      checkedInBy: req.user.userId
    });
    
    await session.save();
    
    // Populate session data
    await session.populate('member', 'firstName lastName email phone');
    if (trainerId) {
      await session.populate('trainer', 'firstName lastName email');
    }
    await session.populate('checkedInBy', 'firstName lastName');
    
    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: { session }
    });
    
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating session'
    });
  }
});

// Update session (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { trainerId, notes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await GymSession.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    // Verify trainer exists (if provided)
    if (trainerId) {
      const trainer = await User.findById(trainerId);
      if (!trainer || trainer.role !== 'trainer') {
        return res.status(404).json({
          success: false,
          message: 'Trainer not found'
        });
      }
      session.trainer = trainerId;
    }
    
    if (notes !== undefined) {
      session.notes = notes;
    }
    
    await session.save();
    
    // Populate session data
    await session.populate('member', 'firstName lastName email phone');
    if (session.trainer) {
      await session.populate('trainer', 'firstName lastName email');
    }
    await session.populate('checkedInBy', 'firstName lastName');
    if (session.checkedOutBy) {
      await session.populate('checkedOutBy', 'firstName lastName');
    }
    
    res.json({
      success: true,
      message: 'Session updated successfully',
      data: { session }
    });
    
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating session'
    });
  }
});

// Delete session (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await GymSession.findById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    await GymSession.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting session'
    });
  }
});

// Get session statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const filter = {
      checkInTime: { $gte: startDate, $lt: endDate }
    };
    
    const [
      totalSessions,
      activeSessions,
      completedSessions,
      avgDuration
    ] = await Promise.all([
      GymSession.countDocuments(filter),
      GymSession.countDocuments({ ...filter, checkOutTime: null }),
      GymSession.countDocuments({ ...filter, checkOutTime: { $ne: null } }),
      GymSession.aggregate([
        { $match: { ...filter, checkOutTime: { $ne: null } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        total: totalSessions,
        active: activeSessions,
        completed: completedSessions,
        averageDuration: avgDuration.length > 0 ? Math.round(avgDuration[0].avgDuration) : 0
      }
    });
    
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session statistics'
    });
  }
});

// Get sessions by member
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    const sessions = await GymSession.find({ member: memberId })
      .populate('member', 'firstName lastName email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GymSession.countDocuments({ member: memberId });
    
    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
    
  } catch (error) {
    console.error('Get member sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching member sessions'
    });
  }
});

// Get sessions by trainer
router.get('/trainer/:trainerId', auth, async (req, res) => {
  try {
    const { trainerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    if (!mongoose.Types.ObjectId.isValid(trainerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trainer ID format'
      });
    }
    
    const sessions = await GymSession.find({ trainer: trainerId })
      .populate('member', 'firstName lastName email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GymSession.countDocuments({ trainer: trainerId });
    
    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
    
  } catch (error) {
    console.error('Get trainer sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trainer sessions'
    });
  }
});

// Get session history
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { memberId, trainerId, startDate, endDate, status } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (memberId) {
      filter.member = memberId;
    }
    
    if (trainerId) {
      filter.trainer = trainerId;
    }
    
    if (status === 'active') {
      filter.checkOutTime = null;
    } else if (status === 'completed') {
      filter.checkOutTime = { $ne: null };
    }
    
    if (startDate || endDate) {
      filter.checkInTime = {};
      if (startDate) {
        filter.checkInTime.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.checkInTime.$lte = new Date(endDate);
      }
    }
    
    const sessions = await GymSession.find(filter)
      .populate('member', 'firstName lastName email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('checkedInBy', 'firstName lastName')
      .populate('checkedOutBy', 'firstName lastName')
      .sort({ checkInTime: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GymSession.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session history',
      error: error.message
    });
  }
});

module.exports = router;
