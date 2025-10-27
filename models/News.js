const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
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
  excerpt: {
    type: String,
    required: true,
    maxlength: 500
  },
  content: {
    type: String,
    required: true
  },
  featuredImage: {
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
  category: {
    type: String,
    required: true,
    enum: ['General', 'Fitness', 'Nutrition', 'Events', 'Promotions', 'Health', 'Technology', 'Community'],
    default: 'General'
  },
  tags: [{
    type: String,
    trim: true
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date,
    default: null
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
    }
  }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  socialMedia: {
    facebook: {
      enabled: { type: Boolean, default: false },
      message: String
    },
    twitter: {
      enabled: { type: Boolean, default: false },
      message: String
    },
    instagram: {
      enabled: { type: Boolean, default: false },
      message: String
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
newsSchema.index({ slug: 1 });
newsSchema.index({ category: 1, status: 1 });
newsSchema.index({ publishedAt: -1 });
newsSchema.index({ featured: 1, priority: -1 });
newsSchema.index({ tags: 1 });
newsSchema.index({ 'seo.keywords': 1 });

// Pre-save middleware to generate slug
newsSchema.pre('save', function(next) {
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

// Virtual for reading time estimation
newsSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Method to increment views
newsSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to add comment
newsSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content: content
  });
  return this.save();
};

// Static method to get featured news
newsSchema.statics.getFeatured = function(limit = 5) {
  return this.find({ 
    status: 'published', 
    featured: true, 
    isActive: true 
  })
  .sort({ priority: -1, publishedAt: -1 })
  .limit(limit)
  .populate('author', 'firstName lastName email')
  .select('-content'); // Exclude full content for listing
};

// Static method to get news by category
newsSchema.statics.getByCategory = function(category, limit = 10, page = 1) {
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

module.exports = mongoose.models.News || mongoose.model('News', newsSchema);
