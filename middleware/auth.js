const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'hypgym_dubai_secret_key_2024_secure_random_string';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      // Include staff-specific fields for sub-role handling
      department: user.department,
      position: user.position,
      employeeId: user.employeeId
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// Admin only middleware
const adminAuth = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Admin or Trainer middleware
const adminOrTrainerAuth = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (!['admin', 'trainer'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Trainer privileges required.'
    });
  }
  next();
};

// Admin or Trainer or Staff middleware
const adminOrTrainerOrStaffAuth = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (!['admin', 'trainer', 'staff'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Trainer, or Staff privileges required.'
    });
  }
  next();
};

module.exports = { auth, adminAuth, adminOrTrainerAuth, adminOrTrainerOrStaffAuth };
