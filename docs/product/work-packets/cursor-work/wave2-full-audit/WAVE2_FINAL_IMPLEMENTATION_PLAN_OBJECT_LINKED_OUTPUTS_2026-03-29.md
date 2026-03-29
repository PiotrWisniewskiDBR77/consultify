# Wave 2 Final Implementation Plan - Object-linked outputs

Date: 2026-03-29
Module: `Object-linked outputs`
Scope: final implementation plan for propagating canonical artifact truth back into source-object surfaces

## 1. Scope

This plan covers only `Object-linked outputs` as the source-object view of the shared artifact family.

It does not widen scope into:

- replacing `Outputs Library` as the canonical home
- solving every module in the product at once
- broad builder work

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OBJECT_LINKED_OUTPUTS.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- work systems where source objects and generated artifacts share one lifecycle truth

Benchmark interpretation:

- source surfaces should expose the same artifact identity
- deep links should open the same canonical artifact
- object-local convenience must not become a second truth system

## 4. Intended Final Product Behavior

`Object-linked outputs` should make artifacts visible from the work objects that produced or use them:

- object panels show linked outputs
- status and type stay understandable
- opens resolve to the canonical artifact
- source objects extend the artifact family rather than duplicating it

## 5. Current Repo Truth

What is already true:

- linking substrate exists
- some important surfaces already expose artifact relationships

What is still incomplete:

- coverage is still uneven across source-object families
- deep-link and reopen behavior are not yet consistent everywhere
- the family still risks feeling notebook-heavy instead of system-wide

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | some linked views exist | consistent linked-output visibility | coverage |
| `Flow completeness` | partial object-to-artifact flow | source panel to canonical artifact continuity | deep-link consistency |
| `UX quality` | some panels are useful | one clear linked-output grammar | panel consistency |
| `Data / logic quality` | link substrate exists | no contradictory object-local truth | truth reuse |
| `Integration quality` | partial | major source-object families should participate | propagation depth |
| `Trust / governance / error handling` | moderate | source panels must preserve artifact status and ownership truth | trust carryover |
| `Market standard fit` | medium-low | true lifecycle linkage | system-wide parity |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Object-linked coverage packet` | close the biggest source-surface gaps | residual object families, panel coverage, linked-status basics | visible artifact linkage on major source surfaces | every object in the repo | users can see linked outputs on the declared major source surfaces |
| `Object-linked deep-link packet` | preserve canonical artifact truth | open/reopen behavior, routing, identity continuity | one open path from object panel to artifact | library replacement | source panels open the same artifact truth without ambiguity |
| `Object-linked status packet` | strengthen trust signals | type labels, status, ownership cues, traceability basics | more believable object-surface readback | full review system on every panel | object panels do not hide what the artifact actually is or what state it is in |

## 8. Dependencies And Risks

Dependencies:

- `Outputs Library`
- `Provenance / review / visibility`
- `Notebook outputs`
- source-object modules such as notes, interview, initiatives, and tools

Risks:

- treating one strong source surface as proof that the whole pattern is complete
- creating source-local artifact truth that diverges from the library
- widening scope into every object surface in one pass

## 9. Final Acceptance Bar

`Object-linked outputs` is finally implemented for its declared Wave 2 role only when:

- major declared source surfaces visibly expose linked artifacts
- links resolve to the same canonical artifact truth
- object panels carry enough status and trust information to be believable
- the pattern extends the family without creating a second artifact home

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full coverage of every object family in one delivery step
- replacing the library as the main artifact home
- broad builder or workflow rewrites

Unsafe claims until separately proven:

- `all object surfaces now expose complete artifact truth`
- `linked outputs are universally complete across the product`
- `object-linked coverage removes the need for a canonical library`
