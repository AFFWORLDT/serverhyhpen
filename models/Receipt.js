const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiptDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'cheque', 'online'],
    required: true
  },
  reference: {
    type: String
  },
  description: {
    type: String
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ReceiptSchema.index({ receiptNumber: 1 });
ReceiptSchema.index({ client: 1 });
ReceiptSchema.index({ receiptDate: -1 });

module.exports = mongoose.model('Receipt', ReceiptSchema);

