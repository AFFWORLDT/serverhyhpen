const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

console.log('Starting MongoDB connection test...');
console.log('Mongoose version:', mongoose.version);
console.log('Node version:', process.version);

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  maxPoolSize: 1,
  retryWrites: true,
  w: 'majority',
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  maxIdleTimeMS: 30000
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  console.log('Connection state:', mongoose.connection.readyState);
  console.log('Database name:', mongoose.connection.db.databaseName);
  
  // Test a simple query
  return mongoose.connection.db.admin().ping();
})
.then(() => {
  console.log('✅ Database ping successful');
  process.exit(0);
})
.catch((error) => {
  console.error('❌ MongoDB Connection Error:', error.message);
  console.error('Error code:', error.code);
  console.error('Error name:', error.name);
  console.error('Error stack:', error.stack);
  process.exit(1);
});
