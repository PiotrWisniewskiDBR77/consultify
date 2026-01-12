/**
 * Credit Note Service
 * Handles credit notes creation, management, and application to invoices
 * Integrates with Stripe Credit Notes API
 */

// Dependency injection container
const deps = {
    _db: null,
    _uuidv4: null,
    _billingWebhookService: null,
    _stripe: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get billingWebhookService() { return this._billingWebhookService; },
    set billingWebhookService(val) { this._billingWebhookService = val; },

    get stripe() { return this._stripe; },
    set stripe(val) { this._stripe = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/index.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._stripe && process.env.STRIPE_SECRET_KEY) {
        try {
            const { default: Stripe } = await import('stripe');
            deps._stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        } catch (e) {
            console.log('[CreditNote] Stripe not initialized');
        }
    }
}

// Lazy load billing webhook service
async function getBillingWebhookService() {
    if (!deps._billingWebhookService) {
        try {
            const module = await import('./billingWebhookService.js');
            deps._billingWebhookService = module.default || module;
        } catch (e) {
            console.warn('[CreditNote] Billing webhook service not available');
        }
    }
    return deps._billingWebhookService;
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
    if (newDeps.billingWebhookService) deps.billingWebhookService = newDeps.billingWebhookService;
    if (newDeps.stripe) deps.stripe = newDeps.stripe;
}

/**
 * Generate unique credit note number
 */
async function generateCreditNoteNumber() {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT COUNT(*) as count FROM credit_notes WHERE credit_note_number LIKE 'CN-${new Date().getFullYear()}%'`,
            [],
            (err, row) => {
                if (err) return reject(err);
                const count = (row?.count || 0) + 1;
                const year = new Date().getFullYear();
                const number = `CN-${year}-${String(count).padStart(6, '0')}`;
                resolve(number);
            }
        );
    });
}

/**
 * Create a new credit note
 * @param {Object} options - Credit note options
 * @param {string} options.organizationId - Organization ID
 * @param {string} [options.invoiceId] - Original invoice ID (optional)
 * @param {Array} options.items - Array of { description, quantity, unitPrice }
 * @param {string} options.reason - Reason for credit note
 * @param {string} [options.reasonDetails] - Additional reason details
 * @param {string} [options.currency] - Currency code
 * @param {number} [options.taxRate] - Tax rate percentage
 * @param {string} [options.memo] - Internal memo
 * @param {string} [options.customerMemo] - Customer-visible memo
 * @param {string} [options.createdBy] - User ID who created the note
 */
async function createCreditNote(options) {
    await initDeps();
    const {
        organizationId,
        invoiceId = null,
        items,
        reason,
        reasonDetails = null,
        currency = 'USD',
        taxRate = 0,
        memo = null,
        customerMemo = null,
        createdBy = null
    } = options;

    const creditNoteId = `cn-${deps.uuidv4()}`;
    const creditNoteNumber = await generateCreditNoteNumber();

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
        subtotal += item.quantity * item.unitPrice;
    }

    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + taxAmount;

    // Get exchange rate if needed
    let exchangeRate = 1.0;
    let baseTotal = total;
    if (currency !== 'USD') {
        const rate = await getExchangeRate(currency, 'USD');
        if (rate) {
            exchangeRate = rate;
            baseTotal = Math.round(total * rate);
        }
    }

    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO credit_notes (
                id, organization_id, invoice_id, credit_note_number,
                subtotal, tax_amount, total, amount_remaining,
                currency, exchange_rate, base_currency, base_total,
                status, reason, reason_details, memo, customer_memo, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                creditNoteId, organizationId, invoiceId, creditNoteNumber,
                subtotal, taxAmount, total, total,
                currency, exchangeRate, 'USD', baseTotal,
                'issued', reason, reasonDetails, memo, customerMemo, createdBy
            ],
            async function(err) {
                if (err) return reject(err);

                // Insert line items
                for (const item of items) {
                    const itemId = `cni-${deps.uuidv4()}`;
                    await insertCreditNoteItem(creditNoteId, itemId, item);
                }

                // Record subscription event
                await recordSubscriptionEvent(organizationId, 'credit_applied', {
                    amount: total,
                    currency,
                    metadata: JSON.stringify({ credit_note_id: creditNoteId, reason })
                });

                // Trigger billing webhook
                const webhookService = await getBillingWebhookService();
                if (webhookService) {
                    webhookService.creditNoteIssued(organizationId, {
                        id: creditNoteId,
                        credit_note_number: creditNoteNumber,
                        organization_id: organizationId,
                        invoice_id: invoiceId,
                        total,
                        currency,
                        reason,
                        status: 'issued',
                        created_at: new Date().toISOString()
                    }).catch(err => console.warn('[CreditNote] Webhook trigger failed:', err.message));
                }

                resolve({
                    id: creditNoteId,
                    creditNoteNumber,
                    total,
                    currency,
                    status: 'issued'
                });
            }
        );
    });
}

/**
 * Insert credit note line item
 */
async function insertCreditNoteItem(creditNoteId, itemId, item) {
    await initDeps();
    return new Promise((resolve, reject) => {
        const amount = item.quantity * item.unitPrice;
        deps.db.run(
            `INSERT INTO credit_note_items (id, credit_note_id, invoice_item_id, description, quantity, unit_price, amount, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemId, creditNoteId, item.invoiceItemId || null, item.description, item.quantity, item.unitPrice, amount, JSON.stringify(item.metadata || {})],
            (err) => {
                if (err) reject(err);
                else resolve({ id: itemId });
            }
        );
    });
}

/**
 * Get credit note by ID
 */
async function getCreditNoteById(creditNoteId) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT cn.*, o.name as organization_name
             FROM credit_notes cn
             LEFT JOIN organizations o ON cn.organization_id = o.id
             WHERE cn.id = ?`,
            [creditNoteId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

/**
 * Get credit notes for organization
 */
async function getCreditNotes(organizationId, options = {}) {
    await initDeps();
    const { status, limit = 50, offset = 0 } = options;
    
    let query = `SELECT * FROM credit_notes WHERE organization_id = ?`;
    const params = [organizationId];
    
    if (status) {
        query += ` AND status = ?`;
        params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
        deps.db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Get all credit notes (admin)
 */
async function getAllCreditNotes(options = {}) {
    await initDeps();
    const { status, organizationId, limit = 100, offset = 0 } = options;
    
    let query = `SELECT cn.*, o.name as organization_name 
                 FROM credit_notes cn
                 LEFT JOIN organizations o ON cn.organization_id = o.id
                 WHERE 1=1`;
    const params = [];
    
    if (status) {
        query += ` AND cn.status = ?`;
        params.push(status);
    }
    
    if (organizationId) {
        query += ` AND cn.organization_id = ?`;
        params.push(organizationId);
    }
    
    query += ` ORDER BY cn.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
        deps.db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Get credit note items
 */
async function getCreditNoteItems(creditNoteId) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.all(
            'SELECT * FROM credit_note_items WHERE credit_note_id = ?',
            [creditNoteId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Apply credit note to invoice
 */
async function applyCreditToInvoice(creditNoteId, invoiceId, amount = null) {
    await initDeps();
    const creditNote = await getCreditNoteById(creditNoteId);
    if (!creditNote) {
        throw new Error('Credit note not found');
    }

    if (creditNote.status === 'voided' || creditNote.status === 'refunded') {
        throw new Error('Credit note is no longer valid');
    }

    if (creditNote.amount_remaining <= 0) {
        throw new Error('No remaining credit available');
    }

    // Get invoice
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    if (creditNote.organization_id !== invoice.organization_id) {
        throw new Error('Credit note and invoice belong to different organizations');
    }

    // Calculate amount to apply
    const amountToApply = amount 
        ? Math.min(amount, creditNote.amount_remaining, invoice.amount_due)
        : Math.min(creditNote.amount_remaining, invoice.amount_due);

    if (amountToApply <= 0) {
        throw new Error('No amount to apply');
    }

    const applicationId = `ca-${deps.uuidv4()}`;

    return new Promise((resolve, reject) => {
        // Start transaction
        deps.db.serialize(() => {
            // Record the application
            deps.db.run(
                `INSERT INTO credit_applications (id, credit_note_id, invoice_id, amount, applied_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [applicationId, creditNoteId, invoiceId, amountToApply, null]
            );

            // Update credit note
            const newAmountApplied = creditNote.amount_applied + amountToApply;
            const newAmountRemaining = creditNote.amount_remaining - amountToApply;
            const newStatus = newAmountRemaining <= 0 ? 'applied' : 'issued';

            deps.db.run(
                `UPDATE credit_notes 
                 SET amount_applied = ?, amount_remaining = ?, status = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [newAmountApplied, newAmountRemaining, newStatus, creditNoteId]
            );

            // Update invoice
            const newAmountPaid = invoice.amount_paid + amountToApply;
            const newAmountDue = invoice.amount_due - amountToApply;
            const invoiceStatus = newAmountDue <= 0 ? 'paid' : invoice.status;

            deps.db.run(
                `UPDATE invoices 
                 SET amount_paid = ?, amount_due = ?, status = ?, credit_note_id = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [newAmountPaid, newAmountDue, invoiceStatus, creditNoteId, invoiceId],
                function(err) {
                    if (err) return reject(err);

                    resolve({
                        applicationId,
                        creditNoteId,
                        invoiceId,
                        amountApplied: amountToApply,
                        creditNoteRemaining: newAmountRemaining,
                        invoiceAmountDue: newAmountDue
                    });
                }
            );
        });
    });
}

/**
 * Refund credit note (issue refund to customer)
 */
async function refundCreditNote(creditNoteId, amount = null) {
    await initDeps();
    const creditNote = await getCreditNoteById(creditNoteId);
    if (!creditNote) {
        throw new Error('Credit note not found');
    }

    if (creditNote.status === 'voided' || creditNote.status === 'refunded') {
        throw new Error('Credit note is no longer valid');
    }

    const refundAmount = amount || creditNote.amount_remaining;
    if (refundAmount <= 0 || refundAmount > creditNote.amount_remaining) {
        throw new Error('Invalid refund amount');
    }

    let stripeRefundId = null;

    // Process Stripe refund if configured
    if (deps.stripe && creditNote.stripe_credit_note_id) {
        try {
            const refund = await deps.stripe.refunds.create({
                amount: refundAmount,
                metadata: {
                    credit_note_id: creditNoteId,
                    organization_id: creditNote.organization_id
                }
            });
            stripeRefundId = refund.id;
        } catch (e) {
            console.error('[CreditNote] Stripe refund failed:', e.message);
            throw new Error(`Stripe refund failed: ${e.message}`);
        }
    }

    return new Promise((resolve, reject) => {
        const newRefundAmount = creditNote.refund_amount + refundAmount;
        const newAmountRemaining = creditNote.amount_remaining - refundAmount;
        const newStatus = newAmountRemaining <= 0 ? 'refunded' : 'issued';

        deps.db.run(
            `UPDATE credit_notes 
             SET refund_amount = ?, amount_remaining = ?, status = ?, 
                 stripe_refund_id = ?, refunded_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?`,
            [newRefundAmount, newAmountRemaining, newStatus, stripeRefundId, creditNoteId],
            function(err) {
                if (err) return reject(err);

                resolve({
                    creditNoteId,
                    refundAmount,
                    stripeRefundId,
                    status: newStatus,
                    amountRemaining: newAmountRemaining
                });
            }
        );
    });
}

/**
 * Void a credit note
 */
async function voidCreditNote(creditNoteId, voidedBy = null) {
    await initDeps();
    const creditNote = await getCreditNoteById(creditNoteId);
    if (!creditNote) {
        throw new Error('Credit note not found');
    }

    if (creditNote.status !== 'draft' && creditNote.status !== 'issued') {
        throw new Error('Only draft or issued credit notes can be voided');
    }

    if (creditNote.amount_applied > 0) {
        throw new Error('Cannot void a credit note that has been partially applied');
    }

    // Void in Stripe if exists
    if (deps.stripe && creditNote.stripe_credit_note_id) {
        try {
            await deps.stripe.creditNotes.voidCreditNote(creditNote.stripe_credit_note_id);
        } catch (e) {
            console.warn('[CreditNote] Could not void in Stripe:', e.message);
        }
    }

    return new Promise((resolve, reject) => {
        deps.db.run(
            `UPDATE credit_notes 
             SET status = 'voided', voided_at = datetime('now'), voided_by = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [voidedBy, creditNoteId],
            function(err) {
                if (err) return reject(err);
                resolve({ creditNoteId, status: 'voided' });
            }
        );
    });
}

/**
 * Get credit note statistics
 */
async function getCreditNoteStats(organizationId = null) {
    await initDeps();
    return new Promise((resolve, reject) => {
        let query = `
            SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued_count,
                SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied_count,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded_count,
                SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END) as voided_count,
                COALESCE(SUM(total), 0) as total_value,
                COALESCE(SUM(amount_applied), 0) as total_applied,
                COALESCE(SUM(refund_amount), 0) as total_refunded,
                COALESCE(SUM(amount_remaining), 0) as total_remaining
            FROM credit_notes
        `;
        const params = [];

        if (organizationId) {
            query += ` WHERE organization_id = ?`;
            params.push(organizationId);
        }

        deps.db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || {
                total_count: 0,
                issued_count: 0,
                applied_count: 0,
                refunded_count: 0,
                voided_count: 0,
                total_value: 0,
                total_applied: 0,
                total_refunded: 0,
                total_remaining: 0
            });
        });
    });
}

/**
 * Get available credit balance for organization
 */
async function getAvailableCreditBalance(organizationId) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT COALESCE(SUM(amount_remaining), 0) as available_credit
             FROM credit_notes 
             WHERE organization_id = ? AND status IN ('issued')`,
            [organizationId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.available_credit || 0);
            }
        );
    });
}

// Helper functions
async function getInvoice(invoiceId) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getExchangeRate(from, to) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?',
            [from, to],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.rate || null);
            }
        );
    });
}

function recordSubscriptionEvent(organizationId, eventType, data) {
    return new Promise((resolve, reject) => {
        const id = `evt-${deps.uuidv4()}`;
        deps.db.run(
            `INSERT INTO subscription_events (id, organization_id, event_type, amount, currency, trigger, metadata)
             VALUES (?, ?, ?, ?, ?, 'system', ?)`,
            [id, organizationId, eventType, data.amount, data.currency, data.metadata],
            (err) => {
                if (err) {
                    console.warn('[CreditNote] Could not record subscription event:', err.message);
                    resolve(); // Don't fail the main operation
                } else {
                    resolve({ id });
                }
            }
        );
    });
}

export {
setDependencies,
    createCreditNote,
    getCreditNoteById,
    getCreditNotes,
    getAllCreditNotes,
    getCreditNoteItems,
    applyCreditToInvoice,
    refundCreditNote,
    voidCreditNote,
    getCreditNoteStats,
    getAvailableCreditBalance,
    generateCreditNoteNumber
};

export default {
    setDependencies,
    createCreditNote,
    getCreditNoteById,
    getCreditNotes,
    getAllCreditNotes,
    getCreditNoteItems,
    applyCreditToInvoice,
    refundCreditNote,
    voidCreditNote,
    getCreditNoteStats,
    getAvailableCreditBalance,
    generateCreditNoteNumber
};

