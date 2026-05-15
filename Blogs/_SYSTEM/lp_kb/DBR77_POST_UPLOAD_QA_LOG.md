# DBR77 Post-Upload QA Log

## Purpose

This file is the QA and signoff template for the six product LP knowledge-base uploads.

Use it after each batch and again after the full wave is complete.

## Product QA Table

| Product | Expected count | Imported count | Locale status | Section status | Spot-check status | Signoff |
|---|---:|---:|---|---|---|---|
| `Consultify` | 50 |  |  |  |  |  |
| `IoT` | 50 |  |  |  |  |  |
| `IRIS` | 50 |  |  |  |  |  |
| `DT` | 50 |  |  |  |  |  |
| `Marketplace` | 50 |  |  |  |  |  |
| `Vector` | 50 |  |  |  |  |  |

## Spot-Check Matrix

For each product, verify one early, one middle, and one late article.

| Product | Early article | Middle article | Late article | Result |
|---|---|---|---|---|
| `Consultify` | `01_why_traditional_consulting_is_broken` | `24_what_a_transformation_pmo_should_track_every_week` | `50_how_to_turn_transformation_management_into_a_repeatable_operating_system` |  |
| `IoT` | `01_why_factories_still_dont_use_machine_data` | `25_when_edge_processing_is_worth_it_in_brownfield_iot` | `50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory` |  |
| `IRIS` | `01_why_dashboards_dont_fix_factories` | `25_how_to_build_ai_assisted_factory_operations_step_by_step` | `50_what_full_operational_closure_should_look_like_in_an_ai_native_factory` |  |
| `DT` | `01_digital_twin_not_3d_model_decision_engine` | `25_when_manual_factory_decisions_become_too_expensive_to_trust` | `50_how_to_turn_digital_twin_into_a_repeatable_capex_decision_system` |  |
| `Marketplace` | `01_why_most_automation_projects_never_start` | `25_what_fat_and_sat_should_actually_prove_before_go_live` | `50_how_to_turn_automation_buying_into_a_repeatable_decision_system` |  |
| `Vector` | `01_why_public_ai_is_a_security_risk_for_industrial_operations` | `25_how_to_compare_industrial_ai_training_policies_without_marketing_fog` | `50_how_to_build_a_manufacturing_ai_governance_system_that_survives_scale` |  |

## QA Questions Per Spot Check

- does the title match the article?
- is the body the actual article body?
- are `EN`, `PL`, and `DE` correctly attached?
- does the article sit in the intended LP section?
- does the slug match the expected article folder slug?

## Hard Failure Log

Record any blockers here:

- archive package imported
- `00_*` file imported
- locale mismatch
- section mismatch
- slug mismatch
- metadata rendered as content

## Final QA Signoff Rule

Treat the upload wave as QA-complete only when:

- all six products show correct counts
- all spot-checks pass
- no hard failure remains unresolved
