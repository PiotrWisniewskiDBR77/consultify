# EPIC-T15 — Evidence Pack & Anygravity P0 Trial #2

**Block:** D
**Status:** `PLANNED`
**Spec source:** Foundation Block precedent + `ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`.
**Owner agent:** Orchestrator + Agent C (screenshots) + Agent D (demo recording)

---

## Goal

Compile the full manual evidence pack across all 4 blocks (DBR77, Menu 3, Word-canvas idiom, AI Editor flow, QA report flow, conversion flow, intake form flow). Run Anygravity P0 trial #2 against full product surface. Produce the program closeout document `TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_<DATE>.md`.

## Acceptance criteria

- Anygravity P0 trial #2 card filed in `DRD/testy_antygravity/TEST_QUEUE.md` per procedure.
- Trial executed; result PASS recorded.
- DBR77 visual review: screenshot grid covers all new components from Blocks A/B/C/D.
- Menu 3 placement audit: 0 violations across full lane.
- Word-canvas idiom parity: side-by-side with Wordy reference.
- Demo recording: ≤5 min e2e walkthrough showing:
  1. Open Tabele lane.
  2. Pick approved template (Block A).
  3. Generate table.
  4. Open AI Editor; apply cell-level proposal (Block C).
  5. Open QA Report; review suggestions (Block C).
  6. View record provenance (Block B).
  7. Convert table to Wordy (Block D EPIC-T13).
  8. Publish intake form (Block D EPIC-T14).
  9. External user submits (Block D EPIC-T14).
  10. Submission lands with provenance (Block B + D).
- Spec compliance audit: line-by-line vs `Consultify Table Studio` spec sections 1–17; report compliance percentage and residual gaps.
- Program closeout doc filed at `consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_<DATE>.md`.

## In scope

### Evidence
- All screenshots saved to `evidence/sprint-5-anygravity/`, `evidence/sprint-6-demo/`, `evidence/sprint-7-closeout/`.
- All trial cards in `DRD/testy_antygravity/`.
- Final report files.

### Out of scope

- New code (this epic is documentation + evidence only).

## Estimated effort

- S5 (0.5 day): Anygravity P0 trial #2 execution.
- S6 (0.5 day): demo recording.
- S7 (0.5 day): final closeout + spec compliance audit.
