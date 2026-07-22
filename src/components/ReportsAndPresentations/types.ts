/**
 * Reports & Presentations Hub — Types
 * V8.1 Outputs Library taxonomy (same shell; route alias /presentations).
 */

export type RapTab =
  | 'outputs_all'
  | 'outputs_mine'
  | 'outputs_review'
  | 'outputs_documents'
  | 'presentations'
  | 'outputs_sheets'
  | 'templates'
  // C2 (2026-07-22): Architekt szablonów Prezentacji — zakładka widoczna TYLKO
  // przy fladze isDeckArchitectEnabled() (default OFF); przy OFF hub bez zmian.
  | 'template_architect'
  // Gen. Excel nav (2026-07-22): rejestr parametrycznych szablonów Excela —
  // zakładka widoczna TYLKO przy fladze isWorkbookTemplatesEnabled() (default
  // OFF); przy OFF hub bez zmian.
  | 'workbook_templates';
// NOTE (#83a): 'outputs_data' retired as a top-level Menu 2 tab — Data Sources
// moved to a sub-tab inside Sheets (SheetsTabContent). Legacy `?tab=data` deep
// links now resolve to 'outputs_sheets' via outputsLibraryTabQuery.ts.

/** Canonical registry row flattened for All / Mine / Needs review tabs */
export interface UnifiedOutputRow {
  kind: 'document' | 'presentation' | 'sheet';
  originRecordId: string;
  artifactId?: string;
  title: string;
  /** Normalized for command-row chips (draft | ready | shared | archived | …) */
  statusKey: string;
  owner: string;
  updatedAt: string;
  reportType?: string;
  sourceType?: string;
  sourceInitiativeId?: string;
  slideCount?: number;
  exportFormats: string[];
  governance?: ArtifactGovernanceSummary;
}

export type TemplateType = 'report' | 'presentation' | 'sheet';
export type TemplateCategory =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'executive_update'
  | 'project_kickoff'
  | 'initiative_review'
  | 'financial_review'
  | 'assessment_results'
  | 'custom';
export type TemplateScope = 'personal' | 'application' | 'organization';
export type TemplateStatus = 'active' | 'deprecated' | 'archived' | 'draft';

export type ReportType = 'R1' | 'R2' | 'R3' | 'R4' | 'custom';
export type ReportStatus = 'draft' | 'ready' | 'exported' | 'archived';

export type PresentationSourceType = 'tool' | 'assessment' | 'finance' | 'upload';
export type PresentationStatus =
  | 'draft'
  | 'generated'
  | 'editing'
  | 'ready'
  | 'shared'
  | 'archived';

export interface ArtifactSourceRef {
  artifact_id: string;
  artifact_type: string;
  artifact_name: string;
}

export interface ArtifactOriginLinkItem {
  linkId: string;
  artifactId: string;
  organizationId: string;
  originRuntime:
    | 'report'
    | 'presentation'
    | 'sheet'
    | 'native_artifact'
    | 'report_template'
    | 'presentation_template';
  originRecordId: string;
  isPrimaryOrigin: boolean;
  createdAt: string;
}

export interface ArtifactAccessGrantItem {
  grantId: string;
  artifactId: string;
  organizationId: string;
  grantKind: 'user' | 'role';
  userId: string | null;
  roleKey: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ArtifactExportTraceItem {
  exportId: string;
  artifactId: string;
  organizationId: string;
  format: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

/**
 * P2.6 — compact deck quality scorecard surfaced on presentation list rows.
 * Derived server-side from the existing checkDeckQualityGates output (score +
 * A-F grade + top failing gates); present only for presentation decks that are
 * readable. Absent → the list badge falls back to `validationState`.
 */
export interface DeckListScorecard {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  result: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  p0: number;
  p1: number;
  p2: number;
  canExport: boolean;
  topIssues: string[];
}

export interface ArtifactGovernanceSummary {
  visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared' | 'demo';
  publishState?: string | null;
  validationState?: 'validated' | 'pending' | 'attention_required' | null;
  /** P2.6 — deck quality scorecard (presentation decks only; see DeckListScorecard). */
  deckScorecard?: DeckListScorecard | null;
  validationChecks?: Array<{
    id: string;
    status: 'passed' | 'pending' | 'failed';
    message: string;
  }>;
  publishReviewers?: string[];
  reviewGateCount?: number;
  projectId?: string | null;
  executionRunId?: string | null;
  executionState?: string | null;
  contextSnapshotId?: string | null;
  canonicalHome?: string | null;
  lastTransitionAt?: string | null;
  sourceRefs?: unknown[];
  originSummary?: Record<string, unknown> | null;
  openPath?: string | null;
  exportPath?: string | null;
  authority?: string | null;
  manageAccessPath?: string | null;
  canManageAccess?: boolean;
  exportHistory?: ArtifactExportTraceItem[];
  reviewAuthority?: 'artifact_review';
  executionAuthority?: 'execution_spine';
  accessGrants?: ArtifactAccessGrantItem[];
  originLinks?: ArtifactOriginLinkItem[];
  lineagePaths?: {
    runPath: string;
    toolUsagePath: string;
    outputsPath: string;
  } | null;
}

export interface TemplateItem {
  id: string;
  title: string;
  description?: string;
  type: TemplateType;
  category: TemplateCategory;
  scope: TemplateScope;
  status: TemplateStatus;
  updatedAt: string;
  createdBy: string;
  slideCount?: number;
  sectionCount?: number;
  deprecationReason?: string;
  migrationHint?: string;
  /** Structured pointer to the replacement template artifact */
  replacedByArtifactId?: string;
  governance?: ArtifactGovernanceSummary | null;
  [key: string]: unknown;
}

export interface ReportItem {
  id: string;
  artifactId?: string;
  title: string;
  reportType: ReportType;
  status: ReportStatus;
  owner: string;
  goal?: string;
  communicationRegister?: string;
  confidentiality?: string;
  periodFrom?: string;
  periodTo?: string;
  createdAt: string;
  updatedAt: string;
  exportFormats: string[];
  sourceRefs?: Array<string | ArtifactSourceRef>;
  governance?: ArtifactGovernanceSummary;
  [key: string]: unknown;
}

export interface PresentationItem {
  id: string;
  artifactId?: string;
  title: string;
  sourceType: PresentationSourceType;
  owner: string;
  status: PresentationStatus;
  presentationMode?: 'show' | 'document' | 'briefing' | 'workshop' | string;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
  thumbnailUrl?: string;
  exportFormats: string[];
  sourceId?: string;
  sourceRefs?: ArtifactSourceRef[];
  governance?: ArtifactGovernanceSummary;
  [key: string]: unknown;
}

export const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; labelPl: string; color: string; dotColor: string }
> = {
  R1: {
    label: 'Weekly Execution',
    labelPl: 'Raport tygodniowy',
    color: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  R2: {
    label: 'Steering Committee',
    labelPl: 'Komitet sterujący',
    color: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  R3: {
    label: 'Benefits Tracking',
    labelPl: 'Śledzenie korzyści',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  R4: {
    label: 'Portfolio Overview',
    labelPl: 'Przegląd portfela',
    color: 'text-amber-400',
    dotColor: 'bg-amber-400',
  },
  custom: { label: 'Custom', labelPl: 'Własny', color: 'text-slate-600', dotColor: 'bg-slate-400' },
};

export type StatusChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const REPORT_STATUS_META: Record<
  ReportStatus,
  { label: string; labelPl: string; dotColor: string; tone: StatusChipTone }
> = {
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400', tone: 'neutral' },
  ready: { label: 'Ready', labelPl: 'Gotowy', dotColor: 'bg-emerald-400', tone: 'success' },
  exported: {
    label: 'Exported',
    labelPl: 'Wyeksportowany',
    dotColor: 'bg-blue-400',
    tone: 'info',
  },
  archived: {
    label: 'Archived',
    labelPl: 'Zarchiwizowany',
    dotColor: 'bg-slate-500',
    tone: 'neutral',
  },
};

export const PRESENTATION_STATUS_META: Record<
  PresentationStatus,
  { label: string; labelPl: string; dotColor: string; tone: StatusChipTone }
> = {
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400', tone: 'neutral' },
  generated: {
    label: 'Generated',
    labelPl: 'Wygenerowana',
    dotColor: 'bg-blue-400',
    tone: 'info',
  },
  editing: { label: 'Editing', labelPl: 'Edycja', dotColor: 'bg-amber-400', tone: 'warning' },
  ready: { label: 'Ready', labelPl: 'Gotowa', dotColor: 'bg-emerald-400', tone: 'success' },
  shared: { label: 'Shared', labelPl: 'Udostępniona', dotColor: 'bg-blue-400', tone: 'info' },
  archived: {
    label: 'Archived',
    labelPl: 'Zarchiwizowana',
    dotColor: 'bg-slate-500',
    tone: 'neutral',
  },
};

export const SOURCE_TYPE_META: Record<
  PresentationSourceType,
  { label: string; labelPl: string; color: string }
> = {
  tool: { label: 'Tool', labelPl: 'Narzędzie', color: 'text-emerald-400' },
  assessment: { label: 'Assessment', labelPl: 'Ocena', color: 'text-blue-400' },
  finance: { label: 'Finance', labelPl: 'Finanse', color: 'text-blue-400' },
  upload: { label: 'Upload', labelPl: 'Przesłane', color: 'text-amber-400' },
};

export const TEMPLATE_TYPE_META: Record<
  TemplateType,
  { label: string; labelPl: string; dotColor: string }
> = {
  report: { label: 'Report', labelPl: 'Raport', dotColor: 'bg-blue-400' },
  sheet: { label: 'Sheet', labelPl: 'Tabela', dotColor: 'bg-emerald-400' },
  presentation: { label: 'Presentation', labelPl: 'Prezentacja', dotColor: 'bg-blue-400' },
};

export const TEMPLATE_STATUS_META: Record<
  TemplateStatus,
  { label: string; labelPl: string; dotColor: string; tone: StatusChipTone }
> = {
  active: { label: 'Active', labelPl: 'Aktywny', dotColor: 'bg-emerald-400', tone: 'success' },
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400', tone: 'neutral' },
  deprecated: {
    label: 'Deprecated',
    labelPl: 'Wycofany',
    dotColor: 'bg-amber-500',
    tone: 'warning',
  },
  archived: {
    label: 'Archived',
    labelPl: 'Zarchiwizowany',
    dotColor: 'bg-slate-500',
    tone: 'neutral',
  },
};
