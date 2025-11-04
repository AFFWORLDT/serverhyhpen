const mongoose = require('mongoose');
const User = require('./models/User');
const ExerciseLibrary = require('./models/ExerciseLibrary');
const Programme = require('./models/Programme');
const TrainingSession = require('./models/TrainingSession');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

async function setupTrainerComplete() {
  try {
    console.log('🏋️  Hyphen Wellness - TRAINER COMPLETE SETUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check admin exists
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ Admin not found. Please run create-admin.js first.');
      process.exit(1);
    }
    console.log(`✅ Admin user found: ${admin.email}\n`);

    // Count existing data
    const existingExercises = await ExerciseLibrary.countDocuments();
    const existingProgrammes = await Programme.countDocuments();
    const existingTrainers = await User.countDocuments({ role: 'trainer' });
    const existingMembers = await User.countDocuments({ role: 'member' });
    const existingSessions = await TrainingSession.countDocuments();

    console.log('📊 Current Database Status:');
    console.log(`   Exercises: ${existingExercises}`);
    console.log(`   Programmes: ${existingProgrammes}`);
    console.log(`   Trainers: ${existingTrainers}`);
    console.log(`   Members: ${existingMembers}`);
    console.log(`   Training Sessions: ${existingSessions}`);
    console.log('');

    // Summary
    console.log('\n✅ SETUP COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n📚 EXERCISE LIBRARY:');
    console.log(`   Total Exercises: ${existingExercises}`);
    const exercisesByMuscle = await ExerciseLibrary.aggregate([
      { $group: { _id: '$muscle_group', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    exercisesByMuscle.forEach(m => {
      console.log(`   - ${m._id}: ${m.count} exercises`);
    });

    console.log('\n🏋️  TRAINING PROGRAMMES:');
    console.log(`   Total Programmes: ${existingProgrammes}`);
    const programmesByLevel = await Programme.aggregate([
      { $group: { _id: '$difficulty_level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    programmesByLevel.forEach(l => {
      console.log(`   - ${l._id}: ${l.count} programmes`);
    });

    console.log('\n👥 TRAINERS:');
    const trainers = await User.find({ role: 'trainer', isActive: true })
      .select('firstName lastName email specialization');
    console.log(`   Total Trainers: ${trainers.length}`);
    trainers.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.firstName} ${t.lastName} - ${t.specialization}`);
      console.log(`      Email: ${t.email} | Password: trainer123`);
    });

    console.log('\n👤 MEMBERS:');
    const members = await User.find({ role: 'member', isActive: true })
      .select('firstName lastName email assignedTrainer')
      .populate('assignedTrainer', 'firstName lastName');
    console.log(`   Total Members: ${members.length}`);
    members.slice(0, 5).forEach((m, i) => {
      const trainerName = m.assignedTrainer ? `${m.assignedTrainer.firstName} ${m.assignedTrainer.lastName}` : 'Unassigned';
      console.log(`   ${i + 1}. ${m.firstName} ${m.lastName} - Trainer: ${trainerName}`);
    });
    if (members.length > 5) {
      console.log(`   ... and ${members.length - 5} more members`);
    }

    console.log('\n📅 TRAINING SESSIONS:');
    console.log(`   Total Sessions: ${existingSessions}`);
    const sessionsByStatus = await TrainingSession.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    sessionsByStatus.forEach(s => {
      console.log(`   - ${s._id}: ${s.count} sessions`);
    });

    console.log('\n🚀 QUICK START GUIDE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n1. Start the servers:');
    console.log('   cd /path/to/project && npm run dev');
    console.log('\n2. Login as trainer:');
    console.log('   Go to: http://localhost:3000/login');
    console.log('   Email: john.trainer@hyphen.com');
    console.log('   Password: trainer123');
    console.log('\n3. Explore trainer features:');
    console.log('   - Dashboard: /trainer-dashboard');
    console.log('   - My Members: /trainer-my-members');
    console.log('   - My Sessions: /trainer-my-sessions');
    console.log('   - Analytics: /trainer-analytics');
    console.log('   - Exercise Library: /exercises');
    console.log('   - Training Programmes: /programmes');
    console.log('\n4. Create training sessions:');
    console.log('   - Navigate to /training-sessions');
    console.log('   - Click "Schedule Session"');
    console.log('   - Select member, programme, and date/time');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
    console.log('✅ Setup verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

setupTrainerComplete();


