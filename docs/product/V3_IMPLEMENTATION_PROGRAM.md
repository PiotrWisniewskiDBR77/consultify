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
- Source traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- Reports & Presentations (hub UX): `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- Report Generator: `docs/product/REPORT_GENERATOR_V3.md`
- Presentation Generator: `docs/product/PRESENTATION_GENERATOR_V3.md`
- Interview Form Engine: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- Financial Analysis: `docs/product/FINANCIAL_ANALYSIS_V3.md`

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

**Target release (per task):**
- `R0` — Go‑live MVP (must)
- `R1` — Full v3 hardening
- `R2` — Polish + content completeness

### 2.2 Program-level gates (merge / go‑live)

**Gate R0 (Go‑live):**
- traceability działa end‑to‑end (Tools/Assessments/MyWork → outputs)
- generatory: min. 1 ścieżka report + 1 ścieżka deck
- Initiatives: template-driven (mała vs duża) + minimum governance
- Results: KPI/ROI tracking jako dowód “dowozimy po wdrożeniu”
- brak “orphan views” (dynamic menu)

### 2.3 Postęp (do uzupełnienia podczas realizacji)

> Wypełniamy ręcznie. Docelowo można to zautomatyzować w v4 (integracja z issue trackerem).

| Workstream | R0 scope | Spec (locked/total) | Impl (done/total) | Blockers | Owner |
| --- | --- | --- | --- | --- | --- |
| WS-A Platform | ✅ | 0/4 | 0/4 | — | Piotr |
| WS-B Chat | ✅ | 0/2 | 0/2 | — | Piotr |
| WS-C MyWork | ✅ | 0/3 | 0/3 | — | Piotr |
| WS-D Interview | ◻︎ | 0/2 | 0/2 | — | Piotr |
| WS-E Tools | ✅ | 0/2 | 0/2 | — | Piotr |
| WS-F Initiatives | ✅ | 0/2 | 0/2 | — | Piotr |
| WS-G Execution | ◻︎ | 0/1 | 0/1 | — | Piotr |
| WS-H Results | ✅ | 0/3 | 0/3 | — | Piotr |
| WS-I Finance export | ◻︎ | 0/1 | 0/1 | — | Piotr |
| WS-J Reports+Presentations | ✅ | 0/3 | 0/3 | — | Piotr |
| WS-K N‑mode management | ◻︎ | 0/1 | 0/1 | — | Piotr |
| WS-L V4 placeholders | ◻︎ | 0/1 | 0/1 | — | Piotr |

### 2.4 Weekly review (rytuał)

- **Scope sanity**: czy R0 nadal jest minimalne i spójne?
- **Top 3 blokery**: co blokuje R0?
- **Risk register**: czy ryzyka się materializują?
- **UX audit**: czy trzymamy `docs/ui-standards/`?

---

### 2.5 Current blockers (aktualny rejestr)

> Wypełniamy na bieżąco. “Blocker” = rzecz, która blokuje zamknięcie R0 (go‑live).

| Date | Blocker | Blocks tasks | Owner | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

### 2.6 Progress log (dziennik realizacji)

> Krótki log “co dowieźliśmy” + link do PR/commit lub notatki. 1 wpis dziennie.

| Date | Done | Notes / link |
| --- | --- | --- |
| — | — | — |

---

### 2.5 R0 Cutline (Go‑live MVP) — lista kontrolna

> R0 = minimalny zestaw, który musi być “dowieziony i spójny” na demo/go‑live.
> Jeśli coś nowego wchodzi do R0 — musi mieć usunięty inny element (R0 budget).

**R0 tasks (must):**
- V3-A01, V3-A02, V3-A04
- V3-B01
- V3-C02, V3-C03
- V3-E01
- V3-F01
- V3-H01, V3-H02
- V3-J01

**R0 demo acceptance (skrót):**
- da się przejść z Chat do konkretnego artefaktu w dynamic menu (min: initiative + report builder)
- idea/notatka z MyWork nie tworzy inicjatywy “znikąd” (materializacja MYWORK ToolSession)
- Tools/Assessments generują inicjatywy z prawidłowym źródłem
- Results pokazuje KPI/ROI tracking jako “dowozimy po wdrożeniu”
- Reports: 1 kanoniczny generator + share/export działa w praktyce

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

| ID | Title | Priority | Target | Spec | Impl | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| V3-A01 | Traceability enforcement (MyWork → ToolSession → outputs) | P0 | R0 | review | todo | V3-C03 |
| V3-A02 | Dynamic menu everywhere (hub → openDocuments → detail) | P0 | R0 | review | todo | — |
| V3-A03 | UI standards compliance sweep (ModuleHub + tables + preview + D/N/C) | P1 | R1 | draft | todo | V3-A02 |
| V3-A04 | Route + menu coherence (Tools/Reports/Presentations naming + entry points) | P0 | R0 | draft | todo | V3-J01 |
| V3-B01 | Chat router pracy (mechaniczne transfery) | P0 | R0 | review | todo | V3-A02 |
| V3-B02 | Ujednolicenie action model (brak martwych typów) | P1 | R1 | draft | todo | V3-B01 |
| V3-C01 | MyWork Inbox: preview pane contract (Outlook-style) | P1 | R1 | draft | todo | — |
| V3-C02 | MyWork conversions: Convert to… zawsze traceable | P0 | R0 | review | todo | V3-A01 |
| V3-C03 | MyWork ToolSession materialization (type=MYWORK) | P0 | R0 | draft | todo | V3-A01 |
| V3-D01 | Interview: sufficiency contract + send-back clarity | P1 | R1 | draft | todo | — |
| V3-D02 | Interview: runtime mode decision (one question vs task-list) | P1 | R1 | draft | todo | — |
| V3-E01 | Tools: jeden mental model (Library→Sessions→Outputs→Initiatives) | P0 | R0 | review | todo | — |
| V3-E02 | Tools hub outputs: Reports+Presentations+Initiatives as artifacts | P1 | R1 | draft | todo | V3-E01 |
| V3-F01 | Initiatives: template-driven N-mode per InitiativeLevel | P0 | R0 | review | todo | V3-K01 |
| V3-F02 | Initiatives: Portfolio Analysis (Resources/Feasibility/Logic/Timeline/Completeness) | P1 | R1 | draft | todo | V3-F01 |
| V3-G01 | Execution: minimal surfaces + spójne statusy | P2 | R2 | draft | todo | V3-F01 |
| V3-H01 | Results: KPI table core (agregacja+add+tracking) | P0 | R0 | review | todo | — |
| V3-H02 | Results: ROI plan vs realized (tracking po wdrożeniu) | P0 | R0 | review | todo | V3-H01 |
| V3-H03 | Results: Operational analysis + ROI analysis views | P1 | R1 | draft | todo | V3-H01 |
| V3-I01 | Finance: Exportuj → Report/Presentation (traceable) | P1 | R1 | draft | todo | V3-J01 |
| V3-J01 | Reports: ujednolicenie report surfaces (user rozumie co jest czym) | P0 | R0 | review | todo | V3-A04 |
| V3-J02 | Presentations: biblioteka decków (hub table+cards) | P1 | R1 | draft | todo | V3-A02 |
| V3-J03 | Generators: upload chaos jako 3 ścieżka report/deck | P2 | R2 | draft | todo | V3-J01 |
| V3-K01 | N-mode: required sections/pola + completeness + AI assist | P1 | R1 | draft | todo | — |
| V3-L01 | V4: MCP IRIS + Marketplace w menu (Coming soon) | P2 | R2 | draft | todo | — |

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
- detail views: spójny header + tryby D/N/C tam gdzie to kanon

**Acceptance / test plan:**
- manual smoke: Tools/Initiatives/Reports/Results (table + grid) w dark/light mode
- preview pane: wybór wiersza ≠ nawigacja do detail; Enter/double-click = open full

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
- SSOT: `OPERATING_MODEL_V3.md`

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

