const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  baseSalary: {
    type: Number,
    required: true,
    min: 0
  },
  allowances: {
    housing: {
      type: Number,
      default: 0
    },
    transport: {
      type: Number,
      default: 0
    },
    medical: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    }
  },
  deductions: {
    tax: {
      type: Number,
      default: 0
    },
    insurance: {
      type: Number,
      default: 0
    },
    loan: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    }
  },
  overtime: {
    hours: {
      type: Number,
      default: 0
    },
    rate: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      default: 0
    }
  },
  bonuses: {
    type: Number,
    default: 0
  },
  grossSalary: {
    type: Number,
    required: true
  },
  netSalary: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'cheque'],
    default: 'bank_transfer'
  },
  paymentDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'paid', 'cancelled'],
    default: 'pending'
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    IBAN: String
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

PayrollSchema.pre('save', function(next) {
  this.grossSalary = this.baseSalary + 
                     this.allowances.housing + 
                     this.allowances.transport + 
                     this.allowances.medical + 
                     this.allowances.other + 
                     this.overtime.amount + 
                     this.bonuses;
  
  const totalDeductions = this.deductions.tax + 
                          this.deductions.insurance + 
                          this.deductions.loan + 
                          this.deductions.other;
  
  this.netSalary = this.grossSalary - totalDeductions;
  
  this.overtime.amount = this.overtime.hours * this.overtime.rate;
  
  this.updatedAt = Date.now();
  next();
});

PayrollSchema.index({ staff: 1, paymentDate: -1 });
PayrollSchema.index({ status: 1 });

module.exports = mongoose.model('Payroll', PayrollSchema);

