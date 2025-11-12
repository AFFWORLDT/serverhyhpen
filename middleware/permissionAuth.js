const { auth } = require('./auth');
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * Middleware to check if user has specific permission
 * @param {string|string[]} permissionSlug - Single permission slug or array of permission slugs
 * @param {object} options - Options for permission check
 * @param {boolean} options.requireAll - If true, user must have all permissions. If false, user needs any one permission
 * @param {boolean} options.allowAdmin - If true, admin role bypasses permission check (default: true)
 */
const hasPermission = (permissionSlug, options = {}) => {
  const { requireAll = false, allowAdmin = true } = options;
  const permissionSlugs = Array.isArray(permissionSlug) ? permissionSlug : [permissionSlug];
  
  return async (req, res, next) => {
    try {
      // First check authentication
      await new Promise((resolve, reject) => {
        auth(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Admin bypass (if enabled)
      if (allowAdmin && req.user.role === 'admin') {
        return next();
      }
      
      // Load user with roles
      const user = await User.findById(req.user.userId)
        .populate('assignedRole additionalRoles', 'permissionSlugs isActive');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Collect all permission slugs from user's roles
      const userPermissions = new Set();
      
      // Add permissions from primary assigned role
      if (user.assignedRole && user.assignedRole.isActive) {
        user.assignedRole.permissionSlugs?.forEach(slug => userPermissions.add(slug));
      }
      
      // Add permissions from additional roles
      if (user.additionalRoles && user.additionalRoles.length > 0) {
        user.additionalRoles
          .filter(role => role.isActive)
          .forEach(role => {
            role.permissionSlugs?.forEach(slug => userPermissions.add(slug));
          });
      }
      
      // Check permissions
      let hasAccess = false;
      
      if (requireAll) {
        // User must have all permissions
        hasAccess = permissionSlugs.every(slug => userPermissions.has(slug));
      } else {
        // User needs at least one permission
        hasAccess = permissionSlugs.some(slug => userPermissions.has(slug));
      }
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: permissionSlugs,
          userPermissions: Array.from(userPermissions)
        });
      }
      
      // Attach user permissions to request for use in controllers
      req.userPermissions = Array.from(userPermissions);
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
  };
};

/**
 * Middleware to check if user has permission for specific resource and action
 * @param {string} resource - Resource name (e.g., 'members', 'packages')
 * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
 */
const hasResourcePermission = (resource, action) => {
  return hasPermission(`${resource}:${action}`);
};

/**
 * Middleware to check if user has any permission in a category
 * @param {string} category - Permission category (e.g., 'members', 'finance')
 */
const hasCategoryPermission = (category) => {
  return async (req, res, next) => {
    try {
      await new Promise((resolve, reject) => {
        auth(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      if (req.user.role === 'admin') {
        return next();
      }
      
      const user = await User.findById(req.user.userId)
        .populate('assignedRole additionalRoles', 'permissionSlugs isActive');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const userPermissions = new Set();
      
      if (user.assignedRole && user.assignedRole.isActive) {
        user.assignedRole.permissionSlugs?.forEach(slug => userPermissions.add(slug));
      }
      
      if (user.additionalRoles && user.additionalRoles.length > 0) {
        user.additionalRoles
          .filter(role => role.isActive)
          .forEach(role => {
            role.permissionSlugs?.forEach(slug => userPermissions.add(slug));
          });
      }
      
      // Check if any permission starts with the category
      const hasCategoryAccess = Array.from(userPermissions).some(slug => 
        slug.startsWith(`${category}:`)
      );
      
      if (!hasCategoryAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. No permissions in ${category} category.`
        });
      }
      
      req.userPermissions = Array.from(userPermissions);
      next();
    } catch (error) {
      console.error('Category permission check error:', error);
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
  };
};

module.exports = {
  hasPermission,
  hasResourcePermission,
  hasCategoryPermission
};

