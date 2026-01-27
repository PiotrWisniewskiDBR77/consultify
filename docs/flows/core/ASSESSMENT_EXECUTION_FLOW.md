# FLOW-ASSESSMENT-001: Assessment Execution (Canonical)

> **ID:** FLOW-ASSESSMENT-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value                                   |
| ------------------------- | --------------------------------------- |
| **Completeness**          | 80%                                     |
| **Gaps Identified**       | 3                                       |
| **Implementation Status** | Partially implemented, needs extensions |

## Purpose

Assessment is the beginning of a transformation engagement. Users complete a maturity assessment, receive an assessment report, and generate **draft initiatives** that enter the initiative lifecycle.

Canonical references:
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`

## Supported Frameworks

| Framework    | Full Name                             | Type                   | Status            |
| ------------ | ------------------------------------- | ---------------------- | ----------------- |
| **SIRI**     | Smart Industry Readiness Index        | Industry 4.0           | Licencjonowane    |
| **ADMA**     | Advanced Manufacturing Assessment     | Manufacturing          | Licencjonowane    |
| **DRD**      | Digital Readiness Diagnosis           | Digital Transformation | DBR77 Proprietary |
| **Lean 4.0** | Lean Assessment 4.0                   | Lean + Digital         | DBR77 Adaptation  |
| **CMMI**     | Capability Maturity Model Integration | Process Maturity       | Standard          |

## Assessment Flow

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      ASSESSMENT LIFECYCLE                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    ┌───────────┐    ┌──────────┐    ┌────────────────┐ │
│  │ CREATE  │───►│ IN_PROGRESS│───►│ COMPLETED │───►│ REPORT_READY │ │
│  └─────────┘    └───────────┘    └──────────┘    └───────┬────────┘ │
│                                                          │          │
│                                                          ▼          │
│                                               ┌──────────────────┐  │
│                                               │ INITIATIVES_GEN  │  │
│                                               └──────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Output: draft initiatives (one object, one lifecycle)
The output of `INITIATIVES_GEN` is a set of **Initiative** objects in **DRAFT** state.

Rules:
- Assessment produces an **Assessment Report** (Draft → Review → Final) and initiatives are created from that report.
- Initiatives then progress through the simplified status model and decision gates (see `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`).

## Assessment Structure

### Generic Structure (all frameworks)

```
Assessment
├── Metadata (name, description, framework, project)
├── Dimensions (varies by framework)
│   ├── Dimension 1
│   │   ├── Subdimension 1.1
│   │   │   ├── Question 1.1.1
│   │   │   │   ├── Answer (1-5 scale)
│   │   │   │   ├── Evidence (attachments)
│   │   │   │   └── AI Notes
│   │   │   └── Question 1.1.2
│   │   └── Subdimension 1.2
│   └── Dimension 2
├── Scores (calculated)
│   ├── Dimension Scores
│   ├── Overall Score
│   └── Maturity Level
├── Report
│   ├── Executive Summary
│   ├── Detailed Analysis
│   ├── Recommendations
│   └── Benchmarks
└── Generated Initiatives (drafts)
```

### DRD Dimensions

1. **Strategy & Leadership** - Strategic alignment, leadership commitment
2. **Organization & Culture** - Change readiness, digital culture
3. **Processes** - Process digitization, automation potential
4. **Technology** - IT infrastructure, data management
5. **People & Skills** - Digital competencies, training needs
6. **Data & Analytics** - Data maturity, analytics capability

### SIRI Dimensions

1. **Operations** - Vertical integration, horizontal integration
2. **Supply Chain** - Supplier connectivity, customer connectivity
3. **Product Lifecycle** - Design digitization, smart products
4. **Strategy & Governance** - Roadmap, investment, leadership

## Sequence Diagram: Assessment → Initiatives

```text
┌──────┐    ┌───────────┐    ┌──────────────┐    ┌────────┐    ┌────┐
│ User │    │ Assessment│    │  AI Analyzer │    │ Report │    │ DB │
│      │    │  Service  │    │              │    │ Service│    │    │
└──┬───┘    └─────┬─────┘    └──────┬───────┘    └───┬────┘    └──┬─┘
   │              │                 │                │            │
   │ Start        │                 │                │            │
   │ Assessment   │                 │                │            │
   │─────────────►│ Create          │                │            │
   │              │────────────────────────────────────────────►│
   │◄─────────────│                 │                │            │
   │              │                 │                │            │
   │ Answer       │                 │                │            │
   │ Question     │                 │                │            │
   │─────────────►│ Save Answer     │                │            │
   │              │────────────────────────────────────────────►│
   │              │                 │                │            │
   │              │ AI Assist       │                │            │
   │              │────────────────►│                │            │
   │              │◄────────────────│                │            │
   │◄─────────────│ {suggestions}   │                │            │
   │              │                 │                │            │
   │ Complete     │                 │                │            │
   │ Assessment   │                 │                │            │
   │─────────────►│ Finalize        │                │            │
   │              │────────────────────────────────────────────►│
   │              │                 │                │            │
   │              │ Generate Report │                │            │
   │              │─────────────────────────────────►│            │
   │              │                 │ AI Analysis    │            │
   │              │                 │◄───────────────│            │
   │              │                 │───────────────►│            │
   │              │◄─────────────────────────────────│            │
   │◄─────────────│ {report}        │                │            │
   │              │                 │                │            │
   │ Generate     │                 │                │            │
   │ Initiatives  │                 │                │            │
   │─────────────►│                 │                │            │
   │              │────────────────►│                │            │
   │              │◄────────────────│                │            │
   │              │ {draft_initiatives: Initiative[DRAFT]}        │
   │◄─────────────│                 │                │            │
```

## AI Integration

### 1. During Assessment

- **Question Clarification**: AI explains scoring criteria
- **Evidence Suggestions**: AI suggests what evidence to provide
- **Real-time Feedback**: AI comments on answers as user progresses

### 2. Report Generation

- **Gap Analysis**: AI identifies biggest gaps
- **Recommendations**: AI suggests priority areas
- **Benchmarking**: Compare with industry averages

### 3. Initiative Generation

- **Draft Initiatives**: AI proposes 5-15 initiatives based on gaps
- **Prioritization**: AI suggests priority based on impact/effort
- **Dependencies**: AI identifies initiative dependencies

## PDF Import Feature

External audits can be imported:

```
┌─────────────────────────────────────────────────┐
│           PDF IMPORT WORKFLOW                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Upload PDF ──► AI Parse ──► Extract Data       │
│                    │                            │
│                    ▼                            │
│           ┌───────────────┐                     │
│           │ Mapping UI    │                     │
│           │ - Dimensions  │                     │
│           │ - Scores      │                     │
│           │ - Findings    │                     │
│           └───────┬───────┘                     │
│                   │                             │
│                   ▼                             │
│           Create Assessment ──► Generate        │
│           (source: pdf_import)    Initiatives   │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Database Schema

### assessments

```sql
id TEXT PRIMARY KEY
organization_id TEXT NOT NULL
project_id TEXT
name TEXT NOT NULL
description TEXT
framework TEXT NOT NULL -- 'DRD', 'SIRI', 'ADMA', 'LEAN40', 'CMMI'
status TEXT DEFAULT 'DRAFT'
overall_score REAL
maturity_level INTEGER
source_type TEXT -- 'manual', 'pdf_import', 'consultant'
source_reference TEXT
started_at TIMESTAMP
completed_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

### assessment_responses

```sql
id TEXT PRIMARY KEY
assessment_id TEXT NOT NULL
dimension_id TEXT NOT NULL
question_id TEXT NOT NULL
score INTEGER -- 1-5
evidence TEXT
evidence_attachments TEXT -- JSON array of file IDs
notes TEXT
ai_feedback TEXT
answered_by TEXT
answered_at TIMESTAMP
```

### assessment_dimension_scores

```sql
id TEXT PRIMARY KEY
assessment_id TEXT NOT NULL
dimension_id TEXT NOT NULL
dimension_name TEXT
score REAL
max_score REAL
weight REAL DEFAULT 1.0
calculated_at TIMESTAMP
```

## Gap Analysis

### GAP-ASSESSMENT-001: Missing full integration with Initiative Generation

| Attribute    | Value                                  |
| ------------ | -------------------------------------- |
| **Priority** | HIGH                                   |
| **Effort**   | 8h                                     |
| **Impact**   | Kluczowa funkcja - raport → inicjatywy |

**Solution:**

- Service: `generateInitiativesFromAssessment(assessmentId)`
- AI analyzes gaps and proposes initiatives
- Draft initiatives created with `source_type: 'assessment'`
- Ensure downstream governance gates are enforced (PROMOTE/APPROVE/SCHEDULE)

---

### GAP-ASSESSMENT-002: Brak PDF Import

| Attribute    | Value                                      |
| ------------ | ------------------------------------------ |
| **Priority** | HIGH                                       |
| **Effort**   | 12h                                        |
| **Impact**   | Zewnętrzne audyty nie mogą być importowane |

**Solution:**

- PDF parsing service (use pdf-parse library)
- AI extraction of scores and findings
- Mapping UI for manual adjustments
- Create assessment with extracted data

---

### GAP-ASSESSMENT-003: Brak AI Assistance w trakcie assessment

| Attribute    | Value                         |
| ------------ | ----------------------------- |
| **Priority** | MEDIUM                        |
| **Effort**   | 6h                            |
| **Impact**   | Użytkownik nie ma wsparcia AI |

**Solution:**

- Real-time AI chat during assessment
- Question-specific suggestions
- Evidence recommendations

## API Endpoints

### Existing

| Method | Endpoint                          | Description       |
| ------ | --------------------------------- | ----------------- |
| GET    | `/api/assessments/my-assessments` | List assessments  |
| GET    | `/api/assessments/:id`            | Get assessment    |
| POST   | `/api/assessments`                | Create assessment |
| PUT    | `/api/assessments/:id`            | Update assessment |
| DELETE | `/api/assessments/:id`            | Delete assessment |

### To Add

| Method | Endpoint                                     | Description                  |
| ------ | -------------------------------------------- | ---------------------------- |
| POST   | `/api/assessments/:id/complete`              | Complete and generate report |
| POST   | `/api/assessments/:id/generate-initiatives`  | Generate draft initiatives   |
| POST   | `/api/assessments/import-pdf`                | Import external audit PDF    |
| GET    | `/api/assessments/:id/ai-suggestions`        | Get AI suggestions           |
| POST   | `/api/assessments/:id/responses/:questionId` | Save question response       |

## Related Flows

- FLOW-INITIATIVE-001: Initiatives generated from assessments
- FLOW-REPORT-001: Assessment reports
- FLOW-AI-001: AI assistance during assessment
- FLOW-PROJECT-001: Assessments belong to projects
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
