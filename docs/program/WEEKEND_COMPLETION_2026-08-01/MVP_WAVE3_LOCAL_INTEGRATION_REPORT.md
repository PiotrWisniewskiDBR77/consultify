# MVP Wave 3 — local integration report

Date: 2026-08-02

Canonical integration branch: `integrate/mvp-wave1-abc`

## Accepted and integrated

### EXE-08 — Closure / evidence gate

- Integrated source: `feat/exe-008-closure-evidence-gate`.
- Canonical flow: draft → evidence → submit → return/resubmit → approve → DONE.
- Negative controls cover missing evidence, missing role, foreign tenant,
  stale initiative version, idempotent retry, concurrent approval and legacy
  completion bypass.
- Combined Execution real-Postgres regression: 32/32 PASS.
- Closure component + real-Postgres focused run: 17/17 PASS.
- Full TypeScript check: PASS.
- The active migration was corrected to replay cleanly on PostgreSQL and to
  tolerate a fresh baseline where the optional section registry is absent.

### INT-08 — Interview accepted output → canonical Candidate

- Integrated source: `feat/int-008-canonical-candidate-handoff`.
- Both accepted Interview submission and accepted insight-finding use the
  shared `initiative_candidates` writer with distinct source lineage.
- Real-Postgres golden and negative matrix: 12/12 PASS.
- Shared Candidate writer regression: 38/38 PASS.
- Full TypeScript check: PASS.
- Integration reconciled the already-canonical pinned transaction helper and
  added the missing fresh-schema `interview_questions.is_required` contract.

## Current boundary

These two items are locally accepted and present on the canonical integration
branch. They are not deployed to Railway and do not constitute production
`CODE_GO`. `TLS-04` and `FIN-05` remain under active independent work/review and
were deliberately not merged into this wave.
