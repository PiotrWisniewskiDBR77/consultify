---
module_id: MODULE_INITIATIVES
function_id: IN_ROI_VIEW
function_name: Initiatives — ROI View
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — ROI View

## 1. Function Identity
- Function ID: `IN_ROI_VIEW`
- Route: `/roi`
- Runtime anchor: `FullROIView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: inspect initiative value and ROI context in dedicated route.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI/value datasets linked to initiatives.
- Initiative value hypotheses, KPI/benefit links, finance assumptions/evidence and results/ROI references.
- Finance/results APIs and initiative link APIs when data crosses owner boundaries.

## 6. Outputs and Side Effects
- Outputs: explicit handoff to decisions/portfolio/execution actions.
- ROI/value context, assumptions visibility and finance/results handoff links.
- No silent finance model mutation and no duplicate results/KPI truth.

## 7. Ownership and Handoff Boundaries
- Boundaries: no silent financial canon ownership transfer.

| Handoff | Owner boundary |
| --- | --- |
| From `IN_PORTFOLIO_HUB` | Reads initiative identity, status and value hypothesis. |
| To `08_finanse` | Finance owns model assumptions and calculations. |
| To `07_rezultaty` | Results owns realized KPI/benefit evidence and tracking. |
| To decisions | Material ROI/value decisions remain auditable decision artefacts. |

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: source assumptions and ROI lineage must stay visible.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

| Evidence type | Pointer | Gate |
| --- | --- | --- |
| Route evidence | `/roi`; `src/routes/routeConfig.ts`; `src/routes/AppRoutes.tsx`. | `PASS_DOC` |
| Component evidence | `src/views/FullROIView.tsx`. | `PASS_DOC` |
| API evidence | finance/results ROI evidence APIs, initiative link APIs and `src/services/api.ts`. | `PASS_DOC` |
| Test evidence | Related results/finance initiative tests exist, but no bound initiative ROI lane gate. | `NOT_DONE` |

## 12. Open Risks and Change Log
- Risk: ROI interpretation without explicit assumption visibility.
