const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Department = require('../models/Department');
const Ledger = require('../models/Ledger');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Generate expense number
const generateExpenseNumber = async () => {
  const count = await Expense.countDocuments();
  return `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
};

/**
 * @swagger
 * /expenses:
 *   get:
 *     summary: Get all expenses
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
  try {
    const { category, status, department } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (department) filter.department = department;

    const expenses = await Expense.find(filter)
      .populate('department', 'name code')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ expenseDate: -1 });

    res.json({
      success: true,
      data: { expenses }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
  }
});

/**
 * @swagger
 * /expenses:
 *   post:
 *     summary: Create expense
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, async (req, res) => {
  try {
    const expenseNumber = await generateExpenseNumber();
    const expense = new Expense({
      ...req.body,
      expenseNumber,
      createdBy: req.user.userId
    });
    await expense.save();

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: { expense }
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, message: 'Failed to create expense' });
  }
});

// Get single expense
router.get('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('department', 'name code')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, data: { expense } });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expense' });
  }
});

// Update expense
router.put('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    // Only admin or creator can update
    if (req.user.role !== 'admin' && expense.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Can't update if already approved
    if (expense.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot update approved expense' });
    }

    Object.assign(expense, req.body, { updatedAt: Date.now() });
    await expense.save();

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: { expense }
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ success: false, message: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    // Only admin or creator can delete
    if (req.user.role !== 'admin' && expense.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Can't delete if already approved
    if (expense.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot delete approved expense' });
    }

    await Expense.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ success: false, message: 'Failed to delete expense' });
  }
});

// Approve expense
router.post('/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense.status = 'approved';
    expense.approvedBy = req.user.userId;
    await expense.save();

    // Update department budget if assigned
    if (expense.department) {
      const department = await Department.findById(expense.department);
      if (department) {
        department.budget.spent = (department.budget.spent || 0) + expense.amount;
        department.budget.remaining = department.budget.total - department.budget.spent;
        await department.save();
      }
    }

    // Create ledger entry
    const transactionNumber = `TXN-${new Date().getFullYear()}-${String(await Ledger.countDocuments() + 1).padStart(5, '0')}`;
    const ledger = new Ledger({
      transactionNumber,
      transactionType: 'expense',
      category: expense.category,
      description: expense.description,
      debit: expense.amount,
      paymentMethod: expense.paymentMethod,
      reference: expense.reference,
      relatedDocument: {
        documentType: 'expense',
        documentId: expense._id
      },
      department: expense.department,
      createdBy: req.user.userId
    });
    await ledger.save();

    res.json({
      success: true,
      message: 'Expense approved successfully',
      data: { expense }
    });
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({ success: false, message: 'Failed to approve expense' });
  }
});

// Reject expense
router.post('/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense.status = 'rejected';
    expense.approvedBy = req.user.userId;
    if (reason) expense.rejectionReason = reason;
    await expense.save();

    res.json({
      success: true,
      message: 'Expense rejected successfully',
      data: { expense }
    });
  } catch (error) {
    console.error('Error rejecting expense:', error);
    res.status(500).json({ success: false, message: 'Failed to reject expense' });
  }
});

// Get expense statistics
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    let filter = {};
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }
    if (department) filter.department = department;

    const expenses = await Expense.find(filter);

    const stats = {
      total: expenses.length,
      totalAmount: expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
      byStatus: {},
      byCategory: {},
      pendingApproval: expenses.filter(e => e.status === 'pending').length,
      approved: expenses.filter(e => e.status === 'approved').length,
      rejected: expenses.filter(e => e.status === 'rejected').length
    };

    expenses.forEach(exp => {
      stats.byStatus[exp.status] = (stats.byStatus[exp.status] || 0) + 1;
      stats.byCategory[exp.category] = (stats.byCategory[exp.category] || 0) + (exp.amount || 0);
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching expense stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

module.exports = router;

