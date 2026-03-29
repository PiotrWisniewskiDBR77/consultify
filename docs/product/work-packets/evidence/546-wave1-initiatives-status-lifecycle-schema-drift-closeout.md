# 546 - Wave 1 initiatives status lifecycle schema-drift closeout

Date: 2026-03-29
Lane: first-tranche `must have` / `Inicjatywy`
Status: historical blocker closeout, later initiatives ratification applied

## Problem

During live manual acceptance on `https://consultify.ai/initiatives`, a freshly created initiative could:

- save owner updates successfully via `PUT /api/initiatives/:id`
- refresh governed readback successfully via V8 detail/readiness/history endpoints
- but fail on status submit with:
  - `PATCH /api/initiatives/:id/status -> 500`

This blocked the must-have transition flow for `DRAFT -> PENDING_REVIEW` even after the owner-edit deadlock had already been fixed.

## Root cause

The legacy status mutation in `server/src/controllers/InitiativeController.ts` still assumed that the `initiatives` table always contained the full lifecycle column set, including newer optional fields such as:

- `review_requested_at`
- `review_requested_by`
- `approved_at`
- `approved_by`
- `approval_comment`
- `blocked_at`
- `blocked_reason`
- `done_at`
- `done_by`
- `completed_at`
- `cancelled_at`
- `cancelled_reason`
- `archived_at`

On the live environment, `review_requested_at` was missing. The controller built a hardcoded `UPDATE initiatives SET ... review_requested_at = ? ...` statement and Postgres rejected it with:

- `column "review_requested_at" of relation "initiatives" does not exist`

## What landed

- made `updateInitiativeStatus` schema-aware for optional lifecycle columns
- added shared helpers in `InitiativeController.ts` to:
  - normalize available column names into a set
  - append lifecycle updates only when the target column exists
- preserved the canonical mutation path:
  - always update required fields like `status` and `updated_at`
  - only write optional lifecycle metadata when present in the current schema
- kept status-history / initiative-history writes best-effort as before

This prevents one missing lifecycle column from crashing the entire transition endpoint on partially migrated environments.

## Verification

Automated:

- `npm exec vitest run tests/unit/backend/controllers/InitiativeController.test.ts`

Added regression coverage for:

- submitting for review when `review_requested_at` / `review_requested_by` are absent from the schema
- ensuring the generated initiative update SQL omits those missing columns instead of throwing

Result:

- `19 / 19` tests passed

Static:

- `ReadLints` on touched controller + test files returned no diagnostics

## Manual status

Live manual acceptance reproduced the production failure and captured the exact failing request:

- `PATCH /api/initiatives/:id/status -> 500`

Live Railway logs confirmed the schema-drift root cause:

- `column "review_requested_at" of relation "initiatives" does not exist`

At the time of this closeout, hosted manual re-check was still required after deploy to confirm:

1. `DRAFT -> PENDING_REVIEW` succeeds on the live initiative created during the gate
2. status readback stays aligned in the open document
3. readiness refresh still returns `200`
4. compact-panel status flow no longer inherits the same backend failure

Current authority:

- live initiatives manual gate pass is recorded in `547-wave1-initiatives-manual-gate-pass.md`
- final module closure is ratified in `548-v81-wave1-final-module-gate-ratification.md`

## Why this matters

Without this fix, `Inicjatywy` could look functionally complete in local tests and still fail at the first real governance transition on production because the write path remained stricter than the live schema.
