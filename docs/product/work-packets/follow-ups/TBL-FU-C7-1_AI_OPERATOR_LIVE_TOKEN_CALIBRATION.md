# TBL-FU-C7-1 — AI Operator Live Token Calibration on Staging

**Source sprint:** Block C / C-S7
**Filed:** 2026-05-08
**Priority:** P1
**Status:** `OPEN`
**Owner:** Agent A (backend) + Anygravity P0 trial coordinator

## Why this exists

C-S7 closeout shipped the conservative default `ai_daily_token_budget = 100 000`. Real per-workspace calibration requires LLM traffic on staging — which only happens during the Anygravity P0 trial #2 (D-S5).

## Scope

1. Set `OPENAI_API_KEY` on staging.
2. Set `ENABLE_TABLE_AI_EDITOR=true`, `ENABLE_TABLE_QA_ENGINE=true`, `ENABLE_TABLE_SOURCE_PACK=true` for the Anygravity workspace only.
3. Run the D-S5 P0 trial workload (~ 1 working day of consulting work).
4. Query `tp_ai_usage` and compute:
   - Median + p95 tokens per level.
   - Total daily tokens.
   - Soft-warn trips (70 %) and hard-cap trips (100 %).
5. Recommend per-tier budgets (Starter / Pro / Enterprise) and write `evidence/sprint-7/token-budget-calibration-live.md`.

## Out of scope

- Multi-day trend analysis.
- Cross-workspace comparisons (we only have Anygravity on the trial).

## Definition of done

- Live calibration report appended to `block-C-ai-operator/evidence/sprint-7/`.
- New defaults proposed (or current defaults confirmed).
- A migration is filed if defaults change.
