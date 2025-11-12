const PDFDocument = require('pdfkit');
const CompanySettings = require('../models/CompanySettings');

// Professional color scheme matching Zoho Books
const COLORS = {
  primary: '#2563eb',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#ef4444',
  text: '#1f2937',
  lightText: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb'
};

/**
 * Generate professional invoice PDF
 */
async function generateInvoicePDF(invoice, company) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get company settings
      let companySettings = company;
      if (!companySettings) {
        companySettings = await CompanySettings.findOne() || new CompanySettings();
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header with company info
      doc.fontSize(24)
         .fillColor(COLORS.primary)
         .text('INVOICE', 50, 50, { bold: true });

      // Company logo placeholder (right side)
      doc.fontSize(10)
         .fillColor(COLORS.primary)
         .text(companySettings.companyName.toUpperCase(), 350, 50, { 
           width: 200, 
           align: 'right',
           bold: true 
         });

      // Invoice number and dates (top right)
      doc.fontSize(10)
         .fillColor(COLORS.text)
         .text(`Invoice number: ${invoice.invoiceNumber}`, 350, 80, { width: 200, align: 'right' });
      
      doc.fontSize(10)
         .fillColor(COLORS.lightText)
         .text(`Date of issue: ${new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 350, 95, { width: 200, align: 'right' });
      
      doc.text(`Date due: ${new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 350, 110, { width: 200, align: 'right' });

      // Bill FROM section
      doc.fontSize(9)
         .fillColor(COLORS.lightText)
         .text('BILL FROM', 50, 140);
      
      doc.fontSize(11)
         .fillColor(COLORS.text)
         .font('Helvetica-Bold')
         .text(companySettings.companyName, 50, 155);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.lightText)
         .text(companySettings.address.street, 50, 170)
         .text(companySettings.address.city, 50, 185)
         .text(`${companySettings.address.country} ${companySettings.address.postalCode}`, 50, 200)
         .text(companySettings.contact.phone, 50, 215)
         .text(companySettings.contact.email, 50, 230)
         .text(companySettings.contact.website, 50, 245);

      // Bill TO section
      doc.fontSize(9)
         .fillColor(COLORS.lightText)
         .text('BILL TO', 350, 140);
      
      const clientName = `${invoice.client?.firstName || ''} ${invoice.client?.lastName || ''}`.trim();
      doc.fontSize(11)
         .fillColor(COLORS.text)
         .font('Helvetica-Bold')
         .text(clientName, 350, 155);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.lightText);
      
      if (invoice.client?.phone) {
        doc.text(invoice.client.phone, 350, 170);
      }
      if (invoice.client?.email) {
        doc.text(invoice.client.email, 350, 185);
      }

      // Items table
      const tableTop = 300;
      
      // Table header
      doc.rect(50, tableTop, 495, 30)
         .fillAndStroke(COLORS.background, COLORS.border);
      
      doc.fontSize(10)
         .fillColor(COLORS.text)
         .font('Helvetica-Bold')
         .text('DESCRIPTION', 60, tableTop + 10, { width: 240 })
         .text('QTY', 310, tableTop + 10, { width: 50, align: 'center' })
         .text('UNIT PRICE', 370, tableTop + 10, { width: 80, align: 'right' })
         .text('AMOUNT', 460, tableTop + 10, { width: 80, align: 'right' });

      // Table rows
      let currentY = tableTop + 35;
      doc.font('Helvetica');
      
      invoice.items.forEach((item, index) => {
        const rowHeight = 40;
        
        // Alternating row colors
        if (index % 2 === 1) {
          doc.rect(50, currentY, 495, rowHeight)
             .fill(COLORS.background);
        }

        doc.fontSize(10)
           .fillColor(COLORS.text)
           .text(item.description, 60, currentY + 10, { width: 240 });
        
        doc.text(item.quantity.toString(), 310, currentY + 10, { width: 50, align: 'center' });
        doc.text(`AED ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 370, currentY + 10, { width: 80, align: 'right' });
        doc.text(`AED ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, currentY + 10, { width: 80, align: 'right' });
        
        currentY += rowHeight;
      });

      // Draw bottom border
      doc.moveTo(50, currentY)
         .lineTo(545, currentY)
         .stroke(COLORS.border);

      currentY += 20;

      // Subtotal, Tax, Discount, Total
      const summaryX = 370;
      const summaryLabelX = 300;

      doc.fontSize(10)
         .fillColor(COLORS.lightText);
      
      doc.text('Subtotal:', summaryLabelX, currentY, { width: 150, align: 'right' });
      doc.fillColor(COLORS.text)
         .text(`AED ${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, summaryX, currentY, { width: 170, align: 'right' });
      currentY += 20;

      if (invoice.tax > 0) {
        doc.fillColor(COLORS.lightText)
           .text(`Tax (${companySettings.taxInfo.taxRate || 5}%):`, summaryLabelX, currentY, { width: 150, align: 'right' });
        doc.fillColor(COLORS.text)
           .text(`AED ${invoice.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, summaryX, currentY, { width: 170, align: 'right' });
        currentY += 20;
      }

      if (invoice.discount > 0) {
        doc.fillColor(COLORS.success)
           .text('Discount:', summaryLabelX, currentY, { width: 150, align: 'right' });
        doc.text(`-AED ${invoice.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, summaryX, currentY, { width: 170, align: 'right' });
        currentY += 20;
      }

      // Total (bold and larger)
      doc.rect(summaryLabelX, currentY - 5, 245, 30)
         .fillAndStroke(COLORS.background, COLORS.border);

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(COLORS.text)
         .text('Total:', summaryLabelX + 10, currentY + 5, { width: 140, align: 'right' });
      
      doc.fontSize(14)
         .fillColor(COLORS.primary)
         .text(`AED ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, summaryX, currentY + 5, { width: 170, align: 'right' });
      
      currentY += 50;

      // Amount due section (if there's a balance)
      if (invoice.balanceAmount > 0) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(COLORS.lightText)
           .text('Amount due:', summaryLabelX, currentY, { width: 150, align: 'right' });
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(COLORS.danger)
           .text(`AED ${invoice.balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, summaryX, currentY, { width: 170, align: 'right' });
        
        currentY += 30;
      }

      // Payment info and notes
      currentY += 20;

      if (companySettings.invoiceTerms) {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.lightText)
           .text('Terms & Conditions:', 50, currentY);
        
        doc.fontSize(9)
           .fillColor(COLORS.text)
           .text(companySettings.invoiceTerms, 50, currentY + 15, { width: 495, align: 'justify' });
        
        currentY += 60;
      }

      // Footer
      const footerY = 750;
      doc.moveTo(50, footerY)
         .lineTo(545, footerY)
         .stroke(COLORS.border);

      doc.fontSize(9)
         .fillColor(COLORS.lightText)
         .text(`If you have any questions, contact ${companySettings.companyName} at`, 50, footerY + 10);
      
      doc.fillColor(COLORS.primary)
         .text(`${companySettings.contact.email} or call ${companySettings.contact.phone}`, 50, footerY + 25);

      // Page numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor(COLORS.lightText)
           .text(
             `Page ${i + 1} of ${pages.count}`,
             50,
             doc.page.height - 50,
             { align: 'center' }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate professional receipt PDF
 */
async function generateReceiptPDF(receipt, invoice, company) {
  return new Promise(async (resolve, reject) => {
    try {
      let companySettings = company;
      if (!companySettings) {
        companySettings = await CompanySettings.findOne() || new CompanySettings();
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fontSize(28)
         .fillColor(COLORS.primary)
         .text('Receipt', 50, 50);

      // Company name (top right)
      doc.fontSize(12)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text(companySettings.companyName.toUpperCase(), 350, 50, { 
           width: 200, 
           align: 'right' 
         });

      // Receipt details (right side)
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.text)
         .text(`Receipt number:`, 350, 80, { width: 100, align: 'left' });
      doc.font('Helvetica-Bold')
         .text(`${receipt.receiptNumber}`, 450, 80, { width: 95, align: 'right' });

      if (invoice) {
        doc.font('Helvetica')
           .text(`Invoice number:`, 350, 95, { width: 100, align: 'left' });
        doc.font('Helvetica-Bold')
           .text(`${invoice.invoiceNumber}`, 450, 95, { width: 95, align: 'right' });
      }

      doc.font('Helvetica')
         .text(`Date paid:`, 350, 110, { width: 100, align: 'left' });
      doc.font('Helvetica-Bold')
         .text(`${new Date(receipt.receiptDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, 450, 110, { width: 95, align: 'right' });

      doc.font('Helvetica')
         .text(`Payment method:`, 350, 125, { width: 100, align: 'left' });
      doc.font('Helvetica-Bold')
         .text(receipt.paymentMethod.replace('_', ' ').toUpperCase(), 450, 125, { width: 95, align: 'right' });

      if (receipt.reference) {
        doc.font('Helvetica')
           .text(`Transaction ref:`, 350, 140, { width: 100, align: 'left' });
        doc.font('Helvetica-Bold')
           .text(receipt.reference, 450, 140, { width: 95, align: 'right' });
      }

      // Bill FROM
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.lightText)
         .text('BILL FROM', 50, 140);
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.text)
         .text(companySettings.companyName, 50, 155);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.lightText)
         .text(companySettings.address.street, 50, 170)
         .text(`${companySettings.address.city}, ${companySettings.address.country} ${companySettings.address.postalCode}`, 50, 185)
         .text(companySettings.contact.phone, 50, 200)
         .text(companySettings.contact.email, 50, 215)
         .text(companySettings.contact.website, 50, 230);

      // Bill TO
      doc.fontSize(9)
         .fillColor(COLORS.lightText)
         .text('BILL TO', 50, 270);
      
      const clientName = `${receipt.client?.firstName || ''} ${receipt.client?.lastName || ''}`.trim();
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.text)
         .text(clientName, 50, 285);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.lightText);
      
      if (receipt.client?.phone) {
        doc.text(receipt.client.phone, 50, 300);
      }
      if (receipt.client?.email) {
        doc.text(receipt.client.email, 50, 315);
      }

      // Payment amount (large, centered)
      const amountY = 370;
      doc.rect(50, amountY, 495, 80)
         .fillAndStroke('#f0f9ff', COLORS.primary);

      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(COLORS.text)
         .text(`AED ${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Paid via ${receipt.paymentMethod.replace('_', ' ')}`, 
           60, amountY + 15, { width: 475, align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor(COLORS.lightText)
         .text(`on ${new Date(receipt.receiptDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 
           60, amountY + 45, { width: 475, align: 'center' });

      // Invoice items (if available)
      if (invoice && invoice.items && invoice.items.length > 0) {
        let itemsY = amountY + 110;
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.text)
           .text('DESCRIPTION', 60, itemsY)
           .text('QTY', 310, itemsY, { width: 50, align: 'center' })
           .text('UNIT PRICE', 370, itemsY, { width: 80, align: 'right' })
           .text('AMOUNT', 460, itemsY, { width: 80, align: 'right' });

        itemsY += 20;
        doc.moveTo(50, itemsY)
           .lineTo(545, itemsY)
           .stroke(COLORS.border);
        
        itemsY += 10;

        invoice.items.forEach((item) => {
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(COLORS.text)
             .text(item.description, 60, itemsY, { width: 240 })
             .text(item.quantity.toString(), 310, itemsY, { width: 50, align: 'center' })
             .text(`AED ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 370, itemsY, { width: 80, align: 'right' })
             .text(`AED ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, itemsY, { width: 80, align: 'right' });
          
          itemsY += 25;
        });

        itemsY += 10;
        doc.moveTo(50, itemsY)
           .lineTo(545, itemsY)
           .stroke(COLORS.border);

        itemsY += 15;

        // Subtotal
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(COLORS.lightText)
           .text('Subtotal:', 370, itemsY, { width: 90, align: 'left' });
        doc.fillColor(COLORS.text)
           .text(`AED ${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, itemsY, { width: 80, align: 'right' });
        itemsY += 18;

        // Total excluding tax
        doc.fillColor(COLORS.lightText)
           .text('Total excluding tax:', 370, itemsY, { width: 90, align: 'left' });
        doc.fillColor(COLORS.text)
           .text(`AED ${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, itemsY, { width: 80, align: 'right' });
        itemsY += 25;

        doc.moveTo(370, itemsY)
           .lineTo(545, itemsY)
           .stroke(COLORS.border);
        itemsY += 10;

        // Total (bold)
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(COLORS.text)
           .text('Total:', 370, itemsY, { width: 90, align: 'left' });
        doc.fillColor(COLORS.primary)
           .text(`AED ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 460, itemsY, { width: 80, align: 'right' });
      }

      // Footer
      const footerY = 720;
      doc.moveTo(50, footerY)
         .lineTo(545, footerY)
         .stroke(COLORS.border);

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.lightText)
         .text(`If you have any questions, contact ${companySettings.companyName} at`, 50, footerY + 10);
      
      doc.fillColor(COLORS.primary)
         .text(`${companySettings.contact.email} or call ${companySettings.contact.phone}`, 50, footerY + 25);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoicePDF,
  generateReceiptPDF
};















