# 🧩 Moduł: Reports (Generyczny Generator Raportów) – Overview

## Status: 🔨 W PLANOWANIU

**Ostatnia aktualizacja:** 2026-01-31

---

## 📋 Plan źródłowy

`wdrozenia/plan-reporting-module.md`

---

## 🎯 Cel biznesowy

Generyczny moduł tworzenia raportów, który:

1. **Jest reusable** w całej aplikacji (Assessment, Interview, Initiatives, Tools, etc.)
2. **Wizard-based** – prowadzi użytkownika krok po kroku przez proces tworzenia raportu
3. **AI-powered** – automatycznie generuje treść na podstawie źródła danych i metodologii
4. **Konfigurowalny** – użytkownik może modyfikować strukturę, długość, styl języka
5. **Eksportowalny** – PDF, opcjonalnie PPTX, HTML

---

## 🏗️ Architektura

### Filozofia: "Report Builder as a Service"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REPORT BUILDER MODULE                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  WIZARD STEPS                                                      │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │ │
│  │  │ 1.SOURCE │→ │2.CONFIG  │→ │3.GENERATE│→ │4.EDIT    │→ EXPORT   │ │
│  │  │  SELECT  │  │ SECTIONS │  │  DRAFT   │  │  REFINE  │           │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │ SOURCE ADAPTERS │  │ REPORT TEMPLATES│  │ EXPORT ENGINES  │        │
│  │ • Assessment    │  │ • Assessment    │  │ • PDF           │        │
│  │ • Interview     │  │ • Interview     │  │ • PPTX          │        │
│  │ • Tool          │  │ • Initiative    │  │ • HTML          │        │
│  │ • Initiative    │  │ • Management    │  │ • Markdown      │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Scope (MVP – Assessment Reports)

### Must Have

- [x] Wizard 4-krokowy (Source → Config → Generate → Edit)
- [x] Source adapter dla Assessment (DRD, SIRI, ADMA, etc.)
- [x] Konfiguracja sekcji (dodawanie/usuwanie/reorder)
- [x] Opcje per sekcja: długość (short/medium/long), język (technical/business/general)
- [x] AI-powered generation (treść na bazie oceny + metodologii)
- [x] Edytor WYSIWYG dla wygenerowanego raportu
- [x] Export PDF
- [x] Statusy: DRAFT → IN_PROGRESS → IN_REVIEW → APPROVED → UTILIZED
- [x] Dynamiczne menu (otwarte raporty, max 6)
- [x] Duplikowanie raportów

### Should Have

- [ ] Export PPTX
- [ ] Szablony raportów (templates)
- [ ] Wersjonowanie raportów
- [ ] Komentarze i review workflow

### Could Have

- [ ] Schedule raportów (cykliczne generowanie)
- [ ] Public share links
- [ ] Integracja z Initiatives (auto-generate initiatives z raportu)

---

## 🔄 Workflow raportów

### Statusy

```
┌────────┐   create   ┌─────────────┐   generate   ┌───────────┐
│  NEW   │ ─────────► │   DRAFT     │ ───────────► │ GENERATED │
└────────┘            └─────────────┘              └───────────┘
                                                        │
                                    edit/regenerate     │ finalize
                                    ◄───────────────────│
                                                        ▼
                      ┌─────────────┐   approve   ┌───────────┐
                      │  IN_REVIEW  │ ◄───────── │  PENDING  │
                      └─────────────┘             │  APPROVAL │
                            │                    └───────────┘
                            │ approve/reject
                            ▼
                      ┌───────────┐   utilize   ┌───────────┐
                      │  APPROVED │ ──────────► │  UTILIZED │
                      └───────────┘             └───────────┘
```

| Status      | Opis                                      | Dozwolone akcje            |
| ----------- | ----------------------------------------- | -------------------------- |
| `DRAFT`     | Raport utworzony, struktura konfigurowana | Edit config, Generate      |
| `GENERATED` | Treść wygenerowana przez AI               | Edit, Regenerate, Finalize |
| `IN_REVIEW` | Wysłany do review                         | Approve, Reject, Comment   |
| `APPROVED`  | Zatwierdzony                              | Export, Duplicate, Utilize |
| `UTILIZED`  | Wykorzystany (np. do inicjatyw)           | Export, Duplicate, View    |

---

## 📝 Struktura raportu Assessment

### Sekcje obowiązkowe (default)

```yaml
sections:
  - id: cover
    title: 'Strona tytułowa'
    type: cover
    required: true
    content:
      - company_info
      - assessment_info
      - date
      - authors

  - id: executive_summary
    title: 'Executive Summary'
    type: summary
    required: true
    options:
      length: medium # short | medium | long
      language: business # technical | business | general

  - id: methodology
    title: 'Metodologia badania'
    type: methodology
    required: true
    content:
      - framework_description (DRD/SIRI/etc.)
      - assessment_scope
      - data_sources

  - id: maturity_matrix
    title: 'Macierz dojrzałości'
    type: matrix
    required: true
    content:
      - radar_chart
      - heatmap
      - scores_table

  - id: axis_chapters # Per axis (7 for DRD)
    title: 'Szczegółowa analiza osi'
    type: axis_analysis
    required: true
    repeat_per: axis
    content:
      - axis_summary
      - areas_breakdown:
          - area_score
          - area_answer
          - area_conclusion
          - area_recommendation

  - id: strengths
    title: 'Mocne strony'
    type: list
    required: true

  - id: weaknesses
    title: 'Słabe strony / Obszary do rozwoju'
    type: list
    required: true

  - id: recommendations
    title: 'Rekomendacje strategiczne'
    type: recommendations
    required: true
    options:
      length: long

  - id: next_steps
    title: 'Kolejne kroki'
    type: action_plan
    required: true

  - id: appendix
    title: 'Załączniki'
    type: appendix
    required: false
    content:
      - detailed_scores
      - evidence_list
      - glossary
```

### Opcje konfiguracji per sekcja

```typescript
interface SectionConfig {
  id: string;
  title: string;
  enabled: boolean; // can be disabled if not required
  order: number;
  options: {
    length: 'short' | 'medium' | 'long';
    language: 'technical' | 'business' | 'general';
    customPrompt?: string; // optional AI guidance
  };
}
```

---

## 🧩 Komponenty

### Frontend

```
src/components/Reports/Builder/
├── ReportBuilderWizard.tsx       # Main wizard container
├── steps/
│   ├── SourceSelectStep.tsx      # Step 1: Select source
│   ├── ConfigStructureStep.tsx   # Step 2: Configure sections
│   ├── GenerateStep.tsx          # Step 3: Generate with AI
│   └── EditRefineStep.tsx        # Step 4: Edit & refine
├── sections/
│   ├── SectionCard.tsx           # Draggable section config card
│   ├── SectionEditor.tsx         # WYSIWYG section editor
│   └── SectionPreview.tsx        # Section preview
├── adapters/
│   ├── AssessmentSourceAdapter.tsx
│   ├── InterviewSourceAdapter.tsx
│   └── ToolSourceAdapter.tsx
├── export/
│   ├── PdfExporter.tsx
│   └── ExportModal.tsx
└── index.ts

src/components/Reports/Hub/
├── ReportBuilderHub.tsx          # Reports list & management
├── ReportCard.tsx                # Report card for grid view
├── ReportRow.tsx                 # Report row for table view
└── ReportQuickActions.tsx        # Actions menu
```

### Backend

```
server/src/
├── routes/
│   └── report-builder/
│       ├── report-builder.routes.ts
│       └── report-builder-export.routes.ts
├── services/
│   ├── reportBuilderService.ts
│   ├── reportGeneratorService.ts
│   └── reportExportService.ts
├── controllers/
│   └── ReportBuilderController.ts
└── validators/
    └── reportBuilder.validators.ts
```

---

## 🗄️ Model danych

### Tabela: `reports`

```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,

  -- Source
  source_type TEXT NOT NULL,  -- 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE'
  source_id TEXT NOT NULL,
  source_name TEXT,

  -- Report metadata
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,  -- 'ASSESSMENT_DRD' | 'ASSESSMENT_SIRI' | etc.

  -- Configuration
  config_json TEXT,  -- SectionConfig[]

  -- Content
  content_json TEXT,  -- Generated/edited content

  -- Status
  status TEXT DEFAULT 'DRAFT',

  -- Workflow
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_at TIMESTAMP,
  finalized_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by TEXT,
  utilized_at TIMESTAMP,

  -- Version
  version INTEGER DEFAULT 1,
  parent_report_id TEXT,  -- For duplicates

  -- Export
  pdf_path TEXT,
  pptx_path TEXT,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (source_id) REFERENCES assessments(id)
);

CREATE INDEX idx_reports_organization ON reports(organization_id);
CREATE INDEX idx_reports_source ON reports(source_type, source_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_by ON reports(created_by);
```

### Tabela: `report_sections`

```sql
CREATE TABLE report_sections (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,

  section_type TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,

  order_index INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT true,

  -- Options
  length TEXT DEFAULT 'medium',
  language TEXT DEFAULT 'business',
  custom_prompt TEXT,

  -- Content
  generated_content TEXT,
  edited_content TEXT,

  -- Metadata
  generated_at TIMESTAMP,
  edited_at TIMESTAMP,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE INDEX idx_report_sections_report ON report_sections(report_id);
```

---

## 🔌 API Endpoints

### Report CRUD

| Method | Endpoint                            | Opis                        |
| ------ | ----------------------------------- | --------------------------- |
| POST   | `/api/report-builder`               | Create new report           |
| GET    | `/api/report-builder`               | List reports (with filters) |
| GET    | `/api/report-builder/:id`           | Get report details          |
| PUT    | `/api/report-builder/:id`           | Update report               |
| DELETE | `/api/report-builder/:id`           | Delete report               |
| POST   | `/api/report-builder/:id/duplicate` | Duplicate report            |

### Wizard steps

| Method | Endpoint                                              | Opis                          |
| ------ | ----------------------------------------------------- | ----------------------------- |
| GET    | `/api/report-builder/sources/:type`                   | List available sources        |
| GET    | `/api/report-builder/sources/:type/:id`               | Get source data for report    |
| GET    | `/api/report-builder/templates/:type`                 | Get default template for type |
| PUT    | `/api/report-builder/:id/config`                      | Update section config         |
| POST   | `/api/report-builder/:id/generate`                    | Generate content with AI      |
| POST   | `/api/report-builder/:id/generate-section/:sectionId` | Regenerate single section     |

### Workflow

| Method | Endpoint                           | Opis                             |
| ------ | ---------------------------------- | -------------------------------- |
| POST   | `/api/report-builder/:id/finalize` | Finalize (GENERATED → IN_REVIEW) |
| POST   | `/api/report-builder/:id/approve`  | Approve report                   |
| POST   | `/api/report-builder/:id/reject`   | Reject with comments             |
| POST   | `/api/report-builder/:id/utilize`  | Mark as utilized                 |

### Export

| Method | Endpoint                                          | Opis          |
| ------ | ------------------------------------------------- | ------------- |
| POST   | `/api/report-builder/:id/export/pdf`              | Generate PDF  |
| POST   | `/api/report-builder/:id/export/pptx`             | Generate PPTX |
| GET    | `/api/report-builder/:id/export/:format/download` | Download file |

### Sessions (Dynamic menu)

| Method | Endpoint                                | Opis                     |
| ------ | --------------------------------------- | ------------------------ |
| GET    | `/api/report-builder/sessions`          | Get open reports (max 6) |
| POST   | `/api/report-builder/:id/session/open`  | Open report in menu      |
| POST   | `/api/report-builder/:id/session/close` | Close report from menu   |

---

## 🎨 UI/UX

### Wizard UX

```
┌─────────────────────────────────────────────────────────────────────┐
│  [←] Create Report                              Step 2 of 4         │
│  ═══════════════════════════════════════════════════════════════    │
│  ● Source  ──●── Config  ────○── Generate  ────○── Edit             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📋 Configure Report Structure                                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ⬛ Cover Page                           [Short ▼] [Business▼]│   │
│  │    Company info, assessment details                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ⬛ Executive Summary                    [Medium▼] [Business▼]│   │
│  │    High-level findings and recommendations                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ⬛ Maturity Matrix                      [Visual]             │   │
│  │    Radar chart, heatmap, scores                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☐ Axis 1: Digital Processes            [Long ▼] [Technical▼]│   │
│  │    Detailed analysis per area                               │   │
│  │    [✎ Custom prompt: Focus on automation gaps...]           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [+ Add Custom Section]                                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                    [← Back]  [Generate Report →]    │
└─────────────────────────────────────────────────────────────────────┘
```

### Reports Hub

```
┌─────────────────────────────────────────────────────────────────────┐
│  Reports                                        [+ New Report]      │
│  [🔍] [All ▾] [Assessment ▾] [Draft ▾]         [≡] [⊞]             │
├─────────────────────────────────────────────────────────────────────┤
│  📄 DRD Assessment Report - Q1 2026      │ Assessment │ ● Draft    │
│  📄 SIRI Maturity Analysis               │ Assessment │ ● Approved │
│  📄 Interview Summary - Board            │ Interview  │ ● Final    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Generation Pipeline

### Prompt struktura dla sekcji

```typescript
interface GenerationContext {
  // Source data
  sourceType: 'ASSESSMENT';
  sourceData: {
    assessmentType: 'DRD' | 'SIRI' | etc.;
    answers: Record<string, AxisAnswer>;
    scores: ScoreSummary;
    company: CompanyProfile;
    methodology: MethodologyDescription;
  };

  // Section config
  section: {
    type: string;
    title: string;
    options: {
      length: 'short' | 'medium' | 'long';
      language: 'technical' | 'business' | 'general';
      customPrompt?: string;
    };
  };

  // Context from other sections
  previousSections?: GeneratedSection[];
}
```

### Przykładowy prompt dla Executive Summary

```markdown
## Role

You are a senior management consultant preparing an executive report.

## Context

- Company: {{company.name}} ({{company.industry}})
- Assessment: {{assessment.type}} ({{assessment.framework}})
- Overall Score: {{scores.overall}} / {{scores.max}}

## Task

Generate an Executive Summary with the following characteristics:

- Length: {{section.options.length}}
- Language style: {{section.options.language}}
  {{#if section.options.customPrompt}}
- Additional guidance: {{section.options.customPrompt}}
  {{/if}}

## Source Data

{{#each axes}}

### {{this.name}}

- Score: {{this.score}} / {{this.maxScore}}
- Key findings: {{this.findings}}
  {{/each}}

## Output Format

Generate a professional executive summary that:

1. Opens with a clear statement of assessment purpose
2. Highlights 3-5 key findings
3. Summarizes overall maturity level
4. Provides strategic recommendations
5. Closes with recommended next steps

Use {{language}} language appropriate for {{audience}}.
```

---

## 📁 Struktura plików wdrożeniowych

```
wdrozenia/modules/reports/
├── 00-OVERVIEW.md                    # This file
├── 01-ARCHITECTURE.md                # Detailed architecture
├── 02-DATA-MODEL.md                  # Database schema details
├── backend/
│   ├── 01-api-list.md               # API endpoints
│   ├── 02-api-detail.md             # Detailed API specs
│   ├── 03-generation-service.md     # AI generation logic
│   └── 04-export-service.md         # PDF/PPTX export
├── frontend/
│   ├── 01-wizard-component.md       # Wizard implementation
│   ├── 02-section-editor.md         # Section editor
│   ├── 03-hub-component.md          # Reports hub
│   └── 04-export-modal.md           # Export UI
├── features/
│   ├── 01-assessment-adapter.md     # Assessment source adapter
│   ├── 02-templates.md              # Report templates
│   └── 03-workflow.md               # Status workflow
└── testing/
    ├── 01-unit-tests.md
    └── 02-e2e-tests.md
```

---

## 🧪 Testy

### Unit Tests

- [ ] Report CRUD operations
- [ ] Section configuration validation
- [ ] AI generation (mocked)
- [ ] Status transitions
- [ ] Export generation

### E2E Tests

- [ ] Full wizard flow (Source → Config → Generate → Edit → Export)
- [ ] Duplicate report
- [ ] Dynamic menu (open/close)
- [ ] PDF export and download
- [ ] Status workflow (Draft → Approved)

---

## 📚 Powiązane dokumenty

- `wdrozenia/standards/entities/03-REPORT.md` - Standard encji Report
- `wdrozenia/UI_UX_GOLDEN_STANDARD.md` - Standardy UI/UX
- `wdrozenia/modules/assessment/00-OVERVIEW.md` - Moduł Assessment (źródło)
- `docs/flows/assessment/ASSESSMENT_EXECUTION_FLOW.md` - Flow assessment

---

## ⚠️ Ryzyka i otwarte decyzje

### Ryzyka

1. **AI generation quality** – treść może wymagać znacznej edycji
   - Mitygacja: good prompts, user editing, regeneration
2. **PDF formatting** – złożone layouty mogą być problematyczne
   - Mitygacja: simple, professional templates
3. **Performance** – generowanie długich raportów może trwać
   - Mitygacja: streaming, progress indicators, background jobs

### Otwarte decyzje

1. **PPTX export** – czy implementować w MVP?
2. **Templates marketplace** – czy użytkownicy mogą dzielić się szablonami?
3. **AI provider** – OpenAI vs Anthropic vs other dla generowania?
4. **Offline export** – czy PDF ma być generowany server-side czy client-side?

---

## 📅 Roadmap implementacji

### Faza 1: Core (MVP)

1. Database schema + migrations
2. API endpoints (CRUD + workflow)
3. Wizard component (4 steps)
4. Assessment source adapter
5. AI generation service
6. Basic PDF export
7. Reports Hub

### Faza 2: Polish

1. Section reordering (drag & drop)
2. Rich text editor dla sekcji
3. Preview mode
4. Duplicate functionality
5. Dynamic menu

### Faza 3: Extended

1. PPTX export
2. Report templates
3. Version history
4. Comments & review workflow
5. Additional source adapters (Interview, Tool)
