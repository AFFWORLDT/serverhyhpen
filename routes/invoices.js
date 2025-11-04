const express = require('express');
const { body, validationResult } = require('express-validator');
const Invoice = require('../models/Invoice');
const Receipt = require('../models/Receipt');
const Income = require('../models/Income');
const Ledger = require('../models/Ledger');
const CompanySettings = require('../models/CompanySettings');
const { auth, adminAuth } = require('../middleware/auth');
const { generateInvoicePDF, generateReceiptPDF } = require('../utils/pdfGenerator');

const router = express.Router();

// Generate invoice number
const generateInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
};

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: Get all invoices
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status, client } = req.query;
    let filter = {};
    if (status) filter.status = status;
    if (client) filter.client = client;

    const invoices = await Invoice.find(filter)
      .populate('client', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ invoiceDate: -1 });

    res.json({
      success: true,
      data: { invoices }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
});

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Create invoice
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const invoiceNumber = await generateInvoiceNumber();
    const invoice = new Invoice({
      ...req.body,
      invoiceNumber,
      createdBy: req.user.userId
    });
    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: { invoice }
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to create invoice' });
  }
});

// Get single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: { invoice } });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
});

// Update invoice
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice }
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to update invoice' });
  }
});

// Record payment
router.post('/:id/payment', auth, adminAuth, async (req, res) => {
  try {
    const { amount, paymentMethod, reference } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Update invoice
    invoice.paidAmount += amount;
    invoice.balanceAmount = invoice.totalAmount - invoice.paidAmount;
    
    if (invoice.balanceAmount <= 0) {
      invoice.status = 'paid';
    } else if (invoice.paidAmount > 0) {
      invoice.status = 'partial';
    }
    
    await invoice.save();

    // Create receipt
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(await Receipt.countDocuments() + 1).padStart(5, '0')}`;
    const receipt = new Receipt({
      receiptNumber,
      invoice: invoice._id,
      client: invoice.client,
      amount,
      paymentMethod,
      reference,
      receivedBy: req.user.userId
    });
    await receipt.save();

    // Create income record
    const incomeNumber = `INC-${new Date().getFullYear()}-${String(await Income.countDocuments() + 1).padStart(5, '0')}`;
    const income = new Income({
      incomeNumber,
      source: 'membership',
      description: `Payment for Invoice ${invoice.invoiceNumber}`,
      amount,
      paymentMethod,
      client: invoice.client,
      invoice: invoice._id,
      receipt: receipt._id,
      reference,
      recordedBy: req.user.userId
    });
    await income.save();

    // Create ledger entry
    const transactionNumber = `TXN-${new Date().getFullYear()}-${String(await Ledger.countDocuments() + 1).padStart(5, '0')}`;
    const ledger = new Ledger({
      transactionNumber,
      transactionType: 'income',
      category: 'membership',
      description: `Payment received for Invoice ${invoice.invoiceNumber}`,
      credit: amount,
      paymentMethod,
      reference,
      relatedDocument: {
        documentType: 'invoice',
        documentId: invoice._id
      },
      createdBy: req.user.userId
    });
    await ledger.save();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: { invoice, receipt, income }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
});

// Download invoice PDF
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const companySettings = await CompanySettings.findOne();
    const pdfBuffer = await generateInvoicePDF(invoice, companySettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

// Delete invoice
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Can't delete paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot delete paid invoice' });
    }

    // Delete associated receipts and ledger entries
    await Receipt.deleteMany({ invoice: invoice._id });
    await Ledger.deleteMany({ 'relatedDocument.documentId': invoice._id, 'relatedDocument.documentType': 'invoice' });

    await Invoice.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to delete invoice' });
  }
});

// Get invoice statistics
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(filter);

    const stats = {
      total: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
      paidAmount: invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
      pendingAmount: invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0),
      byStatus: {},
      paid: invoices.filter(i => i.status === 'paid').length,
      sent: invoices.filter(i => i.status === 'sent').length,
      partial: invoices.filter(i => i.status === 'partial').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      draft: invoices.filter(i => i.status === 'draft').length
    };

    invoices.forEach(inv => {
      stats.byStatus[inv.status] = (stats.byStatus[inv.status] || 0) + 1;
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// Download receipt PDF
router.get('/receipt/:receiptId/pdf', auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.receiptId)
      .populate('client', 'firstName lastName email phone')
      .populate('invoice')
      .populate('receivedBy', 'firstName lastName');
    
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const invoice = receipt.invoice;
    if (invoice) {
      await invoice.populate('items');
    }

    const companySettings = await CompanySettings.findOne();
    const pdfBuffer = await generateReceiptPDF(receipt, invoice, companySettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt-${receipt.receiptNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
});

module.exports = router;

