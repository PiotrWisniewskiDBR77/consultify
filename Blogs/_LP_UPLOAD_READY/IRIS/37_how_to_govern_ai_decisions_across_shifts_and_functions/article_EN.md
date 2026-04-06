# How to Govern AI Decisions Across Shifts and Functions

Target persona: Plant Director / Transformation PMO / Quality Systems Owner  
Funnel stage: Decision  
Core problem: AI governance documents live in IT while night shift runs with different habits, and quality, maintenance, and logistics each interpret "assist" differently  
Main promise: a practical governance grid: ownership, change control, shift handoffs, and exception paths that make AI rules operable 24/7

**Direct answer:** Govern AI decisions across shifts and functions by publishing one rulebook tied to workflows: who can change thresholds, how changes are versioned, what the shift handoff must include, and which function signs which exception path. Then measure drift: override rate by shift, stale suggestion rate, and time-to-owner for AI-tagged work. Governance that does not show up in shift turnover is only compliance theater.

This is operations governance.

It is not an ethics PDF in a drawer.

## Grid 1: RACI for AI rule changes

Keep it blunt.

| Activity | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| propose threshold change | function owner | continuous improvement lead | IT-OT, quality | plant manager |
| test in shadow | IT-OT | system admin | function owner | supervisors |
| publish version | plant manager | system admin | legal or quality as needed | all shifts |
| emergency rollback | on-call operations lead | system admin | safety, quality | plant manager |

If "Accountable" is empty, you will get silent edits.

## Grid 2: shift handoff fields for AI-assisted workflows

Night must inherit the same contract as day.

Minimum handoff record:

- active modes per workflow (watch, advise, act)  
- known model or rule version IDs  
- open exception queue depth and oldest item age  
- top three false-positive themes from the prior shift  
- explicit "do not auto-route" flags during incidents  

Paper handoffs without system fields recreate tribal knowledge.

## Function boundaries: who owns cross-team conflicts

AI will surface conflicts faster.

Pre-assign arbitration:

- production versus maintenance priority disputes: name a single arbiter role per week  
- quality release versus schedule pressure: published escalation ladder  
- warehouse versus line shortages: joint morning cap on act-mode moves  

Unassigned conflict resolution becomes "whoever shouts loudest."

That breaks trust in assistance.

## Change control that fits factory speed

Use two tracks:

**Standard track**  
Weekly review, documented test in shadow, published changelog.

**Emergency track**  
Pause act mode, revert to advise, post incident note within 24 hours.

If emergency track does not exist, teams will hot-fix in production silently.

## Reality check: governance usually breaks at shift boundaries, not in steering meetings

Most plants can explain their governance model in a conference room.

The harder question is whether the incoming shift can tell, in under two minutes:

- which mode is active
- which rule version is live
- which exceptions are already aging
- who owns the next escalation if something drifts further

If that answer depends on memory, calls, or one experienced supervisor, governance is still informal.

## Metrics that expose shift and function drift

Track weekly:

- override rate by shift and by workflow  
- median accept time for advise-mode suggestions  
- count of AI-tagged tasks that aged past SLA  
- incidents where rule version was unknown to the incoming shift  

Rising drift without a named owner is a governance failure, not a model failure.

## Why IRIS makes cross-functional governance concrete

DBR77 IRIS matters here because governance stops being tribal only when rule versions, tasks, approvals, and handoff state are visible in one operational layer.

That is what lets day shift, night shift, quality, and maintenance inherit the same contract instead of reinventing it locally.

If you need the deployment modes those rules govern, see [When AI Should Watch, Advise, or Act in the Factory](../36_when_ai_should_watch_advise_or_act_in_the_factory/article_EN.md); if you need the scale controls after governance is in place, see [How to Scale AI Assistance Without Losing Operational Control](../38_how_to_scale_ai_assistance_without_losing_operational_control/article_EN.md).

## Final takeaway

Govern AI where work happens: versions, shifts, and named arbiters.

If night shift cannot read the rule state in the system, you do not govern yet.
