const mongoose = require('mongoose');
const SMTPSettings = require('./models/SMTPSettings');

const MONGODB_URI = 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

async function checkSMTP() {
  try {
    await mongoose.connect(MONGODB_URI);
    const settings = await SMTPSettings.findOne({ isActive: true });
    
    if (settings) {
      console.log('📧 Current SMTP Settings:');
      console.log('   Host:', settings.host);
      console.log('   Port:', settings.port);
      console.log('   Secure:', settings.secure);
      console.log('   Username:', settings.username);
      console.log('   Password:', settings.password ? '*** (hidden)' : 'NOT SET');
      console.log('   From Email:', settings.fromEmail);
      console.log('   From Name:', settings.fromName);
    } else {
      console.log('⚠️  No active SMTP settings found');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

checkSMTP();
