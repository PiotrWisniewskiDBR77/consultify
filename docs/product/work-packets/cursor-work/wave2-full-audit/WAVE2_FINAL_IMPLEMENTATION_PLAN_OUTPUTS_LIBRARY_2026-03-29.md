# Wave 2 Final Implementation Plan - Outputs Library

Date: 2026-03-29
Module: `Outputs Library`
Scope: final implementation plan for the canonical Wave 2 artifact discovery, ownership, and reopen surface

## 1. Scope

This plan covers only `Outputs Library` as the one canonical home for durable artifacts.

It does not widen scope into:

- full office-style authoring
- every source-object panel in the product
- a second registry or second output shell

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OUTPUTS_LIBRARY.md`
- `docs/product/work-packets/wave-2/WAVE_2_MASTER_IMPLEMENTATION_ORDER.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- artifact hubs and document libraries that make discovery, ownership, review, and reopen behavior obvious

Benchmark interpretation:

- one home for durable outputs
- clear taxonomy and queue semantics
- explicit ownership and review status
- no ambiguity about where an artifact lives

## 4. Intended Final Product Behavior

`Outputs Library` should behave like the canonical artifact home for the whole family:

- all declared artifact classes are discoverable in one place
- filters, queues, and taxonomy explain why an artifact is here
- preview, open, reopen, and review semantics are consistent
- the library exposes the same artifact truth as the registry, not a second shell

## 5. Current Repo Truth

What is already true:

- artifact registry truth is real
- aggregate output surfaces exist
- the product already points toward one canonical home

What is still incomplete:

- taxonomy and queue semantics are still thin
- ownership and review language are not yet one explicit product contract
- the shell still risks feeling thinner than the artifact-family doctrine behind it

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | one aggregate surface exists | one obvious artifact home | shell depth |
| `Flow completeness` | browse and open basics exist | discover-review-reopen-export sequence | queue continuity |
| `UX quality` | aggregate listing works | clearer taxonomy, preview, and status grammar | library clarity |
| `Data / logic quality` | registry truth is strong | shell must expose the same truth cleanly | shell-registry alignment |
| `Integration quality` | family links exist | all declared artifact classes resolve here coherently | family convergence |
| `Trust / governance / error handling` | trust substrate is present | review and ownership must be visible | trust visibility |
| `Market standard fit` | medium | canonical artifact home | productization gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Outputs Library taxonomy closure packet` | make the library feel canonical | taxonomy, queues, filter grammar, section semantics | one stable library grammar across artifact classes | full authoring rewrite | the user can explain where an artifact belongs and why |
| `Outputs Library preview and ownership packet` | strengthen work-forward use | preview, owner, review state, open/reopen semantics | clearer artifact inspection and status language | every source-object panel | the user can inspect ownership, state, and next action without leaving the library blind |
| `Outputs Library family convergence packet` | remove shell ambiguity | cross-format inclusion, library entry consistency, reopen continuity | one believable home across the declared artifact family | all adjacent object surfaces at once | declared artifact classes land in one canonical library without contradictory paths |

## 8. Dependencies And Risks

Dependencies:

- `ArtifactRun z czatu`
- `Provenance / review / visibility`
- `Documents`, `Presentations`, and `Sheet`
- downstream `Object-linked outputs` and `Notebook outputs`

Risks:

- building a thin shell over strong internals and calling it complete
- creating library semantics that disagree with registry truth
- reopening builder scope before the home surface is stable

## 9. Final Acceptance Bar

`Outputs Library` is finally implemented for its declared Wave 2 role only when:

- it is the unambiguous canonical home for declared artifact classes
- preview, open, reopen, review, and owner semantics are explicit
- the library does not contradict registry truth or adjacent product surfaces
- the user can move from artifact discovery to the next action without guessing

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full writer or deck-builder parity
- second registry or second output home
- solving every source-object embedding in the same packet

Unsafe claims until separately proven:

- `Outputs Library now completes the whole artifact family by itself`
- `the office-style output system is fully complete`
- `every output-related surface in the product is already unified`
