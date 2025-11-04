const mongoose = require('mongoose');

const LedgerSchema = new mongoose.Schema({
  transactionNumber: {
    type: String,
    required: true,
    unique: true
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  transactionType: {
    type: String,
    enum: ['income', 'expense', 'payment', 'refund', 'transfer'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  debit: {
    type: Number,
    default: 0,
    min: 0
  },
  credit: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'cheque', 'online']
  },
  reference: {
    type: String
  },
  relatedDocument: {
    documentType: {
      type: String,
      enum: ['invoice', 'receipt', 'expense', 'income', 'payment']
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  createdBy: {
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

LedgerSchema.index({ transactionNumber: 1 });
LedgerSchema.index({ transactionDate: -1 });
LedgerSchema.index({ transactionType: 1 });

module.exports = mongoose.model('Ledger', LedgerSchema);

