const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  image: {
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    mobileUrl: {
      type: String,
      default: ''
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['hero', 'promotional', 'announcement', 'event', 'offer', 'newsletter', 'social'],
    default: 'hero'
  },
  position: {
    type: String,
    required: true,
    enum: ['homepage-hero', 'homepage-top', 'homepage-middle', 'homepage-bottom', 'sidebar', 'header', 'footer', 'popup'],
    default: 'homepage-hero'
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'scheduled'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  targetAudience: {
    type: String,
    enum: ['all', 'members', 'non-members', 'trainers', 'staff', 'premium'],
    default: 'all'
  },
  clickAction: {
    type: {
      type: String,
      enum: ['none', 'url', 'page', 'modal', 'download', 'phone', 'email'],
      default: 'none'
    },
    value: String,
    openInNewTab: {
      type: Boolean,
      default: false
    }
  },
  ctaButton: {
    text: {
      type: String,
      default: 'Learn More'
    },
    color: {
      type: String,
      default: '#3B82F6'
    },
    backgroundColor: {
      type: String,
      default: '#FFFFFF'
    }
  },
  design: {
    backgroundColor: {
      type: String,
      default: '#FFFFFF'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    overlay: {
      enabled: {
        type: Boolean,
        default: false
      },
      color: {
        type: String,
        default: 'rgba(0,0,0,0.5)'
      }
    },
    animation: {
      type: String,
      enum: ['none', 'fade', 'slide', 'zoom', 'bounce'],
      default: 'fade'
    },
    duration: {
      type: Number,
      default: 5000 // milliseconds
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
bannerSchema.index({ position: 1, status: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
bannerSchema.index({ priority: -1 });
bannerSchema.index({ type: 1, isActive: 1 });
bannerSchema.index({ targetAudience: 1 });

// Method to increment views
bannerSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

// Method to increment clicks
bannerSchema.methods.incrementClicks = function() {
  this.analytics.clicks += 1;
  return this.save();
};

// Method to increment conversions
bannerSchema.methods.incrementConversions = function() {
  this.analytics.conversions += 1;
  return this.save();
};

// Static method to get active banners by position
bannerSchema.statics.getActiveByPosition = function(position, targetAudience = 'all') {
  const now = new Date();
  return this.find({
    position: position,
    status: 'active',
    isActive: true,
    startDate: { $lte: now },
    $or: [
      { endDate: null },
      { endDate: { $gte: now } }
    ],
    $or: [
      { targetAudience: 'all' },
      { targetAudience: targetAudience }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .populate('createdBy', 'firstName lastName');
};

// Static method to get banners by type
bannerSchema.statics.getByType = function(type, limit = 10) {
  const now = new Date();
  return this.find({
    type: type,
    status: 'active',
    isActive: true,
    startDate: { $lte: now },
    $or: [
      { endDate: null },
      { endDate: { $gte: now } }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Virtual for click-through rate
bannerSchema.virtual('ctr').get(function() {
  if (this.analytics.views === 0) return 0;
  return (this.analytics.clicks / this.analytics.views) * 100;
});

// Virtual for conversion rate
bannerSchema.virtual('conversionRate').get(function() {
  if (this.analytics.clicks === 0) return 0;
  return (this.analytics.conversions / this.analytics.clicks) * 100;
});

module.exports = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
