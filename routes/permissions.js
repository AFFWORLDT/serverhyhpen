const express = require('express');
const router = express.Router();
const Permission = require('../models/Permission');
const { auth } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');

// Get all permissions (admin only)
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const { category, resource, action, isActive } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const permissions = await Permission.find(filter)
      .sort({ category: 1, resource: 1, action: 1 });
    
    res.json({
      success: true,
      data: {
        permissions
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get permissions by category
router.get('/category/:category', auth, isAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const permissions = await Permission.find({ category, isActive: true })
      .sort({ resource: 1, action: 1 });
    
    res.json({
      success: true,
      data: {
        permissions
      }
    });
  } catch (error) {
    console.error('Error fetching permissions by category:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get single permission by ID
router.get('/:id', auth, isAdmin, async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    
    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }
    
    res.json({
      success: true,
      data: {
        permission
      }
    });
  } catch (error) {
    console.error('Error fetching permission:', error);
    res.status(500).json({ error: 'Failed to fetch permission' });
  }
});

// Create new permission (admin only)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      resource,
      action,
      isActive
    } = req.body;
    
    // Validation
    if (!name || !category || !resource || !action) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, category, resource, action' 
      });
    }
    
    // Check if permission with same slug already exists
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existingPermission = await Permission.findOne({ slug });
    
    if (existingPermission) {
      return res.status(400).json({ error: 'Permission with this name already exists' });
    }
    
    const newPermission = new Permission({
      name: name.trim(),
      description: description?.trim() || '',
      category,
      resource,
      action,
      isActive: isActive !== undefined ? isActive : true,
      isSystem: false,
      createdBy: req.user.userId
    });
    
    await newPermission.save();
    
    res.status(201).json({
      success: true,
      message: 'Permission created successfully',
      data: {
        permission: newPermission
      }
    });
  } catch (error) {
    console.error('Error creating permission:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Permission with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create permission' });
  }
});

// Update permission (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      resource,
      action,
      isActive
    } = req.body;
    
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }
    
    // Cannot modify system permissions
    if (permission.isSystem) {
      return res.status(400).json({ error: 'Cannot modify system permissions' });
    }
    
    // Update fields
    if (name !== undefined) permission.name = name.trim();
    if (description !== undefined) permission.description = description?.trim() || '';
    if (category !== undefined) permission.category = category;
    if (resource !== undefined) permission.resource = resource;
    if (action !== undefined) permission.action = action;
    if (isActive !== undefined) permission.isActive = isActive;
    permission.updatedBy = req.user.userId;
    
    // Regenerate slug if name changed
    if (name && name.trim() !== permission.name) {
      permission.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    await permission.save();
    
    res.json({
      success: true,
      message: 'Permission updated successfully',
      data: {
        permission
      }
    });
  } catch (error) {
    console.error('Error updating permission:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Permission with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// Delete permission (admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({ error: 'Permission not found' });
    }
    
    // Cannot delete system permissions
    if (permission.isSystem) {
      return res.status(400).json({ error: 'Cannot delete system permissions' });
    }
    
    // Check if permission is in use by any role
    const Role = require('../models/Role');
    const rolesUsingPermission = await Role.countDocuments({
      permissions: req.params.id
    });
    
    if (rolesUsingPermission > 0) {
      return res.status(400).json({
        error: `Cannot delete permission. ${rolesUsingPermission} role(s) are using this permission.`
      });
    }
    
    await Permission.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Permission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting permission:', error);
    res.status(500).json({ error: 'Failed to delete permission' });
  }
});

module.exports = router;

