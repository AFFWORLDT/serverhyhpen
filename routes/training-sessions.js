const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const TrainingSession = require('../models/TrainingSession');
const User = require('../models/User');
const Programme = require('../models/Programme');
const { auth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const Email = require('../utils/email');

const router = express.Router();

// Get all training sessions with pagination and filters
// Role-aware: trainer sees own; member sees own; staff/admin can see all
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { member, trainer, programme, status, start_date, end_date } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Scope by role
    if (req.user.role === 'trainer') {
      filter.trainer = req.user.userId;
    } else if (req.user.role === 'member') {
      filter.member = req.user.userId;
    } else if (trainer) {
      filter.trainer = trainer;
    }
    
    if (member) {
      filter.member = member;
    }
    
    if (programme) {
      filter.programme = programme;
    }
    
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
      .populate('member', 'name email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('programme', 'name description')
      .sort({ session_start_time: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await TrainingSession.countDocuments(filter);
    
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
    console.error('Error fetching training sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training sessions',
      error: error.message
    });
  }
});

// Get training session by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await TrainingSession.findById(id)
      .populate('member', 'name email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('programme', 'name description')
      .populate('exercises_completed.exercise', 'name description muscle_group');
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Training session not found'
      });
    }
    
    // Check if user can view this session (trainer can only view their own sessions)
    if (req.user.role === 'trainer' && session.trainer._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own sessions'
      });
    }
    
    res.json({
      success: true,
      data: { session }
    });
  } catch (error) {
    console.error('Error fetching training session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training session',
      error: error.message
    });
  }
});

// Create new training session (Trainer/Admin/Staff scheduling)
router.post('/', auth, adminOrTrainerOrStaffAuth, [
  body('member').isMongoId().withMessage('Invalid member ID'),
  body('programme').optional().isMongoId().withMessage('Invalid programme ID'),
  body('session_start_time').isISO8601().withMessage('Please provide a valid session start time')
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
      member,
      programme,
      session_start_time,
      remarks
    } = req.body;
    
    // Validate member exists and belongs to trainer
    const memberDoc = await User.findById(member);
    if (!memberDoc) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Determine trainer: trainers schedule for themselves; admin/staff must provide trainer
    let trainerId = req.user.userId;
    if (req.user.role !== 'trainer') {
      trainerId = req.body.trainer || memberDoc.assignedTrainer;
    }
    if (!trainerId) {
      return res.status(400).json({ success: false, message: 'trainer is required or member must have assignedTrainer' });
    }
    
    // Validate programme exists
    if (programme) {
      const programmeDoc = await Programme.findById(programme);
      if (!programmeDoc) {
        return res.status(404).json({ success: false, message: 'Programme not found' });
      }
    }
    
    const session = new TrainingSession({
      member,
      trainer: trainerId,
      programme,
      session_start_time: new Date(session_start_time),
      remarks: remarks || '',
      status: 'scheduled'
    });
    
    await session.save();
    // Notify member about schedule
    try {
      const [memberUser, trainerUser] = await Promise.all([
        User.findById(member),
        User.findById(trainerId)
      ]);
      const html = Email.templates.sessionScheduledTemplate({
        firstName: memberUser.firstName,
        trainerName: `${trainerUser.firstName} ${trainerUser.lastName}`,
        when: new Date(session_start_time).toLocaleString(),
        location: req.body.location
      });
      await Email.sendEmail({ to: memberUser.email, subject: 'Your Session is Scheduled', html });
    } catch (e) {
      console.error('Schedule email error:', e.message);
    }
    
    // Populate the created session
    await session.populate([
      { path: 'member', select: 'name email phone' },
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'programme', select: 'name description' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Training session created successfully',
      data: { session }
    });
  } catch (error) {
    console.error('Error creating training session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create training session',
      error: error.message
    });
  }
});

// Update training session (Trainer or Admin only)
router.put('/:id', auth, adminOrTrainerAuth, [
  body('session_start_time').optional().isISO8601().withMessage('Please provide a valid session start time'),
  body('session_end_time').optional().isISO8601().withMessage('Please provide a valid session end time'),
  body('live_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const session = await TrainingSession.findById(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Training session not found'
      });
    }
    
    // Check if user can update this session (trainer can only update their own sessions)
    if (req.user.role === 'trainer' && session.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own sessions'
      });
    }
    
    const updatedSession = await TrainingSession.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'member', select: 'name email phone' },
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'programme', select: 'name description' }
    ]);
    // If rescheduled, notify member
    try {
      if (req.body.session_start_time) {
        const memberUser = await User.findById(updatedSession.member);
        const trainerUser = await User.findById(updatedSession.trainer);
        const html = Email.templates.sessionRescheduledTemplate({
          firstName: memberUser.firstName,
          trainerName: `${trainerUser.firstName} ${trainerUser.lastName}`,
          when: new Date(updatedSession.session_start_time).toLocaleString(),
          location: req.body.location
        });
        await Email.sendEmail({ to: memberUser.email, subject: 'Your Session was Rescheduled', html });
      }
    } catch (e) {
      console.error('Reschedule email error:', e.message);
    }
    
    res.json({
      success: true,
      message: 'Training session updated successfully',
      data: { session: updatedSession }
    });
  } catch (error) {
    console.error('Error updating training session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update training session',
      error: error.message
    });
  }
});

// Complete training session with rating and remarks
router.post('/:id/complete', auth, adminOrTrainerAuth, [
  body('live_rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('remarks').optional().isString().withMessage('Remarks must be a string'),
  body('exercises_completed').optional().isArray().withMessage('Exercises completed must be an array'),
  body('trainer_notes').optional().isString().withMessage('Trainer notes must be a string'),
  body('next_session_recommendations').optional().isString().withMessage('Recommendations must be a string')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { live_rating, remarks, exercises_completed, trainer_notes, next_session_recommendations } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await TrainingSession.findById(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Training session not found'
      });
    }
    
    // Check if user can complete this session (trainer can only complete their own sessions)
    if (req.user.role === 'trainer' && session.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only complete your own sessions'
      });
    }
    
    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Session is already completed'
      });
    }
    
    session.live_rating = live_rating;
    session.remarks = remarks || '';
    session.session_end_time = new Date();
    session.status = 'completed';
    session.submission_timestamp = new Date();
    session.exercises_completed = exercises_completed || [];
    session.trainer_notes = trainer_notes || '';
    session.next_session_recommendations = next_session_recommendations || '';
    
    // Automatically mark attendance as present when completing session (if not already marked)
    if (!session.member_attendance || session.member_attendance === null) {
      session.member_attendance = 'present';
      session.attendance_marked_at = new Date();
      session.attendance_marked_by = req.user.userId;
    }
    
    await session.save();
    // Notify
    try {
      const memberUser = await User.findById(session.member);
      const html = Email.templates.sessionCancelledTemplate({
        firstName: memberUser.firstName,
        when: new Date(session.session_start_time).toLocaleString(),
        reason
      });
      await Email.sendEmail({ to: memberUser.email, subject: 'Your Session was Cancelled', html });
    } catch (e) {
      console.error('Cancel email error:', e.message);
    }
    
    // Increment sessionsUsed if within validity window
    try {
      const member = await User.findById(session.member);
      const now = new Date();
      const withinValidity = member && member.membershipValidityStart && member.membershipValidityEnd && now >= new Date(member.membershipValidityStart) && now <= new Date(member.membershipValidityEnd);
      if (member && withinValidity) {
        member.sessionsUsed = (member.sessionsUsed || 0) + 1;
        await member.save();
      }
    } catch (e) {
      console.error('Post-complete membership increment error:', e.message);
    }

    // Populate the completed session
    await session.populate([
      { path: 'member', select: 'name email phone' },
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'programme', select: 'name description' }
    ]);
    // Notify completion
    try {
      const [memberUser, trainerUser] = await Promise.all([
        User.findById(session.member),
        User.findById(session.trainer)
      ]);
      const html = Email.templates.sessionCompletedTemplate({
        firstName: memberUser.firstName,
        trainerName: `${trainerUser.firstName} ${trainerUser.lastName}`,
        when: new Date(session.session_start_time).toLocaleString(),
        rating: session.live_rating
      });
      await Email.sendEmail({ to: memberUser.email, subject: 'Session Completed', html });
    } catch (e) {
      console.error('Complete email error:', e.message);
    }
    
    res.json({
      success: true,
      message: 'Training session completed successfully',
      data: { session }
    });
  } catch (error) {
    console.error('Error completing training session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete training session',
      error: error.message
    });
  }
});

// Mark member attendance for training session (Trainers can mark present/absent/late/no_show)
router.post('/:id/mark-attendance', auth, adminOrTrainerAuth, [
  body('attendance_status').isIn(['present', 'absent', 'no_show', 'late']).withMessage('Valid attendance status is required')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance_status } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await TrainingSession.findById(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Training session not found'
      });
    }
    
    // Check if user can mark attendance (trainer can only mark for their own sessions)
    if (req.user.role === 'trainer' && session.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only mark attendance for your own sessions'
      });
    }
    
    // Check if session time has passed (can mark attendance)
    const now = new Date();
    const sessionStart = new Date(session.session_start_time);
    
    // Allow marking attendance if session has started or is within 30 minutes before start
    const timeDiff = sessionStart.getTime() - now.getTime();
    const minutesBeforeSession = timeDiff / (1000 * 60);
    
    // Determine if late (if marking present and session has already started)
    let finalAttendanceStatus = attendance_status;
    if (attendance_status === 'present' && now > sessionStart) {
      const lateMinutes = (now.getTime() - sessionStart.getTime()) / (1000 * 60);
      if (lateMinutes > 15) { // Late if more than 15 minutes after start
        finalAttendanceStatus = 'late';
      }
    }
    
    // Update session attendance
    session.member_attendance = finalAttendanceStatus;
    session.attendance_marked_at = new Date();
    session.attendance_marked_by = req.user.userId;
    
    // If marking as present, also update status to in_progress if scheduled
    if (finalAttendanceStatus === 'present' && session.status === 'scheduled') {
      session.status = 'in_progress';
    }
    
    // If marking as absent or no_show, update status accordingly
    if (finalAttendanceStatus === 'no_show') {
      session.status = 'no_show';
    }
    
    await session.save();
    
    // Populate for response
    await session.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'programme', select: 'name description' }
    ]);
    
    res.json({
      success: true,
      message: `Member attendance marked as ${finalAttendanceStatus}`,
      data: { session }
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message
    });
  }
});

// Cancel training session
router.post('/:id/cancel', auth, adminOrTrainerAuth, [
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID format'
      });
    }
    
    const session = await TrainingSession.findById(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Training session not found'
      });
    }
    
    // Check if user can cancel this session
    if (req.user.role === 'trainer' && session.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own sessions'
      });
    }
    
    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed session'
      });
    }
    
    session.status = 'cancelled';
    session.remarks = reason || 'Session cancelled';
    
    await session.save();
    
    res.json({
      success: true,
      message: 'Training session cancelled successfully',
      data: { session }
    });
  } catch (error) {
    console.error('Error cancelling training session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel training session',
      error: error.message
    });
  }
});

// Get sessions by trainer
router.get('/trainer/:trainerId', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { status, start_date, end_date } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(trainerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trainer ID format'
      });
    }
    
    // If user is trainer, they can only view their own sessions
    if (req.user.role === 'trainer' && trainerId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own sessions'
      });
    }
    
    const filter = { trainer: trainerId };
    
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
      .populate('member', 'firstName lastName email phone')
      .populate('trainer', 'firstName lastName email')
      .populate('programme', 'name description')
      .sort({ session_start_time: -1 });
    
    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error fetching trainer sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainer sessions',
      error: error.message
    });
  }
});

// Get sessions by member
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status, start_date, end_date } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }
    
    // Authorization: Members can only view their own sessions
    if (req.user.role === 'member' && req.user.userId.toString() !== memberId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own sessions'
      });
    }
    
    // Admin/Trainer/Staff can view any member's sessions
    if (!['admin', 'trainer', 'staff', 'member'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const member = await User.findById(memberId);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    const filter = { member: memberId };
    
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
      .populate('member', 'firstName lastName email phone')
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

// Get session statistics
router.get('/stats/overview', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { trainer, start_date, end_date } = req.query;
    
    const filter = {};
    
    // If user is trainer, only show their stats
    if (req.user.role === 'trainer') {
      filter.trainer = req.user.userId;
    } else if (trainer) {
      filter.trainer = trainer;
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
    
    const totalSessions = await TrainingSession.countDocuments(filter);
    const completedSessions = await TrainingSession.countDocuments({ ...filter, status: 'completed' });
    const cancelledSessions = await TrainingSession.countDocuments({ ...filter, status: 'cancelled' });
    
    const averageRating = await TrainingSession.aggregate([
      { $match: { ...filter, status: 'completed', live_rating: { $exists: true } } },
      { $group: { _id: null, avgRating: { $avg: '$live_rating' } } }
    ]);
    
    const statusStats = await TrainingSession.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        cancelledSessions,
        averageRating: averageRating.length > 0 ? Math.round(averageRating[0].avgRating * 10) / 10 : 0,
        statusStats
      }
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session statistics',
      error: error.message
    });
  }
});

// Get training session statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const filter = {};
    
    // Authorization: Filter by role
    if (req.user.role === 'trainer') {
      filter.trainer = req.user.userId;
    } else if (req.user.role === 'member') {
      filter.member = req.user.userId;
    }
    // Admin/Staff can see all (no filter)
    
    const totalSessions = await TrainingSession.countDocuments(filter);
    
    const statusStats = await TrainingSession.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const ratingStats = await TrainingSession.aggregate([
      { $match: { ...filter, status: 'completed', live_rating: { $exists: true, $ne: null } } },
      { $group: {
        _id: null,
        averageRating: { $avg: '$live_rating' },
        totalRatings: { $sum: 1 },
        minRating: { $min: '$live_rating' },
        maxRating: { $max: '$live_rating' }
      }}
    ]);
    
    // Only show trainer stats for admin/staff (not for members)
    let trainerStats = [];
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      trainerStats = await TrainingSession.aggregate([
        { $match: filter },
        { $group: { _id: '$trainer', count: { $sum: 1 } } },
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
    }
    
    res.json({
      success: true,
      data: {
        totalSessions,
        statusStats,
        ratingStats: ratingStats[0] || { averageRating: 0, totalRatings: 0, minRating: 0, maxRating: 0 },
        trainerStats
      }
    });
  } catch (error) {
    console.error('Error fetching training session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch training session statistics',
      error: error.message
    });
  }
});
// Member request endpoints (reschedule/cancel)

// Request reschedule
router.post('/:id/request-reschedule', auth, [
  body('newTime').isISO8601().withMessage('Please provide a valid new time'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { newTime, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid session ID format' });
    }

    const session = await TrainingSession.findById(id);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Training session not found' });
    }

    if (req.user.role === 'member' && session.member.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only request reschedule for your own sessions' });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Can only request reschedule for scheduled sessions' });
    }

    res.json({ success: true, message: 'Reschedule request sent. Trainer/scheduling team will review.', data: { requestedTime: newTime, reason } });
  } catch (error) {
    console.error('Request reschedule error:', error);
    res.status(500).json({ success: false, message: 'Failed to request reschedule' });
  }
});

// Request cancel
router.post('/:id/request-cancel', auth, [
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid session ID format' });
    }

    const session = await TrainingSession.findById(id);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Training session not found' });
    }

    if (req.user.role === 'member' && session.member.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only request cancel for your own sessions' });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Can only request cancel for scheduled sessions' });
    }

    res.json({ success: true, message: 'Cancel request sent. Trainer/scheduling team will review.', data: { reason } });
  } catch (error) {
    console.error('Request cancel error:', error);
    res.status(500).json({ success: false, message: 'Failed to request cancel' });
  }
});

module.exports = router;
