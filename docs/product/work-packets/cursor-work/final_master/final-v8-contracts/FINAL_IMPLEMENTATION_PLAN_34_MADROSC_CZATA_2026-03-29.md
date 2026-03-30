# Final Implementation Contract — Mądrość czata (Position 34/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) — P34-A complete (direct contract over existing plan)

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

### 2.3 P34-A canon — policy gateway (wisdom gate)
**Cel kanonu**: jeden, audytowalny “policy gateway”, przez który przechodzi *każdy* consumer AI (Chat, Teresa, Anna, automaty/workerzy) zanim powstanie odpowiedź “oparta o wiedzę”.

#### 2.3.1 One policy truth (anti-duplicate)
- **Jeden gateway** (SSOT): jedna implementacja polityk i scope resolution; brak równoległych “mini-gateway” w consumerach.
- **Brak bypassu**: consumer *nie może* samodzielnie robić retrieval/łączenia źródeł “na boku” poza gatewayem (w tym prompt-only retrieval).
- **Jedna semantyka decyzji**: policy decision ma stabilny kontrakt (allowed/blocked + uzasadnienie), wykorzystywany w UI/telemetrii/audycie.

#### 2.3.2 Policy gateway — co robi (minimalny kontrakt)
- **Scope resolution przed rankingiem**:
  - tenant → org → user/private (z zasadami widoczności i ról),
  - jawnie rozdziela: “co wolno” vs “co jest zablokowane” dla tego zapytania.
- **Policy decision**: klasyfikuje zapytanie i podejmuje decyzję: `ALLOW` / `ALLOW_WITH_LIMITS` / `REFUSE`.
- **Retrieval plan** (jeśli `ALLOW*`): wybór dozwolonych kolekcji/źródeł i filtrów (zanim nastąpi scoring).
- **Source ledger** (dla odpowiedzi grounded): gateway zwraca metadane “used” i “blocked” (z powodami) oraz stan degraded.

#### 2.3.3 Allowed vs blocked (kanon)
- **Allowed (typowo)**:
  - pytania o treści w ramach *jawnie dozwolonego* scope (private użytkownika, org shared, public KB jeśli dopuszczona),
  - prośby o streszczenie/porównanie/plan oparte o dozwolone źródła,
  - pytania proceduralne, które nie wymagają wglądu w niedozwolone dane (z jasnym oznaczeniem “bez źródeł”).
- **Blocked / refuse (P0)**:
  - próby pozyskania danych innego użytkownika, innej org lub innego tenant-a (cross-tenant / cross-user),
  - prośby o ujawnienie sekretów, kluczy, tokenów, danych uwierzytelniających, konfiguracji bezpieczeństwa,
  - prośby o obejście polityk (instrukcje jak ominąć gateway, jak wymusić retrieval z private),
  - żądania “podaj mi źródła, których nie możesz użyć” (np. lista zablokowanych prywatnych dokumentów innych osób),
  - treści wrażliwe, gdzie polityka wymaga odmowy lub bezpiecznego przekierowania (PII/PHI/sekrety/ryzyko prawne) — zgodnie z governance.

#### 2.3.4 Refusal UX (spójna, nieagresywna, audytowalna)
- **Zasada**: odmowa jest *krótka*, *jasna* i *użyteczna* — bez ujawniania zablokowanych danych.
- **Składniki komunikatu**:
  - **Outcome**: “Nie mogę w tym pomóc” / “Nie mam dostępu do tych danych”.
  - **Reason (high-level)**: “to poza dozwolonym zakresem” / “to dane wrażliwe” / “brak uprawnień”.
  - **Next best action**: alternatywa w dozwolonym zakresie (np. “mogę pomóc stworzyć zapytanie do admina”, “mogę pracować na Twoich danych prywatnych”, “mogę użyć org corpus jeśli zostanie to wypromowane i zatwierdzone”).
  - **Audit hook**: decyzja gateway’a jest logowalna (kategoria odmowy + scope, bez wycieku treści zablokowanych).

#### 2.3.5 Citations & uncertainty posture (faithfulness discipline)
- **Gdy odpowiedź jest grounded**:
  - pokazuje **źródła (citations/pointers)** do *użytych* materiałów,
  - nie cytuje “zmyślonych” źródeł; jeśli brak źródeł — mówi to wprost.
- **Gdy odpowiedź nie jest grounded (no sources)**:
  - jawnie oznacza: “Odpowiedź bez źródeł / niezweryfikowana w Twojej bazie wiedzy”.
  - unika overclaimów; preferuje hipotezy + pytania doprecyzowujące.
- **Uncertainty**:
  - jeśli system nie może zweryfikować tezy w dozwolonym scope → mówi “nie wiem / nie mogę potwierdzić” i podaje bezpieczne next steps.

#### 2.3.6 Boundaries (żeby nie dublować P35 / Anna / Teresa)
- **Granica vs P35 (Historia czatów / retrieval library)**:
  - P34 definiuje *policy decision + odmowy + citations/uncertainty + degraded*.
  - P35 definiuje *historię, przechowywanie, indeksowanie, wyszukiwanie i UI biblioteki* — bez zmiany polityk.
- **Granica vs Teresa (copilot) i Anna (public assistant)**:
  - Teresa/Anna są **consumerami**; nie tworzą własnych polityk retrieval.
  - Ich “voice” i “pamięć” to oddzielne kontrakty; P34 dotyczy tylko bramy polityk i prawdy o źródłach.
- **Granica vs sensitive data**:
  - Gateway jest warstwą egzekwującą: brak wycieków PII/sekretów/cross-tenant; nie enumeruje zablokowanych obiektów.
  - Mechanizm “promotion” (private→org) musi być gated (review) zanim treść stanie się częścią org corpus.

#### 2.3.7 Degraded / error posture (bez udawania)
- **No access / insufficient permissions**: informuj o braku dostępu i proponuj dozwolone alternatywy (bez “zgadywania” treści).
- **No sources found**: odpowiedź może być ogólna, ale musi być oznaczona jako “bez źródeł” + proponować jak dodać/promować wiedzę.
- **Tooling down / timeouts**: jawny komunikat o awarii narzędzi; fallback do bezpiecznego trybu “bez retrieval”.
- **Partial results**: jeśli część scope była zablokowana, gateway zwraca to jawnie (kategoriami), ale nie ujawnia wrażliwych metadanych.

#### 2.3.8 Acceptance checklist (P34-A → approved(scope))
- [ ] Zdefiniowany jest **jeden policy gateway** jako jedyny entrypoint dla retrieval.
- [ ] Jasne reguły **allowed/blocked** (w tym P0: cross-tenant/cross-user/sekrety).
- [ ] Spójny **refusal UX** (outcome + reason + next step + audytowalność).
- [ ] Spisana postawa **citations & uncertainty** (brak źródeł = brak udawania).
- [ ] Zapisane **granice** vs P35, vs Teresa/Anna, vs sensitive data/promotion.
- [ ] Opisany **degraded/error posture** (no access / no sources / tooling down / partial).

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
- **Staging proof script (click-by-click)**:
  1. Ask a private-only question and verify only private sources are used; source ledger shows used/blocked lists.
  2. Ask an org-only question and verify org corpus is used; confirm no private leakage.
  3. Ask a mixed query and verify scope resolution is explicit (what was allowed vs blocked).
  4. Promote one private item to org: submit promotion → review → approve; verify provenance preserved.
  5. Re-run the org query and confirm promoted content is retrievable from org corpus with correct ledger.
  6. Trigger “no sources/no access” and verify honest degraded fallback (no overclaim).
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
| P34-A | approved(scope) |  | n/a (docs-only) | n/a (docs-only) | §2.3 canon frozen; runtime evidence belongs to P34-B/C |
| P34-B | delivered | `b7ce044c27` | Contract: `tests/unit/backend/chatPolicyGateway.contract.test.ts` (PASS). UI: `tests/components/AIChat/MessageRenderer.policy.test.tsx` (PASS). | `final_master/evidence/P34-B_POLICY_GATEWAY_RUNTIME_VERIFICATION_2026-03-30.md` | Bounded heuristic evidence posture; additive uncertainty marker on insufficient citations. No history/search (P35). |
| P34-C |  |  |  |  |  |

