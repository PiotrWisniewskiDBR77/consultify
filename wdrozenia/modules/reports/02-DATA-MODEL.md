# Reports Module – Data Model

## Status: 🔨 W PLANOWANIU

---

## 📊 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA MODEL                                     │
│                                                                             │
│  ┌──────────────┐         ┌──────────────────┐         ┌────────────────┐  │
│  │ organizations│◄────────│     reports      │────────►│  assessments   │  │
│  └──────────────┘    1:N  └────────┬─────────┘   1:1   └────────────────┘  │
│                                    │                                        │
│                                    │ 1:N                                    │
│                                    ▼                                        │
│                           ┌──────────────────┐                              │
│                           │ report_sections  │                              │
│                           └──────────────────┘                              │
│                                                                             │
│  ┌──────────────┐         ┌──────────────────┐                              │
│  │    users     │◄────────│  report_sessions │                              │
│  └──────────────┘    N:M  └──────────────────┘                              │
│                                                                             │
│  ┌──────────────┐         ┌──────────────────┐                              │
│  │    users     │◄────────│ report_activity  │                              │
│  └──────────────┘    1:N  └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Tabele

### 1. `reports` – Główna tabela raportów

```sql
-- Migration: XXX_report_builder.sql

CREATE TABLE IF NOT EXISTS reports (
  -- Primary key
  id TEXT PRIMARY KEY,

  -- Organization scope
  organization_id TEXT NOT NULL,
  project_id TEXT,

  -- Source reference (polymorphic)
  source_type TEXT NOT NULL,  -- 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE'
  source_id TEXT NOT NULL,
  source_name TEXT,
  source_framework TEXT,  -- e.g., 'DRD', 'SIRI' for assessments

  -- Report metadata
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,  -- 'ASSESSMENT_DRD' | 'ASSESSMENT_SIRI' | etc.

  -- Template reference
  template_id TEXT,

  -- Configuration (JSON)
  config_json TEXT,  -- Global report config

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'DRAFT',
  -- Allowed: 'DRAFT', 'GENERATED', 'IN_REVIEW', 'APPROVED', 'UTILIZED'

  -- Ownership & timestamps
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,

  -- Workflow timestamps
  generated_at TIMESTAMP,
  finalized_at TIMESTAMP,
  submitted_at TIMESTAMP,  -- When submitted for review
  approved_at TIMESTAMP,
  approved_by TEXT,
  utilized_at TIMESTAMP,

  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_report_id TEXT,  -- For duplicates

  -- Export paths
  pdf_path TEXT,
  pptx_path TEXT,

  -- Generation metadata (JSON)
  generation_metadata TEXT,  -- tokens used, model, etc.

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (parent_report_id) REFERENCES reports(id),
  FOREIGN KEY (template_id) REFERENCES report_templates(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_organization ON reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_source ON reports(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
```

### 2. `report_sections` – Sekcje raportu

```sql
CREATE TABLE IF NOT EXISTS report_sections (
  -- Primary key
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,

  -- Section identity
  section_key TEXT NOT NULL,  -- Unique key within report (e.g., 'executive_summary', 'axis_1')
  section_type TEXT NOT NULL,  -- 'cover', 'summary', 'matrix', 'axis_analysis', etc.
  title TEXT NOT NULL,

  -- Ordering
  order_index INTEGER NOT NULL DEFAULT 0,

  -- Configuration
  enabled BOOLEAN DEFAULT true,
  required BOOLEAN DEFAULT false,

  -- Options (affects generation)
  length TEXT DEFAULT 'medium',  -- 'short' | 'medium' | 'long'
  language TEXT DEFAULT 'business',  -- 'technical' | 'business' | 'general'
  custom_prompt TEXT,  -- Additional AI guidance

  -- Content
  generated_content TEXT,  -- AI-generated content (markdown/JSON)
  edited_content TEXT,  -- User-edited content (takes precedence)
  content_format TEXT DEFAULT 'markdown',  -- 'markdown' | 'json' | 'html'

  -- Generation metadata
  generated_at TIMESTAMP,
  tokens_used INTEGER,

  -- Edit metadata
  edited_at TIMESTAMP,
  edited_by TEXT,

  -- Repeat info (for axis/area sections)
  repeat_for TEXT,  -- NULL | 'axis' | 'area'
  repeat_key TEXT,  -- e.g., '1' for axis 1, '1A' for area 1A
  repeat_name TEXT,  -- e.g., 'Digital Processes'

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (edited_by) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_sections_report ON report_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_report_sections_key ON report_sections(report_id, section_key);
CREATE INDEX IF NOT EXISTS idx_report_sections_order ON report_sections(report_id, order_index);
```

### 3. `report_templates` – Szablony raportów

```sql
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,  -- NULL for system templates

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,  -- 'ASSESSMENT' | 'INTERVIEW' | etc.
  report_type TEXT,  -- 'ASSESSMENT_DRD' | etc. (NULL for generic)

  -- Template configuration (JSON)
  sections_json TEXT NOT NULL,  -- SectionDefinition[]
  default_options_json TEXT,  -- Default options

  -- Flags
  is_system BOOLEAN DEFAULT false,  -- System-provided template
  is_default BOOLEAN DEFAULT false,  -- Default for this type
  is_public BOOLEAN DEFAULT false,  -- Visible to other orgs

  -- Ownership
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(source_type, report_type);
```

### 4. `report_sessions` – Dynamiczne menu (otwarte raporty)

```sql
CREATE TABLE IF NOT EXISTS report_sessions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,

  -- Session state
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Navigation state (JSON)
  navigation_state TEXT,  -- Current step, section, scroll position

  UNIQUE(report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_sessions_user ON report_sessions(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_report_sessions_opened ON report_sessions(opened_at DESC);
```

### 5. `report_activity` – Activity log

```sql
CREATE TABLE IF NOT EXISTS report_activity (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,

  -- Activity details
  action_type TEXT NOT NULL,
  -- 'CREATED', 'UPDATED', 'GENERATED', 'SECTION_GENERATED', 'SECTION_EDITED',
  -- 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPORTED', 'DUPLICATED', 'UTILIZED'

  action_by TEXT NOT NULL,
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Details (JSON)
  metadata TEXT,  -- section_id, old_status, new_status, etc.

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (action_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_activity_report ON report_activity(report_id);
CREATE INDEX IF NOT EXISTS idx_report_activity_time ON report_activity(action_at DESC);
```

### 6. `report_comments` – Komentarze review (opcjonalne)

```sql
CREATE TABLE IF NOT EXISTS report_comments (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  section_id TEXT,  -- NULL for report-level comments

  -- Comment content
  content TEXT NOT NULL,
  comment_type TEXT DEFAULT 'COMMENT',  -- 'COMMENT' | 'SUGGESTION' | 'ISSUE'

  -- Threading
  parent_comment_id TEXT,

  -- Status
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by TEXT,

  -- Ownership
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES report_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES report_comments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_section ON report_comments(section_id);
```

---

## 📦 TypeScript Types

```typescript
// ==========================================
// ENUMS
// ==========================================

type ReportSourceType = 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE';

type ReportStatus =
  | 'DRAFT' // Configuration phase
  | 'GENERATED' // Content generated
  | 'IN_REVIEW' // Submitted for review
  | 'APPROVED' // Approved by reviewer
  | 'UTILIZED'; // Used for initiatives/other

type SectionType =
  | 'cover'
  | 'summary'
  | 'methodology'
  | 'matrix'
  | 'axis_analysis'
  | 'area_analysis'
  | 'list'
  | 'recommendations'
  | 'action_plan'
  | 'appendix'
  | 'custom';

type ContentLength = 'short' | 'medium' | 'long';
type ContentLanguage = 'technical' | 'business' | 'general';
type ContentFormat = 'markdown' | 'json' | 'html';

// ==========================================
// MAIN ENTITIES
// ==========================================

interface Report {
  id: string;
  organizationId: string;
  projectId?: string;

  // Source
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string;
  sourceFramework?: string;

  // Metadata
  title: string;
  description?: string;
  reportType: string;

  // Template
  templateId?: string;

  // Configuration
  config?: ReportConfig;

  // Status
  status: ReportStatus;

  // Ownership
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;

  // Workflow
  generatedAt?: string;
  finalizedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  utilizedAt?: string;

  // Version
  version: number;
  parentReportId?: string;

  // Export
  pdfPath?: string;
  pptxPath?: string;

  // Relations (populated)
  sections?: ReportSection[];
  createdByName?: string;
  approvedByName?: string;
}

interface ReportSection {
  id: string;
  reportId: string;

  // Identity
  sectionKey: string;
  sectionType: SectionType;
  title: string;

  // Ordering
  orderIndex: number;

  // Configuration
  enabled: boolean;
  required: boolean;

  // Options
  length: ContentLength;
  language: ContentLanguage;
  customPrompt?: string;

  // Content
  generatedContent?: string;
  editedContent?: string;
  contentFormat: ContentFormat;

  // Generation
  generatedAt?: string;
  tokensUsed?: number;

  // Edit
  editedAt?: string;
  editedBy?: string;

  // Repeat info
  repeatFor?: 'axis' | 'area';
  repeatKey?: string;
  repeatName?: string;
}

interface ReportConfig {
  defaultLength: ContentLength;
  defaultLanguage: ContentLanguage;
  includeAppendix: boolean;
  customBranding?: {
    logo?: string;
    colors?: {
      primary: string;
      secondary: string;
    };
  };
}

// ==========================================
// TEMPLATES
// ==========================================

interface ReportTemplate {
  id: string;
  organizationId?: string;

  name: string;
  description?: string;
  sourceType: ReportSourceType;
  reportType?: string;

  sections: SectionDefinition[];
  defaultOptions: {
    length: ContentLength;
    language: ContentLanguage;
  };

  isSystem: boolean;
  isDefault: boolean;
  isPublic: boolean;

  createdBy?: string;
  createdAt: string;
}

interface SectionDefinition {
  id: string;
  key: string;
  title: string;
  type: SectionType;

  required: boolean;
  order: number;

  repeatFor?: 'axis' | 'area';

  defaultOptions: {
    length: ContentLength;
    language: ContentLanguage;
  };

  generationConfig: {
    systemPrompt: string;
    userPromptTemplate: string;
    outputFormat: ContentFormat;
  };
}

// ==========================================
// SESSION & ACTIVITY
// ==========================================

interface ReportSession {
  id: string;
  reportId: string;
  userId: string;
  organizationId: string;

  openedAt: string;
  closedAt?: string;
  lastActivityAt: string;

  navigationState?: {
    currentStep: number;
    currentSectionId?: string;
    scrollPosition?: number;
  };

  // Populated
  report?: Report;
}

interface ReportActivity {
  id: string;
  reportId: string;

  actionType: string;
  actionBy: string;
  actionAt: string;

  metadata?: Record<string, unknown>;

  // Populated
  actionByName?: string;
}

// ==========================================
// API TYPES
// ==========================================

interface CreateReportRequest {
  sourceType: ReportSourceType;
  sourceId: string;
  title: string;
  description?: string;
  templateId?: string;
}

interface UpdateReportRequest {
  title?: string;
  description?: string;
}

interface UpdateSectionConfigRequest {
  sections: Array<{
    sectionKey: string;
    enabled?: boolean;
    orderIndex?: number;
    length?: ContentLength;
    language?: ContentLanguage;
    customPrompt?: string;
  }>;
}

interface GenerateReportRequest {
  regenerateSections?: string[]; // Section keys to regenerate
}

interface GenerateSectionRequest {
  customPrompt?: string;
}

interface UpdateSectionContentRequest {
  content: string;
}

interface ExportReportRequest {
  format: 'pdf' | 'pptx';
  options?: {
    template?: string;
    includeComments?: boolean;
  };
}

// ==========================================
// RESPONSE TYPES
// ==========================================

interface ReportListResponse {
  reports: Report[];
  total: number;
  page: number;
  pageSize: number;
}

interface ReportDetailResponse extends Report {
  sections: ReportSection[];
  sourceData?: unknown; // Simplified source data for preview
}

interface GenerationProgressResponse {
  reportId: string;
  status: 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  currentSection?: string;
  completedSections: string[];
  error?: string;
}

interface ExportResponse {
  format: 'pdf' | 'pptx';
  path: string;
  filename: string;
  downloadUrl: string;
  size: number;
  generatedAt: string;
}
```

---

## 🔄 Status Transitions

### Allowed Transitions

```typescript
const REPORT_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT: ['GENERATED'],
  GENERATED: ['DRAFT', 'IN_REVIEW'],
  IN_REVIEW: ['GENERATED', 'APPROVED'],
  APPROVED: ['UTILIZED'],
  UTILIZED: [],
};
```

### Transition Rules

| From      | To        | Requirements                    | Actions                            |
| --------- | --------- | ------------------------------- | ---------------------------------- |
| DRAFT     | GENERATED | All required sections enabled   | Generate content                   |
| GENERATED | DRAFT     | -                               | Clear generated content (optional) |
| GENERATED | IN_REVIEW | All sections generated          | Set submittedAt                    |
| IN_REVIEW | GENERATED | -                               | Set for re-generation              |
| IN_REVIEW | APPROVED  | Reviewer permission             | Set approvedAt, approvedBy         |
| APPROVED  | UTILIZED  | Initiative generation requested | Set utilizedAt                     |

---

## 📊 Queries

### List reports with filters

```sql
SELECT
  r.*,
  u.first_name || ' ' || u.last_name as created_by_name,
  a.first_name || ' ' || a.last_name as approved_by_name,
  (SELECT COUNT(*) FROM report_sections WHERE report_id = r.id AND enabled = true) as section_count
FROM reports r
LEFT JOIN users u ON r.created_by = u.id
LEFT JOIN users a ON r.approved_by = a.id
WHERE r.organization_id = ?
  AND (? IS NULL OR r.status = ?)
  AND (? IS NULL OR r.source_type = ?)
  AND (? IS NULL OR r.title LIKE '%' || ? || '%')
ORDER BY r.created_at DESC
LIMIT ? OFFSET ?
```

### Get open sessions (dynamic menu)

```sql
SELECT
  s.*,
  r.title as report_title,
  r.status as report_status,
  r.source_type,
  r.source_framework
FROM report_sessions s
JOIN reports r ON s.report_id = r.id
WHERE s.user_id = ?
  AND s.organization_id = ?
  AND s.closed_at IS NULL
ORDER BY s.last_activity_at DESC
LIMIT 6
```

### Get report with sections

```sql
SELECT
  r.*,
  json_group_array(
    json_object(
      'id', rs.id,
      'sectionKey', rs.section_key,
      'sectionType', rs.section_type,
      'title', rs.title,
      'orderIndex', rs.order_index,
      'enabled', rs.enabled,
      'required', rs.required,
      'length', rs.length,
      'language', rs.language,
      'customPrompt', rs.custom_prompt,
      'generatedContent', rs.generated_content,
      'editedContent', rs.edited_content,
      'generatedAt', rs.generated_at,
      'editedAt', rs.edited_at
    )
  ) as sections
FROM reports r
LEFT JOIN report_sections rs ON r.id = rs.report_id
WHERE r.id = ?
GROUP BY r.id
```

---

## 📚 Referencje

- `00-OVERVIEW.md` - Przegląd modułu
- `01-ARCHITECTURE.md` - Architektura
- `backend/01-api-list.md` - Lista API
