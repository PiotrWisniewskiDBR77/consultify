# DBR77 LP Batch Execution Pack

## Purpose

This file is the operator-facing execution pack for the six product upload batches.

Use it together with:

- `Blogs/_OPERATIONS/core/DBR77_LP_UPLOAD_RUNBOOK.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_UPLOAD_BATCH_SHEET.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_UPLOAD_MANIFESTS.md`
- `Blogs/_OPERATIONS/core/DBR77_LP_PRE_GO_DECISIONS.md`

## Batch Order

1. `Consultify`
2. `IoT`
3. `IRIS`
4. `DT`
5. `Marketplace`
6. `Vector`

## Batch Pass Template

For every product, complete this sequence:

1. confirm source root
2. confirm canonical count `50`
3. confirm only `article_EN.md`, `article_PL.md`, `article_DE.md`
4. confirm exclusions
5. upload batch
6. run spot-check on early, middle, late article
7. confirm section model
8. confirm locale variants
9. log pass or stop

## Product Passes

### Batch 1: Consultify

- source root: `Blogs/Consultify/Blog/`
- expected count: `50`
- section model:
  - `Governance And ROI`
  - `Execution And Rollout`
  - `AI And Decision Making`
- spot-checks:
  - `01_why_traditional_consulting_is_broken`
  - `24_what_a_transformation_pmo_should_track_every_week`
  - `50_how_to_turn_transformation_management_into_a_repeatable_operating_system`

### Batch 2: IoT

- source root: `Blogs/IoT/Blog/`
- expected count: `50`
- section model:
  - `Downtime And OEE`
  - `Execution And Rollout`
  - `AI And Decision Making`
- spot-checks:
  - `01_why_factories_still_dont_use_machine_data`
  - `25_when_edge_processing_is_worth_it_in_brownfield_iot`
  - `50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory`

### Batch 3: IRIS

- source root: `Blogs/IRIS/Blog/`
- expected count: `50`
- section model:
  - `AI And Decision Making`
  - `Execution And Rollout`
  - `Governance And ROI`
- reference map: `Blogs/IRIS/Blog/00_LP_ATTACHMENT_CHECK_01_50.md`
- spot-checks:
  - `01_why_dashboards_dont_fix_factories`
  - `25_how_to_build_ai_assisted_factory_operations_step_by_step`
  - `50_what_full_operational_closure_should_look_like_in_an_ai_native_factory`

### Batch 4: DT

- source root: `Blogs/DT/Blog/`
- expected count: `50`
- section model:
  - `Layout And Flow`
  - `CAPEX And Investment`
  - `Governance And ROI`
- spot-checks:
  - `01_digital_twin_not_3d_model_decision_engine`
  - `25_when_manual_factory_decisions_become_too_expensive_to_trust`
  - `50_how_to_turn_digital_twin_into_a_repeatable_capex_decision_system`

### Batch 5: Marketplace

- source root: `Blogs/Marketplace/Blog/`
- expected count: `50`
- required exclusion: `_archive_marketplace_43_49_pre_collision_packages/`
- section model:
  - `Automation And Sourcing`
  - `CAPEX And Investment`
  - `Execution And Rollout`
- spot-checks:
  - `01_why_most_automation_projects_never_start`
  - `25_what_fat_and_sat_should_actually_prove_before_go_live`
  - `50_how_to_turn_automation_buying_into_a_repeatable_decision_system`

### Batch 6: Vector

- source root: `Blogs/Vector/Blog/`
- expected count: `50`
- section model:
  - `AI And Decision Making`
  - `Governance And ROI`
  - `Execution And Rollout`
- spot-checks:
  - `01_why_public_ai_is_a_security_risk_for_industrial_operations`
  - `25_how_to_compare_industrial_ai_training_policies_without_marketing_fog`
  - `50_how_to_build_a_manufacturing_ai_governance_system_that_survives_scale`

## Stop Rule

Stop the wave immediately if any batch shows:

- content from `00_*`
- content from `_archive_*`
- metadata instead of article body
- locale records splitting incorrectly
- LP section assignment drifting from the declared product model
