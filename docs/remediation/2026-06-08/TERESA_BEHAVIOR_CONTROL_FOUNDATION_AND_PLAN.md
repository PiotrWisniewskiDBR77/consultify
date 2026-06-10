# Teresa Behavior Control — Foundation (shipped) + Plan (rest)

**Date:** 2026-06-09
**Decision:** "Safe foundation + plan for the rest" — make Teresa regulable in the
existing Virtual Workers admin panel (persona/tone/voice, DB-driven, like Anna),
while the frozen safety boundaries stay hard-coded.

---

## Background — where assistant behavior lives today (verified)

- **Anna (public):** fully DB-regulated. `virtual_workers` + `virtual_worker_profiles`
  rows, edited in the superadmin **Virtual Workers** module
  (`src/views/superadmin/VirtualWorkersModule/`, rendered by `SuperAdminView.tsx`).
  System prompt, persona, tone, policies, knowledge pills, voice — all editable; Anna's
  chat consumes the profile as a "WORKER PROFILE ADDON" via `buildAnnaRuntimeInstruction()`.
- **Teresa (in-app copilot):** behavior was NOT regulable. Voice = env (`TERESA_VOICE_*`);
  behavior = frozen `teresaCopilotCanon.ts`; her LLM call is intent-classification only
  (she proposes/hands off, doesn't free-generate prose). Her voice persona is built
  **client-side** in `buildTeresaVoiceSystemInstruction()`. A `teresa` worker row exists
  in DB but is **disabled**.

---

## FOUNDATION — shipped this turn (low risk)

1. **Migration** `server/migrations/20260609_activate_teresa_virtual_worker.sql`
   - Idempotent. Upserts the `teresa` worker to `status=active`, `surface=in_platform`,
     `voice_enabled=1`, and seeds ONE active profile (persona/tone + a behavior addon).
   - After this runs, Teresa appears in the Virtual Workers panel and is editable exactly
     like Anna (persona, tone, system_prompt addon, voice on/off, voice name).
   - **NOT yet applied** to shared staging — must go through the normal promotion runner
     (`npm run db:migrate:staging`, ideally `--dry-run` first), not a hand-run.

2. **Shared SSOT resolver** `server/src/services/ai/voiceRuntimeService.ts`
   - `resolveVoiceRuntime()` now returns `persona` / `tone` from the active worker profile.
   - **New rule:** only an **ACTIVE** worker governs the runtime; a draft/disabled/missing
     row falls back to env. This is what makes the foundation regression-proof — the
     currently-disabled `teresa` row falls back to env (voice stays ON) until the migration
     activates it.

3. **Teresa voice endpoint** `server/src/routes/v10/teresa.routes.ts`
   - Reverted to worker-governed (default), and now returns `persona` / `tone`.

4. **Client consumption** `src/contexts/TeresaVoiceContext.tsx`
   - Appends admin-configured `persona`/`tone` to the voice system instruction as an addon.
     Guarded: when empty, behavior is byte-identical to today. The hard safety contract in
     `buildTeresaVoiceSystemInstruction()` always precedes the addon.

### What the foundation gives you, once the migration is applied
- Teresa listed in the Virtual Workers panel; her **persona, tone, voice on/off, voice name**
  editable at runtime (no redeploy), exactly like Anna.
- Editing persona/tone changes Teresa's live voice posture; the frozen safety boundaries
  cannot be edited from the panel (they live in code).

### What stays HARD-CODED on purpose (the safety contract)
`teresaCopilotCanon.ts`: no silent writes, approval required before execution, tenant-data
only, no web access by default, anti-duplicate gate, degraded-mode handling. The panel never
exposes these.

---

## PLAN — the rest (not yet built)

| # | Item | Why | Effort | Risk |
|---|------|-----|--------|------|
| P1 | **Apply the migration** to staging (then prod) via the promotion runner; verify Teresa appears in the panel and voice still works | Activates the foundation | XS | low (idempotent) |
| P2 | **Panel access for the right roles** — confirm who can reach the Virtual Workers module. It currently sits under SuperAdmin; OWNER may not see it. Decide if org-OWNER (DBR77) should reach a scoped version | Owner asked "where do we regulate them" — they must be able to open it | S | low |
| P3 | **Teresa knowledge assignments** — wire Teresa to the knowledge-pill system (like Anna) so her in-workspace knowledge is curated, not implicit | Parity + governance | M | med |
| P4 | **Behavior addon for Teresa's proposals/intent**, not just voice — let the profile's persona/tone shape her text proposals too (currently only voice consumes it) | Full "behaves how we dictate" | M | med (touches copilot path) |
| P5 | **Unified Anna + Teresa control screen** — one page, side-by-side: prompts, policies, knowledge, voice, version history | Single place to govern both | M–L | low |
| P6 | **Versioning / audit / rollback UX** for prompt + policy changes; **policy editors** with schema validation (today policies are raw JSON textareas) | Safe edits, audit trail | M | low |
| P7 | **Voice model in DB** (currently `TERESA_VOICE_MODEL` env, shared) — move to worker config for full per-assistant control | Consistency | S | low |

### Recommended order
P1 (activate + verify) → P2 (access) → P5 (unified screen) → P4 (behavior addon for proposals) → P3 (knowledge) → P6/P7.

---

## Verification status (this turn)
- ✅ Backend unit test `teresa.voice-config` 5/5 pass.
- ✅ Anna voice endpoint live: `enabled:true` via the new shared resolver (no regression).
- ✅ Logic: disabled staging `teresa` row → env fallback → voice stays enabled (matches the
  pre-change authed `enabled:true`).
- ⛔ **Authed in-app panel re-check blocked** — the preview session expired (logged out)
  mid-work, so the authenticated `/ai` panel could not be re-opened. Re-verify after login.
