# Ideas P1–P3 — complete execution plan for the next Claude

Status: **READY FOR EXECUTION — implement, test, retest in runtime, and report**
Prepared: `2026-08-09`
Product surface: Consultify → My Work → Ideas → Mind Map / Process Flow / Whiteboard / Table

This plan is the detailed P1–P3 work package under the broader terminal program in `09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md`.

## 1. Mission

Close every open P1–P3 finding from the 2026-08-09 manual audit, preserve all repaired behavior, improve the common interaction architecture of the four Ideas tools, and deliver runtime evidence from the exact implementation candidate.

This is an implementation assignment, not a documentation-only review. Diagnose and repair defects encountered inside this scope, then retest the affected workflow. Do not declare completion from code inspection, type-checks, mocks, or screenshots without the required runtime readback.

Canonical inputs, read completely before editing:

1. `docs/qa/ideas-navigation-2026-08-09/MANUAL_AUDIT_AGENT_BRIEF.md`
2. `docs/qa/ideas-manual-audit-2026-08-09/00_ENVIRONMENT_AND_VERSION.md`
3. reports `01_MIND_MAP_AUDIT.md` through `04_TABLE_AUDIT.md`
4. `05_ALL_BUTTONS_INVENTORY.csv`
5. `06_CROSS_TOOL_SUMMARY.md`
6. `07_RECOMMENDED_CHANGES.csv`
7. relevant standards under `docs/standards/idea-workspace/`

## 2. Operating rules

- Work on the exact supplied working tree. Record initial HEAD, branch, dirty state, runtime URL, backend URL and visible version badge before changing code.
- Preserve unrelated user/agent changes. No reset, clean, broad stash, broad staging or overwrite of files outside the accepted scope.
- Reproduce each open finding before repair where practical. Preserve a before screenshot or precise runtime observation.
- A repair is complete only after: focused automated tests, root type-check, runtime interaction, save/readback or reopen where persistence is relevant, and evidence capture.
- Keep `PASS`, `PARTIAL`, `NOT VERIFIED`, `BLOCKED` and `EVIDENCE_MISSING` literal. Do not infer a pass.
- Do not execute destructive imports, external webhook deliveries, account changes or irreversible actions without separate authorization. Those remain `NOT VERIFIED` with a reason.
- If the currently running localhost is not the supplied candidate, start a separate candidate runtime. Never use production/demo without proving the same deployment SHA.
- Maintain one live execution ledger. Every item below must finish as `REPAIRED + RETESTED`, `VERIFIED NO CHANGE NEEDED`, or `BLOCKED` with concrete evidence.

## 3. Target interaction architecture

Apply this ownership model consistently across all four tools:

| Surface | Canonical responsibility |
|---|---|
| Menu 1 / document overflow | document-level actions: import, export, convert, share, presentation, destructive lifecycle |
| Main toolbar | current mode and selection-dependent editing |
| Movable rail | creation palette, navigation modes and high-frequency canvas actions |
| Right inspector | properties, relations, activity, comments and AI for the selected scope |
| Canvas PPM | short contextual subset; advanced groups nested, never a flat catalogue |

Common behavioral contracts:

- every command has one canonical location; a deliberate compact duplicate must identify itself as an alternative and share the same command implementation;
- every AI action states its scope using the shared vocabulary `Selection`, `Branch`, `Document` (`Zaznaczenie`, `Gałąź`, `Dokument`);
- every async command ends in an explicit state: proposal, applied result, actionable error or cancellation;
- creation never leaves two editors, invisible objects or completely overlapping new objects;
- keyboard and pointer paths operate the same command and expose equivalent feedback;
- save confirmation is not persistence proof—reopen/readback is required.

## 4. Wave 0 — baseline and regression shield

Before product changes:

1. Re-run the four existing business scenes or at least open and verify their persisted minimums.
2. Add/complete targeted tests for the repairs already made during the audit:
   - list/workspace route reconciliation;
   - already-open tab representation synchronization;
   - Whiteboard AI grounding in current board content;
   - shared context-menu Enter/Space activation;
   - source→target Connect in Mind Map, Whiteboard and Process Flow;
   - Process Flow deterministic Yes/No and correction-loop labels;
   - Table AI unsupported-result terminal state and deterministic primitive-field preview;
   - movable rail side switch, arrows and Home reset.
3. Tests must fail on the old behavior and pass on the candidate behavior. Avoid source-text assertion tests when a mounted component or state-transition test is feasible.

Exit gate: existing four scenes still reopen correctly and the repaired behaviors have focused regression coverage.

## 5. Wave 1 — P1 closure

### P1.1 Mind Map — duplicate sibling editor (`MM-P1-01`)

Problem: mixed Add sibling / keyboard sequencing can create two blank inline editors.

Implementation:

- trace all sibling insertion entry points and converge them on one command;
- add an invocation guard for duplicate pointer/keyboard events without suppressing legitimate consecutive inserts;
- maintain exactly one editing node and deterministic focus;
- Escape cancels the new empty node, Enter commits once, and focus returns predictably.

Acceptance:

- one toolbar, PPM or keyboard invocation creates exactly one sibling and one editor;
- 20 rapid alternating pointer/keyboard trials produce no duplicate editor;
- undo removes one insertion; redo restores one insertion;
- committed sibling persists after reopen.

### P1.2 Whiteboard — insertion layout (`WB-P1-02`)

Problem: successive new elements overlap at nearly identical coordinates.

Implementation:

- introduce deterministic cascading/spiral placement relative to viewport center or last insertion;
- respect grid/snap and keep the full object inside the visible viewport;
- after a collision threshold, find the nearest free slot rather than stacking;
- apply the same placement service to notes, shapes, text, frames and template-generated objects where appropriate;
- do not auto-move objects the user has already positioned.

Acceptance:

- ten successive inserts at default zoom are individually visible and selectable;
- a mixed set of 12 notes/shapes/frames has no complete overlap;
- placement remains valid at 1280×800 and 200% browser zoom;
- save/reopen preserves final coordinates.

### P1.3 Cross-tool regression coverage (`SYS-P1-02` in the recommendations ledger)

Add the missing targeted routing, AI-grounding and command-state tests described in Wave 0. Treat this as a release-blocking P1 even if runtime currently passes.

### P1.4 Cross-tool Connect completion (`SYS-P1-04`)

The runtime audit proved source→target Connect in all three canvas tools, but the recommendations ledger still marks the systemic item open. Reconcile implementation and ledger:

- extract or formalize a shared interaction contract where feasible: idle → source selected → target selected/cancelled → success/error;
- consistent visible instruction and Escape cancellation;
- keyboard activation on nodes/elements;
- prevent self-links and duplicate links with an explicit message;
- preserve tool-specific semantics, especially Process Flow Yes/No and correction loop.

Acceptance:

- Mind Map: two cross-links persist;
- Whiteboard: four links persist;
- Process Flow: two labelled decision branches and a labelled correction loop persist;
- all three can be completed without pointer drag;
- mark `SYS-P1-04` repaired only after the shared matrix passes.

### P1.5 Whiteboard freehand accessibility (`WB-P1-04` remaining portion)

Rail movement already has accessible controls. The remaining gap is freehand creation without raw coordinate automation or an inaccessible drag-only path.

Implementation options, preferred order:

1. keyboard drawing mode with arrow-key cursor movement, Space/Enter pen down/up and Escape finish;
2. accessible `Add stroke` command with editable points/style for users unable to drag;
3. retain pointer drawing and add explicit live feedback, stroke completion state and undo semantics.

Acceptance:

- create a visible stroke without raw coordinate scripting;
- change color/width, undo and redo it;
- reopen retains the stroke;
- screen-reader/AX state identifies drawing mode and completion.

### P1.6 Table field authoring (`TB-P1-02`)

The hidden `Columns → New column` path works, but it is not sufficiently discoverable.

Implementation:

- add a clear `Add field` entry in the empty state and canonical columns surface;
- provide a compact wizard: name, type, optional type-specific settings, preview, create;
- support at minimum Text, Number, Select, Date, Rating, Person and Currency;
- validate duplicate/empty names and expose recovery without closing the wizard;
- use the same schema mutation command as existing column creation and AI proposals.

Acceptance:

- create `Obszar`, `Koszt`, `Korzyść`, `Ryzyko`, `Właściciel` in at most ten purposeful interactions after opening Add field;
- type-specific cells render and accept valid input;
- schema and values persist after reopen;
- undo/redo is honest for schema changes.

### P1.7 Table AI terminal outcome (`TB-P1-03`)

Implementation:

- retain the submitted command in history;
- show one durable terminal state: proposal, applied, unsupported with reason, validation error or transport error;
- never close/clear silently;
- include Retry/Edit command and preserve user text after recoverable failure;
- add accessible status/alert semantics without relying on a transient toast.

Acceptance matrix:

- supported field command → preview → apply → persisted field;
- unsupported command → visible actionable error;
- empty/no-op mapping → explicit refusal;
- backend transport failure → retryable state;
- cancellation is visibly distinct from failure.

## 6. Wave 2 — P2 information architecture and discoverability

### Mind Map

- `MM-P2-01`: keep one canonical Present action at document scope; remove or intentionally label any compact alternative.
- `MM-P2-02`: move Import/Export from the creation rail to Menu 1/document overflow.
- `MM-P2-03`: label every AI command with `Selection`, `Branch` or `Document` scope.
- Reduce the approximately 50-item PPM: top level should prioritize Rename/Edit, structure, relation, data and delete; group AI, conversion, appearance and expert functions in submenus.

Acceptance: no unexplained Present or export duplicate; the first PPM level fits without scrolling at 1280×800 and exposes core actions; all AI actions identify scope.

### Process Flow

- `PF-P2-01`: make one surface the primary creation palette. Recommended: rail creates nodes/lanes; toolbar edits mode/selection. Remove duplicated Start/End/Action/Decision/Lane buttons from the other surface or document a genuinely different purpose.
- `PF-P2-02`: after Add Lane, immediately focus inline lane naming; Enter commits, Escape cancels or restores the default safely.
- Add selected-edge properties for label/type/delete/reverse where semantically valid. This is an additional conclusion from the audit: deterministic quick labels solve the tested scene but do not replace general edge editing.

Acceptance: one obvious creation path; a lane is named during creation and persists; any selected edge exposes its current semantic label and safe editing controls.

### Whiteboard

- `WB-P2-01`: newly created sticky/text objects enter inline naming, or expose a visible Rename action immediately.
- `WB-P2-02`: when labels are still generic/default, disable or coach `Find themes` and explain which semantic input is missing.
- Add an optional `Tidy board` / `Auto arrange selection` command using the same collision-free placement engine from P1.

Acceptance: a first-time user names a new object without knowing about double-click; AI does not present generic output as insight; tidy operation is undoable and preserves grouping/frames.

### Table

- `TB-P2-01`: move Forms, Interfaces, Models, Workflow and Webhooks under `More tools`; keep core row, field, filter, sort, group and view work visible.
- `TB-P2-02`: remove or explain Row/Columns/Undo duplicates between toolbar and rail using the target ownership model.
- `TB-P2-03`: add a labelled Send button, keep Enter submission, give the X an accessible `Close assistant` name and tooltip.

Acceptance: default toolbar shows core table work only; no unexplained duplicates; a first-time user can submit AI by click or Enter and cannot mistake Close for Send.

### System-wide duplicate audit (`SYS-P2-02`)

After tool-specific changes, regenerate the 131-control inventory. Every remaining duplicate must be either removed or recorded as intentional with a distinct context/purpose. Do not solve duplication by hiding high-frequency actions in unrelated menus.

## 7. Wave 3 — P3 polish and first-use competence

- `MM-P3-01`: rename inspector `Tool` to `Appearance` / `Wygląd` or `Style` / `Styl`; verify EN and PL.
- `PF-P3-01`: expose `Fit view` directly beside zoom controls with tooltip and keyboard shortcut; it must fit all lanes and nodes, not increase zoom unexpectedly.
- `TB-P3-01`: replace the under-explained zero-record state with three clear paths: Start blank, Use template, Import; optionally show one removable example row only when the user chooses guided start.
- `SYS-P3-01`: standardize AI scope vocabulary and visual chips across all four tools.

Acceptance: labels predict contents in both locales; Fit view works from 25–300% internal zoom; a first-time Table user can create a useful table without hunting; identical AI scope names mean identical target breadth.

## 8. Additional improvements derived from the audit

These are not substitutes for the numbered findings. Implement them after P1–P3 unless they naturally fall inside the same component change.

### A. Shared command registry

Create one command definition per action with stable ID, label/i18n key, icon, scope, enabled reason, keyboard shortcut, destructive flag and handler. Toolbar, rail, inspector and PPM should render the same command rather than duplicate logic. This reduces behavioral drift and makes inventory generation testable.

### B. Universal command feedback

Adopt a small state contract for long/async operations: `idle → running → proposal/result | actionable error | cancelled`. Preserve the last terminal result until dismissed. Use it for AI, import/export, templates, auto-arrange and schema changes.

### C. Honest disabled states

Every disabled action should expose why it is unavailable and what prerequisite is needed. Apply first to Insert, Split, Undo/Redo, AI actions without semantic input and selection-dependent commands.

### D. Persistence health indicator

Keep `Saving…`, `Saved`, `Save failed — retry` and last successful save separate. Add a development/test hook or stable observable state so runtime tests can wait for actual persistence before reopen.

### E. First-use guidance without permanent clutter

Provide contextual one-time coaching for Connect, lane naming, Whiteboard naming, Table Add field and AI scope. Guidance must disappear after successful use and remain accessible from Help.

### F. Interaction telemetry and competence metrics

If telemetry is permitted, instrument only product events—not sensitive canvas content:

- command opened/executed/cancelled/errored;
- time to first meaningful object;
- duplicate insertion prevention;
- AI proposal/applied/error outcome;
- undo immediately after command as a friction signal;
- use of search/help after menu opening.

Define success targets before rollout, for example: ≥90% successful first AI submission, ≥95% first-use object naming, zero silent terminal outcomes, and median business-scene completion time reduced by 25%.

### G. Accessibility gate

For every new or moved control verify accessible name, role, state, focus order, Enter/Space, Escape, visible focus and 44px-equivalent target where the design system requires it. Run the three canvas relationship flows and Table field creation without raw coordinate drag.

## 9. Recommended execution order

1. Baseline/version gate and repaired-behavior regression shield.
2. Shared command/feedback primitives needed by more than one tool.
3. P1 correctness and accessibility: duplicate editor, Whiteboard placement/freehand, Connect contract, Table field wizard/AI terminal states.
4. P2 surface ownership and discoverability, one tool at a time.
5. P3 labels, Fit view, empty state and scope language.
6. Full cross-tool manual regression and evidence package.

Do not perform a large visual redesign. Prefer bounded changes that preserve the accepted scenes, persisted records and established Ideas architecture.

## 10. Required verification matrix

For each tool run both passes again:

- Pass A: every visible toolbar, rail, inspector, Menu 1, Menu 3, PPM and keyboard command; record result, sense, placement, duplicate status and persistence relevance.
- Pass B: rebuild the original business scene from zero, then save, refresh, leave/reopen and confirm readback.

Cross-tool matrix:

- 1280×800, 1440×900, 1920×1080;
- browser zoom 100% and 200%; internal canvas zoom minimum, normal and high;
- light/dark and PL/EN;
- keyboard-only relationship creation and primary authoring paths;
- loading, empty, disabled, validation-error, transport-error and save-error states;
- no silent AI or persistence failure.

Automated minimum:

- focused unit/component tests for every repaired item;
- route and representation integration tests;
- persistence/readback tests for scene-critical data;
- root `npm run type-check`;
- server type-check reported honestly; baseline failures separated from candidate regressions;
- CSV and Markdown evidence-link validation.

## 11. Deliverables

Create a new dated folder rather than overwriting the original audit:

`docs/qa/ideas-p1-p3-remediation-YYYY-MM-DD/`

Required files:

1. `00_BASELINE_AND_VERSION.md`
2. `01_EXECUTION_LEDGER.csv`
3. `02_MIND_MAP_RETEST.md`
4. `03_PROCESS_FLOW_RETEST.md`
5. `04_WHITEBOARD_RETEST.md`
6. `05_TABLE_RETEST.md`
7. `06_CROSS_TOOL_MATRIX.md`
8. `07_TEST_AND_TYPECHECK_RESULTS.md`
9. `08_FINAL_ACCEPTANCE.md`
10. `screenshots/` with stable names: `<tool>__<finding-or-scene>__<state>.png`

The execution ledger must contain: ID, priority, owner/surface, baseline reproduction, implementation summary, files changed, automated tests, runtime result, persistence result, responsive/theme/locale result, evidence, final state and remaining risk.

## 12. Final acceptance gate

The assignment is complete only when:

- every open P1, P2 and P3 row is `REPAIRED + RETESTED` or has a genuine blocker;
- repaired items from the original audit have not regressed;
- each of the four business scenes is possible, natural enough for a first-time user, and persists after reopen;
- no unexplained duplicate command remains;
- AI scope and terminal-state contracts are consistent;
- keyboard paths cover core creation, connection, naming and submission;
- required viewport/zoom/theme/locale/error-state evidence exists;
- automated checks and runtime proof refer to the same candidate SHA;
- facts, observations, conclusions and recommendations are separated in the final report;
- lack of evidence is reported as `NOT VERIFIED`, never converted to PASS.

Final handoff must start with: candidate SHA/runtime, P1/P2/P3 closure counts, four-scene result, regressions, remaining blockers and the exact next gate. `READY_FOR_CODEX_REVIEW` is a candidate handoff, not final acceptance.
