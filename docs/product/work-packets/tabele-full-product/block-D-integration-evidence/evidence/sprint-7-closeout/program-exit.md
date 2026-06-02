# D-S7 — Program Exit Evidence

**Sprint:** D-S7 · 2026-05-08
**Verdict:** Program exits with `RESIDUAL_FOLLOW_UPS`. Ship the surface
dark by default; run the manual Anygravity P0 trial #2 and capture the
5-minute demo in the next operator window.

## What this card consolidates

D-S7 is the program closeout sprint. It produces:

1. The Block D `03_BLOCK_CLOSEOUT.md` (filled).
2. The program closeout document
   `consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`
   (filed).
3. The follow-up roadmap (carried into the program closeout § 9).
4. This evidence card pointing back to all of the above.

## Files filed today

| File | Purpose |
|---|---|
| `block-D-integration-evidence/03_BLOCK_CLOSEOUT.md` | Block D closeout — `DONE_WITH_CONSTRAINTS`. |
| `consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md` | Program-level closeout aggregating Blocks A + B + C + D. |
| `block-D-integration-evidence/evidence/sprint-7-closeout/program-exit.md` (this file) | Evidence card linking the sprint deliverables. |

## Cross-block closeout pointers

- Block A: `block-A-template-catalog/03_BLOCK_CLOSEOUT.md` —
  `DONE_WITH_CONSTRAINTS` at A-S7 on 2026-05-08.
- Block B: `block-B-record-provenance/03_BLOCK_CLOSEOUT.md` —
  `DONE_WITH_CONSTRAINTS` at B-S7 on 2026-05-08.
- Block C: `block-C-ai-operator/03_BLOCK_CLOSEOUT.md` —
  `DONE_WITH_CONSTRAINTS` at C-S7 on 2026-05-08.
- Block D: `block-D-integration-evidence/03_BLOCK_CLOSEOUT.md` —
  `DONE_WITH_CONSTRAINTS` at D-S7 on 2026-05-08.

## Sprint Entry Gate (verified)

- [x] D-S6 closed `GO_WITH_CONSTRAINTS`.
- [x] All evidence files staged across `evidence/sprint-{0..6,5-anygravity,6-demo}`.

## Sprint Exit Gate (verified)

- [x] Block D closeout filled and signed.
- [x] Program closeout doc filed at
      `consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`.
- [x] All 4 block closeouts cross-referenced from the program doc.
- [x] Spec compliance audit attached
      (`evidence/sprint-6-demo/spec-compliance-final.md`).
- [x] Anygravity P0 trial #1 attached (Block A evidence) + trial #2
      readiness pack attached
      (`evidence/sprint-5-anygravity/anygravity-p0-trial-2.md`).
- [ ] Demo recording attached — DEFERRED (storyboard ready).
- [x] Follow-ups filed — see program closeout § 9.

## Program Exit

- **Status:** `RESIDUAL_FOLLOW_UPS`.
- **Recommendation:** Ship Tabele Studio to staging now, dark by
  default. Schedule the Anygravity P0 trial #2 + demo recording in the
  next operator window. Treat each kill-switch flip as a per-workspace
  opt-in until the trial verdict returns `PASS`. Hand the live LLM
  provider + live artifact materializer wiring to the Block C and D
  ops follow-up sprints.

## Sign-off

- CTO: Cursor agent (Claude Opus 4.7 acting under user delegation).
- Date: 2026-05-08.
