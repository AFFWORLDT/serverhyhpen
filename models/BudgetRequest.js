const mongoose = require('mongoose');

const BudgetRequestSchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fiscalYear: {
    type: String,
    required: true
  },
  budgetType: {
    type: String,
    enum: ['initial', 'supplementary', 'revision'],
    default: 'initial'
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  breakdown: [{
    category: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String
  }],
  justification: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'archived'],
    default: 'draft'
  },
  reviews: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: String,
    status: {
      type: String,
      enum: ['approved', 'rejected', 'pending']
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  attachments: [{
    url: String,
    type: String,
    name: String
  }],
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

BudgetRequestSchema.index({ department: 1, status: 1 });
BudgetRequestSchema.index({ fiscalYear: 1 });

module.exports = mongoose.model('BudgetRequest', BudgetRequestSchema);

