const cron = require('node-cron');
const User = require('../models/User');
const { Membership } = require('../models/Membership');
const Payment = require('../models/Payment');
const Class = require('../models/Class');
const Email = require('../utils/email');

// Schedule: Run daily at 9:00 AM
const DAILY_SCHEDULE = '0 9 * * *';

/**
 * Check and send membership expiring soon reminders (7 days before expiry)
 */
const checkMembershipExpiring = async () => {
  try {
    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    // Find memberships expiring in 7 days
    const expiringMemberships = await Membership.find({
      status: 'active',
      endDate: {
        $gte: today,
        $lte: sevenDaysLater
      }
    })
      .populate('member', 'firstName lastName email')
      .populate('plan', 'name price duration');

    console.log(`Found ${expiringMemberships.length} memberships expiring soon`);

    for (const membership of expiringMemberships) {
      if (membership.member?.email) {
        try {
          const html = Email.templates.membershipExpiringSoonTemplate({
            firstName: membership.member.firstName,
            membershipName: membership.plan?.name || 'Membership',
            expiryDate: new Date(membership.endDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          });
          
          await Email.sendEmail({
            to: membership.member.email,
            subject: `Your Membership Expires Soon - ${membership.plan?.name || 'Membership'}`,
            html
          });
          
          console.log(`Sent expiry reminder to ${membership.member.email}`);
        } catch (error) {
          console.error(`Error sending expiry reminder to ${membership.member.email}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error checking membership expiry:', error);
  }
};

/**
 * Check and send membership expired notifications
 */
const checkMembershipExpired = async () => {
  try {
    const today = new Date();
    
    // Find expired memberships that haven't been notified yet
    const expiredMemberships = await Membership.find({
      status: 'active',
      endDate: { $lt: today }
    })
      .populate('member', 'firstName lastName email')
      .populate('plan', 'name price duration');

    console.log(`Found ${expiredMemberships.length} expired memberships`);

    for (const membership of expiredMemberships) {
      if (membership.member?.email) {
        try {
          // Update membership status to expired
          membership.status = 'expired';
          await membership.save();

          const html = Email.templates.membershipExpiredTemplate({
            firstName: membership.member.firstName,
            membershipName: membership.plan?.name || 'Membership',
            expiryDate: new Date(membership.endDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          });
          
          await Email.sendEmail({
            to: membership.member.email,
            subject: `Your Membership Has Expired - ${membership.plan?.name || 'Membership'}`,
            html
          });
          
          console.log(`Sent expiry notification to ${membership.member.email}`);
        } catch (error) {
          console.error(`Error sending expiry notification to ${membership.member.email}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error checking expired memberships:', error);
  }
};

/**
 * Check and send payment reminders for pending payments
 */
const checkPaymentReminders = async () => {
  try {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // Find pending payments older than 3 days
    const pendingPayments = await Payment.find({
      status: 'pending',
      createdAt: { $lte: threeDaysAgo }
    })
      .populate('member', 'firstName lastName email');

    console.log(`Found ${pendingPayments.length} pending payments to remind`);

    for (const payment of pendingPayments) {
      if (payment.member?.email) {
        try {
          const invoiceNumber = payment.receiptNumber || `INV-${payment._id.toString().slice(-6)}`;
          const dueDate = new Date(payment.createdAt);
          dueDate.setDate(dueDate.getDate() + 7);
          
          const html = Email.templates.paymentReminderTemplate({
            firstName: payment.member.firstName,
            invoiceNumber,
            dueDate: dueDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            amount: payment.amount
          });
          
          await Email.sendEmail({
            to: payment.member.email,
            subject: `Payment Reminder - Invoice ${invoiceNumber}`,
            html
          });
          
          console.log(`Sent payment reminder to ${payment.member.email}`);
        } catch (error) {
          console.error(`Error sending payment reminder to ${payment.member.email}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error checking payment reminders:', error);
  }
};

/**
 * Check and send overdue payment notifications
 */
const checkOverduePayments = async () => {
  try {
    const today = new Date();
    
    // Find pending payments with due date passed
    const overduePayments = await Payment.find({
      status: 'pending',
      createdAt: { $lt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
    })
      .populate('member', 'firstName lastName email');

    console.log(`Found ${overduePayments.length} overdue payments`);

    for (const payment of overduePayments) {
      if (payment.member?.email) {
        try {
          const invoiceNumber = payment.receiptNumber || `INV-${payment._id.toString().slice(-6)}`;
          const dueDate = new Date(payment.createdAt);
          dueDate.setDate(dueDate.getDate() + 7);
          
          const html = Email.templates.paymentOverdueTemplate({
            firstName: payment.member.firstName,
            invoiceNumber,
            dueDate: dueDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            amount: payment.amount
          });
          
          await Email.sendEmail({
            to: payment.member.email,
            subject: `Overdue Payment - Invoice ${invoiceNumber}`,
            html
          });
          
          console.log(`Sent overdue payment notification to ${payment.member.email}`);
        } catch (error) {
          console.error(`Error sending overdue payment notification to ${payment.member.email}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error checking overdue payments:', error);
  }
};

/**
 * Check and send class reminders (24 hours before class)
 */
const checkClassReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    // Find classes scheduled for tomorrow
    const upcomingClasses = await Class.find({
      status: 'active',
      schedule: {
        $elemMatch: {
          startTime: {
            $gte: tomorrow,
            $lte: tomorrowEnd
          }
        }
      }
    })
      .populate('trainer', 'firstName lastName email')
      .populate('members', 'firstName lastName email');

    console.log(`Found ${upcomingClasses.length} classes tomorrow`);

    for (const classItem of upcomingClasses) {
      if (classItem.members && classItem.members.length > 0) {
        for (const member of classItem.members) {
          if (member.email) {
            try {
              const nextSession = classItem.schedule?.find(s => {
                const sessionDate = new Date(s.startTime);
                return sessionDate >= tomorrow && sessionDate <= tomorrowEnd;
              });
              
              if (nextSession) {
                const html = Email.templates.classReminderTemplate({
                  firstName: member.firstName,
                  className: classItem.name,
                  classDate: new Date(nextSession.startTime).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }),
                  classTime: new Date(nextSession.startTime).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }),
                  instructor: classItem.trainer ? `${classItem.trainer.firstName} ${classItem.trainer.lastName}` : 'TBA',
                  location: classItem.location || 'Main Gym',
                  hours: 24
                });
                
                await Email.sendEmail({
                  to: member.email,
                  subject: `Class Reminder - ${classItem.name} Tomorrow`,
                  html
                });
                
                console.log(`Sent class reminder to ${member.email}`);
              }
            } catch (error) {
              console.error(`Error sending class reminder to ${member.email}:`, error.message);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking class reminders:', error);
  }
};

/**
 * Initialize all scheduled jobs
 */
const initializeScheduledJobs = () => {
  console.log('📧 Initializing email reminder scheduled jobs...');
  
  // Daily at 9:00 AM - Check all reminders
  cron.schedule(DAILY_SCHEDULE, async () => {
    console.log('⏰ Running scheduled email reminders...');
    await Promise.all([
      checkMembershipExpiring(),
      checkMembershipExpired(),
      checkPaymentReminders(),
      checkOverduePayments(),
      checkClassReminders()
    ]);
    console.log('✅ Scheduled email reminders completed');
  });
  
  console.log('✅ Email reminder scheduled jobs initialized');
  console.log(`   Schedule: Daily at 9:00 AM (${DAILY_SCHEDULE})`);
};

/**
 * Run all checks manually (for testing)
 */
const runAllChecks = async () => {
  console.log('🔄 Running all email reminder checks...');
  await Promise.all([
    checkMembershipExpiring(),
    checkMembershipExpired(),
    checkPaymentReminders(),
    checkOverduePayments(),
    checkClassReminders()
  ]);
  console.log('✅ All email reminder checks completed');
};

module.exports = {
  initializeScheduledJobs,
  runAllChecks,
  checkMembershipExpiring,
  checkMembershipExpired,
  checkPaymentReminders,
  checkOverduePayments,
  checkClassReminders
};


