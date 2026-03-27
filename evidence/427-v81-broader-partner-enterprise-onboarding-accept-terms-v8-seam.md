# V8.1 Evidence - Broader Partner Enterprise Onboarding Accept Terms V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After `EnterpriseOnboardingWizard` status restoration moved onto the governed partner V8 seam, the next smallest honest residual was the first active write on that same partner onboarding path.
Step 1 still posted legal acceptance through legacy `/onboarding/accept-terms`, even though the active wizard entry was now partner-specific and already bootstrapped from the governed partner V8 status bridge.

That made `accept-terms` the next thin packet:

- it is the first visible mutation on the active partner onboarding wizard
- it reuses existing legacy semantics instead of inventing new onboarding product scope
- broader `client-access` still remains placeholder-heavy breadth with multiple unavailable endpoints, so it is still heavier than this cut

## What changed

1. Added a governed partner write route in `server/src/routes/v8/partner.routes.ts`:
   - `POST /api/v8/partner/onboarding/accept-terms`
   - upserts `user_onboarding_status` for terms/privacy acceptance
   - keeps the existing legal-document sync behavior as non-blocking continuity

2. Extended `src/services/api/v8/partner.ts`:
   - added `V8PartnerApi.acceptOnboardingTerms()`

3. Rewired `src/components/Onboarding/EnterpriseOnboardingWizard.tsx`:
   - `handleAcceptTerms()` now prefers the partner V8 write seam
   - bounded compatibility failures still fall back to legacy `/onboarding/accept-terms`
   - step advancement stays unchanged on the active wizard surface

## Regression coverage

Passed targeted regressions:

- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/unit/services/v8-partner-api.test.ts`
- `tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx`

Run:

```bash
npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx
```

Result: `38` tests passed.

## Remaining residuals

This packet does not close:

- deeper onboarding wizard write continuity for pricing-tier selection and completion
- broader `client-access` breadth, which still depends on placeholder-only legacy endpoints
- broader statement-source migration
- placeholder-only `payout-settings` save continuity

## Outcome

The first visible mutation inside the active partner onboarding wizard no longer defaults to a legacy-only route during normal operation.
Legal acceptance now follows a governed partner V8-first write seam with bounded compatibility fallback, while heavier onboarding writes and `client-access` breadth remain explicitly outside this packet.
