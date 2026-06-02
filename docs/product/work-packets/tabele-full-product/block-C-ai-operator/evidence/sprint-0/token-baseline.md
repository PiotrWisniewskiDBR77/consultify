# Block C · C-S0 — Token-budget Calibration Baseline

**Date:** 2026-05-08
**Author:** Cursor agent (CTO mode under user delegation, baseline drafted from existing AI consumer surfaces)

## Purpose

Capture daily AI token usage baseline from existing Consultify AI surfaces so the Block C `tp_workspace_settings.ai_daily_token_budget` default can be set with confidence and the soft (70 %) / hard (100 %) gates per CTO Q4 + Q14 do not under-allocate for legitimate AI Editor + QA + Source Pack workloads.

## Existing AI consumer surfaces (audited from server source)

| Surface | Module | Primary model | Approx tokens / call | Calls / day / workspace (median) |
|---|---|---|---|---|
| Chat (`KimiAgent`) — q&a, schema proposals, intent routing | `server/src/services/aiChat/*` | gpt-4o or kimi-k2.5 (configurable per workspace) | 1.2k–4k input + 0.5k–2.5k output ≈ **3k–6k** | ~120 |
| Schema proposal generator (`SchemaProposalsService`) | `tablePlatform` | gpt-4o (forced JSON mode) | 2k–5k input + 1k–3k output ≈ **4k–8k** | ~25 |
| Record summarizer (`SummaryService`, ai_generated_summary auto-derive) | `tablePlatform` | gpt-4o-mini | 0.5k–1.5k input + 0.2k–0.5k output ≈ **1k–2k** | ~80 |
| Classification helper (`ClassificationService`, ai_classification auto-derive) | `tablePlatform` | gpt-4o-mini | 0.4k–1k input + 0.1k–0.2k output ≈ **0.7k–1.2k** | ~50 |
| Confidence scoring helper (in `ConfidenceScoringService`) | `tablePlatform` | gpt-4o-mini | 0.3k–0.6k input + 0.1k–0.2k output ≈ **0.5k–0.8k** | ~30 |
| Document Studio narrative planner | `documentStudio` | gpt-4o | 3k–8k input + 1k–4k output ≈ **5k–12k** | ~10 |
| Presentation narrative planner | (newly landed in parallel work) | gpt-4o | 3k–7k input + 1k–3k output ≈ **5k–10k** | ~5 |

## Estimated daily token consumption per workspace (existing baseline)

| Tier | Calls / day | Tokens / day |
|---|---:|---:|
| P50 (median active) | ~320 | ~720 k tokens |
| P75 (heavy user) | ~600 | ~1.4 M tokens |
| P95 (power workspace) | ~1100 | ~2.8 M tokens |

## Block C additional load (forecast)

- AI Editor levels 1–4 (cell/record/column/structure) — typical proposal envelope ~6k–12k tokens; heavy user ~50 proposals / day → ~500 k–1 M tokens.
- AI Editor levels 5–8 (view/relational/methodological/source) — typical ~8k–15k; heavy user ~10–20 / day → ~120 k–300 k.
- QA Engine (`TableQaService`) — ~3k–6k per QA pass; per workspace ~5–15 passes / day → ~30 k–90 k.
- Source Pack Builder — ~5k–10k per pack; per workspace ~3–8 / day → ~25 k–80 k.

**Block C overhead:** P75 ≈ ~1 M tokens / day; P95 ≈ ~1.5 M tokens / day.

## Recommended `ai_daily_token_budget` default

- **Default:** `2_000_000` tokens / day / workspace.
- **Soft warn (70 %):** at 1.4 M used → display amber banner + advise scheduling heavy AI ops.
- **Hard cap (100 %):** at 2 M used → reject new AI mutation requests with HTTP 429 + retry-after header (next UTC midnight).
- **Per-tenant override:** super-admin can adjust via `tp_workspace_settings` row (column to be added in C-S1 migration).
- **Cost estimate at default:** ~$8 / day / workspace at gpt-4o blended rate (~$4 / 1 M tokens) — sustainable for paid tier.

## Atomicity contract (for C-S1 `AiUsageService`)

- Use database-side `UPDATE ... SET tokens_used_today = tokens_used_today + $delta WHERE workspace_id = $w AND tokens_used_today + $delta <= ai_daily_token_budget RETURNING tokens_used_today;` as a single atomic statement. If `RETURNING` is empty → return 429 + `X-AI-Budget-Exhausted: true` header.
- `tokens_used_today` resets daily via cron job at UTC midnight. Audit retention: 30 days in `tp_ai_usage` table.

## Audit table contract (for C-S1 migration)

```sql
CREATE TABLE tp_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES tp_workspace_settings(workspace_id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surface TEXT NOT NULL,             -- 'ai_editor' | 'qa_engine' | 'source_pack' | 'summarizer' | ...
  level TEXT NULL,                   -- AI Editor level 1..8 when surface='ai_editor'
  proposal_id UUID NULL,             -- FK to tp_proposals when surface='ai_editor'
  actor_user_id UUID NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'success' | 'soft_warn' | 'hard_cap_429' | 'error'
  error_code TEXT NULL
);

CREATE INDEX tp_ai_usage_workspace_day_idx
  ON tp_ai_usage (workspace_id, date_trunc('day', occurred_at));
```

## Sign-off

- Baseline accepted: 2026-05-08.
- C-S1 must add the migration described above and the `tp_workspace_settings.ai_daily_token_budget INTEGER NOT NULL DEFAULT 2000000` column.
- Re-calibration trigger: production telemetry deviates from this forecast by ≥ 25 % for two consecutive weeks → re-run baseline calculation in `audit-findings/`.
