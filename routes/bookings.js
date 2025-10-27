const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, adminAuth, adminOrTrainerOrStaffAuth } = require('../middleware/auth');
const User = require('../models/User');
const Class = require('../models/Class');

// Booking Schema (we'll add this to a separate model file)
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
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
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String
  }
}, {
  timestamps: true
});

// Add indexes for better performance
bookingSchema.index({ memberId: 1, bookingDate: 1 });
bookingSchema.index({ classId: 1, bookingDate: 1 });
bookingSchema.index({ status: 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// Get all bookings
router.get('/', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      classId, 
      memberId, 
      startDate, 
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (classId) query.classId = classId;
    if (memberId) query.memberId = memberId;
    
    if (startDate && endDate) {
      query.bookingDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(query)
      .populate('memberId', 'firstName lastName email phone')
      .populate('classId', 'name instructor startTime endTime capacity')
      .populate('createdBy', 'firstName lastName email')
      .populate('cancelledBy', 'firstName lastName email')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
});

// Get single booking
router.get('/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('memberId', 'firstName lastName email phone')
      .populate('classId', 'name instructor startTime endTime capacity description')
      .populate('createdBy', 'firstName lastName email')
      .populate('cancelledBy', 'firstName lastName email');

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
      message: 'Failed to fetch booking'
    });
  }
});

// Create new booking
router.post('/', auth, adminOrTrainerOrStaffAuth, [
  body('memberId').isMongoId().withMessage('Valid member ID is required'),
  body('classId').isMongoId().withMessage('Valid class ID is required'),
  body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
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
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Verify class exists
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if member already has a booking for this class on this date
    const existingBooking = await Booking.findOne({
      memberId,
      classId,
      bookingDate: new Date(bookingDate),
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Member already has a booking for this class on this date'
      });
    }

    // Check class capacity
    const currentBookings = await Booking.countDocuments({
      classId,
      bookingDate: new Date(bookingDate),
      status: { $in: ['pending', 'confirmed'] }
    });

    if (currentBookings >= classData.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Class is fully booked for this date'
      });
    }

    const booking = new Booking({
      memberId,
      classId,
      bookingDate: new Date(bookingDate),
      notes,
      createdBy: req.user.userId
    });

    await booking.save();

    // Populate the response
    await booking.populate('memberId', 'firstName lastName email phone');
    await booking.populate('classId', 'name instructor startTime endTime capacity');
    await booking.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking'
    });
  }
});

// Update booking status
router.put('/:id/status', auth, adminOrTrainerOrStaffAuth, [
  body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).withMessage('Invalid status'),
  body('cancellationReason').optional().isLength({ max: 200 }).withMessage('Cancellation reason must be less than 200 characters')
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

    const { status, cancellationReason } = req.body;
    const updateData = { status };

    if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = req.user.userId;
      if (cancellationReason) {
        updateData.cancellationReason = cancellationReason;
      }
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('memberId', 'firstName lastName email phone')
     .populate('classId', 'name instructor startTime endTime capacity')
     .populate('createdBy', 'firstName lastName email')
     .populate('cancelledBy', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status'
    });
  }
});

// Check-in member for booking
router.put('/:id/checkin', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }

    if (booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Member is already checked in'
      });
    }

    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    await booking.save();

    await booking.populate('memberId', 'firstName lastName email phone');
    await booking.populate('classId', 'name instructor startTime endTime capacity');

    res.json({
      success: true,
      message: 'Member checked in successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Check-in booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check-in member'
    });
  }
});

// Delete booking
router.delete('/:id', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking'
    });
  }
});

// Get booking statistics (alias for analytics)
router.get('/stats/overview', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const pending = await Booking.countDocuments({ status: 'pending' });
    const confirmed = await Booking.countDocuments({ status: 'confirmed' });
    const cancelled = await Booking.countDocuments({ status: 'cancelled' });
    const completed = await Booking.countDocuments({ status: 'completed' });

    res.json({
      success: true,
      data: {
        total: totalBookings,
        pending,
        confirmed,
        cancelled,
        completed
      }
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking statistics',
      error: error.message
    });
  }
});

// Get booking analytics
router.get('/analytics/overview', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery = {};

    if (startDate && endDate) {
      matchQuery.bookingDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const analytics = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          pendingBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          noShowBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
          },
          checkedInBookings: {
            $sum: { $cond: ['$checkedIn', 1, 0] }
          }
        }
      }
    ]);

    const classStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$classId',
          count: { $sum: 1 },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          checkedIn: {
            $sum: { $cond: ['$checkedIn', 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: '_id',
          as: 'classInfo'
        }
      },
      {
        $unwind: '$classInfo'
      },
      {
        $project: {
          className: '$classInfo.name',
          instructor: '$classInfo.instructor',
          count: 1,
          confirmed: 1,
          checkedIn: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const dailyStats = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$bookingDate' },
            month: { $month: '$bookingDate' },
            day: { $dayOfMonth: '$bookingDate' }
          },
          count: { $sum: 1 },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          checkedIn: {
            $sum: { $cond: ['$checkedIn', 1, 0] }
          }
        }
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          count: 1,
          confirmed: 1,
          checkedIn: 1
        }
      },
      { $sort: { date: 1 } },
      { $limit: 30 }
    ]);

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalBookings: 0,
          confirmedBookings: 0,
          pendingBookings: 0,
          cancelledBookings: 0,
          completedBookings: 0,
          noShowBookings: 0,
          checkedInBookings: 0
        },
        classStats,
        dailyStats
      }
    });
  } catch (error) {
    console.error('Get booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking analytics'
    });
  }
});

// Get member's bookings
router.get('/member/:memberId', auth, adminOrTrainerOrStaffAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { memberId: req.params.memberId };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('classId', 'name instructor startTime endTime capacity')
      .populate('createdBy', 'firstName lastName email')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get member bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member bookings'
    });
  }
});

module.exports = router;
