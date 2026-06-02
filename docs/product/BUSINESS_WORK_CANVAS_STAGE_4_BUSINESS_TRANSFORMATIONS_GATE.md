# Business Work Canvas Stage 4 Business Transformations Gate

Status: `DRAFT / STAGE 4 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 4 turns Canvas block interactions into governed business transformations.

The main change is that block mutations no longer need to be local UI-only changes. They can go through the Work Canvas operations endpoint, produce preview metadata, require explicit approval for durable block changes, create version snapshots and preserve block context.

## 2. Completed Scope

Stage 4 baseline includes:

- block-aware operations endpoint support for:
  - `insert_block`,
  - `update_block`,
  - `delete_block`,
  - `convert_block`,
  - `generate_block_from_selection`,
  - `regenerate_projection`;
- operation preview metadata:
  - proposed change,
  - affected blocks,
  - Markdown diff,
  - approval requirement,
  - validation result;
- `previewOnly` mode that returns a preview without mutating the draft;
- approval enforcement for durable block operations via `approved: true`;
- version snapshots for approved block operations;
- table-to-chart/table-to-diagram conversion foundation;
- Canvas UI selection-to-table/chart/diagram actions wired to the backend operation endpoint;
- preservation of `conversationId`, `draftId`, block provenance and Markdown projections.

## 3. Approval Contract

Document text edits can remain direct user edits.

Block transformations are treated as governed operations:

```text
preview -> explicit approval -> apply -> version snapshot -> read-back
```

For the current UI, clicking `Create table`, `Create chart` or `Create diagram` is the explicit approval gesture. Programmatic callers can first send `previewOnly: true`, then send the same operation with `approved: true`.

## 4. Context Preservation Rules

Every approved transformation must preserve:

- active `conversationId`,
- active `draftId`,
- current `contentMd`,
- current and generated `blocks`,
- affected block ids,
- block provenance,
- Markdown projection status,
- version lineage.

Rejected or preview-only transformations must leave the draft unchanged.

## 5. Quality Gate

Stage 4 passes only when:

- preview-only block operations do not mutate drafts,
- durable block operations require approval,
- approved operations create version snapshots,
- generated blocks include title, projection status and provenance,
- table blocks can be converted into chart/diagram foundations,
- Canvas UI block creation goes through the operations endpoint,
- read-back updates active Canvas state,
- targeted route, component and contract tests pass,
- changed files have no linter errors.

Stage 4 fails if:

- AI or API callers can silently mutate durable block data,
- preview-only requests persist changes,
- approved transformations lose existing blocks or Markdown content,
- the user cannot understand what will change,
- Canvas context is disconnected from chat/draft state.

## 6. Next Stage

The next implementation stage is Stage 5: Research And Decision Workspace.

Stage 5 should use the Stage 4 operation model to build evidence-first research and decision blocks with clear provenance, confidence and review states.
