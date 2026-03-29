# Wave 1 Final Implementation Plan - Integracja

Date: 2026-03-29
Module: `Integracja`
Scope: final implementation plan for the active Wave 1 connection and governed sync surface

## 1. Scope

This plan covers only `Integracja` as the user-facing connection and sync control layer.

It does not widen scope into:

- full integration-platform parity
- every provider family in the market
- unrelated admin and communication products

## 2. Canonical Source Stack

- `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- sync and interoperability docs indexed in `docs/product/DOCUMENTATION_REGISTRY.md`
- `docs/product/work-packets/evidence/533-v81-integration-must-have-module-closeout-pass.md`
- `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/module-packets/WAVE1_REVIEW_PACKET_INTEGRACJA_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1a-remediation/WAVE1A_EXECUTION_BRIEF_INTEGRACJA_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- `Softs/0 synchronizacja`

Benchmark interpretation:

- connection onboarding should feel deliberate
- post-connect state should remain visible and manageable
- operator workflows should expose health, recovery, and next action
- the product should behave like a control plane, not a disconnected settings page

## 4. Intended Final Product Behavior

`Integracja` should behave like a trustworthy control plane for external systems:

- provider onboarding is explicit
- completion and recovery paths are clear
- connected state stays visible after setup
- operators can understand what is healthy, blocked, stale, or recoverable
- lightweight and governed surfaces do not disagree

## 5. Current Repo Truth

What is already true:

- closure-grade honesty on provider state exists
- the lighter entry surface and governed hub are more aligned
- Wave 1A strengthened lifecycle shell and refresh-runtime materialization

What is still incomplete:

- provider onboarding is still not deep enough
- monitoring and operator visibility are still light
- jobs and health productization remain thin
- post-connect lifecycle parity is still weaker than benchmark expectations

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | trustworthy entry | trustworthy full provider lifecycle | lifecycle depth |
| `Flow completeness` | connect and inspect basics | connect-complete-recover-operate sequence | post-connect continuity |
| `UX quality` | improved state honesty | stronger operator overview and guidance | operator visibility |
| `Data / logic quality` | strong bounded truth | richer jobs, health, and provider-status logic | monitoring depth |
| `Integration quality` | medium | control plane must represent real provider lifecycle | provider parity |
| `Trust / governance / error handling` | strong | preserve honesty under deeper workflows | recovery depth |
| `Market standard fit` | medium-low | closer to control-plane benchmark behavior | breadth gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Integracja provider onboarding parity packet` | make setup feel complete and trustworthy | provider initiation, completion steps, setup-state language | clearer onboarding lifecycle and completion truth on declared providers | every provider family in the market | the user can connect a declared provider and understand what completion still remains |
| `Integracja operator visibility packet` | strengthen run-state visibility | health, jobs, inventory, operator overview, next-step guidance | stronger monitoring vocabulary and operational visibility in the declared hub | full enterprise observability platform | the operator can tell what is healthy, failing, stale, or blocked and what to do next |
| `Integracja post-connect lifecycle packet` | preserve trust after setup | reauth, recovery, drift handling, post-connect maintenance | more believable operate-and-recover lifecycle on active providers | large background-sync rewrite beyond the bounded lane | connected providers remain understandable after the first successful setup |

## 8. Dependencies And Risks

Dependencies:

- broader sync platform maturity
- `Kalendarz` for external calendar expectations
- `Teresa` for cross-surface handoff expectations

Risks:

- stopping at surface honesty and mistaking it for platform depth
- widening scope into a hidden architecture program
- adding provider-specific paths without one stable lifecycle grammar

## 9. Final Acceptance Bar

`Integracja` is finally implemented for its declared Wave 1 role only when:

- declared providers support a believable connect-complete-recover-operate path
- operator visibility is strong enough to explain the current state
- the lighter settings entry and governed hub do not contradict each other
- the user can recover or escalate from degraded state without guessing

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full Zapier or Make parity
- every provider family
- a generic enterprise integration platform

Unsafe claims until separately proven:

- `Integracja now matches commercial control-plane leaders`
- `all provider lifecycle problems are solved`
- `monitoring and jobs are complete across the sync platform`
