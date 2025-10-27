const mongoose = require('mongoose');

// Test MongoDB connection
const MONGODB_URI = 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

console.log('Testing MongoDB connection...');
console.log('URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority',
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  console.log('Database name:', mongoose.connection.db.databaseName);
  console.log('Connection state:', mongoose.connection.readyState);
  process.exit(0);
})
.catch((error) => {
  console.error('❌ MongoDB Connection Error:', error.message);
  console.error('Error code:', error.code);
  console.error('Error name:', error.name);
  console.error('Full error:', error);
  process.exit(1);
});


// Test MongoDB connection
const MONGODB_URI = 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

console.log('Testing MongoDB connection...');
console.log('URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority',
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  console.log('Database name:', mongoose.connection.db.databaseName);
  console.log('Connection state:', mongoose.connection.readyState);
  process.exit(0);
})
.catch((error) => {
  console.error('❌ MongoDB Connection Error:', error.message);
  console.error('Error code:', error.code);
  console.error('Error name:', error.name);
  console.error('Full error:', error);
  process.exit(1);
});

