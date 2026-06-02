# Business Work Canvas Stage 31 Workflow Mutation In-Flight Guards

Status: `DRAFT / STAGE 31 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 31 applies the same in-flight reliability pattern to all workflow mutation controls.

Stage 30 protected `run-next`. This stage protects workflow creation, resume, review metadata updates and comment creation from accidental repeated clicks.

## 2. Completed Scope

- Added in-flight state for `Start workflow`.
- Added per-workflow in-flight state for `Resume`.
- Added per-workflow in-flight state for review metadata updates.
- Added per-workflow in-flight state for workflow comments.
- Added visible temporary labels for each mutation.
- Added component coverage for duplicate workflow creation prevention.

## 3. Safety Contract

- Frontend in-flight state prevents duplicate visible submissions.
- Backend optimistic locking from Stage 25 remains authoritative for stale state conflicts.
- Backend terminal-state and review gates remain authoritative for execution rules.
- In-flight flags clear in `finally` on success or failure.

## 4. Quality Gate

Stage 31 passes only when:

- workflow creation controls disable immediately while a request is active,
- resume/review/comment controls show in-flight state,
- completed requests restore normal controls or updated workflow state,
- targeted tests pass,
- changed files have no linter errors.
