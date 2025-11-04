const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  answer: {
    type: String,
    required: true
  },
  shortAnswer: {
    type: String,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'membership', 'classes', 'equipment', 'payment', 'booking', 'cancellation', 'refund', 'facilities', 'safety', 'nutrition', 'training', 'technical', 'account'],
    default: 'general'
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: 100
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
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
  targetAudience: {
    type: String,
    enum: ['all', 'members', 'non-members', 'trainers', 'staff', 'beginners', 'premium'],
    default: 'all'
  },
  difficulty: {
    type: String,
    enum: ['basic', 'intermediate', 'advanced', 'all'],
    default: 'all'
  },
  relatedFaqs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FAQ'
  }],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    helpful: {
      type: Number,
      default: 0
    },
    notHelpful: {
      type: Number,
      default: 0
    },
    searches: {
      type: Number,
      default: 0
    }
  },
  feedback: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: {
      type: Boolean,
      required: true
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  },
  lastReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastReviewedAt: {
    type: Date,
    default: Date.now
  },
  reviewFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'as-needed'],
    default: 'quarterly'
  }
}, {
  timestamps: true
});

// Indexes for better performance
faqSchema.index({ category: 1, status: 1 });
faqSchema.index({ priority: -1, featured: -1 });
faqSchema.index({ tags: 1 });
faqSchema.index({ targetAudience: 1, difficulty: 1 });
faqSchema.index({ question: 'text', answer: 'text' }); // Text search index
faqSchema.index({ 'seo.keywords': 1 });

// Method to increment views
faqSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

// Method to increment searches
faqSchema.methods.incrementSearches = function() {
  this.analytics.searches += 1;
  return this.save();
};

// Method to add feedback
faqSchema.methods.addFeedback = function(userId, helpful, comment = '') {
  // Remove existing feedback from this user
  this.feedback = this.feedback.filter(fb => fb.user.toString() !== userId.toString());
  
  // Add new feedback
  this.feedback.push({
    user: userId,
    helpful: helpful,
    comment: comment
  });

  // Update analytics
  if (helpful) {
    this.analytics.helpful += 1;
  } else {
    this.analytics.notHelpful += 1;
  }

  return this.save();
};

// Method to mark as reviewed
faqSchema.methods.markAsReviewed = function(userId) {
  this.lastReviewedBy = userId;
  this.lastReviewedAt = new Date();
  return this.save();
};

// Static method to get FAQs by category
faqSchema.statics.getByCategory = function(category, limit = 10) {
  return this.find({ 
    category: category, 
    status: 'published', 
    isActive: true 
  })
  .sort({ priority: -1, featured: -1, createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Static method to get featured FAQs
faqSchema.statics.getFeatured = function(limit = 5) {
  return this.find({ 
    featured: true, 
    status: 'published', 
    isActive: true 
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Static method to search FAQs
faqSchema.statics.searchFAQs = function(query, limit = 10) {
  return this.find({
    $text: { $search: query },
    status: 'published',
    isActive: true
  })
  .sort({ score: { $meta: 'textScore' }, priority: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName');
};

// Static method to get FAQs needing review
faqSchema.statics.getNeedingReview = function() {
  const now = new Date();
  const reviewThresholds = {
    monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
    quarterly: 90 * 24 * 60 * 60 * 1000, // 90 days
    yearly: 365 * 24 * 60 * 60 * 1000, // 365 days
    'as-needed': Infinity
  };

  return this.find({
    status: 'published',
    isActive: true,
    $or: [
      { lastReviewedAt: { $exists: false } },
      {
        $expr: {
          $lt: [
            '$lastReviewedAt',
            {
              $subtract: [
                now,
                { $ifNull: [{ $multiply: ['$reviewFrequency', reviewThresholds.monthly] }, reviewThresholds.quarterly] }
              ]
            }
          ]
        }
      }
    ]
  })
  .sort({ lastReviewedAt: 1 })
  .populate('createdBy', 'firstName lastName');
};

// Virtual for helpfulness percentage
faqSchema.virtual('helpfulnessPercentage').get(function() {
  const total = this.analytics.helpful + this.analytics.notHelpful;
  if (total === 0) return 0;
  return Math.round((this.analytics.helpful / total) * 100);
});

// Virtual for user feedback (requires user context)
faqSchema.virtual('userFeedback').get(function() {
  // This would be set externally based on user context
  return null;
});

module.exports = mongoose.models.FAQ || mongoose.model('FAQ', faqSchema);
