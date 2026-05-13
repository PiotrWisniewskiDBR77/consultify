---
module_id: MODULE_EXECUTION
doc_kind: RAW_TARGET_STATE_2_0_PACKET
version: 1.0
owner: user
status: review
last_updated: 2026-05-10
scope_anchor: 06_realizacja/MODULE_INTEGRATION
work_type: docs-only
---

# RAW Target State 2.0 Packet — Realizacja

## 1. As-Is (Verified)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Execution lane has three active route surfaces. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` define `/execution`, `/implementation`, `/rollout`. | `FullExecutionView`, `ExecutionHub`, `FullRolloutView`. | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/RouterSync.idea-artifact.test.tsx`, `tests/e2e/smoke/wave1-module-closeout.spec.ts` references. | `PASS_WITH_P2` |
| `/implementation` is the shared operating hub for Portfolio, Raporty and Manager. | `/implementation` route renders `ExecutionHub`. | `ExecutionHub` tabs: `list`, `reports`, `people_change`. | Shared `Api`, V8 execution-control client. | `tests/e2e/implementation-module.spec.ts`, `tests/e2e/smoke/pages-render.spec.ts` exist; no fresh run in this docs cycle. | `PASS_WITH_P2` |
| `/execution` is a full-step wrapper over the same execution runtime. | `/execution` route renders `FullExecutionView`. | `FullExecutionView` returns `ExecutionHub`. | Shared runtime APIs only. | `tests/e2e/execution-center.spec.ts` exists; no fresh pass/fail asserted here. | `PASS_WITH_P2` |
| `/rollout` is a separate rollout-focused execution route. | `/rollout` route renders `FullRolloutView`. | `FullRolloutView` renders `FullRolloutWorkspace`, `SplitLayout`, `AIFeedbackButton`. | Session-local rollout state plus V8 execution-control contracts where wired. | `tests/components/RouterSync.idea-artifact.test.tsx` protects `/rollout`; no dedicated workspace regression found. | `PASS_WITH_P2` |
| Execution-control APIs cover timeline, delay, capacity, budget, risk and manager lanes. | n/a | Execution components consume V8 client helpers. | `src/services/api/v8/execution-control.ts`, `server/src/routes/v8/execution-control.routes.ts`. | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts`, `server/src/routes/v8/__tests__/p03-manager-routes.test.ts`. | `PASS` for API contract, `PASS_WITH_P2` for UI evidence |

## 2. Author Target (RAW)

Raw author material defines `Realizacja` as the Consultify Implementation & PMO Engine: a governed execution operating system, not a task manager. The target loop is:

`approved initiative -> project charter/execution plan -> stages/gates -> timeline -> tasks -> decisions -> risks/escalations -> PMO reports -> completion -> Results/ROI/Finance`.

Canonical target requirements from RAW and V8 sources:

- one execution truth across Portfolio, Raporty, Manager, full execution route and rollout route;
- sharp boundary against `05_inicjatywy` for initial planning and against `07_rezultaty` for final KPI/ROI truth;
- honest schedule control: baseline, current reality, forecast, intervention and updated credible path;
- predefined PMO report catalog with visible data sources, quality posture and missing-evidence state;
- manager/control-tower lane for action queue, decisions, blockers, risk, workload and people/change;
- AI may explain, triage and draft, but cannot silently approve, mutate, rebaseline, publish or bypass Menu 3 placement;
- every high-impact mutation needs explicit user action, tenant scope, approval/review posture and visible feedback.

## 3. Delta

| Area | As-Is | Target | Delta priority |
| --- | --- | --- | --- |
| Function integration | Five function files exist and map to route/component/API/test evidence. | One module-level contract must bind functions to `00-07`, RAW, handoffs, evidence and gate. | `P0` docs integration |
| Report trust | Reports catalog and evidence contract exist. | Source-less reports must be blocked from clean success through `missing_evidence`. | `P1` runtime validation |
| Menu 3 / AI placement | `ExecutionHub` exposes `rightControls`; preview/footer and rollout AI placement need audit. | All contextual AI actions must be Menu 3/right-side, local action-zone or row-scoped with no duplicates. | `P1` UI evidence |
| Rollout intervention | Rollout route and doctrine exist. | Auto-schedule, optimizer, conflict resolution, timeline update and rebaseline must be proposal/review flows. | `P1` safety evidence |
| Manager governance | Manager lanes and APIs exist. | Approval depth, source rendering and read-back criteria must be proven for high-impact actions. | `P1` evidence |
| Handoffs | Graph has `05 -> 06` and `06 -> 07`; lineage has execution task bundle. | Execution report package and meeting follow-up handoffs need explicit graph/lineage baseline. | `P0` docs integration |

## 4. Contract 2.0 Proposal

### 4.1 Module Decision

`06_realizacja` is one governed execution operating system composed of:

- `RL_EXECUTION_PORTFOLIO` — live execution portfolio on `/implementation`, tab `list`;
- `RL_EXECUTION_REPORTS` — PMO report catalog and report package review on `/implementation`, tab `reports`;
- `RL_EXECUTION_MANAGER` — manager/control-tower intervention lane on `/implementation`, tab `people_change`;
- `RL_FULL_EXECUTION_VIEW` — full-step `/execution` route delegating to shared `ExecutionHub`;
- `RL_ROLLOUT_VIEW` — rollout schedule/baseline/forecast/intervention route on `/rollout`.

### 4.2 Non-Negotiable Contract Rules

1. No function may create a second initiative, task, decision, owner, deadline, report-truth or capacity truth.
2. Every critical module claim must map to route, component, API/service or test evidence.
3. Every generated report, AI readout, rollout proposal or manager recommendation must disclose source/provenance or missing evidence.
4. Every high-impact execution change is explicit, authenticated, tenant-scoped and reviewable.
5. Runtime done is blocked until Menu 3 AI placement and P1 evidence gaps are closed; docs integration may still be approved.

## 5. Cross-Module Impact

| From | To | Handoff / impact | Required lineage |
| --- | --- | --- | --- |
| `05_inicjatywy` | `06_realizacja` | Approved initiative and scope become execution operating context. | `sourceRefs`, approval state, scope, owner, acceptance criteria. |
| `06_realizacja` | `07_rezultaty` | Delivery evidence and execution status feed realized KPI/ROI validation. | task/decision/blocker evidence, completion state, acceptance refs. |
| `06_realizacja` | `09_outputs` | Execution report packages may be exported/packaged after explicit review. | report definition/run, data sources, quality posture, approval state. |
| `06_realizacja` | `13_meeting` | Execution decisions, blockers and follow-up actions may become meeting agenda/summary inputs. | source objects, decision refs, action owners, due dates. |
| `02_moja-praca` | `06_realizacja` | My Work can surface execution actions as derived work pointers only. | owner module stays `06_realizacja` or upstream canonical module. |
| `16_organizacja`, `17_panel-administratora`, `18_ustawienia` | `06_realizacja` | Org context, policies and preferences constrain access and display. | tenant/project/role scope; no override of execution truth. |

## 6. Delivery Plan

### P0 — Docs Integration Baseline

- Merge function decisions into `03_BEHAVIOR.md`, `04_UI_UX.md`, `05_DATA_AND_INTEGRATIONS.md`, `06_PERMISSIONS_AND_SECURITY.md`, `07_ACCEPTANCE_AND_TESTS.md`, `STATUS.md` and `CHANGELOG.md`.
- Add this RAW packet and `INTEGRATION_REPORT.md`.
- Update graph and lineage for explicit execution report package / meeting follow-up handoffs.
- Gate: `npm run docs:contract:rerun-gate`.

### P1 — Runtime Evidence Closure

- Capture Menu 3 / AI placement evidence for `/implementation`, `/execution` and `/rollout`.
- Prove `RL_EXECUTION_REPORTS` missing-evidence behavior.
- Prove rollout high-impact actions are proposal/review flows.
- Prove Manager provenance, approval depth and read-back states.
- Add or identify focused UI/component/e2e evidence for Portfolio, Reports, Manager and Rollout state matrices.

### P2 — Evidence Enrichment

- Attach screenshot/trace/manual Anygravity evidence for table, kanban, timeline, reports table/grid/document, six Manager lanes and rollout baseline/current/forecast/conflict states.
- Decide long-term route identity: `/execution` primary full-step route or compatibility alias to `/implementation`.

## 7. Open Questions

1. Do Portfolio preview/footer chat actions and Manager `onRegisterActions` local lane controls fully satisfy the Menu 3/right-side or row-scoped placement rule?
2. `DECISION_CLOSED_DOCS`: `missing_evidence` is both persisted report trust state and visible UI trust state; source-less reports cannot show clean success/finalization.
3. `DECISION_CLOSED_DOCS`: `/implementation` is the primary sidebar operating hub; `/execution` remains a compatibility/full-step alias over the shared execution runtime unless a future migration retires it.

## 8. Packet Verdict

- Docs integration readiness: `APPROVED_FOR_DOCS`.
- Runtime readiness: `BLOCKED_P1`.
- Reason: route/component/API/test evidence baseline exists, but runtime acceptance still needs Menu 3 placement, missing-evidence, approval/read-back and state-matrix proof.

## 9. Normalized Gap Register

### P0 must close

| Gap | Evidence location | Required closure | Current status |
| --- | --- | --- | --- |
| Module integration packet, taskboard and function cards must stay aligned. | `IMPLEMENTATION_TASK_BOARD.md`; `function-cards/*_EXECUTION_CARD.md`; `INTEGRATION_REPORT.md` | Keep five function rows/cards and one module packet as canonical docs source. | `DONE_DOC` |
| Execution report package / meeting follow-up handoffs need clear docs-only lineage. | `MODULE_INTERACTION_GRAPH.md`; `ARTIFACT_LINEAGE_MATRIX.md`; `STATUS.md` | Preserve documented handoff baseline without creating runtime ownership changes. | `DONE_DOC` |

### P1 runtime evidence

| Gap | Evidence needed | Blocking reason | Current status |
| --- | --- | --- | --- |
| Menu 3 / AI placement proof is missing across portfolio, full execution and rollout surfaces. | UI smoke or component assertion showing right-side/local command-row placement and no duplicate AI toolbar. | UI governance blocks runtime `GO`. | `NOT_DONE` |
| Report missing-evidence behavior is decided but not proven. | `RL_EXECUTION_REPORTS` route/component/API/test evidence that source-less report cannot show clean success/finalization; persisted report trust state and UI trust state must both reflect `missing_evidence`. | High-impact reports cannot be treated as trusted output. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |
| Manager and rollout high-impact actions need provenance, approval/read-back and proposal/review proof. | manager/control-tower and rollout route/component/API/test matrix. | Hidden rebaseline, hidden approval or fake success must be ruled out. | `NOT_DONE` |

### P2 premium hardening

| Gap | Evidence needed | Current status |
| --- | --- | --- |
| Full state matrix evidence is not complete for all five functions. | loading, empty, error, degraded/partial and success screenshots/tests. | `NOT_DONE` |
| Long-term route identity for `/execution` vs `/implementation` is closed for docs. | `/implementation` primary hub and `/execution` compatibility/full-step alias evidence, plus migration note if retired later. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |
| Premium manual evidence for table, kanban, timeline, reports, Manager lanes and rollout states is not attached. | screenshot/trace/manual Anygravity evidence package. | `NOT_DONE` |

## 10. RAW Depth Hard Gate Annex

### 10.1 RAW Sources

| Source | Status | Mapping |
| --- | --- | --- |
| `docs/modules/06_realizacja/RAW_INPUT.md` | `USED` | module-local baseline. |
| `docs/modules/06_realizacja/RAW_TARGET_STATE_2_0_PACKET.md` | `USED` | this packet and module integration scope. |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | `USED` | primary Implementation & PMO Engine RAW. |
| `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md` | `USED` | primary Execution Hub / AI execution management RAW. |
| `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | downstream realized KPI/ROI evidence handoff. |
| `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | budget/ROI/finance model ownership boundary. |
| `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | calendar/workday execution rhythm and conflict context. |
| `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `IMPACT_ONLY` | chat-origin task/decision/report proposals and approval governance. |

### 10.2 RAW synthesis: must / should / out

| Class | RAW-derived requirement | Contract decision |
| --- | --- | --- |
| must | Realizacja is governed execution lifecycle, not task manager. | `KEEP/ENHANCE` across `RL_*` contracts. |
| must | Stage/gate, decisions, risks, blockers, timeline, PMO reports and completion evidence must preserve source/provenance. | `ENHANCE`; P1 evidence rows required. |
| must | AI can triage/draft/report, but cannot silently approve, rebaseline, publish or mutate high-impact state. | `KEEP` no-hidden-write invariant. |
| should | Execution Hub should unify work queue/action pointers with calendar/inbox/communication context. | `DEFER` where current runtime evidence is partial. |
| should | PMO report catalog should expose `missing_evidence` and quality posture. | `ENHANCE`; `RL-REP-*` tasks. |
| out | Runtime implementation, new tests and new package changes. | `OUT_OF_SCOPE` for docs-only pass. |

### 10.3 As-Is vs Target vs Delta

| Dimension | As-Is | RAW target | Delta | Evidence / plan |
| --- | --- | --- | --- | --- |
| Execution lifecycle | `/implementation`, `/execution`, `/rollout` routes exist with function contracts. | one PMO operating system from approved initiative to completion and Results/ROI. | route identity and state-matrix evidence incomplete. | `NOT_DONE`: P1/P2 evidence tasks. |
| Report trust | report catalog and docs exist. | source-less reports cannot finalize as clean success. | missing-evidence proof absent. | `NOT_DONE`: `RL-REP-P0-001`. |
| AI governance | AI/contextual controls exist in several surfaces. | all contextual AI actions are Menu 3/right-side/local row-scoped and non-duplicated. | placement proof absent. | `NOT_DONE`: UI placement smoke/audit. |
| Rollout/manager mutation | routes and APIs exist. | proposal/review/read-back before high-impact mutation. | proof incomplete. | `NOT_DONE`: manager/rollout evidence rows. |

### 10.4 Decision table

| Requirement | Decision | Rationale | Evidence trace |
| --- | --- | --- | --- |
| Keep `06_realizacja` as execution owner, not strategy/results/finance owner. | `KEEP` | preserves module graph and artifact lineage. | `MODULE_INTERACTION_GRAPH.md`; `ARTIFACT_LINEAGE_MATRIX.md`; `STATUS.md`. |
| Add missing-evidence and source/provenance requirements to reports. | `ENHANCE` | RAW PMO reports require trust posture, not clean success over missing data. | `04_UI_UX.md`; `07_ACCEPTANCE_AND_TESTS.md`; `functions/RL_EXECUTION_REPORTS.md`. |
| Treat AI optimizer/rebaseline as hidden mutation. | `REJECT` | high-impact execution changes require explicit review. | `functions/RL_ROLLOUT_VIEW.md`; `06_PERMISSIONS_AND_SECURITY.md`. |
| Claim runtime full-go for execution UI gates now. | `DEFER` | Menu 3, missing-evidence, approval/read-back and state matrix evidence is missing. | `NOT_DONE` taskboard rows. |

### 10.5 Evidence trace

Critical thesis: Realizacja may generate PMO reports and intervention proposals only with visible source/provenance, approval state and read-back where mutation occurs.

- RAW source: `docs/RAW/implementation-pmo/107...`, `docs/RAW/execution-hub/103...`.
- contract decision: `ENHANCE`, no hidden approval/rebaseline/finalization.
- contract files: `04_UI_UX.md`, `06_PERMISSIONS_AND_SECURITY.md`, `07_ACCEPTANCE_AND_TESTS.md`, `functions/RL_EXECUTION_REPORTS.md`, `functions/RL_ROLLOUT_VIEW.md`.
- evidence: route/component/API baseline exists; UI state matrix and approval/read-back proof remain `NOT_DONE`.

## 11. RAW Semantic + World-Class Certification Addendum — 2026-05-11

Certification posture for `06_realizacja`:

- `DOCS_CERTIFIED`: `YES`
- `TARGET_WORLD_CLASS_CERTIFIED`: `YES_WITH_RUNTIME_CONDITION`
- `RUNTIME_CERTIFIED`: `NO`

Current semantic benchmark conclusion:

- PMO/execution ownership boundaries are clear and aligned to RAW,
- `missing_evidence` and route identity decisions are closed in docs,
- execution report trust, Menu 3 placement and manager/rollout read-back evidence remain runtime blockers.
