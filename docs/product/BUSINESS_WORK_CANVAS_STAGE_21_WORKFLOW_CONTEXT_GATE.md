# Business Work Canvas Stage 21 Workflow Context Gate

Status: `DRAFT / STAGE 21 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 21 connects the workflow execution timeline to Teresa's Canvas context.

The intent is not to send raw provenance or native block JSON to the model. The intent is a compact working-memory summary of what recently happened in governed workflows.

## 2. Completed Scope

- Added workflow event summaries to `canvas-context/v1`.
- Summaries include workflow run id, workflow title, event type, actor, summary and timestamp.
- Injected recent workflow timeline into Teresa's Canvas system instruction.
- Added workflow event types to Wave context facts.

## 3. Safety Contract

- Raw native block JSON remains excluded from Canvas context.
- Raw workflow event metadata is not projected into the context summary.
- Workflow anchors remain `workflowRunId`, `draftId` and `conversationId`.

## 4. Quality Gate

Stage 21 passes only when:

- workflow event summaries are present in the Canvas context packet,
- Teresa receives readable recent workflow timeline context,
- memory facts include workflow event types,
- targeted tests pass,
- changed files have no linter errors.
