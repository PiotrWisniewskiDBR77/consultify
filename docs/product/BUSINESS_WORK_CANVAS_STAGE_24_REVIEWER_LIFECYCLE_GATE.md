# Business Work Canvas Stage 24 Reviewer Lifecycle Gate

Status: `DRAFT / STAGE 24 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 24 makes workflow review metadata enforceable.

When a workflow is sent to review or has an assigned reviewer, durable output generation must wait until the workflow lifecycle is explicitly marked `approved`.

## 2. Completed Scope

- Added backend review lifecycle gate to workflow `run-next`.
- Kept explicit execution approval as a separate requirement.
- Added recoverable `CANVAS_WORKFLOW_REVIEW_REQUIRED` response.
- Added frontend user feedback for review-gated workflow execution.

## 3. Safety Contract

- Review-gated failures do not create versions or outputs.
- Workflows without reviewer/review lifecycle preserve existing run-next behavior.
- Review lifecycle approval does not itself execute workflow steps.

## 4. Quality Gate

Stage 24 passes only when:

- in-review workflows require lifecycle `approved`,
- explicit execution approval is still required,
- frontend explains the blocked state,
- targeted tests pass,
- changed files have no linter errors.
