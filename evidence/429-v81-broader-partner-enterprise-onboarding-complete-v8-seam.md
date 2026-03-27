# V8.1 Evidence - Broader Partner Enterprise Onboarding Complete V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After enterprise onboarding pricing-tier selection moved onto the governed partner V8 seam, the last thin write still active inside the visible partner onboarding wizard was completion itself.
`Skip for Now` still posted completion through legacy `/onboarding/complete`, even though the rest of the active partner onboarding path already used governed partner entry, status restoration, and prior writes.

That made completion continuity the next smallest honest packet:

- it is the last visible write still active on the current partner onboarding wizard path
- it reuses the existing legacy completion preconditions instead of broadening into payment productization
- broader `client-access` still remains placeholder-heavy breadth with multiple unavailable endpoints, so it is still heavier than this cut

## What changed

1. Added a governed partner write route in `server/src/routes/v8/partner.routes.ts`:
   - `POST /api/v8/partner/onboarding/complete`
   - checks the existing onboarding preconditions from `user_onboarding_status`
   - marks onboarding completed and updates the user completion flag on the governed partner seam

2. Extended `src/services/api/v8/partner.ts`:
   - added `V8PartnerApi.completeOnboarding()`

3. Rewired `src/components/Onboarding/EnterpriseOnboardingWizard.tsx`:
   - `handleSkipPayment()` now prefers the partner V8 completion seam
   - bounded compatibility failures still fall back to legacy `/onboarding/complete`
   - the active wizard still navigates to `/app` after completion, unchanged from the user-visible flow

## Regression coverage

Passed targeted regressions:

- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/unit/services/v8-partner-api.test.ts`
- `tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx`

Run:

```bash
npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx
```

Result: `46` tests passed.

## Remaining residuals

This packet does not close:

- broader `client-access` breadth, which still depends on placeholder-only legacy endpoints
- broader statement-source migration
- placeholder-only `payout-settings` save continuity

## Outcome

The last visible write inside the active partner onboarding wizard no longer defaults to a legacy-only route during normal operation.
Enterprise onboarding completion now follows a governed partner V8-first write seam with bounded compatibility fallback, while heavier `client-access` breadth remains explicitly outside this packet.
