# MASTER DEEP SYNTHESIS — Consultify 4‑dimensional re‑audit (2026‑06‑03)

**Cel:** odpowiedź na 4 pytania krytyczne, każda z code‑traced dowodami `file:line`:
1. Każdy moduł osobno — wszystkie funkcjonalności, end‑to‑end UI→route→DB/AI.
2. Przepływ pracy między modułami — łańcuch wartości i miejsca, gdzie się rwie.
3. Teresa AI — per‑moduł i jako jeden spójny system.
4. Pamięć kontekstowa — użytkownik/organizacja × chwilowa/długoterminowa.

**Skład źródłowy (wszystko w tym katalogu):** 13 deep dossierów (`DEEP_MEMORY_ARCHITECTURE.md`, `DEEP_TERESA_SYSTEMWIDE.md`, `DEEP_CROSS_MODULE_FLOW.md`, `DEEP_CONTEXT_GROUNDING.md`, `DEEP_MODULE_01/02/03/04/08/09/10/11/12/13/19_*.md`, `DEEP_MODULE_14_15_deferred.md`) + 19 dossier completion (`../COMPLETION_NN_*.md`).

> Część wcześniejszych ustaleń z poprzedniej rundy została **skorygowana** przez głębszy trace — zaznaczam je literką **[CORR]**.

---

## 0. Werdykt nadrzędny po pogłębieniu

System jest **bardziej dojrzały, niż wskazywała pierwsza runda** — ale **gorzej spięty po seamach** (UX/handoff/budget‑linkage). Konkretnie:

- **Rdzeń AI jest realny.** Jedna `AIPipeline` (`server/src/services/ai/AIPipeline.ts:197,507,2296`), jeden persona (`server/src/ai/persona.ts:446`), routing OpenRouter (`modelRouter.ts:117`), prawdziwe RAG (`ragService.ts:691` — embeddings + cosine + BM25), prawdziwe SSE streaming z heartbeat i retry. To **nie atrapa**.
- **Część „Teresa‑as‑illusion" została wzmocniona dowodami, a część obalona.** Główne potwierdzenia: `ConversationalPanel` (03), `documentTeresaIntent` (10), `applyPresentationEditPlan` (12 — czysty regex), `meetingIntelligenceService.llmClient` (13 — `null`, `setLLMClient` nie ma żadnego wywołania). Obalenia/niuanse: **04 Narzędzia mają działający apply‑path** dla 5 narzędzi strategicznych (`useToolAI.ts:134,155,448–453`) — 9 pozostałych jest psute przez za szeroki emiter `toolAiActions.ts:118/186`; **Document Studio ma działający editor‑LLM** przez scope‑dropdown (`DocumentStudioEditorPanel.tsx:107` → `documentEditorRefiner.ts:180`) — martwa jest tylko warstwa NL‑intent.
- **Pamięć kontekstowa ma dziurę w pętli zapisu i schemat collision.** Czat **nie zapisuje** faktów do `ai_user_memory`/long‑term — `recordInteraction`/`updateUserMemory` nie mają żadnego callera w runtime. Dwa kolidujące schematy `ai_user_memory` (075 key/value vs 250 JSON). Historia rozmowy persistowana, ale **nigdy nie rehydrowana** server‑side (`AIPipeline.ts:1013-1014` czyta `request.history` z klienta).
- **Governance pamięci jest zbyt agresywny.** `contextGovernance.ts:31–43,109,129` defaultem **strippuje `ORG_PATTERNS` + `ORG_FINANCIAL_SUMMARY` + `ORG_SECURITY_POSTURE`**, nie ma UI do zmiany (`ai-governance.routes.ts:82-126` istnieje, 0 referencji we frontendzie). Teresa nie widzi finansów organizacji domyślnie — i nie da się tego włączyć w UI.
- **Łańcuch wartości się rwie w 2 krytycznych miejscach** + 3 mniejszych. **Execution(06) → Results(07) = dead‑end** (`ExecutionHub.tsx:2558` — CTA prowadzi tylko do Initiatives) `[CONFIRMED]`. **Document Studio(10) → Outputs(09)** nie zapisuje artefaktu do rejestru (`v8_output_artifacts`). Plus: Finance→Initiative 404, Finance export gubi `relatedInitiativeIds`, Results→Outputs brak publish‑CTA.

---

## 1. Pamięć kontekstowa — macierz 2×2 (TEN punkt jest sednem)

Źródło: `DEEP_MEMORY_ARCHITECTURE.md` + `DEEP_CONTEXT_GROUNDING.md`.

### 1.1. Dwa context buildery — kanonik i legacy
- **Kanonik** (`server/src/services/aiContextBuilder.ts:171` `buildContext(userId, organizationId, projectId, opts)`) — używany przez `AIPipeline.ts:746`.
- **Legacy** (`server/src/ai/aiContextBuilder.ts:16`, `@ts-nocheck`, `buildContext(orgId)`) — używany **tylko przez AI Coach** (`aiCoach.ts:51`), nie Teresę. Brak osi `user`, brak governance, brak KG, brak RAG. **Rozjazd źródeł prawdy** — P0 do ujednolicenia.

### 1.2. Macierz 2×2 (Scope × Duration)

| | **EPHEMERAL (turn/sesja)** | **LONG‑TERM (między sesjami)** |
|---|---|---|
| **USER** | **A.** Historia rozmowy — `request.history` z klienta (`AIPipeline.ts:1014`), persistowana do `conversation_messages`, **ale NIGDY nie czytana zwrotnie** przez server. Okno = `slice(-8)` na jednej ścieżce; globalny trim 12k tnie *kontekst*, nie historię. | **B. ZEPSUTE.** Dwa kolidujące schematy `ai_user_memory` (075 key/value vs 250 JSON). `aiMemoryService.getUserMemory` czyta 250; `AIPipeline` custom‑instructions czyta 075 z fallbackiem. **Writerzy `updateUserMemory`/`recordInteraction` mają ZERO runtime callers.** Teresa dostaje tylko `communicationStyle/detailLevel/expertise/interactionCount` (`AIPipeline.ts:1165-1180`). `recentTopics` celowo strippowany (cross‑org leak fix). **Teresa NIE pamięta użytkownika faktycznie**, tylko `userStyleProfileService` persistuje ton. |
| **ORG** | **C.** `buildResolvedContext` (`OrganizationContextService.ts:868`) — ~15 SELECTów **na każde zapytanie, bez cache/TTL**. Zaleta: świeżość. Wada: koszt N×. | **D. PRAWDZIWA „pamięć org".** `organization_context_items/_claims/_snapshots` (migracja 669); `contextItemsSample` raw Q&A z wywiadu/notatek (`aiContextBuilder.ts:582-691`, injektowany w `AIPipeline.ts:1432`); `orgPatterns` z `organization_memory`; `terminology` z `ai_organization_memory`; `ai_org_memory` JSON; **Knowledge Graph** w `knowledge_graph_entities/relations`. |

### 1.3. KG — **[CORR]** poprzednie „NO injection" jest **błędne**
KG **JEST** wstrzykiwany do promptu — `buildGraphContext` (`AIPipeline.ts:1264`, próg `minMentions:2`) + auto‑populuje się przez `processConversation` (`ai.routes.ts:4517`). **Caveat:** KG **omija** governance filter — to ślepy obejście polityki.

### 1.4. RAG — **prawdziwe, nie stub** (sprostowanie)
`ragService.hybridSearch` (`ragService.ts:691`) = OpenAI `text-embedding-3-small` + cosine w JS (brute‑force) + BM25 + opcjonalny reranker + LIKE fallback. **Brak pgvector** = limit skalowalności. ACL‑hardened `ContextRetrievalService` (`ai.routes.ts:3505`) używany **tylko dla attachment grounding**; domyślny doc grounding używa org‑only `KnowledgeService.getDocuments` (ignoruje `_userId`/`_role`).

### 1.5. Governance — **gorszy niż myślałem**
`contextGovernance.ts:31-43,109,129`: **defaultem strippuje `ORG_PATTERNS`, `ORG_FINANCIAL_SUMMARY`, `ORG_SECURITY_POSTURE`**. Backend istnieje (`ai-governance.routes.ts:82-126`), **frontend = ZERO referencji** — admin niewidoczny. Skutek: `orgPatterns` jest ładowany z DB, potem usuwany — **czysta strata**. **Failure modes fail‑OPEN** (`aiContextBuilder.ts:350,974`) — błąd polityki = WIĘCEJ kontekstu, nie mniej. To luka.

### 1.6. Świeżość — doskonała
Brak cache na `buildResolvedContext` = nowa odpowiedź z wywiadu/nowy dokument trafia do następnego promptu Teresy **natychmiast**.

### 1.7. Multi‑tenant — bezpieczne
Każde zapytanie kontekstu scoped przez `organizationId` z tokena; `contextItemsSample` filtruje `visibility_scope`; cross‑tenant `recentTopics` celowo niewyrenderowany. **Brak cross‑org leak.**

### 1.8. Top luki pamięci (P0 do dokończenia)
1. **Pętla zapisu user/org factual memory orphaned** — `recordInteraction/updateUserMemory` brak callerów. P0: podpiąć obok KG processConversation w `ai.routes.ts:4517`.
2. **Schemat `ai_user_memory` collision** (075 vs 250) — P0 ujednolicić.
3. **History nigdy nie rehydrowana** server‑side gdy klient nie wyśle — P0: hydrate z `conversation_messages` w `AIPipeline.ts:1013`.
4. **Dual‑path context builder** — P0 zsynchronizować legacy z kanonikiem.
5. **`orgPatterns` ładowany‑then‑strippowany** — P0 przesunąć ładowanie ZA filter lub zmienić domyślną politykę.
6. **KG omija governance** — P1 wpiąć KG w filter.
7. **Brak TTL/cache** na `buildResolvedContext` — P1 mikro‑cache 30s na request batch.
8. **Governance UI = zero** — P0 ship UI dla `ai-governance.routes.ts`.
9. **Fail‑OPEN governance** — P0 fail‑CLOSED.
10. **Brak token‑budgeting per‑sekcja** — P1 (obecnie tylko crude `JSON.stringify(ctx).length > 12000`).

---

## 2. Teresa systemowo — jeden mózg, fragmentaryczny układ nerwowy

Źródło: `DEEP_TERESA_SYSTEMWIDE.md`.

### 2.1. Jeden rdzeń, wiele callerów
- **Kanoniczny endpoint:** `POST /api/ai/chat/stream` (`ai.routes.ts:1423`).
- **Jeden pipeline:** `AIPipeline.processStream` (`AIPipeline.ts:507,2296`).
- **Jeden persona** (BCG consultant + PM + financial analyst, screen‑aware, `persona.ts:446`).
- **Routing modeli:** OpenRouter wyłącznie — gpt‑4o‑mini/4o/claude‑sonnet‑4‑6/o1‑mini per tier (`modelRouter.ts:117`).

### 2.2. Dwie korekty wcześniejszych założeń **[CORR]**
- **„DBR77 Vector" NIE jest modelem inferencji** — to tylko tekst wiedzy produktu wstrzykiwany dla Anny (`annaKnowledgeService.ts:64`). Żadne inference tam nie idzie.
- **BYOK jest na poziomie org/provider, nie per‑user** (`modelRouter.ts:1355,1417`).

### 2.3. Macierz Moduł × Teresa (19 wierszy)

| # | Moduł | Invocation | Apply‑handler | LLM/Fake | file:line proof |
|---|---|---|---|---|---|
| 01 | Czat | `/chat/stream` | n/a (to JEST rdzeń) | ✅ Real | `useAIStream.ts:518,1132` → `ai.routes.ts:1423` |
| 02 | Moja Praca | 4 quick‑action hooki | ✅ Real (4×) **[CORR]** | ✅ Real | `useMindMapQuickActions.ts:992`, `useTableQuickActions.ts:270`, `useProcessFlowQuickActions.ts:120`, `useWhiteboardQuickActions.ts:121` |
| 02b | Chat↔Canvas bridge | `useIdeasTeresaBridge` | ❌ DEAD (0 importerów) | n/a | `useIdeasTeresaBridge.ts` |
| 03 | Wywiad | ConversationalPanel | ❌ **NIE ZAMONTOWANY** | n/a | `Interview/index.ts:41` eksport, `RuntimeModeSelector.tsx:22` nie ma `conversational` |
| 03b | Wywiad backend | `ai-parse`, `evaluate-answers` | n/a | ✅ Real LLM | `InterviewController.ts:4942,1854` |
| 04 | Narzędzia (5 strategicznych) | `useToolAI` | ✅ Real | ✅ Real | `useToolAI.ts:134,155,465-558` |
| 04b | Narzędzia (9 pozostałych) | jw. | ❌ **Apply useEffect early‑return** | streamuje, nie zapisuje | `useToolAI.ts:448-453`, `toolAiActions.ts:118,186` |
| 05 | Inicjatywy — PortfolioAiPanel | `/api/ai/initiatives/{conflicts,priorities,schedule}` | ✅ Real apply | ✅ Real LLM | `ai.routes.ts:6353,6413,6268`, `PortfolioAiPanel.tsx:79-133,135,300` |
| 05b | Inicjatywy — wizard | `generateCandidates` | n/a | ❌ **Heurystyka, nie LLM** | `initiativeWizardService.ts:258-713` |
| 05c | Inicjatywy — generator | `/api/initiative-generator/generate` | persisted | ❌ **Stub — `JSON.stringify(context)`** | `initiative-generator.routes.ts:46-57` |
| 05d | useAssessmentAI | `/ai/generate-initiatives`, `/ai/prioritize-initiatives` | ❌ 404 — dead endpointy | ❌ | `useAssessmentAI.ts:399,411` |
| 06 | Realizacja — Rollout | Teresa risk callout | ✅ Real (chat z kontekstem) | ✅ Real | `RolloutTab.tsx:378-400` |
| 06b | Realizacja — Manager | AiRecommendationPanel V8 | ✅ Real apply | ✅ Real | `Manager/AiRecommendationPanel.tsx:700-877` |
| 06c | Realizacja — interventionSuggestions | computed | ❌ **Nigdy nie renderowane** | n/a | `ExecutionHub.tsx:3936` (dead useMemo) |
| 07 | Rezultaty | brak | ❌ **ZERO** | ❌ ROI „AI insights" = `belowPlanCount >= 3` threshold | `teresaCopilotCanon.ts:26-33` (`results/kpi/roi` brak), `ROIAnalysisView.tsx:376-381,531` |
| 08 | Finanse | `teresaPrompt` zbudowany | ❌ **Nikt nie konsumuje** | ❌ business‑case to template stub | `FinanceHub.tsx:244-256`, `economics.routes.ts:1165-1216` |
| 08b | Finanse — `ORG_FINANCIAL_SUMMARY` | injekcja w prompt | n/a | ❌ **Strippowany defaultem** | `aiContextBuilder.ts:1387-1477`, `contextGovernance.ts:38,129` |
| 09 | Outputs | „Generate with Teresa" CTA | ❌ Otwiera czat ale nie woła `createFromChat` | n/a | `OutputsAggregateTabContent.tsx:191` |
| 10 | Dokumenty — Editor | scope dropdown → `documentEditorRefiner` | ✅ Real | ✅ Real LLM | `DocumentStudioEditorPanel.tsx:107`, `documentEditorRefiner.ts:180` |
| 10b | Dokumenty — Teresa NL intent | `documentTeresaIntent` | ❌ **Tylko w testach** | n/a | `__tests__/*` jedyne importy |
| 10c | Dokumenty — block prose | `useLlm` flag | ✅ Real LLM | ❌ **default = false** | `documentBlockProseGenerator.ts:179`, `DocumentStudioView.tsx:41` |
| 11 | Tabele | 8‑level apply chain | ✅ Real zod‑validated atomic | ✅ Real | `MutationExecutor` — ale 8 flag OFF: `FeatureFlags.ts:82,88,94,100`, `tabeleAiEditorFlag.ts:31` |
| 12 | Prezentacje — narrative | `presentationGeneratorService:1245` | ✅ Real | ✅ Real LLM (4 z 15 intentów) | `presentationGeneratorService.ts:1245` |
| 12b | Prezentacje — agent edit | `applyPresentationEditPlan` | persisted | ❌ **Czysty regex/keyword** | `presentationAgentEditService.ts:46,308` (`matchAll(/slide\|slajd/)`, `.includes('summary')`) |
| 13 | Meeting — operator brief | `aiOperatorService:638` | ✅ wired | ❌ Rule‑based template | `aiOperatorService.ts:691` (`prepSummary` hardcoded string) |
| 13b | Meeting — intelligence | `meetingIntelligenceService` | ❌ **Nie zaimportowany** | ❌ `llmClient = null`, `setLLMClient` 0 wywołań | `meetingIntelligenceService.ts:48,51` |
| 13c | Meeting — Teresa schedules | `MeetingExecutor` | ✅ Real (odwrotny kierunek — Teresa→Meeting) | ✅ | `meetingExecutor.ts:19`, `actionExecutionAdapter.ts:174` |
| 14/15 | MCP/Iris/Marketplace | redirect | n/a | n/a — deferred | `AppRoutes.tsx:2099-2100` |
| 16 | Organizacja | kontekst → wszystkie moduły | ✅ JEST silnik kontekstu | ✅ | `aiContextBuilder.ts:171`, `OrganizationContextService.ts:868` |
| 17 | Admin — budżety AI | `checkBudget` | ✅ **[CORR]** podpięte | ✅ Real | `AIPipeline.ts:306` (gated `AI_BUDGETS_ENABLED`), reads `ai_budgets` |
| 17b | Admin UI ↔ budżety | UI pisze `ai-settings/org` | ❌ **Linkage nieudowodniona** vs `ai_budgets`; `organization_limits` nieczytany | n/a | `adminP32.routes.ts:943-961` (write), `ai.routes.ts` (no read) |
| 17c | Admin/AI sub‑taby (8 zbudowanych) | AccessLimitsTab itd. | ❌ **Nie zamontowane** | n/a | `AdminAIControlCenterPanel.tsx` renderuje tylko 2 z 8 |
| 18 | Ustawienia AI | `/ai-settings/user` save | ✅ Persist | ❌ **Pipeline NIE czyta `model/temperature` z DB** | `AIPipeline.ts:1165-1180` czyta tylko `userMemory.preferences` |
| 19 | Partner | `CommissionIntelligence` | ❌ nawet nie renderowany | ❌ `useMemo` heurystyka oznaczona „AI‑powered" | `CommissionIntelligence.tsx:46` |

### 2.4. Wnioski systemowe
- **~13/19 powierzchni: prawdziwe LLM + działający apply.** Reszta dzieli się na 3 dead/fake (Presentation edit, Meeting intelligence, Interview panel), 2 governance half‑wired (Admin budżety UI linkage, Settings nie‑sterują‑pipelinem), 1 context‑only (Org).
- **Jeden persona nad rozdrobnionym systemem nerwowym.** In‑module callerzy `/ai/chat` (Tasks, Decisions, Notifications, Interview) wysyłają **własny `systemInstruction`** i **omijają screen emphasis, user memory, org context**. To tutaj pęka spójność.
- **Brak rejestru function‑calling.** Teresa „działa" przez 3 równoległe ad‑hoc mechanizmy: server signal→action engine (`actionExecutionAdapter.ts:165` — TASK_CREATE/PLAYBOOK_ASSIGN/MEETING_SCHEDULE), client JSON‑in‑stream parsing (Tools), CustomEvent bus (Ideas). **P1 do unifikacji** — function‑calling registry.

---

## 3. Przepływ między modułami — łańcuch wartości

Źródło: `DEEP_CROSS_MODULE_FLOW.md`.

### 3.1. Trzy realne kręgosłupy danych
1. **Tenant/org via JWT** (`OrgContext.tsx:79,128`).
2. **Org‑context claim store** — odpowiedzi z wywiadu/notatki ingestowane jako `organization_context_items` które Teresa czyta na każde zapytanie (`aiContextBuilder.ts:554,615,625`).
3. **`initiativeId`** — refrowany przez Results/Finance/KPIs (`kpiDomain.ts:118`, `InitiativesHub.tsx:1327`).
4. **`/api/artifacts` registry** (`outputType: report|presentation|sheet|...`) — wspólny dla Chat, Tables, Documents, Outputs (`useRapData.ts:5-12`, `V8ArtifactRunControl.tsx:57-63`, `TabeleView.tsx:116`).

### 3.2. Krawędzie, które DZIAŁAJĄ
- **Interview → Org‑context ingestion** (`InterviewController.ts:779,791`, `v8/interview-insights.routes.ts:240-248`): publish‑on‑insight wywołuje `rebuildOrganizationContextSnapshot` + indeksuje do `knowledge_docs`/`knowledge_chunks` (RAG) + emituje radar signals. **Wywiad jest faktycznie writerem long‑term memory org.**
- **Org → Tools RAG** (`toolScopedRAG.ts:127`).
- **Interview → Tools / Assessment / Initiatives.**
- **Initiatives → Results (KPI‑linked) i Initiatives → Finance.**
- **Chat → Outputs artifact pipeline.**
- **Partner attribution → Billing discount** (`partner-code.routes.ts:171` → `auth.routes.ts:1690` → `BillingCommandService.ts:391,462,468`).

### 3.3. Gdzie się rwie (z file:line)
- **P0 — Execution(06) → Results(07) dead‑end** — `ExecutionHub.tsx:2558` ma CTA tylko do Initiatives, **zero forward link** do Results. To pęknięcie głównego łańcucha wartości.
- **P0 — Document Studio(10) → Outputs(09)** — autorowane dokumenty nigdy nie zapisują do `v8_output_artifacts`; niewidoczne w Outputs (`DocumentStudioView.tsx`).
- **P1 — Finance(08) → Initiative 404** — `href=/initiatives/${id}` route nie istnieje → wildcard do `/chat` (`InitiativeLinkingPanel.tsx:269`).
- **P1 — Finance export gubi `relatedInitiativeIds`** (`FinancialModelWorkspace.tsx:711` / `FinanceHub.tsx:2362`).
- **P1 — Results(07) → Outputs(09)** brak publish CTA (`ResultsKpiReportsView.tsx`).
- **P1 — `notifyContextOfNewArtifact`** to log‑only stub (`artifactRegistryService.ts:1197`) — long‑term context nie dostaje push'a o nowym artefakcie (pull tylko).

### 3.4. Outputs hub obietnica: PARTIAL
Centralny rejestr `v8_output_artifacts` + `artifactRegistryService.registerArtifactOrigin` (`artifactRegistryService.ts:1102`) faktycznie agreguje Chat, Tables, Presentations, Teresa runs, execution, finance. Export podwójnie bramkowany: client `isExportApproved` (`useRapData.ts:165`) + server `enforceNoLegalHold`/`ensureConfidentialityPolicy` (`presentations.routes.ts:1422,1442`). **Realne pdfkit/pptxgenjs.** Wady: Documents bez rejestracji, „Generate with Teresa" empty‑state nie woła `createFromChat`, 3 z 7 tabów omija aggregate view.

---

## 4. Per‑moduł — najistotniejsze ustalenia (skrót z 13 deep dossierów + 6 z COMPLETION)

### 01 Czat — rdzeń AI
**WORKS×9, voice gated×2, PARTIAL×3, BROKEN×1, MOCK×1.** Spine prawdziwie działa od UI do provider SDK + DB INSERT. **Korekta poprzedniej rundy**: Canvas diff/apply/reject **JEST** wpięte (`CanvasRichEditor.tsx:17,233`); honest 422 dla niewspieranych targetów **JEST** implementowany (`work-canvas.routes.ts:3487-3494`). Realne defekty: P0 Canvas→Outputs używa `window.location.assign('/presentations')` (zły moduł + full reload), P0 `/task`/`/decision` fetch bez AbortController (silent hang).

### 02 Moja Praca — **score wyższy niż w COMPLETION**
**Tasks bug NAPRAWIONY już** (`my-work.routes.ts:1095-1097,1099,624-652`). **Teresa "bridge dead" jest pół‑prawdą:** apply‑handlery w 4 narzędziach Ideas faktycznie działają. To, co **martwe**, to `useIdeasTeresaBridge` (0 importerów) + `idea-tool-status` back‑channel (0 emiterów) — chat→canvas Teresa command path nie istnieje.

### 03 Wywiad — orphan UI, backend solidny
`ConversationalPanel` ma **zero referencji w `src/`**, brak nawet w `RuntimeMode` enum. Backend (`ai-parse`, `evaluate-answers`, transcript GET/POST) **w pełni real LLM**. **To pure UI‑mount gap (~1 dzień)**, nie brakująca funkcja. Wywiad **PISZE long‑term memory org** (sprawdzona pętla `interview_insights → rebuildSnapshot → knowledge_chunks`).

### 04 Narzędzia — silent no‑op dla 9 z 14
DB‑init‑mismatch był pół‑prawdą: seed DOES match canonical pattern (`migrationRunner.ts:26`). 9 narzędzi (process‑automation, sop‑builder, a3, smed, dms, inventory, ai‑discovery, pain‑explorer, rpa‑scanner) streamuje AI text, **który nigdy nie zapisuje do store** (`useToolAI.ts:448-453` early‑return; `toolAiActions.ts:118,186` emituje akcje dla wszystkich `input`/`aiAssisted`). 5 strategicznych **działa real apply**.

### 05 Inicjatywy — split: PortfolioAI real, wizard/generator stub
PortfolioAiPanel: 3 endpointy `/api/ai/initiatives/{conflicts,priorities,schedule}` real LLM + apply. Wizard `generateCandidates` heurystyka. `/api/initiative-generator/generate` **zapisuje `'AI Generated Initiative'` z `description = JSON.stringify(context)`** — zero LLM. 3 dead endpointy (`/ai/generate-initiatives`, `/ai/prioritize-initiatives`, `/api/initiatives/generate-from-assessments`).

### 06 Realizacja — **Execution → Results = dead‑end (potwierdzone)**
Solidny: ExecutionHub multi‑view, V8 execution‑control (1761 linii), RolloutTab, ManagerView decision write‑back, AiRecommendationPanel. **G1 P0 runtime blocker:** `NOW()` w 5 SQLite UPDATE statements (`rollout.routes.ts:137,283,399,511,512`) — crash dev. **G4 P1 integration gap:** `ExecutionHub.tsx:2558` nawiguje tylko do Initiatives, nie Results. **G2:** `interventionSuggestions` computed at `ExecutionHub.tsx:3936` ale **nigdy renderowane** = dead useMemo.

### 07 Rezultaty — **Teresa zero integration (potwierdzone)**
Vision: evidence/accountability engine. Realność: `HandoffTargetModule` enum **nie zawiera `results/kpi/roi`** (`teresaCopilotCanon.ts:26-33`). „AI insights" w `ROIAnalysisView.tsx:376-381,531` = `belowPlanCount >= 3` threshold. **Pure label fraud.** `LATERAL JOIN` na SQLite (`benefits.routes.ts:81,88,96`) crashuje na każdej SQLite path. Results→Outputs CTA absent.

### 08 Finanse — modeling real, billing 3 mocki, Teresa dead seam
**Modeling 74 (+2):** `computeModel` (`financialModelingService.ts:643`) prawdziwy double‑entry engine z 3 consistency checks. **Billing 65 (+3):** partner discount end‑to‑end potwierdzony. **[CORR]** prior `revenue.routes.ts` 404 było WRONG — dedicated route mounted at `/api/revenue` (`Gateway.ts:639`), analytics connected. **Realne problemy:** 3 Stripe‑absent mocks (`mock_sub_${orgId}` persistowany w DB, `mock_seti_*`, `processSeatPurchase` zawsze success bez charge). **Nowy finding:** `teresaPrompt` w `FinanceHub.tsx:244-256` zbudowany, ale `useOpenChatWithContext` go nigdy nie konsumuje. **+ ORG_FINANCIAL_SUMMARY governance‑stripped defaultem** — Teresa nie widzi finansów org.

### 09 Outputs — agregacja real, 2 vision gaps potwierdzone
Centralny `v8_output_artifacts` + `registerArtifactOrigin` (`artifactRegistryService.ts:1102`) faktycznie agreguje 10/11/12 + Teresa runs + execution + finance. Export double‑gated, real pdfkit/pptxgenjs. **G5 confirmed:** Document Studio brak publish‑to‑Outputs edge. **G9:** "Generate with Teresa" empty‑state otwiera chat ale nie woła `createFromChat`. **Nowy:** `notifyContextOfNewArtifact` = log‑only stub.

### 10 Dokumenty — **editor LLM real, NL‑intent dead**
**Kluczowa korekta:** `DocumentStudioEditorPanel.tsx:107` używa **scope‑dropdown + instruction box** wywołujących typed proposal endpoints (`/editor/proposals/{local,section,global,...}`) → `refineEditorTextWithLlm` → real `generateChatResponse`. AI edycja **działa** przez explicit scope. Martwa jest tylko free‑form Teresa NL router (`documentTeresaIntent` tylko w testach). Block‑prose generation real LLM ale `useLlm` default **false** (`DocumentStudioView.tsx:41`). **P0:** flip default + wire dead Teresa intent + expose create‑from‑chat.

### 11 Tabele — **wszystko gotowe, wszystko wyłączone**
8‑level apply chain (`MutationExecutor`) live, zod‑validated, atomic. **8 flag OFF** (`FeatureFlags.ts:82,88,94,100` server `=== 'true'` → OFF; `tabeleAiEditorFlag.ts:31` client default false; MELS shell OFF). **P0: flip 4 server + 4 client flags + add `requireTablePlatform.catch()` (`table-platform.routes.ts:82`).**

### 12 Prezentacje — narrative real (4/15), agent edit fake
`presentationGeneratorService.ts:1245`: 4 z 15 intentów real LLM (executive_summary, key_messages, next_steps, recommendation_portfolio); pozostałe 11 deterministic templating. **Agent edit `applyPresentationEditPlan` (`presentationAgentEditService.ts:308`) + `parsePresentationEditIntent:46` pure regex/keyword** — `matchAll(/slide|slajd/)`, `.includes('summary')`, `text.slice(0,180)`. Zero LLM. **P0:** replace heuristic agent‑edit z `modelRouter`, LLM outline endpoint, narrative do 15 intentów.

### 13 Meeting — live‑Teresa dead, scheduler real (odwrotny kierunek)
`meetingIntelligenceService.ts:48` — `private llmClient: any = null`; `setLLMClient` (`:51`) **never invoked anywhere** (4 services define it, 0 call sites). Service **nie importowany** przez żaden plik poza sobą, **żaden route nie eksponuje go**. Dead branch. **Real:** CRUD, calendar grid, follow‑ups, operator brief (rule‑based template w `aiOperatorService.ts:691`), `MeetingExecutor` (Teresa schedules meeting — `meetingExecutor.ts:19`, `actionExecutionAdapter.ts:174`). **Absent:** live transcript (Fireflies zero; Whisper unwired), Teresa live suggestions, post‑meeting recap. **P0:** inject LLM client + add generate‑notes route+button + transcript source.

### 14/15 Deferred — shared DB defect
`mcp_providers`/`marketplace_imports`/allowlist/tools_cache **brak w `DatabaseInitializer.ts`**, są tylko w `PostgresDatabase.ts:1550` → `tryGetColumns` silent `[]`, import 503 (`mcp.routes.ts:508`). `$1` vs `?` placeholder mismatch potwierdzony (6× vs 69×). **1 shared P0 (1 day)** + stay parked.

### 16 Organizacja — **silnik kontekstu, ale 1 P0 + KG nieoptymalnie**
4 ścieżki kontekstu do Teresy (A: kanonik aiContextBuilder z claim‑snapshot + contextItemsSample + orgPatterns + terminology; B: legacy `@ts-nocheck`; C: ContextRetrievalService ACL; D: governance filter). **KG IS injected** `[CORR]` (`AIPipeline.ts:1264`). **P0:** InvitationSendingService (`InvitationSendingService.ts:9-38`) wszystkie 3 `send*` to logger stubs — invite email nie wychodzi. **P1:** dual‑path consolidation, podwójny widget kontekstu, isAdmin po nazwie sekcji nie roli.

### 17 Admin — budżety podpięte, UI linkage niepewny **[CORR]**
**Prior „budżety dekoracyjne" PARTLY REFUTED:** `AIPipeline.ts:306` → `checkBudget` reads `ai_budgets` table (gated `AI_BUDGETS_ENABLED`). ALE: `organization_limits` nieczytany, Admin UI pisze `ai-settings/org` zamiast `ai_budgets` — **UI↔budget‑table linkage nieudowodniona**. **Cross‑org 403 guard** real (`adminP32.routes.ts:300-306`). **SUPERADMIN→admin boundary closed** (`ProtectedRoute.tsx:68-73`). **18 isSensitive audit events** real. **3 luki:** P0 link AI budget UI→table (lub czyt `organization_limits`); P1 zamontować 8 sub‑tabów AccessLimitsTab itd.; P0 audit role‑change/remove member (idzie via org route — brak `adminAuditService` event).

### 18 Ustawienia — **3 P0 bezpieczeństwa potwierdzone**
- **P0 G1 — GDPR delete bez bramki hasła.** `Api.requestGdprDeletion()` (`api.ts:15280`) → `POST /api/gdpr/deletion-request` (`gdpr.routes.ts:533`) — **zero bcrypt check**. Bcrypt‑gated route `/api/settings/gdpr/deletion-request` istnieje ale **nikt go nie woła**. Authenticated session self‑deletes bez hasła.
- **P0 G2 — `Api.deleteAccount` stub** (`api.ts:10669` — `return;`).
- **P0 G3 — AI‑settings 503 fallback dead at runtime.** `Gateway.ts:37` mounts `server/src/routes/ai/ai-settings.routes.ts` z hard 503; graceful fallback w root `ai-settings.routes.ts` **nigdy nie mounted**.
- **Settings nie sterują Teresą:** `response_style`, `writing_tone`, `proactivity_mode`, `temperature`, `topP`, frequency/presence penalty wszystkie save do `user_ai_settings`, `AIContextBuilder` injektuje `context.aiSettings` — **ale nic w `AIPipeline.ts`/`ai.routes.ts`/`persona.ts` nie czyta tych pól do kształtowania calla LLM**. Pipeline czyta tylko `userMemory.preferences` (`AIPipeline.ts:1165-1180`). **Fix:** wpiąć `effective.*` w `ai.routes.ts:1799-1811`.
- **BYOK plaintext** w DB mimo deklaracji „never sent".

### 19 Partner — backend solidny, frontend pełen orphanów **[CORR]**
**Korekty:** (A) `@ts-nocheck` **na LIVE path** — `PartnerPortalView.tsx:162,679,1422,2097,2354,3110` wywołuje legacy `/api/partners/*`; V8 użyte tylko dla 3 calli. P0 nie do deprioretyzowania. (B) **6 partner sub‑views orphaned** (lazy‑imported, never in `<Route>`). (C) **`usePartnerEcosystem` ma ZERO consumerów** — hardcoded mock (`usePartnerEcosystem.ts:19-67`, health=78) = **dead code do usunięcia**, nie „live MOCK do wpięcia". Realne: registration/connect, referral, attribution (`partners.routes.ts:303-959`), attribution→billing real (`BillingCommandService.ts:391,462,468`). Stuby: 9 pure‑503 (POST `/clients:1284`, GET `/clients/:id:1297`, POST `/employees:1350`, GET `/stats:1370`, POST `/access-links:1387`, GET/POST `/licenses:1836/1849`, GET `/invoices:1908/1925`).

---

## 5. Sekwencjonowany program dokończenia do 100% — zaktualizowany

Filozofia bez zmian: **najpierw spiąć to, co już zbudowane**, potem governance/bezpieczeństwo, potem długie ogony, potem odroczone.

### WAVE A — Spięcie pamięci i Teresa naprawdę działa (NAJWYŻSZY ROI)
- **A0** Pętla zapisu pamięci user/org factual: podpiąć `recordInteraction`/`updateUserMemory` obok KG processConversation w `ai.routes.ts:4517`. Ujednolicić `ai_user_memory` schema collision (075 vs 250). Rehydrate history server‑side w `AIPipeline.ts:1013`.
- **A1** Wstrzyknąć `llmClient` do `meetingIntelligenceService.ts:51` + dodać route `generate-notes` + button + Whisper transcript source (Meeting 13).
- **A2** Zamontować `ConversationalPanel` + `SufficiencyIndicator` + dodać `conversational` do `RuntimeMode` enum (`RuntimeModeSelector.tsx:22`) (Wywiad 03).
- **A3** Podpiąć `documentTeresaIntent` w produkcie + flip `useLlm` default na true w `DocumentStudioView.tsx:41` + expose `createFromChat` w Outputs (Dokumenty 10 + Outputs 09).
- **A4** Apply‑handlery dla 9 niedziałających narzędzi: zawęzić emiter `toolAiActions.ts:118,186` żeby nie strzelał dla każdego `input`/`aiAssisted`; rozszerzyć `useToolAI.ts:448-453` (Narzędzia 04).
- **A5** Inicjatywy: wpiąć LLM w `initiative-generator.routes.ts:46-57` + `initiativeWizardService.generateCandidates`; podpiąć/usunąć 3 dead endpointy (Inicjatywy 05).
- **A6** `applyPresentationEditPlan` → realny LLM edit‑plan zamiast regex (`presentationAgentEditService.ts:308`); rozszerzyć narrative LLM z 4 do 15 intentów (Prezentacje 12).
- **A7** Tabele: flip 4 server + 4 client flag OFF→ON; dodać `.catch()` na `table-platform.routes.ts:82` (Tabele 11).
- **A8** Ustawienia AI realnie sterują Teresą: wpiąć `effective.{temperature,response_style,writing_tone,proactivity}` w `ai.routes.ts:1799-1811` + system prompt (Ustawienia 18).
- **A9** Execution → Results CTA: zastąpić `ExecutionHub.tsx:2558` „View in Results" linkiem + przekazać sourceRefs (Realizacja 06 → Rezultaty 07).
- **A10** Rezultaty: dodać `results/kpi/roi` do `teresaCopilotCanon.ts:26-33` + zamienić `belowPlanCount` fraud na realny LLM call (Rezultaty 07).
- **A11** Finanse: konsumować `teresaPrompt` w `FinanceHub.tsx` (zmień `useOpenChatWithContext` żeby przekazał prompt jako opener); **odwrócić governance default** dla `ORG_FINANCIAL_SUMMARY` lub dodać UI toggle (`contextGovernance.ts:38`).
- **A12** Knowledge Graph wpiąć w governance filter (`AIPipeline.ts:1264` → `filterContextByPolicy`).

### WAVE B — Governance, bezpieczeństwo, zaufanie (GA‑blockers)
- **B1 P0 GDPR:** UI dzwoni bramkowaną hasłem `/api/settings/gdpr/...`; zaimplementować `Api.deleteAccount` (`api.ts:10669`).
- **B2 P0 AI‑settings:** zamontować łaskawy fallback (`Gateway.ts:37`).
- **B3 P0 Admin budżety AI linkage:** Admin UI pisze do `ai_budgets` table (lub Pipeline czyta `organization_limits` zapisane przez UI).
- **B4 P0 Admin/AI sub‑taby:** zamontować 8 zbudowanych (`AccessLimitsTab` itd.) w `AdminAIControlCenterPanel.tsx`.
- **B5 P0 Audit najczulszych mutacji:** role‑change/remove member, profil/webhooks/working‑hours, settings.
- **B6 P0 `partners.routes.ts`:** zdjąć `@ts-nocheck`, zabezpieczyć payout/auth (2898 linii).
- **B7 P0 Governance fail‑CLOSED** zamiast fail‑OPEN (`aiContextBuilder.ts:350,974`); ship UI dla `ai-governance.routes.ts`.
- **B8 P0 Stripe mocks:** wyrzucić `mock_sub_${orgId}`, `mock_seti_*`, `processSeatPurchase` bez charge (lub feature‑flag).
- **B9 P1 BYOK:** szyfrowanie kluczy w DB.
- **B10 P0 SQLite blokery:** `NOW()` w `rollout.routes.ts:137,283,399,511,512`; `LATERAL JOIN` w `benefits.routes.ts:81,88,96`.

### WAVE C — Stuby → realne końcówki
- **C1** `InvitationSendingService.ts:9-38` SMTP/SendGrid (Organizacja 16).
- **C2** Per‑org email zamiast `billing@example.com` (`adminP32.routes.ts:1236,1243`); backup routes (Admin 17).
- **C3** Partner dead buttons + 9 stub endpointów (`partners.routes.ts:1284-1925`); usunąć martwy `usePartnerEcosystem`; podpiąć/usunąć 6 orphan sub‑views.
- **C4** Calendar sync „Coming soon" zamiast 501 (Ustawienia 18).
- **C5** Manualny billing → automacja faktur/limitów (Finanse 08).
- **C6** Canvas→Outputs: zamienić `window.location.assign('/presentations')` na proper navigation z preserved state (`WorkCanvasDocumentPanel.tsx:1158`); AbortController/timeout dla `/task` `/decision` (`UnifiedChatPanel.tsx:1722`); `useAIStream.ts:1228-1238` `finally` block; honest 422 inline handler (Czat 01).

### WAVE D — Spójność danych i UI
- **D1** Finance→Initiative 404 — dodać `/initiatives/:id` route lub przekierować poprawnie (`InitiativeLinkingPanel.tsx:269`).
- **D2** Finance export: zachować `relatedInitiativeIds` (`FinanceHub.tsx:2362`).
- **D3** Results→Outputs publish CTA (`ResultsKpiReportsView.tsx`).
- **D4** `notifyContextOfNewArtifact` realne push do long‑term context (`artifactRegistryService.ts:1197`).
- **D5** Color/UI drift → crimson tokens (`_DESIGN_SYSTEM_STANDARDIZATION_PLAN.md`).
- **D6** Usunąć podwójny widget kontekstu org; `isAdmin` po roli (Organizacja 16).
- **D7** Mikro‑cache 30s na `buildResolvedContext` (perf, `OrganizationContextService.ts:868`).
- **D8** pgvector zamiast in‑JS cosine (skalowanie RAG, `ragService.ts:691`).

### WAVE E — Odroczone (po v1)
- **E1** DB init / adapter mismatch (14+15 wspólne, 1 dzień).
- **E2** MCP/Iris (14) un‑park.
- **E3** Marketplace (15) — zależność zewnętrzna: usługa DBR77 musi publikować assety.

---

## 6. Definicja „100%" — zaktualizowana

System jest „w 100%" gdy łącznie:

1. **Teresa nie ma martwych przycisków i niemontowanych paneli** — każdy widoczny przycisk AI ma działający apply‑handler; każdy zbudowany panel AI jest zamontowany; żaden „AI" nie jest regexem/threshold count podawanym jako LLM.
2. **Pętla pamięci domknięta w obie strony** — kontekst się **czyta** i kontekst się **zapisuje** z poziomu Teresy. User factual memory + org factual memory updatowane automatycznie po każdej znaczącej interakcji. History rehydrowana server‑side. Schemat `ai_user_memory` zunifikowany.
3. **Kontekst kompletny** — claim‑snapshot **+ KG + ORG_FINANCIAL_SUMMARY** zasilają Teresę jedną kanoniczną ścieżką (nie dual‑path). Ustawienia AI realnie zmieniają zachowanie modelu. Governance fail‑CLOSED, KG w filtrze.
4. **Governance egzekwowany i widoczny** — limity/budżety AI blokują realnie, Admin UI faktycznie pisze do tej tabeli, którą Pipeline czyta. Najczulsze mutacje audytowane (członkostwo, profile, webhooks). UI dla `ai-governance.routes.ts` shipped.
5. **Brak stubów w widocznych ścieżkach** — żaden przycisk nie prowadzi do 501/503/no‑op; e‑mail (invite/billing) faktycznie wychodzi; dokumenty Studio rejestrują się w Outputs; Execution→Results CTA istnieje.
6. **Bezpieczeństwo domknięte** — GDPR delete za bramką hasła, brak `@ts-nocheck` na ścieżkach payout/auth (Partner), BYOK szyfrowane, Stripe mocks usunięte, SQLite blokery (NOW(), LATERAL) usunięte.
7. **Spójność wizualna** — crimson jako jedyny akcent (per design‑system plan).
8. **Odroczone udokumentowane** — 14/15 jawne kryteria un‑park.

---

## 7. Co dalej (rekomendacja)

1. **NAJPIERW WAVE A** — to różnica między „aplikacją z przyciskami AI" a „aplikacją gdzie Teresa rzeczywiście pracuje i pamięta". A0 (pętla pamięci) + A11 (Teresa widzi finanse) + A8 (ustawienia sterują) + A1 (Meeting live) + A9 (Execution→Results) to **single biggest jump w odczuwalnej inteligencji systemu** — wszystkie przez podpięcie, nie pisanie.
2. **Równolegle WAVE B** — bezpieczeństwo/governance jako warunek GA. B1/B2/B6/B7/B10 są nie‑opcjonalne dla wypuszczenia.
3. WAVE C/D potem; E po v1.
4. Po Wave A/B — **owner visual review** (crimson + LP) per `_DESIGN_SYSTEM_STANDARDIZATION_PLAN.md`.

**Estymata sumaryczna** (na podstawie P0/P1 z 13 deep dossierów + 19 completion):
- WAVE A: ~6–8 dni inżynierskich (głównie podpinanie + ujednolicanie).
- WAVE B: ~4–5 dni (bezpieczeństwo + governance UI).
- WAVE C: ~6–8 dni (stuby + SMTP).
- WAVE D: ~3–4 dni.

To realna ścieżka do **prawdziwego 95–98/100** w 3–4 tygodnie inżynierskie. **Pełne 100% wymaga E (deferred + DBR77 zewnętrzna zależność).**

---

**Pełne uzasadnienia z `file:line` i estymatami P0/P1/P2 — w 13 plikach `DEEP_*.md` + 19 plikach `COMPLETION_NN_*.md` w tym katalogu/poprzednim.**
