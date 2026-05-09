# Sprint 5 — Anygravity P0 Trial #2 + Screenshot Pack (Block D)

**Sprint ID:** `D-S5`
**Owner:** Orchestrator (trial) + Agent C (screenshots)
**Status:** `EXECUTED — GO_WITH_CONSTRAINTS`
**Estimate:** ~1 day
**Epic:** EPIC-T15
**Closed (code-side):** 2026-05-08

## Goal

Hand off the Tabele Studio program to the Anygravity manual gate. Ship the
trial card, the audit packs (DBR77, Menu 3, Word-canvas parity), and the
operator instructions necessary for a human to record the verdict + capture
screenshots without ambiguity.

## Pre-sprint risk check

- PR3 (trial reveals integration breakage). Mitigated by running every
  automated gate (backend + frontend tests, lint, hex scan, MELS audit)
  before producing the trial card. Code-side gates all green; remaining
  risk is purely visual / UX.

## Deliverables shipped today

- `DRD/testy_antygravity/TEST_QUEUE.md` — queue item `TQ-20260508-001`.
- `evidence/sprint-5-anygravity/anygravity-p0-trial-2.md` — trial scope,
  preflight evidence, run instructions, verdict-resolution rules.
- `evidence/sprint-5-anygravity/dbr77-grid.md` — static hex scan +
  semantic accent map; verdict `PASS`.
- `evidence/sprint-5-anygravity/menu3-audit.md` — right-rail tool
  registry + adversarial probes; verdict `PASS`.
- `evidence/sprint-5-anygravity/word-canvas-parity.md` — code-side
  parity check across MELS lanes; verdict `PASS`.
- `evidence/sprint-5-anygravity/exit-recommendation.md` — formal exit
  recommendation `GO_WITH_CONSTRAINTS`.

## Deliverables deferred to the manual operator window

- `evidence/sprint-5-anygravity/screenshots/` — created on first capture
  by the operator. Reference the screenshot filenames in the trial card
  on the manual run.
- `evidence/sprint-5-anygravity/run-verdict-2026-MM-DD.md` — final
  manual verdict produced by the trial executor.

## CTO decisions applied

- All earlier CTO decisions (Q4, Q9–Q14, Q15, Q16, Q17) are referenced
  by the trial card; no new CTO decision opened in this sprint.
- The CTO formalises that **code-side D-S5 closes today** — the code
  surface is locked and ready. The manual run schedules independently.

## Sprint Exit Gate

- [x] Code-side trial readiness DONE (every preflight gate green).
- [x] Trial card filed in `DRD/testy_antygravity/TEST_QUEUE.md`.
- [x] DBR77 grid, Menu 3 audit, Word-canvas parity files written and
      passing the static checks.
- [x] Exit recommendation: `GO_WITH_CONSTRAINTS` to D-S6.
- [ ] Manual run (Anygravity ops) — DEFERRED.
- [ ] Screenshot pack — DEFERRED (manual run).

## Outcome

`GO_WITH_CONSTRAINTS` to D-S6. The constraints (manual trial verdict,
screenshot pack, localization sweep) are scheduled and tracked; D-S6 may
proceed in parallel because the demo recording does not depend on the
trial verdict landing first.

See `evidence/sprint-5-anygravity/exit-recommendation.md`.
