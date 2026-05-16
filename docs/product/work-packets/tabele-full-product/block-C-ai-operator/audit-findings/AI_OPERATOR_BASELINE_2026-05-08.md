# AI Operator Baseline — 2026-05-08

**Source:** Block C · C-S0 preflight audit.
**Author:** Cursor agent (CTO mode under user delegation).

## Existing AI components map

This document inventories every AI consumer surface that already exists in the Consultify backend so Block C's `TableAiEditorService` does not duplicate functionality.

### Backend services with AI calls

| Service path | Purpose | Reuse for Block C? |
|---|---|---|
| `server/src/services/aiChat/KimiAgent.ts` | Conversational q&a, intent routing | **No** (different surface) |
| `server/src/services/tablePlatform/SchemaProposalsService.ts` | Schema generation from chat prompts | **Yes — partial.** AI Editor structure-level (level 4) reuses the schema proposal envelope contract but adds field-level granularity. Recommendation: extract a shared `ProposalEnvelope` type. |
| `server/src/services/tablePlatform/SummaryService.ts` (if exists; otherwise A-S3 helper) | Auto-derive `ai_generated_summary` cells | **Yes.** AI Editor cell-level (level 1) for summary fields delegates to this service. |
| `server/src/services/tablePlatform/ClassificationService.ts` | Auto-derive `ai_classification` cells | **Yes.** AI Editor cell-level (level 1) for classification fields delegates to this service. |
| `server/src/services/tablePlatform/ConfidenceScoringService.ts` | Compute confidence scores | **Indirect.** AI Editor proposals carry `confidence_score` per record; reuse `recompute()` after apply. |
| `server/src/services/documentStudio/DocumentNarrativePlannerService.ts` | Document narrative outline | **No** (Block D consumer, not Block C). |
| `server/src/services/presentationNarrativePlannerService.ts` (newly landed) | Presentation narrative outline | **No** (parallel program). |

### Existing routes that already gate AI calls

| Route | Gate | Reuse |
|---|---|---|
| `POST /tables/:tableId/schema/propose` | tenant ACL + super-admin opt for write | Yes — pattern reused for `POST /tables/:tableId/ai-editor/propose`. |
| `POST /tables/:tableId/schema/proposals/:id/apply` | tenant ACL + audit | Yes — pattern reused for `POST /proposals/:id/apply`. |
| `POST /tables/:tableId/schema/proposals/:id/reject` | tenant ACL + audit | Yes — pattern reused for `POST /proposals/:id/reject`. |

### Existing tables that AI Editor proposals must integrate with

| Table | Owner | Block C interaction |
|---|---|---|
| `tp_proposals` | Foundation Block | Block C extends with `level TEXT` column (1..8). Existing schema-proposal rows keep `level = NULL`. |
| `tp_records` | Foundation Block | Read-only at proposal stage; updated atomically only on apply. |
| `tp_record_sources` | Block B | Block C source-level proposals (level 8) write into this table when applied. |
| `tp_audit_log` | Foundation Block | Block C writes one row per propose/apply/reject. |
| **NEW: `tp_ai_usage`** | Block C (C-S1) | Block C writes one row per AI call with token deltas. |
| **NEW: `tp_qa_reports`** | Block C (C-S4) | Block C QA Engine writes per-table QA outputs. |
| **NEW: `tp_source_packs`** | Block C (C-S6) | Block C Source Pack Builder writes packs. |

### Frontend AI consumers

- `KimiWorkspace` chat — already in MELS shell as Tabele lane bottom, no Block C change.
- `TabelePreviewLayout` records section — Block B provenance components live here; Block C AI Editor / QA panels mount in MELS right rail (per CTO Q1 + EPIC-T16) without touching this layout.
- AddField dialog — `TBL-FU-A1` (P1 follow-up from Block A) ships specialized field UX; AI Editor uses this dialog for proposed-field UX.

## Migration plan signed off

The following migration (combined into one file `2026_05_block_c_ai_operator.sql`) lands at C-S1:

```sql
-- 1. AI Editor proposal level
ALTER TABLE tp_proposals ADD COLUMN level TEXT NULL
  CHECK (level IS NULL OR level IN ('cell','record','column','structure','view','relational','methodological','source'));

-- 2. Per-workspace token budget settings
CREATE TABLE IF NOT EXISTS tp_workspace_settings (
  workspace_id UUID PRIMARY KEY,
  ai_daily_token_budget INTEGER NOT NULL DEFAULT 2000000,
  tokens_used_today INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. AI usage audit
CREATE TABLE IF NOT EXISTS tp_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES tp_workspace_settings(workspace_id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surface TEXT NOT NULL,
  level TEXT NULL,
  proposal_id UUID NULL,
  actor_user_id UUID NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT NULL
);
CREATE INDEX IF NOT EXISTS tp_ai_usage_workspace_day_idx
  ON tp_ai_usage (workspace_id, date_trunc('day', occurred_at));
```

Subsequent migrations land in C-S4 (`tp_qa_reports`) and C-S6 (`tp_source_packs`) per master roadmap.

## Sign-off

- Baseline + migration plan accepted: 2026-05-08.
- Block C kickoff (C-S1) authorized.
- Re-calibration trigger: production telemetry deviates by ≥ 25 % from forecast → re-run audit.
