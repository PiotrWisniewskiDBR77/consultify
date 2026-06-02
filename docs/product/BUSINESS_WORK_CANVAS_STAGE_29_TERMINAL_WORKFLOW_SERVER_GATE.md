# Business Work Canvas Stage 29 Terminal Workflow Server Gate

Status: `DRAFT / STAGE 29 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 29 makes terminal workflow execution protection authoritative on the backend.

Stage 28 made the UI stop presenting completed or failed workflow runs as executable. This stage ensures the same rule is enforced for direct API calls and older clients.

## 2. Completed Scope

- Added a backend `run-next` guard for workflow runs with status `completed` or `failed`.
- Added recoverable `409 CANVAS_WORKFLOW_TERMINAL_STATE`.
- Included workflow id, terminal status and output count in the error payload.
- Added frontend copy for terminal-state conflicts.
- Added integration coverage for repeated `run-next` after completion.

## 3. Safety Contract

- Terminal workflow rejection happens before version snapshots, output creation and workflow event writes.
- Existing review lifecycle and approval checkpoint gates remain unchanged for active workflows.
- UI state remains advisory; backend state remains authoritative.

## 4. Quality Gate

Stage 29 passes only when:

- completed workflows cannot generate duplicate outputs through direct API calls,
- failed workflows are also protected from execution,
- frontend users see a readable message,
- targeted tests pass,
- changed files have no linter errors.
