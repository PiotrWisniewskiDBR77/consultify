# Sprint 5 — AI Editor + QA Frontend (Block C)

**Sprint ID:** `C-S5`
**Owner:** Agent B
**Status:** `PLANNED`
**Estimate:** ~2 days
**Epic:** EPIC-T10 + EPIC-T11

## Goal

Build `TabeleAiEditorPanel` with 8 level cards and `ProposalDiffCard`. Build `TabeleQaPanel` with `QaHealthBar` and `QaSuggestionList`. Wire Menu 3 right-slot in `KimiWorkspaceShell` to open both panels.

## Pre-sprint risk check

C-P1 (8 levels overwhelm), C-P2 (proposed-not-applied confusion), C-P3 (QA scoring opacity).

## Deliverables

- `TabeleAiEditorPanel.tsx` + 8 level cards + diff card.
- `TabeleQaPanel.tsx` + `QaHealthBar` + `QaSuggestionList` + `QaAxisCard`.
- `KimiWorkspaceShell.tsx` Menu 3 right-slot adds 2 buttons (lane=tabele).
- `TabeleView.tsx` right-rail slot exposing panels.
- Component tests for everything.
- ~50 i18n keys.

## Files

### Created
- `consultify/src/components/AIChat/KimiWorkspace/aiEditor/TabeleAiEditorPanel.tsx`
- 8 level card files
- `ProposalDiffCard.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/qa/TabeleQaPanel.tsx`
- `QaHealthBar.tsx`, `QaSuggestionList.tsx`, `QaAxisCard.tsx`
- Component tests under appropriate paths

### Updated
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (Menu 3 right-slot, additive only)
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (right-rail panel slot, additive only)
- `consultify/public/locales/{en,pl}/translation.json`

## Sprint Exit Gate

- [ ] Frontend lint + typecheck clean.
- [ ] DBR77 hex scan clean.
- [ ] Component tests green.
- [ ] Manual review: Menu 3 placement compliant.
- [ ] Recommendation: `GO` to S6.
