# AI OS / Internal Tools — Remediation Program

**Date:** 2026-06-08
**Owner:** Piotr (CTO) · **Scope:** Internal Tools (AI OS) module
**Trigger:** V10 "Teresa voice workspace" panel reports `Voice enabled: no / Model: not configured / unavailable` while Teresa voice **actually works** in the app.

---

## 1. Executive summary

The Internal Tools (AI OS) module is a DBR77-only control plane for the AI layer
(actions, research, artifacts, memory, connectors, agents, outcomes). It now
carries a **beta** badge. Two surfaces inside it are misleading and must be fixed:

1. **V10 "Teresa voice workspace" panel** shows a **false negative** — it claims
   voice is unconfigured even though live voice works.
2. **"Wave 0–9 Runtime truth table"** is **hardcoded to PASS** — it is static
   documentation presented as a live readiness report.

Neither breaks user-facing functionality, but both erode trust in the cockpit
that is supposed to tell us the truth about the AI runtime.

---

## 2. Evidence (verified 2026-06-08, local @976e57c32b)

- **Real voice path works.** `GET /api/public/anna/voice-config` (no auth,
  DB-backed) returns live:
  ```json
  {"enabled":true,"voiceName":"Kore","session":{"clientToken":"...","tokenType":"ephemeral",...},"unavailableReason":null}
  ```
  → `GEMINI_LIVE_API_KEY` is present and a real ephemeral Gemini Live token is minted.

- **Panel path is a separate slice.** `GET /api/v10/teresa/voice-config`
  (`server/src/routes/v10/teresa.routes.ts`, mounted at `Gateway.ts:991`,
  `verifyToken`) is **env-driven** (`TERESA_VOICE_*` + `resolveGeminiLiveServerKey`).
  Unauthenticated it returns **401** (route exists; not a 404).

- **The handler always returns a `model` string** (default
  `gemini-2.5-flash-native-audio-preview-09-2025`). The panel showing
  `model: not configured` (i.e. `null`) means **the handler body never reached the
  hook** — the fetch got a non-2xx and `res.json().catch(() => ({}))` produced `{}`.

---

## 3. Root-cause analysis

### A. Contract mismatch frontend ↔ backend (CONFIRMED bug)
- Backend returns `unavailableReason`; the hook
  (`src/hooks/v10/useV10TeresaRuntime.ts`) reads `body.reason` →
  the reason is **never** populated, so the panel always shows `none`.
- Field map drift: hook reads `body.model || body.voiceModel`; backend only
  emits `model`. `voiceName`/`fallback`/`boundaries` are ignored by the panel.

### B. Auth mismatch on the V10 slice (MOST PROBABLE primary cause)
- The panel calls the **authenticated** `/api/v10/teresa/voice-config` using the
  v10 hook's own `getAuthHeaders()` / `hasAuthToken()`. The symptom set
  (`enabled=no`, `model=null`, `reason=none`, `unavailable`) is exactly what the
  hook produces when the response is **401 → empty `{}` body**.
- Working Teresa voice runs through the **public, no-auth** path, so it is immune
  to this. The V10 panel is the only place that depends on the v10 auth headers.
- **Must confirm in-app** (Phase 0) by capturing the authenticated network call.

### C. Two sources of truth for voice config (DESIGN smell)
- `public/anna` = **DB-backed** (virtual worker record: `voice_enabled`,
  `voice_name`, `surface`, `status`).
- `v10/teresa` = **env-backed** (`TERESA_VOICE_ENABLED/NAME/MODEL`).
- Even with A+B fixed, the two can legitimately disagree because they read
  different config. The cockpit should reflect the config that actually powers voice.

### D. Static "Runtime truth table" (TRUST smell)
- `src/components/AIChat/AIOSWave0GateReport.tsx` hardcodes all gates to `PASS`.
  Presented as a "runtime truth table" it implies live verification it does not do.

---

## 4. Remediation plan (phased)

### Phase 0 — Confirm the auth hypothesis (≈30 min, no code)
- Open AI OS as an authenticated DBR77 user; capture the
  `/api/v10/teresa/voice-config` request in the network panel.
- Record: HTTP status, request headers (is the bearer/cookie present?), response body.
- **Decision gate:** if 401/403 → primary fix is auth (Phase 2). If 200 with
  `enabled:false` → primary fix is config-source unification (Phase 3).

### Phase 1 — Fix the response contract (small, safe, do regardless)
- `src/hooks/v10/useV10TeresaRuntime.ts`: read `body.unavailableReason` (keep
  `reason`/`message` as fallbacks); surface `voiceName`; keep `model` mapping.
- Make the panel distinguish three states honestly:
  `loading` · `ready` · `unavailable(reason)` · **`error(status)`** — never
  collapse a 401/404/5xx into a bland "not configured".
- **Acceptance:** when the endpoint returns `unavailableReason`, the panel shows
  that exact reason; on HTTP error it shows "diagnostics unavailable (HTTP n)".

### Phase 2 — Fix V10 auth (if Phase 0 shows 401/403)
- Align the v10 hook's `getAuthHeaders()`/`hasAuthToken()` with the app's
  canonical auth (same token source the rest of `src/services/api.ts` uses).
- **Acceptance:** authenticated DBR77 user gets `200` and the panel reflects the
  real runtime (expected `enabled:true` locally, since the key is present).

### Phase 3 — Single source of truth for voice (architectural)
- Extract a shared `resolveVoiceRuntime(assistant)` service used by **both**
  `public/anna` and `v10/teresa`, returning `{ enabled, model, voiceName, reason }`
  from the DB-backed worker config (env only as fallback/override).
- Point the v10 endpoint at this service so the cockpit reflects the config that
  truly powers voice.
- **Acceptance:** toggling the worker record (or the documented env override)
  changes **both** endpoints identically; panel matches live behaviour.

### Phase 4 — Make the "truth table" honest
- Either (a) relabel `AIOSWave0GateReport` as **"Build milestones (static)"** with
  a clear "documentation, not a live check" note, or (b) wire each row to a real
  probe (endpoint smoke / health) and render live PASS/FAIL.
- Recommended now: **(a)** relabel (cheap, removes false assurance); schedule (b)
  as a follow-up if a real AI-runtime health board is wanted.

### Phase 5 — Verify & document
- Per project rule: open in preview, verify each state visually, screenshot.
- Update `docs/` and the `project_voice_railway_deploy` / `project_beta_gating`
  notes with the unified voice-config contract.

---

## 5. Effort & sequencing

| Phase | Effort | Risk | Depends on |
|------|--------|------|-----------|
| 0 Confirm auth | XS | none | — |
| 1 Contract fix | S | low | — |
| 2 Auth fix | S–M | low | 0 |
| 3 SSOT voice service | M | med (touches both endpoints) | 1,2 |
| 4 Truth-table honesty | XS–S | none | — |
| 5 Verify/docs | S | none | all |

**Recommended order:** 0 → 1 → 4 (quick wins, no risk) → 2 → 3 → 5.

---

## 6. Out of scope / open questions
- Whether the AI OS cockpit should become a real live health dashboard (Phase 4b)
  or stay a documentation surface.
- Whether Internal Tools stays `open` beta for DBR77 (current decision) or is
  ever exposed beyond DBR77 (would require revisiting `canUseInternalTools`).
