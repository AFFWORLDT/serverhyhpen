const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'trainer', 'member', 'staff'],
    default: 'member'
  },
  dateOfBirth: {
    type: Date,
    required: false
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: false
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'UAE' }
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  profileImage: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  
  // Trainer specific fields
  specialization: {
    type: String,
    trim: true
  },
  experience: {
    type: Number,
    min: 0
  },
  certification: {
    type: String,
    trim: true
  },
  hourlyRate: {
    type: Number,
    min: 0
  },
  
  // Trainer rating
  average_rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  // Staff specific fields
  position: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  salary: {
    type: Number,
    min: 0
  },
  hireDate: {
    type: Date
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  workSchedule: {
    type: String,
    trim: true
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
