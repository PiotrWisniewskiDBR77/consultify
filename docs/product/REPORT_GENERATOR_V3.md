# Report Generator v3 — SSOT (Sponsor‑ready reports)

> **SUPERSEDED for Document runtime doctrine.** Document runtime, document templates, narrative planning, formatting and style governance, AI document editing semantics and document QA contract now live in `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`. R1–R4 reports remain a `report` family inside Document Studio's Template Registry and continue to honor `docs/product/REPORTING_CANONICAL_TEMPLATES.md` for required sections, RAG and escalation rules. This document is preserved as historical reference per the archive-first policy and remains useful for understanding the as-is Report Builder runtime in code.
>
> **Status:** Canonical (v3)  
> **Priorytet:** P0 — “reports are the management layer”  
> **Cel:** Zdefiniować spójny system raportowania w Consultinity: biblioteki, generatory, canonical report types (R1–R4), templates, AI narrative, quality gates i eksporty (PDF/DOCX/PPTX).  
>
> **Powiązane SSOT:**  
> - `docs/product/REPORTING_CANONICAL_TEMPLATES.md` — *kanoniczne typy raportów + RAG + escalation* (R1–R4)  
> - `docs/REPORT_BUILDER_EXPORTS_STANDARD.md` — eksport baseline (PDF/DOCX/PPTX)  
> - `docs/product/SOURCE_TRACEABILITY_SPEC.md` — traceability (ToolSession/AssessmentReport; MyWork seed → MYWORK ToolSession)  
> - `docs/product/OPERATING_MODEL_V3.md` — miejsce raportów w flow i role visibility  
> - `docs/ui-standards/03-modules/module-hub-standard.md` — Hub pattern  
> - `docs/ui-standards/03-modules/view-modes-standard.md` — list/cards  
> - `docs/ui-standards/03-modules/app-table-standard.md` — golden table standard  

---

## 0) Dlaczego Report Generator to osobna kategoria (nie “AI copywriter”)

Twoje screeny trafiają w sedno: rynek zwykle działa **na danych albo na szablonach**, a Consultinity działa na **nieuporządkowanej rzeczywistości organizacji** (artefakty, notatki, sesje narzędziowe, wyniki, execution).

### 0.1 4 warstwy przewagi (SSOT)

Poniższe 4 warstwy są kanonem projektowym Report Generator v3.

#### A) Input (multi-source, chaos-friendly)

MUST docelowo:
- Upload: **PDF / DOCX / XLSX / CSV / JSON**
- Upload “chaosu”: notatki, fragmenty, transkrypcje, zrzuty, luźne materiały
- Analiza wielu źródeł jednocześnie (multi-source)
- Strukturyzacja nieuporządkowanego materiału do “Report Knowledge Map”

#### B) Inteligencja (report intelligence core)

MUST:
- Generowanie narracji **z danych i artefaktów** (nie tylko “opis”)
- Budowa struktury raportu (outline) + walidacja logicznych braków
- Identyfikacja luk / niespójności i pytania doprecyzowujące
- Budowa roadmapy z materiałów
- Generowanie inicjatyw strategicznych (w ramach zasad traceability)
- Generowanie ROI / efektów (jeśli mamy dane ekonomiczne/benefits)

#### C) Warstwa wizualna (premium, bez pracy usera)

MUST:
- Automatyczny layout (template-driven / engine-driven)
- Online report (interactive, living document)
- Eksporty: PDF + DOCX (primary), PPTX (secondary)
- Spójny brand engine (Brand Kit → theme)

#### D) Logika systemowa (report → execution)

MUST:
- Powiązanie raportu z wykonaniem (Initiatives/Tasks/Decisions/Benefits)
- Raport jako punkt startowy projektu (report → initiatives / plan)
- Aktualizacja raportu w czasie (semi-live / refresh)
- AI jako współautor (co-author), nie copywriter (propose → accept/reject)

---

## 1) Report vs Presentation — kanoniczne rozróżnienie

W Consultinity mamy dwa produkty outputowe:

- **Report (v3)**: “dokument zarządczy / audytowy”, samodzielny, czytany bez prezentera.  
  Format: PDF/DOCX (primary), PPTX (opcjonalny)  
  Gęstość: wysoka, strukturalna, z danymi i uzasadnieniem.

- **Presentation (v3)**: “deck do pokazywania lub deliverable w slajdach” (SHOW/DOCUMENT/BRIEFING/WORKSHOP).  
  SSOT: `PRESENTATION_GENERATOR_V3.md`.

**Kanon v3:** raport jest pierwszorzędnym artefaktem dla warstwy management (R1–R4), a prezentacja jest alternatywną formą opakowania (np. Steering deck).

---

## 2) Kanoniczne typy raportów (MVP) — R1–R4

Źródło prawdy: `docs/product/REPORTING_CANONICAL_TEMPLATES.md`

W v3 wspieramy 4 obowiązkowe raporty:

| Code | Report type | Audience | Frequency |
|---|---|---|---|
| R1 | Weekly Execution Report | PMO / Project Team | Weekly |
| R2 | Steering Committee Report | Sponsors / Board | Monthly / gate-based |
| R3 | Benefits Tracking Report | Business Owners | Monthly / Quarterly |
| R4 | Portfolio Overview | Executives / Owner | On-demand |

**Kanon:** każdy typ ma:
- obowiązkowe sekcje,
- źródła danych per sekcja,
- RAG logic,
- escalation rules (kiedy automatycznie trafia do R2),
- export requirements.

---

## 3) Surface types (UI) — Hub + Generator + Artifact

### 3.1 Reports Hub (Library)

MUST:
- view modes: `table` + `grid(cards)` (okładki)  
- filtry: typ (R1–R4), status, zakres czasu, owner/team  
- CTA: **New report**
- szybkie wejście do: “Templates” (jeśli admin), “My reports”, “Team reports”

### 3.2 Report Generator (Wizard / Builder)

Flow jest “Gamma-like”, ale pod raport (dokument):

Kanon flow v3 jest zbudowany na **3 ścieżkach**, ale zawsze kończy się w tym samym Builderze.

#### Ścieżka A — Template Engine (Enterprise Mode) (MUST)

1. User wybiera **Report Template** (R1–R4 lub org template).
2. Template definiuje plan logiczny (sekcje + bloki + wymagane dane).
3. System ładuje źródła kontekstowe (artefakty) i **wypełnia template**:
   - dane → interpretacja → wnioski → rekomendacje
4. User przechodzi przez: Outline → Generate → Edit → Quality gate → Export.

#### Ścieżka B — Free Intelligence Mode (AI Architect) (MUST)

1. User tworzy nowy raport “bez template”.
2. **Report Definition Layer** (Krok 1) zbiera: cel, odbiorcę, język, styl komunikacji, długość, poziom szczegółowości.
3. AI proponuje **outline** (3 warianty opcjonalnie) + user akceptuje.
4. Generate → Edit → Quality gate → Export.

#### Ścieżka C — Minimal Mode (Upload chaos → choose A/B) (SHOULD v3; częściowo as-is)

1. User wrzuca pliki/materiały (PDF/DOCX/XLSX/CSV/notes).
2. System buduje **Knowledge Map** (wstępna strukturyzacja).
3. System pyta: “Template (A) czy Free (B)?”
4. Dalej działa jak A lub B.

#### Spięcie (wspólne kroki)

1. **Define intent / definition**: report type (R1–R4 lub custom), okres, scope, odbiorca, język, styl komunikacji  
2. **Sources**: automatyczne źródła + opcjonalne dodatki (ToolSession, AssessmentReport, Notes, Initiative portfolio)  
3. **Outline**: sekcje raportu + streszczenia per sekcja (AI propose → accept/reject)  
4. **Generate**: budowa contentu sekcja po sekcji (z możliwością regen per sekcja)  
5. **Edit & Quality Gate**: poprawki + walidacja “sponsor‑ready”  
6. **Online report**: living document (primary)  
7. **Export**: PDF/DOCX/PPTX (zgodnie z baseline)

### 3.3 Report Artifact (final)

Każdy report jako artefakt ma:
- metadane: type (R1–R4), timeframe, owner, createdAt/updatedAt
- traceability: skąd powstał (ToolSession/AssessmentReport; jeśli MyWork → MYWORK ToolSession)
- export history (format, timestamp, kto)
- status: `draft/editing` → `ready` → `exported` (MVP), opcjonalnie `archived`

**Kanon v3:** report ma zawsze **wersję online** (interactive). PDF/DOCX/PPTX są *renderami* z tej wersji.

---

## 4) Model danych (logical)

### 4.1 ReportTemplate

```
ReportTemplate {
  template_id: UUID
  name: string
  report_type: "R1" | "R2" | "R3" | "R4" | "custom"
  scope: "application" | "organization"
  organization_id?: UUID
  sections_outline: ReportSectionOutline[]
  default_export: "pdf" | "docx" | "pptx"
  status: "active" | "archived"
  created_by: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

### 4.2 Report

```
Report {
  report_id: UUID
  organization_id: UUID
  project_id?: UUID
  title: string
  report_type: "R1" | "R2" | "R3" | "R4" | "custom"
  period: { from: date, to: date }
  audience: string[]
  goal?: "inform" | "decide" | "sell" | "align"
  communication_register?: "executive" | "professional" | "technical" | "narrative"
  language: string
  confidentiality: "confidential" | "internal" | "public"
  delivery: { primary: "online"; exports: ("pdf" | "docx" | "pptx")[] }
  theme_id?: UUID                     // Brand Kit / curated palettes
  sections: ReportSection[]
  source_refs: SourceRef[]             // same contract as presentations (traceability)
  context_pack_snapshot?: JSON         // optional: unified context package for AI
  status: "draft" | "ready" | "exported" | "archived"
  export_history: ExportRecord[]
  created_by: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

### 4.3 ReportSection / ReportBlock

```
ReportSection {
  section_id: UUID
  order_index: number
  title: string
  summary: string?                     // executive summary for the section
  blocks: ReportBlock[]
  rag?: "green" | "amber" | "red"       // for RAG-driven sections
  source_refs: SourceRef[]
}
```

```
ReportBlock {
  block_id: UUID
  type: "heading" | "paragraph" | "bullet_list" | "table" | "chart" | "callout" | "kpi_strip" | "risk_register"
  content: JSON
  source_ref?: SourceRef
  is_refreshable: boolean              // v3: can refresh from sources (optional)
}
```

---

## 5) AI w raportach — zasady (MUST)

### 5.1 AI propose → accept/reject

AI:
- proponuje narrative, sekcje, bloki, streszczenia
- nie nadpisuje bez zgody usera

### 5.2 Executive summary

Kanon: w raportach typu R2 (Steering) i R4 (Portfolio) AI generuje “executive narrative” na bazie danych:
- decyzje do podjęcia,
- eskalacje,
- najważniejsze odchylenia,
- rekomendowane next steps.

### 5.3 “No hallucination”

AI nie wymyśla danych. Jeśli brakuje danych → placeholder + pytanie do usera.

### 5.4 AI jako współautor (co-author), nie copywriter

Kanon interakcji:
- AI proponuje *tezy, wnioski, rekomendacje* (a nie tylko “opis danych”).
- AI sygnalizuje braki logiczne: “brakuje X, żeby policzyć ROI” / “brakuje ownera inicjatywy”.
- AI zmiany wykonuje w trybie: **propose → accept/reject** (sekcja/blok/cały report).

---

## 5.5 Report Definition Layer (MUST) — zanim raport powstanie

W ścieżce B (bez template) i w ścieżce C (upload) Report Generator musi zebrać definicję raportu:

MUST pola:
- **Cel raportu** (goal): inform / decide / sell / align
- **Odbiorca**: sponsor / executive / investor / internal (lub własny)
- **Język**: PL/EN/…
- **Rejestr komunikacji**: executive / professional / technical / narrative
- **Długość / gęstość**: concise / standard / detailed / comprehensive
- **Forma**: strategiczny / operacyjny / techniczny / inwestorski
- **Poziom danych**: data-heavy / balanced / narrative-heavy

Kanon: po zebraniu definicji AI proponuje outline do akceptacji przed generacją.

---

## 5.6 Narrative Engine Core (Quill‑like) + Governance (Arria‑like) — kanon v3

Ten rozdział jest “sercem” różnicy między **AI copywriterem** a **poważnym systemem raportowym**.

### 5.6.1 Narrative Engine (Quill‑like) — architektura logiczna (v3)

Kanon v3: generowanie tekstu jest **ostatnim etapem**. Najpierw system musi zbudować “prawdę” raportu.

Warstwy:
- **(1) Fact extraction (deterministic)**: zaciągnięcie danych i faktów z artefaktów (Initiatives/Tasks/Decisions/Benefits/EconomicAnalysis/Assessment results) + normalizacja jednostek.
- **(2) Observation selection**: wybór obserwacji (odchylenia, zmiany trendu, ryzyka, decyzje zaległe).
- **(3) Discourse plan**: plan narracji per sekcja:
  - Observation → Explanation → Implication → Recommendation (kanon)
- **(4) Linguistic realization (LLM)**: dopiero tu model pisze tekst, ale w ramach:
  - “no hallucination”
  - stylu (register/tone)
  - kontroli długości (density)
  - cytowania źródeł (traceability)
- **(5) Post‑checks (quality gates)**: walidacje logiczne i stylistyczne przed eksportem/sendem.

### 5.6.2 Governance / Brand Voice (Arria‑like) — kontrola języka (v3)

MUST (v3):
- **Brand Voice Profile** (org‑level): rejestr komunikacji, preferencje słownictwa, dozwolone “hedging” (ostrożność), zakazane frazy.
- **Compliance Mode** (org‑level): włącza ostrzejsze reguły:
  - brak “marketingowych” sformułowań
  - brak deklaracji bez źródła
  - każda rekomendacja musi mieć “why + evidence + next step”
- **Templates control voice**: template może narzucić styl sekcji (executive vs technical).

As‑is w kodzie: istnieją już zalążki “voice controls” w `server/src/services/reportGenerationService.ts` (verbosity / writing style / illustration level + guidance), ale w v3 musi to zostać spięte w jawny profil organizacji oraz w “Report Definition Layer”.

---

## 6) RAG logic & escalation (canonical)

Źródło prawdy: `REPORTING_CANONICAL_TEMPLATES.md`

**Kanon UX:** RAG jest widoczny jako:
- badge przy sekcji,
- summary w hub table,
- escalation list (dla R2).

---

## 7) Export quality gate (MUST)

Źródło prawdy: `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

### 7.1 PDF (primary for sponsor-ready)

MUST:
- title page oddzielna
- header/footer na każdej stronie (client + report title, “Confidential”, page numbers)

### 7.2 DOCX

MUST:
- prawdziwy `.docx`
- zachowane headingi i listy

### 7.3 PPTX

MUST:
- 16:9, consulting-safe fonts
- slide numbers
- sensowny split long sections

### 7.4 Quality Gates (as‑is) → Quality Gates (v3)

As‑is (w kodzie) istnieje techniczny baseline quality gates:
- `server/src/services/reportQualityGatesService.ts`
- endpoint check w Report Builder: `GET /api/report-builder/:id/quality-gates`

Obecne bramki dotyczą głównie kompletności struktury i minimalnej jakości treści (missing sections / empty content / short content).

Target v3 quality gates MUSZĄ rozszerzyć to o:
- **Numeric / logical consistency** (np. sumy, jednostki, okresy)
- **Coverage** (czy R1/R2/R3/R4 pokrywa wymagane sekcje i dane)
- **Compliance** (Brand Voice / hedging / zakazane sformułowania)
- **Traceability coverage** (czy kluczowe tezy mają źródła)

---

## 8) MVP (as-is) vs Target v3

### 8.1 MVP (as-is)

W kodzie (V2) istnieją **3 równoległe “podsystemy raportów”**. SSOT v3 musi je ująć, bo to realny “as‑is”, z którym musimy żyć w MVP.

#### (A) Report Builder (deliverable builder: sponsor‑ready report) — *najbliżej v3*

To jest główny fundament “Report Generator” w kodzie.

**Frontend (UI):**
- Routing: `/reports/builder` (legacy `/reports` redirect)  
  - `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Main view: `src/views/ReportBuilderView.tsx`
  - list existing reports
  - wizard “New report” (`new=true`)
  - editor dla reportu `/reports/builder/:reportId`
- Wizard: source → template (as‑is) + dalej kroki report buildera  
  - `src/components/ReportBuilder/steps/SourceSelectStep`  
  - `src/components/ReportBuilder/TemplatePickerModal`
- Public shared viewer (builder reports): `src/views/reports/PublicReportBuilderView.tsx` (route: `/shared/report/:token`)

**Backend (API):**
- Core routes: `server/src/routes/report-builder.routes.ts`
- Core service/types: `server/src/services/reportBuilderService.ts`
- Wsparcie: quality gates + agent + comments + versions:
  - `server/src/services/reportQualityGatesService.ts`
  - `server/src/services/reportAgentService.ts`
  - `server/src/services/reportBuilderCommentsService.ts`

**As‑is workflow (verified in code):**
- Wizard kroki (UI): **Define intent → Outline → Generate & Edit**
- Report ma statusy (as‑is, backend types):  
  `DRAFT → CONFIGURING → GENERATING → GENERATED → IN_REVIEW → APPROVED → SENT_INTERNAL | SENT_EXTERNAL → UTILIZED`
- Report wspiera:
  - intent snapshot (`config.intent`) + `invocation profiles`
  - sekcje konfigurowalne per report (enabled/order/length/language/custom prompt)
  - generację per sekcja (regen)
  - “agent messages/actions” (AI współautor)
  - wersjonowanie (manual + auto na zmianach statusu)
  - komentarze per report (w builderze)
  - quality gates przed eksportem

**As‑is: share links (public) dla Report Builder:**
- Create link: `POST /api/report-builder/:id/share`
- List links: `GET /api/report-builder/:id/share`
- Revoke: `DELETE /api/report-builder/:id/share/:linkId`
- Public access: `/shared/report/:token` (frontend) + public backend route (w module public routes dla buildera)
- Password protection: hash przez `bcrypt` (w route)

**As‑is: eksporty (baseline, sponsor-ready):**
- PDF: `GET /api/report-builder/:id/export/pdf`
- DOCX: `GET /api/report-builder/:id/export/docx` (+ alias `/doc`)
- PPTX: `GET /api/report-builder/:id/export/pptx`
- Export history: `GET /api/report-builder/:id/exports`
- Export to Notion (integrations): `POST /api/report-builder/:id/export/notion`
- SSOT jakości exportu: `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

**As‑is: “Blocks via API” (curated block library):**
- W bazie istnieje concept `report_builder_block_types` (system blocks + org blocks) z `renderKind` (`markdown/callout/table/chart/matrix/json`) i PPTX metadata.
- Seeder baseline: `server/scripts/seed-dbr77-fill-all-tables.ts` (patrz `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`)

#### (B) Management Reports (PMO/management dashboards + automation) — *osobny moduł “Reports” (legacy/parallel)*

W UI istnieje osobny “ReportsHub” (3 taby: reports/templates/schedules) — to nie jest ten sam “Report Builder”.

**Frontend:**
- Hub: `src/components/Reports/Management/ReportsHub.tsx`
  - tabs: Reports / Templates / Schedules
  - generator drawer: `ReportGeneratorDrawer`

**Backend / API (as‑is):**
- Źródła danych są inne niż w builderze (history/templates/schedules):
  - `/api/management-reports/history`
  - `/api/management-reports/templates`
  - `/api/management-reports/schedules`

Kanon v3: **ten moduł ma zostać ujęty jako “Reporting (R1–R4) surface”** (management layer), ale generator deliverable (Report Builder) pozostaje *jednym wspólnym Builderem* dla finalnych dokumentów.

#### (C) Generic reports (upload + OCR/summary + search) — *wstęp do “Upload chaos”*

W backendzie istnieje osobna ścieżka “generic reports upload” (dziś PDF‑first, z TODO na DOCX/XLSX).

**Backend:**
- Routes: `server/src/routes/generic-reports.routes.ts` (feature-gated / stub)
- Service: `server/src/services/genericReportService.ts`
- Processing: PDF text extraction + proste parse + summary + tag suggestion (placeholder)

To jest **częściowy “as‑is” fundament ścieżki C** (Upload chaos), ale nie jest jeszcze spięty z Report Builderem jako Knowledge Map → outline → builder.

#### (D) Legacy “/api/reports/*” (snapshot public share + generate/export) — *równoległy pipeline V2*

W kodzie istnieje osobny zestaw endpointów “reports generation” (inny niż Report Builder).

**Backend:**
- Routes: `server/src/routes/reports-generation.routes.ts`
  - `POST /api/reports/generate`
  - `POST /api/reports/:reportId/export/:format` (as‑is: `pdf`, `pptx`)
  - `POST /api/reports/:reportId/share`
  - `GET /api/reports/public/:linkToken` (+ password verify: `POST /api/reports/public/:linkToken/verify`)

**Frontend:**
- Public viewer: `src/views/reports/PublicReportView.tsx` (token route)  
  Renderuje snapshoty typu: `ORG_REPORT` / `INITIATIVE_REPORT` (read‑only, watermark, expiry).
- Share UI: `src/components/Reports/ShareModal.tsx` (legacy share path).

Kanon v3: te mechanizmy muszą zostać opisane jako **legacy**, a docelowo dążymy do ujednolicenia:
- “final deliverables” (sponsor‑ready) → **Report Builder share/export**
- “snapshot reporting” (org/initiative quick share) → albo migruje do buildera jako “lightweight template”, albo zostaje jako osobna kategoria (ale z jednym standardem linków i branding).

#### As‑is import (assessment reports)

Istnieje import dla assessmentowych raportów wejściowych (DRD/SIRI/ADMA) i ekstrakcja danych/struktury:
- `server/src/services/reportImportService.ts` wspiera: `pdf/xlsx/docx/json/csv` (framework detection + mapping)

### 8.1.1 Ważna różnica MVP vs Target

MVP ma mocny **Report Builder** (sekcje, intent, eksporty), ale nie ma jeszcze pełnego “upload chaos → knowledge map → choose A/B” dla dowolnych materiałów. To jest Target v3.

### 8.2 Target v3

Docelowo Report Generator v3 spina:
- canonical R1–R4 types (reporting layer),
- wizard “type & scope” + AI narrative,
- template system (app/org scopes),
- traceability jak w presentations,
- quality gate “sponsor-ready”.

oraz (z Twojej wizji):
- 3 ścieżki A/B/C,
- online report jako primary artifact + drill-down,
- report intelligence core (luki, roadmapy, inicjatywy, ROI),
- brand engine + auto layout.

---

## 9) Integracja z całą aplikacją (cross‑cutting)

Report Generator (v3) nie jest “osobnym światem”. Jest **warstwą outputową** systemu i musi mieć spójne kontrakty z osiami produktu.

### 9.1 Entry points (gdzie user wchodzi w raport)

MUST (v3):
- **Sidebar → Reports** (hub)
- **Assessments → “Generate report”** (z kontekstem assessmentu)
- **Tools → “Generate report”** (z kontekstem ToolSession output package)
- **Initiatives / Execution / Benefits → “Generate report”** (z kontekstem portfela + okresu)
- **MyWork (Notebook/Idea) → “Create report”** (ale z regułą materializacji `MYWORK ToolSession`)

As‑is (w kodzie) entry points już istnieją w kilku miejscach (np. Assessment Hub kieruje do `/reports/builder/...`), a `artifactLinks.ts` mapuje report builder jako kanoniczny link do artefaktu reportu.

### 9.2 Traceability (SSOT)

Kanon (SSOT): `docs/product/SOURCE_TRACEABILITY_SPEC.md`

MUST:
- Report (jako final output) musi trzymać `source_refs` wskazujące **kanoniczne źródło**:
  - `ToolSession` lub `AssessmentReport`
- Jeśli raport startuje z MyWork (Idea/Notebook), system musi:
  - utworzyć `ToolSession(MYWORK)` jako źródło,
  - dopiero z niego stworzyć report (żeby nie łamać reguły “2 sources”).

### 9.3 Link graph / backlinks (SSOT)

Kanon: `docs/product/LINK_GRAPH_V3.md`

MUST:
- Report pokazuje “Used sources” (ToolSession/Assessment/Initiatives/Notebook refs).
- Źródła pokazują backlinks: “Used in reports”.

### 9.4 Report → execution (Initiatives/Tasks/Decisions/Benefits)

Kanon v3:
- raport może zawierać sekcje/bloki, które są **wiązane** do systemowych bytów:
  - `Initiative`, `Task`, `Decision`, `BenefitsRecord`, `EconomicAnalysis`
- raport może tworzyć inicjatywy **tylko zgodnie z regułami traceability**:
  - AI może zaproponować inicjatywy, ale ich źródłem pozostaje ToolSession/AssessmentReport (nie “sam report”).

### 9.5 Data binding & semi‑live (v3)

MUST (v3):
- bloki mogą być `refreshable` (per block/section/report)
- UI pokazuje “data is outdated” (timestamp źródła vs timestamp renderu)
- “refresh” nie niszczy ręcznych edycji — działa jak **AI propose → accept/reject** dla zmian

As‑is (w kodzie): istnieją już snapshoty danych per sekcja/blok (np. `sourceDataSnapshot` w recordach sekcji buildera) oraz statusy reportu wspierające iteracyjny cykl “generate → review → send”.

### 9.6 Cykliczne raporty (scheduled reports)

As‑is (w kodzie): fundament już istnieje:
- Service: `server/src/services/scheduledReportService.ts`
- Routes: `server/src/routes/scheduled-reports.routes.ts`

Kanon v3:
- scheduled report to jest **automatyzacja wejścia** do generatora (template + sources + okres),
- output = nowy report artefakt + opcjonalne dostarczenie (email/dashboard/webhook/storage),
- scheduled reports dotyczą zarówno reportów, jak i docelowo decków (w service typ `DeliverableType`).

