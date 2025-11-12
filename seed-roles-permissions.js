const mongoose = require('mongoose');
require('dotenv').config();

const Permission = require('./models/Permission');
const Role = require('./models/Role');
const User = require('./models/User');

// Default permissions structure
const defaultPermissions = [
  // Dashboard
  { name: 'View Dashboard', category: 'dashboard', resource: 'dashboard', action: 'view' },
  { name: 'View Analytics', category: 'dashboard', resource: 'analytics', action: 'view' },
  { name: 'View Reports', category: 'dashboard', resource: 'reports', action: 'view' },
  
  // Members
  { name: 'View Members', category: 'members', resource: 'members', action: 'read' },
  { name: 'Create Members', category: 'members', resource: 'members', action: 'create' },
  { name: 'Update Members', category: 'members', resource: 'members', action: 'update' },
  { name: 'Delete Members', category: 'members', resource: 'members', action: 'delete' },
  { name: 'Manage Member Packages', category: 'members', resource: 'member-packages', action: 'manage' },
  { name: 'View Member Details', category: 'members', resource: 'member-details', action: 'view' },
  { name: 'Export Members', category: 'members', resource: 'members', action: 'export' },
  
  // Staff
  { name: 'View Staff', category: 'staff', resource: 'staff', action: 'read' },
  { name: 'Create Staff', category: 'staff', resource: 'staff', action: 'create' },
  { name: 'Update Staff', category: 'staff', resource: 'staff', action: 'update' },
  { name: 'Delete Staff', category: 'staff', resource: 'staff', action: 'delete' },
  { name: 'Manage Staff Roles', category: 'staff', resource: 'staff-roles', action: 'manage' },
  { name: 'View Staff Performance', category: 'staff', resource: 'staff-performance', action: 'view' },
  { name: 'Manage Staff Schedule', category: 'staff', resource: 'staff-schedule', action: 'manage' },
  
  // Trainers
  { name: 'View Trainers', category: 'trainers', resource: 'trainers', action: 'read' },
  { name: 'Create Trainers', category: 'trainers', resource: 'trainers', action: 'create' },
  { name: 'Update Trainers', category: 'trainers', resource: 'trainers', action: 'update' },
  { name: 'Delete Trainers', category: 'trainers', resource: 'trainers', action: 'delete' },
  { name: 'Manage Trainer Schedule', category: 'trainers', resource: 'trainer-schedule', action: 'manage' },
  { name: 'View Trainer Performance', category: 'trainers', resource: 'trainer-performance', action: 'view' },
  
  // Packages
  { name: 'View Packages', category: 'packages', resource: 'packages', action: 'read' },
  { name: 'Create Packages', category: 'packages', resource: 'packages', action: 'create' },
  { name: 'Update Packages', category: 'packages', resource: 'packages', action: 'update' },
  { name: 'Delete Packages', category: 'packages', resource: 'packages', action: 'delete' },
  { name: 'Manage Package Categories', category: 'packages', resource: 'package-categories', action: 'manage' },
  { name: 'Assign Packages to Members', category: 'packages', resource: 'package-assignment', action: 'manage' },
  
  // Payments
  { name: 'View Payments', category: 'payments', resource: 'payments', action: 'read' },
  { name: 'Create Payments', category: 'payments', resource: 'payments', action: 'create' },
  { name: 'Update Payments', category: 'payments', resource: 'payments', action: 'update' },
  { name: 'Delete Payments', category: 'payments', resource: 'payments', action: 'delete' },
  { name: 'Process Payments', category: 'payments', resource: 'payments', action: 'manage' },
  { name: 'View Payment Reports', category: 'payments', resource: 'payment-reports', action: 'view' },
  { name: 'Export Payments', category: 'payments', resource: 'payments', action: 'export' },
  
  // Appointments
  { name: 'View Appointments', category: 'appointments', resource: 'appointments', action: 'read' },
  { name: 'Create Appointments', category: 'appointments', resource: 'appointments', action: 'create' },
  { name: 'Update Appointments', category: 'appointments', resource: 'appointments', action: 'update' },
  { name: 'Delete Appointments', category: 'appointments', resource: 'appointments', action: 'delete' },
  { name: 'Manage Appointments', category: 'appointments', resource: 'appointments', action: 'manage' },
  { name: 'Cancel Appointments', category: 'appointments', resource: 'appointments', action: 'update' },
  
  // Classes
  { name: 'View Classes', category: 'classes', resource: 'classes', action: 'read' },
  { name: 'Create Classes', category: 'classes', resource: 'classes', action: 'create' },
  { name: 'Update Classes', category: 'classes', resource: 'classes', action: 'update' },
  { name: 'Delete Classes', category: 'classes', resource: 'classes', action: 'delete' },
  { name: 'Manage Class Bookings', category: 'classes', resource: 'class-bookings', action: 'manage' },
  
  // Equipment
  { name: 'View Equipment', category: 'equipment', resource: 'equipment', action: 'read' },
  { name: 'Create Equipment', category: 'equipment', resource: 'equipment', action: 'create' },
  { name: 'Update Equipment', category: 'equipment', resource: 'equipment', action: 'update' },
  { name: 'Delete Equipment', category: 'equipment', resource: 'equipment', action: 'delete' },
  { name: 'Manage Equipment Maintenance', category: 'equipment', resource: 'equipment-maintenance', action: 'manage' },
  
  // Finance
  { name: 'View Finance Dashboard', category: 'finance', resource: 'finance-dashboard', action: 'view' },
  { name: 'View Invoices', category: 'finance', resource: 'invoices', action: 'read' },
  { name: 'Create Invoices', category: 'finance', resource: 'invoices', action: 'create' },
  { name: 'Update Invoices', category: 'finance', resource: 'invoices', action: 'update' },
  { name: 'Delete Invoices', category: 'finance', resource: 'invoices', action: 'delete' },
  { name: 'View Expenses', category: 'finance', resource: 'expenses', action: 'read' },
  { name: 'Create Expenses', category: 'finance', resource: 'expenses', action: 'create' },
  { name: 'Approve Expenses', category: 'finance', resource: 'expenses', action: 'approve' },
  { name: 'View Income', category: 'finance', resource: 'income', action: 'read' },
  { name: 'Create Income', category: 'finance', resource: 'income', action: 'create' },
  { name: 'View Ledger', category: 'finance', resource: 'ledger', action: 'read' },
  { name: 'Manage Budget', category: 'finance', resource: 'budget', action: 'manage' },
  { name: 'View Financial Reports', category: 'finance', resource: 'financial-reports', action: 'view' },
  
  // Reports
  { name: 'View All Reports', category: 'reports', resource: 'reports', action: 'view' },
  { name: 'Generate Reports', category: 'reports', resource: 'reports', action: 'create' },
  { name: 'Export Reports', category: 'reports', resource: 'reports', action: 'export' },
  
  // Settings
  { name: 'View Settings', category: 'settings', resource: 'settings', action: 'read' },
  { name: 'Update Settings', category: 'settings', resource: 'settings', action: 'update' },
  { name: 'Manage System Settings', category: 'settings', resource: 'system-settings', action: 'manage' },
  { name: 'Manage Roles', category: 'settings', resource: 'roles', action: 'manage' },
  { name: 'Manage Permissions', category: 'settings', resource: 'permissions', action: 'manage' },
  { name: 'Manage Departments', category: 'settings', resource: 'departments', action: 'manage' },
  
  // Content Management
  { name: 'View Content', category: 'content', resource: 'content', action: 'read' },
  { name: 'Create Content', category: 'content', resource: 'content', action: 'create' },
  { name: 'Update Content', category: 'content', resource: 'content', action: 'update' },
  { name: 'Delete Content', category: 'content', resource: 'content', action: 'delete' },
  { name: 'Manage News', category: 'content', resource: 'news', action: 'manage' },
  { name: 'Manage Banners', category: 'content', resource: 'banners', action: 'manage' },
  { name: 'Manage Offers', category: 'content', resource: 'offers', action: 'manage' },
  { name: 'Manage Events', category: 'content', resource: 'events', action: 'manage' },
  
  // HR
  { name: 'View HR Dashboard', category: 'hr', resource: 'hr-dashboard', action: 'view' },
  { name: 'Manage Leave Requests', category: 'hr', resource: 'leave', action: 'manage' },
  { name: 'Approve Leave Requests', category: 'hr', resource: 'leave', action: 'approve' },
  { name: 'Manage Payroll', category: 'hr', resource: 'payroll', action: 'manage' },
  { name: 'View Performance Reviews', category: 'hr', resource: 'performance-reviews', action: 'view' },
  { name: 'Create Performance Reviews', category: 'hr', resource: 'performance-reviews', action: 'create' },
  
  // Attendance
  { name: 'View Attendance', category: 'attendance', resource: 'attendance', action: 'read' },
  { name: 'Mark Attendance', category: 'attendance', resource: 'attendance', action: 'create' },
  { name: 'Manage Attendance', category: 'attendance', resource: 'attendance', action: 'manage' },
  { name: 'View Attendance Reports', category: 'attendance', resource: 'attendance-reports', action: 'view' },
  
  // Calendar
  { name: 'View Calendar', category: 'calendar', resource: 'calendar', action: 'view' },
  { name: 'Manage Calendar Events', category: 'calendar', resource: 'calendar', action: 'manage' },
  
  // Notifications
  { name: 'View Notifications', category: 'notifications', resource: 'notifications', action: 'read' },
  { name: 'Send Notifications', category: 'notifications', resource: 'notifications', action: 'create' },
  { name: 'Manage Notifications', category: 'notifications', resource: 'notifications', action: 'manage' },
  
  // System
  { name: 'Manage Users', category: 'system', resource: 'users', action: 'manage' },
  { name: 'View System Logs', category: 'system', resource: 'system-logs', action: 'view' },
  { name: 'Manage System Backup', category: 'system', resource: 'system-backup', action: 'manage' }
];

// Default roles with permissions
const defaultRoles = [
  {
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    type: 'system',
    level: 100,
    color: '#dc2626',
    isSystem: true,
    permissions: [] // All permissions
  },
  {
    name: 'Manager',
    description: 'Management role with broad access to operations and staff',
    type: 'department',
    level: 80,
    color: '#2563eb',
    isSystem: true,
    permissions: [
      'dashboard', 'members', 'staff', 'trainers', 'packages', 'payments',
      'appointments', 'classes', 'equipment', 'finance', 'reports', 'attendance',
      'calendar', 'notifications', 'content', 'hr'
    ]
  },
  {
    name: 'Front Desk Staff',
    description: 'Front desk operations - member check-in, payments, appointments',
    type: 'position',
    level: 40,
    color: '#10b981',
    isSystem: true,
    allowedDepartments: ['Front Desk', 'Reception'],
    permissions: [
      'members', 'packages', 'payments', 'appointments', 'attendance', 'calendar'
    ]
  },
  {
    name: 'Finance Staff',
    description: 'Finance department - payments, invoices, expenses, reports',
    type: 'department',
    level: 50,
    color: '#f59e0b',
    isSystem: true,
    allowedDepartments: ['Finance'],
    permissions: [
      'finance', 'payments', 'reports'
    ]
  },
  {
    name: 'HR Staff',
    description: 'Human resources - staff management, leave, payroll, performance',
    type: 'department',
    level: 60,
    color: '#8b5cf6',
    isSystem: true,
    allowedDepartments: ['Human Resources', 'HR'],
    permissions: [
      'staff', 'hr', 'attendance'
    ]
  },
  {
    name: 'Maintenance Staff',
    description: 'Equipment and facility maintenance',
    type: 'position',
    level: 30,
    color: '#6b7280',
    isSystem: true,
    allowedDepartments: ['Maintenance'],
    permissions: [
      'equipment'
    ]
  },
  {
    name: 'Trainer',
    description: 'Fitness trainers - manage sessions, members, programs',
    type: 'position',
    level: 45,
    color: '#ec4899',
    isSystem: true,
    permissions: [
      'trainers', 'members', 'appointments', 'classes', 'calendar'
    ]
  },
  {
    name: 'Marketing Staff',
    description: 'Marketing and content management',
    type: 'department',
    level: 40,
    color: '#14b8a6',
    isSystem: true,
    allowedDepartments: ['Marketing'],
    permissions: [
      'content'
    ]
  },
  {
    name: 'Security Staff',
    description: 'Security and access control',
    type: 'position',
    level: 25,
    color: '#f97316',
    isSystem: true,
    allowedDepartments: ['Security'],
    permissions: [
      'members', 'attendance', 'dashboard'
    ]
  },
  {
    name: 'Cleaning Staff',
    description: 'Facility cleaning and maintenance',
    type: 'position',
    level: 20,
    color: '#84cc16',
    isSystem: true,
    allowedDepartments: ['Cleaning'],
    permissions: [
      'dashboard:view'
    ]
  }
];

async function seedPermissions() {
  console.log('🌱 Seeding permissions...');
  
  const createdPermissions = [];
  
  for (const permData of defaultPermissions) {
    const slug = permData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const existingPermission = await Permission.findOne({ slug });
    
    if (!existingPermission) {
      const permission = new Permission({
        ...permData,
        slug,
        isSystem: true,
        isActive: true
      });
      
      await permission.save();
      createdPermissions.push(permission);
      console.log(`  ✓ Created permission: ${permission.name}`);
    } else {
      console.log(`  - Permission already exists: ${permData.name}`);
      createdPermissions.push(existingPermission);
    }
  }
  
  console.log(`✅ Created ${createdPermissions.length} permissions\n`);
  return createdPermissions;
}

async function seedRoles(permissions) {
  console.log('🌱 Seeding roles...');
  
  // Create permission slug map for quick lookup
  const permissionMap = new Map();
  permissions.forEach(p => {
    const key = `${p.category}:${p.resource}:${p.action}`;
    permissionMap.set(key, p._id);
    
    // Also map by category
    if (!permissionMap.has(p.category)) {
      permissionMap.set(p.category, []);
    }
    permissionMap.get(p.category).push(p._id);
  });
  
  const createdRoles = [];
  
  for (const roleData of defaultRoles) {
    const slug = roleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const existingRole = await Role.findOne({ slug });
    
    if (existingRole) {
      console.log(`  - Role already exists: ${roleData.name}`);
      createdRoles.push(existingRole);
      continue;
    }
    
    // Resolve permissions
    let rolePermissions = [];
    
    if (roleData.name === 'Super Admin') {
      // Super Admin gets all permissions
      rolePermissions = permissions.map(p => p._id);
    } else if (Array.isArray(roleData.permissions)) {
      // Resolve permissions by category or specific permission
      for (const permRef of roleData.permissions) {
        if (permRef.includes(':')) {
          // Specific permission like 'members:read' or 'members:members:read'
          const parts = permRef.split(':');
          if (parts.length === 2) {
            // Format: category:action (e.g., 'members:read')
            const [category, action] = parts;
            const categoryPerms = permissions.filter(p => 
              p.category === category && p.action === action
            );
            rolePermissions.push(...categoryPerms.map(p => p._id));
          } else if (parts.length === 3) {
            // Format: category:resource:action (e.g., 'members:members:read')
            const [category, resource, action] = parts;
            const key = `${category}:${resource}:${action}`;
            const permId = permissionMap.get(key);
            if (permId) rolePermissions.push(permId);
          }
        } else {
          // Category like 'members' - get all permissions in that category
          const categoryPerms = permissions.filter(p => p.category === permRef);
          rolePermissions.push(...categoryPerms.map(p => p._id));
        }
      }
    }
    
    // Remove duplicates
    rolePermissions = [...new Set(rolePermissions)];
    
    const role = new Role({
      name: roleData.name,
      slug,
      description: roleData.description,
      type: roleData.type,
      level: roleData.level,
      color: roleData.color,
      isSystem: roleData.isSystem,
      isActive: true,
      permissions: rolePermissions,
      allowedDepartments: roleData.allowedDepartments || [],
      allowedPositions: roleData.allowedPositions || [],
      displayOrder: defaultRoles.indexOf(roleData)
    });
    
    await role.save();
    createdRoles.push(role);
    console.log(`  ✓ Created role: ${role.name} with ${rolePermissions.length} permissions`);
  }
  
  console.log(`✅ Created ${createdRoles.length} roles\n`);
  return createdRoles;
}

async function seed() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hypgymdubaiii';
    
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Seed permissions first
    const permissions = await seedPermissions();
    
    // Seed roles with permissions
    const roles = await seedRoles(permissions);
    
    console.log('✅ Seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Permissions: ${permissions.length}`);
    console.log(`   - Roles: ${roles.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding roles and permissions:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seed();
}

module.exports = { seed, seedPermissions, seedRoles };

