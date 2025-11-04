const { auth } = require('./auth');

// Staff sub-role middleware
const staffDepartmentAuth = (allowedDepartments = []) => {
  return (req, res, next) => {
    // First check if user is authenticated
    auth(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user is staff
      if (req.user.role !== 'staff') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Staff role required.'
        });
      }
      
      // If no specific departments allowed, allow all staff
      if (allowedDepartments.length === 0) {
        return next();
      }
      
      // Check if user's department is allowed
      if (!req.user.department || !allowedDepartments.includes(req.user.department)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required departments: ${allowedDepartments.join(', ')}`
        });
      }
      
      next();
    });
  };
};

// Specific department middlewares
const receptionAuth = staffDepartmentAuth(['reception', 'front_desk']);
const maintenanceAuth = staffDepartmentAuth(['maintenance']);
const managementAuth = staffDepartmentAuth(['management']);

// Staff position middleware
const staffPositionAuth = (allowedPositions = []) => {
  return (req, res, next) => {
    // First check if user is authenticated
    auth(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user is staff
      if (req.user.role !== 'staff') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Staff role required.'
        });
      }
      
      // If no specific positions allowed, allow all staff
      if (allowedPositions.length === 0) {
        return next();
      }
      
      // Check if user's position is allowed
      if (!req.user.position || !allowedPositions.includes(req.user.position)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required positions: ${allowedPositions.join(', ')}`
        });
      }
      
      next();
    });
  };
};

// Admin only
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Admin or Staff
const isAdminOrStaff = (req, res, next) => {
  // First check if user is authenticated
  auth(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user is admin or staff
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'staff')) {
      return res.status(403).json({ error: 'Admin or staff access required' });
    }
    next();
  });
};

module.exports = {
  auth,
  adminAuth: require('./auth').adminAuth,
  adminOrTrainerAuth: require('./auth').adminOrTrainerAuth,
  staffDepartmentAuth,
  staffPositionAuth,
  receptionAuth,
  maintenanceAuth,
  managementAuth,
  isAdmin,
  isAdminOrStaff
};
