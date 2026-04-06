# DBR77 LP Implementation Map

## Purpose

This file turns `Blogs/_SYSTEM/lp_kb/DBR77_LP_KNOWLEDGE_ARCHITECTURE_MODEL.md` into a concrete LP build map for all six products.

For each product, define:

- primary persona entry
- LP sections
- article clusters
- proof blocks
- CTA ladder
- cross-product bridge

## Shared LP Build Rule

Every product LP should follow this order:

1. hero value proposition
2. problem reality block
3. decision or use-case paths
4. grouped knowledge sections
5. proof and implementation block
6. CTA ladder
7. cross-product bridge

## Consultify

Primary persona entry: `Owner / President / Chairman`

Primary CTA path:

- early: `explore transformation blind spots`
- mid: `book workshop`
- late: `review ROI case`

| LP section | Article cluster | Persona entry | CTA path | Bridge |
|---|---|---|---|---|
| `Governance And ROI` | transformation control, sponsor cadence, ROI defense, portfolio visibility | owner, CFO | benchmark -> review ROI -> discuss investment logic | to `DT` when capex justification needs scenario testing |
| `Execution And Rollout` | initiative ownership, offsite alignment, execution drift, workshop follow-through | operations leader, transformation sponsor | read -> book workshop -> validate rollout fit | to `IRIS` when strategy must become execution control |
| `AI And Decision Making` | decision latency, strategic reporting, scenario planning, data-first strategy | chairman, COO | explore -> discuss system logic -> schedule decision session | to `Vector` when AI governance becomes a blocker |

Proof blocks:

- reality check on sponsor drift
- implementation warning on workshop-to-execution failure

## IoT

Primary persona entry: `Plant Manager / Operations`

Primary CTA path:

- early: `see where visibility is failing`
- mid: `plan a pilot`
- late: `review line-fit`

| LP section | Article cluster | Persona entry | CTA path | Bridge |
|---|---|---|---|---|
| `Downtime And OEE` | machine visibility, OEE limits, downtime response, maintenance delays | plant manager, maintenance lead | read -> plan pilot -> assess line | to `IRIS` when visibility must route action |
| `Execution And Rollout` | first 30 days, pilot without disruption, rollout governance, data-to-action loops | operations, plant engineering | explore -> plan pilot -> review implementation path | to `Consultify` when rollout governance needs executive ownership |
| `AI And Decision Making` | machine-data use, signal quality, context, decision loops | CTO, plant manager | benchmark -> see demo -> validate architecture | to `Vector` when industrial AI trust becomes relevant |

Proof blocks:

- reality check on over-collection without decisions
- implementation warning on pilot sprawl

## IRIS

Primary persona entry: `Plant Manager / COO`

Primary CTA path:

- early: `see why dashboards are not enough`
- mid: `start demo`
- late: `review architecture`

| LP section | Article cluster | Persona entry | CTA path | Bridge |
|---|---|---|---|---|
| `AI And Decision Making` | dashboards vs operating system, MES limits, KPI blind spots, AI-guided operations | plant manager, CTO | read -> start demo -> review architecture | to `Vector` when secure AI boundaries are the next objection |
| `Execution And Rollout` | insight-to-task loop, spreadsheet replacement, approval workflows, adoption roadmaps | COO, operations director | explore -> start demo -> validate rollout fit | to `IoT` when machine visibility remains the missing input |
| `Governance And ROI` | shared truth, cross-functional control, task closure, operating economics | COO, CFO | benchmark -> book walkthrough -> review business case | to `Consultify` when leadership governance must be rebuilt |

Proof blocks:

- reality check on awareness without action
- implementation warning on fragmented tasking

## DT

Primary persona entry: `CFO / Plant Manager`

Primary CTA path:

- early: `see where guesswork creates risk`
- mid: `book demo`
- late: `review business case`

| LP section | Article cluster | Persona entry | CTA path | Bridge |
|---|---|---|---|---|
| `Layout And Flow` | bottlenecks, layout variants, workforce optimization, continuous improvement simulation | plant manager, operations | read -> book demo -> scope use case | to `IRIS` when simulation findings need operational closure |
| `CAPEX And Investment` | capex approval, robot simulation, board-risk reduction, 12-month ROI logic | CFO, owner | explore -> compare scenarios -> review business case | to `Marketplace` when investment turns into supplier selection |
| `Governance And ROI` | scenario testing discipline, business-case structure, first simulation project, rollout governance | CFO, chairman | benchmark -> plan workshop -> schedule decision meeting | to `Consultify` when transformation governance is weak |

Proof blocks:

- decision mistake block on approving capex without scenarios
- outcome logic block on rework avoidance

## Marketplace

Primary persona entry: `Purchasing / Supplier / Integrator`

Primary CTA path:

- early: `understand the sourcing problem`
- mid: `describe your challenge`
- late: `compare offers`

| LP section | Article cluster | Persona entry | CTA path | Bridge |
|---|---|---|---|---|
| `Automation And Sourcing` | supplier discovery, brief quality, RFQ clarity, compare-offers logic | purchasing, supplier manager | read -> describe challenge -> compare offers | to `DT` when layout or capex simulation must shape sourcing |
| `CAPEX And Investment` | commercial risk, TCO framing, buying mistakes, award logic | owner, CFO | benchmark -> scope shortlist -> review business case | to `Consultify` when governance around buying is weak |
| `Execution And Rollout` | acceptance, handoff, mobilization, kickoff discipline, post-award control | integrator, operations | explore -> review rollout -> schedule decision call | to `IRIS` when buying must connect to execution control |

Proof blocks:

- reality check on weak briefs
- implementation warning on post-award drift

## Vector

Primary persona entry: `CTO / COO`

Primary CTA path:

- early: `review AI risk`
- mid: `start demo`
- late: `review security`

| LP section | Article cluster | Persona entry | CTA path | Bridge |
|---|---|---|---|---|
| `AI And Decision Making` | public AI risk, generic vs industrial models, domain knowledge, approval logic | CTO, COO | read -> start demo -> review security | to `IRIS` when AI must operate inside plant workflows |
| `Governance And ROI` | deployment model cost, auditability, traceability, security-team objections | CTO, security leader | benchmark -> review architecture -> review security | to `Consultify` when governance must be defended at leadership level |
| `Execution And Rollout` | on-prem vs cloud, deployment readiness, data sovereignty, human approval layers | CTO, operations leader | explore -> scope pilot -> validate fit | to `IoT` when live plant signals are required as inputs |

Proof blocks:

- decision mistake block on treating public AI like enterprise SaaS
- implementation warning on weak approval boundaries

## LP Quality Gate

Do not mark an LP ready unless:

- one primary persona entry is obvious
- at least three grouped sections are defined
- each section has a section-level CTA
- at least two proof-bearing blocks are specified
- one cross-product bridge exists after the primary product logic
