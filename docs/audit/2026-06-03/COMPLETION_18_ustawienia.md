# COMPLETION DOSSIER — Module 18: Ustawienia / Settings

**Audit date:** 2026-06-03  
**Score trajectory:** 72 (2026-06-02 audit) → 76 (2026-06-03 re-audit) → **current: ~76/100**  
**Gap to 100%:** 24 points across 8 concrete items  

---

## 1. Purpose / Goal / Vision

Settings is the **complete user control surface** for Consultify: every per-user preference, security posture, AI personality, integration credential, and privacy choice lives here. Vision (from `01_PURPOSE.md`, `SSOT.md`, `24_ADMIN_AND_SETTINGS_LAYOUTS.md`):

- User-scoped ownership only — org-level governance policy writes stay in Admin/Organization module.
- All preference writes must persist durably and round-trip back on reload; no silent no-ops, no fake success.
- AI settings section is the "personality dial" for Teresa — response style, model tier, system instructions, temperature/topP/penalties, memory, proactivity, and BYOK keys must all drive Teresa's runtime behavior.
- GDPR controls (export + deletion) must satisfy GDPR Article 17 with password re-confirmation, auditable request log, and grace-period cancellation.
- Settings History must be a genuine audit trail covering all writes, not just two categories.
- At 100% a user can configure every dimension of their Consultify experience (AI, integrations, notifications, security, appearance, billing) in one place, with all changes persisting and all security gates enforced.

---

## 2. Readiness to 100% — Score and Gap

**Current honest score: 76/100**

Score did not advance since 2026-06-03 re-audit; the two critical blockers (GDPR deletion path, ai/ route fallback) remain unresolved.

| # | Issue | File:Line | Severity |
|---|---|---|---|
| G1 | GDPR deletion: `Api.requestGdprDeletion()` calls `POST /api/gdpr/deletion-request` (`gdpr.routes.ts:533`) — no bcrypt re-confirmation, no password field; authenticated session can self-delete with only a phrase match | `src/services/api.ts:15280`, `server/src/routes/gdpr.routes.ts:533` | P0 |
| G2 | `Api.deleteAccount` in `api.ts:10669` is a stub that returns immediately (`return;`) — `AccountManagementSettings.tsx:35` delete button is silently broken | `src/services/api.ts:10669` | P0 |
| G3 | `Gateway.ts:37/486` mounts `server/src/routes/ai/ai-settings.routes.ts`; the `ai/` version lacks fallback for `GET /user` (line 307) and `PUT /user` (line 338) — hard 503 if `AISettingsService` fails at import; the graceful fallback in root `ai-settings.routes.ts` and `aiSettingsFallback.ts` is dead code at runtime | `server/src/Gateway.ts:37`, `server/src/routes/ai/ai-settings.routes.ts:307,338` | P0 |
| G4 | BYOK API keys stored plaintext in `user_preferences` JSON blob via `PUT /api/settings/preferences/ai-providers` — no encryption, no hashing; leaks in DB backup or SELECT * | `server/src/routes/settings.routes.ts:750-765` | P1 |
| G5 | Calendar connect CTA still returns 501 and triggers a `toast.error` — UI should replace CTA with a "Coming Soon" badge so the error path is never reached by users | `src/components/settings/CalendarSyncSettings.tsx:79-93` | P1 |
| G6 | Settings audit log missing for: profile (`PUT /api/users/:id`), webhooks CRUD, email signatures CRUD, working hours, template saves — Settings History view is incomplete for 5 major sections | `server/src/routes/users.routes.ts` (no `logSettingsChange`); `settings.routes.ts:3402-5260` | P1 |
| G7 | "Usage by Tier" chart in `AISettings.tsx:737-754` renders hardcoded static data (`Budget 85 req $1.20`, etc.) instead of reading from `costSummary` — live cost tracking data exists but the breakdown chart ignores it | `src/components/settings/AISettings.tsx:737-754` | P1 |
| G8 | No frontend tests for critical paths: profile save, API key rotation, GDPR export/deletion; only 5 smoke tests total exist across ~130 settings components | `src/components/settings/__tests__/` (5 files) | P2 |

---

## 3. Teresa Integration — Depth and Missing

**Wired and functioning:**

- `AISettings.tsx` calls `Api.getAIUserSettings()` → `GET /api/ai-settings/user` and `Api.updateAIUserSettings()` → `PUT /api/ai-settings/user`; persists to `user_ai_settings` table when `AISettingsService` loads.
- Fields saved: `response_style`, `writing_tone`, `preferred_language`, `proactivity_mode`, `model_temperature`, `max_tokens`, `top_p`, `frequency_penalty`, `presence_penalty`, `system_instructions`, `visible_model_ids`, `enable_pii_redaction`, `data_retention_policy`, `context_retention`, `auto_suggestions`.
- `AIContextBuilder.ts:220` calls `AISettingsService.getEffectiveSettings(userId, organizationId)` in parallel with other enrichment layers — settings reach Teresa as `context.aiSettings`.
- `/effective` endpoint in `ai/ai-settings.routes.ts:392` has a fallback: if `AISettingsService` unavailable, returns `respondServiceNotConfigured` with empty `{ settings: {} }` — pipeline gets empty context, not an exception.

**Critical gap — settings persist but do NOT drive Teresa prompt:**

- `AIPipeline.ts:806` reads only `prefs?.customInstructions || prefs?.system_instructions` from `ai_user_memory` table (fallback), NOT from the `user_ai_settings` table written by Settings.
- `response_style`, `writing_tone`, `proactivity_mode`, `personality_mode`, `model_temperature`, `topP`, `frequencyPenalty` are saved to `user_ai_settings` but there is zero code in `AIPipeline.ts`, `aiOrchestrator.ts`, `ai.routes.ts`, or `persona.ts` that reads these fields from the effective settings context and applies them to the LLM call.
- `context.aiSettings` is injected into the context object but never unpacked into actual OpenAI/Anthropic call parameters. A user setting temperature=1.8 and response_style='detailed' currently has no effect on Teresa's output.
- `proactivity_mode` saved in Settings reaches `ProactivitySelector` in `AISettings.tsx:142` and is persisted, but `aiProactivityEngine.ts` only provides a "basic fallback" stub (file opens: `// Basic proactivity engine fallback`).

**What is missing for full Teresa integration:**

- Wire `effective.model_temperature`, `effective.top_p`, `effective.frequency_penalty`, `effective.presence_penalty` into the actual `chat/completions` call parameters in `AIPipeline.ts` or `ai.routes.ts`.
- Wire `effective.response_style` / `effective.writing_tone` / `effective.system_instructions` into the Teresa system prompt construction at `ai.routes.ts:1799-1811`.
- Wire `effective.proactivity_mode` into `aiProactivityEngine.ts` to gate or shape proactive suggestions.
- Implement the real `aiProactivityEngine` (currently stub) using saved `proactivity_mode`.
- `AIPersonalitySettings.tsx` saves personality fields to `/api/settings/preferences/ai-personality` (user_preferences); these never reach Teresa.

---

## 4. System Integration

- **Demo toggle:** Live — `DataControlsSettings.tsx:210,662-684` uses `useDemo()` → `toggleDemoMode({ source: 'settings_data_controls' })`; smoke test confirms wiring. ✓
- **Plan display / Billing:** `BillingSettings.tsx` wraps `BillingCore`; no Settings-owned billing routes. AI Credits not yet surfaced in settings. Gap for v1: no plan tier or AI Credits balance displayed on the settings billing page.
- **BYOK:** Functional storage pipeline (`PUT /api/settings/preferences/ai-providers`) but keys stored plaintext in `user_preferences`; no server-side encryption. UI label claims "Never sent to our servers" — the claim is FALSE: keys are `POST`ed to `/api/settings/preferences/ai-providers` and stored in DB (G4).
- **Integrations (OAuth):** Full governed engine at `settings.routes.ts:1531-2099`; CalendarSync honestly returns 501. ✓
- **Org context policy enforcement:** `aiContextBuilder.ts:328-347` enforces `context_policy_json` from `organization_ai_settings` table before passing context to LLM — Settings security boundaries are respected.

---

## 5. Completion Plan to 100%

### P0 — Security blockers (must ship before GA, ~3h total)

| Task | File:Line | Effort |
|---|---|---|
| Fix GDPR deletion: point `Api.requestGdprDeletion()` to `POST /api/settings/gdpr/deletion-request` with `{ password }` body; or add bcrypt to `gdpr.routes.ts:533` | `src/services/api.ts:15280`, `server/src/routes/gdpr.routes.ts:533` | 1h |
| Fix `Api.deleteAccount` stub: implement real `POST /api/settings/gdpr/deletion-request` call with password + `reason` | `src/services/api.ts:10669` | 30m |
| Port `getUserSettingsFallback`/`updateUserSettingsFallback` from dead root `ai-settings.routes.ts` into `server/src/routes/ai/ai-settings.routes.ts:307,338`; delete dead root file | `server/src/routes/ai/ai-settings.routes.ts:307,338`, `server/src/routes/ai-settings.routes.ts` | 1.5h |

### P1 — Functional correctness (~5h total)

| Task | File:Line | Effort |
|---|---|---|
| Encrypt BYOK keys at rest: AES-256 encrypt before `upsertUserPreferenceValue`, decrypt on read; fix UI copy to "encrypted and stored server-side" | `server/src/routes/settings.routes.ts:750-765`, `src/components/settings/AISettings.tsx:848` | 1.5h |
| Replace CalendarSync connect CTA with "Coming Soon" badge — never call the 501 endpoint | `src/components/settings/CalendarSyncSettings.tsx:79-93,196-230` | 30m |
| Add `logSettingsChange` to `users.routes.ts:PUT /:id` (profile save), webhooks CRUD, email signature CRUD, working hours | `server/src/routes/users.routes.ts:188`, `settings.routes.ts:3402-5260` | 1h |
| Wire AI settings to Teresa prompt: read `effective.model_temperature`, `topP`, `frequencyPenalty`, `presencePenalty` into the `chat/completions` call; inject `system_instructions` + `response_style`/`writing_tone` into Teresa system prompt | `server/src/services/ai/AIPipeline.ts:806`, `server/src/routes/ai.routes.ts:1799-1811` | 2h |
| Fix hardcoded "Usage by Tier" chart — read from `costSummary` or remove and show real data only | `src/components/settings/AISettings.tsx:737-754` | 30m |

### P2 — Quality and polish (~3h total)

| Task | File:Line | Effort |
|---|---|---|
| Add `logSettingsChange` for AI model/behavior writes via `api/ai-settings/user` PUT (currently only in settings.routes.ts sub-routes, not the canonical ai/ route) | `server/src/routes/ai/ai-settings.routes.ts:337-380` | 30m |
| Wire `proactivity_mode` from user settings into `aiProactivityEngine.ts` real implementation | `server/src/services/aiProactivityEngine.ts` | 1h |
| Add smoke tests for profile save, API key rotation, GDPR deletion button visibility | `src/components/settings/__tests__/` | 1.5h |

**Estimated total to 100%: ~11h across P0+P1+P2.**
