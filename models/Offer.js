const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 200
  },
  type: {
    type: String,
    required: true,
    enum: ['discount', 'free-trial', 'package', 'membership', 'service', 'product', 'event'],
    default: 'discount'
  },
  category: {
    type: String,
    required: true,
    enum: ['membership', 'personal-training', 'group-classes', 'nutrition', 'spa', 'retail', 'events', 'general'],
    default: 'general'
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'buy-one-get-one', 'free-shipping', 'free-service'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: function() {
      return ['percentage', 'fixed'].includes(this.discountType);
    },
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  discountedPrice: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'AED',
    maxlength: 3
  },
  image: {
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    }
  },
  gallery: [{
    url: String,
    alt: String,
    caption: String
  }],
  terms: {
    type: String,
    required: true
  },
  conditions: [{
    type: String,
    trim: true
  }],
  targetAudience: {
    type: String,
    enum: ['all', 'new-members', 'existing-members', 'premium-members', 'non-members', 'trainers', 'staff'],
    default: 'all'
  },
  eligibility: {
    minAge: {
      type: Number,
      min: 0
    },
    maxAge: {
      type: Number,
      min: 0
    },
    gender: {
      type: String,
      enum: ['all', 'male', 'female']
    },
    membershipType: [{
      type: String
    }],
    requiredServices: [{
      type: String
    }]
  },
  validity: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    usageLimit: {
      type: Number,
      min: 1
    },
    perUserLimit: {
      type: Number,
      min: 1,
      default: 1
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'expired', 'cancelled'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  code: {
    type: String,
    sparse: true,
    uppercase: true,
    trim: true
  },
  usage: {
    totalUses: {
      type: Number,
      default: 0
    },
    uniqueUsers: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    }
  },
  socialSharing: {
    enabled: {
      type: Boolean,
      default: true
    },
    platforms: [{
      type: String,
      enum: ['facebook', 'twitter', 'instagram', 'whatsapp', 'linkedin']
    }]
  },
  notifications: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      template: String
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      template: String
    },
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      template: String
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
offerSchema.index({ type: 1, status: 1 });
offerSchema.index({ category: 1, isActive: 1 });
offerSchema.index({ 'validity.startDate': 1, 'validity.endDate': 1 });
offerSchema.index({ featured: 1, priority: -1 });
offerSchema.index({ targetAudience: 1 });

// Pre-save middleware to generate code if not provided
offerSchema.pre('save', function(next) {
  if (this.isNew && !this.code && this.type === 'discount') {
    const prefix = this.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.code = `${prefix}${random}`;
  }
  next();
});

// Method to check if offer is valid
offerSchema.methods.isValid = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.isActive && 
         this.validity.startDate <= now && 
         this.validity.endDate >= now &&
         this.usage.totalUses < (this.validity.usageLimit || Infinity);
};

// Method to check if user is eligible
offerSchema.methods.isUserEligible = function(user) {
  if (!this.isValid()) return false;

  // Check age
  if (this.eligibility.minAge && user.age < this.eligibility.minAge) return false;
  if (this.eligibility.maxAge && user.age > this.eligibility.maxAge) return false;

  // Check gender
  if (this.eligibility.gender && this.eligibility.gender !== 'all' && user.gender !== this.eligibility.gender) return false;

  // Check membership type
  if (this.eligibility.membershipType && this.eligibility.membershipType.length > 0) {
    if (!user.membershipType || !this.eligibility.membershipType.includes(user.membershipType)) return false;
  }

  return true;
};

// Method to increment usage
offerSchema.methods.incrementUsage = function(userId) {
  this.usage.totalUses += 1;
  // Note: In a real implementation, you'd track unique users separately
  return this.save();
};

// Method to increment views
offerSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

// Method to increment clicks
offerSchema.methods.incrementClicks = function() {
  this.analytics.clicks += 1;
  return this.save();
};

// Method to increment conversions
offerSchema.methods.incrementConversions = function() {
  this.analytics.conversions += 1;
  return this.save();
};

// Static method to get active offers
offerSchema.statics.getActiveOffers = function(targetAudience = 'all', limit = 10) {
  const now = new Date();
  return this.find({
    status: 'active',
    isActive: true,
    'validity.startDate': { $lte: now },
    'validity.endDate': { $gte: now },
    $or: [
      { targetAudience: 'all' },
      { targetAudience: targetAudience }
    ]
  })
  .sort({ priority: -1, featured: -1, createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Static method to get offers by category
offerSchema.statics.getByCategory = function(category, limit = 10) {
  const now = new Date();
  return this.find({
    category: category,
    status: 'active',
    isActive: true,
    'validity.startDate': { $lte: now },
    'validity.endDate': { $gte: now }
  })
  .sort({ priority: -1, featured: -1, createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Virtual for savings amount
offerSchema.virtual('savings').get(function() {
  if (this.discountType === 'percentage' && this.originalPrice) {
    return (this.originalPrice * this.discountValue) / 100;
  } else if (this.discountType === 'fixed' && this.originalPrice) {
    return this.discountValue;
  }
  return 0;
});

// Virtual for final price
offerSchema.virtual('finalPrice').get(function() {
  if (this.discountedPrice) {
    return this.discountedPrice;
  } else if (this.originalPrice && this.discountType === 'percentage') {
    return this.originalPrice - this.savings;
  } else if (this.originalPrice && this.discountType === 'fixed') {
    return this.originalPrice - this.savings;
  }
  return this.originalPrice;
});

// Virtual for conversion rate
offerSchema.virtual('conversionRate').get(function() {
  if (this.analytics.clicks === 0) return 0;
  return (this.analytics.conversions / this.analytics.clicks) * 100;
});

module.exports = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
