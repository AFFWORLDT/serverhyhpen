const mongoose = require('mongoose');

const trainingSessionSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  programme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Programme',
    required: true
  },
  session_start_time: {
    type: Date,
    required: true
  },
  session_end_time: {
    type: Date,
    default: null
  },
  live_rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  remarks: {
    type: String,
    default: ''
  },
  submission_timestamp: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  exercises_completed: [{
    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExerciseLibrary'
    },
    sets_completed: {
      type: Number,
      default: 0
    },
    reps_completed: {
      type: String,
      default: ''
    },
    duration_completed: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: ''
    }
  }],
  member_feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    comments: {
      type: String,
      default: ''
    }
  },
  trainer_notes: {
    type: String,
    default: ''
  },
  next_session_recommendations: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better performance
trainingSessionSchema.index({ member: 1 });
trainingSessionSchema.index({ trainer: 1 });
trainingSessionSchema.index({ programme: 1 });
trainingSessionSchema.index({ session_start_time: 1 });
trainingSessionSchema.index({ status: 1 });

// Pre-save middleware to set submission timestamp when session is completed
trainingSessionSchema.pre('save', function(next) {
  if (this.status === 'completed' && !this.submission_timestamp) {
    this.submission_timestamp = new Date();
  }
  next();
});

// Post-save middleware to update trainer's average rating
trainingSessionSchema.post('save', async function(doc) {
  if (doc.status === 'completed' && doc.live_rating) {
    try {
      const Trainer = mongoose.model('User');
      const trainer = await Trainer.findById(doc.trainer);
      
      if (trainer) {
        // Get all completed sessions for this trainer
        const sessions = await mongoose.model('TrainingSession').find({
          trainer: doc.trainer,
          status: 'completed',
          live_rating: { $exists: true, $ne: null }
        });
        
        // Calculate average rating
        const totalRating = sessions.reduce((sum, session) => sum + session.live_rating, 0);
        const averageRating = totalRating / sessions.length;
        
        // Update trainer's rating
        await Trainer.findByIdAndUpdate(doc.trainer, {
          average_rating: Math.round(averageRating * 10) / 10 // Round to 1 decimal place
        });
      }
    } catch (error) {
      console.error('Error updating trainer rating:', error);
    }
  }
});

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);


