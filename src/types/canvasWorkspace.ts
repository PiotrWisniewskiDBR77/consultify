export type CanvasMode = 'document' | 'md';

export type CanvasStarterId = 'thoughts' | 'document' | 'research' | 'decision' | 'plan';

export type CanvasSaveState = 'unsaved' | 'saving' | 'saved' | 'failed';

export type CanvasLifecycleState = 'draft' | 'in_review' | 'approved';

export type CanvasProjectionStatus = 'synced' | 'stale' | 'failed' | 'missing';

export type CanvasCanonicalFormat = 'markdown' | 'json';

export type CanvasDocumentKind =
  | 'document'
  | 'research'
  | 'decision'
  | 'plan'
  | 'table'
  | 'presentation'
  | 'report';

export interface ActiveCanvasDocument {
  draftId?: string;
  title: string;
  saveState: CanvasSaveState;
  lifecycleState: CanvasLifecycleState;
  activeStarterId: CanvasStarterId;
}

export interface CanvasDocumentState extends ActiveCanvasDocument {
  contentMd: string;
  canonicalFormat: CanvasCanonicalFormat;
  kind: CanvasDocumentKind;
  markdownProjectionStatus: CanvasProjectionStatus;
  projectionError?: string | null;
  updatedAt?: string | null;
  linkedIdeaId?: string | null;
  linkedNoteId?: string | null;
  linkedInitiativeId?: string | null;
}

export interface CanvasSelection {
  draftId?: string;
  mode: CanvasMode;
  selectedText: string;
  startOffset?: number;
  endOffset?: number;
  headingPath?: string[];
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
  | 'create-initiative';

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
}
