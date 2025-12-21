const express = require('express');
const router = express.Router();
const DunningService = require('../services/dunningService');
const InvoiceService = require('../services/invoiceService');

// Use raw body for Stripe signature verification if needed
// For now, assuming body-parser json is used
router.post('/stripe', async (req, res) => {
    const event = req.body;
    const type = event.type;
    const data = event.data?.object;

    console.log(`[Webhook] Received Stripe event: ${type}`);

    try {
        switch (type) {
            case 'invoice.payment_failed':
                // Handle payment failure in Dunning Service
                await DunningService.processPaymentFailure({
                    subscriptionId: data.subscription,
                    customerId: data.customer,
                    invoiceId: data.id,
                    amountDue: data.amount_due,
                    currency: data.currency,
                    failureReason: data.last_payment_error?.message || 'Unknown error'
                });
                break;

            case 'invoice.payment_succeeded':
                // Handle success (recover dunning if active)
                await DunningService.processPaymentSuccess(data.subscription);

                // Create/Update local invoice
                await InvoiceService.createFromStripe(data);
                break;

            case 'customer.subscription.deleted':
                // Handle cancellation
                console.log(`[Webhook] Subscription canceled: ${data.id}`);
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Webhook] Error processing event:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
