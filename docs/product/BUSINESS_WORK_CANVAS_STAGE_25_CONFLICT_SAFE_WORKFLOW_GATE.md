# Business Work Canvas Stage 25 Conflict-Safe Workflow Gate

Status: `DRAFT / STAGE 25 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 25 makes workflow actions conflict-safe.

Workflow operations mutate Canvas provenance and can create durable versions/outputs. They must carry the same optimistic locking contract as draft saves and block operations.

## 2. Completed Scope

- Propagated `baseUpdatedAt` from Canvas UI workflow actions.
- Reused backend `CANVAS_DRAFT_CONFLICT` handling for workflow mutations.
- Covered create, resume, run-next, collaboration update and comment actions.
- Preserved friendly frontend conflict messaging.

## 3. Safety Contract

- Stale workflow actions do not mutate workflow provenance.
- Stale `run-next` does not create versions or outputs.
- Conflict responses remain recoverable and user-readable.

## 4. Quality Gate

Stage 25 passes only when:

- workflow mutations carry `baseUpdatedAt`,
- stale workflow actions are rejected before persistence,
- targeted tests pass,
- changed files have no linter errors.
