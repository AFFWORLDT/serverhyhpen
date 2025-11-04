const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

async function assignMembersToTrainer() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the trainer
    const trainer = await User.findOne({ email: 'john.trainer@hyphen.com' });
    if (!trainer) {
      console.log('❌ Trainer not found. Please run create-trainer.js first');
      process.exit(1);
    }
    console.log(`✅ Found trainer: ${trainer.firstName} ${trainer.lastName} (ID: ${trainer._id})\n`);

    // Find or create members
    let members = await User.find({ role: 'member' }).limit(3);
    
    if (members.length === 0) {
      console.log('⚠️  No members found. Creating sample members...\n');
      
      const sampleMembers = [
        {
          firstName: 'Sarah',
          lastName: 'Member',
          email: 'sarah.member@hyphen.com',
          password: 'member123',
          phone: '0509876543',
          role: 'member',
          dateOfBirth: new Date('1995-03-15'),
          gender: 'female',
          fitnessLevel: 'Beginner',
          fitnessGoals: ['Weight Loss', 'General Fitness'],
          isActive: true
        },
        {
          firstName: 'Mike',
          lastName: 'Johnson',
          email: 'mike.member@hyphen.com',
          password: 'member123',
          phone: '0508765432',
          role: 'member',
          dateOfBirth: new Date('1988-07-22'),
          gender: 'male',
          fitnessLevel: 'Intermediate',
          fitnessGoals: ['Strength Training', 'Muscle Building'],
          isActive: true
        },
        {
          firstName: 'Emma',
          lastName: 'Davis',
          email: 'emma.member@hyphen.com',
          password: 'member123',
          phone: '0507654321',
          role: 'member',
          dateOfBirth: new Date('1992-11-10'),
          gender: 'female',
          fitnessLevel: 'Advanced',
          fitnessGoals: ['Athletic Performance', 'Endurance'],
          isActive: true
        }
      ];

      for (const memberData of sampleMembers) {
        const existingMember = await User.findOne({ email: memberData.email });
        if (!existingMember) {
          const member = new User(memberData);
          await member.save();
          members.push(member);
          console.log(`✅ Created member: ${memberData.firstName} ${memberData.lastName}`);
        } else {
          members.push(existingMember);
          console.log(`✅ Found existing member: ${existingMember.firstName} ${existingMember.lastName}`);
        }
      }
    } else {
      console.log(`✅ Found ${members.length} existing members`);
    }

    console.log('\n👥 Assigning members to trainer...\n');

    // Assign all members to the trainer
    let assignedCount = 0;
    for (const member of members) {
      if (member.assignedTrainer?.toString() !== trainer._id.toString()) {
        member.assignedTrainer = trainer._id;
        await member.save();
        assignedCount++;
        console.log(`✅ Assigned ${member.firstName} ${member.lastName} to ${trainer.firstName} ${trainer.lastName}`);
      } else {
        console.log(`ℹ️  ${member.firstName} ${member.lastName} already assigned to this trainer`);
      }
    }

    console.log(`\n✅ Assignment complete!`);
    console.log(`\n📋 Summary:`);
    console.log(`   Trainer: ${trainer.firstName} ${trainer.lastName}`);
    console.log(`   Total Members Assigned: ${members.length}`);
    console.log(`   Newly Assigned: ${assignedCount}`);
    
    console.log('\n👤 Member Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.firstName} ${member.lastName}`);
      console.log(`   Email: ${member.email}`);
      console.log(`   Password: member123`);
      console.log(`   Fitness Level: ${member.fitnessLevel || 'Not set'}`);
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n✅ You can now view these members in the trainer dashboard!');
    
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

assignMembersToTrainer();




