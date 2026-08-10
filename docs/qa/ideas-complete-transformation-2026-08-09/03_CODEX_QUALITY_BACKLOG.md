# Codex quality backlog — Ideas transformation

Control checkpoint: 2026-08-10, independent inspection of candidate HEAD `5d80167c5b` while Claude had an active uncommitted implementation wave. This backlog does not declare acceptance and must be reconciled against the next committed SHA.

## QG-01 — Split the Action Registry monolith

- Priority: P1
- Evidence: `src/actions/ideaActionRegistry.ts` reached 7,593 lines and 177 registered actions at committed HEAD `5d80167c5b`.
- Required outcome: split definitions by tool/domain while retaining one public registry API and stable action IDs.
- DoD: identical before/after action inventory; unchanged behavior, labels, scopes, permissions, undo, Teresa and analytics contracts; no circular imports; all action checks and focused routing tests pass.

## QG-02 — Replace the coverage ratchet with an accounted inventory

- Priority: P1
- Evidence: `check-action-coverage.sh` passed with a baseline of 264 action-like constructs (regenerated 2026-08-10 at HEAD `111868e07a`; the `288` figure in an earlier revision of this line was stale) — passing the ratchet proved no increase, not complete registration.
- DoD: every baseline hit is classified as registered action, intentional gesture/internal callback, duplicate surface awaiting reuse, or defect; unexplained debt is zero; exclusions have stable reasons; the guard fails on new unexplained constructs.
- **Status: RESOLVED 2026-08-10** — see accounting below.

### QG-02 — resolution (2026-08-10, HEAD `111868e07a`)

Full accounting of the 264-construct baseline (127 files) recorded at HEAD `111868e07a`:
`docs/qa/ideas-complete-transformation-2026-08-09/04_ACTION_COVERAGE_INVENTORY.csv`
(columns: `file,line,snippet,classification,reason,follow_up_action_id_or_blank`).

**Counts per class:**

| Class | Count | % |
|---|---:|---:|
| (a) heuristic false negative (registered/prop-forward, script fails to trace) | 76 | 29% |
| (b) intentional non-command (local gesture/draft, or out-of-domain feature) | 152 | 58% |
| (c) duplicate surface (second entry point for an action registered elsewhere) | 5 | 2% |
| (d) real defect — genuine remaining E02 debt | 31 | 12% |

**Sampling method:** every one of the 264 rows was read individually (function body via `Read`/`grep`, not just the flagged snippet) before classification — none were bulk-assigned from a snippet-only guess. What *is* pattern-based rather than per-row-unique is the *reasoning text*: 124 of the 152 class-(b) rows share one verified reason ("out-of-domain") established by checking, per **file** (not per row), that the file (i) has zero mentions in `src/actions/ideaActionRegistry.ts` and (ii) is imported only by non-Idea-Workspace screens (Decision/Task/Notification/Focus/Inbox/Notebook/Program — confirmed via `grep -rl` importer search per file, 47 files). Similarly ~35 of the 76 class-(a) rows share one verified reason (component-props destructured across multiple lines) after individually reading each function body to confirm the callee is a callback prop, not a real local mutation.

**Class (d) — the true remaining E02 debt: 31 rows**, all inside the four Idea Workspace tools (mindmap/whiteboard/process_flow/table) that `IDEA_ACTION_REGISTRY` actually governs:

| Area | Count | Detail |
|---|---:|---|
| Table platform modules (Automations, Connectors, Distribution ×2 impls, Forms, Interfaces, Sync, Sharing, Record Templates, Date Dependency) | 22 | Real `TablePlatformApi.*`/service calls (delete/create/execute/invite/etc.) with **zero** registry ids anywhere for these "Workflow" P15 modules (`docs/standards/idea-workspace/11_SPECYFIKACJE_NARZEDZI.md` §Table documents them as in-scope target features) |
| Idea canvas top-level (CSV export/copy ×2, per-format export ×2, template apply ×2, structure-type picker ×1) | 7 | `idea.export.open`/`idea.templates.open` only cover *opening* the menu (`mutates:false`); the actual mutating action (apply template overwrites the graph; CSV export/copy has 3 independent unregistered call sites) has no id of its own |
| Mind Map node-detail-drawer "Apply AI suggestion" (×2, NodeDetailDrawer + UnifiedNodeDetailDrawer) | 2 | Dispatches the same `idea-workspace-insert` runtime event several *other* registered `idea.ai.*` actions use, but this call site is its own separate implementation per the registry's own stated policy ("osobna implementacja = osobne id") and has none |

**Class (c) — 5 duplicate surfaces**, each verified against a real, named, already-registered id it should reuse instead of a second unwired call site: `IdeaTableTool.tsx` `applyView`/`saveCurrentView`/`handleBulkConvert` (→ `idea.view.table_apply_view` / `idea.view.table_save_view` / `idea.workspace.table_bulk_convert`), `IdeaProcessFlowTool.tsx` empty-state `addNode` (→ `idea.element.add`), `CommentPinBadge.tsx` (→ `idea.node.mm_open_detail`).

**Class (b) breakdown:** 124 out-of-domain (see above; includes `shared/TaskTemplates.tsx`, which is additionally dead code — zero importers anywhere in `src/`), 3 documented registry precedent (comment-thread delete: the registry's own comments at `idea.node.mm_comments`/`idea.node.pf_comments` state in-panel add/delete lives "poza tą akcją"), 6 `table.row.edit`-precedent (RowDetailPanel's in-panel comment/attachment interactions — same documented convention, `ideaActionRegistry.ts` ~L3443-3466), 2 medium-confidence analogous-pattern judgment calls (AI-panel chat-send in `AICopilotMode`/`ChatToSchemaPanel` — flagged for an explicit owner decision since the precedent isn't as literally worded as the two above), remainder local UI gestures (clipboard copy, dismiss, local unsaved-draft edits, one dev-only debug panel).

**Heuristic improvement (`scripts/check-action-coverage.awk`):** added Pass A3 to recognize component props destructured across *multiple lines* (`({\n  a,\n  onX,\n}) => {`, the majority style for this repo's top-level exported components — Pass A2 only handled the single-line form) and widened the accepted prop-name convention to include `handleX` alongside `onX` (verified against `ViewRouter.tsx`'s `PlatformGridViewProps`, which types `handleDuplicateRow`/`handleDeleteRow`/`handleInsertRow` as real callback props). The change only *subtracts* from `propNames` (an exclusion set), so it can only reduce or hold counts, never increase them.

Full-repo proof (`--all`, 455 files scanned, before vs. after):

| | Total constructs | Files with hits |
|---|---:|---:|
| Before | 264 | 127 |
| After | 194 | 91 |
| Per-file check | **0 files increased**, 0 new files flagged, 47 files decreased, 80 unchanged | |

Baseline regenerated (`--update`) to 194/91, matching the program's established ratchet convention ("regenerate only when debt provably dropped"). Guard re-verified green post-update.

**Not done in this pass (explicitly out of scope per task):** none of the 31 class-(d) rows were fixed — that is separate implementation work for a future registry-expansion pass.



- Priority: P1 / release gate
- Current state: NOT VERIFIED.
- Required chain: committed SHA -> mounted runtime badge -> authenticated real backend/DB -> mutation -> save -> refresh -> cold reopen -> readback.
- DoD: all four tools pass that chain on one environment and SHA; evidence is indexed; mocks remain labelled component-only; two clean acceptance rounds produce no new P0/P1.

## QG-04 — Remove duplicate React keys in Whiteboard drawing UI

- Priority: P2
- Evidence: independent 76/76 focused test run passed, but `IdeaDrawingLayer.keyboardDrawing.test.tsx` repeatedly emitted duplicate-key warnings for `#3b82f6`.
- DoD: unique stable keys; warning-free tests and mounted UI; no lost/duplicated options; keyboard and screen-reader behavior preserved.

## QG-05 — Obtain a conclusive full type-check

- Priority: P1 / merge gate
- Current state: NOT VERIFIED; observed `tsc --noEmit` remained CPU-active for more than seven minutes and returned no terminal result during inspection.
- DoD: run on a clean committed SHA without concurrent mutation; record command, time, exit code and output; PASS requires exit 0; timeout/termination remains NOT VERIFIED; profile pathological runtime if reproduced.

## QG-06 — Synchronize status and ledger after every milestone

- Priority: P1
- Evidence: status described only initial E00; ledger preceded HEAD and contained stale `pending commit` values.
- DoD: exact introducing/verifying SHA in every closed row; documentation, implementation, tests, runtime, persistence and acceptance remain separate states; CSV validation enforces exactly 20 columns in every record.

## Required execution order

1. Finish or safely checkpoint the active implementation wave.
2. Run QG-05 on the resulting clean committed SHA.
3. Complete QG-06 and reconcile every ledger row with that SHA.
4. Execute QG-01 and QG-02 before another large registry expansion.
5. Fix QG-04 and prove warning-free mounted behavior.
6. Execute QG-03; do not declare `READY_FOR_CODEX_REVIEW` before it passes.
