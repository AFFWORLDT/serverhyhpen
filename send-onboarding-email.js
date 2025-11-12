const mongoose = require('mongoose');
require('dotenv').config();
const SMTPSettings = require('./models/SMTPSettings');

// MongoDB connection string
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

async function sendOnboardingEmail() {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get active SMTP settings
    const settings = await SMTPSettings.findOne({ isActive: true });
    
    if (!settings) {
      console.error('❌ No active SMTP settings found. Please configure SMTP first.');
      process.exit(1);
    }

    console.log('\n📧 SMTP Configuration:');
    console.log('Host:', settings.host);
    console.log('From Email:', settings.fromEmail);
    console.log('From Name:', settings.fromName);

    // Test user details
    const testUser = {
      firstName: 'Rahul',
      lastName: 'Saraswat',
      email: 'rahulsarswat57@gmail.com',
      phone: '+971501234567',
      role: 'member',
      _id: 'TEST_USER_' + Date.now()
    };

    console.log('\n📬 Sending onboarding emails...\n');

    // 1. Send Welcome Email to the new user
    console.log('1️⃣ Sending welcome email to:', testUser.email);
    if (settings.emailTemplates?.welcome) {
      const welcomeTemplate = settings.emailTemplates.welcome;
      let emailSubject = welcomeTemplate.subject || 'Welcome to Hyphen Wellness!';
      let emailHtml = welcomeTemplate.template || '';

      // Replace template variables
      emailSubject = emailSubject.replace(/{{firstName}}/g, testUser.firstName);
      emailSubject = emailSubject.replace(/{{lastName}}/g, testUser.lastName);
      emailSubject = emailSubject.replace(/{{email}}/g, testUser.email);
      emailSubject = emailSubject.replace(/{{memberId}}/g, testUser._id);
      emailSubject = emailSubject.replace(/{{loginUrl}}/g, 'http://localhost:3000/login');

      emailHtml = emailHtml.replace(/{{firstName}}/g, testUser.firstName);
      emailHtml = emailHtml.replace(/{{lastName}}/g, testUser.lastName);
      emailHtml = emailHtml.replace(/{{email}}/g, testUser.email);
      emailHtml = emailHtml.replace(/{{memberId}}/g, testUser._id);
      emailHtml = emailHtml.replace(/{{loginUrl}}/g, 'http://localhost:3000/login');

      const welcomeResult = await settings.sendEmail(testUser.email, emailSubject, emailHtml);
      if (welcomeResult.success) {
        console.log('   ✅ Welcome email sent successfully!');
        console.log('   📧 Message ID:', welcomeResult.messageId);
      } else {
        console.log('   ❌ Failed to send welcome email:', welcomeResult.message);
      }
    } else {
      console.log('   ⚠️  Welcome template not found, skipping...');
    }

    // 2. Send Notification Email to Admin
    console.log('\n2️⃣ Sending registration notification to: rahulsarswat57@gmail.com');
    
    const notificationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
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
              <p><strong>Name:</strong> ${testUser.firstName} ${testUser.lastName}</p>
              <p><strong>Email:</strong> ${testUser.email}</p>
              <p><strong>Phone:</strong> ${testUser.phone}</p>
              <p><strong>Role:</strong> <span class="badge ${testUser.role}">${testUser.role}</span></p>
              <p><strong>Member ID:</strong> ${testUser._id}</p>
              <p><strong>Registration Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}</p>
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

    const notificationResult = await settings.sendEmail(
      'rahulsarswat57@gmail.com',
      `New User Registration - ${testUser.firstName} ${testUser.lastName} - Hyphen Wellness`,
      notificationHtml
    );

    if (notificationResult.success) {
      console.log('   ✅ Registration notification sent successfully!');
      console.log('   📧 Message ID:', notificationResult.messageId);
    } else {
      console.log('   ❌ Failed to send notification:', notificationResult.message);
    }

    console.log('\n✅ Onboarding emails sent successfully!');
    console.log('\n📬 Emails sent to:');
    console.log('   1. Welcome email →', testUser.email);
    console.log('   2. Registration notification → rahulsarswat57@gmail.com');
    console.log('\n📝 Please check both inboxes (and spam folders) for the emails.');

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error sending onboarding emails:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the function
sendOnboardingEmail();

