const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { GymSession } = require('./models/GymSession');
const User = require('./models/User');

const server = http.createServer();
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

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
    } else if (role === 'member') {
      socket.join(`member-${userId}`);
      activeConnections.set(socket.id, { userId, role, room: `member-${userId}` });
    }
    
    console.log(`User ${userId} joined room for role: ${role}`);
  });

  // Handle check-in events
  socket.on('checkin', async (data) => {
    try {
      const { memberId, notes } = data;
      
      // Create session in database
      const session = new GymSession({
        member: memberId,
        checkInTime: new Date(),
        notes: notes || '',
        checkedInBy: data.checkedInBy || memberId
      });

      await session.save();
      await session.populate('member', 'firstName lastName email phone');

      // Broadcast to admin room
      io.to('admin-room').emit('session-update', {
        type: 'checkin',
        session: session,
        message: `${session.member.firstName} ${session.member.lastName} checked in`
      });

      // Notify specific member
      io.to(`member-${memberId}`).emit('session-update', {
        type: 'checkin',
        session: session,
        message: 'You have successfully checked in'
      });

      // Update active sessions count
      const activeSessions = await GymSession.find({ checkOutTime: null });
      io.to('admin-room').emit('active-sessions-update', {
        count: activeSessions.length,
        sessions: activeSessions
      });

    } catch (error) {
      console.error('Check-in error:', error);
      socket.emit('error', { message: 'Check-in failed' });
    }
  });

  // Handle check-out events
  socket.on('checkout', async (data) => {
    try {
      const { sessionId, notes } = data;
      
      const session = await GymSession.findById(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Calculate duration
      const checkInTime = new Date(session.checkInTime);
      const checkOutTime = new Date();
      const duration = Math.round((checkOutTime - checkInTime) / (1000 * 60));

      // Update session
      session.checkOutTime = checkOutTime;
      session.duration = duration;
      session.notes = session.notes + (notes ? ` | Check-out: ${notes}` : '');
      session.checkedOutBy = data.checkedOutBy || session.member;

      await session.save();
      await session.populate('member', 'firstName lastName email phone');

      // Broadcast to admin room
      io.to('admin-room').emit('session-update', {
        type: 'checkout',
        session: session,
        message: `${session.member.firstName} ${session.member.lastName} checked out`
      });

      // Notify specific member
      io.to(`member-${session.member._id}`).emit('session-update', {
        type: 'checkout',
        session: session,
        message: 'You have successfully checked out'
      });

      // Update active sessions count
      const activeSessions = await GymSession.find({ checkOutTime: null });
      io.to('admin-room').emit('active-sessions-update', {
        count: activeSessions.length,
        sessions: activeSessions
      });

    } catch (error) {
      console.error('Check-out error:', error);
      socket.emit('error', { message: 'Check-out failed' });
    }
  });

  // Handle session duration updates
  socket.on('update-duration', async (sessionId) => {
    try {
      const session = await GymSession.findById(sessionId);
      if (!session || session.checkOutTime) return;

      const duration = Math.round((new Date() - new Date(session.checkInTime)) / (1000 * 60));
      
      // Broadcast duration update
      io.to('admin-room').emit('duration-update', {
        sessionId: sessionId,
        duration: duration
      });

      io.to(`member-${session.member}`).emit('duration-update', {
        sessionId: sessionId,
        duration: duration
      });

    } catch (error) {
      console.error('Duration update error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeConnections.delete(socket.id);
  });
});

// Function to broadcast session updates to all connected clients
const broadcastSessionUpdate = (updateData) => {
  io.emit('session-update', updateData);
};

// Function to broadcast active sessions count
const broadcastActiveSessions = async () => {
  try {
    const activeSessions = await GymSession.find({ checkOutTime: null })
      .populate('member', 'firstName lastName email phone');
    
    io.to('admin-room').emit('active-sessions-update', {
      count: activeSessions.length,
      sessions: activeSessions
    });
  } catch (error) {
    console.error('Error broadcasting active sessions:', error);
  }
};

// Periodic updates for active sessions
setInterval(async () => {
  await broadcastActiveSessions();
}, 30000); // Update every 30 seconds

module.exports = { server, io, broadcastSessionUpdate, broadcastActiveSessions };
