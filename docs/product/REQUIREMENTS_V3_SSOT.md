# Consultinity MVP — Requirements v3 (SSOT)

> **Status:** Draft (v3)  
> **Cel:** Jedna, kanoniczna checklista wymagań v3 (produkt + UX + cross‑cutting), z linkami do SSOT‑ów szczegółowych.  
> Ten dokument jest “spisem wymagań”, a nie planem implementacji.

---

## 0) Zakres v3 (kontrakt)

### 0.1 North star

v3 ma być “ultimate MVP” gotowe do pracy z pierwszym klientem: spójne UI/UX, kompletne flow, stabilne artefakty i traceability.

### 0.2 SSOT – kluczowe dokumenty

- **System axis / artefakty**: `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- **Operating model v3**: `docs/product/OPERATING_MODEL_V3.md`
- **Tools catalog v3**: `docs/product/TOOLS_CATALOG_V3.md`
- **Interview Form Engine v3**: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- **Notebook v3**: `docs/product/NOTEBOOK_V3.md`
- **Link graph v3 (embedded refs + used-in)**: `docs/product/LINK_GRAPH_V3.md`
- **UI/UX canon v3**: `docs/ui-standards/UI_UX_CANON_V3.md`
- **App topbar**: `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
- **Module hub**: `docs/ui-standards/03-modules/module-hub-standard.md`
- **View modes**: `docs/ui-standards/03-modules/view-modes-standard.md`
- **App table**: `docs/ui-standards/03-modules/app-table-standard.md`
- **Table + preview pane**: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Artifact identity**: `docs/ui-standards/00-foundation/artifact-identity-map.md`
- **Workspace 3‑tools strip**: `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- **Interactive boards**: `docs/ui-standards/03-modules/interactive-board-standard.md`
- **Financial Analysis v3**: `docs/product/FINANCIAL_ANALYSIS_V3.md`
- **Reports & Presentations v3**: `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- **Report Generator v3 (SSOT)**: `docs/product/REPORT_GENERATOR_V3.md` — kanoniczne R1–R4, wizard/builder, templates, AI narrative, export quality gate
- **Presentation Generator v3 (SSOT)**: `docs/product/PRESENTATION_GENERATOR_V3.md` — kompletny flow, model danych, AI agent, template system, media library, eksport, learning
- **Meeting tool v3**: `docs/product/MEETING_TOOL_V3.md`

---

## 1) Wymagania produktu (flow)

### 1.1 System axis (non‑negotiable)

- Centralny obiekt: **Initiative** (1 obiekt = 1 lifecycle).
- Dwa źródła inicjatyw: **Tools** i **Assessments**.
- **Insights** pochodzą z Interview i są tylko kontekstem.

SSOT: `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`

### 1.2 Moduły i kolejność flow (v3)

Kanon flow:

- Chat → MyWork → Interview → Tools → Initiatives → Execution → Realization/Benefits → Financial Analysis → Reports & Presentations

SSOT: `docs/product/OPERATING_MODEL_V3.md`

### 1.3 Role visibility

- MyWork: start zależny od roli (Executive vs Focus).
- Interview: Manager/Owner widzi pełny obraz; Respondent widzi Inbox/Assignments.
- Uprawnienia i “capabilities” liczone z backendu jako effective roles.

SSOT: `docs/product/OPERATING_MODEL_V3.md`, `docs/product/ROLES_MODEL.md`

---

## 2) Wymagania “Tools” (scalenie + mental model)

### 2.1 Scalenie Discovery Tools i Licensed Tools

W v3 UI/UX ma mieć jeden mental model:

**Library → Sessions → Reports → Presentations → Initiatives**

SSOT: `docs/product/OPERATING_MODEL_V3.md`, `docs/product/TOOLS_CATALOG_V3.md`

### 2.2 Traceability outputów

- Każdy output (report/presentation/initiative) musi mieć wskazane źródło: **ToolSession / AssessmentReport**.
- MyWork (Idea/Notebook) może być **punktem startowym** (seed), ale jeśli kończy się outputem “projektowym” (initiative/report/presentation),
  system tworzy **MyWork ToolSession** (typ `MYWORK`) i to on jest kanonicznym źródłem traceability (żeby nie łamać zasady “2 sources”).
- Outputy powstałe z MyWork (np. z Idei) muszą być widoczne także w Tools (biblioteki outputów) — jako elementy output packages powiązane ze swoim ToolSession.

SSOT: `docs/product/OPERATING_MODEL_V3.md`

### 2.3 Notebook jako “kontekst systemu” (MUST)

- Notebook jest źródłem kontekstu i punktem startowym do tworzenia artefaktów (create-from-note).
- Notebook musi wspierać embedded references (chip → expand preview) oraz platform‑wide backlinks (“Used in”).
- Live metadata jest zawsze aktualizowane; live content jest opcjonalne (MVP selector: nagłówki).

SSOT: `docs/product/NOTEBOOK_V3.md`, `docs/product/LINK_GRAPH_V3.md`

### 2.4 Workspace jako “silnik wizualny” (MUST)

- Workspace to kontekstowy, wielotrybowy silnik pracy wizualnej (infinite canvas) wywoływany z obiektów nadrzędnych (Initiative/Report/Assessment/Note/Tools).
- Jeden silnik wspiera tryby (MindMap/Whiteboard/Flowchart/ProcessFlow/VSM/Templates) bez resetowania danych przy zmianie trybu.
- Workspace ma własne ID i jawne relacje many-to-many do obiektów nadrzędnych; backlinks są platform-wide.
- Elementy z canvas mogą być konwertowane do Initiative/Task/Decision/Note z relacją `derived_from`.
- Workspace korzysta z kanonicznego “3‑tools strip” oraz z kontraktu linkowania/backlinków (embedded refs + Used in).
- Workspace ma dwa źródła życia:
  - **personal clean canvas** w MyWork/Ideas (prywatny do czasu powiązania z artefaktami),
  - **tool-linked workspace** (uruchamiany przez konkretny tool/template; lifecycle “tied to tool”).

SSOT (produkt): `docs/product/TOOLS_CATALOG_V3.md` (sekcja 3.2 “WORKSPACE v3 — SSOT”)  
SSOT (linkowanie/backlinks): `docs/product/LINK_GRAPH_V3.md`

---

## 3) Financial Analysis (v3)

### 3.1 5 zakładek (MUST)

- Modelowanie finansowe (P&L / Balance Sheet / Cash Flow)
- Analiza finansowa (biblioteka analiz)
- Predykcje / scenariusze (założenia, porównania)
- Wycena
- CAPEX / inwestycje

SSOT: `docs/product/FINANCIAL_ANALYSIS_V3.md`

### 3.2 Interactive boards (MUST)

Financial Analysis i Benefits/KPI wymagają “interaktywnych tablic” (konfiguracja kolumn/sekcji + linkowanie).

SSOT: `docs/ui-standards/03-modules/interactive-board-standard.md`

---

## 4) Reports & Presentations (v3)

### 4.1 Biblioteki + generatory (MUST)

- Library: list + cards (karty jako okładki)
- Generator: szybki start, content-first, “Gamma-like UX”
- AI: propose → accept/reject (nie nadpisuje)
- Traceability: skąd pochodzi blok/sekcja/slajd

SSOT: `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`

### 4.2 Export quality gate

SSOT: `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

---

## 5) Meeting tool (v3) — planned

Meeting jako narzędzie pracy (event + agenda + pre‑read + decyzje + taski + follow‑ups).

SSOT: `docs/product/MEETING_TOOL_V3.md`

---

## 6) UI/UX v3 (globalny kanon)

### 6.1 Light mode readability (MUST)

- Layer 1 = `bg-slate-50`, Layer 2 = `bg-white`
- tekst główny: `text-slate-900` / `text-navy-900`
- zakaz: jasne tło semantyczne + jasny tekst tego samego koloru

SSOT: `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/ui-standards/00-foundation/visual-language.md`

### 6.2 Rounding system (MUST)

- używamy `rounded-hig-*` tokenów, sterowanych globalnie

SSOT: `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/ui-standards/00-foundation/visual-language.md`

### 6.3 Artifact identity (MUST)

- 1 artefakt = 1 ikona + 1 akcent
- chrome (nav/topbar) monochromatyczny; akcent jako sygnał danych

SSOT: `docs/ui-standards/00-foundation/artifact-identity-map.md`

### 6.4 Breadcrumbs (MUST)

- `Module > Surface/Tool` (bez “Dashboard …” clutter)

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

### 6.5 Dwa topbary (MUST)

- App Topbar (globalny) ≠ Module Topbar (kontekstowy)
- App Topbar kolejność: **Data → Model → Inbox → Tasks(Today) → User**
- brak globalnego AI toggle; AI działa w module przez “AI context”

SSOT: `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`

### 6.6 Module Topbar kolejność (MUST)

Prawa strona: **AI context → +New → View modes → Filters**

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

### 6.7 View modes (MUST)

Kanon trybów: `table / grid(cards) / kanban / timeline / calendar / matrix`.

SSOT: `docs/ui-standards/03-modules/view-modes-standard.md`

### 6.8 Tables (MUST)

Jedna “golden table” w całej aplikacji (typografia, filtry, resizable columns, topbar `h-9`).

SSOT: `docs/ui-standards/03-modules/app-table-standard.md`

### 6.9 Table + Preview pane (SHOULD; MUST dla Inbox/Tasks/Initiatives gdzie ma sens)

Preview jako część surface’u (rounded card, spójne warstwy), “Outlook style”.

SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`

### 6.10 Workspace “3‑tools strip” (MUST dla workspace’ów)

Jedna kontrolka: Tools / Context‑Links / AI Suggestions.

SSOT: `docs/ui-standards/02-components/workspace-3-tools-strip.md`

---

## 7) AI (v3) — zasady działania

### 7.1 AI w kontekście (MUST)

- jeden kanoniczny przycisk w Module Topbar
- otwiera split chat i ładuje kontekst ekranu/artefaktu

SSOT: `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/ui-standards/03-modules/module-hub-standard.md`, `docs/ui-standards/00-foundation/artifact-identity-map.md`

### 7.2 AI jako propozycje (MUST)

- tryb: propose → accept/reject
- AI nigdy nie “przejmuje kontroli” i nie nadpisuje bez zgody

SSOT: `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`, `docs/product/TOOLS_CATALOG_V3.md`

---

## 8) Out of scope v3

- MCP analiza operacyjna
- MCP analiza automatyzacji

SSOT: `docs/product/OPERATING_MODEL_V3.md`

