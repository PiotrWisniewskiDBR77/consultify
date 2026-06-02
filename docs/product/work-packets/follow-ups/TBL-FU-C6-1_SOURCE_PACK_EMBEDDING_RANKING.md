# TBL-FU-C6-1 — Source Pack Embedding-Similarity Ranking

**Source sprint:** Block C / C-S6
**Filed:** 2026-05-08
**Priority:** P2
**Status:** `OPEN`
**Owner:** TBD (Agent A · backend)

## Why this exists

EPIC-T12 § "Acceptance criteria" includes "embedding similarity (uses existing index)" in candidate ranking. C-S6 shipped a deterministic ranker (lexical + recency + confidence + verified-source) only, because:

1. There is no existing pgvector index on `tp_records.data` in the codebase. The "uses existing index" wording assumed a Block A deliverable that landed in spec but not in code.
2. Adding an embedding pipeline (model selection, generation, recompute on update, cost control) is a multi-day workstream that would have blocked the C-S7 closeout.
3. The deterministic ranker satisfies the user-facing acceptance criteria for the MVP.

## Scope

1. Add `tp_record_embeddings` table or extend `tp_records` with a `vector` column behind a feature flag.
2. Wire `EmbeddingService` (already exists for documents) to recompute on record write.
3. Add a `semantic_score` signal to `compositeRank(...)` with a weight slot so the deterministic and semantic rankers can be balanced.
4. Update `findCandidates({ query })` to call the embedding service when a query is supplied; fall back to lexical when the embedding call fails.
5. Add tests covering: index build, recompute on record write, ranking when both signals are present.

## Out of scope

- Embedding cost control beyond what `AiUsageService` already provides.
- Cross-table semantic search (this ticket is per-table).

## Definition of done

- Composite ranking includes `semanticScore` when the index is populated.
- Existing tests still pass; new tests verify the semantic path.
- Performance: a 10 000-record table returns ranked candidates in < 2 s on staging.
