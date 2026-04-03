# What a Human Approval Policy Should Look Like in Factory AI

Target persona: Quality Systems Manager / Plant Manager / Legal and Compliance Partner  
Funnel stage: Decision  
Core problem: teams rely on informal habits for when a human must sign, which breaks under shift change, vacation coverage, and audit questions  
Main promise: a policy skeleton you can publish: scope, thresholds, evidence, escalation, records, and training tied to workflows, not model names

A human approval policy for factory AI should state which workflow states require a named human sign-off, what evidence must be visible at sign-off, how long approvals may wait before escalation, who covers nights and weekends, and how overrides are recorded. It should reference risk classes and reversibility, but always land in concrete workflow fields and roles. If it only talks about "the AI," it will fail audits and the shop floor. Policy is boring on purpose. Boring is what makes operations predictable.

## Section 1: scope and definitions

Publish: which workflows and sites the policy covers; definitions of watch, advise, and act modes in your plant language; which systems are systems of record for approvals. Avoid model marketing names in the core policy text. Use workflow and asset language auditors recognize.

## Section 2: approval matrix by workflow state

Example shape (customize to your plant):

| Workflow state | AI mode allowed | Human gate | Approver role |
|---|---|---|---|
| intake triage | advise | confirm before task creation | line supervisor |
| maintenance work order release | advise | sign before dispatch | maintenance lead |
| quality hold disposition | advise or act within rule | release signature | quality manager |
| customer shipment override | advise only | dual sign | quality plus logistics |

Empty approver cells are how incidents happen.

## Section 3: evidence package at approval time

Require visible evidence, not vibes: signals or fields the suggestion used; uncertainty flags when present; similar past cases linked as reference, not as authority; explicit statement of reversibility and rollback step. Approvers should be able to say "I saw X, therefore I signed."

## Section 4: time-based escalation

Define: maximum wait for approval by severity band; who escalates automatically at timer breach; what happens to act-mode behavior during backlog. Silent timeouts are how "the system decided" becomes a rumor.

## Section 5: coverage and delegation

Cover: night shift named deputies; vacation delegation rules; emergency downgrade to advise-only with who can trigger it. If coverage is not written, people will bypass with personal logins. That destroys traceability.

## Reality check: approval policy usually fails on weekends, coverage gaps, and backlog

Most plants can write a reasonable approval rule in a workshop. The test is whether it still works:

- on night shift when the primary approver is absent
- during backlog when supervisors are clearing queues quickly
- after an incident when auditors want one clean record instead of six explanations

If the policy does not survive those moments, it is still guidance, not control.

## Section 6: training and recertification

State: who must complete policy training before approval rights; annual or post-incident recertification triggers; how contractors are handled. Training records are part of the policy, not HR decoration.

## Checklist: is the policy operational?

- can a new supervisor find their gates in under five minutes?  
- can quality explain the policy without mentioning a vendor?  
- can IT produce an approval audit trail for a random week?

Three "yes" answers mean you are close.

## Why IRIS makes approval policy enforceable

DBR77 IRIS matters here because approval policy only survives shift change when evidence, timers, sign-offs, and resulting tasks share one operational record.

That is what turns policy from a document into a floor-level control mechanism.

If you need the decision-rights logic behind those gates, see [When AI Should Recommend and When Humans Should Decide in Operations](../26_when_ai_should_recommend_and_when_humans_should_decide_in_operations/article_EN.md), [When AI Should Watch, Advise, or Act in the Factory](../36_when_ai_should_watch_advise_or_act_in_the_factory/article_EN.md), and [How to Govern AI Decisions Across Shifts and Functions](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_EN.md).

## Final takeaway

Write approvals in workflow language with named roles, timers, and evidence. If it is not enforceable on the floor, it is not a policy.

---

*DBR77 IRIS stores approvals, evidence, and tasks together so human gates stay traceable across shifts and functions. [Start 14-day trial](https://dbr77.com/iris) or [Watch walkthrough](https://dbr77.com/demo).*
