const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const { auth, adminAuth } = require('../middleware/auth');
const { createCloudinaryStorage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();

// Configure Cloudinary for image uploads
const upload = createCloudinaryStorage('events', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 10485760); // 10MB

// Get all events (Admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const type = req.query.type || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'schedule.startDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.name': { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('attendees.user', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching events'
    });
  }
});

// Get public events (for website/portal integration)
router.get('/public', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || '';
    const type = req.query.type || '';
    const featured = req.query.featured === 'true';
    const upcoming = req.query.upcoming !== 'false';

    let query = {
      status: 'published',
      isActive: true
    };

    if (category) {
      query.category = category;
    }

    if (type) {
      query.type = type;
    }

    if (featured) {
      query.featured = true;
    }

    if (upcoming) {
      const now = new Date();
      query['schedule.startDate'] = { $gte: now };
    }

    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('attendees.user', 'firstName lastName')
      .sort({ 'schedule.startDate': 1 })
      .limit(limit);

    res.json({
      success: true,
      data: { events }
    });

  } catch (error) {
    console.error('Get public events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public events'
    });
  }
});

// Get upcoming events (public)
router.get('/public/upcoming', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const events = await Event.getUpcoming(limit);

    res.json({
      success: true,
      data: { events }
    });

  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming events'
    });
  }
});

// Get events by category (public)
router.get('/public/category/:category', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const events = await Event.getByCategory(req.params.category, limit);

    res.json({
      success: true,
      data: { events }
    });

  } catch (error) {
    console.error('Get events by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching events by category'
    });
  }
});

// Get featured events (public)
router.get('/public/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const events = await Event.getFeatured(limit);

    res.json({
      success: true,
      data: { events }
    });

  } catch (error) {
    console.error('Get featured events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured events'
    });
  }
});

// Get event by slug (public)
router.get('/public/slug/:slug', async (req, res) => {
  try {
    const event = await Event.findOne({ 
      slug: req.params.slug, 
      status: 'published', 
      isActive: true 
    })
    .populate('createdBy', 'firstName lastName email')
    .populate('attendees.user', 'firstName lastName email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Increment views
    await event.incrementViews();

    res.json({
      success: true,
      data: { event }
    });

  } catch (error) {
    console.error('Get event by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event'
    });
  }
});

// Register for event (public)
router.post('/:id/register', auth, async (req, res) => {
  try {
    const { paymentData } = req.body;

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.isOpenForRegistration()) {
      return res.status(400).json({
        success: false,
        message: 'Event is not open for registration'
      });
    }

    await event.registerUser(req.user.id, paymentData);

    res.json({
      success: true,
      message: 'Successfully registered for event',
      data: { 
        event: {
          id: event._id,
          title: event.title,
          startDate: event.schedule.startDate,
          location: event.location.name
        }
      }
    });

  } catch (error) {
    console.error('Register for event error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error while registering for event'
    });
  }
});

// Cancel event registration (public)
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await event.cancelRegistration(req.user.id);

    res.json({
      success: true,
      message: 'Successfully cancelled event registration'
    });

  } catch (error) {
    console.error('Cancel event registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error while cancelling event registration'
    });
  }
});

// Track event view (public)
router.post('/:id/view', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await event.incrementViews();

    res.json({
      success: true,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Track event view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking event view'
    });
  }
});

// Get event by ID (Admin only)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('attendees.user', 'firstName lastName email phone');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: { event }
    });

  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event'
    });
  }
});

// Create new event (Admin only)
router.post('/', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  body('shortDescription').trim().isLength({ min: 10, max: 300 }).withMessage('Short description must be between 10 and 300 characters'),
  body('type').isIn(['workshop', 'seminar', 'competition', 'social', 'fitness', 'nutrition', 'wellness', 'community', 'training', 'celebration']).withMessage('Invalid event type'),
  body('category').isIn(['fitness', 'nutrition', 'wellness', 'social', 'educational', 'competitive', 'charity', 'celebration', 'general']).withMessage('Invalid category'),
  body('location.name').trim().isLength({ min: 3 }).withMessage('Location name is required'),
  body('schedule.startDate').isISO8601().withMessage('Please provide a valid start date'),
  body('schedule.endDate').isISO8601().withMessage('Please provide a valid end date'),
  body('schedule.startTime').notEmpty().withMessage('Start time is required'),
  body('schedule.endTime').notEmpty().withMessage('End time is required'),
  body('capacity.maxAttendees').isInt({ min: 1 }).withMessage('Maximum attendees must be at least 1'),
  body('organizer.name').trim().isLength({ min: 2 }).withMessage('Organizer name is required'),
  body('organizer.email').isEmail().withMessage('Please provide a valid organizer email')
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
      title,
      description,
      shortDescription,
      type,
      category,
      location,
      schedule,
      capacity,
      pricing,
      organizer,
      instructors,
      requirements,
      features,
      status,
      featured,
      priority,
      registration,
      socialMedia,
      seo
    } = req.body;

    // Handle file uploads from Cloudinary
    let image = null;
    let gallery = [];

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        const uploadedFile = req.files.image[0];
        image = {
          url: uploadedFile.secure_url || uploadedFile.url,
          publicId: uploadedFile.public_id,
          alt: req.body.imageAlt || '',
          width: uploadedFile.width,
          height: uploadedFile.height,
          format: uploadedFile.format
        };
      }

      if (req.files.gallery && req.files.gallery.length > 0) {
        gallery = req.files.gallery.map(file => ({
          url: file.secure_url || file.url,
          publicId: file.public_id,
          alt: '',
          caption: '',
          width: file.width,
          height: file.height,
          format: file.format
        }));
      }
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Event image is required'
      });
    }

    // Validate dates
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    // Check if slug already exists
    const existingEvent = await Event.findOne({ slug });
    if (existingEvent) {
      return res.status(400).json({
        success: false,
        message: 'An event with this title already exists'
      });
    }

    const event = new Event({
      title,
      slug,
      description,
      shortDescription,
      type,
      category,
      image,
      gallery,
      location,
      schedule: {
        startDate,
        endDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timezone: schedule.timezone || 'Asia/Dubai',
        isRecurring: schedule.isRecurring || false,
        recurringPattern: schedule.recurringPattern || 'weekly',
        recurringEndDate: schedule.recurringEndDate ? new Date(schedule.recurringEndDate) : null
      },
      capacity: {
        maxAttendees: capacity.maxAttendees,
        waitlistEnabled: capacity.waitlistEnabled || false,
        waitlistCapacity: capacity.waitlistCapacity || 0
      },
      pricing: pricing || { isFree: true },
      organizer,
      instructors: instructors || [],
      requirements: requirements || {},
      features: features || {},
      status: status || 'draft',
      featured: featured || false,
      priority: priority || 0,
      registration: {
        opensAt: registration.opensAt ? new Date(registration.opensAt) : new Date(),
        closesAt: new Date(registration.closesAt),
        requiresApproval: registration.requiresApproval || false,
        allowWaitlist: registration.allowWaitlist !== false,
        maxRegistrationsPerUser: registration.maxRegistrationsPerUser || 1
      },
      socialMedia: socialMedia || {},
      seo: seo || {},
      createdBy: req.user.id
    });

    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event }
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating event'
    });
  }
});

// Update event (Admin only)
router.put('/:id', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('description').optional().trim().isLength({ min: 20 }),
  body('shortDescription').optional().trim().isLength({ min: 10, max: 300 }),
  body('type').optional().isIn(['workshop', 'seminar', 'competition', 'social', 'fitness', 'nutrition', 'wellness', 'community', 'training', 'celebration']),
  body('category').optional().isIn(['fitness', 'nutrition', 'wellness', 'social', 'educational', 'competitive', 'charity', 'celebration', 'general']),
  body('capacity.maxAttendees').optional().isInt({ min: 1 }),
  body('organizer.email').optional().isEmail()
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

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const allowedUpdates = [
      'title', 'description', 'shortDescription', 'type', 'category', 
      'location', 'schedule', 'capacity', 'pricing', 'organizer', 
      'instructors', 'requirements', 'features', 'status', 'featured', 
      'priority', 'registration', 'socialMedia', 'seo', 'isActive'
    ];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle file uploads from Cloudinary
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        // Delete old image from Cloudinary if exists
        if (event.image && event.image.publicId) {
          try {
            await deleteImage(event.image.publicId);
          } catch (deleteError) {
            console.log('Old image deletion warning:', deleteError.message);
          }
        }

        const uploadedFile = req.files.image[0];
        updates.image = {
          url: uploadedFile.secure_url || uploadedFile.url,
          publicId: uploadedFile.public_id,
          alt: req.body.imageAlt || event.image?.alt || '',
          width: uploadedFile.width,
          height: uploadedFile.height,
          format: uploadedFile.format
        };
      }

      if (req.files.gallery && req.files.gallery.length > 0) {
        // Delete old gallery images if exists
        if (event.gallery && event.gallery.length > 0) {
          for (const oldImage of event.gallery) {
            if (oldImage.publicId) {
              try {
                await deleteImage(oldImage.publicId);
              } catch (deleteError) {
                console.log('Old gallery image deletion warning:', deleteError.message);
              }
            }
          }
        }

        updates.gallery = req.files.gallery.map(file => ({
          url: file.secure_url || file.url,
          publicId: file.public_id,
          alt: '',
          caption: '',
          width: file.width,
          height: file.height,
          format: file.format
        }));
      }
    }

    // Update slug if title changed
    if (updates.title && updates.title !== event.title) {
      updates.slug = updates.title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');

      // Check if new slug already exists
      const existingEvent = await Event.findOne({ slug: updates.slug, _id: { $ne: req.params.id } });
      if (existingEvent) {
        return res.status(400).json({
          success: false,
          message: 'An event with this title already exists'
        });
      }
    }

    // Handle date fields
    if (updates.schedule) {
      if (updates.schedule.startDate) {
        updates.schedule.startDate = new Date(updates.schedule.startDate);
      }
      if (updates.schedule.endDate) {
        updates.schedule.endDate = new Date(updates.schedule.endDate);
      }
    }

    if (updates.registration) {
      if (updates.registration.opensAt) {
        updates.registration.opensAt = new Date(updates.registration.opensAt);
      }
      if (updates.registration.closesAt) {
        updates.registration.closesAt = new Date(updates.registration.closesAt);
      }
    }

    updates.lastModifiedBy = req.user.id;

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
     .populate('lastModifiedBy', 'firstName lastName email')
     .populate('attendees.user', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: { event: updatedEvent }
    });

  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating event'
    });
  }
});

// Delete event (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Delete images from Cloudinary if exists
    if (event.image && event.image.publicId) {
      try {
        await deleteImage(event.image.publicId);
      } catch (deleteError) {
        console.log('Image deletion warning:', deleteError.message);
      }
    }

    if (event.gallery && event.gallery.length > 0) {
      for (const image of event.gallery) {
        if (image.publicId) {
          try {
            await deleteImage(image.publicId);
          } catch (deleteError) {
            console.log('Gallery image deletion warning:', deleteError.message);
          }
        }
      }
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting event'
    });
  }
});

// Get event statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const upcomingEvents = await Event.countDocuments({ 
      status: 'published', 
      'schedule.startDate': { $gte: new Date() } 
    });

    const typeStats = await Event.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const categoryStats = await Event.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const performanceStats = await Event.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$analytics.views' },
          totalRegistrations: { $sum: '$analytics.registrations' },
          totalCancellations: { $sum: '$analytics.cancellations' },
          totalNoShows: { $sum: '$analytics.noShows' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        publishedEvents,
        upcomingEvents,
        typeStats,
        categoryStats,
        performanceStats: performanceStats[0] || { 
          totalViews: 0, 
          totalRegistrations: 0, 
          totalCancellations: 0, 
          totalNoShows: 0 
        }
      }
    });

  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching event statistics'
    });
  }
});

module.exports = router;
