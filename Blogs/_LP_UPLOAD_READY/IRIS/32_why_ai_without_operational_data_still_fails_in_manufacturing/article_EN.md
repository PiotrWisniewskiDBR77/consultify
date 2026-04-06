# Why AI Without Operational Data Still Fails in Manufacturing

Target persona: Plant IT-OT Lead / Data Owner / Program Sponsor  
Funnel stage: Awareness  
Core problem: teams ship models on curated datasets while the plant still runs on partial logs, late entries, and conflicting definitions, so assistance cannot close loops  
Main promise: a blunt checklist of what counts as operational data for factory AI, and why missing pieces turn assistants into expensive summarizers

**Direct answer:** AI without operational data still fails in manufacturing because models need the same objects the floor uses: orders, routes, tasks, approvals, downtime reasons, quality holds, and maintenance work packages tied to assets and shifts. If those records are incomplete, delayed, or defined differently per function, AI can generate fluent text and still cannot drive response, ownership, or follow-through.

This is not a "data lake size" problem.

It is a "can the system task a credible next step" problem.

## What "operational data" means in a plant context

Operational data is anything a supervisor would use to run the next two hours without a side meeting.

Minimum credible set:

- work identity: what order, batch, or job is active  
- state: running, waiting, blocked, held  
- ownership: who is responsible right now  
- timestamps that match shift reality, not batch ETL windows  
- reason codes that people actually select under pressure  
- closure evidence: what changed, who approved it, when it ended  

If your AI cannot point to those fields, it is not grounded in operations.

It is grounded in slides.

## Common failure pattern: clean history, dirty present

Plants often train or prompt on:

- last quarter exports  
- harmonized KPI spreadsheets  
- manually cleaned "golden weeks"

Then they deploy into:

- partial scans  
- missing downtime reasons  
- quality notes in personal inboxes  

The model looks smart in a demo.

It fails in Tuesday night reality.

## Checklist: operational readiness for AI assistance

Use this as a gate before expanding model scope.

1. can we name the top 20 operational objects (order, asset, task, hold, work order) in one glossary?  
2. do those objects appear in one system of record for execution, not only in reporting?  
3. is tasking mandatory for exceptions, or optional "when someone remembers"?  
4. do approvals leave an audit trail with actor and time?  
5. can we measure response time from trigger to assigned owner?  
6. do night and weekend shifts enter data with the same fields as days?  

If you answer "no" more than twice, fix data discipline before buying another model.

## Comparison: reporting-grade data versus execution-grade data

| Signal | Reporting-grade | Execution-grade |
|---|---|---|
| downtime | monthly rollup | reasoned events tied to assets and tasks |
| quality | defect count | holds with disposition path and approvals |
| maintenance | cost center totals | work orders with parts, labor, and closure |
| warehouse | inventory snapshot | moves tied to production signals and owners |

AI on reporting-grade data produces commentary.

AI on execution-grade data can propose routed work with accountability.

## Reality check: the data problem usually shows up in the current shift, not in last quarter

Many programs look healthy in historical exports.

The weakness appears in live operations when:

- the active order changed but the model still sees yesterday's context
- downtime reasons are blank because the shift is under pressure
- the approval exists verbally, but not in a record the next shift can inspect

That is why "good enough for analytics" is often still not good enough for assistance.

## When partial data is acceptable

Partial data can work for narrow advisory scopes:

- triage of repeat questions with human confirm  
- draft checklists where every step is reviewed  
- ranking suggestions that never auto-assign  

The failure mode is pretending those narrow scopes are "plant AI."

## Why IRIS is built around execution-grade records

DBR77 IRIS matters here because execution-grade records are not a reporting afterthought. They are the live objects that let the plant assign owners, route exceptions, and close work with evidence.

When work items, approvals, and closures share one layer, operational data stops being an analytics project and becomes the daily spine of assistance.

If you want the next step after that data spine exists, see [How AI Can Reduce Downtime When Response Loops Exist](../33_how_ai_can_reduce_downtime_when_response_loops_exist/article_EN.md).

## Final takeaway

Operational AI needs operational objects, live ownership, and closure discipline.

A model without that spine becomes a fast typist for confusion.
