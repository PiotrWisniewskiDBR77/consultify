# Wave 1 Final Implementation Plan - Radar

Date: 2026-03-29
Module: `Radar`
Scope: final implementation plan for the active Wave 1 decision-support home surface

## 1. Scope

This plan covers only `Radar` as the executive and operator guidance surface in `MyWork`.

It does not widen scope into:

- full BI platform parity
- broad PMO execution ownership that belongs to `Wdrożenia`
- note-taking or assistant behavior owned by `Notatki` and `Teresa`

## 2. Canonical Source Stack

- `docs/product/MYWORK_RADAR_V8_SSOT.md`
- `docs/product/MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `docs/product/MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
- `docs/product/MYWORK_RADAR_SOURCE_TRUST_AND_GOVERNANCE_V8.md`
- `docs/product/MYWORK_HOME_V1_SSOT.md`
- `docs/product/work-packets/evidence/541-v81-radar-must-have-module-closeout-pass.md`
- `docs/product/work-packets/evidence/543-v81-wave1-acceptance-smoke-spine.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/module-packets/WAVE1_REVIEW_PACKET_RADAR_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- `Softs/0 Projekty`
- `Softs/0 KPI`

Benchmark interpretation:

- a decision cockpit should rank what matters
- recommendations should be explainable
- signals should bridge into action, not only observation
- the surface should feel directive, not decorative

## 4. Intended Final Product Behavior

`Radar` should behave like the first operating screen a user can trust:

- it identifies what needs attention now
- it explains why the item matters
- it proposes the next best action
- it hands the user into the right downstream surface
- it remains honest about uncertainty, evidence quality, and missing data

## 5. Current Repo Truth

What is already true:

- Wave 1 closure-grade home surface exists
- signal, trust, and degraded-state honesty are materially better
- the module no longer feels like an obviously fake dashboard lane

What is still incomplete:

- recommendation grammar is not strong enough to feel like a decisional cockpit
- prioritization quality is uneven
- downstream action continuity is still partial
- explainability of recommendations is not yet deep enough

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | informative and useful | directive and action-shaping | informative vs decisional behavior |
| `Flow completeness` | guidance exists | guidance must hand off into concrete next steps | signal-to-action continuity |
| `UX quality` | credible shell | clearer ranking, calmer priorities, stronger action framing | prioritization grammar |
| `Data / logic quality` | medium-strong | recommendation logic must be legible and defensible | explainability |
| `Integration quality` | medium | stronger bridges into initiatives, execution, and notes | downstream handoff depth |
| `Trust / governance / error handling` | strong bounded honesty | keep honesty while deepening recommendations | overclaim risk |
| `Market standard fit` | medium | closer to executive cockpit expectations | decision-support gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Radar decision-support readback packet` | make the surface more directive | priority grammar, recommendation framing, attention hierarchy | clearer ranked signals, explicit why-now language, action-oriented summaries | broad BI system rebuild | a user can identify what matters most now and why without reading the entire page |
| `Radar recommendation explainability packet` | make recommendations trustworthy | recommendation rationale, evidence copy, uncertainty boundaries | explainable recommendation cards and bounded caveat language | full ML recommender program | the user can see why a recommendation was produced and what evidence supports it |
| `Radar downstream continuity packet` | connect signals to real work | links and handoffs into `Inicjatywy`, `Wdrożenia`, and `Notatki` | stronger next-action transitions and saved context continuity | redesign of every downstream module | the user can move from signal to action without losing context or guessing the next surface |

## 8. Dependencies And Risks

Dependencies:

- `Inicjatywy`
- `Wdrożenia`
- `Notatki`
- underlying signal quality from the broader home/runtime pipeline

Risks:

- overpromising intelligence without stronger evidence language
- ranking items without a stable prioritization grammar
- deepening the surface visually without improving action continuity

## 9. Final Acceptance Bar

`Radar` is finally implemented for its declared Wave 1 role only when:

- the surface tells the user what matters now, why, and what to do next
- recommendations are explainable enough to be trusted
- the user can jump into downstream modules with preserved context
- the module still stays honest about evidence quality and uncertainty

## 10. Non-Goals And Unsafe Claims

Non-goals:

- replacing a full BI suite
- claiming fully autonomous prioritization
- absorbing `Wdrożenia`, `Inicjatywy`, or `Notatki`

Unsafe claims until separately proven:

- `Radar already matches the best executive operating systems`
- `Radar recommendations are fully autonomous and always correct`
- `Radar closes the full cross-module action loop by itself`
