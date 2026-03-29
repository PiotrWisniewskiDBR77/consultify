# Wave 1 Final Implementation Plan - Ankiety

Date: 2026-03-29
Module: `Ankiety`
Scope: final implementation plan for the active Wave 1 survey and structured collection lane

## 1. Scope

This plan covers only `Ankiety` as the active collection surface.

It does not widen scope into:

- full assessment orchestration platform
- full reporting and analytics suite
- interview insight productization owned by `Wnioski w Interview`

## 2. Canonical Source Stack

- survey and assessment docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/flows/core/ASSESSMENT_EXECUTION_FLOW.md`
- `docs/product/work-packets/evidence/539-v81-surveys-must-have-module-closeout-pass.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/module-packets/WAVE1_REVIEW_PACKET_ANKIETY_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md`
- `docs/product/work-packets/AGENT_3_SURVEYS_INTERVIEW_INSIGHTS_EXECUTION_MEMO_2026-03-28.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- `Softs/0 Ankiety`

Benchmark interpretation:

- collection should feel operator-safe
- submission lifecycle should be governed
- response state should support downstream review and synthesis
- the product should not pretend that collection alone equals insight

## 4. Intended Final Product Behavior

`Ankiety` should behave like a credible structured collection lane:

- operators can create and run a declared survey flow
- respondents submit through an honest lifecycle
- the operator understands submission state and next action
- collected responses remain ready for downstream review or insight work

## 5. Current Repo Truth

What is already true:

- Wave 1 closure for the bounded collection shell is real
- submit and locked/read-only truth are materially stronger
- the module no longer overstates its bounded shell state

What is still incomplete:

- operator workflow remains shallow
- submission governance and follow-through are not deep enough
- reporting and synthesis readiness remain limited
- the bridge from collection into insight is still weak

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | real collection lane exists | collection must support real operator follow-through | operator workflow depth |
| `Flow completeness` | ask and submit work | review and follow-up lifecycle must be stronger | governance continuity |
| `UX quality` | bounded shell is honest | clearer status and post-submit next steps | operator clarity |
| `Data / logic quality` | collection path is credible | response handling must better support later synthesis | downstream readiness |
| `Integration quality` | medium | stronger bridge into insight and decision surfaces | collection-to-insight bridge |
| `Trust / governance / error handling` | stronger than before | operators must trust state transitions and submission outcomes | submission governance |
| `Market standard fit` | medium | closer to serious collection products | workflow depth gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Survey operator workflow packet` | deepen operator control | survey state, operator actions, review workflow, status grammar | clearer operator lifecycle and post-collection control | full analytics suite | the operator can run and review the declared survey lane without guessing status |
| `Survey submission governance packet` | make submission handling more trustworthy | submission lifecycle, locked state, outcome language, recovery cues | stronger submission-state governance and explicit next-step language | separate assessment platform redesign | the system communicates what was submitted, what remains pending, and what the operator should do next |
| `Survey to insight bridge packet` | prepare collection output for downstream use | response handoff, evidence framing, next-action routes into insight work | cleaner bridge into `Wnioski w Interview` or analyst review | claiming that collection alone generates full insight | a completed collection run can move into the next declared review surface without ambiguity |

## 8. Dependencies And Risks

Dependencies:

- `Wnioski w Interview`
- broader assessment flow definitions
- downstream review and analyst workflows

Risks:

- overstating rules-based summaries as deep insight
- deepening survey UI without fixing operator follow-through
- widening scope into a hidden assessment-platform program

## 9. Final Acceptance Bar

`Ankiety` is finally implemented for its declared Wave 1 role only when:

- the operator can run the declared survey flow and understand response state
- submission outcomes are explicit and recoverable
- downstream review and insight handoff are visible
- the module remains honest about what collection does and does not prove

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full assessment orchestration
- full reporting suite
- treating raw collection as final insight

Unsafe claims until separately proven:

- `Ankiety now delivers full Typeform-class product depth`
- `survey outputs are already full research insights`
- `the entire assessment package is complete`
