const mongoose = require('mongoose');

const IncomeSchema = new mongoose.Schema({
  incomeNumber: {
    type: String,
    required: true,
    unique: true
  },
  source: {
    type: String,
    required: true,
    enum: [
      'membership',
      'training_session',
      'package',
      'equipment_rental',
      'merchandise',
      'cafe',
      'event',
      'sponsorship',
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
  incomeDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'cheque', 'online'],
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  receipt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receipt'
  },
  reference: {
    type: String
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

IncomeSchema.index({ incomeNumber: 1 });
IncomeSchema.index({ source: 1 });
IncomeSchema.index({ incomeDate: -1 });

module.exports = mongoose.model('Income', IncomeSchema);

