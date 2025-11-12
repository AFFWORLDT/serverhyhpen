const mongoose = require('mongoose');
require('dotenv').config();
const SMTPSettings = require('./models/SMTPSettings');
const User = require('./models/User');

// Zoho Mail SMTP Configuration
const zohoConfig = {
  host: 'smtp.zoho.com',
  port: 587,
  secure: false, // Port 587 uses STARTTLS, not SSL
  username: 'train@hyphendxb.ae',
  password: '$Dubai@2025#',
  fromEmail: 'train@hyphendxb.ae',
  fromName: 'Hyphen Wellness',
  testEmail: 'train@hyphendxb.ae'
};

// Enhanced Email Templates
const emailTemplates = {
  welcome: {
    subject: 'Welcome to Hyphen Wellness!',
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏋️ Welcome to Hyphen Wellness!</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>Welcome to Hyphen Wellness! We're excited to have you join our fitness community.</p>
            <p>Your account has been successfully created. Here are your account details:</p>
            <ul>
              <li><strong>Email:</strong> {{email}}</li>
              <li><strong>Member ID:</strong> {{memberId}}</li>
            </ul>
            <p>You can now access your dashboard and start your fitness journey with us.</p>
            <a href="{{loginUrl}}" class="button">Login to Dashboard</a>
            <p>If you have any questions, feel free to contact us.</p>
            <p>Best regards,<br>Hyphen Wellness Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  classReminder: {
    subject: 'Class Reminder - {{className}}',
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f5576c; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Class Reminder</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>This is a friendly reminder about your upcoming class:</p>
            <div class="info-box">
              <h3>{{className}}</h3>
              <p><strong>Date & Time:</strong> {{startTime}}</p>
              <p><strong>Duration:</strong> {{duration}} minutes</p>
              <p><strong>Trainer:</strong> {{trainerName}}</p>
              <p><strong>Location:</strong> {{location}}</p>
            </div>
            <p>We look forward to seeing you!</p>
            <p>Best regards,<br>Hyphen Wellness Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  attendanceNotification: {
    subject: 'Attendance Update - {{eventTitle}}',
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
          .status.present { background: #10b981; color: white; }
          .status.absent { background: #ef4444; color: white; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Attendance Notification</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>Your attendance has been updated for:</p>
            <h3>{{eventTitle}}</h3>
            <p>Status: <span class="status {{status}}">{{status}}</span></p>
            <p>Date: {{date}}</p>
            <p>Thank you for being part of Hyphen Wellness!</p>
            <p>Best regards,<br>Hyphen Wellness Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  passwordReset: {
    subject: 'Password Reset Request - Hyphen Wellness',
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #fa709a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>We received a request to reset your password for your Hyphen Wellness account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="{{resetLink}}" class="button">Reset Password</a>
            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong></p>
              <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">{{resetLink}}</p>
            <p>Best regards,<br>Hyphen Wellness Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  appointmentReminder: {
    subject: 'Appointment Reminder - {{appointmentType}}',
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #a8edea; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Appointment Reminder</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>This is a reminder about your upcoming appointment:</p>
            <div class="info-box">
              <h3>{{appointmentType}}</h3>
              <p><strong>Date & Time:</strong> {{dateTime}}</p>
              <p><strong>Trainer:</strong> {{trainerName}}</p>
              <p><strong>Duration:</strong> {{duration}} minutes</p>
            </div>
            <p>Please arrive 10 minutes early for check-in.</p>
            <p>Best regards,<br>Hyphen Wellness Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  membershipRenewal: {
    subject: 'Membership Renewal Reminder - Hyphen Wellness',
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #fcb69f; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #fcb69f; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Membership Renewal</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>Your membership is set to expire soon. Here are the details:</p>
            <div class="info-box">
              <p><strong>Current Plan:</strong> {{planName}}</p>
              <p><strong>Expiry Date:</strong> {{expiryDate}}</p>
              <p><strong>Days Remaining:</strong> {{daysRemaining}} days</p>
            </div>
            <p>Renew now to continue enjoying all our facilities and services!</p>
            <a href="{{renewalUrl}}" class="button">Renew Membership</a>
            <p>Best regards,<br>Hyphen Wellness Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

async function configureZohoSMTPSettings() {
  try {
    // Connect to MongoDB - use the same connection as server
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find an admin user to use as creator
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating SMTP settings without creator reference.');
    }

    // Deactivate existing SMTP settings
    await SMTPSettings.updateMany({ isActive: true }, { isActive: false });
    console.log('✅ Deactivated existing SMTP settings');

    // Create new SMTP settings
    const smtpSettings = new SMTPSettings({
      ...zohoConfig,
      emailTemplates: emailTemplates,
      createdBy: adminUser ? adminUser._id : null,
      updatedBy: adminUser ? adminUser._id : null
    });

    await smtpSettings.save();
    console.log('✅ SMTP settings saved successfully');

    // Test the connection
    console.log('\n🔍 Testing SMTP connection...');
    const testResult = await smtpSettings.testConnection();
    
    if (testResult.success) {
      console.log('✅ SMTP connection test successful!');
      console.log('📧 Test email sent to:', zohoConfig.testEmail);
    } else {
      console.log('❌ SMTP connection test failed:', testResult.message);
    }

    // Display configuration
    console.log('\n📋 SMTP Configuration:');
    console.log('Host:', zohoConfig.host);
    console.log('Port:', zohoConfig.port);
    console.log('Secure:', zohoConfig.secure);
    console.log('Username:', zohoConfig.username);
    console.log('From Email:', zohoConfig.fromEmail);
    console.log('From Name:', zohoConfig.fromName);
    console.log('\n📧 Email Templates Configured:');
    console.log('- Welcome');
    console.log('- Class Reminder');
    console.log('- Attendance Notification');
    console.log('- Password Reset');
    console.log('- Appointment Reminder');
    console.log('- Membership Renewal');

    console.log('\n✅ Zoho SMTP configuration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error configuring SMTP:', error);
    process.exit(1);
  }
}

// Run the configuration
configureZohoSMTPSettings();

