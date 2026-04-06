# KPI AI Support Analysis

## Context

The KPI model now treats `Initiative -> KPI assignment -> observation phase -> report` as the core operational flow.
This creates a much better place for AI support than the previous flat KPI list, because the assistant can reason inside a known initiative context, lifecycle bucket, and observation expectation.

## Where AI Helps Most

### 1. KPI Definition In Initiative Context

AI can help when a team is configuring KPI assignments inside an initiative or initiative template.

Best support:
- propose KPI candidates from initiative objective, scope, and expected operational effect
- suggest phase split: `realization`, `post-implementation`, or both
- draft baseline and target hypotheses
- recommend measurement cadence and owner role
- detect vague KPI names such as "quality improvement" and turn them into measurable definitions

Guardrails:
- AI should suggest, not auto-publish
- every KPI needs an explicit human owner
- every target must show the assumptions behind it

### 2. Monitoring During Realization

AI can work as a monitoring copilot for initiatives in `APPROVED`, `SCHEDULED`, and `EXECUTING`.

Best support:
- highlight initiatives whose tracked KPIs have no recent entry
- detect KPI combinations that indicate delivery risk
- summarize what changed since the previous observation period
- generate "needs review" narratives for the report flow
- prioritize which initiatives should enter the scorecard/reconciliation lane first

Guardrails:
- AI should rank and explain, not silently change KPI status
- all recommendations must cite current KPI values, deltas, and missing data

### 3. Post-Implementation Observation

The new split between realization and post-implementation creates a strong AI use case after delivery is marked done.

Best support:
- compare expected vs. actual operational effect after implementation
- identify initiatives that are technically closed but operationally underperforming
- explain whether a KPI miss looks like adoption delay, measurement gap, or wrong target design
- recommend whether an initiative should stay observed, be escalated, or be closed from KPI observation

Guardrails:
- no automatic closure of observation
- financial consequences should stay linked to ROI and finance lanes, not rewritten inside KPI

### 4. Report Preparation

AI can reduce the manual work of building KPI reports without replacing operator judgment.

Best support:
- draft report titles and executive summaries from selected initiatives and KPI set
- cluster deviations into themes
- convert raw KPI movement into plain-language operational interpretation
- propose action plan items with urgency, owner role, and due-date suggestion
- identify which initiatives are missing from the report scope based on lifecycle and active KPI alerts

Guardrails:
- report creation should remain deterministic about selected initiative IDs and KPI IDs
- AI-generated actions should start as editable draft actions

### 5. Reconciliation And Next Actions

AI is especially useful after the report exists and the system already has structured evidence.

Best support:
- explain likely root-cause patterns across multiple KPI deviations
- detect repeated action plans that are not improving results
- suggest when a KPI issue should become a task, escalation, or initiative change request
- surface conflicts between KPI improvement and ROI expectations

Guardrails:
- no direct write to tasks or initiative status without human confirmation
- any suggested escalation should include the evidence packet that triggered it

## Highest-Value AI Features To Build First

1. KPI definition copilot inside initiative KPI setup
2. observation-gap detector for `needs entry`, stale cadence, and inconsistent targets
3. report drafting assistant for the `Results / Reports` tab
4. post-implementation outcome reviewer for realized initiatives still under observation

## Features To Avoid Early

- full autonomous KPI creation without review
- automatic target rewriting based on sparse history
- direct status mutation of initiatives from AI output
- merging KPI and ROI reasoning into one opaque recommendation stream

## Product Principle

AI should accelerate KPI reasoning, not become a second source of truth.
The source of truth remains:
- initiative lifecycle
- KPI assignment definition
- recorded measurements
- human-approved reports and actions

## Suggested Next Delivery Slice

Build one narrow AI workflow first:

`Initiative KPI setup -> AI suggests KPI definition pack -> user approves -> runtime monitor explains drift -> report assistant drafts summary/action items`

This path gives the best ratio of value to risk because it stays close to the new initiative-centric KPI model and reuses structured data already present in the product.
