# How to Assign Model Ownership Across Engineering, Operations, and Finance

Target persona: COO / chief engineer establishing governance for a plant or network digital twin  
Funnel stage: Consideration  
Core problem: the model becomes "IT's project" or "engineering's hobby" because no function owns assumptions, refresh, and decision use  
Main promise: a simple RACI-style split that keeps Digital Twin a decision system with accountable inputs and approved outputs

**Direct answer:** assign engineering ownership of model structure and technical validity, operations ownership of floor-truth inputs and change notifications, and finance ownership of guardrails, ranges used in CAPEX memos, and sign-off on scenario packs used at gates. Name a single twin steward who coordinates refresh events and publishes scenario summaries for leadership. Digital Twin is a scenario-testing environment for layout, flow, and CAPEX, not a rotating exhibit owned by whichever function funded it last.

Ownership is how simulation survives reorgs.

Without it, the twin becomes a file that everyone admires and nobody maintains.

## RACI-style split that works in factories

| Role | Accountable for |
|---|---|
| engineering lead | structure, routing logic, resource definitions, model releases |
| operations lead | staffing reality, shift rules, WIP behavior signals, change triggers |
| finance partner | ROI guardrails, scenario packs at gates, range language in approvals |
| twin steward | versioning, refresh cadence, library IDs, leadership summaries |

The steward can sit in engineering, but must have explicit time and authority to stop stale quoting.

## Decision rights: who can change what

- **engineering** changes structure after documented operational deltas  
- **operations** approves floor-truth parameter bands before gate meetings  
- **finance** approves which scenarios count as decision-grade for capital  
- **steward** blocks publication of outputs if baseline mismatch is open  

## Checklist: healthy ownership signals

- [ ] assumption changes have named authors and dates  
- [ ] operations receives a short delta readout after refresh  
- [ ] finance recognizes scenario IDs in gate materials  
- [ ] leadership knows who to call when rankings flip  

## When this model fails

It fails when the steward is a part-time volunteer without gate authority, when finance never sees ranges, or when operations learns about model changes from a slide deck.

## What Digital Twin changes here

Digital Twin only works as a decision system when inputs and outputs have clear ministers.

## What DBR77 Digital Twin adds

DBR77 Digital Twin only stays decision-grade when engineering, operations, and finance each own a named slice of structure, floor truth, and gate language.

Row-level traceability lands easier next to the reusable assumption ledger article in this series.

## Bottom line

Split the work.

Unify the accountability.

One steward, three functional owners, zero orphaned models.
