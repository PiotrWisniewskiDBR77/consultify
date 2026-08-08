# DoD-11 — Agent UI accessibility contract evidence

Date: 2026-08-08
Verdict: `LOCAL DOM_KEYBOARD_PL_EN_ASSISTIVE_REFLOW_GREEN / BROWSER_MATRIX_PENDING`

## Implemented contract

- Agent Hub exposes the primary content and bulk-operation areas as named landmarks.
- Transformation Cases exposes a named busy region, alert semantics for failures and a live canonical-runtime status.
- Agent Operations supports keyboard form submission, localized PL/EN accessible names, busy/disabled states, live results and unambiguous recovery controls.
- Agent Process Templates exposes localized headings and controls, busy/live state, correct button types and linked `aria-expanded` / `aria-controls` governance history.
- Agent Operations and governed Templates expose persistent load/recovery errors and distinct unauthorized states. Operations preserves the canonical Run across retry, clears stale diagnostics on failure, disables concurrent recovery and offers local context clearing on 403; Templates blocks protected actions on 403. Their forms/control groups use responsive layout and semantic surface/text tokens.
- Final publication exposes an atomic polite state summary, links disabled generation to the exact blocking reason, reports busy state, retains keyboard focus across prepare/review, and announces the locked-to-unlocked transition.
- Common proposal scope controls reflow from one mobile column to a three-control desktop group; before/after payloads and long digests break safely, and the states use semantic light/dark surface and text tokens.

## Automated evidence

- Keyboard diagnostic submission: passed.
- Polish semantics, live status and alert behavior: passed.
- Governance-history disclosure relationship: passed.
- English accessible labels: passed.
- Transformation Cases accessibility assertions: passed.
- Final-publication PL/EN, unauthorized/expired, exact disabled-reason, live-state, focus and responsive-class contracts: passed.
- Focused Agent Hub navigation, Agent accessibility, canonical Operations, governed Templates and Transformation Cases regression: `30/30` passed (`16/16` is superseded as the earlier narrower aggregate).
- Full repository TypeScript check: passed.

## Acceptance boundary

This is local DOM, keyboard and responsive-class contract evidence. It does not prove rendered responsive desktop/mobile reflow, overflow and touch targets; visual light/dark contrast; focus order, visibility and return in a real browser; or practical VoiceOver/NVDA announcements without duplication. Same-SHA deployed role/browser evidence is also pending. Therefore DoD-11 is `PARTIAL`, not `ACCEPTED`.
