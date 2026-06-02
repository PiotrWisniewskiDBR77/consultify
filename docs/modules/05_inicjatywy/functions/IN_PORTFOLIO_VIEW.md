---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_VIEW
function_name: Initiatives — Portfolio Route View
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Portfolio Route View

## 1. Function Identity
- Function ID: `IN_PORTFOLIO_VIEW`
- Route: `/portfolio`
- Runtime anchor: `PortfolioView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: portfolio-level strategic prioritization surface.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: initiative portfolio datasets and value/status metadata.
- Portfolio rollups, initiative health, value/prioritization metadata and allowed drill-through context.
- Backend initiative list/status APIs and capability context for any material action.

## 6. Outputs and Side Effects
- Outputs: explicit move to initiative/action lanes.
- Portfolio projections, prioritization context and bounded drill-through links.
- No duplicate portfolio initiative source of truth.

## 7. Ownership and Handoff Boundaries
- Boundaries: view surface, not hidden write owner for other modules.

| Handoff | Owner boundary |
| --- | --- |
| From `IN_PORTFOLIO_HUB` | Reads initiative truth and portfolio-level metadata. |
| To `IN_PORTFOLIO_HUB` | Drill-through or action requests return to canonical initiative identity. |
| To outputs/reporting | Rollups can be packaged downstream but do not become new initiative artefacts. |

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: ACL/tenant-scoped portfolio context.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

| Evidence type | Pointer | Gate |
| --- | --- | --- |
| Route evidence | `/portfolio`; `src/routes/routeConfig.ts`; `src/routes/AppRoutes.tsx`. | `PASS_DOC` |
| Component evidence | `src/views/PortfolioView.tsx`. | `PASS_DOC` |
| API evidence | `src/services/api.ts`; initiative list/status APIs. | `PASS_DOC` |
| Test evidence | No lane-specific smoke/regression bound in this module contract. | `NOT_DONE` |

## 12. Open Risks and Change Log
- Risk: overlap confusion with `/initiatives` entry if labels drift.
