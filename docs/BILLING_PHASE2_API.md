# Billing Module Phase 2 - API Documentation

## Overview

This document describes the Phase 2 enhancements to the Consultify Billing Module, including Credit Notes, Tax Configuration, Invoice Templates, Subscription Analytics, and Billing Webhooks.

---

## Table of Contents

1. [Credit Notes API](#credit-notes-api)
2. [Tax API](#tax-api)
3. [Invoice Templates API](#invoice-templates-api)
4. [Subscription Analytics API](#subscription-analytics-api)
5. [Billing Webhook Events API](#billing-webhook-events-api)
6. [Database Schema](#database-schema)
7. [Event Types Reference](#event-types-reference)

---

## Credit Notes API

### Create Credit Note
```
POST /api/billing/credit-notes
```

Creates a new credit note for the organization.

**Request Body:**
```json
{
  "amount": 5000,
  "currency": "USD",
  "reason": "service_unsatisfactory",
  "reasonDetails": "Customer requested refund due to service issues",
  "invoiceId": "inv-123" // Optional: link to specific invoice
}
```

**Response:**
```json
{
  "creditNote": {
    "id": "cn-abc123",
    "creditNumber": "CN-2024-000001",
    "amount": 5000,
    "currency": "USD",
    "status": "issued",
    "issued_at": "2024-01-15T10:30:00Z"
  }
}
```

### Get Credit Notes
```
GET /api/billing/credit-notes?status=issued
```

Returns all credit notes for the organization.

**Query Parameters:**
- `status` (optional): Filter by status (`issued`, `applied`, `refunded`, `void`)

### Get Credit Note by ID
```
GET /api/billing/credit-notes/:id
```

### Apply Credit to Invoice
```
POST /api/billing/credit-notes/:id/apply
```

Applies credit note amount to an open invoice.

**Request Body:**
```json
{
  "invoiceId": "inv-456",
  "amountToApply": 2500
}
```

---

## Tax API

### Get Tax Rates
```
GET /api/billing/tax/rates?countryCode=US&stateCode=CA
```

Returns configured tax rates.

**Query Parameters:**
- `countryCode` (optional): ISO 2-letter country code
- `stateCode` (optional): State/province code

**Response:**
```json
{
  "rates": [
    {
      "id": "tr-123",
      "country_code": "US",
      "state_code": "CA",
      "tax_type": "sales_tax",
      "rate": 0.0725,
      "name": "California Sales Tax",
      "is_active": true
    }
  ]
}
```

### Add Tax Rate (SuperAdmin Only)
```
POST /api/billing/tax/rates
```

**Request Body:**
```json
{
  "countryCode": "DE",
  "taxType": "vat",
  "rate": 0.19,
  "name": "German VAT",
  "description": "Standard VAT rate for Germany"
}
```

### Update Tax Rate (SuperAdmin Only)
```
PUT /api/billing/tax/rates/:id
```

### Calculate Tax
```
POST /api/billing/tax/calculate
```

Calculates tax for a given amount. Uses Stripe Tax if configured, falls back to internal rates.

**Request Body:**
```json
{
  "amount": 10000,
  "currency": "USD",
  "countryCode": "US",
  "stateCode": "CA",
  "taxId": "VAT123456789" // Optional
}
```

**Response:**
```json
{
  "taxCalculation": {
    "amount": 725,
    "rate": 0.0725,
    "source": "stripe_tax",
    "breakdown": [...]
  }
}
```

### Validate VAT Number
```
POST /api/billing/tax/validate-vat
```

**Request Body:**
```json
{
  "countryCode": "GB",
  "vatNumber": "123456789"
}
```

### Get Tax Report (SuperAdmin Only)
```
GET /api/billing/admin/tax/report?startDate=2024-01-01&endDate=2024-12-31
```

---

## Invoice Templates API

### Get Templates
```
GET /api/billing/templates
```

Returns invoice templates available to the organization (org-specific + global).

### Create Template (SuperAdmin Only)
```
POST /api/billing/templates
```

**Request Body:**
```json
{
  "name": "Enterprise Invoice",
  "organizationId": null,
  "templateData": {
    "header": {
      "showLogo": true,
      "companyName": "Consultify Inc.",
      "address": "123 Main St"
    },
    "footer": {
      "terms": "Net 30",
      "notes": "Thank you for your business"
    },
    "style": {
      "primaryColor": "#8B5CF6",
      "font": "Inter"
    }
  },
  "isDefault": true
}
```

### Update Template (SuperAdmin Only)
```
PUT /api/billing/templates/:id
```

### Delete Template (SuperAdmin Only)
```
DELETE /api/billing/templates/:id
```

### Generate Invoice from Template
```
POST /api/billing/templates/:id/generate-invoice
```

**Request Body:**
```json
{
  "invoiceDetails": {
    "items": [
      {
        "description": "Monthly Subscription - Pro Plan",
        "quantity": 1,
        "unit_price": 9900
      }
    ],
    "due_date": "2024-02-15"
  }
}
```

---

## Subscription Analytics API

All analytics endpoints require SuperAdmin role.

### MRR Trend
```
GET /api/billing/admin/analytics/mrr?period=12%20months
```

Returns Monthly Recurring Revenue trend.

**Response:**
```json
{
  "mrrTrend": [
    {
      "month": "2024-01",
      "mrr": 45000,
      "newSubscriptions": 12,
      "canceledSubscriptions": 3
    }
  ]
}
```

### Churn Rate
```
GET /api/billing/admin/analytics/churn?period=12%20months
```

**Response:**
```json
{
  "churnRate": [
    {
      "month": "2024-01",
      "churnRate": 2.5,
      "churnedCustomers": 5,
      "activeCustomers": 200
    }
  ]
}
```

### Lifetime Value (LTV)
```
GET /api/billing/admin/analytics/ltv
```

**Response:**
```json
{
  "ltv": {
    "ltv": "2800.00",
    "avgMrrPerCustomer": "99.00",
    "avgChurnRate": "2.5%"
  }
}
```

### Cohort Analysis
```
GET /api/billing/admin/analytics/cohorts
```

Returns customer retention cohort data.

### Expansion Revenue
```
GET /api/billing/admin/analytics/expansion-revenue?period=12%20months
```

**Response:**
```json
{
  "expansionRevenue": [
    {
      "month": "2024-01",
      "expansion_mrr": 5000
    }
  ]
}
```

---

## Billing Webhook Events API

### Get Webhook Events
```
GET /api/billing/webhook-events?limit=100
```

Returns recent billing webhook events for the organization.

### Get Webhook Event Stats
```
GET /api/billing/webhook-events/stats?period=30%20days
```

### Get Webhook Event by ID
```
GET /api/billing/webhook-events/:id
```

### Get Available Event Types
```
GET /api/billing/webhook-event-types
```

**Response:**
```json
{
  "eventTypes": {
    "SUBSCRIPTION_CREATED": "subscription.created",
    "SUBSCRIPTION_UPDATED": "subscription.updated",
    "SUBSCRIPTION_CANCELED": "subscription.canceled",
    "INVOICE_PAID": "invoice.paid",
    "PAYMENT_FAILED": "payment.failed",
    "CREDIT_NOTE_ISSUED": "credit_note.issued"
  }
}
```

### Retry Failed Event (SuperAdmin Only)
```
POST /api/billing/admin/webhook-events/:id/retry
```

### Get Failed Events (SuperAdmin Only)
```
GET /api/billing/admin/webhook-events/failed?limit=50
```

### Get Pending Events (SuperAdmin Only)
```
GET /api/billing/admin/webhook-events/pending?limit=50
```

---

## Database Schema

### credit_notes
```sql
CREATE TABLE credit_notes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    credit_number TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    reason TEXT,
    status TEXT DEFAULT 'issued',
    issued_at TEXT,
    applied_to_invoice_id TEXT,
    refund_id TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

### invoice_templates
```sql
CREATE TABLE invoice_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    template_data TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

### tax_rates
```sql
CREATE TABLE tax_rates (
    id TEXT PRIMARY KEY,
    country_code TEXT NOT NULL,
    state_code TEXT,
    tax_type TEXT NOT NULL,
    rate REAL NOT NULL,
    name TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    valid_from TEXT,
    valid_until TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

### subscription_events
```sql
CREATE TABLE subscription_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at TEXT
);
```

### billing_webhook_events
```sql
CREATE TABLE billing_webhook_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    target_url TEXT,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TEXT,
    next_retry_at TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

---

## Event Types Reference

### Subscription Events
| Event | Description |
|-------|-------------|
| `subscription.created` | New subscription created |
| `subscription.updated` | Subscription plan or details changed |
| `subscription.canceled` | Subscription canceled |
| `subscription.trial_ending` | Trial period ending soon (3 days) |
| `subscription.renewed` | Subscription renewed |
| `subscription.paused` | Subscription paused |
| `subscription.resumed` | Subscription resumed from pause |

### Invoice Events
| Event | Description |
|-------|-------------|
| `invoice.created` | Invoice created |
| `invoice.sent` | Invoice sent to customer |
| `invoice.paid` | Invoice paid successfully |
| `invoice.payment_failed` | Payment attempt failed |
| `invoice.overdue` | Invoice past due date |
| `invoice.voided` | Invoice voided |
| `invoice.finalized` | Invoice finalized (no more changes) |

### Payment Events
| Event | Description |
|-------|-------------|
| `payment.succeeded` | Payment successful |
| `payment.failed` | Payment failed |
| `payment.refunded` | Payment refunded |
| `payment.disputed` | Payment disputed by customer |

### Credit Note Events
| Event | Description |
|-------|-------------|
| `credit_note.issued` | Credit note issued |
| `credit_note.applied` | Credit applied to invoice |
| `credit_note.refunded` | Credit note refunded |
| `credit_note.voided` | Credit note voided |

### Usage Events
| Event | Description |
|-------|-------------|
| `usage.limit_approaching` | Usage at 80% of limit |
| `usage.limit_exceeded` | Usage exceeded plan limit |
| `usage.record_created` | Usage record created |

### Dunning Events
| Event | Description |
|-------|-------------|
| `dunning.started` | Dunning process started |
| `dunning.retry_scheduled` | Payment retry scheduled |
| `dunning.final_attempt` | Final payment attempt |
| `dunning.completed` | Dunning completed (payment recovered) |
| `dunning.failed` | Dunning failed (subscription to be canceled) |

---

## Webhook Payload Format

All webhook events follow this format:

```json
{
  "id": "evt_abc123xyz",
  "type": "invoice.paid",
  "created": "2024-01-15T10:30:00.000Z",
  "livemode": true,
  "data": {
    "object": {
      // Event-specific data
    }
  }
}
```

### Signature Verification

Webhooks include HMAC signature in the `X-Consultify-Signature` header:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === expectedSignature;
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

- Standard endpoints: 100 requests/minute
- Analytics endpoints: 20 requests/minute
- Webhook retry: 10 requests/minute

---

## Changelog

### Version 2.0.0 (January 2024)
- Added Credit Notes API
- Added Tax Configuration API with Stripe Tax integration
- Added Invoice Templates API
- Added Subscription Analytics API
- Added Billing Webhook Events system
- Extended discount_codes with min_purchase_amount, applies_to, usage_limit_per_customer

---

## Test Results

### Test Summary (January 2, 2026)

| Test Suite | Tests | Passed | Failed |
|------------|-------|--------|--------|
| billingWebhookService.test.js | 20 | 20 | 0 |
| subscriptionAnalyticsService.test.js | 14 | 14 | 0 |
| billingPhase2.test.js (integration) | 22 | 22 | 0 |
| **Total** | **56** | **56** | **0** |

### Test Coverage Areas

#### Billing Webhook Service
- ✅ Event type definitions (subscription, invoice, payment, credit note, dunning)
- ✅ Event recording and persistence
- ✅ Event status management
- ✅ Retry logic for failed events
- ✅ Convenience methods for common events
- ✅ Event statistics and reporting
- ✅ Error handling

#### Subscription Analytics Service
- ✅ MRR trend calculation with cumulative values
- ✅ Churn rate calculation by period
- ✅ LTV (Lifetime Value) calculation
- ✅ Cohort analysis data structure
- ✅ Expansion revenue tracking
- ✅ Current MRR with breakdown
- ✅ Database error handling

#### Integration Tests (Phase 2 API)
- ✅ Credit Notes CRUD operations
- ✅ Credit note application to invoices
- ✅ Tax rate configuration
- ✅ Tax calculation
- ✅ VAT validation
- ✅ Invoice template management
- ✅ MRR/Churn/LTV analytics endpoints
- ✅ Webhook event endpoints
- ✅ Authorization and access control
- ✅ Input validation

### Running Tests

```bash
# Run all billing phase 2 tests
npx vitest run tests/unit/backend/billingWebhookService.test.js \
  tests/unit/backend/subscriptionAnalyticsService.test.js \
  tests/integration/routes/billingPhase2.test.js

# Run with coverage
npx vitest run --coverage tests/unit/backend/billing*.test.js
```

---

## Support

For API support, contact: api-support@consultify.ai

