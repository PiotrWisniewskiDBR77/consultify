# How to Keep IoT Signal Definitions Consistent Across Shifts

Target persona: Engineering lead / Continuous improvement lead / Shift operations sponsor  
Funnel stage: Consideration  
Core problem: each shift names states differently, rounds timestamps differently, and interprets thresholds in conversation, so handover becomes opinion instead of evidence  
Main promise: a shared signal dictionary plus handover rules that stay stable when people, vendors, or screens change

Shift handover breaks first when definitions drift.

IoT does not fix vocabulary by itself.

It exposes whether the plant agrees on what a signal means.

For adjacent discipline, pair this with [how to use IoT data in shift handover without creating more reporting](../33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting/article_EN.md), state vocabulary before scale in [what a good machine state model looks like before scaling IoT](../35_what_a_good_machine_state_model_looks_like_before_scaling_iot/article_EN.md), and rename and threshold ownership in [what IoT governance should look like after the first year](../42_what_iot_governance_should_look_like_after_the_first_year/article_EN.md).

## Direct answer

Keep IoT signal definitions consistent across shifts with a **single plant dictionary**, **frozen field names for handover**, and a **monthly sample audit** where operators explain the same tag in their own words.

If two shifts use different words for the same machine state, you do not have a state model problem only.

You have a communication failure that will poison maintenance priority and escalation.

## Framework: the definition stack

1. **Semantic layer**  
   Plain-language meaning: running, faulted, starved, blocked, changeover, warmup, hold for quality

2. **Technical layer**  
   Tag name, unit, sampling cadence, and edge versus cloud source of truth

3. **Operational layer**  
   What supervisors expect in escalation, what planners need for work-order routing, what quality needs for traceability

4. **Training layer**  
   Short glossary in the local language of the floor, tied to screens operators actually see

5. **Governance layer**  
   Who approves a rename, how version history is kept, how overrides relate to definitions

## Checklist: minimum dictionary fields per critical signal

- [ ] business name used in handover (not only PLC shorthand)
- [ ] numeric unit and rounding rule
- [ ] expected range in normal production and in idle
- [ ] known false-positive causes and how to log them
- [ ] link to maintenance priority class if the signal can drive work
- [ ] retention class for evidence and audit expectations

## Comparison: tribal naming versus plant dictionary

| Tribal naming | Plant dictionary |
|---|---|
| "that vibration thing" | named signal with owner |
| different Excel tabs per shift | one approved list |
| threshold changes in chat | logged change control |
| training by shadowing only | glossary plus sign-off |

## Signal quality and standards

Definitions are the front door to signal quality.

They should inherit the honesty bar from [how to improve machine data quality before scaling IoT](../24_how_to_improve_machine_data_quality_before_scaling_iot/article_EN.md).

Poor definitions create noisy alerts, repeat overrides, and weak evidence in customer or regulatory reviews.

Tie definition work to standards your plant already owns: safety interlocks, quality holds, maintenance classes.

## What this means for DBR77 IoT

DBR77 IoT treats the signal dictionary as part of the product surface: the same field names operators see at handover, version notes when definitions change, and exports that carry enough context for maintenance and quality without a side spreadsheet.

When vocabulary is owned and frozen where it must be, shift changes stop being a game of telephone.

## Bottom line

Consistency is not a documentation hobby.

It is how handover, escalation, and evidence stay aligned when the night crew does not read the morning crew's chat history.
