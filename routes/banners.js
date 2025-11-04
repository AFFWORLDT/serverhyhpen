const express = require('express');
const { body, validationResult } = require('express-validator');
const Banner = require('../models/Banner');
const { auth, adminAuth } = require('../middleware/auth');
const { createCloudinaryStorage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();

// Configure Cloudinary for image uploads
const upload = createCloudinaryStorage('banners', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 10485760); // 10MB

// Get all banners (Admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const type = req.query.type || '';
    const position = req.query.position || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) {
      query.type = type;
    }

    if (position) {
      query.position = position;
    }

    if (status) {
      query.status = status;
    }

    const banners = await Banner.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await Banner.countDocuments(query);

    res.json({
      success: true,
      data: {
        banners,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banners'
    });
  }
});

// Get public banners by position (for website/portal integration)
router.get('/public/position/:position', async (req, res) => {
  try {
    const targetAudience = req.query.audience || 'all';
    const banners = await Banner.getActiveByPosition(req.params.position, targetAudience);

    res.json({
      success: true,
      data: { banners }
    });

  } catch (error) {
    console.error('Get banners by position error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banners by position'
    });
  }
});

// Get public banners by type (for website/portal integration)
router.get('/public/type/:type', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const banners = await Banner.getByType(req.params.type, limit);

    res.json({
      success: true,
      data: { banners }
    });

  } catch (error) {
    console.error('Get banners by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banners by type'
    });
  }
});

// Track banner click (public)
router.post('/:id/click', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await banner.incrementClicks();

    res.json({
      success: true,
      message: 'Click tracked successfully'
    });

  } catch (error) {
    console.error('Track banner click error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking banner click'
    });
  }
});

// Track banner view (public)
router.post('/:id/view', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await banner.incrementViews();

    res.json({
      success: true,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Track banner view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking banner view'
    });
  }
});

// Track banner conversion (public)
router.post('/:id/conversion', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await banner.incrementConversions();

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });

  } catch (error) {
    console.error('Track banner conversion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while tracking banner conversion'
    });
  }
});

// Get banner by ID (Admin only)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email');

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.json({
      success: true,
      data: { banner }
    });

  } catch (error) {
    console.error('Get banner by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banner'
    });
  }
});

// Create new banner (Admin only)
router.post('/', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 }
]), [
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('type').isIn(['hero', 'promotional', 'announcement', 'event', 'offer', 'newsletter', 'social']).withMessage('Invalid banner type'),
  body('position').isIn(['homepage-hero', 'homepage-top', 'homepage-middle', 'homepage-bottom', 'sidebar', 'header', 'footer', 'popup']).withMessage('Invalid banner position'),
  body('priority').optional().isInt({ min: 0, max: 10 }).withMessage('Priority must be between 0 and 10'),
  body('status').optional().isIn(['active', 'inactive', 'scheduled']).withMessage('Invalid status'),
  body('targetAudience').optional().isIn(['all', 'members', 'non-members', 'trainers', 'staff', 'premium']).withMessage('Invalid target audience'),
  body('clickAction.type').optional().isIn(['none', 'url', 'page', 'modal', 'download', 'phone', 'email']).withMessage('Invalid click action type')
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
      subtitle,
      description,
      type,
      position,
      priority,
      status,
      startDate,
      endDate,
      targetAudience,
      clickAction,
      ctaButton,
      design
    } = req.body;

    // Handle file uploads from Cloudinary
    let image = null;
    let mobileImage = null;

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

      if (req.files.mobileImage && req.files.mobileImage[0]) {
        const uploadedFile = req.files.mobileImage[0];
        mobileImage = uploadedFile.secure_url || uploadedFile.url;
      }
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required'
      });
    }

    if (mobileImage) {
      image.mobileUrl = mobileImage;
    }

    const banner = new Banner({
      title,
      subtitle,
      description,
      image,
      type,
      position,
      priority: priority || 0,
      status: status || 'active',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      targetAudience: targetAudience || 'all',
      clickAction: clickAction || { type: 'none' },
      ctaButton: ctaButton || {},
      design: design || {},
      createdBy: req.user.id
    });

    await banner.save();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: { banner }
    });

  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating banner'
    });
  }
});

// Update banner (Admin only)
router.put('/:id', auth, adminAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 }
]), [
  body('title').optional().trim().isLength({ min: 3, max: 100 }),
  body('type').optional().isIn(['hero', 'promotional', 'announcement', 'event', 'offer', 'newsletter', 'social']),
  body('position').optional().isIn(['homepage-hero', 'homepage-top', 'homepage-middle', 'homepage-bottom', 'sidebar', 'header', 'footer', 'popup']),
  body('priority').optional().isInt({ min: 0, max: 10 }),
  body('status').optional().isIn(['active', 'inactive', 'scheduled']),
  body('targetAudience').optional().isIn(['all', 'members', 'non-members', 'trainers', 'staff', 'premium']),
  body('clickAction.type').optional().isIn(['none', 'url', 'page', 'modal', 'download', 'phone', 'email'])
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

    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    const allowedUpdates = [
      'title', 'subtitle', 'description', 'type', 'position', 'priority', 
      'status', 'startDate', 'endDate', 'targetAudience', 'clickAction', 
      'ctaButton', 'design', 'isActive'
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
        if (banner.image && banner.image.publicId) {
          try {
            await deleteImage(banner.image.publicId);
          } catch (deleteError) {
            console.log('Old image deletion warning:', deleteError.message);
          }
        }

        const uploadedFile = req.files.image[0];
        updates.image = {
          url: uploadedFile.secure_url || uploadedFile.url,
          publicId: uploadedFile.public_id,
          alt: req.body.imageAlt || banner.image?.alt || '',
          mobileUrl: banner.image?.mobileUrl,
          width: uploadedFile.width,
          height: uploadedFile.height,
          format: uploadedFile.format
        };
      }

      if (req.files.mobileImage && req.files.mobileImage[0]) {
        const uploadedFile = req.files.mobileImage[0];
        updates.image = updates.image || banner.image || {};
        updates.image.mobileUrl = uploadedFile.secure_url || uploadedFile.url;
      }
    }

    // Handle date fields
    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate);
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate);
    }

    updates.lastModifiedBy = req.user.id;

    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
     .populate('lastModifiedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: { banner: updatedBanner }
    });

  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating banner'
    });
  }
});

// Delete banner (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete images from Cloudinary if exists
    if (banner.image) {
      if (banner.image.publicId) {
        try {
          await deleteImage(banner.image.publicId);
        } catch (deleteError) {
          console.log('Image deletion warning:', deleteError.message);
        }
      }
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });

  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting banner'
    });
  }
});

// Get banner statistics (Admin only)
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalBanners = await Banner.countDocuments();
    const activeBanners = await Banner.countDocuments({ status: 'active', isActive: true });
    const scheduledBanners = await Banner.countDocuments({ status: 'scheduled' });

    const typeStats = await Banner.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const positionStats = await Banner.aggregate([
      { $group: { _id: '$position', count: { $sum: 1 } } }
    ]);

    const performanceStats = await Banner.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$analytics.views' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalConversions: { $sum: '$analytics.conversions' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalBanners,
        activeBanners,
        scheduledBanners,
        typeStats,
        positionStats,
        performanceStats: performanceStats[0] || { totalViews: 0, totalClicks: 0, totalConversions: 0 }
      }
    });

  } catch (error) {
    console.error('Get banner stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banner statistics'
    });
  }
});

module.exports = router;
