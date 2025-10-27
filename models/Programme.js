const mongoose = require('mongoose');

const programmeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exercises: [{
    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExerciseLibrary',
      required: true
    },
    sets: {
      type: Number,
      default: 1
    },
    reps: {
      type: String,
      default: '10-12'
    },
    duration_minutes: {
      type: Number,
      default: 0
    },
    rest_seconds: {
      type: Number,
      default: 60
    },
    order: {
      type: Number,
      default: 1
    }
  }],
  duration_in_weeks: {
    type: Number,
    required: true,
    min: 1,
    max: 52
  },
  difficulty_level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  target_muscle_groups: [{
    type: String,
    enum: [
      'chest', 'back', 'shoulders', 'arms', 'legs', 
      'glutes', 'core', 'cardio', 'full_body', 'other'
    ]
  }],
  equipment_needed: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
programmeSchema.index({ created_by: 1 });
programmeSchema.index({ difficulty_level: 1 });
programmeSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Programme', programmeSchema);




