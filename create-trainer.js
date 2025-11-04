const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii?retryWrites=true&w=majority';

async function createTrainer() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Trainer data
    const trainers = [
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.trainer@hyphen.com',
        password: 'trainer123',
        phone: '0501234567',
        role: 'trainer',
        dateOfBirth: new Date('1988-05-15'),
        gender: 'male',
        specialization: 'Strength & Conditioning',
        experience: 8,
        certification: 'NASM-CPT, CrossFit Level 2',
        hourlyRate: 250,
        address: {
          street: '123 Fitness Street',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '12345',
          country: 'UAE'
        },
        emergencyContact: {
          name: 'Jane Smith',
          phone: '0509876543',
          relationship: 'Spouse'
        },
        isActive: true
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.trainer@hyphen.com',
        password: 'trainer123',
        phone: '0502345678',
        role: 'trainer',
        dateOfBirth: new Date('1992-08-22'),
        gender: 'female',
        specialization: 'Yoga & Pilates',
        experience: 5,
        certification: 'RYT-500, PMA-CPT',
        hourlyRate: 200,
        address: {
          street: '456 Wellness Ave',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '12346',
          country: 'UAE'
        },
        emergencyContact: {
          name: 'Mike Johnson',
          phone: '0508765432',
          relationship: 'Brother'
        },
        isActive: true
      },
      {
        firstName: 'Ahmed',
        lastName: 'Hassan',
        email: 'ahmed.trainer@hyphen.com',
        password: 'trainer123',
        phone: '0503456789',
        role: 'trainer',
        dateOfBirth: new Date('1985-03-10'),
        gender: 'male',
        specialization: 'Cardio & Weight Loss',
        experience: 10,
        certification: 'ACE-CPT, Precision Nutrition Level 1',
        hourlyRate: 280,
        address: {
          street: '789 Health Road',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '12347',
          country: 'UAE'
        },
        emergencyContact: {
          name: 'Fatima Hassan',
          phone: '0507654321',
          relationship: 'Spouse'
        },
        isActive: true
      },
      {
        firstName: 'Maria',
        lastName: 'Rodriguez',
        email: 'maria.trainer@hyphen.com',
        password: 'trainer123',
        phone: '0504567890',
        role: 'trainer',
        dateOfBirth: new Date('1990-11-18'),
        gender: 'female',
        specialization: 'HIIT & Functional Training',
        experience: 6,
        certification: 'ISSA-CFT, TRX Certified',
        hourlyRate: 220,
        address: {
          street: '321 Active Lane',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '12348',
          country: 'UAE'
        },
        emergencyContact: {
          name: 'Carlos Rodriguez',
          phone: '0506543210',
          relationship: 'Father'
        },
        isActive: true
      },
      {
        firstName: 'David',
        lastName: 'Chen',
        email: 'david.trainer@hyphen.com',
        password: 'trainer123',
        phone: '0505678901',
        role: 'trainer',
        dateOfBirth: new Date('1987-07-25'),
        gender: 'male',
        specialization: 'Bodybuilding & Nutrition',
        experience: 12,
        certification: 'IFBB Pro, Precision Nutrition Level 2',
        hourlyRate: 300,
        address: {
          street: '654 Muscle Street',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '12349',
          country: 'UAE'
        },
        emergencyContact: {
          name: 'Linda Chen',
          phone: '0505432109',
          relationship: 'Spouse'
        },
        isActive: true
      }
    ];

    console.log('🏋️ Creating/Updating Trainers...\n');

    for (const trainerData of trainers) {
      // Check if trainer already exists
      let trainer = await User.findOne({ email: trainerData.email });
      
      if (trainer) {
        console.log(`✅ Trainer ${trainerData.firstName} ${trainerData.lastName} already exists`);
        console.log(`   Email: ${trainer.email}`);
        console.log(`   Specialization: ${trainer.specialization}`);
        
        // Update trainer data
        Object.assign(trainer, trainerData);
        await trainer.save();
        console.log(`   ✅ Updated trainer profile\n`);
      } else {
        console.log(`➕ Creating new trainer: ${trainerData.firstName} ${trainerData.lastName}`);
        trainer = new User(trainerData);
        await trainer.save();
        console.log(`   ✅ Created successfully`);
        console.log(`   Email: ${trainerData.email}`);
        console.log(`   Password: trainer123`);
        console.log(`   Specialization: ${trainerData.specialization}`);
        console.log(`   Hourly Rate: AED ${trainerData.hourlyRate}\n`);
      }
    }

    console.log('\n✅ All trainers processed successfully!');
    console.log('\n📋 Trainer Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    trainers.forEach((trainer, index) => {
      console.log(`${index + 1}. ${trainer.firstName} ${trainer.lastName}`);
      console.log(`   Email: ${trainer.email}`);
      console.log(`   Password: trainer123`);
      console.log(`   Specialization: ${trainer.specialization}`);
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
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

createTrainer();




