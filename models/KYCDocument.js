const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentType: {
    type: String,
    required: true,
    enum: [
      'passport',
      'emirates_id',
      'visa',
      'driving_license',
      'utility_bill',
      'bank_statement',
      'employment_certificate',
      'insurance_card',
      'medical_certificate',
      'other'
    ]
  },
  documentName: {
    type: String,
    required: true
  },
  documentNumber: {
    type: String,
    required: true
  },
  issueDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  issuingAuthority: {
    type: String,
    required: true
  },
  documentFiles: [{
    fileName: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  verificationNotes: {
    type: String,
    default: ''
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
kycDocumentSchema.index({ member: 1, documentType: 1 });
kycDocumentSchema.index({ status: 1 });
kycDocumentSchema.index({ expiryDate: 1 });

// Pre-save middleware to update updatedAt
kycDocumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if document is expired
kycDocumentSchema.methods.isExpired = function() {
  return this.expiryDate < new Date();
};

// Method to get days until expiry
kycDocumentSchema.methods.daysUntilExpiry = function() {
  const today = new Date();
  const diffTime = this.expiryDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

module.exports = mongoose.models.KYCDocument || mongoose.model('KYCDocument', kycDocumentSchema);
