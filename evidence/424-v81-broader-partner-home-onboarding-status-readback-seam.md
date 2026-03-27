# V8.1 Evidence - Broader Partner Home Onboarding Status Readback Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After the referred-customer lifecycle readback packet, the next honest partner residual was not the entire `client-access` breadth.
`ClientAccessView` still fans out into three placeholder-only legacy endpoints (`/api/partners/clients`, `/api/partners/employees`, `/api/partners/access-links`), so that surface remains broader feature-unavailable breadth rather than a thin seam.

The smaller active gap was the connected `partner-home` onboarding panel:

- the visible checklist in `ProviderHomeView` was still static (`completed: i === 0`)
- the real onboarding contract already existed at `/api/onboarding/status`
- the active partner portal therefore showed guessed onboarding progress instead of real runtime truth

That made `partner-home onboarding status readback` the next smallest honest packet.

## What changed

1. Added a governed V8 bridge at `GET /api/v8/partner/onboarding-status` in `server/src/routes/v8/partner.routes.ts`.
   - keeps the same partner-org gate as the rest of the partner runtime bridge
   - reads the current user's onboarding row from `user_onboarding_status`
   - returns a normalized V8 payload (`termsAccepted`, `privacyAccepted`, `pricingTier`, `paymentSetup`, `completed`) plus standard partner meta

2. Added `V8PartnerApi.getOnboardingStatus()` and exported `V8PartnerOnboardingStatus` from the shared V8 client layer in:
   - `src/services/api/v8/partner.ts`
   - `src/services/api/v8/index.ts`

3. Rewired `src/views/partner/ProviderHomeView.tsx` onboarding progress to use the governed status.
   - `ProviderHomeView` now loads onboarding progress from `V8PartnerApi.getOnboardingStatus()`
   - bounded compatibility fallback still uses legacy `/onboarding/status`
   - the checklist now reflects real onboarding milestones instead of a hard-coded first-step-complete placeholder
   - incomplete steps send the user to `/setup/onboarding`

## Regression coverage

Passed targeted regressions:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx`

Run:

```bash
npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx
```

Result: `34` tests passed.

## Remaining residuals

This packet does not close:

- deeper onboarding write / wizard continuity beyond status readback
- broader `client-access` breadth, which still depends on placeholder-only legacy endpoints
- broader statement-source migration
- placeholder-only `payout-settings` save continuity

## Outcome

The active partner portal no longer guesses onboarding progress on `partner-home`.
Visible onboarding progress now comes from a governed V8-first seam with bounded fallback, while the heavier onboarding and client-access breadth stays explicitly outside this packet.
