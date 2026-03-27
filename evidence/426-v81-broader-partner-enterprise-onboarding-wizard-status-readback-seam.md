# V8.1 Evidence - Broader Partner Enterprise Onboarding Wizard Status Readback Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After `partner-home onboarding CTA authority` landed, the active partner checklist finally pointed at the correct enterprise onboarding route.
But the newly active `EnterpriseOnboardingWizard` still bootstrapped itself from legacy `/onboarding/status`, even though a governed partner V8 onboarding-status seam already existed from the previous packet.

That made the next smallest honest residual a deeper onboarding-wizard readback seam on the same active path:

- the live partner entry now opens `EnterpriseOnboardingWizard`, so its initial step resolution is operator-visible
- the V8 route/client seam already existed, which kept this cut thin and bounded
- broader `client-access` still remained placeholder-heavy breadth with multiple unavailable endpoints, so it was still heavier than this packet

## What changed

1. Rewired `src/components/Onboarding/EnterpriseOnboardingWizard.tsx`:
   - onboarding bootstrap now prefers `V8PartnerApi.getOnboardingStatus()`
   - compatibility-only failures still fall back to legacy `/onboarding/status`
   - V8 and legacy payloads are normalized into the same step-resolution contract before the wizard resumes on pricing, payment, or completion

2. Added focused component regression coverage in `tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx`:
   - verifies the enterprise onboarding wizard prefers the governed partner V8 status seam
   - verifies bounded fallback to legacy status on compatible failures

## Regression coverage

Passed targeted regressions:

- `tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx`
- `tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx`
- `tests/components/partner/ProviderHomeView.cta-authority.test.tsx`
- `tests/unit/services/v8-partner-api.test.ts`

Run:

```bash
npx vitest run tests/components/partner/EnterpriseOnboardingWizard.v8-status.test.tsx tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx tests/components/partner/ProviderHomeView.cta-authority.test.tsx tests/unit/services/v8-partner-api.test.ts
```

Result: `20` tests passed.

## Remaining residuals

This packet does not close:

- deeper onboarding wizard write continuity inside `EnterpriseOnboardingWizard`
- broader `client-access` breadth, which still depends on placeholder-only legacy endpoints
- broader statement-source migration
- placeholder-only `payout-settings` save continuity

## Outcome

The active partner onboarding entry no longer decides its starting step from a legacy-only status read during normal operation.
Visible enterprise onboarding step restoration now follows the governed partner V8 seam first, while heavier onboarding writes and `client-access` breadth remain explicitly outside this packet.
