# Sprint 5 — Tabele Lane Integration (Block B)

**Sprint ID:** `B-S5`
**Owner:** Agent C
**Status:** `PLANNED`
**Estimate:** ~1 day
**Epic:** EPIC-T9

## Goal

Add Source / Confidence column to `TabelePreviewLayout` records section. New component `TabeleProvenanceColumn.tsx` reuses Block B's confidence bar + validation badge for the Word-canvas idiom.

## Pre-sprint risk check

B-P5 (bloating records section on no-provenance tables). PR8 (Foundation regression).

## Deliverables

- `TabeleProvenanceColumn.tsx`.
- `TabelePreviewLayout.tsx` records section additive change: column appears when `provenance enabled` and any record has score or status.
- Component test `TabeleProvenanceColumn.test.tsx`.
- Foundation Block focused regression run green.

## Files

### Created
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.tsx`
- `tests/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.test.tsx`

### Updated (very small additive)
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx` — records section column slot

### Untouched
- All other Foundation Block files.

## Sprint Entry Gate

- [ ] S4 closed `GO`.

## Sprint Exit Gate

- [ ] Frontend lint + typecheck clean.
- [ ] Component test green.
- [ ] Word-canvas idiom parity preserved.
- [ ] Foundation Block focused tests still green.
- [ ] Recommendation: `GO` to S6.
