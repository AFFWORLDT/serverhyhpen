const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  budget: {
    total: {
      type: Number,
      default: 0
    },
    allocated: {
      type: Number,
      default: 0
    },
    spent: {
      type: Number,
      default: 0
    },
    remaining: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  totalStaff: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    trim: true
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

// Calculate remaining budget before save
DepartmentSchema.pre('save', function(next) {
  if (this.budget.total) {
    this.budget.remaining = this.budget.total - this.budget.spent;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Department', DepartmentSchema);

