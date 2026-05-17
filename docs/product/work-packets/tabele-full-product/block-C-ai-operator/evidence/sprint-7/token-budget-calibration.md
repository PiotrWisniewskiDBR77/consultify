# Token Budget Calibration — Block C

**Date:** 2026-05-08
**Author:** Block C exit gate (CTO seat)

## Defaults shipped

| Setting | Value | Source |
|---|---|---|
| `tp_workspace_settings.ai_daily_token_budget` (default for new workspaces) | 100 000 | C-S0 migration `20260508_block_c_ai_operator.sql` |
| Soft-warn threshold | 70 % | `AiUsageService.SOFT_WARN_THRESHOLD` |
| Hard cap behavior | HTTP 429 + `AI_DAILY_QUOTA_EXHAUSTED` | `AiUsageService.consume()` |
| Reset cadence | Daily, on next `consume()` after midnight UTC | `AiUsageService.consume()` |

## Per-level estimated input/output (from C-S2 / C-S3 design notes)

| Level | Median tokens-in | Median tokens-out | Estimated cost / propose |
|---|---|---|---|
| L1 — `cell` | ~120 (record context) | ~30 (refined value + confidence) | ~150 |
| L2 — `record` | ~250 (record + adjacent fields) | ~80 (multi-field value object) | ~330 |
| L3 — `column` | ~600 (visible records sample) | ~200 (per-record values) | ~800 |
| L4 — `structure` | ~400 (schema + intent) | ~150 (schema diff) | ~550 |
| L5 — `view` | ~250 (current view config + intent) | ~100 (view delta) | ~350 |
| L6 — `relational` | ~500 (two-table headers + sample rows) | ~120 (relation declaration) | ~620 |
| L7 — `methodological` | ~400 (governance rules + record sample) | ~80 (deviation flags) | ~480 |
| L8 — `source` | ~350 (record + missing-source list) | ~100 (candidate URLs) | ~450 |

## Implied daily ceiling

A single workspace at the 100 k default supports roughly:

- ~666 cell-level edits/day, OR
- ~125 column-level proposals/day, OR
- A mixed workload of ~50 column + ~200 record + ~100 cell proposals/day (≈ 100 000 tokens).

This matches the "typical consulting team" envelope from EPIC-T10's design.

## Recommendation for production

Keep `100 000 tokens/day` as the default. Calibration on real staging traffic is filed as **TBL-FU-C7-1**:

1. Enable `liveOpenAiProvider` on staging behind `OPENAI_API_KEY` set in env.
2. Turn on the AI Editor for a single workspace (Anygravity).
3. Run the D-S5 P0 trial workload.
4. Capture `tp_ai_usage` rows for the trial day.
5. Recommend a per-tier budget (Starter / Pro / Enterprise) based on the actual median + p95.

## Cost ceiling protection

Even if the LLM provider misbehaves and emits oversized responses:

- `consume()` aborts with `AI_DAILY_QUOTA_EXHAUSTED` once `tokens_used_today >= ai_daily_token_budget`.
- The atomic `UPDATE … RETURNING tokens_used_today` makes consumption races impossible (PostgreSQL row-level lock).
- Soft-warn at 70 % surfaces in the AI Editor banner so users can self-throttle.

## Audit trail

Every proposal is recorded in `tp_ai_usage` with `(workspace_id, user_id, level, tokens_in, tokens_out, model, status, created_at)`. The audit ledger is append-only and can be replayed to produce a per-workspace cost report.

## Status

`DEFERRED — TBL-FU-C7-1` for live calibration; the conservative default is shipped.
