# Billing Integration Guide

This guide covers how to set up and integrate the Consultinity billing system with Stripe for production use.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Stripe Setup](#stripe-setup)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing with Stripe CLI](#testing-with-stripe-cli)
6. [Production Checklist](#production-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- Node.js 18+ installed
- A Stripe account (sandbox for testing, live for production)
- Redis (optional, for email queue - falls back to memory queue)
- SMTP service configured (SendGrid, AWS SES, etc.)

## Environment Configuration

### Required Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx          # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_xxx     # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_xxx        # Webhook signing secret

# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxx
SMTP_FROM="Consultinity Billing" <billing@consultinity.app>

# Optional: Redis for Email Queue
REDIS_URL=redis://localhost:6379

# Application URLs
APP_URL=https://app.consultinity.app
COMPANY_NAME=Consultinity
COMPANY_EMAIL=billing@consultinity.app
```

### Configuration in Database

Additional settings can be configured via the `settings` table:

```sql
-- Dunning schedule (days after first failure)
INSERT INTO settings (key, value, category) VALUES
    ('dunning_step_1_days', '3', 'billing'),
    ('dunning_step_2_days', '7', 'billing'),
    ('dunning_step_3_days', '14', 'billing'),
    ('dunning_step_4_days', '21', 'billing'),
    ('dunning_max_retries', '4', 'billing');
```

---

## Stripe Setup

### 1. Create Products and Prices

In your Stripe Dashboard or via API:

```javascript
// Example: Create a product and price
const product = await stripe.products.create({
  name: 'Consultinity Pro',
  description: 'Professional plan with unlimited projects',
});

const monthlyPrice = await stripe.prices.create({
  product: product.id,
  unit_amount: 9900, // $99.00
  currency: 'usd',
  recurring: { interval: 'month' },
});

const yearlyPrice = await stripe.prices.create({
  product: product.id,
  unit_amount: 99000, // $990.00 (2 months free)
  currency: 'usd',
  recurring: { interval: 'year' },
});
```

### 2. Update Subscription Plans Table

```sql
UPDATE subscription_plans SET
    stripe_price_id = 'price_xxx_monthly',
    stripe_price_id_yearly = 'price_xxx_yearly',
    stripe_product_id = 'prod_xxx'
WHERE id = 'plan-pro';
```

### 3. Configure Customer Portal

In Stripe Dashboard → Settings → Billing → Customer Portal:

- Enable subscription management
- Enable payment method management
- Enable invoice history
- Set cancellation policy
- Configure proration behavior

---

## Webhook Configuration

### Webhook Endpoint

Configure Stripe to send events to:

```
https://your-domain.com/webhooks/stripe
```

### Required Events

Enable the following events in Stripe Dashboard:

| Event                           | Purpose                           |
| ------------------------------- | --------------------------------- |
| `customer.subscription.created` | New subscription activation       |
| `customer.subscription.updated` | Plan changes, status updates      |
| `customer.subscription.deleted` | Subscription cancellation         |
| `invoice.created`               | New invoice generation            |
| `invoice.paid`                  | Successful payment                |
| `invoice.payment_failed`        | Failed payment (triggers dunning) |
| `checkout.session.completed`    | Checkout success                  |
| `payment_intent.succeeded`      | Payment confirmation              |
| `payment_intent.payment_failed` | Payment failure                   |
| `customer.updated`              | Billing info sync                 |
| `charge.refunded`               | Refund processing                 |
| `charge.dispute.created`        | Dispute handling                  |
| `price.updated`                 | Price sync                        |

### Webhook Signature Verification

The webhook handler automatically verifies signatures when `STRIPE_WEBHOOK_SECRET` is set:

```javascript
// Handled automatically in server/routes/webhooks/stripe.js
const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

---

## Testing with Stripe CLI

### 1. Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz
```

### 2. Login and Forward Events

```bash
# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/webhooks/stripe
```

### 3. Trigger Test Events

```bash
# Trigger a checkout session completion
stripe trigger checkout.session.completed

# Trigger a payment failure
stripe trigger invoice.payment_failed

# Trigger a subscription update
stripe trigger customer.subscription.updated
```

### 4. Test Card Numbers

| Card Number        | Scenario           |
| ------------------ | ------------------ |
| `4242424242424242` | Success            |
| `4000000000000002` | Declined           |
| `4000000000009995` | Insufficient funds |
| `4000000000009987` | Expired card       |

---

## Production Checklist

### Security

- [ ] Use live Stripe keys (not test keys)
- [ ] Verify webhook signatures are enabled
- [ ] Implement rate limiting on billing endpoints
- [ ] Enable audit logging for all billing operations
- [ ] Encrypt sensitive billing data at rest
- [ ] Use express-validator for input validation

### Configuration

- [ ] Configure Customer Portal in Stripe Dashboard
- [ ] Set up automatic retries in Stripe settings
- [ ] Configure dunning emails and schedules
- [ ] Set up billing notification preferences
- [ ] Create and test all email templates

### Monitoring

- [ ] Set up Stripe webhook monitoring
- [ ] Configure alerts for failed payments
- [ ] Monitor dunning queue stats
- [ ] Track MRR and revenue metrics

### Testing

- [ ] Complete checkout flow test
- [ ] Plan upgrade/downgrade with proration
- [ ] Payment failure and dunning flow
- [ ] Subscription cancellation
- [ ] Invoice PDF generation
- [ ] All email templates render correctly

---

## API Quick Reference

### Create Checkout Session

```javascript
POST /api/billing/checkout
{
    "planId": "plan-pro",
    "successUrl": "https://app.example.com/billing/success",
    "cancelUrl": "https://app.example.com/billing/cancel",
    "billingCycle": "monthly"
}
```

### Create Customer Portal Session

```javascript
POST /api/billing/checkout/portal
{
    "returnUrl": "https://app.example.com/settings/billing"
}
```

### Get Usage Summary

```javascript
GET /api/billing/usage-summary?timeframe=30d
```

### Create Spending Alert

```javascript
POST /api/billing/spending-alerts
{
    "type": "ai_tokens",
    "threshold": 80,
    "thresholdType": "percentage",
    "action": "notify",
    "notifyEmails": ["admin@example.com"]
}
```

---

## Troubleshooting

### Common Issues

#### Webhook Signature Verification Failed

- Ensure `STRIPE_WEBHOOK_SECRET` matches the secret from Stripe Dashboard
- Check that raw body parsing is enabled: `express.raw({ type: 'application/json' })`
- Verify the webhook URL is correct

#### Emails Not Sending

- Check SMTP configuration in settings or environment variables
- Review email queue stats: `GET /api/admin/billing/email-stats`
- Check for failed emails and retry: `POST /api/admin/billing/retry-emails`

#### Payment Processing Errors

- Review payment attempts: Check `payment_attempts` table
- Verify customer has valid payment method
- Check Stripe Dashboard for detailed error messages

#### Dunning Not Working

- Verify dunning schedule settings in database
- Check `dunning_states` table for active states
- Review cron job/scheduler for `processPendingDunning`

### Logging

Enable detailed billing logs:

```env
DEBUG=billing:*
```

### Support

For additional support:

- Stripe Documentation: https://stripe.com/docs
- Consultinity Support: support@consultinity.app
