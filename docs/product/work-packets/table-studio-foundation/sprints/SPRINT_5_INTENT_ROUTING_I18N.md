# Sprint 5 — Intent Routing, i18n EN+PL, A11y, E2E Smoke

**Sprint ID:** `S5`
**Owner:** Orchestrator (sequential, single-agent — integration-heavy)
**Status:** `BLOCKED — pending Sprint 4 merged`
**Wave:** 3
**Epic:** EPIC-4 (US-4.3, US-4.5, US-4.6, US-4.7)
**Estimate:** ~2 days

## Sprint goal

Complete the integration polish: chat intent-routing patterns, EN+PL i18n, a11y on canvas + chips, and the e2e smoke spec. End-of-sprint output: 8 chat intent commands work; ~25 i18n keys present; a11y meets WCAG AA; e2e smoke green on staging.

## Committed user stories

- US-4.3 — Intent routing patterns (1.5 d)
- US-4.5 — i18n EN + PL ~25 keys (0.5 d)
- US-4.6 — A11y on canvas + chips (0.75 d)
- US-4.7 — E2E smoke spec (1 d)

Total: ~3.75 d single-agent → ~2 d with focused execution and parallel test writing.

## Pre-sprint risk check (against `02_RISK_REGISTER.md`)

- T8 (i18n missing keys) — addressed by `npm run i18n:check`.
- S6 (XSS via interpolation) — addressed by safe `t()` defaults + no `dangerouslySetInnerHTML`.

## Sprint Entry Gate

- [ ] Sprint 4 merged (TabeleView orchestrator working).
- [ ] EPIC-4 US-4.3, US-4.5, US-4.6, US-4.7 ACs reviewed.

## Work plan (2-day breakdown)

### Day 1
- US-4.3 — Intent routing patterns (mirror `PrezentacjeView.tsx` lines 247–304).
- US-4.5 — i18n keys EN + PL.

### Day 2
- US-4.6 — A11y audit + fixes.
- US-4.7 — E2E smoke spec (5 scenarios).
- Sprint demo: full happy path with intent commands fired in chat.

## Sprint Exit Gate

- [ ] All committed user stories DONE.
- [ ] L1.1 lint PASS.
- [ ] L1.2 typecheck PASS.
- [ ] `npm run i18n:check` PASS.
- [ ] L3.1 TabeleView test exercises 3 intent patterns PASS.
- [ ] L5.1, L5.2, L5.3 e2e smoke PASS.
- [ ] L6.3 Menu 3 placement audit PASS.
- [ ] A11y manual smoke (VoiceOver / NVDA) recorded.
- [ ] Sprint demo (4 min): full lane end-to-end with intent commands.

## Files this sprint will touch

### Created
- `consultify/tests/e2e/smoke/tabele-foundation.spec.ts`

### Updated
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (+intent routing useEffect + a11y attributes)
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/*.tsx` (+a11y aria attributes if missing)
- `consultify/public/locales/en/translation.json` (+~25 keys)
- `consultify/public/locales/pl/translation.json` (+~25 keys)

### Untouched (verified)
- All shared scaffolding from Sprints 1–4 stays.

## Subagent prompt (delegation contract)

This sprint stays with the orchestrator (no subagent delegation) because:
- Intent routing requires careful coordination with chat panel state already wired in Sprint 4.
- i18n key authoring must follow exact existing patterns to keep lints clean.
- A11y review is best done by the same agent that knows the entire canvas.

If a subagent is delegated, use this contract:

> **Role:** Integration specialist (intent routing + i18n + a11y).
> **Mission:** Execute Sprint 5 per this card. Mirror `PrezentacjeView.tsx` intent routing pattern exactly. No new control flow.
>
> **Inputs:**
> - `00_TASK_PACKET.md`
> - `01_VALIDATION_MATRIX.md` (L1.1–L1.2, L3.1, L5.1–L5.3, L6.3)
> - `02_RISK_REGISTER.md` (T8, S6)
> - `epics/EPIC-4_INTEGRATION_INTENT_ROUTING_I18N.md` (US-4.3, US-4.5, US-4.6, US-4.7)
> - Reference: `consultify/src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` lines 247–304 (intent routing template).
>
> **Outputs:**
> - Intent routing useEffect added.
> - All ~25 i18n keys present in EN + PL.
> - All a11y ACs met.
> - E2E smoke green.
> - Append "Realized risks" + "Daily evidence" to this card.

## Realized risks

> _to fill at sprint end_

## Daily evidence

> _to fill_
