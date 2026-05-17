# Business Work Canvas Stage 20 Workflow Timeline Gate

Status: `DRAFT / STAGE 20 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 20 adds an execution timeline to governed Canvas workflows.

The Canvas workflow ledger already tracks steps, approvals, outputs and review metadata. This stage adds a durable event trail so business users can see what happened to a workflow and when.

## 2. Completed Scope

- Persisted workflow events on each workflow run.
- Recorded create, approval required, resume, approve, output created, collaboration update and comment events.
- Added actor, event type, summary, timestamp and optional metadata.
- Rendered a compact workflow timeline in Canvas diagnostics.

## 3. Safety Contract

- Timeline events are read-only from the UI.
- Timeline events do not trigger output generation.
- Events remain anchored to `workflowRunId`, `draftId` and `conversationId` through workflow provenance.

## 4. Quality Gate

Stage 20 passes only when:

- timeline events persist,
- timeline is visible in Canvas diagnostics,
- approval and output events are recorded during workflow execution,
- collaboration/comment actions record events,
- targeted backend/frontend tests pass,
- changed files have no linter errors.
