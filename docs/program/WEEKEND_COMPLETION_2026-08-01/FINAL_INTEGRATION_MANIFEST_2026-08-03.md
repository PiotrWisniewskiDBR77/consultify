# Final MVP integration manifest — 2026-08-03

This file freezes the reviewed inputs for the controlled integration. A branch
must not be replaced with a newer tip without a new Codex review.

## Integration base

- `integrate/mvp-wave1-abc` content base: `1421ae29dc782e887c890c2a9dfcf850f88b8d42`
- integration branch: `codex/integrate-mvp-final-20260803`

## Whole-branch integration inputs

| Package | Reviewed branch | Frozen HEAD |
| --- | --- | --- |
| Strict fresh-schema repair | `codex/strict-fresh-schema-ordering-repair` | `c58df30c754f36088882b8c8865b9528210f76b3` |
| MAT-10 | `codex/mat10-canonical-artifact-lineage` | `f0b8b3cb3ad1357f2b2f47488556035ea9defc32` |
| FIN-05 | `codex/fin05-canonical-statement-ingestion` | `b6fe0a4a88c671b2e1c8dba8eed2a48a83a64d33` |
| FIN-07 | `codex/fin-007-post-investment-actuals` | `55bedffaf7f44f5fe17b02e3d83439a73c5259f8` |
| MW-07 | `codex/mw07-canonical-calendar-capacity` | `c77cf3e4d9e158ddede170536a9724aaba0cb03d` |
| MW-08 | `codex/mw08-canonical-reconciled` | `65e396cec3c16ceb3b62db175916798692fc02d2` |
| MW-10 | `codex/cto-reconcile-mw10` | `a0185d9a7b80b76ab73042aae01d9ab1cf262f1b` |
| INI-04 + INI-05 | `codex/ini05-canonical-portfolio-resources-roadmap` | `e9c5c1004fef8e1b08395681893001e7b5f67edc` |
| RES-02/03/04/09/10/11 | `codex/res11-canonical-visibility-rollup` | `2ca76a2dde0f3395839fad419b9097028634cf44` |

`INI-04` is not merged separately: its capability matrix was verified
byte-for-byte in the INI-05 tip. The intermediate Results branches are not
merged separately: the RES-11 tip contains their accepted ancestry/convergence.

## Delta-only reconciliation inputs

The following branches are historically behind the integration base and must
not be merged wholesale:

- MW-11 production/test delta: `9b64f283a8`, `ab1d9e85cd`.
- CHAT-07/08/09 delta: `687062b720`, `0cbc82137c`, `c6ad722f76`,
  `7eff1d7159`, `023b818ac6`.

Their accepted deltas must be replayed on the current integration tree without
reintroducing deletions of later MW-07, INI or Results work.

## Migration sequencing decision

- FIN-07 retains `939_fin007_post_investment_actuals.sql`.
- MW-10 retains `940_mw010_vault_document_versions.sql`.
- MW-11 lease migration is renamed during integration from
  `939_ai_agent_plan_execution_lease.sql` to
  `941_ai_agent_plan_execution_lease.sql`, followed by strict fresh/replay and
  lease/fencing verification.

## Safety constraints

- No merge, push or deployment from the dirty primary worktree.
- One integration commit and one scoped gate per package.
- Railway mutations begin only on `dev` after explicit context verification.
- No `demo` or production deployment without a separate post-DEV decision.
