const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  assigned_programme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Programme',
    default: null
  },
  start_date: {
    type: Date,
    default: null
  },
  end_date: {
    type: Date,
    default: null
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  goals: [{
    type: String
  }],
  fitness_level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  medical_conditions: [{
    type: String
  }],
  allergies: [{
    type: String
  }],
  emergency_contact: {
    name: String,
    phone: String,
    relationship: String
  },
  current_weight: {
    type: Number,
    default: null
  },
  target_weight: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  },
  age: {
    type: Number,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better performance
clientSchema.index({ trainer: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ assigned_programme: 1 });
clientSchema.index({ name: 'text' });

// Pre-save middleware to calculate end_date when programme is assigned
clientSchema.pre('save', function(next) {
  if (this.assigned_programme && this.start_date && !this.end_date) {
    const startDate = new Date(this.start_date);
    const programme = this.constructor.model('Programme').findById(this.assigned_programme);
    programme.then(prog => {
      if (prog) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (prog.duration_in_weeks * 7));
        this.end_date = endDate;
      }
      next();
    }).catch(next);
  } else {
    next();
  }
});

module.exports = mongoose.model('Client', clientSchema);

