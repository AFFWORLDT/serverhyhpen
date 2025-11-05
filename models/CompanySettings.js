const mongoose = require('mongoose');

const CompanySettingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    default: 'Hyphen Gym'
  },
  address: {
    street: {
      type: String,
      default: 'Warehouse 7 15 St - Al Quoz Industrial Area 3'
    },
    city: {
      type: String,
      default: 'Dubai'
    },
    country: {
      type: String,
      default: 'United Arab Emirates'
    },
    postalCode: {
      type: String,
      default: '00000'
    }
  },
  contact: {
    phone: {
      type: String,
      default: '+971 56 394 9253'
    },
    email: {
      type: String,
      default: 'finance@hyphendxb.ae'
    },
    website: {
      type: String,
      default: 'www.hyphenglobal.com'
    }
  },
  taxInfo: {
    taxNumber: {
      type: String,
      default: ''
    },
    taxRate: {
      type: Number,
      default: 5
    }
  },
  bankDetails: {
    bankName: {
      type: String,
      default: ''
    },
    accountNumber: {
      type: String,
      default: ''
    },
    IBAN: {
      type: String,
      default: ''
    },
    swiftCode: {
      type: String,
      default: ''
    }
  },
  logo: {
    type: String,
    default: ''
  },
  invoicePrefix: {
    type: String,
    default: 'INV'
  },
  receiptPrefix: {
    type: String,
    default: 'REC'
  },
  invoiceTerms: {
    type: String,
    default: 'Payment is due within 15 days from the date of invoice. Please include invoice number with payment.'
  },
  invoiceNotes: {
    type: String,
    default: 'Thank you for your business!'
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

module.exports = mongoose.model('CompanySettings', CompanySettingsSchema);









