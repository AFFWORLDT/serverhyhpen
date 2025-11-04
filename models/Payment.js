const mongoose = require('mongoose');

// Payment Schema
const paymentSchema = new mongoose.Schema({
  membership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membership',
    required: false
  },
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'AED'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'online', 'stripe'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripePaymentIntentId: String,
  stripeChargeId: String,
  paymentDate: {
    type: Date,
    default: Date.now
  },
  description: String,
  receiptNumber: {
    type: String,
    required: false
  },
  notes: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Generate receipt number
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.receiptNumber) {
    const count = await this.constructor.countDocuments();
    this.receiptNumber = `RCP-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Update timestamp
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Database indexes for performance optimization
paymentSchema.index({ member: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });
paymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ membership: 1 });
paymentSchema.index({ processedBy: 1 });
paymentSchema.index({ paymentMethod: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

