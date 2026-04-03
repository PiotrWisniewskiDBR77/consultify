# What a Good Machine State Model Looks Like Before Scaling IoT

Target persona: Manufacturing engineer / OT systems lead / Reliability engineer  
Funnel stage: Evaluation  
Core problem: teams scale sensors before they agree what "running well" means in machine language, so every site invents its own labels under pressure  
Main promise: a minimal state model you can govern: stable states, allowed transitions, evidence for each transition, and explicit unknowns

Scaling IoT without a state model is like expanding a plant without line balance data. You will move faster and discover conflicts later. A state model is not a vendor feature list.

It is the plant's agreement on how machine reality maps to the next operational decision. A good pre-scale **machine state model** has: a small set of **named states** operators and maintenance already use in conversation; **clear transitions** tied to signals or physical checks, not vibes; **one owner per transition** when the state implies a different next action; an **unknown** bucket that is allowed temporarily with a time-bound follow-up. If you cannot draw it on one page, it is not ready to scale.

## States versus tags

Tags are free-form labels. States are operational commitments.

| Tags | States |
|---|---|
| many, overlapping | few, mutually exclusive for a given asset moment |
| fun for analytics later | drive playbooks now |
| easy to add in software | hard to align across shifts |

Keep tags for engineering depth. Keep states boring enough for the floor.

## Framework: the six-state starter set

Adapt names to your plant, keep the logic:

1. **Running to plan** Within agreed variance bands for cycle, quality proxies, and constraints

2. **Running constrained** Running but limited by material, tooling, staffing, or upstream flow

3. **Degrading** Trend away from baseline without stop yet; maintenance priority rises

4. **Stopped known** Reason code matches a known fault pattern or verified condition

5. **Stopped unknown** Stop without a trusted reason; investigation state

6. **Out of service** Planned work, changeover, or lockout; not a fault state

This set is enough to align IoT, CMMS, and shift language before you multiply sites.

## Checklist: validate the model before scale

- [ ] operators can assign states without opening a manual
- [ ] each state maps to a default next role: operator, maintenance, engineering
- [ ] transitions log who confirmed physical reality when sensors disagree
- [ ] standards are referenced for safety and quality gates between states
- [ ] unknown stops have a maximum age before escalation

## Comparison: sensor-first scaling versus state-first scaling

| Sensor-first | State-first |
|---|---|
| more points, unclear meaning | fewer points, agreed meaning |
| debates about thresholds in every meeting | debates once, then govern |
| dashboard sprawl | shared language for planning |

## When this fails

**Fails** when leadership treats the model as IT documentation instead of a living operations contract.

**Fails** when vendors define states that do not match how maintenance triages the asset.

Agree signal trust and identity before you debate state names in [how to improve machine data quality before scaling IoT](../24_how_to_improve_machine_data_quality_before_scaling_iot/article_EN.md), then wire the vocabulary into shift handover in [how to use IoT data in shift handover without creating more reporting](../33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting/article_EN.md).

## What this means for DBR77 IoT

DBR77 IoT pays off when the plant loads a small, boring state vocabulary into the system before multiplying sensors and tags, so transitions and temporary unknowns stay reviewable at the asset instead of argued only from remote dashboards.

Harden the model on one line class, then scale points without changing the language every month.

## Bottom line

Agree the **state model before you multiply sensors**.

Small, boring, governed states beat a large cloud of clever tags nobody trusts on night shift.
