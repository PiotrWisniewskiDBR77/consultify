---
module_id: MODULE_INITIATIVES
function_id: IN_ROADMAP_VIEW
function_name: Initiatives — Roadmap View
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Roadmap View

## 1. Function Identity
- Function ID: `IN_ROADMAP_VIEW`
- Route: `/roadmap`
- Runtime anchor: `FullRoadmapView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: view initiative sequencing and timeline dependencies.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: route-level roadmap surface.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: initiative timelines and status data.
- Approved/scheduled initiative records, dependency metadata, planned dates and baseline/readiness status.
- Capability/readiness context for scheduling actions when actions are exposed.

## 6. Outputs and Side Effects
- Outputs: explicit navigation/handoffs back to initiative execution lanes.
- Roadmap schedule projection, sequencing/dependency visibility and explicit scheduling context.
- No hidden execution-task creation or duplicate initiative truth.

## 7. Ownership and Handoff Boundaries
- Boundaries: roadmap is a planning view, not silent mutation path.

| Handoff | Owner boundary |
| --- | --- |
| From `IN_PORTFOLIO_HUB` | Uses initiative identity, status and scheduling context. |
| To `06_realizacja` | Shows execution readiness/handoff context only; execution owns tasks and blockers. |
| To `07_rezultaty` / `08_finanse` | May expose timing/value context; does not own KPI or finance truth. |

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: tenant-scoped, source-linked timeline context.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

| Evidence type | Pointer | Gate |
| --- | --- | --- |
| Route evidence | `/roadmap`; `src/routes/routeConfig.ts`; `src/routes/AppRoutes.tsx`. | `PASS_DOC` |
| Component evidence | `src/views/FullRoadmapView.tsx`. | `PASS_DOC` |
| API evidence | initiative lifecycle/readiness APIs and roadmap service boundaries. | `PASS_DOC` |
| Test evidence | No lane-specific smoke/regression bound in this module contract. | `NOT_DONE` |

## 12. Open Risks and Change Log
- Risk: route-family consistency across `/initiatives` and `/roadmap`.
