# AUDYT "AI-only" Enterprise SaaS Ready

## Consultify - Rola: Consultant / Manager / Co-Thinker

**Data audytu:** 2026-02-06
**Audytor:** AI Code Auditor (Claude)
**Metoda:** Statyczna analiza kodu + analiza dokumentacji vs implementacja
**Zakres:** 12 sekcji checklisty (AI-G0 → AI-CONS-7)

---

## EXECUTIVE SUMMARY

### Deklarowany stan: 94.5/100 "Enterprise Ready" (wg docs/ai-audit/SCORECARD.md)

### Rzeczywisty stan po audycie kodu: ~45/100 — NIE GOTOWY do produkcji enterprise

**Kluczowe odkrycie:** Istnieje systemowy problem "fasadowej architektury" — dokumentacja, endpointy i typy TypeScript sugerują kompletny system, ale pod spodem:

- **85+ serwisów** opartych na lazy-load wrapperach, z których wiele wskazuje na nieistniejące pliki JS (silently fallback do stub proxy zwracającego `null`)
- **Rate limiting** dla AI to NO-OP (trzy middleware passthrough)
- **Memory cleanup** to stub `{ itemsCleaned: 0, memoryFreed: 0 }`
- **Cost monitoring** trzyma dane w pamięci RAM (Array), nie w DB — restart = utrata
- **Citation/Quality/RAG metrics** — lazy-loadery wskazują na samych siebie (circular), runtime = stub proxy
- **Cloud integrations** to DEMO MODE z `isImplemented: false`

### Rozbieżność Scorecard vs Kod

| Obszar                   | Scorecard             | Kod                                         | Delta     |
| ------------------------ | --------------------- | ------------------------------------------- | --------- |
| Rate limiting AI         | "Implemented"         | NO-OP middleware                            | KRYTYCZNY |
| Memory cleanup           | "Implemented"         | Stub zwracający 0                           | KRYTYCZNY |
| Citation services        | "Implemented"         | Circular lazy-load → stub proxy             | KRYTYCZNY |
| Quality checker          | "Implemented"         | Circular lazy-load → stub proxy             | KRYTYCZNY |
| RAG metrics              | "Implemented"         | Circular lazy-load → stub proxy             | KRYTYCZNY |
| Learning system          | "Implemented"         | Lazy-load wrapper, Promise exported as sync | KRYTYCZNY |
| Observability            | "P95/P99 implemented" | Lazy-load → stub proxy                      | KRYTYCZNY |
| Cost monitoring          | "Budget tracking"     | In-memory array, nie persystowany           | WYSOKI    |
| Cloud integrations       | N/A                   | `isImplemented: false`                      | WYSOKI    |
| Retention policy service | "Implemented"         | Plik nie istnieje                           | WYSOKI    |

---

## SZCZEGÓŁOWY AUDYT PER SEKCJA

---

## 0) AI Gate (warunki brzegowe "GO-LIVE")

### AI-G0: Kontrakt streamingu SSE

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                                        | Evidence                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Kontrakt udokumentowany                          | ✅ `wdrozenia/integrations/api-contracts/AI_CHAT_STREAM.md` istnieje                                    |
| POST /api/ai/chat/stream przyjmuje pola z kanonu | ✅ `server/src/routes/ai.routes.ts` (linia 338+) — endpoint istnieje z walidacją Zod                    |
| ToolsMenu, tier/model, kontekst UI               | ✅ Frontend przesyła focusMode, selectedTier, screenContext                                             |
| Test integracyjny                                | ⚠️ `tests/integration/routes/ai.test.js` istnieje ale nie pokrywa pełnego kontraktu                     |
| Request/response sample w logach                 | ⚠️ traceId generowany w AIPipeline.ts (linia 187) ale brak strukturyzowanego logowania request/response |

**Blokery:**

- Brak pełnego testu integracyjnego walidującego kontrakt SSE end-to-end
- Logi nie zawierają pełnego request/response sample (tylko traceId)

---

### AI-G1: Brak trybu "demo/stub" na krytycznych ścieżkach AI

**Status: NIE SPEŁNIONY**

**Evidence krytyczne:**

1. **Cloud integrations** — `src/hooks/useCloudIntegrations.ts` linia 61: `isImplemented: false`
2. **AI Context service** — `server/src/services/ai/aiContext.ts` linia 11: `const service = {} as any; // Stubbed missing module`
3. **Summarization** — `server/src/services/ai/summarizationService.ts` linia 25: `return 'Summary stub'`
4. **Draft service** — `server/src/services/ai/draftService.ts`: cały serwis to stub z logami warn
5. **Proactive nudges** — `server/src/services/ai/proactiveNudges.ts`: cały serwis to stub
6. **85+ lazy-load wrapperów** — pattern `createCachedLazyService` z circular resolution → runtime stub proxy

**Systemowy problem lazy-loadera:**
Plik `server/src/utils/lazyServiceLoader.ts` (269 linii) implementuje pattern:

- Wrapper TS importuje `createCachedLazyService('../../ai/service.js')`
- Loader strip'uje `../` i resolv'uje do `server/src/services/ai/service.ts`
- Ale `.ts` plik TO SAM WRAPPER → circular import
- Loader tworzy `Proxy` stub zwracający `null` dla każdej metody
- **W runtime:** `citationExtractor.extract()` → `null`, `qualityChecker.check()` → `null`, itd.
- **Żaden error nie jest rzucany** — ciche awarie

**Dotknięte krytyczne serwisy:**

- `citationExtractor.ts` → stub proxy
- `citationVerifier.ts` → stub proxy
- `qualityChecker.ts` → stub proxy
- `ragMetricsService.ts` → stub proxy
- `learningSystem.ts` → stub proxy (dodatkowo eksportuje `undefined` bo Promise traktowany jako sync)
- `observability.ts` → stub proxy
- `responseQualityService.ts` → stub proxy
- `personalizationEngine.ts` → stub proxy
- `enterpriseSecurity.ts` → stub proxy
- ... i ~75 kolejnych serwisów

---

### AI-G2: Budżety i blokady kosztów

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                              | Evidence                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 403 AI_BUDGET_EXHAUSTED handling FE    | ✅ `src/services/api/baseClient.ts` linie 101-111 — poprawnie obsługuje freeze                                  |
| Budget checking w pipeline             | ✅ `server/src/services/ai/AIPipeline.ts` linie 367-395                                                         |
| Soft cap endpoint                      | ✅ `GET /api/ai/soft-cap-status` (linia 2896 ai.routes.ts)                                                      |
| Cost monitoring service                | ⚠️ `server/src/services/ai/cost-monitoring.service.ts` — **IN-MEMORY ONLY** (Array JS), restart = utrata danych |
| Hard cap enforcement                   | ❌ Nie w pełni zaimplementowany                                                                                 |
| Multi-level budgets (org/user/project) | ❌ Tylko org-level                                                                                              |
| Alert thresholds 80/90/95%             | ⚠️ Skonfigurowane w cost-monitoring (50/75/90%) ale log-only, brak notyfikacji                                  |

**Blokery:**

- Cost monitoring nie persystuje do DB — restart serwera = utrata historii kosztów
- Brak hard cap (tylko soft cap + degrade tier)
- Brak budżetów per user i per project

---

### AI-G3: HITL (Human-in-the-loop)

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                | Evidence                                                                 |
| ------------------------ | ------------------------------------------------------------------------ |
| Endpointy AI Actions     | ✅ `server/src/routes/actionDecisions.routes.ts` (1000+ linii)           |
| approve/reject + audit   | ✅ Tabela `ai_actions_log` w migration `250_ai_memory_system.sql`        |
| Frontend pending actions | ⚠️ `src/services/api.ts` ma `approveAIAction()`, `getPendingAIActions()` |
| UI komponent approval    | ❌ Brak dedykowanego UI komponentu dla pending actions                   |
| Action notifications     | ❌ Nie zaimplementowane (potwierdzone w audit gaps)                      |

---

### AI-G4: Multi-tenant isolation dla danych AI

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                    | Evidence                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| Conversations isolated       | ✅ `user_id` + `organization_id` w tabeli conversations      |
| Memory isolated              | ✅ `ai_user_memory`, `ai_organization_memory` mają org scope |
| RAG/embeddings isolated      | ✅ `ragService.ts` filtruje po organization w vector search  |
| Actions isolated             | ✅ `ai_actions_log` ma `organization_id`                     |
| Test "Org A nie widzi Org B" | ❌ **Brak dedykowanych testów multi-tenant isolation**       |

**Bloker:** Brak testów potwierdzających izolację. Kod wygląda na poprawny, ale bez testów to nie jest evidence.

---

### AI-G5: Observability AI

**Status: NIE SPEŁNIONY**

| Kryterium             | Evidence                                                              |
| --------------------- | --------------------------------------------------------------------- |
| Health endpoints      | ✅ `server/src/routes/ai/ai-health-check.routes.ts`                   |
| Correlation ID        | ✅ `baseClient.ts` generuje i wysyła `X-Correlation-ID`               |
| Trace ID              | ✅ `AIPipeline.ts` generuje `traceId`                                 |
| Observability service | ❌ `server/src/services/ai/observability.ts` → lazy-load → stub proxy |
| Dashboard             | ❌ Brak                                                               |
| Alerting              | ❌ Brak (cost monitoring loguje tylko do console)                     |
| P95/P99 metrics       | ❌ `metrics.ts` → lazy-load → stub proxy                              |
| Incident drill        | ❌ Brak evidence                                                      |

---

## 1) Chat + streaming + historia

### AI-CHAT-1: Streaming SSE

**Status: SPEŁNIONY z zastrzeżeniami**

| Kryterium             | Evidence                                                                               |
| --------------------- | -------------------------------------------------------------------------------------- |
| [DONE] marker         | ✅ Backend: `res.write('data: [DONE]\n\n')`, Frontend: sprawdza `dataStr === '[DONE]'` |
| thought i text events | ✅ Event types: `text`, `thought`, `dt_state`, `research_progress`                     |
| resumeFromPartial     | ⚠️ Zaimplementowany ale manual-only (brak auto-reconnect)                              |
| Reconnect             | ⚠️ 1 retry z 1.5s delay, brak exponential backoff                                      |

**Zastrzeżenia:**

- Auto-reconnect deklarowany w docs, ale kod ma tylko manual retry
- Brak exponential backoff
- Max 1 retry

---

### AI-CHAT-2: Persistence

**Status: SPEŁNIONY**

| Kryterium                | Evidence                                       |
| ------------------------ | ---------------------------------------------- |
| Conversations table      | ✅ Migration `073_conversations.sql`           |
| Messages table           | ✅ `conversation_messages` z metadanymi        |
| CRUD endpoints           | ✅ `server/src/routes/conversations.routes.ts` |
| Brak utraty przy refresh | ✅ Dane w DB, przeładowanie pobiera z API      |

---

### AI-CHAT-3: Foldery, archiwizacja, bulk ops

**Status: SPEŁNIONY**

| Kryterium               | Evidence                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| Archive/unarchive       | ✅ `POST /api/conversations/bulk` z `action: 'archive'`                      |
| Foldery (chat_projects) | ✅ `chat_projects` tabela + routes                                           |
| Star/unstar             | ✅ Implementacja w conversations.routes.ts                                   |
| Per-tenant limits       | ⚠️ Nie znaleziono explicit limitów per tenant na liczbę folderów/konwersacji |

---

### AI-CHAT-4: Feedback do wiadomości

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                 | Evidence                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Feedback collection       | ✅ `POST /api/ai/feedback` + `ai_feedback` tabela                                                       |
| rating/comment/correction | ✅ Typy: `like`, `dislike`, `correction`, `suggestion`                                                  |
| UI komponent              | ✅ `src/components/AIChat/InlineResponseFeedback.tsx`                                                   |
| PATCH per message         | ❌ Endpoint `PATCH /conversations/:id/messages/:id/feedback` udokumentowany ale nie znaleziony w routes |
| Używany przez QA/learning | ❌ `learningSystem.ts` → stub proxy → feedback nie jest przetwarzany                                    |

---

### AI-CHAT-5: Rate limits

**Status: NIE SPEŁNIONY**

| Kryterium                         | Evidence                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| AI rate limiter                   | ❌ `server/src/middleware/rateLimiting.middleware.ts` linia 27-29: **NO-OP** (`next()`)    |
| Global limiter                    | ⚠️ `server/src/index.ts` ma `apiLimiter` (300/15min prod) ale to globalny, nie AI-specific |
| Documented limits (30/min stream) | ❌ Nie zaimplementowane — udokumentowane ale middleware to passthrough                     |
| Test "przekroczenie limitu"       | ❌ Nie ma co testować, limiter nie działa                                                  |

**KRYTYCZNE:** Wszystkie trzy rate limiter middleware (auth, default, AI) to NO-OPs.

---

## 2) Kontekst i "PMO-aware"

### AI-CTX-1: Warstwowanie kontekstu

**Status: SPEŁNIONY**

| Kryterium                  | Evidence                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 6-layer system             | ✅ `server/src/services/aiContextBuilder.ts` (680 linii) — Platform/Org/Project/Execution/Knowledge/External |
| Token counting             | ✅ `tokenCount` tracked w messages                                                                           |
| Context size limiting      | ✅ Trims execution layer >12KB                                                                               |
| POST /api/ai/context/build | ⚠️ Endpoint udokumentowany w API docs, implementacja via AIPipeline                                          |

---

### AI-CTX-2: Kontekst UI do backendu

**Status: SPEŁNIONY**

| Kryterium                | Evidence                                               |
| ------------------------ | ------------------------------------------------------ |
| projectId, screenContext | ✅ `src/contexts/AIContext.tsx` zarządza screenContext |
| focusMode                | ✅ `src/components/AIChat/Input/FocusModeSelector.tsx` |
| Walidacja pól            | ✅ Zod schema w ai.routes.ts waliduje request body     |

---

### AI-CTX-3: Focus mode realnie zmienia odpowiedź

**Status: SPEŁNIONY (architekturalnie)**

| Kryterium             | Evidence                                                |
| --------------------- | ------------------------------------------------------- |
| Focus modes           | ✅ `all`, `pmo-docs`, `project-data`, `research`, `web` |
| Filtrowanie kontekstu | ✅ `aiContextBuilder.ts` filtruje warstwy wg focus mode |
| Test A/B porównawczy  | ❌ Brak formalnego testu                                |

---

### AI-CTX-4: Brak cross-tenant context leak

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                       | Evidence                                              |
| ------------------------------- | ----------------------------------------------------- |
| Org filtering w RAG             | ✅ `ragService.ts` filtruje po `organization_id`      |
| Org filtering w context builder | ✅ `aiContextBuilder.ts` buduje kontekst per org/user |
| Testy bezpieczeństwa            | ❌ Brak dedykowanych testów cross-tenant leak         |

---

## 3) RAG / embeddings / cytowania

### AI-RAG-1: Indeks dokumentów

**Status: SPEŁNIONY**

| Kryterium       | Evidence                                                       |
| --------------- | -------------------------------------------------------------- |
| Pipeline ingest | ✅ `server/src/services/ai/ingestionPipeline.ts` (468 linii)   |
| Chunking        | ✅ 800 token target, 1200 max, 150 overlap                     |
| Embeddings      | ✅ `text-embedding-3-small` (OpenAI) via `embeddingService.ts` |
| Storage         | ✅ pgvector + SQLite fallback                                  |
| Migration       | ✅ `server/migrations/init-pgvector.sql`                       |

---

### AI-RAG-2: API embeddings

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium           | Evidence                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| Generate embeddings | ✅ `embeddingService.ts` (312+ linii)                                     |
| Search              | ✅ Hybrid: vector cosine + BM25 keyword w `ragService.ts`                 |
| Health              | ⚠️ Health check raportuje status, ale `ragMetricsService.ts` → stub proxy |
| Stats               | ❌ RAG metrics service nie działa (lazy-load → stub)                      |

---

### AI-RAG-3: Citations / źródła

**Status: NIE SPEŁNIONY (facade)**

| Kryterium                  | Evidence                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| UI citations               | ✅ `src/components/AIChat/CitationList.tsx` (214 linii) — inline markers [1], [2]                     |
| Citation types             | ✅ `assessment`, `initiative`, `report`, `roadmap`, `external`                                        |
| Citation extractor backend | ❌ `server/src/services/ai/citationExtractor.ts` → lazy-load → **stub proxy** (plik .js nie istnieje) |
| Citation verifier backend  | ❌ `server/src/services/ai/citationVerifier.ts` → lazy-load → **stub proxy** (plik .js nie istnieje)  |
| DB migration               | ✅ `205_citation_verification.sql` istnieje                                                           |
| Rekordy w DB               | ❌ Serwisy nie działają → brak zapisów                                                                |

**Wniosek:** Frontend rendering citations działa, ale backend extraction/verification to **dead code** — nigdy nie produkuje wyników.

---

### AI-RAG-4: Guardrails hallucination control

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                        | Evidence                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| Deep Thinking self-check         | ✅ `deepThinkingSelfCheck.ts` (295+ linii) — 3-layer quality gate          |
| Safety scoring                   | ✅ Hard gate `safety_honesty >= 1`                                         |
| Overreach detection              | ✅ Hard vs soft citation checking                                          |
| RAG metrics / groundedness       | ❌ `ragMetricsService.ts` → stub proxy                                     |
| Quality checker                  | ❌ `qualityChecker.ts` → stub proxy                                        |
| "Insufficient evidence" fallback | ⚠️ W promptach (CONSTRAINT.NO_HALLUCINATION) ale nie w runtime enforcement |

---

### AI-RAG-5: File attachments E2E

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium          | Evidence                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| Upload endpoint    | ✅ `/api/knowledge/upload`, `/api/documents/upload`                    |
| Ingestion pipeline | ✅ `ingestionPipeline.ts` — chunking → embedding → storage             |
| Supported formats  | ⚠️ Tylko `.md`, `.mdx`, `.txt`, `.json` — **brak PDF/DOCX** w pipeline |
| Media ingestion    | ✅ YouTube, URL, batch upload                                          |
| E2E test           | ❌ Brak                                                                |

**Uwaga:** Document processors istnieją (`docxProcessor.ts`, `pptxProcessor.ts`, `spreadsheetProcessor.ts`) ale to lazy-load wrappery → prawdopodobnie stub proxy.

---

### AI-RAG-6: Integracje chmurowe

**Status: NIE SPEŁNIONY — DEMO MODE**

| Kryterium            | Evidence                                               |
| -------------------- | ------------------------------------------------------ |
| Frontend picker      | ✅ `CloudFilePicker.tsx` z demo bannerem               |
| Hook                 | ✅ `useCloudIntegrations.ts` z `isImplemented: false`  |
| OAuth flow           | ❌ Nie zaimplementowany                                |
| Backend endpoints    | ❌ Brak `/api/cloud/list-files`, `/api/cloud/download` |
| connectedProviderIds | Hardcoded `[] as CloudProviderId[]`                    |

---

## 4) Pamięć AI

### AI-MEM-1: User memory CRUD

**Status: SPEŁNIONY**

| Kryterium                     | Evidence                                       |
| ----------------------------- | ---------------------------------------------- |
| GET/PATCH /api/ai/memory/user | ✅ `ai.routes.ts` linie 1381-1524              |
| Schema preferencji            | ✅ `ai_user_memory` tabela (migration 250)     |
| Używana w generacji           | ✅ `AIPipeline.ts` linie 444-499 ładuje memory |

---

### AI-MEM-2: Org memory CRUD

**Status: SPEŁNIONY**

| Kryterium                           | Evidence                                             |
| ----------------------------------- | ---------------------------------------------------- |
| GET/PATCH/DELETE /api/ai/memory/org | ✅ Implementacja w ai.routes.ts + aiMemory.routes.ts |
| Tabela                              | ✅ `ai_organization_memory`                          |
| Wpływ na terminologię               | ⚠️ Memory ładowana do kontekstu, ale brak testu A/B  |

---

### AI-MEM-3: Project memory

**Status: SPEŁNIONY**

| Kryterium                             | Evidence                                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| GET /api/ai/memory/project/:projectId | ✅                                                               |
| POST .../decision                     | ✅ Record project decision                                       |
| DELETE                                | ✅ Clear project memory                                          |
| Kontekstowe włączanie                 | ✅ aiContextBuilder ładuje project memory when projectId present |

---

### AI-MEM-4: Retencja i cleanup

**Status: NIE SPEŁNIONY**

| Kryterium                | Evidence                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Polityki                 | ✅ `minimal`/`standard`/`extended` (30/90/365 dni) w `ai_settings`                                   |
| Cleanup job              | ❌ `server/src/cron/MemoryCleanupJob.js` = **STUB** zwracający `{ itemsCleaned: 0, memoryFreed: 0 }` |
| Scheduler                | ✅ `Scheduler.ts` linia 224 — scheduled niedziele 2:00 AM                                            |
| Retention policy service | ❌ **Plik nie istnieje** (`server/src/services/retentionPolicyService.ts` → 0 wyników)               |
| Raport rozmiaru tabel    | ❌ Brak                                                                                              |

**KRYTYCZNE:** Polityki są skonfigurowane ale nigdy nie wykonywane. Dane rosną bez kontroli.

---

### AI-MEM-5: Token control / trimming

**Status: SPEŁNIONY**

| Kryterium        | Evidence                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| Token estimation | ✅ `aiMemoryManager.ts` `estimateTokens()`                                        |
| Memory trimming  | ✅ `trimMemory()` z priorytetami (decisions > phaseTransitions > recommendations) |
| History trimming | ✅ `trimHistory()` preserves system messages                                      |
| Metrics          | ✅ `tokens_saved_by_trim` w `ai_memory_metrics` tabeli                            |

---

## 5) Learning / feedback loops / jakość

### AI-LEARN-1: Feedback przetwarzany

**Status: NIE SPEŁNIONY**

| Kryterium                  | Evidence                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| Endpointy aggregate/trends | ✅ `GET /api/ai/quality/aggregate`, `GET /api/ai/quality/trends` |
| Response quality service   | ❌ `responseQualityService.ts` → lazy-load → stub proxy          |
| Tabela ai_quality_metrics  | ⚠️ Migration istnieje, ale serwis je populujący to stub          |
| Realne agregacje           | ❌ Endpointy istnieją ale serwis zwraca null                     |

---

### AI-LEARN-2: Correction workflow

**Status: NIE SPEŁNIONY**

| Kryterium                  | Evidence                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Correction type w feedback | ✅ Typ `correction` w InlineResponseFeedback                                               |
| QA queue                   | ❌ Brak implementacji                                                                      |
| Learning system            | ❌ `learningSystem.ts` → lazy-load → eksportuje `undefined` (Promise traktowany jako sync) |

---

### AI-LEARN-3: Response quality scoring

**Status: NIE SPEŁNIONY**

| Kryterium       | Evidence                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| Metryki jakości | ✅ Zdefiniowane w typach (relevance/groundedness/completeness/coherence) |
| Obliczanie      | ❌ `qualityChecker.ts` → stub proxy                                      |
| UI ekspozycja   | ❌ Brak, bo serwis nie produkuje danych                                  |

---

### AI-LEARN-4: A/B testing

**Status: NIE SPEŁNIONY**

| Kryterium           | Evidence                                                   |
| ------------------- | ---------------------------------------------------------- |
| A/B testing route   | ⚠️ `server/src/routes/ai/ai-ab-testing.routes.ts` istnieje |
| Framework           | ❌ Brak pełnej implementacji                               |
| Raport statystyczny | ❌ Brak                                                    |

---

### AI-LEARN-5: Anti-regression golden prompts

**Status: NIE SPEŁNIONY**

| Kryterium              | Evidence          |
| ---------------------- | ----------------- |
| Golden prompts dataset | ❌ Nie znaleziony |
| CI integration         | ❌ Brak           |

---

## 6) AI Actions (HITL), autonomia, audyt

### AI-ACT-1: Pending actions per tenant

**Status: SPEŁNIONY**

| Kryterium                          | Evidence                        |
| ---------------------------------- | ------------------------------- |
| GET /ai/actions/pending            | ✅ `actionDecisions.routes.ts`  |
| Per-tenant filtering               | ✅ `organization_id` w queries  |
| conversationId, messageId, payload | ✅ W schemacie `ai_actions_log` |

---

### AI-ACT-2: Approve + audit

**Status: SPEŁNIONY**

| Kryterium                    | Evidence                                           |
| ---------------------------- | -------------------------------------------------- |
| POST /ai/actions/:id/approve | ✅                                                 |
| Audit log                    | ✅ `approved_by`, `approved_at` w `ai_actions_log` |
| Execute action               | ✅ `/ai/actions/:id/execute` endpoint              |

---

### AI-ACT-3: Reject + no side effects

**Status: SPEŁNIONY**

| Kryterium                   | Evidence                                    |
| --------------------------- | ------------------------------------------- |
| POST /ai/actions/:id/reject | ✅                                          |
| rejection_reason            | ✅ W schemacie tabeli                       |
| Brak side effects           | ⚠️ Logika istnieje, brak dedykowanego testu |

---

### AI-ACT-4: Polityki akcji / RBAC

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium         | Evidence                                                                          |
| ----------------- | --------------------------------------------------------------------------------- |
| ai_actions_config | ✅ Tabela konfiguracji per org/project                                            |
| RBAC integration  | ⚠️ Ogólny RBAC istnieje ale nie znaleziono explicit policy engine per action type |

---

### AI-ACT-5: Idempotency

**Status: NIEOKREŚLONY**

| Kryterium           | Evidence                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| Double approve test | ❌ Brak testu                                                             |
| Idempotency logic   | ⚠️ `approval_status` check przed approve, ale brak testu potwierdzającego |

---

## 7) Routing modeli / provider management / failover

### AI-LLM-1: Tier routing

**Status: SPEŁNIONY**

| Kryterium                         | Evidence                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| ModelRouter                       | ✅ `server/src/services/ai/modelRouter.ts` (846 linii)      |
| BUDGET/STANDARD/PREMIUM/REASONING | ✅ Tier-based routing z fallback chains                     |
| UI selector                       | ✅ `src/components/LLMSelector.tsx`                         |
| Unit test                         | ✅ `server/tests/unit/backend/services/ModelRouter.test.ts` |

---

### AI-LLM-2: Multi-provider failover

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium        | Evidence                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Fallback chain   | ✅ Skonfigurowany w modelRouter                                             |
| Circuit breaker  | ⚠️ Deklarowany, ale `circuitBreaker.ts` to prawdopodobnie lazy-load wrapper |
| Symulacja awarii | ❌ Brak testu                                                               |

---

### AI-LLM-3: Health checks providera

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium          | Evidence                                     |
| ------------------ | -------------------------------------------- |
| Health endpoints   | ✅ `ai-health-check.routes.ts`               |
| LLM health monitor | ⚠️ `llmHealthMonitor.ts` → lazy-load wrapper |
| Dashboard          | ❌ Brak                                      |
| Alert testowy      | ❌ Brak                                      |

---

### AI-LLM-4: Rate limiting per provider

**Status: NIE SPEŁNIONY**

| Kryterium           | Evidence                            |
| ------------------- | ----------------------------------- |
| Per-provider limits | ❌ Rate limiter middleware to NO-OP |
| Backoff             | ❌ Brak                             |

---

## 8) Koszty, budżety, billing-readiness

### AI-COST-1: Widoczność kosztów

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                    | Evidence                                              |
| ---------------------------- | ----------------------------------------------------- |
| Token usage tracking         | ✅ `cost-monitoring.service.ts` liczy tokeny i koszty |
| Per org/user/model breakdown | ✅ W metodach `getMetrics()`, `getUserUsage()`        |
| Raport miesięczny            | ❌ Dane w RAM, restart = utrata                       |
| Per project                  | ❌ Brak project-level tracking                        |

---

### AI-COST-2: Budżety wielopoziomowe

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium        | Evidence                                               |
| ---------------- | ------------------------------------------------------ |
| Org budget       | ✅ `AIPipeline.ts` sprawdza budget                     |
| User budget      | ⚠️ `perUserLimitUSD` w config ale enforcement niepełny |
| Project budget   | ❌ Brak                                                |
| Alerty 80/90/95% | ⚠️ Thresholds 50/75/90% — log-only, brak notyfikacji   |

---

### AI-COST-3: Freeze mechanizm

**Status: SPEŁNIONY**

| Kryterium           | Evidence                             |
| ------------------- | ------------------------------------ |
| AI_BUDGET_EXHAUSTED | ✅ Backend rzuca 403 + FE obsługuje  |
| UX freeze           | ✅ `useAppStore.setAiFreezeStatus()` |
| Komunikat powodu    | ✅ `reason`, `scope` w payload       |

---

### AI-COST-4: Reconciliacja usage→invoice

**Status: NIE SPEŁNIONY**

| Kryterium      | Evidence                                                  |
| -------------- | --------------------------------------------------------- |
| Billing routes | ✅ `billing.routes.ts`, `tokenBilling.routes.ts` istnieją |
| Reconciliation | ❌ In-memory cost data nie jest spójne z billing          |

---

## 9) Security, privacy, compliance

### AI-SEC-1: PII detection + redaction

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium              | Evidence                                            |
| ---------------------- | --------------------------------------------------- |
| UI toggle              | ✅ `DataPrivacySettings.tsx` — `enablePiiRedaction` |
| Sensitivity config     | ✅ `piiDetectionSensitivity` w typach               |
| Enterprise security    | ❌ `enterpriseSecurity.ts` → lazy-load → stub proxy |
| Testy z PII            | ❌ Brak                                             |
| Polish PII (PESEL/NIP) | ❌ Nie znaleziono                                   |

---

### AI-SEC-2: Encryption at rest

**Status: NIEOKREŚLONY**

| Kryterium    | Evidence                             |
| ------------ | ------------------------------------ |
| Konfiguracja | Zależy od deployment (PG encryption) |
| KMS/Vault    | ❌ Nie znaleziono integracji         |
| Audit        | ❌ Brak                              |

---

### AI-SEC-3: Data retention

**Status: NIE SPEŁNIONY**

| Kryterium              | Evidence                     |
| ---------------------- | ---------------------------- |
| Polityki zdefiniowane  | ✅ minimal/standard/extended |
| Cleanup jobs           | ❌ Stub                      |
| RetentionPolicyService | ❌ Plik nie istnieje         |

---

### AI-SEC-4: DSR (Data Subject Request)

**Status: NIEOKREŚLONY**

| Kryterium     | Evidence                                                        |
| ------------- | --------------------------------------------------------------- |
| GDPR guide    | ✅ `docs/security-compliance/GDPR_COMPLIANCE_GUIDE.md` istnieje |
| AI data w DSR | ❌ Nie zweryfikowano czy export/delete obejmuje AI artefakty    |

---

### AI-SEC-5: Prompt injection defense

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium          | Evidence                                                 |
| ------------------ | -------------------------------------------------------- |
| Defense mechanisms | ✅ Prompt constraints (NO_HALLUCINATION, safety scoring) |
| Test pack          | ❌ Brak dedykowanych testów prompt injection             |
| Monitoring         | ❌ Observability → stub                                  |

---

## 10) Observability AI (SLO, alerting, incident response)

### AI-OBS-1: SLI/SLO

**Status: NIE SPEŁNIONY**

| Kryterium         | Evidence                     |
| ----------------- | ---------------------------- |
| SLI/SLO definicje | ❌ Nie znaleziono            |
| Dashboard         | ❌ Brak                      |
| P50/P95/P99       | ❌ `metrics.ts` → stub proxy |

---

### AI-OBS-2: Traceability

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium         | Evidence                                           |
| ----------------- | -------------------------------------------------- |
| correlationId     | ✅ Frontend generuje i wysyła w headerach          |
| traceId           | ✅ AIPipeline generuje per request                 |
| Full trace UI→LLM | ❌ Brak distributed tracing (Jaeger/OpenTelemetry) |

---

### AI-OBS-3: Alerting

**Status: NIE SPEŁNIONY**

| Kryterium   | Evidence                                |
| ----------- | --------------------------------------- |
| Alert rules | ❌ Tylko console.warn w cost-monitoring |
| Alert test  | ❌ Brak                                 |

---

### AI-OBS-4: Runbooki AI

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium                  | Evidence                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| Incident Response Playbook | ✅ `docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md` (513 linii)    |
| AI-specific runbooks       | ❌ Brak dedykowanych runbooków dla AI (provider down, cost spike) |
| Ćwiczenie                  | ❌ Brak evidence                                                  |

---

## 11) Testy AI

### AI-TEST-1: L6.1-L6.8

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium               | Evidence                                         |
| ----------------------- | ------------------------------------------------ |
| 7/8 HEALTHY             | ✅ Wg AI-CHAT-SYSTEM-HEALTH.md                   |
| L6.1 Cloud Integrations | ❌ DEMO MODE                                     |
| Test E2E                | ✅ `tests/e2e/ai-system-health.spec.ts` istnieje |

---

### AI-TEST-2: L6.9-L6.17

**Status: NIE SPEŁNIONY**

| Kryterium       | Evidence                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------- |
| Status          | ⚠️ "SPECIFIED" — testy mają specyfikację ale **puste ciała** (tylko komentarze `// Check:`) |
| L6.9 Vector DB  | ❌ Test body puste                                                                          |
| L6.10 Memory    | ❌ Test body puste                                                                          |
| L6.11 Learning  | ❌ Test body puste                                                                          |
| L6.14 DB Tables | ❌ Test body puste                                                                          |
| L6.15 Pipeline  | ❌ Test body puste                                                                          |
| L6.17 Quality   | ❌ Test body puste                                                                          |

**KRYTYCZNE:** "SPECIFIED" ≠ "PASSING". Testy to puste szablony.

---

### AI-TEST-3: E2E critical flow

**Status: NIE SPEŁNIONY**

| Kryterium      | Evidence                                                                   |
| -------------- | -------------------------------------------------------------------------- |
| Full flow test | ❌ Brak testu: conversation → stream → feedback → action → approve → audit |

---

### AI-TEST-4: Security tests

**Status: NIE SPEŁNIONY**

| Kryterium                    | Evidence                 |
| ---------------------------- | ------------------------ |
| Prompt injection tests       | ❌ Brak                  |
| Multi-tenant isolation tests | ❌ Brak                  |
| Rate limit abuse tests       | ❌ Rate limiter to NO-OP |

---

### AI-TEST-5: Load tests

**Status: NIE SPEŁNIONY**

| Kryterium                 | Evidence                |
| ------------------------- | ----------------------- |
| Streaming pod obciążeniem | ❌ Brak load testów AI  |
| Progi SLO                 | ❌ SLO nie zdefiniowane |

---

## 12) "IBM/BCG-level" kompetencje odpowiedzi

### AI-CONS-1 → AI-CONS-5: Consulting competencies

**Status: CZĘŚCIOWO SPEŁNIONY (prompts exist, no testing)**

| Kryterium              | Evidence                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| Prompt templates       | ✅ `harvardConsultantPrompts.ts`, `coThinkerPrompts.ts`, consulting frameworks |
| MECE capability        | ✅ Zdefiniowane w prompt templates                                             |
| Executive output       | ✅ Prompt instructions dla 1-pager format                                      |
| PMO discipline         | ✅ Framework engine z consulting methodologies                                 |
| **Testowanie jakości** | ❌ Brak golden prompts, brak A/B, brak regression suite                        |

---

### AI-CONS-6: Groundedness

**Status: CZĘŚCIOWO SPEŁNIONY**

| Kryterium           | Evidence                                   |
| ------------------- | ------------------------------------------ |
| "Nie wiem" behavior | ✅ CONSTRAINT.NO_HALLUCINATION w promptach |
| Runtime enforcement | ❌ qualityChecker → stub proxy             |

---

### AI-CONS-7: Response style

**Status: SPEŁNIONY**

| Kryterium             | Evidence                                                      |
| --------------------- | ------------------------------------------------------------- |
| responseStyle options | ✅ `concise`, `formal`, `explanatory`, `learning` w ToolsMenu |
| Style in context      | ✅ Przekazywany do backendu i wstrzykiwany w prompt           |

---

## PODSUMOWANIE SCORINGU

### Scoring per sekcja

| #         | Sekcja             | Punktów możliwych | Spełnione | Częściowe | Niespełnione | Score %  |
| --------- | ------------------ | ----------------- | --------- | --------- | ------------ | -------- |
| 0         | AI Gate            | 6                 | 0         | 4         | 2            | 33%      |
| 1         | Chat+streaming     | 5                 | 2         | 2         | 1            | 52%      |
| 2         | Kontekst           | 4                 | 2         | 2         | 0            | 75%      |
| 3         | RAG/embeddings     | 6                 | 1         | 3         | 2            | 33%      |
| 4         | Pamięć AI          | 5                 | 3         | 0         | 2            | 60%      |
| 5         | Learning           | 5                 | 0         | 0         | 5            | 0%       |
| 6         | AI Actions         | 5                 | 3         | 1         | 1            | 65%      |
| 7         | LLM routing        | 4                 | 1         | 2         | 1            | 38%      |
| 8         | Koszty/budżety     | 4                 | 1         | 2         | 1            | 38%      |
| 9         | Security           | 5                 | 0         | 2         | 3            | 20%      |
| 10        | Observability      | 4                 | 0         | 2         | 2            | 17%      |
| 11        | Testy              | 5                 | 0         | 1         | 4            | 10%      |
| 12        | Consulting quality | 7                 | 1         | 4         | 2            | 29%      |
| **TOTAL** |                    | **65**            | **14**    | **25**    | **26**       | **~41%** |

---

## PLAN NAPRAWCZY — PRIORYTETY I FAZY

### FAZA 0: NAPRAWCZA "STOP THE BLEEDING" (Tydzień 1-2)

**Cel:** Usunąć ciche awarie i fasadowy kod

| #    | Zadanie                                                                                                                                                                     | Bloker dla          | Effort |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------ |
| F0-1 | **Audit lazy-loaderów** — Zidentyfikuj WSZYSTKIE 85+ serwisów, które runtime'owo są stub proxy. Stwórz raport "phantom services".                                           | Wszystko            | 2d     |
| F0-2 | **Zdecyduj: implement or remove** — Dla każdego phantom service: albo napisz implementację, albo jawnie oznacz jako `NotImplementedError` z logiem ERROR (nie cichym null). | AI-G1               | 5d     |
| F0-3 | **Implementuj rate limiting** — Zastąp NO-OP middleware prawdziwą implementacją (express-rate-limit + Redis store jest już w index.ts).                                     | AI-CHAT-5, AI-LLM-4 | 1d     |
| F0-4 | **Implementuj MemoryCleanupJob** — Prawdziwa logika cleanup wg retention policy.                                                                                            | AI-MEM-4, AI-SEC-3  | 2d     |
| F0-5 | **Persystuj cost monitoring do DB** — Przenieś z in-memory array do tabeli AI cost.                                                                                         | AI-COST-1           | 2d     |
| F0-6 | **Scorecard correction** — Zaktualizuj SCORECARD.md do stanu faktycznego.                                                                                                   | Governance          | 0.5d   |

### FAZA 1: KRYTYCZNE SERWISY (Tydzień 3-4)

**Cel:** Uruchomić kluczowe serwisy, które dziś są stub proxy

| #    | Zadanie                                                                                            | Bloker dla             | Effort |
| ---- | -------------------------------------------------------------------------------------------------- | ---------------------- | ------ |
| F1-1 | **Implementuj citationExtractor (real)** — Ekstrakcja cytowań z odpowiedzi AI z linkami do źródeł. | AI-RAG-3               | 3d     |
| F1-2 | **Implementuj citationVerifier** — Weryfikacja cytowań vs źródła.                                  | AI-RAG-3               | 2d     |
| F1-3 | **Implementuj qualityChecker** — Scoring odpowiedzi (relevance/groundedness/completeness).         | AI-LEARN-3, AI-RAG-4   | 3d     |
| F1-4 | **Implementuj ragMetricsService** — Metryki jakości RAG (precision, recall, groundedness).         | AI-RAG-2, AI-RAG-4     | 2d     |
| F1-5 | **Implementuj learningSystem** — Processing feedback → pattern extraction → prompt improvement.    | AI-LEARN-1, AI-LEARN-2 | 5d     |
| F1-6 | **Implementuj observability** — P50/P95/P99 latency, error rate, request count per model.          | AI-OBS-1               | 3d     |
| F1-7 | **Implementuj responseQualityService** — Agregacja metryk jakości + trendy.                        | AI-LEARN-1             | 2d     |

### FAZA 2: SECURITY & COMPLIANCE (Tydzień 5-6)

**Cel:** Enterprise security posture

| #    | Zadanie                                                                                                      | Bloker dla          | Effort |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------------------- | ------ |
| F2-1 | **PII redaction (runtime)** — Implementuj enterpriseSecurity z regułami PII (w tym PESEL/NIP).               | AI-SEC-1            | 3d     |
| F2-2 | **Multi-tenant isolation tests** — 5+ scenariuszy cross-tenant (conversations, memory, RAG, actions, audit). | AI-G4, AI-TEST-4    | 3d     |
| F2-3 | **Prompt injection test suite** — Min. 20 attack vectors + monitoring.                                       | AI-SEC-5, AI-TEST-4 | 2d     |
| F2-4 | **Data retention implementation** — RetentionPolicyService (nowy plik) + joby cleanup per typ danych.        | AI-SEC-3            | 3d     |
| F2-5 | **DSR AI scope** — Upewnij się, że export/delete obejmuje conversations, memory, embeddings, actions.        | AI-SEC-4            | 2d     |
| F2-6 | **Encryption audit** — Zweryfikuj at-rest encryption dla AI data w PG.                                       | AI-SEC-2            | 1d     |

### FAZA 3: OBSERVABILITY & TESTING (Tydzień 7-8)

**Cel:** Mierzalność i testowalność

| #    | Zadanie                                                                                   | Bloker dla | Effort |
| ---- | ----------------------------------------------------------------------------------------- | ---------- | ------ |
| F3-1 | **SLI/SLO definitions** — Availability 99.5%, P95 < 5s, error rate < 2%.                  | AI-OBS-1   | 1d     |
| F3-2 | **Alerting setup** — LLM outage, cost spike, error burst, DB latency.                     | AI-OBS-3   | 3d     |
| F3-3 | **AI-specific runbooks** — provider down, cost spike, data leak, bad responses.           | AI-OBS-4   | 2d     |
| F3-4 | **L6.9-L6.17 test implementations** — Wypełnij puste ciała testów.                        | AI-TEST-2  | 5d     |
| F3-5 | **E2E critical flow test** — conversation → stream → feedback → action → approve → audit. | AI-TEST-3  | 3d     |
| F3-6 | **Load tests** — 50+ concurrent streams, verify SLO thresholds.                           | AI-TEST-5  | 3d     |
| F3-7 | **Distributed tracing** — OpenTelemetry integration for full request trace.               | AI-OBS-2   | 3d     |

### FAZA 4: ADVANCED FEATURES (Tydzień 9-12)

**Cel:** Enterprise-grade features

| #    | Zadanie                                                                                                       | Bloker dla      | Effort |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| F4-1 | **Cloud integrations (real)** — OAuth 2.0 dla Google Drive, OneDrive, Dropbox + backend.                      | AI-RAG-6, AI-G1 | 10d    |
| F4-2 | **Multi-level budgets** — Dodaj per-user i per-project budget tracking + enforcement.                         | AI-COST-2       | 5d     |
| F4-3 | **A/B testing framework** — Experiment definition, routing, statistical analysis.                             | AI-LEARN-4      | 5d     |
| F4-4 | **Golden prompts regression** — Dataset + CI integration + tolerance scoring.                                 | AI-LEARN-5      | 3d     |
| F4-5 | **HITL UI** — Pending actions panel, notification system.                                                     | AI-G3, AI-ACT-1 | 5d     |
| F4-6 | **Auto-reconnect streaming** — Exponential backoff, max retries, seamless resume.                             | AI-CHAT-1       | 3d     |
| F4-7 | **PDF/DOCX ingestion** — Real document processors (nie lazy-load stubs).                                      | AI-RAG-5        | 5d     |
| F4-8 | **Consulting quality validation** — Golden prompt dataset + regression + A/B for MECE/hypothesis/exec output. | AI-CONS-1-7     | 5d     |
| F4-9 | **Billing reconciliation** — Cost tracking → invoice alignment.                                               | AI-COST-4       | 3d     |

---

## DEPENDENCY MAP (co blokuje co)

```
F0-1 (audit lazy-loaders)
├── F0-2 (implement or remove) ─────────────────────┐
│   ├── F1-1 (citationExtractor) ──► F1-2 (verifier)│
│   ├── F1-3 (qualityChecker) ──────────────────────►├── AI-RAG-3, AI-RAG-4
│   ├── F1-4 (ragMetrics) ─────────────────────────►│
│   ├── F1-5 (learningSystem) ─────────────────────►├── AI-LEARN-*
│   ├── F1-6 (observability) ──────────────────────►├── AI-OBS-*
│   └── F1-7 (responseQuality) ───────────────────►│
│                                                    │
F0-3 (rate limiting) ───────────────────────────────►├── AI-CHAT-5, AI-LLM-4
F0-4 (memory cleanup) ─────────────────────────────►├── AI-MEM-4
F0-5 (cost DB persist) ────────────────────────────►├── AI-COST-1
│                                                    │
F2-* (security) ← requires F1-6 (observability) ──►│
F3-* (testing) ← requires F1-* (real services) ───►│
F4-* (advanced) ← requires F2-*, F3-* ────────────►│
```

---

## RISK REGISTER (RAID)

| #   | Typ        | Opis                                                                 | Impact | Mitigation                                      |
| --- | ---------- | -------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| R1  | Risk       | Lazy-loader pattern wymusza refactor ~85 plików                      | H      | Scriptowe podejście: generator TS z real import |
| R2  | Risk       | Scorecard nie odzwierciedla stanu → fałszywe poczucie bezpieczeństwa | H      | Natychmiastowa korekta + automated health check |
| R3  | Risk       | In-memory cost monitoring traci dane                                 | H      | DB persistence w F0-5                           |
| R4  | Risk       | Brak rate limiting = DoS vector                                      | H      | F0-3 jest 1-dniowy fix                          |
| R5  | Assumption | pgvector extension jest aktywna w prod DB                            | M      | Verify deployment config                        |
| R6  | Assumption | Redis jest dostępny dla rate limiting store                          | M      | Verify infrastructure                           |
| R7  | Issue      | L6.9-L6.17 "SPECIFIED" interpretowane jako "ready"                   | H      | Testy muszą mieć ciała i przechodzić            |
| R8  | Dependency | Cloud OAuth wymaga rejestracji apps u 3 providerów                   | M      | Rozpocznij wcześnie (F4-1)                      |

---

## DECISION LOG

| #   | Decyzja potrzebna                                                                                     | Kto decyduje              | Deadline  | Konsekwencja braku decyzji |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------- | --------- | -------------------------- |
| D1  | Czy lazy-loader pattern ma zostać (refactor wrapperów) czy cała architektura serwisów ma być re-done? | Tech Lead                 | Tydzień 1 | Blokuje F0-2 i całą Fazę 1 |
| D2  | Jakie serwisy ze 85+ są krytyczne vs "nice to have"?                                                  | Product Owner + Tech Lead | Tydzień 1 | Blokuje F0-2               |
| D3  | Czy cloud integrations (Google/OneDrive/Dropbox) są wymagane na MVP enterprise?                       | Product Owner             | Tydzień 1 | Determinuje scope F4-1     |
| D4  | Jaki jest target SLO? (availability, latency, error rate)                                             | CTO + Product             | Tydzień 2 | Blokuje F3-1               |
| D5  | Czy PII redaction ma wspierać polskie PII (PESEL/NIP/REGON)?                                          | Legal + Product           | Tydzień 3 | Blokuje F2-1               |
| D6  | Jaki monitoring stack? (Prometheus/Grafana vs Datadog vs custom)                                      | DevOps + CTO              | Tydzień 2 | Blokuje F3-2               |

---

## SZACUNEK WYSIŁKU

| Faza                            | Effort                                  | Kiedy                   |
| ------------------------------- | --------------------------------------- | ----------------------- |
| Faza 0: Stop the bleeding       | ~12.5d (2.5 tygodnie, 1 dev)            | Tydzień 1-2             |
| Faza 1: Krytyczne serwisy       | ~20d (4 tygodnie, 1 dev / 2 tyg, 2 dev) | Tydzień 3-4             |
| Faza 2: Security                | ~14d                                    | Tydzień 5-6             |
| Faza 3: Observability & Testing | ~20d                                    | Tydzień 7-8             |
| Faza 4: Advanced features       | ~44d                                    | Tydzień 9-12            |
| **TOTAL**                       | **~110.5 developer-days**               | **~12 tygodni z 2 dev** |

**Z 2 deweloperami, realny timeline to 10-14 tygodni do "Enterprise Ready".**

---

_Audyt wygenerowany: 2026-02-06_
_Następne review: po zakończeniu Fazy 0_
