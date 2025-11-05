const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

async function checkReception() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check reception account
    const reception = await User.findOne({ email: 'reception@hyphen.com' }).select('+password');
    
    if (reception) {
      console.log('✅ Reception account found in MongoDB:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   ID:', reception._id);
      console.log('   Email:', reception.email);
      console.log('   First Name:', reception.firstName);
      console.log('   Last Name:', reception.lastName);
      console.log('   Phone:', reception.phone);
      console.log('   Role:', reception.role);
      console.log('   Department:', reception.department || 'Not set');
      console.log('   Position:', reception.position || 'Not set');
      console.log('   Active:', reception.isActive);
      console.log('   Last Login:', reception.lastLogin || 'Never');
      console.log('   Created At:', reception.createdAt);
      console.log('   Updated At:', reception.updatedAt);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Test password
      console.log('\n🔐 Testing password...');
      const isPasswordValid = await reception.comparePassword('reception123');
      console.log('   Password test (reception123):', isPasswordValid ? '✅ Valid' : '❌ Invalid');
      
    } else {
      console.log('❌ Reception account NOT found in MongoDB');
      console.log('   Run create-reception.js to create it');
    }
    
    // Also check all staff accounts
    console.log('\n📋 All Staff Accounts:');
    const allStaff = await User.find({ role: 'staff' }).select('-password');
    console.log(`   Total staff accounts: ${allStaff.length}`);
    allStaff.forEach((staff, index) => {
      console.log(`   ${index + 1}. ${staff.firstName} ${staff.lastName} (${staff.email}) - ${staff.department || 'No department'}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkReception();

