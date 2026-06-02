# Sprint 6 — Demo Recording + Full Validation (Block D)

**Sprint ID:** `D-S6`
**Owner:** Agent D (validation) + Agent C (demo)
**Status:** `EXECUTED — GO_WITH_CONSTRAINTS`
**Estimate:** ~1 day
**Closed (code-side):** 2026-05-08

## Goal

Execute the program's full validation matrix end-to-end and prepare the
operator-facing demo storyboard. Capture a final spec-compliance audit
to feed the D-S7 program closeout.

## Pre-sprint risk check

PR8 (regression across all 4 blocks). Mitigated by running each Block C
+ D unit suite plus the right-rail wiring tests; pre-existing failures
in unrelated services (Records / Metadata / Interface / smoke /
automation) documented as `TBL-FU-D-12` and explicitly out of scope.

## Deliverables shipped today

- `evidence/sprint-6-demo/validation-matrix-run.md` — L1–L8 execution
  log with per-suite test counts and probe verdicts.
- `evidence/sprint-6-demo/demo-storyboard.md` — 5-minute scene-by-scene
  shot list for the recorded demo.
- `evidence/sprint-6-demo/spec-compliance-final.md` — final
  spec-compliance audit (~ 97 %), residual gaps tracked.

## Deliverables deferred to the manual operator window

- `evidence/sprint-6-demo/full-walkthrough.mp4` — the 5-minute demo
  recording. Folded into the next operator window alongside the D-S5
  trial verdict.
- `evidence/sprint-6-demo/run-verdict-2026-MM-DD.md` — written after the
  demo capture.

## Validation execution (summary)

| Layer | Status |
|---|---|
| L1 Static analysis | PASS |
| L2 Unit tests | PASS — 146 / 146 across program surface |
| L3 Integration | PASS |
| L4 Migration replay | PASS |
| L5 Cross-tenant ACL + rate limit | PASS |
| L6 UI / DBR77 / Menu 3 | PASS |
| L7 Audit ledger lifecycle | PASS |
| L8 Provenance / observability | PASS |

Pre-existing failures in unrelated services (12 across 6 files) are
documented in the matrix; tracked as `TBL-FU-D-12` for the platform team.

## Sprint Exit Gate

- [x] Validation matrix executed L1–L8.
- [x] Spec-compliance audit completed at 97 % (≥ 95 % gate).
- [x] Demo storyboard written; ready for operator capture.
- [ ] Demo recording captured — DEFERRED to operator.
- [x] Recommendation: `GO_WITH_CONSTRAINTS` to D-S7.

## Outcome

`GO_WITH_CONSTRAINTS` to D-S7. The constraints carried forward are:

- Manual trial verdict (D-S5).
- Demo recording capture (D-S6).
- Pre-existing test failures in unrelated services (`TBL-FU-D-12`).
- Live LLM provider + live artifact materializer wiring (post-D-S7).

D-S7 may proceed in parallel because the final program closeout
explicitly enumerates these constraints rather than blocking on them.

See `evidence/sprint-6-demo/spec-compliance-final.md`.
