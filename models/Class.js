const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  maxCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number,
    required: true,
    min: 15 // minutes
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    }
  }],
  equipment: [{
    type: String,
    trim: true
  }],
  requirements: {
    type: String,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  location: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Database indexes for performance optimization
classSchema.index({ trainer: 1, status: 1 });
classSchema.index({ status: 1, createdAt: -1 });
classSchema.index({ name: 1 }, { unique: true });
classSchema.index({ type: 1 });
classSchema.index({ difficulty: 1 });
classSchema.index({ members: 1 });
classSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Class', classSchema);














