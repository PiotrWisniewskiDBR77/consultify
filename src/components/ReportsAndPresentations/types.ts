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
  | 'templates';

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

export type TemplateType = 'report' | 'presentation';
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
export type TemplateScope = 'application' | 'organization';
export type TemplateStatus = 'active' | 'archived' | 'draft';

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
  originRuntime: 'report' | 'presentation' | 'sheet' | 'native_artifact';
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

export interface ArtifactGovernanceSummary {
  visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared' | 'demo';
  publishState?: string | null;
  publishReviewers?: string[];
  reviewGateCount?: number;
  projectId?: string | null;
  accessGrants?: ArtifactAccessGrantItem[];
  originLinks?: ArtifactOriginLinkItem[];
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
    color: 'text-purple-400',
    dotColor: 'bg-purple-400',
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
  custom: { label: 'Custom', labelPl: 'Własny', color: 'text-slate-400', dotColor: 'bg-slate-400' },
};

export const REPORT_STATUS_META: Record<
  ReportStatus,
  { label: string; labelPl: string; dotColor: string }
> = {
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400' },
  ready: { label: 'Ready', labelPl: 'Gotowy', dotColor: 'bg-emerald-400' },
  exported: { label: 'Exported', labelPl: 'Wyeksportowany', dotColor: 'bg-blue-400' },
  archived: { label: 'Archived', labelPl: 'Zarchiwizowany', dotColor: 'bg-slate-500' },
};

export const PRESENTATION_STATUS_META: Record<
  PresentationStatus,
  { label: string; labelPl: string; dotColor: string }
> = {
  draft: { label: 'Draft', labelPl: 'Szkic', dotColor: 'bg-slate-400' },
  generated: { label: 'Generated', labelPl: 'Wygenerowana', dotColor: 'bg-blue-400' },
  editing: { label: 'Editing', labelPl: 'Edycja', dotColor: 'bg-amber-400' },
  ready: { label: 'Ready', labelPl: 'Gotowa', dotColor: 'bg-emerald-400' },
  shared: { label: 'Shared', labelPl: 'Udostępniona', dotColor: 'bg-purple-400' },
  archived: { label: 'Archived', labelPl: 'Zarchiwizowana', dotColor: 'bg-slate-500' },
};

export const SOURCE_TYPE_META: Record<
  PresentationSourceType,
  { label: string; labelPl: string; color: string }
> = {
  tool: { label: 'Tool', labelPl: 'Narzędzie', color: 'text-emerald-400' },
  assessment: { label: 'Assessment', labelPl: 'Ocena', color: 'text-purple-400' },
  finance: { label: 'Finance', labelPl: 'Finanse', color: 'text-blue-400' },
  upload: { label: 'Upload', labelPl: 'Przesłane', color: 'text-amber-400' },
};

export const TEMPLATE_TYPE_META: Record<
  TemplateType,
  { label: string; labelPl: string; dotColor: string }
> = {
  report: { label: 'Report', labelPl: 'Raport', dotColor: 'bg-blue-400' },
  presentation: { label: 'Presentation', labelPl: 'Prezentacja', dotColor: 'bg-purple-400' },
};
