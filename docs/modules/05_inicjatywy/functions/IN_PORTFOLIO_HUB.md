---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_HUB
function_name: Initiatives — Portfolio Hub
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Portfolio Hub

## 1. Function Identity
- Function ID: `IN_PORTFOLIO_HUB`
- Entry route: `/initiatives`
- Runtime anchor: `InitiativesHub` tab `list`
- Feature state: `real`

## 2. User Job and Business Outcome
- Manage initiative portfolio in one operational surface.
- Drive status transitions and prioritization with traceability.

## 3. Trigger and Entry Points
- Sidebar initiatives entry and direct route `/initiatives`.

## 4. UI Component Footprint
- `InitiativesHub` table/kanban/timeline/grid view modes, preview panel, filter chips.

## 5. Inputs, Data Contracts, and Dependencies
- Initiative records, lifecycle metadata, planning snapshots, filter/scope state.
- Backend capability payload from `GET /api/initiatives/:id/gate-readiness-check`.
- Source/provenance links or explicit missing-evidence state.
- Task, decision, RAID, KPI, finance and roadmap references as linked context only.

## 6. Outputs and Side Effects
- Initiative updates, opens, and explicit downstream handoff actions.
- Context create requests for tasks, decisions and RAID only when backend capabilities allow them.
- Status transition requests only after readiness/capability preflight and user action.
- No hidden execution, KPI, finance or source mutation.

## 7. Ownership and Handoff Boundaries
- Owns initiative portfolio runtime, not execution/results canonical records.

| Handoff | Owner boundary |
| --- | --- |
| To `06_realizacja` | Approved/scheduled initiative scope can seed execution, but tasks and blockers are execution truth. |
| To `07_rezultaty` | KPI targets and benefit hypotheses can be linked, but realized measurement is results truth. |
| To `08_finanse` | Budget envelope and assumptions can be linked, but finance models/assumptions remain finance truth. |
| To `02_moja-praca` | Tasks/decisions can surface in My Work, but initiative identity remains in this module. |

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success with next-action guidance.

## 9. AI, Source, Evidence, Approval
- AI actions in Menu 3/context controls only; source/evidence required.

### 9.1 Initiative Card System Responsibility

`IN_PORTFOLIO_HUB` is the primary owner for the Initiative Card System on `/initiatives`.

- It owns list/table, kanban, timeline, grid, preview/detail and modal card variants.
- It must render workflow CTAs, context create actions, editability and AI availability from backend capabilities, not local permission inference.
- It must preserve source/provenance display or show explicit missing-evidence state.
- It may hand off to roadmap, portfolio, execution, ROI/results lanes, but those lanes must not duplicate initiative truth.

Canonical contract: `../INITIATIVE_CARD_SYSTEM_CONTRACT.md`.

## 10. Security, Roles, and Tenancy
- Tenant/ACL checks and governance-aware write paths.

## 11. Acceptance Criteria and Test Evidence

- `/initiatives` renders `InitiativesHub` and supports documented view modes.

| Evidence type | Pointer | Gate |
| --- | --- | --- |
| Route evidence | `/initiatives`; `src/routes/routeConfig.ts`; `src/routes/AppRoutes.tsx`. | `PASS_DOC` |
| Component evidence | `src/components/Initiatives/InitiativesHub.tsx`; `InitiativePreviewV3`; portfolio card components. | `PASS_DOC` |
| API evidence | `src/services/api.ts`; `server/src/routes/pmo/initiatives.routes.ts`; `server/src/controllers/InitiativeController.ts`; `GET /api/initiatives/:id/gate-readiness-check`. | `PASS_DOC` |
| Test evidence | `tests/e2e/smoke/deploy-gate-api.spec.ts` for CRUD; no dedicated UI transition/card regression bound. | `NOT_DONE` |

## 12. Open Risks and Change Log
- Risk: high view-mode complexity without regression automation.
- Change log: initial function contract created.

## RAW Hard Gate Trace — 2026-05-11

- RAW source: `docs/modules/05_inicjatywy/RAW_INPUT.md`; impact contexts `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`, `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`, `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`.
- Contract decision: `KEEP` initiative lifecycle owner; `ENHANCE` source-envelope and card lifecycle evidence.
- Evidence: route/component/API mapped; dedicated UI card/lifecycle regression remains `NOT_DONE`.
