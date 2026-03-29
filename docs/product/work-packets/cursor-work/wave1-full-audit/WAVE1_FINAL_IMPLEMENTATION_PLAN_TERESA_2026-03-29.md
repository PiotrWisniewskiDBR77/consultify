# Wave 1 Final Implementation Plan - Teresa

Date: 2026-03-29
Module: `Teresa`
Scope: final implementation plan for the active Wave 1 internal contextual AI interlocutor

## 1. Scope

This plan covers only `Teresa` as the internal contextual copilot surface.

It does not widen scope into:

- public assistant behavior owned by `Anna`
- a fully autonomous workflow engine
- broad communication-platform scope

## 2. Canonical Source Stack

- `docs/product/work-packets/evidence/535-v81-teresa-runtime-honesty-packet-1.md`
- `docs/product/work-packets/evidence/536-v81-teresa-must-have-module-closeout-pass.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/module-packets/WAVE1_REVIEW_PACKET_TERESA_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md`
- `docs/product/work-packets/AGENT_2_CALENDAR_INTEGRATION_TERESA_EXECUTION_MEMO_2026-03-28.md`
- `docs/product/work-packets/cursor-work/wave1a-remediation/WAVE1B_WAVE1C_CUT_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- `Softs/0 Czat`
- `Softs/0 Agenci`
- `Softs/KIMI`

Benchmark interpretation:

- contextual copilots should preserve work context across surfaces
- voice and history should not feel like disconnected shells
- the product should offer meaningful handoff without overclaiming autonomy

## 4. Intended Final Product Behavior

`Teresa` should behave like an internal contextual copilot:

- understands the current work surface
- preserves history in a way that supports continuity
- hands users into the correct next work lane
- uses voice only when runtime truth supports it
- remains proposal-oriented and bounded, not falsely autonomous

## 5. Current Repo Truth

What is already true:

- closure-grade internal assistant shell exists
- runtime honesty is materially stronger
- identity split between `Anna` and `Teresa` is explicitly governed

What is still incomplete:

- workspace handoffs are still shallow
- history and voice continuity remain partial
- broader action continuity across modules is incomplete
- the module still feels more trustworthy than deep

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | bounded contextual help works | stronger cross-surface assistance | handoff depth |
| `Flow completeness` | chat lane is real | chat-to-work continuity must be stronger | action continuity |
| `UX quality` | credible shell | voice and history should feel continuous | continuity feel |
| `Data / logic quality` | bounded runtime truth | stronger context transfer between surfaces | context persistence |
| `Integration quality` | medium | assistant must bridge more cleanly into work modules | module adapters |
| `Trust / governance / error handling` | strong bounded honesty | preserve proposal-only clarity while broadening utility | autonomy-overclaim risk |
| `Market standard fit` | medium | closer to strong contextual copilot behavior | copilot-depth gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Teresa workspace handoff packet` | make the assistant more useful across modules | context carryover, module-aware actions, handoff language | clearer transitions from chat into the active work surface | full autonomous agent execution | a user can move from Teresa into the intended module without losing what the conversation established |
| `Teresa voice and history continuity packet` | improve continuity confidence | voice-state framing, history persistence cues, recovery language | stronger continuity across sessions and voice states on the declared lane | call-center or omnichannel productization | history and voice state remain understandable across supported transitions |
| `Teresa action continuity packet` | deepen the bounded copilot feel | follow-up actions, explicit proposal-to-application flow, cross-surface reuse | better assistant continuity without changing the proposal-only governance model | hidden auto-apply workflows | the assistant can propose the next work action and carry bounded context into the target surface |

## 8. Dependencies And Risks

Dependencies:

- `Anna` identity separation
- `Integracja`
- `Kalendarz`
- `Notatki`
- the business spine modules for high-value handoffs

Risks:

- overclaiming autonomous behavior
- deepening voice without stronger continuity semantics
- adding cross-surface actions without preserving context and governance

## 9. Final Acceptance Bar

`Teresa` is finally implemented for its declared Wave 1 role only when:

- the user can move from chat to the intended work surface with preserved context
- history and voice continuity are understandable on the supported lane
- the assistant remains proposal-oriented and transparent about what it can or cannot do
- identity separation from `Anna` remains explicit

## 10. Non-Goals And Unsafe Claims

Non-goals:

- a fully autonomous internal agent
- all-surface action parity in one pass
- public assistant behaviors

Unsafe claims until separately proven:

- `Teresa is now a full autonomous workflow engine`
- `voice and history are fully unified across every product surface`
- `Teresa now has complete cross-module action parity`
