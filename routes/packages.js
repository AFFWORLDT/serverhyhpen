const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Package = require('../models/Package');
const MemberPackage = require('../models/MemberPackage');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { auth } = require('../middleware/auth');
const { isAdmin, isAdminOrStaff } = require('../middleware/roleAuth');

/**
 * @swagger
 * /packages:
 *   get:
 *     summary: Get all packages
 *     tags: [Packages]
 *     security: []
 *     responses:
 *       200:
 *         description: List of all packages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 packages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Package'
 */
// Get all packages (public - for display)
router.get('/', async (req, res) => {
  try {
    const { isActive, category } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    if (category) {
      filter.category = category;
    }
    
    const packages = await Package.find(filter)
      .populate('includedPrograms', 'name description')
      .sort({ displayOrder: 1, sessions: 1 });
    
    res.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Get package statistics (admin only) - MUST come before /:id route
router.get('/stats/overview', auth, isAdmin, async (req, res) => {
  try {
    const totalPackages = await Package.countDocuments({ isActive: true });
    const activeMembers = await MemberPackage.countDocuments({ status: 'active' });
    const expiredPackages = await MemberPackage.countDocuments({ status: 'expired' });
    const completedPackages = await MemberPackage.countDocuments({ status: 'completed' });
    
    // Revenue from packages (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyRevenue = await MemberPackage.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaid' }
        }
      }
    ]);
    
    // Most popular packages
    const popularPackages = await MemberPackage.aggregate([
      {
        $group: {
          _id: '$package',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'packages',
          localField: '_id',
          foreignField: '_id',
          as: 'packageInfo'
        }
      },
      {
        $unwind: '$packageInfo'
      },
      {
        $project: {
          name: '$packageInfo.name',
          sessions: '$packageInfo.sessions',
          count: 1
        }
      }
    ]);
    
    res.json({
      totalPackages,
      activeMembers,
      expiredPackages,
      completedPackages,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      popularPackages
    });
  } catch (error) {
    console.error('Error fetching package stats:', error);
    res.status(500).json({ error: 'Failed to fetch package statistics' });
  }
});

// Get package sales statistics for a specific package - MUST come before /:id route
router.get('/:id/stats', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const package = await Package.findById(id);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    // Get all member packages for this package
    const memberPackages = await MemberPackage.find({ package: id })
      .populate('member', 'firstName lastName email phone')
      .populate('assignedTrainer', 'firstName lastName')
      .populate('purchasedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    // Calculate statistics
    const totalSold = memberPackages.length;
    const totalRevenue = memberPackages.reduce((sum, mp) => sum + (mp.amountPaid || 0), 0);
    const activeCount = memberPackages.filter(mp => mp.status === 'active').length;
    const expiredCount = memberPackages.filter(mp => mp.status === 'expired').length;
    const completedCount = memberPackages.filter(mp => mp.status === 'completed').length;
    const cancelledCount = memberPackages.filter(mp => mp.status === 'cancelled').length;
    
    // Revenue by month (last 12 months)
    const revenueByMonth = await MemberPackage.aggregate([
      {
        $match: { package: new mongoose.Types.ObjectId(id) }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          revenue: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      },
      {
        $limit: 12
      }
    ]);
    
    res.json({
      success: true,
      data: {
        package: {
          id: package._id,
          name: package.name,
          sessions: package.sessions,
          totalPrice: package.totalPrice
        },
        statistics: {
          totalSold,
          totalRevenue,
          activeCount,
          expiredCount,
          completedCount,
          cancelledCount
        },
        revenueByMonth,
        memberPackages: memberPackages.map(mp => ({
          id: mp._id,
          member: mp.member ? {
            id: mp.member._id,
            name: `${mp.member.firstName} ${mp.member.lastName}`,
            email: mp.member.email,
            phone: mp.member.phone
          } : null,
          status: mp.status,
          sessionsTotal: mp.sessionsTotal,
          sessionsUsed: mp.sessionsUsed,
          sessionsRemaining: mp.sessionsRemaining,
          validityStart: mp.validityStart,
          validityEnd: mp.validityEnd,
          amountPaid: mp.amountPaid,
          paymentMethod: mp.paymentMethod,
          paymentDate: mp.paymentDate,
          assignedTrainer: mp.assignedTrainer ? {
            id: mp.assignedTrainer._id,
            name: `${mp.assignedTrainer.firstName} ${mp.assignedTrainer.lastName}`
          } : null,
          purchasedBy: mp.purchasedBy ? {
            id: mp.purchasedBy._id,
            name: `${mp.purchasedBy.firstName} ${mp.purchasedBy.lastName}`
          } : null,
          createdAt: mp.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching package stats:', error);
    res.status(500).json({ error: 'Failed to fetch package statistics' });
  }
});

// Get single package by ID
router.get('/:id', async (req, res) => {
  try {
    const package = await Package.findById(req.params.id)
      .populate('includedPrograms', 'name description duration');
    
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json(package);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

// Create new package (admin only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      sessions,
      pricePerSession,
      totalPrice,
      validityMonths,
      photo,
      category,
      features,
      includedPrograms,
      discountPercentage,
      displayOrder,
      notes
    } = req.body;
    
    // Validation
    if (!name || sessions === undefined || !pricePerSession || !totalPrice || validityMonths === undefined) {
      return res.status(400).json({ error: 'Missing required fields: name, sessions, pricePerSession, totalPrice, validityMonths' });
    }
    
    const newPackage = new Package({
      name,
      description,
      sessions,
      pricePerSession,
      totalPrice,
      validityMonths,
      photo,
      category: category || 'basic',
      features: features || [],
      includedPrograms: includedPrograms || [],
      discountPercentage: discountPercentage || 0,
      displayOrder: displayOrder || 0,
      notes,
      createdBy: req.user.userId
    });
    
    await newPackage.save();
    
    res.status(201).json({
      message: 'Package created successfully',
      package: newPackage
    });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// Update package (admin only)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      sessions,
      pricePerSession,
      totalPrice,
      validityMonths,
      photo,
      isActive,
      category,
      features,
      includedPrograms,
      discountPercentage,
      displayOrder,
      notes
    } = req.body;
    
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    // Update fields
    if (name !== undefined) package.name = name;
    if (description !== undefined) package.description = description;
    if (sessions !== undefined) package.sessions = sessions;
    if (pricePerSession !== undefined) package.pricePerSession = pricePerSession;
    if (totalPrice !== undefined) package.totalPrice = totalPrice;
    if (validityMonths !== undefined) package.validityMonths = validityMonths;
    if (photo !== undefined) package.photo = photo;
    if (isActive !== undefined) package.isActive = isActive;
    if (category !== undefined) package.category = category;
    if (features !== undefined) package.features = features;
    if (includedPrograms !== undefined) package.includedPrograms = includedPrograms;
    if (discountPercentage !== undefined) package.discountPercentage = discountPercentage;
    if (displayOrder !== undefined) package.displayOrder = displayOrder;
    if (notes !== undefined) package.notes = notes;
    
    package.updatedBy = req.user.userId;
    
    await package.save();
    
    res.json({
      message: 'Package updated successfully',
      package
    });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Delete package (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    // Check if package is in use by any member
    const activeMembers = await MemberPackage.countDocuments({
      package: req.params.id,
      status: 'active'
    });
    
    if (activeMembers > 0) {
      return res.status(400).json({
        error: `Cannot delete package. ${activeMembers} member(s) are currently using this package. Consider deactivating instead.`
      });
    }
    
    await Package.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// ==================== MEMBER PACKAGE ROUTES ====================

// Assign package to member (admin/staff only)
router.post('/assign', isAdminOrStaff, async (req, res) => {
  try {
    const {
      memberId,
      packageId,
      amountPaid,
      paymentMethod,
      paymentReference,
      assignedTrainer,
      notes
    } = req.body;
    
    // Validation
    if (!memberId || !packageId || amountPaid === undefined) {
      return res.status(400).json({ error: 'Missing required fields: memberId, packageId, amountPaid' });
    }
    
    // Check member exists
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member') {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Check package exists
    const package = await Package.findById(packageId);
    if (!package) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    if (!package.isActive) {
      return res.status(400).json({ error: 'Cannot assign inactive package' });
    }
    
    // Calculate validity dates
    const validityStart = new Date();
    const validityEnd = new Date();
    validityEnd.setMonth(validityEnd.getMonth() + package.validityMonths);
    
    // Create member package record
    const memberPackage = new MemberPackage({
      member: memberId,
      package: packageId,
      sessionsTotal: package.sessions,
      sessionsUsed: 0,
      sessionsRemaining: package.sessions,
      validityStart,
      validityEnd,
      status: 'active',
      amountPaid,
      paymentMethod: paymentMethod || 'cash',
      paymentReference,
      assignedTrainer: assignedTrainer || member.assignedTrainer,
      notes,
      purchasedBy: req.user.userId
    });
    
    await memberPackage.save();
    
    // Update member's current package info
    member.sessionsTotal = package.sessions;
    member.sessionsUsed = 0;
    member.membershipValidityStart = validityStart;
    member.membershipValidityEnd = validityEnd;
    if (assignedTrainer) {
      member.assignedTrainer = assignedTrainer;
    }
    await member.save();
    
    // Create payment record
    const payment = new Payment({
      member: memberId,
      amount: amountPaid,
      paymentMethod: paymentMethod || 'cash',
      paymentDate: new Date(),
      status: 'completed',
      reference: paymentReference,
      description: `Package Purchase: ${package.name}`,
      metadata: {
        packageId: packageId,
        packageName: package.name,
        sessions: package.sessions,
        validityMonths: package.validityMonths
      },
      processedBy: req.user.userId
    });
    
    await payment.save();
    
    // Send email confirmation
    try {
      const SMTPSettings = require('../models/SMTPSettings');
      const Email = require('../utils/email');
      
      const smtpSettings = await SMTPSettings.findOne();
      if (smtpSettings && smtpSettings.isActive && member.email) {
        const email = new Email(smtpSettings);
        await email.send({
          to: member.email,
          subject: `Package Assigned: ${package.name}`,
          html: `
            <h2>Package Assignment Confirmation</h2>
            <p>Dear ${member.firstName} ${member.lastName},</p>
            <p>Your package has been successfully assigned!</p>
            <h3>Package Details:</h3>
            <ul>
              <li><strong>Package:</strong> ${package.name}</li>
              <li><strong>Sessions:</strong> ${package.sessions}</li>
              <li><strong>Validity:</strong> ${validityStart.toLocaleDateString()} - ${validityEnd.toLocaleDateString()}</li>
              <li><strong>Amount Paid:</strong> AED ${amountPaid}</li>
              <li><strong>Payment Method:</strong> ${paymentMethod || 'cash'}</li>
            </ul>
            <p>Thank you for choosing us!</p>
          `
        });
        console.log(`✅ Email sent to ${member.email}`);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails
    }
    
    res.status(201).json({
      message: 'Package assigned successfully',
      memberPackage: await memberPackage.populate([
        { path: 'member', select: 'firstName lastName email' },
        { path: 'package', select: 'name sessions validityMonths totalPrice' },
        { path: 'assignedTrainer', select: 'firstName lastName' }
      ]),
      payment
    });
  } catch (error) {
    console.error('Error assigning package:', error);
    res.status(500).json({ error: 'Failed to assign package' });
  }
});

// Get member's packages (history + active)
router.get('/member/:memberId', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status } = req.query;
    
    // Authorization: member can only view their own, admin/staff can view any
    if (req.user && req.user.role === 'member' && req.user.userId.toString() !== memberId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const filter = { member: memberId };
    if (status) {
      filter.status = status;
    }
    
    const packages = await MemberPackage.find(filter)
      .populate('package', 'name sessions pricePerSession totalPrice validityMonths')
      .populate('assignedTrainer', 'firstName lastName email profileImage')
      .populate('purchasedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json(packages);
  } catch (error) {
    console.error('Error fetching member packages:', error);
    res.status(500).json({ error: 'Failed to fetch member packages' });
  }
});

// Get member's active package
router.get('/member/:memberId/active', auth, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Authorization: member can only view their own, admin/staff can view any
    if (req.user && req.user.role === 'member' && req.user.userId.toString() !== memberId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const activePackage = await MemberPackage.findOne({
      member: memberId,
      status: 'active'
    })
      .populate('package', 'name sessions pricePerSession totalPrice validityMonths features')
      .populate('assignedTrainer', 'firstName lastName email phone profileImage')
      .sort({ validityEnd: -1 }); // Get the one expiring last if multiple active
    
    if (!activePackage) {
      return res.status(404).json({ error: 'No active package found' });
    }
    
    res.json(activePackage);
  } catch (error) {
    console.error('Error fetching active package:', error);
    res.status(500).json({ error: 'Failed to fetch active package' });
  }
});

// Extend package (admin only)
router.post('/member-package/:id/extend', isAdmin, async (req, res) => {
  try {
    const { additionalDays, additionalSessions, amountPaid, reason } = req.body;
    
    const memberPackage = await MemberPackage.findById(req.params.id);
    if (!memberPackage) {
      return res.status(404).json({ error: 'Member package not found' });
    }
    
    await memberPackage.extend(
      additionalDays || 0,
      additionalSessions || 0,
      req.user.userId,
      amountPaid || 0,
      reason
    );
    
    // If additional sessions, update member's total sessions
    if (additionalSessions > 0) {
      const member = await User.findById(memberPackage.member);
      if (member) {
        member.sessionsTotal += additionalSessions;
        await member.save();
      }
    }
    
    res.json({
      message: 'Package extended successfully',
      memberPackage: await memberPackage.populate([
        { path: 'package', select: 'name' },
        { path: 'member', select: 'firstName lastName' }
      ])
    });
  } catch (error) {
    console.error('Error extending package:', error);
    res.status(500).json({ error: 'Failed to extend package' });
  }
});

// Freeze package (admin only)
router.post('/member-package/:id/freeze', isAdmin, async (req, res) => {
  try {
    const { days, reason } = req.body;
    
    if (!days || days < 1) {
      return res.status(400).json({ error: 'Invalid freeze duration' });
    }
    
    const memberPackage = await MemberPackage.findById(req.params.id);
    if (!memberPackage) {
      return res.status(404).json({ error: 'Member package not found' });
    }
    
    if (memberPackage.status !== 'active') {
      return res.status(400).json({ error: 'Can only freeze active packages' });
    }
    
    await memberPackage.freeze(days, reason);
    
    // Update member's validity end date
    const member = await User.findById(memberPackage.member);
    if (member) {
      member.membershipValidityEnd = memberPackage.validityEnd;
      await member.save();
    }
    
    res.json({
      message: `Package frozen for ${days} days`,
      memberPackage: await memberPackage.populate([
        { path: 'package', select: 'name' },
        { path: 'member', select: 'firstName lastName' }
      ])
    });
  } catch (error) {
    console.error('Error freezing package:', error);
    res.status(500).json({ error: 'Failed to freeze package' });
  }
});

// Cancel package (admin only)
router.post('/member-package/:id/cancel', isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const memberPackage = await MemberPackage.findById(req.params.id);
    if (!memberPackage) {
      return res.status(404).json({ error: 'Member package not found' });
    }
    
    memberPackage.status = 'cancelled';
    memberPackage.cancelledBy = req.user.userId;
    memberPackage.cancellationDate = new Date();
    memberPackage.cancellationReason = reason;
    
    await memberPackage.save();
    
    res.json({
      message: 'Package cancelled successfully',
      memberPackage: await memberPackage.populate([
        { path: 'package', select: 'name' },
        { path: 'member', select: 'firstName lastName' }
      ])
    });
  } catch (error) {
    console.error('Error cancelling package:', error);
    res.status(500).json({ error: 'Failed to cancel package' });
  }
});

// Bulk schedule sessions for a member package
router.post('/member-package/:id/bulk-schedule', isAdminOrStaff, async (req, res) => {
  try {
    const { 
      numberOfSessions, // NEW: How many sessions to schedule (optional, defaults to all)
      frequency, // 'daily', 'weekly', 'biweekly', 'custom'
      daysOfWeek, // [1, 3, 5] for Mon, Wed, Fri
      startTime, // '18:00'
      duration, // 60 minutes
      trainerId,
      programId,
      location,
      startDate,
      customDates // Array of specific dates for custom scheduling
    } = req.body;

    const memberPackage = await MemberPackage.findById(req.params.id).populate('member');
    if (!memberPackage) {
      return res.status(404).json({ error: 'Member package not found' });
    }

    if (memberPackage.status !== 'active') {
      return res.status(400).json({ error: 'Package must be active to schedule sessions' });
    }

    const Appointment = require('../models/Appointment');
    
    // Use numberOfSessions if provided, otherwise schedule all remaining
    const requestedSessions = numberOfSessions ? parseInt(numberOfSessions) : memberPackage.sessionsRemaining;
    const sessionsToSchedule = Math.min(requestedSessions, memberPackage.sessionsRemaining);
    
    if (sessionsToSchedule === 0) {
      return res.status(400).json({ error: 'No remaining sessions to schedule' });
    }

    // Calculate session dates based on frequency
    const sessionDates = [];
    const startDateObj = startDate ? new Date(startDate) : new Date();
    const validityEnd = new Date(memberPackage.validityEnd);

    if (frequency === 'custom' && customDates) {
      // Use provided custom dates
      customDates.slice(0, sessionsToSchedule).forEach(date => {
        const dateObj = new Date(date);
        if (dateObj <= validityEnd) {
          sessionDates.push(dateObj);
        }
      });
    } else {
      // Auto-generate dates based on frequency
      let currentDate = new Date(startDateObj);
      let scheduledCount = 0;

      while (scheduledCount < sessionsToSchedule && currentDate <= validityEnd) {
        const dayOfWeek = currentDate.getDay();
        
        // Check if this day should have a session
        let shouldSchedule = false;
        
        if (frequency === 'daily') {
          shouldSchedule = dayOfWeek >= 1 && dayOfWeek <= 5; // Mon-Fri
        } else if (frequency === 'weekly') {
          shouldSchedule = daysOfWeek && daysOfWeek.includes(dayOfWeek);
        } else if (frequency === 'biweekly') {
          const weekNumber = Math.floor((currentDate - startDateObj) / (7 * 24 * 60 * 60 * 1000));
          shouldSchedule = weekNumber % 2 === 0 && daysOfWeek && daysOfWeek.includes(dayOfWeek);
        }

        if (shouldSchedule) {
          sessionDates.push(new Date(currentDate));
          scheduledCount++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Create appointments for each session date (optimized bulk insert)
    const [hours, minutes] = startTime.split(':');
    const appointmentsToCreate = [];
    const conflicts = [];

    // Fetch all existing appointments in one query
    const allStartTimes = sessionDates.map(date => {
      const start = new Date(date);
      start.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return start;
    });

    const existingAppointments = await Appointment.find({
      $or: [
        { client: memberPackage.member._id },
        { staff: trainerId || memberPackage.assignedTrainer }
      ],
      startTime: { 
        $gte: allStartTimes[0], 
        $lte: new Date(allStartTimes[allStartTimes.length - 1].getTime() + (duration || 60) * 60000)
      },
      status: { $in: ['scheduled', 'pending_reschedule'] }
    });

    // Build a Set for fast conflict checking
    const existingTimesSet = new Set(
      existingAppointments.map(apt => 
        `${apt.client}-${apt.startTime.getTime()}-${apt.staff}`
      )
    );

    // Prepare appointments to create
    for (const sessionDate of sessionDates) {
      const appointmentStart = new Date(sessionDate);
      appointmentStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const appointmentEnd = new Date(appointmentStart);
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + (duration || 60));

      // Quick conflict check using Set
      const conflictKey = `${memberPackage.member._id}-${appointmentStart.getTime()}-${trainerId || memberPackage.assignedTrainer}`;
      
      if (existingTimesSet.has(conflictKey)) {
        conflicts.push({
          date: appointmentStart,
          reason: 'Conflict with existing appointment'
        });
        continue;
      }

      appointmentsToCreate.push({
        client: memberPackage.member._id,
        staff: trainerId || memberPackage.assignedTrainer,
        program: programId,
        location: location || 'Main Gym',
        startTime: appointmentStart,
        endTime: appointmentEnd,
        duration: duration || 60,
        title: `${memberPackage.package?.name || 'Training'} Session`,
        status: 'scheduled',
        createdBy: req.user.userId
      });
    }

    // Bulk insert all appointments at once
    const createdAppointments = await Appointment.insertMany(appointmentsToCreate);

    res.json({
      success: true,
      message: `Successfully scheduled ${createdAppointments.length} sessions`,
      data: {
        scheduled: createdAppointments.length,
        conflicts: conflicts.length,
        appointments: createdAppointments,
        conflictDetails: conflicts,
        remainingSessions: sessionsToSchedule - createdAppointments.length
      }
    });

  } catch (error) {
    console.error('Bulk schedule error:', error);
    res.status(500).json({ error: 'Failed to schedule sessions' });
  }
});

// Get suggested schedule for a member package
router.get('/member-package/:id/suggest-schedule', isAdminOrStaff, async (req, res) => {
  try {
    const memberPackage = await MemberPackage.findById(req.params.id).populate('member assignedTrainer');
    if (!memberPackage) {
      return res.status(404).json({ error: 'Member package not found' });
    }

    const sessionsRemaining = memberPackage.sessionsRemaining;
    const validityEnd = new Date(memberPackage.validityEnd);
    const today = new Date();
    const daysRemaining = Math.ceil((validityEnd - today) / (1000 * 60 * 60 * 24));

    // Calculate optimal frequency
    let suggestedFrequency = 'weekly';
    let suggestedDaysOfWeek = [1, 3, 5]; // Mon, Wed, Fri
    
    if (sessionsRemaining / daysRemaining > 0.5) {
      suggestedFrequency = 'daily';
      suggestedDaysOfWeek = [1, 2, 3, 4, 5]; // Mon-Fri
    } else if (sessionsRemaining / daysRemaining < 0.15) {
      suggestedFrequency = 'weekly';
      suggestedDaysOfWeek = [1, 3]; // Mon, Wed
    }

    res.json({
      success: true,
      data: {
        sessionsRemaining,
        daysRemaining,
        suggestedFrequency,
        suggestedDaysOfWeek,
        suggestedTime: '18:00', // 6 PM default
        suggestedDuration: 60,
        trainer: memberPackage.assignedTrainer ? {
          _id: memberPackage.assignedTrainer._id,
          name: `${memberPackage.assignedTrainer.firstName} ${memberPackage.assignedTrainer.lastName}`
        } : null
      }
    });

  } catch (error) {
    console.error('Suggest schedule error:', error);
    res.status(500).json({ error: 'Failed to generate schedule suggestions' });
  }
});

// Reschedule all sessions for a member package
router.post('/member-package/:id/reschedule-all', isAdminOrStaff, async (req, res) => {
  try {
    const { newSchedule } = req.body; // Same format as bulk-schedule
    const memberPackage = await MemberPackage.findById(req.params.id).populate('member');
    
    if (!memberPackage) {
      return res.status(404).json({ error: 'Member package not found' });
    }

    const Appointment = require('../models/Appointment');

    // Find all scheduled appointments for this member
    const existingAppointments = await Appointment.find({
      client: memberPackage.member._id,
      status: { $in: ['scheduled', 'pending_reschedule'] }
    });

    // Delete all existing scheduled appointments
    await Appointment.deleteMany({
      client: memberPackage.member._id,
      status: { $in: ['scheduled', 'pending_reschedule'] }
    });

    console.log(`Deleted ${existingAppointments.length} existing appointments`);

    // Now create new schedule using the same logic as bulk-schedule
    const { 
      frequency, daysOfWeek, startTime, duration, 
      trainerId, programId, location, startDate 
    } = newSchedule;

    const sessionDates = [];
    const startDateObj = startDate ? new Date(startDate) : new Date();
    const validityEnd = new Date(memberPackage.validityEnd);
    const sessionsToSchedule = memberPackage.sessionsRemaining;

    // Generate dates based on frequency
    let currentDate = new Date(startDateObj);
    let scheduledCount = 0;

    while (scheduledCount < sessionsToSchedule && currentDate <= validityEnd) {
      const dayOfWeek = currentDate.getDay();
      let shouldSchedule = false;
      
      if (frequency === 'daily') {
        shouldSchedule = dayOfWeek >= 1 && dayOfWeek <= 5;
      } else if (frequency === 'weekly') {
        shouldSchedule = daysOfWeek && daysOfWeek.includes(dayOfWeek);
      } else if (frequency === 'biweekly') {
        const weekNumber = Math.floor((currentDate - startDateObj) / (7 * 24 * 60 * 60 * 1000));
        shouldSchedule = weekNumber % 2 === 0 && daysOfWeek && daysOfWeek.includes(dayOfWeek);
      }

      if (shouldSchedule) {
        sessionDates.push(new Date(currentDate));
        scheduledCount++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create new appointments
    const [hours, minutes] = startTime.split(':');
    const createdAppointments = [];

    for (const sessionDate of sessionDates) {
      const appointmentStart = new Date(sessionDate);
      appointmentStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const appointmentEnd = new Date(appointmentStart);
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + (duration || 60));

      const appointment = new Appointment({
        client: memberPackage.member._id,
        staff: trainerId || memberPackage.assignedTrainer,
        program: programId,
        location: location || 'Main Gym',
        startTime: appointmentStart,
        endTime: appointmentEnd,
        duration: duration || 60,
        title: `${memberPackage.package?.name || 'Training'} Session`,
        status: 'scheduled',
        createdBy: req.user.userId
      });

      await appointment.save();
      createdAppointments.push(appointment);
    }

    res.json({
      success: true,
      message: `Rescheduled all sessions: deleted ${existingAppointments.length}, created ${createdAppointments.length}`,
      data: {
        deleted: existingAppointments.length,
        created: createdAppointments.length,
        appointments: createdAppointments
      }
    });

  } catch (error) {
    console.error('Reschedule all error:', error);
    res.status(500).json({ error: 'Failed to reschedule sessions' });
  }
});

module.exports = router;

