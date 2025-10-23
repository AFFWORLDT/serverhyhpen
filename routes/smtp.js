const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const SMTPSettings = require('../models/SMTPSettings');

// Get SMTP settings
router.get('/', auth, async (req, res) => {
  try {
    // Only admin can access SMTP settings
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const settings = await SMTPSettings.findOne({ isActive: true })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get SMTP settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMTP settings'
    });
  }
});

// Create or update SMTP settings
router.post('/', auth, [
  body('host').notEmpty().withMessage('SMTP host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Valid port number is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('fromEmail').isEmail().withMessage('Valid from email is required'),
  body('fromName').notEmpty().withMessage('From name is required')
], async (req, res) => {
  try {
    // Only admin can create/update SMTP settings
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      host,
      port,
      secure,
      username,
      password,
      fromEmail,
      fromName,
      testEmail,
      emailTemplates
    } = req.body;

    // Deactivate existing settings
    await SMTPSettings.updateMany({ isActive: true }, { isActive: false });

    // Create new settings
    const settings = new SMTPSettings({
      host,
      port,
      secure: secure || false,
      username,
      password,
      fromEmail,
      fromName,
      testEmail,
      emailTemplates: emailTemplates || {},
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await settings.save();

    res.status(201).json({
      success: true,
      message: 'SMTP settings saved successfully',
      data: settings
    });
  } catch (error) {
    console.error('Create SMTP settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save SMTP settings'
    });
  }
});

// Test SMTP connection
router.post('/test', auth, [
  body('testEmail').optional().isEmail().withMessage('Valid test email is required')
], async (req, res) => {
  try {
    // Only admin can test SMTP settings
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { testEmail } = req.body;

    const settings = await SMTPSettings.findOne({ isActive: true });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active SMTP settings found'
      });
    }

    // Update test email if provided
    if (testEmail) {
      settings.testEmail = testEmail;
      await settings.save();
    }

    // Test the connection
    const result = await settings.testConnection();

    res.json({
      success: result.success,
      message: result.message,
      data: {
        testStatus: settings.testStatus,
        testMessage: settings.testMessage,
        lastTested: settings.lastTested
      }
    });
  } catch (error) {
    console.error('Test SMTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test SMTP connection'
    });
  }
});

// Send test email
router.post('/send-test', auth, [
  body('to').isEmail().withMessage('Valid recipient email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('html').notEmpty().withMessage('Email content is required')
], async (req, res) => {
  try {
    // Only admin can send test emails
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { to, subject, html, attachments } = req.body;

    const settings = await SMTPSettings.findOne({ isActive: true });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active SMTP settings found'
      });
    }

    const result = await settings.sendEmail(to, subject, html, attachments);

    res.json({
      success: result.success,
      message: result.message,
      data: result.messageId ? { messageId: result.messageId } : null
    });
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
});

// Update email templates
router.put('/templates', auth, [
  body('templates').isObject().withMessage('Templates object is required')
], async (req, res) => {
  try {
    // Only admin can update email templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { templates } = req.body;

    const settings = await SMTPSettings.findOne({ isActive: true });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active SMTP settings found'
      });
    }

    settings.emailTemplates = { ...settings.emailTemplates, ...templates };
    settings.updatedBy = req.user.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Email templates updated successfully',
      data: settings.emailTemplates
    });
  } catch (error) {
    console.error('Update email templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email templates'
    });
  }
});

// Send notification email
router.post('/send-notification', auth, [
  body('recipients').isArray().withMessage('Recipients array is required'),
  body('templateType').isIn(['welcome', 'classReminder', 'attendanceNotification', 'passwordReset']).withMessage('Invalid template type'),
  body('data').isObject().withMessage('Template data object is required')
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

    const { recipients, templateType, data, customSubject, customHtml } = req.body;

    const settings = await SMTPSettings.findOne({ isActive: true });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active SMTP settings found'
      });
    }

    let subject, html;

    if (customSubject && customHtml) {
      subject = customSubject;
      html = customHtml;
    } else {
      const template = settings.emailTemplates[templateType];
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'Template not found'
        });
      }

      subject = template.subject;
      html = template.template;

      // Replace template variables
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, data[key]);
        html = html.replace(regex, data[key]);
      });
    }

    const result = await settings.sendEmail(recipients, subject, html);

    res.json({
      success: result.success,
      message: result.message,
      data: result.messageId ? { messageId: result.messageId } : null
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification email'
    });
  }
});

// Get email templates
router.get('/templates', auth, async (req, res) => {
  try {
    // Only admin can access email templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const settings = await SMTPSettings.findOne({ isActive: true });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active SMTP settings found'
      });
    }

    res.json({
      success: true,
      data: settings.emailTemplates
    });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates'
    });
  }
});

module.exports = router;
