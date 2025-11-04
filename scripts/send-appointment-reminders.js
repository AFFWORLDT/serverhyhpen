const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Email = require('../utils/email');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

async function sendReminders() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    // Find appointments in 24 hours that haven't sent reminder
    const appointments24h = await Appointment.find({
      status: 'scheduled',
      startTime: { $gte: now, $lte: in24Hours },
      reminderSent24h: false
    }).populate('client staff');

    console.log(`Found ${appointments24h.length} appointments for 24h reminders`);

    for (const apt of appointments24h) {
      try {
        const html = Email.templates.appointmentReminderTemplate({
          firstName: apt.client.firstName,
          trainerName: `${apt.staff.firstName} ${apt.staff.lastName}`,
          when: apt.startTime.toLocaleString(),
          location: apt.location,
          hours: 24
        });
        await Email.sendEmail({
          to: apt.client.email,
          subject: 'Appointment Reminder - Tomorrow',
          html
        });
        apt.reminderSent24h = true;
        await apt.save();
        console.log(`✅ Sent 24h reminder to ${apt.client.email}`);
      } catch (err) {
        console.error(`❌ Failed to send 24h reminder for ${apt._id}:`, err.message);
      }
    }

    // Find appointments in 1 hour that haven't sent reminder
    const appointments1h = await Appointment.find({
      status: 'scheduled',
      startTime: { $gte: now, $lte: in1Hour },
      reminderSent1h: false
    }).populate('client staff');

    console.log(`Found ${appointments1h.length} appointments for 1h reminders`);

    for (const apt of appointments1h) {
      try {
        const html = Email.templates.appointmentReminderTemplate({
          firstName: apt.client.firstName,
          trainerName: `${apt.staff.firstName} ${apt.staff.lastName}`,
          when: apt.startTime.toLocaleString(),
          location: apt.location,
          hours: 1
        });
        await Email.sendEmail({
          to: apt.client.email,
          subject: 'Appointment Reminder - In 1 Hour',
          html
        });
        apt.reminderSent1h = true;
        await apt.save();
        console.log(`✅ Sent 1h reminder to ${apt.client.email}`);
      } catch (err) {
        console.error(`❌ Failed to send 1h reminder for ${apt._id}:`, err.message);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Reminder job completed');
  } catch (error) {
    console.error('❌ Reminder job error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  sendReminders();
}

module.exports = sendReminders;

