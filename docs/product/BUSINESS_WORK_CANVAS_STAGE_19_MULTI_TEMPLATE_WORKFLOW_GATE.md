# Business Work Canvas Stage 19 Multi-Template Workflow Gate

Status: `DRAFT / STAGE 19 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 19 makes workflow templates operationally meaningful.

Before this stage, the workflow runtime had a governed ledger, approvals and output linkage, but template selection was not visible in the UI and plans were too generic. Stage 19 gives business users distinct workflow plans for common consulting work.

## 2. Completed Scope

- Added distinct workflow step plans for all supported templates.
- Preserved approval checkpoints before durable output creation.
- Preserved `draftId`, `conversationId` and `workflowRunId` anchors.
- Added Canvas diagnostics template selector before starting workflow runs.
- Kept existing resume, run-next, collaboration metadata and comments behavior.

## 3. Supported Templates

- Market research to report.
- Meeting note to initiatives.
- KPI review to dashboard.
- Client proposal to deck.
- Decision memo to execution plan.

## 4. Quality Gate

Stage 19 passes only when:

- template choice changes the generated workflow plan,
- template choice is available from Canvas diagnostics,
- workflow output generation still requires approval,
- targeted backend/frontend tests pass,
- changed files have no linter errors.
