# Digital Twin Audit And Update Plan 01-12

Status: **retrofit complete** for English base articles `01-12` under `Blogs/DT/Blog/` for the scope defined in this file (priority rewrites plus universal legacy production-note cleanup). PL and DE bodies were out of scope.

Strategy source of truth: `Blogs/_SYSTEM/strategy/DBR77_PRODUCT_MARKETING_PLAN.md`

Tracker source of truth: `Blogs/_SYSTEM/strategy/MASTER_COMPLETION_PLAN.md`

Tone and structure calibration references:

- `Blogs/DT/Blog/21_when_a_factory_should_simulate_before_it_reconfigures_flow/article_EN.md`
- `Blogs/DT/Blog/31_how_to_use_digital_twin_in_capex_stage_gates/article_EN.md`

## Purpose

This file translates the DBR77 product marketing standard into a practical update plan for the first `12` Digital Twin English articles.

Use it to decide:

- which articles are already strong enough to keep with packaging cleanup
- which articles need a light rewrite for structure, proof texture, or differentiation
- which articles need a heavy rewrite (none in this slice for substance; see notes)
- which recurring package issues must be fixed before publishing

Layer names below follow the five-layer product knowledge architecture in the strategy master: Field Reality, Problem Deep Dives, Solution Logic, Decision Support, Execution And Transformation.

## Audit Rubric

Score every article against these dimensions (same family as prior product audits):

1. **Knowledge-layer fit**

- does the article clearly serve one of the five layers
- does it strengthen Digital Twin as decision-grade simulation and scenario testing, not generic digital transformation talk

2. **Trust and proof**

- does it use operational logic, trade-offs, and governance-adjacent reasoning
- does it avoid hollow transformation rhetoric
- does it include enough case-shaped or illustrative texture (even one concrete scenario beats abstract lists)

3. **Article arc**

- real problem, what actually happens, reality check, what works, how DBR77 fits, outcome logic
- reference `21` and `31` use explicit **Direct answer** blocks, tables, or checklists where the topic supports them; most `01-12` pieces rely on section stacks without a labeled direct answer

4. **Operational specificity**

- closeness to layout, flow, buffers, variability, CAPEX, automation, logistics, and approval behavior

5. **Maturity and tone**

- calm, industrial, proof-bearing, non-startup
- article `12` leans on a sharper headline than the calmer reference standard

6. **System fit**

- persona and funnel stage in the header align with content
- LP and CTA handling should follow the publication checklist; production notes must not ship in customer-facing HTML

## Article Classification (post-retrofit English `01-12`)

| Article | Strongest layer fit | Classification | What changed in this wave | Optional later polish |
| --- | --- | --- | --- | --- |
| `01_digital_twin_not_3d_model_decision_engine` | Solution Logic | **rewritten** | Direct answer; decision-engine framing; reduced overlap with `08` (no CAD-deep narrative here) | none critical |
| `02_why_capex_decisions_should_be_simulated_before_they_are_approved` | Decision Support | **keep** | historical production-note lines removed | optional cross-link to `31` |
| `03_before_you_buy_a_robot_simulate_it_first` | Decision Support | **keep** | historical production-note lines removed | optional tighten DBR77 block |
| `04_why_most_digital_twins_fail` | Problem Deep Dives | **keep** | historical production-note lines removed | optional short checklist echoing `21` |
| `05_how_to_compare_layout_variants_without_guesswork` | Solution Logic | **keep** | historical production-note lines only; body unchanged | direct answer or comparison table per earlier audit note |
| `06_from_manual_inputs_to_live_data_a_practical_digital_twin_roadmap` | Execution And Transformation | **rewritten** | Direct answer; phased milestone table; decision-linked integration logic | none critical |
| `07_how_simulation_reduces_change_risk_in_production_and_logistics` | Field Reality | **rewritten** | Direct answer; plant and warehouse vignettes; compact pre go-live gate table | none critical |
| `08_digital_twin_vs_cad_what_decision_makers_need_to_know` | Solution Logic | **rewritten** | Direct answer; CAD versus twin roles; decision-timing table; complementarity and approval focus | none critical |
| `09_how_cfos_can_use_simulation_to_validate_roi` | Decision Support | **keep** | historical production-note lines removed | optional sensitivity sidebar |
| `10_the_cost_of_rework_when_you_skip_scenario_testing` | Decision Support | **keep** | historical production-note lines removed | direct answer or cost pattern list per earlier audit note |
| `11_how_to_identify_bottlenecks_before_they_happen` | Problem Deep Dives | **keep** | historical production-note lines removed | direct answer or early-warning list per earlier audit note |
| `12_simulation_vs_reality_why_your_factory_planning_is_still_wrong` | Problem Deep Dives | **rewritten** | Calmer H1 and lead; direct answer; stress-test framing; folder slug unchanged for links | none critical |

**Heavy rewrite:** none for this slice. Priority pieces received substantive rewrites aligned to decision-support cadence, not a full library teardown.

## Recurring Package Issues (01-12)

1. **Legacy production-note lines:** **resolved for English `01-12`.** All historical production-note lines were removed from `article_EN.md` files in this range. PL/DE counterparts were not edited in this wave. Other DT article indices (`13+`) may still contain production notes until a later pass.

2. **Repeated DBR77 closing blocks:** many retained articles (`02`-`05`, `09`-`11`) still share the four-bullet pattern. Priority rewrites (`01`, `06`, `07`, `08`, `12`) now use shorter, article-specific **What DBR77 Digital Twin adds** sections. A future harmonization pass can de-template the remaining bodies if template fatigue matters in export.

3. **Missing direct-answer headers:** **improved** for `01`, `06`, `07`, `08`, `12`. Optional follow-up: add labeled direct answers to `05`, `10`, `11` if editorial time allows.

4. **Proof texture:** priority articles now include gate logic, tables, or scenario families where natural.

5. **Pair redundancy:** **addressed.** `01` owns decision-engine category framing; `08` owns CAD complementarity and decision timing in approval flows.

## Top Priority Update Articles

Completed in this wave:

1. `01_digital_twin_not_3d_model_decision_engine`
2. `12_simulation_vs_reality_why_your_factory_planning_is_still_wrong`
3. `08_digital_twin_vs_cad_what_decision_makers_need_to_know`
4. `06_from_manual_inputs_to_live_data_a_practical_digital_twin_roadmap`
5. `07_how_simulation_reduces_change_risk_in_production_and_logistics`

## Update Sequence (recommended) -- historical

The sequence below was the planned order; execution followed it in substance (CTA strip plus paired `01`/`08` and `12` calibration).

1. Strip historical production-note lines from all `01-12` `article_EN.md` files in one batch.
2. Edit `01` and `08` in the same session so category education stays non-redundant.
3. Edit `12` for headline and lead calibration while keeping the stress-test argument.
4. Add direct-answer sections (and light tables where natural) to `05`, `06`, `07`, `10`, `11`.
5. Apply a single harmonized **What DBR77 Digital Twin adds** pattern across `01-12`, with one sentence of article-specific payoff each.
6. Re-read against `21` and `31` for cadence and checklist density.

## Layer Guidance For This Retrofit Wave

Strengthen:

- explicit decision gates and scenario families (borrow patterns from `21` and `31`)
- downside and sensitivity language for finance readers
- progressive data maturity without perfect-data deferral
- calm industrial tone over slogan stacks

## Done Standard For DT 01-12 English Retrofit (as delivered)

Against this checklist:

- [x] all historical production-note lines removed from `01-12` English article bodies
- [x] priority rewrites completed for `01`, `08`, `12`, `06`, `07`
- [x] `01` and `08` non-redundant after pass
- [~] DBR77 closing blocks de-templated with one unique line per article (done for priority rewrites; retained articles still use shared bullet pattern)
- [~] direct-answer blocks added where the audit flagged light rewrite (done for priority set; `05`, `10`, `11` deferred)
- [x] every row in the classification table still maps cleanly to one primary layer

## Next Audit Move (tracker)

After DT `01-12` English retrofit, the remaining detailed article-level audit gap at this batch size is **Vector** (for example `01-20` or the product-specific first tranche defined in the master tracker). Optional: extend legacy production-note cleanup and body polish to DT `13+` English when scheduled.
