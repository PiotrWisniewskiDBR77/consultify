# How AI Can Prioritize Factory Issues Across Functions

Target persona: Plant Manager / Operations Excellence Lead  
Funnel stage: Consideration  
Core problem: cross-functional issues compete for attention using different languages, and the plant loses time arguing about urgency instead of executing  
Main promise: a practical method to combine signals, apply a transparent rubric, and route prioritized work with human confirmation at defined thresholds

**Direct answer:** AI can prioritize factory issues across functions by normalizing signals into one work-item model, scoring with an explicit rubric (severity, customer impact, safety, downtime risk), and routing ranked queues while reserving human confirmation for high-impact changes.

Prioritization is a political process disguised as a technical one.

AI helps only when the politics become visible and rule-bound.

## Step 1: normalize intake so issues become comparable

Different functions describe pain differently.

AI assistance starts with structure:

- common required fields
- shared severity scale
- explicit link to asset, order, customer, or batch where possible

If intake is free text only, you will get impressive summaries and weak prioritization.

## Step 2: build a rubric everyone can argue with

A usable rubric includes a small number of dimensions:

**Safety and compliance exposure**  
Binary or tiered, but not vague.

**Customer and schedule impact**  
Late risk, line down risk, premium customer flags.

**Operational drag**  
Throughput, scrap risk, rework hours if known.

**Recurrence**  
Is this the same failure mode as last week?

Keep weights simple at first.

Complexity is not sophistication.

## Step 3: let AI propose scores, humans calibrate early

A practical rollout pattern:

1. AI proposes scores and rationale snippets
2. supervisors adjust with reason codes for two to four weeks
3. freeze weights after calibration unless KPIs shift

This trains the model and trains the organization.

## Step 4: route ranked work, do not only rank reports

Prioritization without routing is a meeting substitute.

Each prioritized item should:

- land with an owner role
- carry context for handoff
- have a due clock
- have escalation if stalled

## Step 5: use thresholds for automatic moves versus human gates

Example threshold logic (illustrative):

- below a combined score, auto-assign to standard queue
- above the score, require shift lead confirmation
- above a higher tier, require cross-functional triage window

Thresholds should be published.

Secret thresholds create distrust.

## Anti-patterns that break cross-functional prioritization

- separate "AI priorities" in a tool nobody operates from
- ranking that ignores maintenance capacity reality
- prioritization without closure metrics

## Why IRIS is the right substrate for cross-functional prioritization

DBR77 IRIS matters here because cross-functional prioritization fails when ranking logic and execution routing live in different places.

The plant needs one shared intake, one visible rubric, and one path from priority to owned work.

If the missing step is the decision layer itself, see [Why Factories Need One Decision Layer Before More AI Models](../27_why_factories_need_one_decision_layer_before_more_ai_models/article_EN.md); this article picks up after that by showing how to score and route work across functions.

## Final takeaway

AI prioritization works when the plant commits to shared intake, a visible rubric, and routed follow-through.

Otherwise AI becomes another opinion in the room.
