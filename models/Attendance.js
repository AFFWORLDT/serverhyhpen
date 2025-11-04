const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarEvent',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused', 'pending'],
    default: 'pending'
  },
  checkInTime: {
    type: Date
  },
  checkOutTime: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  isManual: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    trim: true
  },
  deviceInfo: {
    userAgent: String,
    ipAddress: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
attendanceSchema.index({ event: 1, user: 1 }, { unique: true });
attendanceSchema.index({ user: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ checkInTime: 1 });
attendanceSchema.index({ markedAt: 1 });

// Virtual for duration if both check-in and check-out times exist
attendanceSchema.virtual('duration').get(function() {
  if (this.checkInTime && this.checkOutTime) {
    return this.checkOutTime - this.checkInTime;
  }
  return null;
});

// Method to check if user is currently checked in
attendanceSchema.methods.isCheckedIn = function() {
  return this.checkInTime && !this.checkOutTime;
};

// Method to check if attendance is late
attendanceSchema.methods.isLate = function() {
  if (!this.checkInTime || !this.event) return false;
  
  // Get event start time from populated event or reference
  const eventStartTime = this.event.startTime || this.event;
  return this.checkInTime > eventStartTime;
};

// Pre-save middleware to set status based on check-in time
attendanceSchema.pre('save', function(next) {
  if (this.checkInTime && this.event) {
    // This will be handled in the route where we have access to the event
    if (this.status === 'pending') {
      this.status = 'present';
    }
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
