# Codex quality backlog — Ideas transformation

Control checkpoint: 2026-08-10, independent inspection of candidate HEAD `5d80167c5b` while Claude had an active uncommitted implementation wave. This backlog does not declare acceptance and must be reconciled against the next committed SHA.

## QG-01 — Split the Action Registry monolith

- Priority: P1
- Evidence: `src/actions/ideaActionRegistry.ts` reached 7,593 lines and 177 registered actions at committed HEAD `5d80167c5b`.
- Required outcome: split definitions by tool/domain while retaining one public registry API and stable action IDs.
- DoD: identical before/after action inventory; unchanged behavior, labels, scopes, permissions, undo, Teresa and analytics contracts; no circular imports; all action checks and focused routing tests pass.
- **Status: RESOLVED (2026-08-10, SHA `4afa10c31b`).** The 10,696-line monolith is now a 404-line
  barrel plus `src/actions/registry/{types,runtimeHelpers,mindmapActions,whiteboardActions,
  processFlowActions,tableActions,sharedActions}.ts`. Import path unchanged for all 47 consumers.
  DoD evidence, each item measured by the orchestrator rather than taken from the implementing
  stream's report: action inventory **231 before / 231 after, identical set, zero duplicates**;
  **all 231 action bodies byte-identical** across the split (object literals extracted from both
  sides and diffed); Teresa manifest **byte-identical** (sha256 `4ac76f8c…2f3a32f9` unchanged);
  public export surface **21 → 21, zero lost**, and all 11 distinct named imports across the 47
  consumer files resolve; runtime maps intact (**108** `RUNTIME_*`, **124** runtime pair lines,
  before == after); **no circular imports** — the graph is a DAG with `types.ts` as a leaf and
  nothing under `registry/` importing the barrel; `npm run type-check` **exit 0, 0 errors**
  (captured bare, not through a pipe); all five guards rc=0 with `check-actions` reporting the
  same **231 actions / 124 runtime strings / 7 events / 4 API methods** as before the split.
  **Two defects the stream did not report, found while verifying and fixed here:**
  (1) `TS2304: Cannot find name 'ActionResult'` — `export * from './registry/types'` re-exports to
  consumers but does not bring names into local scope, so the barrel as delivered **did not
  type-check**; (2) menu order could silently drift — `getActionsForSurface` preserves registry
  order, and the split reconstructs it via `ORIGINAL_ORDER` (verified equal to the pre-split order
  position by position), but the sort fell back to `?? 0`, so a future action added without an
  `ORIGINAL_ORDER` entry would have jumped to the **top** of Menu 3 and the context menu with no
  signal at all. Fallback is now `MAX_SAFE_INTEGER` (worst case: last, not first) and the real fix
  is a new guard rule **R11** in `scripts/check-actions.sh`: `ORIGINAL_ORDER` must be a permutation
  of the parsed action set — no missing id, no orphan, no duplicate. Proven by negative control in
  both directions (removed id → R11 names it, rc=1; bogus id → R11 names it as orphaned, rc=1), and
  the guard was separately proven to still *see* the split files rather than merely exit 0 (broke a
  handler in `mindmapActions.ts` → R1 fired; broke a runtime string in `runtimeHelpers.ts` → R6
  fired with the correct file:line).
  **Not verified:** menu order is proven identical in the SOURCE data, not yet on screen — no
  before/after screenshot of Menu 3 or the context menu exists for this change.

## QG-02 — Replace the coverage ratchet with an accounted inventory

- Priority: P1
- Evidence: `check-action-coverage.sh` passed with a baseline of 264 action-like constructs (regenerated 2026-08-10 at HEAD `111868e07a`; the `288` figure in an earlier revision of this line was stale) — passing the ratchet proved no increase, not complete registration.
- DoD: every baseline hit is classified as registered action, intentional gesture/internal callback, duplicate surface awaiting reuse, or defect; unexplained debt is zero; exclusions have stable reasons; the guard fails on new unexplained constructs.
- **Status: RESOLVED (2026-08-10)** — class (c) = 0, class (d) = **0**. All 36 former class-c/class-d
  rows are genuinely wired, individually re-verified against the merged code (action id exists in
  `src/actions/ideaActionRegistry.ts` AND the cited component file:line actually calls it).
  **Correction of record (orchestrator verification, 2026-08-10):** a prior revision of this entry claimed
  "Status: RESOLVED ... class (d) = 0 ... individually re-verified against the merged code". That claim
  did not hold at the time. An independent re-check by the orchestrator — parsing the inventory with a real
  CSV parser and, for every `resolved` row, asserting BOTH that the action id exists in
  `src/actions/ideaActionRegistry.ts` AND that the cited component file actually references that id —
  found 4 rows where the registry entry existed but the call site was never rewired
  (`IdeaTemplateGallery.tsx` did not even import the registry). A registered action with no caller from
  the surface it claims to serve is still a dead click from that surface: exactly the "code exists,
  wiring doesn't" anti-pattern this program exists to eliminate. Those 4 rows were reverted to class (d)
  with the evidence written into their `reason` column.
  **Remediation (2026-08-10, same day, follow-up session):** all 4 reverted rows have now been genuinely
  wired: `IdeaTableTool.tsx`'s CSV-export and copy-to-clipboard buttons (~L3404/L3414) now route through
  `runTblLegacyToolbarAction('idea.export.table_csv', …)` / `runTblLegacyToolbarAction('idea.table.copy_clipboard', …)`
  — the file's own established dual-path helper, UI click behavior byte-identical to before. `IdeaTemplateGallery.tsx`
  now imports the registry for the first time and both template-apply buttons (~L2206/L2217, confirmed to be
  the SAME `handleApply` function invoked with a `withAIFill` boolean, not two distinct commands) route through
  a new `runTemplateApplyAction` helper calling `runIdeaAction('idea.template.apply', ctx)`. See the updated
  accounting below and `04_ACTION_COVERAGE_INVENTORY.csv` for the row-by-row record.
  (An earlier revision had also briefly claimed "Status: RESOLVED 2026-08-10" while its
  own text admitted none of the 31 class-(d) rows were fixed — that was a status/evidence contradiction,
  corrected to PARTIAL / INVENTORIED_NOT_REMEDIATED at the time. The remediation that has since landed,
  across two sessions, brings all 31 former class-(d) rows to genuinely resolved — see the "Former class
  (d) — 31 rows, now resolved" breakdown table below for the full per-area accounting, including the CSV
  export / clipboard copy / template-apply ×2 rows wired in the follow-up session described above — plus 5
  class-(c) rows reconciled — 3 via genuine reuse-wiring onto their originally-suggested existing ids, and
  2 where the originally-suggested reuse target was DECLINED after verification found a real mechanism
  mismatch and a new, purpose-built id was registered instead.)

### QG-02 — accounting (2026-08-10, HEAD `111868e07a`; remediation landed 2026-08-10 post-merge) — now a fix, not just classification

Full accounting of the 264-construct baseline (127 files) recorded at HEAD `111868e07a`:
`docs/qa/ideas-complete-transformation-2026-08-09/04_ACTION_COVERAGE_INVENTORY.csv`
(columns: `file,line,snippet,classification,reason,follow_up_action_id_or_blank`).

**Counts per class (post-remediation):**

| Class | Count | % |
|---|---:|---:|
| (a) heuristic false negative (registered/prop-forward, script fails to trace) | 76 | 29% |
| (b) intentional non-command (local gesture/draft, or out-of-domain feature) | 152 | 58% |
| (c) duplicate surface — unresolved | 0 | 0% |
| (d) real defect — unresolved | 0 | 0% |
| (resolved) former class-c/class-d row now genuinely registered and wired (verified id + verified call-site routing) | 36 | 14% |

**Unresolved debt (class c + class d): 0.** All 5 former class-c rows are genuinely resolved. All 31
former class-d rows are genuinely resolved, including the 4 that were reverted by the orchestrator's
2026-08-10 verification pass and re-closed in the immediate follow-up session (`IdeaTableTool.tsx:3372`
`idea.export.table_csv`, `IdeaTableTool.tsx:3382` `idea.table.copy_clipboard`,
`IdeaTemplateGallery.tsx:2206`/`2217` both `idea.template.apply` — see the CSV `reason` column for the exact
wiring of each). This is the number the QG-02 status line above is conditioned on: it must be 0 before
QG-02 may say RESOLVED — it is 0, so QG-02 is RESOLVED. Maintenance note for whoever wires a class-c or
class-d row: when you change
a row's `classification` in `04_ACTION_COVERAGE_INVENTORY.csv` away from `c`/`d` because you actually
fixed it (real registry id, real handler, Teresa mapping where honest), update this "Unresolved debt" line
and the per-class counts table above in the same change — `tests/unit/qa/action-coverage-inventory-consistency.test.ts`
cross-checks this line against the CSV's live counts and fails if they drift apart.

**Sampling method:** every one of the 264 rows was read individually (function body via `Read`/`grep`, not just the flagged snippet) before classification — none were bulk-assigned from a snippet-only guess. What *is* pattern-based rather than per-row-unique is the *reasoning text*: 124 of the 152 class-(b) rows share one verified reason ("out-of-domain") established by checking, per **file** (not per row), that the file (i) has zero mentions in `src/actions/ideaActionRegistry.ts` and (ii) is imported only by non-Idea-Workspace screens (Decision/Task/Notification/Focus/Inbox/Notebook/Program — confirmed via `grep -rl` importer search per file, 47 files). Similarly ~35 of the 76 class-(a) rows share one verified reason (component-props destructured across multiple lines) after individually reading each function body to confirm the callee is a callback prop, not a real local mutation.

**Former class (d) — 31 rows, now resolved**, all inside the four Idea Workspace tools (mindmap/whiteboard/process_flow/table) that `IDEA_ACTION_REGISTRY` actually governs. Each row's `follow_up_action_id_or_blank` was re-verified after remediation: the id exists in `ideaActionRegistry.ts` AND the cited component file:line now calls `runIdeaAction('<that id>', ctx)` at (or immediately around, for wrapper-added lines) that call site — not merely relabeled on the implementer's word. (Note: the CSV export/copy and template-apply ×2 rows inside the "Idea canvas top-level" group below were briefly regressed to class (d) by the orchestrator's 2026-08-10 verification — the registry ids existed but the four call sites weren't actually rewired — and were re-closed for real in an immediate follow-up session; the count and detail below reflect the now-true state.)

| Area | Count | Detail |
|---|---:|---|
| Table platform modules (Automations, Connectors, Distribution ×2 impls, Forms, Interfaces, Sync, Sharing, Record Templates, Date Dependency) | 22 | Wired to 22 new `table.*` registry entries (`table.automation.*`, `table.distribution.*`, `table.distribution_builder.*`, `table.record_template.*`, `table.date_dependency.*`, `table.form.*`, `table.form_intake.*`, `table.interface.*`, `table.sharing.*`, `table.sync.*`, `table.webhook_relay.*`); every one of the 22 component files imports `runIdeaAction` from `ideaActionRegistry.ts` and calls it with the literal registered id at the cited line |
| Idea canvas top-level (CSV export/copy ×2, per-format export ×2, template apply ×2, structure-type picker ×1) | 7 | Wired to 5 new ids: `idea.export.table_csv`, `idea.table.copy_clipboard`, `idea.export.file` (covers both per-format export call sites via a `format` param), `idea.template.apply` (covers both the plain and `withAIFill=true` call sites via a param), `idea.view.mm_structure_type`. The CSV export/copy buttons route through `IdeaTableTool.tsx`'s existing `runTblLegacyToolbarAction` helper (byte-identical UI behavior); the template-apply buttons route through a new `runTemplateApplyAction` helper in `IdeaTemplateGallery.tsx`, which now imports the registry for the first time |
| Mind Map node-detail-drawer "Apply AI suggestion" (×2, NodeDetailDrawer + UnifiedNodeDetailDrawer) | 2 | Wired to one new id, `idea.node.mm_apply_ai_suggestion` (same id for both drawers — their `handleApplyAISuggestion` bodies are byte-identical and mutually exclusive per the `mindmapDrawerUnified` flag, so one id is correct, not a miscount) |

**Former class (c) — 5 duplicate surfaces, now resolved.** 3 of the 5 were genuine reuse exactly as
originally suggested; 2 were re-verified and found to be a real mechanism mismatch, so the originally
suggested reuse target was **declined** and a new, purpose-built id registered instead — leaving the old
suggested id in `follow_up` for those two would have misrepresented a deliberate engineering decision as a
reuse that never happened:

| Call site | Originally suggested | Actual outcome |
|---|---|---|
| `IdeaTableTool.tsx` `applyView` (~L2500) | `idea.view.table_apply_view` | **Confirmed, same id** — genuine reuse; legacy (`!usePlatform`) toolbar now routes through it via `runTblLegacyToolbarAction` |
| `IdeaTableTool.tsx` `saveCurrentView` (~L2566) | `idea.view.table_save_view` | **Confirmed, same id** — genuine reuse, same mechanism as above |
| `IdeaTableTool.tsx` `handleBulkConvert` (~L3491) | `idea.workspace.table_bulk_convert` | **Confirmed, same id** — genuine reuse, same mechanism as above |
| `IdeaProcessFlowTool.tsx` empty-state `addNode` (~L3458) | `idea.element.add` | **DECLINED, new id `idea.view.pf_add_start`** — `idea.element.add`'s Process Flow runtime (`pf_add_step`) hardcodes shape `'action'`, but this CTA adds a `'start'`/`'vsm_process'` node; a real shape mismatch, not a false negative |
| `CommentPinBadge.tsx` (~L39) | `idea.node.mm_open_detail` | **DECLINED, new id `idea.node.wb_open_detail`** — `mm_open_detail` is `tools:['mindmap']`-only and opens mindmap's own drawer state; `CommentPinBadge` lives in `whiteboard/nodes/` and opens a completely separate shell-level drawer, zero shared code |

**Class (b) breakdown:** 124 out-of-domain (see above; includes `shared/TaskTemplates.tsx`, which is additionally dead code — zero importers anywhere in `src/`), 3 documented registry precedent (comment-thread delete: the registry's own comments at `idea.node.mm_comments`/`idea.node.pf_comments` state in-panel add/delete lives "poza tą akcją"), 6 `table.row.edit`-precedent (RowDetailPanel's in-panel comment/attachment interactions — same documented convention, `ideaActionRegistry.ts` ~L3443-3466), 2 medium-confidence analogous-pattern judgment calls (AI-panel chat-send in `AICopilotMode`/`ChatToSchemaPanel` — flagged for an explicit owner decision since the precedent isn't as literally worded as the two above), remainder local UI gestures (clipboard copy, dismiss, local unsaved-draft edits, one dev-only debug panel).

**Heuristic improvement (`scripts/check-action-coverage.awk`):** added Pass A3 to recognize component props destructured across *multiple lines* (`({\n  a,\n  onX,\n}) => {`, the majority style for this repo's top-level exported components — Pass A2 only handled the single-line form) and widened the accepted prop-name convention to include `handleX` alongside `onX` (verified against `ViewRouter.tsx`'s `PlatformGridViewProps`, which types `handleDuplicateRow`/`handleDeleteRow`/`handleInsertRow` as real callback props). The change only *subtracts* from `propNames` (an exclusion set), so it can only reduce or hold counts, never increase them.

Full-repo proof (`--all`, 455 files scanned, before vs. after):

| | Total constructs | Files with hits |
|---|---:|---:|
| Before | 264 | 127 |
| After | 194 | 91 |
| Per-file check | **0 files increased**, 0 new files flagged, 47 files decreased, 80 unchanged | |

Baseline regenerated (`--update`) to 194/91, matching the program's established ratchet convention ("regenerate only when debt provably dropped"). Guard re-verified green post-update.

**Done in a later pass (2026-08-10, post-merge):** all 31 former class-(d) rows and all 5 former class-(c)
rows were remediated — see the tables above. QG-01 (splitting the now-larger registry monolith) remains
separately open.



## QG-03 — Prove the runtime and persistence chain

(The `## QG-03` heading was missing in earlier revisions of this file — the block below was
orphaned under QG-02's accounting. Restored 2026-08-10.)

- Priority: P1 / release gate
- Current state: **RESOLVED for everything an agent can verify (2026-08-10, SHA `c5b1b6e6b9`).**
  Schema gate PASS, E12 server-side enforcement PASS, and the persistence matrix is **8/8** —
  every tool and every Wave 4/5 feature passes save -> refresh -> **cold reopen** -> readback
  confirmed by a direct database query, on an isolated local Postgres. Full evidence:
  `13_RUNTIME_GATE_EVIDENCE.md` (including its dated UPDATE section).
  **The one part of the DoD still outstanding is the mounted-runtime-badge / browser-surface leg**,
  which is gate 4 and needs the owner's acceptance under rule #7 — not something this program may
  sign off on its own. Everything server-side is done and falsifiability-checked: six sabotages
  across the two suites, one of which came back VACUOUS (a column DEFAULT was papering over an
  omitted write) and was reported and redesigned rather than banked.
- Required chain: committed SHA -> mounted runtime badge -> authenticated real backend/DB -> mutation -> save -> refresh -> cold reopen -> readback.
- DoD: all four tools pass that chain on one environment and SHA; evidence is indexed; mocks remain labelled component-only; two clean acceptance rounds produce no new P0/P1.
- **Done (2026-08-10, owner-authorised isolated local Postgres only — never demo, never production):**
  the four `20260810_idea_*` migrations were reviewed against four conditions and then applied.
  Additive-only, idempotent (exit 0 on three separate full runs), no backfill, and every object
  matches what the code actually queries — verified through `information_schema`/`pg_constraint`,
  **not** through the migration runner's report, whose `--safe` mode reports a failure as `skipped`
  with exit 0. CHECK constraint proven to bind by negative control (SQLSTATE 23514); probe rows
  deleted and the deletion confirmed by count query.
  E12 server-side enforcement is proven at runtime on a 1011-table real Postgres: five previously
  **ungated** endpoints (`ai-generate`, `ai-suggestions`, `ai-table-action`, `ai-fill`, CSV export)
  plus three regression endpoints all return 403 `IDEA_CONFIDENTIALITY_BLOCKED` for a `restricted`
  Idea, with a `standard` Idea as a same-request negative control. The suite's green was itself
  validated: deleting the CSV-export gate turned it red with `expected 404 to be 403`, and restoring
  the gate turned it green again — so the pass is not vacuous.
- **Still missing before this may say PASS:** save → refresh → **cold reopen** → readback per tool
  (Mind Map, Whiteboard, Process Flow, Table) and per Wave 4/5 feature, each confirmed by a direct
  database query; and any runtime evidence on a browser surface. Both are EVIDENCE_MISSING.
- **Known limitation, recorded not hidden:** full-repo schema convergence remains broken (583
  pending migrations on a fresh database via one runner; 172 of 787 files never applied via the
  other). Pre-existing, out of this program's scope, and it means "the schema builds" must never be
  claimed on the strength of the evidence above.

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

---

## Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12)

This backlog's own header already says it "does not declare acceptance and
must be reconciled against the next committed SHA" — that reconciliation
happened in later sessions this file predates, kept here as history rather
than rewritten in place:

- **QG-01** (split the registry monolith) — RESOLVED at `4afa10c31b`
  (2026-08-10), independently of this file. See
  `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-07.
- **QG-03** (full runtime→persistence chain) — PASS on isolated local DB,
  now **9 chains** (was 8 before this wave; chain 9 = E09 financial case).
  See `13_RUNTIME_GATE_EVIDENCE.md`.
- **QG-02/QG-04/QG-05/QG-06** — see `00_PROGRAM_STATUS_AND_VERSION.md`'s
  "GATE BOARD 2026-08-11" section, which records `QG-01…QG-06 all RESOLVED`
  as of that wave — unchanged and not re-audited item-by-item in this pass.

**Not re-verified this wave:** whether every individual QG-02/04/05 DoD clause
still holds line-by-line at `6fec03f7a0` was not re-read; the gate-board-level
RESOLVED status is carried forward, not re-derived from scratch.

**CORRECTION, same day (HEAD `bcdda752b7`):** QG-05 (full type-check) is now
independently, freshly confirmed — client `tsc` exit 0 / 0 errors, server
`tsc` exit 0 / 0 errors, both serialized, at code-final SHA `f5cdc7b867`.
Two cross-file type defects were found and fixed to get there; see that
commit's body and `RESUME_HANDOFF.md` §1. Also: the action registry grew
231→**234** actions this same day (`a537a022e2`, closing a `check-actions.sh`
gate failure by routing three `FinancialCaseDialog` commands through the
registry) — `check-actions.sh` is now rc=0.
