# STAGE 1.5 ULTRA DEEP GAP AUDIT — MODULE_SETTINGS

## Scope And Mode

- Scope anchor: `18_ustawienia/MODULE_INTEGRATION`
- Role: Deep RAW Auditor — `MODULE_SETTINGS`
- Mode: docs-only, no runtime edits
- Audit date: 2026-05-11

## Hard Rules Applied

- `MODULE_SETTINGS` remains the user/workspace preferences hub.
- Policy/admin controls only move through the correct ownership boundary.
- Every critical claim must be traceable as `source -> decision -> evidence/NOT_DONE`.
- Runtime files are evidence only in this pass; no source code was edited.

## Mandatory Source Set

| Source | Use in Stage 1.5 |
| --- | --- |
| `docs/modules/18_ustawienia/**` | Module contract baseline, RAW packet, function contracts, cards, acceptance, board |
| `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md` | Mounted surface inventory and status comparison |
| `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` | Memory control taxonomy and user/admin/operator split |
| `src/routes/routeConfig.ts` | Route constants, AppView mappings, nested path resolution |
| `src/routes/AppRoutes.tsx` | Auth/role-gated mounted route evidence |
| `src/views/SettingsView.tsx` | Settings section ownership and rendered settings components |
| `src/views/admin/AdminView.tsx` | Admin owner shell evidence |
| `src/views/superadmin/SuperAdminView.tsx` | Superadmin owner shell and branch remap evidence |

Supporting evidence used to classify gaps:

- `src/components/settings/SettingsOwnershipPanels.tsx`
- `src/components/settings/AIMemorySettings.tsx`
- `src/components/settings/AIPrivacySettings.tsx`
- `src/components/settings/AIPromptLibrarySettings.tsx`
- `src/components/settings/VoiceSettings.tsx`
- `src/services/api.ts`
- `src/services/api/settings.api.ts`
- `server/src/routes/settings.routes.ts`

## Executive Verdict

`APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE`

Stage 1.5 confirms that the route and ownership boundary are structurally sound: `/settings/*`, `/admin/*`, and `/superadmin/*` are distinct mounted surfaces with explicit auth/role gates. The remaining gaps are not contract ambiguity gaps; they are runtime/evidence completion gaps around V8 memory semantics, role-safe superadmin handoff UX and E2E proof for settings preference persistence. Inventory status drift found during the audit was closed in docs synchronization.

## Boundary Doctrine

| Boundary | Stage 1.5 decision | Evidence / NOT_DONE |
| --- | --- | --- |
| Settings -> user/workspace preferences | KEEP | `AppRoutes.tsx` mounts `/settings/*` under `ProtectedRoute requireAuth`; `SettingsView.tsx` renders personal/workspace settings sections |
| Settings -> admin policy | KEEP/ENHANCE | `SettingsOwnershipPanels.tsx` shows read-only tenant/security policy values and handoff actions to Organization/Admin; per-section acceptance now needs Stage 1.5 rows |
| Settings -> superadmin platform controls | KEEP/NOT_DONE | `AppRoutes.tsx` role-gates `/superadmin/*`; `SuperAdminView.tsx` owns platform branches; settings runtime has no explicit role-safe superadmin handoff UX |
| Settings -> memory controls | ENHANCE/NOT_DONE | V8 requires `private_mode`, `review_my_memory`, `delete_memory_item`, `forget_recent_session_effect`; current settings UI/API only covers coarse memory preferences and clear-all behavior |
| Settings -> legacy settings root API | KEEP boundary | `server/src/routes/settings.routes.ts` blocks legacy `/api/settings` root for non-superadmins and directs scoped settings to registry/platform routes |

## Claim Chain Matrix

| Claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| Settings is a protected user route, not an admin console | `AppRoutes.tsx`, `routeConfig.ts`, `SettingsView.tsx` | KEEP | `/settings/*` uses `ProtectedRoute requireAuth`; nested settings paths map to `SETTINGS_PROFILE_MODULE`; rendered shell is `SettingsView` |
| Admin is the tenant policy owner surface | `AppRoutes.tsx`, `AdminView.tsx`, inventory | KEEP | `/admin/*` uses `requiredRole="ADMIN"` and renders `AdminView -> AdminSettingsModule` |
| Superadmin is the platform control plane | `AppRoutes.tsx`, `SuperAdminView.tsx`, inventory | KEEP | `/superadmin/*` uses `requiredRole="SUPERADMIN"` and renders dedicated `SuperAdminView` branches |
| Settings can expose policy provenance but must not write policy controls directly | `SettingsOwnershipPanels.tsx`, `06_PERMISSIONS_AND_SECURITY.md` | KEEP/ENHANCE | Tenant/default/security panels render source/read-only values and Organization/Admin CTAs; superadmin UX handoff remains `NOT_DONE` |
| Admin-first mediation remains the default settings handoff | `RAW_TARGET_STATE_2_0_PACKET.md`, `SettingsOwnershipPanels.tsx` | KEEP | `Open Organization`, `Open Admin Security`; direct superadmin link is not mounted for normal settings users |
| Direct superadmin handoff may only appear in superadmin role context | hard rule, `AppRoutes.tsx`, `SuperAdminView.tsx` | KEEP/NOT_DONE | Role gate exists; settings role-safe UX handoff pattern is not implemented |
| V8 memory controls must not collapse user/admin/operator concerns | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` | ENHANCE | V8 defines three surfaces: user memory controls, tenant admin controls, operator visibility controls |
| User memory controls are incomplete against V8 vocabulary | V8 doc, `AIMemorySettings.tsx`, `api.ts` | NOT_DONE | UI covers enabled/retention/includes/clear-all; missing explicit `private_mode`, per-item review/delete, session-promotion/forget semantics |
| AI privacy, prompt library and voice are no longer pure local stubs in the current code path | inventory, `settings.api.ts`, `settings.routes.ts`, component files | ENHANCE inventory/doc status | Components call `Api.*`; typed FE API maps to `/settings/preferences/...`; backend routes persist to `user_preferences`; E2E proof remains `NOT_DONE` |
| Legacy system settings root must not become a user settings write path | `settings.routes.ts` | KEEP | `/api/settings` GET/POST returns `LEGACY_SETTINGS_SCOPE_BLOCKED` for non-superadmins |

## As-Is Runtime Evidence

### Route Separation

| Surface | Route evidence | Owner evidence | Status |
| --- | --- | --- | --- |
| Settings | `/settings/*` in `AppRoutes.tsx` | `SettingsView.tsx` | PASS |
| Admin | `/admin/*` in `AppRoutes.tsx`, `requiredRole="ADMIN"` | `AdminView.tsx` -> `AdminSettingsModule` | PASS |
| Superadmin | `/superadmin/*` in `AppRoutes.tsx`, `requiredRole="SUPERADMIN"` | `SuperAdminView.tsx` | PASS |

### Settings Sections And Ownership

| Section family | Evidence | Stage 1.5 classification |
| --- | --- | --- |
| Overview / tenant defaults / branding / security / module preferences | `SettingsOwnershipPanels.tsx` | `real-readonly-policy-visibility` with Organization/Admin handoff |
| Profile, avatar, signatures, working hours, dashboard, work preferences, regional | `SettingsView.tsx`, inventory | user/workspace preference domain |
| AI behavior/model/autocomplete/memory/usage | `SettingsView.tsx`, inventory, `api.ts` | settings user preference domain; memory semantics partial |
| AI privacy / prompt library / voice | component files, `settings.api.ts`, `settings.routes.ts` | `API_WIRED_NOT_E2E_PROVEN`; inventory status should no longer be treated as authoritative `stub` without re-audit |
| Security dashboard / auth access | `SettingsView.tsx` | user account security settings; tenant policy writes remain Admin-owned |
| Developer / templates / import-export / history / theme / shortcuts | inventory | outside Stage 1.5 boundary focus; retain existing partial/stub risk until separately audited |

## Settings vs Admin vs Superadmin Ownership Matrix

| Control domain | Settings role | Admin role | Superadmin role | Decision |
| --- | --- | --- | --- | --- |
| User profile, avatar, signatures, working hours | editable preference hub | no ownership transfer | no ownership transfer | Settings owns user-scoped preferences |
| Tenant defaults, branding, security policy | read-only provenance/handoff | tenant policy owner | platform override only where applicable | Settings must not write tenant policy |
| User AI behavior/model/autocomplete | user preference surface | may constrain through tenant policy | may constrain platform model/provider defaults | Settings owns user preference only |
| User AI memory preference | partial user control | tenant memory policy owner | platform memory/AI governance owner | Keep split; V8 parity `NOT_DONE` |
| AI privacy/prompt/voice | user preference surface, API-wired | tenant constraints possible | platform constraints possible | E2E and policy overlay evidence `NOT_DONE` |
| Global system settings | no direct ownership | no direct ownership unless admin module exposes tenant scope | superadmin/platform owner | Legacy root blocked for non-superadmins |

## Memory Controls Deep Gap

| V8 control | Required surface | Current evidence | Decision |
| --- | --- | --- | --- |
| `personal_memory_on_or_off` | Settings user memory | `AIMemorySettings.tsx` has `enabled`; `api.ts` maps to coarse AI user settings | PARTIAL |
| `private_mode` | Settings user memory / Teresa context | no explicit user control found in settings runtime evidence | `NOT_DONE_P1` |
| `forget_recent_session_effect` | Settings user memory / chat/Teresa handoff | clear-all and `context_retention='none'` exist, but no distinct recent-session forget semantics | `NOT_DONE_P1` |
| `review_my_memory` | Settings user memory | no per-item memory review surface found | `NOT_DONE_P2` |
| `delete_memory_item` | Settings user memory | clear-all exists; per-item delete not found | `NOT_DONE_P2` |
| `allow_user_personalization` | Admin memory policy | not Settings-owned | ADMIN_BOUNDARY |
| `allow_org_memory` | Admin memory policy | not Settings-owned | ADMIN_BOUNDARY |
| `assistant_org_memory_access_policy` | Admin/platform memory policy | not Settings-owned | ADMIN/SUPERADMIN_BOUNDARY |
| `MemoryAccessExplanation` | User-visible explanation / operator support | no complete settings runtime evidence | `NOT_DONE` |

## Inventory Drift Finding

The shared inventory is useful, but Stage 1.5 found drift in the `ai-privacy`, `ai-prompt-library`, and `ai-voice` rows:

| Inventory row | Inventory status | Stage 1.5 evidence | Stage 1.5 decision |
| --- | --- | --- | --- |
| `ai-privacy` | `stub` | `AIPrivacySettings.tsx` calls `Api.getAIPrivacyPreferences/saveAIPrivacyPreferences`; `settings.api.ts` maps to `/settings/preferences/ai-privacy`; backend GET/PUT routes exist | Reclassify as `API_WIRED_NOT_E2E_PROVEN`, not pure local stub |
| `ai-prompt-library` | `stub` | `AIPromptLibrarySettings.tsx` calls `Api.getPromptLibrary/savePromptLibrary`; typed API and backend GET/PUT routes exist | Reclassify as `API_WIRED_NOT_E2E_PROVEN`; built-in fallback remains |
| `ai-voice` | `stub` | `VoiceSettings.tsx` calls `Api.getAIVoice/saveAIVoice`; typed API and backend GET/PUT routes exist | Reclassify as `API_WIRED_NOT_E2E_PROVEN`; browser speech test remains local runtime behavior |

Decision: do not claim full production readiness without E2E persistence evidence, but stop describing these rows as local-only stubs in module-level docs.

## Gap Register

| Gap ID | Gap | Severity | Owner boundary | Evidence / NOT_DONE | Required closure |
| --- | --- | --- | --- | --- | --- |
| SET-GAP-15-01 | V8 user memory controls incomplete | P1 | Settings user preference + Chat/Teresa | `private_mode` and `forget_recent_session_effect` not evidenced | Runtime implementation + UX acceptance |
| SET-GAP-15-02 | Per-item memory review/delete missing | P2 | Settings user preference | `review_my_memory`, `delete_memory_item` not evidenced | Memory object registry + UI/API |
| SET-GAP-15-03 | Superadmin handoff doctrine not represented in settings UX | P1 | Superadmin role boundary | route gate exists; settings UX missing | Role-safe handoff only for superadmin context, or explicit non-exposure decision |
| SET-GAP-15-04 | Shared inventory stale for AI privacy/prompt/voice | P1 docs | Cross-module docs | inventory said `stub`; code shows API-wired routes | CLOSED_DOCS: inventory now marks these rows `API_WIRED_NOT_E2E_PROVEN` |
| SET-GAP-15-05 | E2E persistence proof missing for API-wired preferences | P1/P2 evidence | Settings user preference | FE+BE paths exist; no runtime test evidence in this audit | Add test/evidence rows |
| SET-GAP-15-06 | High-impact setting audit/approval evidence incomplete | P2 security | Settings/Admin boundary | docs require confirmation/audit; not fully evidenced across sections | Add test canon and audit proof per high-impact setting |

## Acceptance Delta

| Acceptance row | Stage 1.5 status | Evidence / NOT_DONE |
| --- | --- | --- |
| Settings remains auth-protected user/workspace hub | PASS | `AppRoutes.tsx`, `SettingsView.tsx` |
| Admin remains tenant policy owner | PASS | `AppRoutes.tsx`, `AdminView.tsx` |
| Superadmin remains platform control plane | PASS | `AppRoutes.tsx`, `SuperAdminView.tsx` |
| Settings policy controls are read-only and handoff-based | PASS_WITH_NOT_DONE | Admin/Organization handoff exists; superadmin UX handoff not mounted |
| V8 user memory controls are complete | NOT_DONE | Missing `private_mode`, per-item review/delete, recent-session forget semantics |
| Tenant admin/operator memory controls are not editable through settings | PASS | V8 split + route boundaries |
| AI privacy/prompt/voice are API-wired | PASS_WITH_NOT_DONE | FE+BE endpoints exist; E2E proof missing |
| Legacy system settings root is blocked for non-superadmins | PASS | `LEGACY_SETTINGS_SCOPE_BLOCKED` |

## Synchronization Actions Required

- Packet: updated verdict from generic docs approval to Stage 1.5 `APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE`.
- Functions: added Stage 1.5 boundary/memory evidence and API-wired-but-not-E2E taxonomy.
- Cards: reflected superadmin UX and V8 memory `NOT_DONE` without weakening Settings ownership.
- Board: added Stage 1.5 gap rows and marked inventory sync as closed docs work.
- Acceptance: added Stage 1.5 acceptance rows for role boundaries, memory, inventory drift and E2E evidence.

## Final Gate

`APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE`

This module may proceed as a docs-aligned settings contract. It must not proceed to "runtime complete" until V8 memory controls, superadmin handoff UX decision/evidence and E2E preference persistence evidence are completed.
