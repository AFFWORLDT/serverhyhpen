const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sessions: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerSession: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  validityMonths: {
    type: Number,
    required: true,
    min: 0,
    default: 0 // 0 means no expiry for single session packages
  },
  // Optional image/photo for the package
  photo: {
    type: String,
    trim: true
  },
  // Package status
  isActive: {
    type: Boolean,
    default: true
  },
  // Metadata
  category: {
    type: String,
    enum: ['starter', 'basic', 'premium', 'platinum', 'custom'],
    default: 'basic'
  },
  // Features included in this package
  features: [{
    type: String,
    trim: true
  }],
  // Programs included (links to Programme model)
  includedPrograms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Programme'
  }],
  // Discount or special offer
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // Display order
  displayOrder: {
    type: Number,
    default: 0
  },
  // Notes for internal use
  notes: {
    type: String,
    trim: true
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

// Index for faster queries
packageSchema.index({ isActive: 1, displayOrder: 1 });
packageSchema.index({ sessions: 1 });
packageSchema.index({ totalPrice: 1 });

// Virtual to calculate savings if discount applied
packageSchema.virtual('savings').get(function() {
  if (this.discountPercentage > 0) {
    const originalPrice = this.totalPrice / (1 - this.discountPercentage / 100);
    return originalPrice - this.totalPrice;
  }
  return 0;
});

module.exports = mongoose.model('Package', packageSchema);

