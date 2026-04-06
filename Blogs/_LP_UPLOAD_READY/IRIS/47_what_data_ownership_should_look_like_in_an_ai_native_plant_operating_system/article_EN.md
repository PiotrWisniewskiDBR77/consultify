# What Data Ownership Should Look Like in an AI-Native Plant Operating System

Target persona: CIO / IT-OT Architect / Data Governance Lead  
Funnel stage: Consideration  
Core problem: "everyone owns data" means no one fixes definitions, refresh failures, or lineage gaps when models and rules multiply  
Main promise: a practical ownership map for source systems, curated operational definitions, assistance outputs, and audit trails with explicit RACI

**Direct answer:** Data ownership in an AI-native plant operating system should name a single accountable owner per operational definition family (for example OEE scope, downtime reason tree, location master), a responsible steward for daily quality, and consulted parties for each consuming workflow. Assistance outputs inherit the ownership of the workflow they touch, not the model vendor. Refresh SLAs, exception handling for stale feeds, and version publishing rights must be written down. If two teams can both edit the same threshold without a changelog entry, you do not have ownership, you have shared blame.

AI does not create new data.

It exposes who neglected the old data contract.

## Map 1: three layers of ownership

| Layer | Accountable | Responsible | Typical failure |
|---|---|---|---|
| source feeds | plant data council lead | system admin per source | silent schema drift |
| operational definitions | function owner (prod, quality, WH) | CI analyst | KPI arguments |
| assistance configuration | plant manager | cross-functional config team | shadow threshold edits |

Accountable approves publishes.

Responsible fixes daily breaks.

## Checklist: definition packet (publish before models tune on it)

- plain-language definition and exclusions  
- field mapping to source tables or tags  
- refresh cadence and maximum acceptable lag  
- known distortions and compensations  
- change window and communication rule for operators  

Packets prevent "the model is wrong" debates that are actually definition fights.

## Framework: vendor data versus plant-owned data

| Data type | Plant must own | Vendor may operate |
|---|---|---|
| thresholds and approval classes | yes | only under contract and logging |
| operator notes and claims | yes | never |
| model weights and prompts | policy and evaluation | execution hosting optional |
| raw machine stream | access and retention rules | collection appliance |

If the contract is silent on logs, assume the worst and fix it.

## Step sequence: ownership reset workshop (half day)

1. list the top ten KPIs used in assisted workflows  
2. assign one accountable owner each, no shared titles  
3. map feeds and lag for each KPI  
4. agree on a single publish path for definition changes  
5. set a monthly data health review with red-flags tied to actions  

## When centralized IT ownership alone fails

- operations will not wait for tickets during a stop  
- definitions need shop-floor judgment weekly  
- maintenance and quality disagree on the same event labels  

Pair IT accountability with function stewards on the floor.

## Why IRIS makes ownership visible in execution

DBR77 IRIS matters here because ownership stops being abstract once definitions, tasks, refresh lineage, and assistance configurations are visible in the same execution layer.

That makes it easier to see who publishes, who fixes lag, and who answers when a workflow breaks under pressure.

If you need the neighboring data and vendor boundary context, see [Why AI Without Operational Data Still Fails in Manufacturing](../32_why_ai_without_operational_data_still_fails_in_manufacturing/article_EN.md) and [When Vendor AI Tools Should Feed the Execution Layer and When Not To](../48_when_vendor_ai_tools_should_feed_the_execution_layer_and_when_not_to/article_EN.md).

## Final takeaway

Ownership is who publishes, who fixes lag, and who answers auditors.

Write it in RACI, not in slogans.
