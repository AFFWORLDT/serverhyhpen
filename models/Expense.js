const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  expenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'rent',
      'utilities',
      'salaries',
      'equipment',
      'maintenance',
      'marketing',
      'supplies',
      'insurance',
      'taxes',
      'travel',
      'meals',
      'training',
      'software',
      'other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  expenseDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'cheque'],
    required: true
  },
  vendor: {
    type: String
  },
  reference: {
    type: String
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    url: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  notes: {
    type: String
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

ExpenseSchema.index({ expenseNumber: 1 });
ExpenseSchema.index({ category: 1, status: 1 });
ExpenseSchema.index({ expenseDate: -1 });

module.exports = mongoose.model('Expense', ExpenseSchema);

