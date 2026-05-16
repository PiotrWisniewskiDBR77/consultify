# Business Work Canvas Stage 22 Workflow Output Ledger Gate

Status: `DRAFT / STAGE 22 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 22 makes workflow-generated deliverables visible in the Canvas workflow ledger and available to Teresa as safe context.

The goal is operational usability: when a workflow creates a report, deck, table or other downstream output, users should see it where the workflow lives.

## 2. Completed Scope

- Rendered workflow outputs in Canvas diagnostics.
- Added output type, title and open link.
- Added workflow output summaries to `canvas-context/v1`.
- Injected workflow outputs into Teresa's Canvas instruction.
- Added workflow output ids to Wave context facts.

## 3. Safety Contract

- Output summaries are lightweight and do not include raw native payloads.
- Output summaries preserve `workflowRunId`, `stepId`, output id and output type.
- Output visibility does not execute or mutate downstream artifacts.

## 4. Quality Gate

Stage 22 passes only when:

- workflow outputs are visible in the UI,
- output summaries are included in Canvas context,
- Teresa receives readable workflow output context,
- targeted tests pass,
- changed files have no linter errors.
