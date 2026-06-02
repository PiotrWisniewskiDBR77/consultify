# Business Work Canvas Stage 8 Team Workflow Runtime Gate

Status: `DRAFT / STAGE 8 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 8 introduces the first governed workflow ledger for Work Canvas.

The goal is to move toward a Manus-like operating workspace while preserving the Consultify governance model: Teresa can frame and resume work, but durable actions still require visible approval checkpoints.

## 2. Completed Scope

Stage 8 baseline includes:

- workflow run object stored on Canvas provenance,
- workflow id, draft id and conversation id anchors,
- workflow status and template,
- step ledger for Teresa actions, user approval, generated artifacts and downstream conversion,
- approval checkpoint metadata,
- output link placeholders for generated downstream artifacts,
- workflow create endpoint,
- workflow resume endpoint with draft/conversation context validation,
- Canvas diagnostics renderer for workflow ledger,
- start and resume actions from Canvas diagnostics,
- tests for workflow creation, approval checkpoint visibility and resume context preservation.

## 3. Governance Contract

Workflow actions must not happen silently.

Every workflow run starts with:

- Teresa framing step,
- explicit user approval checkpoint,
- pending generated artifact step,
- pending downstream conversion/linking step.

Stage 8 does not yet execute recurring refreshes or automatically overwrite outputs. Those behaviors require a later approval and refresh policy.

## 4. Context Contract

Every workflow run must preserve:

- `workflowRunId`,
- `draftId`,
- `conversationId`,
- step ids,
- approval ids,
- output ids and URLs when available.

Resume operations must verify that the workflow belongs to the current draft and conversation before adding a new ledger step.

## 5. Quality Gate

Stage 8 passes only when:

- workflow ledger explains how work was produced,
- user can resume a workflow without losing Canvas context,
- approval checkpoints are visible and enforced as pending metadata,
- generated outputs can be linked back to workflow steps,
- workflow metadata does not conflict with single-user Canvas behavior,
- route and component tests pass,
- changed files have no linter errors.

Stage 8 fails if:

- agent/workflow actions happen silently,
- resuming a workflow attaches to the wrong conversation or draft,
- workflow refresh overwrites manually edited artifacts without review,
- workflow state disappears after draft save/autosave,
- existing Canvas actions regress.

## 6. Next Stage

The next implementation stage is Stage 9: Deep Context And Memory Integration.

Stage 9 should focus on durable memory/context packets for Teresa, not on adding silent automation.
