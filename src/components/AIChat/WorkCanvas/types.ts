export type WorkCanvasKind =
  | 'markdown'
  | 'table'
  | 'checklist'
  | 'research'
  | 'document'
  | 'sheet'
  | 'deck'
  | 'decision';

export type WorkCanvasTarget =
  | 'note'
  | 'table'
  | 'idea'
  | 'initiative'
  | 'task'
  | 'project_brief'
  | 'decision'
  | 'research_report'
  | 'client_deliverable'
  | 'kpi_roi_artifact';

export type WorkCanvasSaveState = 'unsaved' | 'saving' | 'saved' | 'failed';

export type WorkCanvasLifecycleState = 'draft' | 'in_review' | 'approved' | 'finalized';

export type WorkCanvasDirtyState = 'clean' | 'dirty' | 'stale' | 'conflicted';

export type WorkCanvasVisibility = 'private' | 'project' | 'organization' | 'external';

export type WorkCanvasAuditStatus = 'not_required' | 'pending' | 'recorded' | 'failed';

export type WorkCanvasState =
  | 'empty'
  | 'draft'
  | 'saving'
  | 'saved'
  | 'research_running'
  | 'artifact_ready'
  | 'conversion_pending'
  | 'converted'
  | 'error';

export interface WorkCanvasSource {
  id: string;
  label: string;
  url?: string;
  confidence?: number;
}

export interface WorkCanvasProvenance {
  conversationId?: string | null;
  artifactRunId?: string | null;
  artifactId?: string | null;
  researchSessionId?: string | null;
  sourceContextId?: string | null;
  sourceSummary?: string | null;
}

export interface WorkCanvasTableContent {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface WorkCanvasChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface WorkCanvasResearchContent {
  mission: string;
  questions: string[];
  allowedSources: Array<'web' | 'attachment' | 'product' | 'org'>;
  status: 'planned' | 'approved' | 'running' | 'paused' | 'completed' | 'failed';
}

export interface WorkCanvasDecisionContent {
  recommendation: string;
  options: string[];
  assumptions: string[];
  risks: string[];
  confidence?: number;
}

export type WorkCanvasContent =
  | string
  | WorkCanvasTableContent
  | WorkCanvasChecklistItem[]
  | WorkCanvasResearchContent
  | WorkCanvasDecisionContent;

export interface WorkCanvasDraft {
  id: string;
  conversationId: string;
  kind: WorkCanvasKind;
  title: string;
  content: WorkCanvasContent;
  saveState: WorkCanvasSaveState;
  lifecycleState: WorkCanvasLifecycleState;
  dirtyState: WorkCanvasDirtyState;
  visibility: WorkCanvasVisibility;
  auditStatus: WorkCanvasAuditStatus;
  sources: WorkCanvasSource[];
  provenance: WorkCanvasProvenance;
  clientId?: string | null;
  projectId?: string | null;
  ownerId?: string | null;
  researchSessionId?: string;
  artifactRunId?: string;
  artifactId?: string;
  artifactVersion?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkCanvasConversionProposal {
  id: string;
  draftId: string;
  target: WorkCanvasTarget;
  title: string;
  summary: string;
  status: 'proposed' | 'executing' | 'approved' | 'rejected';
  payload?: Record<string, unknown>;
  requiredCapability?: string;
  targetObjectId?: string | null;
  readBack?: Record<string, unknown> | null;
  auditEventId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkCanvasActionResult<T> {
  data: T;
  auditEventId?: string | null;
  readBack?: Record<string, unknown> | null;
}

export const WORK_CANVAS_TARGET_LABEL: Record<WorkCanvasTarget, string> = {
  note: 'Note',
  table: 'Table',
  idea: 'Idea',
  initiative: 'Initiative',
  task: 'Task',
  project_brief: 'Brief',
  decision: 'Decision',
  research_report: 'Research Report',
  client_deliverable: 'Client Deliverable',
  kpi_roi_artifact: 'KPI/ROI Artifact',
};
