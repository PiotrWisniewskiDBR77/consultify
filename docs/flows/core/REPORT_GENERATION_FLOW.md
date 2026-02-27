# FLOW-REPORT-001: Report Generation

> **ID:** FLOW-REPORT-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value                 |
| ------------------------- | --------------------- |
| **Completeness**          | 85%                   |
| **Gaps Identified**       | 2                     |
| **Implementation Status** | Partially implemented |

## Purpose

System generowania raportów - od assessment reports po custom analytics reports. Kluczowa funkcja produktowa.

## Report Types

| Type                  | Source       | Description                                  |
| --------------------- | ------------ | -------------------------------------------- |
| **Assessment Report** | Assessment   | Wyniki assessment z analizą i rekomendacjami |
| **Project Report**    | Project      | Status projektu, postęp, ryzyka              |
| **Initiative Report** | Initiative   | Szczegóły realizacji inicjatywy              |
| **Portfolio Report**  | Organization | Przegląd wszystkich projektów                |
| **Custom Report**     | User Query   | Raport na żądanie z wybranych danych         |

## Report Generation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                      REPORT GENERATION FLOW                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────┐    ┌────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │  Request   │───►│   AI Gen   │───►│   Template   │───►│  Export  │ │
│  │  Report    │    │  Content   │    │   Render     │    │  Format  │ │
│  └────────────┘    └────────────┘    └──────────────┘    └──────────┘ │
│       │                 │                  │                   │      │
│       ▼                 ▼                  ▼                   ▼      │
│  - Select Type     - Data Query       - Apply Style      - PDF        │
│  - Choose Params   - AI Analysis      - Charts           - PowerPoint │
│  - Set Language    - Recommendations  - Tables           - Word       │
│                                       - Formatting       - Excel      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## AI-Assisted Generation

### Content Generation

```
Input: Assessment Data + Organization Context + Language
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                      AI REPORT ENGINE                        │
├──────────────────────────────────────────────────────────────┤
│  1. Executive Summary Generation                             │
│     - Key findings                                           │
│     - Critical gaps                                          │
│     - Top recommendations                                    │
│                                                              │
│  2. Detailed Analysis                                        │
│     - Dimension-by-dimension breakdown                       │
│     - Strengths & weaknesses                                 │
│     - Industry benchmarking                                  │
│                                                              │
│  3. Recommendations                                          │
│     - Priority actions                                       │
│     - Implementation roadmap                                 │
│     - Resource estimates                                     │
│                                                              │
│  4. Visual Elements                                          │
│     - Radar charts                                           │
│     - Progress bars                                          │
│     - Comparison tables                                      │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
Output: Structured Report Content (JSON)
```

## Report Templates

### Assessment Report Template

```
┌──────────────────────────────────────────┐
│          [COMPANY LOGO]                  │
│                                          │
│    DIGITAL MATURITY ASSESSMENT           │
│           REPORT                         │
│                                          │
│    Company: [Organization Name]          │
│    Date: [Date]                          │
│    Framework: [DRD/SIRI/ADMA]            │
└──────────────────────────────────────────┘

1. EXECUTIVE SUMMARY
   - Overall Score: [X.X / 5.0]
   - Maturity Level: [Level Name]
   - Key Findings (3-5 bullets)

2. METHODOLOGY
   - Framework description
   - Assessment process

3. RESULTS BY DIMENSION
   [Radar Chart]

   3.1 [Dimension 1]: [Score]
       - Current state
       - Strengths
       - Gaps
       - Recommendations

   3.2 [Dimension 2]: [Score]
       ...

4. BENCHMARKING
   - Industry average comparison
   - Best-in-class comparison

5. ROADMAP
   - Quick wins (0-3 months)
   - Short-term (3-12 months)
   - Long-term (12+ months)

6. APPENDIX
   - Detailed responses
   - Evidence summary
```

## Export Formats

| Format         | Status   | Notes                        |
| -------------- | -------- | ---------------------------- |
| **PDF**        | ✅ Ready | Primary format, full styling |
| **PowerPoint** | 🔄 P1    | Slide deck for presentations |
| **Word**       | 🔄 P1    | Editable document            |
| **Excel**      | 🔄 P1    | Data export with charts      |

## Public Link Sharing

Reports can be shared via public link:

```
Link: https://app.consultinity.com/reports/public/{public_link_id}
Password: Optional password protection
Expiry: Configurable expiration date
Branding: Company logo + Consultinity branding
```

## Database Schema

### assessment_reports (from migration 248)

```sql
id TEXT PRIMARY KEY
assessment_id TEXT NOT NULL
organization_id TEXT NOT NULL
executive_summary TEXT
detailed_analysis TEXT -- JSON
recommendations TEXT -- JSON array
benchmark_data TEXT -- JSON
generated_by TEXT -- 'ai' or 'manual'
public_link_id TEXT
public_link_expires_at TIMESTAMP
public_link_password TEXT
```

### report_templates

```sql
id TEXT PRIMARY KEY
organization_id TEXT -- NULL for system templates
name TEXT NOT NULL
type TEXT NOT NULL -- 'assessment', 'project', 'portfolio', 'custom'
template_data TEXT NOT NULL -- JSON with sections, styling
is_default INTEGER DEFAULT 0
created_at TIMESTAMP
```

### report_exports

```sql
id TEXT PRIMARY KEY
report_id TEXT NOT NULL
format TEXT NOT NULL -- 'pdf', 'pptx', 'docx', 'xlsx'
file_path TEXT
file_size INTEGER
exported_by TEXT
exported_at TIMESTAMP
download_count INTEGER DEFAULT 0
```

## Gap Analysis

### GAP-REPORT-001: (Resolved) Exporty PDF/DOCX/PPTX są zaimplementowane w Report Builder

| Attribute    | Value                                     |
| ------------ | ----------------------------------------- |
| **Priority** | HIGH (historyczne)                        |
| **Effort**   | —                                         |
| **Impact**   | —                                         |

**Status (as-is, verified in code):**

- Report Builder export endpoints istnieją:
  - PDF: `GET /api/report-builder/:id/export/pdf`
  - DOCX: `GET /api/report-builder/:id/export/docx` (+ alias `/doc`)
  - PPTX: `GET /api/report-builder/:id/export/pptx`
- Baseline jakości: `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

---

### GAP-REPORT-002: (Resolved) Public link sharing jest zaimplementowane (2 równoległe mechanizmy)

| Attribute    | Value                             |
| ------------ | --------------------------------- |
| **Priority** | MEDIUM (historyczne)              |
| **Effort**   | —                                 |
| **Impact**   | —                                 |

**Status (as-is, verified in code):**

- **Report Builder sharing**:
  - `POST /api/report-builder/:id/share` (password + expiry + branding flags)
  - public viewer: `/shared/report/:token` (frontend) + public backend route
- **Legacy public snapshots**:
  - `POST /api/reports/:reportId/share`
  - `GET /api/reports/public/:linkToken` (+ password verify)
  - public viewer: `src/views/reports/PublicReportView.tsx`

**Uwaga (v3):** SSOT dla ujednolicenia share/export jest w `docs/product/REPORT_GENERATOR_V3.md` (rozdział “as-is subsystems + legacy”).

## API Endpoints

### Existing (partial)

| Method | Endpoint                      | Description     |
| ------ | ----------------------------- | --------------- |
| GET    | `/api/assessments/:id/report` | Get report data |

### To Add

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| POST   | `/api/reports/generate`           | Generate new report    |
| GET    | `/api/reports/:id`                | Get report             |
| POST   | `/api/reports/:id/export/:format` | Export to format       |
| POST   | `/api/reports/:id/share`          | Create public link     |
| GET    | `/api/reports/public/:linkId`     | Access public report   |
| GET    | `/api/reports/templates`          | List templates         |
| POST   | `/api/reports/templates`          | Create custom template |

## Multi-language Support

Reports should be generated in user's language:

```typescript
interface ReportGenerationParams {
  assessmentId: string;
  language: 'en' | 'pl' | 'de' | 'es' | 'ja' | 'ar';
  templateId?: string;
  includeAppendix?: boolean;
}
```

AI generates content in the requested language.

## Related Flows

- FLOW-ASSESSMENT-001: Assessment reports
- FLOW-PROJECT-001: Project reports
- FLOW-AI-001: AI content generation
