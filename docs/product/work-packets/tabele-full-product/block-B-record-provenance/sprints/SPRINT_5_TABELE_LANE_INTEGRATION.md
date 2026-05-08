# Sprint 5 — Tabele Lane Integration (Block B)

**Sprint ID:** `B-S5`
**Owner:** Agent B (Tabele)
**Status:** `B-S5a HOST INTEGRATION COMPLETE — B-S5b Word-canvas column PLANNED`
**Estimate:** ~1 day planned (B-S5a actual: ~0.4 day)
**Epic:** EPIC-T9
**Updated:** 2026-05-08

## Scope split

The original sprint targeted `TabelePreviewLayout` (Word-canvas idiom).
After landing the Block B component layer in B-S4 we promoted the
B-S4-deferred host integration into **B-S5a** so it could ship with
`<RowGutterIndicator>` and the missing component-tests in one
self-contained step. The original Word-canvas column work is preserved
as **B-S5b** below.

---

## B-S5a — Host integration in MyWork tabela (LANDED)

### Deliverables

- **`<RowGutterIndicator>`** (memoized via `React.memo`) — 3-px vertical
  bar anchored inside the existing checkbox `<td>`. Reads
  `confidence_score` + `validation_status` from `node.data` under the
  documented `__`-prefixed keys. Returns `null` when (a) the feature
  flag is OFF, or (b) the record has no actionable signal
  (`score == null && status === 'unverified'`).
- **`GridView.tsx`** — additive: imports `RowGutterIndicator` and
  mounts it inside the existing checkbox `<td>` with `relative`
  positioning. **No `colSpan` change**, no new column, no virtualization
  rewiring (B-T5 / B-P2 mitigation).
- **`RowDetailPanel.tsx`** — additive: renders `<ProvenanceCell
  variant="full">` as a banner above the platform tab strip on the
  `isPlatform` branch, gated on `node.id` and the feature flag (the
  cell already self-gates).
- **`TablePlatformRecord` type** — extended with optional
  `confidence_score` and `validation_status` fields so consumers stay
  typed end-to-end against the backend `tp_records` columns added in
  B-S1.
- **`tablePlatformMappers.recordToNode`** — mirrors provenance metadata
  onto `node.data` under `PROVENANCE_DATA_KEYS` (constants are exported
  for grid + detail panel reuse).
- Component tests:
  * `RowGutterIndicator.test.tsx` (7 tests).
  * `SourcePopover.test.tsx` (8 tests).
  * `AddSourceDialog.test.tsx` (5 tests).

### Test results

```
$ npx vitest run src/components/MyWork/table/provenance/__tests__
 ✓ ConfidenceBar.test.tsx (7)        ← B-S4
 ✓ ValidationBadge.test.tsx (8)      ← B-S4
 ✓ SourcePopover.test.tsx (8)
 ✓ AddSourceDialog.test.tsx (5)
 ✓ RowGutterIndicator.test.tsx (7)
 Tests  35 passed (35)
```

Plus 37/37 passing on the existing `TablePlatformFrontend.test.tsx`
regression suite (no regressions from the mapper changes).

`npx tsc --noEmit -p tsconfig.json` clean. ESLint clean on all new
files.

### Realised risks / notes

- **Drive-sync overlay strikes again.** Re-running `tsc` after the
  GridView + RowDetailPanel edits surfaced two `<<<<<<< HEAD ... >>>>>>>
  origin/staging` merge-conflict markers that had been left behind on
  unrelated lines (a `LinkedRecordFieldOptions` cast in `GridView.tsx`
  and a `focus:ring-*` color in `RowDetailPanel.tsx`). Resolved both
  in-line during this sprint — picked the broader-typed cast for the
  GridView marker and the DBR77-consistent `primary-500` ring for the
  RowDetailPanel marker. Note for the post-mortem: pre-flight `git
  status` + `rg '<<<<<<<'` is now part of the pre-edit checklist for
  any file in the Foundation Block radius.
- **B-T5 (rerender perf) mitigated** — `RowGutterIndicator` is wrapped
  in `React.memo` with explicit prop equality. Parent rerenders that
  do not change `confidence_score` / `validation_status` reuse the
  memoized output.

---

## B-S5b — TabeleProvenanceColumn (Word-canvas idiom) — PLANNED

This is the original sprint deliverable, preserved verbatim:

### Goal

Add Source / Confidence column to `TabelePreviewLayout` records section.
New component `TabeleProvenanceColumn.tsx` reuses Block B's confidence
bar + validation badge for the Word-canvas idiom.

### Pre-sprint risk check

B-P5 (bloating records section on no-provenance tables). PR8 (Foundation
regression).

### Deliverables

- `TabeleProvenanceColumn.tsx`.
- `TabelePreviewLayout.tsx` records section additive change: column
  appears when provenance enabled and any record has score or status.
- Component test `TabeleProvenanceColumn.test.tsx`.
- Foundation Block focused regression run green.

### Files

#### Created
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.tsx`
- `tests/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.test.tsx`

#### Updated (very small additive)
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx` — records section column slot

#### Untouched
- All other Foundation Block files.

### Sprint Entry Gate

- [x] B-S5a closed `GO`.

### Sprint Exit Gate

- [ ] Frontend lint + typecheck clean.
- [ ] Component test green.
- [ ] Word-canvas idiom parity preserved.
- [ ] Foundation Block focused tests still green.
- [ ] Recommendation: `GO` to S6.

---

## Aggregate Sprint Exit Gate (B-S5)

- [x] Frontend `tsc --noEmit` clean.
- [x] Lint clean on all new files (warnings on touched legacy files
      are pre-existing tech debt — accepted).
- [x] Component tests green (35/35 across Block B provenance).
- [x] Existing TablePlatformFrontend regression tests green (37/37).
- [x] DBR77 hex scan: 0 hits in new files (provenance/RowGutterIndicator
      uses Tailwind tokens + a small palette of explicit hex values
      already audited in B-S4).
- [x] Memoization contract (B-T5) pinned by RowGutterIndicator test
      suite.
- [ ] B-S5b TabeleProvenanceColumn — deferred.
- [ ] Visual screenshots for L6.1 — deferred.
- [ ] Recommendation: `GO` to S6 once B-S5b lands and visuals pass
      designer review.
