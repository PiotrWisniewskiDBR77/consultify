# When AI Should Watch, Advise, or Act in the Factory

Target persona: Operations Director / IT-OT Architect / Quality and Safety Lead  
Funnel stage: Decision  
Core problem: plants toggle between "AI does nothing" and "AI does too much" because they never publish operational modes tied to thresholds and accountability  
Main promise: a three-mode framework (watch, advise, act) mapped to signals, reversibility, and approval paths, separate from generic autonomy debates

AI should watch when you need consistent detection and logging without changing workflow state. It should advise when humans must confirm before tasks, routings, or messages leave draft form. It should act only inside narrow, published rules with audit trails, rollback paths, and explicit owners for exceptions. The choice is not philosophy. It is threshold design plus liability alignment. This complements risk-class decision rights. It answers deployment mode, not only who signs.

## Mode 1: watch

**Definition** AI monitors streams, tags anomalies, and writes structured events. It does not create obligations for others without a human or rule trigger.

**Use when** - definitions are still stabilizing - you need baseline false-positive rates - cultural trust is low but measurement is urgent

**Proof you are doing it right** - event catalog is reviewed weekly - supervisors can ignore alerts without breaking metrics integrity - noise rates trend down with reason-code discipline

## Mode 2: advise

**Definition** AI proposes ranked actions, drafts tasks, and suggests routings. Nothing becomes binding until a human confirms or a second rule gate passes.

**Use when** - cross-functional tradeoffs need judgment - similar past cases help, but are not law - you want speed without silent commitments

**Proof you are doing it right** - median time from suggestion to accept or reject is measured - overrides are categorized, not treated as shameful noise - drafts reduce typing time without skipping required fields

## Mode 3: act

**Definition** The system performs allowed operations automatically: enqueue work, notify roles, escalate at timers, or apply non-destructive routings within caps.

**Use when** - rules are boring, frequent, and well-bounded - reversibility is fast and cheap - failure modes are contained and visible

**Proof you are doing it right** - every automated action has a cited rule version - exception queues have owners and SLA - pause switches exist for maintenance windows and incidents

## Decision matrix: pick a starting mode

| Situation | Start in | Move up when |
|---|---|---|
| new line or new data feed | watch | stable definitions and measured noise |
| multi-team disputes on priority | advise | acceptance rate high, overrides explainable |
| repeat clerical routing with clean rules | act | audits clean for two review cycles |

## Handoffs between modes

Plants fail when they jump from watch to act because a vendor demo looked good.

Healthy sequence: watch until definitions hold across shifts; advise until acceptance and override patterns are understood; act only on the narrowest slice with caps.

## Reality check: mode drift is usually an operating problem, not a technical one

Many teams say they are still in advise mode. But in daily work, the plant has already started treating suggestions as binding because:

- teams are overloaded and stop reviewing carefully
- exception queues have no visible owner
- nobody notices that draft routing is now behaving like auto-routing

That is why mode discipline has to be published in workflow rules, not left to good intentions.

## Why IRIS supports mode discipline

DBR77 IRIS matters here because watch, advise, and act are only meaningful when each mode is attached to real tasks, approvals, pause switches, and exception queues.

That keeps deployment mode visible in the workflow instead of leaving it buried in a vendor setting.

If you need the shift and function governance around those modes, see [How to Govern AI Decisions Across Shifts and Functions](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_EN.md); if you need the approval gates, see [What a Human Approval Policy Should Look Like in Factory AI](../39_what_a_human_approval_policy_should_look_like_in_factory_ai/article_EN.md).

## Final takeaway

Watch measures, advise confirms, acts inside rules. Publish the mode per workflow, not per press release.

---

*DBR77 IRIS binds watch, advise, and act behaviors to workflow states, tasks, and approvals so modes are enforceable, not rhetorical. [Start 14-day trial](https://dbr77.com/iris) or [Start interactive demo](https://dbr77.com/demo).*
