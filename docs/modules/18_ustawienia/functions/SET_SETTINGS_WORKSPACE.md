---
module_id: MODULE_SETTINGS
function_id: SET_SETTINGS_WORKSPACE
function_name: Settings — Settings Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-07-31
---

# Function Contract — Settings Workspace

> Pełny pakiet odbiorowy:
> [`SETTINGS_COMPLETE_PRODUCT_CONTRACT.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/SETTINGS_COMPLETE_PRODUCT_CONTRACT.md),
> [`SETTINGS_INFORMATION_ARCHITECTURE_OWNERSHIP_AND_INHERITANCE.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/SETTINGS_INFORMATION_ARCHITECTURE_OWNERSHIP_AND_INHERITANCE.md),
> [`SETTINGS_DATA_SECURITY_INTEGRATIONS_AND_CHANGE_CONTRACT.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/SETTINGS_DATA_SECURITY_INTEGRATIONS_AND_CHANGE_CONTRACT.md)
> oraz
> [`SETTINGS_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/SETTINGS_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md).

## 1. Function Identity
- Function ID: `SET_SETTINGS_WORKSPACE`
- Route family: `/settings/*`
- Runtime anchor: `SettingsView`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: canonical user/workspace preference configuration surface.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: profile/preferences/memory settings and policy context.
- Dependencies:
  - Router and app view mapping: `routeConfig.ts`, `AppRoutes.tsx`
  - Settings UI shell: `SettingsView.tsx`, `SettingsSidebar.tsx`
  - Preference APIs: `api.ts`, `settings.api.ts`, `server/src/routes/settings.routes.ts`
  - Stage 1.5 audit: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## 6. Outputs and Side Effects
- Outputs: explicit persisted setting updates with read-back feedback.
- Side effects:
  - Allowed: user-scoped settings mutations
  - Disallowed: hidden mutations of admin/superadmin-owned policy controls

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.
- Settings remains P31 user/workspace preference hub, not P32/P33 policy owner.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- Critical claim chain:
  - Source: `AppRoutes.tsx`, `ProtectedRoute.tsx`
  - Decision: keep settings as auth-protected user route
  - Evidence: `/settings/*` uses `ProtectedRoute requireAuth`; `/admin/*` and `/superadmin/*` remain role-gated owner routes

## 10A. Stage 1.5 Evidence Taxonomy

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `SettingsView.tsx` | KEEP: render Settings as the user/workspace preference hub | Settings sections render inside `SettingsView`; no admin/superadmin shell is mounted inside settings |
| `server/src/routes/settings.routes.ts` | KEEP: legacy root settings API is not a user mutation path | `/api/settings` root blocks non-superadmins with `LEGACY_SETTINGS_SCOPE_BLOCKED`; scoped preferences use `/settings/preferences/...` |
| `settings.api.ts` + `settings.routes.ts` | ENHANCE: AI privacy, prompt library and voice are API-wired but not E2E-proven | FE typed API and BE GET/PUT routes exist; runtime persistence test evidence `NOT_DONE` |
| `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` + `AIMemorySettings.tsx` | ENHANCE: V8 memory parity remains incomplete | `personal_memory_on_or_off` is partial; `private_mode`, `review_my_memory`, `delete_memory_item`, `forget_recent_session_effect` are `NOT_DONE` |

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - [x] `/settings/*` route mounted and protected
  - [x] app view mapping points to settings module root and nested settings paths
  - [x] scoped settings preference API wiring is documented separately from stale inventory `stub` labels
  - [ ] full V8 memory semantics represented in runtime (`NOT_DONE`)
  - [ ] E2E persistence evidence exists for API-wired AI privacy/prompt/voice settings (`NOT_DONE`)
  - [ ] superadmin boundary handoff doctrine explicitly represented in settings UX (`NOT_DONE`)

- Route evidence: module route/view scope for `18_ustawienia` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `18_ustawienia` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `18_ustawienia` user flows.

## 12. Open Risks and Change Log
- Risk: false saved-state UX if write/readback handling regresses.
- Risk: memory/privacy controls may imply broader semantics than currently implemented if V8 mapping remains partial.
