# When IoT Alerts Should Create Work Orders and When They Should Not

Target persona: Maintenance planner / Reliability engineer / CMMS owner with operations partnership  
Funnel stage: Trial  
Core problem: CMMS floods with auto-generated tickets that technicians ignore, while real failures still arrive as verbal escalations  
Main promise: a routing matrix: which alerts become work orders, which become watch items, and which only enrich existing jobs

A work order is a promise of labor and parts.

IoT alerts are observations.

Confusing the two burns trust faster than any dashboard color.

## Direct answer

Create a work order from an IoT alert only when **labor is truly required**, **a job plan or failure mode exists**, and **the signal crossed a plant-defined threshold with corroboration**.

Do not create a work order when the alert is **baseline noise**, **a known transient during startup**, **a training or override situation**, or **better handled as a supervisor escalation first**.

## Step sequence: alert to routing decision

1. **Classify the signal** against your state model and signal dictionary  
2. **Check corroboration** from a second signal, repeat occurrence, or operator confirmation  
3. **Match to a maintenance class** from your priority ladder  
4. **If interrupt risk is high**, open an interrupt path per plant rules  
5. **If learning is the goal**, log to engineering visibility without CMMS load  
6. **Review weekly** for false work-order creation rate and adjust thresholds

This routing stack extends [what machine data should trigger action and what should not](../23_what_machine_data_should_trigger_action_and_what_should_not/article_EN.md), inherits alarm hygiene from [how to reduce false alarms in IIoT systems](../28_how_to_reduce_false_alarms_in_iiot_systems/article_EN.md), and shares the maintenance triage ladder in [how to turn IoT signals into maintenance priorities without noise](../36_how_to_turn_iot_signals_into_maintenance_priorities_without_noise/article_EN.md).

## Comparison: CMMS spam versus disciplined routing

| CMMS spam | Disciplined routing |
|---|---|
| every threshold trip becomes a ticket | tickets tied to job plans |
| technicians mute notifications | alerts map to classes |
| planner becomes a data janitor | planner owns routing rules with ops |
| no feedback loop on bad rules | measured false ticket rate |

## Escalation without automatic work orders

Some conditions need **supervisor visibility** or **structured problem solving** before anyone commits wrench time.

That is not weakness.

It is respect for brownfield constraints and finite craft capacity.

Supervisor-first and watch-item paths should match [when IoT should trigger supervisor escalation and when it should not](../34_when_iot_should_trigger_supervisor_escalation_and_when_it_should_not/article_EN.md).

Before widening closed-loop automation, use [when to expand from visibility to closed-loop response](../29_when_to_expand_from_visibility_to_closed_loop_response/article_EN.md) as the expansion gate.

## What this means for DBR77 IoT

DBR77 IoT separates observation from labor commitment: alerts arrive with context technicians can trust, routing tables stay visible to planners, and auto-ticket paths require explicit plant rules instead of default vendor behavior.

The point is a CMMS feed that respects craft capacity, not a pipe that turns every threshold trip into wrench time.

## Bottom line

Work orders should be scarce and serious.

IoT should make that discipline visible, not automate chaos into your backlog.
