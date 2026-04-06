# DBR77 LP Upload Manifests

## Purpose

This file is the clean import manifest set for tomorrow's LP knowledge-base upload.

It defines, per product:

- source root
- expected canonical count
- allowed content files
- exclusions
- LP section model
- spot-check set

## Shared Import Rule

For every product, import only article folders and only these body files:

- `article_EN.md`
- `article_PL.md`
- `article_DE.md`

Always exclude:

- `00_*`
- `_archive_*`
- package metadata files such as `publish.md`, `cta.md`, `social.md`, `seo.md`, `sources.md`, `image-prompts.md`

## Consultify Manifest

- source root: `Blogs/Consultify/Blog/`
- canonical article count: `50`
- locale status: `50 EN`, `50 PL`, `50 DE`
- exclude: `00_AUDIT_AND_UPDATE_PLAN_*`, `00_ROADMAP.md`
- LP sections:
  - `Governance And ROI`
  - `Execution And Rollout`
  - `AI And Decision Making`
- spot-check set:
  - early: `01_why_traditional_consulting_is_broken`
  - middle: `24_what_a_transformation_pmo_should_track_every_week`
  - late: `50_how_to_turn_transformation_management_into_a_repeatable_operating_system`

## IoT Manifest

- source root: `Blogs/IoT/Blog/`
- canonical article count: `50`
- locale status: `50 EN`, `50 PL`, `50 DE`
- exclude: `00_AUDIT_AND_UPDATE_PLAN_*`, `00_ROADMAP.md`
- LP sections:
  - `Downtime And OEE`
  - `Execution And Rollout`
  - `AI And Decision Making`
- spot-check set:
  - early: `01_why_factories_still_dont_use_machine_data`
  - middle: `25_when_edge_processing_is_worth_it_in_brownfield_iot`
  - late: `50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory`

## IRIS Manifest

- source root: `Blogs/IRIS/Blog/`
- canonical article count: `50`
- locale status: `50 EN`, `50 PL`, `50 DE`
- exclude:
  - `00_AUDIT_AND_UPDATE_PLAN_*`
  - `00_ROADMAP.md`
  - `00_LP_ATTACHMENT_CHECK_01_50.md`
  - `00_PUBLICATION_CHECKLIST_PASS_01_50.md`
- LP sections:
  - `AI And Decision Making`
  - `Execution And Rollout`
  - `Governance And ROI`
- LP attachment reference: `Blogs/IRIS/Blog/00_LP_ATTACHMENT_CHECK_01_50.md`
- spot-check set:
  - early: `01_why_dashboards_dont_fix_factories`
  - middle: `25_how_to_build_ai_assisted_factory_operations_step_by_step`
  - late: `50_what_full_operational_closure_should_look_like_in_an_ai_native_factory`

## DT Manifest

- source root: `Blogs/DT/Blog/`
- canonical article count: `50`
- locale status: `50 EN`, `50 PL`, `50 DE`
- exclude: `00_AUDIT_AND_UPDATE_PLAN_*`, `00_ROADMAP.md`
- LP sections:
  - `Layout And Flow`
  - `CAPEX And Investment`
  - `Governance And ROI`
- spot-check set:
  - early: `01_digital_twin_not_3d_model_decision_engine`
  - middle: `25_when_manual_factory_decisions_become_too_expensive_to_trust`
  - late: `50_how_to_turn_digital_twin_into_a_repeatable_capex_decision_system`

## Marketplace Manifest

- source root: `Blogs/Marketplace/Blog/`
- canonical article count: `50`
- locale status: `50 EN`, `50 PL`, `50 DE` in the main library
- mandatory exclusion:
  - `_archive_marketplace_43_49_pre_collision_packages/`
- additional exclude:
  - `00_AUDIT_AND_UPDATE_PLAN_*`
  - `00_ROADMAP.md`
- LP sections:
  - `Automation And Sourcing`
  - `CAPEX And Investment`
  - `Execution And Rollout`
- spot-check set:
  - early: `01_why_most_automation_projects_never_start`
  - middle: `25_what_fat_and_sat_should_actually_prove_before_go_live`
  - late: `50_how_to_turn_automation_buying_into_a_repeatable_decision_system`

## Vector Manifest

- source root: `Blogs/Vector/Blog/`
- canonical article count: `50`
- locale status: `50 EN`, `50 PL`, `50 DE`
- exclude:
  - `00_AUDIT_AND_UPDATE_PLAN_*`
  - `00_ROADMAP.md`
  - `00_VECTOR_STRATEGY.md`
- LP sections:
  - `AI And Decision Making`
  - `Governance And ROI`
  - `Execution And Rollout`
- spot-check set:
  - early: `01_why_public_ai_is_a_security_risk_for_industrial_operations`
  - middle: `25_how_to_compare_industrial_ai_training_policies_without_marketing_fog`
  - late: `50_how_to_build_a_manufacturing_ai_governance_system_that_survives_scale`

## Manifest Acceptance Rule

Treat a manifest as valid only if:

- canonical count is `50`
- all three locale bodies exist
- all `00_*` files are excluded
- all `_archive_*` folders are excluded
- spot-check slugs are available before upload starts
