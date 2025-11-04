const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Programme',
    required: false
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Gym'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled'],
    default: 'scheduled'
  },
  color: {
    type: String,
    default: '#3b82f6' // blue
  },
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: { 
      type: String, 
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'weekly'
    },
    interval: { type: Number, default: 1 }, // every X days/weeks/months
    daysOfWeek: [{ type: Number }], // 0-6 (Sunday-Saturday)
    endDate: { type: Date },
    occurrences: { type: Number } // or end after X occurrences
  },
  parentAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  isRecurringInstance: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true
  },
  reminderSent24h: {
    type: Boolean,
    default: false
  },
  reminderSent1h: {
    type: Boolean,
    default: false
  },
  linkedTrainingSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrainingSession'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
appointmentSchema.index({ staff: 1, startTime: 1 });
appointmentSchema.index({ client: 1, startTime: 1 });
appointmentSchema.index({ startTime: 1, endTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ location: 1 });

// Virtual for formatted duration
appointmentSchema.virtual('durationFormatted').get(function() {
  const hours = Math.floor(this.duration / 60);
  const mins = this.duration % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
});

// Method to check conflicts
appointmentSchema.methods.hasConflict = async function(staffId, start, end, excludeId = null) {
  const query = {
    staff: staffId,
    status: { $in: ['scheduled', 'rescheduled'] },
    $or: [
      { startTime: { $lt: end }, endTime: { $gt: start } }
    ]
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const conflicts = await this.constructor.find(query);
  return conflicts.length > 0;
};

module.exports = mongoose.model('Appointment', appointmentSchema);

