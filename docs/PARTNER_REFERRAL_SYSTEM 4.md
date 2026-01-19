# Partner Referral System Documentation

## Overview

The Partner Referral System is a comprehensive SaaS-enterprise-grade module for managing partner relationships, referral tracking, commission calculations, and payouts. It supports both individual affiliates and company partners.

## Architecture

### Database Schema

Located in: `server/migrations/216_partner_referral_system.sql`

#### Core Tables

| Table                             | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `partner_organizations`           | Extended with referral codes, payout settings  |
| `partner_payout_accounts`         | Bank/PayPal accounts for receiving commissions |
| `partner_attributions`            | Links customers to referring partners          |
| `partner_commission_transactions` | Individual commission events                   |
| `partner_payouts`                 | Batch payout records                           |
| `partner_referral_clicks`         | Click tracking for analytics                   |
| `partner_campaign_links`          | UTM-tracked campaign links                     |
| `partner_tax_info`                | W-9/W-8BEN tax forms                           |
| `partner_agreement_signatures`    | Signed agreements                              |

### Backend Services

#### PartnerReferralService (`server/src/services/partnerReferralService.ts`)

Handles:

- Referral code generation and validation
- Click tracking and analytics
- Campaign link management
- Attribution creation

Key Functions:

```typescript
validateReferralCode(code: string): Promise<ValidateReferralCodeResult>
getReferralTools(partnerOrgId: string): Promise<PartnerReferralTools>
createCampaignLink(params: CreateCampaignLinkParams): Promise<CampaignLink>
trackClick(params: ReferralClickParams): Promise<{ success: boolean; clickId?: string }>
createAttribution(params: CreateAttributionParams): Promise<Attribution>
getReferralAnalytics(partnerOrgId: string, days: number): Promise<ReferralAnalytics>
```

#### PartnerCommissionService (`server/src/services/partnerCommissionService.ts`)

Handles:

- Commission calculation on payments
- Commission approval workflow
- Payout management
- Earnings reporting

Key Functions:

```typescript
createCommission(params: CreateCommissionParams): Promise<CommissionTransaction>
getCommissions(partnerOrgId: string, options): Promise<CommissionTransaction[]>
approveCommissions(commissionIds: string[], approvedBy: string): Promise<ApproveResult>
requestPayout(params: PayoutRequest): Promise<Payout | null>
getEarningsSummary(partnerOrgId: string): Promise<EarningsSummary>
```

### API Endpoints

#### Partner Portal Endpoints (Authenticated)

| Method | Endpoint                                | Description                    |
| ------ | --------------------------------------- | ------------------------------ |
| GET    | `/api/partners/referral-tools`          | Get partner's codes and links  |
| POST   | `/api/partners/campaign-links`          | Create new campaign link       |
| DELETE | `/api/partners/campaign-links/:linkId`  | Delete campaign link           |
| GET    | `/api/partners/referral-analytics`      | Get click/conversion analytics |
| GET    | `/api/partners/attributions`            | Get referred organizations     |
| GET    | `/api/partners/earnings`                | Get earnings summary           |
| GET    | `/api/partners/commission-transactions` | Get commission history         |
| POST   | `/api/partners/payouts/request`         | Request payout                 |
| GET    | `/api/partners/payouts`                 | Get payout history             |

#### Public Endpoints (No Auth)

| Method | Endpoint                                  | Description           |
| ------ | ----------------------------------------- | --------------------- |
| GET    | `/api/public/partner/validate-code/:code` | Validate partner code |
| POST   | `/api/public/partner/track-click`         | Track referral click  |

#### SuperAdmin Endpoints

| Method | Endpoint                                                  | Description              |
| ------ | --------------------------------------------------------- | ------------------------ |
| GET    | `/api/superadmin/partner-settlements/summary`             | Settlement overview      |
| GET    | `/api/superadmin/partner-settlements/pending-commissions` | List pending commissions |
| POST   | `/api/superadmin/partner-settlements/approve-commissions` | Approve commissions      |
| GET    | `/api/superadmin/partner-settlements/pending-payouts`     | List pending payouts     |
| POST   | `/api/superadmin/partner-settlements/process-payout/:id`  | Mark payout processing   |
| POST   | `/api/superadmin/partner-settlements/complete-payout/:id` | Complete payout          |
| POST   | `/api/superadmin/partner-settlements/fail-payout/:id`     | Fail payout              |

## Frontend Components

### Partner Portal Sections

| Section        | File                                                  | Description          |
| -------------- | ----------------------------------------------------- | -------------------- |
| Referral Tools | `src/views/partner/sections/ReferralToolsSection.tsx` | Code/link management |
| Earnings       | `src/views/partner/sections/EarningsSection.tsx`      | Commission tracking  |

### SuperAdmin

| View                | File                                                      | Description                  |
| ------------------- | --------------------------------------------------------- | ---------------------------- |
| Partner Settlements | `src/views/superadmin/revenue/PartnerSettlementsView.tsx` | Commission/payout management |

## User Flows

### Partner: Generate and Share Referral Link

1. Partner logs in to Partner Portal
2. Navigates to **Referrals** → **My Links & Codes**
3. Views their unique referral code and link
4. Optionally creates campaign links with UTM parameters
5. Copies link and shares via email, social media, etc.

### Partner: Track Referrals and Earnings

1. Partner navigates to **Referrals** → **Click Analytics**
2. Views click counts, signups, and conversions
3. Navigates to **Earnings** → **Commission Earnings**
4. Views pending, approved, and paid commissions
5. Requests payout when threshold is met

### Customer: Sign Up via Partner Link

1. Customer clicks partner referral link
2. System tracks click (IP hash, UTM params, session)
3. Customer completes signup
4. System creates attribution linking customer to partner
5. First payment triggers commission calculation

### Admin: Assign Partner Code Post-Signup

1. Organization admin goes to Settings
2. Enters partner code in "Partner Attribution" field
3. System validates code and creates attribution
4. Future payments generate commissions for partner

### SuperAdmin: Process Payouts

1. SuperAdmin navigates to **Revenue** → **Partner Settlements**
2. Reviews pending commissions
3. Approves valid commissions
4. Reviews payout requests
5. Processes and completes payouts
6. System marks commissions as paid

## Commission Model

### Default Rates by Tier

| Tier     | Commission Rate | Minimum Payout |
| -------- | --------------- | -------------- |
| Bronze   | 10%             | €100           |
| Silver   | 12%             | €100           |
| Gold     | 15%             | €100           |
| Platinum | 20%             | €100           |

### Commission Types

| Type         | Description                          |
| ------------ | ------------------------------------ |
| INITIAL      | First payment from referred customer |
| SUBSCRIPTION | Recurring subscription payment       |
| RENEWAL      | Annual renewal                       |
| UPSELL       | Upgrade to higher plan               |
| REFUND       | Negative commission on refund        |
| BONUS        | Manual bonus award                   |

### Attribution Window

- Default: 30 days from click to signup
- Commission duration: 12 months from first payment (configurable)

## Integration Points

### Stripe Webhook Integration

When a customer payment is processed via Stripe:

1. Webhook handler checks for attribution
2. If attributed, creates commission transaction
3. Commission amount = payment × partner commission rate

```typescript
// In Stripe webhook handler
const attribution = await PartnerReferralService.getAttributionByOrganization(organizationId);
if (attribution && attribution.status === 'ACTIVE') {
  await PartnerCommissionService.createCommission({
    partnerOrgId: attribution.partnerOrgId,
    attributionId: attribution.id,
    organizationId,
    transactionType: 'SUBSCRIPTION',
    grossAmount: payment.amount,
    commissionRate: attribution.commissionRatePercent,
    stripePaymentId: payment.id,
  });
}
```

### Signup Integration

In the registration flow:

1. Check for `partner_code` in request body
2. Validate code using `validateReferralCode`
3. Create attribution after organization creation

```typescript
// In auth.routes.ts register handler
if (partner_code) {
  const validation = await PartnerReferralService.validateReferralCode(partner_code);
  if (validation.valid && validation.partnerOrgId) {
    await PartnerReferralService.createAttribution({
      partnerOrgId: validation.partnerOrgId,
      organizationId: newOrgId,
      attributionType: 'PROMO_CODE',
      referralCodeUsed: partner_code,
      commissionRatePercent: partnerCommissionRate,
    });
  }
}
```

## Security Considerations

1. **IP Hashing**: IP addresses are hashed with SHA-256 before storage
2. **Rate Limiting**: Apply rate limits to public endpoints
3. **Code Validation**: Codes are case-insensitive and normalized
4. **Payout Verification**: Manual review before large payouts
5. **Tax Compliance**: Require tax forms before first payout > €600

## Testing

### Unit Tests

```bash
npm run test:unit -- --grep "PartnerReferral"
npm run test:unit -- --grep "PartnerCommission"
```

### Integration Tests

```bash
npm run test:integration -- --grep "partner"
```

## Deployment Checklist

1. [ ] Run migration `216_partner_referral_system.sql`
2. [ ] Deploy backend services
3. [ ] Configure environment variables
4. [ ] Test partner code validation endpoint
5. [ ] Test click tracking endpoint
6. [ ] Verify SuperAdmin settlements view
7. [ ] Set up Stripe webhook for commission creation
8. [ ] Configure payout method integrations

## Environment Variables

```env
# Partner System
PARTNER_DEFAULT_COMMISSION_RATE=15
PARTNER_ATTRIBUTION_WINDOW_DAYS=30
PARTNER_COMMISSION_DURATION_MONTHS=12
PARTNER_MIN_PAYOUT_THRESHOLD=100

# Payout Integrations (optional)
STRIPE_CONNECT_CLIENT_ID=...
PAYPAL_CLIENT_ID=...
WISE_API_KEY=...
```

## Support

For issues with the Partner Referral System:

1. Check application logs for errors
2. Verify database migrations have run
3. Check API endpoint responses
4. Contact platform support for payout issues
