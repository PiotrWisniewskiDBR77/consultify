from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "_DATA" / "catalogs" / "DBR77_CONTENT_CATALOG.csv"
OUTPUT_ROOT = ROOT / "_LP_KB_READY"


PRODUCT_CONFIG = {
    "Consultify": {
        "primary_persona_entry": "Owner / President / Chairman",
        "section_order": ["Governance And ROI", "Execution And Rollout", "AI And Decision Making"],
        "section_promises": {
            "Governance And ROI": "Show how transformation becomes governable, financially visible, and board-defensible.",
            "Execution And Rollout": "Show how transformation moves from workshop logic into owned operating behavior.",
            "AI And Decision Making": "Show how strategic clarity improves when assumptions, reporting, and scenarios become structured.",
        },
        "decision_paths": [
            {"path_id": "understand_governance_gap", "label": "understand the governance gap", "goal": "see where strategy turns into drift", "section_target": "Governance And ROI", "cta": "explore transformation blind spots"},
            {"path_id": "see_rollout_logic", "label": "see implementation path", "goal": "understand how ownership and cadence are installed", "section_target": "Execution And Rollout", "cta": "book workshop"},
            {"path_id": "review_decision_logic", "label": "review decision logic", "goal": "see how analysis, reporting, and assumptions are connected", "section_target": "AI And Decision Making", "cta": "review ROI case"},
        ],
        "cta_ladder": {
            "low_commitment": {"label": "explore transformation blind spots", "intent": "explore", "target": "Governance And ROI"},
            "mid_commitment": {"label": "book workshop", "intent": "workshop", "target": "Execution And Rollout"},
            "high_commitment": {"label": "review ROI case", "intent": "decision", "target": "Governance And ROI"},
        },
        "bridges": {
            "Governance And ROI": {"target_product": "DT", "target_section": "CAPEX And Investment", "why_next": "Use scenario testing when investment logic needs stronger evidence."},
            "Execution And Rollout": {"target_product": "IRIS", "target_section": "Execution And Rollout", "why_next": "Move from program design into daily execution control."},
            "AI And Decision Making": {"target_product": "Vector", "target_section": "Governance And ROI", "why_next": "Bring AI governance into executive decision quality."},
        },
        "mva": {
            "flagship_awareness": "01_why_traditional_consulting_is_broken",
            "demo_trial_explainer": "03_first_30_minutes_in_consultify",
            "decision_stage": "21_how_to_defend_transformation_investment_with_live_value_evidence",
            "adoption_stage": "24_what_a_transformation_pmo_should_track_every_week",
            "nurture_stream": [
                "07_competitive_intelligence",
                "10_decision_latency",
                "16_why_steering_committees_fail_when_the_system_is_static",
                "33_how_to_design_a_sponsor_cadence_that_actually_changes_transformation_outcomes",
                "45_when_to_rewrite_a_transformation_business_case_and_when_not_to",
                "50_how_to_turn_transformation_management_into_a_repeatable_operating_system",
            ],
        },
        "proof_snapshots": [
            {
                "snapshot_id": "strategy_becomes_theater",
                "headline": "Strategy becomes theater when execution is not governed.",
                "asset_anchor": [
                    "01_why_traditional_consulting_is_broken",
                    "32_when_a_transformation_program_needs_intervention_not_more_reporting",
                ],
            },
            {
                "snapshot_id": "roi_not_governable",
                "headline": "ROI claims decay when value review is not built into the operating rhythm.",
                "asset_anchor": [
                    "15_how_to_keep_transformation_roi_visible_after_kickoff",
                    "21_how_to_defend_transformation_investment_with_live_value_evidence",
                ],
            },
        ],
    },
    "IoT": {
        "primary_persona_entry": "Plant Manager / Operations",
        "section_order": ["Downtime And OEE", "Execution And Rollout", "AI And Decision Making"],
        "section_promises": {
            "Downtime And OEE": "Make operational losses visible early enough to change the shift.",
            "Execution And Rollout": "Show how pilots become plant-standard operating behavior without disruption.",
            "AI And Decision Making": "Show how machine signals become usable operational decisions, not just collected data.",
        },
        "decision_paths": [
            {"path_id": "see_visibility_gap", "label": "understand the visibility gap", "goal": "see where OEE and machine data are still misleading", "section_target": "Downtime And OEE", "cta": "see where visibility is failing"},
            {"path_id": "plan_pilot", "label": "plan a pilot", "goal": "understand rollout and first-value logic", "section_target": "Execution And Rollout", "cta": "plan a pilot"},
            {"path_id": "review_signal_logic", "label": "review signal logic", "goal": "see how data becomes action", "section_target": "AI And Decision Making", "cta": "review line-fit"},
        ],
        "cta_ladder": {
            "low_commitment": {"label": "see where visibility is failing", "intent": "explore", "target": "Downtime And OEE"},
            "mid_commitment": {"label": "plan a pilot", "intent": "pilot", "target": "Execution And Rollout"},
            "high_commitment": {"label": "review line-fit", "intent": "decision", "target": "Execution And Rollout"},
        },
        "bridges": {
            "Downtime And OEE": {"target_product": "IRIS", "target_section": "Execution And Rollout", "why_next": "Move from visibility into owned execution and closure."},
            "Execution And Rollout": {"target_product": "Consultify", "target_section": "Execution And Rollout", "why_next": "Install stronger rollout governance at leadership level."},
            "AI And Decision Making": {"target_product": "Vector", "target_section": "AI And Decision Making", "why_next": "Handle AI trust and secure industrial decision logic."},
        },
        "mva": {
            "flagship_awareness": "01_why_factories_still_dont_use_machine_data",
            "demo_trial_explainer": "21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory",
            "decision_stage": "15_how_to_build_a_business_case_for_iiot_in_a_brownfield_factory",
            "adoption_stage": "30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard",
            "nurture_stream": [
                "09_oee_is_not_enough",
                "24_how_to_improve_machine_data_quality_before_scaling_iot",
                "28_how_to_reduce_false_alarms_in_iiot_systems",
                "33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting",
                "45_what_an_executive_iot_scorecard_should_include_after_scale_up",
                "50_how_to_turn_iot_into_a_repeatable_operating_system_in_a_brownfield_factory",
            ],
        },
        "proof_snapshots": [
            {
                "snapshot_id": "measured_not_controllable",
                "headline": "Plants often look measurable long before they become controllable.",
                "asset_anchor": [
                    "01_why_factories_still_dont_use_machine_data",
                    "11_real_time_production_visibility_in_practice",
                ],
            },
            {
                "snapshot_id": "pilot_not_standard",
                "headline": "Pilot value disappears when signal logic and rollout discipline are not standardized.",
                "asset_anchor": [
                    "20_how_to_review_iiot_value_after_the_first_pilot",
                    "30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard",
                ],
            },
        ],
    },
    "IRIS": {
        "primary_persona_entry": "Plant Manager / COO",
        "section_order": ["AI And Decision Making", "Execution And Rollout", "Governance And ROI"],
        "section_promises": {
            "AI And Decision Making": "Show how recommendations, approvals, and execution boundaries become usable in plant operations.",
            "Execution And Rollout": "Show how insight becomes owned action, tasking, and operating closure.",
            "Governance And ROI": "Show how plant operating logic becomes governable, auditable, and economically defensible.",
        },
        "decision_paths": [
            {"path_id": "see_why_dashboards_fail", "label": "see why dashboards are not enough", "goal": "understand the execution-layer problem", "section_target": "AI And Decision Making", "cta": "see why dashboards are not enough"},
            {"path_id": "see_rollout_path", "label": "see implementation path", "goal": "learn how tasking and approvals are installed", "section_target": "Execution And Rollout", "cta": "start demo"},
            {"path_id": "review_architecture", "label": "review architecture", "goal": "understand governance and auditability", "section_target": "Governance And ROI", "cta": "review architecture"},
        ],
        "cta_ladder": {
            "low_commitment": {"label": "see why dashboards are not enough", "intent": "explore", "target": "AI And Decision Making"},
            "mid_commitment": {"label": "start demo", "intent": "demo", "target": "Execution And Rollout"},
            "high_commitment": {"label": "review architecture", "intent": "decision", "target": "Governance And ROI"},
        },
        "bridges": {
            "AI And Decision Making": {"target_product": "Vector", "target_section": "AI And Decision Making", "why_next": "Define secure AI boundaries around factory execution."},
            "Execution And Rollout": {"target_product": "IoT", "target_section": "Execution And Rollout", "why_next": "Use stronger machine visibility as the execution input layer."},
            "Governance And ROI": {"target_product": "Consultify", "target_section": "Governance And ROI", "why_next": "Rebuild leadership governance around execution control."},
        },
        "mva": {
            "flagship_awareness": "01_why_dashboards_dont_fix_factories",
            "demo_trial_explainer": "25_how_to_build_ai_assisted_factory_operations_step_by_step",
            "decision_stage": "39_what_a_human_approval_policy_should_look_like_in_factory_ai",
            "adoption_stage": "40_how_to_review_ai_assisted_operations_after_the_first_90_days",
            "nurture_stream": [
                "02_what_a_plant_operating_system_actually_means",
                "04_from_insight_to_task_to_action_closing_the_execution_loop",
                "20_why_ai_in_factory_operations_fails_without_one_execution_layer",
                "26_when_ai_should_recommend_and_when_humans_should_decide_in_operations",
                "46_how_to_create_audit_ready_records_for_ai_assisted_factory_decisions",
                "50_what_full_operational_closure_should_look_like_in_an_ai_native_factory",
            ],
        },
        "proof_snapshots": [
            {
                "snapshot_id": "dashboards_do_not_close_loops",
                "headline": "Factories lose time in the gap between visibility and owned response.",
                "asset_anchor": [
                    "01_why_dashboards_dont_fix_factories",
                    "04_from_insight_to_task_to_action_closing_the_execution_loop",
                ],
            },
            {
                "snapshot_id": "ai_needs_execution_layer",
                "headline": "AI without one execution layer produces drift, ambiguity, and weak accountability.",
                "asset_anchor": [
                    "20_why_ai_in_factory_operations_fails_without_one_execution_layer",
                    "36_when_ai_should_watch_advise_or_act_in_the_factory",
                ],
            },
        ],
    },
    "DT": {
        "primary_persona_entry": "CFO / Plant Manager",
        "section_order": ["Layout And Flow", "CAPEX And Investment", "Governance And ROI"],
        "section_promises": {
            "Layout And Flow": "Show where scenario comparison reduces operational change risk before execution.",
            "CAPEX And Investment": "Show how investment decisions become safer when scenarios are tested before commitment.",
            "Governance And ROI": "Show how simulation becomes part of executive decision discipline, not engineering theater.",
        },
        "decision_paths": [
            {"path_id": "see_where_guesswork_hurts", "label": "see where guesswork creates risk", "goal": "understand how layout and flow assumptions fail", "section_target": "Layout And Flow", "cta": "see where guesswork creates risk"},
            {"path_id": "compare_scenarios", "label": "compare options", "goal": "review scenario-based investment logic", "section_target": "CAPEX And Investment", "cta": "book demo"},
            {"path_id": "review_business_case", "label": "review business case", "goal": "defend the decision in board-level language", "section_target": "Governance And ROI", "cta": "review business case"},
        ],
        "cta_ladder": {
            "low_commitment": {"label": "see where guesswork creates risk", "intent": "explore", "target": "Layout And Flow"},
            "mid_commitment": {"label": "book demo", "intent": "demo", "target": "CAPEX And Investment"},
            "high_commitment": {"label": "review business case", "intent": "decision", "target": "Governance And ROI"},
        },
        "bridges": {
            "Layout And Flow": {"target_product": "IRIS", "target_section": "Execution And Rollout", "why_next": "Move from simulated improvement into governed operating execution."},
            "CAPEX And Investment": {"target_product": "Marketplace", "target_section": "CAPEX And Investment", "why_next": "Translate investment logic into supplier and offer selection."},
            "Governance And ROI": {"target_product": "Consultify", "target_section": "Governance And ROI", "why_next": "Install stronger transformation governance around scenario-based decisions."},
        },
        "mva": {
            "flagship_awareness": "01_digital_twin_not_3d_model_decision_engine",
            "demo_trial_explainer": "20_how_to_run_your_first_simulation_project",
            "decision_stage": "24_how_to_compare_capex_options_when_every_scenario_looks_plausible",
            "adoption_stage": "37_how_to_use_digital_twin_in_monthly_operations_reviews",
            "nurture_stream": [
                "10_the_cost_of_rework_when_you_skip_scenario_testing",
                "15_how_digital_twin_reduces_capex_risk",
                "27_what_a_good_simulation_input_set_looks_like_before_live_integration",
                "34_what_a_good_sensitivity_analysis_should_show_before_approval",
                "41_how_to_decide_when_a_simulation_is_good_enough_for_capital_commitment",
                "50_how_to_turn_digital_twin_into_a_repeatable_capex_decision_system",
            ],
        },
        "proof_snapshots": [
            {
                "snapshot_id": "capex_on_narrative",
                "headline": "Teams overpay when capital is approved on narrative confidence rather than scenario stress.",
                "asset_anchor": [
                    "01_digital_twin_not_3d_model_decision_engine",
                    "24_how_to_compare_capex_options_when_every_scenario_looks_plausible",
                ],
            },
            {
                "snapshot_id": "not_decision_grade",
                "headline": "Simulation is weak when it helps visualize but not compare disciplined options.",
                "asset_anchor": [
                    "27_what_a_good_simulation_input_set_looks_like_before_live_integration",
                    "34_what_a_good_sensitivity_analysis_should_show_before_approval",
                ],
            },
        ],
    },
    "Marketplace": {
        "primary_persona_entry": "Purchasing / Supplier / Integrator",
        "section_order": ["Automation And Sourcing", "CAPEX And Investment", "Execution And Rollout"],
        "section_promises": {
            "Automation And Sourcing": "Show how buying clarity starts with better briefs, comparability, and supplier logic.",
            "CAPEX And Investment": "Show how automation buying becomes financially defendable, not commercially fuzzy.",
            "Execution And Rollout": "Show what must happen after award so buying does not become post-award drift.",
        },
        "decision_paths": [
            {"path_id": "understand_sourcing_problem", "label": "understand the sourcing problem", "goal": "see where automation buying gets stuck before implementation", "section_target": "Automation And Sourcing", "cta": "understand the sourcing problem"},
            {"path_id": "scope_shortlist", "label": "compare options", "goal": "review investment and award logic", "section_target": "CAPEX And Investment", "cta": "describe your challenge"},
            {"path_id": "review_rollout", "label": "see implementation path", "goal": "understand handoff, mobilization, and acceptance", "section_target": "Execution And Rollout", "cta": "compare offers"},
        ],
        "cta_ladder": {
            "low_commitment": {"label": "understand the sourcing problem", "intent": "explore", "target": "Automation And Sourcing"},
            "mid_commitment": {"label": "describe your challenge", "intent": "challenge", "target": "Automation And Sourcing"},
            "high_commitment": {"label": "compare offers", "intent": "decision", "target": "CAPEX And Investment"},
        },
        "bridges": {
            "Automation And Sourcing": {"target_product": "DT", "target_section": "CAPEX And Investment", "why_next": "Use scenario testing when sourcing depends on layout or capex assumptions."},
            "CAPEX And Investment": {"target_product": "Consultify", "target_section": "Governance And ROI", "why_next": "Strengthen executive governance around the buying decision."},
            "Execution And Rollout": {"target_product": "IRIS", "target_section": "Execution And Rollout", "why_next": "Connect supplier delivery to operating control after go-live."},
        },
        "mva": {
            "flagship_awareness": "01_why_most_automation_projects_never_start",
            "demo_trial_explainer": "14_how_to_write_a_better_automation_challenge_brief",
            "decision_stage": "44_what_a_board_ready_automation_decision_packet_should_include",
            "adoption_stage": "48_what_a_good_manufacturer_side_mobilization_plan_should_include_after_award",
            "nurture_stream": [
                "15_what_to_include_in_an_automation_rfq_or_rfp",
                "23_how_to_check_automation_supplier_references_without_wasting_time",
                "26_how_to_compare_automation_commercial_models_not_just_prices",
                "36_how_to_set_acceptance_criteria_before_automation_delivery_begins",
                "49_how_to_review_automation_project_risk_between_contract_award_and_go_live",
                "50_how_to_turn_automation_buying_into_a_repeatable_decision_system",
            ],
        },
        "proof_snapshots": [
            {
                "snapshot_id": "buying_unstructured",
                "headline": "Automation buying looks active long after the decision process has already stalled.",
                "asset_anchor": [
                    "01_why_most_automation_projects_never_start",
                    "14_how_to_write_a_better_automation_challenge_brief",
                ],
            },
            {
                "snapshot_id": "clarification_breaks_comparability",
                "headline": "Offer comparison collapses when the brief is weak and clarifications drift vendor by vendor.",
                "asset_anchor": [
                    "46_how_to_keep_supplier_clarifications_from_destroying_offer_comparability",
                    "26_how_to_compare_automation_commercial_models_not_just_prices",
                ],
            },
        ],
    },
    "Vector": {
        "primary_persona_entry": "CTO / COO",
        "section_order": ["AI And Decision Making", "Governance And ROI", "Execution And Rollout"],
        "section_promises": {
            "AI And Decision Making": "Show where public AI, generic models, and weak boundaries create real industrial risk.",
            "Governance And ROI": "Show how security, auditability, and deployment cost become decision-grade issues.",
            "Execution And Rollout": "Show how secure industrial AI becomes deployable, governable operating capability.",
        },
        "decision_paths": [
            {"path_id": "review_ai_risk", "label": "review AI risk", "goal": "understand perimeter and model-risk logic", "section_target": "AI And Decision Making", "cta": "review AI risk"},
            {"path_id": "review_architecture", "label": "review architecture", "goal": "understand governance and review logic", "section_target": "Governance And ROI", "cta": "start demo"},
            {"path_id": "scope_pilot", "label": "see implementation path", "goal": "see what deployment-ready industrial AI requires", "section_target": "Execution And Rollout", "cta": "review security"},
        ],
        "cta_ladder": {
            "low_commitment": {"label": "review AI risk", "intent": "explore", "target": "AI And Decision Making"},
            "mid_commitment": {"label": "start demo", "intent": "demo", "target": "Execution And Rollout"},
            "high_commitment": {"label": "review security", "intent": "decision", "target": "Governance And ROI"},
        },
        "bridges": {
            "AI And Decision Making": {"target_product": "IRIS", "target_section": "AI And Decision Making", "why_next": "Put AI logic inside governed plant workflows."},
            "Governance And ROI": {"target_product": "Consultify", "target_section": "Governance And ROI", "why_next": "Defend governance and investment logic at leadership level."},
            "Execution And Rollout": {"target_product": "IoT", "target_section": "AI And Decision Making", "why_next": "Use live plant signals as secure industrial AI inputs."},
        },
        "mva": {
            "flagship_awareness": "01_why_public_ai_is_a_security_risk_for_industrial_operations",
            "demo_trial_explainer": "22_how_to_run_a_security_review_of_an_industrial_ai_vendor",
            "decision_stage": "18_the_enterprise_checklist_for_secure_ai_in_manufacturing",
            "adoption_stage": "49_how_to_review_industrial_ai_risk_after_the_first_90_days",
            "nurture_stream": [
                "07_what_private_ai_really_means_in_a_manufacturing_environment",
                "12_can_you_audit_your_ai_why_traceability_matters_in_industrial_decisions",
                "25_how_to_compare_industrial_ai_training_policies_without_marketing_fog",
                "33_what_a_private_ai_architecture_review_should_decide_before_rollout",
                "45_what_a_secure_ai_change_control_process_should_include",
                "50_how_to_build_a_manufacturing_ai_governance_system_that_survives_scale",
            ],
        },
        "proof_snapshots": [
            {
                "snapshot_id": "public_ai_perimeter_failure",
                "headline": "Public AI becomes an industrial risk when convenience bypasses perimeter control.",
                "asset_anchor": [
                    "01_why_public_ai_is_a_security_risk_for_industrial_operations",
                    "06_the_hidden_risk_of_uploading_layouts_costs_and_process_know_how_to_public_ai",
                ],
            },
            {
                "snapshot_id": "security_review_too_vague",
                "headline": "Security claims stay weak when buyers cannot inspect boundaries, logging, and training policy.",
                "asset_anchor": [
                    "22_how_to_run_a_security_review_of_an_industrial_ai_vendor",
                    "18_the_enterprise_checklist_for_secure_ai_in_manufacturing",
                ],
            },
        ],
    },
}


@dataclass
class ProductRows:
    product: str
    rows: list[dict[str, str]]


def load_catalog() -> dict[str, ProductRows]:
    products: dict[str, list[dict[str, str]]] = {name: [] for name in PRODUCT_CONFIG}
    with CATALOG_PATH.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            product = row["product"]
            if product in products:
                products[product].append(row)
    return {k: ProductRows(k, v) for k, v in products.items()}


def parse_attachment_clusters(product: str) -> dict[str, dict[str, list[str]]]:
    path = ROOT / product / "Blog" / "00_LP_ATTACHMENT_CHECK_01_50.md"
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    result: dict[str, dict[str, list[str]]] = {}
    current_section = None
    mode = None

    for raw in lines:
        line = raw.strip()
        if line.startswith("### "):
            current_section = line.replace("### ", "", 1).strip()
            result.setdefault(current_section, {"featured": [], "deeper": []})
            mode = None
            continue
        if current_section is None:
            continue
        if line == "Featured cluster:":
            mode = "featured"
            continue
        if line == "Deeper library candidates:":
            mode = "deeper"
            continue
        if mode and line.startswith("- "):
            slug = line.replace("- ", "", 1).strip().strip("`")
            if slug:
                result[current_section][mode].append(slug)
            continue
        if line.startswith("## ") and "Article Attachment Map" in line:
            break
        if line == "":
            continue

    return result


def normalize_stage(stage: str) -> str:
    mapping = {
        "Awareness": "Awareness",
        "Decision": "Decision",
        "Adoption": "Adoption",
        "Demo/Trial/Pilot Entry": "Demo/Trial/Pilot Entry",
        "Nurture": "Nurture",
    }
    if stage in mapping:
        return mapping[stage]
    lower = stage.lower()
    if "aware" in lower:
        return "Awareness"
    if "decision" in lower:
        return "Decision"
    if "adoption" in lower or "implement" in lower:
        return "Adoption"
    if "demo" in lower or "trial" in lower or "pilot" in lower:
        return "Demo/Trial/Pilot Entry"
    return stage


def canonical_id(product: str, slug: str) -> str:
    return f"{product}::{slug}"


def section_id(product: str, label: str) -> str:
    return f"{product}::{label.lower().replace(' ', '_')}"


def summarize_line(row: dict[str, str]) -> str:
    return row["problem"] or row["promise"] or row["title"]


def build_articles(product: str, rows: list[dict[str, str]], featured_lookup: set[str], mva: dict[str, object]) -> list[dict[str, object]]:
    role_lookup: dict[str, str] = {}
    config = PRODUCT_CONFIG[product]
    for key, value in mva.items():
        if isinstance(value, list):
            for slug in value:
                role_lookup[slug] = key
        elif isinstance(value, str):
            role_lookup[value] = key

    articles = []
    for row in sorted(rows, key=lambda r: r["slug"]):
        slug = row["slug"]
        articles.append(
            {
                "canonical_id": canonical_id(product, slug),
                "slug": slug,
                "title": row["title"],
                "summary_line": summarize_line(row),
                "product": product,
                "target_persona": row["persona"],
                "funnel_stage": normalize_stage(row["stage"]),
                "core_problem": row["problem"],
                "main_promise": row["promise"],
                "lp_section": row["lp_section"],
                "knowledge_layer": row["knowledge_layer"],
                "secondary_bridge": row["bridge"] or "",
                "bridge_product": config["bridges"].get(row["lp_section"], {}).get("target_product", ""),
                "bridge_section": config["bridges"].get(row["lp_section"], {}).get("target_section", ""),
                "primary_keyword": row["primary_keyword"],
                "featured": slug in featured_lookup,
                "mva_role": role_lookup.get(slug, ""),
                "locales": {
                    "EN": {"path": f"{slug}/article_EN.md", "title": row["title"]},
                    "PL": {"path": f"{slug}/article_PL.md"},
                    "DE": {"path": f"{slug}/article_DE.md"},
                },
            }
        )
    return articles


def build_sections(product: str, clusters: dict[str, dict[str, list[str]]]) -> list[dict[str, object]]:
    config = PRODUCT_CONFIG[product]
    sections = []
    for label in config["section_order"]:
        featured = clusters.get(label, {}).get("featured", [])
        deeper = clusters.get(label, {}).get("deeper", [])
        sections.append(
            {
                "section_id": section_id(product, label),
                "label": label,
                "promise": config["section_promises"][label],
                "intro": config["section_promises"][label],
                "featured_slugs": featured,
                "deeper_slugs": deeper,
                "section_cta": config["bridges"][label]["why_next"],
            }
        )
    return sections


def build_knowledge_base_manifest(product: str, rows: list[dict[str, str]], clusters: dict[str, dict[str, list[str]]]) -> dict[str, object]:
    config = PRODUCT_CONFIG[product]
    featured_lookup = {slug for sec in clusters.values() for slug in sec.get("featured", [])}
    sections = build_sections(product, clusters)
    articles = build_articles(product, rows, featured_lookup, config["mva"])

    return {
        "schema_version": "1.0.0",
        "product": product,
        "source_root": f"Blogs/{product}/Blog",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "primary_persona_entry": config["primary_persona_entry"],
        "sections": sections,
        "articles": articles,
        "cta_ladder": config["cta_ladder"],
        "cross_product_bridges": config["bridges"],
    }


def build_renderer_manifest(product: str, kb_manifest: dict[str, object]) -> dict[str, object]:
    config = PRODUCT_CONFIG[product]
    hero_title = kb_manifest["articles"][0]["title"] if kb_manifest["articles"] else ""
    return {
        "product": product,
        "entry_module": {
            "hero_value_proposition": hero_title,
            "problem_reality_block": f"{product} should open from repeated industrial reality, not generic software positioning.",
            "primary_persona_bridge": config["primary_persona_entry"],
            "primary_cta": config["cta_ladder"]["low_commitment"]["label"],
        },
        "decision_paths": config["decision_paths"],
        "knowledge_sections": [
            {
                "section_id": section_id(product, sec["label"]),
                "label": sec["label"],
                "featured_cluster": sec["featured_slugs"],
                "deeper_library": sec["deeper_slugs"],
                "proof_module_ref": sec["label"],
                "cta_module_ref": sec["label"],
            }
            for sec in kb_manifest["sections"]
        ],
        "proof_modules": config["proof_snapshots"],
        "cta_modules": config["cta_ladder"],
        "bridge_module": config["bridges"],
    }


def choose_target_slug(target_product: str, target_section: str, kb_manifests: dict[str, dict[str, object]]) -> str:
    target_sections = kb_manifests[target_product]["sections"]
    for section in target_sections:
        if section["label"] == target_section and section["featured_slugs"]:
            return section["featured_slugs"][0]
    for section in target_sections:
        if section["featured_slugs"]:
            return section["featured_slugs"][0]
    return ""


def build_relation_manifest(product: str, kb_manifests: dict[str, dict[str, object]]) -> dict[str, object]:
    kb = kb_manifests[product]
    articles = kb["articles"]
    same_lp_edges = []
    cross_edges = []
    featured_edges = []
    mva_edges = []

    by_section: dict[str, list[dict[str, object]]] = {}
    by_slug: dict[str, dict[str, object]] = {a["slug"]: a for a in articles}
    for article in articles:
        by_section.setdefault(article["lp_section"], []).append(article)

    for section, section_articles in by_section.items():
        section_articles = sorted(section_articles, key=lambda a: a["slug"])
        for article in section_articles:
            related = [
                other for other in section_articles
                if other["slug"] != article["slug"]
            ][:5]
            for other in related:
                same_lp_edges.append(
                    {
                        "from_slug": article["slug"],
                        "to_slug": other["slug"],
                        "edge_type": "same_section",
                        "reason": f"same lp_section: {section}",
                        "weight": 100,
                    }
                )

    for section in kb["sections"]:
        featured = section["featured_slugs"]
        deeper = section["deeper_slugs"]
        for fslug in featured:
            for dslug in deeper[:4]:
                featured_edges.append(
                    {
                        "from_slug": fslug,
                        "to_slug": dslug,
                        "edge_type": "featured_cluster",
                        "reason": f"featured to deeper within {section['label']}",
                        "weight": 85,
                    }
                )

    for article in articles:
        target_product = article.get("bridge_product")
        target_section = article.get("bridge_section")
        if target_product and target_product in kb_manifests:
            target_slug = choose_target_slug(target_product, target_section, kb_manifests)
            if target_slug:
                cross_edges.append(
                    {
                        "from_slug": article["slug"],
                        "to_slug": target_slug,
                        "edge_type": "bridge_next_product",
                        "reason": f"bridge to {target_product} / {target_section}",
                        "weight": 80,
                    }
                )

    mva = PRODUCT_CONFIG[product]["mva"]
    path = [
        mva["flagship_awareness"],
        mva["demo_trial_explainer"],
        mva["decision_stage"],
        mva["adoption_stage"],
    ]
    for src, dst in zip(path, path[1:]):
        if src in by_slug and dst in by_slug:
            mva_edges.append(
                {
                    "from_slug": src,
                    "to_slug": dst,
                    "edge_type": "mva_path",
                    "reason": "minimum viable asset path",
                    "weight": 95,
                }
            )

    return {
        "product": product,
        "same_lp_edges": same_lp_edges,
        "cross_product_edges": cross_edges,
        "featured_edges": featured_edges,
        "mva_edges": mva_edges,
    }


def build_qa_manifest(product: str, kb_manifest: dict[str, object], relation_manifest: dict[str, object]) -> dict[str, object]:
    warnings = []
    errors = []
    article_count_actual = len(kb_manifest["articles"])
    section_count = len(kb_manifest["sections"])
    featured_article_count = sum(len(sec["featured_slugs"]) for sec in kb_manifest["sections"])
    bridge_count = len(relation_manifest["cross_product_edges"])

    if article_count_actual != 50:
        errors.append({"code": "article_count_mismatch", "scope": product, "message": f"Expected 50 articles, got {article_count_actual}."})
    if section_count < 3:
        errors.append({"code": "section_count_too_low", "scope": product, "message": f"Expected at least 3 sections, got {section_count}."})
    if featured_article_count < 9:
        warnings.append({"code": "featured_count_low", "scope": product, "message": f"Featured article count looks low: {featured_article_count}."})
    if bridge_count < 1:
        warnings.append({"code": "bridge_count_low", "scope": product, "message": "No cross-product bridge edges generated."})

    return {
        "product": product,
        "article_count_expected": 50,
        "article_count_actual": article_count_actual,
        "locale_complete_count": article_count_actual,
        "section_count": section_count,
        "featured_article_count": featured_article_count,
        "bridge_count": bridge_count,
        "warnings": warnings,
        "errors": errors,
    }


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def build_product(product: str, rows: list[dict[str, str]], kb_manifests: dict[str, dict[str, object]]) -> None:
    out = OUTPUT_ROOT / product
    out.mkdir(parents=True, exist_ok=True)
    kb = kb_manifests[product]
    renderer = build_renderer_manifest(product, kb)
    relations = build_relation_manifest(product, kb_manifests)
    qa = build_qa_manifest(product, kb, relations)
    write_json(out / "knowledge_base_manifest.json", kb)
    write_json(out / "renderer_manifest.json", renderer)
    write_json(out / "relation_manifest.json", relations)
    write_json(out / "qa_manifest.json", qa)


def main() -> None:
    if OUTPUT_ROOT.exists():
        for child in OUTPUT_ROOT.iterdir():
            if child.is_dir():
                for sub in child.iterdir():
                    sub.unlink()
                child.rmdir()
            else:
                child.unlink()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    product_rows = load_catalog()
    kb_manifests: dict[str, dict[str, object]] = {}

    for product, rows in product_rows.items():
        clusters = parse_attachment_clusters(product)
        kb_manifests[product] = build_knowledge_base_manifest(product, rows.rows, clusters)

    for product, rows in product_rows.items():
        build_product(product, rows.rows, kb_manifests)

    readme = OUTPUT_ROOT / "README.md"
    readme.write_text(
        "\n".join(
            [
                "# DBR77 LP KB Ready",
                "",
                "This directory contains generated manifests for LP repository programs.",
                "",
                "Per product:",
                "- `knowledge_base_manifest.json`",
                "- `renderer_manifest.json`",
                "- `relation_manifest.json`",
                "- `qa_manifest.json`",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()

