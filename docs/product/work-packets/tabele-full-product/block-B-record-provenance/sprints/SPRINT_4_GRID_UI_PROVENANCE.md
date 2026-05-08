# Sprint 4 — Grid UI Provenance (Block B)

**Sprint ID:** `B-S4`
**Owner:** Agent B
**Status:** `PLANNED`
**Estimate:** ~1.5 days
**Epic:** EPIC-T8 + EPIC-T9

## Goal

Build `<ConfidenceBar>`, `<ValidationBadge>`, `<SourcePopover>`, `<AddSourceDialog>`. Wire into `GridView` row gutter behind `featureRecordProvenanceEnabled` flag.

## Pre-sprint risk check

B-T5 (rerender perf), B-P1 (semantics misread), B-P2 (gutter clutter), B-P3 (z-index).

## Deliverables

- 4 new components.
- `GridView.tsx` row-gutter render slot.
- Component tests.
- Visual screenshots for L6.1.

## Files

### Created
- `consultify/src/components/MyWork/table/provenance/SourcePopover.tsx`
- `consultify/src/components/MyWork/table/provenance/ConfidenceBar.tsx`
- `consultify/src/components/MyWork/table/provenance/ValidationBadge.tsx`
- `consultify/src/components/MyWork/table/provenance/AddSourceDialog.tsx`
- `tests/components/MyWork/table/provenance/SourcePopover.test.tsx`
- `tests/components/MyWork/table/provenance/ConfidenceBar.test.tsx`
- `tests/components/MyWork/table/provenance/ValidationBadge.test.tsx`
- `tests/components/MyWork/table/provenance/AddSourceDialog.test.tsx`

### Updated
- `consultify/src/components/MyWork/table/GridView.tsx` (row-gutter slot only)
- `consultify/public/locales/{en,pl}/translation.json` (~30 keys)

### Untouched
- All Foundation Block files (this sprint touches GridView, not Tabele lane).

## Sprint Entry Gate

- [ ] S3 closed `GO`.
- [ ] Backend endpoints reachable from staging.

## Sprint Exit Gate

- [ ] Frontend lint + typecheck clean.
- [ ] Component tests green.
- [ ] DBR77 hex scan clean.
- [ ] Manual review: gutter doesn't break dense tables.
- [ ] Recommendation: `GO` to S5.
