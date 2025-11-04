const express = require('express');
const { body, validationResult } = require('express-validator');
const News = require('../models/News');
const { auth, adminAuth } = require('../middleware/auth');
const { createCloudinaryStorage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();

// Configure Cloudinary for image uploads
const upload = createCloudinaryStorage('news', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880); // 5MB

// Get all news (Admin only)
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
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const news = await News.find(query)
      .populate('author', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await News.countDocuments(query);

    res.json({
      success: true,
      data: {
        news,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching news'
    });
  }
});

// Get public news (for website/portal integration)
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category || '';
    const featured = req.query.featured === 'true';
    const limitContent = req.query.limitContent === 'true';

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

    const news = await News.find(query)
      .populate('author', 'firstName lastName')
      .sort({ priority: -1, publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(limitContent ? '-content' : '');

    const total = await News.countDocuments(query);

    res.json({
      success: true,
      data: {
        news,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get public news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public news'
    });
  }
});

// Get news by slug (public)
router.get('/public/slug/:slug', async (req, res) => {
  try {
    const news = await News.findOne({ 
      slug: req.params.slug, 
      status: 'published', 
      isActive: true 
    })
    .populate('author', 'firstName lastName email')
    .populate('comments.user', 'firstName lastName');

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    // Increment views
    await news.incrementViews();

    res.json({
      success: true,
      data: { news }
    });

  } catch (error) {
    console.error('Get news by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching news article'
    });
  }
});

// Get featured news (public)
router.get('/public/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const news = await News.getFeatured(limit);

    res.json({
      success: true,
      data: { news }
    });

  } catch (error) {
    console.error('Get featured news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured news'
    });
  }
});

// Get news by category (public)
router.get('/public/category/:category', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const news = await News.getByCategory(req.params.category, limit, page);

    res.json({
      success: true,
      data: { news }
    });

  } catch (error) {
    console.error('Get news by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching news by category'
    });
  }
});

// Get news by ID (Admin only)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author', 'firstName lastName email')
      .populate('comments.user', 'firstName lastName');

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    res.json({
      success: true,
      data: { news }
    });

  } catch (error) {
    console.error('Get news by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching news article'
    });
  }
});

// Create new news article (Admin only)
router.post('/', auth, adminAuth, upload.fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('excerpt').trim().isLength({ min: 10, max: 500 }).withMessage('Excerpt must be between 10 and 500 characters'),
  body('content').trim().isLength({ min: 50 }).withMessage('Content must be at least 50 characters'),
  body('category').isIn(['General', 'Fitness', 'Nutrition', 'Events', 'Promotions', 'Health', 'Technology', 'Community']).withMessage('Invalid category'),
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
      excerpt,
      content,
      category,
      tags,
      priority,
      featured,
      status,
      seo,
      socialMedia
    } = req.body;

    // Handle file uploads from Cloudinary
    let featuredImage = null;
    let gallery = [];

    if (req.files) {
      if (req.files.featuredImage && req.files.featuredImage[0]) {
        const uploadedFile = req.files.featuredImage[0];
        featuredImage = {
          url: uploadedFile.secure_url || uploadedFile.url,
          publicId: uploadedFile.public_id,
          alt: req.body.featuredImageAlt || '',
          caption: req.body.featuredImageCaption || '',
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

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    // Check if slug already exists
    const existingNews = await News.findOne({ slug });
    if (existingNews) {
      return res.status(400).json({
        success: false,
        message: 'A news article with this title already exists'
      });
    }

    const news = new News({
      title,
      slug,
      excerpt,
      content,
      featuredImage,
      gallery,
      category,
      tags: tags || [],
      author: req.user.id,
      priority: priority || 0,
      featured: featured || false,
      status: status || 'draft',
      publishedAt: status === 'published' ? new Date() : null,
      seo: seo || {},
      socialMedia: socialMedia || {}
    });

    await news.save();

    res.status(201).json({
      success: true,
      message: 'News article created successfully',
      data: { news }
    });

  } catch (error) {
    console.error('Create news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating news article'
    });
  }
});

// Update news article (Admin only)
router.put('/:id', auth, adminAuth, upload.fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('excerpt').optional().trim().isLength({ min: 10, max: 500 }),
  body('content').optional().trim().isLength({ min: 50 }),
  body('category').optional().isIn(['General', 'Fitness', 'Nutrition', 'Events', 'Promotions', 'Health', 'Technology', 'Community']),
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

    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    const allowedUpdates = [
      'title', 'excerpt', 'content', 'category', 'tags', 'priority', 
      'featured', 'status', 'seo', 'socialMedia', 'isActive'
    ];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle file uploads from Cloudinary
    if (req.files) {
      if (req.files.featuredImage && req.files.featuredImage[0]) {
        // Delete old image from Cloudinary if exists
        if (news.featuredImage && news.featuredImage.publicId) {
          try {
            await deleteImage(news.featuredImage.publicId);
          } catch (deleteError) {
            console.log('Old image deletion warning:', deleteError.message);
          }
        }

        const uploadedFile = req.files.featuredImage[0];
        updates.featuredImage = {
          url: uploadedFile.secure_url || uploadedFile.url,
          publicId: uploadedFile.public_id,
          alt: req.body.featuredImageAlt || news.featuredImage?.alt || '',
          caption: req.body.featuredImageCaption || news.featuredImage?.caption || '',
          width: uploadedFile.width,
          height: uploadedFile.height,
          format: uploadedFile.format
        };
      }

      if (req.files.gallery && req.files.gallery.length > 0) {
        // Delete old gallery images if exists
        if (news.gallery && news.gallery.length > 0) {
          for (const oldImage of news.gallery) {
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
    if (updates.title && updates.title !== news.title) {
      updates.slug = updates.title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');

      // Check if new slug already exists
      const existingNews = await News.findOne({ slug: updates.slug, _id: { $ne: req.params.id } });
      if (existingNews) {
        return res.status(400).json({
          success: false,
          message: 'A news article with this title already exists'
        });
      }
    }

    // Set publishedAt if status changed to published
    if (updates.status === 'published' && news.status !== 'published') {
      updates.publishedAt = new Date();
    }

    const updatedNews = await News.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('author', 'firstName lastName email');

    res.json({
      success: true,
      message: 'News article updated successfully',
      data: { news: updatedNews }
    });

  } catch (error) {
    console.error('Update news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating news article'
    });
  }
});

// Delete news article (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    // Delete images from Cloudinary if exists
    if (news.featuredImage && news.featuredImage.publicId) {
      try {
        await deleteImage(news.featuredImage.publicId);
      } catch (deleteError) {
        console.log('Image deletion warning:', deleteError.message);
      }
    }

    if (news.gallery && news.gallery.length > 0) {
      for (const image of news.gallery) {
        if (image.publicId) {
          try {
            await deleteImage(image.publicId);
          } catch (deleteError) {
            console.log('Gallery image deletion warning:', deleteError.message);
          }
        }
      }
    }

    await News.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'News article deleted successfully'
    });

  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting news article'
    });
  }
});

// Add comment to news (public)
router.post('/:id/comments', async (req, res) => {
  try {
    const { content, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Content and userId are required'
      });
    }

    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    await news.addComment(userId, content);

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

// Get news statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalNews = await News.countDocuments();
    const publishedNews = await News.countDocuments({ status: 'published' });
    const draftNews = await News.countDocuments({ status: 'draft' });
    const featuredNews = await News.countDocuments({ featured: true });

    const categoryStats = await News.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const monthlyStats = await News.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        totalNews,
        publishedNews,
        draftNews,
        featuredNews,
        categoryStats,
        monthlyStats
      }
    });

  } catch (error) {
    console.error('Get news stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching news statistics'
    });
  }
});

module.exports = router;
