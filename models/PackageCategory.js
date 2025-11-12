const mongoose = require('mongoose');

const packageCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: '#3b82f6', // Default blue color
    trim: true
  },
  bgColor: {
    type: String,
    default: '#dbeafe', // Default light blue background
    trim: true
  },
  textColor: {
    type: String,
    default: '#1e40af', // Default dark blue text
    trim: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Generate slug from name before saving
packageCategorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Index for faster queries
packageCategorySchema.index({ isActive: 1, displayOrder: 1 });
packageCategorySchema.index({ slug: 1 });

module.exports = mongoose.model('PackageCategory', packageCategorySchema);

