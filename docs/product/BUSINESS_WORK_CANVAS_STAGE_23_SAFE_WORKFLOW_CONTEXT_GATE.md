# Business Work Canvas Stage 23 Safe Workflow Context Gate

Status: `DRAFT / STAGE 23 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 23 hardens Canvas workflow context before it reaches Teresa.

Workflow runs contain operational details such as comments, events and metadata. Teresa needs the current state and recent summaries, not raw workflow provenance. This stage replaces full workflow run objects in the AI context packet with sanitized summaries.

## 2. Completed Scope

- Converted `canvas-context/v1.workflowRuns` to safe workflow run summaries.
- Preserved run, draft and conversation anchors.
- Preserved step summaries, approval statuses, lifecycle and output count.
- Kept event and output detail in dedicated safe summary arrays.
- Excluded raw comments, raw events and event metadata from workflow run summaries.

## 3. Safety Contract

- Raw workflow comments do not enter the AI context packet through `workflowRuns`.
- Raw event metadata does not enter workflow run summaries.
- Teresa still receives enough workflow state to reason about next approved actions.

## 4. Quality Gate

Stage 23 passes only when:

- workflow run context is sanitized,
- event and output summaries retain anchors,
- raw comments and event metadata are excluded,
- targeted context tests pass,
- changed files have no linter errors.
