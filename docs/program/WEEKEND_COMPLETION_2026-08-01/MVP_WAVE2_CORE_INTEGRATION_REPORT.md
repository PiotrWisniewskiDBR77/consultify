# MVP Wave 2 — core integration report

Date: 2026-08-02
Integration branch: `codex/integrate-mvp-wave2-core`
Starting point: `integrate/mvp-wave1-abc` (`d62afe2dbc`)

## Outcome

The accepted Assessment, Decision/My Work, Initiative, Execution, Results and
Tools changes listed below are combined on one isolated integration branch.
No demo/prod deployment was performed and the pre-existing dirty primary
worktree was not modified.

Integrated source branches:

- `codex/sync-demo-20260729`
- `codex/ini-candidate-closure`
- `feat/asm-005-007-quality-output`
- `feat/asm-008-candidate-pack-handoff`
- `feat/mw-005-006-decision-create-live`
- `feat/exe-002-004-management-spine`
- `feat/exe-005-006-change-progress-spine`
- `codex/res-canonical-route-proof`
- `codex/tls-swot-conclusion-fix`

## Integration fixes

- Retained both Results recovery helpers and the Tools deviation audit helper
  while resolving the shared Results-router conflict.
- Corrected the generic row constraint used by pinned PostgreSQL transactions.
- Made the in-scope Assessment, Execution and Results migrations independently
  replay-safe on the current fresh-Postgres baseline.
- Restored the minimum canonical `projects` / `initiatives` schema contract
  required by Decision → Initiative → Execution, including the lifecycle
  status constraint.

## Verification evidence

All commands below ran on the combined integration tree.

| Gate | Result |
|---|---:|
| Full TypeScript check (`npm run type-check`) | PASS |
| Focused unit/component regression | 169/169 PASS |
| Decision → Initiative → Execution real-Postgres matrix | 39/39 PASS |
| Execution management/change/progress real-Postgres matrix | 23/23 PASS |
| Results recovery/deviation + Decision workspace real-Postgres matrix | 27/27 PASS |
| Assessment ASM-005/007 golden flow | 16/16 PASS |
| Assessment ASM-005/007 negative controls | 14/14 PASS |
| Assessment ASM-008 golden flow | 10/10 PASS |
| Assessment ASM-008 negative controls | 6/6 PASS |
| In-scope migration second replay | PASS |
| `git diff --check` | PASS |

Real-database tests used the dedicated local database `wave2_integration` on
port 5442. They exercised persistence, tenant isolation, idempotent retry,
concurrent writes and transactional rollback; they were not mock-only passes.

## Honest boundary / remaining promotion gate

This report proves the combined core wave, not the repository's complete
deployment migration chain. The global fresh-schema loader still has broad,
pre-existing migration debt outside this wave (many historical migrations are
not replay-safe, and optional legacy tables such as `audit_events` and
`initiative_gate_roles` are absent in the audit database). In-scope runtime
tests pass, but promotion must remain blocked until the canonical environment's
full migration run is validated separately.

Therefore this branch is ready for review and controlled integration into the
canonical baseline, but this report does **not** grant `CODE_GO`, deployment or
production readiness.
