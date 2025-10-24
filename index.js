const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Configuration
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://localhost:3009", 
      "https://client-eight-azure-77.vercel.app",
      "https://hyphendubai.vercel.app",
      "https://*.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});
const PORT = 5001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000", 
      "http://localhost:3009", 
      "https://client-eight-azure-77.vercel.app",
      "https://hyphendubai.vercel.app",
      "https://hypgym-dubai.vercel.app",
      "https://hypgym-dubai-frontend.vercel.app",
      "https://hypgym-dubai-client.vercel.app",
      "https://hypgym-dubai-admin.vercel.app"
    ];
    
    // Check if origin is allowed or is a Vercel preview URL
    if (allowedOrigins.includes(origin) || 
        origin.includes('.vercel.app') || 
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true,
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With", 
    "Accept", 
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers"
  ],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Manual CORS headers for additional security
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow all Vercel domains
  if (!origin || 
      origin.includes('.vercel.app') || 
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      message: 'CORS Error: Origin not allowed',
      origin: req.headers.origin
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
});

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://affworldtechnologies:wMbiyR0ZM8JWfOYl@loc.6qmwn3p.mongodb.net/hypgymdubaiii';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  maxPoolSize: 10, // Maintain up to 10 socket connections
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
})
.catch((error) => {
  console.error('❌ MongoDB Connection Error:', error);
  console.error('Connection string:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs
  // Don't exit process, let the app continue
});

// MongoDB connection check middleware
const checkMongoConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database connection unavailable. Please try again later.',
      error: 'MongoDB not connected'
    });
  }
  next();
};

// Routes
app.use('/api/auth', checkMongoConnection, require('./routes/auth'));
app.use('/api/members', checkMongoConnection, require('./routes/members'));
app.use('/api/memberships', checkMongoConnection, require('./routes/memberships'));
app.use('/api/payments', checkMongoConnection, require('./routes/payments'));
app.use('/api/admin', checkMongoConnection, require('./routes/admin'));
app.use('/api/dashboard', checkMongoConnection, require('./routes/dashboard'));
app.use('/api/trainers', checkMongoConnection, require('./routes/trainers'));
app.use('/api/staff', checkMongoConnection, require('./routes/staff'));
app.use('/api/equipment', checkMongoConnection, require('./routes/equipment'));
app.use('/api/classes', checkMongoConnection, require('./routes/classes'));
app.use('/api/notifications', checkMongoConnection, require('./routes/notifications'));
app.use('/api/checkin', checkMongoConnection, require('./routes/checkin'));
app.use('/api/bookings', checkMongoConnection, require('./routes/bookings'));
app.use('/api/sessions', checkMongoConnection, require('./routes/sessions'));
app.use('/api/exercises', checkMongoConnection, require('./routes/exercises'));
app.use('/api/programmes', checkMongoConnection, require('./routes/programmes'));
app.use('/api/training-sessions', checkMongoConnection, require('./routes/training-sessions'));
app.use('/api/calendar', checkMongoConnection, require('./routes/calendar'));
app.use('/api/attendance', checkMongoConnection, require('./routes/attendance'));
app.use('/api/smtp', checkMongoConnection, require('./routes/smtp'));
app.use('/api/profile', checkMongoConnection, require('./routes/profile'));
app.use('/api/personal', checkMongoConnection, require('./routes/personal'));
app.use('/api/system', checkMongoConnection, require('./routes/system'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HypGym Dubai Backend API is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'HypGym Dubai Backend API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      members: '/api/members',
      trainers: '/api/trainers',
      staff: '/api/staff',
      equipment: '/api/equipment',
      classes: '/api/classes',
      sessions: '/api/sessions',
      exercises: '/api/exercises',
      programmes: '/api/programmes',
      clients: '/api/clients',
      trainingSessions: '/api/training-sessions',
      calendar: '/api/calendar',
      attendance: '/api/attendance',
      smtp: '/api/smtp',
      memberships: '/api/memberships',
      payments: '/api/payments',
      checkin: '/api/checkin',
      bookings: '/api/bookings',
      notifications: '/api/notifications',
      admin: '/api/admin',
      dashboard: '/api/dashboard'
    }
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'HypGym Dubai Server is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// WebSocket functionality
const { GymSession } = require('./models/GymSession');
const User = require('./models/User');

// Store active connections
const activeConnections = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their specific room based on role and ID
  socket.on('join-room', (data) => {
    const { userId, role } = data;
    
    if (role === 'admin') {
      socket.join('admin-room');
      activeConnections.set(socket.id, { userId, role, room: 'admin-room' });
    } else if (role === 'trainer') {
      socket.join('trainer-room');
      activeConnections.set(socket.id, { userId, role, room: 'trainer-room' });
    } else if (role === 'member') {
      socket.join(`member-${userId}`);
      activeConnections.set(socket.id, { userId, role, room: `member-${userId}` });
    }
    
    console.log(`User ${userId} (${role}) joined room`);
  });

  // Handle session updates
  socket.on('session-update', async (data) => {
    try {
      // Broadcast to admin and trainer rooms
      io.to('admin-room').to('trainer-room').emit('session-update', data);
      
      // If it's a member's session, notify them too
      if (data.memberId) {
        io.to(`member-${data.memberId}`).emit('session-update', data);
      }
    } catch (error) {
      console.error('Error broadcasting session update:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeConnections.delete(socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server running on port ${PORT}`);
});
