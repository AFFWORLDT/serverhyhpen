const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');

// Get all roles (admin only)
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const { type, isActive, department, position } = req.query;
    
    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (department) filter.allowedDepartments = department;
    if (position) filter.allowedPositions = position;
    
    const roles = await Role.find(filter)
      .populate('permissions', 'name slug category resource action')
      .sort({ displayOrder: 1, level: -1, name: 1 });
    
    // Get user counts for each role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.countDocuments({
          $or: [
            { assignedRole: role._id },
            { additionalRoles: role._id }
          ]
        });
        
        const roleObj = role.toObject();
        roleObj.usersCount = userCount;
        return roleObj;
      })
    );
    
    res.json({
      success: true,
      data: {
        roles: rolesWithCounts
      }
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch roles',
      message: error.message 
    });
  }
});

// Get single role by ID
router.get('/:id', auth, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate('permissions', 'name slug category resource action description');
    
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json({
      success: true,
      data: {
        role
      }
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Get role by slug
router.get('/slug/:slug', auth, isAdmin, async (req, res) => {
  try {
    const role = await Role.findOne({ slug: req.params.slug })
      .populate('permissions', 'name slug category resource action description');
    
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json({
      success: true,
      data: {
        role
      }
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Create new role (admin only)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      permissions,
      allowedDepartments,
      allowedPositions,
      level,
      type,
      color,
      isActive,
      displayOrder
    } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    
    // Check if role with same name or slug already exists
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existingRole = await Role.findOne({
      $or: [{ name: name.trim() }, { slug }]
    });
    
    if (existingRole) {
      return res.status(400).json({ error: 'Role with this name already exists' });
    }
    
    // Validate permissions if provided
    let permissionIds = [];
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isActive: true
      });
      permissionIds = validPermissions.map(p => p._id);
    }
    
    const newRole = new Role({
      name: name.trim(),
      description: description?.trim() || '',
      permissions: permissionIds,
      allowedDepartments: allowedDepartments || [],
      allowedPositions: allowedPositions || [],
      level: level || 0,
      type: type || 'custom',
      color: color || '#3b82f6',
      isActive: isActive !== undefined ? isActive : true,
      isSystem: false,
      displayOrder: displayOrder || 0,
      createdBy: req.user.userId
    });
    
    await newRole.save();
    
    // Populate permissions for response
    await newRole.populate('permissions', 'name slug category resource action');
    
    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        role: newRole
      }
    });
  } catch (error) {
    console.error('Error creating role:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Role with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      permissions,
      allowedDepartments,
      allowedPositions,
      level,
      type,
      color,
      isActive,
      displayOrder
    } = req.body;
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Cannot modify system roles
    if (role.isSystem) {
      return res.status(400).json({ error: 'Cannot modify system roles' });
    }
    
    // Check if name change would conflict with existing role
    if (name && name.trim() !== role.name) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existingRole = await Role.findOne({
        _id: { $ne: req.params.id },
        $or: [{ name: name.trim() }, { slug }]
      });
      
      if (existingRole) {
        return res.status(400).json({ error: 'Role with this name already exists' });
      }
    }
    
    // Update fields
    if (name !== undefined) role.name = name.trim();
    if (description !== undefined) role.description = description?.trim() || '';
    if (allowedDepartments !== undefined) role.allowedDepartments = allowedDepartments;
    if (allowedPositions !== undefined) role.allowedPositions = allowedPositions;
    if (level !== undefined) role.level = level;
    if (type !== undefined) role.type = type;
    if (color !== undefined) role.color = color;
    if (isActive !== undefined) role.isActive = isActive;
    if (displayOrder !== undefined) role.displayOrder = displayOrder;
    role.updatedBy = req.user.userId;
    
    // Update permissions if provided
    if (permissions !== undefined) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isActive: true
      });
      role.permissions = validPermissions.map(p => p._id);
    }
    
    // Regenerate slug if name changed
    if (name && name.trim() !== role.name) {
      role.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    await role.save();
    
    // Populate permissions for response
    await role.populate('permissions', 'name slug category resource action');
    
    res.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        role
      }
    });
  } catch (error) {
    console.error('Error updating role:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Role with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role (admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Cannot delete system roles
    if (role.isSystem) {
      return res.status(400).json({ error: 'Cannot delete system roles' });
    }
    
    // Check if role is assigned to any user
    const usersWithRole = await User.countDocuments({
      $or: [
        { assignedRole: req.params.id },
        { additionalRoles: req.params.id }
      ]
    });
    
    if (usersWithRole > 0) {
      return res.status(400).json({
        error: `Cannot delete role. ${usersWithRole} user(s) are assigned this role. Please reassign or remove those users first.`
      });
    }
    
    await Role.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Assign role to user
router.post('/:id/assign', auth, isAdmin, async (req, res) => {
  try {
    const { userId, isPrimary } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (isPrimary) {
      user.assignedRole = role._id;
    } else {
      if (!user.additionalRoles.includes(role._id)) {
        user.additionalRoles.push(role._id);
      }
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Role assigned successfully',
      data: {
        user: await user.populate('assignedRole additionalRoles', 'name slug description')
      }
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Remove role from user
router.post('/:id/unassign', auth, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.assignedRole && user.assignedRole.toString() === req.params.id) {
      user.assignedRole = null;
    }
    
    user.additionalRoles = user.additionalRoles.filter(
      roleId => roleId.toString() !== req.params.id
    );
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Role removed successfully',
      data: {
        user: await user.populate('assignedRole additionalRoles', 'name slug description')
      }
    });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// Get users with specific role
router.get('/:id/users', auth, isAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    const users = await User.find({
      $or: [
        { assignedRole: req.params.id },
        { additionalRoles: req.params.id }
      ]
    }).select('firstName lastName email phone role department position isActive');
    
    res.json({
      success: true,
      data: {
        role: {
          id: role._id,
          name: role.name,
          slug: role.slug
        },
        users
      }
    });
  } catch (error) {
    console.error('Error fetching users with role:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;

