# Sprint 3 — Tabele Lane Conversion Buttons (Block D)

**Sprint ID:** `D-S3`
**Owner:** Agent B
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T13

## Goal

Add `TabeleConvertButton` and `ConversionToast` to Menu 3 right-slot of `KimiWorkspaceShell` (lane=tabele). Wire dropdown for "Convert to Document" / "Convert to Presentation". Open async conversion → result lane on completion.

## Pre-sprint risk check

D-P1 (button confusion), D-P2 (citation rendering).

## Deliverables

- `TabeleConvertButton.tsx`.
- `ConversionToast.tsx`.
- `KimiWorkspaceShell.tsx` Menu 3 right-slot updated (lane=tabele only; additive).
- Component tests.
- ~10 i18n keys.

## Files

### Created
- `consultify/src/components/AIChat/KimiWorkspace/conversion/TabeleConvertButton.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/conversion/ConversionToast.tsx`
- Tests.

### Updated
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (additive: lane=tabele branch)
- `consultify/public/locales/{en,pl}/translation.json`

## Sprint Exit Gate

- [ ] Frontend lint + typecheck clean.
- [ ] DBR77 hex scan clean.
- [ ] Component tests green.
- [ ] Manual review: Menu 3 placement compliant.
- [ ] Recommendation: `GO` to S4.
