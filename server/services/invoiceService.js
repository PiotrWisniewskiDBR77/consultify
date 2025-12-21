/**
 * Invoice Service
 * 
 * Invoice generation and management with PDF support.
 * 
 * Features:
 * - Invoice creation from subscriptions
 * - PDF generation
 * - Multi-currency support
 * - Tax calculations
 * - Email delivery
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const CurrencyService = require('./currencyService');
const EmailService = require('./emailService');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
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

// Invoice number generation
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Get count for this month
    const result = await dbGet(
        `SELECT COUNT(*) as count FROM invoices 
         WHERE invoice_number LIKE ?`,
        [`INV-${year}${month}-%`]
    );

    const sequence = String((result?.count || 0) + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
}

const InvoiceService = {
    /**
     * Create invoice for organization
     * @param {Object} options 
     */
    async createInvoice(options) {
        const {
            organizationId,
            items, // Array of { description, quantity, unitPrice }
            currency = 'USD',
            taxRate = 0,
            taxType = null,
            dueDate = null,
            notes = null,
            billingPeriodStart = null,
            billingPeriodEnd = null,
        } = options;

        const invoiceId = uuidv4();
        const invoiceNumber = await generateInvoiceNumber();

        // Calculate totals
        let subtotal = 0;
        for (const item of items) {
            subtotal += item.quantity * item.unitPrice;
        }

        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const total = subtotal + taxAmount;

        // Get exchange rate to base currency
        let exchangeRate = 1.0;
        let baseTotal = total;

        if (currency !== 'USD') {
            const conversion = await CurrencyService.convertAmount(total, currency, 'USD');
            exchangeRate = conversion.rate;
            baseTotal = conversion.amount;
        }

        // Default due date: 30 days
        const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Create invoice
        await dbRun(
            `INSERT INTO invoices 
             (id, organization_id, invoice_number, status, subtotal, tax_amount, total, amount_due,
              currency, exchange_rate, base_currency, base_total, tax_rate, tax_type,
              due_date, billing_period_start, billing_period_end, notes)
             VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?)`,
            [
                invoiceId, organizationId, invoiceNumber,
                subtotal, taxAmount, total, total,
                currency, exchangeRate, baseTotal,
                taxRate, taxType,
                dueDate || defaultDueDate, billingPeriodStart, billingPeriodEnd, notes
            ]
        );

        // Create line items
        for (const item of items) {
            await dbRun(
                `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), invoiceId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
            );
        }

        return {
            id: invoiceId,
            invoiceNumber,
            total,
            currency,
        };
    },

    /**
     * Get invoice by ID
     * @param {string} invoiceId 
     */
    async getInvoice(invoiceId) {
        const invoice = await dbGet(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);

        if (!invoice) return null;

        const items = await dbAll(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);

        return {
            ...invoice,
            items,
            formattedTotal: CurrencyService.formatAmount(invoice.total, invoice.currency),
            formattedSubtotal: CurrencyService.formatAmount(invoice.subtotal, invoice.currency),
            formattedTax: CurrencyService.formatAmount(invoice.tax_amount, invoice.currency),
        };
    },

    /**
     * Get invoices for organization
     * @param {string} organizationId 
     * @param {Object} options 
     */
    async getInvoices(organizationId, options = {}) {
        const { status, limit = 50, offset = 0 } = options;

        let query = `SELECT * FROM invoices WHERE organization_id = ?`;
        const params = [organizationId];

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }

        query += ` ORDER BY invoice_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const invoices = await dbAll(query, params);

        return invoices.map(inv => ({
            ...inv,
            formattedTotal: CurrencyService.formatAmount(inv.total, inv.currency),
        }));
    },

    /**
     * Mark invoice as paid
     * @param {string} invoiceId 
     */
    async markAsPaid(invoiceId) {
        await dbRun(
            `UPDATE invoices SET status = 'paid', amount_paid = total, amount_due = 0, paid_at = datetime('now')
             WHERE id = ?`,
            [invoiceId]
        );
    },

    /**
     * Finalize and send invoice
     * @param {string} invoiceId 
     */
    async finalizeAndSend(invoiceId) {
        // Update status to open
        await dbRun(`UPDATE invoices SET status = 'open' WHERE id = ?`, [invoiceId]);

        // Get invoice with org info
        const invoice = await this.getInvoice(invoiceId);

        if (!invoice) {
            throw new Error('Invoice not found');
        }

        // Get org admin
        const admin = await dbGet(
            `SELECT email, first_name FROM users 
             WHERE organization_id = ? AND role IN ('ADMIN', 'OWNER') LIMIT 1`,
            [invoice.organization_id]
        );

        if (!admin) {
            console.warn(`[Invoice] No admin found for org ${invoice.organization_id}`);
            return;
        }

        // Generate PDF (placeholder - would use PDFKit or similar)
        const pdfUrl = await this._generatePDF(invoice);

        // Update invoice with PDF URL
        await dbRun(`UPDATE invoices SET pdf_url = ? WHERE id = ?`, [pdfUrl, invoiceId]);

        // Send email
        await EmailService.send({
            to: admin.email,
            subject: `Invoice ${invoice.invoice_number} from Consultify`,
            template: 'invoice',
            data: {
                firstName: admin.first_name,
                invoiceNumber: invoice.invoice_number,
                total: invoice.formattedTotal,
                dueDate: invoice.due_date,
                viewUrl: `${process.env.FRONTEND_URL}/billing/invoices/${invoiceId}`,
            },
            attachments: pdfUrl ? [{ filename: `${invoice.invoice_number}.pdf`, path: pdfUrl }] : [],
        });

        return { sent: true, pdfUrl };
    },

    /**
     * Void an invoice
     * @param {string} invoiceId 
     * @param {string} reason 
     */
    async voidInvoice(invoiceId, reason) {
        await dbRun(
            `UPDATE invoices SET status = 'void', notes = COALESCE(notes, '') || '\nVoided: ' || ?
             WHERE id = ?`,
            [reason, invoiceId]
        );
    },

    /**
     * Create invoice from Stripe invoice
     * @param {Object} stripeInvoice 
     */
    async createFromStripe(stripeInvoice) {
        const {
            id: stripeId,
            customer,
            amount_due,
            amount_paid,
            currency,
            status,
            lines,
            tax,
            period_start,
            period_end,
        } = stripeInvoice;

        // Find organization by Stripe customer
        const org = await dbGet(
            `SELECT id, billing_currency FROM organizations WHERE stripe_customer_id = ?`,
            [customer]
        );

        if (!org) {
            console.warn(`[Invoice] Organization not found for Stripe customer ${customer}`);
            return null;
        }

        // Map line items
        const items = lines.data.map(line => ({
            description: line.description || line.plan?.nickname || 'Subscription',
            quantity: line.quantity || 1,
            unitPrice: line.amount,
        }));

        // Create invoice
        const invoice = await this.createInvoice({
            organizationId: org.id,
            items,
            currency: currency.toUpperCase(),
            taxRate: tax ? (tax / amount_due * 100) : 0,
            billingPeriodStart: period_start ? new Date(period_start * 1000).toISOString() : null,
            billingPeriodEnd: period_end ? new Date(period_end * 1000).toISOString() : null,
        });

        // Update with Stripe ID and status
        await dbRun(
            `UPDATE invoices SET stripe_invoice_id = ?, status = ?, amount_paid = ?
             WHERE id = ?`,
            [stripeId, status === 'paid' ? 'paid' : 'open', amount_paid, invoice.id]
        );

        return invoice;
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    async _generatePDF(invoice) {
        // Placeholder for PDF generation
        // In production, use PDFKit or similar library
        console.log(`[Invoice] PDF generation for ${invoice.invoice_number} (placeholder)`);

        // Would generate PDF and return path/URL
        // const PDFDocument = require('pdfkit');
        // const doc = new PDFDocument();
        // ... generate PDF ...

        return null; // Return PDF URL or path
    },
};

module.exports = InvoiceService;
