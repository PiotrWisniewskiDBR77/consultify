# Business Work Canvas Stage 5 Research Decision Workspace Gate

Status: `DRAFT / STAGE 5 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 5 introduces the Consultify-specific advantage inside Work Canvas: evidence-aware research and decision blocks.

The goal is not just to display another artifact type. The goal is to make uncertainty, sources, assumptions, risks and recommendations visible enough that a business user can reason with Teresa instead of accepting unsupported output.

## 2. Completed Scope

Stage 5 baseline includes:

- richer research block Markdown projection,
- richer decision block Markdown projection,
- native research block renderer with:
  - research question,
  - confidence,
  - findings/facts,
  - sources,
  - limitations/contradictions,
  - gaps,
  - recommendations;
- native decision block renderer with:
  - recommendation card,
  - approval status,
  - options,
  - criteria,
  - risks,
  - assumptions;
- selection-to-research transformation through the governed operations endpoint,
- selection-to-decision transformation through the governed operations endpoint,
- backend generated research data with confidence, sources and gaps,
- backend generated decision data with recommendation, risks, assumptions and approval status,
- tests for research confidence/source lineage,
- tests for decision recommendation/risk/assumption display.

## 3. Evidence Contract

Research blocks must not present findings as final truth without visible uncertainty.

Every generated research block must expose:

- confidence,
- source lineage,
- gaps or limitations,
- recommendations as follow-up guidance, not hidden execution.

Decision blocks must expose:

- decision question,
- options,
- criteria,
- assumptions,
- risks,
- recommendation,
- approval status.

## 4. Governance Rules

Research and decision blocks are generated through the Stage 4 governed operation path:

```text
preview -> approval -> version snapshot -> read-back
```

For current UI selection actions, the button click is the explicit approval gesture. API callers can still request `previewOnly: true` before applying with `approved: true`.

## 5. Quality Gate

Stage 5 passes only when:

- research output shows sources, confidence and limitations/gaps,
- decision output shows options, criteria, risks, assumptions and recommendation,
- generated research/decision blocks preserve `conversationId` and `draftId`,
- recommendations remain traceable to Canvas selection or explicit assumptions,
- approved transformations create version snapshots through the existing operations endpoint,
- Markdown-only documents and earlier table/chart/diagram behavior still pass,
- targeted route, component and contract tests pass,
- changed files have no linter errors.

Stage 5 fails if:

- research outputs unsupported claims without visible uncertainty,
- decision blocks hide assumptions or trade-offs,
- downstream/generated blocks lose lineage,
- a research/decision renderer can blank the Canvas,
- generated recommendations bypass approval.

## 6. Next Stage

The next implementation stage is Stage 6: Output Library And Export Maturity.

Stage 6 should focus on durable outputs and export paths for reports, decks, tables, dashboards and decision memos.
