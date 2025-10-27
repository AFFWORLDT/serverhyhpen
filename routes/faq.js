const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FAQ = require('../models/FAQ');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/faq';
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
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, TXT, and image files are allowed!'));
    }
  }
});

// Get all FAQs (Admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const faqs = await FAQ.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('lastReviewedBy', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await FAQ.countDocuments(query);

    res.json({
      success: true,
      data: {
        faqs,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching FAQs'
    });
  }
});

// Get public FAQs (for website/portal integration)
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category || '';
    const featured = req.query.featured === 'true';
    const targetAudience = req.query.audience || 'all';

    let query = { 
      status: 'published', 
      isActive: true 
    };
    
    if (category) {
      query.category = category;
    }

    if (featured) {
      query.featured = true;
    }

    if (targetAudience !== 'all') {
      query.$or = [
        { targetAudience: 'all' },
        { targetAudience: targetAudience }
      ];
    }

    const faqs = await FAQ.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ priority: -1, featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FAQ.countDocuments(query);

    res.json({
      success: true,
      data: {
        faqs,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get public FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public FAQs'
    });
  }
});

// Get FAQs by category (public)
router.get('/public/category/:category', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const faqs = await FAQ.getByCategory(req.params.category, limit);

    res.json({
      success: true,
      data: { faqs }
    });

  } catch (error) {
    console.error('Get FAQs by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching FAQs by category'
    });
  }
});

// Get featured FAQs (public)
router.get('/public/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const faqs = await FAQ.getFeatured(limit);

    res.json({
      success: true,
      data: { faqs }
    });

  } catch (error) {
    console.error('Get featured FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured FAQs'
    });
  }
});

// Search FAQs (public)
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

    const faqs = await FAQ.searchFAQs(query, limit);

    res.json({
      success: true,
      data: { faqs }
    });

  } catch (error) {
    console.error('Search FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching FAQs'
    });
  }
});

// Track FAQ view (public)
router.post('/:id/view', async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.incrementViews();

    res.json({
      success: true,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Track FAQ view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking view'
    });
  }
});

// Track FAQ search (public)
router.post('/:id/search', async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.incrementSearches();

    res.json({
      success: true,
      message: 'Search tracked successfully'
    });

  } catch (error) {
    console.error('Track FAQ search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking search'
    });
  }
});

// Submit FAQ feedback (public)
router.post('/:id/feedback', auth, async (req, res) => {
  try {
    const { helpful, comment } = req.body;

    if (typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Helpful status is required'
      });
    }

    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.addFeedback(req.user.id, helpful, comment);

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        helpful: faq.analytics.helpful,
        notHelpful: faq.analytics.notHelpful,
        helpfulnessPercentage: faq.helpfulnessPercentage
      }
    });

  } catch (error) {
    console.error('Submit FAQ feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
});

// Get FAQ by ID (Admin only)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .populate('lastReviewedBy', 'firstName lastName email')
      .populate('feedback.user', 'firstName lastName email')
      .populate('relatedFaqs', 'question category');

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.json({
      success: true,
      data: { faq }
    });

  } catch (error) {
    console.error('Get FAQ by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching FAQ'
    });
  }
});

// Create new FAQ (Admin only)
router.post('/', auth, adminAuth, upload.array('attachments', 5), [
  body('question').trim().isLength({ min: 10, max: 500 }).withMessage('Question must be between 10 and 500 characters'),
  body('answer').trim().isLength({ min: 20 }).withMessage('Answer must be at least 20 characters'),
  body('category').isIn(['general', 'membership', 'classes', 'equipment', 'payment', 'booking', 'cancellation', 'refund', 'facilities', 'safety', 'nutrition', 'training', 'technical', 'account']).withMessage('Invalid category'),
  body('targetAudience').optional().isIn(['all', 'members', 'non-members', 'trainers', 'staff', 'beginners', 'premium']).withMessage('Invalid target audience'),
  body('difficulty').optional().isIn(['basic', 'intermediate', 'advanced', 'all']).withMessage('Invalid difficulty level'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('priority').optional().isInt({ min: 0, max: 10 }).withMessage('Priority must be between 0 and 10'),
  body('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
  body('reviewFrequency').optional().isIn(['monthly', 'quarterly', 'yearly', 'as-needed']).withMessage('Invalid review frequency')
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
      question,
      answer,
      shortAnswer,
      category,
      subcategory,
      tags,
      priority,
      featured,
      status,
      targetAudience,
      difficulty,
      relatedFaqs,
      seo,
      reviewFrequency
    } = req.body;

    // Handle file uploads
    let attachments = [];
    if (req.files) {
      attachments = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/faq/${file.filename}`,
        type: file.mimetype,
        size: file.size
      }));
    }

    const faq = new FAQ({
      question,
      answer,
      shortAnswer,
      category,
      subcategory,
      tags: tags || [],
      priority: priority || 0,
      featured: featured || false,
      status: status || 'draft',
      targetAudience: targetAudience || 'all',
      difficulty: difficulty || 'all',
      attachments,
      relatedFaqs: relatedFaqs || [],
      seo: seo || {},
      reviewFrequency: reviewFrequency || 'quarterly',
      createdBy: req.user.id
    });

    await faq.save();

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: { faq }
    });

  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating FAQ'
    });
  }
});

// Update FAQ (Admin only)
router.put('/:id', auth, adminAuth, upload.array('attachments', 5), [
  body('question').optional().trim().isLength({ min: 10, max: 500 }),
  body('answer').optional().trim().isLength({ min: 20 }),
  body('category').optional().isIn(['general', 'membership', 'classes', 'equipment', 'payment', 'booking', 'cancellation', 'refund', 'facilities', 'safety', 'nutrition', 'training', 'technical', 'account']),
  body('targetAudience').optional().isIn(['all', 'members', 'non-members', 'trainers', 'staff', 'beginners', 'premium']),
  body('difficulty').optional().isIn(['basic', 'intermediate', 'advanced', 'all']),
  body('tags').optional().isArray(),
  body('priority').optional().isInt({ min: 0, max: 10 }),
  body('featured').optional().isBoolean(),
  body('status').optional().isIn(['draft', 'published', 'archived']),
  body('reviewFrequency').optional().isIn(['monthly', 'quarterly', 'yearly', 'as-needed'])
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

    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    const allowedUpdates = [
      'question', 'answer', 'shortAnswer', 'category', 'subcategory', 'tags', 
      'priority', 'featured', 'status', 'targetAudience', 'difficulty', 
      'relatedFaqs', 'seo', 'reviewFrequency', 'isActive'
    ];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/faq/${file.filename}`,
        type: file.mimetype,
        size: file.size
      }));
      updates.attachments = [...faq.attachments, ...newAttachments];
    }

    updates.lastModifiedBy = req.user.id;

    const updatedFAQ = await FAQ.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
     .populate('lastModifiedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'FAQ updated successfully',
      data: { faq: updatedFAQ }
    });

  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating FAQ'
    });
  }
});

// Mark FAQ as reviewed (Admin only)
router.post('/:id/review', auth, adminAuth, async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.markAsReviewed(req.user.id);

    res.json({
      success: true,
      message: 'FAQ marked as reviewed'
    });

  } catch (error) {
    console.error('Mark FAQ as reviewed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking FAQ as reviewed'
    });
  }
});

// Delete FAQ (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await FAQ.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'FAQ deleted successfully'
    });

  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting FAQ'
    });
  }
});

// Get FAQs needing review (Admin only)
router.get('/admin/needing-review', auth, adminAuth, async (req, res) => {
  try {
    const faqs = await FAQ.getNeedingReview();

    res.json({
      success: true,
      data: { faqs }
    });

  } catch (error) {
    console.error('Get FAQs needing review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching FAQs needing review'
    });
  }
});

// Get FAQ statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalFAQs = await FAQ.countDocuments();
    const publishedFAQs = await FAQ.countDocuments({ status: 'published' });
    const featuredFAQs = await FAQ.countDocuments({ featured: true });
    const needingReview = await FAQ.getNeedingReview();

    const categoryStats = await FAQ.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const difficultyStats = await FAQ.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    const performanceStats = await FAQ.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$analytics.views' },
          totalSearches: { $sum: '$analytics.searches' },
          totalHelpful: { $sum: '$analytics.helpful' },
          totalNotHelpful: { $sum: '$analytics.notHelpful' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalFAQs,
        publishedFAQs,
        featuredFAQs,
        needingReview: needingReview.length,
        categoryStats,
        difficultyStats,
        performanceStats: performanceStats[0] || { 
          totalViews: 0, 
          totalSearches: 0, 
          totalHelpful: 0, 
          totalNotHelpful: 0 
        }
      }
    });

  } catch (error) {
    console.error('Get FAQ stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching FAQ statistics'
    });
  }
});

module.exports = router;
