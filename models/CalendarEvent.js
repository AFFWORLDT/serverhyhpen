const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['class', 'training_session', 'staff_meeting', 'maintenance', 'event', 'holiday', 'personal'],
    required: true
  },
  category: {
    type: String,
    enum: ['hr', 'member', 'trainer', 'staff', 'global'],
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  location: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: {
      type: Number,
      default: 1
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    endDate: Date
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isAllDay: {
    type: Boolean,
    default: false
  },
  reminder: {
    enabled: {
      type: Boolean,
      default: false
    },
    minutes: {
      type: Number,
      default: 15
    }
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  visibility: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public'
  },
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedEntityType'
  },
  relatedEntityType: {
    type: String,
    enum: ['Class', 'TrainingSession', 'User', 'Equipment']
  }
}, {
  timestamps: true
});

// Indexes for better performance
calendarEventSchema.index({ startTime: 1, endTime: 1 });
calendarEventSchema.index({ type: 1 });
calendarEventSchema.index({ category: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ assignedTo: 1 });
calendarEventSchema.index({ status: 1 });

// Virtual for duration
calendarEventSchema.virtual('duration').get(function() {
  return this.endTime - this.startTime;
});

// Method to check if event is currently active
calendarEventSchema.methods.isActive = function() {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime;
};

// Method to check if event is upcoming
calendarEventSchema.methods.isUpcoming = function() {
  return new Date() < this.startTime;
};

// Method to check if event is past
calendarEventSchema.methods.isPast = function() {
  return new Date() > this.endTime;
};

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
