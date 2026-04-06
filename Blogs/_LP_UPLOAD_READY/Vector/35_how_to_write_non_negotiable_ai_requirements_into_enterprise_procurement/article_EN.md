# How to Write Non-Negotiable AI Requirements Into Enterprise Procurement

Target persona: procurement lead with IT and legal partners  
Funnel stage: Decision  
Core problem: RFPs copy generic security language that vendors can satisfy with checkbox answers while leaving training, subprocessors, and data paths undefined  
Main promise: a tight requirements annex makes training policy, deployment boundaries, audit rights, and incident duties enforceable before signature

Procurement is where abstract policy becomes contract reality.

Weak language produces weak controls.

## Direct answer

Write non-negotiable AI requirements as a numbered annex covering data processing purpose limitation, prohibition or narrow permission for training and human review, subprocessors and change notice, deployment mode obligations, logging and forensic cooperation, liability caps exceptions for confidentiality breaches, and exit data destruction with verification. Mark each clause as pass or fail for vendor response, not narrative essay.

If it is not in the annex, it is not in the deal.

## Requirements annex: twelve clauses to include

1. **Purpose limitation**: AI processes client data only for named services.
2. **Training exclusion**: default no training on client content; any exception requires opt-in scope and duration.
3. **Fine-tuning boundaries**: if allowed, specify data classes forbidden from tuning sets.
4. **Human review**: if vendor staff may view prompts or outputs, define cases, regions, and retention.
5. **Subprocessors**: list approved parties or require pre-approval with minimum notice days.
6. **Regions**: fixed allowlist for storage, inference, support access, and backups.
7. **Deployment commitment**: on-premise, private API, or isolated tenant as contracted, not optional at go-live.
8. **Security baseline**: reference your enterprise control framework by ID, not by vague SOC wording alone.
9. **Logging**: minimum events, retention, customer access, and export format.
10. **Incidents**: categories, notification clock, root-cause cooperation, and regulatory assistance where applicable.
11. **Audits**: frequency, scope, and remediation timelines for critical findings.
12. **Exit**: data return, cryptographic wipe evidence, and model artifact deletion where customer data could persist.

## Checklist: score vendor responses

For each clause, require:

- [ ] explicit conform or documented exception
- [ ] reference to technical control or exhibit diagram
- [ ] named subprocessors if relevant

Narrative marketing attachments do not score.

## Comparison: soft RFP language versus enforceable language

| Soft | Enforceable |
|---|---|
| "Vendor will maintain reasonable security" | "Vendor implements controls in Exhibit A and proves conformance annually" |
| "Customer data is protected" | "Customer content in scope X is not used to train global models per Section 4.2" |
| "Private cloud available" | "Production inference executes only in Region Y tenant Z with no admin crossover" |

## When to walk away

Walk away when the vendor refuses training exclusions for your highest data classes, or when subprocessors can change overnight without a remedy period.

## Product bridge

Twelve-clause annexes work when each clause has a technical counterpart: architecture diagram row, log field, or test you can run before signature.

Vector is the class of offering those clauses were written for: deployment boundaries you can attach to contract language, client data excluded from model training, and proprietary industrial reasoning instead of generic chat, so legal and engineering sign the same facts.

## Final takeaway

Non-negotiable requirements are how manufacturers keep AI vendors honest after the demo ends.

Write the annex once.

Reuse it across categories with data-class overlays.
