# How to Decide Which IoT Signals Deserve Edge Logic

Target persona: IT-OT architect / Controls lead / Plant systems engineer  
Funnel stage: Consideration  
Core problem: teams either push everything to the cloud for convenience or lock logic into PLCs without visibility, and neither path scales cleanly in brownfield  
Main promise: a decision grid: latency, safety, bandwidth, autonomy during outages, and maintainability determine where logic lives

Edge logic is not ideology.

It is a placement decision for accountability and uptime.

The wrong placement shows up as late response, brittle overrides, or un-auditable changes.

## Direct answer

Put IoT logic on the edge when **sub-second response matters**, **the line must run safely when WAN is impaired**, **raw streams are too heavy to ship continuously**, or **local interlocks need deterministic behavior** tied to standards.

Keep logic centralized when **global optimization**, **cross-line correlation**, or **infrequent batch analytics** is the goal and latency is acceptable.

When in doubt, default to **visibility first**, then promote only signals that pass a written edge promotion test.

## Framework: edge promotion test (six gates)

1. **Latency gate**  
   Does waiting for cloud round-trip create safety, quality, or constraint risk?

2. **Autonomy gate**  
   Does the line need decisions during upstream network loss?

3. **Bandwidth gate**  
   Would continuous cloud ingestion crowd the plant network without benefit?

4. **Determinism gate**  
   Does a standard or insurer expect bounded behavior?

5. **Maintainability gate**  
   Can your team patch and version edge logic with change control?

6. **Evidence gate**  
   Can you still reconstruct what the edge decided for audits and post-incident review?

## Comparison: edge-by-default versus cloud-by-default

| Edge-by-default | Cloud-by-default |
|---|---|
| many small rules to patch | fewer deployment targets |
| strong local autonomy | simpler global views |
| risk of hidden logic drift | risk of late actuation |
| needs disciplined versioning | needs honest latency math |

## Signal quality prerequisite

Edge logic amplifies mistakes.

Promote signals only after **baseline honesty** and **definition stability** across shifts.

Otherwise you automate confusion closer to the machine.

Baseline and definition stability belong with [how to improve machine data quality before scaling IoT](../24_how_to_improve_machine_data_quality_before_scaling_iot/article_EN.md) and [how to keep IoT signal definitions consistent across shifts](../43_how_to_keep_iot_signal_definitions_consistent_across_shifts/article_EN.md). The economic and risk case for edge stays in [when edge processing is worth it in brownfield IoT](../25_when_edge_processing_is_worth_it_in_brownfield_iot/article_EN.md).

## What this means for DBR77 IoT

DBR77 IoT keeps edge and cloud as explicit choices: promote logic only after signals pass a written test, keep versioning and rollback visible to controls and IT-OT partners, and default to visibility until the plant trusts the baseline.

Placement stays accountable to brownfield constraints instead of folding to a single vendor topology.

## Bottom line

Edge is where urgency and autonomy live.

Cloud is where pattern and portfolio views live.

Choose per signal class, not per slogan.
