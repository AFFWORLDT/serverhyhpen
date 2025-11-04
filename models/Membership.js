const mongoose = require('mongoose');

// Membership Plan Schema
const membershipPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in months
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'AED'
  },
  features: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  maxMembers: {
    type: Number,
    default: null // null means unlimited
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

// Membership Schema
const membershipSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'suspended'],
    default: 'active'
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'online'],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    required: true
  },
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

// Calculate end date based on plan duration
membershipSchema.pre('save', function(next) {
  if (this.isNew) {
    const plan = this.plan;
    const startDate = new Date(this.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.duration);
    this.endDate = endDate;
    this.remainingAmount = this.totalAmount - this.paidAmount;
  }
  next();
});

// Update timestamp
membershipSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);
const Membership = mongoose.model('Membership', membershipSchema);

module.exports = { MembershipPlan, Membership };

