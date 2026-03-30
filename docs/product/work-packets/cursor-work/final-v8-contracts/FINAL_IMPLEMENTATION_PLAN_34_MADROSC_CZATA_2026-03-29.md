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
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- Benchmark: `docs/product/KNOWLEDGE_RAG_V8_BENCHMARK.md`
- SSOT: `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **Perplexity (source transparency + search/filter/tool posture)**:
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/search/quickstart.html` (search API posture).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/filters.html` (filters/scoping posture).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/tools.html` (tools posture).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/model-fallback.html` (availability/fallback posture).
- **PromptingGuide (RAG faithfulness + hallucinations risk posture)**:
  - `Softs/0 Prompty/Promptguide.zip :: Promptguide/www.promptingguide.ai/research/rag-faithfulness.en.html`
  - `Softs/0 Prompty/Promptguide.zip :: Promptguide/www.promptingguide.ai/research/rag_hallucinations.en.html`
- **LlamaIndex (production RAG + evaluation + observability + memory patterns)**:
  - `Softs/0 Prompty/LLamaindex.zip :: LLamaindex/developers.llamaindex.ai/python/framework/understanding/rag.html` (RAG fundamentals posture).
  - `Softs/0 Prompty/LLamaindex.zip :: LLamaindex/developers.llamaindex.ai/python/framework/optimizing/production_rag.html` (productionization posture).
  - `Softs/0 Prompty/LLamaindex.zip :: LLamaindex/developers.llamaindex.ai/python/framework/module_guides/evaluating.html` (evaluation posture).
  - `Softs/0 Prompty/LLamaindex.zip :: LLamaindex/developers.llamaindex.ai/python/framework/module_guides/observability.html` (observability posture).
  - `Softs/0 Prompty/LLamaindex.zip :: LLamaindex/developers.llamaindex.ai/python/examples/memory/mem0memory.html` (memory separation adjacency).
- **OpenAI (tool/agent integration posture to support governed retrieval)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/tools.html`
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/agents.html`
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/cookbook/examples/how_to_call_functions_for_knowledge_retrieval.html`
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/cookbook/examples/mcp/mcp_tool_guide.html`
- **KIMI (deep research deliverable posture)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/deep-research.html` (deep research → long-form report deliverable).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “policy-first RAG + source ledger + audit”, nie “magiczne odpowiedzi bez dowodu”.**

- **Policy-first scoping before ranking (Implementation plan)**:
  - Scope selection (tenant/user/visibility) zachodzi przed rankingiem i prompt assembly.
- **Source transparency (Perplexity posture)**:
  - Odpowiedzi “oparte o wiedzę” mają źródła / pointers, a nie tylko narrację.
- **Degraded modes (Perplexity model fallback + plan)**:
  - Brak narzędzi / brak dostępu / brak źródeł → jawny degraded state + bezpieczny fallback.
- **Evaluation + observability as part of the system (LlamaIndex posture + plan audit)**:
  - RAG ma ewaluację, metryki i trace’y; operator może wskazać “co zostało użyte”.
- **Faithfulness discipline (PromptingGuide risks)**:
  - System nie overclaimuje; tam gdzie brak dowodu — jawnie to komunikuje.
- **One retrieval gateway (Implementation plan)**:
  - Konsumenci nie omijają gateway’a; brak bocznych, nieaudytowalnych retrieval pathów.

### 4.4 Gap ledger vs Softs (what we are missing — derived from the v8 plan)
Źródło prawdy: `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Retrieval policy gateway | governed entrypoint | “required by plan” | Dopiąć gateway jako jedyną drogę dla consumerów | P0 |
| Source ledger + audit | traceable truth | “required by plan” | Utrwalać used/blocked sources + audyt użycia knowledge | P0 |
| Promotion workflow | no silent sharing | “required by plan” | Zbudować promotion state machine z provenance + review | P0 |
| Evaluation/observability | production RAG | “evidence incomplete” | Dodać evaluation harness + retrieval traces + operator tooling | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Brak cross-user retrieval z private; org corpus jest canonical shared; provenance/citations są audytowalne; freshness i versioning są jawne.
- Konsumenci AI nie omijają retrieval policy gateway.
- Każda odpowiedź “grounded” ma source ledger (albo jawne ograniczenie).

### 5.2 Tests
- Security regression: permission leakage tests (private→other user, org→wrong role, cross-tenant).
- Contract tests: retrieval response zawiera `used_sources[]` + `blocked_sources[]` + `scope_resolution` (w zadeklarowanym zakresie).
- Promotion tests: private→org promotion wymaga review + zachowuje provenance; brak silent promotion.
- Observability: retrieval traces są dostępne operatorowi (bounded) i dają się zmatchować do audytu.

### 5.3 Staging proof checklist
- Demo: 3 zapytania (private-only, org-only, mixed) → widoczne źródła + brak leakage.
- Demo: promotion workflow (private→org) + review + potem retrieval z org corpus.
- Demo: degraded mode (no access / no sources) → jawny fallback bez overclaim.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Chat wisdom SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P34-A — Retrieval policy gateway canon (scope approval)
- **Goal**: policy-first RAG: gateway jako jedyna droga + jawny source ledger + brak leakage.
- **Inputs required**: scope resolution rules (private/org/tenant) + used/blocked source schema + promotion workflow.
- **Acceptance**: scope zatwierdzony; non-goals jawne; security posture i degraded states spisane.
- **Evidence**: scope approval + linkowane SSOT/bench.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze scope resolution rules (private/org/tenant) and the leakage prevention posture.
  - Freeze source ledger schema (used_sources/blocked_sources + rationale) and retention posture.
  - Freeze promotion workflow (private→org) with review gate (no silent sharing).
- **DoD**:
  - Approved(scope): gateway is the single entrypoint; security rules are explicit and testable.

#### P34-B — Source ledger + promotion workflow closure
- **Goal**: odpowiedzi grounded mają sources; private→org promotion jest gated (review) i zachowuje provenance.
- **Acceptance**: 3 query scenariusze działają; promotion działa; konsumenci AI nie omijają gateway.
- **Evidence**: security/regression tests + staging demos.
- **Tasks**:
  - Implement used/blocked source ledger and show it (or explicit “no sources” degraded).
  - Implement promotion state machine with review and preserved provenance.
  - Add security regression tests (no leakage) and run staging demos (3 queries + promotion).
- **DoD**:
  - No leakage proven; promotion is governed; consumers cannot bypass gateway.

#### P34-C — Verification + observability + rollout
- **Goal**: retrieval traces + evaluation harness (bounded) + staging proof + rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony; operator ma minimalną observability.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Deliver bounded observability: retrieval traces + minimal eval harness; capture staging proof.
  - Fill ledger rows P34-A/B/C; validate rollback to private-only mode if needed.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw gateway + security, potem promotion, potem evaluation/observability (P1) stopniowo.

### 8.3 Rollback plan
- Wyłącz org retrieval/promotion; zachowaj private-only; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: leakage private→org / cross-tenant (P0 security).
- Ryzyko: brak jawnego source ledger → brak zaufania i audytu.
- Decyzje: minimalny format source records (url/id/type/version) i retention.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P34-A |  |  |  |  |  |
| P34-B |  |  |  |  |  |
| P34-C |  |  |  |  |  |

