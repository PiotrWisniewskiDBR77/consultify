# How to Design an Exception Handling Model for AI-Assisted Operations

Target persona: Operations Architect / Plant Engineering Lead / Quality Systems Owner  
Funnel stage: Consideration  
Core problem: AI assistance increases event volume, but plants still route exceptions through informal chats, so response ownership and closure loops stay unclear  
Main promise: a compact exception model with typed paths, thresholds, approvals, and audit fields that supervisors can run under load

**Direct answer:** Design exception handling for AI-assisted operations by classifying every assisted output into one of four paths: auto-task within policy, advise-only with human claim, escalate with mandatory owner and SLA, or hard stop pending approval. For each path, define triggers, who may override, what record fields are mandatory, and how closure is proven. Publish the model next to workflow maps so shifts do not improvise. A model without named owners and time boxes is only a diagram.

Assisted operations do not fail because the model is wrong on day one.

They fail because exceptions become a second shadow process.

## Why exceptions spike when assistance goes live

Assistance surfaces borderline cases that humans used to absorb quietly.

You will see:

- more candidate tasks with incomplete context  
- more near-threshold signals that disagree across functions  
- more "almost auto" routes that need a human stamp  

If you do not design the exception layer, the floor will design it with phone calls.

## Framework: four exception paths (pick one per event type)

| Path | When it applies | Required record | Closure proof |
|---|---|---|---|
| Auto-task | inside published thresholds and policy | task ID, rule version, timestamp | completed work order or verified state |
| Advise-only | useful signal, human must claim | suggestion ID, claim owner, reason if rejected | explicit dismiss or convert-to-task |
| Escalate | SLA risk, safety, quality hold, cross-function conflict | escalation tier, owner, due time | resolution note tied to originating signal |
| Hard stop | regulatory, customer lock, or immature data | approval role, evidence link, release criteria | signed release or versioned rule change |

If a fifth path appears in practice ("just ask the engineer"), your model is incomplete.

## Checklist: minimum definitions before go-live

1. exception taxonomy: false positive, missing data, policy conflict, safety, customer, supplier  
2. ownership matrix: who is first responder per type on each shift  
3. escalation ladder: time-based steps, not personality-based steps  
4. approval rules: which path requires which role, including deputy coverage  
5. handoff fields: what the next shift must see in the system, not on paper  
6. rollback hook: how to pause assisted routing without losing the audit trail  
7. post-incident loop: when exceptions force a threshold or training change  

## Comparison: ticket culture versus closure culture

| Signal | Ticket culture | Closure culture |
|---|---|---|
| intent | log activity | finish the operational state |
| metric | backlog count | time-to-owner and time-to-closure |
| success | "we assigned it" | "the line is safe, sorted, and documented" |

AI assistance amplifies ticket culture unless you bind tasks to operational outcomes.

## Reality check: exception models usually fail when the floor invents a fifth path

Most teams can describe the official paths in a workshop.

The real test comes later, when the plant starts using unofficial workarounds such as:

- "call maintenance first and log it later"
- "leave it in advise until day shift arrives"
- "ask engineering informally because nobody owns this path"

The moment that hidden fifth path becomes normal, the model is no longer controlling assisted volume.

The floor is.

## Step sequence: roll out the model without drama

1. shadow mode: tag would-be exceptions without auto-routing  
2. weekly review: categorize the top twenty themes and assign owners  
3. publish v1 paths for three workflows only  
4. measure: median time-to-owner, repeat escalations, override reasons  
5. version the rulebook when thresholds move  

## When this model works

- supervisors already respect SLAs for manual work  
- you can keep one changelog for thresholds and modes  
- quality and maintenance agree on hold rules  

## When this model fails

- ERP or MES remains the only system of record and IRIS-like layers are optional  
- engineering edits rules without operations sign-off  
- night shift lacks deputy approvers  

## Why IRIS fits the exception layer naturally

DBR77 IRIS matters here because exception handling only works when assistance, tasks, approvals, and closure proof share one execution record instead of being reconstructed after the incident.

That turns exception design into an operating contract, not a side process built from chat history.

For the neighboring hardening pieces, see [When a Factory Needs One Operational Arbiter for Conflicting Signals](../42_when_a_factory_needs_one_operational_arbiter_for_conflicting_signals/article_EN.md), [How to Create Audit-Ready Records for AI-Assisted Factory Decisions](../46_how_to_create_audit_ready_records_for_ai_assisted_factory_decisions/article_EN.md), and [What Full Operational Closure Should Look Like in an AI-Native Factory](../50_what_full_operational_closure_should_look_like_in_an_ai_native_factory/article_EN.md).

## Final takeaway

Exception design is ownership design.

If every path names a responder, a time box, and a closure field, the plant can absorb higher assisted volume without losing control.
