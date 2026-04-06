# What an AI Agent Can Do in a Factory Today

Target persona: Operations Manager / Engineering Manager  
Funnel stage: Consideration  
Core problem: buyers hear "agent" language from vendors, but need a grounded scope list that matches real constraints: safety, approvals, traceability, and existing systems  
Main promise: a practical boundary map of what an AI agent can reliably support now, what still belongs to humans, and what requires a unified execution layer to work at all

**Direct answer:** Today, a factory AI agent can reliably assist with triage, context assembly, draft task proposals, threshold-based routing suggestions, and follow-up checks inside governed workflows. It should not be treated as an autonomous operator of the physical plant without hard guardrails and human decision gates.

"Agent" is becoming a noisy word.

In operations, the useful question is narrower:

what work can an agent perform inside real factory constraints?

## Define the agent as a workflow participant

For this article, an agent means software that can:

- read signals and documents in scope
- propose structured next steps
- interact with workflows through allowed interfaces
- stop at defined approval boundaries

It does not mean "unsupervised control of assets."

## What an agent can do today (illustrative scope)

These are common, defensible capabilities when the plant has decent data access and clear workflows:

**Triage and clustering**  
Group alarms, quality notes, and maintenance requests so humans review bundles, not noise.

**Context packets**  
Attach relevant parameters, recent changes, and linked work history to a new ticket.

**Draft routing**  
Suggest owner, priority band, and due time based on rules and history, for human confirmation.

**Threshold monitoring**  
Flag when a KPI or condition crosses a pre-agreed boundary and open a governed work item.

**Follow-through nudges**  
Detect stalled tasks and suggest escalation paths that still require a person to accept.

Treat these as illustrative patterns, not a guarantee for every environment.

## What still belongs to humans in most plants

Even strong AI should not quietly own:

- safety-critical overrides
- quality release decisions with regulatory exposure
- capital or major schedule commitments
- disciplinary or HR-linked judgments
- supplier contract changes

These are ownership and liability boundaries, not technology limits alone.

## A three-zone framework: assist, recommend, act

| Zone | What happens | Typical controls |
|---|---|---|
| Assist | prepares information | logging, scope limits |
| Recommend | proposes an action | human confirm, reason codes |
| Act | changes system state | strict roles, approvals, audit trail |

Healthy factory programs expand Assist first, tighten Recommend with approvals, and treat Act as rare and explicit.

## Preconditions that separate demo from operations

An agent becomes operationally serious only if the plant can answer:

1. What systems is the agent allowed to touch?
2. What is the audit trail for each suggestion and action?
3. Which actions always require human approval?
4. How are conflicting definitions resolved before automation?
5. How is failure handled when the agent is wrong?

If those answers are vague, keep the agent in Assist mode.

## Reality check: most agent projects fail when people mistake workflow speed for autonomy

The first version often looks impressive because it drafts quickly, routes quickly, and sounds confident.

The failure appears when the plant quietly assumes that:

- a drafted action is already an approved action
- a suggested owner is the same as accountable ownership
- a smart interface removes the need for clear workflow rules

That is how "agent" turns from a useful helper into a new source of ambiguity.

## Why IRIS matters for agent usefulness

DBR77 IRIS matters here because useful agents need a governed place to attach context, draft work, and stop at approval gates.

That is how agent behavior stays visible to operations instead of floating above fragmented tools and private chats.

If you are defining what an agent may do, start here; for decision-rights thresholds see [When AI Should Recommend and When Humans Should Decide in Operations](../26_when_ai_should_recommend_and_when_humans_should_decide_in_operations/article_EN.md), and for leadership trust criteria see [What Makes Factory AI Trustworthy for Operations Leaders](../29_what_makes_factory_ai_trustworthy_for_operations_leaders/article_EN.md).

## Final takeaway

An AI agent in a factory today is best understood as a disciplined workflow helper, not a silent decision maker.

The maturity of your execution layer determines how much of its capability you can safely use.
