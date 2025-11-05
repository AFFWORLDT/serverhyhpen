const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Programme = require('../models/Programme');
const TrainingSession = require('../models/TrainingSession');
const { auth, adminAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const Email = require('../utils/email');

const router = express.Router();

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: Get appointments with filters
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff
 *         schema:
 *           type: string
 *         description: Filter by staff/trainer ID
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *         description: Filter by client/member ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled, no-show]
 *         description: Filter by status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: List of appointments
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
 *                     appointments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Appointment'
 */
// Get appointments with filters
router.get('/', auth, async (req, res) => {
  try {
    const { 
      staff, 
      client, 
      location, 
      status, 
      startDate, 
      endDate,
      view = 'week' 
    } = req.query;

    const filter = {};

    // Role-based filtering
    if (req.user.role === 'trainer' || req.user.role === 'staff') {
      filter.staff = req.user.userId;
    } else if (req.user.role === 'member') {
      filter.client = req.user.userId;
    }

    // Override filters for admin
    if (req.user.role === 'admin') {
      if (staff) filter.staff = staff;
      if (client) filter.client = client;
    }

    if (location) filter.location = location;
    if (status) filter.status = status;

    // Date range filter
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(filter)
      .populate('client', 'firstName lastName email phone')
      .populate('staff', 'firstName lastName email staffTeam staffColor')
      .populate('program', 'name description')
      .sort({ startTime: 1 });

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
});

// Get single appointment
router.get('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('client', 'firstName lastName email phone')
      .populate('staff', 'firstName lastName email staffTeam')
      .populate('program', 'name description');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Check permissions
    if (req.user.role === 'member' && appointment.client._id.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if ((req.user.role === 'trainer' || req.user.role === 'staff') && appointment.staff._id.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointment' });
  }
});

// Create appointment (Members can create for themselves, admin/staff/trainer can create for any)
router.post('/', auth, [
  body('client').optional().isMongoId().withMessage('Valid client ID required'),
  body('staff').isMongoId().withMessage('Valid staff ID required'),
  body('startTime').isISO8601().withMessage('Valid start time required'),
  body('duration').isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Determine client: members create for themselves, admin/staff can specify
    let finalClient = req.body.client;
    if (req.user.role === 'member') {
      finalClient = req.user.userId;
    } else if (!req.body.client) {
      return res.status(400).json({ success: false, message: 'Client ID is required' });
    }

    const { staff, program, location, startTime, duration, title, description, recurring, notes, color } = req.body;

    // Calculate end time
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    // Check for conflicts
    const tempAppointment = new Appointment();
    const hasConflict = await tempAppointment.hasConflict(staff, start, end);
    if (hasConflict) {
      return res.status(400).json({ success: false, message: 'Staff has conflicting appointment at this time' });
    }

    const appointment = new Appointment({
      client: finalClient,
      staff,
      program,
      location: location || 'Main Gym',
      startTime: start,
      endTime: end,
      duration,
      title,
      description,
      recurring: recurring || { enabled: false },
      notes,
      color,
      createdBy: req.user.userId
    });

    await appointment.save();

    // If recurring, create instances
    if (recurring && recurring.enabled) {
      await createRecurringInstances(appointment);
    }

    await appointment.populate([
      { path: 'client', select: 'firstName lastName email' },
      { path: 'staff', select: 'firstName lastName email staffTeam' },
      { path: 'program', select: 'name' }
    ]);

    // Send appointment booked email
    try {
      if (appointment.client && appointment.staff) {
        const html = Email.templates.appointmentBookedTemplate({
          firstName: appointment.client.firstName,
          trainerName: `${appointment.staff.firstName} ${appointment.staff.lastName}`,
          appointmentDate: appointment.startTime.toLocaleDateString('en-US', { timeZone: 'Asia/Dubai' }),
          appointmentTime: appointment.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }),
          duration: appointment.duration,
          location: appointment.location,
          notes: appointment.notes
        });
        await Email.sendEmail({
          to: appointment.client.email,
          subject: 'Appointment Booked - Hyphen Wellness',
          html
        });
      }
    } catch (e) {
      console.error('Appointment booked email error:', e.message);
    }

    res.status(201).json({ success: true, data: { appointment } });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const { startTime, duration, status, notes, description } = req.body;

    // If rescheduling, check conflicts
    if (startTime || duration) {
      const newStart = startTime ? new Date(startTime) : appointment.startTime;
      const newDuration = duration || appointment.duration;
      const newEnd = new Date(newStart.getTime() + newDuration * 60000);

      const hasConflict = await appointment.hasConflict(appointment.staff, newStart, newEnd, appointment._id);
      if (hasConflict) {
        return res.status(400).json({ success: false, message: 'Conflict detected with existing appointment' });
      }

      appointment.startTime = newStart;
      appointment.endTime = newEnd;
      appointment.duration = newDuration;
      if (status !== 'rescheduled') appointment.status = 'rescheduled';
    }

    if (status) appointment.status = status;
    if (notes !== undefined) appointment.notes = notes;
    if (description !== undefined) appointment.description = description;
    appointment.updatedBy = req.user.userId;

    const oldStartTime = appointment.startTime;
    const oldDuration = appointment.duration;
    
    await appointment.save();
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email' },
      { path: 'staff', select: 'firstName lastName email staffTeam' },
      { path: 'program', select: 'name' }
    ]);

    // Send appointment rescheduled email if time changed
    if ((startTime || duration) && appointment.client && appointment.staff) {
      try {
        const html = Email.templates.appointmentRescheduledTemplate({
          firstName: appointment.client.firstName,
          trainerName: `${appointment.staff.firstName} ${appointment.staff.lastName}`,
          oldDate: oldStartTime.toLocaleDateString('en-US', { timeZone: 'Asia/Dubai' }),
          oldTime: oldStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }),
          newDate: appointment.startTime.toLocaleDateString('en-US', { timeZone: 'Asia/Dubai' }),
          newTime: appointment.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }),
          location: appointment.location,
          reason: req.body.reason
        });
        await Email.sendEmail({
          to: appointment.client.email,
          subject: 'Appointment Rescheduled - Hyphen Wellness',
          html
        });
      } catch (e) {
        console.error('Appointment rescheduled email error:', e.message);
      }
    }

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // If deleting recurring parent, optionally delete all instances
    const { deleteAll } = req.query;
    if (deleteAll === 'true' && !appointment.isRecurringInstance) {
      await Appointment.deleteMany({ parentAppointment: appointment._id });
    }

    await appointment.deleteOne();
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete appointment' });
  }
});

// Complete appointment
router.post('/:id/complete', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    appointment.status = 'completed';
    await appointment.save();

    // Create/update linked training session and increment member sessions
    if (!appointment.linkedTrainingSession) {
      const trainingSession = new TrainingSession({
        member: appointment.client,
        trainer: appointment.staff,
        programme: appointment.program,
        session_start_time: appointment.startTime,
        session_end_time: appointment.endTime,
        status: 'completed',
        submission_timestamp: new Date()
      });
      await trainingSession.save();
      appointment.linkedTrainingSession = trainingSession._id;
      await appointment.save();

      // Increment member sessionsUsed from active package
      try {
        const MemberPackage = require('../models/MemberPackage');
        
        // Find active package for member
        const activeMemberPackage = await MemberPackage.findOne({
          member: appointment.client,
          status: 'active'
        });
        
        if (activeMemberPackage) {
          // Use the useSession method which handles auto-completion
          await activeMemberPackage.useSession();
          console.log(`✅ Session used for member ${appointment.client}. Remaining: ${activeMemberPackage.sessionsRemaining}`);
        } else {
          // Fallback to old User model method if no package found
          const member = await User.findById(appointment.client);
          if (member && member.membershipValidityStart && member.membershipValidityEnd) {
            const now = new Date();
            const withinValidity = now >= new Date(member.membershipValidityStart) && now <= new Date(member.membershipValidityEnd);
            if (withinValidity) {
              member.sessionsUsed = (member.sessionsUsed || 0) + 1;
              await member.save();
              console.log(`✅ Session used (legacy method) for member ${appointment.client}`);
            }
          }
        }
      } catch (err) {
        console.error('Member session increment error:', err.message);
      }
    }

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete appointment' });
  }
});

// Cancel appointment
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isStaff = req.user.role === 'staff';
    const isAssignedTrainer = appointment.staff && appointment.staff.toString() === req.user.userId;
    const isClient = appointment.client && appointment.client.toString() === req.user.userId;

    if (!isAdmin && !isStaff && !isAssignedTrainer && !isClient) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this appointment' });
    }

    // Check 24-hour policy for members
    if (req.user.role === 'member' || isClient) {
      const appointmentTime = new Date(appointment.startTime);
      const now = new Date();
      const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
      
      if (hoursUntilAppointment < 24) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot cancel appointments within 24 hours. Please contact admin.' 
        });
      }
      
      if (!reason || !reason.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Reason is required for cancellation' 
        });
      }
    }

    // Update appointment status
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = req.user.userId;
    appointment.cancellationReason = reason || 'Cancelled by user';
    await appointment.save();
    
    await appointment.populate([
      { path: 'client', select: 'firstName lastName email' },
      { path: 'staff', select: 'firstName lastName email staffTeam' }
    ]);

    // Send appointment cancelled email
    if (appointment.client && appointment.staff) {
      try {
        const html = Email.templates.appointmentCancelledTemplate({
          firstName: appointment.client.firstName,
          trainerName: `${appointment.staff.firstName} ${appointment.staff.lastName}`,
          appointmentDate: appointment.startTime.toLocaleDateString('en-US', { timeZone: 'Asia/Dubai' }),
          appointmentTime: appointment.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }),
          reason: appointment.cancellationReason,
          rescheduleUrl: 'http://localhost:3000/calendar'
        });
        await Email.sendEmail({
          to: appointment.client.email,
          subject: 'Appointment Cancelled - Hyphen Wellness',
          html
        });
      } catch (e) {
        console.error('Appointment cancelled email error:', e.message);
      }
    }

    res.json({ 
      success: true, 
      message: 'Appointment cancelled successfully',
      data: { appointment } 
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel appointment' });
  }
});

// Bulk operations
router.post('/bulk/copy-week', auth, adminAuth, async (req, res) => {
  try {
    const { sourceWeekStart, targetWeekStart, staffIds } = req.body;

    const sourceStart = new Date(sourceWeekStart);
    const sourceEnd = new Date(sourceStart);
    sourceEnd.setDate(sourceEnd.getDate() + 7);

    const filter = {
      startTime: { $gte: sourceStart, $lt: sourceEnd }
    };
    if (staffIds && staffIds.length) {
      filter.staff = { $in: staffIds };
    }

    const appointments = await Appointment.find(filter);
    const targetStart = new Date(targetWeekStart);
    const daysDiff = Math.floor((targetStart - sourceStart) / (1000 * 60 * 60 * 24));

    const newAppointments = appointments.map(apt => {
      const newStart = new Date(apt.startTime);
      newStart.setDate(newStart.getDate() + daysDiff);
      const newEnd = new Date(apt.endTime);
      newEnd.setDate(newEnd.getDate() + daysDiff);

      return {
        ...apt.toObject(),
        _id: undefined,
        startTime: newStart,
        endTime: newEnd,
        createdBy: req.user.userId,
        createdAt: undefined,
        updatedAt: undefined
      };
    });

    await Appointment.insertMany(newAppointments);
    res.json({ success: true, message: `Copied ${newAppointments.length} appointments`, data: { count: newAppointments.length } });
  } catch (error) {
    console.error('Bulk copy error:', error);
    res.status(500).json({ success: false, message: 'Failed to copy week' });
  }
});

// Analytics endpoint
router.get('/analytics/overview', auth, async (req, res) => {
  try {
    const { startDate, endDate, staff } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }
    if (staff) filter.staff = staff;

    const totalAppointments = await Appointment.countDocuments(filter);
    const completedAppointments = await Appointment.countDocuments({ ...filter, status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ ...filter, status: 'cancelled' });
    const scheduledAppointments = await Appointment.countDocuments({ ...filter, status: 'scheduled' });

    // Popular time slots
    const timeSlots = await Appointment.aggregate([
      { $match: filter },
      { $addFields: { hour: { $hour: '$startTime' } } },
      { $group: { _id: '$hour', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Staff performance
    const staffPerformance = await Appointment.aggregate([
      { $match: { ...filter, status: 'completed' } },
      { $group: { _id: '$staff', completed: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staffInfo' } },
      { $unwind: '$staffInfo' },
      { $project: { name: { $concat: ['$staffInfo.firstName', ' ', '$staffInfo.lastName'] }, completed: 1 } },
      { $sort: { completed: -1 } }
    ]);

    // Utilization rate (appointments per day)
    const utilizationRate = totalAppointments > 0 && startDate && endDate
      ? (totalAppointments / Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        scheduledAppointments,
        completionRate: totalAppointments > 0 ? ((completedAppointments / totalAppointments) * 100).toFixed(1) : 0,
        cancellationRate: totalAppointments > 0 ? ((cancelledAppointments / totalAppointments) * 100).toFixed(1) : 0,
        utilizationRate,
        popularTimeSlots: timeSlots,
        staffPerformance
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

// Helper function to create recurring instances
async function createRecurringInstances(parentAppointment) {
  const { recurring, startTime, duration, client, staff, program, location, title, description, color } = parentAppointment;
  
  if (!recurring.enabled) return;

  const instances = [];
  let currentDate = new Date(startTime);
  currentDate.setDate(currentDate.getDate() + (recurring.interval || 1) * (recurring.frequency === 'weekly' ? 7 : recurring.frequency === 'monthly' ? 30 : 1));

  const maxOccurrences = recurring.occurrences || 52; // Default 1 year for weekly
  const endDate = recurring.endDate ? new Date(recurring.endDate) : new Date(startTime.getTime() + 365 * 24 * 60 * 60 * 1000);

  let count = 0;
  while (count < maxOccurrences && currentDate <= endDate) {
    const instanceStart = new Date(currentDate);
    const instanceEnd = new Date(instanceStart.getTime() + duration * 60000);

    instances.push({
      client,
      staff,
      program,
      location,
      startTime: instanceStart,
      endTime: instanceEnd,
      duration,
      title,
      description,
      color,
      parentAppointment: parentAppointment._id,
      isRecurringInstance: true,
      recurring: { enabled: false }
    });

    currentDate.setDate(currentDate.getDate() + (recurring.interval || 1) * (recurring.frequency === 'weekly' ? 7 : recurring.frequency === 'monthly' ? 30 : 1));
    count++;
  }

  if (instances.length > 0) {
    await Appointment.insertMany(instances);
  }
}

module.exports = router;

