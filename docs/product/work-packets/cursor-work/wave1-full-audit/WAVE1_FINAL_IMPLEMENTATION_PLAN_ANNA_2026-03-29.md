# Wave 1 Final Implementation Plan - Anna

Date: 2026-03-29
Module: `Anna`
Scope: final implementation plan for the active Wave 1 public AI interlocutor

## 1. Scope

This plan covers only `Anna` as the external/public AI entry surface.

It does not widen scope into:

- broad landing redesign
- internal assistant behavior owned by `Teresa`
- a general communication product

## 2. Canonical Source Stack

- `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- `docs/product/work-packets/evidence/542-v81-anna-must-have-module-closeout-pass.md`
- `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/module-packets/WAVE1_REVIEW_PACKET_ANNA_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md`
- `docs/product/work-packets/AGENT_1_ANNA_RADAR_NOTES_EXECUTION_MEMO_2026-03-28.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- `Softs/0 Czat`
- `Softs/KIMI`

Benchmark interpretation:

- strong public AI entry
- safe answer boundaries
- clear handoff to next commercial action
- resilient voice and multilingual framing
- visible conversion and funnel instrumentation

`Softs` is used here only for behavioral expectation, not for UI copying or parity claims.

## 4. Intended Final Product Behavior

`Anna` should behave like a high-confidence public product guide:

- answers public product questions clearly
- stays inside public knowledge and safety boundaries
- preserves identity separation from `Teresa`
- uses voice only when runtime conditions are trustworthy
- supports multilingual public discovery on the declared lanes
- hands the user into `demo`, `trial`, or `contact` without ambiguity
- records enough instrumentation to measure whether the surface actually converts

## 5. Current Repo Truth

What is already true:

- closure-grade public shell exists
- CTA authority is explicit and tested
- degraded runtime behavior is safe
- stale session and voice leakage were already bounded
- Wave 1 closure for the bounded lane is real

What is not yet true:

- voice is not yet resilient enough to be treated as commercially strong
- multilingual breadth is still limited
- conversion analytics and public-path instrumentation are not deep enough
- public scenario coverage is narrower than stronger commercial AI front doors

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | strong for bounded discovery | strong across more public scenarios | narrative coverage depth |
| `Flow completeness` | good CTA handoff | richer pre-handoff guidance and clearer qualification | shallow onboarding intelligence |
| `UX quality` | strong baseline shell | calmer voice and multilingual confidence | voice and language breadth |
| `Data / logic quality` | strong public-response constraints | stronger instrumentation and journey insight | analytics depth |
| `Integration quality` | medium-strong | clearer handoff measurement into next systems | handoff telemetry |
| `Trust / governance / error handling` | strong | preserve safety while broadening surface | runtime-dependent voice confidence |
| `Market standard fit` | medium-strong | stronger front-door product feel | commercial polish gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Anna multilingual trust packet` | widen public accessibility without identity drift | copy, language coverage, public-surface routing, translation completeness | supported multilingual public path, explicit fallback when a locale is partial, aligned CTA language | internal assistant behavior, broader site redesign | user can complete the declared public question-to-CTA journey in supported languages without mixed identity or broken copy |
| `Anna voice resilience and fallback depth packet` | make voice commercially safer | browser/runtime detection, fallback copy, voice-state transitions | clearer voice availability states, explicit fallback path, stronger runtime honesty | full call-center or telephony productization | voice either works reliably on the declared lane or fails safely without confusing the user |
| `Anna conversion analytics and handoff instrumentation packet` | prove that the public assistant helps conversion | event capture, CTA instrumentation, public journey checkpoints | visible funnel instrumentation, handoff event map, reporting-ready event language | company-wide analytics platform rewrite | product can measure key public assistant transitions from first prompt to CTA completion |

## 8. Dependencies And Risks

Dependencies:

- public runtime availability
- browser audio environment when voice is active
- identity and boundary alignment with `Teresa`
- canonical CTA routing across landing surfaces

Risks:

- overloading `Anna` with internal-copilot expectations
- treating voice presence as proof of voice quality
- shipping analytics events without a stable event grammar

## 9. Final Acceptance Bar

`Anna` is finally implemented for its declared Wave 1 role only when:

- a user can ask public questions and receive safe, useful answers across the declared scenarios
- supported languages are explicit and do not degrade into broken mixed-language guidance
- voice either behaves reliably on the supported lane or fails into a clear fallback state
- CTA handoff remains canonical and measurable
- the product team can inspect whether the assistant is helping discovery and conversion

## 10. Non-Goals And Unsafe Claims

Non-goals:

- replacing `Teresa`
- becoming a fully autonomous public sales agent
- delivering every possible multilingual market variant in one pass

Unsafe claims until separately proven:

- `Anna now matches the strongest public AI leaders in full parity`
- `Anna is a complete voice product`
- `Anna covers all public acquisition workflows`
