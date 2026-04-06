# DBR77 Image Prompts Audit

## Purpose

This file is the working audit for the current DBR77 image prompt library.

Use it together with:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPT_TEMPLATE.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPTS_INVENTORY.csv`

## Audit Scope

The audit covers all prompt files currently present under `Blogs/`.

Audited file count:

- total `image-prompts.md` files: `327`
- product `Blog/` tree files: `317`
- archive files: `7`
- extra DBR77 `Pages/` and `Personas/` prompt files: `10`

## Audit Method

The audit combines:

1. structural parsing across all `327` files
2. pattern classification by product
3. representative manual review across the main prompt families

The inventory source is:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPTS_INVENTORY.csv`

## Quality Rubric

Each prompt family was evaluated against six practical checks:

1. role completeness: `Hero`, `Analytical`, `Social`
2. thesis clarity: does the prompt express an argument, not only a topic
3. operational realism: credible plant, executive, or procurement context
4. generation guardrails: `negative prompts` or `avoid`
5. reuse readiness: clear channel intent and crop logic
6. production readiness: explicit aspect ratio or framing guidance

Working band logic:

- `A`: structurally strong and generation-ready
- `B`: good base, but needs normalization
- `C`: usable after prompt upgrade
- `D`: should be rewritten before scale generation

## Global Findings

### Overall Structure

| Metric | Count |
|---|---:|
| All `image-prompts.md` files | 327 |
| Files with `Hero` heading | 327 |
| Files with `Social` heading | 327 |
| Files using numbered `1/2/3` format | 0 |
| Files with an `objective` field or label | 327 |
| Files with explicit `negative prompt` label | 209 |
| Files with `avoid` guardrail language | 167 |
| Files with explicit aspect ratio or framing signal | 327 |

### Main Strengths

- The system already understands the three-role model well.
- Most products use article-linked, decision-oriented imagery rather than generic tech art.
- `Marketplace`, `DT`, `IRIS`, `Vector`, and much of `Consultify` already use useful guardrail language.
- The better prompts already match the DBR77 tone: calm, practical, high-trust, industrial.

### Main Risks

- `IoT` has severe format drift and is the biggest structural risk area.
- `Consultify`, `DT`, `IRIS`, and `Vector` have meaningful bands with no `Social` prompt.
- `Marketplace` is highly consistent, but still lacks explicit aspect ratio language in the current format.
- `DBR77` prompts are strategically strong but use a different `Objective` plus `Prompt` style, which makes automation less uniform.
- Guardrail language is inconsistent across the library: `negative prompt`, `negative prompts`, `avoid`, or inline prohibition language.

## Product Audit Summary

| Product | Files | Triptych complete | Missing `Social` | Numbered `1/2/3` | Guardrails present | Explicit aspect/framing | Main audit signal |
|---|---:|---:|---:|---:|---:|---:|---|
| `Consultify` | 50 | 50 | 0 | 0 | 50 | 50 | Product line now fully normalized |
| `IoT` | 50 | 50 | 0 | 0 | 50 | 50 | Fully normalized after rewrite wave |
| `IRIS` | 50 | 50 | 0 | 0 | 50 | 50 | Product line now fully normalized |
| `DT` | 50 | 50 | 0 | 0 | 50 | 50 | Product line now fully normalized |
| `Marketplace` | 57 | 57 | 0 | 0 | 57 | 57 | Fully normalized including archived files |
| `Vector` | 50 | 50 | 0 | 0 | 50 | 50 | Product line now fully normalized |
| `DBR77` | 20 | 20 | 0 | 0 | 20 inline only | 19 framing only | Strong strategy prompts, but non-standard format |

## Product Findings

### `IoT`

Status:

- normalized and now generation-ready

Why:

- `50/50` files are now full `Hero + Analytical + Social`
- `0/50` use numbered prompts
- `0/50` are missing `Social`
- `50/50` now carry explicit aspect ratio and reusable constraints

Representative files:

- strong early format: `Blogs/IoT/Blog/01_why_factories_still_dont_use_machine_data/image-prompts.md`
- normalized rollout case: `Blogs/IoT/Blog/22_when_to_integrate_iiot_with_mes_erp_and_cmms_and_when_to_wait/image-prompts.md`
- normalized standardization case: `Blogs/IoT/Blog/30_how_to_go_from_one_successful_iot_pilot_to_a_plant_standard/image-prompts.md`

Audit conclusion:

- `IoT` no longer blocks scale generation and can now be used as an active product line in the queue.

### `Consultify`

Status:

- fully normalized for active generation

Why:

- all `50` files now carry full triptych coverage
- all `50` files now include reusable social coverage
- all active files now carry explicit constraints and aspect ratio

Representative files:

- good operating contrast: `Blogs/Consultify/Blog/14_why_strategy_workshops_fail_without_execution_system/image-prompts.md`
- strong decision-review framing: `Blogs/Consultify/Blog/22_what_monthly_transformation_reviews_should_actually_decide/image-prompts.md`

Audit conclusion:

- `Consultify` is ready for active generation batches.

### `IRIS`

Status:

- high-quality analytical system, now normalized for active generation

Why:

- `50/50` files are complete triptychs
- explicit constraints and aspect ratio now exist across the active product line
- strong `objective`, `avoid`, and diagram logic remain intact

Representative files:

- strong framework style: `Blogs/IRIS/Blog/20_why_ai_in_factory_operations_fails_without_one_execution_layer/image-prompts.md`
- strong social-safe pattern: `Blogs/IRIS/Blog/34_the_rise_of_decision_automation_in_manufacturing/image-prompts.md`

Audit conclusion:

- `IRIS` is ready for active generation batches.

### `DT`

Status:

- one of the best foundations in the library, now normalized for active generation

Why:

- strong use of comparison, scenario, and decision logic
- `50/50` complete triptychs
- explicit constraints and aspect ratio now exist across the active product line
- strong use of negatives and framing cues remains intact

Representative files:

- high-trust decision framing: `Blogs/DT/Blog/12_simulation_vs_reality_why_your_factory_planning_is_still_wrong/image-prompts.md`
- strong three-role structure: `Blogs/DT/Blog/04_why_most_digital_twins_fail/image-prompts.md`

Audit conclusion:

- `DT` should be treated as a reference product for analytical-image quality and active generation.

### `Marketplace`

Status:

- most consistent product line

Why:

- all `57` files are complete triptychs
- all include explicit negative prompts
- all now include explicit output constraints and aspect ratio
- archive files no longer diverge from the active standard

Representative files:

- solid procurement brief pattern: `Blogs/Marketplace/Blog/14_how_to_write_a_better_automation_challenge_brief/image-prompts.md`
- strong shortlist logic: `Blogs/Marketplace/Blog/24_when_to_use_a_shortlist_and_when_to_keep_more_suppliers_in_play/image-prompts.md`

Important note:

- `7` files sit under `Blogs/Marketplace/Blog/_archive_marketplace_43_49_pre_collision_packages/` and should not be treated as active generation targets.

Audit conclusion:

- `Marketplace` is fully normalized and can act as a reference line for structured procurement visuals.

### `Vector`

Status:

- strategically mature and now fully normalized for active generation

Why:

- `50/50` complete triptychs
- explicit constraints and aspect ratio now exist across the active product line
- governance and risk-control language remains strong

Representative files:

- strong security split logic: `Blogs/Vector/Blog/01_why_public_ai_is_a_security_risk_for_industrial_operations/image-prompts.md`
- strong technical editorial style: `Blogs/Vector/Blog/29_what_a_cto_should_ask_before_connecting_ai_to_factory_systems/image-prompts.md`
- good procurement-governance bridge: `Blogs/Vector/Blog/35_how_to_write_non_negotiable_ai_requirements_into_enterprise_procurement/image-prompts.md`

Audit conclusion:

- `Vector` is ready for active generation batches.

### `DBR77`

Status:

- strategically strong and now normalized to the operational contract

Why:

- all `20` files are complete triptychs
- `Objective + Prompt` structure remains, but now also includes explicit guardrails, constraints, and aspect ratio
- the bucket now aligns with the same generation contract as the product lines

Representative file:

- `Blogs/DBR77/Blog/01_why_most_factories_still_run_on_guesswork/image-prompts.md`

Audit conclusion:

- `DBR77` is now generation-ready while preserving its strategic editorial structure.

## Quality Bands By Product

| Product | `A` | `B` | `C` | `D` | Interpretation |
|---|---:|---:|---:|---:|---|
| `Consultify` | 50 | 0 | 0 | 0 | fully normalized and ready |
| `IoT` | 50 | 0 | 0 | 0 | fully normalized and ready |
| `IRIS` | 50 | 0 | 0 | 0 | fully normalized and ready |
| `DT` | 50 | 0 | 0 | 0 | fully normalized and ready |
| `Marketplace` | 57 | 0 | 0 | 0 | fully normalized and ready |
| `Vector` | 50 | 0 | 0 | 0 | fully normalized and ready |
| `DBR77` | 20 | 0 | 0 | 0 | fully normalized and ready |

## Audit Decision

Treat the library as three different work types:

### Type 1: Already Recovered

- `IoT` numbered and low-guardrail files were normalized into the shared contract

### Type 2: Monitoring And Tuning

- no normalization blocker remains
- future work is now generation quality review, not structural repair

## Immediate Implications

1. Do not start large-batch Antygravity generation from raw `IoT` prompts.
2. Use any of the six product lines plus `DBR77` as reference-quality prompt libraries.
3. Treat the next phase as image-generation review and asset QA, not prompt-library repair.
4. Use the queue and workflow to control production batches rather than revisiting prompt structure again.
