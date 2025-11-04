const mongoose = require('mongoose');

const staffAvailabilitySchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dayOfWeek: {
    type: Number, // 0 = Sunday, 6 = Saturday
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String, // Format: "HH:mm" e.g., "09:00"
    required: true
  },
  endTime: {
    type: String, // Format: "HH:mm" e.g., "17:00"
    required: true
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Gym'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
staffAvailabilitySchema.index({ staff: 1, dayOfWeek: 1 });
staffAvailabilitySchema.index({ location: 1 });

module.exports = mongoose.model('StaffAvailability', staffAvailabilitySchema);

