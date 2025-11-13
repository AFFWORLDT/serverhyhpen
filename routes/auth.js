const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();
const SMTPSettings = require('../models/SMTPSettings');
const Email = require('../utils/email');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'hypgym_dubai_secret_key_2024_secure_random_string';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *               - role
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 example: John
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phone:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 15
 *                 example: +971501234567
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [admin, member, trainer, staff]
 *                 example: member
 *               specialization:
 *                 type: string
 *                 description: Required for trainer role
 *                 example: Strength Training
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Validation error or user already exists
 *         $ref: '#/components/responses/ValidationError'
 */
// Register new user
router.post('/register', [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10-15 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'member', 'trainer', 'staff']).withMessage('Please select a valid role')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, phone, password, role, specialization, department } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const userData = {
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      isActive: true,
      // Creation tracking
      creationMethod: 'self_registration'
    };

    // Add role-specific fields
    if (role === 'trainer' && specialization) {
      userData.specialization = specialization;
    }
    if (role === 'staff' && department) {
      userData.department = department;
    }

    const user = new User(userData);
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send welcome email to member and notify admin
    try {
      // Send welcome email to the newly registered user using SMTP templates
      const smtpSettings = await SMTPSettings.findOne({ isActive: true });
      if (smtpSettings && smtpSettings.emailTemplates?.welcome) {
        const welcomeTemplate = smtpSettings.emailTemplates.welcome;
        let emailSubject = welcomeTemplate.subject || 'Welcome to Hyphen Wellness!';
        let emailHtml = welcomeTemplate.template || '';

        // Replace template variables
        emailSubject = emailSubject.replace(/{{firstName}}/g, user.firstName);
        emailSubject = emailSubject.replace(/{{lastName}}/g, user.lastName);
        emailSubject = emailSubject.replace(/{{email}}/g, user.email);
        emailSubject = emailSubject.replace(/{{memberId}}/g, user._id.toString());
        emailSubject = emailSubject.replace(/{{loginUrl}}/g, 'http://localhost:3000/login');

        emailHtml = emailHtml.replace(/{{firstName}}/g, user.firstName);
        emailHtml = emailHtml.replace(/{{lastName}}/g, user.lastName);
        emailHtml = emailHtml.replace(/{{email}}/g, user.email);
        emailHtml = emailHtml.replace(/{{memberId}}/g, user._id.toString());
        emailHtml = emailHtml.replace(/{{loginUrl}}/g, 'http://localhost:3000/login');

        // Send welcome email to the new user
        await smtpSettings.sendEmail(user.email, emailSubject, emailHtml);
        console.log(`✅ Onboarding email sent to ${user.email}`);
      } else {
        // Fallback to old template if SMTP templates not available
        const memberHtml = Email.templates.welcomeMemberTemplate({ firstName });
        await Email.sendEmail({ to: email, subject: 'Welcome to Hyphen Wellness', html: memberHtml });
      }

      // Send notification email to admin (rahulsasrwat57@gmail.com) about new registration
      const notificationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
            .badge { display: inline-block; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; margin: 5px 0; }
            .badge.member { background: #10b981; color: white; }
            .badge.trainer { background: #3b82f6; color: white; }
            .badge.staff { background: #8b5cf6; color: white; }
            .badge.admin { background: #ef4444; color: white; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New User Registration</h1>
              <p>Hyphen Wellness</p>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p>A new user has successfully registered on Hyphen Wellness!</p>
              <div class="info-box">
                <h3>Registration Details</h3>
                <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Phone:</strong> ${user.phone}</p>
                <p><strong>Role:</strong> <span class="badge ${user.role}">${user.role}</span></p>
                <p><strong>Member ID:</strong> ${user._id}</p>
                <p><strong>Registration Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}</p>
                ${user.specialization ? `<p><strong>Specialization:</strong> ${user.specialization}</p>` : ''}
              </div>
              <p>Please review the new registration in your admin dashboard.</p>
              <a href="http://localhost:3000/dashboard" class="button">View Dashboard</a>
              <p>Best regards,<br><strong>Hyphen Wellness System</strong></p>
            </div>
            <div class="footer">
              <p>© 2024 Hyphen Wellness. All rights reserved.</p>
              <p>This is an automated notification from your gym management system.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (smtpSettings) {
        await smtpSettings.sendEmail(
          'rahulsarswat57@gmail.com',
          `New User Registration - ${user.firstName} ${user.lastName} - Hyphen Wellness`,
          notificationHtml
        );
        console.log('✅ Registration notification sent to rahulsarswat57@gmail.com');
      } else {
        // Fallback notification
        const notifyHtml = Email.templates.registrationNotificationTemplate({ firstName, lastName, email, role });
        await Email.sendEmail({ to: 'rahulsarswat57@gmail.com', subject: 'New Registration - Hyphen Wellness', html: notifyHtml });
      }
    } catch (e) {
      console.error('Registration email error:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// Admin: Create user (Admin only)
router.post('/admin/create-user', auth, [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10-15 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'member', 'trainer', 'staff']).withMessage('Please select a valid role')
], async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, phone, password, role, specialization, department, dateOfBirth, gender, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const userData = {
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      isActive: true
    };

    // Add optional fields
    if (dateOfBirth) userData.dateOfBirth = dateOfBirth;
    if (gender) userData.gender = gender;
    if (address) userData.address = address;
    if (role === 'trainer' && specialization) {
      userData.specialization = specialization;
    }
    if (role === 'staff' && department) {
      userData.department = department;
    }

    const user = new User(userData);
    await user.save();

    // Send welcome and internal notification emails
    try {
      const smtpSettings = await SMTPSettings.findOne({ isActive: true });
      const Email = require('../utils/email');
      
      // Send role-specific account creation emails
      if (role === 'trainer') {
        // Send trainer account creation email
        if (smtpSettings) {
          const emailHtml = Email.templates.trainerAccountCreatedTemplate({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: password,
            specialization: user.specialization,
            hourlyRate: user.hourlyRate,
            loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000/login',
            createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim()
          });
          
          await smtpSettings.sendEmail(
            user.email,
            `Welcome to Hyphen Wellness Trainer Team, ${user.firstName}!`,
            emailHtml
          );
        } else {
          const emailHtml = Email.templates.trainerAccountCreatedTemplate({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: password,
            specialization: user.specialization,
            hourlyRate: user.hourlyRate,
            loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000/login',
            createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim()
          });
          
          await Email.sendEmail({
            to: user.email,
            subject: `Welcome to Hyphen Wellness Trainer Team, ${user.firstName}!`,
            html: emailHtml
          });
        }
        console.log(`✅ Trainer account creation email sent to ${user.email}`);
      } else if (role === 'staff') {
        // Send staff account creation email
        if (smtpSettings) {
          const emailHtml = Email.templates.staffAccountCreatedTemplate({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: password,
            position: user.position,
            department: user.department,
            employeeId: user.employeeId,
            loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000/login',
            createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim()
          });
          
          await smtpSettings.sendEmail(
            user.email,
            `Welcome to Hyphen Wellness Staff Team, ${user.firstName}!`,
            emailHtml
          );
        } else {
          const emailHtml = Email.templates.staffAccountCreatedTemplate({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: password,
            position: user.position,
            department: user.department,
            employeeId: user.employeeId,
            loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000/login',
            createdByName: `${req.user.firstName || 'Admin'} ${req.user.lastName || ''}`.trim()
          });
          
          await Email.sendEmail({
            to: user.email,
            subject: `Welcome to Hyphen Wellness Staff Team, ${user.firstName}!`,
            html: emailHtml
          });
        }
        console.log(`✅ Staff account creation email sent to ${user.email}`);
      } else {
        // Send member welcome email for other roles
        if (smtpSettings && smtpSettings.emailTemplates?.welcome) {
          const welcomeTemplate = smtpSettings.emailTemplates.welcome;
          let emailSubject = welcomeTemplate.subject || 'Welcome to Hyphen Wellness!';
          let emailHtml = welcomeTemplate.template || '';

          // Replace template variables
          emailSubject = emailSubject.replace(/{{firstName}}/g, user.firstName);
          emailSubject = emailSubject.replace(/{{lastName}}/g, user.lastName);
          emailSubject = emailSubject.replace(/{{email}}/g, user.email);
          emailSubject = emailSubject.replace(/{{memberId}}/g, user._id.toString());
          emailSubject = emailSubject.replace(/{{loginUrl}}/g, 'http://localhost:3000/login');

          emailHtml = emailHtml.replace(/{{firstName}}/g, user.firstName);
          emailHtml = emailHtml.replace(/{{lastName}}/g, user.lastName);
          emailHtml = emailHtml.replace(/{{email}}/g, user.email);
          emailHtml = emailHtml.replace(/{{memberId}}/g, user._id.toString());
          emailHtml = emailHtml.replace(/{{loginUrl}}/g, 'http://localhost:3000/login');

          // Send welcome email to the new user
          await smtpSettings.sendEmail(user.email, emailSubject, emailHtml);
          console.log(`✅ Onboarding email sent to ${user.email}`);
        } else {
          // Fallback to old template if SMTP templates not available
          const memberHtml = Email.templates.welcomeMemberTemplate({ firstName });
          await Email.sendEmail({ to: email, subject: 'Welcome to Hyphen Wellness', html: memberHtml });
        }
      }

      // Send notification email to admin (rahulsasrwat57@gmail.com) about new user creation
      const notificationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
            .badge { display: inline-block; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; margin: 5px 0; }
            .badge.member { background: #10b981; color: white; }
            .badge.trainer { background: #3b82f6; color: white; }
            .badge.staff { background: #8b5cf6; color: white; }
            .badge.admin { background: #ef4444; color: white; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👤 New User Created</h1>
              <p>Hyphen Wellness</p>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p>A new user has been created by admin on Hyphen Wellness!</p>
              <div class="info-box">
                <h3>User Details</h3>
                <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Phone:</strong> ${user.phone}</p>
                <p><strong>Role:</strong> <span class="badge ${user.role}">${user.role}</span></p>
                <p><strong>User ID:</strong> ${user._id}</p>
                <p><strong>Created Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}</p>
                ${user.specialization ? `<p><strong>Specialization:</strong> ${user.specialization}</p>` : ''}
                ${user.department ? `<p><strong>Department:</strong> ${user.department}</p>` : ''}
              </div>
              <p>Please review the new user in your admin dashboard.</p>
              <a href="http://localhost:3000/dashboard" class="button">View Dashboard</a>
              <p>Best regards,<br><strong>Hyphen Wellness System</strong></p>
            </div>
            <div class="footer">
              <p>© 2024 Hyphen Wellness. All rights reserved.</p>
              <p>This is an automated notification from your gym management system.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (smtpSettings) {
        await smtpSettings.sendEmail(
          'rahulsarswat57@gmail.com',
          `New User Created - ${user.firstName} ${user.lastName} - Hyphen Wellness`,
          notificationHtml
        );
        console.log('✅ User creation notification sent to rahulsarswat57@gmail.com');
      } else {
        // Fallback notification
        const notifyHtml = Email.templates.registrationNotificationTemplate({ firstName, lastName, email, role });
        await Email.sendEmail({ to: 'rahulsarswat57@gmail.com', subject: 'New User Created - Hyphen Wellness', html: notifyHtml });
      }
    } catch (e) {
      console.error('Admin create user email error:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          specialization: user.specialization,
          department: user.department,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Admin user creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user creation',
      error: error.message
    });
  }
});

// Login user
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@hyphen.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIs...
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact admin.'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          profileImage: user.profileImage,
          lastLogin: user.lastLogin,
          // Include staff-specific fields for sub-role handling
          department: user.department,
          position: user.position,
          employeeId: user.employeeId,
          workSchedule: user.workSchedule
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Provide more specific error messages
    let errorMessage = 'Server error during login';
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      errorMessage = 'Database connection error. Please try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure profileImage is included in response (even if null)
    const userData = user.toObject();
    if (userData.profileImage === undefined) {
      userData.profileImage = null;
    }

    // Ensure user object has both _id and id for compatibility
    const responseUser = {
      ...userData,
      id: userData._id, // Add id field for compatibility with login response
      userId: userData._id // Add userId field for compatibility
    };

    res.json({
      success: true,
      data: { user: responseUser }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('phone').optional().isMobilePhone(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('profileImage').optional().isString(),
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'address', 'emergencyContact', 'profileImage'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const oldUser = await User.findById(req.user.userId).select('-password');
    if (!oldUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Track changes for email
    const changes = [];
    Object.keys(updates).forEach(key => {
      if (oldUser[key] !== user[key]) {
        changes.push(`${key.charAt(0).toUpperCase() + key.slice(1)}`);
      }
    });

    // Send profile updated email
    if (changes.length > 0) {
      try {
        const html = Email.templates.profileUpdatedTemplate({
          firstName: user.firstName,
          changes: changes
        });
        await Email.sendEmail({
          to: user.email,
          subject: 'Profile Updated - Hyphen Wellness',
          html
        });
      } catch (e) {
        console.error('Profile update email error:', e.message);
      }
    }

    // Ensure profileImage is included in response (even if null)
    const userData = user.toObject();
    if (userData.profileImage === undefined) {
      userData.profileImage = null;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: userData }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send password changed email
    try {
      const html = Email.templates.passwordChangedTemplate({
        firstName: user.firstName,
        changedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }),
        ipAddress: req.ip || req.connection.remoteAddress
      });
      await Email.sendEmail({
        to: user.email,
        subject: 'Password Changed - Hyphen Wellness',
        html
      });
    } catch (e) {
      console.error('Password changed email error:', e.message);
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
});

// Update user role (for testing purposes)
router.put('/update-role/:id', async (req, res) => {
  try {
    const { role } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user role',
      error: error.message
    });
  }
});

// Forgot password - Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Don't reveal if user exists for security
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Send password reset email using SMTP templates if available
    try {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      
      // Try to use SMTP templates first
      const smtpSettings = await SMTPSettings.findOne({ isActive: true });
      
      if (smtpSettings && smtpSettings.emailTemplates?.passwordReset) {
        // Use SMTP template
        const passwordResetTemplate = smtpSettings.emailTemplates.passwordReset;
        let emailSubject = passwordResetTemplate.subject || 'Password Reset Request - Hyphen Wellness';
        let emailHtml = passwordResetTemplate.template || '';
        
        // Replace template variables
        emailSubject = emailSubject.replace(/{{firstName}}/g, user.firstName);
        emailSubject = emailSubject.replace(/{{email}}/g, user.email);
        emailSubject = emailSubject.replace(/{{resetLink}}/g, resetLink);
        emailSubject = emailSubject.replace(/{{expirationTime}}/g, '1 hour');
        
        emailHtml = emailHtml.replace(/{{firstName}}/g, user.firstName);
        emailHtml = emailHtml.replace(/{{email}}/g, user.email);
        emailHtml = emailHtml.replace(/{{resetLink}}/g, resetLink);
        emailHtml = emailHtml.replace(/{{expirationTime}}/g, '1 hour');
        
        // Send email via SMTP
        await smtpSettings.sendEmail(user.email, emailSubject, emailHtml);
        console.log(`✅ Password reset email sent to ${user.email} via SMTP`);
      } else {
        // Fallback to old template
        const html = Email.templates.passwordResetTemplate({
          firstName: user.firstName,
          resetLink,
          expirationTime: '1 hour'
        });
        await Email.sendEmail({
          to: user.email,
          subject: 'Password Reset Request - Hyphen Wellness',
          html
        });
        console.log(`✅ Password reset email sent to ${user.email} via fallback`);
      }
    } catch (e) {
      console.error('Password reset email error:', e.message);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing password reset request'
    });
  }
});

// Reset password - Reset password with token
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Send password changed email using SMTP templates if available
    try {
      const changeDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const changedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' });
      
      // Try to use SMTP templates first
      const smtpSettings = await SMTPSettings.findOne({ isActive: true });
      
      if (smtpSettings && smtpSettings.emailTemplates?.passwordReset) {
        // Use SMTP template (password changed notification)
        let emailSubject = 'Password Changed Successfully - Hyphen Wellness';
        let emailHtml = `Hi ${user.firstName},<br><br>Your password has been successfully changed on ${changeDate}.<br><br>If you did not make this change, please contact us immediately.<br><br>Best regards,<br>Hyphen Wellness Team`;
        
        // Send email via SMTP
        await smtpSettings.sendEmail(user.email, emailSubject, emailHtml);
        console.log(`✅ Password changed email sent to ${user.email} via SMTP`);
      } else {
        // Fallback to old template
        const html = Email.templates.passwordChangedTemplate({
          firstName: user.firstName,
          changedAt,
          ipAddress: req.ip || req.connection.remoteAddress
        });
        await Email.sendEmail({
          to: user.email,
          subject: 'Password Changed Successfully - Hyphen Wellness',
          html
        });
        console.log(`✅ Password changed email sent to ${user.email} via fallback`);
      }
    } catch (e) {
      console.error('Password changed email error:', e.message);
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password'
    });
  }
});

module.exports = router;
