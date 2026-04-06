# When Vendor AI Tools Should Feed the Execution Layer and When Not To

Target persona: Procurement / Plant Engineering / IT-OT Integration Lead  
Funnel stage: Evaluation  
Core problem: attractive vendor copilots create parallel task channels that bypass approvals, training, and audit fields the plant already defined  
Main promise: a decision matrix on contracts, data handling, latency, ownership, and closure hooks so vendor tools strengthen execution instead of fragmenting it

**Direct answer:** Vendor AI tools should feed the execution layer when outputs map to stable task types, data stays under plant retention and access rules, latency fits operational SLAs, and every assisted action can land with the same approval and audit fields as native workflows. Do not feed the execution layer when the vendor cannot commit to immutable logs for act behaviors, refuses field-level lineage, or requires operators to live inside a separate app for closure. A tool that cannot close a loop in your system of record is a side project, not operations infrastructure.

The vendor demo is not your night shift.

Your execution record is.

## Matrix: feed the layer versus keep adjacent

| Criterion | Feed execution | Keep adjacent |
|---|---|---|
| task mapping | structured IDs and owners | free text only |
| approvals | respects plant policy classes | bypass or shadow approvers |
| logging | contractually defined, exportable | opaque or transient |
| latency | within SLA for the workflow | batch or unpredictable |
| data residency | matches plant and customer rules | unclear subprocessors |

If two or more rows land in the wrong column, do not integrate for act modes.

## Checklist: contract clauses that save you later

- explicit system-of-record designation for assisted decisions  
- retention, export format, and legal hold behavior  
- change notification for model or prompt updates that affect routing  
- incident support SLAs and root-cause cooperation  
- decommission path: data extract and field mapping on exit  

Unsigned clauses become oral promises that expire on the first outage.

## Step sequence: pilot vendor feed safely

1. shadow publish: mirror outputs without routing  
2. measure precision on claims and dismissals only  
3. map ten real exceptions end-to-end with audit fields  
4. run a red-team shift: stale data, duplicate signals, language edge cases  
5. promote to advise, then act only on workflows with stable closure  

## Comparison: best-of-breed stack versus execution spine

| Element | Best-of-breed without spine | Spine-first with vendors |
|---|---|---|
| operator experience | many apps | one closure habit |
| audit | reconstructed | mostly native |
| training load | high | concentrated |
| failure isolation | unclear | workflow-bounded |

Best-of-breed wins features.

Spine-first wins follow-through.

## When adjacent tools still make sense

- pure engineering analytics with no line state change  
- R&D experimentation with synthetic or offline data  
- supplier portals the plant never treats as operational truth  

Label them clearly so they do not leak into act paths.

## Why IRIS is built as the execution spine vendors should meet

DBR77 IRIS matters here because vendor tools only become operationally useful when they publish into the same task, approval, and closure shape as the plant's native workflows.

That lets procurement compare vendors on operational fit instead of on novelty and slide design.

If you need the neighboring decision-layer and ownership context, see [Why Factories Need One Decision Layer Before More AI Models](../27_why_factories_need_one_decision_layer_before_more_ai_models/article_EN.md), [How to Build a Cross-Site Playbook for AI-Assisted Factory Operations](../43_how_to_build_a_cross_site_playbook_for_ai_assisted_factory_operations/article_EN.md), and [What Data Ownership Should Look Like in an AI-Native Plant Operating System](../47_what_data_ownership_should_look_like_in_an_ai_native_plant_operating_system/article_EN.md).

## Final takeaway

Integrate vendors on closure discipline, not on novelty.

If they cannot write to your record with the same accountability as internal workflows, keep them out of act modes.
