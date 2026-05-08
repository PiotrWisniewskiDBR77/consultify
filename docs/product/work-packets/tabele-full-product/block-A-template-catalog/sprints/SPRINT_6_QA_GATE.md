# Sprint 6 — QA Gate (Block A)

**Sprint ID:** `A-S6`
**Owner:** Agent D
**Status:** `PLANNED`
**Estimate:** ~1 day

## Goal

Execute the entire `01_VALIDATION_MATRIX.md` end-to-end. Capture evidence per layer. Decide block exit recommendation.

## Pre-sprint risk check

PR8 (Foundation regression). PR1 (merge conflicts with B). Run all 8 layers.

## Deliverables

- Full execution log saved to `evidence/sprint-6/validation-matrix-run.md`.
- Cross-tenant ACL audit log file.
- DBR77 visual review screenshots.
- Anygravity P0 trial #1 result re-confirmed.
- E2E smoke green.
- **EPIC-T16 D8:** Side-by-side screenshots — Tabele view vs. reference deck-builder screens — annotated with shape deviation ≤ 10 %. Saved to `evidence/sprint-6/mels-visual-review/`.
- **EPIC-T16 D9:** DBR77 hex scan report on `ExecutiveModuleShell` + `TabeleLeftRail` + `TabeleRightRail` + `TabeleTopBarChips`: 0 raw hex literals.

## Validation execution

| Layer | Status |
|---|---|
| L1 Static / Lint / Type | ___ |
| L2 Unit | ___ |
| L3 Component | ___ |
| L4 Integration | ___ |
| L5 E2E smoke | ___ |
| L6 Manual / Anygravity | ___ |
| L7 Security / tenant | ___ |
| L8 Performance | ___ |

## Files

### Created
- `evidence/sprint-6/validation-matrix-run.md`
- `evidence/sprint-6/anygravity-p0-trial-1-final.md`
- `evidence/sprint-6/screenshots/` folder

### Updated
- None.

## Sprint Entry Gate

- [ ] S5 closed `GO`.

## Sprint Exit Gate

- [ ] All 8 layers executed.
- [ ] Failures documented with severity + owner.
- [ ] Cross-tenant audit clean.
- [ ] **EPIC-T16:** MELS § 6 acceptance checklist green (top bar, left rail, canvas, right rail, persistence, shortcuts, no-Menu-2, hex scan).
- [ ] **EPIC-T16:** UX reviewer signs off the visual diff vs. reference deck-builder screens.
- [ ] Recommendation: `GO` / `GO_WITH_CONSTRAINTS` / `NO_GO` to S7.

## Realized risks

(filled at exit)

## Daily evidence

(filled per day)
