---
module_id: MODULE_ADMIN_PANEL
function_id: ADM_ADMIN_WORKSPACE
function_name: Admin Panel — Admin Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-07-31
---

# Function Contract — Admin Workspace

> Rozwinięty, aktualny kontrakt funkcjonalny i remanent znajdują się w pakiecie weekendowym:
> - `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ADMIN_PANEL_COMPLETE_PRODUCT_CONTRACT.md`
> - `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ADMIN_PANEL_ROLES_TEAMS_PROJECTS_AND_WORKFLOWS.md`
> - `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ADMIN_PANEL_AI_TERESA_CONNECTIONS_AND_POLICY_ENGINE.md`
> - `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ADMIN_PANEL_SECURITY_DATA_BILLING_AUDIT_AND_SUPERADMIN_BOUNDARY.md`
> - `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ADMIN_PANEL_MARKET_BENCHMARK_AS_IS_GAPS_AND_GOLDEN_FLOWS.md`
>
> W razie konfliktu te dokumenty są źródłem prawdy dla TO-BE i odbioru, a zamontowany runtime jest źródłem prawdy dla AS-IS.

## 1. Function Identity
- Function ID: `ADM_ADMIN_WORKSPACE`
- Route family: `/admin/*`
- Runtime anchor: `AdminView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: secured tenant-admin control plane runtime.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint: `AdminView` under `ProtectedRoute(requiredRole="ADMIN")`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: tenant admin entities, roles/policies, integrations and audit context.
- Dependency boundary:
  - user preferences read/handoff from settings plane
  - platform-level overrides via superadmin plane only

## 6. Outputs and Side Effects
- Outputs: explicit reviewed admin mutations with audit visibility.

## 7. Ownership and Handoff Boundaries
- Hard split:
  - module 17 owns tenant admin workspace writes
  - module 18 owns user preferences
  - superadmin owns cross-tenant platform operations
- Handoffs must be explicit (link/deep-link/state guidance), never hidden.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- Known boundary risk is tracked in module board as `ADM-RAW-P0-001`.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `17_panel-administratora` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `17_panel-administratora` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `17_panel-administratora` user flows.

Critical claims:

| Claim | Source | Decision | Evidence / Status |
| --- | --- | --- | --- |
| Tenant admin cockpit is mounted and canonical | enterprise P32 + runtime | `KEEP` | `AdminSettingsModule.tsx`, `AppRoutes.tsx`, inventory admin rows |
| Workspace aliases are supported (`/admin/integrations` etc.) | route config | `ENHANCE` | `routeConfig.ts`, `AdminSettingsModule.tsx` |
| High-impact write audit evidence is complete in module-local proofs | acceptance doctrine | `ENHANCE` | `NOT_DONE` (`ADM-RAW-P1-004`) |

## 12. Open Risks and Change Log
- Risk: high-impact admin actions without deep regression evidence.
- Risk: boundary policy conflict propagated from `ADM_SUPERADMIN_BOUNDARY` (`ADM-RAW-P0-001`).
