const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
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
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  // Permission slugs for quick lookup (denormalized)
  permissionSlugs: [{
    type: String,
    trim: true
  }],
  // Department restrictions (if role is department-specific)
  allowedDepartments: [{
    type: String,
    trim: true
  }],
  // Position restrictions (if role is position-specific)
  allowedPositions: [{
    type: String,
    trim: true
  }],
  // Hierarchy level (higher number = more permissions)
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Role type
  type: {
    type: String,
    enum: ['system', 'department', 'position', 'custom'],
    default: 'custom'
  },
  // Color for UI display
  color: {
    type: String,
    default: '#3b82f6',
    trim: true
  },
  // Is this a system role (cannot be deleted)
  isSystem: {
    type: Boolean,
    default: false
  },
  // Is role active
  isActive: {
    type: Boolean,
    default: true
  },
  // Display order
  displayOrder: {
    type: Number,
    default: 0
  },
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
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
roleSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Update permission slugs when permissions change
roleSchema.pre('save', async function(next) {
  if (this.isModified('permissions') && this.permissions.length > 0) {
    const Permission = mongoose.model('Permission');
    const permissions = await Permission.find({ _id: { $in: this.permissions } });
    this.permissionSlugs = permissions.map(p => p.slug);
  }
  next();
});

// Indexes for faster queries
roleSchema.index({ slug: 1 });
roleSchema.index({ isActive: 1, displayOrder: 1 });
roleSchema.index({ type: 1 });
roleSchema.index({ level: -1 });

// Method to check if role has permission
roleSchema.methods.hasPermission = function(permissionSlug) {
  return this.permissionSlugs.includes(permissionSlug);
};

// Method to check if role has any of the permissions
roleSchema.methods.hasAnyPermission = function(permissionSlugs) {
  return permissionSlugs.some(slug => this.permissionSlugs.includes(slug));
};

// Method to check if role has all permissions
roleSchema.methods.hasAllPermissions = function(permissionSlugs) {
  return permissionSlugs.every(slug => this.permissionSlugs.includes(slug));
};

module.exports = mongoose.model('Role', roleSchema);

