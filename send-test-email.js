const mongoose = require('mongoose');
require('dotenv').config();
const SMTPSettings = require('./models/SMTPSettings');

// MongoDB connection string
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

async function sendTestEmail() {
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

    console.log('\n📧 SMTP Configuration Found:');
    console.log('Host:', settings.host);
    console.log('Port:', settings.port);
    console.log('From Email:', settings.fromEmail);
    console.log('From Name:', settings.fromName);

    // Test email details
    const testEmail = process.argv[2] || settings.testEmail || 'train@hyphendxb.ae';
    
    console.log('\n📬 Sending test email to:', testEmail);

    // Create a beautiful test email
    const testEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .success-badge { display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Test Email from Hyphen Wellness</h1>
            <p>SMTP Configuration Successful!</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is a test email from your Hyphen Wellness system. Your Zoho Mail SMTP configuration is working correctly!</p>
            
            <div class="info-box">
              <h3>✅ Email Configuration Status</h3>
              <p><strong>SMTP Server:</strong> ${settings.host}</p>
              <p><strong>Port:</strong> ${settings.port}</p>
              <p><strong>From Email:</strong> ${settings.fromEmail}</p>
              <p><strong>From Name:</strong> ${settings.fromName}</p>
              <p><strong>Status:</strong> <span class="success-badge">✅ Active</span></p>
            </div>

            <p>If you received this email, it means:</p>
            <ul>
              <li>✅ SMTP connection is working</li>
              <li>✅ Email authentication is successful</li>
              <li>✅ Email templates are ready to use</li>
              <li>✅ Your system can send emails</li>
            </ul>

            <p>You can now use the following email templates in your application:</p>
            <ul>
              <li>📧 Welcome Email</li>
              <li>📅 Class Reminder</li>
              <li>✅ Attendance Notification</li>
              <li>🔐 Password Reset</li>
              <li>⏰ Appointment Reminder</li>
              <li>🔄 Membership Renewal</li>
            </ul>

            <p><strong>Test Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}</p>
            
            <p>Best regards,<br><strong>Hyphen Wellness Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Hyphen Wellness. All rights reserved.</p>
            <p>This is an automated test email from your gym management system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send test email
    const result = await settings.sendEmail(
      testEmail,
      '✅ Test Email - Hyphen Wellness SMTP Configuration',
      testEmailHtml
    );

    if (result.success) {
      console.log('\n✅ Test email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📬 Recipient:', testEmail);
      console.log('\n📝 Please check your inbox (and spam folder) for the test email.');
    } else {
      console.error('\n❌ Failed to send test email:', result.message);
      process.exit(1);
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error sending test email:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the function
sendTestEmail();

