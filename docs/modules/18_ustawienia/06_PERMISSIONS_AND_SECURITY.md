---
module_id: MODULE_SETTINGS
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & Security — Ustawienia

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- User can edit own settings; admin/tenant settings require admin route and role.
- Settings must remain user/workspace preference hub and must not mutate admin/superadmin policy domains directly.

Function-level enforcement applies uniformly to: `SET_SETTINGS_WORKSPACE`, `SET_POLICY_BOUNDARY_LINKS`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.
- MUST keep cross-links to admin/superadmin explicit and ownership-safe (no hidden capability hints for unauthorized roles).

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.
- SHOULD disclose ownership reason when a setting is read-only due to policy.

## As-Is Permission Evidence (source -> decision -> evidence)

| Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- |
| `AppRoutes.tsx` + `ProtectedRoute.tsx` | KEEP: settings is auth-protected; admin/superadmin are role-protected | `/settings/*` (`requireAuth`), `/admin/*` (`ADMIN`), `/superadmin/*` (`SUPERADMIN`) |
| `SettingsOwnershipPanels.tsx` | KEEP/ENHANCE: policy-owned controls are read-only with handoff to owner route | organization/admin handoff exists; superadmin handoff contract not explicit (`NOT_DONE`) |
| `routeConfig.ts` + `SettingsView.tsx` | KEEP: settings stays in one route family and does not mount admin/superadmin runtime internally | all settings sections render inside `SettingsView`; no admin route mount inside settings |
| `USER_AND_ADMIN_MEMORY_CONTROLS_V8.md` + settings memory/privacy components | ENHANCE: privacy posture must avoid over-claiming user memory control scope | full V8 user/admin/operator split still partial in runtime (`NOT_DONE`) |
| `server/src/routes/settings.routes.ts` | KEEP: legacy root settings API is not a user settings policy bypass | non-superadmin requests to `/api/settings` root receive `LEGACY_SETTINGS_SCOPE_BLOCKED`; PASS |

## Acceptance Criteria

- [x] Unauthorized users cannot view/mutate protected admin and superadmin routes.
- [ ] High-impact settings changes have complete approval/audit evidence across all settings subdomains (`NOT_DONE`).
- [x] Sensitive data stays scoped by route role guards and settings ownership boundaries.
- [x] Legacy system settings root is blocked for non-superadmin users.
- [ ] Explicit superadmin ownership handoff pattern is documented and validated in settings UX (`NOT_DONE`).
- [ ] E2E audit confirms settings cannot directly mutate admin/superadmin policy controls (`NOT_DONE`).

## STAN ZMIERZONY 2026-09-01 (dyżur 238) — bramka widoczności sekcji dla pilota

Ta sekcja dokumentu wcześniej nie opisywała mechanizmu ograniczającego
zwykłego użytkownika (pilota) do podzbioru sekcji Ustawień. Zmierzone
bezpośrednio na `SettingsSidebar.tsx` i `pilotAccess.ts`:

| Element | Zmierzone | Dowód |
| --- | --- | --- |
| Pełna lista sekcji | 37 liści w 10 grupach | `src/components/settings/SettingsSidebar.tsx` (pomiar bezpośredni `grep`) |
| Dozwolone dla pilota | 4: `profile`, `auth-access`, `language`, `theme` | `src/utils/pilotAccess.ts:15-19` |
| Mechanizm ukrywania | **Usuwa** pozycje z listy (nie kłódka) | `SettingsSidebar.tsx:491-492` |
| Przekierowanie z zablokowanej trasy | **Ciche** — brak wpisu do dziennika w tym bloku | `src/components/RouterSync.tsx:330-344` (wpis do dziennika ma sąsiedni blok `316-327`) |

**Ryzyko bezpieczeństwa nazwane wprost:** to jest UI-owy filtr nawigacji, nie
dowód separacji danych API/DB dla pilota — ten pomiar nie sprawdza, czy
backend odmawia zapisu/odczytu dla sekcji spoza allowlisty niezależnie od UI.

Test regresyjny (dowiedziony mutacyjnie 1.09):
`src/components/settings/__tests__/SettingsSidebar.pilotSectionFilter.test.tsx`
(commit `93a6092cd6`) i `src/components/__tests__/RouterSync.pilotSettingsSilentRedirect.test.tsx`
(commit `4c59a77010`). Pełny pomiar:
`docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`.
