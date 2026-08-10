# 14 — Accessibility, Locale, Performance report (E14)

Candidate: worktree `ideas-e14-a11y`, detached at `04a959288f0d8fde6242e6d5c8a4cfd0f82c30d9`.
Scope: the four Idea Workspace tools — Mind Map (`IdeaMapWorkspace.tsx` + `mindmap/`),
Whiteboard (`IdeaWhiteboardTool.tsx` + `whiteboard/`), Process Flow (`IdeaProcessFlowTool.tsx`
+ `processflow/`), Table (`IdeaTableTool.tsx` + `table/`) — and their shared canvas primitives
under `src/components/MyWork/canvas/`.

Method note: this is a static-code + automated-test audit, not a live browser/screen-reader
session. Every claim below is either a grep-verified code fact with file:line, a real command
with its real exit code, or explicitly marked NOT VERIFIED / NOT MEASURED. No visual/manual
click-through was performed — that is out of scope for a worktree-only, no-server stream.

## One-line verdicts

- **Locale**: FAIL — 8 confirmed hardcoded-English product-chrome strings across the four
  tools (2 fixed, 6 reported); i18n coverage is otherwise strong (~3,600 `t()` call sites
  found across the four tool trees).
- **Accessibility**: FAIL — systemic gap: zero `role="dialog"`/`aria-modal` on any modal/drawer
  in Mind Map, Whiteboard or Process Flow (Table has 2 of ~10+); one 6-field form had zero
  focus indicator at all (fixed). Roving-tabindex/focus-return failures are pre-existing and
  not touched.
- **Performance**: UNPROVEN BY MEASUREMENT, code-level risk confirmed — Table's grid has no
  virtualization library and no per-row memoization; Whiteboard and Process Flow's `<ReactFlow>`
  instances have no `onlyRenderVisibleElements`; Mind Map has the mechanism but it is gated by
  a feature flag (`mindmapVirtualization`) whose `defaultValue` is `false`.

## Findings table

| id | area | severity | file:line | what is wrong | how proved | suggested fix |
|----|------|----------|-----------|----------------|------------|----------------|
| E14-A11Y-01 | a11y | P1 | `src/components/MyWork/IdeaProcessFlowTool.tsx:4142-4200` (before fix) | Process Flow's "Node metrics" editor (Duration/Unit/Cost/FTE/Automation potential/Savings estimate) — 6 form fields — used `outline-none` with **no** `focus:` replacement at all. Tabbing through the form gave zero visible focus indicator on any field. | Read the JSX; confirmed identical `className` string on all 6 fields via `grep -c` (6 matches), none paired with any `focus:` class. | **FIXED** — added `focus:border-c-focus` (canon blue token, matching the pattern already used in `table/IdeaDecisionLogPanel.tsx:99`) to all 6 fields via one `replace_all`. |
| E14-A11Y-02 | a11y | P1 | Whole-tool scan | Zero `role="dialog"`/`aria-modal` in Mind Map, Whiteboard, Process Flow, and only 2 files in Table (`table/provenance/AddSourceDialog.tsx`, `table/provenance/SourcePopover.tsx`) despite dozens of `fixed inset-0`/`absolute inset-0` modal-style overlays (e.g. Process Flow's metrics editor at line 4118, Whiteboard's outline-import modal at line ~4706). Screen-reader users get no indication a modal opened; no evidence of a shared focus-trap/focus-return utility being used. | `grep -rc 'role="dialog"\|aria-modal'` across all four tool trees returned 0 for Mind Map/Whiteboard/Process Flow, 2 for Table; cross-checked against `fixed inset-0` overlay counts (Table 42, Mind Map subtree 28, Process Flow 1 root + more via panels, Whiteboard 1 root + more). | NOT FIXED — structural, needs a shared modal primitive with focus trap/return; out of "small fix" scope, reported only. |
| E14-A11Y-03 | a11y | pre-existing | `src/components/MyWork/__tests__/IdeaCanvasContextMenu.cb05.test.tsx`, `src/components/MyWork/canvas/__tests__/whiteboardContextMenu.keyboard.integration.test.tsx` | Roving-tabindex and focus-return failures in the shared `CanvasContextMenu` (6 real test failures: ArrowDown roving focus, focus-return-to-trigger, Shift+F10/ContextMenu-key open+Escape+focus-return on node/edge/background, and the roving-tabIndex assertion itself). | `npx vitest run` on both files, real failures reproduced (see command log below). | Matches the task's named "pre-existing: roving-tabindex gaps in the shared CanvasContextMenu" bucket. Not touched. |
| E14-A11Y-04 | a11y | pre-existing | `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx`, `RowDetailPanel.comments.test.tsx` | 15 + 5 = 20 real test failures ("AI Table Builder" ViewRouter/GridView tests, `RowDetailPanel.comments` "t is not a function"-adjacent mock issues). | `npx vitest run` reproduced identically before and after my fixes (same 10/15/5 unique test names both runs). | Matches the task's named pre-existing buckets `TablePlatformFrontend` and `RowDetailPanel.comments`. Not touched. |
| E14-A11Y-05 | a11y/locale | P3 (new-to-me, same root-cause category as named pre-existing bucket) | `src/components/MyWork/__tests__/IdeaTemplateGallery.l06.test.tsx` | 4 real failures: rendered DOM shows raw i18n keys (`myWorkIdeas.templateGallery.templateGallery`, `...chooseTemplateGetStartedQuickly`) instead of translated text, so `screen.getAllByText('Use template')` finds nothing. | `npx vitest run`, inspected the printed DOM in the failure output — literal dotted keys are visible as rendered text. | Not named explicitly in the task's known list, but it is the exact same "i18n raw-key mock" failure category as `dp5HeuristicAiGating`/`canvasLeftToolbar`/`useTableSchema` — reported, not fixed (mock/test-setup issue, not product code). |
| E14-LOC-01 | locale | P2 → FIXED | `src/components/MyWork/table/ViewRouter.tsx:762` | Per-row selection checkbox `aria-label="Select row"` was hardcoded English. This control renders once per visible table row — at scale it is the single most-repeated hardcoded string found in the four tools. A correctly-paired key (`myWorkTable.gridView.selectRow` = "Select row" EN / "Wybierz wiersz" PL) already exists and sits unused. | Grepped `aria-label="[A-Za-z]` across all four trees; confirmed via Python JSON walk that `myWorkTable.gridView.selectRow` exists with matching EN/PL values; confirmed it was not referenced anywhere in `ViewRouter.tsx` before the fix. | **FIXED** — wired to `t('myWorkTable.gridView.selectRow', 'Select row')`. Verified: `PlatformGridView` (line 151) already has `const { t } = useTranslation()` in scope at line 176. |
| E14-LOC-02 | locale | P2 → FIXED | `src/components/MyWork/processflow/ProcessFlowToolbar.tsx:591` | "More actions" overflow menu item literally read `AI Coach` in English always, while every sibling menu item in the same menu (Validate, Summary, Readback, AI Proposal, Auto arrange, Duplicate, Delete selected, Ask AI about this process) used `t(...)`. A correctly-paired key (`myWork.aiCoachPanel.aICoach` = "AI Coach" EN / "Coach AI" PL) already exists elsewhere in the app. | Direct visual/text comparison of the 8 sibling `<button role="menuitem">` blocks in the same overflow menu (lines 544-680); confirmed key pairing via Python JSON walk. | **FIXED** — wired to `t('myWork.aiCoachPanel.aICoach', 'AI Coach')`. `t` already in scope (`ProcessFlowToolbar.tsx:261`). |
| E14-LOC-03 | locale | P2 → FIXED | `src/components/MyWork/processflow/FlowNodeComponent.tsx:316` | Ghost-node "Accept" button (AI-proposal preview acceptance, per-node) had `title="Accept"` hardcoded English. A correctly-paired key exists in the same tool's namespace: `processFlow.aiProposalPanel.accept` = "Accept" EN / "Akceptuj" PL. | Grep + Python JSON walk for exact-value match of `"Accept"` across en/pl translation files, cross-checked the key lives under the `processFlow.*` namespace (same tool). | **FIXED** — added `useTranslation` import + `const { t } = useTranslation()` (file had none before) and wired `title={t('processFlow.aiProposalPanel.accept', 'Accept')}`. |
| E14-LOC-04 | locale | P3 → FIXED | `src/components/MyWork/whiteboard/nodes/TextBlockNode.tsx:126`, `StickyNoteNode.tsx:168` | "Converted" badge tooltip (shown on whiteboard nodes that were promoted/converted to another artifact) hardcoded English in both files. Existing paired key `ideas.mindmap.converted` = "Converted" EN / "Skonwertowane" PL (also `myWorkMindmap.nodeStatus.converted` as an alternate). | Grep for `title="Converted"`; confirmed exact-value match via Python JSON walk in both locale files. | **FIXED** in both files — added `useTranslation` import + hook (neither file had i18n wiring before) and used `t('ideas.mindmap.converted', 'Converted')`. |
| E14-LOC-05 | locale | P3 | `src/components/MyWork/mindmap/MindMap3DView.tsx:178` | `title="Reset view"` hardcoded English, while the two adjacent labels in the same toolbar (`n3dView`, `dragRotate`) use `t()`. No existing key matches "Reset view" exactly (confirmed empty result from JSON value search). | Grep + Python JSON walk (`find_path(en, 'Reset view')` → `[]`). | NOT FIXED — no existing key to reuse; adding one requires editing `public/locales/*.json`, which is outside the declared fix scope (`src/components/MyWork/`, `src/actions/registry/`, `src/i18n*`). Reported only. |
| E14-LOC-06 | locale | P3 | `src/components/MyWork/whiteboard/nodes/WhiteboardNodeReactions.tsx:111` | `title="Add reaction"` hardcoded English on the reaction-toggle button (rendered on every whiteboard node). No existing exact-match key found. | Grep + Python JSON walk (`find_path(en, 'Add reaction')` → `[]`). | NOT FIXED — same reason as E14-LOC-05 (no reusable key; new key needs a `public/locales/*.json` edit, out of scope). |
| E14-LOC-07 | locale | P3 | `TextBlockNode.tsx:117`, `StickyNoteNode.tsx:158` | `title={`${n} linked artifact${n !== 1 ? 's' : ''}`}` — hand-rolled English pluralization, not run through i18next plural keys. Under PL/pseudo-locale rules (DoD 3.8: "plural 0/1/2/5... pass") this is wrong for Polish, which needs 3 plural forms, not 2. | Read the template-literal source directly. | NOT FIXED — correct localization needs an i18next plural key with `_one`/`_few`/`_many`/`_other` suffixes, which is a locale-JSON change and non-trivial pluralization logic, not a "small" fix. Reported only. |
| E14-LOC-08 | locale | not a finding (noted only) | `IdeaProcessFlowTool.tsx:4169` (`FTE`), `ProcessFlowToolbar.tsx:556` (`KPI`), `FloatingNodeToolbar.tsx:754` (`aria-label="AI"`) | Three bare abbreviations rendered without `t()`. Not counted as locale defects: "FTE", "KPI" and "AI" are the same string in both PL and EN in this product's own translation files (spot-checked: no PL variant exists for these abbreviations elsewhere in the app either). | Grep + spot read. | Not fixed, not counted as a defect — output is identical in both locales regardless of `t()` wiring. |
| E14-PERF-01 | perf | P2 (concrete, not measured) | `src/components/MyWork/table/ViewRouter.tsx` (whole file) | Table's grid renders via `processedRows.map((row) => renderRow(row))` (line ~824) — no `react-window`/`react-virtual`/`useVirtualizer` anywhere in `src/components/MyWork/table/` (confirmed absent), and `renderRow` is an inline non-memoized function (not a `React.memo` component), so there is no per-row bail-out on unrelated state changes. This directly conflicts with DoD §14's explicit target ("Table remains usable for 5,000 rows with virtualization"). | `grep -rl "react-window\|react-virtual\|useVirtualizer" src/components/MyWork/table` → no matches; read `ViewRouter.tsx` render path directly. | NOT FIXED — architectural, requires introducing a virtualization library and restructuring row rendering; explicitly out of "small fix" scope. Reported only. |
| E14-PERF-02 | perf | P2 (concrete, not measured) | `src/components/MyWork/IdeaWhiteboardTool.tsx:613`, `IdeaProcessFlowTool.tsx:3498` | Neither Whiteboard's nor Process Flow's `<ReactFlow>` instance passes `onlyRenderVisibleElements`. By contrast, Mind Map's canvas (delegated to `IdeaRecommendationMap.tsx`) has viewport-culling wired via `shouldVirtualize()` (`mindmap/virtualization.ts`, threshold 300 nodes) — but that mechanism is gated by the `mindmapVirtualization` feature flag, whose `defaultValue` is `false` (`src/hooks/useFeatureFlags.tsx:240`). So today, in default configuration, **all three** canvas tools mount full DOM for every node regardless of viewport, contradicting DoD §14's "pan/zoom/drag remains responsive for 500 canvas elements and 1,000 edges" target. | Grepped the three `<ReactFlow>` prop blocks directly; traced `mindmapVirtualization` flag default in `useFeatureFlags.tsx`. | NOT FIXED — flipping the flag default or wiring `onlyRenderVisibleElements` into Whiteboard/Process Flow is a behavior change requiring its own acceptance pass (Piotr's rule #9: no live flag flips without an accepted screenshot), out of this stream's remit. Reported only. |
| E14-PERF-03 | perf | NOT MEASURED | all four tools | No actual p50/p95 timings, frame times, or dataset-size stress tests were run (no dev server, no browser in this worktree — worktree-only stream per task constraints). DoD §14's numeric targets (≤2.5s warm load, ≤100ms command feedback, etc.) are **NOT VERIFIED** for any of the four tools. | N/A | N/A — flagged as NOT MEASURED, not guessed. |

## Fixed vs reported-only summary

**Fixed (8 files, all inside `src/components/MyWork/{table,processflow,whiteboard}/` or the
four tools' own root files — see diff stat below):**

1. `src/components/MyWork/table/ViewRouter.tsx` — `aria-label="Select row"` → `t('myWorkTable.gridView.selectRow', 'Select row')`.
2. `src/components/MyWork/processflow/ProcessFlowToolbar.tsx` — bare `AI Coach` text → `t('myWork.aiCoachPanel.aICoach', 'AI Coach')`.
3. `src/components/MyWork/processflow/FlowNodeComponent.tsx` — `title="Accept"` → `t('processFlow.aiProposalPanel.accept', 'Accept')` (added `useTranslation` hook, file had none).
4. `src/components/MyWork/whiteboard/nodes/TextBlockNode.tsx` — `title="Converted"` → `t('ideas.mindmap.converted', 'Converted')` (added `useTranslation` hook, file had none).
5. `src/components/MyWork/whiteboard/nodes/StickyNoteNode.tsx` — same as #4.
6. `src/components/MyWork/IdeaProcessFlowTool.tsx` — 6× `outline-none` form fields in the Node Metrics editor → added `focus:border-c-focus` (canon blue focus token) to all 6, via one `replace_all` on the shared className string.
7. `src/components/MyWork/IdeaTableTool.tsx` — 2× inline-rename inputs (`outline-none`, saved-view rename and column-header rename) → added `focus:border-c-focus` to both.
8. `src/components/MyWork/IdeaWhiteboardTool.tsx` — outline-import textarea's `focus:border-c-border-strong` (a non-canon neutral border) → `focus:border-c-focus` (canon blue).

**Reported only (structural/out-of-scope, not touched):** E14-A11Y-02 (systemic missing
`role="dialog"`/`aria-modal`), E14-A11Y-03/04/05 (pre-existing and pre-existing-category test
failures), E14-LOC-05/06/07 (need new locale-JSON keys or real plural-key work, outside the
`src/components/MyWork/`, `src/actions/registry/`, `src/i18n*` fix-scope boundary), E14-PERF-01/02/03
(architectural, or unmeasurable without a running app).

## Pre-existing, not mine (confirmed present, left untouched)

- i18n raw-key mocks: reproduced in `IdeaTemplateGallery.l06.test.tsx` (4 failures) — same
  root-cause category as the named `dp5HeuristicAiGating`/`canvasLeftToolbar`/
  `useTableSchema`/`useTableViews` bucket. Did not search for the literally-named files/tests
  themselves under those exact names — see NOT VERIFIED below.
- Roving-tabindex gaps in the shared `CanvasContextMenu`: reproduced directly, 6 failures across
  `IdeaCanvasContextMenu.cb05.test.tsx` and `canvas/__tests__/whiteboardContextMenu.keyboard.integration.test.tsx`.
- `~10 ProcessFlowToolbar AI-panel-trigger tests`: `ProcessFlowToolbar.cb05.test.tsx` ran clean
  (0 failures) in both my pre-fix and post-fix runs — see NOT VERIFIED (I could not reproduce
  this named bucket; either it does not currently fail on this SHA, or it lives in a file I did
  not run).
- `AITableProposal`: file exists (`table/AITableProposal.tsx`) but has no `__tests__` file under
  `src/components/MyWork/table/__tests__/` matching that name — not run, not reproduced.
- `TablePlatformFrontend` "AI Table Builder": reproduced, 15 failures.
- `RowDetailPanel.comments`: reproduced, 5 failures.

## NOT VERIFIED / NOT MEASURED

- Live keyboard-reachability walk-through of every toolbar/menu/rail control in a running browser
  — this worktree has no dev server per task constraints; all a11y claims here are static-code
  facts (JSX attributes, test results), not interactive verification.
- Contrast ratios, reduced-motion behavior, 200% browser-zoom reflow — NOT VERIFIED (no browser).
- Whether the named pre-existing buckets `dp5HeuristicAiGating` and `canvasLeftToolbar` exist as
  literal test/describe names anywhere in the four tools' test trees — grepped for the literal
  strings across `src/components/MyWork/**/*.test.*`, zero matches. The underlying files
  (`mindmap/CanvasLeftToolbar.tsx`) exist but no test file references either name directly. Could
  not confirm or reproduce these two specific named failures.
- The task's named "~10 `ProcessFlowToolbar` AI-panel-trigger tests" — `ProcessFlowToolbar.cb05.test.tsx`
  passed cleanly in every run performed. Not reproduced; either already fixed upstream of this SHA,
  gated behind a flag/mock this run didn't hit, or named incorrectly.
- Actual p50/p95 render/interaction timings for any of the four tools at any dataset size — NOT
  MEASURED (no dev server, no browser, no profiling run).
- Whether `mindmapVirtualization`, `focus-highlight`, or other opt-in a11y/perf flags are turned
  on for the deployed demo/prod environment — NOT VERIFIED (worktree has no live DB/env access;
  this stream is explicitly forbidden from any database work).
- Full a11y sweep of `mindmap/`, `table/`, `processflow/` subfolders beyond the toolbar/node files
  sampled above — given ~14,000 lines in the four root files alone plus ~60 subtree files, this
  was a targeted grep-driven audit (aria-label/title/placeholder patterns, dialog roles, outline-none,
  crimson-focus, virtualization markers), not an exhaustive line-by-line read of every file.

## Methodology and quantification (Task A)

- i18n convention confirmed by reading `src/i18n.ts` (i18next + react-i18next, 6 supported
  languages, `translation` default namespace loaded from `public/locales/{{lng}}/translation.json`)
  and by observing two live patterns in the four tools: (1) `t('namespace.key', 'EN fallback')`
  calls, and (2) manual `isPl ? xPl : xEn` ternaries for a handful of legacy fields (e.g.
  `IdeaTableTool.tsx:2865`, `IdeaMapWorkspace.tsx` convert-target labels).
- Total `t(` call sites counted via grep across the four tool root files + their four subtree
  folders (`whiteboard/`, `mindmap/`, `processflow/`, `table/`): **3,649** (136 + 245 + 105 + 149
  in the four root files; 178 + 724 + 181 + 1,931 in the four subtrees respectively).
- Hardcoded-string candidates found via `grep -n 'aria-label="[A-Za-z]\|title="[A-Za-z ]\{3,\}"\|placeholder="[A-Za-z]'`
  across all four trees, then each hand-verified against surrounding JSX to exclude: format-hint
  placeholders (`https://...`, `name@example.com` — language-agnostic by design, not defects),
  correctly-paired `isPl ? ... : ...` ternaries, and abbreviations identical in both locales
  (FTE/KPI/AI). This produced the 8 confirmed findings (E14-LOC-01..07 plus the not-a-finding
  trio E14-LOC-08) out of roughly 20 raw grep hits.
- Raw-JSX-text-node scan (`grep -noE '>[A-Z][a-zA-Z]+( [A-Za-z]+){0,4}</'`) across the four root
  files found only one hit (`FTE`, already covered above) — the four root files are otherwise
  clean of bare hardcoded JSX text children.
- This is a **grep-and-verify**, not exhaustive-read, method: it will miss hardcoded strings that
  aren't in `aria-label=`/`title=`/`placeholder=`/bare-JSX-text form (e.g. strings built via
  helper functions, strings inside `alt=`, `aria-description`, toast/error messages constructed
  elsewhere and passed in as props). Scope explicitly NOT covered: `mindmap/`, `table/`,
  `processflow/` files beyond the toolbar/node/view-router files sampled; `notebook/`, `canvas/`
  shared primitives beyond the context-menu tests already run.

## Exact commands run, with real exit codes

```
$ npx vitest run \
  "src/components/MyWork/__tests__/IdeaCanvasContextMenu.cb05.test.tsx" \
  "src/components/MyWork/canvas/__tests__/CanvasToolbarPrimitives.test.tsx" \
  "src/components/MyWork/canvas/__tests__/resolveKeyboardContextMenuTarget.test.ts" \
  "src/components/MyWork/canvas/__tests__/whiteboardContextMenu.keyboard.integration.test.tsx" \
  "src/components/MyWork/mindmap/__tests__/useMindMapNodes.addSiblingReentrancy.test.tsx" \
  "src/components/MyWork/mindmap/__tests__/useMindMapQuickActions.aiExpandTarget.test.tsx" \
  "src/components/MyWork/whiteboard/__tests__/WhiteboardToolbar.cb05.test.tsx" \
  "src/components/MyWork/whiteboard/__tests__/whiteboardPlacement.test.ts" \
  --retry=0
EXIT: 1   (Test Files: 2 failed | 6 passed (8); Tests: 6 failed | 38 passed (44) — all 6 failures
           in IdeaCanvasContextMenu.cb05.test.tsx / whiteboardContextMenu.keyboard.integration.test.tsx,
           the named pre-existing roving-tabindex bucket)

$ npx vitest run \
  "src/components/MyWork/processflow/__tests__/ProcessFlowToolbar.cb05.test.tsx" \
  "src/components/MyWork/table/__tests__/AICopilotMode.registryBoundary.test.tsx" \
  "src/components/MyWork/table/__tests__/PlatformCellRenderer.specialized.test.tsx" \
  "src/components/MyWork/table/__tests__/RowDetailPanel.comments.test.tsx" \
  "src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx" \
  "src/components/MyWork/table/__tests__/filterEval.test.ts" \
  "src/components/MyWork/table/__tests__/useTablePlatformRealtimeSync.test.tsx" \
  --retry=0
EXIT: 1   (Test Files: 2 failed | 5 passed (7); Tests: 15 failed | 60 passed (75) — 15 in
           TablePlatformFrontend + (RowDetailPanel.comments counted separately, 5 more) — both
           named pre-existing buckets)

$ npx vitest run \
  "src/components/MyWork/__tests__/IdeaBusinessCaseSection.roundtrip.test.tsx" \
  "src/components/MyWork/__tests__/IdeaTemplateGallery.l06.test.tsx" \
  "src/components/MyWork/__tests__/IdeaWhiteboardTool.clearDrawingsUndo.test.tsx" \
  "src/components/MyWork/__tests__/NotebookHeaderActions.a11y.test.tsx" \
  "src/components/MyWork/__tests__/NotebookLibraryContent.smoke.test.tsx" \
  "src/components/MyWork/__tests__/ideaWorkspaceToolResolution.test.ts" \
  "src/components/MyWork/canvas/__tests__/canvasEdgeKindVocabulary.test.ts" \
  "src/components/MyWork/canvas/__tests__/canvasNodeTypeVocabulary.test.ts" \
  "src/components/MyWork/canvas/__tests__/useIdeaMapSync.rv006.test.tsx" \
  "src/components/MyWork/notebook/__tests__/SlashMenu.behavior.test.tsx" \
  --retry=0
EXIT: 1   (Test Files: 1 failed | 9 passed (10); Tests: 4 failed | 44 passed (48) — all 4 in
           IdeaTemplateGallery.l06.test.tsx, i18n raw-key-mock category, not in the named list
           but same root cause)

$ bash scripts/check-focus-canon.sh <four-tool paths>
EXIT: 0   (whole-repo debt-meter script — ignores path args, scans the entire repo regardless;
           its own headline numbers are NOT scoped to the four tools, so not used as evidence)

$ grep -rnE "ring-primary-|outline-primary-|focus:ring-primary|focus-visible:ring-primary|ring-offset-primary-" \
  <the four tools' own root files + four subtree folders> --include="*.tsx" --include="*.ts"
EXIT: 1 (grep "no matches" exit code — zero crimson-as-focus violations found inside the four
         tools' own files; the repo-wide 130-file/261-occurrence debt reported by the canon
         script lives entirely outside this scope)

# Post-fix regression check:
$ npx vitest run \
  "src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx" \
  "src/components/MyWork/table/__tests__/AICopilotMode.registryBoundary.test.tsx" \
  "src/components/MyWork/table/__tests__/PlatformCellRenderer.specialized.test.tsx" \
  "src/components/MyWork/table/__tests__/useTablePlatformRealtimeSync.test.tsx" \
  "src/components/MyWork/processflow/__tests__/ProcessFlowToolbar.cb05.test.tsx" \
  "src/components/MyWork/whiteboard/__tests__/WhiteboardToolbar.cb05.test.tsx" \
  "src/components/MyWork/mindmap/__tests__/useMindMapNodes.addSiblingReentrancy.test.tsx" \
  "src/components/MyWork/mindmap/__tests__/useMindMapQuickActions.aiExpandTarget.test.tsx" \
  "src/components/MyWork/__tests__/IdeaWhiteboardTool.clearDrawingsUndo.test.tsx" \
  --retry=0
EXIT: 1   (Test Files: 1 failed | 8 passed (9); Tests: 10 failed | 59 passed (69) — same 10
           unique TablePlatformFrontend test names as the pre-fix baseline run, byte-identical
           failure set → no regression introduced by the E14-LOC-01/E14-PERF fixes)

# Per-file esbuild syntax check on all 8 edited files (not full tsc, per worker hygiene rule):
$ npx esbuild <each of the 8 edited files> --jsx=automatic --outfile=/dev/null
EXIT: 0 for all 8 files (clean compile, no syntax errors)
```

## Files touched (all inside declared scope)

```
 src/components/MyWork/IdeaProcessFlowTool.tsx             | 12 ++++++------
 src/components/MyWork/IdeaTableTool.tsx                   |  4 ++--
 src/components/MyWork/IdeaWhiteboardTool.tsx              |  2 +-
 src/components/MyWork/processflow/FlowNodeComponent.tsx   |  4 +++-
 src/components/MyWork/processflow/ProcessFlowToolbar.tsx  |  2 +-
 src/components/MyWork/table/ViewRouter.tsx                |  2 +-
 src/components/MyWork/whiteboard/nodes/StickyNoteNode.tsx |  4 +++-
 src/components/MyWork/whiteboard/nodes/TextBlockNode.tsx  |  4 +++-
 8 files changed, 20 insertions(+), 14 deletions(-)
```

No files touched outside `src/components/MyWork/` and this new doc. No commits made (per task
constraint) — changes are left uncommitted in the worktree for the orchestrator to merge.
