# DEEP RAW GAP AUDIT — MODULE_SETTINGS (2026-05-11)

## Scope and Mode

- Scope anchor: `18_ustawienia/MODULE_INTEGRATION`
- Mode: docs-only (no runtime edits)
- Audit intent:
  - Krok 1: Gap audit As-Is (kod vs docs)
  - Krok 2: RAW alignment + boundary hardening

## Source Set

### Module docs

- `docs/modules/18_ustawienia/00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/18_ustawienia/functions/SET_SETTINGS_WORKSPACE.md`
- `docs/modules/18_ustawienia/functions/SET_POLICY_BOUNDARY_LINKS.md`
- `docs/modules/18_ustawienia/RAW_INPUT.md`

### Cross-SOT

- `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`

### Runtime evidence

- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/views/SettingsView.tsx`
- `src/views/admin/AdminView.tsx`
- `src/views/superadmin/SuperAdminView.tsx`
- Supporting evidence: `src/components/ProtectedRoute.tsx`, `src/components/settings/SettingsOwnershipPanels.tsx`, `src/components/settings/SettingsSidebar.tsx`, `src/services/api.ts`, `src/services/api/settings.api.ts`, `server/src/routes/settings.routes.ts`

## Hard Rule Conformance Snapshot

| Hard rule | Decision | Evidence | Status |
| --- | --- | --- | --- |
| Settings is user/workspace preference hub, not admin panel | KEEP. `/settings/*` is auth-gated user surface; admin and superadmin remain separate route trees with role guards | `AppRoutes.tsx`, `ProtectedRoute.tsx` | PASS |
| Admin/superadmin cross-links explicit and no ownership leak | ENHANCE. Admin handoff exists (`tenant-security` -> `/admin?tab=security`), superadmin boundary is implicit only | `SettingsOwnershipPanels.tsx`, missing superadmin handoff pattern in settings docs/runtime | GAP_P1 |
| Critical claims follow source -> decision -> evidence/NOT_DONE | ENHANCE. Existing docs are high-level; evidence depth is shallow | current `03-07` and function contracts | GAP_P1 |
| No hidden permissions / hidden mutations | KEEP with caveat. Route guards are explicit; several settings writes exist and are user-scoped, but memory semantics mapping to V8 controls is incomplete | `ProtectedRoute.tsx`, `SettingsView.tsx`, `AIMemorySettings.tsx`, `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` | PARTIAL |

## Krok 1 — Gap Audit (As-Is: code vs docs)

## 1) Route, tab behavior, role gating

### Findings

| Claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| Settings route is active and protected | Router docs + runtime | KEEP | `AppRoutes.tsx`: `/settings/*` wrapped in `<ProtectedRoute requireAuth={true}>` |
| Admin is separate and role-gated | P32 contract + runtime | KEEP | `AppRoutes.tsx`: `/admin/*` uses `requiredRole="ADMIN"` |
| Superadmin is separate and role-gated | inventory + runtime | KEEP | `AppRoutes.tsx`: `/superadmin/*` uses `requiredRole="SUPERADMIN"` |
| Settings launcher points to profile module root | module docs + runtime | KEEP | `menuConfig.ts` (`SETTINGS_PROFILE_MODULE`), `routeConfig.ts` (`SETTINGS_PROFILE_MODULE` -> `/settings/profile`) |
| Any nested `/settings/*` path maps back to settings module in app view resolution | runtime | KEEP | `routeConfig.ts`: `getAppViewFromPath()` returns `SETTINGS_PROFILE_MODULE` for `/settings/*` |
| Settings has explicit tenant/admin handoff UI | boundary rule | KEEP/ENHANCE | `SettingsOwnershipPanels.tsx`: Open Organization/Open Admin Security; no superadmin handoff |

### Gap notes

- G1: docs did not explicitly bind current role gates to acceptance rows (`PASS_WITH_EVIDENCE` needed).
- G2: superadmin boundary is enforced by route tree, but not explicitly surfaced as settings handoff pattern.

## 2) Settings vs Admin boundary

| Claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| P31 (Settings) must not become second admin root | P32 contract | KEEP | `FINAL_IMPLEMENTATION_PLAN_32...`: P31 is personal/user-scoped; P32 is tenant-admin |
| Settings can display tenant policy but should route writes to admin owner | module docs + runtime | KEEP | `SettingsOwnershipPanels.tsx`: tenant-security card is read-only + "Open Admin Security" |
| Boundary evidence should include per-section owner map | module docs | ENHANCE | Current docs lack explicit owner table per section; added in packet/board/docs updates |

## 3) Settings vs Superadmin boundary

| Claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| Superadmin is platform-level cross-tenant control plane | cross-SOT inventory + runtime | KEEP | `SuperAdminView.tsx` + inventory superadmin module map |
| Settings should not expose platform controls as local editable state | hard rule + P32/P33 split | KEEP | no `/settings` direct superadmin mutators found |
| Explicit safe handoff from settings to superadmin when needed | hard rule | NEW | NOT_DONE in runtime; docs now mark as required boundary pattern with role-safe disclosure |

## 4) Memory controls and privacy posture

| Claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| User memory controls must be explicit (`private_mode`, review/delete/forget semantics) | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` | ENHANCE | `AIMemorySettings.tsx` exposes enable/retention/clear-all, but lacks explicit `private_mode`, per-item review/delete, session effect forget |
| Tenant admin memory controls must remain admin-owned | memory controls v8 + P32 contract | KEEP/ENHANCE | settings shows user-level controls; explicit admin memory control handoff is under-documented in module contract |
| AI privacy/prompt/voice are mounted with API contract, not local-only stubs | runtime code | KEEP with doc correction | `settings.api.ts` + `server/src/routes/settings.routes.ts` contain endpoints; previous inventory marking as `stub` is stale |

## 5) Evidence depth quality

| Area | Current depth | Decision | Required hardening |
| --- | --- | --- | --- |
| Routing/gating | Medium | KEEP | tie each acceptance row to exact route+guard evidence |
| Boundary ownership | Medium-low | ENHANCE | add owner matrix with admin/superadmin handoff criteria |
| Memory/privacy controls | Low-medium | ENHANCE | add As-Is/Target delta and explicit NOT_DONE rows |
| Stub/partial status taxonomy | Low (drifted) | ENHANCE | separate "client wired" vs "server route verified" vs "E2E verified" |

## Krok 2 — RAW Alignment and Boundary Hardening

## Must / Should / Out

### MUST

- Settings remains user/workspace preference hub (`/settings/*`), not admin replacement.
- Admin and superadmin boundaries are explicit in docs and acceptance matrix.
- Every critical claim is stated as `source -> decision -> evidence/NOT_DONE`.
- Memory/privacy semantics in settings reflect V8 user/admin split without hidden mutations.

### SHOULD

- Show superadmin handoff pattern only when relevant role/context exists (no role leak).
- Mark confidence level per feature: `route verified`, `API verified`, `runtime test NOT_DONE`.
- Keep inventory statuses synchronized with actual runtime/API evidence.

### OUT

- Any runtime/router/component changes in this pass.
- Any hidden write behavior or implied permission escalation.

## As-Is vs Target vs Delta

| Domain | As-Is | Target (RAW 2.0) | Delta |
| --- | --- | --- | --- |
| Settings identity | Mostly correct | fully explicit with hard boundaries and evidence mapping | docs hardening only |
| Admin boundary | explicit for tenant-security | explicit across all policy-owned branches | add ownership map + acceptance evidence |
| Superadmin boundary | implicit in route tree | explicit handoff doctrine with no ownership leak | add docs + task rows; runtime handoff NOT_DONE |
| Memory controls | user controls partial vs V8 taxonomy | complete semantics mapping (user/admin/operator) | document gaps and owner decisions |
| Evidence quality | mixed, often generic | strict source-decision-evidence/NOT_DONE | update 03-07 + functions + board/cards |

## Decision Table (KEEP / ENHANCE / NEW / DEFER)

| Item | Decision | Why | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| `/settings/*`, `/admin/*`, `/superadmin/* role separation` | KEEP | already enforced by route guards | `AppRoutes.tsx`, `ProtectedRoute.tsx` |
| Settings taxonomy panel and tenant/admin handoff cards | ENHANCE | good baseline, needs superadmin boundary clause and acceptance depth | `SettingsOwnershipPanels.tsx`; superadmin handoff NOT_DONE |
| Memory controls mapping to V8 contract | ENHANCE | current UI does not cover full V8 control vocabulary | `AIMemorySettings.tsx`, `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` |
| Inventory statuses for ai-privacy/prompt/voice | ENHANCE | runtime/API evidence indicates mounted endpoints | `settings.api.ts`, `settings.routes.ts` |
| Explicit superadmin cross-link contract from settings | NEW | required by hard boundary rule for explicit cross-links | runtime NOT_DONE |
| Runtime implementation of missing memory semantics (`private_mode`, review/delete per item, forget session effect) | DEFER | outside docs-only mode; needs product+engineering owner decision | NOT_DONE |

## Acceptance Rows with Runtime Evidence / NOT_DONE

| Acceptance row | Evidence | Status |
| --- | --- | --- |
| Settings route is protected and user-scoped | `AppRoutes.tsx` + `ProtectedRoute.tsx` | PASS |
| Admin and superadmin are separate role-gated surfaces | `AppRoutes.tsx` | PASS |
| Settings provides explicit admin handoff for tenant security | `SettingsOwnershipPanels.tsx` (`Open Admin Security`) | PASS |
| Settings documents explicit superadmin handoff policy without role leak | docs updated; runtime link policy missing | PASS_WITH_NOT_DONE |
| User memory control semantics align with V8 user/admin/operator taxonomy | docs aligned; runtime parity incomplete | NOT_DONE |
| No hidden writes for policy-owned settings | docs and boundary cards enforce read-only + handoff; full E2E audit pending | PASS_WITH_NOT_DONE |

## CTO Decisions (Locked 2026-05-11)

1. Superadmin handoff policy:
   - Settings keeps admin-first handoff for standard users and tenant admins.
   - Direct superadmin handoff is allowed only for users already in `SUPERADMIN` role context.
   - Handoff copy must stay ownership-safe and non-leaky.
2. V8 memory rollout priority:
   - P1 runtime: `private_mode` toggle + explicit `forget_recent_session_effect`.
   - P2 runtime: per-item memory `review_my_memory` and `delete_memory_item`.
3. Cross-module inventory sync:
   - Proceed immediately as separate cross-module docs task; do not block settings docs gate.

## Final Verdict

`APPROVED_FOR_DOCS`

Rationale:

- Owner decisions are now locked at CTO level and translated into explicit doctrine.
- Contract is unblocked for next implementation sprint with clear runtime backlog (`NOT_DONE`) and no scope ambiguity.
