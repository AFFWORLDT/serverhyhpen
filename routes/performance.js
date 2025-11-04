const express = require('express');
const { body, validationResult } = require('express-validator');
const PerformanceReview = require('../models/PerformanceReview');
const User = require('../models/User');
const { auth, adminAuth, adminOrStaffAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /performance:
 *   get:
 *     summary: Get all performance reviews
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of performance reviews
 */
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role !== 'admin') {
      filter.staff = req.user.userId;
    } else if (req.query.staff) {
      filter.staff = req.query.staff;
    }

    const reviews = await PerformanceReview.find(filter)
      .populate('staff', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ 'reviewPeriod.endDate': -1 });

    res.json({
      success: true,
      data: { reviews }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance reviews'
    });
  }
});

/**
 * @swagger
 * /performance:
 *   post:
 *     summary: Create performance review
 *     description: Admin creates performance review with multi-criteria ratings
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - staff
 *               - reviewPeriod
 *               - ratings
 *             properties:
 *               staff:
 *                 type: string
 *               reviewType:
 *                 type: string
 *                 enum: [monthly, quarterly, semi-annual, annual, probation]
 *               reviewPeriod:
 *                 type: object
 *                 properties:
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *               ratings:
 *                 type: object
 *                 properties:
 *                   punctuality:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   workQuality:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   communication:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   teamwork:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                   initiative:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *     responses:
 *       201:
 *         description: Performance review created
 */
router.post('/', auth, adminAuth, [
  body('staff').isMongoId(),
  body('reviewPeriod.startDate').isISO8601(),
  body('reviewPeriod.endDate').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const review = new PerformanceReview({
      ...req.body,
      reviewedBy: req.user.userId
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: 'Performance review created successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create performance review'
    });
  }
});

module.exports = router;

