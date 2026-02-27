# Tools Catalog v3 (SSOT)

> **Status:** Draft (v3 kick-off)  
> **Cel:** Kanoniczny katalog narzędzi + ich standardy UI + powiązanie z artefaktami i output packages.  
> **Powiązane SSOT:**
> - Operating model: `docs/product/OPERATING_MODEL_V3.md`
> - System axis: `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
> - Workspace tools standard: `docs/ui-standards/README.md` (sekcja Workspace) + `src/components/shared/WorkspaceTools.tsx`
> - Module hub standard: `docs/ui-standards/03-modules/module-hub-standard.md`
> - View modes standard: `docs/ui-standards/03-modules/view-modes-standard.md`

## 1) Definicje

### 1.1 “Tool” (narzędzie)

Tool = powtarzalna metoda pracy, która:

- zbiera dane (inputs)
- prowadzi użytkownika przez strukturę (UX)
- generuje output (artefakt / pakiet wynikowy)
- może tworzyć inicjatywy (directly lub przez raport/presentację)

### 1.2 Tool surfaces (typy UI)

Każde narzędzie musi zadeklarować swój “surface type”:

1. **Module Hub** (kolekcje + view modes + dynamic tabs)
2. **Artifact Detail (N-mode / document view)** (np. ToolDocumentView, InsightViewer)
3. **Workspace** (canvas/editor + ToolsPanel po prawej)
4. **Wizard** (kroki + generowanie + export)

## 2) Kanoniczny obszar “Tools” w aplikacji (v3)

W v3 obszar Tools scala:

- consulting tools (Discovery Tools)
- licensed tools (Assessments)

W UI jest to jeden mental model: **Library → Sessions → Outputs → Initiatives**.

### 2.1 Zakładki Tools (kanon)

- **Library**
- **Sessions**
- **Reports**
- **Presentations**
- **Initiatives**

## 3) Narzędzia — stan as-is vs v3

Poniżej mapujemy Twoją listę (z mapy) na aktualny kod i to-be v3.

### 3.1 Notatnik (Living Notebook)

- **Surface type:** Workspace
- **SSOT komponenty:** `src/components/MyWork/NotebookContent.tsx`, `src/components/MyWork/notebook/AIChatInlinePanel.tsx`
- **SSOT (produkt):** `docs/product/NOTEBOOK_V3.md`
- **SSOT (linkowanie/backlinks):** `docs/product/LINK_GRAPH_V3.md`
- **Artefakty:** `NotebookPage`
- **Wyjścia (convert-to):**
  - Initiative / Task / Decision / Idea
  - oraz generatory: Assessment questions / Report outline / Presentation outline (przez AI kickoff)

### 3.2 Workspace (whiteboard / mind map / diagrams)

> **WORKSPACE v3 — SSOT (FINAL DEFINICJA)**
>
> Workspace to **kontekstowy, wielotrybowy silnik wizualnej pracy** (infinite canvas), wywoływany wewnątrz systemu.
> Nie jest osobnym produktem ani repozytorium logiki biznesowej — służy do modelowania/strukturyzacji i generowania obiektów systemowych.
>
> **Kanon UX:** zachowujemy obecny wygląd (“Miro na sterydach”) jako bazę i rozwijamy narzędzie + panel narzędzi analogicznie jak w Notebooku.
>
> **Kontekstowe wywoływanie (MUST):**
> - Workspace nie startuje jako osobna aplikacja.
> - Jest wywoływany z: Initiative / Report / Assessment / Note / narzędzi strategicznych / narzędzi operacyjnych.
> - Zawsze działa w kontekście nadrzędnego obiektu.
>
> **Dwa “źródła życia” (Kanon v3):**
>
> 1. **Personal workspace (My Work > Ideas)** — “clean canvas”
>    - start = puste środowisko do “malowania” (bez template)
>    - jeśli user zapisze workspace, jest on **prywatny** i dostępny tylko dla użytkownika
>    - dopóki nie zostanie połączony z innym artefaktem (decision/task/report/…), pozostaje wyłącznie w dyspozycji użytkownika
>    - może zostać później podlinkowany do innych artefaktów (wtedy wchodzi do platform‑wide backlinks).
>
> 2. **Tool‑linked workspace (Templates / narzędzia)** — “workspace narzędziowy”
>    - workspace jest zawsze tworzony/uruchamiany przez konkretny tool (np. consulting template, flow analysis, VSM)
>    - ma **stałe powiązanie** z tym narzędziem (parent artefakt / session)
>    - gdy tool/session jest usunięty → workspace jest usuwany razem z nim (lifecycle “tied to tool”).
>    - tryb + layout + aktywne pola są narzucane przez standard danego toola (opisujemy w specach narzędzi).
>
> **Jeden silnik, wiele trybów (MUST):**
> - Jeden infinite canvas.
> - Tryb pracy wybierany lub narzucony przez kontekst.
> - Zmiana trybu **zmienia zestaw tooli**, ale **nie resetuje danych**.
>
> **Tryby (v3):**
> 1. **MindMap** — My Work + praca koncepcyjna  
>    Tools: node/child, collapse/expand, drag&drop, cross-links, convert node → Initiative/Task/Decision/Note.
> 2. **Whiteboard** — burza mózgów / warsztat  
>    Tools: sticky notes, shapes, arrows, frames, grouping, snap to grid.
> 3. **Flowchart** — automatyzacja / logika  
>    Tools: process/decision/start-end, connectors, swimlanes, flow validation.
> 4. **Process Flow (ops)** — analiza procesów  
>    Tools: swimlanes, activity, gateway, time field, cost field, KPI marker.
> 5. **VSM** — value stream mapping  
>    Tools: process box, inventory, data box (CT/LT/uptime), material flow, timeline, VA/NVA calc.
> 6. **Consulting Templates** — SWOT/5 Forces/7S/Canvas itd.  
>    **Kanon v3:** template’y strategiczne/operacyjne są budowane na silniku Workspace. Nie budujemy osobnych edytorów.
>
>    **Kanon v3 (SSOT wdrożeniowy):** pełna biblioteka „classic frameworks” (Strategia/Operacje/Transformacja — 60 narzędzi) oraz ich kontrakt implementacji w Consultify jest opisana w:
>    - `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`
>    - oraz merytorycznie w `wdrozenia/modules/tools/catalog/{strategy,operations,transformation}/`
>
> **Integracja z biblioteką narzędzi (MUST):**
> - user wybiera tool w Library → system tworzy nadrzędny obiekt (ToolSession/Assessment/…) → ładuje Workspace z template’em.
>
> **Obiektowość i relacje (MUST):**
> - Każdy Workspace ma własne ID.
> - Workspace ma jawne relacje many-to-many do: Initiative/Report/Assessment/Note/ToolSession (w zależności od kontekstu).
> - Backlinks są platform-wide.
>
> **Create from canvas (MUST):**
> - Element na planszy może zostać: Initiative / Task / Decision / Note.
> - System zapisuje relację `derived_from` i nie duplikuje treści bez potrzeby (preferuje ref/link + seed content).
>
> **Backlinks (MUST):**
> - Każdy obiekt pokazuje: powiązane Workspaces, obiekty utworzone z Workspace, obiekty wykorzystujące Workspace.
>
> **Panel narzędzi (MUST):**
> - Workspace korzysta z kanonicznego “3‑tools strip”: Tools / Context‑Links / AI Suggestions.
> - Context‑Links obejmuje embedded references + platform-wide “Used in”.
>
> **SSOT cross-cutting:** `docs/product/LINK_GRAPH_V3.md` (embedded references + backlinks).

#### 3.2.1 MindMap — “My Ideas map”

- **Surface type:** Workspace (canvas)
- **SSOT komponenty:** `src/components/MyWork/IdeasMindMap.tsx`
- **Artefakty:** `MyIdea` + edges (powiązania)

#### 3.2.2 Idea Workspace — Recommendation Map

- **Surface type:** Workspace
- **SSOT komponenty:** `src/components/MyWork/IdeaMapWorkspace.tsx`, `IdeaWorkspaceTools.tsx`, `IdeaRecommendationMap.tsx`
- **Kluczowe reguły v3:**
  - `locked` (AI i zapis mapy zablokowane do momentu “Accept challenge”)
  - AI działa w trybie *propose → accept/reject*

### 3.3 Ankieta (Survey)

- **Surface type:** Wizard (shell) + modułowe workspace’y
- **SSOT komponent:** `src/components/Survey/SurveyShell.tsx`
- **Zastosowanie v3:** Interview (respondent flow), Assessments (frameworks)

### 3.4 Model finansowy / analiza finansowa

- **Surface type:** Module Hub + Wizard/Workspace (docelowo)
- **As-is:** Economics module istnieje (API + flow w `docs/modules/ECONOMICS_MODULE.md`)
- **To-be v3:** 5 zakładek Financial Analysis (model → analysis → forecasts → valuation → capex)
- **SSOT (szczegół):** `docs/product/FINANCIAL_ANALYSIS_V3.md`

### 3.5 Interaktywna tabela

- **Surface type:** Module Hub (table as primary)
- **SSOT standard:** `docs/ui-standards/03-modules/app-table-standard.md`
- **Zasada v3:** wszędzie “ta sama tabela” (typografia, filtry, resizable columns, akcje, status semantyka)

### 3.6 Prezentacje (generator)

- **Surface type:** Wizard
- **SSOT komponent:** `src/components/Presentations/PresentationWizard.tsx`
- **Artefakt:** Deck (pptx export)
- **SSOT (produkt/UX):** `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`

### 3.7 Raporty (generator + management)

- **Surface type:** Module Hub + Wizard/Editor
- **As-is (V2):** równoległe podsystemy raportów (ważne dla spójnej dokumentacji):
  - **Report Builder (deliverable builder)**: `src/views/ReportBuilderView.tsx` (+ backend `server/src/routes/report-builder.routes.ts`)
  - **Management Reports (PMO hub)**: `src/components/Reports/Management/ReportsHub.tsx`
  - **Generic reports upload (PDF-first, feature-gated)**: `server/src/routes/generic-reports.routes.ts`
  - **Legacy public snapshot reports (/api/reports/*)**: `server/src/routes/reports-generation.routes.ts`, `src/views/reports/PublicReportView.tsx`
- **SSOT (produkt/UX):**
  - `docs/product/PRESENTATIONS_AND_REPORTS_V3.md` (hub + gamma-like UX)
  - `docs/product/REPORT_GENERATOR_V3.md` (P0: end-to-end report generator + as-is subsystems + target v3)

### 3.8 Spotkanie (Meeting)

- **Status:** planned (v3+)
- **Uwaga:** istnieją raporty typu “Team Meeting” (Management Reports), ale brak kanonicznego artefaktu “Meeting” jako narzędzia pracy.
- **SSOT (produkt):** `docs/product/MEETING_TOOL_V3.md`

## 4) Zasady standaryzacji (v3)

1. **Jedno źródło UI standardów**: `docs/ui-standards/` (nie duplikujemy reguł).
2. **View modes są globalne**: `table/cards/kanban/timeline/calendar/matrix` zgodnie z `view-modes-standard.md`.
3. **Workspace tools panel**: wspólny shell (`WorkspaceTools`) + sekcje shared + sekcje per-workspace.
4. **Konwersje muszą być spójne**: “Create from … / Convert to …” zawsze w panelu narzędzi lub w kanonicznym miejscu na ekranie.

