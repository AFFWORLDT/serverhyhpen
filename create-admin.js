const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

async function createAdmin() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if admin exists
    let admin = await User.findOne({ email: 'admin@hyphen.com' });
    
    if (admin) {
      console.log('✅ Admin user already exists:');
      console.log('   Email:', admin.email);
      console.log('   Role:', admin.role);
      console.log('   Active:', admin.isActive);
      console.log('   First Name:', admin.firstName);
      console.log('   Last Name:', admin.lastName);
      
      // Reset password if needed
      if (!admin.isActive) {
        admin.isActive = true;
        await admin.save();
        console.log('\n✅ Admin account activated!');
      }
      
      // Reset password to admin123
      admin.password = 'admin123';
      await admin.save();
      console.log('✅ Password reset to: admin123');
      
    } else {
      console.log('❌ Admin user NOT found');
      console.log('Creating admin user...\n');
      
      admin = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@hyphen.com',
        password: 'admin123',
        phone: '0500000000',
        role: 'admin',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'other',
        isActive: true
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully!');
      console.log('   Email: admin@hyphen.com');
      console.log('   Password: admin123');
    }
    
    console.log('\n✅ Login credentials:');
    console.log('   Email: admin@hyphen.com');
    console.log('   Password: admin123');
    console.log('\n✅ Ready to login!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAdmin();










