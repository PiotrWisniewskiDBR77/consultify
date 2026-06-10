# Module 18 — Ustawienia — Readiness Scorecard

**Readiness: 76/100 — Tier: Beta — Δ +4 vs baseline 72**
**Route(s):** `/settings/*` (frontend), `/api/settings/*`, `/api/ai-settings/*`, `/api/auth/change-password`, `/api/users/:id`
**One-line verdict:** Two of five baseline blockers are fully fixed (calendar 501, push gating). One is half-fixed (AI fallback exists but routed to dead file). One regression found: frontend deletion flow routes to an unprotected `/api/gdpr/deletion-request` endpoint (no password check); the bcrypt-gated route in settings.routes.ts is unreachable from the UI. Audit log coverage expanded significantly. Demo toggle confirmed live.

---

## Verified changes since baseline (2026-06-02)

### 1. Account deletion — bcrypt verification: PARTIALLY FIXED + ROUTING GAP (REGRESSION)
`server/src/routes/settings.routes.ts:3014–3029` — bcrypt IS now present. `password` required (400), `bcrypt.compareSync` at line 3028 blocks wrong password (403). The old TODO comment is gone.

**However, the frontend never calls this route.** `DataControlsSettings.tsx:366` calls `Api.requestGdprDeletion()` which posts to `/api/gdpr/deletion-request` (`gdpr.routes.ts:533–575`) — that handler has NO password field, NO bcrypt check. The bcrypt-gated endpoint at `/api/settings/gdpr/deletion-request` is unreachable from the UI.

Additionally, `Api.deleteAccount` in `api.ts:10554` (used by `AccountManagementSettings.tsx:35`) is a stub that returns immediately with no HTTP call.

**Net effect:** Account deletion can be triggered by any authenticated session with just a phrase match ("delete my data") and no password re-confirmation. The baseline security gap is not resolved in the path users actually take.

### 2. Calendar OAuth — 501 honest, no fake success: FIXED
`server/src/routes/settings.routes.ts:2318–2326`
- `POST /api/settings/calendar/connect` now returns `501 { success: false, available: false }` with an explicit "not yet available" message.
- Frontend `CalendarSyncSettings.tsx:89–96` catches the error and calls `toast.error(message)` + sets `actionError`; no "connected" state is set.
- Confirmed: `DegradedState` banner renders if load itself fails (`CalendarSyncSettings.tsx:182`).

### 3. AI settings graceful fallback: PARTIALLY FIXED — critical routing gap remains
The `server/src/routes/ai-settings.routes.ts` (root) has a complete fallback layer (imports `aiSettingsFallback.ts`, `getUserSettingsFallback`, `updateUserSettingsFallback`; lines 311–323 / 344–387). Unit tests exist in `server/src/routes/__tests__/aiSettingsFallback.test.ts`.

**However:** Gateway.ts line 37/486 mounts `server/src/routes/ai/ai-settings.routes.ts` (the `ai/` subdirectory version), NOT the root file. The `ai/` version still has hard 503 for `GET /user` (line 307) and `PUT /user` (line 338) when `AISettingsService` is null — no fallback to `user_preferences`. The fallback file and its tests are unused at runtime.

**Net effect:** AI Behavior / Model / Parameters pages still return 503 if `aiSettingsService.js` fails to import at startup. Baseline blocker is NOT resolved in production.

### 4. Push notifications — gated, not silently broken: FIXED
`src/components/settings/PushNotificationsSettings.tsx:8–10, 194–205`
- Desktop push uses the real W3C Notification API with OS permission gating.
- Mobile push row is explicitly disabled, labelled "coming soon — requires the Consultify mobile app", backed by a smoke test (`__tests__/PushNotificationsSettings.smoke.test.tsx`).

### 5. Settings audit log — coverage expanded: IMPROVED
`logSettingsChange` call count: 2 (baseline, appearance + developer only) → **16 calls** across: recovery, notifications, privacy, GDPR consents, GDPR retention, AI instructions, AI model, AI parameters, AI personality, AI memory, AI voice, AI privacy, API key rotate, appearance, developer. Still missing: profile updates, webhooks CRUD, email signatures, working hours, template saves. Settings History is now meaningfully populated.

### 6. Demo toggle in Settings: CONFIRMED LIVE
`src/components/settings/DataControlsSettings.tsx:210, 662–684`
- `useDemo()` hook wires `isDemoMode` / `toggleDemoMode` / `demoOrganization`.
- Toggle is rendered as a `SettingsToggle` inside a "Sample Workspace" card; when active it shows the active org name (Atelier Toys).
- Smoke test at `src/components/settings/__tests__/DataControlsSettings.smoke.test.tsx:85–93` verifies toggle click calls `toggleDemoMode` with `{ source: 'settings_data_controls' }`.

---

## Functionality map (persist vs cosmetic)

| Section | State |
|---|---|
| Profile, Avatar, Working Hours | REAL — users table / user_preferences |
| Email Signatures | REAL — email_signatures table |
| Regional, Notifications, Quiet Hours, DND, Sounds, Digest | REAL — user_preferences |
| AI Behavior / Model / Parameters / Personality | BETA — real if AISettingsService loads; hard 503 from ai/ route if it doesn't |
| AI Memory / Voice / Privacy / Prompt Library | REAL — user_preferences via settings.routes.ts |
| Theme / Appearance | REAL — user_preferences |
| Accessibility, Shortcuts, Privacy | REAL — user_preferences |
| Password change | REAL — bcrypt |
| Security, MFA, Sessions, Login History | REAL |
| Recovery Options | REAL — user_preferences |
| Integrations (Connected Apps) | REAL — governed OAuth engine |
| Calendar Sync | STUB (connect returns 501 honestly; UI shows error, not fake success) |
| API Keys | REAL — SHA-256 hashed, user_api_keys |
| Webhooks | REAL — user_webhooks |
| GDPR export / deletion | PARTIAL — bcrypt gate exists in settings.routes.ts but UI calls unprotected gdpr.routes.ts; no password re-confirmation in actual user flow |
| Settings History | REAL — 16 logSettingsChange call sites |
| Settings Templates | REAL — settings_templates |
| Developer Mode | REAL — developer_settings |
| Demo Toggle | REAL — useDemo hook, DataControlsSettings |
| Push Notifications (desktop) | REAL — W3C Notification API |
| Push Notifications (mobile) | GATED — "coming soon" badge, no silent no-op |

---

## Intra-module flow & states

- All preference writes use the shared `upsertUserPreferenceValue` helper (settings.routes.ts:85).
- Atomic errors: `asyncHandler` wraps every route; DB failures surface as 500 not unhandled rejections.
- Frontend error path: `normalizeApiErrorMessage` + `DegradedState`/`ErrorState` used consistently across `AIBehaviorSettings.tsx`, `CalendarSyncSettings.tsx`, `PushNotificationsSettings.tsx`.
- Restore: `settings_audit_log` restore endpoint at settings.routes.ts:4683 correctly reads old_value and writes back.

---

## UI/UX adherence

Consistent use of `SettingsSection`, `SettingsFormRow`, `SettingsDivider`, `SettingsToggle`, `SettingsSelect`, `SettingsButtonGroup`, `SettingsTextarea` from `src/components/settings/shared/`. Two-column layout (sidebar + content) maintained. `TeresaMark` icon integrated at `src/components/settings/ai/AIModelSelectionSettings.tsx:232`. Minor: `BillingSettings.tsx` still uses direct className composition, not shared primitives.

---

## Cross-module handoffs

- **Demo toggle → DemoContext:** `toggleDemoMode` from `useDemo()` — live, tested.
- **AI settings → Teresa pipeline:** `GET /api/ai-settings/effective` feeds Teresa's context builder (`aiContextBuilder.ts`); effective route in `ai/ai-settings.routes.ts:393` uses `respondServiceNotConfigured` fallback with empty `{ settings: {} }` if service unavailable — pipeline gets empty context, not an exception.
- **Billing:** delegated to `BillingCore`, no Settings ownership.

---

## Risks / regressions / runtime

1. **CRITICAL — GDPR deletion: no password check in live user path.** `DataControlsSettings.tsx:366` → `Api.requestGdprDeletion()` → POST `/api/gdpr/deletion-request` (`gdpr.routes.ts:533`) schedules deletion without bcrypt re-confirmation. Any authenticated session can self-delete with a text match only. Fix: wire the frontend to POST `/api/settings/gdpr/deletion-request` with `{ password }` in the body, or add bcrypt to `gdpr.routes.ts`. Also: `Api.deleteAccount` at `api.ts:10554` is a stub (returns immediately); `AccountManagementSettings` delete button silently does nothing.
2. **CRITICAL — ai/ route routing gap:** `Gateway.ts:37/486` mounts `ai/ai-settings.routes.ts`; graceful fallback lives in root `ai-settings.routes.ts`. Root file and `aiSettingsFallback.ts` are dead at runtime. AI Behavior / Model / Parameters still return 503 if service unavailable. Fix: re-point Gateway import or port fallback into `ai/ai-settings.routes.ts`.
3. **Calendar 501 — UI clarity:** Connect CTA will always trigger a toast error. Replace with "Coming Soon" badge.
4. **Audit log gaps:** Profile, webhooks CRUD, email signatures, working hours, template saves are not logged; Settings History is incomplete for those sections.
5. **Duplicate route files:** `server/src/routes/ai-settings.routes.ts` vs `server/src/routes/ai/ai-settings.routes.ts` — both live; the root file is never mounted but looks authoritative. Risk of wrong-file edits.

---

## Top gaps to reach 90+

1. **Fix GDPR deletion password gate** — either point `Api.requestGdprDeletion()` to `/api/settings/gdpr/deletion-request` with `{ password }`, or add bcrypt to `gdpr.routes.ts:533`. Also fix the `Api.deleteAccount` stub.
2. **Re-wire ai/ route to use aiSettingsFallback** — port `getUserSettingsFallback`/`updateUserSettingsFallback` into `server/src/routes/ai/ai-settings.routes.ts`; delete the dead root `ai-settings.routes.ts`.
3. **Mark Calendar as "Coming Soon" in UI** — replace connect CTA with a disabled badge.
4. **Expand audit log** — add `logSettingsChange` to PUT `/api/users/:id`, webhooks CRUD, email signature writes, working hours.
