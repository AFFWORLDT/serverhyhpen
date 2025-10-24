const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { Class } = require('../models/Class');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Booking Schema
const bookingSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  bookingDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['booked', 'cancelled', 'completed', 'no_show'],
    default: 'booked'
  },
  notes: String,
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Booking = mongoose.model('Booking', bookingSchema);

// Create booking
router.post('/', auth, [
  body('memberId').isMongoId().withMessage('Valid member ID required'),
  body('classId').isMongoId().withMessage('Valid class ID required'),
  body('bookingDate').isISO8601().withMessage('Valid booking date required')
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

    const { memberId, classId, bookingDate, notes } = req.body;

    // Verify member exists
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member' || !member.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or inactive'
      });
    }

    // Verify class exists and is active
    const classItem = await Class.findById(classId);
    if (!classItem || classItem.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Class not found or inactive'
      });
    }

    // Check if member already booked this class
    const existingBooking = await Booking.findOne({
      member: memberId,
      class: classId,
      bookingDate: new Date(bookingDate),
      status: { $in: ['booked', 'completed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Member already booked this class'
      });
    }

    // Check class capacity
    const currentBookings = await Booking.countDocuments({
      class: classId,
      bookingDate: new Date(bookingDate),
      status: { $in: ['booked', 'completed'] }
    });

    if (currentBookings >= classItem.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Class is fully booked'
      });
    }

    // Create booking
    const booking = new Booking({
      member: memberId,
      class: classId,
      bookingDate: new Date(bookingDate),
      notes: notes || '',
      bookedBy: req.user.userId
    });

    await booking.save();

    // Populate details
    await booking.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'class', select: 'name type schedule maxCapacity' },
      { path: 'bookedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating booking'
    });
  }
});

// Get all bookings
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const classId = req.query.classId;
    const memberId = req.query.memberId;

    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (classId) {
      query.class = classId;
    }
    
    if (memberId) {
      query.member = memberId;
    }

    const bookings = await Booking.find(query)
      .populate('member', 'firstName lastName email phone')
      .populate('class', 'name type schedule maxCapacity')
      .populate('bookedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings'
    });
  }
});

// Get booking by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('member', 'firstName lastName email phone')
      .populate('class', 'name type schedule maxCapacity')
      .populate('bookedBy', 'firstName lastName');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking'
    });
  }
});

// Update booking status
router.put('/:id/status', auth, [
  body('status').isIn(['booked', 'cancelled', 'completed', 'no_show']).withMessage('Invalid status')
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

    const { status, notes } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    booking.status = status;
    if (notes) {
      booking.notes = booking.notes + (booking.notes ? ` | ${notes}` : notes);
    }
    booking.updatedAt = new Date();

    await booking.save();

    await booking.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'class', select: 'name type schedule maxCapacity' },
      { path: 'bookedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating booking status'
    });
  }
});

// Cancel booking
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking already cancelled'
      });
    }

    booking.status = 'cancelled';
    if (reason) {
      booking.notes = booking.notes + (booking.notes ? ` | Cancelled: ${reason}` : `Cancelled: ${reason}`);
    }
    booking.updatedAt = new Date();

    await booking.save();

    await booking.populate([
      { path: 'member', select: 'firstName lastName email phone' },
      { path: 'class', select: 'name type schedule maxCapacity' },
      { path: 'bookedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling booking'
    });
  }
});

// Get member's bookings
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const bookings = await Booking.find({ member: memberId })
      .populate('member', 'firstName lastName email phone')
      .populate('class', 'name type schedule maxCapacity')
      .populate('bookedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments({ member: memberId });

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get member bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching member bookings'
    });
  }
});

// Get class bookings
router.get('/class/:classId', auth, async (req, res) => {
  try {
    const { classId } = req.params;
    const bookingDate = req.query.bookingDate;

    let query = { class: classId };
    
    if (bookingDate) {
      const date = new Date(bookingDate);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      query.bookingDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const bookings = await Booking.find(query)
      .populate('member', 'firstName lastName email phone')
      .populate('class', 'name type schedule maxCapacity')
      .populate('bookedBy', 'firstName lastName')
      .sort({ bookingDate: 1 });

    res.json({
      success: true,
      data: { bookings }
    });

  } catch (error) {
    console.error('Get class bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching class bookings'
    });
  }
});

// Get booking stats
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({ status: 'booked' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

    // Today's bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.countDocuments({
      bookingDate: { $gte: today, $lt: tomorrow },
      status: 'booked'
    });

    res.json({
      success: true,
      data: {
        total: totalBookings,
        active: activeBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        today: todayBookings
      }
    });

  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking stats'
    });
  }
});

module.exports = router;


