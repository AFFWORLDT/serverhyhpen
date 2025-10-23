const mongoose = require('mongoose');

// Gym Session Schema
const gymSessionSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  checkInTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkOutTime: Date,
  duration: Number, // in minutes
  equipment: [{
    name: String,
    duration: Number
  }],
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate duration when checkout
gymSessionSchema.pre('save', function(next) {
  if (this.checkOutTime && this.checkInTime) {
    this.duration = Math.round((this.checkOutTime - this.checkInTime) / (1000 * 60));
  }
  next();
});

// Equipment Schema
const equipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['cardio', 'strength', 'functional', 'accessories']
  },
  brand: String,
  model: String,
  serialNumber: String,
  purchaseDate: Date,
  warrantyExpiry: Date,
  status: {
    type: String,
    enum: ['active', 'maintenance', 'out_of_order'],
    default: 'active'
  },
  location: String,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp
equipmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const GymSession = mongoose.model('GymSession', gymSessionSchema);
const Equipment = mongoose.model('Equipment', equipmentSchema);

module.exports = { GymSession, Equipment };

