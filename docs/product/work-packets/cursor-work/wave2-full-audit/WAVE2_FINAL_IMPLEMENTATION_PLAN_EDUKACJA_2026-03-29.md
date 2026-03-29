# Wave 2 Final Implementation Plan - Edukacja

Date: 2026-03-29
Module: `Edukacja`
Scope: final implementation plan for the standalone Wave 2 learning and enablement product

## 1. Scope

This plan covers only `Edukacja` as the standalone learning and enablement module.

It does not widen scope into:

- generic help and KB content ownership
- partner-only enablement
- claiming a finished education runtime where only strategic fragments exist

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_C_KNOWLEDGE_AND_SUPPORT_SYSTEMS.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_EDUKACJA.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- structured learning and enablement products with explicit paths, progress, and role-based journeys

Benchmark interpretation:

- learning should be structured, not only browsed
- progress and path ownership should be visible
- education should tie to real work and adoption

## 4. Intended Final Product Behavior

`Edukacja` should behave like a standalone learning product:

- explicit learning paths
- visible progress and next step
- clear relationship to Help, onboarding, and enablement
- role-appropriate adoption and capability growth

## 5. Current Repo Truth

What is already true:

- strategy and documentation acknowledge the need for standalone education
- some content fragments live inside help and tutorial surfaces

What is still incomplete:

- standalone product packaging is weak
- runtime ownership versus Help is still unclear
- there is no single clear learning-path model yet

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | education intent exists | standalone learning product | module identity |
| `Flow completeness` | content fragments exist | path-progress-next-step sequence | learning path model |
| `UX quality` | embedded content exists | one clear education shell or contract | product shell |
| `Data / logic quality` | light content structure exists | progress and role logic need definition | progress model |
| `Integration quality` | adjacent to help and onboarding | clean boundaries and handoffs | boundary clarity |
| `Trust / governance / error handling` | low | content ownership and scope must be explicit | ownership model |
| `Market standard fit` | low | structured enablement journeys | module maturity |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Edukacja scope statement packet` | define what the module is | module boundary, relationship to Help, first-class role | one explicit education contract | full runtime buildout | the team can explain what belongs to Edukacja and what does not |
| `Learning-path and progress packet` | give the module a real user journey | path structure, progression model, role framing | one credible learning path model | every content format | the user can understand how to progress through education rather than only browse content |
| `Help and academy boundary packet` | prevent scope collapse | handoffs with Help, onboarding, and partner enablement | explicit boundaries and adjacent ownership | all partner learning operations | education remains visible as a module instead of disappearing into Help |

## 8. Dependencies And Risks

Dependencies:

- `Help / Baza wiedzy`
- onboarding and public-entry expectations
- `Program partnerski` for adjacent enablement logic

Risks:

- collapsing education back into Help because Help is stronger today
- shipping only content without a learning journey
- claiming education maturity from strategy notes alone

## 9. Final Acceptance Bar

`Edukacja` is finally implemented for its declared Wave 2 role only when:

- the standalone module contract is explicit
- at least one structured learning-path model is defined
- boundaries with Help and adjacent enablement are clear
- the module can be planned and implemented without guessing whether it exists separately

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full LMS parity
- community or cohort platform parity
- treating tutorial content fragments as a finished education product

Unsafe claims until separately proven:

- `Edukacja is already a full product`
- `all enablement journeys are complete`
- `Help and Edukacja are fully unified with no further decisions needed`
