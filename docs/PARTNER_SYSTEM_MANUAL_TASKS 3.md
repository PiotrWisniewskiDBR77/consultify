# Partner Referral System - Manual Tasks for Deployment

## 📋 Pre-Deployment Tasks (Do BEFORE deployment)

### 1. Code Review & Testing

- [ ] Review `server/migrations/216_partner_referral_system.sql`
- [ ] Review `server/src/services/partnerReferralService.ts`
- [ ] Review `server/src/services/partnerCommissionService.ts`
- [ ] Review `server/src/routes/partners.routes.ts` (extended with referral routes)
- [ ] Run unit tests for new services
- [ ] Run integration tests for partner API endpoints

### 2. Environment Configuration

- [ ] Add to production `.env`:

```env
# Partner Referral System
PARTNER_DEFAULT_COMMISSION_RATE=15
PARTNER_ATTRIBUTION_WINDOW_DAYS=30
PARTNER_COMMISSION_DURATION_MONTHS=12
PARTNER_MIN_PAYOUT_THRESHOLD=100
APP_URL=https://app.consultinity.com
```

## 🚀 Deployment Tasks (Do DURING deployment)

### 3. Database Migration

- [ ] Backup production database
- [ ] Run migration:

```bash
psql $DATABASE_URL -f server/migrations/216_partner_referral_system.sql
```

- [ ] Verify tables created:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'partner_%';
```

- [ ] Verify existing partner_organizations have referral_code generated (trigger should have run)

### 4. Backend Deployment

- [ ] Deploy updated `server/src/Gateway.ts` with new route imports
- [ ] Deploy new services: `partnerReferralService.ts`, `partnerCommissionService.ts`
- [ ] Deploy updated `partners.routes.ts`
- [ ] Verify routes accessible:
  - `GET /api/partners/referral-tools` (should return 401 without auth)
  - `GET /api/public/partner/validate-code/TEST` (should return validation result)

### 5. Frontend Deployment

- [ ] Deploy updated `PartnerSidebar.tsx` with new navigation items
- [ ] Deploy `PartnerPortalView.tsx` with new section routing
- [ ] Deploy new sections: `ReferralToolsSection.tsx`, `EarningsSection.tsx`
- [ ] Deploy `PartnerSettlementsView.tsx` for SuperAdmin

## ✅ Post-Deployment Verification

### 6. Smoke Tests

- [ ] Partner Portal: Log in as partner user
- [ ] Navigate to "Referrals" → "My Links & Codes"
- [ ] Verify referral code and link are displayed
- [ ] Create a test campaign link
- [ ] Navigate to "Earnings" → "Commission Earnings"
- [ ] Verify summary cards show data (even if zeros)

### 7. SuperAdmin Verification

- [ ] Log in as SuperAdmin
- [ ] Navigate to "Revenue" → "Partner Settlements"
- [ ] Verify summary cards display
- [ ] Verify pending commissions table loads

### 8. Public Endpoint Tests

```bash
# Test code validation
curl https://app.consultinity.com/api/public/partner/validate-code/PARTNER-TEST

# Test click tracking
curl -X POST https://app.consultinity.com/api/public/partner/track-click \
  -H "Content-Type: application/json" \
  -d '{"referralCode":"PARTNER-A1B2C3","utmSource":"test"}'
```

## 🔧 Configuration Tasks (Post-Deployment)

### 9. Stripe Integration (If using automated commissions)

- [ ] Add Stripe webhook handler for `invoice.paid`:

```typescript
// In stripe webhook handler
if (event.type === 'invoice.paid') {
  const invoice = event.data.object;
  const organizationId = invoice.metadata.organization_id;

  // Check for attribution
  const attribution = await PartnerReferralService.getAttributionByOrganization(organizationId);
  if (attribution && attribution.status === 'ACTIVE') {
    await PartnerCommissionService.createCommission({
      partnerOrgId: attribution.partnerOrgId,
      attributionId: attribution.id,
      organizationId,
      transactionType: 'SUBSCRIPTION',
      grossAmount: invoice.amount_paid / 100,
      commissionRate: attribution.commissionRatePercent,
      stripeInvoiceId: invoice.id,
      stripePaymentId: invoice.payment_intent,
    });
  }
}
```

### 10. Signup Flow Integration

- [ ] Update registration handler to accept `partner_code`:

```typescript
// In auth register handler
if (req.body.partner_code) {
  const validation = await PartnerReferralService.validateReferralCode(req.body.partner_code);
  if (validation.valid && validation.partnerOrgId) {
    await PartnerReferralService.createAttribution({
      partnerOrgId: validation.partnerOrgId,
      organizationId: newOrganization.id,
      attributionType: 'PROMO_CODE',
      referralCodeUsed: req.body.partner_code,
      commissionRatePercent: 15, // Or fetch from partner tier
    });
  }
}
```

### 11. Payout Method Integration (Optional)

For automated payouts, integrate with:

- [ ] Stripe Connect (for Stripe-based payouts)
- [ ] PayPal Payouts API
- [ ] Wise Business API
- [ ] Bank transfer batch processing

## 📊 Monitoring Setup

### 12. Add Metrics/Alerts

- [ ] Monitor `/api/public/partner/validate-code` response times
- [ ] Monitor `/api/public/partner/track-click` success rate
- [ ] Alert on commission creation failures
- [ ] Alert on payout processing failures

### 13. Logging

- [ ] Ensure partner commission transactions are logged
- [ ] Ensure payout requests are logged with audit trail
- [ ] Log attribution creation events

## 🧪 Testing Checklist

### Integration Tests to Run

```bash
# Partner referral service tests
npm run test -- --grep "PartnerReferralService"

# Partner commission service tests
npm run test -- --grep "PartnerCommissionService"

# Partner routes tests
npm run test -- --grep "partners.routes"
```

### Manual Test Scenarios

1. **New Partner Code Generation**
   - Create new partner organization
   - Verify referral_code is auto-generated
   - Verify referral_link_slug is created

2. **Click Tracking Flow**
   - Visit referral link with UTM params
   - Verify click recorded in `partner_referral_clicks`
   - Verify UTM params captured

3. **Attribution Flow**
   - Sign up with partner code
   - Verify attribution created
   - Verify customer appears in partner's "Referred Customers"

4. **Commission Flow**
   - Make payment for attributed organization
   - Verify commission transaction created
   - Verify commission appears in partner dashboard

5. **Payout Flow**
   - Approve commissions as SuperAdmin
   - Request payout as partner
   - Process payout as SuperAdmin
   - Complete payout
   - Verify commissions marked as PAID

## ⚠️ Rollback Plan

If issues occur:

1. Revert frontend deployment
2. Revert backend deployment
3. Do NOT rollback database migration (data loss risk)
4. If DB issues, restore from pre-deployment backup

## 📞 Support Contacts

- Technical Issues: dev-team@consultinity.com
- Partner Questions: partners@consultinity.com
- Billing/Payout Issues: finance@consultinity.com
