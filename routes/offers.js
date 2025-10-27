const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Offer = require('../models/Offer');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/offers';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all offers (Admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const type = req.query.type || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
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

    const offers = await Offer.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await Offer.countDocuments(query);

    res.json({
      success: true,
      data: {
        offers,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offers'
    });
  }
});

// Get public offers (for website/portal integration)
router.get('/public', async (req, res) => {
  try {
    const targetAudience = req.query.audience || 'all';
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || '';
    const featured = req.query.featured === 'true';

    let query = {
      status: 'active',
      isActive: true
    };

    if (category) {
      query.category = category;
    }

    if (featured) {
      query.featured = true;
    }

    const now = new Date();
    query['validity.startDate'] = { $lte: now };
    query['validity.endDate'] = { $gte: now };

    if (targetAudience !== 'all') {
      query.$or = [
        { targetAudience: 'all' },
        { targetAudience: targetAudience }
      ];
    }

    const offers = await Offer.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ priority: -1, featured: -1, createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: { offers }
    });

  } catch (error) {
    console.error('Get public offers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public offers'
    });
  }
});

// Get offer by code (public)
router.get('/public/code/:code', async (req, res) => {
  try {
    const offer = await Offer.findOne({ 
      code: req.params.code.toUpperCase(),
      status: 'active',
      isActive: true
    })
    .populate('createdBy', 'firstName lastName');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or expired'
      });
    }

    if (!offer.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Offer is no longer valid'
      });
    }

    res.json({
      success: true,
      data: { offer }
    });

  } catch (error) {
    console.error('Get offer by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offer'
    });
  }
});

// Track offer view (public)
router.post('/:id/view', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    await offer.incrementViews();

    res.json({
      success: true,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Track offer view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking offer view'
    });
  }
});

// Track offer click (public)
router.post('/:id/click', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    await offer.incrementClicks();

    res.json({
      success: true,
      message: 'Click tracked successfully'
    });

  } catch (error) {
    console.error('Track offer click error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking offer click'
    });
  }
});

// Use offer (public)
router.post('/:id/use', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    if (!offer.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Offer is no longer valid'
      });
    }

    await offer.incrementUsage(userId);
    await offer.incrementConversions();

    res.json({
      success: true,
      message: 'Offer used successfully',
      data: { 
        offer: {
          id: offer._id,
          title: offer.title,
          code: offer.code,
          discountValue: offer.discountValue,
          discountType: offer.discountType
        }
      }
    });

  } catch (error) {
    console.error('Use offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while using offer'
    });
  }
});

// Get offer by ID (Admin only)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email');

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    res.json({
      success: true,
      data: { offer }
    });

  } catch (error) {
    console.error('Get offer by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offer'
    });
  }
});

// Create new offer (Admin only)
router.post('/', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('shortDescription').trim().isLength({ min: 5, max: 200 }).withMessage('Short description must be between 5 and 200 characters'),
  body('type').isIn(['discount', 'free-trial', 'package', 'membership', 'service', 'product', 'event']).withMessage('Invalid offer type'),
  body('category').isIn(['membership', 'personal-training', 'group-classes', 'nutrition', 'spa', 'retail', 'events', 'general']).withMessage('Invalid category'),
  body('discountType').optional().isIn(['percentage', 'fixed', 'buy-one-get-one', 'free-shipping', 'free-service']).withMessage('Invalid discount type'),
  body('discountValue').optional().isFloat({ min: 0 }).withMessage('Discount value must be a positive number'),
  body('originalPrice').optional().isFloat({ min: 0 }).withMessage('Original price must be a positive number'),
  body('priority').optional().isInt({ min: 0, max: 10 }).withMessage('Priority must be between 0 and 10'),
  body('status').optional().isIn(['draft', 'active', 'paused', 'expired', 'cancelled']).withMessage('Invalid status'),
  body('validity.startDate').isISO8601().withMessage('Please provide a valid start date'),
  body('validity.endDate').isISO8601().withMessage('Please provide a valid end date')
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
      discountType,
      discountValue,
      originalPrice,
      discountedPrice,
      currency,
      terms,
      conditions,
      targetAudience,
      eligibility,
      validity,
      status,
      featured,
      priority,
      code,
      socialSharing,
      notifications
    } = req.body;

    // Handle file uploads
    let image = null;
    let gallery = [];

    if (req.files) {
      if (req.files.image) {
        image = {
          url: `/uploads/offers/${req.files.image[0].filename}`,
          alt: req.body.imageAlt || ''
        };
      }

      if (req.files.gallery) {
        gallery = req.files.gallery.map(file => ({
          url: `/uploads/offers/${file.filename}`,
          alt: '',
          caption: ''
        }));
      }
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Offer image is required'
      });
    }

    // Validate dates
    const startDate = new Date(validity.startDate);
    const endDate = new Date(validity.endDate);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const offer = new Offer({
      title,
      description,
      shortDescription,
      type,
      category,
      discountType,
      discountValue,
      originalPrice,
      discountedPrice,
      currency: currency || 'AED',
      image,
      gallery,
      terms,
      conditions: conditions || [],
      targetAudience: targetAudience || 'all',
      eligibility: eligibility || {},
      validity: {
        startDate,
        endDate,
        usageLimit: validity.usageLimit,
        perUserLimit: validity.perUserLimit || 1
      },
      status: status || 'draft',
      featured: featured || false,
      priority: priority || 0,
      code: code ? code.toUpperCase() : undefined,
      socialSharing: socialSharing || {},
      notifications: notifications || {},
      createdBy: req.user.id
    });

    await offer.save();

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      data: { offer }
    });

  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating offer'
    });
  }
});

// Update offer (Admin only)
router.put('/:id', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').optional().trim().isLength({ min: 5, max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }),
  body('shortDescription').optional().trim().isLength({ min: 5, max: 200 }),
  body('type').optional().isIn(['discount', 'free-trial', 'package', 'membership', 'service', 'product', 'event']),
  body('category').optional().isIn(['membership', 'personal-training', 'group-classes', 'nutrition', 'spa', 'retail', 'events', 'general']),
  body('discountType').optional().isIn(['percentage', 'fixed', 'buy-one-get-one', 'free-shipping', 'free-service']),
  body('discountValue').optional().isFloat({ min: 0 }),
  body('originalPrice').optional().isFloat({ min: 0 }),
  body('priority').optional().isInt({ min: 0, max: 10 }),
  body('status').optional().isIn(['draft', 'active', 'paused', 'expired', 'cancelled'])
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

    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    const allowedUpdates = [
      'title', 'description', 'shortDescription', 'type', 'category', 
      'discountType', 'discountValue', 'originalPrice', 'discountedPrice', 
      'currency', 'terms', 'conditions', 'targetAudience', 'eligibility', 
      'validity', 'status', 'featured', 'priority', 'code', 'socialSharing', 
      'notifications', 'isActive'
    ];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle file uploads
    if (req.files) {
      if (req.files.image) {
        updates.image = {
          url: `/uploads/offers/${req.files.image[0].filename}`,
          alt: req.body.imageAlt || '',
          mobileUrl: offer.image.mobileUrl
        };
      }

      if (req.files.gallery) {
        updates.gallery = req.files.gallery.map(file => ({
          url: `/uploads/offers/${file.filename}`,
          alt: '',
          caption: ''
        }));
      }
    }

    // Handle validity dates
    if (updates.validity) {
      if (updates.validity.startDate) {
        updates.validity.startDate = new Date(updates.validity.startDate);
      }
      if (updates.validity.endDate) {
        updates.validity.endDate = new Date(updates.validity.endDate);
      }
    }

    // Handle code
    if (updates.code) {
      updates.code = updates.code.toUpperCase();
    }

    updates.lastModifiedBy = req.user.id;

    const updatedOffer = await Offer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
     .populate('lastModifiedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Offer updated successfully',
      data: { offer: updatedOffer }
    });

  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating offer'
    });
  }
});

// Delete offer (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    await Offer.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Offer deleted successfully'
    });

  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting offer'
    });
  }
});

// Get offer statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalOffers = await Offer.countDocuments();
    const activeOffers = await Offer.countDocuments({ status: 'active', isActive: true });
    const expiredOffers = await Offer.countDocuments({ status: 'expired' });

    const typeStats = await Offer.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const categoryStats = await Offer.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const performanceStats = await Offer.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$analytics.views' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalUses: { $sum: '$usage.totalUses' },
          totalRevenue: { $sum: '$usage.revenue' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalOffers,
        activeOffers,
        expiredOffers,
        typeStats,
        categoryStats,
        performanceStats: performanceStats[0] || { 
          totalViews: 0, 
          totalClicks: 0, 
          totalConversions: 0, 
          totalUses: 0, 
          totalRevenue: 0 
        }
      }
    });

  } catch (error) {
    console.error('Get offer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offer statistics'
    });
  }
});

module.exports = router;
