# FEEDBACK-1 K-26 — My Work Kanban governed transitions

**Verdict: READY FOR CTO REVIEW.** Independent re-review found P0=0, P1=0, P2=0 after all three initial P1 findings were fixed.

- Base: `be57c5dae677844a224d78d874d3ab52444a882d` (`origin/integracja/20260911`).
- Branch: `codex/feedback-1-k26-kanban-20260917`.
- Scope: W120 FEEDBACK-1 position 6, K-26.
- Freeze marker: `[ODMROZENIE 07_MY_WORK_AGENT DEC-575]`.
- Migrations: none; `blocked_reason`, `blocked_at`, and `blocked_by_decision_id` already exist.
- Screenshots: intentionally absent; the current file-channel rule says nobody creates screenshots.

## Delivered behavior

- Kanban loads the canonical server transition graph and fails closed if it is unavailable.
- A drop outside that graph is reverted without an API write.
- Entering `blocked` opens the canonical `ReasonDialog`; a non-empty reason is required, trimmed, and written with the status and CAS token.
- The personal-task API validates target and source statuses, preserves an unchanged legacy status only as a no-op, and never lends unknown statuses the `todo` graph.
- A stale CAS token returns `409 TASK_VERSION_CONFLICT` before transition validation while the guarded UPDATE retains its CAS predicate against a race after the precheck.
- Entering `blocked` requires a new reason from the request; a stale historical reason cannot be reactivated. `blocked -> blocked` may retain the current reason.
- Leaving `blocked` clears `blocked_reason`, `blocked_at`, and `blocked_by_decision_id` in the same UPDATE.
- Personal-task list/detail/update responses expose `blockedReason`; Task detail persists it.
- EN and PL translations are symmetric and use the existing neutral UI tokens.

## Evidence

- Fresh migrations: `925/925 success` on local PostgreSQL container `cx-codex-k26-pg`, port 6454.
- Real PostgreSQL mounted API: `11/11 PASS`, including invalid transition, required reason, block write/readback, unblock cleanup, CAS, tenant and owner isolation.
- Focused/importer tests: `30/30 PASS` across workflow service, mounted route, Kanban behavior, canonical card, and completed-task readback.
- Final focused re-review set: `29/29 PASS` independently.
- Mutation proof: `5/5 RED` when removing transition guard, fresh block reason requirement, unblock cleanup, CAS precheck, or unknown-source fail-closed parsing; source restored after every mutation.
- Server TypeScript, exact lock `@types/node 22.19.3`: `0 diagnostics`.
- Front TypeScript exact-lock: base/reference `152`, candidate `152`, delta `0`; current line-environment reference from W179/W181 is `169`, and K-26 files contribute `0` diagnostics.
- Per-file esbuild: `TasksKanbanBoard.tsx` and `TaskDetailView.tsx` PASS.
- `check:jezyk:ci`: PASS, debt decreases (`K5en -2`).
- `check:flagi:dockerfile`: PASS (`196` flags, `0` missing).
- `check-list-canon.sh --all`: PASS, `346/346` baseline, no new violations.
- `check-artefakt.sh`: PASS, `8/8` baseline, no new violations.
- `git diff --check`: PASS.
- Independent review after fixes: READY, P0=0, P1=0, P2=0.

## Initial review findings closed

1. A previous blocker reason could have been reactivated on a fresh transition into `blocked`; entry now requires a new body reason and has a regression test.
2. CAS was evaluated after transition validation; the scoped token precheck now returns 409 first, and the UPDATE still guards the race window.
3. Unknown source statuses inherited `todo`; they now fail closed, with a narrow unchanged-legacy no-op for unrelated edits.
4. UI tests now cover unavailable workflow config, a forbidden drop, and an API rejection that keeps the reason dialog open with an actionable error.
