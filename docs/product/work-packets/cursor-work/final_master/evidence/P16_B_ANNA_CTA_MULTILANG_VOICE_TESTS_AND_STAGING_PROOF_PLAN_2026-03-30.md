# P16-B Evidence — Anna LP: CTA + multilang + voice degraded + factfulness posture
Date: 2026-03-30  
Packet: **P16-B**  
State: **implemented (code + automated tests)**; staging proof script ready

## Context pack (max 5, SSOT order)
1. Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
2. Contract (P16): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_16_ANNA_2026-03-29.md` (see §8.1 P16-B)
3. Public Anna API: `server/src/routes/public-anna.routes.ts`
4. Funnel telemetry (CTA grammar): `server/src/services/annaAnalyticsService.ts`
5. Existing guardrail tests: `server/src/routes/v8/__tests__/public-anna.routes.test.ts`

---

## Automated tests (run locally)

### Existing baseline (must stay green)

```bash
npx vitest run \
  server/src/routes/v8/__tests__/public-anna.routes.test.ts
```

### P16-B additions (implemented)

Run set:

```bash
npx vitest run \
  server/src/routes/v8/__tests__/public-contact.routes.test.ts \
  server/src/routes/v8/__tests__/public-anna.citations-contract.test.ts \
  tests/components/Landing/AnnaLpCtaCompletion.start.test.tsx \
  tests/components/Landing/AnnaAssistantWidget.guardrails.p16b.test.tsx
```

Expected (P16-B):
- Public Q&A can emit **CTA funnel events** using the canonical grammar:
  - event name: `anna_lp.cta.<verb>` where `<verb>` ∈ `impression | click | start | submit_attempt | submit_success | submit_error | retry | fallback_used`
  - required metadata: `cta_type`, `language`, `channel`, `session_id`, `turn_id`, `source_intent`
- **Multilang stability**: PL↔EN (and supported languages) do not cause identity drift; locale controls output language consistently.
- **Voice degraded posture**: when voice is unavailable/rate-limited, the system falls back to text and preserves context continuity.
- **Factfulness posture**: when Anna makes “factful” claims, the response includes **citations/evidence pointers** OR an explicit **uncertainty marker** (no overclaim).

Notes:
- The widget guardrail test asserts language switching does **not** wipe the message transcript.
- The voice degraded test asserts voice-unavailable triggers a bounded fallback event and continues in text mode.

---

## Staging proof script (runtime checklist)

Environment prerequisites:
- Public Anna surface reachable (LP widget / public route).
- Ability to view conversion events (bounded: via existing telemetry surface or DB query in staging tooling).

### A) CTA + funnel instrumentation (bounded)

1. Open Anna public surface in **PL**.
2. Ask: “Co to jest Consultify?”
3. Confirm a CTA is offered (demo/trial/contact) and that at least:
   - `anna_lp.cta.impression` is recorded (when CTA appears), and
   - `anna_lp.cta.click` is recorded (when CTA is clicked).
4. Complete CTA flow (bounded: click to open handoff or submit minimal form) and confirm:
   - `submit_attempt` + (`submit_success` OR `submit_error`) are recorded with required metadata.

### B) Multilang switch (PL ↔ EN)

1. Switch to **EN**.
2. Ask: “Is Consultify a fit for a transformation program?”
3. Confirm response is EN, with no identity drift (still Anna; no Teresa mixing).
4. Confirm CTA events record `language='en'`.

### C) Voice degraded → text fallback (explicit)

1. Trigger voice on (if present).
2. Simulate voice failure (rate-limit/unavailable) and confirm:
   - UI/API returns an explicit degraded message,
   - fallback to text continues the same session (context continuity),
   - `anna_lp.cta.fallback_used` (or equivalent) is recorded when fallback happens.

### D) Factfulness posture (citations OR uncertainty marker)

1. Ask a factful question (“Czy Consultify ma integracje z X?” / “Jakie macie certyfikacje?”).
2. Confirm the answer includes either:
   - explicit citations/evidence pointers, or
   - explicit uncertainty marker + safe next step (no fabrication).

Capture:
- short screen recording for A+B+C+D, plus an event log snippet proving metadata presence.

---

## Rollback posture (P16-B scope)
- Disable CTA/voice features via feature flags (if present) and preserve safe public Q&A fallback.
- No destructive data operations; conversion events remain auditable.

---

## Known limits (explicit, for honesty)
- This packet is bounded to CTA instrumentation + multilang + voice degraded and response-shaping posture. Full sales agent behavior remains out-of-scope (P16 non-goal).

