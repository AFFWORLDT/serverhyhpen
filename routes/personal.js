const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Workout Log Schema
const workoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  workoutType: { type: String, required: true },
  duration: { type: Number, required: true }, // in minutes
  exercises: [{
    name: { type: String, required: true },
    sets: { type: Number, required: true },
    reps: { type: Number, required: true },
    weight: { type: Number, default: 0 },
    notes: { type: String }
  }],
  caloriesBurned: { type: Number, default: 0 },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

// Nutrition Log Schema
const nutritionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  meals: [{
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
    foodItems: [{
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      calories: { type: Number, required: true },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 }
    }],
    totalCalories: { type: Number, required: true }
  }],
  totalCalories: { type: Number, required: true },
  waterIntake: { type: Number, default: 0 }, // in liters
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const NutritionLog = mongoose.model('NutritionLog', nutritionLogSchema);

// Fitness Goal Schema
const fitnessGoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: ['weight', 'muscle', 'endurance', 'flexibility', 'strength', 'other'], required: true },
  targetValue: { type: Number, required: true },
  currentValue: { type: Number, default: 0 },
  unit: { type: String, required: true },
  targetDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'completed', 'paused', 'cancelled'], default: 'active' },
  progress: { type: Number, default: 0 }, // percentage
  milestones: [{
    title: { type: String, required: true },
    targetValue: { type: Number, required: true },
    achieved: { type: Boolean, default: false },
    achievedDate: { type: Date }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const FitnessGoal = mongoose.model('FitnessGoal', fitnessGoalSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession' },
  createdAt: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

// WORKOUT LOGS API

// Get workout logs
router.get('/workouts', auth, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.userId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const workouts = await WorkoutLog.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await WorkoutLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        workouts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get workout logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workout logs',
      error: error.message
    });
  }
});

// Create workout log
router.post('/workouts', auth, [
  body('date').isISO8601().withMessage('Please provide a valid date'),
  body('workoutType').trim().isLength({ min: 2 }).withMessage('Workout type is required'),
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('exercises').isArray().withMessage('Exercises must be an array'),
  body('exercises.*.name').trim().isLength({ min: 2 }).withMessage('Exercise name is required'),
  body('exercises.*.sets').isNumeric().withMessage('Sets must be a number'),
  body('exercises.*.reps').isNumeric().withMessage('Reps must be a number')
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

    const workoutData = {
      ...req.body,
      userId: req.user.userId
    };

    const workout = new WorkoutLog(workoutData);
    await workout.save();

    res.status(201).json({
      success: true,
      message: 'Workout log created successfully',
      data: { workout }
    });
  } catch (error) {
    console.error('Create workout log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workout log',
      error: error.message
    });
  }
});

// NUTRITION LOGS API

// Get nutrition logs
router.get('/nutrition', auth, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.userId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const nutritionLogs = await NutritionLog.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await NutritionLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        nutritionLogs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get nutrition logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nutrition logs',
      error: error.message
    });
  }
});

// Create nutrition log
router.post('/nutrition', auth, [
  body('date').isISO8601().withMessage('Please provide a valid date'),
  body('meals').isArray().withMessage('Meals must be an array'),
  body('totalCalories').isNumeric().withMessage('Total calories must be a number')
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

    const nutritionData = {
      ...req.body,
      userId: req.user.userId
    };

    const nutritionLog = new NutritionLog(nutritionData);
    await nutritionLog.save();

    res.status(201).json({
      success: true,
      message: 'Nutrition log created successfully',
      data: { nutritionLog }
    });
  } catch (error) {
    console.error('Create nutrition log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create nutrition log',
      error: error.message
    });
  }
});

// FITNESS GOALS API

// Get fitness goals
router.get('/goals', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.userId };
    if (status) {
      query.status = status;
    }

    const goals = await FitnessGoal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FitnessGoal.countDocuments(query);

    res.json({
      success: true,
      data: {
        goals,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get fitness goals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fitness goals',
      error: error.message
    });
  }
});

// Create fitness goal
router.post('/goals', auth, [
  body('title').trim().isLength({ min: 2 }).withMessage('Title is required'),
  body('category').isIn(['weight', 'muscle', 'endurance', 'flexibility', 'strength', 'other']).withMessage('Please select a valid category'),
  body('targetValue').isNumeric().withMessage('Target value must be a number'),
  body('unit').trim().isLength({ min: 1 }).withMessage('Unit is required'),
  body('targetDate').isISO8601().withMessage('Please provide a valid target date')
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

    const goalData = {
      ...req.body,
      userId: req.user.userId
    };

    const goal = new FitnessGoal(goalData);
    await goal.save();

    res.status(201).json({
      success: true,
      message: 'Fitness goal created successfully',
      data: { goal }
    });
  } catch (error) {
    console.error('Create fitness goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fitness goal',
      error: error.message
    });
  }
});

// Update fitness goal progress
router.put('/goals/:id/progress', auth, [
  body('currentValue').isNumeric().withMessage('Current value must be a number')
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

    const goal = await FitnessGoal.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found'
      });
    }

    goal.currentValue = req.body.currentValue;
    goal.progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);

    // Check if goal is completed
    if (goal.progress >= 100) {
      goal.status = 'completed';
    }

    await goal.save();

    res.json({
      success: true,
      message: 'Goal progress updated successfully',
      data: { goal }
    });
  } catch (error) {
    console.error('Update goal progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update goal progress',
      error: error.message
    });
  }
});

// FEEDBACK API

// Submit feedback for trainer
router.post('/feedback', auth, [
  body('trainerId').isMongoId().withMessage('Please provide a valid trainer ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim()
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

    const { trainerId, rating, comment, sessionId } = req.body;

    // Verify trainer exists
    const trainer = await mongoose.model('User').findById(trainerId);
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({
        success: false,
        message: 'Trainer not found'
      });
    }

    const feedback = new Feedback({
      userId: req.user.userId,
      trainerId,
      rating,
      comment,
      sessionId
    });

    await feedback.save();

    // Update trainer's average rating
    const allFeedbacks = await Feedback.find({ trainerId });
    const averageRating = allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length;
    
    await mongoose.model('User').findByIdAndUpdate(trainerId, {
      average_rating: Math.round(averageRating * 10) / 10
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { feedback }
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

// Get feedback for trainer (trainer can view their feedback)
router.get('/feedback/trainer', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trainer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Trainer privileges required.'
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const feedbacks = await Feedback.find({ trainerId: req.user.userId })
      .populate('userId', 'firstName lastName')
      .populate('sessionId', 'date duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Feedback.countDocuments({ trainerId: req.user.userId });

    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get trainer feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: error.message
    });
  }
});

module.exports = router;
