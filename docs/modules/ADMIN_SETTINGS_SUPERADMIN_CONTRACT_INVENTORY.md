# Admin, Settings, SuperAdmin Contract Inventory

This document is the working source of truth for active product surfaces mounted by the current routing layer.

It tracks:
- mounted route or section
- production component owner
- API contract currently used by UI
- implementation status

Status legend:
- `real`: mounted and backed by real HTTP calls
- `partial`: mounted, but some data or actions are still incomplete
- `stub`: mounted, but source of truth is local state, localStorage, or fake success responses
- `legacy-child`: still reachable through a mounted parent, but no longer a canonical top-level surface
- `unused`: present in repo, not mounted by the active route tree

## Active Mount Points

Top-level routing currently mounts:
- `/settings/*` -> `SettingsView`
- `/admin/*` -> `AdminView` -> `AdminSettingsModule`
- `/superadmin/*` -> `SuperAdminView`

Canonical route sources:
- `src/routes/AppRoutes.tsx`
- `src/routes/routeConfig.ts`
- `src/views/SettingsView.tsx`
- `src/views/admin/AdminSettingsModule.tsx`
- `src/views/superadmin/SuperAdminView.tsx`

## Settings Inventory

| Section | Mounted component | API contract used by UI | Status |
| --- | --- | --- | --- |
| `overview` | `SettingsOwnershipPanels` | `GET /api/organization-context`, `GET /api/settings/registry/:key/resolve` | `real` |
| `tenant-defaults` | `SettingsOwnershipPanels` | `GET /api/organization-context`, `GET /api/settings/registry/:key/resolve` | `real` |
| `tenant-branding` | `SettingsOwnershipPanels` | `GET /api/organization-context`, `GET /api/settings/registry/:key/resolve` | `real` |
| `tenant-security` | `SettingsOwnershipPanels` | `GET /api/organization-context`, `GET /api/settings/registry/:key/resolve` | `real` |
| `module-preferences` | `SettingsOwnershipPanels` | `GET /api/organization-context`, `GET /api/settings/registry/:key/resolve` | `real` |
| `profile` | `ProfileSettings` | `PUT /api/users/:id` | `real` |
| `avatar` | `AvatarPhotoSettings` | `POST /api/users/:id/avatar`, `DELETE /api/users/:id/avatar` | `real` |
| `signatures` | `EmailSignaturesSettings` | `GET/POST /api/settings/signatures`, `PUT/DELETE /api/settings/signatures/:id`, `POST /api/settings/signatures/:id/default` | `real` |
| `working-hours` | `WorkingHoursSettings` | `GET/PUT /api/settings/working-hours` | `real` |
| `dashboard` | `DashboardPreferencesSettings` | `GET/PUT /api/settings/preferences/dashboard` | `real` |
| `work-preferences` | `WorkPreferencesSettings` | `GET/PUT /api/settings/preferences/work` | `real` |
| `regional` | `RegionalSettings` | `GET /api/organization-context`, `GET/PUT /api/settings/preferences/regional` | `real` |
| `language` | `LanguageSettings` | `GET /api/organization-context`, local i18n change only | `partial` |
| `ai-behavior` | `AIBehaviorSettings` | `GET/PUT /api/ai-settings/user` | `real` |
| `ai-model-params` | `AIModelParametersSettings` | `GET /api/ai-settings/available-models`, `GET/PUT /api/ai-settings/user` | `real` |
| `ai-autocomplete` | `AIAutoCompleteSettings` | `GET/PUT /api/ai-settings/user` | `real` |
| `ai-memory` | `AIMemorySettings` | `GET/PUT /api/ai-settings/user` | `real` |
| `ai-privacy` | `AIPrivacySettings` | `GET/PUT /api/settings/preferences/ai-privacy` | `partial` (`API_WIRED_NOT_E2E_PROVEN`) |
| `ai-prompt-library` | `AIPromptLibrarySettings` | `GET/PUT /api/settings/preferences/prompt-library` | `partial` (`API_WIRED_NOT_E2E_PROVEN`) |
| `ai-voice` | `VoiceSettings` | `GET/PUT /api/settings/preferences/ai-voice` | `partial` (`API_WIRED_NOT_E2E_PROVEN`) |
| `ai-usage` | `AIUsageDashboard` | `GET /api/ai-settings/user/costs?period=...` | `real` |
| `notifications-overview` | `NotificationSettings` | `GET/POST /api/settings/notifications`, `GET /api/integrations` | `real` |
| `notifications-email-digest` | `EmailDigestSettings` | `GET/PUT /api/settings/notifications/email`, `GET/PUT /api/settings/notifications/digest` | `real` |
| `notifications-desktop-sounds` | `DesktopSoundsSettings` | `GET/PUT /api/settings/notifications/sounds` | `real` |
| `notifications-availability` | `AvailabilitySettings` | `GET/PUT /api/settings/notifications/dnd`, `GET/PUT /api/settings/preferences/quietHours` | `real` |
| `security-dashboard` | `SecurityOverviewPage` | `GET /api/auth/sessions`, login history, recovery settings, MFA status | `real` |
| `auth-access` | `AuthenticationAccessPage` | sessions, login history, recovery, password change, revoke actions | `real` |
| `connected-apps` | `ConnectedAppsSettings` | settings integrations REST and OAuth start/test/disconnect flows | `real` |
| `calendar-sync` | `CalendarSyncSettings` | settings integrations REST, calendar preferences, OAuth start | `real` |
| `api-keys` | `APIAccessSettings` | `GET/POST/PUT/DELETE /api/settings/api-keys`, rotate, usage | `real` |
| `webhooks` | `WebhooksSettings` | `GET/POST/PUT/DELETE /api/settings/webhooks`, deliveries, retry, test | `real` |
| `data-controls` | `DataControlsSettings` | GDPR consent, retention, export, deletion APIs | `real` |
| `privacy` | `PrivacySettings` | stubbed load helper, real save to `PUT /api/settings/preferences/privacy` | `partial` |
| `theme` | `ThemeSettings` | stubbed appearance helpers | `stub` |
| `accessibility` | `AccessibilitySettings` | stubbed helpers in `api.ts` | `stub` |
| `shortcuts` | `KeyboardShortcutsSettings` | stubbed helpers in `api.ts` | `stub` |
| `import-export` | `SettingsExportImport` | stubbed export/import helpers | `stub` |
| `templates` | `SettingsTemplates` | stubbed template helpers | `stub` |
| `developer` | `DeveloperSettings` | stubbed developer settings helpers | `stub` |
| `beta-features` | `DeveloperSettings` | same as developer settings | `stub` |
| `settings-history` | `SettingsHistory` | stubbed history helpers | `stub` |

## Admin Inventory

`AdminSettingsModule` is the only canonical production shell for `/admin/*`.

| Section | Mounted component | API contract used by UI | Status |
| --- | --- | --- | --- |
| `overview` | `AdminEnterpriseOverviewPanel` | `GET /api/admin/overview` | `real` |
| `people` | `AdminMembersRolesPanel` | organization members CRUD, access code create | `real` |
| `security` | `AdminSecurityIdentityPanel` | security policy, collaboration, API keys, IAM, SCIM | `real` |
| `billing` | `AdminBillingFinOpsPanel` | billing summary, payment methods, invoices, alerts, tax settings | `real` |
| `ai` | `AdminAIControlCenterPanel` | `GET /api/admin/ai/summary`, org AI settings, LLM/token/help analytics subviews | `real` |
| `integrations` | `UnifiedSyncHub` | V8 sync APIs plus REST fallbacks | `real` |
| `audit` | `AdminAuditLogPanel` | audit logs, stats, risk summary, export, retention | `real` |
| `operations` | `AdminOrganizationOperationsPanel` | organization data, members, competency catalog; some actions still indirect | `partial` |
| legacy aliases | `LegacyAdminHandoffPanel` | navigation handoff only | `legacy-child` |

## SuperAdmin Inventory

`SuperAdminView` remaps many legacy `AppView` values into canonical mounted branches.

| Route branch | Mounted component | API contract used by UI | Status |
| --- | --- | --- | --- |
| `customers`, `overview`, customer legacy entries | `CustomersModule` | organizations, user ops, communication, commercial submodules | `real` |
| `ai-platform` and legacy AI entries | `AIPlatformModule` | governance, LLM configuration, observability, V8 admin diagnostics, knowledge, prompts | `real` |
| `system`, `configuration`, `analytics`, `api-keys` | `SystemModule` | system health, metrics, feature flags, backups, integrations, analytics, API keys | `real` |
| `content`, `compliance` | `GovernanceModule` | operator overview, timeline, audit/compliance/legal children | `real` |
| `security`, `sso`, `security-policies` | `SecurityModule` | SSO, security policies, IAM, DLP and related controls | `real` |
| `virtual-workers` | `VirtualWorkersModule` | virtual worker CRUD, analytics, release, knowledge, conversations | `real` |
| legacy app views remapped into the above | `CustomersModule`, `AIPlatformModule`, `SystemModule`, `SecurityModule`, `GovernanceModule` | same as canonical module | `legacy-child` |

## Immediate Implementation Targets

The highest-priority mounted stubs or partial flows that must be replaced before claiming production readiness are:
- `AccessibilitySettings`
- `DeveloperSettings`
- `SettingsExportImport`
- `SettingsTemplates`
- `SettingsHistory`
- `ThemeSettings`
- `KeyboardShortcutsSettings`
- `PrivacySettings` load path
- `AIPrivacySettings` E2E persistence evidence
- `AIPromptLibrarySettings` E2E persistence evidence
- `VoiceSettings` E2E persistence evidence
- `OrgAISettingsView` raw fetch client
- `PromptManagementUI` preview and test actions

## Canonical Rules

- Mounted surfaces must not use fake success responses.
- Mounted surfaces must not use local mock state as their source of truth.
- Canonical admin entry points are `SettingsView`, `AdminSettingsModule`, and `SuperAdminView`.
- Legacy views can remain only if they are mounted strictly as child content or redirect shells.
- Stage 1.5 Settings audit reclassifies API-wired rows separately from pure stubs; `API_WIRED_NOT_E2E_PROVEN` is not production-ready until runtime persistence evidence exists.
