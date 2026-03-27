# V8.1 Evidence - Broader Partner Home Onboarding CTA Authority Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After `partner-home onboarding status readback` landed, the connected partner home finally showed real onboarding progress.
But the active checklist CTA still sent every incomplete partner step to `/setup/onboarding`, and that route renders the older global `OnboardingWizard` first-value flow rather than the enterprise onboarding flow that matches the visible partner checklist (`terms`, `pricing`, `payment`, `complete`).

That made the next smallest honest residual a CTA-authority seam on the same active surface:

- the checklist copy and status now clearly describe the enterprise onboarding contract
- the existing target route still pointed at a different wizard
- `client-access` remained broader feature-unavailable breadth with multiple placeholder endpoints, so it was still heavier than this cut

## What changed

1. Added a dedicated partner onboarding route in `src/routes/routeConfig.ts`:
   - `ROUTES.PARTNER.ONBOARDING = '/partner/onboarding'`

2. Mounted a partner-specific entry route in `src/routes/AppRoutes.tsx`:
   - `GET /partner/onboarding` now renders the existing `EnterpriseOnboardingWizard`
   - the older global `/setup/onboarding` route still points to `OnboardingWizard`
   - this keeps partner onboarding authority separate from the global first-value wizard instead of silently repurposing the shared route

3. Rewired `src/views/partner/ProviderHomeView.tsx`:
   - incomplete onboarding checklist steps now navigate to `ROUTES.PARTNER.ONBOARDING`
   - the active `partner-home` surface now sends the operator to the workflow that matches the checklist semantics already shown on that screen

## Regression coverage

Passed targeted regressions:

- `tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx`
- `tests/components/partner/ProviderHomeView.cta-authority.test.tsx`
- `tests/unit/routes/routeConfig.test.ts`

Run:

```bash
npx vitest run tests/components/partner/ProviderHomeView.v8-onboarding-status.test.tsx tests/components/partner/ProviderHomeView.cta-authority.test.tsx tests/unit/routes/routeConfig.test.ts
```

Result: `13` tests passed.

## Remaining residuals

This packet does not close:

- deeper onboarding wizard runtime continuity inside `EnterpriseOnboardingWizard`
- broader `client-access` breadth, which still depends on placeholder-only legacy endpoints
- broader statement-source migration
- placeholder-only `payout-settings` save continuity

## Outcome

The active partner-home checklist no longer routes operators into the wrong onboarding wizard.
Visible partner onboarding CTA authority now points at a partner-specific enterprise onboarding entry while the heavier onboarding and `client-access` breadth remains explicitly outside this packet.
