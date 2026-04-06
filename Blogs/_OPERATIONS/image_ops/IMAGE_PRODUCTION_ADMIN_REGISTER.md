# Image Production Admin Register

Last updated: 2026-03-31 — Agent3 twenty-two-role pack: wide roles verified 1376×768; social canonical 1024² exports v2–v9 where v1 was 768²; Agent2 Consultify+IRIS raster pass
Administrator: Cursor assistant

Important note:

- this register reflects the legacy operational acceptance pass used before the professional image reset
- `watchlist` and older `approved` counts should not be treated as proof that those assets meet the new stricter AI-look standard
- use this register mainly for backlog triage and historical recovery, not as the final benchmark for new production

## Purpose

This file is the working admin register for the full target image set defined by:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

It records:

- the target production scope
- what is already generated
- what is quality-approved
- what needs fixes
- what is still missing
- the current statistics of executed work

## Status Definitions

- `🟢 approved`: publishable now and clean enough to treat as done
- `🟠 watchlist`: publishable now, but not benchmark quality
- `🔴 fix_required`: clearly wrong, visibly broken, childish, or trust-damaging
- `🟡 missing`: target slug is not fully generated yet

For newly generated assets after the professional reset, apply the stricter logic from:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`

## Visual Legend

- `🟢` publish now
- `🟠` publish now, but watch
- `🔴` rerender needed
- `🟡` not generated yet

## Global Statistics

### Target Scope

- total target products: `7`
- total target slugs: `320`
- total target roles: `960`

### Delivery Progress

- generated roles: `408 / 960` (`42.5%`)
- missing roles: `552 / 960` (`57.5%`)
- fully generated slugs: `136 / 320` (`42.5%`)
- not fully generated slugs: `184 / 320` (`57.5%`)

### QC Progress

- `approved` slugs: `44 / 320` (`13.8%` of total target)
- `approved` slugs among generated: `44 / 136` (`32.4%`)
- `publishable now` slugs (`approved + watchlist`): `80 / 320` (`25.0%` of total target)
- `publishable now` among generated: `80 / 136` (`58.8%`)
- `watchlist` slugs: `36`
- `fix_required` slugs: `56`
- `missing` slugs: `184`

### Product Dashboard

| Product | Target slugs | Target roles | Existing roles | Generated slugs | Approved | Watchlist | Fix required | Missing |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Consultify | 50 | 150 | 150 | 50 | 42 | 7 | 1 | 0 |
| DT | 50 | 150 | 150 | 50 | 0 | 18 | 32 | 0 |
| DBR77 | 20 | 60 | 60 | 20 | 2 | 2 | 16 | 0 |
| Vector | 50 | 150 | 30 | 10 | 0 | 5 | 5 | 40 |
| IRIS | 50 | 150 | 18 | 6 | 0 | 4 | 2 | 44 |
| IoT | 50 | 150 | 0 | 0 | 0 | 0 | 0 | 50 |
| Marketplace | 50 | 150 | 0 | 0 | 0 | 0 | 0 | 50 |

## Main Operational Findings

- `Consultify` is mostly healthy under operational QC: `49 / 50` slugs are publishable now, and only slug `35` remains true red.
- `DT` is still the heaviest repair area, but the main burn is text-heavy analyticals and obvious hero copy failures, not mild hand softness.
- `DBR77` remains risky because of readable gibberish, fake UI, and wrong-subject analyticals, but `4` slugs moved off red under the softer bar.
- `Vector` and `IRIS` were previously undercounted in the register. The repo currently has `Vector 01-10` and `IRIS 01-06` generated.
- The real money-burn zone is now clear: rerender only `🔴` rows. `🟠 watchlist` rows are publishable and should not trigger automatic repair.

## Product QC Notes

### Consultify

- strongest area: the newer operational batch remains strong, especially `22-50` except `35`
- recurring issue: older heroes repeat boardroom and tabletop metaphors
- recurring issue: some analyticals feel slide-like or template-forward
- special note: under the relaxed bar, most older soft issues downgrade to `watchlist`, not `fix_required`

### DT

- strongest area: concept coverage and overall thesis fit are good across the line
- recurring issue: readable gibberish and misspelled labels, especially in analyticals
- recurring issue: heroes often carry pseudo-copy on screens or signage
- recurring issue: hologram drift is common, but is usually only `watchlist` now
- special note: do not spend money fixing soft hero polish until the text-heavy red assets are repaired first

### DBR77

- strongest area: system metaphors and high-level structure
- recurring issue: readable UI gibberish in analyticals and overlays
- recurring issue: occasional wrong-subject analytical choices
- recurring issue: hologram and sci-fi drift, but this alone is not a red flag anymore
- special note: only reject when the text or subject failure is obvious at normal review size

### Vector

- strongest area: brand/topic fit is directionally strong
- recurring issue: readable text artefacts in heroes and analyticals
- recurring issue: command-center and hologram drift
- recurring issue: some analyticals drift toward generic dashboards instead of a clean argument
- special note: `10` slugs already exist; only half of them are true red under the relaxed bar

## Register

### Consultify

```text
01_why_traditional_consulting_is_broken | 🟢 approved | - | workshop tabletop reads credible; mild genericity acceptable
02_10_questions_before_buying_ai_consulting_platform | 🟠 watchlist | social | near-readable UI and product-copy flavor in social
03_first_30_minutes_in_consultify | 🟠 watchlist | social | strong still-life; stopwatch numerals make it slightly text-adjacent
04_roi_calculator_guide | 🟢 approved | - | acceptable
05_ai_driven_swot | 🟢 approved | - | acceptable
06_scenario_planning | 🟢 approved | - | pointing-hand stiffness is tolerable under operational QC
07_competitive_intelligence | 🟠 watchlist | analytical | dense board / product-UI feel, but still publishable
08_strategic_alignment | 🟢 approved | - | acceptable
09_data_first_strategy | 🟢 approved | - | acceptable
10_decision_latency | 🟢 approved | - | acceptable
11_strategic_reporting | 🟢 approved | - | acceptable
12_okr_management | 🟢 approved | - | acceptable
13_why_board_updates_should_come_from_live_transformation_systems | 🟠 watchlist | analytical | clean and usable, but template-forward and slightly slide-like
14_why_strategy_workshops_fail_without_execution_system | 🟢 approved | - | acceptable
15_how_to_keep_transformation_roi_visible_after_kickoff | 🟠 watchlist | hero,analytical | illustrative hero and slide-strip analytical; still publishable
16_why_steering_committees_fail_when_the_system_is_static | 🟢 approved | - | prior dashboard concern is no longer a blocker
17_why_transformation_programs_need_one_source_of_truth | 🟢 approved | - | on-thesis and strong enough under relaxed review
18_how_to_turn_leadership_decisions_into_owned_initiatives | 🟠 watchlist | hero | busy layered composite, but still usable
19_why_transformation_portfolios_fail_without_live_prioritization | 🟠 watchlist | analytical | legible stage logic feels PPT-like, not broken
20_how_to_keep_leadership_alignment_after_the_offsite | 🟢 approved | - | acceptable
21_how_to_defend_transformation_investment_with_live_value_evidence | 🟢 approved | - | acceptable
22_what_monthly_transformation_reviews_should_actually_decide | 🟢 approved | - | acceptable
23_how_to_run_quarterly_transformation_resets_without_losing_momentum | 🟢 approved | - | acceptable
24_what_a_transformation_pmo_should_track_every_week | 🟢 approved | - | acceptable
25_how_to_cut_dead_initiatives_without_political_drift | 🟢 approved | - | acceptable
26_when_to_replan_a_transformation_portfolio_and_when_to_hold_course | 🟢 approved | - | acceptable
27_how_to_make_strategy_assumptions_visible_before_the_board_review | 🟢 approved | - | acceptable
28_why_transformation_capacity_breaks_before_strategy_does | 🟢 approved | - | acceptable
29_how_to_link_transformation_initiatives_to_budget_reality | 🟢 approved | - | acceptable
30_what_executive_sponsors_should_never_delegate_in_transformation | 🟢 approved | - | mild softness is acceptable
31_how_to_build_a_live_transformation_risk_register | 🟢 approved | - | acceptable
32_when_a_transformation_program_needs_intervention_not_more_reporting | 🟢 approved | - | acceptable
33_how_to_design_a_sponsor_cadence_that_actually_changes_transformation_outcomes | 🟢 approved | - | acceptable
34_when_a_transformation_portfolio_should_stop_funding_an_initiative | 🟢 approved | - | acceptable
35_what_a_good_escalation_path_looks_like_in_cross_functional_programs | 🟠 watchlist | - | Agent1 2026-03-31: hero Mode2 physical rerender; v1+meta `cursor-builtin`; human QC hands
36_how_to_reduce_governance_debt_in_large_transformation_programs | 🟢 approved | - | acceptable
37_when_transformation_metrics_start_driving_the_wrong_behavior | 🟢 approved | - | acceptable
38_how_to_keep_strategy_reviews_from_turning_into_narrative_theater | 🟢 approved | - | acceptable
39_what_executives_should_require_before_approving_the_next_wave_of_change | 🟢 approved | - | acceptable
40_how_to_prove_transformation_value_before_the_full_program_finishes | 🟢 approved | - | acceptable
41_when_a_transformation_team_is_overloaded_even_if_the_plan_looks_green | 🟢 approved | - | acceptable
42_how_to_reset_transformation_control_after_a_missed_quarter | 🟢 approved | - | acceptable
43_how_to_define_decision_rights_in_a_transformation_operating_system | 🟢 approved | - | acceptable
44_what_a_board_ready_transformation_packet_should_include_every_time | 🟢 approved | - | acceptable
45_when_to_rewrite_a_transformation_business_case_and_when_not_to | 🟢 approved | - | acceptable
46_how_to_manage_transformation_assumptions_without_spreadsheet_chaos | 🟢 approved | - | acceptable
47_what_a_good_transformation_capacity_model_should_make_visible | 🟢 approved | - | acceptable
48_when_change_exhaustion_is_a_governance_problem_not_a_people_problem | 🟢 approved | - | acceptable
49_how_to_keep_a_transformation_pmo_from_becoming_a_reporting_factory | 🟢 approved | - | acceptable
50_how_to_turn_transformation_management_into_a_repeatable_operating_system | 🟢 approved | - | acceptable
```

### DT

```text
01_digital_twin_not_3d_model_decision_engine | 🟠 watchlist | - | Agent1: analytical twin-vs-model tabletop rerender; v1+meta
02_why_capex_decisions_should_be_simulated_before_they_are_approved | 🟠 watchlist | hero | hand / stiffness issues, but still publishable
03_before_you_buy_a_robot_simulate_it_first | 🟠 watchlist | hero | minor hand softness only
04_why_most_digital_twins_fail | 🟠 watchlist | - | Agent1: hero failure-to-focus physical metaphor; v1+meta
05_how_to_compare_layout_variants_without_guesswork | 🟠 watchlist | - | Agent1: hero dual maquette comparison; v1+meta
06_from_manual_inputs_to_live_data_a_practical_digital_twin_roadmap | 🟠 watchlist | - | Agent1: hero roadmap physical pins-to-sensor; v1+meta
07_how_simulation_reduces_change_risk_in_production_and_logistics | 🟠 watchlist | hero | face / hand softness, not a blocker
08_digital_twin_vs_cad_what_decision_makers_need_to_know | 🟠 watchlist | hero | mild hand issues
09_how_cfos_can_use_simulation_to_validate_roi | 🟠 watchlist | hero | notebook / pen grip softness
10_the_cost_of_rework_when_you_skip_scenario_testing | 🟠 watchlist | hero | single hand artefact
11_how_to_identify_bottlenecks_before_they_happen | 🟠 watchlist | hero | softness and duplicated label feel, still usable
12_simulation_vs_reality_why_your_factory_planning_is_still_wrong | 🟠 watchlist | - | Agent1: hero model-vs-reality; v1+meta (alt gen file); human QC
13_five_scenarios_every_factory_should_simulate | 🟠 watchlist | - | Agent1: hero `hero_16x9_v1` rerender + social `social_1x1_v3` P0 (1024² crop from that hero); meta sidecars
14_digital_twin_for_workforce_optimization | 🟠 watchlist | hero | worker / foot artefacts, but still publishable
15_how_digital_twin_reduces_capex_risk | 🟠 watchlist | hero | metaphor drift is tolerable under the relaxed bar
16_from_static_layout_to_living_factory_model | 🟠 watchlist | - | Agent1: hero static-to-living transition; v1+meta
17_how_to_use_simulation_for_continuous_improvement | 🟠 watchlist | - | Agent1: hero improvement loop tokens; v1+meta
18_the_roi_of_digital_twin_in_12_months | 🟠 watchlist | - | Agent1: hero ROI desk still life; v1+meta (retry gen)
19_how_to_build_a_digital_twin_business_case_without_guesswork | 🟠 watchlist | - | Agent1: hero briefcase scenario slides; v1+meta (retry gen)
20_how_to_run_your_first_simulation_project | 🟠 watchlist | - | Agent1: hero first-project toolkit; v1+meta
21_when_a_factory_should_simulate_before_it_reconfigures_flow | 🟠 watchlist | hero | pseudo floor annotations are not severe enough to reject
22_how_to_test_capacity_decisions_before_the_next_demand_shift | 🟠 watchlist | - | Agent1: hero scales-blocks capacity; v1+meta
23_what_to_simulate_before_expanding_a_production_line | 🟠 watchlist | hero | floating UI icons and dense scene, but still usable
24_how_to_compare_capex_options_when_every_scenario_looks_plausible | 🟠 watchlist | - | Agent1: hero balance-beam CAPEX; v1+meta
25_when_manual_factory_decisions_become_too_expensive_to_trust | 🟠 watchlist | hero | generic command-center feel, not a hard failure
26_how_to_use_digital_twin_for_brownfield_change_planning | 🟠 watchlist | - | Agent1: hero acetate overlays brownfield; v1+meta (retry)
27_what_a_good_simulation_input_set_looks_like_before_live_integration | 🟠 watchlist | - | Agent1: hero tray-stack inputs; social **v3** P0 1024² crop from new hero; v1+meta sidecars
28_how_to_sequence_factory_changes_with_less_operational_risk | 🟠 watchlist | hero | holographic flowchart drift only
29_when_to_use_digital_twin_for_network_and_intralogistics_decisions | 🟠 watchlist | - | Agent1: hero marble-channel hub; v1+meta (timeout retry)
30_how_to_turn_simulation_outputs_into_executive_decisions | 🟠 watchlist | - | Agent1: hero executive packet brass weights; v1+meta
31_how_to_use_digital_twin_in_capex_stage_gates | 🔴 fix_required | hero | stage-gate collage with anatomy and pseudo screen content
32_when_a_simulation_result_is_strong_enough_to_act_on | 🔴 fix_required | analytical | latest analytical has typos / pseudo labels
33_how_to_use_digital_twin_for_factory_change_governance | 🔴 fix_required | hero | misspelled centre label and distorted hands
34_what_a_good_sensitivity_analysis_should_show_before_approval | 🔴 fix_required | hero | multiple misspelled control-panel labels
35_how_to_test_supplier_and_ramp_risk_in_factory_simulation | 🔴 fix_required | hero | misspelled section headers
36_when_to_simulate_phased_rollouts_instead_of_full_cutovers | 🟠 watchlist | hero,social | duplicate callouts and weaker social focal point, but still publishable
37_how_to_use_digital_twin_in_monthly_operations_reviews | 🔴 fix_required | hero | many typos / gibberish overlays
38_what_to_compare_before_you_expand_capacity_in_a_brownfield_factory | 🔴 fix_required | hero,analytical | typo-heavy hero and misspelled analytical labels
39_how_to_package_simulation_evidence_for_board_level_decisions | 🔴 fix_required | hero | pseudo labels and spelling errors
40_when_to_refresh_a_digital_twin_model_after_operational_change | 🟠 watchlist | hero | pointing-arm elongation only
41_how_to_decide_when_a_simulation_is_good_enough_for_capital_commitment | 🟠 watchlist | - | Agent3 2026-03-31: hero rerender Mode 2 physical; v1+meta `cursor-builtin`; first gen timeout→ag3_dt41_hero2
42_what_a_factory_scenario_library_should_look_like_after_the_first_projects | 🟠 watchlist | social | social geometry is awkward, but still serviceable
43_how_to_retire_weak_options_early_in_digital_twin_decision_cycles | 🟠 watchlist | hero | crop and hand softness only
44_when_to_use_digital_twin_in_post_investment_reviews_and_when_not_to | 🟠 watchlist | - | Agent3: hero rerender PIR delta evidence; v1+meta; human QC hands
45_how_to_assign_model_ownership_across_engineering_operations_and_finance | 🟠 watchlist | - | Agent3: hero rerender steward hub tokens; v1+meta
46_what_an_executive_simulation_review_should_decide_in_30_minutes | 🔴 fix_required | hero | extra-digit hand is too visible to ship
47_when_to_link_digital_twin_to_real_time_data_and_when_static_is_enough | 🟠 watchlist | hero | decorative symbol noise, not a hard blocker
48_how_to_compare_resilience_not_just_throughput_in_factory_scenarios | 🟠 watchlist | - | Agent3: hero dual mockup resilience contrast; v1+meta
49_what_a_reusable_factory_assumption_ledger_should_include | 🟠 watchlist | - | Agent3: hero linked packets chain; v1+meta; first gen timeout→ag3_dt49_hero2
50_how_to_turn_digital_twin_into_a_repeatable_capex_decision_system | 🔴 fix_required | hero,analytical | garbled cues and pseudo module titles
```

### DBR77

```text
01_why_most_factories_still_run_on_guesswork | 🟠 watchlist | - | Agent3: hero+analytical physical chaos-vs-rail; v1+meta; hero first timeout→ag3_d77_01_hero2
02_the_hidden_cost_of_poor_factory_decisions | 🟠 watchlist | - | Agent3: analytical domino cascade tabletop; v1+meta
03_from_excel_to_ai_the_evolution_of_factory_management | 🟢 approved | - | clear before/after thesis; mild softness is acceptable
04_why_digital_transformation_fails_in_manufacturing | 🟠 watchlist | hero | strong before/after metaphor; decorative gibberish is tolerable here
05_the_new_role_of_the_factory_ceo_in_the_ai_era | 🟠 watchlist | - | Agent3: analytical CEO old silos vs dial+seals; v1+meta
06_the_death_of_static_planning_in_manufacturing | 🟠 watchlist | - | Agent3 Paczka C 2026-03-31: hero Mode 2 physical refresh; `cursor-builtin` v1+meta
07_why_you_should_never_invest_in_automation_without_simulation | 🟠 watchlist | - | Agent3 Paczka C: analytical physical prototype vs brochure; v1+meta
08_the_real_reason_your_factory_is_not_efficient | 🟠 watchlist | - | Agent3 Paczka C: analytical friction-chain rig; v1+meta
09_data_is_the_new_factory_floor | 🟠 watchlist | - | Agent3 Paczka C: hero tactile bench metaphor; v1+meta
10_the_factory_of_the_future_is_not_automated_its_intelligent | 🟠 watchlist | - | Agent3 Paczka C: analytical twin diorama; v1+meta
01_ai_native_operating_system_for_industry | 🟠 watchlist | - | Agent3 Paczka C: analytical five-tray stack; v1+meta
02_one_ecosystem_for_manufacturing_decisions | 🟠 watchlist | - | Agent3 Paczka C: triptych physical routing; social 1024²
03_decision_systems_in_manufacturing | 🟠 watchlist | hero | hologram-heavy hero, but still publishable
04_from_guesswork_to_governed_execution | 🟠 watchlist | - | Agent3 Paczka C: analytical yarn vs straightedges; v1+meta
05_simulate_run_automate_the_dbr77_operating_logic | 🟠 watchlist | - | Agent3 Paczka C: hero track + social 1024² kinetic macro; v1+meta
06_which_dbr77_product_fits_your_current_decision_bottleneck | 🟠 watchlist | - | Agent3 Paczka C: hero cork Y-fork + analytical hex tiles; v1+meta
01_ceo_better_board_control_through_stronger_decision_systems | 🟠 watchlist | - | Agent3 Paczka C: triptych physical governance; social 1024²
02_cfo_safer_capex_and_clearer_roi_in_manufacturing | 🟠 watchlist | - | Agent3 Paczka C: hero desk story + analytical capex rail; v1+meta
03_cto_reduce_tool_sprawl_and_strengthen_decision_architecture | 🟢 approved | - | all roles are publishable enough under the relaxed bar
04_plant_manager_less_firefighting_more_control | 🟠 watchlist | - | Agent3 Paczka C: hero aisle tableau + analytical dual tracks; v1+meta
```

### Vector

```text
01_why_public_ai_is_a_security_risk_for_industrial_operations | 🟠 watchlist | hero,analytical,social | credible industrial/security thesis, but still carries hologram and cyber drift
02_will_your_data_train_someone_elses_model_what_every_manufacturer_should_ask | 🟠 watchlist | - | Agent3 2026-03-31: analytical rerender Mode 2 physical review arc; v1+meta; human QC
03_on_prem_vs_cloud_ai_for_manufacturing_what_actually_matters | 🟠 watchlist | - | Agent3: full triptych rerender physical containment board; social 1024²; `cursor-builtin`
04_generic_llm_vs_industrial_ai_the_difference_is_bigger_than_accuracy | 🟠 watchlist | - | Agent3: analytical rerender dual-rail governed vs casual; v1+meta
05_why_factory_data_should_never_be_treated_like_generic_enterprise_data | 🟠 watchlist | - | Agent3: hero rerender paper vs steel plates metaphor; v1+meta
06_the_hidden_risk_of_uploading_layouts_costs_and_process_know_how_to_public_ai | 🟠 watchlist | hero,analytical | assets exist; hero and analytical are usable but too texty and dashboard-like
07_what_private_ai_really_means_in_a_manufacturing_environment | 🟠 watchlist | - | Agent3: hero rerender mesh cabinet patch private deployment; v1+meta (analytical/social unchanged this batch)
08_how_to_evaluate_an_industrial_ai_vendor_without_getting_lost_in_buzzwords | 🟠 watchlist | analytical,social | mild typo artefacts and awkward social text, but still publishable
09_why_ai_governance_matters_more_in_factories_than_in_offices | 🟠 watchlist | analytical | duplicated / misspelled review labels, though the slug is still shippable
10_ai_that_recommends_is_useful_ai_that_decides_alone_is_dangerous | 🟠 watchlist | social | social headline is awkward, but the overall thesis remains clear
11_the_real_cost_of_choosing_the_wrong_ai_deployment_model | 🟠 watchlist | - | Agent3 Paczka 11–19: triptych landed Mode 2 physical; v1+meta; social 1024²
12_can_you_audit_your_ai_why_traceability_matters_in_industrial_decisions | 🟠 watchlist | - | Agent3 triptych; social used alt raster `vec32_12_social2` (timeout on first gen); see meta `generation_notes`
13_why_domain_knowledge_beats_bigger_generic_models_in_manufacturing | 🟠 watchlist | - | Agent3 triptych physical fit-vs-scale story; v1+meta
14_what_it_means_to_train_an_ai_on_real_transformation_cases | 🟠 watchlist | - | Agent3 triptych case-archive workbench; v1+meta
15_why_security_teams_block_ai_projects_and_when_theyre_right | 🟠 watchlist | - | Agent3 triptych barrier/unmated couplers; v1+meta
16_industrial_ai_without_data_sovereignty_is_a_strategic_mistake | 🟠 watchlist | - | Agent3 triptych boundary threshold wire tension; v1+meta
17_how_human_approval_layers_make_ai_safer_and_more_defensible | 🟠 watchlist | - | Agent3 triptych frosted layers stamp; v1+meta
18_the_enterprise_checklist_for_secure_ai_in_manufacturing | 🟠 watchlist | - | Agent3 triptych riveted punch readiness; v1+meta
19_what_makes_an_ai_model_deployment_ready_for_industry | 🟠 watchlist | - | Agent3: **hero** v1 rerender (demo cloche vs deployment crate); analytical+social left as earlier versions in folder—reconcile under Mode 2 when convenient
20_how_dbr77_vector_differs_from_chatgpt_wrappers_and_generic_copilots | 🟡 missing | hero,analytical,social | no generated assets yet
21_when_a_manufacturer_should_choose_private_ai_over_public_ai_convenience | 🟡 missing | hero,analytical,social | no generated assets yet
22_how_to_run_a_security_review_of_an_industrial_ai_vendor | 🟡 missing | hero,analytical,social | no generated assets yet
23_what_an_ai_deployment_boundary_should_include_in_manufacturing | 🟡 missing | hero,analytical,social | no generated assets yet
24_when_ai_outputs_need_human_approval_and_when_they_do_not | 🟡 missing | hero,analytical,social | no generated assets yet
25_how_to_compare_industrial_ai_training_policies_without_marketing_fog | 🟡 missing | hero,analytical,social | no generated assets yet
26_what_traceability_should_look_like_in_a_manufacturing_ai_system | 🟡 missing | hero,analytical,social | no generated assets yet
27_when_on_prem_ai_is_worth_the_complexity_and_when_it_is_not | 🟡 missing | hero,analytical,social | no generated assets yet
28_how_to_build_a_governed_pilot_for_industrial_ai_without_creating_shadow_it | 🟡 missing | hero,analytical,social | no generated assets yet
29_what_a_cto_should_ask_before_connecting_ai_to_factory_systems | 🟡 missing | hero,analytical,social | no generated assets yet
30_how_to_turn_secure_industrial_ai_into_a_repeatable_operating_capability | 🟡 missing | hero,analytical,social | no generated assets yet
31_when_ai_security_claims_are_too_vague_for_industrial_buyers | 🟡 missing | hero,analytical,social | no generated assets yet
32_how_to_classify_factory_use_cases_by_ai_risk_before_adoption | 🟡 missing | hero,analytical,social | no generated assets yet
33_what_a_private_ai_architecture_review_should_decide_before_rollout | 🟡 missing | hero,analytical,social | no generated assets yet
34_when_a_manufacturer_should_isolate_ai_by_site_business_unit_or_workflow | 🟡 missing | hero,analytical,social | no generated assets yet
35_how_to_write_non_negotiable_ai_requirements_into_enterprise_procurement | 🟡 missing | hero,analytical,social | no generated assets yet
36_what_an_industrial_ai_incident_response_model_should_include | 🟡 missing | hero,analytical,social | no generated assets yet
37_when_factory_knowledge_should_not_be_exposed_to_generic_ai_tools | 🟠 watchlist | - | Agent3 Paczka C 2026-03-31: full triptych Mode 2 physical routing/knowledge rig; social 1024²; `cursor-builtin` v1+meta
38_how_to_evaluate_ai_subprocessors_and_data_paths_in_manufacturing | 🟢 approved | hero,analytical,social | Vector Agent3 triptych v1+meta; social center-crop
39_what_a_secure_human_in_the_loop_design_should_look_like_for_industrial_ai | 🟢 approved | hero,analytical,social | Vector Agent3; analytical QC rerender (punctuation/ruler drift)
40_how_to_scale_industrial_ai_without_losing_deployment_control | 🟢 approved | hero,analytical,social | Vector Agent3 triptych v1+meta
41_when_ai_governance_should_become_a_board_level_issue_in_manufacturing | 🟢 approved | hero,analytical,social | Vector Agent3 triptych v1+meta
42_what_a_manufacturer_should_require_in_an_ai_audit_export | 🟢 approved | hero,analytical,social | Vector Agent3 triptych v1+meta; refresh 2026-03-31 physical-lane prompts; `generation_notes` (seed/steps n/a, px table); social 1024²
43_how_to_decide_which_factory_workflows_are_safe_enough_for_ai_assistance | 🟢 approved | hero,analytical,social | Vector Agent3; refresh 2026-03-31 physical-lane prompts; `generation_notes`; social 1024²
44_when_an_industrial_ai_program_should_pause_before_scaling_further | 🟢 approved | hero,analytical,social | Vector Agent4 premium triptych v1+meta; social 768sq center-crop from 1376×768
45_what_a_secure_ai_change_control_process_should_include | 🟢 approved | hero,analytical,social | Vector Agent4 premium triptych v1+meta; social 768sq center-crop from 1376×768
46_how_to_compare_private_api_isolated_tenant_and_on_prem_ai_without_confusion | 🟠 watchlist | - | triptych Agent 4 (2026-03 end); premium physical control metaphors; Mode 2 QC; social 1024² crop
47_when_ai_policy_documents_fail_and_operating_rules_should_replace_them | 🟠 watchlist | - | triptych Agent 4 (2026-03 end); premium physical control metaphors; Mode 2 QC; social 1024² crop
48_what_a_multi_site_industrial_ai_rollout_should_standardize_first | 🟠 watchlist | - | triptych Agent 4 (2026-03 end); premium physical control metaphors; Mode 2 QC; social 1024² crop
49_how_to_review_industrial_ai_risk_after_the_first_90_days | 🟠 watchlist | - | triptych Agent 4 (2026-03 end); premium physical control metaphors; Mode 2 QC; social 1024² crop
50_how_to_build_a_manufacturing_ai_governance_system_that_survives_scale | 🟠 watchlist | - | triptych Agent 4 (2026-03 end); premium physical control metaphors; Mode 2 QC; social 1024² crop
```

### IRIS

```text
01_why_dashboards_dont_fix_factories | 🟠 watchlist | hero,analytical,social | strong metaphor, but slightly gimmicky and stock-like; Agent2: social v2 true 1024² (crop from mislabeled 16:9 v1)
02_what_a_plant_operating_system_actually_means | 🟠 watchlist | - | Agent3: IRIS hero five-station brass groove table; v1+meta; verify hands; Agent2: hero v3 1376×768 cover from square v2; social v2 1024²
03_why_mes_alone_is_no_longer_enough | 🟠 watchlist | hero,analytical | mild hand softness and readable START / STOP controls; Agent2: social v2 1024²
04_from_insight_to_task_to_action_closing_the_execution_loop | 🟠 watchlist | analytical,social | analytical feels toy-like; social split layout is weaker than the brief; Agent2: social v2 1024²
05_why_plants_still_run_on_spreadsheets | 🟠 watchlist | hero | triptych exists; hero has mild softness and small stamped marks; Agent2: social v2 1024²
06_ai_native_operations_what_that_should_mean_in_practice | 🟠 watchlist | - | Agent3: IRIS hero embedded groove approval gate; v1+meta; Agent2: hero v3 1376×768 cover from square v2; social v2 1024²
07_how_to_unify_mes_wms_qms_and_cmms_without_replacing_everything | 🟠 watchlist | hero,analytical,social | triptych on disk; register sync; Agent2: social v2 1024²
08_why_hidden_definitions_kill_kpi_alignment | 🟠 watchlist | hero,analytical,social | triptych on disk; register sync; Agent2: social v2 1024²
09_the_cost_of_siloed_operational_systems | 🟡 missing | hero,analytical,social | no generated assets yet
10_how_human_approval_makes_industrial_ai_more_useful | 🟠 watchlist | hero,analytical,social | hero+analytical v1 are 1376×768; Agent2: analytical v3 from square v2 → 1376×768; social v2 1024² from wide v1
11_how_to_build_a_real_time_kpi_system_for_your_factory | 🟡 missing | hero,analytical,social | no generated assets yet
12_oee_is_not_enough_what_you_should_measure_instead | 🟡 missing | hero,analytical,social | no generated assets yet
13_how_to_manage_maintenance_with_data | 🟡 missing | hero,analytical,social | no generated assets yet
14_warehouse_optimization_using_real_time_data | 🟡 missing | hero,analytical,social | no generated assets yet
15_production_planning_vs_reality_why_aps_fails | 🟠 watchlist | hero,analytical,social | Agent2: hero+analytical v2 true 16:9 (cover from square v1); social v1 already 1024²; human Mode 2 QC
16_how_to_connect_all_factory_systems_into_one_brain | 🟠 watchlist | hero,analytical,social | Agent2: hero+analytical v2 true 16:9 from square v1; social v1 already 1024²
17_from_reporting_to_decision_making_systems | 🟠 watchlist | hero,analytical,social | Agent2: hero+analytical v2 true 16:9 from square v1; social v1 already 1024²
18_the_end_of_manual_production_control | 🟠 watchlist | hero,analytical,social | Agent2: hero+analytical v2 true 16:9 from square v1; social v1 already 1024²
19_how_to_evaluate_a_plant_operating_system_for_a_real_factory | 🟠 watchlist | hero,analytical,social | Agent2: hero+analytical v2 true 16:9 from square v1; social v2 1024² (wide v1 corrected)
20_why_ai_in_factory_operations_fails_without_one_execution_layer | 🟡 missing | hero,analytical,social | no generated assets yet
21_how_ai_is_changing_factory_operations_when_execution_is_connected | 🟡 missing | hero,analytical,social | no generated assets yet
22_what_an_ai_agent_can_do_in_a_factory_today | 🟡 missing | hero,analytical,social | no generated assets yet
23_from_humans_to_ai_assisted_operations_what_changes_first | 🟡 missing | hero,analytical,social | no generated assets yet
24_autonomous_factory_myth_or_operating_reality | 🟡 missing | hero,analytical,social | no generated assets yet
25_how_to_build_ai_assisted_factory_operations_step_by_step | 🟡 missing | hero,analytical,social | no generated assets yet
26_when_ai_should_recommend_and_when_humans_should_decide_in_operations | 🟡 missing | hero,analytical,social | no generated assets yet
27_why_factories_need_one_decision_layer_before_more_ai_models | 🟡 missing | hero,analytical,social | no generated assets yet
28_how_ai_can_prioritize_factory_issues_across_functions | 🟡 missing | hero,analytical,social | no generated assets yet
29_what_makes_factory_ai_trustworthy_for_operations_leaders | 🟡 missing | hero,analytical,social | no generated assets yet
30_how_to_roll_out_ai_assisted_operations_without_disrupting_the_plant | 🟡 missing | hero,analytical,social | no generated assets yet
31_how_ai_and_digital_twin_work_together_in_factory_decisions | 🟡 missing | hero,analytical,social | no generated assets yet
32_why_ai_without_operational_data_still_fails_in_manufacturing | 🟡 missing | hero,analytical,social | no generated assets yet
33_how_ai_can_reduce_downtime_when_response_loops_exist | 🟡 missing | hero,analytical,social | no generated assets yet
34_the_rise_of_decision_automation_in_manufacturing | 🟡 missing | hero,analytical,social | no generated assets yet
35_what_factory_jobs_change_first_in_ai_assisted_operations | 🟡 missing | hero,analytical,social | no generated assets yet
36_when_ai_should_watch_advise_or_act_in_the_factory | 🟡 missing | hero,analytical,social | no generated assets yet
37_how_to_govern_ai_decisions_across_shifts_and_functions | 🟡 missing | hero,analytical,social | no generated assets yet
38_how_to_scale_ai_assistance_without_losing_operational_control | 🟡 missing | hero,analytical,social | no generated assets yet
39_what_a_human_approval_policy_should_look_like_in_factory_ai | 🟡 missing | hero,analytical,social | no generated assets yet
40_how_to_review_ai_assisted_operations_after_the_first_90_days | 🟡 missing | hero,analytical,social | no generated assets yet
41_how_to_design_an_exception_handling_model_for_ai_assisted_operations | 🟡 missing | hero,analytical,social | no generated assets yet
42_when_a_factory_needs_one_operational_arbiter_for_conflicting_signals | 🟡 missing | hero,analytical,social | no generated assets yet
43_how_to_build_a_cross_site_playbook_for_ai_assisted_factory_operations | 🟡 missing | hero,analytical,social | no generated assets yet
44_what_an_executive_ai_operations_scorecard_should_include_and_ignore | 🟡 missing | hero,analytical,social | no generated assets yet
45_when_to_keep_ai_assistance_inside_one_workflow_and_when_to_connect_more | 🟡 missing | hero,analytical,social | no generated assets yet
46_how_to_create_audit_ready_records_for_ai_assisted_factory_decisions | 🟡 missing | hero,analytical,social | no generated assets yet
47_what_data_ownership_should_look_like_in_an_ai_native_plant_operating_system | 🟡 missing | hero,analytical,social | no generated assets yet
48_when_vendor_ai_tools_should_feed_the_execution_layer_and_when_not_to | 🟡 missing | hero,analytical,social | no generated assets yet
49_how_to_keep_human_accountability_clear_in_ai_assisted_shift_management | 🟡 missing | hero,analytical,social | no generated assets yet
50_what_full_operational_closure_should_look_like_in_an_ai_native_factory | 🟡 missing | hero,analytical,social | no generated assets yet
```

### IoT

```text
01_why_factories_still_dont_use_machine_data | 🟡 missing | hero,analytical,social | no generated assets yet
02_what_data_should_you_collect_from_machines | 🟡 missing | hero,analytical,social | no generated assets yet
03_from_sensors_to_decisions | 🟡 missing | hero,analytical,social | no generated assets yet
04_machine_data_is_useless_without_context | 🟡 missing | hero,analytical,social | no generated assets yet
05_edge_vs_cloud_in_manufacturing | 🟡 partial | social | DBR77 window: social_1x1_v1 + sidecar only; hero and analytical still pending
06_how_to_start_iiot_without_breaking_production | 🟢 approved | hero,analytical,social | v1 rasters + meta (DBR77 IoT operator batch); professional-reset QC pass
07_how_to_reduce_downtime_by_30_using_real_time_data | 🟢 approved | hero,analytical,social | v1 rasters + meta (DBR77 IoT operator batch)
08_the_hidden_costs_of_not_measuring_production_properly | 🟢 approved | hero,analytical,social | v1 rasters + meta (DBR77 IoT operator batch)
09_oee_is_not_enough | 🟢 approved | hero,analytical,social | v1 rasters + meta (DBR77 IoT operator batch)
10_why_your_maintenance_strategy_is_failing | 🟢 approved | hero,analytical,social | v1 rasters + meta (DBR77 IoT operator batch)
11_real_time_production_visibility_in_practice | 🟢 approved | hero,analytical,social | v1 rasters + meta; social rerendered once for blank-screen QC (pre-raster kept)
12_5_operational_problems_every_factory_has | 🟢 approved | hero,analytical,social | v1 rasters + meta; verify lanyard badge at full res for text integrity
13_7_mistakes_companies_make_when_implementing_iot | 🟢 approved | hero,analytical,social | v1 rasters + meta (DBR77 IoT operator batch)
14_from_pilot_to_scale_how_to_roll_out_iiot_without_losing_control | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
15_how_to_build_a_business_case_for_iiot_in_a_brownfield_factory | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
16_what_to_measure_in_the_first_90_days_of_iiot_rollout | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
17_how_to_choose_the_right_first_iiot_use_case | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
18_who_should_own_iiot_rollout_inside_the_factory | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
19_why_iiot_alerts_fail_on_the_shop_floor_and_what_works_instead | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
20_how_to_review_iiot_value_after_the_first_pilot | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 window-100 slice-25); prompts reset to physical lane; verify vs DBR77_IMAGE_QC_STANDARD before benchmark approval
22_when_to_integrate_iiot_with_mes_erp_and_cmms_and_when_to_wait | 🟡 missing | analytical,social | hero landed 2026-03-29 (slice-25); analytical+social deferred to next queue operator; partial prompt placeholders in image-prompts.md
23_what_machine_data_should_trigger_action_and_what_should_not | 🟡 missing | hero,analytical,social | no generated assets yet
24_how_to_improve_machine_data_quality_before_scaling_iot | 🟡 missing | hero,analytical,social | no generated assets yet
25_when_edge_processing_is_worth_it_in_brownfield_iot | 🟡 missing | hero,analytical,social | no generated assets yet
26_how_to_roll_out_iot_across_multiple_lines_without_losing_control | 🟡 missing | hero,analytical,social | no generated assets yet
27_what_to_do_when_operators_do_not_trust_iot_signals_yet | 🟡 missing | hero,analytical,social | no generated assets yet
28_how_to_reduce_false_alarms_in_iiot_systems | 🟡 missing | hero,analytical,social | no generated assets yet
29_when_to_expand_from_visibility_to_closed_loop_response | 🟡 missing | hero,analytical,social | no generated assets yet
30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard | 🟢 approved | hero,analytical,social | DBR77 pack3 scope: social v1 + meta only; hero and analytical from earlier run
31_what_to_review_after_the_first_6_months_of_iot_rollout | 🟢 approved | hero,analytical,social | DBR77 IoT operator pack3 v1 + meta
32_how_to_prove_iot_value_across_sites_without_forcing_one_template | 🟢 approved | hero,analytical,social | DBR77 IoT operator pack3 v1 + meta
33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting | 🟢 approved | hero,analytical,social | DBR77 IoT operator pack3 v1 + meta
34_when_iot_should_trigger_supervisor_escalation_and_when_it_should_not | 🟢 approved | hero,analytical,social | DBR77 IoT operator pack3 v1 + meta
35_what_a_good_machine_state_model_looks_like_before_scaling_iot | 🟢 approved | hero,analytical,social | pack3 v1 + meta; social rerender for lock text artefact
36_how_to_turn_iot_signals_into_maintenance_priorities_without_noise | 🟢 approved | hero,analytical,social | DBR77 IoT operator pack3 v1 + meta
37_how_to_keep_an_iot_program_alive_when_the_first_champion_leaves | 🟢 approved | hero,analytical,social | pack3 v1 + meta; social rerender for garment print; check reader UI at full res
38_what_to_standardize_across_sites_in_iot_and_what_to_leave_local | 🟢 approved | hero,analytical,social | DBR77 IoT operator pack3 v1 + meta
39_how_to_use_iot_for_faster_problem_confirmation_on_the_shop_floor | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
40_when_real_time_visibility_should_change_the_production_plan | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
41_how_to_review_operator_overrides_in_iot_workflows | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
42_what_iot_governance_should_look_like_after_the_first_year | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
43_how_to_keep_iot_signal_definitions_consistent_across_shifts | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
44_when_iot_alerts_should_create_work_orders_and_when_they_should_not | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
45_what_an_executive_iot_scorecard_should_include_after_scale_up | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
46_how_to_decide_which_iot_signals_deserve_edge_logic | 🟠 watchlist | - | triptych landed 2026-03-29 (DBR77 IoT batch 4/4); physical-scene premium pass; anti-control-room prompt lane; human QC vs DBR77_IMAGE_QC_STANDARD
47_when_real_time_visibility_should_trigger_structured_problem_solving | 🟡 missing | analytical,social | hero landed 2026-03-29 (batch 4/4); analytical+social reserved next round (see image-prompts.md)
48_how_to_create_a_site_ready_iot_rollout_playbook_for_new_lines | 🟡 missing | hero,analytical,social | no generated assets yet
49_what_data_retention_and_traceability_should_look_like_in_iiot | 🟡 missing | hero,analytical,social | no generated assets yet
50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory | 🟡 missing | hero,analytical,social | no generated assets yet
```

### Marketplace

```text
01_why_most_automation_projects_never_start | 🟡 missing | hero,analytical,social | no generated assets yet
02_the_hidden_cost_of_manual_processes_in_manufacturing | 🟡 missing | hero,analytical,social | no generated assets yet
03_why_hiring_more_people_is_not_a_strategy_anymore | 🟡 missing | hero,analytical,social | no generated assets yet
04_what_automation_really_means_in_2026 | 🟡 missing | hero,analytical,social | no generated assets yet
05_the_biggest_myths_about_industrial_automation | 🟢 approved | hero,analytical,social | producer3 pack: social v1+meta; center-crop social; hero+analytical already in folder with sidecars
06_why_automation_feels_overwhelming | 🟢 approved | hero,analytical,social | producer3 local runner triptych v1+meta; social center-crop from 16:9 master
07_the_real_reason_plants_delay_automation_decisions | 🟢 approved | hero,analytical,social | same
08_how_to_identify_the_best_processes_to_automate_first | 🟢 approved | hero,analytical,social | same
09_how_to_compare_automation_vendors_effectively | 🟢 approved | hero,analytical,social | hero rerender for garment text artefact; prior archived
10_the_real_cost_of_automation | 🟢 approved | hero,analytical,social | same
11_how_to_run_an_automation_pilot_project | 🟢 approved | hero,analytical,social | same
12_how_to_reduce_risk_in_automation_projects | 🟢 approved | hero,analytical,social | same
13_when_not_to_automate_and_why_waiting_can_be_the_right_decision | 🟢 approved | hero,analytical,social | same
14_how_to_write_a_better_automation_challenge_brief | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
15_what_to_include_in_an_automation_rfq_or_rfp | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
16_how_to_compare_robot_integrators_oems_and_turnkey_suppliers | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
17_what_a_good_automation_offer_should_make_visible | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
18_when_to_standardize_and_when_to_customize_an_automation_project | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
19_how_to_align_operations_engineering_and_procurement_before_automation_buying | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
20_what_to_check_before_signing_an_automation_contract | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
21_how_to_scope_an_automation_project_without_overcomplicating_it | 🟠 watchlist | - | triptych landed 2026-03-29 (Marketplace / Cursor prod4); premium physical-scene lane; verify vs DBR77_IMAGE_QC_STANDARD Mode 2
22_how_to_keep_automation_momentum_after_the_first_vendor_meetings | 🟡 missing | analytical,social | hero landed 2026-03-29 (prod4); analytical+social next pack — image-prompts.md reserved
23_how_to_check_automation_supplier_references_without_wasting_time | 🟡 missing | hero,analytical,social | no generated assets yet
24_when_to_use_a_shortlist_and_when_to_keep_more_suppliers_in_play | 🟡 missing | hero,analytical,social | no generated assets yet
25_what_fat_and_sat_should_actually_prove_before_go_live | 🟡 missing | hero,analytical,social | no generated assets yet
26_how_to_compare_automation_commercial_models_not_just_prices | 🟡 missing | hero,analytical,social | no generated assets yet
27_when_single_sourcing_is_smarter_than_running_a_full_supplier_beauty_contest | 🟠 watchlist | - | triptych complete: hero+analytical Agent 2; social Agent 3 (2026-03-30) incl. 1024x1024 square post-process per feed QC
28_what_internal_red_flags_should_pause_an_automation_buying_process | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
29_how_to_prepare_your_plant_for_supplier_site_visits_and_discovery_workshops | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
30_what_a_clean_handoff_from_selection_to_delivery_should_look_like | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
31_how_to_validate_total_cost_of_ownership_in_automation_projects | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
32_when_to_reopen_an_automation_decision_before_signing | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
33_how_to_choose_the_right_internal_owner_for_an_automation_project | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
34_when_to_run_a_paid_discovery_phase_before_full_automation_award | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
35_what_change_order_risk_to_check_before_an_automation_project_starts | 🟠 watchlist | - | triptych Agent 3 (2026-03-30); premium physical-scene lane; Mode 2 human QC
36_how_to_set_acceptance_criteria_before_automation_delivery_begins | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta; one-pass QC rerender hero (badges/grid drift)
37_when_an_incumbent_supplier_should_not_win_the_next_automation_project | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta; social center-crop
38_how_to_keep_procurement_speed_without_losing_technical_quality | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta
39_what_a_good_internal_business_case_for_automation_should_make_visible | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta
40_how_to_prepare_operations_for_automation_go_live_before_installation_starts | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta
41_when_to_bundle_multiple_automation_needs_into_one_buying_process_and_when_not_to | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta
42_how_to_run_a_final_internal_alignment_review_before_automation_kickoff | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta
43_how_to_decide_if_an_automation_project_is_ready_for_board_approval | 🟢 approved | hero,analytical,social | Agent4 triptych v1+meta; one-pass QC rerender social (ruler ticks)
44_what_a_board_ready_automation_decision_packet_should_include | 🟡 partial | hero | Agent4: hero v1+meta only; analytical+social next batch per scope
45_when_to_freeze_scope_in_an_automation_purchase_and_when_not_to | 🟡 missing | hero,analytical,social | no generated assets yet
46_how_to_keep_supplier_clarifications_from_destroying_offer_comparability | 🟡 missing | hero,analytical,social | no generated assets yet
47_when_a_manufacturer_needs_a_formal_owner_side_pmo_for_automation_delivery | 🟡 missing | hero,analytical,social | no generated assets yet
48_what_a_good_manufacturer_side_mobilization_plan_should_include_after_award | 🟡 missing | hero,analytical,social | no generated assets yet
49_how_to_review_automation_project_risk_between_contract_award_and_go_live | 🟡 missing | hero,analytical,social | no generated assets yet
50_how_to_turn_automation_buying_into_a_repeatable_decision_system | 🟡 missing | hero,analytical,social | no generated assets yet
49_how_to_review_automation_buying_decisions_after_go_live_without_blame_theater | 🟠 watchlist | - | ARCHIVE (`_archive_marketplace_43_49_pre_collision_packages/`); Agent4 triptych 2026-03-31; premium anti-NOC/sci-fi pass; physical lane; cursor-builtin; hero|analytical 1376×768; social PIL 1024²; Mode 2 human QC
```

## Administrative Priorities

### Priority 1

- repair only true reds that are already generated:
  - `Consultify 35`
  - `IRIS 02`, `IRIS 06`
  - `Vector 02`, `03`, `04`, `05`, `07`

### Priority 2

- repair text-heavy red assets in `DT` first:
  - prioritise analyticals and heroes with obvious readable gibberish
  - do not spend budget on orange-only hero softness

### Priority 3

- repair `DBR77` reds where the failure is clear text or wrong-subject logic:
  - analyticals first
  - hero rerenders only where overlays or subject choice are visibly damaging

### Priority 4

- continue fresh generation:
  - `Vector 11-50`
  - `IRIS 07-50`
  - `IoT 01-50`
  - `Marketplace 01-50`

## Admin Rules Going Forward

- Every new generation batch must update this register.
- No slug should be treated as done without a QC decision.
- Existing files alone do not mean approved status.
- If a role is rerendered, the slug must be rechecked in this register.
- `🟠 watchlist` means publishable now and should not trigger automatic rerendering.
