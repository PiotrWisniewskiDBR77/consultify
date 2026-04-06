# DBR77 Image Gap Coverage Plan

## Purpose

This file turns the audit into an execution plan.

It answers:

- what must be fixed first
- what can be normalized later
- how to move through nearly `1000` image outputs without losing context

## Planning Baseline

Current prompt inventory:

- total prompt files in scope: `327`
- active non-archive prompt files: `320`
- theoretical full image target at `3` roles each: `960`
- full target including archives: `981`

This means the right planning unit is not “one article at a time.”

The right planning unit is:

- one product at a time
- one structural problem at a time
- one batch at a time

## Priority Tiers

### `P0` Completed Recovery Wave

This recovery wave has already been executed.

Recovered target:

- `IoT`

Closed issues:

- `36` numbered files converted to named roles
- full `50/50` triptych coverage
- explicit aspect ratio, constraints, and negative prompts added

Outcome:

- `IoT` no longer blocks generation batches
- `IoT` now acts as an active standardized product line

### `P1` Completed Standardization

The remaining normalization targets have now been closed:

- `DBR77`
- archived `Marketplace` prompt files

Current implication:

- the backlog is no longer structural
- the next stage is generation, review, and tuning

### `P2` Automation Normalization

These libraries are good enough to use as references, but should still be aligned to the final contract.

Targets:

- `Marketplace`
- `DBR77`

Typical work:

- add explicit AR fields
- align field names to the template
- separate inline prohibition language into dedicated `constraints` and `negative prompts`

## Product Order

To minimize context switching and preserve reasoning consistency, use this order:

1. start controlled generation batches
2. review first outputs and version only where image quality or crop safety fails

Reason:

- `IoT` has already been normalized and removed as the critical blocker
- the six active product lines are normalized
- `DBR77` is normalized
- archived `Marketplace` files are normalized
- context should now be preserved by queue-based generation, not by additional prompt repair waves

## Work Passes Per Product

Every product should be processed in three passes only.

### Pass 1: Structural Normalization

Questions:

- are all three roles present
- is the format parseable
- does each role state objective, thesis, constraints, and aspect ratio

Output:

- standardized prompt files

### Pass 2: Quality Upgrade

Questions:

- does the image express the thesis clearly
- is the scene specific enough
- is the image operationally credible
- are stock and sci-fi risks blocked

Output:

- stronger generation-ready prompts

### Pass 3: Channel Readiness

Questions:

- can `Social` work for LinkedIn and newsletter
- does `Hero` support web trust
- does `Analytical` support article comprehension
- are filenames, output expectations, and metadata clear

Output:

- prompt files ready for generation and reuse

## Recommended Batch Size

To avoid context loss, use fixed-size execution batches.

### Prompt Rewrite Batch

- `10` article folders at a time

Why:

- enough repetition for consistency
- still small enough to keep product logic in working memory

### Image Generation Batch

- `30` images at a time
- equivalent to `10` full article triptychs

Why:

- easy to review
- aligns with the prompt rewrite batch
- avoids mixed standards inside one delivery block

### Review Batch

- one product mini-wave at a time
- never mix `IoT` and `Vector` or `Marketplace` and `Consultify` in one review pass

## Backlog By Product

### `IoT`

Primary backlog:

- no structural blocker remains
- optional future work is only prompt tuning after first generated-image review

Execution note:

- treat `Blogs/IoT/Blog/01_why_factories_still_dont_use_machine_data/image-prompts.md` and `Blogs/IoT/Blog/30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard/image-prompts.md` as normalized references inside the product

### `IRIS`

Primary backlog:

- no backlog remains beyond generation-tuning after the first image review

### `DT`

Primary backlog:

- no backlog remains beyond generation-tuning after the first image review
- keep `DT` as a reference line for analytical image quality

### `Marketplace`

Primary backlog:

- use the full `57` files as a reference line for structured procurement visuals
- preserve current triptych and negative-prompt quality

Execution note:

- do not include `_archive_marketplace_43_49_pre_collision_packages` in active generation batches

### `Vector`

Primary backlog:

- no backlog remains beyond generation-tuning after the first image review
- preserve strong governance and risk-control language

### `Consultify`

Primary backlog:

- no backlog remains beyond generation-tuning after the first image review
- preserve strong executive-review and portfolio-control logic

### `DBR77`

Primary backlog:

- no structural backlog remains
- keep the stronger ecosystem-level narrative logic intact during generation review

## Execution Waves

### Wave 1: Structural Recovery

Targets:

- already completed across the six active product lines

Goal:

- eliminate active product-line blockers to automation and distribution

### Wave 2: Standard Contract Rollout

Targets:

- completed across the full prompt library
- any future product-specific prompt tuning after first generation review

Goal:

- one prompt contract across the full system, not only the six active product lines

### Wave 3: Antygravity Readiness

Targets:

- output naming
- metadata readiness
- queue readiness
- generation order by priority

Goal:

- allow clean batch generation without manual folder hunting

### Wave 4: Optimization

Targets:

- upgrade strongest prompts into model-specific high-performance variants
- refine product-specific motif consistency
- tune social variants after first generation review

Goal:

- quality lift after the core system is already stable

## Definition Of Done

A product is done only when:

1. all active prompt files use named roles or an equally parseable standard
2. all active article prompts include `Hero`, `Analytical`, and `Social`
3. all prompts state the thesis, constraints, negatives, and aspect ratio clearly
4. active files can be moved into generation batches without manual reinterpretation
5. archive files are clearly excluded from active generation

## Operational Rule

Do not chase image generation volume before prompt normalization is stable.

For DBR77, output only helps when the full image library looks like the natural extension of real industrial expertise.
