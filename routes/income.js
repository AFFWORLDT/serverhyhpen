const express = require('express');
const Income = require('../models/Income');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /income:
 *   get:
 *     summary: Get all income records
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
  try {
    const { source, startDate, endDate } = req.query;
    let filter = {};
    if (source) filter.source = source;
    if (startDate || endDate) {
      filter.incomeDate = {};
      if (startDate) filter.incomeDate.$gte = new Date(startDate);
      if (endDate) filter.incomeDate.$lte = new Date(endDate);
    }

    const incomes = await Income.find(filter)
      .populate('client', 'firstName lastName')
      .populate('recordedBy', 'firstName lastName')
      .sort({ incomeDate: -1 });

    const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);

    res.json({
      success: true,
      data: { incomes, totalIncome }
    });
  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch income records' });
  }
});

// Get income analytics (must come before '/:id')
router.get('/analytics', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    if (startDate || endDate) {
      filter.incomeDate = {};
      if (startDate) filter.incomeDate.$gte = new Date(startDate);
      if (endDate) filter.incomeDate.$lte = new Date(endDate);
    }

    const incomes = await Income.find(filter);
    const bySource = {};
    const byPaymentMethod = {};
    let total = 0;

    incomes.forEach(inc => {
      bySource[inc.source] = (bySource[inc.source] || 0) + inc.amount;
      byPaymentMethod[inc.paymentMethod] = (byPaymentMethod[inc.paymentMethod] || 0) + inc.amount;
      total += inc.amount;
    });

    res.json({ success: true, data: { total, bySource, byPaymentMethod, count: incomes.length } });
  } catch (error) {
    console.error('Error fetching income analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

// Get single income record
router.get('/:id', auth, async (req, res) => {
  try {
    const income = await Income.findById(req.params.id)
      .populate('client', 'firstName lastName')
      .populate('recordedBy', 'firstName lastName');
    
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found' });
    }

    res.json({ success: true, data: { income } });
  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch income record' });
  }
});

// Create income record
const generateIncomeNumber = async () => {
  const count = await Income.countDocuments();
  return `INC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
};

router.post('/', auth, async (req, res) => {
  try {
    const incomeNumber = await generateIncomeNumber();
    const income = new Income({
      ...req.body,
      incomeNumber,
      recordedBy: req.user.userId
    });
    await income.save();

    // Create ledger entry
    const Ledger = require('../models/Ledger');
    const transactionNumber = `TXN-${new Date().getFullYear()}-${String(await Ledger.countDocuments() + 1).padStart(5, '0')}`;
    const ledger = new Ledger({
      transactionNumber,
      transactionType: 'income',
      category: income.source,
      description: income.description,
      credit: income.amount,
      paymentMethod: income.paymentMethod,
      reference: income.reference,
      relatedDocument: {
        documentType: 'income',
        documentId: income._id
      },
      createdBy: req.user.userId
    });
    await ledger.save();

    res.status(201).json({
      success: true,
      message: 'Income record created successfully',
      data: { income }
    });
  } catch (error) {
    console.error('Error creating income:', error);
    res.status(500).json({ success: false, message: 'Failed to create income record' });
  }
});

// Update income record
router.put('/:id', auth, async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);
    
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found' });
    }

    // Only admin or creator can update
    if (req.user.role !== 'admin' && income.recordedBy.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const oldAmount = income.amount;
    Object.assign(income, req.body, { updatedAt: Date.now() });
    await income.save();

    // Update ledger if amount changed
    if (req.body.amount && req.body.amount !== oldAmount) {
      const Ledger = require('../models/Ledger');
      await Ledger.updateOne(
        { 'relatedDocument.documentId': income._id, 'relatedDocument.documentType': 'income' },
        { credit: income.amount }
      );
    }

    res.json({
      success: true,
      message: 'Income record updated successfully',
      data: { income }
    });
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({ success: false, message: 'Failed to update income record' });
  }
});

// Delete income record
router.delete('/:id', auth, async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);
    
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found' });
    }

    // Only admin can delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete associated ledger entry
    const Ledger = require('../models/Ledger');
    await Ledger.deleteOne({ 'relatedDocument.documentId': income._id, 'relatedDocument.documentType': 'income' });

    await Income.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Income record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({ success: false, message: 'Failed to delete income record' });
  }
});

// (moved analytics handler above)

module.exports = router;

