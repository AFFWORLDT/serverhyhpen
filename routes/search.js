const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Class = require('../models/Class');
const Programme = require('../models/Programme');
const TrainingSession = require('../models/TrainingSession');
const { Membership } = require('../models/Membership');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /search/global:
 *   get:
 *     summary: Global search across all entities
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 2 characters)
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/global', auth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, 'i');

    // Search across multiple collections in parallel
    const [
      members,
      trainers,
      staff,
      payments,
      appointments,
      classes,
      programmes,
      trainingSessions,
      memberships
    ] = await Promise.all([
      // Search Members
      User.find({
        role: 'member',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { 'address.street': searchRegex },
          { 'address.city': searchRegex }
        ]
      })
        .select('firstName lastName email phone role isActive profileImage')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean(), // Use .lean() for better performance

      // Search Trainers
      User.find({
        role: 'trainer',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { specialization: searchRegex }
        ]
      })
        .select('firstName lastName email phone role specialization isActive profileImage')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean(), // Use .lean() for better performance

      // Search Payments
      Payment.find({
        $or: [
          { receiptNumber: searchRegex },
          { paymentMethod: searchRegex },
          { description: searchRegex }
        ]
      })
        .populate('member', 'firstName lastName email profileImage')
        .select('receiptNumber amount paymentMethod status member createdAt')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean(), // Use .lean() for better performance

      // Search Appointments
      Appointment.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { location: searchRegex },
          { notes: searchRegex }
        ]
      })
        .populate('client', 'firstName lastName email profileImage')
        .populate('staff', 'firstName lastName email profileImage')
        .select('title description startTime endTime location status client staff')
        .limit(10)
        .sort({ startTime: -1 })
        .lean(), // Use .lean() for better performance

      // Search Classes
      Class.find({
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { type: searchRegex },
          { instructor: searchRegex }
        ]
      })
        .populate('trainer', 'firstName lastName profileImage')
        .select('name type description instructor trainer price status')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean(), // Use .lean() for better performance

      // Search Staff
      User.find({
        role: 'staff',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      })
        .select('firstName lastName email phone role isActive profileImage')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean(), // Use .lean() for better performance

      // Search Programmes
      Programme.find({
        $or: [
          { name: searchRegex },
          { description: searchRegex }
        ]
      })
        .select('name description duration_in_weeks sessionCount difficulty')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean(), // Use .lean() for better performance

      // Search Training Sessions
      TrainingSession.find({
        $or: [
          { remarks: searchRegex },
          { status: searchRegex }
        ]
      })
        .populate('member', 'firstName lastName email profileImage')
        .populate('trainer', 'firstName lastName email profileImage')
        .populate('programme', 'name')
        .select('session_start_time session_end_time status remarks member trainer programme')
        .limit(10)
        .sort({ session_start_time: -1 })
        .lean(), // Use .lean() for better performance

      // Search Memberships
      Membership.find({
        $or: [
          { status: searchRegex }
        ]
      })
        .populate('member', 'firstName lastName email profileImage')
        .populate('plan', 'name price duration')
        .select('member plan startDate endDate status price createdAt')
        .limit(10)
        .sort({ createdAt: -1 })
        .lean() // Use .lean() for better performance
    ]);

    // Format results
    const results = {
      members: members.map(member => ({
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        role: member.role,
        isActive: member.isActive,
        profileImage: member.profileImage
      })),
      trainers: trainers.map(trainer => ({
        _id: trainer._id,
        firstName: trainer.firstName,
        lastName: trainer.lastName,
        email: trainer.email,
        phone: trainer.phone,
        role: trainer.role,
        specialization: trainer.specialization,
        isActive: trainer.isActive,
        profileImage: trainer.profileImage
      })),
      staff: staff.map(staffMember => ({
        _id: staffMember._id,
        firstName: staffMember.firstName,
        lastName: staffMember.lastName,
        email: staffMember.email,
        phone: staffMember.phone,
        role: staffMember.role,
        isActive: staffMember.isActive,
        profileImage: staffMember.profileImage
      })),
      payments: payments.map(payment => ({
        _id: payment._id,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        member: payment.member ? {
          _id: payment.member._id,
          firstName: payment.member.firstName,
          lastName: payment.member.lastName,
          email: payment.member.email,
          profileImage: payment.member.profileImage
        } : null,
        createdAt: payment.createdAt
      })),
      appointments: appointments.map(appointment => ({
        _id: appointment._id,
        title: appointment.title,
        description: appointment.description,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        location: appointment.location,
        status: appointment.status,
        client: appointment.client ? {
          _id: appointment.client._id,
          firstName: appointment.client.firstName,
          lastName: appointment.client.lastName,
          email: appointment.client.email,
          profileImage: appointment.client.profileImage
        } : null,
        staff: appointment.staff ? {
          _id: appointment.staff._id,
          firstName: appointment.staff.firstName,
          lastName: appointment.staff.lastName,
          email: appointment.staff.email,
          profileImage: appointment.staff.profileImage
        } : null
      })),
      classes: classes.map(classItem => ({
        _id: classItem._id,
        name: classItem.name,
        type: classItem.type,
        description: classItem.description,
        instructor: classItem.instructor,
        trainer: classItem.trainer ? {
          _id: classItem.trainer._id,
          firstName: classItem.trainer.firstName,
          lastName: classItem.trainer.lastName,
          profileImage: classItem.trainer.profileImage
        } : null,
        price: classItem.price,
        status: classItem.status
      })),
      programmes: programmes.map(programme => ({
        _id: programme._id,
        name: programme.name,
        description: programme.description,
        duration_in_weeks: programme.duration_in_weeks,
        sessionCount: programme.sessionCount,
        difficulty: programme.difficulty
      })),
      trainingSessions: trainingSessions.map(session => ({
        _id: session._id,
        session_start_time: session.session_start_time,
        session_end_time: session.session_end_time,
        status: session.status,
        remarks: session.remarks,
        member: session.member ? {
          _id: session.member._id,
          firstName: session.member.firstName,
          lastName: session.member.lastName,
          email: session.member.email,
          profileImage: session.member.profileImage
        } : null,
        trainer: session.trainer ? {
          _id: session.trainer._id,
          firstName: session.trainer.firstName,
          lastName: session.trainer.lastName,
          email: session.trainer.email,
          profileImage: session.trainer.profileImage
        } : null,
        programme: session.programme ? {
          _id: session.programme._id,
          name: session.programme.name
        } : null
      })),
      memberships: memberships.map(membership => ({
        _id: membership._id,
        startDate: membership.startDate,
        endDate: membership.endDate,
        status: membership.status,
        price: membership.price,
        member: membership.member ? {
          _id: membership.member._id,
          firstName: membership.member.firstName,
          lastName: membership.member.lastName,
          email: membership.member.email,
          profileImage: membership.member.profileImage
        } : null,
        plan: membership.plan ? {
          _id: membership.plan._id,
          name: membership.plan.name,
          price: membership.plan.price,
          duration: membership.plan.duration
        } : null,
        createdAt: membership.createdAt
      }))
    };

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform search',
      error: error.message
    });
  }
});

module.exports = router;


