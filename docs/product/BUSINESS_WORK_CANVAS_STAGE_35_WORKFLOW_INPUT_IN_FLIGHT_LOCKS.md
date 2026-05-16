# Business Work Canvas Stage 35 Workflow Input In-Flight Locks

Status: `DRAFT / STAGE 35 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 35 locks workflow inputs while their matching mutation is being saved.

This prevents users from editing reviewer or comment fields during an in-flight request, which could otherwise create confusing local state or discard edits after the response returns.

## 2. Completed Scope

- Disabled reviewer input during review metadata updates.
- Disabled comment input during comment creation.
- Preserved existing in-flight button labels and states.
- Extended reviewer preservation coverage to assert input locking during approval.

## 3. Safety Contract

- Backend remains authoritative for persisted workflow metadata.
- UI locks only apply while a matching request is in flight.
- Locks clear via existing `finally` blocks on success or failure.

## 4. Quality Gate

Stage 35 passes only when:

- reviewer input cannot change during review metadata save,
- comment input cannot change during comment save,
- controls recover after request completion,
- targeted tests pass,
- changed files have no linter errors.
