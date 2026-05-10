---
module_id: MODULE_EXECUTION
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Realizacja / Implementation & PMO

## 1. Main Screen

As-Is: the execution lane uses `FullExecutionView`, `ExecutionHub` and `FullRolloutView` under one sidebar module. `ExecutionHub` provides ModuleHub-style kanban/timeline/report/manager controls, table+preview, drag-and-drop task handling and execution signal components.

## 2. Runtime States

- Loading: task, rollout, report and signal loads must show explicit state flags or loaders.
- Empty: empty boards/tables/reports must say whether no execution work exists, no filter matches or data is unavailable.
- Error: guarded components/callouts and toast feedback must surface failures.
- Degraded: fallback service logic, disabled non-core modules or partial execution data must be visible as degraded, not success.
- Success: task moves, status updates or report generation must confirm the result and identify the next blocker/review/follow-up.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps the execution module shell. Menu 3 is the active execution command row/filter/action zone for selected view, row, task or rollout context. Row actions may exist when scoped to one record.

## 4. AI Actions Placement

AI/chat contextual openers must be invoked through explicit Menu 3/right-side or row-scoped actions. No route wrapper may add a duplicate secondary AI toolbar under the canvas.

## 5. Next Action Guidance

Execution UX must tell the user whether to assign/advance a task, resolve a blocker, review a signal, retry failed data, open a rollout view or wait for gated access.

## 6. Source / Evidence / Provenance

Execution reports, blockers and signals must expose source tasks, initiatives, owners or data inputs. Generated summaries must identify evidence or disclose missing/partial evidence.

## 7. Approval / Diff / Review

Execution mutations are explicit authenticated actions. High-impact status changes, rollout decisions and generated report finalization require review/approval and must leave visible feedback/audit where supported.

## 8. Anti-Patterns

- Drag/drop or status mutation without visible confirmation.
- Fallback/degraded data presented as current truth.
- AI execution action duplicated in canvas and Menu 3.
- Hidden production gate or role denial.
- Report without source tasks/signals.

## 9. As-Is Gaps

- Existing docs confirm protected/gated wrappers and fallback states, but do not enumerate all task mutation review/diff patterns.
- Provenance rendering for each execution report/signal path needs runtime validation.

## 10. Acceptance Criteria

- Execution routes render the documented execution/rollout hub surfaces.
- Loading, empty, error, degraded and success states are explicit.
- AI/chat actions use Menu 3/right-side or row-scoped placement without duplication.
- Reports/signals show source/provenance.
- High-impact execution mutations require explicit review/approval.

## 11. Function Annex — Execution Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | Execution Portfolio Operations | `/implementation` (hub tab `list`) | real | `ExecutionHub` list modes (table/kanban/timeline) | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL_EXECUTION_REPORTS` | Execution Reports | `ExecutionHub` tab `reports` | real | report catalog/report preview controls in `ExecutionHub` | `functions/RL_EXECUTION_REPORTS.md` |
| `RL_EXECUTION_MANAGER` | Manager Lane | `ExecutionHub` tab `people_change` | real | manager metrics/suggestions views in `ExecutionHub` | `functions/RL_EXECUTION_MANAGER.md` |
| `RL_FULL_EXECUTION_VIEW` | Full Execution Route | `/execution` | real | `FullExecutionView` | `functions/RL_FULL_EXECUTION_VIEW.md` |
| `RL_ROLLOUT_VIEW` | Rollout View | `/rollout` | real | `FullRolloutView` | `functions/RL_ROLLOUT_VIEW.md` |
