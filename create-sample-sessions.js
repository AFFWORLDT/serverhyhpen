const mongoose = require('mongoose');
const TrainingSession = require('./models/TrainingSession');
const User = require('./models/User');
const Programme = require('./models/Programme');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

async function createSampleSessions() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the trainer we created
    const trainer = await User.findOne({ email: 'john.trainer@hyphen.com' });
    if (!trainer) {
      console.log('❌ Trainer not found. Please run create-trainer.js first');
      process.exit(1);
    }
    console.log(`✅ Found trainer: ${trainer.firstName} ${trainer.lastName}`);

    // Find some members
    const members = await User.find({ role: 'member' }).limit(3);
    if (members.length === 0) {
      console.log('⚠️  No members found in database');
      console.log('   Creating a sample member...\n');
      
      const sampleMember = new User({
        firstName: 'Sarah',
        lastName: 'Member',
        email: 'sarah.member@hyphen.com',
        password: 'member123',
        phone: '0509876543',
        role: 'member',
        dateOfBirth: new Date('1995-03-15'),
        gender: 'female',
        assignedTrainer: trainer._id,
        isActive: true
      });
      await sampleMember.save();
      members.push(sampleMember);
      console.log('✅ Created sample member: Sarah Member');
    }

    // Find or create a programme
    let programme = await Programme.findOne();
    if (!programme) {
      programme = new Programme({
        name: 'Strength Training Programme',
        description: 'Complete strength and conditioning programme',
        duration: 60,
        difficulty: 'Intermediate',
        category: 'Strength',
        trainer: trainer._id,
        exercises: []
      });
      await programme.save();
      console.log('✅ Created sample programme');
    }

    console.log('\n🏋️  Creating sample training sessions...\n');

    // Create sessions (1 scheduled for tomorrow, 1 completed from yesterday)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(14, 0, 0, 0);

    const sessions = [
      {
        member: members[0]._id,
        trainer: trainer._id,
        programme: programme._id,
        session_start_time: tomorrow,
        status: 'scheduled',
        remarks: 'Focus on upper body strength'
      },
      {
        member: members[0]._id,
        trainer: trainer._id,
        programme: programme._id,
        session_start_time: yesterday,
        session_end_time: new Date(yesterday.getTime() + 60 * 60 * 1000),
        status: 'completed',
        live_rating: 5,
        remarks: 'Great workout session!',
        trainer_notes: 'Client showed excellent progress',
        submission_timestamp: yesterday
      }
    ];

    // Clear existing sessions for this trainer
    await TrainingSession.deleteMany({ trainer: trainer._id });
    console.log('🗑️  Cleared existing sessions');

    // Create new sessions
    for (const sessionData of sessions) {
      const session = new TrainingSession(sessionData);
      await session.save();
      const member = await User.findById(sessionData.member);
      console.log(`✅ Created ${sessionData.status} session with ${member.firstName} ${member.lastName}`);
      console.log(`   Date: ${sessionData.session_start_time.toLocaleString()}`);
    }

    console.log('\n✅ Sample sessions created successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Trainer: ${trainer.firstName} ${trainer.lastName}`);
    console.log(`   Scheduled Sessions: 1`);
    console.log(`   Completed Sessions: 1`);
    console.log('\n✅ You can now view these sessions in the trainer dashboard!');
    
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

createSampleSessions();




