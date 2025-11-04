const express = require('express');
const Ledger = require('../models/Ledger');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /ledger:
 *   get:
 *     summary: Get ledger entries
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { transactionType, startDate, endDate, department } = req.query;
    let filter = {};
    if (transactionType) filter.transactionType = transactionType;
    if (department) filter.department = department;
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const entries = await Ledger.find(filter)
      .populate('department', 'name code')
      .populate('createdBy', 'firstName lastName')
      .sort({ transactionDate: -1 });

    // Calculate running balance
    let balance = 0;
    const entriesWithBalance = entries.map(entry => {
      balance += (entry.credit - entry.debit);
      return {
        ...entry.toObject(),
        runningBalance: balance
      };
    });

    res.json({
      success: true,
      data: { entries: entriesWithBalance }
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ledger' });
  }
});

// Get financial summary
router.get('/summary', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const entries = await Ledger.find(filter);
    
    let totalDebit = 0;
    let totalCredit = 0;
    const byCategory = {};

    entries.forEach(entry => {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
      
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = { debit: 0, credit: 0 };
      }
      byCategory[entry.category].debit += entry.debit;
      byCategory[entry.category].credit += entry.credit;
    });

    const netBalance = totalCredit - totalDebit;

    res.json({
      success: true,
      data: {
        totalDebit,
        totalCredit,
        netBalance,
        byCategory,
        transactionCount: entries.length
      }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

// Create manual ledger transaction
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const {
      transactionDate,
      transactionType,
      category,
      description,
      amount,
      paymentMethod,
      reference,
      department
    } = req.body;

    if (!transactionType || !category || !description || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const count = await Ledger.countDocuments();
    const transactionNumber = `TXN-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const debit = ['expense', 'refund'].includes(transactionType) ? Number(amount) : 0;
    const credit = ['income', 'payment', 'transfer'].includes(transactionType) ? Number(amount) : 0;

    const entry = new Ledger({
      transactionNumber,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      transactionType,
      category,
      description,
      debit,
      credit,
      paymentMethod,
      reference,
      department: department || undefined,
      createdBy: req.user.userId
    });

    await entry.save();

    res.status(201).json({ success: true, message: 'Transaction recorded', data: { entry } });
  } catch (error) {
    console.error('Error creating ledger transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to create transaction' });
  }
});

// Get single ledger entry (must come after /summary)
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const entry = await Ledger.findById(req.params.id)
      .populate('department', 'name code')
      .populate('createdBy', 'firstName lastName');
    
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: { entry } });
  } catch (error) {
    console.error('Error fetching ledger entry:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction' });
  }
});

// Update ledger entry
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const {
      transactionDate,
      transactionType,
      category,
      description,
      amount,
      paymentMethod,
      reference,
      department
    } = req.body;

    const entry = await Ledger.findById(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Update fields
    if (transactionDate) entry.transactionDate = new Date(transactionDate);
    if (transactionType) entry.transactionType = transactionType;
    if (category) entry.category = category;
    if (description) entry.description = description;
    if (paymentMethod) entry.paymentMethod = paymentMethod;
    if (reference !== undefined) entry.reference = reference;
    if (department !== undefined) entry.department = department;

    // Recalculate debit/credit if amount or type changed
    if (amount !== undefined || transactionType) {
      const finalAmount = amount !== undefined ? Number(amount) : (entry.debit || entry.credit);
      const finalType = transactionType || entry.transactionType;
      
      entry.debit = ['expense', 'refund'].includes(finalType) ? finalAmount : 0;
      entry.credit = ['income', 'payment', 'transfer'].includes(finalType) ? finalAmount : 0;
    }

    await entry.save();

    res.json({ success: true, message: 'Transaction updated successfully', data: { entry } });
  } catch (error) {
    console.error('Error updating ledger entry:', error);
    res.status(500).json({ success: false, message: 'Failed to update transaction' });
  }
});

// Delete ledger entry
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const entry = await Ledger.findById(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Only allow deletion if not linked to other documents
    if (entry.relatedDocument && entry.relatedDocument.documentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete transaction linked to other documents' 
      });
    }

    await Ledger.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting ledger entry:', error);
    res.status(500).json({ success: false, message: 'Failed to delete transaction' });
  }
});

module.exports = router;

