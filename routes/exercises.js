const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const ExerciseLibrary = require('../models/ExerciseLibrary');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

const router = express.Router();

// Get all exercises with pagination and filters
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { muscle_group, difficulty_level, equipment_required, search } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (muscle_group) {
      filter.muscle_group = muscle_group;
    }
    
    if (difficulty_level) {
      filter.difficulty_level = difficulty_level;
    }
    
    if (equipment_required !== undefined) {
      filter.equipment_required = equipment_required === 'true';
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const exercises = await ExerciseLibrary.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await ExerciseLibrary.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        exercises,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exercises',
      error: error.message
    });
  }
});

// Get exercise by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exercise ID format'
      });
    }
    
    const exercise = await ExerciseLibrary.findById(id);
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }
    
    res.json({
      success: true,
      data: { exercise }
    });
  } catch (error) {
    console.error('Error fetching exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exercise',
      error: error.message
    });
  }
});

// Create new exercise (Admin/Trainer only)
router.post('/', auth, adminOrTrainerAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Exercise name must be at least 2 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('muscle_group').isIn([
    'chest', 'back', 'shoulders', 'arms', 'legs', 
    'glutes', 'core', 'cardio', 'full_body', 'other'
  ]).withMessage('Please select a valid muscle group'),
  body('difficulty_level').isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Please select a valid difficulty level'),
  body('equipment_required').optional().isBoolean().withMessage('Equipment required must be boolean'),
  body('video_demo_url').optional().isURL().withMessage('Please provide a valid video URL')
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
      muscle_group,
      equipment_required,
      difficulty_level,
      video_demo_url,
      instructions,
      tips,
      calories_burned_per_minute
    } = req.body;
    
    const exercise = new ExerciseLibrary({
      name,
      description,
      muscle_group,
      equipment_required: equipment_required || false,
      difficulty_level,
      video_demo_url,
      instructions: instructions || [],
      tips: tips || [],
      calories_burned_per_minute: calories_burned_per_minute || 0
    });
    
    await exercise.save();
    
    res.status(201).json({
      success: true,
      message: 'Exercise created successfully',
      data: { exercise }
    });
  } catch (error) {
    console.error('Error creating exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create exercise',
      error: error.message
    });
  }
});

// Update exercise (Admin/Trainer only)
router.put('/:id', auth, adminOrTrainerAuth, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Exercise name must be at least 2 characters'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('muscle_group').optional().isIn([
    'chest', 'back', 'shoulders', 'arms', 'legs', 
    'glutes', 'core', 'cardio', 'full_body', 'other'
  ]).withMessage('Please select a valid muscle group'),
  body('difficulty_level').optional().isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Please select a valid difficulty level'),
  body('equipment_required').optional().isBoolean().withMessage('Equipment required must be boolean'),
  body('video_demo_url').optional().isURL().withMessage('Please provide a valid video URL')
], async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exercise ID format'
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
    
    const exercise = await ExerciseLibrary.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Exercise updated successfully',
      data: { exercise }
    });
  } catch (error) {
    console.error('Error updating exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exercise',
      error: error.message
    });
  }
});

// Delete exercise (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exercise ID format'
      });
    }
    
    const exercise = await ExerciseLibrary.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exercise',
      error: error.message
    });
  }
});

// Get exercise statistics
router.get('/stats/overview', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const totalExercises = await ExerciseLibrary.countDocuments({ isActive: true });
    
    const muscleGroupStats = await ExerciseLibrary.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$muscle_group', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const difficultyStats = await ExerciseLibrary.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty_level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const equipmentStats = await ExerciseLibrary.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$equipment_required', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalExercises,
        muscleGroupStats,
        difficultyStats,
        equipmentStats
      }
    });
  } catch (error) {
    console.error('Error fetching exercise stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exercise statistics',
      error: error.message
    });
  }
});

// Get exercise statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const totalExercises = await ExerciseLibrary.countDocuments({ isActive: true });
    
    const muscleGroupStats = await ExerciseLibrary.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$muscle_group', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const difficultyStats = await ExerciseLibrary.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty_level', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const equipmentStats = await ExerciseLibrary.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$equipment_required', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalExercises,
        byMuscleGroup: muscleGroupStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        byDifficulty: difficultyStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        byEquipment: equipmentStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching exercise stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exercise statistics',
      error: error.message
    });
  }
});
module.exports = router;
