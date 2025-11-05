const mongoose = require('mongoose');

const smtpSettingsSchema = new mongoose.Schema({
  host: {
    type: String,
    required: true,
    trim: true
  },
  port: {
    type: Number,
    required: true,
    default: 587
  },
  secure: {
    type: Boolean,
    default: false
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  fromEmail: {
    type: String,
    required: true,
    trim: true
  },
  fromName: {
    type: String,
    required: true,
    trim: true,
    default: 'Hyphen Gym'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  testEmail: {
    type: String,
    trim: true
  },
  lastTested: {
    type: Date
  },
  testStatus: {
    type: String,
    enum: ['success', 'failed', 'not_tested'],
    default: 'not_tested'
  },
  testMessage: {
    type: String,
    trim: true
  },
  emailTemplates: {
    welcome: {
      subject: {
        type: String,
        default: 'Welcome to Hyphen!'
      },
      template: {
        type: String,
        default: 'Welcome {{firstName}}, your account has been created successfully!'
      }
    },
    classReminder: {
      subject: {
        type: String,
        default: 'Class Reminder - {{className}}'
      },
      template: {
        type: String,
        default: 'Reminder: You have a class "{{className}}" scheduled for {{startTime}}'
      }
    },
    attendanceNotification: {
      subject: {
        type: String,
        default: 'Attendance Update - {{eventTitle}}'
      },
      template: {
        type: String,
        default: 'Your attendance for "{{eventTitle}}" has been marked as {{status}}'
      }
    },
    passwordReset: {
      subject: {
        type: String,
        default: 'Password Reset Request'
      },
      template: {
        type: String,
        default: 'Click here to reset your password: {{resetLink}}'
      }
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for single SMTP settings (only one active configuration)
smtpSettingsSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

// Method to test SMTP connection
smtpSettingsSchema.methods.testConnection = async function() {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.username,
        pass: this.password
      }
    });

    // Verify connection
    await transporter.verify();
    
    // Send test email if test email is provided
    if (this.testEmail) {
      await transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: this.testEmail,
        subject: 'SMTP Test Email',
        html: '<p>This is a test email from Hyphen SMTP configuration.</p>'
      });
    }

    this.testStatus = 'success';
    this.testMessage = 'SMTP connection successful';
    this.lastTested = new Date();
    
    return { success: true, message: 'SMTP connection successful' };
  } catch (error) {
    this.testStatus = 'failed';
    this.testMessage = error.message;
    this.lastTested = new Date();
    
    return { success: false, message: error.message };
  }
};

// Method to send email using this configuration
smtpSettingsSchema.methods.sendEmail = async function(to, subject, html, attachments = []) {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.username,
        pass: this.password
      }
    });

    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      attachments: attachments
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = mongoose.model('SMTPSettings', smtpSettingsSchema);
