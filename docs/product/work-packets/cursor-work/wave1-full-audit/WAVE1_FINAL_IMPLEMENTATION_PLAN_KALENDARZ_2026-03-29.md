# Wave 1 Final Implementation Plan - Kalendarz

Date: 2026-03-29
Module: `Kalendarz`
Scope: final implementation plan for the active Wave 1 calendar and connected planning surface

## 1. Scope

This plan covers only `Kalendarz` as the active planning calendar lane.

It does not widen scope into:

- full Google or Outlook suite parity
- a separate meeting-product platform
- generic task management outside the declared calendar contract

## 2. Canonical Source Stack

- `docs/product/MYWORK_CALENDAR_V1_SSOT.md`
- `docs/product/MYWORK_CALENDAR_V8_SSOT.md`
- `docs/product/MYWORK_CALENDAR_V8_AS_IS.md`
- `docs/product/MYWORK_CALENDAR_V8_GAP_MATRIX.md`
- `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`
- `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`
- `docs/product/work-packets/evidence/534-v81-calendar-must-have-module-closeout-pass.md`
- `docs/product/work-packets/evidence/549-v8-v81-package-exception-retirement.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/module-packets/WAVE1_REVIEW_PACKET_KALENDARZ_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1a-remediation/WAVE1A_EXECUTION_BRIEF_KALENDARZ_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- `Softs/0 Kalendarz`

Benchmark interpretation:

- connected calendar truth must be reliable
- external source state must be explicit
- workload and adjustment guidance must help planning
- authoring and recovery must feel PMO-grade, not only visually present

## 4. Intended Final Product Behavior

`Kalendarz` should behave like a trustworthy planning surface:

- internal and external source state is honest
- the user understands whether a source is connected, degraded, or recoverable
- workload pressure is visible for the selected planning horizon
- the user can move from calendar insight into the next action without guessing

## 5. Current Repo Truth

What is already true:

- closure-grade calendar lane exists
- Wave 1A improved external-source honesty and selected-day workload guidance
- the shell no longer overstates connected planning truth

What is still incomplete:

- external sync maturity is still below PMO-grade expectations
- workload and adjustment depth remain partial
- richer event authoring and connected action continuity remain later
- parity with strong external calendar products is not yet credible

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | usable and honest | planning guidance must help real prioritization and adjustment | workload depth |
| `Flow completeness` | core view works | stronger connect-plan-adjust sequence | action continuity |
| `UX quality` | improved state messaging | deeper planning confidence and calmer authoring | PMO-grade planning feel |
| `Data / logic quality` | bounded workload signal exists | richer conflict, load, and adjustment logic | workload model breadth |
| `Integration quality` | medium | external source lifecycle must be more trustworthy | sync maturity |
| `Trust / governance / error handling` | stronger than before | recoverability and authoring truth must stay explicit | sync recovery depth |
| `Market standard fit` | medium-low | closer to assistant-grade connected planning | parity gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Calendar external parity packet` | strengthen external-source trust | source state, recovery, external-connected truth, lifecycle copy | stronger source-state grammar and more believable external planning lane | full external suite parity or every provider family | the user can tell what is connected, degraded, blocked, or recoverable without ambiguity |
| `Calendar workload and adjustment packet` | deepen planning usefulness | day-load, conflicts, adjustment guidance, planning context | richer workload summary and next-step guidance for overloaded or conflicted time blocks | full AI scheduler autonomy | the user can inspect workload pressure and understand what kind of adjustment is needed |
| `Calendar connected-action packet` | improve continuity after planning insight | event authoring handoff, next actions, bridge into related work surfaces | clearer follow-up actions from planning insights into neighboring modules | complete task platform redesign | the user can move from planning signal to the next declared action with preserved context |

## 8. Dependencies And Risks

Dependencies:

- `Integracja`
- external calendar provider maturity
- `Teresa` for assistant-grade planning continuity

Risks:

- overstating connected planning while sync maturity is still partial
- deepening workload summaries without clearer action guidance
- confusing visual density with planning intelligence

## 9. Final Acceptance Bar

`Kalendarz` is finally implemented for its declared Wave 1 role only when:

- external source state is honest and actionable
- workload pressure is visible enough to support planning decisions
- the user can recover from broken or partial external state
- the product supports a believable connect-plan-adjust journey on the declared lane

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full Google Calendar parity
- full Outlook parity
- full autonomous scheduling engine

Unsafe claims until separately proven:

- `Kalendarz is now leader-grade across all external providers`
- `the calendar is a full assistant scheduler`
- `connected planning is complete across every authoring workflow`
