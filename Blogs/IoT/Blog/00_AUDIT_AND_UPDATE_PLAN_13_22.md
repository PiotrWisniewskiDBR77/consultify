# IoT Audit And Update Plan 13-22

Status: IoT English articles `13` through `22` retrofit complete (March `2026`): DBR77 bridge sections lever-keyed, timeline cluster cross-links added, optional pointer from `13` to `06` added. This file remains the rubric and classification record for the tranche.  
Strategy source of truth: `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md`  
Tracker source of truth: `Blogs/_SYSTEM/strategy/MASTER_COMPLETION_PLAN.md`

## Purpose

This file records a detailed article-level audit for the second English tranche of the IoT library. It uses the same rubric family as `Blogs/IoT/Blog/00_AUDIT_AND_UPDATE_PLAN_01_12.md` and the calm, industrial, proof-bearing standard described there.

Use it to decide:

- which articles are already strong as bodies
- which articles need only packaging or bridge edits
- which tranche-wide patterns should be fixed in one batch
- how this band relates to IoT `01-12` and later bands

## Audit Rubric

Score every article against these dimensions:

1. `Knowledge-layer fit`
- does the article clearly serve one of the `5` layers
- does it strengthen IoT positioning instead of drifting into generic education

2. `Trust and proof`
- does it use field-pattern language, honest anchors, trade-offs, or implementation warnings
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
| `13_7_mistakes_companies_make_when_implementing_iot` | Execution And Transformation | keep | strong mistake taxonomy tied to operating loops, integration sequencing, and reporting vs control; aligns with brownfield reality | done: lever-keyed DBR77 bridge; optional cross-link to `06_how_to_start_iiot_without_breaking_production` in body |
| `14_from_pilot_to_scale_how_to_roll_out_iiot_without_losing_control` | Execution And Transformation | keep | clear scale risk story, operating similarity rule, and standardization-before-scale logic | done: lever-keyed DBR77 bridge (rollout governance); cross-links to `21`, `16`, `20` |
| `15_how_to_build_a_business_case_for_iiot_in_a_brownfield_factory` | Decision Support | keep | credible CFO and operations bridge, narrow-proof-first structure, brownfield honesty | done: lever-keyed DBR77 bridge (staged finance proof) |
| `16_what_to_measure_in_the_first_90_days_of_iiot_rollout` | Execution And Transformation | keep | five measurement groups map cleanly to signal, context, response, recurrence, review; explicit anti-overclaim stance | done: lever-keyed DBR77 bridge; cross-links to `21` and `20` |
| `17_how_to_choose_the_right_first_iiot_use_case` | Decision Support | keep | controllability-over-importance frame and three filters (loss, control, review) are decision-grade | done: lever-keyed DBR77 bridge (controllable scope) |
| `18_who_should_own_iiot_rollout_inside_the_factory` | Execution And Transformation | keep | sharp IT-participates-but-does-not-own-ops-case distinction; committee vs accountability reality check | done: lever-keyed DBR77 bridge (ownership chain) |
| `19_why_iiot_alerts_fail_on_the_shop_floor_and_what_works_instead` | Problem Deep Dive | keep | high operational specificity on alert logic, ownership, escalation inflation, and context over UI noise | done: lever-keyed DBR77 bridge (alert and escalation design) |
| `20_how_to_review_iiot_value_after_the_first_pilot` | Decision Support | keep | strong anti-ROI-theater framing, five review questions, three exit decisions, explicit staged proof | done: lever-keyed DBR77 bridge; cross-links to `21`, `16`, `14` |
| `21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory` | Execution And Transformation | keep | reference-grade time-boxed arc (weeks `1`-`4`), brownfield risk setup, leadership watch list | done: lever-keyed DBR77 bridge; cross-links to `16`, `20`, `14` (timeline cluster) |
| `22_when_to_integrate_iiot_with_mes_erp_and_cmms_and_when_to_wait` | Decision Support | keep | sequence discipline, per-system roles, anti-architecture-as-proof reality check | done: lever-keyed DBR77 bridge (integration timing and loop maturity); pairs cleanly with mistake `5` in `13` |

## Strongest Internal Style References

Use these as templates when editing weaker assets elsewhere in the library:

1. `21_what_the_first_30_days_of_iiot_should_look_like_in_a_brownfield_factory` for time-boxed execution rhythm, brownfield constraints, and leadership review focus
2. `19_why_iiot_alerts_fail_on_the_shop_floor_and_what_works_instead` for shop-floor failure modes and concrete response-path design
3. `20_how_to_review_iiot_value_after_the_first_pilot` for honest baseline-led review and staged proof language
4. `15_how_to_build_a_business_case_for_iiot_in_a_brownfield_factory` for CFO-ready structure without hype
5. `22_when_to_integrate_iiot_with_mes_erp_and_cmms_and_when_to_wait` for when-to-wait judgment and system-specific roles

## Top Priority Update Articles

No article in `13-22` required a heavy body rewrite under the current rubric. The March `2026` retrofit completed the tranche-wide packaging items below.

Completed batch items:

1. lever-keyed `## What this means for DBR77 IoT` across `13-22` so each closing ties to that article's primary lever
2. `16`, `20`, `14`, `21`: light cross-references between first `30` days, first `90` days, post-pilot review, and pilot-to-scale narratives (relative `article_EN.md` links)
3. `13`: optional pointer toward `06` for readers who want the protective start sequence alongside the mistake list

## Package Readiness And Recurring Issues

Cross-package and tranche-wide findings for IoT English `13-22`:

1. historical production-note markers were not found in any `article_EN.md` in this band via repository search at audit time; English bodies read publish-ready on that dimension
2. the `## What this means for DBR77 IoT` sections were highly similar across articles at audit time; the retrofit replaced interchangeable five-bullet blocks with topic-specific prose per article
3. closing `## Bottom line` sections are consistent with the DBR77 standard and are not themselves a problem; they reinforce outcome logic
4. structural repetition across `13-22` is intentional (problem, pattern, reality check, DBR77 bridge, bottom line) and supports the knowledge system; the risk is sameness in the product bridge, not in the core teaching arc
5. topical overlap inside the tranche is expected: `14`, `16`, `20`, and `21` form a natural timeline cluster (first month, first quarter, post-pilot, scale). Differentiation is already present in scope; light cross-links are now in place; avoid merging topics in future edits
6. overlap with IoT `01-12`: `13` echoes execution themes from `06`; `15` relates to `08` style CFO logic; `19` extends alert and visibility themes from `11`. Prefer cross-links over rewriting bodies
7. this tranche already represents a stronger mature IoT style than some older base articles: calm claims, operating loops, and explicit anti-theater language. Use it as a quality reference when retrofitting `01-12` stragglers

## Update Sequence For IoT 13-22

1. `[x]` run a single editorial batch to de-template or lever-key `## What this means for DBR77 IoT` across `13-22` (complete)
2. `[x]` add targeted cross-links in the timeline cluster (`14`, `16`, `20`, `21`) and optional pointer from `13` to `06` (complete)
3. re-read against `Blogs/_SYSTEM/standards/DBR77_PUBLICATION_OPERATING_CHECKLIST.md` for persona, stage, and CTA routing (packaging files, not bodies, unless a gap appears)
4. after this band is stable, schedule IoT `23-32` audit or retrofit work using the same rubric

## Done Standard For IoT 13-22 Retrofit

The `13-22` update wave is complete as of March `2026`:

- DBR77 bridge sections are topic-specific and not interchangeable across the tranche
- timeline-cluster articles cross-reference each other where helpful
- no production-only instructions remain in English article bodies (none found at audit)
- the band still reads as one coherent execution and decision-support layer for pilots and early rollout

## Layer Guidance After 13-22

IoT `13-22` already strengthens Decision Support and Execution And Transformation relative to the base library. For subsequent bands, continue to:

- deepen Field Reality and Problem Deep Dive where topics allow
- avoid duplicating the same DBR77 bullet list in every product bridge
- preserve the proof-first, calm industrial tone established here
