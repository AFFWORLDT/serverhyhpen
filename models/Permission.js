const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'dashboard',
      'members',
      'staff',
      'trainers',
      'packages',
      'payments',
      'appointments',
      'classes',
      'equipment',
      'finance',
      'reports',
      'settings',
      'content',
      'hr',
      'attendance',
      'calendar',
      'notifications',
      'system'
    ],
    trim: true
  },
  resource: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'manage', 'view', 'export', 'import', 'approve', 'reject'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false // System permissions cannot be deleted
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
permissionSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Indexes for faster queries
permissionSchema.index({ category: 1, resource: 1, action: 1 });
permissionSchema.index({ slug: 1 });
permissionSchema.index({ isActive: 1 });

module.exports = mongoose.model('Permission', permissionSchema);

