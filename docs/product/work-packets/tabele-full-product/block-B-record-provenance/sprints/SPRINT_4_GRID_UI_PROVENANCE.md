# Sprint 4 — Grid UI Provenance (Block B)

**Sprint ID:** `B-S4`
**Owner:** Agent B (Tabele)
**Status:** `FRONTEND COMPONENTS COMPLETE — gutter wiring deferred to S5`
**Estimate:** ~1.5 days (actual: ~0.4 day for component layer)
**Epic:** EPIC-T8 + EPIC-T9
**Updated:** 2026-05-08

## Goal

Build `<ConfidenceBar>`, `<ValidationBadge>`, `<SourcePopover>`,
`<AddSourceDialog>` and the composed `<ProvenanceCell>` wrapper bound to
the `/api/table-platform` provenance endpoints. Ship the components
behind a frontend feature flag (`featureRecordProvenanceEnabled`,
default OFF) so they are safe to roll out independently of the backend
flag.

The original spec also called for wiring a row-gutter slot into
`GridView.tsx`. After re-reading the realised B-T5 (rerender perf) and
B-P2 (gutter clutter) risk notes the CTO call is to **defer GridView
gutter wiring to S5** and land the components + tests now. See
"Deferred" section below for the rationale and the S5 plan.

## Pre-sprint risk check (re-evaluated)

- **B-T5 — rerender perf** — landing the gutter implies adding a per-row
  fetched signal (confidence_score / validation_status) into GridView's
  hot path. Without memoisation this re-renders the body on every server
  patch. We defer to S5 where we can land it with `useMemo`/`useRef`
  battery + a dedicated load-test.
- **B-P1 — semantics misread** — addressed in S4. `ConfidenceBar` aria
  label and tooltip explicitly say "AI confidence reflects record
  provenance and validation history — NOT data quality." Component test
  pins this wording.
- **B-P2 — gutter clutter** — addressed by deferring the gutter and
  landing only an opt-in `<ProvenanceCell variant="full">` for the
  detail panel. Compact variant is exported but not yet mounted in the
  grid hot path.
- **B-P3 — z-index** — `<SourcePopover>` and `<AddSourceDialog>` use
  `z-50` parented to the trigger; do not collide with the existing
  `RowDetailPanel` overlay (`z-40`).

## Deliverables — landed

### Created

- `consultify/src/utils/recordProvenanceFlag.ts`
  Frontend kill-switch (`isRecordProvenanceEnabled`) with the standard
  resolution chain (URL → localStorage → `VITE_RECORD_PROVENANCE`),
  default OFF until backend flag rolls out across staging + prod.
- `consultify/src/services/api/recordProvenance.api.ts`
  Thin client around the Block B endpoints (`listRecordSources`,
  `createRecordSource`, `updateRecordSource`, `verifyRecordSource`,
  `deleteRecordSource`, `getValidationStatusTransitions`,
  `setValidationStatus`).
- `consultify/src/components/MyWork/table/provenance/ConfidenceBar.tsx`
- `consultify/src/components/MyWork/table/provenance/ValidationBadge.tsx`
- `consultify/src/components/MyWork/table/provenance/SourcePopover.tsx`
- `consultify/src/components/MyWork/table/provenance/AddSourceDialog.tsx`
- `consultify/src/components/MyWork/table/provenance/ProvenanceCell.tsx`
- `consultify/src/components/MyWork/table/provenance/__tests__/ConfidenceBar.test.tsx`
- `consultify/src/components/MyWork/table/provenance/__tests__/ValidationBadge.test.tsx`
- `consultify/public/locales/en/tabele-provenance.json` (~28 keys)
- `consultify/public/locales/pl/tabele-provenance.json` (~28 keys)

### Untouched (intentionally)

- `consultify/src/components/MyWork/table/GridView.tsx` — gutter wiring
  deferred to S5 (see below).
- `consultify/src/components/MyWork/table/RowDetailPanel.tsx` — host
  mount also deferred to S5 to keep the diff isolated and reviewable.
- All Foundation Block files.

## Tests

- `ConfidenceBar.test.tsx` — 7 tests, all green.
  Covers: not-scored aria/tooltip, percentage rendering, fill width
  scaling and 4% lower bound, color-tier shifts at 0.40/0.65/0.85,
  compact variant hides the percent label, `onClick` wraps in a button,
  aria-label uses the documented "AI confidence" wording (B-P1
  contract).
- `ValidationBadge.test.tsx` — 8 tests, all green.
  Covers: default fallback to `Unverified`, label per status, menu
  visibility gates (allowed = empty → no menu), current state hidden
  from picker, admin-only `*→unverified` policy hide/reveal,
  `onChange` invocation + menu close, read-only mode disables the
  trigger.
- `SourcePopover` and `AddSourceDialog` get their first round of
  coverage in S5 alongside `ProvenanceCell` integration. Component
  surface is small enough to land safely on visual + manual review for
  this sprint.

```
$ npx vitest run src/components/MyWork/table/provenance/__tests__
 ✓ ConfidenceBar.test.tsx (7)
 ✓ ValidationBadge.test.tsx (8)
 Tests  15 passed (15)
```

`npx tsc --noEmit -p tsconfig.json` clean. ESLint clean on all new
files.

## Deferred to Sprint 5 (B-S5)

Tracked as an explicit follow-up (no orphaned scope):

1. **GridView row-gutter slot.** Render `<ProvenanceCell variant="compact">`
   inside the existing checkbox column (`CHECK_COL_PX = 44px`). Implementation
   notes:
   - Row data already lives on `TableNode.data`; backend exposes
     `confidence_score` and `validation_status` on records.
   - Memoize the cell with `React.memo` keyed on `(recordId,
     confidence_score, validation_status)` to eliminate B-T5 rerender
     risk.
   - Update `colSpan` for the virtualization padding rows.
2. **RowDetailPanel host mount.** Land `<ProvenanceCell variant="full">`
   in the `isPlatform` branch as a banner above the tab strip.
3. **Component tests** for `SourcePopover` and `AddSourceDialog` plus
   an integration test for `ProvenanceCell` that mocks
   `recordProvenance.api`.
4. **Visual screenshots for L6.1** (UI/UX review pack).

## Sprint Entry Gate

- [x] S3 closed `GO` (BACKEND COMPLETE 2026-05-08).
- [x] Backend endpoints reachable from staging (validated via routes
      and ACL tests in B-S2/B-S3).

## Sprint Exit Gate

- [x] Frontend `tsc --noEmit` clean.
- [x] Frontend `eslint --fix` clean on all new files.
- [x] Component tests green (15/15).
- [x] DBR77 hex scan clean (no new colors outside the existing palette).
- [x] B-P1 wording contract pinned by `ConfidenceBar` aria-label test.
- [x] Frontend killswitch lands default OFF.
- [ ] Manual visual review of components — pending designer pass.
- [ ] Recommendation: `GO` to S5 once gutter wiring + remaining tests
      land.

## Realised risks / notes

- **Drive-sync race condition.** Same risk as A-S2/A-S3 — the
  `drive-sync-backup` overlay can re-shuffle staged files during commit.
  Mitigation: stage explicitly + verify `git status` post-commit; add
  attribution note if files co-land with an unrelated stream.
- **i18n namespace fan-out.** Block B introduces `tabele-provenance` as
  a third Tabele namespace alongside `translation` and
  `tabele-templates`. S5 to add the namespace to the i18n parity test.
