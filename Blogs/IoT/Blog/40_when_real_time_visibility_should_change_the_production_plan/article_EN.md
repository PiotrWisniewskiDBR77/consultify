# When Real-Time Visibility Should Change the Production Plan

Target persona: Production planner / Operations manager / Supply chain interface  
Funnel stage: Decision  
Core problem: planners distrust shop-floor stories, while IoT can show drift too late if it is not tied to planning governance, so either nothing changes or everything changes chaotically  
Main promise: a decision gate: which real-time conditions authorize a plan change, who approves, within what time window, and what evidence standard applies

Real-time visibility is not a license to replan every hour.

It is a trigger list for when the plan is no longer the best honest forecast. Planning needs governance as much as the line needs safety rules.

Change the production plan when **confirmed machine and flow conditions** cross thresholds that your plant already ties to customer, inventory, or compliance risk, and when the change passes a **named approver** inside a defined window.

Do not change the plan based on: unconfirmed sensor spikes; one shift's opinion without corroboration; visibility that only affects internal efficiency with no customer or inventory impact.

## Framework: three plan-change classes

1. **Protect class** Safety, regulatory, or quality non-conformance that blocks shipment or introduces recall-class risk Plan change is often mandatory, not optional.

2. **Recover class** Confirmed capacity loss on a constraint resource with a time horizon that breaks the committed schedule Plan change is authorized if recovery actions cannot close the gap.

3. **Rebalance class** Flow imbalance that will create downstream starvation or excess within an agreed horizon Plan change is optional but should follow a standard playbook.

Each class should have a default approver and a maximum frequency per day to prevent thrash.

## Comparison: reactive thrash versus governed replan

| Reactive thrash | Governed replan |
|---|---|
| constant sequence changes | trigger list and approver |
| planner burned out | planner protected by rules |
| IoT blamed for chaos | IoT cited as evidence object |
| operators distrust plan | plan aligns to confirmed reality |

## Checklist: make IoT evidence admissible in planning

- [ ] signals used for replan are on the approved evidence list
- [ ] confirmation workflow is referenced, not skipped for "urgency"
- [ ] overrides and downtime reason codes are part of the story
- [ ] standards for customer commitment are explicit
- [ ] post-change review logs what evidence triggered the move

## Integration with handover and escalation

Planning sits between **shift execution** and **customer promise**.

If handover and escalation rules are weak, planners will keep ignoring IoT.

Strengthen those loops first on constraint lines using [how to use IoT data in shift handover without creating more reporting](../33_how_to_use_iot_data_in_shift_handover_without_creating_more_reporting/article_EN.md), [when IoT should trigger supervisor escalation and when it should not](../34_when_iot_should_trigger_supervisor_escalation_and_when_it_should_not/article_EN.md), and [how to use IoT for faster problem confirmation on the shop floor](../39_how_to_use_iot_for_faster_problem_confirmation_on_the_shop_floor/article_EN.md).

## What this means for DBR77 IoT

DBR77 IoT is differentiated in planning when replan triggers tie to confirmed conditions, named approvers, and protect or recover or rebalance classes with frequency caps, not to raw visibility or shift opinion.

Constraint assets on older lines should follow the same evidence bar once signal quality is admitted into the planning conversation.

## Bottom line

Let real-time visibility change the plan only where **confirmed conditions**, **clear risk**, and **named authority** align. Otherwise keep the plan stable and fix the signal or the process.
