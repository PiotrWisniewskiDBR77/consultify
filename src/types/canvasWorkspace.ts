import type { CanonicalFormat, MarkdownProjectionStatus } from './artifactContent';

export type CanvasMode = 'rich' | 'document' | 'md';

export type CanvasStarterId =
  | 'thoughts'
  | 'document'
  | 'research'
  | 'decision'
  | 'plan'
  // Deliverables light runtime (L1): prawy panel = żywy artefakt decka,
  // nie dokument markdown — patrz docs/plans/DELIVERABLES_LIGHT_TARGET.md §10.2.
  | 'presentation';

export type CanvasSaveState = 'unsaved' | 'saving' | 'saved' | 'failed' | 'conflict';

export type CanvasLifecycleState = 'draft' | 'in_review' | 'approved';

export type CanvasProjectionStatus = MarkdownProjectionStatus;

export type CanvasCanonicalFormat = CanonicalFormat;

export type CanvasArtifactBlockKind =
  | 'table'
  | 'chart'
  | 'diagram'
  | 'decision'
  | 'research'
  | 'dashboard';

export type CanvasArtifactBlockStatus = 'draft' | 'ready' | 'stale' | 'failed';

export type CanvasArtifactBlockCapability =
  | 'view'
  | 'edit'
  | 'filter'
  | 'sort'
  | 'export'
  | 'rerun'
  | 'convert';

export interface CanvasArtifactBlockProvenance {
  source: 'user' | 'assistant' | 'import' | 'system';
  conversationId?: string;
  draftId?: string;
  operationId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasArtifactBlock<TData = unknown> {
  id: string;
  kind: CanvasArtifactBlockKind;
  schemaVersion: 'canvas-block/v1';
  title: string;
  status: CanvasArtifactBlockStatus;
  capabilities: CanvasArtifactBlockCapability[];
  data: TData;
  provenance: CanvasArtifactBlockProvenance;
  markdownProjection: string;
  markdownProjectionStatus: CanvasProjectionStatus;
  projectionError?: string | null;
}

export type CanvasDocumentKind =
  | 'markdown'
  | 'document'
  | 'research'
  | 'decision'
  | 'plan'
  | 'checklist'
  | 'sheet'
  | 'deck'
  | 'table'
  | 'presentation'
  | 'report';

export interface ActiveCanvasDocument {
  draftId?: string;
  researchSessionId?: string | null;
  title: string;
  saveState: CanvasSaveState;
  lifecycleState: CanvasLifecycleState;
  activeStarterId: CanvasStarterId;
  kind?: CanvasDocumentKind;
  contentMd?: string;
  markdownProjectionStatus?: CanvasProjectionStatus;
  blocks?: CanvasArtifactBlock[];
  workflowRuns?: CanvasWorkflowRun[];
  linkedOutputs?: CanvasContextPacket['linkedOutputs'];
}

/**
 * C4 — one append-only ledger entry per Canvas→workspace materialization.
 * Written by the backend into `draft.provenance.materializedTo[]` by both
 * writers (save-to-workspace route + proposal approval).
 */
export interface CanvasMaterializedLink {
  target: 'idea' | 'note' | 'initiative' | 'decision' | 'task' | string;
  entityId: string;
  url: string;
  title: string;
  at: string;
}

export interface CanvasDocumentState extends ActiveCanvasDocument {
  contentMd: string;
  blocks?: CanvasArtifactBlock[];
  canonicalFormat: CanvasCanonicalFormat;
  kind: CanvasDocumentKind;
  markdownProjectionStatus: CanvasProjectionStatus;
  projectionError?: string | null;
  updatedAt?: string | null;
  /** ISO timestamp of the last confirmed save, for the save-status affordance. */
  lastSavedAt?: string | null;
  linkedIdeaId?: string | null;
  linkedNoteId?: string | null;
  linkedInitiativeId?: string | null;
  workflowRuns?: CanvasWorkflowRun[];
  /** C4 — entities materialized from this draft (provenance.materializedTo). */
  materializedTo?: CanvasMaterializedLink[];
}

export interface CanvasSelection {
  draftId?: string;
  mode: CanvasMode;
  selectedText: string;
  startOffset?: number;
  endOffset?: number;
  headingPath?: string[];
}

export interface CanvasVersionSummary {
  id: string;
  draftId: string;
  operationType: string;
  summary: string;
  contentMd: string;
  blocks?: CanvasArtifactBlock[];
  createdBy: string;
  createdAt: string;
}

export interface CanvasDiffSummary {
  addedLines: number;
  removedLines: number;
  summary: string;
  addedLineSamples?: string[];
  removedLineSamples?: string[];
}

export type CanvasWorkflowStepKind =
  | 'teresa_action'
  | 'user_approval'
  | 'generated_artifact'
  | 'failed_retry'
  | 'downstream_conversion';

export type CanvasWorkflowStepStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface CanvasWorkflowStep {
  id: string;
  kind: CanvasWorkflowStepKind;
  title: string;
  summary: string;
  status: CanvasWorkflowStepStatus;
  approvalRequired?: boolean;
  approvedAt?: string | null;
  outputType?: string | null;
  outputId?: string | null;
  blockId?: string | null;
  versionId?: string | null;
  createdAt: string;
}

export interface CanvasWorkflowRun {
  id: string;
  draftId: string;
  conversationId: string;
  template: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  steps: CanvasWorkflowStep[];
  approvals: Array<{
    stepId: string;
    status: 'pending' | 'approved' | 'rejected';
    requiredCapability: string;
  }>;
  outputs: Array<{
    stepId: string;
    type: string;
    id: string;
    title: string;
    url?: string;
  }>;
  events?: Array<{
    id: string;
    type:
      | 'created'
      | 'resumed'
      | 'approval_required'
      | 'approved'
      | 'output_created'
      | 'collaboration_updated'
      | 'comment_added';
    actorId: string;
    summary: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  collaboration?: {
    ownerId?: string | null;
    reviewerId?: string | null;
    lifecycle?: 'draft' | 'in_review' | 'approved';
    comments?: Array<{
      id: string;
      authorId: string;
      body: string;
      createdAt: string;
    }>;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasContextBlockSummary {
  blockId: string;
  kind: CanvasArtifactBlockKind;
  title: string;
  status: CanvasArtifactBlockStatus;
  projectionStatus: CanvasProjectionStatus;
  markdownProjection: string;
}

export interface CanvasContextWorkflowEventSummary {
  workflowRunId: string;
  workflowTitle: string;
  eventType: string;
  actorId: string;
  summary: string;
  createdAt: string;
}

export interface CanvasContextWorkflowOutputSummary {
  workflowRunId: string;
  workflowTitle: string;
  stepId: string;
  type: string;
  id: string;
  title: string;
  url?: string;
}

export interface CanvasContextWorkflowRunSummary {
  id: string;
  draftId: string;
  conversationId: string;
  template: string;
  title: string;
  status: CanvasWorkflowRun['status'];
  lifecycle?: 'draft' | 'in_review' | 'approved';
  stepSummaries: Array<{
    id: string;
    kind: CanvasWorkflowStepKind;
    title: string;
    status: CanvasWorkflowStepStatus;
    approvalRequired?: boolean;
    outputType?: string | null;
    outputId?: string | null;
  }>;
  approvalStatuses: Array<{
    stepId: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
  outputCount: number;
  updatedAt: string;
}

export interface CanvasMemorySnapshot {
  summary: string;
  anchors: {
    draftId?: string | null;
    researchSessionId?: string | null;
    title: string;
    kind?: CanvasDocumentKind;
    workflowRunIds: string[];
    blockIds: string[];
  };
  limitations: string[];
}

export interface CanvasContextPacket {
  schemaVersion: 'canvas-context/v1';
  activeDraft: {
    draftId?: string | null;
    researchSessionId?: string | null;
    title: string;
    kind?: CanvasDocumentKind;
    lifecycleState: CanvasLifecycleState;
    saveState: CanvasSaveState;
    markdownProjectionStatus?: CanvasProjectionStatus;
  };
  markdownProjection: string;
  selection?: CanvasSelection | null;
  blockSummaries: CanvasContextBlockSummary[];
  workflowRuns: CanvasContextWorkflowRunSummary[];
  workflowEventSummaries?: CanvasContextWorkflowEventSummary[];
  workflowOutputSummaries?: CanvasContextWorkflowOutputSummary[];
  linkedOutputs: Array<{
    type: string;
    id: string;
    title?: string;
    url?: string;
  }>;
  memorySnapshot: CanvasMemorySnapshot;
}

export type CanvasEditOperation =
  | {
      type: 'replace_selection';
      selectedText: string;
      replacementMd: string;
      reason?: string;
    }
  | {
      type: 'append_section';
      heading: string;
      contentMd: string;
      reason?: string;
    }
  | {
      type: 'update_document';
      contentMd: string;
      reason?: string;
    };

export interface CanvasOperationResponse {
  draft: CanvasDocumentState;
  version?: CanvasVersionSummary;
  diff?: CanvasDiffSummary;
}

export interface CanvasShareResult {
  token: string;
  url: string;
  title: string;
}

export type CanvasOperation =
  | {
      type: 'copy';
      draftId?: string;
    }
  | {
      type: 'save';
      draftId?: string;
    }
  | {
      type: 'share';
      draftId?: string;
    }
  | {
      type: 'create_output';
      draftId?: string;
      outputType: 'presentation' | 'table' | 'report';
    }
  | {
      type: 'save_to_workspace';
      draftId?: string;
      target: 'idea' | 'note' | 'initiative';
    }
  | {
      type: 'replace_selection';
      draftId?: string;
      selection: CanvasSelection;
      replacementMd: string;
    }
  | {
      type: 'append_section';
      draftId?: string;
      heading: string;
      contentMd: string;
    }
  | {
      type: 'update_document';
      draftId?: string;
      contentMd: string;
    };

export type CanvasActionGroup = 'file' | 'view' | 'output' | 'workspace';

export type CanvasActionId =
  | 'copy'
  | 'share'
  | 'save'
  | 'close'
  | 'view-document'
  | 'view-md'
  | 'create-presentation'
  | 'create-table'
  | 'create-report'
  | 'send-to-idea'
  | 'save-as-note'
  | 'create-initiative'
  // C3 — actions whose backend exists today but the chat-shell never exposed
  // them (ecosystem audit). Wired through the canonical createWorkspaceResource
  // path so both shells produce the same real DB rows.
  | 'create-decision'
  | 'create-task';

export type CanvasActionAvailabilityStatus =
  | 'enabled'
  | 'disabled_no_active_document'
  | 'disabled_missing_runtime'
  | 'disabled_missing_permission'
  | 'coming_soon'
  | 'loading'
  | 'failed';

export interface CanvasActionAvailability {
  actionId: CanvasActionId;
  group: CanvasActionGroup;
  status: CanvasActionAvailabilityStatus;
  label: string;
  reason?: string;
}

export interface CanvasRuntimeCapabilities {
  canShare?: boolean;
  canCreatePresentation?: boolean;
  canCreateTable?: boolean;
  canCreateReport?: boolean;
  canSendToIdea?: boolean;
  canSaveAsNote?: boolean;
  canCreateInitiative?: boolean;
  // C3 — newly surfaced actions (the backends already existed).
  canCreateDecision?: boolean;
  canCreateTask?: boolean;
}
