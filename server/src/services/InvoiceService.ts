/**
 * Invoice Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Invoice generation and management with PDF support.
 * Fully migrated from server/services/invoiceService.js
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { uploadsDir } from '../utils/storagePaths.js';

// ==========================================
// TYPES
// ==========================================

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
}

export interface InvoiceOptions {
  organizationId: string;
  items: InvoiceItem[];
  currency?: string;
  taxRate?: number;
  taxType?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
}

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_due: number;
  amount_paid?: number;
  currency: string;
  exchange_rate: number;
  base_currency: string;
  base_total: number;
  tax_rate: number;
  tax_type: string | null;
  due_date: string;
  paid_at?: string | null;
  pdf_url?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  notes?: string | null;
  stripe_invoice_id?: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  formattedTotal?: string;
  formattedSubtotal?: string;
  formattedTax?: string;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  lines: {
    data: Array<{
      description?: string;
      quantity?: number;
      amount: number;
      plan?: {
        nickname?: string;
      };
    }>;
  };
  tax?: number | null;
  period_start?: number | null;
  period_end?: number | null;
}

interface InvoiceServiceDeps {
  db: IDatabase;
  uuidv4: () => string;
  CurrencyService: any;
  EmailService: any;
}

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class InvoiceServiceClass {
  #deps: InvoiceServiceDeps | null = null;
  #initialized = false;
  #initPromise: Promise<void> | null = null;

  constructor(deps?: Partial<InvoiceServiceDeps>) {
    if (deps?.db && deps?.uuidv4 && deps?.CurrencyService && deps?.EmailService) {
      this.#deps = deps as InvoiceServiceDeps;
      this.#initialized = true;
    }
  }

  async #initDeps() {
    if (this.#initialized) return;
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = (async () => {
      const [uuidModule, currencyModule, emailModule] = await Promise.all([
        import('uuid'),
        import('./currencyService.js'),
        import('./emailService.js'),
      ]);

      this.#deps = {
        db: getDatabase(),
        uuidv4: uuidModule.v4,
        CurrencyService: currencyModule.default || currencyModule,
        EmailService: emailModule.default || emailModule,
      };
      this.#initialized = true;
    })();

    return this.#initPromise;
  }

  setDependencies(newDeps: Partial<InvoiceServiceDeps>) {
    this.#deps = { ...this.#deps!, ...newDeps };
    this.#initialized = true;
  }

  private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
    await this.#initDeps();
    return DbPromise.get<T>(this.#deps!.db, sql, params);
  }

  private async dbRun(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID?: number; changes: number }> {
    await this.#initDeps();
    const result = await DbPromise.run(this.#deps!.db, sql, params);
    return {
      lastID: result.lastID,
      changes: result.changes || 0,
    };
  }

  private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.#initDeps();
    return DbPromise.all<T>(this.#deps!.db, sql, params);
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const result = await this.dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM invoices 
             WHERE invoice_number LIKE ?`,
      [`INV-${year}${month}-%`]
    );

    const sequence = String((result?.count || 0) + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Create invoice for organization
   */
  async createInvoice(options: InvoiceOptions): Promise<Partial<Invoice>> {
    await this.#initDeps();
    const { uuidv4 } = this.#deps!;

    const {
      organizationId,
      items,
      currency = 'USD',
      taxRate = 0,
      taxType = null,
      dueDate = null,
      notes = null,
      billingPeriodStart = null,
      billingPeriodEnd = null,
    } = options;

    const invoiceId = uuidv4();
    const invoiceNumber = await this.generateInvoiceNumber();

    // Line items live in the invoices.line_items JSON column (matching the live
    // billing router). There is no invoice_items table in the live schema, so we
    // normalize into the same JSON shape the rest of the billing system reads.
    const lineItems = items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + taxAmount;

    const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Tax-rate/type and notes have no dedicated columns in the live invoices
    // schema; preserve them in the metadata JSON instead of dropping them.
    const metadata = { taxRate, taxType, notes };

    await this.dbRun(
      `INSERT INTO invoices
             (id, organization_id, invoice_number, status, subtotal, tax_amount, total, amount_due,
              currency, due_date, period_start, period_end, line_items, metadata)
             VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        organizationId,
        invoiceNumber,
        subtotal,
        taxAmount,
        total,
        total,
        currency,
        dueDate || defaultDueDate,
        billingPeriodStart,
        billingPeriodEnd,
        JSON.stringify(lineItems),
        JSON.stringify(metadata),
      ]
    );

    return {
      id: invoiceId,
      invoice_number: invoiceNumber,
      total,
      currency,
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    await this.#initDeps();
    const { CurrencyService } = this.#deps!;

    const invoice = await this.dbGet<Invoice & { line_items?: string }>(
      `SELECT * FROM invoices WHERE id = ?`,
      [invoiceId]
    );

    if (!invoice) return null;

    // Line items are stored as JSON on invoices.line_items (there is no
    // invoice_items table in the live schema).
    let items: InvoiceItem[] = [];
    if (invoice.line_items) {
      try {
        items = JSON.parse(invoice.line_items) as InvoiceItem[];
      } catch {
        items = [];
      }
    }

    return {
      ...invoice,
      items,
      formattedTotal: CurrencyService.formatAmount(invoice.total, invoice.currency),
      formattedSubtotal: CurrencyService.formatAmount(invoice.subtotal, invoice.currency),
      formattedTax: CurrencyService.formatAmount(invoice.tax_amount, invoice.currency),
    };
  }

  /**
   * Get invoices for organization
   */
  async getInvoices(
    organizationId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<Invoice[]> {
    await this.#initDeps();
    const { CurrencyService } = this.#deps!;

    const { status, limit = 50, offset = 0 } = options;

    let query = `SELECT * FROM invoices WHERE organization_id = ?`;
    const params: any[] = [organizationId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const invoices = await this.dbAll<Invoice>(query, params);

    return invoices.map(
      (inv) =>
        ({
          ...inv,
          invoice_number: inv.invoice_number || `INV-${inv.id?.slice(0, 8) || 'UNKNOWN'}`,
          invoice_date: inv.created_at,
          due_date: (inv as any).period_end || inv.due_date,
          total: (inv as any).amount_paid || inv.amount_due || 0,
          currency: inv.currency || 'USD',
          formattedTotal: CurrencyService.formatAmount(
            (inv as any).total || (inv as any).amount_paid || inv.amount_due || 0,
            inv.currency || 'USD'
          ),
        }) as Invoice
    );
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(invoiceId: string): Promise<void> {
    await this.dbRun(
      `UPDATE invoices SET status = 'paid', amount_paid = total, amount_due = 0, paid_at = datetime('now')
             WHERE id = ?`,
      [invoiceId]
    );
  }

  /**
   * Finalize and send invoice
   */
  async finalizeAndSend(invoiceId: string): Promise<{ sent: boolean; pdfUrl: string | null }> {
    await this.#initDeps();
    const { EmailService } = this.#deps!;

    await this.dbRun(`UPDATE invoices SET status = 'open' WHERE id = ?`, [invoiceId]);

    const invoice = await this.getInvoice(invoiceId);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const admin = await this.dbGet<{ email: string; first_name: string }>(
      `SELECT email, first_name FROM users 
             WHERE organization_id = ? AND role IN ('ADMIN', 'OWNER') LIMIT 1`,
      [invoice.organization_id]
    );

    if (!admin) {
      logger.warn(`[Invoice] No admin found for org ${invoice.organization_id}`);
      return { sent: false, pdfUrl: null };
    }

    const pdfUrl = await this._generatePDF(invoice);

    await this.dbRun(`UPDATE invoices SET pdf_url = ? WHERE id = ?`, [pdfUrl, invoiceId]);

    const invoiceUrl = `${process.env.FRONTEND_URL}/billing/invoices/${invoiceId}`;
    await EmailService.send({
      to: admin.email,
      subject: `Invoice ${invoice.invoice_number} from Consultify`,
      // Renders billing/invoice_created.hbs via emailService (Task #84).
      template: 'invoice_created',
      data: {
        // Legacy fields kept for the inline JSON fallback.
        firstName: admin.first_name,
        total: invoice.formattedTotal,
        viewUrl: invoiceUrl,
        // Fields consumed by billing/invoice_created.hbs.
        recipientName: admin.first_name,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.formattedTotal ?? String(invoice.total),
        currency: invoice.currency ?? '',
        invoiceDate: invoice.created_at ?? '',
        dueDate: invoice.due_date,
        billingPeriod:
          invoice.billing_period_start && invoice.billing_period_end
            ? `${invoice.billing_period_start} – ${invoice.billing_period_end}`
            : '',
        invoiceUrl,
      },
      attachments: pdfUrl ? [{ filename: `${invoice.invoice_number}.pdf`, path: pdfUrl }] : [],
    });

    return { sent: true, pdfUrl };
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId: string, reason: string): Promise<void> {
    await this.dbRun(
      `UPDATE invoices SET status = 'void', notes = COALESCE(notes, '') || '\nVoided: ' || ?
             WHERE id = ?`,
      [reason, invoiceId]
    );
  }

  /**
   * Create invoice from Stripe invoice
   */
  async createFromStripe(stripeInvoice: StripeInvoice): Promise<Partial<Invoice> | null> {
    await this.#initDeps();

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

    const org = await this.dbGet<{ id: string }>(
      `SELECT id FROM organizations WHERE stripe_customer_id = ?`,
      [customer]
    );

    if (!org) {
      logger.warn(`[Invoice] Organization not found for Stripe customer ${customer}`);
      return null;
    }

    const items = lines.data.map((line) => ({
      description: line.description || line.plan?.nickname || 'Subscription',
      quantity: line.quantity || 1,
      unitPrice: line.amount,
    }));

    const invoice = await this.createInvoice({
      organizationId: org.id,
      items,
      currency: currency.toUpperCase(),
      taxRate: tax ? (tax / amount_due) * 100 : 0,
      billingPeriodStart: period_start ? new Date(period_start * 1000).toISOString() : null,
      billingPeriodEnd: period_end ? new Date(period_end * 1000).toISOString() : null,
    });

    await this.dbRun(
      `UPDATE invoices SET stripe_invoice_id = ?, status = ?, amount_paid = ?
             WHERE id = ?`,
      [stripeId, status === 'paid' ? 'paid' : 'open', amount_paid, invoice.id]
    );

    return invoice;
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  /**
   * Generate PDF for invoice
   * GAP-INVOICE-001: Real PDF generation for manual invoices
   */
  async _generatePDF(invoice: Invoice): Promise<string | null> {
    try {
      const PDFDocument = (await import('pdfkit')).default;
      const fs = await import('fs');
      const path = await import('path');

      // Create uploads directory if it doesn't exist
      const invoicesUploadsDir = uploadsDir('invoices');

      const fileName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filePath = path.join(invoicesUploadsDir, fileName);

      // Get organization and tax settings for invoice
      const orgData = await this.dbGet(
        `SELECT o.name, bts.billing_name, bts.billing_address_line1, bts.billing_address_line2,
                        bts.billing_city, bts.billing_state, bts.billing_postal_code, bts.billing_country,
                        bts.tax_id, bts.tax_id_type
                 FROM organizations o
                 LEFT JOIN billing_tax_settings bts ON o.id = bts.organization_id
                 WHERE o.id = ?`,
        [invoice.organization_id]
      );

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(24).text('INVOICE', 50, 50);
        doc.fontSize(10).text('Consultify', 400, 50, { align: 'right' });
        doc.text('DBR77 Consultify Sp. z o.o.', 400, 65, { align: 'right' });
        doc.text('ul. Przemysłowa 12/14', 400, 80, { align: 'right' });
        doc.text('00-450 Warsaw, Poland', 400, 95, { align: 'right' });
        doc.text('VAT: PL1234567890', 400, 110, { align: 'right' });

        // Invoice details
        doc.moveTo(50, 140).lineTo(550, 140).stroke();
        doc.fontSize(12);
        doc.text(`Invoice Number: ${invoice.invoice_number}`, 50, 160);
        doc.text(`Issue Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 50, 180);
        doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 50, 200);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 50, 220);

        // Bill To section
        doc.fontSize(12).text('Bill To:', 350, 160);
        const customerName = (orgData as any)?.billing_name || (orgData as any)?.name || 'Customer';
        doc.text(customerName, 350, 180);
        if ((orgData as any)?.billing_address_line1) {
          doc.text((orgData as any).billing_address_line1, 350, 200);
        }
        if ((orgData as any)?.billing_city) {
          const cityLine = `${(orgData as any).billing_city}${(orgData as any)?.billing_postal_code ? ', ' + (orgData as any).billing_postal_code : ''}`;
          doc.text(cityLine, 350, 220);
        }
        if ((orgData as any)?.billing_country) {
          doc.text((orgData as any).billing_country, 350, 240);
        }
        if ((orgData as any)?.tax_id) {
          doc.text(`VAT: ${(orgData as any).tax_id}`, 350, 260);
        }

        // Items table header
        const tableTop = 300;
        doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Description', 50, tableTop + 10);
        doc.text('Qty', 300, tableTop + 10);
        doc.text('Unit Price', 370, tableTop + 10);
        doc.text('Amount', 470, tableTop + 10);
        doc
          .moveTo(50, tableTop + 25)
          .lineTo(550, tableTop + 25)
          .stroke();

        // Items
        doc.font('Helvetica');
        let yPos = tableTop + 35;
        const items = invoice.items || [];

        if (items.length === 0) {
          // Add default line if no items
          doc.text('Subscription Service', 50, yPos);
          doc.text('1', 310, yPos);
          doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 360, yPos);
          doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 460, yPos);
          yPos += 20;
        } else {
          for (const item of items) {
            doc.text(item.description || 'Service', 50, yPos);
            doc.text(String(item.quantity || 1), 310, yPos);
            doc.text(`${invoice.currency} ${(item.unitPrice || 0).toFixed(2)}`, 360, yPos);
            doc.text(
              `${invoice.currency} ${(item.amount || item.unitPrice * item.quantity).toFixed(2)}`,
              460,
              yPos
            );
            yPos += 20;
          }
        }

        // Totals
        doc
          .moveTo(350, yPos + 10)
          .lineTo(550, yPos + 10)
          .stroke();
        yPos += 20;
        doc.text('Subtotal:', 350, yPos);
        doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 460, yPos);
        yPos += 20;

        if (invoice.tax_amount > 0) {
          doc.text(`Tax (${invoice.tax_rate}%):`, 350, yPos);
          doc.text(`${invoice.currency} ${invoice.tax_amount.toFixed(2)}`, 460, yPos);
          yPos += 20;
        }

        doc.font('Helvetica-Bold');
        doc.text('Total:', 350, yPos);
        doc.text(`${invoice.currency} ${invoice.total.toFixed(2)}`, 460, yPos);

        // Notes
        if (invoice.notes) {
          yPos += 50;
          doc.font('Helvetica').fontSize(10);
          doc.text('Notes:', 50, yPos);
          doc.text(invoice.notes, 50, yPos + 15);
        }

        // Footer
        doc.fontSize(8).font('Helvetica');
        doc.text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });
        doc.text('Payment is due within the terms specified above.', 50, 715, {
          align: 'center',
          width: 500,
        });

        doc.end();

        stream.on('finish', () => {
          const publicUrl = `/uploads/invoices/${fileName}`;
          logger.info(`[Invoice] PDF generated: ${publicUrl}`);
          resolve(publicUrl);
        });

        stream.on('error', (err) => {
          logger.error('[Invoice] PDF generation failed:', err);
          reject(err);
        });
      });
    } catch (err) {
      logger.error('[Invoice] PDF generation error:', err);
      return null;
    }
  }

  /**
   * Get PDF for invoice - returns existing or generates new
   * GAP-INVOICE-001
   */
  async getPDF(invoiceId: string): Promise<string | null> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) return null;

    // If Stripe invoice, redirect to Stripe PDF
    if (invoice.stripe_invoice_id && invoice.pdf_url?.includes('stripe.com')) {
      return invoice.pdf_url;
    }

    // If we have a local PDF, return it
    if (invoice.pdf_url && !invoice.pdf_url.includes('stripe.com')) {
      return invoice.pdf_url;
    }

    // Generate new PDF
    const pdfUrl = await this._generatePDF(invoice);
    if (pdfUrl) {
      await this.dbRun(`UPDATE invoices SET pdf_url = ? WHERE id = ?`, [pdfUrl, invoiceId]);
    }
    return pdfUrl;
  }
}

// ==========================================
// EXPORTS
// ==========================================

const InvoiceService = new InvoiceServiceClass();

export const createInvoice = (options: InvoiceOptions) => InvoiceService.createInvoice(options);
export const getInvoice = (invoiceId: string) => InvoiceService.getInvoice(invoiceId);
export const getInvoices = (orgId: string, options?: any) =>
  InvoiceService.getInvoices(orgId, options);
export const markAsPaid = (invoiceId: string) => InvoiceService.markAsPaid(invoiceId);
export const finalizeAndSend = (invoiceId: string) => InvoiceService.finalizeAndSend(invoiceId);
export const voidInvoice = (invoiceId: string, reason: string) =>
  InvoiceService.voidInvoice(invoiceId, reason);
export const createFromStripe = (stripeInvoice: StripeInvoice) =>
  InvoiceService.createFromStripe(stripeInvoice);
export const getPDF = (invoiceId: string) => InvoiceService.getPDF(invoiceId);

export default InvoiceService;
