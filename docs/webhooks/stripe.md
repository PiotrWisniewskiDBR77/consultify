# Stripe Webhook Documentation

This document details the Stripe webhook implementation for the Consultinity billing system.

## Overview

The webhook handler processes Stripe events for subscription lifecycle management, payment processing, and billing automation.

**Endpoint:** `POST /webhooks/stripe`

**Location:** `server/routes/webhooks/stripe.js`

---

## Event Types

### Subscription Events

#### `customer.subscription.created`

Triggered when a new subscription is created.

**Actions:**

- Record subscription in `organization_billing`
- Create state transition in `subscription_state_history`
- Queue welcome email
- Create admin notification

**Payload Example:**

```json
{
  "id": "sub_xxx",
  "customer": "cus_xxx",
  "status": "active",
  "current_period_start": 1704067200,
  "current_period_end": 1706745600,
  "items": {
    "data": [
      {
        "price": {
          "id": "price_xxx",
          "nickname": "Pro Plan"
        }
      }
    ]
  }
}
```

#### `customer.subscription.updated`

Triggered when a subscription is modified (plan change, status change).

**Actions:**

- Update `organization_billing` status and period dates
- Record state transition if status changed
- Send notification for significant changes

#### `customer.subscription.deleted`

Triggered when a subscription is canceled.

**Actions:**

- Set status to "canceled" in `organization_billing`
- Record state transition
- Queue cancellation confirmation email
- Create admin notification

---

### Invoice Events

#### `invoice.created`

Triggered when a new invoice is created (draft).

**Actions:**

- Record invoice in `invoices` table
- Queue invoice notification email (if enabled)

#### `invoice.paid`

Triggered when an invoice is successfully paid.

**Actions:**

- Update invoice status to "paid"
- Record successful payment attempt
- Update billing status to "active"
- Clear any dunning state
- Queue payment receipt email
- Create success notification

#### `invoice.payment_failed`

Triggered when payment fails.

**Actions:**

- Record failed payment attempt with failure reason
- Update billing status to "past_due"
- Initialize or advance dunning state
- Queue payment failed email
- Create high-priority notification

---

### Checkout Events

#### `checkout.session.completed`

Triggered when a checkout session is successfully completed.

**Actions:**

- Update `checkout_sessions` record
- Link Stripe customer to organization
- Queue welcome email
- Create success notification

**Payload Example:**

```json
{
  "id": "cs_xxx",
  "customer": "cus_xxx",
  "mode": "subscription",
  "subscription": "sub_xxx",
  "amount_total": 9900,
  "customer_email": "user@example.com",
  "metadata": {
    "organization_id": "org-xxx",
    "user_id": "user-xxx",
    "plan_id": "plan-pro"
  }
}
```

---

### Payment Intent Events

#### `payment_intent.succeeded`

Triggered when a payment intent is confirmed.

**Actions:**

- Record successful payment attempt
- Clear dunning state if exists

#### `payment_intent.payment_failed`

Triggered when a payment intent fails.

**Actions:**

- Record failed payment attempt with error details
- Log failure code and reason

---

### Customer Events

#### `customer.updated`

Triggered when customer information is updated in Stripe.

**Actions:**

- Sync billing email to `organization_billing`
- Update tax ID if present in `billing_tax_settings`

---

### Charge Events

#### `charge.refunded`

Triggered when a charge is refunded.

**Actions:**

- Record refund in `billing_refunds` table
- Queue credit note email
- Create refund notification

**Payload Example:**

```json
{
  "id": "ch_xxx",
  "customer": "cus_xxx",
  "amount": 9900,
  "currency": "usd",
  "refunds": {
    "data": [
      {
        "id": "re_xxx",
        "amount": 9900,
        "status": "succeeded",
        "reason": "requested_by_customer"
      }
    ]
  }
}
```

#### `charge.dispute.created`

Triggered when a dispute (chargeback) is created.

**Actions:**

- Record dispute in `billing_disputes` table
- Create critical-priority notification for admins
- Optionally freeze account

---

### Price Events

#### `price.updated`

Triggered when a Stripe price is updated.

**Actions:**

- Sync pricing to `subscription_plans` table
- Update monthly or yearly price based on interval

---

## Idempotency

All webhook events are logged with their Stripe event ID in the `stripe_events` table. Before processing any event, the handler checks if the event has already been processed:

```javascript
if (await isEventProcessed(event.id)) {
  return res.json({ received: true, skipped: true });
}
```

This ensures events are never processed twice, even if Stripe retries delivery.

---

## Signature Verification

When `STRIPE_WEBHOOK_SECRET` is set, all incoming webhooks are verified:

```javascript
const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);
```

**Important:** The endpoint must receive the raw request body for signature verification to work. This is handled by:

```javascript
express.raw({ type: 'application/json' });
```

---

## Error Handling

Errors during webhook processing are:

1. Logged with full context
2. Recorded in `stripe_events` with status "failed" and error message
3. Returned as 500 status to trigger Stripe retry

Stripe will retry failed webhooks with exponential backoff:

- 1 hour
- 6 hours
- 24 hours
- 48 hours
- 72 hours

---

## Retry Policy

If a webhook fails:

1. The event is logged with "failed" status
2. The error is recorded for debugging
3. Stripe will automatically retry
4. On retry, idempotency check prevents duplicate processing

---

## Testing Webhooks

### Local Development

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

### Trigger Test Events

```bash
# Subscription lifecycle
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted

# Payment events
stripe trigger invoice.paid
stripe trigger invoice.payment_failed

# Checkout
stripe trigger checkout.session.completed

# Refunds
stripe trigger charge.refunded
```

### Manual Testing

```bash
curl -X POST http://localhost:3001/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_xxx",
    "type": "customer.subscription.created",
    "data": {
        "object": {
            "id": "sub_xxx",
            "customer": "cus_xxx",
            "status": "active",
            "current_period_start": 1704067200,
            "current_period_end": 1706745600
        }
    }
}'
```

---

## Database Tables Used

| Table                        | Purpose                       |
| ---------------------------- | ----------------------------- |
| `stripe_events`              | Event logging and idempotency |
| `organization_billing`       | Organization billing status   |
| `subscription_state_history` | State transitions audit       |
| `payment_attempts`           | Payment attempt tracking      |
| `dunning_states`             | Dunning management            |
| `invoices`                   | Invoice records               |
| `billing_refunds`            | Refund records                |
| `billing_disputes`           | Dispute records               |
| `checkout_sessions`          | Checkout tracking             |
| `billing_email_queue`        | Email queue                   |
| `notifications`              | Admin notifications           |

---

## Helper Functions

### `getOrgIdFromCustomer(customerId)`

Retrieves organization ID from Stripe customer ID.

### `logStripeEvent(event, orgId, status, errorMessage)`

Logs event for audit and idempotency.

### `queueBillingEmail(orgId, templateKey, templateData)`

Queues email for asynchronous sending.

### `createNotification(orgId, type, title, message, priority)`

Creates in-app notification for organization admins.

### `recordPaymentAttempt(...)`

Records payment attempt for analytics and debugging.

### `initializeDunning(orgId, subscriptionId, amountDue)`

Starts dunning process for failed payments.

---

## Security Considerations

1. **Always verify webhook signatures in production**
2. **Use HTTPS** for webhook endpoint
3. **Implement rate limiting** to prevent abuse
4. **Log all events** for audit trail
5. **Never expose webhook secret** in client-side code
6. **Validate metadata** before using in database queries
