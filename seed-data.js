const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

async function seedData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if there are already users
    const userCount = await User.countDocuments();
    console.log(`📊 Current user count: ${userCount}`);

    if (userCount === 0) {
      console.log('🌱 Database is empty. Creating sample data...');

      // Create admin user
      const adminPassword = await bcrypt.hash('admin123', 10);
      const admin = await User.create({
        email: 'admin@hypgym.com',
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        phone: '+971501234567',
        isActive: true
      });
      console.log('✅ Created admin user: admin@hypgym.com / admin123');

      // Create reception staff
      const receptionPassword = await bcrypt.hash('reception123', 10);
      const reception = await User.create({
        email: 'reception@hypgym.com',
        password: receptionPassword,
        firstName: 'Reception',
        lastName: 'Staff',
        role: 'staff',
        phone: '+971501234568',
        isActive: true,
        subRole: {
          type: 'reception',
          department: 'Front Desk',
          position: 'Reception Staff',
          employeeId: 'EMP001'
        }
      });
      console.log('✅ Created reception user: reception@hypgym.com / reception123');

      // Create some sample members
      const memberPassword = await bcrypt.hash('member123', 10);
      const members = [];
      for (let i = 1; i <= 5; i++) {
        const member = await User.create({
          email: `member${i}@example.com`,
          password: memberPassword,
          firstName: `Member`,
          lastName: `${i}`,
          role: 'member',
          phone: `+97150123456${i}`,
          isActive: true,
          dateOfBirth: new Date(1990 + i, i - 1, i),
          gender: i % 2 === 0 ? 'male' : 'female',
          emergencyContact: {
            name: `Emergency Contact ${i}`,
            phone: `+97150999999${i}`,
            relationship: 'Family'
          }
        });
        members.push(member);
      }
      console.log('✅ Created 5 sample members');

      console.log('\n🎉 Sample data created successfully!');
      console.log('\n📝 Login Credentials:');
      console.log('Admin: admin@hypgym.com / admin123');
      console.log('Reception: reception@hypgym.com / reception123');
      console.log('Members: member1@example.com to member5@example.com / member123');
    } else {
      console.log('ℹ️  Database already has data. Skipping seed.');
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();

