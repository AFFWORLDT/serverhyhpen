const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Programme = require('../models/Programme');
const ExerciseLibrary = require('../models/ExerciseLibrary');
const { auth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all programmes with pagination and filters
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { difficulty_level, created_by, search } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (difficulty_level) {
      filter.difficulty_level = difficulty_level;
    }
    
    if (created_by) {
      filter.created_by = created_by;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const programmes = await Programme.find(filter)
      .populate('created_by', 'firstName lastName email')
      .populate('exercises.exercise', 'name description muscle_group difficulty_level')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Programme.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        programmes,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching programmes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programmes',
      error: error.message
    });
  }
});

// Get programme by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID format'
      });
    }
    
    const programme = await Programme.findById(id)
      .populate('created_by', 'firstName lastName email')
      .populate('exercises.exercise', 'name description muscle_group difficulty_level equipment_required video_demo_url');
    
    if (!programme) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found'
      });
    }
    
    res.json({
      success: true,
      data: { programme }
    });
  } catch (error) {
    console.error('Error fetching programme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programme',
      error: error.message
    });
  }
});

// Create new programme (Trainer only)
router.post('/', auth, adminOrTrainerAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Programme name must be at least 2 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('duration_in_weeks').isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks'),
  body('exercises').isArray({ min: 1 }).withMessage('At least one exercise is required'),
  body('exercises.*.exercise').isMongoId().withMessage('Invalid exercise ID'),
  body('exercises.*.sets').optional().isInt({ min: 1 }).withMessage('Sets must be at least 1'),
  body('exercises.*.reps').optional().isString().withMessage('Reps must be a string'),
  body('exercises.*.duration_minutes').optional().isInt({ min: 0 }).withMessage('Duration must be non-negative'),
  body('exercises.*.rest_seconds').optional().isInt({ min: 0 }).withMessage('Rest time must be non-negative')
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
      description,
      duration_in_weeks,
      exercises,
      difficulty_level,
      target_muscle_groups,
      equipment_needed,
      tags
    } = req.body;
    
    // Validate that all exercises exist
    const exerciseIds = exercises.map(ex => ex.exercise);
    const existingExercises = await ExerciseLibrary.find({
      _id: { $in: exerciseIds },
      isActive: true
    });
    
    if (existingExercises.length !== exerciseIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more exercises not found or inactive'
      });
    }
    
    // Add order to exercises if not provided
    const exercisesWithOrder = exercises.map((ex, index) => ({
      ...ex,
      order: ex.order || index + 1
    }));
    
    const programme = new Programme({
      name,
      description,
      created_by: req.user.userId,
      exercises: exercisesWithOrder,
      duration_in_weeks,
      difficulty_level: difficulty_level || 'Beginner',
      target_muscle_groups: target_muscle_groups || [],
      equipment_needed: equipment_needed || [],
      tags: tags || []
    });
    
    await programme.save();
    
    // Populate the created programme
    await programme.populate([
      { path: 'created_by', select: 'firstName lastName email' },
      { path: 'exercises.exercise', select: 'name description muscle_group difficulty_level' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Programme created successfully',
      data: { programme }
    });
  } catch (error) {
    console.error('Error creating programme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create programme',
      error: error.message
    });
  }
});

// Update programme (Creator or Admin only)
router.put('/:id', auth, adminOrTrainerAuth, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Programme name must be at least 2 characters'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('duration_in_weeks').optional().isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks'),
  body('exercises').optional().isArray({ min: 1 }).withMessage('At least one exercise is required')
], async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID format'
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
    
    const programme = await Programme.findById(id);
    
    if (!programme) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found'
      });
    }
    
    // Check if user can update this programme (creator or admin)
    if (programme.created_by.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only update programmes you created'
      });
    }
    
    // If exercises are being updated, validate them
    if (req.body.exercises) {
      const exerciseIds = req.body.exercises.map(ex => ex.exercise);
      const existingExercises = await ExerciseLibrary.find({
        _id: { $in: exerciseIds },
        isActive: true
      });
      
      if (existingExercises.length !== exerciseIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more exercises not found or inactive'
        });
      }
      
      // Add order to exercises if not provided
      req.body.exercises = req.body.exercises.map((ex, index) => ({
        ...ex,
        order: ex.order || index + 1
      }));
    }
    
    const updatedProgramme = await Programme.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate([
      { path: 'created_by', select: 'firstName lastName email' },
      { path: 'exercises.exercise', select: 'name description muscle_group difficulty_level' }
    ]);
    
    res.json({
      success: true,
      message: 'Programme updated successfully',
      data: { programme: updatedProgramme }
    });
  } catch (error) {
    console.error('Error updating programme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update programme',
      error: error.message
    });
  }
});

// Delete programme (Creator or Admin only)
router.delete('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid programme ID format'
      });
    }
    
    const programme = await Programme.findById(id);
    
    if (!programme) {
      return res.status(404).json({
        success: false,
        message: 'Programme not found'
      });
    }
    
    // Check if user can delete this programme (creator or admin)
    if (programme.created_by.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete programmes you created'
      });
    }
    
    await Programme.findByIdAndUpdate(id, { isActive: false });
    
    res.json({
      success: true,
      message: 'Programme deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting programme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete programme',
      error: error.message
    });
  }
});

// Get programmes by trainer
router.get('/trainer/:trainerId', auth, async (req, res) => {
  try {
    const { trainerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(trainerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trainer ID format'
      });
    }
    
    const programmes = await Programme.find({
      created_by: trainerId,
      isActive: true
    })
    .populate('created_by', 'firstName lastName email')
    .populate('exercises.exercise', 'name description muscle_group difficulty_level')
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: { programmes }
    });
  } catch (error) {
    console.error('Error fetching trainer programmes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainer programmes',
      error: error.message
    });
  }
});

// Get programme statistics
router.get('/stats/overview', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const totalProgrammes = await Programme.countDocuments({ isActive: true });
    
    const difficultyStats = await Programme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty_level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const durationStats = await Programme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$duration_in_weeks', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    const trainerStats = await Programme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$created_by', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'trainer' } },
      { $unwind: '$trainer' },
      { $project: { trainerName: { $concat: ['$trainer.firstName', ' ', '$trainer.lastName'] }, count: 1 } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalProgrammes,
        difficultyStats,
        durationStats,
        trainerStats
      }
    });
  } catch (error) {
    console.error('Error fetching programme stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programme statistics',
      error: error.message
    });
  }
});

// Get programme statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const totalProgrammes = await Programme.countDocuments({ isActive: true });
    
    const difficultyStats = await Programme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty_level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const durationStats = await Programme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$duration_in_weeks', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    const trainerStats = await Programme.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$created_by', count: { $sum: 1 } } },
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
        totalProgrammes,
        difficultyStats,
        durationStats,
        trainerStats
      }
    });
  } catch (error) {
    console.error('Error fetching programme stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programme statistics',
      error: error.message
    });
  }
});
module.exports = router;
