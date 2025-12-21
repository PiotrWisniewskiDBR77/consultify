const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireOrgAccess } = require('../middleware/rbac');
const InvoiceService = require('../services/invoiceService');
const CurrencyService = require('../services/currencyService');

/**
 * GET /api/billing/invoices
 * Get invoices for organization
 */
router.get('/invoices', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { status, limit, offset } = req.query;

        const invoices = await InvoiceService.getInvoices(orgId, {
            status,
            limit: parseInt(limit) || 20,
            offset: parseInt(offset) || 0
        });

        res.json({ invoices });
    } catch (error) {
        console.error('[Billing] Get invoices error:', error);
        res.status(500).json({ error: 'Failed to get invoices' });
    }
});

/**
 * GET /api/billing/invoices/:id
 * Get single invoice details
 */
router.get('/invoices/:id', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const invoice = await InvoiceService.getInvoice(req.params.id);

        if (!invoice || invoice.organization_id !== (req.org?.id || req.user.organizationId)) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({ invoice });
    } catch (error) {
        console.error('[Billing] Get invoice error:', error);
        res.status(500).json({ error: 'Failed to get invoice' });
    }
});

/**
 * POST /api/billing/invoices/:id/pay
 * Mark invoice as paid (manual action for testing/admin)
 */
router.post('/invoices/:id/pay', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const invoice = await InvoiceService.getInvoice(req.params.id);
        if (!invoice || invoice.organization_id !== (req.org?.id || req.user.organizationId)) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        await InvoiceService.markAsPaid(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Billing] Pay invoice error:', error);
        res.status(500).json({ error: 'Failed to pay invoice' });
    }
});

/**
 * GET /api/billing/currencies
 * Get supported currencies
 */
router.get('/currencies', async (req, res) => {
    try {
        const currencies = await CurrencyService.getSupportedCurrencies();
        res.json({ currencies });
    } catch (error) {
        console.error('[Billing] Get currencies error:', error);
        res.status(500).json({ error: 'Failed to get currencies' });
    }
});

/**
 * GET /api/billing/exchange-rates
 * Get exchange rate for currency
 */
router.get('/exchange-rate', async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'Missing currency codes' });

        const rate = await CurrencyService.getExchangeRate(from, to);
        res.json({ from, to, rate });
    } catch (error) {
        console.error('[Billing] Exchange rate error:', error);
        res.status(500).json({ error: 'Failed to get exchange rate' });
    }
});

module.exports = router;
