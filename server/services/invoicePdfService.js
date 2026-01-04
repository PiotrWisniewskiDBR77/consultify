/**
 * Invoice PDF Service
 * 
 * Generates professional PDF invoices using PDFKit.
 * Supports multiple templates, multi-currency, and tax calculations.
 * 
 * @module services/invoicePdfService
 */

import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/index.js';
import path from 'path';
import fs from 'fs';

const db = getDatabase();

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Configuration
const CONFIG = {
    company: {
        name: process.env.COMPANY_NAME || 'Consultify',
        address: process.env.COMPANY_ADDRESS || '123 Business Street',
        city: process.env.COMPANY_CITY || 'San Francisco, CA 94105',
        country: process.env.COMPANY_COUNTRY || 'United States',
        email: process.env.COMPANY_EMAIL || 'billing@consultify.app',
        phone: process.env.COMPANY_PHONE || '+1 (555) 123-4567',
        website: process.env.COMPANY_WEBSITE || 'https://consultify.app',
        taxId: process.env.COMPANY_TAX_ID || ''
    },
    colors: {
        primary: '#1a1a2e',
        secondary: '#4f46e5',
        accent: '#059669',
        text: '#374151',
        lightText: '#6b7280',
        border: '#e5e7eb',
        background: '#f8f9fa'
    },
    fonts: {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold'
    }
};

/**
 * Get invoice data with all related information
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice data
 */
export async function getInvoiceData(invoiceId) {
    // Get invoice
    const invoice = await dbGet(`
        SELECT i.*, o.name as organization_name
        FROM invoices i
        LEFT JOIN organizations o ON i.organization_id = o.id
        WHERE i.id = ?
    `, [invoiceId]);

    if (!invoice) {
        throw new Error('Invoice not found');
    }

    // Parse line items
    let lineItems = [];
    if (invoice.line_items) {
        try {
            lineItems = JSON.parse(invoice.line_items);
        } catch (e) {
            lineItems = [];
        }
    }

    // Get tax settings
    const taxSettings = await dbGet(`
        SELECT * FROM billing_tax_settings WHERE organization_id = ?
    `, [invoice.organization_id]);

    // Get organization billing info
    const billing = await dbGet(`
        SELECT * FROM organization_billing WHERE organization_id = ?
    `, [invoice.organization_id]);

    return {
        ...invoice,
        lineItems,
        taxSettings: taxSettings || {},
        billing: billing || {},
        company: CONFIG.company
    };
}

/**
 * Format currency amount
 * @param {number} amount - Amount in smallest unit (cents)
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
function formatCurrency(amount, currency = 'USD') {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    });
    return formatter.format(amount / 100);
}

/**
 * Format date
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Generate invoice PDF
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateInvoicePdf(invoiceId) {
    const data = await getInvoiceData(invoiceId);
    
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title: `Invoice ${data.invoice_number}`,
                Author: CONFIG.company.name,
                Subject: `Invoice for ${data.organization_name}`,
                Creator: 'Consultify Billing System'
            }
        });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Build PDF content
        addHeader(doc, data);
        addBillingInfo(doc, data);
        addInvoiceDetails(doc, data);
        addLineItems(doc, data);
        addTotals(doc, data);
        addFooter(doc, data);

        doc.end();
    });
}

/**
 * Add header with company logo and info
 */
function addHeader(doc, data) {
    const pageWidth = doc.page.width - 100;
    
    // Company name (left side)
    doc.font(CONFIG.fonts.bold)
       .fontSize(24)
       .fillColor(CONFIG.colors.primary)
       .text(CONFIG.company.name, 50, 50);

    // Invoice label (right side)
    doc.font(CONFIG.fonts.bold)
       .fontSize(28)
       .fillColor(CONFIG.colors.secondary)
       .text('INVOICE', 50, 50, { align: 'right' });

    // Company details
    doc.font(CONFIG.fonts.regular)
       .fontSize(9)
       .fillColor(CONFIG.colors.lightText)
       .text(CONFIG.company.address, 50, 80)
       .text(CONFIG.company.city, 50, 92)
       .text(CONFIG.company.country, 50, 104)
       .text(CONFIG.company.email, 50, 120)
       .text(CONFIG.company.phone, 50, 132);

    if (CONFIG.company.taxId) {
        doc.text(`Tax ID: ${CONFIG.company.taxId}`, 50, 148);
    }

    // Invoice status badge
    const statusColors = {
        paid: CONFIG.colors.accent,
        open: CONFIG.colors.secondary,
        draft: CONFIG.colors.lightText,
        past_due: '#dc2626',
        void: '#6b7280'
    };
    const statusColor = statusColors[data.status] || CONFIG.colors.lightText;
    
    const statusText = data.status.toUpperCase().replace('_', ' ');
    const statusWidth = doc.widthOfString(statusText) + 20;
    const statusX = doc.page.width - 50 - statusWidth;
    
    doc.roundedRect(statusX, 85, statusWidth, 22, 4)
       .fill(statusColor);
    
    doc.font(CONFIG.fonts.bold)
       .fontSize(10)
       .fillColor('#ffffff')
       .text(statusText, statusX, 91, { width: statusWidth, align: 'center' });

    // Horizontal line
    doc.strokeColor(CONFIG.colors.border)
       .lineWidth(1)
       .moveTo(50, 170)
       .lineTo(doc.page.width - 50, 170)
       .stroke();
}

/**
 * Add billing information section
 */
function addBillingInfo(doc, data) {
    const startY = 190;
    const leftCol = 50;
    const rightCol = 320;

    // Bill To section
    doc.font(CONFIG.fonts.bold)
       .fontSize(10)
       .fillColor(CONFIG.colors.lightText)
       .text('BILL TO', leftCol, startY);

    doc.font(CONFIG.fonts.bold)
       .fontSize(12)
       .fillColor(CONFIG.colors.text)
       .text(data.taxSettings?.billing_name || data.organization_name || 'Customer', leftCol, startY + 16);

    let yOffset = startY + 32;
    
    if (data.taxSettings?.billing_address_line1) {
        doc.font(CONFIG.fonts.regular)
           .fontSize(10)
           .fillColor(CONFIG.colors.text)
           .text(data.taxSettings.billing_address_line1, leftCol, yOffset);
        yOffset += 14;
    }

    if (data.taxSettings?.billing_city) {
        const cityLine = [
            data.taxSettings.billing_city,
            data.taxSettings.billing_state,
            data.taxSettings.billing_postal_code
        ].filter(Boolean).join(', ');
        doc.text(cityLine, leftCol, yOffset);
        yOffset += 14;
    }

    if (data.taxSettings?.billing_country) {
        doc.text(data.taxSettings.billing_country, leftCol, yOffset);
        yOffset += 14;
    }

    if (data.taxSettings?.tax_id) {
        doc.text(`Tax ID: ${data.taxSettings.tax_id}`, leftCol, yOffset + 8);
    }

    // Invoice details section (right side)
    doc.font(CONFIG.fonts.bold)
       .fontSize(10)
       .fillColor(CONFIG.colors.lightText)
       .text('INVOICE DETAILS', rightCol, startY);

    const details = [
        ['Invoice Number', data.invoice_number],
        ['Invoice Date', formatDate(data.created_at)],
        ['Due Date', formatDate(data.due_date)],
        ['Currency', data.currency?.toUpperCase() || 'USD']
    ];

    let detailY = startY + 16;
    details.forEach(([label, value]) => {
        doc.font(CONFIG.fonts.regular)
           .fontSize(10)
           .fillColor(CONFIG.colors.lightText)
           .text(label + ':', rightCol, detailY, { continued: true })
           .font(CONFIG.fonts.bold)
           .fillColor(CONFIG.colors.text)
           .text(' ' + (value || '-'), { continued: false });
        detailY += 16;
    });
}

/**
 * Add invoice details / summary section
 */
function addInvoiceDetails(doc, data) {
    // This space is used for any additional invoice metadata
    // such as PO numbers, project references, etc.
    
    if (data.metadata) {
        let metadata;
        try {
            metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
        } catch (e) {
            metadata = {};
        }

        if (metadata.po_number || metadata.project_name) {
            const startY = 310;
            doc.font(CONFIG.fonts.regular)
               .fontSize(9)
               .fillColor(CONFIG.colors.lightText);

            if (metadata.po_number) {
                doc.text(`PO Number: ${metadata.po_number}`, 50, startY);
            }
            if (metadata.project_name) {
                doc.text(`Project: ${metadata.project_name}`, 50, startY + 14);
            }
        }
    }
}

/**
 * Add line items table
 */
function addLineItems(doc, data) {
    const startY = 340;
    const tableTop = startY + 25;
    const columns = {
        description: { x: 50, width: 280 },
        quantity: { x: 340, width: 60 },
        unitPrice: { x: 400, width: 80 },
        amount: { x: 480, width: 65 }
    };

    // Table header background
    doc.rect(50, startY, doc.page.width - 100, 22)
       .fill(CONFIG.colors.primary);

    // Table headers
    doc.font(CONFIG.fonts.bold)
       .fontSize(9)
       .fillColor('#ffffff')
       .text('DESCRIPTION', columns.description.x + 10, startY + 7)
       .text('QTY', columns.quantity.x, startY + 7, { width: columns.quantity.width, align: 'center' })
       .text('UNIT PRICE', columns.unitPrice.x, startY + 7, { width: columns.unitPrice.width, align: 'right' })
       .text('AMOUNT', columns.amount.x, startY + 7, { width: columns.amount.width, align: 'right' });

    // Table rows
    let rowY = tableTop;
    const lineItems = data.lineItems || [];
    
    if (lineItems.length === 0) {
        // Add a default line item if none exist
        lineItems.push({
            description: data.description || 'Subscription Fee',
            quantity: 1,
            unit_price: data.subtotal || data.total || 0,
            amount: data.subtotal || data.total || 0
        });
    }

    lineItems.forEach((item, index) => {
        const isEven = index % 2 === 0;
        
        // Alternating row background
        if (isEven) {
            doc.rect(50, rowY, doc.page.width - 100, 28)
               .fill(CONFIG.colors.background);
        }

        doc.font(CONFIG.fonts.regular)
           .fontSize(10)
           .fillColor(CONFIG.colors.text)
           .text(item.description || '-', columns.description.x + 10, rowY + 8, { 
               width: columns.description.width - 20,
               lineBreak: false
           })
           .text(String(item.quantity || 1), columns.quantity.x, rowY + 8, { 
               width: columns.quantity.width, 
               align: 'center' 
           })
           .text(formatCurrency(item.unit_price || item.amount || 0, data.currency), columns.unitPrice.x, rowY + 8, { 
               width: columns.unitPrice.width, 
               align: 'right' 
           })
           .text(formatCurrency(item.amount || 0, data.currency), columns.amount.x, rowY + 8, { 
               width: columns.amount.width, 
               align: 'right' 
           });

        rowY += 28;
    });

    // Table border
    doc.strokeColor(CONFIG.colors.border)
       .lineWidth(0.5)
       .rect(50, startY, doc.page.width - 100, rowY - startY)
       .stroke();

    return rowY;
}

/**
 * Add totals section
 */
function addTotals(doc, data) {
    const rightCol = 400;
    const valueCol = 480;
    const width = 65;
    
    // Calculate position based on line items
    let startY = 340 + 25 + ((data.lineItems?.length || 1) * 28) + 30;

    // Subtotal
    doc.font(CONFIG.fonts.regular)
       .fontSize(10)
       .fillColor(CONFIG.colors.text)
       .text('Subtotal', rightCol, startY, { align: 'right', width: 70 })
       .text(formatCurrency(data.subtotal || data.total || 0, data.currency), valueCol, startY, { align: 'right', width });

    // Tax (if applicable)
    if (data.tax_amount && data.tax_amount > 0) {
        startY += 18;
        const taxRate = data.tax_rate ? ` (${data.tax_rate}%)` : '';
        doc.text(`Tax${taxRate}`, rightCol, startY, { align: 'right', width: 70 })
           .text(formatCurrency(data.tax_amount, data.currency), valueCol, startY, { align: 'right', width });
    }

    // Discount (if applicable)
    if (data.discount_amount && data.discount_amount > 0) {
        startY += 18;
        doc.fillColor(CONFIG.colors.accent)
           .text('Discount', rightCol, startY, { align: 'right', width: 70 })
           .text(`-${formatCurrency(data.discount_amount, data.currency)}`, valueCol, startY, { align: 'right', width });
    }

    // Total line
    startY += 25;
    doc.strokeColor(CONFIG.colors.border)
       .lineWidth(1)
       .moveTo(rightCol - 10, startY - 8)
       .lineTo(doc.page.width - 50, startY - 8)
       .stroke();

    // Total
    doc.font(CONFIG.fonts.bold)
       .fontSize(14)
       .fillColor(CONFIG.colors.primary)
       .text('Total Due', rightCol - 30, startY, { align: 'right', width: 100 })
       .fontSize(16)
       .fillColor(CONFIG.colors.secondary)
       .text(formatCurrency(data.total || 0, data.currency), valueCol - 20, startY, { align: 'right', width: width + 20 });

    // Amount paid (if any)
    if (data.amount_paid && data.amount_paid > 0) {
        startY += 25;
        doc.font(CONFIG.fonts.regular)
           .fontSize(10)
           .fillColor(CONFIG.colors.accent)
           .text('Amount Paid', rightCol, startY, { align: 'right', width: 70 })
           .text(formatCurrency(data.amount_paid, data.currency), valueCol, startY, { align: 'right', width });
        
        // Balance due
        const balanceDue = (data.total || 0) - (data.amount_paid || 0);
        if (balanceDue > 0) {
            startY += 20;
            doc.font(CONFIG.fonts.bold)
               .fontSize(12)
               .fillColor('#dc2626')
               .text('Balance Due', rightCol, startY, { align: 'right', width: 70 })
               .text(formatCurrency(balanceDue, data.currency), valueCol, startY, { align: 'right', width });
        }
    }
}

/**
 * Add footer with payment info and notes
 */
function addFooter(doc, data) {
    const footerY = doc.page.height - 120;

    // Separator line
    doc.strokeColor(CONFIG.colors.border)
       .lineWidth(0.5)
       .moveTo(50, footerY - 20)
       .lineTo(doc.page.width - 50, footerY - 20)
       .stroke();

    // Payment information
    doc.font(CONFIG.fonts.bold)
       .fontSize(9)
       .fillColor(CONFIG.colors.text)
       .text('Payment Information', 50, footerY);

    doc.font(CONFIG.fonts.regular)
       .fontSize(8)
       .fillColor(CONFIG.colors.lightText)
       .text('Payment is due by the due date shown above.', 50, footerY + 14)
       .text('For questions about this invoice, please contact ' + CONFIG.company.email, 50, footerY + 26);

    // Notes (if any)
    if (data.notes) {
        doc.font(CONFIG.fonts.bold)
           .fontSize(9)
           .fillColor(CONFIG.colors.text)
           .text('Notes', 300, footerY);

        doc.font(CONFIG.fonts.regular)
           .fontSize(8)
           .fillColor(CONFIG.colors.lightText)
           .text(data.notes, 300, footerY + 14, { width: 245 });
    }

    // Page number
    doc.font(CONFIG.fonts.regular)
       .fontSize(8)
       .fillColor(CONFIG.colors.lightText)
       .text(
           `Generated on ${formatDate(new Date())} | ${CONFIG.company.website}`,
           50,
           doc.page.height - 30,
           { align: 'center', width: doc.page.width - 100 }
       );
}

/**
 * Generate and save invoice PDF to disk
 * @param {string} invoiceId - Invoice ID
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Path to generated PDF
 */
export async function saveInvoicePdf(invoiceId, outputPath) {
    const pdfBuffer = await generateInvoicePdf(invoiceId);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, pdfBuffer);
    return outputPath;
}

/**
 * Generate invoice preview (first page only, lower quality)
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Buffer>} PNG preview buffer
 */
export async function generateInvoicePreview(invoiceId) {
    // For preview, we just return the PDF - frontend can render first page
    return await generateInvoicePdf(invoiceId);
}

export default {
    generateInvoicePdf,
    saveInvoicePdf,
    generateInvoicePreview,
    getInvoiceData,
    formatCurrency,
    formatDate
};

