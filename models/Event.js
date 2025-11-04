const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 300
  },
  type: {
    type: String,
    required: true,
    enum: ['workshop', 'seminar', 'competition', 'social', 'fitness', 'nutrition', 'wellness', 'community', 'training', 'celebration'],
    default: 'workshop'
  },
  category: {
    type: String,
    required: true,
    enum: ['fitness', 'nutrition', 'wellness', 'social', 'educational', 'competitive', 'charity', 'celebration', 'general'],
    default: 'general'
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
  location: {
    name: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    isVirtual: {
      type: Boolean,
      default: false
    },
    virtualLink: String,
    virtualPlatform: String
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    timezone: {
      type: String,
      default: 'Asia/Dubai'
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurringPattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'weekly'
    },
    recurringEndDate: Date
  },
  capacity: {
    maxAttendees: {
      type: Number,
      required: true,
      min: 1
    },
    currentAttendees: {
      type: Number,
      default: 0
    },
    waitlistEnabled: {
      type: Boolean,
      default: false
    },
    waitlistCapacity: {
      type: Number,
      default: 0
    }
  },
  pricing: {
    isFree: {
      type: Boolean,
      default: true
    },
    price: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'AED'
    },
    earlyBirdPrice: {
      type: Number,
      min: 0
    },
    earlyBirdEndDate: Date,
    memberDiscount: {
      type: Number,
      min: 0,
      max: 100
    },
    groupDiscount: {
      enabled: {
        type: Boolean,
        default: false
      },
      minGroupSize: {
        type: Number,
        default: 5
      },
      discountPercentage: {
        type: Number,
        min: 0,
        max: 100
      }
    }
  },
  organizer: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    organization: String,
    bio: String
  },
  instructors: [{
    name: String,
    email: String,
    phone: String,
    bio: String,
    specialization: String,
    image: String
  }],
  requirements: {
    ageRestriction: {
      minAge: Number,
      maxAge: Number
    },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'all'],
      default: 'all'
    },
    equipment: [String],
    prerequisites: [String],
    healthRequirements: [String]
  },
  features: {
    includes: [String],
    amenities: [String],
    refreshments: {
      provided: {
        type: Boolean,
        default: false
      },
      description: String
    },
    parking: {
      available: {
        type: Boolean,
        default: false
      },
      cost: Number,
      description: String
    },
    wifi: {
      type: Boolean,
      default: false
    },
    accessibility: {
      wheelchairAccessible: {
        type: Boolean,
        default: false
      },
      description: String
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed', 'postponed'],
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
  registration: {
    opensAt: {
      type: Date,
      default: Date.now
    },
    closesAt: {
      type: Date,
      required: true
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    allowWaitlist: {
      type: Boolean,
      default: true
    },
    maxRegistrationsPerUser: {
      type: Number,
      default: 1
    }
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['registered', 'confirmed', 'cancelled', 'waitlist'],
      default: 'registered'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'cancelled'],
      default: 'pending'
    },
    paymentId: String,
    notes: String
  }],
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    registrations: {
      type: Number,
      default: 0
    },
    cancellations: {
      type: Number,
      default: 0
    },
    noShows: {
      type: Number,
      default: 0
    }
  },
  socialMedia: {
    hashtags: [String],
    facebookEventId: String,
    instagramPostId: String,
    twitterPostId: String
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
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
eventSchema.index({ slug: 1 });
eventSchema.index({ type: 1, status: 1 });
eventSchema.index({ category: 1, isActive: 1 });
eventSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
eventSchema.index({ featured: 1, priority: -1 });
eventSchema.index({ 'location.coordinates': '2dsphere' });
eventSchema.index({ 'registration.opensAt': 1, 'registration.closesAt': 1 });

// Pre-save middleware to generate slug
eventSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Method to check if event is open for registration
eventSchema.methods.isOpenForRegistration = function() {
  const now = new Date();
  return this.status === 'published' && 
         this.isActive && 
         this.registration.opensAt <= now && 
         this.registration.closesAt >= now &&
         this.capacity.currentAttendees < this.capacity.maxAttendees;
};

// Method to register user for event
eventSchema.methods.registerUser = function(userId, paymentData = {}) {
  // Check if user is already registered
  const existingRegistration = this.attendees.find(attendee => 
    attendee.user.toString() === userId.toString()
  );

  if (existingRegistration) {
    throw new Error('User is already registered for this event');
  }

  // Check if event is open for registration
  if (!this.isOpenForRegistration()) {
    throw new Error('Event is not open for registration');
  }

  // Check capacity
  if (this.capacity.currentAttendees >= this.capacity.maxAttendees) {
    if (this.capacity.waitlistEnabled) {
      // Add to waitlist
      this.attendees.push({
        user: userId,
        status: 'waitlist',
        paymentStatus: paymentData.status || 'pending',
        paymentId: paymentData.paymentId
      });
    } else {
      throw new Error('Event is at full capacity');
    }
  } else {
    // Regular registration
    this.attendees.push({
      user: userId,
      status: 'registered',
      paymentStatus: paymentData.status || 'pending',
      paymentId: paymentData.paymentId
    });
    this.capacity.currentAttendees += 1;
  }

  this.analytics.registrations += 1;
  return this.save();
};

// Method to cancel user registration
eventSchema.methods.cancelRegistration = function(userId) {
  const attendeeIndex = this.attendees.findIndex(attendee => 
    attendee.user.toString() === userId.toString()
  );

  if (attendeeIndex === -1) {
    throw new Error('User is not registered for this event');
  }

  const attendee = this.attendees[attendeeIndex];
  
  if (attendee.status === 'waitlist') {
    // Remove from waitlist
    this.attendees.splice(attendeeIndex, 1);
  } else {
    // Cancel registration
    attendee.status = 'cancelled';
    this.capacity.currentAttendees -= 1;
    
    // Move someone from waitlist if available
    const waitlistAttendee = this.attendees.find(a => a.status === 'waitlist');
    if (waitlistAttendee) {
      waitlistAttendee.status = 'registered';
      this.capacity.currentAttendees += 1;
    }
  }

  this.analytics.cancellations += 1;
  return this.save();
};

// Method to increment views
eventSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

// Static method to get upcoming events
eventSchema.statics.getUpcoming = function(limit = 10) {
  const now = new Date();
  return this.find({
    status: 'published',
    isActive: true,
    'schedule.startDate': { $gte: now }
  })
  .sort({ 'schedule.startDate': 1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName')
  .populate('attendees.user', 'firstName lastName email');
};

// Static method to get events by category
eventSchema.statics.getByCategory = function(category, limit = 10) {
  const now = new Date();
  return this.find({
    category: category,
    status: 'published',
    isActive: true,
    'schedule.startDate': { $gte: now }
  })
  .sort({ 'schedule.startDate': 1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Static method to get featured events
eventSchema.statics.getFeatured = function(limit = 5) {
  const now = new Date();
  return this.find({
    featured: true,
    status: 'published',
    isActive: true,
    'schedule.startDate': { $gte: now }
  })
  .sort({ priority: -1, 'schedule.startDate': 1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Virtual for registration status
eventSchema.virtual('registrationStatus').get(function() {
  const now = new Date();
  if (now < this.registration.opensAt) {
    return 'not-open';
  } else if (now > this.registration.closesAt) {
    return 'closed';
  } else if (this.capacity.currentAttendees >= this.capacity.maxAttendees) {
    return this.capacity.waitlistEnabled ? 'waitlist' : 'full';
  } else {
    return 'open';
  }
});

// Virtual for spots remaining
eventSchema.virtual('spotsRemaining').get(function() {
  return Math.max(0, this.capacity.maxAttendees - this.capacity.currentAttendees);
});

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
