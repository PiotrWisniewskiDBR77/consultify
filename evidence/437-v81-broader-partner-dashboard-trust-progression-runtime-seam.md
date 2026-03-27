# V8.1 Evidence - Broader Partner Dashboard Trust Progression Runtime Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Packet: eighteenth broader packet

## Why this packet

After the shared dashboard runtime-summary seam landed, the remaining lighter placeholder breadth on the active `PartnerDashboardView` was `TrustProgression`.

This was the next honest cut because:

- `TrustProgressionIndicator` still depended on static `usePartnerEcosystem` phase data
- the repo already had enough governed partner seams to derive a bounded milestone read-model without inventing partner deal-pipeline truth
- `CommissionIntelligence` still depends on placeholder `deals`, so it remained the heavier residual

## What changed

1. Added shared trust runtime loader in `src/components/Partner/partnerTrustRuntime.ts`:
   - reads partner connection from `/api/partners/connection`
   - reads onboarding status V8-first with bounded fallback to `/onboarding/status`
   - reads client count V8-first with bounded fallback to `/api/partners/clients`
   - reuses the shared governed runtime-summary seam for referral and earnings activity
   - derives a bounded trust-phase snapshot from real connection, onboarding, activation, and referral signals

2. Updated trust phase state handling:
   - added explicit `completed?: boolean` support on `PartnerTrustProgression`
   - updated `TrustProgressionIndicator` to honor real completion flags instead of requiring synthetic timestamps

3. Rewired `src/views/partner/PartnerDashboardView.tsx`:
   - removed dashboard trust progression dependence on `usePartnerEcosystem`
   - now loads runtime summary and trust snapshot independently
   - preserves the previously landed runtime-summary seam even if trust snapshot loading fails

## Regression coverage

- `tests/unit/services/partner-trust-runtime.test.ts`
  - onboarding phase stays in `G3` until real activation signals appear
  - ecosystem phase only appears when real referral activity exists
  - trust snapshot loader uses governed seams with bounded fallback
- `tests/components/partner/PartnerDashboardView.runtime-summary.test.tsx`
  - active dashboard now calls both governed runtime loaders and still renders the governed summary block

## Verification

Executed:

```bash
npx vitest run tests/unit/services/partner-trust-runtime.test.ts tests/components/partner/PartnerDashboardView.runtime-summary.test.tsx
```

Result:

- 4 tests passed

## Remaining residuals after this packet

- `CommissionIntelligence` still depends on placeholder `deals` and has no governed partner-authenticated deal-pipeline runtime contract yet
- partner `payout-settings` save ownership remains unresolved and still requires an explicit partner-scoped write contract

## Outcome

The active partner dashboard no longer depends on placeholder hook data for trust progression.
Its compact trust indicator now comes from a bounded governed runtime snapshot built from existing partner connection, onboarding, client, referral, and earnings seams, while `CommissionIntelligence` and partner `payout-settings` ownership remain explicit residuals.
