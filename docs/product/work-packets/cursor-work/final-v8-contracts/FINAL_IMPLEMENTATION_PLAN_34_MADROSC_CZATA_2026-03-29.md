# Final Implementation Contract — Mądrość czata (Position 34/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (direct contract over existing plan)

## 1. Executive summary
- **Intent**: Konkurencyjność: kontekst, reasoning, research; żeby chat był tak dobry jak konkurencja (bez udawania).
- **Primary users**: użytkownicy chatu + operatorzy bezpieczeństwa/knowledge governance.
- **Success metric**: policy-first retrieval + org/private separation + provenance/citations + freshness + audit; wszyscy konsumenci AI idą przez one retrieval gateway.

## 2. Scope
### 2.1 In-scope
- Knowledge/RAG jako wspólna warstwa dla chatu, agentów, workerów.
- Tenancy isolation + org/private split + promotion workflow.
- Retrieval policy gateway + audit.

### 2.2 Out-of-scope / non-goals
- „Upload files to AI” jako jedyny model.
- Bypass policy gateway przez consumerów.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- Benchmark: `docs/product/KNOWLEDGE_RAG_V8_BENCHMARK.md`
- SSOT: `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: „mature enterprise RAG systems” (benchmark w repo jest kategoriami, nie listą vendorów) → **vendor list missing input**.
- **Adjacent**: `Perplexity` (source transparency) jest benchmarkiem dla chatu; knowledge layer musi to umożliwiać w uczciwy sposób.

## 5. Evidence plan (DoD)
- Acceptance: brak cross-user retrieval z private; org corpus jest canonical shared; provenance/citations są audytowalne; freshness i versioning są jawne.
- Evidence: testy permission leakage + retrieval traces + staging demo promotion workflow + operator tooling proof.

