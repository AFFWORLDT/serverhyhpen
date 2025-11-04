const SMTPSettings = require('../models/SMTPSettings');

// Enhanced base template with better styling and responsiveness
function buildBaseTemplate({ title, bodyHtml, headerColor = 'linear-gradient(135deg,#2563eb,#7c3aed)' }) {
  return `
  <!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          background: #f7fafc; 
          margin: 0; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', 'Arial', 'Noto Sans', sans-serif; 
          color: #1f2937; 
          line-height: 1.6;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        .card { 
          background: #ffffff; 
          border-radius: 12px; 
          border: 1px solid #e5e7eb; 
          overflow: hidden; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.07); 
        }
        .header { 
          background: ${headerColor}; 
          padding: 30px 24px; 
          color: #fff; 
          text-align: center;
        }
        .header h2 { margin: 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 8px 0 0; opacity: 0.95; font-size: 14px; }
        .content { padding: 32px 24px; }
        .footer { 
          padding: 20px 24px; 
          background: #f9fafb; 
          color: #6b7280; 
          font-size: 12px; 
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .btn { 
          display: inline-block; 
          padding: 14px 28px; 
          background: #2563eb; 
          color: #fff !important; 
          border-radius: 8px; 
          text-decoration: none; 
          font-weight: 600; 
          margin: 16px 0;
          transition: background 0.3s;
        }
        .btn:hover { background: #1d4ed8; }
        .btn-secondary { background: #6b7280; }
        .btn-success { background: #10b981; }
        .btn-warning { background: #f59e0b; }
        .btn-danger { background: #ef4444; }
        .info-box { 
          background: #f0f9ff; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #2563eb; 
        }
        .success-box { 
          background: #f0fdf4; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #10b981; 
        }
        .warning-box { 
          background: #fffbeb; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #f59e0b; 
        }
        .error-box { 
          background: #fef2f2; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #ef4444; 
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #6b7280; }
        .detail-value { color: #1f2937; font-weight: 500; }
        .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
        .muted { color: #6b7280; font-size: 14px; }
        .icon { font-size: 48px; text-align: center; margin: 20px 0; }
        h1 { margin: 0 0 16px; color: #1f2937; font-size: 24px; font-weight: 700; }
        h2 { margin: 0 0 12px; color: #1f2937; font-size: 20px; font-weight: 600; }
        h3 { margin: 0 0 8px; color: #1f2937; font-size: 18px; font-weight: 600; }
        p { margin: 12px 0; color: #374151; }
        ul { margin: 12px 0; padding-left: 24px; }
        li { margin: 8px 0; color: #374151; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .mt-16 { margin-top: 16px; }
        .mb-16 { margin-bottom: 16px; }
        @media only screen and (max-width: 600px) {
          .container { padding: 10px; }
          .content { padding: 24px 16px; }
          .header { padding: 24px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h2 style="margin:0;">Hyphen Wellness</h2>
            <p style="margin:6px 0 0; opacity:.9;">Dubai's Smart Gym Management</p>
          </div>
          <div class="content">
            ${bodyHtml}
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} Hyphen Wellness. All rights reserved.</p>
            <p style="margin: 0; font-size: 11px; opacity: 0.8;">This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

// ============================================
// USER MANAGEMENT TEMPLATES
// ============================================

function welcomeMemberTemplate({ firstName, lastName, email, loginUrl = 'http://localhost:3000/login' }) {
  const body = `
    <div class="icon">🎉</div>
    <h1>Welcome to Hyphen Wellness, ${firstName}!</h1>
    <p>Hi ${firstName}${lastName ? ' ' + lastName : ''},</p>
    <p>Your account has been created successfully. We're excited to be part of your fitness journey!</p>
    <div class="success-box">
      <p style="margin: 0; color: #166534; font-weight: 600;">✅ Account Created Successfully</p>
    </div>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Your Account Details:</p>
      <div class="detail-row">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${email}</span>
      </div>
    </div>
    <p>Use the Hyphen Wellness platform to:</p>
    <ul>
      <li>Check in to the gym</li>
      <li>Manage your membership</li>
      <li>Track your training sessions</li>
      <li>Book appointments with trainers</li>
      <li>View your payment history</li>
    </ul>
    <div class="text-center mt-16">
      <a href="${loginUrl}" class="btn">Log in to Your Account</a>
    </div>
    <p class="muted text-center">If you have any questions, feel free to contact our support team.</p>
  `;
  return buildBaseTemplate({ title: 'Welcome to Hyphen Wellness', bodyHtml: body });
}

function registrationNotificationTemplate({ firstName, lastName, email, phone, role, memberId, specialization }) {
  const body = `
    <h2>New User Registration</h2>
    <p>A new user has successfully registered on Hyphen Wellness.</p>
    <div class="info-box">
      <p style="margin: 0 0 16px; font-weight: 600; color: #1f2937;">Registration Details:</p>
      <div class="detail-row">
        <span class="detail-label">Name:</span>
        <span class="detail-value">${firstName} ${lastName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${email}</span>
      </div>
      ${phone ? `
      <div class="detail-row">
        <span class="detail-label">Phone:</span>
        <span class="detail-value">${phone}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Role:</span>
        <span class="detail-value" style="text-transform: capitalize;">${role}</span>
      </div>
      ${memberId ? `
      <div class="detail-row">
        <span class="detail-label">Member ID:</span>
        <span class="detail-value">${memberId}</span>
      </div>
      ` : ''}
      ${specialization ? `
      <div class="detail-row">
        <span class="detail-label">Specialization:</span>
        <span class="detail-value">${specialization}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Registration Date:</span>
        <span class="detail-value">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}</span>
      </div>
    </div>
    <p class="muted">Please review this new registration in your admin dashboard.</p>
  `;
  return buildBaseTemplate({ title: 'New Registration - Hyphen Wellness', bodyHtml: body });
}

function passwordResetTemplate({ firstName, resetLink, expiresIn = '24 hours' }) {
  const body = `
    <div class="icon">🔐</div>
    <h1>Password Reset Request</h1>
    <p>Hi ${firstName},</p>
    <p>We received a request to reset your password for your Hyphen Wellness account.</p>
    <div class="warning-box">
      <p style="margin: 0 0 8px; color: #92400e; font-weight: 600;">⚠️ Important</p>
      <p style="margin: 0; color: #92400e; font-size: 14px;">This link will expire in ${expiresIn}. If you didn't request this, please ignore this email.</p>
    </div>
    <div class="text-center mt-16">
      <a href="${resetLink}" class="btn">Reset Your Password</a>
    </div>
    <p class="muted text-center">Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 12px; color: #6b7280; text-align: center; background: #f9fafb; padding: 12px; border-radius: 6px;">${resetLink}</p>
    <p class="muted">If you didn't request a password reset, you can safely ignore this email.</p>
  `;
  return buildBaseTemplate({ title: 'Password Reset - Hyphen Wellness', bodyHtml: body });
}

function passwordChangedTemplate({ firstName, changedAt, ipAddress }) {
  const body = `
    <div class="icon">✅</div>
    <h1>Password Changed Successfully</h1>
    <p>Hi ${firstName},</p>
    <p>Your password has been successfully changed.</p>
    <div class="success-box">
      <p style="margin: 0; color: #166534; font-weight: 600;">Your account password was updated</p>
    </div>
    <div class="info-box">
      <div class="detail-row">
        <span class="detail-label">Changed At:</span>
        <span class="detail-value">${changedAt}</span>
      </div>
      ${ipAddress ? `
      <div class="detail-row">
        <span class="detail-label">IP Address:</span>
        <span class="detail-value">${ipAddress}</span>
      </div>
      ` : ''}
    </div>
    <p class="warning-box" style="background: #fffbeb; border-left-color: #f59e0b;">
      <strong style="color: #92400e;">Security Notice:</strong> If you didn't make this change, please contact support immediately.
    </p>
  `;
  return buildBaseTemplate({ title: 'Password Changed - Hyphen Wellness', bodyHtml: body });
}

function accountActivatedTemplate({ firstName }) {
  const body = `
    <div class="icon">✨</div>
    <h1>Account Activated</h1>
    <p>Hi ${firstName},</p>
    <p>Great news! Your Hyphen Wellness account has been activated.</p>
    <div class="success-box">
      <p style="margin: 0; color: #166534; font-weight: 600;">You can now access all features of your account.</p>
    </div>
    <p>You can now log in and start using all the features available to you.</p>
    <div class="text-center mt-16">
      <a href="http://localhost:3000/login" class="btn">Log in to Your Account</a>
    </div>
  `;
  return buildBaseTemplate({ title: 'Account Activated - Hyphen Wellness', bodyHtml: body });
}

function accountDeactivatedTemplate({ firstName, reason }) {
  const body = `
    <div class="icon">⚠️</div>
    <h1>Account Deactivated</h1>
    <p>Hi ${firstName},</p>
    <p>Your Hyphen Wellness account has been deactivated.</p>
    ${reason ? `
    <div class="info-box">
      <p style="margin: 0 0 8px; font-weight: 600;">Reason:</p>
      <p style="margin: 0;">${reason}</p>
    </div>
    ` : ''}
    <p>If you believe this is an error or have questions, please contact our support team.</p>
  `;
  return buildBaseTemplate({ title: 'Account Deactivated - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#f59e0b,#ef4444)' });
}

function profileUpdatedTemplate({ firstName, changes }) {
  const body = `
    <div class="icon">📝</div>
    <h1>Profile Updated</h1>
    <p>Hi ${firstName},</p>
    <p>Your profile has been successfully updated.</p>
    ${changes && changes.length > 0 ? `
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Updated Fields:</p>
      <ul style="margin: 0;">
        ${changes.map(change => `<li>${change}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    <p class="muted">If you didn't make these changes, please contact support immediately.</p>
  `;
  return buildBaseTemplate({ title: 'Profile Updated - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// MEMBERSHIP TEMPLATES
// ============================================

function membershipAssignedTemplate({ firstName, membershipName, startDate, endDate, price, features }) {
  const body = `
    <div class="icon">🎯</div>
    <h1>Membership Assigned</h1>
    <p>Hi ${firstName},</p>
    <p>Congratulations! A membership has been assigned to your account.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Membership Details:</p>
      <div class="detail-row">
        <span class="detail-label">Plan:</span>
        <span class="detail-value">${membershipName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Start Date:</span>
        <span class="detail-value">${startDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">End Date:</span>
        <span class="detail-value">${endDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Price:</span>
        <span class="detail-value">AED ${price}</span>
      </div>
    </div>
    ${features && features.length > 0 ? `
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Membership Features:</p>
      <ul style="margin: 0;">
        ${features.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    <p>You can now enjoy all the benefits of your membership!</p>
  `;
  return buildBaseTemplate({ title: 'Membership Assigned - Hyphen Wellness', bodyHtml: body });
}

function membershipRenewedTemplate({ firstName, membershipName, newEndDate, price }) {
  const body = `
    <div class="icon">🔄</div>
    <h1>Membership Renewed</h1>
    <p>Hi ${firstName},</p>
    <p>Your membership has been successfully renewed.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Renewal Details:</p>
      <div class="detail-row">
        <span class="detail-label">Plan:</span>
        <span class="detail-value">${membershipName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">New End Date:</span>
        <span class="detail-value">${newEndDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount Paid:</span>
        <span class="detail-value">AED ${price}</span>
      </div>
    </div>
    <p>Thank you for continuing your fitness journey with us!</p>
  `;
  return buildBaseTemplate({ title: 'Membership Renewed - Hyphen Wellness', bodyHtml: body });
}

function membershipExpiringSoonTemplate({ firstName, membershipName, daysRemaining, expiryDate, renewUrl }) {
  const body = `
    <div class="icon">⏰</div>
    <h1>Membership Expiring Soon</h1>
    <p>Hi ${firstName},</p>
    <p>Your membership is expiring in <strong>${daysRemaining} days</strong>.</p>
    <div class="warning-box">
      <p style="margin: 0 0 12px; color: #92400e; font-weight: 600;">Membership Details:</p>
      <div class="detail-row">
        <span class="detail-label">Plan:</span>
        <span class="detail-value">${membershipName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Expiry Date:</span>
        <span class="detail-value">${expiryDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Days Remaining:</span>
        <span class="detail-value" style="color: #dc2626; font-weight: 700;">${daysRemaining} days</span>
      </div>
    </div>
    <p>Don't miss out on your fitness journey! Renew your membership now to continue enjoying all the benefits.</p>
    ${renewUrl ? `
    <div class="text-center mt-16">
      <a href="${renewUrl}" class="btn btn-success">Renew Membership</a>
    </div>
    ` : ''}
  `;
  return buildBaseTemplate({ title: 'Membership Expiring Soon - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#f59e0b,#f97316)' });
}

function membershipExpiredTemplate({ firstName, membershipName, expiredDate, renewUrl }) {
  const body = `
    <div class="icon">❌</div>
    <h1>Membership Expired</h1>
    <p>Hi ${firstName},</p>
    <p>Your membership has expired on <strong>${expiredDate}</strong>.</p>
    <div class="error-box">
      <p style="margin: 0 0 12px; color: #991b1b; font-weight: 600;">Expired Membership:</p>
      <div class="detail-row">
        <span class="detail-label">Plan:</span>
        <span class="detail-value">${membershipName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Expired Date:</span>
        <span class="detail-value">${expiredDate}</span>
      </div>
    </div>
    <p>To continue enjoying our facilities and services, please renew your membership.</p>
    ${renewUrl ? `
    <div class="text-center mt-16">
      <a href="${renewUrl}" class="btn btn-success">Renew Membership Now</a>
    </div>
    ` : ''}
  `;
  return buildBaseTemplate({ title: 'Membership Expired - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#ef4444,#dc2626)' });
}

function membershipUpgradedTemplate({ firstName, oldPlan, newPlan, upgradeDate, priceDifference }) {
  const body = `
    <div class="icon">⬆️</div>
    <h1>Membership Upgraded</h1>
    <p>Hi ${firstName},</p>
    <p>Congratulations! Your membership has been upgraded.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Upgrade Details:</p>
      <div class="detail-row">
        <span class="detail-label">Previous Plan:</span>
        <span class="detail-value">${oldPlan}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">New Plan:</span>
        <span class="detail-value">${newPlan}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Upgraded On:</span>
        <span class="detail-value">${upgradeDate}</span>
      </div>
      ${priceDifference ? `
      <div class="detail-row">
        <span class="detail-label">Price Difference:</span>
        <span class="detail-value">AED ${priceDifference}</span>
      </div>
      ` : ''}
    </div>
    <p>You now have access to additional features and benefits. Enjoy your upgraded membership!</p>
  `;
  return buildBaseTemplate({ title: 'Membership Upgraded - Hyphen Wellness', bodyHtml: body });
}

function membershipCancelledTemplate({ firstName, membershipName, cancellationDate, reason }) {
  const body = `
    <div class="icon">🚫</div>
    <h1>Membership Cancelled</h1>
    <p>Hi ${firstName},</p>
    <p>Your membership has been cancelled.</p>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Cancellation Details:</p>
      <div class="detail-row">
        <span class="detail-label">Plan:</span>
        <span class="detail-value">${membershipName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Cancelled On:</span>
        <span class="detail-value">${cancellationDate}</span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ''}
    </div>
    <p>We're sorry to see you go. If you'd like to reactivate your membership in the future, we'd be happy to welcome you back!</p>
  `;
  return buildBaseTemplate({ title: 'Membership Cancelled - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// PAYMENT TEMPLATES
// ============================================

function paymentReceiptTemplate({ firstName, receiptNumber, amount, paymentMethod, date, description, invoiceUrl }) {
  const body = `
    <div class="icon">💳</div>
    <h1>Payment Receipt</h1>
    <p>Hi ${firstName},</p>
    <p>Thank you! We have successfully received your payment.</p>
    <div class="success-box">
      <p style="margin: 0 0 16px; color: #166534; font-weight: 600; font-size: 18px;">Payment Confirmed</p>
      <div class="detail-row">
        <span class="detail-label">Receipt #:</span>
        <span class="detail-value" style="font-weight: 700; font-size: 16px;">${receiptNumber}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value" style="font-weight: 700; color: #166534; font-size: 18px;">AED ${amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Method:</span>
        <span class="detail-value">${paymentMethod}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${date}</span>
      </div>
      ${description ? `
      <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">${description}</span>
      </div>
      ` : ''}
    </div>
    ${invoiceUrl ? `
    <div class="text-center mt-16">
      <a href="${invoiceUrl}" class="btn">Download Invoice</a>
    </div>
    ` : ''}
    <p class="muted text-center">Please keep this receipt for your records.</p>
  `;
  return buildBaseTemplate({ title: 'Payment Receipt - Hyphen Wellness', bodyHtml: body });
}

function paymentReminderTemplate({ firstName, amount, dueDate, daysOverdue, invoiceNumber, paymentUrl }) {
  const body = `
    <div class="icon">⏰</div>
    <h1>Payment Reminder</h1>
    <p>Hi ${firstName},</p>
    <p>This is a friendly reminder about your pending payment.</p>
    <div class="warning-box">
      <p style="margin: 0 0 12px; color: #92400e; font-weight: 600;">Payment Details:</p>
      <div class="detail-row">
        <span class="detail-label">Amount Due:</span>
        <span class="detail-value" style="font-weight: 700; color: #dc2626;">AED ${amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${dueDate}</span>
      </div>
      ${daysOverdue > 0 ? `
      <div class="detail-row">
        <span class="detail-label">Days Overdue:</span>
        <span class="detail-value" style="color: #dc2626; font-weight: 700;">${daysOverdue} days</span>
      </div>
      ` : ''}
      ${invoiceNumber ? `
      <div class="detail-row">
        <span class="detail-label">Invoice #:</span>
        <span class="detail-value">${invoiceNumber}</span>
      </div>
      ` : ''}
    </div>
    <p>Please make the payment as soon as possible to avoid any service interruptions.</p>
    ${paymentUrl ? `
    <div class="text-center mt-16">
      <a href="${paymentUrl}" class="btn btn-warning">Pay Now</a>
    </div>
    ` : ''}
  `;
  return buildBaseTemplate({ title: 'Payment Reminder - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#f59e0b,#f97316)' });
}

function paymentOverdueTemplate({ firstName, amount, dueDate, daysOverdue, invoiceNumber, paymentUrl }) {
  const body = `
    <div class="icon">⚠️</div>
    <h1>Payment Overdue</h1>
    <p>Hi ${firstName},</p>
    <p>Your payment is now overdue. Please settle this amount immediately to avoid service suspension.</p>
    <div class="error-box">
      <p style="margin: 0 0 12px; color: #991b1b; font-weight: 600;">Overdue Payment:</p>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value" style="font-weight: 700; color: #dc2626; font-size: 18px;">AED ${amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${dueDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Days Overdue:</span>
        <span class="detail-value" style="color: #dc2626; font-weight: 700;">${daysOverdue} days</span>
      </div>
      ${invoiceNumber ? `
      <div class="detail-row">
        <span class="detail-label">Invoice #:</span>
        <span class="detail-value">${invoiceNumber}</span>
      </div>
      ` : ''}
    </div>
    <p style="font-weight: 600; color: #dc2626;">Please make payment immediately to avoid service interruption.</p>
    ${paymentUrl ? `
    <div class="text-center mt-16">
      <a href="${paymentUrl}" class="btn btn-danger">Pay Now</a>
    </div>
    ` : ''}
  `;
  return buildBaseTemplate({ title: 'Payment Overdue - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#ef4444,#dc2626)' });
}

function invoiceGeneratedTemplate({ firstName, invoiceNumber, amount, dueDate, items, invoiceUrl }) {
  const body = `
    <div class="icon">📄</div>
    <h1>New Invoice Generated</h1>
    <p>Hi ${firstName},</p>
    <p>A new invoice has been generated for your account.</p>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Invoice Details:</p>
      <div class="detail-row">
        <span class="detail-label">Invoice #:</span>
        <span class="detail-value" style="font-weight: 700;">${invoiceNumber}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value" style="font-weight: 700;">AED ${amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${dueDate}</span>
      </div>
    </div>
    ${items && items.length > 0 ? `
    <div class="info-box" style="margin-top: 16px;">
      <p style="margin: 0 0 12px; font-weight: 600;">Invoice Items:</p>
      ${items.map(item => `
      <div class="detail-row">
        <span class="detail-label">${item.description || item.name}:</span>
        <span class="detail-value">AED ${item.amount}</span>
      </div>
      `).join('')}
    </div>
    ` : ''}
    ${invoiceUrl ? `
    <div class="text-center mt-16">
      <a href="${invoiceUrl}" class="btn">View Invoice</a>
    </div>
    ` : ''}
    <p class="muted text-center">Please make payment before the due date.</p>
  `;
  return buildBaseTemplate({ title: 'Invoice Generated - Hyphen Wellness', bodyHtml: body });
}

function refundProcessedTemplate({ firstName, refundNumber, amount, originalPayment, reason, refundMethod }) {
  const body = `
    <div class="icon">💰</div>
    <h1>Refund Processed</h1>
    <p>Hi ${firstName},</p>
    <p>Your refund has been successfully processed.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Refund Details:</p>
      <div class="detail-row">
        <span class="detail-label">Refund #:</span>
        <span class="detail-value" style="font-weight: 700;">${refundNumber}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value" style="font-weight: 700; color: #166534;">AED ${amount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Original Payment:</span>
        <span class="detail-value">${originalPayment}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Refund Method:</span>
        <span class="detail-value">${refundMethod}</span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ''}
    </div>
    <p>The refund will be processed to your original payment method within 5-7 business days.</p>
  `;
  return buildBaseTemplate({ title: 'Refund Processed - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// APPOINTMENT & SESSION TEMPLATES
// ============================================

function appointmentBookedTemplate({ firstName, trainerName, appointmentDate, appointmentTime, duration, location, notes }) {
  const body = `
    <div class="icon">📅</div>
    <h1>Appointment Booked</h1>
    <p>Hi ${firstName},</p>
    <p>Your appointment has been successfully booked!</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Appointment Details:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${appointmentDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${appointmentTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${duration} minutes</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    ${notes ? `
    <div class="info-box">
      <p style="margin: 0 0 8px; font-weight: 600;">Notes:</p>
      <p style="margin: 0;">${notes}</p>
    </div>
    ` : ''}
    <p>We look forward to seeing you! Please arrive on time for your appointment.</p>
  `;
  return buildBaseTemplate({ title: 'Appointment Booked - Hyphen Wellness', bodyHtml: body });
}

function appointmentConfirmedTemplate({ firstName, trainerName, appointmentDate, appointmentTime, location }) {
  const body = `
    <div class="icon">✅</div>
    <h1>Appointment Confirmed</h1>
    <p>Hi ${firstName},</p>
    <p>Your appointment has been confirmed.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Confirmed Appointment:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${appointmentDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${appointmentTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    <p>See you soon!</p>
  `;
  return buildBaseTemplate({ title: 'Appointment Confirmed - Hyphen Wellness', bodyHtml: body });
}

function appointmentReminderTemplate({ firstName, trainerName, appointmentDate, appointmentTime, location, hours }) {
  const body = `
    <div class="icon">⏰</div>
    <h1>Appointment Reminder</h1>
    <p>Hi ${firstName},</p>
    <p>This is a friendly reminder about your upcoming appointment in <strong>${hours} hours</strong>.</p>
    <div class="warning-box">
      <p style="margin: 0 0 12px; color: #92400e; font-weight: 600;">Appointment Details:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${appointmentDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${appointmentTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    <p>Please make sure to arrive on time for your appointment.</p>
  `;
  return buildBaseTemplate({ title: 'Appointment Reminder - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#f59e0b,#f97316)' });
}

function appointmentRescheduledTemplate({ firstName, trainerName, oldDate, oldTime, newDate, newTime, location, reason }) {
  const body = `
    <div class="icon">🔄</div>
    <h1>Appointment Rescheduled</h1>
    <p>Hi ${firstName},</p>
    <p>Your appointment has been rescheduled.</p>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Previous Appointment:</p>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${oldDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${oldTime}</span>
      </div>
    </div>
    <div class="success-box" style="margin-top: 16px;">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">New Appointment:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${newDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${newTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    ${reason ? `
    <div class="info-box" style="margin-top: 16px;">
      <p style="margin: 0 0 8px; font-weight: 600;">Reason:</p>
      <p style="margin: 0;">${reason}</p>
    </div>
    ` : ''}
  `;
  return buildBaseTemplate({ title: 'Appointment Rescheduled - Hyphen Wellness', bodyHtml: body });
}

function appointmentCancelledTemplate({ firstName, trainerName, appointmentDate, appointmentTime, reason, rescheduleUrl }) {
  const body = `
    <div class="icon">❌</div>
    <h1>Appointment Cancelled</h1>
    <p>Hi ${firstName},</p>
    <p>Your appointment has been cancelled.</p>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Cancelled Appointment:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${appointmentDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${appointmentTime}</span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ''}
    </div>
    ${rescheduleUrl ? `
    <p>If you'd like to reschedule, you can book a new appointment.</p>
    <div class="text-center mt-16">
      <a href="${rescheduleUrl}" class="btn">Book New Appointment</a>
    </div>
    ` : ''}
  `;
  return buildBaseTemplate({ title: 'Appointment Cancelled - Hyphen Wellness', bodyHtml: body });
}

function sessionScheduledTemplate({ firstName, trainerName, sessionDate, sessionTime, duration, location, programmeName }) {
  const body = `
    <div class="icon">🏋️</div>
    <h1>Training Session Scheduled</h1>
    <p>Hi ${firstName},</p>
    <p>Your training session has been scheduled.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Session Details:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      ${programmeName ? `
      <div class="detail-row">
        <span class="detail-label">Programme:</span>
        <span class="detail-value">${programmeName}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${sessionDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${sessionTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${duration} minutes</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    <p>Get ready for an amazing workout session!</p>
  `;
  return buildBaseTemplate({ title: 'Training Session Scheduled - Hyphen Wellness', bodyHtml: body });
}

function sessionRescheduledTemplate({ firstName, trainerName, oldDate, oldTime, newDate, newTime, location }) {
  const body = `
    <div class="icon">🔄</div>
    <h1>Training Session Rescheduled</h1>
    <p>Hi ${firstName},</p>
    <p>Your training session has been rescheduled.</p>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Previous Session:</p>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${oldDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${oldTime}</span>
      </div>
    </div>
    <div class="success-box" style="margin-top: 16px;">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">New Session:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${newDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${newTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
  `;
  return buildBaseTemplate({ title: 'Training Session Rescheduled - Hyphen Wellness', bodyHtml: body });
}

function sessionCancelledTemplate({ firstName, trainerName, sessionDate, sessionTime, reason }) {
  const body = `
    <div class="icon">❌</div>
    <h1>Training Session Cancelled</h1>
    <p>Hi ${firstName},</p>
    <p>Your training session scheduled for <strong>${sessionDate} at ${sessionTime}</strong> has been cancelled.</p>
    <div class="info-box">
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ''}
    </div>
    <p>If you have any questions or would like to reschedule, please contact us.</p>
  `;
  return buildBaseTemplate({ title: 'Training Session Cancelled - Hyphen Wellness', bodyHtml: body });
}

function sessionCompletedTemplate({ firstName, trainerName, sessionDate, sessionTime, rating, notes }) {
  const body = `
    <div class="icon">✅</div>
    <h1>Training Session Completed</h1>
    <p>Hi ${firstName},</p>
    <p>Your training session with <strong>${trainerName}</strong> on <strong>${sessionDate} at ${sessionTime}</strong> has been marked as completed.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Session Summary:</p>
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${sessionDate}</span>
      </div>
      ${rating ? `
      <div class="detail-row">
        <span class="detail-label">Rating:</span>
        <span class="detail-value">${rating}/5 ⭐</span>
      </div>
      ` : ''}
    </div>
    ${notes ? `
    <div class="info-box">
      <p style="margin: 0 0 8px; font-weight: 600;">Session Notes:</p>
      <p style="margin: 0;">${notes}</p>
    </div>
    ` : ''}
    <p>Great job on completing your session! Keep up the excellent work.</p>
  `;
  return buildBaseTemplate({ title: 'Training Session Completed - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// CHECK-IN/CHECK-OUT TEMPLATES
// ============================================

function checkinConfirmationTemplate({ firstName, checkInTime, location }) {
  const body = `
    <div class="icon">✅</div>
    <h1>Check-in Confirmed</h1>
    <p>Hi ${firstName},</p>
    <p>You have successfully checked in at <strong>${checkInTime}</strong>.</p>
    <div class="success-box">
      <p style="margin: 0; color: #166534; font-weight: 600; font-size: 18px;">💪 Have a great workout!</p>
      <div class="detail-row" style="margin-top: 16px;">
        <span class="detail-label">Check-in Time:</span>
        <span class="detail-value">${checkInTime}</span>
      </div>
      ${location ? `
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location}</span>
      </div>
      ` : ''}
    </div>
    <p>Enjoy your workout session!</p>
  `;
  return buildBaseTemplate({ title: 'Check-in Confirmation - Hyphen Wellness', bodyHtml: body });
}

function checkoutSummaryTemplate({ firstName, checkOutTime, checkInTime, duration, location }) {
  const body = `
    <div class="icon">👋</div>
    <h1>Check-out Summary</h1>
    <p>Hi ${firstName},</p>
    <p>Your session has ended at <strong>${checkOutTime}</strong>.</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Session Summary:</p>
      <div class="detail-row">
        <span class="detail-label">Check-in:</span>
        <span class="detail-value">${checkInTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Check-out:</span>
        <span class="detail-value">${checkOutTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value" style="font-weight: 700;">${duration} minutes</span>
      </div>
      ${location ? `
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location}</span>
      </div>
      ` : ''}
    </div>
    <p>Thank you for your visit! See you next time.</p>
  `;
  return buildBaseTemplate({ title: 'Check-out Summary - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// CLASS TEMPLATES
// ============================================

function classEnrolledTemplate({ firstName, className, classDate, classTime, instructor, location }) {
  const body = `
    <div class="icon">🎯</div>
    <h1>Class Enrollment Confirmed</h1>
    <p>Hi ${firstName},</p>
    <p>You have been successfully enrolled in the class!</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Class Details:</p>
      <div class="detail-row">
        <span class="detail-label">Class Name:</span>
        <span class="detail-value">${className}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${classDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${classTime}</span>
      </div>
      ${instructor ? `
      <div class="detail-row">
        <span class="detail-label">Instructor:</span>
        <span class="detail-value">${instructor}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    <p>We look forward to seeing you in class!</p>
  `;
  return buildBaseTemplate({ title: 'Class Enrollment Confirmed - Hyphen Wellness', bodyHtml: body });
}

function classReminderTemplate({ firstName, className, classDate, classTime, instructor, location, hours }) {
  const body = `
    <div class="icon">⏰</div>
    <h1>Class Reminder</h1>
    <p>Hi ${firstName},</p>
    <p>This is a reminder about your upcoming class in <strong>${hours} hours</strong>.</p>
    <div class="warning-box">
      <p style="margin: 0 0 12px; color: #92400e; font-weight: 600;">Class Details:</p>
      <div class="detail-row">
        <span class="detail-label">Class Name:</span>
        <span class="detail-value">${className}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${classDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${classTime}</span>
      </div>
      ${instructor ? `
      <div class="detail-row">
        <span class="detail-label">Instructor:</span>
        <span class="detail-value">${instructor}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location || 'Hyphen Wellness'}</span>
      </div>
    </div>
    <p>See you in class!</p>
  `;
  return buildBaseTemplate({ title: 'Class Reminder - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#f59e0b,#f97316)' });
}

function classCancelledTemplate({ firstName, className, classDate, classTime, reason }) {
  const body = `
    <div class="icon">❌</div>
    <h1>Class Cancelled</h1>
    <p>Hi ${firstName},</p>
    <p>The class you were enrolled in has been cancelled.</p>
    <div class="info-box">
      <p style="margin: 0 0 12px; font-weight: 600;">Cancelled Class:</p>
      <div class="detail-row">
        <span class="detail-label">Class Name:</span>
        <span class="detail-value">${className}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${classDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${classTime}</span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ''}
    </div>
    <p>We apologize for any inconvenience. You can enroll in other available classes.</p>
  `;
  return buildBaseTemplate({ title: 'Class Cancelled - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// TRAINER TEMPLATES
// ============================================

function trainerAssignedTemplate({ firstName, trainerName, trainerEmail, trainerPhone, specialization }) {
  const body = `
    <div class="icon">👨‍🏫</div>
    <h1>Trainer Assigned</h1>
    <p>Hi ${firstName},</p>
    <p>A trainer has been assigned to you!</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Trainer Details:</p>
      <div class="detail-row">
        <span class="detail-label">Name:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      ${specialization ? `
      <div class="detail-row">
        <span class="detail-label">Specialization:</span>
        <span class="detail-value">${specialization}</span>
      </div>
      ` : ''}
      ${trainerEmail ? `
      <div class="detail-row">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${trainerEmail}</span>
      </div>
      ` : ''}
      ${trainerPhone ? `
      <div class="detail-row">
        <span class="detail-label">Phone:</span>
        <span class="detail-value">${trainerPhone}</span>
      </div>
      ` : ''}
    </div>
    <p>You can now schedule training sessions with your assigned trainer.</p>
  `;
  return buildBaseTemplate({ title: 'Trainer Assigned - Hyphen Wellness', bodyHtml: body });
}

function programmeAssignedTemplate({ firstName, programmeName, trainerName, duration, sessions, description }) {
  const body = `
    <div class="icon">📋</div>
    <h1>Training Programme Assigned</h1>
    <p>Hi ${firstName},</p>
    <p>A training programme has been assigned to you!</p>
    <div class="success-box">
      <p style="margin: 0 0 12px; color: #166534; font-weight: 600;">Programme Details:</p>
      <div class="detail-row">
        <span class="detail-label">Programme Name:</span>
        <span class="detail-value">${programmeName}</span>
      </div>
      ${trainerName ? `
      <div class="detail-row">
        <span class="detail-label">Trainer:</span>
        <span class="detail-value">${trainerName}</span>
      </div>
      ` : ''}
      ${duration ? `
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${duration}</span>
      </div>
      ` : ''}
      ${sessions ? `
      <div class="detail-row">
        <span class="detail-label">Sessions:</span>
        <span class="detail-value">${sessions}</span>
      </div>
      ` : ''}
    </div>
    ${description ? `
    <div class="info-box">
      <p style="margin: 0 0 8px; font-weight: 600;">Description:</p>
      <p style="margin: 0;">${description}</p>
    </div>
    ` : ''}
    <p>Start your training programme and achieve your fitness goals!</p>
  `;
  return buildBaseTemplate({ title: 'Training Programme Assigned - Hyphen Wellness', bodyHtml: body });
}

// ============================================
// SYSTEM TEMPLATES
// ============================================

function systemMaintenanceTemplate({ firstName, maintenanceDate, maintenanceTime, duration, reason }) {
  const body = `
    <div class="icon">🔧</div>
    <h1>System Maintenance Notice</h1>
    <p>Hi ${firstName},</p>
    <p>We will be performing scheduled system maintenance.</p>
    <div class="warning-box">
      <p style="margin: 0 0 12px; color: #92400e; font-weight: 600;">Maintenance Details:</p>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${maintenanceDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${maintenanceTime}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${duration}</span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ''}
    </div>
    <p>During this time, some services may be temporarily unavailable. We apologize for any inconvenience.</p>
  `;
  return buildBaseTemplate({ title: 'System Maintenance - Hyphen Wellness', bodyHtml: body, headerColor: 'linear-gradient(135deg,#f59e0b,#f97316)' });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getActiveSMTP() {
  const settings = await SMTPSettings.findOne({ isActive: true });
  return settings || null;
}

async function sendEmail({ to, subject, html }) {
  const settings = await getActiveSMTP();
  if (!settings) throw new Error('No active SMTP settings found');
  return settings.sendEmail(to, subject, html);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  sendEmail,
  getActiveSMTP,
  templates: {
    // User Management
    welcomeMemberTemplate,
    registrationNotificationTemplate,
    passwordResetTemplate,
    passwordChangedTemplate,
    accountActivatedTemplate,
    accountDeactivatedTemplate,
    profileUpdatedTemplate,
    
    // Membership
    membershipAssignedTemplate,
    membershipRenewedTemplate,
    membershipExpiringSoonTemplate,
    membershipExpiredTemplate,
    membershipUpgradedTemplate,
    membershipCancelledTemplate,
    
    // Payments
    paymentReceiptTemplate,
    paymentReminderTemplate,
    paymentOverdueTemplate,
    invoiceGeneratedTemplate,
    refundProcessedTemplate,
    
    // Appointments & Sessions
    appointmentBookedTemplate,
    appointmentConfirmedTemplate,
    appointmentReminderTemplate,
    appointmentRescheduledTemplate,
    appointmentCancelledTemplate,
    sessionScheduledTemplate,
    sessionRescheduledTemplate,
    sessionCancelledTemplate,
    sessionCompletedTemplate,
    
    // Check-in/Check-out
    checkinConfirmationTemplate,
    checkoutSummaryTemplate,
    
    // Classes
    classEnrolledTemplate,
    classReminderTemplate,
    classCancelledTemplate,
    
    // Trainer
    trainerAssignedTemplate,
    programmeAssignedTemplate,
    
    // System
    systemMaintenanceTemplate
  }
};
