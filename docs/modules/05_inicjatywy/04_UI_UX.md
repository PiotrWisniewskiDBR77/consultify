---
module_id: MODULE_INITIATIVES
doc_kind: UI_UX
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# UI/UX — Inicjatywy

## 1. Main Screen

As-Is: `/initiatives` renders `InitiativesHub` in a no-padding module workspace layout. Related initiative lane surfaces remain available through `/roadmap`, `/portfolio` and `/roi`. The screen job is initiative portfolio work across kanban/list/timeline/grid, table+preview and open-document patterns.

## 2. Runtime States

- Loading: hub refresh/loading states must be visible before initiative data is trusted.
- Empty: no-initiative or filtered-empty states must tell the user how to create, import, clear filters or inspect another scope.
- Error: failures must use toast/banner handling and must not leave stale data looking current.
- Degraded: pilot restrictions, partial portfolio data or unavailable linked lanes must be visible.
- Success: creation, update, status transition or deep-link open must confirm the result and identify the next review/action.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the initiative command row for the active view, selected initiative or open document. `InitiativesHub` may register analysis action nodes in command-row space.

## 4. AI Actions Placement

Initiative analysis actions must render in Menu 3/right-side command space or row-scoped controls. The same AI action must not appear both in the initiative canvas and in Menu 3.

## 5. Next Action Guidance

The UX must tell the user whether to create/refine an initiative, review assumptions, move status, open linked ROI/roadmap data, clear filters or request access.

## 6. Source / Evidence / Provenance

Initiative recommendations, expected value and status summaries must show linked source documents, interviews, ROI assumptions or explicit missing-evidence status.

### 6.1 Initiative Card System UI Contract

`INITIATIVE_CARD_SYSTEM_CONTRACT.md` is the canonical UI contract for Initiative Card variants.

| Context | Variant | UI obligation | Evidence pointer |
| --- | --- | --- | --- |
| `/initiatives` list/table | List row card | Dense identity, status, owner/priority/date, selection and preview. | `PortfolioListView` inside `InitiativesHub`. |
| `/initiatives` kanban | Kanban card | Status-column card with backend-gated status action behavior. | `PortfolioKanbanView` inside `InitiativesHub`. |
| `/initiatives` timeline | Timeline card | Dates, baseline/readiness and schedule clarity. | `InitiativesTimelineView` inside `InitiativesHub`. |
| `/initiatives` grid | Grid card | Compact visual summary and preview open. | `InitiativeGridCard` inside `InitiativesHub`. |
| `/initiatives?open=<id>` | Preview/detail card | Same initiative identity, source/evidence, AI chat opener and handoff links. | `InitiativePreviewV3` and deep-link handling in `InitiativesHub`. |
| `/roadmap`, `/portfolio`, `/roi` | Lane card/reference | Context-specific emphasis without duplicating initiative truth. | Function contracts and lane views. |

AI actions attached to card context must live in Menu 3/right-side command space and must not be duplicated inside the canvas.

## 7. Approval / Diff / Review

High-impact transitions, portfolio decisions and value/ROI changes require explicit gated actions and visible review/diff where available. No hidden mutation path is allowed.

## 8. Anti-Patterns

- Status/value changes without review or visible result.
- AI recommendation without source/evidence.
- Hidden pilot/role denial.
- Duplicated AI toolbar in canvas.
- Stale portfolio data presented as current success.

## 9. As-Is Gaps

- Existing docs confirm hub state, status/filter chips and gated actions, but the per-transition approval/diff UI matrix is not fully enumerated.
- Provenance display for all initiative recommendations and ROI links needs runtime validation.

## 10. Acceptance Criteria

- `/initiatives` renders `InitiativesHub` as the main initiative screen.
- Loading, empty, error, degraded and success states are visible across portfolio views.
- AI analysis actions use Menu 3/right-side placement without duplication.
- Initiative claims and value data show source/provenance or missing-evidence status.
- High-impact transitions require explicit review/approval.

## 11. Function Annex — Initiatives Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Owner business | Owner tech | Evidence gate | Contract |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Portfolio Hub | `/initiatives` | real | `InitiativesHub` (table/kanban/timeline/grid + preview) | user | user | `NOT_DONE`: missing dedicated card/lifecycle UI regression | `functions/IN_PORTFOLIO_HUB.md` |
| `IN_ANALYSIS_WORKSPACE` | Analysis Workspace | `InitiativesHub` tab `analysis` | real | analysis command row + subviews in `InitiativesHub` | user | user | `NOT_DONE`: missing dedicated analysis UI regression | `functions/IN_ANALYSIS_WORKSPACE.md` |
| `IN_ROADMAP_VIEW` | Roadmap View | `/roadmap` | real | `FullRoadmapView` | user | user | `NOT_DONE`: lane smoke not bound | `functions/IN_ROADMAP_VIEW.md` |
| `IN_PORTFOLIO_VIEW` | Portfolio Route View | `/portfolio` | real | `PortfolioView` | user | user | `NOT_DONE`: lane smoke not bound | `functions/IN_PORTFOLIO_VIEW.md` |
| `IN_ROI_VIEW` | ROI View | `/roi` | real | `FullROIView` | user | user | `NOT_DONE`: lane smoke not bound | `functions/IN_ROI_VIEW.md` |

## 12. UI/UX Gate Matrix

| Gate | Expected evidence | Current status |
| --- | --- | --- |
| Loading | `InitiativesHub` `isLoading` / `isRefreshing` or lane-level equivalent is visible before trusted data. | `PASS_DOC`, runtime screenshot/test evidence needed |
| Success | Create/update/transition/open/handoff has visible confirmation or next action. | `PASS_DOC`, runtime UI evidence needed |
| Error | Toast/banner/inline error is visible and stale data is not presented as current. | `PASS_DOC`, runtime UI evidence needed |
| Empty | Empty and filtered-empty states explain cause and next action. | `PASS_DOC`, runtime UI evidence needed |
| Degraded | Permission, pilot, partial-data and missing-evidence states are explicit. | `PASS_DOC`, runtime UI evidence needed |
| Toast/Banner | Critical mutations produce honest user feedback. | `NOT_DONE`, no bound transition/card UI test evidence |
| Refresh/Read-back | Mutations remain visible after refetch/refresh. | `NOT_DONE`, no bound initiative UI read-back evidence |
| Menu 3 AI Actions | Contextual AI actions are in Menu 3/right-side command space and not duplicated in canvas. | `PASS_DOC`, runtime UI audit needed |
| DBR77/Semantic Colors | Status chips/cards use shared semantic status language, not color-only meaning. | `PASS_DOC`, runtime UI audit needed |

## 13. Function Annex — `IN_ANALYSIS_WORKSPACE`

Scope: this annex governs only `/initiatives` -> `InitiativesHub` tab `analysis` and the five analysis subviews. It does not redefine portfolio hub, roadmap, portfolio route or ROI route behavior.

### 13.1 Purpose And Layout

The Analysis tab is the initiative readiness workspace for checking workload, feasibility, logic/dependencies, timeline and completeness before governance or scheduling action. It uses `ModuleHub.commandRowContent` as Menu 3: subview chips render on the left side of the local command row and contextual AI/action buttons registered by subviews render on the right side.

Runtime naming note: author scope names the first subview `workload`; current implementation uses `resources`. The UI contract treats these as the same subview until product copy is normalized.

### 13.2 Sub-View UI Matrix

| Sub-view | User job | Component footprint | Data dependencies | CTA actions | Role gating | AI actions | Critical risks | Acceptance criteria | Evidence pointers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `workload` / runtime `resources` | Understand team load and rebalance ownership before scheduling. | `InitiativesHub` analysis tab, `PortfolioAnalysisView`, `ResourcesAnalysis`. | Initiative list, users, owner fields, backend capabilities. | Open initiative, sort/filter, explicit owner reassignment. | Reassignment/edit only when backend capability allows. | AI rebalancing only in Menu 3 right-side action slot; proposal must be reviewed before apply. | Over-allocation can be stale if users/assignments are partial; local role inference could bypass backend. | Over/under allocation and empty/degraded states are visible; apply actions are explicit and refetched. | Route `/initiatives`; API `/api/initiatives`, `gate-readiness-check`; tests no dedicated UI regression. |
| `feasibility` | Judge budget, skills, time and risk feasibility. | `PortfolioAnalysisView`, `FeasibilityAnalysis`, `usePortfolioAnalysisData`. | Initiative feasibility dimensions, readiness metrics, status/role matrix. | Open initiative, inspect blockers, propose fixes. | Sponsor/PMO/Initiative Owner authority is backend capability-driven. | Advisory feasibility recommendations only; no approval authority. | Score may be mistaken for proof if missing evidence is not shown. | Red/amber/green dimensions have visible reasons or missing-evidence state. | API `/api/initiatives/readiness-analysis`; test `tests/integration/initiatives/initiatives.readiness-analysis.test.ts`. |
| `logic` | See dependency graph, conflicts, cycles and sequencing. | `PortfolioAnalysisView`, `LogicAnalysis`, `DependencyGraphCanvas`. | Portfolio dependencies, initiative dates/status, dependency API. | Open initiative, create/delete dependency, inspect graph. | Dependency writes require capability and tenant/project scope. | AI discovery, cycle and sequencer actions stay proposal-only until accepted. | Bad dependency writes can alter planning truth; graph can imply causality without evidence. | Dependencies and timing conflicts are visible; create/delete is explicit with feedback. | API `/api/initiatives/portfolio/dependencies`; no dedicated UI regression. |
| `timeline` | Check dates, conflicts, delay impact and scheduling options. | `PortfolioAnalysisView`, `TimelineAnalysis`. | Planned start/end, dependencies, readiness rules, V8 planning readiness. | Open initiative, edit dates, apply schedule proposal. | Date/schedule edits require backend capability; baseline policy follows status matrix. | Auto-schedule/optimizer/delay impact proposals only; Menu 3 right side. | Hidden schedule changes or premature baseline mutation would violate PMO governance. | No-date/delayed/at-risk/on-schedule states are distinguishable; date mutation is explicit and validated. | API `/api/initiatives`, `/api/v8/planning/initiatives/:initiativeId/gate-readiness-check`; test `server/src/routes/v8/__tests__/planning.routes.test.ts`. |
| `completeness` | Identify missing fields/evidence before gate readiness. | `PortfolioAnalysisView`, `CompletenessAnalysis`, optional `InitiativeCompletenessChecker`. | Completeness rows, readiness analysis, section types, source/provenance. | Open initiative, inspect missing critical fields, apply auto-fill proposal. | Fix/apply requires capabilities; `CANCELLED`/`ARCHIVED` stays inactive. | Auto-fill, bulk fix and triage are proposal-only; Menu 3 right side. | AI could fabricate missing evidence if provenance is not enforced. | Missing critical/total counts and gate-ready state are explainable; no silent auto-fill. | API `/api/initiatives/readiness-analysis`, `/api/initiatives/section-types`; tests `InitiativeCompletenessChecker.test.tsx`, `initiatives.section-types.test.ts`. |

### 13.3 Runtime State UX

| State | Analysis tab obligation |
| --- | --- |
| `loading` | Show untrusted/loading state for initiative list, dependencies or readiness data before analysis claims appear. |
| `empty` | Explain no initiatives or filtered-empty result and offer clear next action such as create/import/clear filters. |
| `error` | Surface toast/banner/inline failure and avoid presenting stale analysis as current success. |
| `degraded` | Show read-only/partial state for missing users, missing dependency data, denied capability, disabled AI or missing evidence. |
| `success` | Render current rows/cards/graph and confirm explicit mutations through toast/read-back/refetch. |

### 13.4 AI / CTA Placement

- AI actions for all five subviews must use the Menu 3 right-side slot exposed through `onRegisterActions` / `commandRowContent`.
- The same AI action must not be duplicated inside the analysis canvas.
- AI is available only when backend `capabilities.ctaBar.canUseAi = true`; otherwise the CTA may remain visible but disabled with an explanatory message.
- AI outputs are proposals/diffs. Applying them is a separate user action and must pass backend capability/tenant checks.

### 13.5 Raw Visual Packet Status

Required visual labels for this contract cycle are: workload, wykonalność, logika/dependencies, harmonogram and kompletność. The requested files under `assets/Screenshot_2026-05-10_at_19.48*.png` were not found in the active workspace during documentation update, so this annex binds visual intent by subview label and records the missing screenshots as an evidence gap rather than runtime proof.

## 14. Module Integration UI/UX Baseline

This UI/UX contract is integrated for `05_inicjatywy/MODULE_INTEGRATION`.

| Surface | UI/UX rule | Evidence status |
| --- | --- | --- |
| `/initiatives` portfolio hub | Initiative card variants, preview/detail, lifecycle CTAs and AI actions must remain backend-capability-driven. | `PASS_DOC`, dedicated card UI regression missing |
| `/initiatives` analysis tab | Five subviews use the local command row; contextual AI/actions must sit in Menu 3 right-side space only. | `PASS_DOC`, dedicated Analysis UI regression missing |
| `/roadmap` | Roadmap is a scheduling/projection surface and must not become duplicate initiative truth. | `PASS_DOC`, lane smoke missing |
| `/portfolio` | Portfolio route is a rollup/prioritization projection and must drill through to initiative truth. | `PASS_DOC`, lane smoke missing |
| `/roi` | ROI route displays value/assumption context while finance/results own their canonical truths. | `PASS_DOC`, initiative ROI lane gate missing |

Integration anti-patterns:

- Duplicating AI actions in Menu 3 and canvas.
- Treating companion lanes as new initiative owners.
- Showing status/role/AI availability from local frontend inference.
- Presenting missing evidence, unavailable source data or failed API calls as success.

## 14. RAW Depth UI/UX Annex

| RAW source | UX decision | Evidence state |
| --- | --- | --- |
| `docs/modules/05_inicjatywy/RAW_INPUT.md` | Initiative cards and analysis surfaces must show source/evidence or missing-evidence state. | `PASS_DOC`; lifecycle/card UI regression `NOT_DONE`. |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | Approved initiative handoff to execution must carry sourceRefs, approval state and scope. | `PASS_DOC`; handoff read-back evidence `NOT_DONE`. |
| `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` | KPI/value targets are handoff context only; Results owns realized measurement. | `PASS_DOC`. |
| `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | ROI/budget assumptions are visible but Finance owns finance model truth. | `PASS_DOC`; finance runtime evidence out of scope. |
