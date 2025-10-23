const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Client = require('../models/Client');
const Programme = require('../models/Programme');
const TrainingSession = require('../models/TrainingSession');
const { auth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all clients with pagination and filters
router.get('/', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { trainer, assigned_programme, fitness_level, search } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    
    // If user is trainer, only show their clients
    if (req.user.role === 'trainer') {
      filter.trainer = req.user.userId;
    } else if (trainer) {
      filter.trainer = trainer;
    }
    
    if (assigned_programme) {
      filter.assigned_programme = assigned_programme;
    }
    
    if (fitness_level) {
      filter.fitness_level = fitness_level;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const clients = await Client.find(filter)
      .populate('trainer', 'firstName lastName email')
      .populate('assigned_programme', 'name description duration_in_weeks')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Client.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        clients,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
      error: error.message
    });
  }
});

// Get client by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }
    
    const client = await Client.findById(id)
      .populate('trainer', 'firstName lastName email')
      .populate('assigned_programme', 'name description duration_in_weeks exercises');
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if user can view this client (trainer can only view their own clients)
    if (req.user.role === 'trainer' && client.trainer._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own clients'
      });
    }
    
    res.json({
      success: true,
      data: { client }
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client',
      error: error.message
    });
  }
});

// Create new client (Trainer only)
router.post('/', auth, adminOrTrainerAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Client name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('assigned_programme').optional().isMongoId().withMessage('Invalid programme ID'),
  body('start_date').optional().isISO8601().withMessage('Please provide a valid start date'),
  body('fitness_level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Please select a valid fitness level')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      name,
      email,
      phone,
      assigned_programme,
      start_date,
      goals,
      fitness_level,
      medical_conditions,
      allergies,
      emergency_contact,
      current_weight,
      target_weight,
      height,
      age,
      gender,
      notes
    } = req.body;
    
    // Check if email already exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Client with this email already exists'
      });
    }
    
    // Validate programme if provided
    if (assigned_programme) {
      const programme = await Programme.findById(assigned_programme);
      if (!programme) {
        return res.status(400).json({
          success: false,
          message: 'Programme not found'
        });
      }
    }
    
    const client = new Client({
      name,
      email,
      phone,
      trainer: req.user.userId,
      assigned_programme: assigned_programme || null,
      start_date: start_date || new Date(),
      goals: goals || [],
      fitness_level: fitness_level || 'Beginner',
      medical_conditions: medical_conditions || [],
      allergies: allergies || [],
      emergency_contact: emergency_contact || null,
      current_weight: current_weight || null,
      target_weight: target_weight || null,
      height: height || null,
      age: age || null,
      gender: gender || null,
      notes: notes || ''
    });
    
    await client.save();
    
    // Populate the created client
    await client.populate([
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'assigned_programme', select: 'name description duration_in_weeks' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: { client }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: error.message
    });
  }
});

// Update client (Trainer or Admin only)
router.put('/:id', auth, adminOrTrainerAuth, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Client name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('assigned_programme').optional().isMongoId().withMessage('Invalid programme ID'),
  body('start_date').optional().isISO8601().withMessage('Please provide a valid start date'),
  body('fitness_level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Please select a valid fitness level')
], async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if user can update this client (trainer can only update their own clients)
    if (req.user.role === 'trainer' && client.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own clients'
      });
    }
    
    // Validate programme if being updated
    if (req.body.assigned_programme) {
      const programme = await Programme.findById(req.body.assigned_programme);
      if (!programme) {
        return res.status(400).json({
          success: false,
          message: 'Programme not found'
        });
      }
    }
    
    const updatedClient = await Client.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'assigned_programme', select: 'name description duration_in_weeks' }
    ]);
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      data: { client: updatedClient }
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client',
      error: error.message
    });
  }
});

// Delete client (Trainer or Admin only)
router.delete('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }
    
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if user can delete this client (trainer can only delete their own clients)
    if (req.user.role === 'trainer' && client.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own clients'
      });
    }
    
    await Client.findByIdAndUpdate(id, { isActive: false });
    
    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
      error: error.message
    });
  }
});

// Assign programme to client
router.post('/:id/assign-programme', auth, adminOrTrainerAuth, [
  body('programme_id').isMongoId().withMessage('Invalid programme ID'),
  body('start_date').optional().isISO8601().withMessage('Please provide a valid start date')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { programme_id, start_date } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }
    
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if user can update this client
    if (req.user.role === 'trainer' && client.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own clients'
      });
    }
    
    const programme = await Programme.findById(programme_id);
    
    if (!programme) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found'
      });
    }
    
    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (programme.duration_in_weeks * 7));
    
    client.assigned_programme = programme_id;
    client.start_date = startDate;
    client.end_date = endDate;
    
    await client.save();
    
    await client.populate([
      { path: 'trainer', select: 'firstName lastName email' },
      { path: 'assigned_programme', select: 'name description duration_in_weeks' }
    ]);
    
    res.json({
      success: true,
      message: 'Programme assigned successfully',
      data: { client }
    });
  } catch (error) {
    console.error('Error assigning programme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign programme',
      error: error.message
    });
  }
});

// Get client sessions
router.get('/:id/sessions', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, start_date, end_date } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }
    
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if user can view this client's sessions
    if (req.user.role === 'trainer' && client.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own clients\' sessions'
      });
    }
    
    const filter = { client: id };
    
    if (status) {
      filter.status = status;
    }
    
    if (start_date || end_date) {
      filter.session_start_time = {};
      if (start_date) {
        filter.session_start_time.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.session_start_time.$lte = new Date(end_date);
      }
    }
    
    const sessions = await TrainingSession.find(filter)
      .populate('trainer', 'firstName lastName email')
      .populate('programme', 'name description')
      .sort({ session_start_time: -1 });
    
    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error fetching client sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client sessions',
      error: error.message
    });
  }
});

// Get client statistics
router.get('/:id/stats', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID format'
      });
    }
    
    const client = await Client.findById(id);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if user can view this client's stats
    if (req.user.role === 'trainer' && client.trainer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own clients\' statistics'
      });
    }
    
    const totalSessions = await TrainingSession.countDocuments({ client: id });
    const completedSessions = await TrainingSession.countDocuments({ 
      client: id, 
      status: 'completed' 
    });
    const averageRating = await TrainingSession.aggregate([
      { $match: { client: mongoose.Types.ObjectId(id), status: 'completed', live_rating: { $exists: true } } },
      { $group: { _id: null, avgRating: { $avg: '$live_rating' } } }
    ]);
    
    const recentSessions = await TrainingSession.find({ client: id })
      .populate('trainer', 'firstName lastName')
      .populate('programme', 'name')
      .sort({ session_start_time: -1 })
      .limit(5);
    
    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        averageRating: averageRating.length > 0 ? Math.round(averageRating[0].avgRating * 10) / 10 : 0,
        recentSessions
      }
    });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client statistics',
      error: error.message
    });
  }
});

// Get client statistics
router.get('/stats', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'trainer') {
      filter.trainer = req.user.userId;
    }
    
    const totalClients = await Client.countDocuments({ ...filter, isActive: true });
    
    const fitnessLevelStats = await Client.aggregate([
      { $match: { ...filter, isActive: true } },
      { $group: { _id: '$fitness_level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const programmeStats = await Client.aggregate([
      { $match: { ...filter, isActive: true } },
      { $group: { 
        _id: { $ifNull: ['$assigned_programme', 'unassigned'] }, 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } }
    ]);
    
    const trainerStats = await Client.aggregate([
      { $match: { ...filter, isActive: true } },
      { $group: { _id: '$trainer', count: { $sum: 1 } } },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'trainer'
      }},
      { $unwind: '$trainer' },
      { $project: {
        trainerName: { $concat: ['$trainer.firstName', ' ', '$trainer.lastName'] },
        count: 1
      }},
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalClients,
        fitnessLevelStats,
        programmeStats,
        trainerStats
      }
    });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client statistics',
      error: error.message
    });
  }
});
module.exports = router;
