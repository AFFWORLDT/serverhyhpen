const express = require('express');
const { body, validationResult } = require('express-validator');
const StaffLeave = require('../models/StaffLeave');
const User = require('../models/User');
const { auth, adminAuth, adminOrStaffAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /leave:
 *   get:
 *     summary: Get all leave requests
 *     tags: [HR Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: List of leave requests
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    
    // If not admin, only show own leaves
    if (req.user.role !== 'admin') {
      filter.staff = req.user.userId;
    }
    
    if (status) {
      filter.status = status;
    }

    const leaves = await StaffLeave.find(filter)
      .populate('staff', 'firstName lastName email phone')
      .populate('approvedBy', 'firstName lastName')
      .sort({ startDate: -1 });

    res.json({
      success: true,
      data: { leaves }
    });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests'
    });
  }
});

/**
 * @swagger
 * /leave:
 *   post:
 *     summary: Submit leave request
 *     description: Staff/trainers can submit leave requests. Auto-calculates days.
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
 *               - leaveType
 *               - startDate
 *               - endDate
 *               - reason
 *             properties:
 *               leaveType:
 *                 type: string
 *                 enum: [annual, sick, personal, emergency, maternity, paternity, unpaid]
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *                 minLength: 10
 *     responses:
 *       201:
 *         description: Leave request submitted successfully
 *       400:
 *         description: Validation error
 */
router.post('/', auth, [
  body('leaveType').isIn(['annual', 'sick', 'personal', 'emergency', 'maternity', 'paternity', 'unpaid']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('reason').trim().isLength({ min: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { leaveType, startDate, endDate, reason } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = new StaffLeave({
      staff: req.user.userId,
      leaveType,
      startDate: start,
      endDate: end,
      daysRequested,
      reason
    });

    await leave.save();

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: { leave }
    });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create leave request'
    });
  }
});

// Approve/Reject leave
router.put('/:id/approve', auth, adminAuth, [
  body('action').isIn(['approve', 'reject'])
], async (req, res) => {
  try {
    const { action, rejectionReason } = req.body;
    const leave = await StaffLeave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (action === 'approve') {
      leave.status = 'approved';
      leave.approvedBy = req.user.userId;
      leave.approvedAt = new Date();
    } else {
      leave.status = 'rejected';
      leave.rejectionReason = rejectionReason || 'No reason provided';
    }

    await leave.save();

    res.json({
      success: true,
      message: `Leave ${action}d successfully`,
      data: { leave }
    });
  } catch (error) {
    console.error('Error updating leave:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leave request'
    });
  }
});

module.exports = router;

