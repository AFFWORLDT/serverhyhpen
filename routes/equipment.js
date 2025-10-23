const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth, adminOrTrainerAuth } = require('../middleware/auth');

// Equipment Model
const { Equipment } = require('../models/GymSession');

const router = express.Router();

// Get all equipment
router.get('/', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';

    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const equipment = await Equipment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Equipment.countDocuments(query);

    res.json({
      success: true,
      data: {
        equipment,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching equipment'
    });
  }
});

// Get equipment by ID
router.get('/:id', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.json({
      success: true,
      data: { equipment }
    });

  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching equipment'
    });
  }
});

// Create new equipment (Admin only)
router.post('/', auth, adminAuth, [
  body('name').trim().isLength({ min: 2 }).withMessage('Equipment name must be at least 2 characters'),
  body('category').trim().isLength({ min: 2 }).withMessage('Category must be at least 2 characters'),
  body('brand').trim().isLength({ min: 2 }).withMessage('Brand must be at least 2 characters'),
  body('model').trim().isLength({ min: 1 }).withMessage('Model is required'),
  body('serialNumber').trim().isLength({ min: 1 }).withMessage('Serial number is required'),
  body('purchaseDate').isISO8601().withMessage('Please provide a valid purchase date'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),
  body('location').trim().isLength({ min: 2 }).withMessage('Location must be at least 2 characters'),
  body('status').isIn(['active', 'maintenance', 'out_of_order', 'retired']).withMessage('Valid status is required')
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
      name, 
      category, 
      brand, 
      model, 
      serialNumber, 
      purchaseDate, 
      purchasePrice, 
      location, 
      status,
      description,
      warrantyExpiry,
      lastMaintenanceDate,
      nextMaintenanceDate,
      maintenanceNotes
    } = req.body;

    // Check if equipment with same serial number already exists
    const existingEquipment = await Equipment.findOne({ serialNumber });
    if (existingEquipment) {
      return res.status(400).json({
        success: false,
        message: 'Equipment with this serial number already exists'
      });
    }

    // Create new equipment
    const equipment = new Equipment({
      name,
      category,
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchasePrice,
      location,
      status,
      description,
      warrantyExpiry,
      lastMaintenanceDate,
      nextMaintenanceDate,
      maintenanceNotes
    });

    await equipment.save();

    res.status(201).json({
      success: true,
      message: 'Equipment created successfully',
      data: { equipment }
    });

  } catch (error) {
    console.error('Create equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating equipment'
    });
  }
});

// Update equipment (Admin only)
router.put('/:id', auth, adminAuth, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('category').optional().trim().isLength({ min: 2 }),
  body('brand').optional().trim().isLength({ min: 2 }),
  body('model').optional().trim().isLength({ min: 1 }),
  body('serialNumber').optional().trim().isLength({ min: 1 }),
  body('purchaseDate').optional().isISO8601(),
  body('purchasePrice').optional().isFloat({ min: 0 }),
  body('location').optional().trim().isLength({ min: 2 }),
  body('status').optional().isIn(['active', 'maintenance', 'out_of_order', 'retired'])
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

    const allowedUpdates = [
      'name', 'category', 'brand', 'model', 'serialNumber', 'purchaseDate', 
      'purchasePrice', 'location', 'status', 'description', 'warrantyExpiry',
      'lastMaintenanceDate', 'nextMaintenanceDate', 'maintenanceNotes'
    ];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Check if serial number is being updated and if it's already taken
    if (updates.serialNumber) {
      const existingEquipment = await Equipment.findOne({ 
        serialNumber: updates.serialNumber, 
        _id: { $ne: req.params.id } 
      });
      if (existingEquipment) {
        return res.status(400).json({
          success: false,
          message: 'Serial number is already taken by another equipment'
        });
      }
    }

    const equipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.json({
      success: true,
      message: 'Equipment updated successfully',
      data: { equipment }
    });

  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating equipment'
    });
  }
});

// Delete equipment (Admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const equipment = await Equipment.findByIdAndDelete(req.params.id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.json({
      success: true,
      message: 'Equipment deleted successfully'
    });

  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting equipment'
    });
  }
});

// Update equipment status (Admin/Trainer)
router.put('/:id/status', auth, adminOrTrainerAuth, [
  body('status').isIn(['active', 'maintenance', 'out_of_order', 'retired']).withMessage('Valid status is required'),
  body('maintenanceNotes').optional().trim()
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

    const { status, maintenanceNotes } = req.body;

    const equipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        maintenanceNotes,
        lastMaintenanceDate: status === 'maintenance' ? new Date() : undefined
      },
      { new: true }
    );

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found'
      });
    }

    res.json({
      success: true,
      message: 'Equipment status updated successfully',
      data: { equipment }
    });

  } catch (error) {
    console.error('Update equipment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating equipment status'
    });
  }
});

// Get equipment by category
router.get('/category/:category', auth, adminOrTrainerAuth, async (req, res) => {
  try {
    const equipment = await Equipment.find({ 
      category: req.params.category,
      status: 'active'
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: { equipment }
    });

  } catch (error) {
    console.error('Get equipment by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching equipment by category'
    });
  }
});

// Get equipment statistics
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalEquipment = await Equipment.countDocuments();
    const activeEquipment = await Equipment.countDocuments({ status: 'active' });
    const maintenanceEquipment = await Equipment.countDocuments({ status: 'maintenance' });
    const outOfOrderEquipment = await Equipment.countDocuments({ status: 'out_of_order' });
    
    const categoryStats = await Equipment.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const statusStats = await Equipment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Calculate total value
    const totalValue = await Equipment.aggregate([
      { $group: { _id: null, total: { $sum: '$purchasePrice' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalEquipment,
        activeEquipment,
        maintenanceEquipment,
        outOfOrderEquipment,
        totalValue: totalValue[0]?.total || 0,
        categoryStats,
        statusStats
      }
    });

  } catch (error) {
    console.error('Get equipment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching equipment statistics'
    });
  }
});

module.exports = router;
