const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Programme = require('../models/Programme');
const TrainingSession = require('../models/TrainingSession');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all clients with pagination
router.get('/', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { trainer, assigned_programme, fitness_level, search } = req.query;
    
    let filter = { role: 'member' };
    
    // Trainer can only see their clients
    if (req.user.role === 'trainer') {
      filter.trainer = req.user.userId;
    }
    
    // Admin filters
    if (trainer) filter.trainer = trainer;
    if (assigned_programme) filter.assigned_programme = assigned_programme;
    if (fitness_level) filter.fitness_level = fitness_level;
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const clients = await User.find(filter)
      .populate('trainer', 'firstName lastName email')
      .populate('assigned_programme', 'name duration_in_weeks')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(filter);
    
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
      message: 'Failed to fetch clients'
    });
  }
});

// Get client by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const client = await User.findById(req.params.id)
      .populate('trainer', 'firstName lastName email phone')
      .populate('assigned_programme', 'name description duration_in_weeks exercises')
      .select('-password');
    
    if (!client || client.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check authorization
    if (req.user.role === 'trainer' && client.trainer?.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
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
      message: 'Failed to fetch client'
    });
  }
});

// Create new client
router.post('/', auth, adminOrTrainerAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').isLength({ min: 10 }).withMessage('Phone number must be at least 10 digits'),
  body('trainer').isMongoId().withMessage('Please select a valid trainer'),
  body('fitness_level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']),
  body('assigned_programme').optional().isMongoId()
], async (req, res) => {
  try {
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
      trainer,
      assigned_programme,
      fitness_level,
      goals,
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
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Verify trainer exists
    const trainerExists = await User.findById(trainer);
    if (!trainerExists || trainerExists.role !== 'trainer') {
      return res.status(400).json({
        success: false,
        message: 'Invalid trainer selected'
      });
    }
    
    // Parse name into firstName and lastName
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Create client
    const client = new User({
      firstName,
      lastName,
      email,
      phone,
      role: 'member',
      trainer,
      assigned_programme: assigned_programme || null,
      fitness_level: fitness_level || 'Beginner',
      goals: Array.isArray(goals) ? goals : (goals ? [goals] : []),
      medical_conditions: Array.isArray(medical_conditions) ? medical_conditions : (medical_conditions ? [medical_conditions] : []),
      allergies: Array.isArray(allergies) ? allergies : (allergies ? [allergies] : []),
      emergency_contact: emergency_contact || {},
      current_weight: current_weight ? parseFloat(current_weight) : null,
      target_weight: target_weight ? parseFloat(target_weight) : null,
      height: height ? parseFloat(height) : null,
      age: age ? parseInt(age) : null,
      gender: gender || '',
      notes: notes || '',
      isActive: true,
      password: 'TemporaryPassword123!' // Default password, should be changed on first login
    });
    
    await client.save();
    
    const populatedClient = await User.findById(client._id)
      .populate('trainer', 'firstName lastName email')
      .populate('assigned_programme', 'name duration_in_weeks')
      .select('-password');
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: { client: populatedClient }
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

// Update client
router.put('/:id', auth, adminOrTrainerAuth, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('phone').optional().isLength({ min: 10 }),
  body('trainer').optional().isMongoId(),
  body('fitness_level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']),
  body('assigned_programme').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const client = await User.findById(req.params.id);
    
    if (!client || client.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check authorization
    if (req.user.role === 'trainer' && client.trainer?.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const {
      name,
      email,
      phone,
      trainer,
      assigned_programme,
      fitness_level,
      goals,
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
    
    // Update name if provided
    if (name) {
      const nameParts = name.trim().split(' ');
      client.firstName = nameParts[0] || client.firstName;
      client.lastName = nameParts.slice(1).join(' ') || client.lastName;
    }
    
    // Check email uniqueness if changed
    if (email && email !== client.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      client.email = email;
    }
    
    // Update fields
    if (phone !== undefined) client.phone = phone;
    if (trainer !== undefined) client.trainer = trainer;
    if (assigned_programme !== undefined) client.assigned_programme = assigned_programme || null;
    if (fitness_level !== undefined) client.fitness_level = fitness_level;
    if (goals !== undefined) client.goals = Array.isArray(goals) ? goals : (goals ? [goals] : []);
    if (medical_conditions !== undefined) client.medical_conditions = Array.isArray(medical_conditions) ? medical_conditions : (medical_conditions ? [medical_conditions] : []);
    if (allergies !== undefined) client.allergies = Array.isArray(allergies) ? allergies : (allergies ? [allergies] : []);
    if (emergency_contact !== undefined) client.emergency_contact = emergency_contact;
    if (current_weight !== undefined) client.current_weight = current_weight ? parseFloat(current_weight) : null;
    if (target_weight !== undefined) client.target_weight = target_weight ? parseFloat(target_weight) : null;
    if (height !== undefined) client.height = height ? parseFloat(height) : null;
    if (age !== undefined) client.age = age ? parseInt(age) : null;
    if (gender !== undefined) client.gender = gender;
    if (notes !== undefined) client.notes = notes;
    
    await client.save();
    
    const updatedClient = await User.findById(client._id)
      .populate('trainer', 'firstName lastName email')
      .populate('assigned_programme', 'name duration_in_weeks')
      .select('-password');
    
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

// Delete client
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    
    if (!client || client.role !== 'member') {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Check if client has active sessions or memberships
    const activeSessions = await TrainingSession.countDocuments({
      member: client._id,
      status: { $in: ['scheduled', 'in_progress'] }
    });
    
    if (activeSessions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete client with active training sessions'
      });
    }
    
    // Soft delete - set isActive to false
    client.isActive = false;
    await client.save();
    
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

// Get client statistics
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalClients = await User.countDocuments({ role: 'member', isActive: true });
    
    const fitnessLevelStats = await User.aggregate([
      { $match: { role: 'member', isActive: true } },
      { $group: { _id: '$fitness_level', count: { $sum: 1 } } }
    ]);
    
    const programmeStats = await User.aggregate([
      { $match: { role: 'member', isActive: true, assigned_programme: { $ne: null } } },
      {
        $group: {
          _id: '$assigned_programme',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'programmes',
          localField: '_id',
          foreignField: '_id',
          as: 'programme'
        }
      },
      { $unwind: '$programme' }
    ]);
    
    const trainerStats = await User.aggregate([
      { $match: { role: 'member', isActive: true, trainer: { $ne: null } } },
      {
        $group: {
          _id: '$trainer',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'trainer'
        }
      },
      { $unwind: '$trainer' }
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
      message: 'Failed to fetch client statistics'
    });
  }
});

module.exports = router;







