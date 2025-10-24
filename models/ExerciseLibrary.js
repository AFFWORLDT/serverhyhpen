const mongoose = require('mongoose');

const exerciseLibrarySchema = new mongoose.Schema({
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
  muscle_group: {
    type: String,
    required: true,
    enum: [
      'chest', 'back', 'shoulders', 'arms', 'legs', 
      'glutes', 'core', 'cardio', 'full_body', 'other'
    ]
  },
  equipment_required: {
    type: Boolean,
    default: false
  },
  difficulty_level: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  video_demo_url: {
    type: String,
    default: null
  },
  instructions: {
    type: [String],
    default: []
  },
  tips: {
    type: [String],
    default: []
  },
  calories_burned_per_minute: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
exerciseLibrarySchema.index({ muscle_group: 1 });
exerciseLibrarySchema.index({ difficulty_level: 1 });
exerciseLibrarySchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('ExerciseLibrary', exerciseLibrarySchema);


