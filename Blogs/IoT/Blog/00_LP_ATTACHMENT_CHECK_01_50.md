# IoT LP Attachment Check 01-50

Status: complete LP attachment map for `IoT` English library `01-50`.  
Strategy source of truth: `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md`  
LP model source of truth: `Blogs/_SYSTEM/lp_kb/DBR77_LP_KNOWLEDGE_ARCHITECTURE_MODEL.md`  
Publication system source of truth: `Blogs/_SYSTEM/standards/DBR77_PUBLICATION_OPERATING_CHECKLIST.md`

## Purpose

This document turns the completed `IoT` English article library into an LP-ready knowledge map.

Use it to:

- assign each `IoT` article one primary LP section
- assign one optional secondary bridge where useful
- choose the first featured clusters for the public LP
- keep shared section labels consistent with the DBR77 LP model

## IoT LP Section Model

Per `Blogs/_SYSTEM/lp_kb/DBR77_LP_KNOWLEDGE_ARCHITECTURE_MODEL.md`, `IoT` should use these primary public sections:

1. `Downtime And OEE`
2. `Execution And Rollout`
3. `AI And Decision Making`

Support themes for internal curation:

- machine visibility
- signal quality
- rollout governance

## Recommended Public Knowledge Sections

### Downtime And OEE

Featured cluster:

- `01_why_factories_still_dont_use_machine_data`
- `07_how_to_reduce_downtime_by_30_using_real_time_data`
- `09_oee_is_not_enough`
- `10_why_your_maintenance_strategy_is_failing`
- `11_real_time_production_visibility_in_practice`
- `12_5_operational_problems_every_factory_has`

Deeper library candidates:

- `08_the_hidden_costs_of_not_measuring_production_properly`
- `19_why_iiot_alerts_fail_on_the_shop_floor_and_what_works_instead`
- `24_how_to_improve_machine_data_quality_before_scaling_iot`
- `28_how_to_reduce_false_alarms_in_iiot_systems`
- `35_what_a_good_machine_state_model_looks_like_before_scaling_iot`
- `36_how_to_turn_iot_signals_into_maintenance_priorities_without_noise`
- `39_how_to_use_iot_for_faster_problem_confirmation_on_the_shop_floor`
- `40_when_real_time_visibility_should_change_the_production_plan`
- `47_when_real_time_visibility_should_trigger_structured_problem_solving`

### Execution And Rollout

Featured cluster:

- `06_how_to_start_iiot_without_breaking_production`
- `13_7_mistakes_companies_make_when_implementing_iot`
- `14_from_pilot_to_scale_how_to_roll_out_iiot_without_losing_control`
- `15_how_to_build_a_business_case_for_iiot_in_a_brownfield_factory`
- `16_what_to_measure_in_the_first_90_days_of_iiot_rollout`
- `21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory`

Deeper library candidates:

- `17_how_to_choose_the_right_first_iiot_use_case`
- `18_who_should_own_iiot_rollout_inside_the_factory`
- `20_how_to_review_iiot_value_after_the_first_pilot`
- `26_how_to_roll_out_iot_across_multiple_lines_without_losing_control`
- `30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard`
- `31_what_to_review_after_the_first_6_months_of_iot_rollout`
- `32_how_to_prove_iot_value_across_sites_without_forcing_one_template`
- `37_how_to_keep_an_iot_program_alive_when_the_first_champion_leaves`
- `42_what_iot_governance_should_look_like_after_the_first_year`
- `48_how_to_create_a_site_ready_iot_rollout_playbook_for_new_lines`
- `50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory`

### AI And Decision Making

Featured cluster:

- `02_what_data_should_you_collect_from_machines`
- `03_from_sensors_to_decisions`
- `04_machine_data_is_useless_without_context`
- `05_edge_vs_cloud_in_manufacturing`
- `22_when_to_integrate_iiot_with_mes_erp_and_cmms_and_when_to_wait`
- `23_what_machine_data_should_trigger_action_and_what_should_not`

Deeper library candidates:

- `25_when_edge_processing_is_worth_it_in_brownfield_iot`
- `29_when_to_expand_from_visibility_to_closed_loop_response`
- `33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting`
- `34_when_iot_should_trigger_supervisor_escalation_and_when_it_should_not`
- `41_how_to_review_operator_overrides_in_iot_workflows`
- `43_how_to_keep_iot_signal_definitions_consistent_across_shifts`
- `44_when_iot_alerts_should_create_work_orders_and_when_they_should_not`
- `45_what_an_executive_iot_scorecard_should_include_after_scale_up`
- `46_how_to_decide_which_iot_signals_deserve_edge_logic`
- `49_what_data_retention_and_traceability_should_look_like_in_iiot`

## Article Attachment Map

| Article | Primary LP section | Optional secondary bridge | Why this fit is strongest |
|---|---|---|---|
| `01_why_factories_still_dont_use_machine_data` | `Downtime And OEE` | `AI And Decision Making` | machine visibility |
| `02_what_data_should_you_collect_from_machines` | `AI And Decision Making` | `Downtime And OEE` | signal choice |
| `03_from_sensors_to_decisions` | `AI And Decision Making` | `Execution And Rollout` | data-to-action |
| `04_machine_data_is_useless_without_context` | `AI And Decision Making` | `Downtime And OEE` | context gap |
| `05_edge_vs_cloud_in_manufacturing` | `AI And Decision Making` | `Execution And Rollout` | architecture choice |
| `06_how_to_start_iiot_without_breaking_production` | `Execution And Rollout` | `Downtime And OEE` | safe start |
| `07_how_to_reduce_downtime_by_30_using_real_time_data` | `Downtime And OEE` | `Execution And Rollout` | downtime response |
| `08_the_hidden_costs_of_not_measuring_production_properly` | `Downtime And OEE` | `AI And Decision Making` | measurement cost |
| `09_oee_is_not_enough` | `Downtime And OEE` | `AI And Decision Making` | KPI limit |
| `10_why_your_maintenance_strategy_is_failing` | `Downtime And OEE` | `Execution And Rollout` | maintenance losses |
| `11_real_time_production_visibility_in_practice` | `Downtime And OEE` | `Execution And Rollout` | live visibility |
| `12_5_operational_problems_every_factory_has` | `Downtime And OEE` | `Execution And Rollout` | repeated losses |
| `13_7_mistakes_companies_make_when_implementing_iot` | `Execution And Rollout` | `AI And Decision Making` | rollout mistakes |
| `14_from_pilot_to_scale_how_to_roll_out_iiot_without_losing_control` | `Execution And Rollout` | `AI And Decision Making` | scale discipline |
| `15_how_to_build_a_business_case_for_iiot_in_a_brownfield_factory` | `Execution And Rollout` | `Downtime And OEE` | business case |
| `16_what_to_measure_in_the_first_90_days_of_iiot_rollout` | `Execution And Rollout` | `Downtime And OEE` | first metrics |
| `17_how_to_choose_the_right_first_iiot_use_case` | `Execution And Rollout` | `Downtime And OEE` | first use case |
| `18_who_should_own_iiot_rollout_inside_the_factory` | `Execution And Rollout` | `AI And Decision Making` | ownership model |
| `19_why_iiot_alerts_fail_on_the_shop_floor_and_what_works_instead` | `Downtime And OEE` | `Execution And Rollout` | alert failure |
| `20_how_to_review_iiot_value_after_the_first_pilot` | `Execution And Rollout` | `Downtime And OEE` | post-pilot review |
| `21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory` | `Execution And Rollout` | `Downtime And OEE` | first 30 days |
| `22_when_to_integrate_iiot_with_mes_erp_and_cmms_and_when_to_wait` | `AI And Decision Making` | `Execution And Rollout` | integration timing |
| `23_what_machine_data_should_trigger_action_and_what_should_not` | `AI And Decision Making` | `Downtime And OEE` | trigger logic |
| `24_how_to_improve_machine_data_quality_before_scaling_iot` | `Downtime And OEE` | `AI And Decision Making` | data quality |
| `25_when_edge_processing_is_worth_it_in_brownfield_iot` | `AI And Decision Making` | `Execution And Rollout` | edge tradeoff |
| `26_how_to_roll_out_iot_across_multiple_lines_without_losing_control` | `Execution And Rollout` | `AI And Decision Making` | multi-line rollout |
| `27_what_to_do_when_operators_do_not_trust_iot_signals_yet` | `Execution And Rollout` | `AI And Decision Making` | trust adoption |
| `28_how_to_reduce_false_alarms_in_iiot_systems` | `Downtime And OEE` | `AI And Decision Making` | false alarms |
| `29_when_to_expand_from_visibility_to_closed_loop_response` | `AI And Decision Making` | `Execution And Rollout` | closed loop |
| `30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard` | `Execution And Rollout` | `AI And Decision Making` | plant standard |
| `31_what_to_review_after_the_first_6_months_of_iot_rollout` | `Execution And Rollout` | `Downtime And OEE` | six-month review |
| `32_how_to_prove_iot_value_across_sites_without_forcing_one_template` | `Execution And Rollout` | `Downtime And OEE` | multi-site proof |
| `33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting` | `AI And Decision Making` | `Execution And Rollout` | handover logic |
| `34_when_iot_should_trigger_supervisor_escalation_and_when_it_should_not` | `AI And Decision Making` | `Execution And Rollout` | escalation rule |
| `35_what_a_good_machine_state_model_looks_like_before_scaling_iot` | `Downtime And OEE` | `AI And Decision Making` | state model |
| `36_how_to_turn_iot_signals_into_maintenance_priorities_without_noise` | `Downtime And OEE` | `AI And Decision Making` | maintenance prioritization |
| `37_how_to_keep_an_iot_program_alive_when_the_first_champion_leaves` | `Execution And Rollout` | `Downtime And OEE` | program continuity |
| `38_what_to_standardize_across_sites_in_iot_and_what_to_leave_local` | `Execution And Rollout` | `AI And Decision Making` | standards balance |
| `39_how_to_use_iot_for_faster_problem_confirmation_on_the_shop_floor` | `Downtime And OEE` | `Execution And Rollout` | fast confirmation |
| `40_when_real_time_visibility_should_change_the_production_plan` | `Downtime And OEE` | `AI And Decision Making` | planning shift |
| `41_how_to_review_operator_overrides_in_iot_workflows` | `AI And Decision Making` | `Execution And Rollout` | override governance |
| `42_what_iot_governance_should_look_like_after_the_first_year` | `Execution And Rollout` | `AI And Decision Making` | year-one governance |
| `43_how_to_keep_iot_signal_definitions_consistent_across_shifts` | `AI And Decision Making` | `Execution And Rollout` | signal consistency |
| `44_when_iot_alerts_should_create_work_orders_and_when_they_should_not` | `AI And Decision Making` | `Execution And Rollout` | WO routing |
| `45_what_an_executive_iot_scorecard_should_include_after_scale_up` | `AI And Decision Making` | `Execution And Rollout` | executive scorecard |
| `46_how_to_decide_which_iot_signals_deserve_edge_logic` | `AI And Decision Making` | `Execution And Rollout` | edge decision |
| `47_when_real_time_visibility_should_trigger_structured_problem_solving` | `Downtime And OEE` | `Execution And Rollout` | problem solving |
| `48_how_to_create_a_site_ready_iot_rollout_playbook_for_new_lines` | `Execution And Rollout` | `AI And Decision Making` | rollout playbook |
| `49_what_data_retention_and_traceability_should_look_like_in_iiot` | `AI And Decision Making` | `Execution And Rollout` | retention traceability |
| `50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory` | `Execution And Rollout` | `AI And Decision Making` | repeatable OS |

## Proof Block Recommendations For IoT LP

Use at least two proof-bearing blocks on the `IoT` LP:

1. `Reality-check pattern`
   - source cluster: `01`, `02`, `03`, `04`
   - purpose: prove why plants over-collect, under-contextualize, and stop at visibility

2. `Decision mistakes buyers usually make`
   - source cluster: `09`, `10`, `23`, `29`
   - purpose: help buyers see why OEE, alerts, and visibility do not create control by themselves

3. `Implementation warning block`
   - source cluster: `06`, `13`, `14`, `21`, `30`, `42`
   - purpose: show how pilots fail when ownership, cadence, or rollout logic stay weak

## CTA Ladder For IoT LP

Recommended maturity ladder:

- low commitment: see where visibility is failing, review signal-quality mistakes, benchmark downtime losses
- medium commitment: plan a pilot, review first 30 days, assess one line in scope
- high commitment: review line fit, validate rollout path, schedule pilot discussion

## Done Standard

Treat this LP attachment check as complete when:

- every `IoT` article has one primary LP section
- each article has at most one optional secondary bridge
- the LP can surface `3-6` featured articles per public section without dumping all `50`
- proof blocks are assigned by cluster instead of date order
