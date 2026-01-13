# Partner Payout Integration Architecture

## Executive Summary

This document outlines the architecture options for automated partner payout integration to replace manual bank transfers. The goal is to enable seamless, scalable commission payments to partners.

---

## Current State

### How Payouts Work Today

1. Partner requests payout from Partner Portal
2. SuperAdmin approves and marks payout as "Processing"
3. Finance team manually transfers funds via bank
4. SuperAdmin manually marks payout as "Completed"

### Pain Points

- Manual process prone to errors
- Slow turnaround (3-5 business days)
- No real-time tracking for partners
- High operational overhead
- Limited payout methods (bank transfer only)

---

## Proposed Solutions

### Option A: Stripe Connect (Recommended)

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Consultinity                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Partner Portal  │───▶│ Payout Service  │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│                                  ▼                               │
│                         ┌────────────────┐                       │
│                         │ Stripe Connect │                       │
│                         │    Platform    │                       │
│                         └────────┬───────┘                       │
│                                  │                               │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        ┌──────────┐        ┌──────────┐        ┌──────────┐
        │ Partner  │        │ Partner  │        │ Partner  │
        │ Bank EUR │        │ Bank USD │        │ Bank GBP │
        └──────────┘        └──────────┘        └──────────┘
```

**How it works:**

1. Partner onboards to Stripe Connect (KYC, bank details)
2. When commission approved, we call Stripe Transfer API
3. Stripe handles currency conversion, compliance, banking
4. Partner sees funds in 2-3 business days

**Pricing:**

- 0.25% + €0.25 per payout (EU)
- 1% for currency conversion
- No monthly fees

**Pros:**

- Already use Stripe for billing (unified platform)
- Automatic KYC/compliance handling
- Multi-currency support
- Real-time tracking and webhooks
- Fast setup (API ready)

**Cons:**

- 0.25% fee on payouts
- Partners need Stripe onboarding
- May feel "corporate" for some partners

**Implementation Effort:** 2-3 weeks

---

### Option B: PayPal Payouts

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Consultinity                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Partner Portal  │───▶│ Payout Service  │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│                                  ▼                               │
│                         ┌────────────────┐                       │
│                         │ PayPal Payouts │                       │
│                         │      API       │                       │
│                         └────────┬───────┘                       │
│                                  │                               │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        ┌──────────┐        ┌──────────┐        ┌──────────┐
        │ Partner  │        │ Partner  │        │ Partner  │
        │  PayPal  │        │  PayPal  │        │  PayPal  │
        └──────────┘        └──────────┘        └──────────┘
```

**How it works:**

1. Partner provides PayPal email
2. When commission approved, we call PayPal Payouts API
3. Funds appear in partner's PayPal instantly
4. Partner can withdraw to bank or use PayPal balance

**Pricing:**

- 2% per transaction (domestic)
- 0.5% + FX fee for international
- Mass Payouts available at volume discounts

**Pros:**

- Partners familiar with PayPal
- Instant delivery to PayPal balance
- No partner onboarding needed
- Global coverage (200+ countries)

**Cons:**

- Higher fees than Stripe
- Requires PayPal Business account
- Less integration with existing billing
- PayPal disputes possible

**Implementation Effort:** 2 weeks

---

### Option C: Wise (TransferWise) Business API

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Consultinity                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Partner Portal  │───▶│ Payout Service  │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│                                  ▼                               │
│                         ┌────────────────┐                       │
│                         │   Wise API     │                       │
│                         │   (Business)   │                       │
│                         └────────┬───────┘                       │
│                                  │                               │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        ┌──────────┐        ┌──────────┐        ┌──────────┐
        │ Partner  │        │ Partner  │        │ Partner  │
        │ Bank EUR │        │ Bank USD │        │ Bank PLN │
        └──────────┘        └──────────┘        └──────────┘
```

**How it works:**

1. Partner provides bank details (IBAN, SWIFT)
2. We create recipient in Wise
3. When commission approved, we create transfer
4. Wise handles FX at mid-market rate, sends to bank

**Pricing:**

- ~0.5% + fixed fee (varies by corridor)
- Best FX rates (mid-market)
- No hidden fees

**Pros:**

- Lowest cost for international transfers
- Best exchange rates
- Direct bank deposit (no intermediary)
- Good for EU/UK partners

**Cons:**

- Slower (1-3 business days)
- Requires storing bank details
- More complex onboarding
- API rate limits

**Implementation Effort:** 3-4 weeks

---

### Option D: SEPA Direct Credit (EU Only)

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Consultinity                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Partner Portal  │───▶│ Payout Service  │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│                                  ▼                               │
│                         ┌────────────────┐                       │
│                         │  Banking API   │                       │
│                         │   (GoCardless  │                       │
│                         │   or similar)  │                       │
│                         └────────┬───────┘                       │
│                                  │                               │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
                                   ▼
                         ┌────────────────┐
                         │  SEPA Network  │
                         └────────┬───────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        ┌──────────┐       ┌──────────┐       ┌──────────┐
        │ Partner  │       │ Partner  │       │ Partner  │
        │  Bank    │       │  Bank    │       │  Bank    │
        │  (EU)    │       │  (EU)    │       │  (EU)    │
        └──────────┘       └──────────┘       └──────────┘
```

**How it works:**

1. Partner provides IBAN
2. We batch payouts and submit SEPA file
3. Banking partner executes transfers
4. Funds arrive same-day or next-day

**Pricing:**

- €0.10 - €0.30 per transfer
- No FX fees (EUR only)

**Pros:**

- Lowest fees (EU)
- Same-day settlement possible
- Direct to bank account
- Familiar for EU partners

**Cons:**

- EUR only (no multi-currency)
- EU/EEA only
- Requires bank integration
- Batch processing (not real-time)

**Implementation Effort:** 4-5 weeks

---

## Recommendation

### Primary: Stripe Connect

**Why:**

1. **Integration synergy** - Already using Stripe for billing
2. **Speed** - 2-3 weeks to implement
3. **Compliance** - Stripe handles KYC/AML
4. **Developer experience** - Well-documented API
5. **Partner experience** - Professional onboarding flow

### Secondary: PayPal (for specific markets)

Add PayPal as an alternative for:

- Partners in markets where Stripe Connect isn't ideal
- Partners who prefer PayPal
- Lower-value, high-frequency payouts

---

## Implementation Plan

### Phase 1: Stripe Connect MVP (Weeks 1-3)

**Week 1: Setup & Onboarding**

- [ ] Create Stripe Connect platform
- [ ] Implement partner onboarding flow
- [ ] Store Connect account IDs in `partner_organizations`
- [ ] Add onboarding status UI to Partner Portal

**Week 2: Payout Integration**

- [ ] Create `PartnerPayoutService` with Stripe Transfer API
- [ ] Update payout approval flow to trigger Stripe transfer
- [ ] Implement webhook handlers for transfer events
- [ ] Add transfer status tracking

**Week 3: Testing & Polish**

- [ ] Test with sandbox accounts
- [ ] Add error handling and retry logic
- [ ] Create payout history in Partner Portal
- [ ] Document partner onboarding guide

### Phase 2: PayPal Alternative (Weeks 4-5, Optional)

- [ ] Integrate PayPal Payouts API
- [ ] Add payout method selection to Partner Portal
- [ ] Allow partners to choose preferred method

---

## Database Changes

```sql
-- Add Stripe Connect account to partner_organizations
ALTER TABLE partner_organizations
ADD COLUMN stripe_connect_account_id TEXT,
ADD COLUMN stripe_connect_status TEXT DEFAULT 'NOT_STARTED',
ADD COLUMN stripe_connect_onboarded_at TIMESTAMP,
ADD COLUMN preferred_payout_method TEXT DEFAULT 'STRIPE_CONNECT';

-- Add transfer tracking to partner_payouts
ALTER TABLE partner_payouts
ADD COLUMN stripe_transfer_id TEXT,
ADD COLUMN stripe_payout_id TEXT,
ADD COLUMN external_reference TEXT,
ADD COLUMN failure_reason TEXT;

-- Index for lookups
CREATE INDEX idx_partner_orgs_connect ON partner_organizations(stripe_connect_account_id);
```

---

## API Endpoints

### Partner Onboarding

```
POST /api/partners/connect/onboarding
  -> Returns Stripe Connect onboarding URL

GET /api/partners/connect/status
  -> Returns current onboarding status

POST /api/partners/connect/webhook
  -> Handles Stripe Connect webhooks
```

### Payout Processing

```
POST /api/superadmin/partner-settlements/process-payout/:id
  -> Now triggers Stripe Transfer (instead of manual)

GET /api/partners/payouts/:id/tracking
  -> Returns real-time transfer status
```

---

## Estimated Costs

### Per €1,000 in Partner Payouts

| Method         | Fee                   | Net to Partner |
| -------------- | --------------------- | -------------- |
| Stripe Connect | €2.75 (0.25% + €0.25) | €997.25        |
| PayPal         | €20.00 (2%)           | €980.00        |
| Wise           | €5.00 (~0.5%)         | €995.00        |
| SEPA           | €0.20                 | €999.80        |

### Monthly Volume Estimate

- 50 partners × €500 avg = €25,000/month
- Stripe fees: ~€68/month
- Annual savings vs manual processing: 20+ hours/month × €50/hr = €12,000+

---

## Decision Required

**Recommendation:** Proceed with **Stripe Connect** as primary payout method.

**Questions for stakeholders:**

1. Do we want to offer PayPal as an alternative?
2. Should partners pay the payout fee or do we absorb it?
3. Minimum payout threshold (e.g., €50)?
4. Payout frequency (on-demand, weekly, monthly)?

---

## References

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [PayPal Payouts API](https://developer.paypal.com/docs/payouts/)
- [Wise Business API](https://api-docs.wise.com/)
- [SEPA Credit Transfer](https://www.europeanpaymentscouncil.eu/what-we-do/sepa-credit-transfer)
