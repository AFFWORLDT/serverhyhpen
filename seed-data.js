const mongoose = require('mongoose');
const SMTPSettings = require('./models/SMTPSettings');
const User = require('./models/User');
const Package = require('./models/Package');
const MemberPackage = require('./models/MemberPackage');

async function seedSMTP() {
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

    await mongoose.connect(MONGODB_URI);

  await SMTPSettings.updateMany({ isActive: true }, { isActive: false });

  const settings = new SMTPSettings({
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    username: 'train@hyphendxb.ae',
    password: 'Dubai@2025#',
    fromEmail: 'train@hyphendxb.ae',
    fromName: 'Hyphen',
    testEmail: 'train@hyphendxb.ae',
    createdBy: new mongoose.Types.ObjectId(),
    updatedBy: new mongoose.Types.ObjectId()
  });

  await settings.save();
  console.log('✅ Seeded SMTP settings for Zoho');
  await mongoose.disconnect();
  console.log('✅ SMTP completed');
}

async function seedUsersAndMemberships() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';
  await mongoose.connect(MONGODB_URI);

  const now = new Date();
  const validityStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const validityEnd = new Date(validityStart);
  validityEnd.setMonth(validityEnd.getMonth() + 3);

  // Ensure trainer user exists
  let trainer = await User.findOne({ email: 'trainer@hyphen.com' });
  if (!trainer) {
    trainer = new User({
      firstName: 'Demo',
      lastName: 'Trainer',
      email: 'trainer@hyphen.com',
      phone: '0500000001',
      password: 'trainer123',
      role: 'trainer'
    });
    await trainer.save();
    console.log('✅ Created trainer@hyphen.com');
  }

  // Ensure member user exists
  let member = await User.findOne({ email: 'testmember@hyphen.com' });
  if (!member) {
    member = new User({
      firstName: 'Test',
      lastName: 'Member',
      email: 'testmember@hyphen.com',
      phone: '0500000002',
      password: 'test123',
      role: 'member'
    });
  }

  member.assignedTrainer = trainer._id;
  member.membershipValidityStart = validityStart;
  member.membershipValidityEnd = validityEnd;
  member.sessionsTotal = 12;
  member.sessionsUsed = 0;
  await member.save();
  console.log('✅ Seeded member membership and trainer assignment');

  await mongoose.disconnect();
  console.log('✅ Users/memberships completed');
}

async function seedPackages() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';
  await mongoose.connect(MONGODB_URI);

  // Check if packages already exist
  const existingCount = await Package.countDocuments();
  if (existingCount > 0) {
    console.log(`ℹ️ ${existingCount} packages already exist, skipping seed`);
    await mongoose.disconnect();
    return;
  }

  // Based on pricing table from the PDF
  const packages = [
    {
      name: 'Single Session',
      description: 'Perfect for trying out our services',
      sessions: 1,
      pricePerSession: 350,
      totalPrice: 350,
      validityMonths: 0, // No expiry for single session
      category: 'starter',
      displayOrder: 1,
      features: ['One-time session', 'No commitment', 'Full gym access']
    },
    {
      name: '12 Sessions Package',
      description: 'Great starter package for beginners',
      sessions: 12,
      pricePerSession: 320,
      totalPrice: 3840,
      validityMonths: 1,
      category: 'basic',
      displayOrder: 2,
      features: ['12 training sessions', '1 month validity', 'Personalized program', 'Progress tracking']
    },
    {
      name: '25 Sessions Package',
      description: 'Popular choice for committed members',
      sessions: 25,
      pricePerSession: 300,
      totalPrice: 7500,
      validityMonths: 3,
      category: 'premium',
      displayOrder: 3,
      features: ['25 training sessions', '3 months validity', 'Advanced programming', 'Nutrition guidance', 'Priority booking']
    },
    {
      name: '50 Sessions Package',
      description: 'Best value for serious fitness enthusiasts',
      sessions: 50,
      pricePerSession: 270,
      totalPrice: 13500,
      validityMonths: 4,
      category: 'platinum',
      displayOrder: 4,
      features: ['50 training sessions', '4 months validity', 'Comprehensive program', 'Full nutrition plan', 'Priority support', 'Flexible scheduling']
    },
    {
      name: '100 Sessions Package',
      description: 'Ultimate package for maximum commitment',
      sessions: 100,
      pricePerSession: 235,
      totalPrice: 23500,
      validityMonths: 7,
      category: 'platinum',
      displayOrder: 5,
      features: ['100 training sessions', '7 months validity', 'Elite programming', 'Complete nutrition coaching', 'VIP treatment', 'Maximum flexibility', 'Free merchandise']
    }
  ];

  await Package.insertMany(packages);
  console.log(`✅ Seeded ${packages.length} packages`);

  await mongoose.disconnect();
  console.log('✅ Packages completed');
}

async function assignPackageToMember() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';
  await mongoose.connect(MONGODB_URI);

  // Find test member and 12 sessions package
  const member = await User.findOne({ email: 'testmember@hyphen.com' });
  const package12 = await Package.findOne({ sessions: 12 });
  
  if (!member || !package12) {
    console.log('ℹ️ Member or package not found, skipping package assignment');
    await mongoose.disconnect();
    return;
  }

  // Check if already assigned
  const existingPackage = await MemberPackage.findOne({
    member: member._id,
    status: 'active'
  });

  if (existingPackage) {
    console.log('ℹ️ Member already has active package, skipping');
    await mongoose.disconnect();
    return;
  }

  // Calculate validity dates
  const validityStart = new Date();
  validityStart.setHours(0, 0, 0, 0);
  const validityEnd = new Date(validityStart);
  validityEnd.setMonth(validityEnd.getMonth() + package12.validityMonths);

  // Create member package
  const memberPackage = new MemberPackage({
    member: member._id,
    package: package12._id,
    sessionsTotal: package12.sessions,
    sessionsUsed: 0,
    sessionsRemaining: package12.sessions,
    validityStart,
    validityEnd,
    status: 'active',
    amountPaid: package12.totalPrice,
    paymentMethod: 'cash',
    assignedTrainer: member.assignedTrainer
  });

  await memberPackage.save();
  console.log(`✅ Assigned "${package12.name}" to ${member.email}`);

  await mongoose.disconnect();
  console.log('✅ Member package assignment completed');
}

async function run() {
  try {
    await seedSMTP();
    await seedUsersAndMemberships();
    await seedPackages();
    await assignPackageToMember();
    console.log('✅ All seeds finished');
  } catch (e) {
    console.error('❌ Seed error:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}