# Sprint 4 — Form Intake Frontend (Block D)

**Sprint ID:** `D-S4`
**Owner:** Agent B
**Status:** `PLANNED`
**Estimate:** ~1.5 days
**Epic:** EPIC-T14

## Goal

Ship `CreateIntakeFormDialog`, `IntakeFormPreview`, `PublicIntakeForm` (separate route bundle for `/public/forms/:token`). Wire "Create intake form" button into `TabeleView`.

## Pre-sprint risk check

D-P3 (unbranded form), D-P4 (allow-list UX), D-S5 (XSS on rendered submissions).

## Deliverables

- `CreateIntakeFormDialog.tsx` with field allow-list builder.
- `IntakeFormPreview.tsx`.
- `PublicIntakeForm.tsx`.
- Route added in `AppRoutes.tsx`.
- Component tests.
- ~25 i18n keys.

## Files

### Created
- `consultify/src/components/AIChat/KimiWorkspace/formIntake/CreateIntakeFormDialog.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/formIntake/IntakeFormPreview.tsx`
- `consultify/src/components/PublicIntakeForm/PublicIntakeForm.tsx`
- Tests.

### Updated
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (additive launcher)
- `consultify/src/AppRoutes.tsx` (add `/public/forms/:token` route)
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (add "Create intake form" button)
- `consultify/public/locales/{en,pl}/translation.json`

## Sprint Exit Gate

- [ ] Frontend lint + typecheck clean.
- [ ] DBR77 hex scan clean.
- [ ] Component tests green.
- [ ] Manual review: public form respects DBR77 + branding.
- [ ] XSS audit clean.
- [ ] Recommendation: `GO` to S5.
