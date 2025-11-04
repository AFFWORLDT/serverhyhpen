const mongoose = require('mongoose');

const proTipSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['fitness', 'nutrition', 'wellness', 'motivation', 'technique', 'recovery', 'equipment', 'safety', 'lifestyle', 'general'],
    default: 'general'
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'all'],
    default: 'all'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'members', 'trainers', 'staff', 'beginners', 'athletes', 'seniors', 'youth'],
    default: 'all'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  image: {
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    caption: {
      type: String,
      default: ''
    }
  },
  gallery: [{
    url: String,
    alt: String,
    caption: String
  }],
  video: {
    url: String,
    platform: {
      type: String,
      enum: ['youtube', 'vimeo', 'direct', 'other']
    },
    duration: Number, // in seconds
    thumbnail: String
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expert: {
    name: String,
    credentials: String,
    bio: String,
    image: String,
    socialMedia: {
      instagram: String,
      twitter: String,
      linkedin: String,
      website: String
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
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
  publishedAt: {
    type: Date,
    default: null
  },
  readingTime: {
    type: Number, // in minutes
    default: 0
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    }
  },
  interactions: {
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    saves: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      likes: {
        type: Number,
        default: 0
      },
      replies: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        content: String,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }]
    }]
  },
  relatedTips: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProTip'
  }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  socialSharing: {
    enabled: {
      type: Boolean,
      default: true
    },
    platforms: [{
      type: String,
      enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'whatsapp']
    }]
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
proTipSchema.index({ slug: 1 });
proTipSchema.index({ category: 1, status: 1 });
proTipSchema.index({ difficulty: 1, targetAudience: 1 });
proTipSchema.index({ featured: 1, priority: -1 });
proTipSchema.index({ publishedAt: -1 });
proTipSchema.index({ tags: 1 });
proTipSchema.index({ 'seo.keywords': 1 });

// Pre-save middleware to generate slug and reading time
proTipSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  // Calculate reading time (assuming 200 words per minute)
  if (this.isModified('content')) {
    const wordCount = this.content.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }

  next();
});

// Method to increment views
proTipSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

// Method to like/unlike tip
proTipSchema.methods.toggleLike = function(userId) {
  const existingLike = this.interactions.likes.find(like => 
    like.user.toString() === userId.toString()
  );

  if (existingLike) {
    // Unlike
    this.interactions.likes = this.interactions.likes.filter(like => 
      like.user.toString() !== userId.toString()
    );
    this.analytics.likes -= 1;
  } else {
    // Like
    this.interactions.likes.push({ user: userId });
    this.analytics.likes += 1;
  }

  return this.save();
};

// Method to save/unsave tip
proTipSchema.methods.toggleSave = function(userId) {
  const existingSave = this.interactions.saves.find(save => 
    save.user.toString() === userId.toString()
  );

  if (existingSave) {
    // Unsave
    this.interactions.saves = this.interactions.saves.filter(save => 
      save.user.toString() !== userId.toString()
    );
    this.analytics.saves -= 1;
  } else {
    // Save
    this.interactions.saves.push({ user: userId });
    this.analytics.saves += 1;
  }

  return this.save();
};

// Method to add comment
proTipSchema.methods.addComment = function(userId, content) {
  this.interactions.comments.push({
    user: userId,
    content: content
  });
  this.analytics.comments += 1;
  return this.save();
};

// Method to increment shares
proTipSchema.methods.incrementShares = function() {
  this.analytics.shares += 1;
  return this.save();
};

// Static method to get featured tips
proTipSchema.statics.getFeatured = function(limit = 5) {
  return this.find({ 
    status: 'published', 
    featured: true, 
    isActive: true 
  })
  .sort({ priority: -1, publishedAt: -1 })
  .limit(limit)
  .populate('author', 'firstName lastName')
  .select('-content'); // Exclude full content for listing
};

// Static method to get tips by category
proTipSchema.statics.getByCategory = function(category, limit = 10, page = 1) {
  const skip = (page - 1) * limit;
  return this.find({ 
    category: category, 
    status: 'published', 
    isActive: true 
  })
  .sort({ publishedAt: -1 })
  .skip(skip)
  .limit(limit)
  .populate('author', 'firstName lastName')
  .select('-content');
};

// Static method to get tips by difficulty
proTipSchema.statics.getByDifficulty = function(difficulty, limit = 10) {
  return this.find({ 
    difficulty: difficulty, 
    status: 'published', 
    isActive: true 
  })
  .sort({ publishedAt: -1 })
  .limit(limit)
  .populate('author', 'firstName lastName')
  .select('-content');
};

// Static method to search tips
proTipSchema.statics.searchTips = function(query, limit = 10) {
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { excerpt: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ],
    status: 'published',
    isActive: true
  })
  .sort({ publishedAt: -1 })
  .limit(limit)
  .populate('author', 'firstName lastName')
  .select('-content');
};

// Virtual for like status (requires user context)
proTipSchema.virtual('isLiked').get(function() {
  // This would be set externally based on user context
  return false;
});

// Virtual for save status (requires user context)
proTipSchema.virtual('isSaved').get(function() {
  // This would be set externally based on user context
  return false;
});

module.exports = mongoose.models.ProTip || mongoose.model('ProTip', proTipSchema);
