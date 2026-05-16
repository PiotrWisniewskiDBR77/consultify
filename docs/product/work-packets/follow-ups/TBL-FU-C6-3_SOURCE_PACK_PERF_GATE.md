# TBL-FU-C6-3 — Source Pack 10k-Record Performance Gate

**Source sprint:** Block C / C-S6
**Filed:** 2026-05-08
**Priority:** P2
**Status:** `OPEN`
**Owner:** TBD (Agent A · backend + perf eng)

## Why this exists

EPIC-T12 acceptance gate calls for a `<2 s` candidate-ranking budget on a 10 000-record table. C-S6 shipped a 1 000-row scan cap as a defensive bound; the real perf measurement will run during C-S7 closeout when staging carries synthetic data.

## Scope

1. Seed `staging` with a 10 000-record `tp_records` corpus on a Block-A template.
2. Run `findCandidates(...)` with three queries:
   - empty (recency-only)
   - 1-token query (lexical hit)
   - 4-token query (token overlap)
3. Confirm p95 latency `< 2 000 ms` end-to-end.
4. If we breach: introduce a `tp_records.search_text` GIN index OR pre-rank in PostgreSQL with `ts_rank_cd`.
5. Document the result in `block-C-ai-operator/evidence/sprint-7/perf-source-pack.md`.

## Out of scope

- 100 000-record corpus — that's the V2 deliverable for embeddings (TBL-FU-C6-1).
- Pack creation latency (already linear in `MAX_PACK_RECORDS = 200`).

## Definition of done

- p95 < 2 s on the 10 000-record corpus across all three queries.
- Findings logged in C-S7 closeout evidence.
- If we miss the budget, an architectural fix (GIN/ts_rank or pgvector) is queued before Block C closes.
