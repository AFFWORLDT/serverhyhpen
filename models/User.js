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
    startTime: String,
    endTime: String,
    days: [String]
  },
  
  // Enhanced staff fields for analytics and management
  skills: [{
    type: String,
    trim: true
  }],
  certifications: [{
    name: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String
  }],
  achievements: [{
    title: String,
    description: String,
    date: Date,
    category: String
  }],
  goals_completed: {
    type: Number,
    default: 0
  },
  goals_total: {
    type: Number,
    default: 0
  },
  training_hours: {
    type: Number,
    default: 0
  },
  total_reviews: {
    type: Number,
    default: 0
  },
  last_review_date: {
    type: Date
  },
  performance_notes: {
    type: String,
    default: ''
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  team: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night', 'flexible'],
    default: 'flexible'
  },
  contract_type: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'intern', 'consultant'],
    default: 'full-time'
  },
  benefits: [{
    type: String,
    trim: true
  }],
  leave_balance: {
    annual: { type: Number, default: 21 },
    sick: { type: Number, default: 7 },
    personal: { type: Number, default: 3 }
  },
  attendance_score: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  productivity_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  customer_satisfaction_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Member/Client specific fields
  assignedProgramme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Programme',
    default: null
  },
  programmeStartDate: {
    type: Date,
    default: null
  },
  programmeEndDate: {
    type: Date,
    default: null
  },
  assignedTrainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fitnessGoals: [{
    type: String,
    trim: true
  }],
  fitnessLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  medicalConditions: [{
    type: String,
    trim: true
  }],
  allergies: [{
    type: String,
    trim: true
  }],
  currentWeight: {
    type: Number,
    default: null
  },
  targetWeight: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  },
  memberNotes: {
    type: String,
    default: ''
  },
  
  // KYC (Know Your Customer) fields
  kycStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'pending_review', 'approved', 'rejected', 'expired'],
    default: 'not_started'
  },
  kycEnabled: {
    type: Boolean,
    default: false
  },
  kycRequired: {
    type: Boolean,
    default: true
  },
  kycCompletedAt: {
    type: Date
  },
  kycExpiryDate: {
    type: Date
  },
  kycNotes: {
    type: String,
    default: ''
  },
  kycVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  kycVerifiedAt: {
    type: Date
  },
  
  // Membership management fields
  membershipStatus: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'expired', 'cancelled'],
    default: 'active'
  },
  membershipType: {
    type: String,
    enum: ['basic', 'premium', 'vip', 'corporate', 'student', 'senior'],
    default: 'basic'
  },
  membershipStartDate: {
    type: Date
  },
  membershipEndDate: {
    type: Date
  },
  membershipRenewalDate: {
    type: Date
  },
  membershipNotes: {
    type: String,
    default: ''
  },
  
  // Creation tracking fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for initial admin users
  },
  createdByName: {
    type: String,
    required: false // Human-readable name of creator
  },
  creationMethod: {
    type: String,
    enum: ['manual', 'self_registration', 'import', 'api'],
    default: 'manual'
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

// Hash password before saving (only if password is new or changed)
userSchema.pre('save', async function(next) {
  // Only hash the password if it's been modified (and not already hashed)
  if (!this.isModified('password')) return next();
  
  // Check if password is already hashed (starts with $2a$ or $2b$)
  if (this.password && this.password.startsWith('$2')) {
    return next();
  }
  
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
