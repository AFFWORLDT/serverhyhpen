const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ProTip = require('../models/ProTip');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/pro-tips';
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

// Get all pro tips (Admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const difficulty = req.query.difficulty || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (status) {
      query.status = status;
    }

    const proTips = await ProTip.find(query)
      .populate('author', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await ProTip.countDocuments(query);

    res.json({
      success: true,
      data: {
        proTips,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get pro tips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pro tips'
    });
  }
});

// Get public pro tips (for website/portal integration)
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category || '';
    const difficulty = req.query.difficulty || '';
    const featured = req.query.featured === 'true';
    const limitContent = req.query.limitContent === 'true';

    let query = { 
      status: 'published', 
      isActive: true 
    };
    
    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (featured) {
      query.featured = true;
    }

    const proTips = await ProTip.find(query)
      .populate('author', 'firstName lastName')
      .sort({ priority: -1, publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(limitContent ? '-content' : '');

    const total = await ProTip.countDocuments(query);

    res.json({
      success: true,
      data: {
        proTips,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get public pro tips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public pro tips'
    });
  }
});

// Get pro tip by slug (public)
router.get('/public/slug/:slug', async (req, res) => {
  try {
    const proTip = await ProTip.findOne({ 
      slug: req.params.slug, 
      status: 'published', 
      isActive: true 
    })
    .populate('author', 'firstName lastName email')
    .populate('interactions.comments.user', 'firstName lastName')
    .populate('relatedTips', 'title slug excerpt image');

    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    // Increment views
    await proTip.incrementViews();

    res.json({
      success: true,
      data: { proTip }
    });

  } catch (error) {
    console.error('Get pro tip by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pro tip'
    });
  }
});

// Get featured pro tips (public)
router.get('/public/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const proTips = await ProTip.getFeatured(limit);

    res.json({
      success: true,
      data: { proTips }
    });

  } catch (error) {
    console.error('Get featured pro tips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured pro tips'
    });
  }
});

// Get pro tips by category (public)
router.get('/public/category/:category', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const proTips = await ProTip.getByCategory(req.params.category, limit, page);

    res.json({
      success: true,
      data: { proTips }
    });

  } catch (error) {
    console.error('Get pro tips by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pro tips by category'
    });
  }
});

// Get pro tips by difficulty (public)
router.get('/public/difficulty/:difficulty', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const proTips = await ProTip.getByDifficulty(req.params.difficulty, limit);

    res.json({
      success: true,
      data: { proTips }
    });

  } catch (error) {
    console.error('Get pro tips by difficulty error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pro tips by difficulty'
    });
  }
});

// Search pro tips (public)
router.get('/public/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const proTips = await ProTip.searchTips(query, limit);

    res.json({
      success: true,
      data: { proTips }
    });

  } catch (error) {
    console.error('Search pro tips error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching pro tips'
    });
  }
});

// Like/unlike pro tip (public)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    await proTip.toggleLike(req.user.id);

    res.json({
      success: true,
      message: 'Pro tip like status updated',
      data: { 
        likes: proTip.analytics.likes,
        isLiked: proTip.interactions.likes.some(like => 
          like.user.toString() === req.user.id.toString()
        )
      }
    });

  } catch (error) {
    console.error('Toggle pro tip like error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating like status'
    });
  }
});

// Save/unsave pro tip (public)
router.post('/:id/save', auth, async (req, res) => {
  try {
    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    await proTip.toggleSave(req.user.id);

    res.json({
      success: true,
      message: 'Pro tip save status updated',
      data: { 
        saves: proTip.analytics.saves,
        isSaved: proTip.interactions.saves.some(save => 
          save.user.toString() === req.user.id.toString()
        )
      }
    });

  } catch (error) {
    console.error('Toggle pro tip save error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating save status'
    });
  }
});

// Add comment to pro tip (public)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    await proTip.addComment(req.user.id, content);

    res.json({
      success: true,
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding comment'
    });
  }
});

// Track pro tip view (public)
router.post('/:id/view', async (req, res) => {
  try {
    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    await proTip.incrementViews();

    res.json({
      success: true,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Track pro tip view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking view'
    });
  }
});

// Track pro tip share (public)
router.post('/:id/share', async (req, res) => {
  try {
    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    await proTip.incrementShares();

    res.json({
      success: true,
      message: 'Share tracked successfully'
    });

  } catch (error) {
    console.error('Track pro tip share error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking share'
    });
  }
});

// Get pro tip by ID (Admin only)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const proTip = await ProTip.findById(req.params.id)
      .populate('author', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('interactions.comments.user', 'firstName lastName email')
      .populate('relatedTips', 'title slug');

    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    res.json({
      success: true,
      data: { proTip }
    });

  } catch (error) {
    console.error('Get pro tip by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pro tip'
    });
  }
});

// Create new pro tip (Admin only)
router.post('/', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('content').trim().isLength({ min: 50 }).withMessage('Content must be at least 50 characters'),
  body('excerpt').trim().isLength({ min: 10, max: 500 }).withMessage('Excerpt must be between 10 and 500 characters'),
  body('category').isIn(['fitness', 'nutrition', 'wellness', 'motivation', 'technique', 'recovery', 'equipment', 'safety', 'lifestyle', 'general']).withMessage('Invalid category'),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'all']).withMessage('Invalid difficulty level'),
  body('targetAudience').optional().isIn(['all', 'members', 'trainers', 'staff', 'beginners', 'athletes', 'seniors', 'youth']).withMessage('Invalid target audience'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('priority').optional().isInt({ min: 0, max: 10 }).withMessage('Priority must be between 0 and 10'),
  body('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status')
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
      content,
      excerpt,
      category,
      subcategory,
      difficulty,
      targetAudience,
      tags,
      priority,
      featured,
      status,
      expert,
      relatedTips,
      seo,
      socialSharing
    } = req.body;

    // Handle file uploads
    let image = null;
    let gallery = [];

    if (req.files) {
      if (req.files.image) {
        image = {
          url: `/uploads/pro-tips/${req.files.image[0].filename}`,
          alt: req.body.imageAlt || '',
          caption: req.body.imageCaption || ''
        };
      }

      if (req.files.gallery) {
        gallery = req.files.gallery.map(file => ({
          url: `/uploads/pro-tips/${file.filename}`,
          alt: '',
          caption: ''
        }));
      }
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Pro tip image is required'
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
    const existingProTip = await ProTip.findOne({ slug });
    if (existingProTip) {
      return res.status(400).json({
        success: false,
        message: 'A pro tip with this title already exists'
      });
    }

    const proTip = new ProTip({
      title,
      slug,
      content,
      excerpt,
      category,
      subcategory,
      difficulty: difficulty || 'all',
      targetAudience: targetAudience || 'all',
      tags: tags || [],
      image,
      gallery,
      expert: expert || {},
      priority: priority || 0,
      featured: featured || false,
      status: status || 'draft',
      publishedAt: status === 'published' ? new Date() : null,
      relatedTips: relatedTips || [],
      seo: seo || {},
      socialSharing: socialSharing || {},
      author: req.user.id
    });

    await proTip.save();

    res.status(201).json({
      success: true,
      message: 'Pro tip created successfully',
      data: { proTip }
    });

  } catch (error) {
    console.error('Create pro tip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating pro tip'
    });
  }
});

// Update pro tip (Admin only)
router.put('/:id', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('content').optional().trim().isLength({ min: 50 }),
  body('excerpt').optional().trim().isLength({ min: 10, max: 500 }),
  body('category').optional().isIn(['fitness', 'nutrition', 'wellness', 'motivation', 'technique', 'recovery', 'equipment', 'safety', 'lifestyle', 'general']),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'all']),
  body('targetAudience').optional().isIn(['all', 'members', 'trainers', 'staff', 'beginners', 'athletes', 'seniors', 'youth']),
  body('tags').optional().isArray(),
  body('priority').optional().isInt({ min: 0, max: 10 }),
  body('featured').optional().isBoolean(),
  body('status').optional().isIn(['draft', 'published', 'archived'])
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

    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    const allowedUpdates = [
      'title', 'content', 'excerpt', 'category', 'subcategory', 'difficulty', 
      'targetAudience', 'tags', 'priority', 'featured', 'status', 'expert', 
      'relatedTips', 'seo', 'socialSharing', 'isActive'
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
          url: `/uploads/pro-tips/${req.files.image[0].filename}`,
          alt: req.body.imageAlt || '',
          caption: req.body.imageCaption || ''
        };
      }

      if (req.files.gallery) {
        updates.gallery = req.files.gallery.map(file => ({
          url: `/uploads/pro-tips/${file.filename}`,
          alt: '',
          caption: ''
        }));
      }
    }

    // Update slug if title changed
    if (updates.title && updates.title !== proTip.title) {
      updates.slug = updates.title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');

      // Check if new slug already exists
      const existingProTip = await ProTip.findOne({ slug: updates.slug, _id: { $ne: req.params.id } });
      if (existingProTip) {
        return res.status(400).json({
          success: false,
          message: 'A pro tip with this title already exists'
        });
      }
    }

    // Set publishedAt if status changed to published
    if (updates.status === 'published' && proTip.status !== 'published') {
      updates.publishedAt = new Date();
    }

    updates.lastModifiedBy = req.user.id;

    const updatedProTip = await ProTip.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('author', 'firstName lastName email')
     .populate('lastModifiedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Pro tip updated successfully',
      data: { proTip: updatedProTip }
    });

  } catch (error) {
    console.error('Update pro tip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating pro tip'
    });
  }
});

// Delete pro tip (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const proTip = await ProTip.findById(req.params.id);
    if (!proTip) {
      return res.status(404).json({
        success: false,
        message: 'Pro tip not found'
      });
    }

    await ProTip.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Pro tip deleted successfully'
    });

  } catch (error) {
    console.error('Delete pro tip error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting pro tip'
    });
  }
});

// Get pro tip statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalProTips = await ProTip.countDocuments();
    const publishedProTips = await ProTip.countDocuments({ status: 'published' });
    const featuredProTips = await ProTip.countDocuments({ featured: true });

    const categoryStats = await ProTip.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const difficultyStats = await ProTip.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    const performanceStats = await ProTip.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$analytics.views' },
          totalLikes: { $sum: '$analytics.likes' },
          totalShares: { $sum: '$analytics.shares' },
          totalSaves: { $sum: '$analytics.saves' },
          totalComments: { $sum: '$analytics.comments' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalProTips,
        publishedProTips,
        featuredProTips,
        categoryStats,
        difficultyStats,
        performanceStats: performanceStats[0] || { 
          totalViews: 0, 
          totalLikes: 0, 
          totalShares: 0, 
          totalSaves: 0, 
          totalComments: 0 
        }
      }
    });

  } catch (error) {
    console.error('Get pro tip stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pro tip statistics'
    });
  }
});

module.exports = router;
