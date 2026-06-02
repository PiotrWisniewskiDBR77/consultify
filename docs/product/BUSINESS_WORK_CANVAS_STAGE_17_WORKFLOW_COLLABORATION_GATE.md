# Business Work Canvas Stage 17 Workflow Collaboration Gate

Status: `DRAFT / STAGE 17 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 17 adds review metadata and persisted comments to governed Canvas workflows.

The goal is not realtime collaboration. The goal is a reliable business review layer around workflow outputs: owner, reviewer, lifecycle and comments are part of the workflow ledger and survive draft saves.

## 2. Completed Scope

- Workflow runs now support collaboration metadata.
- Workflow collaboration metadata includes owner, reviewer, lifecycle and comments.
- Backend exposes update collaboration and add comment endpoints.
- Canvas diagnostics displays review metadata and recent comments.
- Review actions are metadata-only and do not execute workflow steps.

## 3. Safety Contract

- Review lifecycle changes do not mutate durable outputs.
- Comments are persisted in Canvas provenance rather than shown as placeholder UI.
- Workflow context anchors remain `workflowRunId`, `draftId` and `conversationId`.

## 4. Quality Gate

Stage 17 passes only when:

- workflow review metadata persists,
- comments persist,
- existing workflow create/resume/run-next behavior still passes,
- targeted tests pass,
- changed files have no linter errors.
