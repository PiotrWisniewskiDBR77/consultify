# EPIC-T10 — Unified AI Table Editor

**Block:** C — AI Operator
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, sections 4.2, 5G, 5H, 7.
**Owner agent:** A (backend) + B (frontend)

---

## Goal

Single panel — `TabeleAiEditorPanel` — surfacing eight distinct edit levels, each producing a typed proposal that flows through `tp_proposals` queue. AI never executes; user always approves. Each level is a separate handler with a constrained prompt and validation layer.

## The 8 levels

| Level | Name | Mutation target | Approval role | Prompt anchor |
|---|---|---|---|---|
| 1 | `cell` | one record × one field | record owner / view editor | "Refine value at field X for record Y given context Z" |
| 2 | `record` | one record (multiple fields) | record owner | "Fill missing fields on record Y given other fields and context" |
| 3 | `column` | many records × one field | view editor | "Compute / refine field X across visible records given source records" |
| 4 | `structure` | schema change (new field, type change) | super-admin via ChatToSchemaService | "Propose schema delta to capture pattern Z; use ChatToSchemaService" |
| 5 | `view` | view filter / sort / grouping | view editor | "Suggest a view configuration that surfaces records matching Z" |
| 6 | `relational` | foreign-key wiring between tables | super-admin | "Suggest relations needed to express Z" |
| 7 | `methodological` | validate against template governance rules | super-admin | "Compare current table data vs template; flag deviations" |
| 8 | `source` | propose missing sources for records | super-admin | "Identify records missing required sources; suggest candidates" |

## Acceptance criteria

- `TableAiEditorService.proposeMutation({tableId, level, payload, actor})` returns `{proposalId, summary, diff}` for every level.
- 8 level handlers under `TableAiEditorLevels/`. Each handler has:
  - Strict input schema (Zod).
  - Strict output schema for the proposal.
  - Audit log entry on creation.
  - Token usage logged via `AiUsageService.consume`.
- Level 4 (`structure`) proxies through existing `ChatToSchemaService`; no new schema-mutation path.
- Level 6 (`relational`) proxies through existing relations service.
- Level 7 (`methodological`) reads template `governance_rules` from Block A.
- Level 8 (`source`) integrates with Source Pack Builder (EPIC-T12).
- `ProposalDiffCard` UI component shows: summary, before / after diff, "Apply", "Reject", "Refine" actions.
- "Refine" issues a follow-up proposal request with revision context (cap 3 refinements per session per proposal).
- Methodological + Source levels require super-admin role.

## Proposal envelope contract

```ts
type ProposalEnvelope<TPayload> = {
  proposalId: string;
  level: 'cell'|'record'|'column'|'structure'|'view'|'relational'|'methodological'|'source';
  summary: string;
  diff: { before: unknown; after: unknown };
  payload: TPayload;
  expiresAt: ISODateString;
  nonce: string;
  tokenUsage: { input: number; output: number; total: number };
};
```

## In scope

### Backend
- `TableAiEditorService.ts` — orchestrator; routes to level handler.
- 8 level handler files under `TableAiEditorLevels/`.
- `AiUsageService.ts` — token budget, atomic consumption, 70 / 100 % thresholds.
- Migration adds:
  - `tp_proposals.level TEXT` column (extends existing proposals table).
  - `tp_ai_usage` table for daily token tracking.
- Routes: `POST /tables/:id/ai-editor/propose`, `POST /tables/:id/ai-editor/refine/:proposalId`, `POST /proposals/:id/apply`, `POST /proposals/:id/reject`.
- Tests for each handler + cross-tenant + token budget.

### Frontend
- `TabeleAiEditorPanel.tsx` — vertical tab strip with 8 levels grouped 3+2+3.
- `levels/{Cell,Record,Column,Structure,View,Relational,Methodological,Source}LevelCard.tsx` — per-level UI.
- `ProposalDiffCard.tsx` — shared diff renderer.
- Component tests.

## Out of scope

- Replay history / undo (covered by existing `tp_proposals.history`).
- Real-time multi-user collab on proposals.

## Dependencies

- Block A's `template.governance_rules` (level 7).
- Block A's `ai_generated_summary`, `ai_classification` (level 1/2 retargeting).
- Block B's `confidence_score`, `validation_status` (level 1/2 prioritization heuristics).
- Block B's `tp_record_sources` (level 8).

## Estimated effort

- S1 (1 day): service skeleton + envelope contract + first 4 level handlers stubbed.
- S2 (1 day): full implementation of cell, record, column, structure handlers.
- S3 (1.5 days): full implementation of view, relational, methodological, source handlers.
- S5 (1.5 days): frontend panel + 8 level cards + diff card.
