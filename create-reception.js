const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

async function createReception() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if reception account exists
    let reception = await User.findOne({ email: 'reception@hyphen.com' });
    
    if (reception) {
      console.log('✅ Reception account already exists:');
      console.log('   Email:', reception.email);
      console.log('   Role:', reception.role);
      console.log('   Department:', reception.department);
      console.log('   Position:', reception.position);
      console.log('   Active:', reception.isActive);
      console.log('   First Name:', reception.firstName);
      console.log('   Last Name:', reception.lastName);
      
      // Reset password if needed
      if (!reception.isActive) {
        reception.isActive = true;
      }
      
      // Set department and position if missing
      if (!reception.department) {
        reception.department = 'Reception';
      }
      if (!reception.position) {
        reception.position = 'Receptionist';
      }
      
      // Reset password to reception123
      reception.password = 'reception123';
      await reception.save();
      console.log('✅ Password reset to: reception123');
      if (reception.department) {
        console.log('✅ Department set to:', reception.department);
      }
      if (reception.position) {
        console.log('✅ Position set to:', reception.position);
      }
      
    } else {
      console.log('❌ Reception account NOT found');
      console.log('Creating reception account...\n');
      
      reception = new User({
        firstName: 'Reception',
        lastName: 'Staff',
        email: 'reception@hyphen.com',
        password: 'reception123',
        phone: '0500000001',
        role: 'staff',
        department: 'Reception',
        position: 'Receptionist',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'other',
        isActive: true,
        hireDate: new Date()
      });
      
      await reception.save();
      console.log('✅ Reception account created successfully!');
      console.log('   Email: reception@hyphen.com');
      console.log('   Password: reception123');
      console.log('   Department: Reception');
      console.log('   Position: Receptionist');
    }
    
    console.log('\n✅ Login credentials:');
    console.log('   Email: reception@hyphen.com');
    console.log('   Password: reception123');
    console.log('\n✅ Reception account ready!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createReception();

