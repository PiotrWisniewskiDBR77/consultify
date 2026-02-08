# Modul: Tools - Overview

## Plan zrodlowy
`wdrozenia/plan-tools-initiatives.md`

## Audyt zgodnosci (dowod)
`wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`

## Cel
Discovery tools -> generowanie inicjatyw (DRAFT) z DoD i gate decisions.

## Standard artefaktu (raport z Tools)
W module Tools „raport” jest artefaktem Discovery (snapshot + approval + eksport), a nie raportem zarządczym:
- `wdrozenia/standards/entities/04-TOOL-REPORT.md`

## AI Chat System Health (L6) - 18 Poziomów Testów ✅ ZAIMPLEMENTOWANE

### Wersja: 3.0.0 | Testy: 75 | Status: 100% PASS

### Dokumentacja
- **Raport sprawności AI** - `wdrozenia/modules/tools/AI-CHAT-SYSTEM-HEALTH.md`
- **Plan stabilizacji** - `wdrozenia/modules/tools/AI-SYSTEM-STABILIZATION-PLAN.md`

### Podstawowe testy (L6.1-L6.8) - ✅ Zaimplementowane (22 testy)
| Test | Obszar | Testy | Status |
|------|--------|-------|--------|
| L6.1 | Cloud Integrations | 2 | ✅ |
| L6.2 | Tools Menu | 3 | ✅ |
| L6.3 | Chat Conversation | 3 | ✅ |
| L6.4 | Voice System | 3 | ✅ |
| L6.5 | History Management | 3 | ✅ |
| L6.6 | LLM Management | 3 | ✅ |
| L6.7 | End-to-End Flow | 2 | ✅ |
| L6.8 | Health Summary | 3 | ✅ |

### Zaawansowane testy (L6.9-L6.18) - ✅ Zaimplementowane (53 testy)
| Test | Obszar | Testy | Status |
|------|--------|-------|--------|
| L6.9 | Vector DB / Embeddings | 5 | ✅ |
| L6.10 | AI Memory System | 5 | ✅ |
| L6.11 | AI Learning System | 6 | ✅ |
| L6.12 | User Style Profiles | 4 | ✅ |
| L6.13 | Context Builder (RAG) | 4 | ✅ |
| L6.14 | AI Database Tables | 7 | ✅ |
| L6.15 | AI Pipeline & Streaming | 7 | ✅ |
| L6.16 | AI Admin Management | 6 | ✅ |
| L6.17 | AI Quality & Observability | 7 | ✅ |
| L6.18 | Complete System Summary | 2 | ✅ |

### API Endpoints
- Health Check: `GET /api/ai/health-check`
- Health Check (Full): `GET /api/ai/health-check?advanced=true`
- Summary: `GET /api/ai/health-check/summary`
- Advanced: `GET /api/ai/health-check/advanced`
- Subsystem: `GET /api/ai/health-check/subsystem/:name`
  - Basic: cloud, tools, chat, voice, history, llm
  - Advanced: vector, embeddings, memory, learning, style, context, rag, database, tables, pipeline, admin, quality, observability

### Testy E2E
```bash
# Wszystkie testy L6 (75 testów)
npx playwright test tests/e2e/ai-system-health.spec.ts

# Pojedyncza grupa
npx playwright test tests/e2e/ai-system-health.spec.ts -g "L6.9"

# Tylko zaawansowane
npx playwright test tests/e2e/ai-system-health.spec.ts -g "L6.1[0-8]"
```

---

## Dokumentacja funkcjonalnosci

### Frontend
- **ToolDocumentView (Kanoniczny widok)** - `wdrozenia/modules/tools/frontend/07-tool-document-view.md`
  - Dwukolumnowy layout zgodny z Golden Standard
  - Step-based workflow z nawigacją
  - ToolCanvas integration
  - DoD Checklist i logika completion
  - Auto-save i hydration z API
  - AI Integration w każdej sekcji
  - Gate Decisions i Generated Initiatives

### Backend
- **API Endpoints** - `wdrozenia/modules/tools/backend/01-api-list.md`
- **Request Review** - `wdrozenia/modules/tools/backend/01-request-review.md`
- **Generate Initiatives** - `wdrozenia/modules/tools/backend/03-generate-initiatives.md`

### UI/UX
- **Hub Structure** - `wdrozenia/modules/tools/frontend/01-hub-structure.md`
- **Completion Checker** - `wdrozenia/modules/tools/frontend/01-completion-checker.md`
- **Generate Modal** - `wdrozenia/modules/tools/frontend/06-generate-modal.md`

---

## Podsumowanie zgodnosci: ~95%

### Wymagania krytyczne (Kryteria rozliczenia)
| Wymaganie | Status | Dowod |
|-----------|--------|-------|
| Flow DRAFT -> REVIEW -> APPROVED -> Generate | ✅ | E2E test, ToolController.ts |
| Inicjatywy widoczne w Initiatives jako DRAFT | ✅ | source_type='tool' w initiatives |
| DoD i role blokuja przejscia | ✅ | requireDoD(), ensurePermission() |
| UI/UX zgodny ze standardem (ClickUp-like) | ✅ | ModuleHub pattern, Golden Standard |

### Deliverables
| Deliverable | Status | Pliki |
|-------------|--------|-------|
| 1) Widoki UI/UX | ✅ | ToolWorkspace, ToolReviewPanel, GenerateModal |
| 2) API endpoints + walidacje | ✅ | tools.routes.ts, tool.validators.ts |
| 3) Model danych i relacje | ✅ | 4 tabele, migracje 291-292 |
| 4) Decyzje (gates) i audit log | ✅ | tool_decisions, audit_log |
| 5) Testy (unit/API/E2E) | ✅ | 40+ testow |

---

## Zaimplementowane funkcjonalnosci

### Workflow statusow
| Status | Opis | Akcje dostepne | Nastepny status |
|--------|------|----------------|-----------------|
| DRAFT | Sesja w trakcie edycji | Edit, Request Review | REVIEW |
| REVIEW | Oczekuje na zatwierdzenie | Approve, Send back | APPROVED / DRAFT |
| APPROVED | Zatwierdzone | Generate initiatives | COMPLETED |
| COMPLETED | Zakonczono generowanie | View, Export | - |

### API Endpoints (9 endpointow)
| Endpoint | Metoda | Opis | Auth | Rate Limit |
|----------|--------|------|------|------------|
| `/api/tools` | POST | Utworz sesje narzedzia | TOOLS_CREATE | 20/h |
| `/api/tools` | GET | Lista sesji (z filtrami) | TOOLS_VIEW | 200/h |
| `/api/tools/:toolId` | GET | Pobierz sesje | TOOLS_VIEW | 200/h |
| `/api/tools/:toolId` | PUT | Aktualizuj sesje | TOOLS_EDIT | 100/h |
| `/api/tools/:toolId/request-review` | POST | Wyslij do review | TOOLS_REQUEST_REVIEW | 20/h |
| `/api/tools/:toolId/approve` | POST | Zatwierdz narzedzie | TOOLS_APPROVE | 20/h |
| `/api/tools/:toolId/send-back` | POST | Odeslij do draft | TOOLS_APPROVE | 20/h |
| `/api/tools/:toolId/generate-initiatives` | POST | Generuj inicjatywy | TOOLS_GENERATE | 10/h |
| `/api/tools/:toolId/generated-initiatives` | GET | Lista wygenerowanych | TOOLS_VIEW | 200/h |

### Model danych
| Tabela | Opis | Kolumny kluczowe |
|--------|------|------------------|
| `tool_sessions` | Sesje narzedzi | id, org_id, tool_type, status, completion_percent, confidence_avg |
| `tool_decisions` | Decyzje (gates) | id, tool_session_id, decision_type, status, decision_id |
| `tool_initiative_batches` | Batche generowania | id, tool_session_id, methodology_id, count, generated_by |
| `tool_initiative_links` | Powiazania tool -> initiative | id, tool_session_id, batch_id, initiative_id |

### Permissions
| Permission | Role | Opis |
|------------|------|------|
| `TOOLS_VIEW` | USER, ADMIN, PM, SUPERADMIN | Podglad narzedzi |
| `TOOLS_CREATE` | ADMIN, PM, SUPERADMIN | Tworzenie sesji |
| `TOOLS_EDIT` | ADMIN, PM, SUPERADMIN | Edycja sesji |
| `TOOLS_REQUEST_REVIEW` | ADMIN, PM, SUPERADMIN | Wysylanie do review |
| `TOOLS_APPROVE` | ADMIN, SUPERADMIN | Zatwierdzanie / odrzucanie |
| `TOOLS_GENERATE_INITIATIVES` | ADMIN, PM, SUPERADMIN | Generowanie inicjatyw |
| `TOOLS_DELETE` | SUPERADMIN | Usuwanie sesji |

### Definition of Done (DoD)
| Kryterium | Wartosc | Opis |
|-----------|---------|------|
| `completion_percent` | >= 100 | Wszystkie wymagane pola wypelnione |
| `confidence_avg` | >= 3 | Srednia pewnosc odpowiedzi (skala 1-5) |

### UI Komponenty
| Komponent | Plik | Opis | Status |
|-----------|------|------|--------|
| **ToolDocumentView** | `ToolDocumentView.tsx` | **Kanoniczny widok dokumentu (dwukolumnowy)** | ✅ Active |
| ToolCanvas | `ToolCanvas.tsx` | Renderowanie treści narzędzia (kroki) | ✅ Active |
| GenerateInitiativesModal | `GenerateInitiativesModal.tsx` | Modal generowania (count 3-7, metodyka) | ✅ Active |
| ToolReviewPanel | `ToolReviewPanel.tsx` | Panel review z gaps i akcjami | ✅ Active |
| DiscoveryToolsHub | `DiscoveryToolsHub.tsx` | Hub z zakladkami i kategoriami | ✅ Active |
| toolCompletion | `toolCompletion.ts` | Logika DoD i gaps (computeToolCompletionItems, computeToolReviewGaps) | ✅ Active |
| ToolWorkspace | `ToolWorkspace.tsx` | ~~Legacy workspace~~ (zastąpiony przez ToolDocumentView) | ⚠️ Deprecated |
| ToolContextPanel | `ToolContextPanel.tsx` | ~~Prawy panel~~ (zintegrowany w ToolDocumentView) | ⚠️ Deprecated |
| ToolHeader | `ToolHeader.tsx` | ~~Header~~ (zintegrowany w ToolDocumentView) | ⚠️ Deprecated |
| ToolActionBar | `ToolActionBar.tsx` | ~~Action bar~~ (zintegrowany w ToolDocumentView) | ⚠️ Deprecated |
| InlineAssist | `InlineAssist.tsx` | Micro-suggestions przy polach | ✅ Active |

### Generowanie inicjatyw
| Metodologia | Category | Priority | Risk | Best For |
|-------------|----------|----------|------|----------|
| Impact x Feasibility | Strategy | P1 | Medium | Strategic planning |
| Value x Effort | Operations | P2 | Low | Quick wins |
| Risk/Compliance | Process Auto | P1 | High | Compliance |
| Customer/Market | Digital | P2 | Medium | CX improvements |
| Operational Efficiency | Operations | P2 | Low | Cost reduction |

### AI Pipeline
| Etap | Opis | Timeout |
|------|------|---------|
| Build Prompt | Kontekst org + chat + tool answers | - |
| Call AI | GPT-4 Turbo | 8s |
| Retry | 1 retry przy bledzie | 8s |
| Fallback | Generowanie fallback initiatives | - |
| Normalize | Deduplikacja, walidacja, defaults | - |
| Persist | Zapis do initiatives + links | - |

### Decision Management (Gates)
| Decision Type | Status | Opis |
|---------------|--------|------|
| REQUEST_REVIEW | PENDING -> APPROVED | Wyslanie do review |
| APPROVE_TOOL | PENDING -> APPROVED/REJECTED | Zatwierdzenie lub odrzucenie |
| GENERATE_INITIATIVES | APPROVED | Generowanie inicjatyw |

### Audit Log
| Action | Opis | Details |
|--------|------|---------|
| `tool_review_requested` | Wyslano do review | decisionId, priority, dueDate |
| `tool_approved` | Zatwierdzono | decisionId, comment |
| `tool_sent_back` | Odeslano do draft | decisionId, reason |
| `initiatives_generated` | Wygenerowano inicjatywy | batchId, count, methodologyId |

### Testy
| Typ | Plik | Liczba testow |
|-----|------|---------------|
| Unit - Validators | `tool.validators.test.ts` | 15 |
| Unit - Routes | `tools.routes.test.ts` | 13 |
| E2E | `tools-to-initiatives.spec.ts` | 12 |
| **RAZEM** | - | **40** |

---

## Nowe funkcjonalności (2026-01)

### ToolDocumentView (Kanoniczny widok)
- ✅ **Dwukolumnowy layout** zgodny z Golden Standard (Task/Initiative)
- ✅ **Step-based workflow** - klikalne step pills, Previous/Next navigation
- ✅ **ToolCanvas integration** - renderowanie treści narzędzia z `showContextPanel={false}`
- ✅ **DoD Checklist** - dynamicznie generowany przez `computeToolCompletionItems()`
- ✅ **hydrateSessionFromApi** - poprawne ładowanie danych z backendu do store
- ✅ **Auto-save** - debounced zapis zmian (1.5s)
- ✅ **AI Integration** - Generate with AI w każdej sekcji, AI comments
- ✅ **Gate Decisions** - wyświetlanie wszystkich decyzji bramkowych
- ✅ **Generated Initiatives** - lista inicjatyw z linkami do pełnego widoku
- ✅ **Comments Section** - shared component z Task/Initiative
- ✅ **Activity Log** - historia zmian statusu i akcji

**Dokumentacja:** `wdrozenia/modules/tools/frontend/07-tool-document-view.md`

### toolCompletion.ts (Centralized DoD Logic)
- ✅ **computeToolReviewGaps()** - lista brakujących elementów dla review
- ✅ **computeToolCompletionItems()** - lista kryteriów DoD z statusem done/not done
- ✅ **Tool-specific logic** - obsługa SWOT, Porter, Growth Paths, Portfolio Priority, Risk & Uncertainty

**Dokumentacja:** `wdrozenia/modules/tools/frontend/07-tool-document-view.md` (sekcja "Tool Completion Logic")

---

## Braki / Nice-to-have (P2/P3)

### P2 (Enhancement)
| Feature | Opis | Effort |
|---------|------|--------|
| Go to section z DoD | Scroll do sekcji w lewej kolumnie z DoD checklist | 2h |
| Team section | Wyświetlanie owner/reviewer z opisami ról | 2h |
| Traceability section | Pokazanie źródła narzędzia (assessment, interview) | 2h |
| Decision Owner Selection UI | Backend przyjmuje `decisionOwnerId`, UI brak selektora | 2h |
| Link z Initiative do Tool | `source_type='tool'` zapisane, brak linku w UI | 1h |
| Batch history view | Lista wszystkich batchy generowania | 3h |
| Export to PDF | Eksport analizy do PDF | 4h |

### P3 (Nice-to-have)
| Feature | Opis | Effort |
|---------|------|--------|
| Tooltipy Confidence | Tooltip z uzasadnieniem confidence | 1h |
| Wybor fragmentow czatu (pinowanie) | Tylko ostatnie 50 wiadomosci | 4h |
| Related Initiatives w Context Panel | Wyswietlane ostatnie 5, brak ryzyka | 2h |
| Checklist DoD w Request Review Modal | Interaktywna checklist | 3h |
| Collaborative editing | Real-time sync miedzy userami | 8h |
| Version history | Historia zmian sesji | 6h |

---

## Narzedzia (31 total)

### Zaimplementowane (5)
| ID | Nazwa | Kategoria | Status |
|----|-------|-----------|--------|
| `dynamic-swot` | Dynamic SWOT | Strategy | ✅ Active |
| `market-forces` | Market Forces / Porter | Strategy | ✅ Active |
| `growth-paths` | Growth Paths / Ansoff | Strategy | ✅ Active |
| `portfolio-priority` | Portfolio Priority / BCG | Strategy | ✅ Active |
| `risk-uncertainty` | Risk & Uncertainty | Strategy | ✅ Active |

### Coming Soon - Strategic (5)
| ID | Nazwa | Kategoria | ETA |
|----|-------|-----------|-----|
| `value-chain` | Value Chain | Strategy | Q2 2026 |
| `ambition-decomposer` | Ambition Decomposer | Strategy | Q2 2026 |
| `focus-tradeoff` | Focus & Trade-off | Strategy | Q2 2026 |
| `capability-mapper` | Capability Mapper | Strategy | Q3 2026 |
| `narrative-engine` | Narrative Engine | Strategy | Q3 2026 |

### Coming Soon - Operational (10)
| ID | Nazwa | Kategoria | ETA |
|----|-------|-----------|-----|
| `vsm-builder` | VSM Builder | Operations | Q2 2026 |
| `sop-builder` | SOP Builder | Operations | Q2 2026 |
| `a3-problem` | A3 Problem Solving | Operations | Q2 2026 |
| `smed-planner` | SMED Planner | Operations | Q3 2026 |
| `dms-builder` | DMS Builder | Operations | Q3 2026 |
| `automation-pipeline` | Automation Pipeline | Operations | Q3 2026 |
| `constraint-control` | Constraint Control | Operations | Q3 2026 |
| `decision-engine` | Decision Engine | Operations | Q4 2026 |
| `control-tower` | Control Tower | Operations | Q4 2026 |
| `inventory-autopilot` | Inventory Autopilot | Operations | Q4 2026 |

### Coming Soon - Digital (10)
| ID | Nazwa | Kategoria | ETA |
|----|-------|-----------|-----|
| `robotics-feasibility` | Robotics Feasibility | Digital | Q2 2026 |
| `logistics-automation` | Logistics Automation | Digital | Q2 2026 |
| `rpa-scanner` | RPA Scanner | Digital | Q2 2026 |
| `ai-discovery` | AI Discovery | Digital | Q3 2026 |
| `integration-diagnostic` | Integration Diagnostic | Digital | Q3 2026 |
| `digital-value-pool` | Digital Value Pool | Digital | Q3 2026 |
| `legacy-analyzer` | Legacy Analyzer | Digital | Q3 2026 |
| `data-inventory` | Data Inventory | Digital | Q4 2026 |
| `pain-to-solution` | Pain-to-Solution | Digital | Q4 2026 |
| `pain-explorer` | Pain Explorer | Digital | Q4 2026 |

### Coming Soon - Process Automation (1)
| ID | Nazwa | Kategoria | ETA |
|----|-------|-----------|-----|
| `process-automation-builder` | Process Automation Builder | Automation | Q3 2026 |

---

## Rekomendacje dalszego rozwoju

### Priorytet 1 (Q1 2026) - ✅ Ukończone
1. ✅ **ToolDocumentView** - kanoniczny widok dwukolumnowy
2. ✅ **Step-based workflow** - nawigacja między krokami
3. ✅ **toolCompletion.ts** - centralizacja logiki DoD
4. ✅ **hydrateSessionFromApi** - poprawne ładowanie z backendu

### Priorytet 2 (Q2 2026)
1. **Go to section z DoD** - scroll do sekcji z checklist
2. **Team section** - owner/reviewer z opisami ról
3. **Traceability section** - źródło narzędzia (assessment, interview)
4. **Dodac selektor decision owner** - w request review modal
5. **Dodac link z Initiative do Tool** - w InitiativeDetailCard
6. **Rozszerzyc testy** - coverage do 80%

### Priorytet 3 (Q3-Q4 2026)
7. **Rozszerzyc related initiatives** - pokazac ryzyko i wiecej szczegolow
8. **Dodac tooltipy confidence** - wyjasnienie dlaczego confidence jest na danym poziomie
9. **Dodac pinowanie fragmentow czatu** - dla lepszego kontekstu
10. **Export do PDF** - eksport analizy
11. **Collaborative editing** - real-time sync
12. **Version history** - historia zmian
13. **Nowe narzedzia** - Value Chain, VSM Builder, RPA Scanner

---

## Metryki sukcesu

| Metryka | Target | Obecny |
|---------|--------|--------|
| Czas generowania inicjatyw | < 10s | ~5s |
| Czas ladowania listy sesji | < 200ms | ~150ms |
| Test coverage | 80% | ~70% |
| E2E pass rate | 100% | 100% |
| User satisfaction | > 4.0/5 | TBD |

---

## Pliki zrodlowe

### Backend
| Plik | Opis | Linie |
|------|------|-------|
| `server/src/routes/tools.routes.ts` | Routing | ~100 |
| `server/src/controllers/ToolController.ts` | Controller | ~1000 |
| `server/src/services/ToolInitiativeService.ts` | AI Service | ~300 |
| `server/src/validators/tool.validators.ts` | Validators | ~100 |

### Frontend
| Plik | Opis | Linie |
|------|------|-------|
| `src/components/DiscoveryTools/ToolDocumentView.tsx` | **Kanoniczny widok dokumentu (dwukolumnowy)** | ~1500 | ✅ Active |
| `src/components/DiscoveryTools/ToolCanvas.tsx` | Renderowanie treści narzędzia (kroki) | ~400 | ✅ Active |
| `src/components/DiscoveryTools/toolCompletion.ts` | Logika DoD i gaps | ~220 | ✅ Active |
| `src/components/DiscoveryTools/GenerateInitiativesModal.tsx` | Modal generowania inicjatyw | ~350 | ✅ Active |
| `src/components/DiscoveryTools/ToolReviewPanel.tsx` | Panel review z gaps i akcjami | ~300 | ✅ Active |
| `src/components/Discovery/DiscoveryToolsHub.tsx` | Hub z zakladkami i kategoriami | ~500 | ✅ Active |
| `src/components/DiscoveryTools/InlineAssist.tsx` | AI micro-suggestions | ~150 | ✅ Active |
| `src/store/useToolStore.ts` | Zustand store (session, steps, data) | ~1400 | ✅ Active |
| ~~`src/components/DiscoveryTools/ToolWorkspace.tsx`~~ | ~~Legacy workspace~~ | ~800 | ⚠️ Deprecated |
| ~~`src/components/DiscoveryTools/ToolContextPanel.tsx`~~ | ~~Context panel~~ | ~250 | ⚠️ Deprecated |
| ~~`src/components/DiscoveryTools/ToolHeader.tsx`~~ | ~~Header~~ | ~150 | ⚠️ Deprecated |
| ~~`src/components/DiscoveryTools/ToolActionBar.tsx`~~ | ~~Action bar~~ | ~100 | ⚠️ Deprecated |

### Testy
| Plik | Opis | Testy |
|------|------|-------|
| `tests/unit/backend/tool.validators.test.ts` | Validators | 15 |
| `tests/unit/backend/tools.routes.test.ts` | Routes | 13 |
| `tests/e2e/tools-to-initiatives.spec.ts` | E2E flow | 12 |

### Migracje
| Plik | Opis |
|------|------|
| `server/src/migrations/291_tools_initiatives.sql` | Tabele tool_sessions, batches, links |
| `server/src/migrations/292_tools_decisions_link.sql` | Tabela tool_decisions |
