---
module_id: MODULE_SETTINGS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Ustawienia

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.
- Verify policy boundary handoff (settings -> organization/admin and superadmin doctrine).
- Verify memory/privacy semantics against `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`.

## Required Checks

- [x] Route opens documented runtime (`/settings/*`) and is auth-protected.
- [x] AppView enum and route mapping are consistent in `src/types/core.ts` and `routeConfig.ts`.
- [x] No contradiction with global ownership split (P31 settings, P32 admin, P33 superadmin).
- [x] Admin and superadmin routes are separately role-gated.
- [x] Superadmin handoff policy is explicitly defined in docs (admin-first mediation; direct superadmin handoff only in superadmin role context).
- [ ] Superadmin handoff pattern from settings is explicitly validated in UI/runtime (`NOT_DONE`).
- [ ] V8 memory controls parity (private mode/review/delete/forget semantics) is validated (`NOT_DONE`).

## Current Gate Expectation

- Expected gate result today: `APPROVED_FOR_DOCS_WITH_RUNTIME_NOT_DONE (runtime backlog P1/P2 remains).`
- This is docs readiness with explicit runtime `NOT_DONE` follow-ups.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `SET_SETTINGS_WORKSPACE` | Protected settings runtime is mounted and remains user/workspace hub | `AppRoutes.tsx`, `ProtectedRoute.tsx`, `SettingsView.tsx` | pass |
| `SET_POLICY_BOUNDARY_LINKS` | Settings vs admin/superadmin policy boundary is explicit and leak-safe | `SettingsOwnershipPanels.tsx`, `routeConfig.ts`, `AppRoutes.tsx` | pass (`partial`, superadmin handoff `NOT_DONE`) |

## Stage 1.5 Acceptance Matrix

| Row ID | Claim | Source | Decision | Evidence / NOT_DONE | Status |
| --- | --- | --- | --- | --- | --- |
| SET-15-ACC-01 | `/settings/*` is the user/workspace preferences hub | `AppRoutes.tsx`, `routeConfig.ts`, `SettingsView.tsx` | KEEP | Auth-protected settings route and nested settings view mapping | PASS |
| SET-15-ACC-02 | `/admin/*` owns tenant admin policy controls | `AppRoutes.tsx`, `AdminView.tsx` | KEEP | `requiredRole="ADMIN"` and `AdminView -> AdminSettingsModule` | PASS |
| SET-15-ACC-03 | `/superadmin/*` owns platform controls | `AppRoutes.tsx`, `SuperAdminView.tsx` | KEEP | `requiredRole="SUPERADMIN"` and dedicated `SuperAdminView` branches | PASS |
| SET-15-ACC-04 | Settings policy visibility is read-only and handoff-based | `SettingsOwnershipPanels.tsx` | KEEP/ENHANCE | Organization/Admin handoff exists; superadmin UX handoff missing | PASS_WITH_NOT_DONE |
| SET-15-ACC-05 | User memory controls match V8 user vocabulary | `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`, `AIMemorySettings.tsx`, `api.ts` | ENHANCE | `private_mode`, per-item review/delete and recent-session forget not evidenced | NOT_DONE |
| SET-15-ACC-06 | Tenant admin/operator memory controls are not editable through settings | V8 doc, route boundaries | KEEP | Settings owns user preference only; admin/superadmin route trees remain separate | PASS |
| SET-15-ACC-07 | AI privacy/prompt/voice are classified from live evidence | `AIPrivacySettings.tsx`, `AIPromptLibrarySettings.tsx`, `VoiceSettings.tsx`, `settings.api.ts`, `settings.routes.ts` | ENHANCE | FE+BE API wiring exists; E2E persistence proof missing | PASS_WITH_NOT_DONE |
| SET-15-ACC-08 | Legacy `/api/settings` root is blocked for non-superadmin users | `settings.routes.ts` | KEEP | `LEGACY_SETTINGS_SCOPE_BLOCKED` for non-superadmin root access | PASS |
| SET-15-ACC-09 | No hidden policy writes through settings | hard rule, `06_PERMISSIONS_AND_SECURITY.md`, runtime evidence | KEEP | Contract disallows direct policy writes; full E2E mutation audit not done | PASS_WITH_NOT_DONE |

## STAN ZMIERZONY 2026-09-01 (dyżur 238)

**Obalone**: powyższy „Current Gate Expectation" i matryce nie wspominają, że
karta modułu (`MODULE_ACCEPTANCE.md`) ma `G08`/`G09` `NOT_STARTED`, podczas
gdy `docs/FUNCTIONAL_DOCUMENTATION.md:57` niesie `CLOSED_FINAL 2026-08-25` —
**pierwszy przegląd wizualny nigdy się nie zaczął.** Sprzeczność między
dwoma dokumentami tego samego stanu — nierozstrzygnięta tutaj.

Zmierzone bezpośrednio: **37 sekcji w 10 grupach** (`SettingsSidebar.tsx`),
z czego zwykły użytkownik widzi **4** (`PILOT_ALLOWED_SETTINGS_SECTIONS`,
`src/utils/pilotAccess.ts:15-19`) — **33/37 (89%) usuwane z listy**, nie
dekorowane. Przekierowanie z zablokowanej trasy jest ciche (brak wpisu do
dziennika, `RouterSync.tsx:330-344`). Szczegóły bramki i test regresyjny:
`06_PERMISSIONS_AND_SECURITY.md`, sekcja „STAN ZMIERZONY 2026-09-01".

**Martwy kod zmierzony przy okazji**: `SidebarUsage.tsx` (`src/components/SidebarUsage.tsx:7-47`)
nie ma produkcyjnego importera; sam importuje realny `UsageMeters.tsx` z
`src/components/billing/`, nie z nieistniejącej ścieżki
`src/components/settings/UsageMeters.tsx`. Nie usunięto (poza zakresem
dyżuru 238).

Pełny pomiar: `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `src/components/ProtectedRoute.tsx`
- `src/components/settings/SettingsOwnershipPanels.tsx`
- `src/components/settings/AIMemorySettings.tsx`
- `src/components/settings/AIPrivacySettings.tsx`
- `src/components/settings/AIPromptLibrarySettings.tsx`
- `src/components/settings/VoiceSettings.tsx`
- `src/services/api.ts`
- `src/services/api/settings.api.ts`
- `server/src/routes/settings.routes.ts`
- `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`
- `docs/modules/18_ustawienia/STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`
