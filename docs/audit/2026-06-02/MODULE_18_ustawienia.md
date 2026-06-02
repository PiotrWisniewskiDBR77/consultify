# Module 18 — Ustawienia — Readiness Scorecard

**Readiness: 72/100 — Tier: Beta**
**Route(s):** `/settings/*` (frontend), `/api/settings/*`, `/api/ai-settings/*`, `/api/auth/change-password`, `/api/users/:id`
**One-line verdict:** Core persistence (profile, regional, notifications, security, integrations, AI behavior, appearance) is genuinely backend-wired; a real gap exists in the AI settings layer (19 routes behind a service-availability guard that returns 503 if AISettingsService is unconfigured), calendar sync pretends to connect without real OAuth, and the old audit doc's 98/100 score is wildly inflated.

---

## Settings sections (which persist vs which are cosmetic)

- **Profile (name, job title, timezone, etc.):** REAL — `Api.updateUser` → `PUT /api/users/:id` → `users` table (`server/src/routes/users.routes.ts:188`)
- **Avatar/Photo:** REAL — separate upload route; referenced in old doc, not re-verified in depth
- **Email Signatures:** REAL — `email_signatures` table, CRUD routes at `/api/settings/email-signatures` (`settings.routes.ts:3402–3550`)
- **Working Hours:** REAL — `user_preferences` table, `/api/settings/working-hours` (`settings.routes.ts:3318`)
- **Regional, Notifications (all), Quiet Hours, DND, Sounds, Digest:** REAL — all backed by `user_preferences` via `upsertUserPreferenceValue` (`settings.routes.ts:85`)
- **Language:** REAL — i18n localStorage (no backend needed)
- **AI Behavior / Instructions / Personality / Autocomplete / Memory / Parameters / Model:** BETA — frontend calls `/api/ai-settings/user` GET/PUT which routes through `AISettingsService`; service IS present (`aiSettingsService.ts:338, 370`) and uses `user_ai_settings` table, but every route has a `respondServiceNotConfigured` guard that returns 503 if the module fails to import at startup — no graceful partial fallback
- **AI Usage Dashboard:** BETA — reads `ai_usage_logs` table (`aiSettingsService.ts:551`); empty in fresh installs; dashboard shows zeros not a stub UI
- **AI Voice / AI Privacy / Prompt Library / AI Memory:** REAL — `/api/settings/preferences/ai-voice`, `ai-privacy`, `ai-memory`, `prompt-library` all exist in `settings.routes.ts:4030–4253` and write to `user_preferences`
- **Theme / Appearance:** REAL — `/api/settings/preferences/appearance` persists to `user_preferences`; ThemeSettings also reads back on load (`settings.routes.ts:5271`)
- **Accessibility / Keyboard Shortcuts / Privacy / GDPR Consents & Retention:** REAL — all wired, `settings.routes.ts:2493, 2554, 2417, 2665, 2712`
- **Password Change:** REAL — `/api/auth/change-password` (`auth.routes.ts:1968`)
- **Security Overview / MFA / Sessions / Login History:** REAL — backend routes exist in `settings.routes.ts:5540`; `security.routes.ts`, `auth.routes.ts` handle MFA
- **Recovery Options:** REAL — `/api/settings/recovery` GET/PUT writes to `user_preferences` (`settings.routes.ts:244–318`)
- **Integrations (Connected Apps):** REAL — full OAuth engine + governed integrations path; `settings.routes.ts:1531–2099`
- **Calendar Sync:** STUB — `POST /api/settings/calendar/connect` always returns `{ success: true, authUrl: null }` and marks connected=true without any real OAuth handshake (`settings.routes.ts:2302–2326`)
- **API Keys:** REAL — `user_api_keys` table, CRUD + rotate at `/api/settings/api-keys` (`settings.routes.ts:4820–5040`); key is SHA-256 hashed at rest
- **Webhooks:** REAL — `user_webhooks` table, CRUD + test endpoint (`settings.routes.ts:5045–5260`)
- **Dashboard/Work Preferences:** REAL — `user_preferences` via `/api/settings/preferences/dashboard`, `/preferences/work`
- **Data Controls (GDPR export/deletion):** REAL — `gdpr_requests` table, grace-period deletion flow (`settings.routes.ts:2764–3115`)
- **Settings Export/Import:** REAL — reads/writes all `user_preferences` keys + profile columns (`settings.routes.ts:4682–4820`)
- **Settings History:** REAL — `settings_audit_log` table, restore capability (`settings.routes.ts:4596–4680`)
- **Settings Templates:** REAL — `settings_templates` table (`settings.routes.ts:4397–4595`)
- **Developer Mode:** REAL — `developer_settings` table (`settings.routes.ts:5362–5470`)
- **Billing:** REAL (delegated) — `BillingSettings.tsx` wraps `BillingCore` which is the canonical billing surface; no direct settings route ownership

---

## What's REAL (verified + backend-wired)

- `server/src/routes/settings.routes.ts:85` — `upsertUserPreferenceValue` used by 20+ preference endpoints
- `server/src/routes/settings.routes.ts:244` — `/recovery` GET/PUT → `user_preferences`
- `server/src/routes/settings.routes.ts:324–421` — regional preferences persisted
- `server/src/routes/settings.routes.ts:428–503` — notifications preferences persisted
- `server/src/routes/settings.routes.ts:1531–1688` — integrations GET/connect/delete with governed fallback
- `server/src/routes/settings.routes.ts:2302` — calendar GET + settings real; only connect is stub
- `server/src/routes/settings.routes.ts:4596` — settings history reads `settings_audit_log`
- `server/src/routes/settings.routes.ts:4690` — settings export reads all `user_preferences`
- `server/src/routes/settings.routes.ts:4820` — API keys with SHA-256 hashing
- `server/src/services/aiSettingsService.ts:338` — `getUserSettings` reads `user_ai_settings` table
- `src/components/settings/ProfileSettings.tsx:501` — `Api.updateUser(currentUser.id, updates)` → real DB

## What's MOCK / hardcoded / stub

- `server/src/routes/settings.routes.ts:2302–2326` — `POST /calendar/connect` sets `connected: true` and returns `authUrl: null` without any real OAuth; externalEmail falls back to `req.user?.email || 'user@example.com'`
- `server/src/routes/settings.routes.ts:3010` — `// In production, verify password here` comment in deletion endpoint; password is NOT verified before scheduling deletion
- `server/src/routes/ai-settings.routes.ts:72` — `respondServiceNotConfigured` returns 503 instead of graceful partial defaults for all 19 AI settings routes if `AISettingsService` fails to import
- `src/services/api.ts:14756–14763` — `getAIAutoComplete` hardcodes `sensitivity: 0.5, suggestionsInComments: true` as client-side defaults (not persisted per those fields)

## What's BROKEN / NO_GO / missing

- **Calendar OAuth is fake** — `POST /api/settings/calendar/connect` marks integration active without real token exchange; users see "connected" but nothing syncs
- **AI settings degraded-to-503** — if `aiSettingsService.js` has any import error at server startup, all of AI Behavior / Model / Parameters / Personality pages show a service-unavailable error with no fallback to `user_preferences`
- **Deletion without password verification** — `/api/settings/gdpr/deletion-request` schedules account deletion with no password confirmation (comment at line 3010 acknowledges this); security risk
- **Push Notifications** — UI exists but no FCM/APNS integration; `user_preferences` records a flag but no actual push delivery path
- **Settings audit log is write-only in practice** — `logSettingsChange` is called in only a handful of routes (appearance, developer), not across all settings sections, so the history view will be sparse

---

## Backend wiring

**Real and persisting:** preferences (regional, notifications, quiet hours, DND, sounds, digest, inbox-ai, ai-providers, accessibility, shortcuts, privacy, ai-memory, ai-voice, ai-privacy, prompt-library, appearance, dashboard, working-hours, calendar-settings, gdpr-consents, gdpr-retention) all write to `user_preferences` via `upsertUserPreferenceValue`. Profile → `users` table via `PUT /api/users/:id`. API keys → `user_api_keys`. Webhooks → `user_webhooks`. Email signatures → `email_signatures`. Settings templates → `settings_templates`. Developer settings → `developer_settings`. GDPR requests → `gdpr_requests`. Recovery → `user_preferences`.

**Gated/degraded:** AI settings behavior (instructions, model params, personality) → `user_ai_settings` table, real, but guarded behind `AISettingsService` availability with a hard 503 fallback rather than default values.

**Not real:** Calendar OAuth connect — fake token; no actual calendar data sync.

---

## UI/UX consistency

SettingsView uses the shared `SettingsSection`, `SettingsFormRow`, `SettingsDivider`, `SettingsToggle`, `SettingsSelect`, `SettingsTextarea`, `SettingsButtonGroup` primitives from `src/components/settings/shared/` across nearly all panels. Consistent two-column layout (sidebar + content) with pilot access gating. Minor inconsistency: some older panels (e.g. `BillingSettings`) use direct className composition instead of shared primitives. Overall quality is solid.

---

## Tests

`server/src/routes/__tests__/settings.routes.test.ts` — exists, covers integration authority continuity (governed vs legacy integrations, OAuth flows, regional defaults from org context). Coverage is narrowly focused on the integrations section; notification, preferences, AI, GDPR, and security subsections have no direct unit/integration tests in this file. No frontend component tests found for settings components.

---

## Doc-vs-code drift

The existing `docs/SETTINGS_MODULE_AUDIT_FINAL.md` (dated 2026-01-10, score: 98/100) is **significantly stale and inflated**:
- Claims Theme → `localStorage` only (partially wrong; it now persists to `user_preferences` via `/preferences/appearance`)
- Claims AI Usage Dashboard hits `/api/settings/ai-usage` (wrong; actual endpoint is `/api/ai-settings/user/costs`)
- Claims AI Instructions hit `/api/settings/preferences/ai-instructions` (wrong; actual path goes through `/api/ai-settings/user` via `AISettingsService`)
- Does not mention the calendar OAuth stub or the password-less deletion gap
- Lists Push Notifications at 75% without noting it is entirely non-functional in production

`docs/modules/18_ustawienia/STATUS.md` and `CODEMAP.md` correctly identify the runtime class as `real` and the route as `/settings/*`, but are too abstract to catch the gaps above.

---

## Top gaps to reach market-ready (prioritized)

1. **Implement real Calendar OAuth** — replace the stub `POST /calendar/connect` with an actual OAuth flow (Google/Outlook) or clearly mark the section as "coming soon" in the UI instead of faking a successful connection
2. **Add password verification to account deletion** — `settings.routes.ts:3010` comment acknowledges this is missing; high security risk; add `bcrypt.compare` before scheduling
3. **Harden AI settings degradation** — if `AISettingsService` fails to load, fall back to `user_preferences` defaults rather than returning 503; the 19 AI settings pages going blank on a service hiccup is a UX blocker
4. **Expand settings audit log coverage** — `logSettingsChange` is called for appearance and developer sections only; add it to notifications, AI, security, and privacy writes so Settings History is actually useful
5. **Remove or scope push notifications UI** — either wire FCM/APNS or add a "requires mobile app" gate instead of letting users toggle settings that have no effect
6. **Frontend tests for settings components** — zero component-level tests; critical flows (profile save, recovery options, API key rotation) should have at least smoke tests
