# Business Work Canvas Stage 30 Workflow In-Flight Guard

Status: `DRAFT / STAGE 30 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 30 prevents duplicate workflow execution requests caused by rapid repeated clicks.

Stage 29 protects the backend from terminal workflow re-execution. This stage improves the live UI path by disabling the execution control immediately while `run-next` is already in flight.

## 2. Completed Scope

- Added per-workflow in-flight state for `run-next`.
- Disabled the execution CTA during an active request.
- Added a temporary `Running...` CTA label.
- Added component coverage that verifies duplicate clicks do not send another request from the disabled control.

## 3. Safety Contract

- Frontend in-flight state is ergonomic protection, not the source of truth.
- Backend terminal-state and conflict guards remain authoritative.
- In-flight state clears on success or failure.
- Completed workflow UI still resolves to terminal-state controls.

## 4. Quality Gate

Stage 30 passes only when:

- visible repeated clicks cannot submit duplicate execution requests,
- users get immediate loading feedback,
- successful completion still shows terminal status,
- targeted tests pass,
- changed files have no linter errors.
