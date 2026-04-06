# IRIS Publication Checklist Pass 01-50

Status: publication checklist pass complete for `IRIS` English library `01-50`.  
Strategy source of truth: `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md`  
Publication system source of truth: `Blogs/_SYSTEM/standards/DBR77_PUBLICATION_OPERATING_CHECKLIST.md`  
Publication matrix source of truth: `Blogs/_OPERATIONS/core/DBR77_PUBLICATION_MATRIX.md`

## Purpose

This file checks whether the `IRIS` package layer is aligned with the DBR77 publication system after the article-level audits, bridge retrofit work, and LP attachment mapping were completed.

It focuses on package coherence, not body rewrites.

Use it to confirm:

- face routing matches `IRIS` trust zones
- persona and stage signals remain credible
- CTA logic stays inside realistic funnel behavior
- package files are production-ready enough for future LP and publishing work

## Checklist Scope

This pass reviewed package-level alignment across:

- `social.md`
- `cta.md`
- `publish.md`
- prior audit notes for `IRIS 01-20`, `21-30`, `31-40`, and `41-50`

## What Was Checked

1. primary product gate remains `IRIS`
2. social package face recommendations stay inside `IRIS` trust zones
3. persona and stage labels are internally coherent
4. CTA choices remain plausible for awareness, consideration, decision, or adoption contexts
5. `publish.md` and `cta.md` still align on soft versus end CTA logic
6. package structure remains complete enough for future production use

## Findings

### Strong Overall State

- `IRIS` package structure is complete across the library and already includes `publish.md`, `cta.md`, and `social.md`
- `publish.md` files are generally machine-readable and page-order aware
- CTA logic is consistently product-tied and mostly matches buyer maturity
- later `IRIS` tranches already use clearer package metadata than the oldest base articles

### Highest-Priority Mismatches Found

1. older `IRIS` social packages still contained `Marketplace` face leakage through `Paweł Mroczkowski`
2. two late-library `social.md` files used `Stage: Evaluation`, which is not a standard stage label in the current publication system
3. older `01-10` social packages remain somewhat mixed in face posture, with some category-first `Piotr` usage that is acceptable but less product-pure than the newer `Konrad` / `Paweł Dera` pattern

## Corrections Applied

### Face-routing cleanup

Corrected `Marketplace`-face leakage inside `IRIS` social files:

- `01_why_dashboards_dont_fix_factories`
- `03_why_mes_alone_is_no_longer_enough`
- `07_how_to_unify_mes_wms_qms_and_cmms_without_replacing_everything`
- `08_why_hidden_definitions_kill_kpi_alignment`
- `09_the_cost_of_siloed_operational_systems`
- `10_how_human_approval_makes_industrial_ai_more_useful`

Those optional adaptations now point to `Paweł Dera`, which fits operations-facing `IRIS` distribution far better than `Marketplace` publishing ownership.

### Primary-face correction

Corrected the strongest hard mismatches in:

- `04_from_insight_to_task_to_action_closing_the_execution_loop`
- `05_why_plants_still_run_on_spreadsheets`

These now use `Paweł Dera` as the primary publishing face and `Konrad Milewski` as the system-level secondary adaptation, which is materially closer to the `IRIS` publication matrix than the prior `Marketplace`-face setup.

### Stage normalization

Normalized non-standard stage labels in:

- `44_what_an_executive_ai_operations_scorecard_should_include_and_ignore`
- `48_when_vendor_ai_tools_should_feed_the_execution_layer_and_when_not_to`

`Stage: Evaluation` was replaced with `Stage: Decision` to match the dominant late-stage pattern already used across the `IRIS` package set.

## Repo Re-Check After Fixes

After the package corrections:

- repo search found no remaining `Paweł Mroczkowski` or `Pawel Mroczkowski` references inside `Blogs/IRIS/Blog`
- repo search found no remaining `Stage: Evaluation` labels inside `Blogs/IRIS/Blog`

## Residual Notes

These are not blockers:

- some early `IRIS 01-10` social packages still use a more umbrella-style `Piotr` posture for strategic category framing
- that is acceptable where the asset is deliberately market-education or category-definition led
- if a future pass wants stricter product-face purity, those early awareness assets can be rotated further toward `Konrad Milewski` or `Paweł Dera`

## Done Standard

Treat this pass as complete when:

- hard face mismatches are removed
- obvious non-standard stage labels are normalized
- package files remain aligned with `IRIS` product ownership
- no article-body rewrites are required to support publication-system coherence

## Next Move

With `IRIS` article audits, bridge retrofit, LP attachment mapping, and publication checklist pass now complete, the next logical `IRIS` backlog is:

- locales
- proof polish
- later publication execution work, not another package-coherence cleanup
