# IoT Audit And Update Plan 01-12

Status: English base-library retrofit complete for the priority scope defined in this file (March `2026`). Priority article rewrites are in place, historical production-note markers are absent from English `01-12`, and package `01` is normalized to the standard package shape including `publish.md`. Further proof polish on selected keep articles remains optional.  
Strategy source of truth: `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md`  
Tracker source of truth: `Blogs/_SYSTEM/strategy/MASTER_COMPLETION_PLAN.md`

## Purpose

This file translates the new DBR77 product marketing standard into a practical update plan for the first `12` IoT articles.

Use it to decide:

- which articles are already strong
- which articles need a light rewrite
- which articles need a heavier rewrite
- which recurring package issues must be fixed before publishing

## Audit Rubric

Score every article against these dimensions:

1. `Knowledge-layer fit`
- does the article clearly serve one of the `5` layers
- does it strengthen the IoT positioning instead of drifting into generic education

2. `Trust and proof`
- does it use field-pattern language, honest number anchors, trade-offs, or implementation warnings
- does it avoid inflated or weakly supported claims

3. `Article arc`
- does it follow the desired structure:
  - real problem
  - what actually happens
  - common mistake or reality check
  - what works
  - how DBR77 approaches it
  - outcome logic

4. `Operational specificity`
- does it sound close to production, maintenance, operators, and real-time decision loops

5. `Maturity and tone`
- does it sound experienced, calm, specific, and non-startup

6. `System fit`
- does it fit product, persona, funnel stage, and LP attachment logic

## Article Classification

| Article | Strongest layer fit | Classification | Why | Key update action |
|---|---|---|---|---|
| `01_why_factories_still_dont_use_machine_data` | Field Reality | light rewrite | strong positioning and brownfield logic, but the `80%` claim needs stronger support or softer framing | qualify or soften the headline stat and add stronger proof-style anchors |
| `02_what_data_should_you_collect_from_machines` | Solution Logic | keep | strong process clarity and good decision-first framing | optional proof enrichment only |
| `03_from_sensors_to_decisions` | Solution Logic | keep | strong end-to-end logic and clear operational loop | add one failure-mode or trade-off block only |
| `04_machine_data_is_useless_without_context` | Problem Deep Dive | keep | strong recurring insight and good context framing | add one role-specific consequence and keep distinct from `02` and `03` |
| `05_edge_vs_cloud_in_manufacturing` | Decision Support | light rewrite | strong architecture topic, but can be calmer and more decision-safe | remove trendy year framing and add stronger risk or financial logic |
| `06_how_to_start_iiot_without_breaking_production` | Execution And Transformation | keep | one of the clearest execution-layer articles in the library | add optional `30/90 day` milestone logic |
| `07_how_to_reduce_downtime_by_30_using_real_time_data` | Problem Deep Dive | heavy rewrite | biggest trust risk because the outcome claim can read as inflated without stronger evidence | retitle or qualify the claim and rebuild around response-loop logic |
| `08_the_hidden_costs_of_not_measuring_production_properly` | Decision Support | light rewrite | strong CFO and ROI bridge, but still abstract | add illustrative cost logic and stronger business-case framing |
| `09_oee_is_not_enough` | Problem Deep Dive | keep | very strong fit with the new system and repeatable insight logic | coordinate positioning so it does not overlap too much with context-driven articles |
| `10_why_your_maintenance_strategy_is_failing` | Problem Deep Dive | keep | strong maintenance-loop framing and operational logic | add optional CMMS or integration boundary note |
| `11_real_time_production_visibility_in_practice` | Solution Logic | keep | strong explanation of what good visibility actually looks like by role | add one implementation warning about noisy or role-wrong visibility |
| `12_5_operational_problems_every_factory_has` | Field Reality | light rewrite | strong synthesis article, but should feel more like accumulated practice than summary content | upgrade it into a stronger pillar with sharper recurring-pattern language and clearer cross-links |

## Top Priority Update Articles

Completed in the delivered base retrofit wave:

1. `07_how_to_reduce_downtime_by_30_using_real_time_data`
2. `01_why_factories_still_underuse_their_machine_data` (folder slug unchanged)
3. `12_5_operational_problems_every_factory_has`
4. `05_edge_vs_cloud_in_manufacturing`
5. `08_the_hidden_costs_of_not_measuring_production_properly`

## Package Readiness Issues

Cross-package issues identified in the existing IoT base library at audit time, with current status:

1. historical production-note markers are **no longer present** in English `01-12` article bodies
2. package `01_why_factories_still_dont_use_machine_data` now includes `publish.md`
3. package `01` now uses normalized `seo.md` and `image-prompts.md` structure aligned with the rest of the library
4. CTA intent consistency between `cta.md` and `publish.md` should be treated as optional publication-packaging QA, not as a body blocker

## Update Sequence For IoT 01-12

1. `[x]` remove or convert legacy body-instruction markers into true publish-ready logic
2. `[x]` normalize package `01` so it matches the standard package structure
3. `[x]` rewrite the top `5` priority articles
4. `[ ]` optional light quality pass on the `keep` articles so all `01-12` assets use the same proof-bearing standard
5. `[x]` use the audit to guide `13-22` so the next batch fills the weakest content layers first

## Layer Guidance For The Next Batch

The next IoT expansion wave should strengthen the weaker layers in the current library:

- Decision Support
- Execution And Transformation

This means `13-22` should lean harder into:

- ROI
- pilot economics
- architecture and deployment choices
- governance
- first `30` days
- first `90` days
- escalation logic
- value review

## Done Standard For IoT Base Retrofit

Treat the `01-12` update wave as complete for the delivered priority scope when:

- all historical production-note lines are removed from English article bodies
- package `01` matches the standard package shape
- the top priority rewrite articles are updated
- every `01-12` article has a clear layer fit
- the base library reads as one coherent knowledge system instead of a set of separate blog posts

Current status:

- `[x]` historical production-note lines removed from English `01-12`
- `[x]` package `01` normalized to the standard package shape
- `[x]` top-priority rewrite articles updated
- `[x]` every `01-12` article retains a clear layer fit
- `[x]` base English library is coherent enough to treat the priority retrofit wave as complete
