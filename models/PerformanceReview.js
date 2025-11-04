const mongoose = require('mongoose');

const PerformanceReviewSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  reviewType: {
    type: String,
    enum: ['monthly', 'quarterly', 'semi-annual', 'annual', 'probation'],
    default: 'quarterly'
  },
  ratings: {
    punctuality: {
      type: Number,
      min: 1,
      max: 5
    },
    workQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    teamwork: {
      type: Number,
      min: 1,
      max: 5
    },
    initiative: {
      type: Number,
      min: 1,
      max: 5
    },
    overall: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  strengths: [{
    type: String
  }],
  areasForImprovement: [{
    type: String
  }],
  goals: [{
    description: String,
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    }
  }],
  comments: {
    type: String
  },
  nextReviewDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'reviewed', 'acknowledged'],
    default: 'draft'
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

PerformanceReviewSchema.index({ staff: 1, 'reviewPeriod.endDate': -1 });
PerformanceReviewSchema.index({ status: 1 });

module.exports = mongoose.model('PerformanceReview', PerformanceReviewSchema);

