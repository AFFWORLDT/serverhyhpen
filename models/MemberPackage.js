const mongoose = require('mongoose');

// This model tracks a member's active/purchased packages
const memberPackageSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  // Sessions info
  sessionsTotal: {
    type: Number,
    required: true,
    min: 0
  },
  sessionsUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  sessionsRemaining: {
    type: Number,
    required: true,
    min: 0
  },
  // Validity window
  validityStart: {
    type: Date,
    required: true,
    default: Date.now
  },
  validityEnd: {
    type: Date,
    required: true
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'expired', 'completed', 'cancelled', 'suspended'],
    default: 'active'
  },
  // Payment info
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'online', 'other'],
    default: 'cash'
  },
  paymentReference: {
    type: String,
    trim: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  // Assigned trainer for this package
  assignedTrainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Freeze/pause functionality
  freezeHistory: [{
    freezeStart: Date,
    freezeEnd: Date,
    reason: String,
    freezeDays: Number
  }],
  totalFrozenDays: {
    type: Number,
    default: 0
  },
  // Extensions
  extensionHistory: [{
    extendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    extendedDate: Date,
    additionalDays: Number,
    additionalSessions: Number,
    reason: String,
    amountPaid: Number
  }],
  // Notes
  notes: {
    type: String,
    trim: true
  },
  // Metadata
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin/Staff who processed the purchase
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationDate: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true
  }
}, { 
  timestamps: true 
});

// Indexes
memberPackageSchema.index({ member: 1, status: 1 });
memberPackageSchema.index({ package: 1 });
memberPackageSchema.index({ validityEnd: 1 });
memberPackageSchema.index({ status: 1 });

// Virtual to check if package is currently valid
memberPackageSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.validityStart && 
         now <= this.validityEnd &&
         this.sessionsRemaining > 0;
});

// Method to use a session
memberPackageSchema.methods.useSession = async function() {
  if (this.sessionsRemaining > 0) {
    this.sessionsUsed += 1;
    this.sessionsRemaining -= 1;
    
    // Auto-complete if all sessions used
    if (this.sessionsRemaining === 0) {
      this.status = 'completed';
    }
    
    await this.save();
    return true;
  }
  return false;
};

// Method to freeze package
memberPackageSchema.methods.freeze = async function(days, reason) {
  const freezeStart = new Date();
  const freezeEnd = new Date(freezeStart.getTime() + days * 24 * 60 * 60 * 1000);
  
  this.freezeHistory.push({
    freezeStart,
    freezeEnd,
    reason,
    freezeDays: days
  });
  
  this.totalFrozenDays += days;
  
  // Extend validity end date by frozen days
  this.validityEnd = new Date(this.validityEnd.getTime() + days * 24 * 60 * 60 * 1000);
  
  await this.save();
  return true;
};

// Method to extend package
memberPackageSchema.methods.extend = async function(additionalDays, additionalSessions, extendedBy, amountPaid, reason) {
  this.extensionHistory.push({
    extendedBy,
    extendedDate: new Date(),
    additionalDays: additionalDays || 0,
    additionalSessions: additionalSessions || 0,
    reason,
    amountPaid: amountPaid || 0
  });
  
  if (additionalDays > 0) {
    this.validityEnd = new Date(this.validityEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  }
  
  if (additionalSessions > 0) {
    this.sessionsTotal += additionalSessions;
    this.sessionsRemaining += additionalSessions;
  }
  
  // Reactivate if was completed
  if (this.status === 'completed' && this.sessionsRemaining > 0) {
    this.status = 'active';
  }
  
  await this.save();
  return true;
};

// Auto-update status based on expiry
memberPackageSchema.pre('save', function(next) {
  const now = new Date();
  
  // Check expiry
  if (this.status === 'active' && now > this.validityEnd) {
    this.status = 'expired';
  }
  
  // Check completion
  if (this.status === 'active' && this.sessionsRemaining === 0) {
    this.status = 'completed';
  }
  
  next();
});

module.exports = mongoose.model('MemberPackage', memberPackageSchema);

