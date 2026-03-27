# V8.1 Evidence - Broader Partner Enterprise Onboarding Select Tier V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After enterprise onboarding legal acceptance moved onto the governed partner V8 seam, the next smallest honest residual was the next visible write on that same wizard path.
Step 2 still posted pricing-tier selection through legacy `/onboarding/select-tier`, even though the active partner onboarding path already used governed partner V8 routing for entry, status restoration, and the first write.

That made pricing-tier selection the next thin packet:

- it is the next active mutation after legal acceptance on the same visible wizard
- it reuses the existing legacy tier contract instead of broadening into billing or completion scope
- broader `client-access` still remains placeholder-heavy breadth with multiple unavailable endpoints, so it is still heavier than this cut

## What changed

1. Added a governed partner write route in `server/src/routes/v8/partner.routes.ts`:
   - `POST /api/v8/partner/onboarding/select-tier`
   - validates the requested tier against the existing `starter` / `professional` / `enterprise` contract
   - upserts `user_onboarding_status.pricing_tier` on the active partner onboarding seam

2. Extended `src/services/api/v8/partner.ts`:
   - added `V8PartnerApi.selectOnboardingTier()`

3. Rewired `src/components/Onboarding/EnterpriseOnboardingWizard.tsx`:
   - `handleSelectTier()` now prefers the partner V8 write seam
   - bounded compatibility failures still fall back to legacy `/onboarding/select-tier`
   - step advancement from pricing to payment stays unchanged on the active wizard surface

## Regression coverage

Passed targeted regressions:

- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/unit/services/v8-partner-api.test.ts`
- `tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx`

Run:

```bash
npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx
```

Result: `42` tests passed.

## Remaining residuals

This packet does not close:

- deeper onboarding wizard completion continuity
- broader `client-access` breadth, which still depends on placeholder-only legacy endpoints
- broader statement-source migration
- placeholder-only `payout-settings` save continuity

## Outcome

The second visible mutation inside the active partner onboarding wizard no longer defaults to a legacy-only route during normal operation.
Pricing-tier selection now follows a governed partner V8-first write seam with bounded compatibility fallback, while heavier completion and `client-access` breadth remain explicitly outside this packet.
