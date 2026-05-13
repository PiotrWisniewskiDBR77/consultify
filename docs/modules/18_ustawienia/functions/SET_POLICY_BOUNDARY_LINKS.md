---
module_id: MODULE_SETTINGS
function_id: SET_POLICY_BOUNDARY_LINKS
function_name: Settings — Policy Boundary and Admin Links
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Policy Boundary and Admin Links

## 1. Function Identity
- Function ID: `SET_POLICY_BOUNDARY_LINKS`
- Boundary: user-editable settings vs admin/superadmin/tenant-owned policy settings
- Feature state: `partial` (boundary active, needs per-section evidence)

## 2. User Job and Business Outcome
- Purpose: keep settings ownership clear and route users to admin-owned controls when needed.

## 3. Trigger and Entry Points
- Outputs: explicit lock/redirect/deeplink behavior instead of silent denial.
- Entry points:
  - `SettingsOwnershipPanels` handoff actions
  - settings sections that display policy-owned read-only values

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: policy lock and authorization state.

## 6. Outputs and Side Effects
- Outputs and side effects are explicit user-driven actions; no hidden mutations are implied.

## 7. Ownership and Handoff Boundaries
- Evidence:
  - settings -> organization handoff
  - settings -> admin security handoff
  - route-level superadmin separation (`/superadmin/*`)
- Risk: policy ambiguity leading to incorrect ownership assumptions.
- Risk: missing explicit settings-level superadmin handoff doctrine may cause ownership confusion.

Stage 1.5 boundary decision:

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `SettingsOwnershipPanels.tsx` | KEEP: settings may show policy provenance and admin handoff | Organization/Admin handoff CTAs exist and policy values are read-only |
| `AppRoutes.tsx` + `AdminView.tsx` | KEEP: tenant admin controls stay in Admin owner surface | `/admin/*` is role-gated and renders `AdminView -> AdminSettingsModule` |
| `AppRoutes.tsx` + `SuperAdminView.tsx` | KEEP: platform controls stay in SuperAdmin owner surface | `/superadmin/*` is role-gated and renders `SuperAdminView`; settings superadmin handoff UX remains `NOT_DONE` |
| `server/src/routes/settings.routes.ts` | KEEP: legacy settings root is superadmin/platform scoped, not user-settings scoped | non-superadmin requests receive `LEGACY_SETTINGS_SCOPE_BLOCKED` |

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- Critical claim chain:
  - Source: `AppRoutes.tsx`, `ProtectedRoute.tsx`, `SettingsOwnershipPanels.tsx`
  - Decision: keep policy ownership explicit and avoid hidden capability
  - Evidence: admin handoff exists; superadmin route is isolated; superadmin handoff UX in settings is `NOT_DONE`

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - [x] Policy-owned settings are presented as read-only in settings where relevant
  - [x] Admin handoff is explicit (`Open Admin Security`)
  - [ ] Superadmin handoff policy from settings is explicit and role-safe (`NOT_DONE`)
  - [x] Hidden writes for policy-owned settings are disallowed by contract
  - [x] Legacy `/api/settings` root is documented as blocked for non-superadmin users
  - [ ] E2E evidence proves no settings surface can mutate admin/superadmin-owned policy controls directly (`NOT_DONE`)

- Route evidence: module route/view scope for `18_ustawienia` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `18_ustawienia` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `18_ustawienia` user flows.

## 12. Open Risks and Change Log
- Risk: policy ambiguity leading to incorrect ownership assumptions.
