# Consultinity — V3 Implementation Program (SSOT / Backlog Ledger)

Owner: CTO/PO (Piotr + AI)  
Status: living document (v3 go‑live program)  
Last update: 2026-02-25  

> **Cel tego pliku:** mieć **jedno, precyzyjne źródło prawdy** dla wdrożenia całego V3: założenia, epiki, taski, DoD, acceptance, zależności, ryzyka i plan release.  
> Ten dokument jest **programem wdrożeniowym**, a nie opisem produktu (produkt = `REQUIREMENTS_V3_SSOT.md` + modułowe SSOTy).

---

## 0) Referencje (SSOT)

- V3 Requirements index: `docs/product/REQUIREMENTS_V3_SSOT.md`
- Operating model: `docs/product/OPERATING_MODEL_V3.md`
- Tools catalog: `docs/product/TOOLS_CATALOG_V3.md`
- Consulting Tools (module SSOT): `docs/product/CONSULTING_TOOLS_V3.md`
- Consulting Tools (tool-by-tool specs): `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- Known Tools content audit (v3): `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`
- Source traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- Reports & Presentations (hub UX): `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- Report Generator: `docs/product/REPORT_GENERATOR_V3.md`
- Presentation Generator: `docs/product/PRESENTATION_GENERATOR_V3.md`
- Interview Form Engine: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- Financial Analysis: `docs/product/FINANCIAL_ANALYSIS_V3.md`
- Finance export (wizard + traceability): `docs/product/FINANCE_EXPORT_V3.md`
- Results (KPI/ROI): `docs/product/RESULTS_V3.md`
- ROI tracking contract: `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- Execution module: `docs/product/EXECUTION_V3.md`
- Demo → Trial funnel: `docs/product/DEMO_TRIAL_V3.md`
- Model registry: `docs/product/MODEL_REGISTRY_V3.md`
- AI model purposes & requirements: `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- AI provider APIs (keys checklist): `docs/product/modules/ai/AI_API_KEYS_CHECKLIST_V3.md`
- AI provider & residency policy: `docs/product/modules/ai/AI_PROVIDER_RESIDENCY_POLICY_V3.md`
- AI pricing & cost controls: `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md`
- AI market update standard: `docs/product/modules/ai/AI_MARKET_UPDATE_STANDARD_V3.md`
- AI agent orchestration: `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- Video enablement: `docs/product/VIDEO_ENABLEMENT_V3.md`

UI/UX (canonical):
- Index: `docs/ui-standards/README.md`
- UI/UX canon v3: `docs/ui-standards/UI_UX_CANON_V3.md`
- Module hub: `docs/ui-standards/03-modules/module-hub-standard.md`
- View modes: `docs/ui-standards/03-modules/view-modes-standard.md`
- App table: `docs/ui-standards/03-modules/app-table-standard.md`
- Table + preview pane: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- Presentation modes D/N/C: `docs/ui-standards/01-shell-layout/presentation-modes.md`

---

## 1) Kontrakt programu (v3)

### 1.1 North star

V3 ma być “ultimate MVP” gotowe na pierwszego klienta: spójne UI/UX, kompletne flow, stabilne artefakty i **traceability** (źródła outputów).

### 1.2 Nienegocjowalne (MUST)

- **SSOT-first**: jeśli coś jest w backlogu — ma referencję do SSOT lub równolegle dopisujemy SSOT.
- **UI/UX compliance**:
  - ModuleHub standard (topbar + dynamic tabs + view toggle)
  - view modes standard (table/grid/kanban/timeline/calendar/matrix)
  - app table standard + preview pane standard
  - D/N/C presentation modes w detail view
  - **i18n PL+EN** i **locked/read-only** wszędzie, gdzie dotyczy artefaktów
- **Traceability non‑negotiable**: każdy output (initiative/report/deck) ma `source_type + source_id` wskazujące kanoniczne źródło.
- **Dynamic menu wszędzie**: kolekcja → otwarcie w dynamic tabs (`openDocuments`) → detail/wizard/workspace. Brak “osieroconych” ekranów.
- **AI contract**: AI zawsze w trybie *propose → accept/reject*, nie nadpisuje pracy usera.

### 1.3 Out of scope v3 (explicit)

- MCP IRIS + MCP Marketplace = **V4** (w menu: **Coming soon**).
- Zaawansowane timeline dependencies / critical path w portfolio = v4+ (w v3 dopuszczamy “timeline minimal”).
- Real-time collaboration = nie w v3.

---

## 2) Dashboard programu (postęp + kontrola)

> Ten rozdział jest “pulpitem dowodzenia” programu — tu widać postęp, blokery i gotowość do go‑live.
> Aktualizujemy codziennie (5 min) i robimy weekly review (30 min).

### 2.1 Statusy (kontrakty)

**Status specyfikacji (per task):**
- `draft` → mamy zarys + założenia
- `review` → brak dużych niewiadomych, gotowe do przeglądu
- `locked` → scope + DoD zamknięte (implementacja bez domysłów)
- `implemented` → dowiezione + minimalne QA

**Status implementacji (per task):**
- `todo`
- `in_progress`
- `blocked`
- `done`

**Status QA (per task):**
- `not_tested` → brak smoke (nie wolno oznaczać “implemented” bez smoke)
- `smoke_passed` → podstawowy scenariusz przeszedł (manual, 5–15 min)
- `qa_passed` → szerszy smoke + regresja modułu (R0/R1 gate, jeśli dotyczy)

**Target release (per task):**
- `R0` — Go‑live MVP (must)
- `R1` — Full v3 hardening
- `R2` — Polish + content completeness

### 2.1.1 Wymagane pola w “task ledger” (MUST)

Każdy task w tym programie musi mieć (w opisie specyfikacji):

- **SSOT** (linki do dokumentów źródła prawdy)
- **DoD** + **Acceptance / test plan**
- **Owner** (jedna osoba odpowiedzialna)
- **PR/commit link** (po wdrożeniu) w `Progress log`

Reguła: “done” bez smoke = nie istnieje (QA status min `smoke_passed`).

### 2.2 Program-level gates (merge / go‑live)

**Gate R0 (Go‑live):**
- traceability działa end‑to‑end (Tools/Assessments/MyWork → outputs)
- generatory: min. 1 ścieżka report + 1 ścieżka deck
- Initiatives: template-driven (mała vs duża) + minimum governance
- Results: KPI/ROI tracking jako dowód “dowozimy po wdrożeniu”
- brak “orphan views” (dynamic menu)

### 2.3 Postęp (do uzupełnienia podczas realizacji)

> Wypełniamy ręcznie. Docelowo można to zautomatyzować w v4 (integracja z issue trackerem).

| Workstream | R0 scope | Spec (locked/total) | Impl (done/total) | QA (smoke/total) | Blockers | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| WS-A Platform | ✅ | 0/8 | **8/8** | **8/8** (A05 done, rest smoke_passed) | — | Piotr |
| WS-B Chat | ✅ | 0/2 | **2/2** | **2/2** smoke_passed | — | Piotr |
| WS-C MyWork | ✅ | 0/6 | **6/6** | **6/6** smoke_passed | — | Piotr |
| WS-D Interview | ◻︎ | 0/3 | **3/3** | **3/3** (D01,D02 done, D03 smoke) | — | Piotr |
| WS-E Tools | ✅ | 0/7 | **7/7** | **7/7** (E04,E06,E07 done, rest smoke) | — | Piotr |
| WS-F Initiatives | ✅ | 0/2 | **2/2** | **2/2** smoke_passed | — | Piotr |
| WS-G Execution | ◻︎ | 0/1 | **1/1** | **1/1** done | — | Piotr |
| WS-H Results | ✅ | 0/3 | **3/3** | **3/3** smoke_passed | — | Piotr |
| WS-I Finance export | ◻︎ | 0/1 | **1/1** | **1/1** smoke_passed | — | Piotr |
| WS-J Reports+Presentations | ✅ | 0/3 | **3/3** | **3/3** (J03 done, rest smoke) | — | Piotr |
| WS-K N‑mode management | ◻︎ | 0/1 | **1/1** | **1/1** smoke_passed | — | Piotr |
| WS-L V4 placeholders | ◻︎ | 0/1 | **1/1** | **1/1** done | — | Piotr |

### 2.4 Weekly review (rytuał)

- **Scope sanity**: czy R0 nadal jest minimalne i spójne?
- **Top 3 blokery**: co blokuje R0?
- **Risk register**: czy ryzyka się materializują?
- **UX audit**: czy trzymamy `docs/ui-standards/`?

---

### 2.7 Current blockers (aktualny rejestr)

> Wypełniamy na bieżąco. “Blocker” = rzecz, która blokuje zamknięcie R0 (go‑live).

| Date | Blocker | Blocks tasks | Owner | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

### 2.8 Progress log (dziennik realizacji)

> Krótki log “co dowieźliśmy” + link do PR/commit lub notatki. 1 wpis dziennie.

| Date | Done | Notes / link |
| --- | --- | --- |
| 2026-02-26 | V3-A01, V3-A02, V3-A04, V3-B01, V3-B02, V3-C02, V3-C03, V3-A06 | Agent A (BE): routing/menu coherence + MyWork traceability + chat action model + Model Registry BE. Scope smoke B/C/D passed locally. |
| 2026-02-26 | V3-A06 (hardening) | Agent A (BE): final hardening for audit/fallback evidence. Added compatibility audit endpoint (`GET /api/llm/audit-log`), audit writes for legacy config mutations in `llm.routes.ts`, fallback usage audit entries in `modelRegistryService.resolveModel`, and UI typing/filter support for `fallback_used`. `npm run type-check` + `npx tsx server/scripts/smoke-a06-model-registry.ts` passed. |
| 2026-02-26 | V3-B02 (QA smoke) | Agent A (BE): contract smoke for unified chat action model passed (`npx tsx server/scripts/smoke-b02-chat-actions.ts`). Verified central registry + payload validation + capability checks + unified handler + NAVIGATE normalization + action UI analytics/error state. |
| 2026-02-26 | WS-C evidence hardening (V3-C01..V3-C06) | Agent A (audit pass): added dedicated contract smoke `server/scripts/smoke-c-ws.ts` covering Inbox preview+keyboard, Convert traceability + `sourceSessionId`, Focus cockpit lanes+DnD, Decisions timeline (no queue), Ideas shared graph model. `npx tsx server/scripts/smoke-c-ws.ts` passed. |
| 2026-02-26 | V3-E01, V3-E03, V3-A03, V3-C01, V3-A08, V3-J02, V3-E02, V3-C04, V3-C05, V3-C06, V3-D03, V3-E05, V3-A07, V3-D01-ui, V3-D02-ui | Agent 2 (FE/UX): Tools unified model + wizard shell, UI compliance sweep, preview pane rollout (3 hubs), MyWork (Focus/Decisions/Ideas), InterviewHub compliance, Process Automation, MicroVideoPrompt, PresentationsHub. |
| 2026-02-26 | V3-H01, V3-H02, V3-H03, V3-A02, V3-K01, V3-B01, V3-B02, V3-F01, V3-A01, V3-C03, V3-A04, V3-J01, V3-C02, V3-F02, V3-I01, V3-A06 | Agent 2 (FE/UX): Results full module (KPI+ROI+analysis), Dynamic menu system, NMode completeness, Chat router+actions, Initiative templates+portfolio analysis, Traceability+MyWork materialization, Route coherence+Reports unification, Finance export, Model Registry FE. `tsc --noEmit` clean (0 errors). **ALL 38 IMPL TASKS DONE.** |
| 2026-02-26 | V3-A05, V3-D01, V3-D02, V3-E04, V3-E06, V3-E07, V3-G01, V3-J03, V3-L01 | Agent 3 (BE/contract): demo dataset contract + demo/trial telemetry, Interview D01/D02 gates + runtime telemetry, Upload Bundle + Execution telemetry, tools content/methodology audit contract, MCP coming-soon routing. Smoke pack passed: `smoke:demo:script-a`, `smoke:interview:d01d02`, `smoke:j03g01`, `smoke:e04e06e07l01`, `smoke:agent3`. |
| 2026-02-26 | V3-A05 (QA hardening) | Agent 3 (BE/contract): added regression unit test for `setUserDemoPreference` update-first/insert-fallback path (Postgres-safe) in `tests/unit/backend/middleware/demoGuard.preferences.test.ts`; `npx vitest run tests/unit/backend/middleware/demoGuard.preferences.test.ts` passed. |
| — | — | — |

---

### 2.5 R0 Cutline (Go‑live MVP) — lista kontrolna

> R0 = minimalny zestaw, który musi być “dowieziony i spójny” na demo/go‑live.
> Jeśli coś nowego wchodzi do R0 — musi mieć usunięty inny element (R0 budget).

**R0 tasks (must):**
- V3-A01, V3-A02, V3-A04, V3-A05
- V3-B01
- V3-C02, V3-C03
- V3-E01, V3-E03
- V3-F01
- V3-H01, V3-H02
- V3-J01

**R0 demo acceptance (skrót):**
- da się przejść z Chat do konkretnego artefaktu w dynamic menu (min: initiative + report builder)
- idea/notatka z MyWork nie tworzy inicjatywy “znikąd” (materializacja MYWORK ToolSession)
- Tools/Assessments generują inicjatywy z prawidłowym źródłem
- Results pokazuje KPI/ROI tracking jako “dowozimy po wdrożeniu”
- Reports: 1 kanoniczny generator + share/export działa w praktyce

### 2.5.1 R0 Demo Script (10–15 min) — kanoniczny scenariusz smoke

> Ten skrypt to “prawda operacyjna” R0. Po każdym większym PR robimy go w 5–15 min.  
> Jeśli coś nie przechodzi — **task wraca na `blocked`** (albo powstaje nowy task naprawczy).

**A) Wejście / dostęp**
- Start w aplikacji (niezalogowany) → wejście do systemu (login).
- (Opcjonalnie) `Demo` → wybór języka → start demo (Atelier ToolToys) — jeśli R0 obejmuje V3-A05.

**B) Chat jako router**
- W czacie: “Chcę zrobić diagnozę / wybrać narzędzie” → przejście do `Tools` (Library) z kontekstem.
- W czacie: “Chcę wygenerować raport” → start `Reports > Builder` (wizard) z kontekstem.

**C) Tools → ToolSession → Outputs (traceability)**
- Tools (Library) → uruchom 1 narzędzie (sesja) → przejście przez wizard → `Finalize` → `Create Initiative` (lub draft initiatives).
- W inicjatywie: widoczny `source_type + source_id` + działa `Open source`.

**D) MyWork → Convert to… (traceability)**
- MyWork → utwórz Idea/Notebook → `Convert to Initiative` (lub Report/Deck).
- System materializuje `ToolSession(type=MYWORK)` i podpina output (widać “Open source”).

**E) Initiatives (template-driven)**
- Otwórz inicjatywę z narzędzia → widać template/sekcje zgodne z `InitiativeLevel` + minimalny “completeness” feedback.

**F) Results (KPI + ROI tracking)**
- Results → KPI list → otwórz KPI → dodaj manualny wpis time-series.
- ROI → porównanie plan vs realized (w minimalnym zakresie).

**G) Report/Deck generator (min. 1 ścieżka)**
- Reports > Builder → utwórz report z kontekstu (tool session / initiative) → zapisz.
- “Open source” działa i wraca do snapshotu/źródła.

**H) UX sanity (kanon v3)**
- ModuleHub: 1 Command Row, brak ad-hoc pasków.
- App Table: filtry w headerach, resizer subtelny, kebab (⋮) jako Actions.
- Preview pane (tam gdzie wdrożone): default OFF, selection→preview, Enter→open full, parity akcji.

### 2.5.2 Suggested execution order (R0) — żeby nie blokować się wzajemnie

> Ta kolejność minimalizuje “rework”. Jeśli zmieniasz scope R0, aktualizuj też tę sekcję.

1) **Platform foundations**: `V3-A02` (dynamic menu), `V3-A01` (traceability guards)  
2) **Chat routing**: `V3-B01` (NAVIGATE contract)  
3) **MyWork bridge**: `V3-C03` (MYWORK ToolSession), `V3-C02` (Convert to…)  
4) **Tools mental model**: `V3-E01`  
5) **Tool Wizard Standard**: `V3-E03` (shell + 1 referencyjne narzędzie)  
6) **Initiatives templates**: `V3-F01` (min gates/completeness)  
7) **Results tracking**: `V3-H01` + `V3-H02`  
8) **Reports (1 kanoniczny generator)**: `V3-J01`  
9) **Route/menu coherence**: `V3-A04` (w praktyce równolegle, ale blokuje “polish go‑live”)  
10) **Demo/Trial** (jeśli w R0): `V3-A05`

### 2.5.3 R0 Demo Dataset Contract (Atelier ToolToys) — żeby demo nigdy nie było “puste”

> Minimalny zestaw danych dla R0 demo/trial, żeby wszystkie ścieżki miały “o co zahaczyć”.

- **Org / project**: 1 organizacja demo + 1 aktywny projekt.
- **Tools**: min. 3 przykładowe ToolSessions (strategic/operations/digital), każda z 1 outputem.
- **Initiatives**: min. 8 inicjatyw (mix levels) z przypiętym `source_type/source_id`.
- **Results**: min. 6 KPI (w tym 2 przypięte do inicjatyw) + min. 1 ROI card z plan vs realized.
- **Reports/Decks**: min. 2 artefakty (1 report, 1 deck) z `Open source`.
- **i18n**: dataset dostępny w 6 językach (min. nazwy/tytuły + opisy preview).

### 2.5.4 Execution plan (R0) — praca 3 agentami (bez konfliktów)

> Cel: maksymalna równoległość bez rozjechania się po plikach/kontraktach.  
> Zasada: każdy agent pracuje na **tej samej gałęzi**, ale na **oddzielnych taskach** i robi małe PR-y (albo małe commit-y) zgodnie z `2.4 PR checklist`.

**Agent BE (Cursor, GPT-5.3) — foundations + traceability (R0 core):**
- Taski: `V3-A02`, `V3-A01`, `V3-B01`, `V3-C03`, `V3-C02`, `V3-F01`, `V3-H01`, `V3-H02`, `V3-J01`
- Własność: kontrakty API/DB/guards, `source_type/source_id`, `ToolSession(MYWORK)`, routing `NAVIGATE`, minimalne serwisy Results/ROI i generator raportu.
- “Definition of done”: przechodzi Demo Script B/C/D/F/G (w części BE).

**Agent FE/UX (Cursor, Opus 4.6) — wizard UI + compliance v3 (R0-facing):**
- Taski: `V3-E03`, oraz FE część `V3-A04` (copy/entry points/breadcrumbs) jeśli to głównie UI
- Własność: ModuleHub/AppTable/CommandRow/buttons, wizard shell (kroki, pętla missing→add→re-process), dynamic tabs behavior, minimalne UI pod Results/Reports w ścieżce demo.
- “Definition of done”: Demo Script C/G/H przechodzi na UI (bez “orphan views”).

**Agent Seed/Demo (Codex, GPT-5.3) — dataset + demo/trial:**
- Task: `V3-A05`
- Własność: seed danych Atelier ToolToys + i18n dataset + limity DEMO/TRIAL + telemetria + SuperAdmin view (minimal).
- “Definition of done”: Demo Script A + contract dataset (2.5.3) spełniony.

**Reguły koordynacji (MUST):**
- `A01/A02` są “foundation”: jeśli BE zmienia traceability/dynamic tabs contract — FE dostosowuje UI, nie dubluje logiki.
- `E03` (wizard) zależy od mental model Tools (`E01`) i traceability (`A01`) — FE buduje shell, BE dostarcza kontrakty zapisu/odczytu sesji.
- Każdy agent po swojej porcji robi smoke wg `2.5.1` i wpisuje do `2.8 Progress log` (data + PR link).

---

## 3) Jak pracujemy (task ledger — styl V2)

### 2.1 Stany specyfikacji taska
- `draft`: pierwsza wersja (z założeniami)
- `review`: gotowe do przeglądu (brak dużych niewiadomych)
- `locked`: scope i DoD zamknięte (implementuje zespół)
- `implemented`: wdrożone i zweryfikowane (smoke + minimal QA)

### 2.2 Priorytety (program)
- **P0**: konieczne na demo/go‑live MVP (blokery)
- **P1**: kluczowe dla “pełnego v3” (może wejść tuż po go‑live)
- **P2**: polish / rozszerzenia / porządki, które nie blokują

### 2.3 Template taska (kopiuj 1:1)

#### V3-XXX — [WORKSTREAM] Tytuł
- Status spec: draft
- Priorytet: P0/P1/P2
- Moduł: Chat / MyWork / Interview / Tools / Initiatives / Results / Finance / Reports / Platform
- SSOT: (lista linków)

**Business challenge (problem):**

**Cel (outcome, nie feature):**

**Użytkownicy i scenariusze:**

**Zakres (IN/OUT):**
- IN:
- OUT:

**UX / UI notes:**

**Data / integrations:**

**AI behavior (jeśli dotyczy):**

**Definition of Done (DoD):**

**Acceptance / test plan:**

**Dependencies:**

**Risks / go-live risk:**

**Analytics (events/metrics) (jeśli dotyczy):**

**Rollout plan:**

---

### 2.4 PR checklist v3 (MUST) — “quality gates” przed merge

> Krótka lista, która ma powstrzymać regresje v3. Jeśli nie spełnione — PR nie wchodzi.

- **SSOT link**: PR opisuje, które taski (`V3-…`) i które SSOTy realizuje.
- **Traceability**: jeśli PR tworzy outputy (initiative/report/deck) → `source_type + source_id` są egzekwowane.
- **Dynamic tabs**: wejścia z hubów otwierają detail/wizard w dynamic menu; brak orphan views.
- **UI standards** (jeśli dotyczy UI):
  - 1 Command Row (bez dodatkowych pasków)
  - App Table: filtry w headerach, resizer subtelny, kebab (⋮) w Actions
  - Preview pane: default OFF, selection→preview, Enter→open full, parity akcji
  - view-modes kolejność ikon: table→kanban→timeline→calendar→matrix→grid
  - przyciski wg 3‑poziomowego kanonu (pill/rounded)
- **i18n**: nowe etykiety mają PL+EN.
- **locked/read-only**: jeśli edycja artefaktów → respektuje `locked` (UI + API).
- **Telemetry (minimal)**: nowe krytyczne flow ma eventy zgodne ze specem taska.
- **Smoke**: autor PR przechodzi `2.5.1 R0 Demo Script` w zakresie dotkniętych ścieżek.

### 2.5 Verification Matrix (R0/R1) — kontrola pokrycia flow

> To jest “tablica prawdy” QA. Każdy wiersz to flow, które musi działać.

| Flow | R0/R1 | Task(s) | Test (manual) | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Chat → Tools (open + context) | R0 | `V3-B01`, `V3-A02` | Demo Script B | Piotr | smoke_passed (structural) |
| Tools → Wizard → Create Initiative (traceable) | R0 | `V3-E03`, `V3-A01`, `V3-F01` | Demo Script C | Piotr | smoke_passed (structural) |
| MyWork → Convert to Initiative (MYWORK ToolSession) | R0 | `V3-C03`, `V3-C02`, `V3-A01` | Demo Script D | Piotr | smoke_passed (structural) |
| Results → KPI tracking (manual TS) | R0 | `V3-H01` | Demo Script F | Piotr | smoke_passed (structural) |
| Results → ROI plan vs realized | R0 | `V3-H02` | Demo Script F | Piotr | smoke_passed (structural) |
| Reports → Builder → Save + Open source | R0 | `V3-J01`, `V3-A01` | Demo Script G | Piotr | smoke_passed (structural) |
| Demo → Trial funnel | R0 | `V3-A05` | Demo Script A | Piotr | done |

### 2.6 “Naming / enums freeze” (MUST) — żeby nie rozwalić integracji w trakcie kodowania

> Od startu implementacji R0 nie zmieniamy semantyki identyfikatorów bez taska migracyjnego.

- **Tool slugs (`toolType`)**: kanon w `CONSULTING_TOOLS_TOOL_SPECS_V3.md` (bez aliasów w danych sesji).
- **AI routing**: wybór modelu wyłącznie przez `purpose` (SSOT: `AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`).
- **Statusy artefaktów**: wszędzie te same enumy (Initiative/ROI/KPI/ToolSession) — jeśli zmieniamy, robimy migrację + back-compat.
- **Traceability fields**: `source_type`, `source_id` są obowiązkowe na outputach; nie zmieniamy nazw.

## 4) Workstreams / Epics (mapa programu)

W3: Program jest podzielony na workstreamy (epiki). Każdy ma taski z identyfikatorami `V3-<letter><number>`.

- **WS-A Platform (cross-cutting)**: traceability, dynamic menu, UI/UX compliance, shared standards.
- **WS-B Chat v3**: router pracy, mechaniczne transfery, spójny action model.
- **WS-C MyWork v3**: personal hub, Inbox, conversions, idea/notebook → toolsession.
- **WS-D Interview v3**: discovery workflow, sufficiency, insights → context export.
- **WS-E Tools v3**: library/sessions/outputs/initiatives + scalenie mental model.
- **WS-F Initiatives v3**: lifecycle, templates per level, portfolio analysis, gate readiness.
- **WS-G Execution v3**: realizacja, statusy, operacyjne zarządzanie (minimum).
- **WS-H Results (Rezultaty) v3**: KPI table, operational analysis, ROI analysis, tracking.
- **WS-I Finance v3**: model + analizy + powiązania do inicjatyw + eksport do report/deck.
- **WS-J Reports & Presentations v3**: biblioteki + generatory + upload mode + share/export.
- **WS-K N‑mode management**: required sections, completeness, AI assist w uzupełnianiu.
- **WS-L V4 placeholders**: MCP IRIS + Marketplace “Coming soon”.

---

## 5) Release plan (go‑live oriented)

### 4.1 Release R0 — “Go‑live MVP”
Cel: brak blokad logicznych i spójny UX na kluczowych ścieżkach:
- Chat → Tools/Interview/MyWork (router działa)
- Tools/Assessments → Initiative drafts → Initiatives lifecycle
- Results tracking (KPI/ROI) jako “proof” dowiezienia
- Reports: co najmniej 1 kanoniczny generator + share/export

### 4.2 Release R1 — “Full v3 hardening”
Cel: portfolio analysis, export z finansów, unified outputs, N‑mode completeness + AI assist.

### 4.3 Release R2 — “Polish + content completeness”
Cel: dopracowanie opisów narzędzi (known-tools), szablonów, micro‑video, help content.

---

## 6) Task index (tracking table)

> **To jest Twoja tabela “jak w V2”** — w jednym miejscu widać wszystkie taski, priorytet, status spec i status realizacji.
> Task specs poniżej zawierają pełne opisy (problem/cel/scope/DoD/AC/ryzyka/rollout).

| ID | Title | Priority | Target | Spec | Impl | QA | Owner | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V3-A01 | Traceability enforcement (MyWork → ToolSession → outputs) | P0 | R0 | review | done | smoke_passed | Piotr | V3-C03 |
| V3-A02 | Dynamic menu everywhere (hub → openDocuments → detail) | P0 | R0 | review | done | smoke_passed | Piotr | — |
| V3-A03 | UI standards compliance sweep (ModuleHub + tables + preview + D/N/C) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A02 |
| V3-A04 | Route + menu coherence (Tools/Reports/Presentations naming + entry points) | P0 | R0 | draft | done | smoke_passed | Piotr | V3-J01 |
| V3-A05 | Demo → Trial funnel (dataset + limits + telemetry) | P0 | R0 | draft | done | done | Piotr | V3-A03 |
| V3-A06 | SuperAdmin: Model Registry (kind/purpose/fallbacks) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A05 |
| V3-A07 | Preview pane contract rollout (key hubs) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A03 |
| V3-A08 | Video enablement system (micro‑prompts + rekomendacje) | P1 | R0/R1 | draft | done | smoke_passed | Piotr | V3-A03 |
| V3-B01 | Chat router pracy (mechaniczne transfery) | P0 | R0 | review | done | smoke_passed | Piotr | V3-A02 |
| V3-B02 | Ujednolicenie action model (brak martwych typów) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-B01 |
| V3-C01 | MyWork Inbox: preview pane contract (Outlook-style) | P1 | R1 | draft | done | smoke_passed | Piotr | — |
| V3-C02 | MyWork conversions: Convert to… zawsze traceable | P0 | R0 | review | done | smoke_passed | Piotr | V3-A01 |
| V3-C03 | MyWork ToolSession materialization (type=MYWORK) | P0 | R0 | draft | done | smoke_passed | Piotr | V3-A01 |
| V3-C04 | MyWork Focus redesign (lightweight execution cockpit) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A03 |
| V3-C05 | MyWork Decisions: timeline + remove queue view + preview parity actions | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A03 |
| V3-C06 | MyWork Ideas: canvas tools selector + shared core model (no data loss) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A03 |
| V3-D01 | Interview: sufficiency contract + send-back clarity | P1 | R1 | draft | done | done | Piotr | — |
| V3-D02 | Interview: runtime mode decision (one question vs task-list) | P1 | R1 | draft | done | done | Piotr | — |
| V3-D03 | InterviewHub: App Table Standard compliance (all tabs) + preview for Insights | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A03 |
| V3-E01 | Tools: jeden mental model (Library→Sessions→Outputs→Initiatives) | P0 | R0 | review | done | smoke_passed | Piotr | — |
| V3-E02 | Tools hub outputs: Reports+Presentations+Initiatives as artifacts | P1 | R1 | draft | done | smoke_passed | Piotr | V3-E01 |
| V3-E03 | Tools: Tool Wizard Standard (non-licensed tools runtime) | P0 | R0 | draft | done | smoke_passed | Piotr | V3-E01 |
| V3-E04 | Tools: One task per consulting tool (spec+assets+help) | P1 | R2 | draft | done | done | Piotr | V3-E03 |
| V3-E05 | Tools: Process Automation tool (hybrid workspace+table wizard) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-E03 |
| V3-E06 | Tools: Licensed methodologies parity (SIRI/ADMA) | P1 | R1 | draft | done | done | Piotr | V3-E01 |
| V3-E07 | Tools Quality: Known Tools content completeness audit + fill plan | P1 | R2 | draft | done | done | Piotr | V3-E04 |
| V3-F01 | Initiatives: template-driven N-mode per InitiativeLevel | P0 | R0 | review | done | smoke_passed | Piotr | V3-K01 |
| V3-F02 | Initiatives: Portfolio Analysis (Resources/Feasibility/Logic/Timeline/Completeness) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-F01 |
| V3-G01 | Execution: minimal surfaces + spójne statusy | P2 | R2 | draft | done | done | Piotr | V3-F01 |
| V3-H01 | Results: KPI table core (agregacja+add+tracking) | P0 | R0 | review | done | smoke_passed | Piotr | — |
| V3-H02 | Results: ROI plan vs realized (tracking po wdrożeniu) | P0 | R0 | review | done | smoke_passed | Piotr | V3-H01 |
| V3-H03 | Results: Operational analysis + ROI analysis views | P1 | R1 | draft | done | smoke_passed | Piotr | V3-H01 |
| V3-I01 | Finance: Exportuj → Report/Presentation (traceable) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-J01 |
| V3-J01 | Reports: ujednolicenie report surfaces (user rozumie co jest czym) | P0 | R0 | review | done | smoke_passed | Piotr | V3-A04 |
| V3-J02 | Presentations: biblioteka decków (hub table+cards) | P1 | R1 | draft | done | smoke_passed | Piotr | V3-A02 |
| V3-J03 | Generators: upload chaos jako 3 ścieżka report/deck | P2 | R2 | draft | done | done | Piotr | V3-J01 |
| V3-K01 | N-mode: required sections/pola + completeness + AI assist | P1 | R1 | draft | done | smoke_passed | Piotr | — |
| V3-L01 | V4: MCP IRIS + Marketplace w menu (Coming soon) | P2 | R2 | draft | done | done | Piotr | — |

---

## 7) Task specs (pełne opisy jak V2)

> Uwaga: poniższe taski są **implementacyjne**. Jeśli coś jest “już w kodzie”, task dotyczy “domknięcia v3” (spójność, brakujące połączenia, UX kontrakty).

---

### WS-A — Platform / Cross‑cutting

#### V3-A01 — [Platform] Traceability enforcement (MyWork → ToolSession → outputs)
- Status spec: review
- Priorytet: P0
- Target: R0
- Moduł: Platform / MyWork / Tools / Initiatives / Reports / Presentations
- SSOT: `SOURCE_TRACEABILITY_SPEC.md`, `OPERATING_MODEL_V3.md`, `SYSTEM_ARCHITECTURE_BRIEF.md`

**Business challenge (problem):**  
Bez twardej traceability system nie jest “consulting OS”, tylko luźnym notatnikiem. Inicjatywy/raporty/decki bez źródła psują governance, audyt i zaufanie zarządu.

**Cel (outcome, nie feature):**  
Każdy output (Initiative/Report/Deck) ma jednoznaczne, kanoniczne źródło i da się go zreprodukować / uzasadnić.

**Użytkownicy i scenariusze:**  
- Konsultant generuje inicjatywy z Tools/Assessment i chce mieć “source” w inicjatywie.  
- User tworzy coś w MyWork (Idea/Notebook), a potem “konwertuje do inicjatywy/raportu/decku” — system materializuje MyWork ToolSession.  
- Zarząd ogląda raport — widzi “z czego powstał” (ToolSession/AssessmentReport/FinancialAnalysis run).

**Zakres (IN/OUT):**
- IN:
  - zablokowanie bypassu “MyWork → initiative/report/deck bez ToolSession”
  - materializacja `ToolSession(type=MYWORK)` jako “kanoniczne źródło” dla outputów z MyWork
  - metadane traceability widoczne w UI (detail view + exports)
- OUT:
  - pełny “link graph UI” dla wszystkich obiektów (to osobny strumień, v3 minimal)

**UX / UI notes:**  
- W detail view: “Source” jest widoczne jako stały blok meta (properties strip) + link “Open source”.
- W generatorach: “Sources” są widoczne w setup (wizard) oraz w final artefakcie.

**Data / integrations:**  
- Każdy output dostaje: `source_type`, `source_id` + opcjonalnie `source_snapshot` (dla eksportów).

**AI behavior (jeśli dotyczy):**  
- AI nie może tworzyć outputu bez źródła; jeśli brak — proponuje utworzenie MyWork ToolSession (propose→accept).

**Definition of Done (DoD):**
- Nie da się utworzyć inicjatywy z MyWork bez utworzenia `ToolSession(MYWORK)` (albo walidacja, albo auto-materializacja).
- Wszystkie outputy mają `source_type + source_id` i UI je pokazuje.
- API ma guardrails (brak “NULL source”).

**Acceptance / test plan:**
- MyWork Idea → Convert to Initiative: inicjatywa ma `source_type=tool` i `source_id=<toolSessionId>` (MYWORK).
- ToolSession → Generate initiatives: inicjatywy mają `source_type=tool` i `source_id=<toolSessionId>`.
- Report Builder: report ma wskazane źródło (w metadanych reportu).

**Dependencies:** V3-C03, V3-A04  
**Risks / go-live risk:** P0 governance break jeśli zostawimy bypassy.  
**Analytics (events/metrics):**
- `artifact_created` (type, source_type, has_source=true)
- `artifact_convert_clicked` (from=idea|notebook, to=initiative|report|deck)
- `artifact_source_opened` (type, source_type)
**Rollout plan:** najpierw guardrails + UI “Source”, dopiero potem deep link/backlinks polish.

#### V3-A02 — [Platform] Dynamic menu everywhere (hub → openDocuments → detail)
- Status spec: review
- Priorytet: P0
- Target: R0
- Moduł: Platform (routing + surfaces)
- SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

**Business challenge (problem):**  
Bez spójnego “dynamic menu” użytkownik gubi kontekst (skąd przyszedł), nie może pracować równolegle na 2–3 artefaktach i ma wrażenie “innych aplikacji” w jednej.

**Cel (outcome, nie feature):**  
Wszystkie kluczowe moduły pracują w jednym UX pattern: kolekcja → dynamic tabs → detail/wizard/workspace.

**Użytkownicy i scenariusze:**
- User w Tools otwiera 2 sesje + 1 inicjatywę równolegle (tabs).
- User w Reports generuje draft, zostawia w tle i wraca do Tools (bez utraty kontekstu).
- User otwiera dokument z preview pane (Enter/double-click) i wraca do kolekcji bez “resetu”.

**Zakres (IN/OUT):**
- IN:
  - moduły kolekcyjne: Tools, Initiatives, Reports (builder), Presentations (library + wizard), Results
  - standard: kolekcja → openDocument → dynamic tabs → detail
- OUT:
  - pełna przebudowa całego routera na raz (migracja jest stopniowa)

**UX / UI notes:**
- Dynamic menu ma limit widocznych tabów + overflow (zgodnie ze standardem hub).
- Tab ma “dirty indicator” jeśli jest draft/unsaved.
- Powrót do kolekcji zachowuje filtry i fokus (nie resetuje).

**Data / integrations:**
- Minimalny kontrakt: `openDocuments[]` (id, type, title, routeKey, dirty, lastVisitedAt).
- Deep link do artefaktu działa również bez wcześniejszego otwarcia kolekcji (auto‑materializacja taba).

**AI behavior:** —

**Definition of Done (DoD):**
- Nie istnieją “orphan views” które otwierają artefakty poza dynamic tabs (dla modułów w zakresie).
- Z listy można otworzyć N dokumentów (max widocznych + overflow).
- Detail view działa bez resetowania kontekstu czatu i bez resetu filtrów kolekcji po powrocie.

**Acceptance / test plan:**
- Tools: otwórz 3 dokumenty → zamknij 1 → kolejność/stan tabów jest spójny.
- Reports: otwórz draft report w osobnym tabie → przejdź do Tools → wróć → draft nadal otwarty.
- Deep link: wejście na URL dokumentu otwiera go w tabie (bez błędu “orphan view”).

**Dependencies:** V3-A04 (routing/menu), V3-J01 (entry points w reports), V3-J02 (presentations hub)  
**Risks / go-live risk:** P0 — regresja nawigacji psuje całą aplikację.  
**Analytics (events/metrics):**
- `dynamic_tab_opened` / `dynamic_tab_closed` (type)
- `dynamic_tab_overflow_opened`
- `dynamic_orphan_view_blocked` (route)
**Rollout plan:** moduł po module (tools → initiatives → reports → presentations → results) z smoke testem po każdym kroku.

#### V3-A03 — [Platform] UI standards compliance sweep (ModuleHub + tables + preview + D/N/C)
- Status spec: draft
- Priorytet: P1
- Target: R1
- Moduł: Platform + wszystkie moduły z kolekcjami i detail views
- SSOT: `docs/ui-standards/**`

**Business challenge (problem):**  
“ładne” moduły obok “starych” ekranów rozbijają zaufanie i niszczą perceived quality. V3 ma wyglądać jak jeden system.

**Cel (outcome, nie feature):**  
Spójne standardy UI/UX w krytycznych hubach i detail views — użytkownik nie “czuje przeskoków”.

**Użytkownicy i scenariusze:**  
- user przeskakuje Tools → Initiatives → Reports → Results i nie widzi innej aplikacji
- user używa preview pane (Outlook style) i ma to samo zachowanie w modułach

**Zakres (IN/OUT):**
- IN:
  - module hub: topbar, dynamic tabs, view modes, filtry
  - table standard + preview pane standard
  - D/N/C w artefaktach objętych standardem
  - i18n + locked dla artefaktów
  - globalny “pill/rounded” system przycisków (w tym main module tabs)
  - Card Standard v3 (wymiana “dziwnych” Cards view, m.in. Inbox)
  - Executive dashboards: Density toggle (Compact/Comfortable) jako MUST
- OUT:
  - “beauty refactor” wszystkich ekranów legacy jednocześnie (robimy modułami)

**UX / UI notes:**  
- źródłem prawdy są `docs/ui-standards/**` (szczególnie: module hub, app table, preview pane, D/N/C).

**Data / integrations:** —

**AI behavior:** —

**Definition of Done (DoD):**
- topbar bez duplikacji breadcrumbs/tytułów, kontrolki `h-9`, spójne CTA i view toggle
- tabelaryczne moduły spełniają `App Table Standard`
- preview pane używa `PreviewPaneShell` i ma anatomię (header/body/footer)
- AI context button jest **ikona-only** i “wpada w oczy” (mocniejszy kontrast/akcent), bez konkurowania z Primary CTA
- view-modes mają stałą kolejność ikon (table→kanban→timeline→calendar→matrix→grid)
- detail views: spójny header + tryby D/N/C tam gdzie to kanon

**Acceptance / test plan:**
- manual smoke: Tools/Initiatives/Reports/Results (table + grid) w dark/light mode
- preview pane: wybór wiersza ≠ nawigacja do detail; Enter/double-click = open full

### Compliance sweep checklist (R1) — mapa ekranów → standard → task

> To jest lista kontrolna do “UI standards sweep”. Każdy wpis kończy się: “OK / Not OK” i jeśli Not OK — linkujemy do taska naprawczego lub tworzymy sub‑task w `V3-A03`.

| Surface (module > tab) | Must-have (SSOT) | Najczęstsze naruszenia z feedbacku | Naprawiamy w |
| --- | --- | --- | --- |
| **My Work > Inbox (table)** | App Table + Preview Pane + 1 Command Row | dodatkowe rzędy nad tabelą, brak preview contract/keyboard | `V3-C01` + `V3-A03` |
| **My Work > Inbox (cards)** | Card Standard v3 | “dziwny” cards view, brak kebaba, brak spójnych sygnałów | `V3-A03` (Card Standard rollout) |
| **My Work > Tasks (table/kanban/timeline)** | View-modes order + App Table + Timeline MUST + Preview contract | duplikacja mini-toolbarów, złe resizery, brak multi-select priorytetów | `V3-A03` (+ standardy już w SSOT) |
| **My Work > Decisions (table/kanban/timeline)** | View-modes order + Timeline + Preview parity akcji | “queue view”, brak timeline, preview zawsze otwarty, brak parity (Approve/Reject/Delegate/Request info) | `V3-C05` + `V3-A03` |
| **My Work > Executive** | Dashboard density + framing + Density toggle MUST | mikro-typografia + duże puste przestrzenie + słabe granice sekcji | `V3-A03` (Executive hardening) |
| **My Work > Pomysły (canvas tool selector)** | Selector narzędzia canvasa + shared core model (no data loss) | narzędzia jako osobne światy, ryzyko utraty treści przy przełączeniu | `V3-C06` |
| **Interviews > Inbox/Sessions/Assigned/Templates/Insights** | App Table Standard + Module Topbar order + 1 Command Row + kebab (⋮) | brak filtrów/resizerów/kebaba, ad-hoc help stripy, chaos w topbar | `V3-D03` |
| **Tools hub (Library/Sessions/Outputs)** | ModuleHub + App Table + Cards standard + Dynamic tabs | niespójne taby/entry points, karty/tabele różne między kategoriami | `V3-E01` + `V3-A03` |
| **Initiatives hub (table/kanban/timeline)** | ModuleHub + App Table + Timeline + Preview | niespójne view-modes i filtry, brak preview lub “border-l widget” | `V3-A03` (+ zależne od `V3-F01`) |
| **Results hub (KPI/Reports/ROI)** | ModuleHub + App Table + Preview Pane | duplikacje kontrolek, brak jednego command row | `V3-H01` + `V3-A03` |
| **Reports hub / Presentations hub** | ModuleHub + App Table + Cards standard + Dynamic tabs | “dwa światy” generator vs biblioteka, niespójny cards view | `V3-J01` + `V3-J02` + `V3-A03` |

**Globalne MUST-y do odhaczenia w ramach sweep:**

- Main module tabs w hubach są **pill (rounded-full)** i używają 3‑poziomowego systemu buttonów (SSOT: `visual-language.md` 8.3).
- “AI w kontekście” w Module Topbar jest **ikona-only** i jest widoczny, ale nie konkuruje z Primary CTA (SSOT: `UI_UX_CANON_V3.md`).
- View-modes mają stałą kolejność ikon: `table → kanban → timeline → calendar → matrix → grid`.
- Kebab (⋮) jest jedynym wejściem do menu akcji w tabelach i kartach (Actions column / card actions).
- Zero ad-hoc pasków/boksów między topbarem a tabelą — tylko 1 Command Row (Dynamic tabs / Search / Context counters).

**Dependencies:** V3-A02  
**Risks / go-live risk:** jeśli odkładamy — “perceived quality” siada i klient widzi “V2 + doczepki”.  
**Analytics (events/metrics):**
- `ui_standard_violation_seen` (manual QA checklist marker)
- `preview_pane_used` (module)
**Rollout plan:** robić po 1 module na sprint (najpierw R0 path), reszta w R1.

#### V3-A04 — [Platform] Route + menu coherence (Tools/Reports/Presentations naming + entry points)
- Status spec: draft
- Priorytet: P0
- Target: R0
- SSOT: `OPERATING_MODEL_V3.md`, `PRESENTATIONS_AND_REPORTS_V3.md`

**Business challenge (problem):**  
User widzi kilka “raportów” i nie rozumie różnic; `/tools` jest public showcase; osobno discovery tools vs licensed → chaos mentalny.

**Cel (outcome):**  
Jedna, zrozumiała nawigacja i nazewnictwo: user wie gdzie robi report/deck i gdzie je potem znajduje.

**Zakres (IN/OUT):**
- IN:
  - porządek menu, breadcrumbs i entry points dla: Tools / Licensed / Reports / Presentations
  - spójne nazwy w UI i routach (bez “aliasów” mylących usera)
- OUT:
  - przebudowa publicznego `/tools` (może pozostać osobno jako showcase)

**Użytkownicy i scenariusze:**
- User klika `Tools` w sidebar i trafia do realnego modułu pracy (nie showcase).
- User klika `Reports` i rozumie różnicę `Builder` vs `Management`.
- User z Tools tworzy report/deck i widzi spójne entry points + breadcrumbs.

**UX / UI notes:**  
- w breadcrumbs zawsze “Module > Surface” (np. `Reports > Builder`, `Reports > Management`).
- generator i biblioteka muszą być rozróżnione w nawigacji.

**Data / integrations:** —

**AI behavior:** —

**Definition of Done (DoD):**
- menu i breadcrumbs mówią prawdę: gdzie jest “generator”, gdzie “biblioteka”
- brak sytuacji, że user trafia do publicznego showcase myśląc, że to panel pracy
- startowe CTA w modułach prowadzą do kanonicznego flow (wizard)

**Acceptance / test plan:**
- smoke: klik w sidebar: Tools / Licensed Tools / Reports → trafiamy w spójne miejsca
- z narzędzia: “Create report” prowadzi do Report Builder, nie do Management Reports

**Dependencies:** V3-J01  
**Risks / go-live risk:** P0 — klient nie ogarnie “gdzie co jest”.  
**Analytics (events/metrics):**
- `sidebar_navigation_clicked` (target)
- `route_redirected` (from, to)
**Rollout plan:** szybkie rename/redirects + copy w UI, bez dużych refactorów.

#### V3-A05 — [Platform] Demo → Trial funnel (dataset + limits + telemetry)
- Status spec: draft
- Priorytet: P0
- Target: R0
- Moduł: Platform (access, onboarding, SuperAdmin)
- SSOT: `docs/product/DEMO_TRIAL_V3.md`, `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`, `server/src/services/access/AccessTypes.ts`

**Business challenge (problem):**  
Demo bez spójnego datasetu i limitów jest "pustą skorupą"; trial bez jasnej konwersji i telemetrii nie pozwala mierzyć skuteczności. Brak danych o startach demo/trial i conversion rate blokuje decyzje produktowe.

**Cel (outcome, nie feature):**  
Szczelny funnel Demo → Trial: pełne dane demonstracyjne (Atelier ToolToys), egzekwowane limity (AI + write), prowadzona konwersja oraz telemetria widoczna w SuperAdmin.

**Użytkownicy i scenariusze:**
- User z landingu klika "Demo" → logowanie (jeśli brak) → wybór języka → start demo z pełnym datasetem.
- User w DEMO widzi banner "Tryb demo • Firma: Atelier ToolToys • [Start trial]" i licznik AI (np. "AI: 3/10 dziś").
- User przekracza limit AI w demo → komunikat "Przejdź na trial, aby korzystać z AI" + degraded mode (demo działa dalej bez czata).
- User klika "Start trial" → tworzy organizację → dostaje 7 dni + onboarding.
- SuperAdmin widzi listę uruchomień demo/trial (kto/kiedy/język/source) oraz conversion rate.

**Zakres (IN/OUT):**
- IN:
  - modal demo: login gate + wybór języka (6 języków) + "Start demo"
  - dataset Atelier ToolToys: 1–3 projekty, 8–15 inicjatyw, tasks/decisions, Results (KPI+ROI), Reports+Presentations z traceability
  - warstwa tłumaczeń datasetu (core dataset + `*_translations` lub seed per locale)
  - limity DEMO: `DEFAULT_DEMO_LIMITS` (AccessTypes) + egzekwowanie AI (quotaService)
  - Trial: 7 dni (config `TRIAL_DURATION_DAYS` + UI copy), ostrzeżenia T‑7/T‑3, lockdown po wygaśnięciu
  - konwersja: strategiczne CTA "Start trial" w demo (banery, czat)
  - telemetria: `demo_started`, `demo_mode_enabled/disabled`, `demo_ai_limit_reached`, `trial_started`, `trial_expiry_warning_shown`, `trial_converted_to_paid`
  - SuperAdmin: widok demo/trial starts + conversion stats
- OUT:
  - personalizacja rekomendacji demo (v4+)
  - pełny onboarding playbook z wideo (V3-A08)

**UX / UI notes:**
- Banner DEMO: "Tryb demo • Firma: Atelier ToolToys • [Start trial]" — subtelny, nie nachalny.
- Copy "demo" nie może kłamać (as‑is "No signup required" vs wymóg tokena — dopasować).
- Trial banner: ile dni zostało + CTA "Upgrade"; soft warning przed odcięciem akcji.
- i18n PL+EN dla wszystkich komunikatów demo/trial.

**Data / integrations:**
- `AccessTypes.ts`: `DEFAULT_DEMO_LIMITS`, `TRIAL_DURATION_DAYS` (7), `TRIAL_WARNING_DAYS`
- `trialService.ts`, `demo.routes.ts`, `demoGuard.middleware.js`
- `quotaService` / `rateLimiter` dla egzekwowania limitów AI
- seed dataset + translations per locale

**AI behavior (jeśli dotyczy):**  
- AI w demo ma limit interakcji; po przekroczeniu: komunikat CTA do trial + degraded mode (bez czata). Zachęca, nie blokuje zwiedzania.

**Definition of Done (DoD):**
- Modal demo: login + wybór języka + start → przełączenie na DEMO org z pełnym datasetem.
- Dataset Atelier ToolToys dostępny w 6 językach (UI + content locale).
- Limity DEMO egzekwowane (AI, write); po przekroczeniu AI — degraded mode + CTA.
- Trial = 7 dni; ostrzeżenia T‑7/T‑3; lockdown + CTA po wygaśnięciu.
- Wszystkie eventy telemetryczne wysyłane; SuperAdmin pokazuje listę starts + conversion.

**Acceptance / test plan:**
- Smoke: Landing → Demo → wybór PL → start → widzę banner "Tryb demo" i dataset Atelier ToolToys.
- Smoke: 10 wywołań AI w demo → limit reached → komunikat + degraded mode; dalej mogę przeglądać aplikację.
- Smoke: Start trial → nowa org → 7 dni w UI; po T‑7 widzę warning.
- Smoke: SuperAdmin → lista demo/trial starts z datą, użytkownikiem, językiem, source.
- CLI smoke (backend): `npm run -s db:seed:demo:contract` + `npm run -s smoke:demo:script-a`.

**Dependencies:** V3-A03 (UI spójność bannerów)  
**Risks / go-live risk:** P0 — bez szczelnego funnelu demo/trial nie ma mierzalnej konwersji.  
**Analytics (events/metrics):**
- `demo_started` (language, scenarioId?)
- `demo_mode_enabled` / `demo_mode_disabled`
- `demo_ai_limit_reached`
- `trial_started` (source=demo|landing|invite)
- `trial_expiry_warning_shown` (daysLeft)
- `trial_converted_to_paid`
**Rollout plan:** R0: modal + dataset + limity + telemetria; R1: dopracowanie CTA i A/B copy.

#### V3-A06 — [Platform] SuperAdmin: Model Registry (kind/purpose/fallbacks)
- Status spec: draft
- Priorytet: P1
- Target: R1
- Moduł: Platform (SuperAdmin, AI infrastructure)
- SSOT: `docs/product/MODEL_REGISTRY_V3.md`, `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`, `server/src/services/ai/modelRouter.ts`, `server/src/routes/llm.routes.ts`

**Business challenge (problem):**  
Modele są rozproszone: LLM (text) przez tiers/capabilities, obraz osobno, brak jednej warstwy "co mamy, do czego służy, jakie fallbacki". SuperAdmin nie ma spójnego widoku katalogu i assignments.

**Cel (outcome, nie feature):**  
Jeden kanoniczny Model Registry: katalog modeli z `kind` (TEXT_LLM / IMAGE_MODEL / BUSINESS_MODEL), assignments purpose→model, fallback chain, health gating — wszystko widoczne i edytowalne w SuperAdmin.

**Użytkownicy i scenariusze:**
- SuperAdmin przegląda katalog Providers/Models: name, provider, model_id, kind, is_active, health_status, cost_per_1k (bez sekretów w UI).
- SuperAdmin konfiguruje assignments: TEXT_LLM tiers (BUDGET/STANDARD/PREMIUM/REASONING), IMAGE_MODEL purposes (cover/report/presentation), BUSINESS_MODEL purposes (LeanLM → Lean suggestions).
- Feature calls wybierają model przez `purpose`, nie "na sztywno"; fallback chain działa przy unhealthy.
- Każda zmiana konfiguracji jest logowana (audyt).

**Zakres (IN/OUT):**
- IN:
  - katalog modeli: `kind` (TEXT_LLM | IMAGE_MODEL | BUSINESS_MODEL), `purpose` assignments, `requirements` (context window, tool use, vision)
  - SuperAdmin: widok Providers/Models (name, provider, model_id, kind, is_active, health_status, cost_per_1k) — secrets nigdy w UI
  - SuperAdmin: edycja assignments dla TEXT_LLM (tiers), IMAGE_MODEL (purposes), BUSINESS_MODEL (purposes)
  - routing: feature calls → model przez purpose + fallback chain + health gating
  - audyt: logowanie zmian konfiguracji (kto/kiedy/co)
  - brak konfiguracji = jawny błąd + bezpieczny fallback (nie cicha degradacja)
- OUT:
  - org-level overrides (R2+; jeśli wchodzą — muszą być audytowalne)
  - pełna personalizacja rekomendacji modeli (v4+)

**UX / UI notes:**
- SuperAdmin ma sekcję "Model Registry" z podsekcjami: Catalog, TEXT_LLM Assignments, IMAGE_MODEL Assignments, BUSINESS_MODEL Assignments.
- Tabela katalogu: kolumny zgodne z App Table Standard (resizable, filtry, kebab).
- i18n PL+EN dla etykiet (nazwy purposes mogą być techniczne, ale UI ma tłumaczenia).

**Data / integrations:**
- `modelRouter.ts`: rozszerzenie o `kind`, `purpose` assignments, fallback chain
- `llm.routes.ts`, `imageService.ts` — integracja z registry
- Nowe lub rozszerzone tabele: `model_registry`, `model_assignments`, `model_audit_log`
- `quotaService` / billing: koszty per purpose (do limitów)

**AI behavior (jeśli dotyczy):**  
- AI gateway wybiera model przez purpose z registry; przy braku/healthy fallback — jawny błąd, nie "cicha" degradacja.

**Definition of Done (DoD):**
- Katalog modeli w SuperAdmin z polami: name, provider, model_id, kind, is_active, health_status, cost_per_1k.
- Assignments edytowalne dla TEXT_LLM, IMAGE_MODEL, BUSINESS_MODEL.
- Feature calls używają purpose → model z registry; fallback chain działa.
- Każda zmiana konfiguracji jest logowana; brak konfiguracji = jawny błąd.

**Acceptance / test plan:**
- Smoke: SuperAdmin → Model Registry → widzę katalog bez API keys.
- Smoke: Zmiana assignment (np. chat_simple → inny model) → zapis → następne wywołanie używa nowego modelu.
- Smoke: Model unhealthy → routing przełącza na fallback; w logach widać fallback event.
- Smoke: Usunięcie ostatniego modelu z purpose → jawny błąd w UI, nie cicha degradacja.

**Dependencies:** V3-A05 (telemetria AI w demo/trial), V3-A03 (SuperAdmin UI spójność)  
**Risks / go-live risk:** P1 — bez tego trudno skalować i audytować modele; nie blokuje R0.  
**Analytics (events/metrics):**
- `model_registry_viewed`
- `model_assignment_changed` (kind, purpose)
- `model_fallback_used` (purpose, reason)
- `model_audit_log_entry` (internal)
**Rollout plan:** R1: katalog + assignments + routing; R2: org overrides + koszty per purpose.

#### V3-A07 — [Platform] Preview pane contract rollout (key hubs)
- Status spec: draft
- Priorytet: P1
- Target: R1
- Moduł: Platform + MyWork, Initiatives, Results, Interview
- SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`, `docs/ui-standards/03-modules/app-table-standard.md`, `docs/ui-standards/03-modules/module-hub-standard.md`, `docs/ui-standards/UI_UX_CANON_V3.md`

**Business challenge (problem):**  
Preview pane jest "border-l widgetem" lub brakuje go w kluczowych hubach; brak spójnego kontraktu (Outlook style) powoduje niespójne zachowanie i utratę perceived quality.

**Cel (outcome, nie feature):**  
Wszystkie kluczowe huby z tabelami używają jednego kontraktu preview pane: `PreviewPaneShell`, anatomia (header/body/footer), selection→preview / Enter→full, parity akcji, i18n, locked state.

**Użytkownicy i scenariusze:**
- User w MyWork Inbox: single click → preview, Enter/double-click → full detail; J/K nawigacja, Esc zamyka.
- User w Initiatives: wybór wiersza → preview z key fields + quick actions (np. Open full); te same akcje co w full view.
- User w Results (KPI): preview pokazuje podsumowanie KPI + link do inicjatywy.
- User w Interview Insights: preview dla insight item; parity akcji jeśli dotyczy.
- Artefakt locked: preview pokazuje stan read-only, akcje edycyjne disabled.

**Zakres (IN/OUT):**
- IN:
  - huby objęte rollout: MyWork Inbox (V3-C01), MyWork Decisions (V3-C05), Initiatives hub, Results hub, Interview Insights (V3-D03)
  - wspólny shell: `PreviewPaneShell` (kicker, title, actions, onClose, children, footer)
  - anatomia: header (sticky) + body (scroll) + footer (sticky) z quick actions
  - interakcje: single click = selection + preview; Enter/double-click = open full; J/K nawigacja; Close (X)
  - preview domyślnie OFF (otwiera się po selection)
  - parity akcji: te same quick actions w preview i full view (Approve/Reject/Delegate/Request info itd.)
  - layout: 20–33% szerokości, min 340px, Layer 1/2 tła, rounded card zgodny z tabelą
  - i18n PL+EN (kicker "Preview"/"Podgląd", etykiety akcji)
  - locked state: preview respektuje `locked` — akcje edycyjne disabled, copy "Poproś ownera" jeśli brak uprawnień
- OUT:
  - pełna migracja wszystkich legacy "cowboy panels" (np. InitiativeCompactPanel) — robimy stopniowo w taskach modułowych
  - "pin preview" jako opcja (R2+)

**UX / UI notes:**
- Źródło prawdy: `table-preview-pane-standard.md` (layout, anatomia, interakcje).
- Preview nie może być "gołym border-l" — card z Layer 2, `rounded-xl`/`rounded-hig-md`, spójne z tabelą.
- Parity akcji: MUST — te same nazwy i semantyka w preview i full view.
- Responsywność: preview może się zwężać szybciej niż tabela; `clamp()` dla szerokości.

**Data / integrations:**
- Preview payload: minimalny kontrakt per encja (id, type, title, key fields, quick actions metadata).
- API: endpoint lub rozszerzenie list do zwracania "preview payload" bez pełnego dokumentu (opcjonalnie, dla performance).

**AI behavior (jeśli dotyczy):**  
- AI może proponować "suggested actions" w preview (propose→accept), ale nie wykonuje bez kliknięcia.

**Definition of Done (DoD):**
- Wszystkie 5 hubów (Inbox, Decisions, Initiatives, Results, Interview Insights) używają `PreviewPaneShell`.
- Single click = preview, Enter/double-click = full; J/K, Esc działają.
- Parity akcji: preview ma te same quick actions co full view (gdzie dotyczy).
- i18n PL+EN; locked state respektowany.
- Brak "border-l widget" — preview wygląda jak część composite container (rounded, warstwy).

**Acceptance / test plan:**
- Smoke: MyWork Inbox — klik wiersz → preview otwarty; Enter → full detail w dynamic tabs.
- Smoke: Decisions — preview ma Approve/Reject/Delegate/Request info w footerze; akcje działają.
- Smoke: Initiatives — preview z key fields + Open full; zwężenie okna nie łamie layoutu.
- Smoke: Results — preview KPI z linkiem do inicjatywy.
- Smoke: Interview Insights — preview zgodny ze standardem.
- Smoke: Artefakt locked → preview pokazuje disabled akcje edycyjne.

**Dependencies:** V3-A03 (UI standards sweep, App Table + ModuleHub)  
**Risks / go-live risk:** P1 — bez spójnego preview pane "Outlook style" tracimy triage efficiency i premium feel.  
**Analytics (events/metrics):**
- `preview_pane_used` (module, entityType)
- `preview_pane_action_clicked` (module, actionType)
- `preview_pane_opened_full` (module)
**Rollout plan:** R1: rollout po 1 hubie (Inbox → Decisions → Initiatives → Results → Insights); każdy z smoke testem.

#### V3-A08 — [Platform] Video enablement system (micro‑prompts + rekomendacje + kanon UI)
- Status spec: draft
- Priorytet: P1
- Target: R0/R1
- SSOT: `VIDEO_ENABLEMENT_V3.md`, `docs/videos/README.md`, `docs/ui-standards/00-foundation/visual-language.md`, `docs/ui-standards/00-foundation/color-system.md`

**Business challenge (problem):**  
Bez krótkiej edukacji (i “co dalej”) user nie łapie wartości platformy, a overlaye/filmy łatwo zmienić w spam.

**Cel (outcome):**  
Kontekstowe micro‑wideo w modułach + polecanie kolejnych filmów (edukacja + promo) w spójnym, “tech sexy” UI, z kontrolą częstotliwości i telemetrią.

**Zakres (IN/OUT):**
- IN:
  - micro‑video modal (Layer‑3) pokazuje 1 film kontekstowy + 2–4 rekomendacje (playable)
  - stan per user+module: watched / skipped / don’t show again
  - eventy analityczne dla promptu i oglądania
- OUT:
  - personalizacja rekomendacji (R1+)
  - wideo jako kroki playbooków onboardingowych (R1+)

**Definition of Done (DoD) — R0:**
- modal micro‑video jest spójny z DBR77 visual language i nie ma “D‑mode vibe”
- pokazuje rekomendacje w tym samym oknie (bez wychodzenia)
- zapis dismissals działa per user+module
- eventy: `help_video_prompt_shown`, `help_video_view_started`, `help_video_view_completed`, `help_video_skipped`, `help_video_dont_show`

**Dependencies:** V3-A03 (UI sweep), V3-A05 (Demo/Trial value moments)  
**Risks / go-live risk:** P1 — bez tego spada time‑to‑value i demo conversion.  
**Rollout plan:** R0: micro‑prompt + rekomendacje; R1: personalizacja + playbooks video.

---

### WS-B — Chat v3

#### V3-B01 — [Chat] Chat jako router pracy (mechaniczne transfery do narzędzi)
- Status spec: review
- Priorytet: P0
- Target: R0
- SSOT: `OPERATING_MODEL_V3.md`, `V3_MODULE_VERIFICATION_MATRIX.md` (Chat)

**Business challenge (problem):**  
Chat bez “mechanicznego transferu” jest tylko copywriterem. V3 ma być routerem pracy: rozpoznaje intencję i *prowadzi do narzędzia*.

**Cel (outcome, nie feature):**  
Użytkownik z czatu w 1–2 klikach trafia do właściwego miejsca aplikacji **z zachowaniem kontekstu** (otwarcie artefaktu lub uruchomienie generatora).

**Użytkownicy i scenariusze:**
- “Chcę zrobić diagnozę” → Tools/Assessment (z właściwą kategorią).
- “Chcę dopracować inicjatywę X” → otwarcie `InitiativeDocumentView` w dynamic tabs.
- “Chcę wygenerować raport / deck” → start generatora z wypełnionym kontekstem.

**Zakres (IN/OUT):**
- IN:
  - `NAVIGATE` działa na poziomie: module + entity (id) + surface (list/detail/wizard)
  - citations / response actions / smart suggestions korzystają z jednego “nawigatora”
  - fallback: jeśli deep link nie działa → otwieramy moduł root + komunikat
- OUT:
  - automatyczne wykonywanie destrukcyjnych akcji bez akceptacji

**UX / UI notes:**
- “Mechaniczny transfer” = user klika akcję w odpowiedzi AI i system przenosi do właściwego surface’u.
- Jeśli brakuje kontekstu → AI proponuje checklistę braków (gatekeeper), nie “zgaduje”.

**Data / integrations:**
- Action payload: `targetModule`, opcjonalnie `entityType`, `entityId`, `surface`, `params`.

**AI behavior:**
- propose→accept: AI proponuje akcje, user klika.

**Definition of Done (DoD):**
- `NAVIGATE` otwiera: Tools, Initiatives, Report Builder, Presentations, Results (minimum R0).
- działa “open specific entity in dynamic tabs” (min: initiative, report builder).
- błędy mają UX fallback.

**Acceptance / test plan:**
- z czatu otwieram initiativeId (w dynamic tabs) i wracam do czatu bez resetu rozmowy
- z czatu uruchamiam Report Builder wizard z kontekstem

**Dependencies:** V3-A02  
**Risks / go-live risk:** P0 — bez tego chat nie spełnia roli v3.  
**Analytics:** `chat_action_clicked`, `chat_action_failed` (min: NAVIGATE).  
**Rollout plan:** R0: NAVIGATE + deep links; R1: pełny katalog akcji i unify UI.

#### V3-B02 — [Chat] Ujednolicenie action model (brak martwych typów)
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `src/types/domain/ai.ts`, `docs/product/V3_MODULE_VERIFICATION_MATRIX.md` (Chat)

**Business challenge (problem):**  
Jeśli prompt mówi o akcjach, których UI nie obsługuje (albo backend nie ma endpointu), user traci zaufanie (“system udaje, że potrafi”).

**Cel (outcome):**  
Jedna lista akcji + jeden kontrakt payloadów + jedna obsługa, używana przez wszystkie komponenty chatowe.

**Zakres (IN/OUT):**
- IN:
  - jeden katalog: action types + payload schema + capabilities (co wolno w danej roli/statusie)
  - jedna implementacja handlera (front) + jeden standard UI (render, disable, errors)
  - prompty nie zawierają “martwych” akcji
- OUT:
  - advanced workflow marketplace (v4+)

**Użytkownicy i scenariusze:**
- User dostaje w odpowiedzi AI 3 akcje (np. Navigate, Create Task, Create Decision) i każda ma spójny wygląd + działa.
- Admin/Manager widzi akcje wymagające uprawnień, User widzi je jako disabled z komunikatem.

**UX / UI notes:**
- Każda akcja ma: label, short description, primary/secondary styling, disabled reason.
- Błędy są inline (na karcie akcji), nie jako “silent fail”.

**Data / integrations:**
- Kontrakt akcji ma wersję (`action_schema_version`) i walidację payloadu.
- Capability check: role + workspace/project + status artefaktu.

**AI behavior:**
- AI proponuje tylko akcje, które są dozwolone w danym kontekście (capabilities).
- Jeśli AI “chce” akcję niedozwoloną — proponuje alternatywę (np. “poproś managera”).

**Definition of Done (DoD):**
- 0 “martwych” akcji (prompt/types/handler są zgodne)
- każda akcja ma: render w UI, handler, error state, analytics

**Acceptance / test plan:**
- test manual: akcje z odpowiedzi AI zawsze są klikalne i działają albo pokazują sensowny błąd

**Dependencies:** V3-B01  
**Risks:** P1 — nie blokuje R0, ale psuje “mechanical transfer”.  
**Analytics (events/metrics):**
- `chat_action_rendered` (type)
- `chat_action_clicked` (type)
- `chat_action_failed` (type, reason)
**Rollout plan:** spiąć kontrakt w 1 miejscu, potem refactor użyć w komponentach.

---

### WS-C — MyWork v3

#### V3-C01 — [MyWork] Inbox jako triage center + preview pane contract
- Status spec: draft
- Priorytet: P1
- SSOT: `table-preview-pane-standard.md`
- Target: R1

**Business challenge (problem):**  
Inbox bez preview pane to “klik w nieskończoność” i brak triage. To zabija MyWork jako centrum dowodzenia.

**Cel (outcome):**  
User może przejrzeć 20+ pozycji i wykonać quick actions bez otwierania full detail view.

**Użytkownicy i scenariusze:**
- user skanuje powiadomienia i wybiera 3 rzeczy do zrobienia dziś
- user odpina “mark as read / dismiss / assign / open full”

**Zakres (IN/OUT):**
- IN:
  - selection (single click) otwiera preview (Outlook style)
  - Enter/double click otwiera full detail
  - keyboard: J/K do nawigacji, Esc zamyka preview
  - quick actions (minimum) zgodne z typem itemu
- OUT:
  - pełne unified inbox dla całej aplikacji (v4+ jeśli trzeba)

**UX / UI notes:**
- trzymamy się `table-preview-pane-standard.md` (shell + anatomia + interakcje)

**Data / integrations:**
- Inbox item ma minimalny kontrakt: `id`, `type`, `title`, `created_at`, `source_type/source_id`, `unread`, `priority`.
- Preview pane ładuje “preview payload” (krótkie podsumowanie + działania) bez pobierania pełnego dokumentu.

**AI behavior (opcjonalnie):**
- AI może dodawać “suggested actions” do inbox items (np. “convert to task”, “reply”), ale nie wykonuje ich bez kliknięcia.

**Definition of Done (DoD):**
- preview pane ma header/body/footer i korzysta ze wspólnego shell’a
- decyzja hover vs click jest jedna w całej aplikacji i opisana w SSOT

**Acceptance / test plan:**
- triage 20 items < 2 min bez przypadkowego otwarcia full detail
- Enter otwiera full detail, a single click tylko zmienia preview

**Dependencies:** —  
**Risks:** P1 UX — nie blokuje R0, ale mocno wpływa na “everyday use”.
**Analytics (events/metrics):**
- `mywork_inbox_opened`
- `mywork_inbox_item_previewed` (type)
- `mywork_inbox_item_opened_full` (type)
**Rollout plan:** R1: preview pane + keyboard + minimal quick actions; potem unified inbox scope.

#### V3-C02 — [MyWork] Conversions (Idea/Notebook) → consistent “Convert to …”
- Status spec: review
- Priorytet: P0
- SSOT: `SOURCE_TRACEABILITY_SPEC.md`, `TOOLS_CATALOG_V3.md`
**DoD:** konwersje nie łamią traceability; “Convert to initiative/report/presentation” zawsze przez ToolSession; UI pokazuje co się stanie (“Create ToolSession (MyWork) first”).

**Target:** R0  

**Business challenge (problem):**  
Konwersje “magiczne” psują governance i traceability (outputy bez źródła).

**Cel (outcome):**  
Każde “Convert to …” jest przewidywalne i zawsze traceable.

**Użytkownicy i scenariusze:**
- User ma pomysł (Idea) i robi “Convert to initiative” → powstaje draft inicjatywy z linkiem do źródła.
- User ma notatkę (Notebook) i robi “Convert to report” → powstaje draft report z prefilled context.

**Zakres (IN/OUT):**
- IN:
  - Convert to… zawsze pokazuje “co się stanie” (w tym materializacja ToolSession)
  - zapis `derived_from` + `source_type/source_id`
- OUT:
  - automatyczne łączenie wielu źródeł w jeden output bez interakcji (v4+)

**UX / UI notes:**
- Menu konwersji ma stały wording: `Convert to…` + microcopy “This will create a MyWork session first”.
- Po konwersji: toast + “Open output” + “Open source”.

**Data / integrations:**
- Zapisujemy: `derived_from` (idea/notebook id) + `source_type/source_id` (toolSession) na output.

**AI behavior (opcjonalnie):**
- AI może proponować “Convert to…” jako sugestię, ale user wykonuje klik.

**Definition of Done (DoD):**
- Wszystkie konwersje prowadzą przez ToolSession (MYWORK) lub istniejącą sesję.
- Output ma poprawne metadane source i UI je pokazuje.

**Acceptance / test plan:**
- Idea → Convert to Initiative: inicjatywa ma źródło i link “Open source”
- Notebook → Convert to Report: report ma źródło i metadane

**Dependencies:** V3-A01, V3-C03  
**Risks / go-live risk:** P0 — bypass governance = krytyczny.  
**Analytics (events/metrics):**
- `mywork_convert_clicked` (from, to)
- `mywork_convert_completed` (toType, has_source=true)
**Rollout plan:** R0: guardrail + copy + materializacja.

#### V3-C03 — [MyWork] MyWork ToolSession materialization (type=MYWORK)
- Status spec: draft
- Priorytet: P0
**Dependencies:** V3-A01
**DoD:** jeśli output “projektowy” powstaje z MyWork, system tworzy ToolSession i podpina źródła; zapisuje minimalny snapshot kontekstu (linki/refs).

**Business challenge (problem):**  
MyWork jest miejscem “luźnej pracy”, ale V3 wymaga, aby deliverables zawsze miały kanoniczne źródło. Bez MYWORK ToolSession traceability jest fikcją.

**Cel (outcome):**  
Każdy output pochodzący z MyWork ma ToolSession jako źródło (auto‑materializacja), a user rozumie co się stało.

**Użytkownicy i scenariusze:**
- User tworzy notatkę i konwertuje ją do reportu → system tworzy MYWORK ToolSession.
- User tworzy ideę i konwertuje do inicjatywy → system tworzy MYWORK ToolSession i zapisuje snapshot.

**Zakres (IN/OUT):**
- IN:
  - endpoint / logika tworzenia ToolSession(type=MYWORK)
  - snapshot: refs do notebook/ideas/attachments + krótki summary
  - UI: pokazanie “Source: MyWork session” w output
- OUT:
  - pełny “MyWork workspace as tool” (rozbudowane kroki) (v4+)

**UX / UI notes:**
- Po pierwszej materializacji: toast “Created MyWork session” + “Open session”.
- W output: link “Open source session” działa zawsze.

**Data / integrations:**
- ToolSession: `type=MYWORK`, `derived_from` (idea/notebook ids), `snapshot_json`.

**AI behavior (opcjonalnie):**
- AI może proponować materializację, ale system i tak robi ją automatycznie przy konwersji.

**Definition of Done (DoD):**
- Każdy convert z MyWork tworzy lub reuse’uje MYWORK ToolSession.
- Source metadane są kompletne (no nulls).

**Acceptance / test plan:**
- Convert z Idea → Initiative tworzy session i ustawia source na output.
- Convert z Notebook → Report tworzy session i ustawia source na output.

**Risks / go-live risk:** P0 — bez tego traceability w v3 nie istnieje.  
**Analytics (events/metrics):**
- `mywork_session_materialized` (reason=convert)
- `mywork_session_opened`
**Rollout plan:** R0: auto‑materializacja + source UI; R1: lepszy snapshot + reuse heurystyka.

**Target:** R0

**Business challenge (problem):**  
MyWork jest “personal”, ale outputy są “platformowe”. Bez mostu, MyWork będzie albo “śmietnikiem”, albo będzie łamał traceability.

**Cel (outcome):**  
MyWork ToolSession jako legalny kanał wyjścia dla outputów z MyWork.

**Zakres (IN/OUT):**
- IN:
  - ToolSession type=MYWORK + minimalny snapshot kontekstu (refs/notes)
  - outputy z MyWork są widoczne w Tools → Outputs (jak inne)
- OUT:
  - rozbudowany editor tool session (v4+)

**Acceptance / test plan:**
- MyWork → Convert to initiative/report/deck: system tworzy ToolSession i podpina output
- output w Tools ma badge “MYWORK” jako source

**Dependencies:** V3-A01  
**Risks:** P0 — to jest fundament traceability dla MyWork.

#### V3-C04 — [MyWork] Focus redesign (lightweight execution cockpit)
- Status spec: draft
- Priorytet: P1
- Target: R1 (UX hardening)
- SSOT: `docs/MYWORK_MODULE_SPECIFICATION.md` (sekcja Focus), `workspace-3-tools-strip.md`, `table-preview-pane-standard.md`, `module-hub-standard.md`

**Business challenge (problem):**  
Obecny Focus jest przeładowany (środkowy feed AI/coach, dużo sekcji/ramek), przez co nie spełnia roli “szybkiego odhaczania” i zabiera przestrzeń roboczą.

**Cel (outcome):**  
Focus staje się lekkim cockpit’em: w 10–30 sekund user widzi plan (My list + Today + This Week) i może: dodać task, przerzucić, odhaczyć, otworzyć preview/full detail.

**Zakres (IN/OUT):**
- IN:
  - usunięcie centralnego “AI Coach feed” z content area
  - lane’y: `My list (capture)` + `Today` + `This Week` (Later opcjonalne, R1+)
  - quick-add `+ Task` w nagłówku lane (My list i Today)
  - drag&drop między lane’ami (Today ↔ Week, My list → Today/Week)
  - preview pane + prawy 3‑tools strip jako opcjonalne panele (nie duszą lane’ów)
- OUT:
  - “later backlog” jako główny element focus (to nie jest focus)

**Definition of Done (DoD):**
- Focus jest wizualnie i informacyjnie “lekki” (bez środkowego feedu)
- da się dodać task w 1 klik (quick-add) i przerzucić między lane’ami
- preview/full detail działa zgodnie ze standardami (Outlook style + dynamic tabs)

**Dependencies:** V3-C01 (preview pane pattern), V3-A03 (UI standards sweep)  
**Risks:** P1 UX — bez tego MyWork traci “sprzedażową” czytelność i premium feel.  
**Rollout plan:** R1: redesign Focus + minimal quick-add + drag/drop; potem dopracowanie AI suggestions w panelu.

#### V3-C05 — [MyWork] Decisions: timeline + remove queue view + preview parity actions
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `docs/ui-standards/03-modules/view-modes-standard.md`, `docs/ui-standards/03-modules/table-preview-pane-standard.md`, `docs/MYWORK_MODULE_SPECIFICATION.md`

**Business challenge (problem):**  
Decyzje i zadania mają zbliżony model pracy (priorytety, terminy, statusy), a dziś decyzje mają “twórczość” (queue/review-next jako pseudo-widok) i niespójny preview.

**Cel (outcome):**  
Decyzje działają jak “pierwsza klasa” kolekcji v3: Table/Kanban/Timeline + preview jak Outlook + quick actions spójne z full view.

**Zakres (IN/OUT):**
- IN:
  - view-modes dla Decisions: `table` + `kanban` + `timeline` (bez “queue view” jako view-mode)
  - Timeline: zoom day/week/month/quarter + multiselect priorytetów
  - Preview pane dla decyzji:
    - default OFF (otwiera się po kliknięciu w wiersz)
    - **parity akcji**: Approve/Reject/Delegate/Request info jak w full view
- OUT:
  - rozbudowany “review-next” jako osobny moduł (jeśli zostaje, to osobny flow, R2+)

**Definition of Done (DoD):**
- brak “queue view” w przełączniku view-modes
- timeline działa dla decyzji i ma minimalny kontrakt jak Tasks timeline (zoom, filtry multi, preview)
- preview dla decyzji ma te same quick actions co full view (i te same uprawnienia)

**Dependencies:** V3-A03 (UI standards sweep)  
**Risks:** P1 UX — bez tego Decisions odstają i psują spójność v3.

#### V3-C06 — [MyWork] Ideas: canvas tools selector + shared core model (no data loss)
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `docs/MYWORK_MODULE_SPECIFICATION.md` (Ideas: canvas tools + `IdeaWorkspaceGraph`), `docs/ui-standards/UI_UX_CANON_V3.md`

**Business challenge (problem):**  
Pomysły mają stać się “żywym workspace’em” (mind map dziś wygląda świetnie), ale bez wspólnego rdzenia danych przełącznik narzędzi będzie gubił treści i rozmnoży dług.

**Cel (outcome):**  
Jedno źródło treści (`IdeaWorkspaceGraph`) + różne renderery (MindMap/Flow/Table/Whiteboard) + brak utraty danych przy przełączaniu.

**Zakres (IN/OUT):**
- IN:
  - selector narzędzia canvasa w prawym górnym rogu (MindMap/Process Flow/Table/Whiteboard)
  - wspólny core model: nodes/edges + `extensions` namespaced dla danych narzędziowych
  - per-tool view state (layout) per user/per workspace
- OUT:
  - pełny “whiteboard suite” jak Miro (v4+), jeśli to miałoby wyjść poza scope

**Definition of Done (DoD):**
- przełączanie narzędzi nie gubi treści (core data zachowane)
- dane specyficzne narzędzia trafiają do `extensions` (namespaced) i nie są tracone
- preferencja narzędzia zapisywana per user/per workspace

**Dependencies:** V3-A03 (UI standards sweep)  
**Risks:** P1 — bez rdzenia danych “workspace tools” stanie się 4 niespójnymi światami.

---

### WS-D — Interview v3

#### V3-D01 — [Interview] Sufficiency contract (min) + send-back clarity
- Status spec: draft
- Priorytet: P1
- SSOT: `INTERVIEW_FORM_ENGINE_V3.md`
- Target: R1

**Business challenge (problem):**  
Manager nie wie czy odpowiedzi są “wystarczające”, respondent nie wie czego brakuje. Pętla jest kosztowna i nieprzewidywalna.

**Cel (outcome, nie feature):**  
Zatwierdzanie działa jak kontrola jakości: jest jasny powód send-back i widoczne “co poprawić”.

**Użytkownicy i scenariusze:**
- Respondent wypełnia assignment → `Submit`.
- Manager ocenia → `Approve` albo `Send-back` z listą braków.
- Respondent uzupełnia i ponawia submit.

**Zakres (IN/OUT):**
- IN:
  - standard “send-back”: **reason + lista braków (min)** + (opcjonalnie) wskazanie konkretnych pytań/sekcji
  - standard “approve”: minimalny gate jakości (nie tylko % wypełnienia)
  - UI: respondent widzi braki jak checklist (co trzeba uzupełnić)
- OUT:
  - pełny scoring jakości odpowiedzi przez LLM/ML (v4+)

**UX / UI notes:**
- Manager ma “sufficiency view”: podsumowanie braków + quick actions.
- Respondent ma “missing items” powiązane z pytaniami/sekcjami.

**Data / integrations:**
- Backend przechowuje: `sent_back_reason` + opcjonalnie `missing_items_json`.

**AI behavior (opcjonalnie):**
- AI może proponować brakujące elementy (np. “brakuje linku / liczby / załącznika”) w trybie propose→accept.

**Definition of Done (DoD):**
- Każdy `send-back` ma reason i jest widoczny w UI respondenta.
- Respondent ma listę braków i może je odhaczać.
- `approve` ma minimalny kontrakt jakości (SSOT) i egzekwuje go backend.

**Acceptance / test plan:**
- Send-back: respondent widzi reason + brakujące elementy (i nie musi domyślać się “co”).
- Approve: bez spełnienia minimum → backend odrzuca + UI pokazuje komunikat.

**Dependencies:** —  
**Risks / go-live risk:** P1 — bez tego Interview robi “tarcie” i spowalnia discovery.  
**Analytics (events/metrics):**
- `interview_assignment_submitted`
- `interview_assignment_sent_back` (has_missing_items=true)
- `interview_assignment_approved`
**Rollout plan:** najpierw reason+missing list; potem dopiero ulepszony gate.

#### V3-D02 — [Interview] Runtime mode decision (one-question vs task-list) → SSOT alignment
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `INTERVIEW_FORM_ENGINE_V3.md`, `docs/product/V3_MODULE_VERIFICATION_MATRIX.md`

**Business challenge (problem):**  
SSOT mówi “one question per screen”, a UI jest task-list → rozjazd dokumentacji i produktu, ryzyko “audytu SSOT”.

**Cel (outcome):**  
Jedna decyzja produktowa, jeden kanon runtime. Jeśli są 2 tryby — jeden jest default, drugi jest jawnie opisany.

**Użytkownicy i scenariusze:**
- Respondent wypełnia formularz w trybie domyślnym (bez konfuzji) i rozumie postęp.
- Manager review’uje odpowiedzi i wie, jak działają attachments/comments w tym trybie.

**Zakres (IN/OUT):**
- IN:
  - decyzja: default runtime = `task-list` albo `one-question`
  - update SSOT + verif matrix + copy w UI
  - minimalny plan migracji (jeśli zmieniamy default)
- OUT:
  - budowa obu trybów w pełnej parze funkcji (jeśli nie jest potrzebne)

**UX / UI notes:**
- Jeśli zostają 2 tryby: przełącznik jest *explicit* (nie ukryty), z jasnym copy “to zmienia sposób wypełniania”.
- Jeśli zostaje 1 tryb: UI i SSOT muszą powiedzieć to samo (bez “legacy” opisów).

**Data / integrations:**
- Kontrakt w danych: `runtime_mode` per template/assignment (żeby nie zgadywać na froncie).
- Migracja: istniejące assignmenty zachowują dotychczasowy UX (bez niespodzianek).

**AI behavior:** —

**Definition of Done (DoD):**
- brak sprzeczności w `INTERVIEW_FORM_ENGINE_V3.md`
- UI mówi prawdę (default i opcjonalny przełącznik jeśli zostaje)
- dokumentacja wskazuje konsekwencje UX (review/approval, evidence/attachments)

**Acceptance / test plan:**
- Dla nowego assignmentu widać, jaki jest runtime mode (default lub wybrany).
- Zmiana trybu (jeśli istnieje) wpływa na render, ale nie psuje flow submit/approve/send-back.
- SSOT + verif matrix nie zawierają sprzecznych zapisów.

**Dependencies:** V3-D01 (wspólny “quality loop”)  
**Risks:** P1 — jeśli zostawimy sprzeczność, SSOT traci rangę.
**Analytics (events/metrics):**
- `interview_runtime_mode_selected` (mode, templateId)
- `interview_runtime_mode_changed` (mode, templateId)
**Rollout plan:** decyzja + update SSOT w R1; dopiero potem ewentualna implementacja przełącznika.

#### V3-D03 — [Interview] InterviewHub: App Table Standard compliance + Insights preview
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `docs/INTERVIEW_MODULE.md` (UI compliance v3), `docs/ui-standards/03-modules/app-table-standard.md`, `docs/ui-standards/03-modules/module-hub-standard.md`, `docs/ui-standards/03-modules/table-preview-pane-standard.md`

**Business challenge (problem):**  
InterviewHub dziś łamie kanon tabel/hubów (brak filtrów, resizerów, kebaba, ad-hoc paski “help”), co obniża perceived quality i utrudnia pracę (szczególnie Assigned/Insights).

**Cel (outcome):**  
Inbox/Sessions/Assigned/Templates/Insights w InterviewHub są spójne z App Table Standard i Command Row, a Insights mają preview pane jak inne kolekcje.

**Zakres (IN/OUT):**
- IN:
  - filtry w headerach kolumn (tam gdzie są potrzebne), resizable columns, Actions kebab (⋮)
  - usunięcie ad-hoc “help stripów” i bannerów między topbarem a tabelą (zastąpić Command Row counters)
  - porządek prawych kontrolek topbara: AI context → +New → view-modes → filters
  - Insights: preview pane (selection→preview, Enter→open full)
- OUT:
  - redesign całego Interview workspace (session answering) — osobne taski

**Definition of Done (DoD):**
- wszystkie 5 tabów InterviewHub spełniają App Table Standard
- brak dodatkowych rzędów między topbarem a tabelą
- Insights mają preview pane zgodny ze standardem (shell + anatomia + interakcje)

**Dependencies:** V3-A03  
**Risks:** P1 UX — bez tego Interview odstaje od v3.

---

### WS-E — Tools v3 (Discovery + Licensed)

#### V3-E01 — [Tools] Jeden mental model Tools (Library → Sessions → Outputs → Initiatives)
- Status spec: review
- Priorytet: P0
- SSOT: `OPERATING_MODEL_V3.md`, `TOOLS_CATALOG_V3.md`
- Target: R0

**Business challenge (problem):**  
W kodzie istnieją dziś osobne entry points (Discovery Tools vs Licensed Tools/Assessment). V3 wymaga jednego mental modelu.

**Cel (outcome):**  
Użytkownik porusza się po Tools jak po jednym module: **Library → Sessions → Outputs → Initiatives**.

**Użytkownicy i scenariusze:**
- User szuka narzędzia: filtruje strategic/operational/digital/assessment.
- User wraca do “sesji w pracy”.
- User tworzy output (initiative/report/deck) i widzi go w outputs.

**Zakres (IN/OUT):**
- IN:
  - spójny Tools hub (taby, copy, filtry)
  - Licensed/Assessment jest “kategorią” lub płynnym przejściem, nie osobnym światem
  - breadcrumbs “Tools > …” spójne z Operating Model
- OUT:
  - fizyczne scalenie kodu w jeden moduł (może być v4+)

**UX / UI notes:**
- Library: table + cards (okładki) + filtry kategorii (strategic/operational/digital/licensed).
- Sessions: lista uruchomień (ToolSession + Assessment sessions) z tym samym standardem statusów.
- Outputs: na R0 może być link/alias do “Reports/Presentations”, ale user musi widzieć jedną ścieżkę “co powstało”.
- Wszystko otwiera się w dynamic menu (ModuleHub → dynamic tabs).

**Data / integrations:**
- Spójny kontrakt “Tool session” vs “Assessment session” na poziomie list (metadane: id, type, status, updatedAt, owner).
- Filtry muszą działać per project/organization.

**AI behavior:**
- AI nie “przeskakuje” usera między modułami bez akcji — proponuje akcje (propose→accept).

**Definition of Done (DoD):**
- user ma jeden punkt “Tools” i nie czuje, że to 2 moduły
- w Tools widać: library + sessions + outputs + initiatives (nawet jeśli outputs jest linkiem/aliasem na początek)

**Acceptance / test plan:**
- user startuje narzędzie z library i wraca do sessions/outputs bez “gubienia”
- user z assessment może przejść do initiatives/outputs tym samym torem

**Dependencies:** V3-A04  
**Risks / go-live risk:** P0 — jeśli user się gubi, narzędzia nie będą używane.  
**Analytics (events/metrics):**
- `tools_hub_opened` (tab, viewMode)
- `tools_library_tool_opened` (toolType)
- `tools_session_started` (toolType/source)
- `tools_outputs_opened` (type=report|deck)
**Rollout plan:** R0: mental model + copy + aliasy; R1: dopięcie outputs jako artefaktów.

#### V3-E02 — [Tools] Outputs w Tools hub: Reports + Presentations + Initiatives (traceability)
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `PRESENTATIONS_AND_REPORTS_V3.md`, `REPORT_GENERATOR_V3.md`, `PRESENTATION_GENERATOR_V3.md`

**Business challenge (problem):**  
“Reports” jako status sesji to UI skrót, który nie spełnia v3: user potrzebuje biblioteki outputów jako artefaktów z metadanymi i historią.

**Cel (outcome):**  
Tools hub pokazuje outputy jako *artefakty* (Report, Deck, Initiative) powiązane z ToolSession/AssessmentReport.

**Użytkownicy i scenariusze:**
- User kończy sesję narzędzia i widzi wygenerowane: report + deck + draft initiatives.
- User z listy outputów otwiera report, zmienia tytuł, eksportuje i wraca do sesji źródłowej.

**Zakres (IN/OUT):**
- IN:
  - tab Reports = lista reportów powstałych z Tools
  - tab Presentations = lista decków powstałych z Tools
  - tab Initiatives = inicjatywy z `source_type=tool|assessment` + filtr po source
- OUT:
  - wersjonowanie outputów (v4+)

**UX / UI notes:**
- Każdy output ma: tool badge, createdAt, createdBy, title (editable), “Open source”.
- Akcje: Open / Rename / Export / Share (minimal).

**Data / integrations:**
- Report: musi mieć `source_type` + `source_id` (ToolSession/AssessmentReport) i `created_by`, `created_at`.
- Deck: analogicznie (Presentation decks).
- Initiatives: filtrowalne po `source_type` i `source_id`.

**AI behavior:**
- AI może proponować “create report/deck from this session” jako akcję — ale output musi mieć traceability.

**Definition of Done (DoD):**
- w Tools → Reports widać realne reporty (nie sesje)
- w Tools → Presentations widać realne decki
- klik otwiera artefakt w dynamic menu

**Acceptance / test plan:**
- Z ToolSession tworzę report → pojawia się w Tools → Reports jako artefakt z metadanymi.
- Z ToolSession tworzę deck → pojawia się w Tools → Presentations jako artefakt z metadanymi.
- “Open source” z outputu otwiera właściwą sesję.

**Dependencies:** V3-J01, V3-J02, V3-A02  
**Risks:** średnie — nie blokuje R0, ale jest kluczowe dla “full v3”.  
**Analytics (events/metrics):**
- `tools_output_opened` (type, id, sourceType)
- `tools_output_renamed`
- `tools_output_exported` (format)
**Rollout plan:** najpierw listy + open; potem filtry i metadane.

#### V3-E03 — [Tools] Tool Wizard Standard (non-licensed tools runtime)
- Status spec: draft
- Priorytet: P0
- Target: R0
- Moduł: Tools (Consulting Tools)
- SSOT: `CONSULTING_TOOLS_V3.md`, `TOOLS_CATALOG_V3.md`, `SOURCE_TRACEABILITY_SPEC.md`, `docs/ui-standards/03-modules/module-hub-standard.md`, `docs/ui-standards/02-components/workspace-3-tools-strip.md`, `docs/ui-standards/03-modules/app-table-standard.md`, `docs/ui-standards/03-modules/table-preview-pane-standard.md`

**Business challenge (problem):**  
Bez wspólnego szkieletu wizarda każdy consulting tool buduje własny flow — brak powtarzalności, spójności i możliwości skalowania. User gubi się między narzędziami, a traceability outputów jest niespójna.

**Cel (outcome, nie feature):**  
Jeden reużywalny **Tool Wizard Standard** dla wszystkich non-licensed consulting tools: wspólny szkielet kroków, zbieranie inputów, iteracyjne dopracowanie, użycie workspace/tabeli, tworzenie outputów (initiative/report/deck) z traceability, AI w trybie propose→accept, help content i assety (60s avatar script) śledzone per tool.

**Użytkownicy i scenariusze:**
- Konsultant startuje narzędzie z Library → wizard prowadzi przez: Define → Inputs & Assumptions → Work surface → Review → Finalize → Outputs.
- User wypełnia brakujące pola (missing items checklist) i iteruje — wizard nie jest jednorazowym formularzem.
- User finalizuje sesję i tworzy initiative/report/deck — każdy output ma `source_type/source_id` i akcję “Open source”.
- AI proponuje uzupełnienia i sugestie — user akceptuje lub odrzuca (propose→accept).

**Zakres (IN/OUT):**
- IN:
  - wspólny szkielet wizarda: Define (intent, scope, audience) → Inputs & Assumptions (client data + consultant assumptions, attachments/links) → Work (table/workspace/hybrid) → Review (summaries + missing items + suggested improvements) → Finalize (freeze, eligibility) → Outputs (Create initiative/report/presentation)
  - pętla iteracyjna: missing → add → re-process (deterministyczna checklista, nie “opinie AI”)
  - work surface types: Table (App Table standard) / Workspace (3-tools strip: Tools / Context / AI Suggestions) / Hybrid
  - output creation z traceability (`source_type`, `source_id`, `source_version`) i “Open source”
  - AI: propose→accept wszędzie; brak nadpisywania pracy usera
  - help content i 60s avatar script jako assety śledzone per tool (referencja do KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT)
- OUT:
  - licensed assessments (SIRI/ADMA) — osobny runtime (V3-E06)
  - pełna implementacja 31 narzędzi — to V3-E04

**UX / UI notes:**
- Wizard korzysta z module hub standard (dynamic tabs, topbar).
- Work surface: table zgodna z app-table-standard; workspace z workspace-3-tools-strip.
- Preview pane (gdy dotyczy): table-preview-pane-standard.
- Assumptions są first-class: widoczne, audytowalne, w snapshot przy finalizacji.

**Data / integrations:**
- ToolSession: `tool_type`, `status` (DRAFT/FINALIZED), `input_snapshot`, `output_snapshot`, `locked`.
- Outputs: `source_type=tool`, `source_id=<toolSessionId>`.
- Per-tool config: `surface_type`, `inputs_schema`, `outputs_capabilities` (z TOOLS_CATALOG / CONSULTING_TOOLS_TOOL_SPECS).

**AI behavior:**
- Zawsze propose→accept; nigdy auto-nadpisanie.
- AI może proponować: missing inputs, assumptions, summaries, draft outputów — user zatwierdza.
- Sugestie muszą być explainable i actionable (grounded w danych sesji).

**Definition of Done (DoD):**
- Wspólny wizard shell działa dla min. 1 narzędzia referencyjnego (np. dynamic-swot lub process-automation).
- Kroki Define → Inputs → Work → Review → Finalize → Outputs są egzekwowane.
- Pętla missing→add→re-process działa (checklist + re-process).
- Output (initiative/report/deck) ma traceability i “Open source”.
- AI propose→accept jest egzekwowany w UI.

**Acceptance / test plan:**
- Start narzędzia z Library → wizard otwiera się w dynamic tab.
- Wypełnienie inputów → brakujące pola → uzupełnienie → re-process → brakujące znikają.
- Finalize → Create initiative → inicjatywa ma source_type/source_id.
- AI proponuje uzupełnienie → user accept/reject → zapis odzwierciedla wybór.

**Dependencies:** V3-E01  
**Risks / go-live risk:** P0 — bez tego consulting tools nie skalują i nie mają spójnego UX.  
**Analytics (events/metrics):**
- `tools_wizard_step_completed` (toolType, step)
- `tools_wizard_finalized` (toolType)
- `tools_wizard_output_created` (toolType, outputType)
**Rollout plan:** R0: wizard shell + 1 narzędzie referencyjne; R1: rozszerzenie na kolejne tools.

#### V3-E04 — [Tools] One task per consulting tool (spec+assets+help)
- Status spec: draft
- Priorytet: P1
- Target: R2
- Moduł: Tools (Consulting Tools)
- SSOT: `CONSULTING_TOOLS_TOOL_SPECS_V3.md`, `TOOLS_CATALOG_V3.md`, `KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`, `CONSULTING_TOOLS_V3.md`, `SOURCE_TRACEABILITY_SPEC.md`, `docs/ui-standards/**`

**Business challenge (problem):**  
31 consulting tools bez spójnych speców, assetów i help content = chaos implementacyjny i słaba jakość sprzedażowa. Każde narzędzie wymaga: pełnej specyfikacji, preview graphic, 60s micro-video script, KB article — inaczej Library i sesje są niekompletne.

**Cel (outcome, nie feature):**  
Jeden task per consulting tool: kompletna spec (Library preview + wizard steps + work surface + outputs), assety (preview graphic + 60s avatar script), help content (KB “How to use” PL+EN). Wszystkie tools z CONSULTING_TOOLS_TOOL_SPECS_V3 mają odpowiadający task z DoD i acceptance.

**Użytkownicy i scenariusze:**
- Konsultant w Library widzi pełny preview: whenToUse, inputs, steps, outputs, graphic, micro-video, KB link.
- User startuje sesję — wizard ma spójne kroki (Define → Inputs → Work → Review → Finalize → Outputs) dopasowane do spec toola.
- User szuka pomocy — KB article “How to use” jest dostępny i kompletny (PL+EN).

**Zakres (IN/OUT):**
- IN:
  - 31 consulting tools (Strategy 1–10, Operations 11–20, Digital 21–30, Process Automation 31) z CONSULTING_TOOLS_TOOL_SPECS_V3
  - per tool: spec (Library content: whenToUse/inputs/steps/outputs/commonMistakes/example/nextSteps), wizard config (kroki + work surface type), preview graphic (graphics assumptions), 60s micro-video script, KB article (tools-${toolType}-how-to)
  - i18n PL+EN dla Library i KB
  - slug governance: canonical toolType (np. ai-discovery, legacy-analyzer) — bez legacy aliasów w sesjach
- OUT:
  - licensed methodologies (DRD/SIRI/ADMA) — V3-E06
  - asset production pipeline (nagranie video, thumbnail) — może być równoległy tor

**UX / UI notes:**
- Library preview: table-preview-pane-standard (description + graphic + micro-video + KB).
- Wizard: wspólny szkielet z V3-E03, per-tool config nadpisuje kroki i work surface.
- Assesments (SIRI/ADMA) są większe, ale nadal integrują się z modułem Tools (Library → Sessions → Outputs → Initiatives).

**Data / integrations:**
- Known Tools registry: `library_content_translations` (whenToUse, inputs, steps, outputs, commonMistakes, example, nextSteps).
- KB: slug `tools-${toolType}-how-to`, translations EN+PL.
- Assets: preview_image_url, micro_video_url (lub script do produkcji).

**AI behavior:** —

**Definition of Done (DoD):**
- Każdy z 31 tools ma: pełną spec w CONSULTING_TOOLS_TOOL_SPECS_V3 (lub uzupełnioną), Library content w registry, KB article, graphics assumptions, 60s video script.
- Minimum R0/R1: top tools (P0 z audytu) są kompletne; R2: reszta.
- Task jest “done” gdy spec + assets + help są zatwierdzone i wpięte.

**Acceptance / test plan:**
- Dla wybranego toola: Library pokazuje pełny preview, KB otwiera się, wizard ma poprawne kroki.
- Brak toola z pustym whenToUse lub brakującą KB (dla scope R2).

**Dependencies:** V3-E03 (wizard standard)  
**Risks / go-live risk:** P1 — bez tego tools są “szkieletem” bez treści; R2 scope.  
**Analytics (events/metrics):**
- `tools_library_tool_previewed` (toolType, has_graphic, has_video, has_kb)
**Rollout plan:** R1: P0 tools (top strategic + process-automation); R2: pełny zestaw 31.

#### V3-E05 — [Tools] Process Automation tool (hybrid workspace+table wizard)
- Status spec: draft
- Priorytet: P1
- Target: R1
- Moduł: Tools (Consulting Tools)
- SSOT: `CONSULTING_TOOLS_V3.md` (sekcja 9), `CONSULTING_TOOLS_TOOL_SPECS_V3.md` (Tool #31), `TOOLS_CATALOG_V3.md`, `SOURCE_TRACEABILITY_SPEC.md`, `docs/ui-standards/02-components/workspace-3-tools-strip.md`, `docs/ui-standards/03-modules/app-table-standard.md`, `FINANCE_EXPORT_V3.md` (outputs), `PRESENTATIONS_AND_REPORTS_V3.md`, `REPORT_GENERATOR_V3.md`, `PRESENTATION_GENERATOR_V3.md`

**Business challenge (problem):**  
Process Automation to narzędzie referencyjne dla hybrid tools (workspace + table + economics). Bez niego nie mamy “proof of concept” dla pełnego flow: mapowanie procesu → optymalizacja lean → automatyzacja → ROI — i generowanie initiative/report/deck z traceability.

**Cel (outcome, nie feature):**  
Pełna implementacja Process Automation tool: hybrid workspace (flowchart) + tabela kroków + economics (payback/ROI) + outputy (initiative batch, optional report/deck) z traceability. Narzędzie jest kanonicznym przykładem dla V3-E03 (Tool Wizard Standard) i V3-E04 (one task per tool).

**Użytkownicy i scenariusze:**
- Konsultant mapuje proces klienta w workspace (flowchart: trigger/decision/action) i synchronizuje z tabelą kroków (1 wiersz = 1 krok).
- User mierzy as-is time, proponuje lean optimizations, przypisuje technologie automatyzacji (z reuse), liczy savings i payback/ROI.
- User finalizuje sesję i tworzy initiative package (“process improvement initiatives”) + opcjonalny report/deck “Process Automation Summary” — wszystkie z source_type/source_id.

**Zakres (IN/OUT):**
- IN:
  - wizard steps (kanoniczne z CONSULTING_TOOLS_V3): Capture process (chat-assisted) → draw flowchart w Workspace → Map flowchart → steps table → Classify steps (trigger/decision/action) → Measure as-is → Lean optimize → Automation options (reuse tech) → Savings → Economics (CAPEX/OPEX, payback/ROI)
  - work surface: hybrid — workspace (flowchart) + table (ProcessStep[], 1 row per step) + economics summary
  - data model: ProcessStep (step_id, order_index, name, step_type, as_is_time, to_be_time, lean_ideas, automation_technology_ids, time_saved, capex/opex), AutomationTechnology[], economics summary
  - outputs: initiative batch + optional report/deck (traceable)
- OUT:
  - zaawansowana optymalizacja matematyczna procesów (v4+)
  - pełna integracja z Financial Analysis module (R0 minimal)

**UX / UI notes:**
- Workspace: flowchart z shapes (start/end, decision diamond, action rectangle); 3-tools strip (Tools / Context / AI Suggestions).
- Table: App Table standard, kolumny zgodne z ProcessStep.
- Economics: sekcja podsumowania (totals, savings, payback, ROI).
- Output creation: jak w FINANCE_EXPORT_V3 / PRESENTATIONS_AND_REPORTS — traceability + “Open source”.

**Data / integrations:**
- ToolSession.tool_type = `process-automation`.
- ProcessStep[], AutomationTechnology[] w output_snapshot.
- Outputs: source_type=tool, source_id=toolSessionId.

**AI behavior:**
- AI może proponować: lean ideas, automation tech per step, economics assumptions — propose→accept.
- Chat-assisted capture: AI pomaga w pierwszym szkicu flowchartu.

**Definition of Done (DoD):**
- Wizard Process Automation działa end-to-end: flowchart → table → classify → measure → optimize → automation → savings → economics.
- Output (initiative batch + report/deck) ma traceability.
- Narzędzie jest używane jako reference implementation dla V3-E03.

**Acceptance / test plan:**
- Prosty proces (5 kroków) → flowchart + table zsynchronizowane.
- Lean + automation → savings i ROI są liczone.
- Finalize → Create initiatives → inicjatywy mają source.

**Dependencies:** V3-E03  
**Risks / go-live risk:** P1 — kluczowe dla “hybrid tools” credibility, nie blokuje R0.  
**Analytics (events/metrics):**
- `tools_process_automation_started`
- `tools_process_automation_step_completed` (step)
- `tools_process_automation_finalized`
**Rollout plan:** R1: pełna implementacja + reference dla innych hybrid tools.

#### V3-E06 — [Tools] Licensed methodologies parity (SIRI/ADMA)
- Status spec: draft
- Priorytet: P1
- Target: R1
- Moduł: Tools (Consulting Tools / Licensed)
- SSOT: `CONSULTING_TOOLS_V3.md`, `TOOLS_CATALOG_V3.md`, `SOURCE_TRACEABILITY_SPEC.md`, `PRESENTATIONS_AND_REPORTS_V3.md`, `REPORT_GENERATOR_V3.md`, `PRESENTATION_GENERATOR_V3.md`, `docs/ui-standards/03-modules/module-hub-standard.md`

**Business challenge (problem):**  
DRD jest benchmarkiem dla licensed assessments; SIRI i ADMA mają rozjazdy w: zestawach pytań, scoringu, wizualizacji wyników, outputach (report/deck). Bez parytetu klient widzi “różne produkty” zamiast spójnej oferty metodologicznej.

**Cel (outcome, nie feature):**  
SIRI i ADMA osiągają parytet z DRD: wyrównane zestawy pytań (question sets), wizualizacja scoringu (scoring visualization parity), outputy report/presentation z traceability, artefakt Methodology Pack (knowledge + runtime config) jako kanoniczny model. Assessments są większe niż consulting tools, ale integrują się z modułem Tools (Library → Sessions → Outputs → Initiatives).

**Użytkownicy i scenariusze:**
- Konsultant wybiera SIRI lub ADMA w Library (Licensed) → startuje sesję assessment → wypełnia pytania (questionnaire runtime).
- User widzi scoring i wizualizację wyników w tym samym standardzie co DRD (dimensions, levels, evidence).
- User finalizuje AssessmentReport → tworzy report/deck — output ma source_type=assessment, source_id=assessmentReportId.
- User otwiera “Open methodology” — Methodology Pack (knowledge assets, scoring rules, evidence guidance) jest dostępny.

**Zakres (IN/OUT):**
- IN:
  - wyrównanie question sets: SIRI i ADMA mają zestawy pytań zdefiniowane w Methodology Pack (dimensions, questions, scoring scales, aggregation rules) — spójne z modelem DRD
  - scoring visualization parity: ten sam standard wizualizacji (heatmap, dimension scores, level indicators) co DRD
  - report/presentation outputs: AssessmentReport jako source; traceability (`source_type`, `source_id`); generatory report/deck korzystają z assessment data
  - Methodology Pack artefakt: framework_code (SIRI/ADMA), knowledge assets (overview, how to score, evidence rules), question/scoring model, runtime UI config, output mapping rules
  - integracja z Tools hub: Licensed jako kategoria; Sessions i Outputs pokazują assessment runs obok tool sessions
- OUT:
  - nowe licensed packs (v4+)
  - pełna personalizacja pytań per klient (v4+)

**UX / UI notes:**
- Library: Licensed category; preview z Methodology Pack (description, when to use, KB links).
- Assessment runtime: questionnaire + scoring + summary — spójny z DRD.
- Output creation: jak Report Generator / Presentation Generator — z kontekstem assessment.

**Data / integrations:**
- MethodologyPack: framework_code, knowledge_assets_refs, scoring_model, runtime_ui_config, output_mapping_rules.
- AssessmentReport: canonical source dla outputów; status FINAL.
- Outputs: source_type=assessment, source_id=assessmentReportId.

**AI behavior:**
- AI może proponować interpretacje i sugestie (propose→accept), nie zmienia scoringu bez zgody.

**Definition of Done (DoD):**
- SIRI i ADMA mają question sets zdefiniowane w Methodology Pack (parity z DRD).
- Scoring visualization jest spójna (ten sam standard UI).
- Report/deck z assessment ma traceability i “Open source”.
- Methodology Pack dla SIRI i ADMA istnieje (knowledge + runtime).

**Acceptance / test plan:**
- SIRI session → wypełnienie → scoring → wizualizacja jak DRD.
- ADMA session → analogicznie.
- Finalize → Generate report → report ma source_type=assessment, source_id.
- “Open methodology” otwiera Methodology Pack.

**Dependencies:** V3-E01  
**Risks / go-live risk:** P1 — bez parytetu licensed oferta jest niespójna.  
**Analytics (events/metrics):**
- `tools_licensed_session_started` (framework=SIRI|ADMA)
- `tools_licensed_report_generated` (framework)
**Rollout plan:** R1: SIRI + ADMA parity; DRD pozostaje benchmarkiem.

#### V3-E07 — [Tools] Known Tools content completeness audit + fill plan
- Status spec: draft
- Priorytet: P1
- Target: R2
- Moduł: Tools (Consulting Tools)
- SSOT: `KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`, `CONSULTING_TOOLS_TOOL_SPECS_V3.md`, `CONSULTING_TOOLS_V3.md`, `TOOLS_CATALOG_V3.md`

**Business challenge (problem):**  
Nie wiadomo, które narzędzia są “sprzedażowo kompletne” (whenToUse, inputs, steps, outputs, KB, graphic, video script), a które mają braki. Bez audytu i planu uzupełnień Library i sesje są niekompletne, a demo traci wiarygodność.

**Cel (outcome, nie feature):**  
Mieć jedno źródło prawdy: tabela audytu tool → braki (whenToUse, inputs, steps, outputs, KB, graphics, video script) → priorytet → owner → ETA. Plan uzupełnień z kolejnością, właścicielami i szacunkiem czasowym. Licensed assessments (DRD/SIRI/ADMA) są poza zakresem (własny tor Methodology Packs).

**Użytkownicy i scenariusze:**
- PO/SME przegląda tabelę audytu i wie: które tools są P0 (demo-critical), które P1/P2, kto jest ownerem, kiedy ETA.
- AI/Writer ma listę braków per tool i może draftować content (whenToUse, KB, video script).
- Design/Video wie, które tools potrzebują preview graphic i 60s avatar — i w jakiej kolejności.

**Zakres (IN/OUT):**
- IN:
  - tabela audytu: toolType → braki (L=Library whenToUse/inputs/steps/outputs, KB=article+translations, GFX=preview graphic, VID=60s avatar script+url)
  - priorytety: P0 (demo-critical), P1 (credibility), P2 (reszta)
  - owners: PO/SME (Piotr), AI/Writer, Design/Video
  - ETA per tool (czas wytworzenia i zatwierdzenia contentu/assetów, nie implementacji kodu)
  - plan uzupełnień: kolejność (P0 → P1 → P2), zasada “content first” (spec + graphics assumptions + video script przed implementacją UI)
- OUT:
  - licensed assessments — osobny audyt (Methodology Packs)
  - asset production pipeline (HeyGen, thumbnail) — może być równoległy tor

**UX / UI notes:**
- Audyt jest dokumentem SSOT (KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3) — nie rozproszone notatki.
- Tabela ma kolumny: toolType, Category, Braki (L/KB/GFX/VID), Priorytet, Owner, ETA.

**Data / integrations:**
- Źródło: Known Tools registry (library_content_translations), KB (tools-${toolType}-how-to), assets (preview_image_url, video_url).
- Braki = brak lub NULL w odpowiednich polach.

**AI behavior:** —

**Definition of Done (DoD):**
- Tabela audytu w KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3 jest kompletna dla 31 consulting tools.
- Każdy tool ma: Braki (L/KB/GFX/VID), Priorytet, Owner, ETA.
- Plan uzupełnień ma kolejność (P0→P1→P2) i zasadę “content first”.
- Minimum: 6 tools bez wpisu w Known Tools (ambition-decomposer, focus-tradeoff, narrative-engine, smed-planner, dms-builder, inventory-autopilot) mają wpis w planie z ETA.

**Acceptance / test plan:**
- Przegląd tabeli: brak toola bez wpisu.
- Dla P0 tools: braki są jasne, owner i ETA ustawione.
- Plan uzupełnień jest wykonalny (kolejność i zasoby spójne).

**Dependencies:** V3-E04 (one task per tool — audyt informuje taski)  
**Risks / go-live risk:** P1 — bez audytu content jest chaotyczny; R2 scope.  
**Analytics (events/metrics):**
- `tools_audit_reviewed` (optional)
**Rollout plan:** R1: audyt + plan P0/P1; R2: wykonanie planu (fill) + P2.

---

### WS-F — Initiatives v3

#### V3-F01 — [Initiatives] Template-driven N-mode per InitiativeLevel (mała vs duża)
- Status spec: review
- Priorytet: P0
- SSOT: `presentation-modes.md`, `initiative-sections.md` (UI standards)
- Target: R0

**Business challenge (problem):**  
Jedna “karta inicjatywy” dla wszystkiego nie działa. Quick win nie może wymagać 15 sekcji, a transformacja nie może być pusta.

**Cel (outcome):**  
InitiativeLevel steruje: widocznymi sekcjami, required polami, gates oraz completeness.

**Użytkownicy i scenariusze:**
- Quick win: w 10 min da się opisać i zaplanować bez “papierologii”.
- Transformation: ma komplet charter + governance + finanse + RAID + zespół.

**Zakres (IN/OUT):**
- IN:
  - 4 template’y sekcji: quick_win / standard / strategic / transformation
  - required sekcje/pola per etap statusu (np. PLANNING/SCHEDULED)
  - completeness score + missing items (w detail view)
- OUT:
  - marketplace template’ów i rozbudowane wersjonowanie (v4+)

**UX / UI notes:**
- Inicjatywa ma “level pill” widoczny w headerze.
- Level steruje: listą sekcji w NModeLeftNav + required sekcje/pola + “smart open”.
- Kompleteness jest widoczne w control/properties strip jako % + lista braków.

**Data / integrations:**
- Template = `visible_sections[]` + `required_fields[]` per etap/status.
- Backend liczy gate readiness i zwraca capabilities (co wolno edytować).

**AI behavior:**
- AI proponuje uzupełnienia sekcji i pól (propose→accept), np. charter, risks, KPI suggestions.

**Definition of Done (DoD):**
- quick_win ma maks. ~3–5 sekcji i nie pokazuje ciężkich governance elementów
- transformation ma pełny zestaw sekcji
- completeness działa i blokuje krytyczne przejścia statusu (gate readiness)

**Acceptance / test plan:**
- utworzenie initiative level quick_win → UI pokazuje krótką listę sekcji
- zmiana level na transformation → pojawiają się dodatkowe sekcje, a brakujące elementy są widoczne jako “missing”

**Dependencies:** V3-K01 (required/completeness)  
**Risks / go-live risk:** P0 — bez tego “duże inicjatywy” będą nieużywalne.  
**Analytics (events/metrics):**
- `initiative_level_changed`
- `initiative_section_completed` (sectionId)
- `initiative_completeness_viewed`
**Rollout plan:** R0: template per level + minimal required; R1: pełne completeness + AI assist.

#### V3-F02 — [Initiatives] Portfolio Analysis (Resources/Feasibility/Logic/Timeline/Completeness)
- Status spec: draft
- Priorytet: P1
- Target: R1
- SSOT: `OPERATING_MODEL_V3.md` (Initiatives Analysis), `view-modes-standard.md`

**Business challenge (problem):**  
Portfolio bez analizy = chaos (zasoby, logika, timeline, kompletność). Potrzebujemy narzędzia konsultingowego do “quality gate” planu.

**Cel (outcome):**  
Klik “Analysis” daje 5 sub‑widoków: Resources / Feasibility / Logic / Timeline / Completeness, które wykrywają problemy i prowadzą do naprawy.

**Użytkownicy i scenariusze:**
- PMO sprawdza kompletność portfela przed steering committee i widzi listę braków.
- Manager filtruje “overallocated resources” i otwiera inicjatywę do korekty.

**Zakres (IN/OUT):**
- IN:
  - 5 sub‑widoków + issues list + CTA “napraw”
  - minimum: wykrycie braków danych + podstawowe konflikty
- OUT:
  - optymalizacja matematyczna portfela (v4+)

**UX / UI notes:**
- “Analysis” jest osobnym przyciskiem/tabem w Initiatives hub.
- Sub‑widoki: Resources / Feasibility / Logic / Timeline / Completeness.
- Każdy sub‑widok ma: summary + issue list + “Open initiative” + (opcjonalnie) “Fix suggestions”.

**Data / integrations:**
- Minimalne dane do analizy: owner, start/end, dependencies, resource allocation, status.
- W v3 timeline dependencies mogą być tylko logiczne (bez critical path).

**AI behavior (opcjonalnie):**
- AI może proponować remediacje (np. “przesuń start”, “dodaj owner”), ale execution jest manual.

**Definition of Done (DoD):**
- każdy sub‑widok ma: summary + issues list + link do inicjatywy
- issues wynikają z danych i checklist, nie “opinii AI”

**Acceptance / test plan:**
- brak ownerów/daty → Completeness pokazuje listę braków
- konflikt dat (initiative starts before dependency) → Logic pokazuje konflikt

**Dependencies:** V3-F01  
**Risks:** P1 — bez tego trudno “sprzedać” profesjonalne portfolio, ale nie blokuje R0.
**Analytics (events/metrics):**
- `initiatives_analysis_opened` (subview)
- `initiatives_analysis_issue_opened`
**Rollout plan:** R1: 5 sub‑widoków + issues list; R2: lepsze heurystyki + AI remediacje.

---

### WS-G — Execution v3

#### V3-G01 — [Execution] Minimal execution surfaces + spójne statusy
- Status spec: draft
- Priorytet: P2
**Business challenge (problem):**  
Po go‑live inicjatywy muszą wejść w tryb realizacji — bez Execution nie ma jednego miejsca “kto/co/kiedy/ryzyka”.

**Cel (outcome):**  
Minimalny, spójny moduł do prowadzenia realizacji inicjatyw (bez rozbudowanego war-room), zgodny z view modes i statusami.

**Użytkownicy i scenariusze:**
- PMO/Manager: ogląda inicjatywy w realizacji w kanban/timeline.
- Owner: aktualizuje status i kluczowe ryzyka/blokery.

- Target: R2
- SSOT: `OPERATING_MODEL_V3.md`, `docs/product/EXECUTION_V3.md`

**Zakres (IN/OUT):**
- IN: minimalna kolekcja “Execution initiatives” + tasks/decisions + raportowanie stanu
- OUT: rozbudowane change management i “war room” (v4+)

**UX / UI notes:**
- Hub Execution: table/kanban/timeline (wg standardu), filtr “In execution”.
- Minimalny drill-down: otwarcie inicjatywy (N-mode) + szybkie status update.

**Data / integrations:**
- Execution to *view* na Initiatives + Tasks/Decisions; bez nowych, równoległych modeli danych.
- Statusy muszą być spójne z Initiatives (żeby nie powstał drugi “workflow”).

**AI behavior:** —

**Definition of Done (DoD):**
- Execution hub istnieje i pokazuje inicjatywy w realizacji
- user może zmienić status i dodać blocker/risk w inicjatywie
- widoki są zgodne z `view-modes-standard.md`

**Acceptance / test plan:**
- Dla 3 inicjatyw w realizacji: kanban i timeline renderują poprawnie, filtry działają.
- Zmiana statusu w Execution od razu widoczna w Initiatives i odwrotnie.

**Dependencies:** V3-F01  
**Risks / go-live risk:** niskie na R0; ważne dla późniejszej skali.
**Analytics (events/metrics):**
- `execution_hub_opened` (viewMode)
- `execution_status_updated` (initiativeId, from, to)
**Rollout plan:** R2 jako “operational add-on” po ustabilizowaniu Initiatives/Results.

---

### WS-H — Results (Rezultaty) v3

#### V3-H01 — [Results] KPI table jako core (agregacja + add + tracking)
- Status spec: review
- Priorytet: P0
- SSOT: `interactive-board-standard.md`, `app-table-standard.md`
**Business challenge:** “wdrożyliśmy” bez dowiezienia KPI to klasyczny consulting failure.  
**Cel:** KPI table jako dowód dowiezienia; agregacja KPI z inicjatyw + możliwość dodania globalnie.  
**DoD:** jedna tabela KPI; add KPI; time series; mapping KPI↔initiative; status “on target / below”.
- Target: R0

**Użytkownicy i scenariusze:**
- Owner inicjatywy definiuje KPI w Initiative → KPI pojawia się automatycznie w Results.
- PMO dodaje KPI globalnie i mapuje do inicjatyw.
- Co tydzień/miesiąc user wpisuje wartości (manual) i widzi trend.

**Zakres (IN/OUT):**
- IN:
  - tabela KPI zgodna ze standardem (filtry, kolumny, CTA)
  - Add KPI (globalnie) + Create KPI (z inicjatywy) + agregacja
  - time-series entry (manual) + aktualizacja current value
  - mapping KPI↔initiative (attribution)
- OUT:
  - automatyczne integracje danych KPI (v4+)

**UX / UI notes:**
- Nazwa modułu: **Rezultaty** (nie “Benefits” w user-facing copy).
- Tabela KPI zgodna z `App Table Standard` (filtry, resizable columns, topbar).
- CTA: “Dodaj miernik” (global KPI) + “Open initiative” z wiersza.
- KPI ma: baseline/target/current, unit, frequency, owner, data source, status (on-target/below).

**Data / integrations:**
- `initiative_kpis` (per initiative) + `kpi_time_series` + `initiative_kpi_mappings` (attribution) jako fundament.
- Agregacja: Results list = union (KPIs per initiative + global KPIs jeśli wprowadzimy).

**AI behavior (opcjonalnie):**
- AI może proponować KPI dla inicjatywy (z kontekstu initiative/tool), ale zapis jest zawsze manual/akceptowany.

**Definition of Done (DoD):**
- Jest jedna kanoniczna tabela KPI (Results) + możliwość wejścia w szczegół KPI (history).
- KPI z inicjatyw automatycznie pojawiają się w Results i mają mapping do inicjatywy.

**Acceptance / test plan:**
- KPI z inicjatywy jest widoczny w Results (agregacja)
- global KPI może być zmapowany do inicjatywy
- dodanie punktu time-series aktualizuje KPI current value

**Dependencies:** —  
**Risks / go-live risk:** P0 — to jest główny differentiator “dowozimy”.
**Analytics (events/metrics):**
- `results_kpi_created` (source=initiative|global)
- `results_kpi_value_recorded` (kpiId, period)
- `results_kpi_mapping_updated`
**Rollout plan:** R0: tabela + manual time series + mapping; R1: lepsze trendy/segmentacja + eksport do report/deck.

#### V3-H02 — [Results] ROI plan vs realized (tracking po wdrożeniu)
- Status spec: review
- Priorytet: P0
**Business challenge:** ROI bez rozdziału “plan vs wykonanie” jest marketingiem.  
**Cel:** realny tracking ROI w czasie.  
**DoD:** assumptions + realized; inicjatywy przechodzą do tracking; różnice są widoczne w UI.
- Target: R0
- SSOT: `FINANCIAL_ANALYSIS_V3.md`, `OPERATING_MODEL_V3.md`

**Zakres (IN/OUT):**
- IN: assumptions vs realized, frequency, owner, minimal UI do wpisu i porównania
- OUT: zaawansowane symulacje scenariuszy (osobny tor finansów)

**UX / UI notes:**
- ROI view ma 2 kolumny/serie: Plan (assumptions) vs Realized.
- Minimalny “data entry” dla realized (manual) + historia wpisów.

**Data / integrations:**
- Backend przechowuje assumptions i realized per initiative oraz per okres (np. miesiąc/kwartał).
- Powiązanie z Financial Analysis jest “traceable” (ale bez automatycznej synchronizacji w R0).

**AI behavior:** —

**Użytkownicy i scenariusze:**
- Owner inicjatywy wpisuje realized wartości cyklicznie i widzi odchylenie vs plan.
- PMO filtruje inicjatywy “below plan” i otwiera drill‑down.

**Definition of Done (DoD):**
- ROI ma assumptions (plan) + realized (actual) + widoczne odchylenie per okres.
- Da się pokazać 1 inicjatywę end‑to‑end bez arkuszy.

**Acceptance / test plan:**
- Dla 1 inicjatywy: wpis plan + 2 wpisy realized → UI pokazuje różnicę i trend.
- Dane są widoczne po refresh i w API.

**Dependencies:** V3-H01 (KPI/Results baseline)  
**Risks / go-live risk:** P0 — bez tego ROI jest “deklaracją”, nie trackingiem.  
**Analytics:** `results_roi_assumptions_updated`, `results_roi_realized_recorded`
**Rollout plan:** R0: manual entry + porównanie; R1: eksport do report/deck.

#### V3-H03 — [Results] Operational analysis + ROI analysis jako 2 surfaces
- Status spec: draft
- Priorytet: P1
**Business challenge (problem):**  
Jeśli KPI i ROI nie są rozdzielone, user nie rozumie czy patrzy na performance operacyjny czy realizację wartości finansowej.

**Cel (outcome):**  
Dwa jasne surfaces: `Operational` (KPI) i `ROI` (plan vs realized), oba z filtrami i drill‑down do inicjatyw.
- Target: R1

**Zakres (IN/OUT):**
- IN: dashboardy i widoki trendów + segmentacja (project/owner/category)
- OUT: zaawansowane modelowanie predykcyjne (v4+)

**Użytkownicy i scenariusze:**
- PMO wchodzi w Operational i segmentuje KPI po owner/project.
- Manager/CFO wchodzi w ROI i sprawdza inicjatywy z największym odchyleniem.

**UX / UI notes:**
- Dwa “surfaces” w Results: `Operational` i `ROI`.
- Każdy surface ma: filtry + drill-down + szybkie linki do inicjatyw.

**Data / integrations:**
- Operational korzysta z KPI time-series.
- ROI korzysta z assumptions/realized.

**AI behavior (opcjonalnie):**
- AI może proponować “insights” (np. anomalie), ale nie zmienia danych.

**Definition of Done (DoD):**
- Operational: trendy KPI + filtry + drill‑down.
- ROI: plan vs realized + lista inicjatyw z odchyleniami + drill‑down.

**Acceptance / test plan:**
- Zmiana filtrów zawęża KPI/ROI listy i grafy.
- Drill-down z KPI/ROI otwiera inicjatywę w dynamic menu.

**Dependencies:** V3-H01, V3-H02  
**Risks / go-live risk:** średnie — nie blokuje R0.
**Analytics:** `results_analysis_opened` (type=operational|roi)
**Rollout plan:** R1: minimalne dashboardy + drill-down; potem eksport i narracje.

---

### WS-I — Finance v3 (export to outputs)

#### V3-I01 — [Finance] Exportuj z Financial Analysis → Report / Presentation (traceable)
- Status spec: draft
- Priorytet: P1
- SSOT: `PRESENTATIONS_AND_REPORTS_V3.md`
**Business challenge:** analizy finansowe bez “wyjścia” do deliverables nie kończą pracy.  
**Cel:** 1 klik “Exportuj” z kontekstu finansów do report/deck.  
**DoD:** draft report/deck z traceability; template/no-template; metadane (kto/kiedy).
- Target: R1

**Zakres (IN/OUT):**
- IN: przycisk Export w panelu; creation draft report/deck; sourceArtifact=financial_analysis_run
- OUT: pełny “finance narrative engine” (osobny tor)

**UX / UI notes:**
- W prawym panelu (properties strip) przycisk **Exportuj** z wyborem:
  - `Report` (z template / bez template)
  - `Presentation` (z template / bez template)
- Po eksporcie user widzi toast + link `Open output`.
- Output ma sekcję “Source” (traceability) i akcję “Open source” wracającą do Financial Analysis.

**Data / integrations:**
- Każdy output ma `source_type=financial_analysis` + `source_id` (model/run) + `created_by`, `created_at`.
- Jeśli export dotyczy inicjatyw (impact tab), zachowujemy powiązania: output → (initiativeIds).

**AI behavior (opcjonalnie):**
- Generator może proponować narrację (executive summary) na bazie wyników, ale dane liczbowe są zawsze “zaciągnięte” z modelu.

**Użytkownicy i scenariusze:**
- Konsultant kończy Financial Analysis i generuje report dla klienta (template).
- Manager generuje deck “executive” (no template) i wysyła do steering.

**Definition of Done (DoD):**
- Export tworzy draft output (report/deck) z poprawnym `source_type/source_id` i linkiem “Open source”.
- Output zapisuje metadane (kto/kiedy, template yes/no).

**Acceptance / test plan:**
- Klik “Exportuj → Report (template)” tworzy draft report i ustawia źródło na financial analysis.
- Klik “Exportuj → Presentation (no template)” tworzy draft deck i ustawia źródło na financial analysis.
- “Open source” z outputu wraca do właściwego widoku finansów.

**Dependencies:** V3-J01 (jasne entry points report/deck), V3-E02 (outputs w Tools – opcjonalne, jeśli linkujemy)  
**Risks / go-live risk:** P1 — bez eksportu finanse są “martwym końcem” i nie produkują deliverables.  
**Analytics (events/metrics):**
- `finance_export_clicked` (type=report|deck, template=yes|no)
- `finance_export_created` (outputId)
**Rollout plan:** R1: sam export + traceability + open; potem dopiero predefiniowane finance templates.

---

### WS-J — Reports & Presentations v3

#### V3-J01 — [Reports] Ujednolicenie “report surfaces” (user rozumie co jest czym)
- Status spec: review
- Priorytet: P0
- SSOT: `REPORT_GENERATOR_V3.md`, `PRESENTATIONS_AND_REPORTS_V3.md`
**Business challenge:** kilka subsystemów raportów = user confusion + ryzyko sprzedażowe.  
**Cel:** jasna opowieść produktowa i UX entry points.  
**DoD:** user wie: gdzie generuje raport “deliverable” (Report Builder), gdzie ma PMO “management reports”, gdzie jest upload chaos.
- Target: R0

**Zakres (IN/OUT):**
- IN: copy + entry points + breadcrumbs; jasne nazwy “Builder” vs “Management”
- OUT: pełne scalenie subsystemów w jeden backend (v4+)

**UX / UI notes:**
- Zasada: **1 primary path** dla deliverables (Report Builder) + jawny “secondary path” dla PMO (Management Reports).
- Nazwy i copy muszą konsekwentnie mówić: “Deliverable report” vs “Management report”.
- Breadcrumbs i sidebar nie mogą prowadzić do dwóch “Reports” bez rozróżnienia.

**Data / integrations:**
- Nie zmieniamy backendów w R0 — porządkujemy entry points, routing i copy.

**AI behavior:** brak wymagania (AI jest w generatorach, nie w hubie).

**Użytkownicy i scenariusze:**
- User klika “Reports” i trafia do *jednego* kanonicznego entry pointu (Builder) z jasnym opisem.
- PMO klika “Management reports” (secondary) i rozumie, że to inne zastosowanie.

**Definition of Done (DoD):**
- UI ma jednoznaczne nazwy i entry points; user nie myli “management report” z deliverable.
- Breadcrumbs wszędzie pokazują `Reports > Builder` lub `Reports > Management`.

**Acceptance / test plan:**
- Z poziomu menu user trafia do właściwego entry pointu (builder vs management) i UI to komunikuje.
- Nie ma miejsca w UI, gdzie to są dwie identyczne etykiety “Reports” bez dopisku.

**Dependencies:** V3-A04 (spójne menu/routing), V3-E01 (Tools mental model wpływa na nazewnictwo outputs)  
**Risks / go-live risk:** P0 — bez tego klient zobaczy chaos i “brak produktu”.  
**Analytics (events/metrics):**
- `reports_entry_opened` (entry=builder|management)
- `reports_confusion_signal` (opcjonalne: klik back-and-forth między entry points)
**Rollout plan:** R0: copy + routing + breadcrumbs; R1: dopięcie outputs list (V3-E02) i biblioteki decków (V3-J02).

#### V3-J02 — [Presentations] Biblioteka decków (hub: table + cards + dynamic menu)
- Status spec: draft
- Priorytet: P1
- SSOT: `PRESENTATIONS_AND_REPORTS_V3.md`, `view-modes-standard.md`
**Business challenge:** prezentacje wyglądają jak jednorazowy eksport, jeśli nie ma biblioteki i historii.  
**Cel:** biblioteka decków jak dla raportów (table+cards).  
**DoD:** list + cards, filtry, open w dynamic menu, export history.
- Target: R1

**Zakres (IN/OUT):**
- IN:
  - hub “Presentations”: table view + cards view
  - filtry: source type (tool/assessment/finance/upload), owner, date
  - open w dynamic menu + minimal preview
  - akcje: rename, export (ponownie), open source
- OUT:
  - edytor decków “in-app” (v4+)

**UX / UI notes:**
- Table zgodna z `view-modes-standard.md` i `app-table-standard.md`.
- Cards: miniatura + tytuł + source badge + last export.
- Preview pane (opcjonalnie): ostatni eksport / cover.

**Data / integrations:**
- Deck ma: `id`, `title`, `created_at`, `created_by`, `source_type`, `source_id`, `last_export_at`, `export_formats[]`.

**AI behavior (opcjonalnie):**
- AI może proponować tytuł i opis decka przy tworzeniu.

**Użytkownicy i scenariusze:**
- Konsultant generuje deck z ToolSession i wraca do niego po tygodniu (biblioteka).
- Manager re-exportuje deck do PPTX i widzi historię eksportów.

**Definition of Done (DoD):**
- Biblioteka decków istnieje w 2 view modes (table+cards), ma filtry i open w dynamic menu.
- Deck ma traceability i akcję “Open source”.

**Acceptance / test plan:**
- Po wygenerowaniu deck pojawia się w bibliotece.
- Rename działa i jest odzwierciedlony w listach Tools outputs (jeśli linkowane).
- Re-export działa i aktualizuje `last_export_at`.

**Dependencies:** V3-J01 (entry points), V3-E02 (Tools outputs list), V3-I01 (Finance export – źródło decków)  
**Risks / go-live risk:** P1 — bez biblioteki decki “znikają” i produkt traci pamięć.  
**Analytics (events/metrics):**
- `presentations_hub_opened` (viewMode)
- `presentation_opened` (deckId, sourceType)
- `presentation_exported` (format)
**Rollout plan:** R1: biblioteka + open + export; R2: preview pane + lepsze filtry.

#### V3-J03 — [Generators] Upload chaos jako 3 ścieżka report/deck (MVP)
- Status spec: draft
- Priorytet: P2
**Business challenge (problem):**  
Klient często ma już dokumenty, a konsultant potrzebuje szybko zbudować draft deliverable na bazie uploadu — bez robienia wszystkiego od zera w narzędziach.

**Cel (outcome):**  
Trzeci tryb: wrzuć dokumenty → wygeneruj draft report/deck z traceability do upload bundle.

**Użytkownicy i scenariusze:**
- Konsultant wrzuca 1 PDF i generuje draft report do review.
- Konsultant wrzuca PDF+PPTX i generuje draft deck “exec”.

**Definition of Done (DoD):**
- Wizard: Upload → Context → Generate działa dla report i deck.
- Output ma widoczne źródła (upload bundle) i oznaczenie “draft requires review”.
- Target: R2

**Zakres (IN/OUT):**
- IN:
  - upload 1..N plików (PDF/DOCX/PPTX) do “generator wizard”
  - extraction: tekst + podstawowe metadane (tytuł, autor, data)
  - wybór output type: report/deck
  - minimal quality gates (np. “za mało tekstu”, “brak kontekstu organizacji”)
- OUT:
  - pełny “knowledge base” i automatyczne cytowania z OCR (v4+)

**UX / UI notes:**
- Wizard ma 3 kroki: Upload → Context → Generate.
- UI musi jasno powiedzieć, że to jest *pomoc* i wymaga review (compliance risk).

**Data / integrations:**
- Zapisujemy paczkę uploadów jako artefakt wejściowy (`source_type=upload_bundle`).
- Output ma traceability do upload bundle.

**AI behavior:**
- AI tworzy draft outline i streszczenie, ale musi oznaczać “pochodzenie” i ryzyko halucynacji.

**Acceptance / test plan:**
- 1 PDF + context pack → draft report.
- 2 pliki (PDF+PPTX) → draft deck z sekcją “Sources”.

**Dependencies:** V3-J01 (jasne generator entry points)  
**Risks / go-live risk:** P2 — ryzyko jakości i compliance, dlatego R2 i z wyraźnym oznaczeniem.  
**Analytics (events/metrics):**
- `upload_generator_started`
- `upload_generator_generated` (type=report|deck)
**Rollout plan:** R2: MVP upload + traceability + gates; później OCR i lepsze cytowania.

---

### WS-K — N‑mode management (required sections + AI assist)

#### V3-K01 — [N‑mode] Required sections/pola per etap + completeness + AI assist
- Status spec: draft
- Priorytet: P1
- SSOT: `presentation-modes.md`, `initiative-sections.md`, `building-blocks.md`
**Business challenge:** bez required/completeness N‑mode jest ładny, ale nie prowadzi do dowiezienia “gotowych” artefaktów.  
**Cel:** required sekcje/pola zależne od etapu + completeness + AI wspiera uzupełnianie.  
**DoD:** per typ artefaktu i per etap: required lista, completeness score, missing list; AI propose→accept + one-click fill dla braków (z możliwością odrzucenia).
- Target: R1

**Zakres (IN/OUT):**
- IN:
  - required sections/pola per typ (Initiative/Decision/Task/Notification) i per etap/status
  - completeness score + missing list w UI
  - AI propose→accept do uzupełnień (one-click fill)
- OUT:
  - pełna automatyczna edycja bez akceptacji usera

**Użytkownicy i scenariusze:**
- Owner inicjatywy widzi “missing items” i uzupełnia je ręcznie.
- Owner klika “AI propose fill” dla 1 brakującego pola i akceptuje/odrzuca.
- Manager (locked) widzi braki, ale nie może edytować — prosi ownera.

**Definition of Done (DoD):**
- Dla danego artefaktu i statusu system pokazuje: required items + missing list + completeness score.
- Gate readiness blokuje krytyczne przejścia statusu, jeśli braki są krytyczne.

**UX / UI notes:**
- NModeCanvas pokazuje “completeness pill” + klik otwiera listę braków.
- Missing list linkuje do konkretnego pola/sekcji i scrolluje do miejsca.
- W locked state user widzi braki, ale nie może edytować (copy: “Poproś ownera”).

**Data / integrations:**
- Konfiguracja required/completeness jako dane (json / config), nie hardcode per komponent.
- API: zwraca `required_items[]`, `missing_items[]`, `completeness_score`, `gate_readiness`.

**AI behavior:**
- AI proponuje uzupełnienia tylko dla missing items i zawsze w trybie propose→accept.
- AI używa źródeł: tool sessions, interview insights, notebook notes (jeśli istnieją) jako kontekst, ale nie nadpisuje bez zgody.

**Acceptance / test plan:**
- Inicjatywa w PLANNING pokazuje “missing 5 items”.
- Klik w missing item przenosi do właściwej sekcji.
- AI potrafi zaproponować uzupełnienie 1 missing item i user może accept/reject.

**Dependencies:** V3-F01 (initiative templates/levels), V3-A03 (AI actions + context, jeśli wykorzystujemy)  
**Risks / go-live risk:** P1 — bez required/completeness N‑mode nie dowozi jakości i jest “ładnym edytorem”.  
**Analytics (events/metrics):**
- `nmode_completeness_viewed`
- `nmode_missing_item_clicked`
- `nmode_ai_fill_proposed` / `nmode_ai_fill_accepted` / `nmode_ai_fill_rejected`
**Rollout plan:** R1: required + missing list + manual fixes; potem AI assist i gate readiness.

---

### WS-L — V4 placeholders (Coming soon)

#### V3-L01 — [V4] MCP IRIS + MCP Marketplace w menu jako “Coming soon”
- Status spec: draft
- Priorytet: P2
- Target: R2

**Business challenge (problem):**  
Chcemy komunikować roadmapę V4 bez ryzyka obietnic w V3 i bez rozpraszania użytkownika w go‑live.

**Cel (outcome):**  
Użytkownik widzi w menu “MCP IRIS” i “MCP Marketplace” jako jasne placeholdery V4 (“Coming soon”), bez wpływu na flow V3.

**Użytkownicy i scenariusze:**
- User widzi nowe pozycje, klika z ciekawości i dostaje krótki, spójny ekran informacji.
- Admin pyta “kiedy” — ekran nie zawiera dat ani obietnic.

**Zakres (IN/OUT):**
- IN:
  - 2 pozycje menu + badge “Coming soon”
  - ekran placeholder z opisem (3 bullet points) i bez CTA
- OUT:
  - jakakolwiek funkcjonalność MCP w V3

**AI behavior:** —

**Definition of Done (DoD):**
- 2 pozycje w menu + spójny ekran “Coming soon” (bez obietnic v3).

**UX / UI notes:**
- Menu item ma badge “Coming soon”.
- Klik otwiera prosty ekran: “MCP IRIS / Marketplace — Coming soon (V4)”, 3 bullet points “co to da” bez dat.
- Brak CTA typu “join waitlist” (żeby nie psuć go-live v3).

**Data / integrations:** brak (statyczny placeholder).

**Acceptance / test plan:**
- Menu pokazuje MCP IRIS + MCP Marketplace.
- Ekran coming soon jest spójny wizualnie z resztą shell/hub.

**Dependencies:** V3-A04 (menu config / routing)  
**Risks:** niskie — kosmetyka.  
**Analytics:** `coming_soon_opened` (module=iris|marketplace)
**Rollout plan:** R2 (po go-live v3), żeby nie rozpraszać.

---

## 8) Ryzyka programu (go‑live)

Lista ryzyk (do utrzymania jako “risk register”):

1. **Rozjazd mental model Tools** (Discovery vs Licensed) → user confusion.
2. **Raporty w 3+ subsystemach** → brak jasnej historii “co jest deliverable”.
3. **Traceability bypass** (MyWork→initiative) → governance break.
4. **Brak biblioteki decków** → prezentacje wyglądają jak “jednorazowy eksport”.
5. **N‑mode bez required/completeness** → chaos w dużych inicjatywach.

Mitigacje: taski P0/P1 powyżej.

---

## 9) Definition of Done (program-level)

V3 jest “done” na poziomie programu, gdy:

- P0 taski są `implemented` + smoke verified,
- traceability działa end‑to‑end (Tools/Assessments/MyWork → outputs),
- user może wygenerować raport/deck z kontekstu narzędzia lub z generatora,
- Initiatives mają template-driven sekcje i minimum governance,
- Results pokazuje KPI/ROI tracking jako dowód “dowozimy po wdrożeniu”,
- UI/UX jest spójne z `docs/ui-standards/` w krytycznych hubach.
