import {
  Copy,
  Download,
  FileText,
  FolderOpen,
  Lightbulb,
  MoreHorizontal,
  Plus,
  Presentation,
  RefreshCw,
  Rocket,
  Save,
  Share2,
  StickyNote,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import React from 'react';

import { Api } from '@/services/api';
import type {
  ActiveCanvasDocument,
  CanvasActionAvailability,
  CanvasActionId,
  CanvasArtifactBlock,
  CanvasArtifactBlockKind,
  CanvasDiffSummary,
  CanvasDocumentState,
  CanvasLifecycleState,
  CanvasMode,
  CanvasProjectionStatus,
  CanvasRuntimeCapabilities,
  CanvasSelection,
  CanvasStarterId,
  CanvasVersionSummary,
} from '@/types/canvasWorkspace';
import { getCanvasActionAvailability } from '@/utils/canvas/canvasActionAvailability';
import {
  mapDraftResponseToCanvasDocumentState,
  starterIdToCanvasKind,
} from '@/utils/canvas/canvasDraftAdapter';

import { CanvasArtifactBlockRenderer } from './CanvasArtifactBlockRenderer';
import { CanvasMarkdownRenderer } from './CanvasMarkdownRenderer';

export type { ActiveCanvasDocument } from '@/types/canvasWorkspace';

interface StarterTemplate {
  id: CanvasStarterId;
  label: string;
  title: string;
  description: string;
  markdown: string;
}

interface WorkCanvasDocumentPanelProps {
  conversationId?: string | null;
  initialProjectionStatus?: CanvasProjectionStatus;
  initialBlocks?: CanvasArtifactBlock[];
  onActiveDocumentChange?: (document: ActiveCanvasDocument) => void;
  onCanvasSelectionChange?: (selection: CanvasSelection | null) => void;
  onClose?: () => void;
}

interface PendingCanvasOperation {
  draftId: string;
  baseUpdatedAt?: string | null;
  operation: Record<string, unknown>;
  preview: {
    proposedChange?: string;
    affectedBlocks?: string[];
    markdownDiff?: CanvasDiffSummary;
    approvalRequired?: boolean;
    validationResult?: {
      status?: string;
      message?: string;
    };
  };
  applyLabel: string;
  successMessage: string;
}

type PendingDatasetFormat = 'csv' | 'json' | 'xlsx';
type DatasetAnalysisKind = 'profile_summary' | 'aggregate_numeric' | 'filtered_table';
type CanvasWorkflowTemplate =
  | 'market_research_to_report'
  | 'meeting_note_to_initiatives'
  | 'kpi_review_to_dashboard'
  | 'client_proposal_to_deck'
  | 'decision_memo_to_execution_plan';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

const starterTemplates: StarterTemplate[] = [
  {
    id: 'thoughts',
    label: 'Zbierz myśli',
    title: 'Working Notes',
    description: 'Capture raw ideas and sort them into usable business structure.',
    markdown: `# Working Notes

Area: Business exploration
Purpose: Capture rough thinking before it becomes a decision, plan, or deliverable.

## Raw Thoughts

- 
- 
- 

## Patterns Emerging

| Theme | Evidence | Next Question |
|---|---|---|
|  |  |  |

> Use this space freely. Teresa can help turn it into a brief, decision memo, or research plan.`,
  },
  {
    id: 'document',
    label: 'Napisz dokument',
    title: 'Company Work Note',
    description: 'A clean Markdown-canonical document for business work.',
    markdown: `# Company Work Note

Area: Operating workspace
Purpose: Shape a business output with Teresa on the left and the document on the right.

## Context

Write the situation, goal, constraints, and audience here.

## Working Draft

- [ ] Define the business question.
- [ ] Capture assumptions.
- [ ] List open decisions.
- [ ] Decide the next action.

## Notes

> This is Markdown canonical. The document view and MD view read from the same source.`,
  },
  {
    id: 'research',
    label: 'Zrób research',
    title: 'Market Research Brief',
    description: 'Start a structured research brief before turning on deep search.',
    markdown: `# Market Research Brief

Area: Market research
Purpose: Define what Teresa should investigate before evidence gathering starts.

## Research Question

What do we need to know, and what decision will this research support?

## Scope

| Dimension | Definition |
|---|---|
| Market | TBD |
| Segment | TBD |
| Geography | TBD |
| Competitors | TBD |

## Evidence Needed

- Reliable sources
- Customer signals
- Competitor positioning
- Risks and assumptions`,
  },
  {
    id: 'decision',
    label: 'Przygotuj decyzję',
    title: 'Decision Memo',
    description: 'Frame options, trade-offs, risks, and the recommended choice.',
    markdown: `# Decision Memo

Decision: TBD
Owner: TBD
Date: TBD

## Recommendation

State the recommended option in one clear paragraph.

## Options

| Option | Upside | Risk | Confidence |
|---|---|---|---|
| A |  |  |  |
| B |  |  |  |

## Assumptions

- 

## Decision Log

- [ ] Approved
- [ ] Needs more evidence`,
  },
  {
    id: 'plan',
    label: 'Rozpisz plan',
    title: 'Execution Plan',
    description: 'Turn the conversation into clear workstreams and next steps.',
    markdown: `# Execution Plan

Purpose: Convert the business idea into accountable execution.

## Workstreams

| Workstream | Owner | Outcome | Status |
|---|---|---|---|
| Strategy | TBD |  | Not started |
| Research | TBD |  | Not started |
| Delivery | TBD |  | Not started |

## Next Steps

- [ ] Confirm scope.
- [ ] Assign owners.
- [ ] Define first milestone.
- [ ] Review risks with Teresa.`,
  },
];

const VIEW_MODE_STORAGE_KEY = 'workCanvas.viewMode';

const workspaceActionIds: CanvasActionId[] = ['send-to-idea', 'save-as-note', 'create-initiative'];

const outputActionIds: CanvasActionId[] = ['create-presentation', 'create-table', 'create-report'];

const canvasRuntimeCapabilities: CanvasRuntimeCapabilities = {
  canCreatePresentation: true,
  canCreateTable: true,
  canCreateReport: true,
  canSendToIdea: true,
  canSaveAsNote: true,
  canCreateInitiative: true,
  canShare: true,
};

const workspaceTargets: Partial<Record<CanvasActionId, 'idea' | 'note' | 'initiative'>> = {
  'send-to-idea': 'idea',
  'save-as-note': 'note',
  'create-initiative': 'initiative',
};

const outputTargets: Partial<Record<CanvasActionId, 'presentation' | 'table' | 'report'>> = {
  'create-presentation': 'presentation',
  'create-table': 'table',
  'create-report': 'report',
};

const datasetArtifactActions: Array<{
  kind: 'table' | 'chart' | 'dashboard' | 'research';
  label: string;
  analysisKind?: DatasetAnalysisKind;
  titlePrefix?: string;
}> = [
  { kind: 'table', label: 'Dataset table' },
  { kind: 'chart', label: 'Dataset chart' },
  { kind: 'dashboard', label: 'KPI dashboard' },
  { kind: 'research', label: 'Findings report' },
  {
    kind: 'research',
    label: 'Profile summary',
    analysisKind: 'profile_summary',
    titlePrefix: 'Profile Summary',
  },
  {
    kind: 'chart',
    label: 'Aggregate chart',
    analysisKind: 'aggregate_numeric',
    titlePrefix: 'Aggregate Chart',
  },
  {
    kind: 'table',
    label: 'Filtered table',
    analysisKind: 'filtered_table',
    titlePrefix: 'Filtered Table',
  },
];

const workflowTemplateOptions: Array<{
  id: CanvasWorkflowTemplate;
  label: string;
  description: string;
}> = [
  {
    id: 'market_research_to_report',
    label: 'Market research to report',
    description: 'Research narrative, evidence map and report output.',
  },
  {
    id: 'meeting_note_to_initiatives',
    label: 'Meeting note to initiatives',
    description: 'Decisions, owners, initiative shortlist and brief.',
  },
  {
    id: 'kpi_review_to_dashboard',
    label: 'KPI review to dashboard',
    description: 'KPI signals, dashboard plan and table output.',
  },
  {
    id: 'client_proposal_to_deck',
    label: 'Client proposal to deck',
    description: 'Proposal storyline, deck outline and presentation output.',
  },
  {
    id: 'decision_memo_to_execution_plan',
    label: 'Decision memo to execution plan',
    description: 'Decision logic, milestones and execution plan.',
  },
];

const actionIcons: Record<CanvasActionId, React.ComponentType<{ size?: number }>> = {
  copy: Copy,
  share: Share2,
  save: Save,
  close: X,
  'view-document': FileText,
  'view-md': FileText,
  'create-presentation': Presentation,
  'create-table': Table2,
  'create-report': FileText,
  'send-to-idea': Lightbulb,
  'save-as-note': StickyNote,
  'create-initiative': Rocket,
};

const toolbarButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white';

const toolbarGroupClass =
  'flex items-center gap-1 rounded-full border border-slate-200 px-1 dark:border-white/10';

function getInitialMode(): CanvasMode {
  if (typeof window === 'undefined') return 'document';
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'md' ? 'md' : 'document';
}

function createDocumentState(
  template: StarterTemplate,
  projectionStatus: CanvasProjectionStatus = 'synced',
  blocks: CanvasArtifactBlock[] = []
): CanvasDocumentState {
  return {
    title: template.title,
    contentMd: template.markdown,
    blocks,
    canonicalFormat: 'markdown',
    kind: starterIdToCanvasKind(template.id),
    markdownProjectionStatus: projectionStatus,
    saveState: 'unsaved',
    lifecycleState: 'draft',
    activeStarterId: template.id,
    projectionError: projectionStatus === 'failed' ? 'Projection needs regeneration.' : null,
  };
}

function lifecycleLabel(lifecycleState: CanvasLifecycleState): string {
  if (lifecycleState === 'in_review') return 'In review';
  if (lifecycleState === 'approved') return 'Approved';
  return 'Draft';
}

function projectionLabel(status: CanvasProjectionStatus): string {
  if (status === 'stale') return 'Projection stale';
  if (status === 'failed') return 'Projection failed';
  if (status === 'missing') return 'Projection missing';
  return 'Projection synced';
}

function saveStateLabel(saveState: CanvasDocumentState['saveState']): string {
  if (saveState === 'saving') return 'Saving';
  if (saveState === 'failed') return 'Save failed';
  if (saveState === 'unsaved') return 'Unsaved changes';
  return 'Saved';
}

function buildLineDiff(before: string, after: string): CanvasDiffSummary {
  const beforeLines = String(before || '').split('\n');
  const afterLines = String(after || '').split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const addedLines = afterLines.filter((line) => !beforeSet.has(line)).length;
  const removedLines = beforeLines.filter((line) => !afterSet.has(line)).length;
  return {
    addedLines,
    removedLines,
    summary: `${addedLines} lines added, ${removedLines} lines removed`,
  };
}

function canvasActionErrorMessage(error: unknown, fallback: string): string {
  const record = error && typeof error === 'object' ? (error as any) : null;
  if (record?.data?.code === 'CANVAS_DRAFT_CONFLICT') {
    return 'Canvas changed elsewhere. Your local edits are still visible. Reload latest or retry from the current draft before applying this action.';
  }
  return error instanceof Error ? error.message : fallback;
}

export function WorkCanvasDocumentPanel({
  conversationId,
  initialProjectionStatus = 'synced',
  initialBlocks = [],
  onActiveDocumentChange,
  onCanvasSelectionChange,
  onClose,
}: WorkCanvasDocumentPanelProps) {
  const [mode, setMode] = React.useState<CanvasMode>(() => getInitialMode());
  const [documentState, setDocumentState] = React.useState<CanvasDocumentState>(() =>
    createDocumentState(starterTemplates[1], initialProjectionStatus, initialBlocks)
  );
  const [isHydrating, setIsHydrating] = React.useState(true);
  const [isProjectionRefreshing, setIsProjectionRefreshing] = React.useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = React.useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = React.useState(false);
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null);
  const [activeActionId, setActiveActionId] = React.useState<CanvasActionId | null>(null);
  const [canvasSelection, setCanvasSelection] = React.useState<CanvasSelection | null>(null);
  const [versions, setVersions] = React.useState<CanvasVersionSummary[]>([]);
  const [isVersionsOpen, setIsVersionsOpen] = React.useState(false);
  const [isVersionsLoading, setIsVersionsLoading] = React.useState(false);
  const [latestDiff, setLatestDiff] = React.useState<CanvasDiffSummary | null>(null);
  const [pendingDataset, setPendingDataset] = React.useState<{
    filename: string;
    format: PendingDatasetFormat;
    content: string;
  } | null>(null);
  const [pendingOperation, setPendingOperation] = React.useState<PendingCanvasOperation | null>(
    null
  );
  const [selectedWorkflowTemplate, setSelectedWorkflowTemplate] =
    React.useState<CanvasWorkflowTemplate>('market_research_to_report');
  const [workflowReviewerById, setWorkflowReviewerById] = React.useState<Record<string, string>>(
    {}
  );
  const [workflowCommentById, setWorkflowCommentById] = React.useState<Record<string, string>>({});
  const documentViewRef = React.useRef<HTMLElement | null>(null);
  const lastSavedContentRef = React.useRef(documentState.contentMd);
  const lastSavedTitleRef = React.useRef(documentState.title);
  const latestContentRef = React.useRef(documentState.contentMd);
  const autosaveTimerRef = React.useRef<number | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const activeTemplate =
    starterTemplates.find((template) => template.id === documentState.activeStarterId) ||
    starterTemplates[1];

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIsHydrating(false), 120);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, [mode]);

  React.useEffect(() => {
    onActiveDocumentChange?.({
      draftId: documentState.draftId,
      title: documentState.title,
      saveState: documentState.saveState,
      lifecycleState: documentState.lifecycleState,
      activeStarterId: documentState.activeStarterId,
      kind: documentState.kind,
      contentMd: documentState.contentMd,
      markdownProjectionStatus: documentState.markdownProjectionStatus,
      blocks: documentState.blocks || [],
      workflowRuns: documentState.workflowRuns || [],
      linkedOutputs: Array.isArray(documentState.workflowRuns)
        ? documentState.workflowRuns.flatMap((workflow) => workflow.outputs || [])
        : [],
    });
  }, [documentState, onActiveDocumentChange]);

  React.useEffect(() => {
    latestContentRef.current = documentState.contentMd;
  }, [documentState.contentMd]);

  React.useEffect(() => {
    onCanvasSelectionChange?.(canvasSelection);
  }, [canvasSelection, onCanvasSelectionChange]);

  const persistDraft = React.useCallback(
    async (draft: CanvasDocumentState = documentState) => {
      const effectiveConversationId = conversationId || `canvas-${Date.now()}`;

      setDocumentState((current) => ({ ...current, saveState: 'saving' }));
      try {
        const token = window.localStorage.getItem('token') || '';
        const response = await fetch(
          draft.draftId
            ? `/api/work-canvas/drafts/${encodeURIComponent(draft.draftId)}`
            : '/api/work-canvas/drafts',
          {
            method: draft.draftId ? 'PUT' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              conversationId: effectiveConversationId,
              baseUpdatedAt: draft.updatedAt || null,
              kind: 'document',
              title: draft.title,
              content: draft.contentMd,
              canonicalFormat: draft.canonicalFormat,
              contentMd: draft.contentMd,
              blocks: draft.blocks || [],
              saveState: 'saved',
              lifecycleState: draft.lifecycleState,
              provenance: {
                source: 'chat-work-canvas-panel',
                starterId: draft.activeStarterId,
                workflowRuns: draft.workflowRuns || [],
              },
            }),
          }
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          const saveError: any = new Error(json?.error || 'Failed to save Canvas draft');
          saveError.data = json;
          throw saveError;
        }
        const savedDraft = json?.data;
        const nextState = mapDraftResponseToCanvasDocumentState(savedDraft, {
          ...draft,
          draftId: draft.draftId,
          saveState: 'saved',
          projectionError: null,
        });
        setDocumentState((current) => {
          if (current.contentMd !== draft.contentMd) {
            return {
              ...current,
              draftId: savedDraft?.id || current.draftId || draft.draftId,
              saveState: 'unsaved',
            };
          }
          return mapDraftResponseToCanvasDocumentState(savedDraft, {
            ...current,
            draftId: current.draftId || draft.draftId,
            saveState: 'saved',
            projectionError: null,
          });
        });
        if (latestContentRef.current === draft.contentMd) {
          lastSavedContentRef.current = nextState.contentMd;
          lastSavedTitleRef.current = nextState.title;
        }
        return nextState;
      } catch (error) {
        const message = canvasActionErrorMessage(error, 'Save failed');
        setDocumentState((current) => ({
          ...current,
          saveState: 'failed',
          projectionError: message,
        }));
        setActionFeedback(message);
        return null;
      }
    },
    [conversationId, documentState]
  );

  const selectTemplate = (template: StarterTemplate) => {
    const next = createDocumentState(template);
    setDocumentState(next);
    setMode('document');
    void persistDraft(next);
  };

  const copyMarkdown = async () => {
    await navigator.clipboard?.writeText(documentState.contentMd);
    setActionFeedback('Markdown copied to clipboard.');
  };

  const exportDocument = async (
    format: 'markdown' | 'csv' | 'json' | 'pdf' | 'docx' | 'xlsx' | 'pptx'
  ) => {
    const draft = await ensurePersistedDraft();
    if (!draft?.draftId) {
      setActionFeedback('Export is available after the draft is saved.');
      return;
    }

    try {
      const { blob, filename } = await Api.workCanvasExportDraft(draft.draftId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setActionFeedback(`Exported ${filename}.`);
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to export Canvas draft.');
    }
  };

  const openDocumentFolder = async () => {
    const draft = await ensurePersistedDraft();
    if (!draft?.draftId) {
      setActionFeedback('Document location is available after the draft is saved.');
      return;
    }
    window.open(
      `/work-canvas/drafts/${encodeURIComponent(draft.draftId)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setActionFeedback('Document location opened.');
  };

  const handleUploadFiles = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    const datasetFile = selectedFiles.find((file) => /\.(csv|json|xlsx)$/i.test(file.name));
    if (datasetFile) {
      try {
        const lowerName = datasetFile.name.toLowerCase();
        const format: PendingDatasetFormat = lowerName.endsWith('.json')
          ? 'json'
          : lowerName.endsWith('.xlsx')
            ? 'xlsx'
            : 'csv';
        const content =
          format === 'xlsx'
            ? arrayBufferToBase64(await datasetFile.arrayBuffer())
            : await datasetFile.text();
        setPendingDataset({ filename: datasetFile.name, format, content });
        setActionFeedback(
          `${datasetFile.name} ready for Canvas dataset actions: table, chart, dashboard or findings.`
        );
      } catch (error) {
        setActionFeedback(error instanceof Error ? error.message : 'Failed to read dataset file.');
      }
      return;
    }
    setActionFeedback(
      `Uploading ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} to this workspace...`
    );
    try {
      const uploaded = await Promise.all(
        selectedFiles.map((file) => Api.uploadChatAttachment(file))
      );
      setActionFeedback(
        `Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}: ${uploaded
          .map((file) => file.filename)
          .join(', ')}`
      );
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to upload files.');
    }
  };

  const createArtifactFromDataset = async (
    artifactKind: 'table' | 'chart' | 'dashboard' | 'research',
    analysisKind?: DatasetAnalysisKind,
    titlePrefix?: string
  ) => {
    if (!pendingDataset) {
      setActionFeedback('Upload a CSV, JSON, or XLSX dataset first.');
      return;
    }
    const title =
      Boolean(titlePrefix) || artifactKind === 'dashboard'
        ? `${titlePrefix || 'KPI Dashboard'}: ${pendingDataset.filename}`
        : `${artifactKind} from ${pendingDataset.filename}`;
    setActionFeedback(`Preparing ${title} preview...`);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId)
        throw new Error('Canvas draft could not be saved before dataset analysis.');
      const result = await Api.workCanvasApplyOperation(draft.draftId, {
        baseUpdatedAt: draft.updatedAt || null,
        previewOnly: true,
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind,
          dataset: pendingDataset,
          title,
          analysis: analysisKind ? { kind: analysisKind } : undefined,
        },
      });
      setPendingOperation({
        draftId: draft.draftId,
        baseUpdatedAt: draft.updatedAt || null,
        operation: {
          type: 'generate_artifact_from_dataset',
          artifactKind,
          dataset: pendingDataset,
          title,
          analysis: analysisKind ? { kind: analysisKind } : undefined,
        },
        preview: result.data.preview || {},
        applyLabel: `Apply ${titlePrefix || artifactKind}`,
        successMessage: `${title} created.`,
      });
      setActionFeedback(`Preview ready for ${title}.`);
    } catch (error) {
      setActionFeedback(canvasActionErrorMessage(error, 'Failed to analyze dataset.'));
    }
  };

  const updateMarkdown = (contentMd: string) => {
    setDocumentState((current) => ({
      ...current,
      contentMd,
      saveState: 'unsaved',
      markdownProjectionStatus: 'synced',
      projectionError: null,
    }));
  };

  const createArtifactBlockFromSelection = async (kind: CanvasArtifactBlockKind) => {
    const selectedText = canvasSelection?.selectedText?.trim();
    if (!selectedText) {
      setActionFeedback('Select Canvas text first, then create a block.');
      return;
    }
    const title =
      kind === 'table'
        ? 'Table from selection'
        : kind === 'chart'
          ? 'Chart from selection'
          : kind === 'diagram'
            ? 'Diagram from selection'
            : kind === 'research'
              ? 'Research from selection'
              : 'Decision from selection';
    setActionFeedback(`Preparing ${title.toLowerCase()}...`);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId)
        throw new Error('Canvas draft could not be saved before transformation.');
      const result = await Api.workCanvasApplyOperation(draft.draftId, {
        baseUpdatedAt: draft.updatedAt || null,
        previewOnly: true,
        operation: {
          type: 'generate_block_from_selection',
          kind,
          selectedText,
          title,
          reason: `${title} created from selected Canvas text`,
        },
      });
      setPendingOperation({
        draftId: draft.draftId,
        baseUpdatedAt: draft.updatedAt || null,
        operation: {
          type: 'generate_block_from_selection',
          kind,
          selectedText,
          title,
          reason: `${title} created from selected Canvas text`,
        },
        preview: result.data.preview || {},
        applyLabel: `Apply ${title}`,
        successMessage: `${title} created from selected Canvas text.`,
      });
      setActionFeedback(`Preview ready: ${title}.`);
    } catch (error) {
      setActionFeedback(canvasActionErrorMessage(error, `Failed to create ${kind} block.`));
    }
  };

  const applyPendingOperation = async () => {
    if (!pendingOperation) return;
    setActionFeedback('Applying approved Canvas transformation...');
    try {
      const result = await Api.workCanvasApplyOperation(pendingOperation.draftId, {
        baseUpdatedAt: pendingOperation.baseUpdatedAt || null,
        operation: {
          ...pendingOperation.operation,
          approved: true,
        },
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          draftId: pendingOperation.draftId,
          saveState: 'saved',
        })
      );
      if (result.data.diff) setLatestDiff(result.data.diff);
      setPendingOperation(null);
      setActionFeedback(pendingOperation.successMessage);
      await loadVersions();
    } catch (error) {
      setActionFeedback(canvasActionErrorMessage(error, 'Failed to apply Canvas transformation.'));
    }
  };

  const rejectPendingOperation = () => {
    setPendingOperation(null);
    setActionFeedback('Canvas transformation rejected. Draft unchanged.');
  };

  const updateTitle = (title: string) => {
    setDocumentState((current) => ({
      ...current,
      title,
      saveState: 'unsaved',
    }));
  };

  React.useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (
      !documentState.draftId ||
      documentState.saveState !== 'unsaved' ||
      (documentState.contentMd === lastSavedContentRef.current &&
        documentState.title === lastSavedTitleRef.current)
    ) {
      return undefined;
    }
    const snapshot = documentState;
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft(snapshot);
    }, 1400);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
  }, [documentState, persistDraft]);

  const captureMarkdownSelection = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    const selectedText = target.value.slice(target.selectionStart, target.selectionEnd);
    if (!selectedText.trim()) {
      setCanvasSelection(null);
      return;
    }
    setCanvasSelection({
      draftId: documentState.draftId,
      mode: 'md',
      selectedText,
      startOffset: target.selectionStart,
      endOffset: target.selectionEnd,
    });
  };

  const captureDocumentSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    const root = documentViewRef.current;
    if (!selection || !root || !selectedText.trim()) {
      setCanvasSelection(null);
      return;
    }
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !root.contains(anchorNode)) return;
    setCanvasSelection({
      draftId: documentState.draftId,
      mode: 'document',
      selectedText,
    });
  };

  const resetToTemplate = () => {
    const next = createDocumentState(activeTemplate);
    setDocumentState(next);
    setIsDiagnosticsOpen(false);
    void persistDraft(next);
  };

  const retryProjection = () => {
    setIsProjectionRefreshing(true);
    window.setTimeout(() => {
      setDocumentState((current) => ({
        ...current,
        markdownProjectionStatus: 'synced',
        projectionError: null,
      }));
      setIsProjectionRefreshing(false);
    }, 350);
  };

  const handleUnavailableAction = (availability: CanvasActionAvailability) => {
    setActionFeedback(availability.reason || `${availability.label} is not available yet.`);
  };

  const ensurePersistedDraft = async (): Promise<CanvasDocumentState | null> => {
    if (documentState.draftId) return documentState;
    const saved = await persistDraft(documentState);
    return saved;
  };

  const runWorkspaceAction = async (
    actionId: CanvasActionId,
    target: 'idea' | 'note' | 'initiative'
  ) => {
    setActiveActionId(actionId);
    setActionFeedback(`Saving Canvas to ${target}...`);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) throw new Error('Canvas draft could not be saved before handoff.');
      const result = await Api.workCanvasSaveToWorkspace(draft.draftId, { target });
      const linked = result.data.linkedResource;
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setActionFeedback(`${linked.title} saved to ${linked.type}. ${linked.id}`);
    } catch (error) {
      setActionFeedback(
        error instanceof Error ? error.message : `Failed to save Canvas to ${target}.`
      );
    } finally {
      setActiveActionId(null);
    }
  };

  const runOutputAction = async (
    actionId: CanvasActionId,
    outputType: 'presentation' | 'table' | 'report'
  ) => {
    setActiveActionId(actionId);
    setActionFeedback(`Creating ${outputType} from Canvas...`);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId)
        throw new Error('Canvas draft could not be saved before output creation.');
      const result = await Api.workCanvasCreateOutput(draft.draftId, { outputType });
      const output = result.data.outputResource;
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setActionFeedback(`${output.title} created. ${output.id}`);
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : `Failed to create ${outputType}.`);
    } finally {
      setActiveActionId(null);
    }
  };

  const runShareAction = async () => {
    setActiveActionId('share');
    setActionFeedback('Preparing Canvas share link...');
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) throw new Error('Canvas draft could not be saved before sharing.');
      const result = await Api.workCanvasShare(draft.draftId);
      const shareUrl = result.data.share.url;
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      await navigator.clipboard?.writeText(shareUrl);
      setActionFeedback(`Share link ready and copied: ${shareUrl}`);
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to share Canvas draft.');
    } finally {
      setActiveActionId(null);
    }
  };

  const startWorkflow = async () => {
    setActionFeedback('Starting governed Canvas workflow...');
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId)
        throw new Error('Canvas draft could not be saved before workflow start.');
      const result = await Api.workCanvasCreateWorkflow(draft.draftId, {
        template: selectedWorkflowTemplate,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setActionFeedback(`Workflow started: ${result.data.workflowRun.title}.`);
    } catch (error) {
      setActionFeedback(
        error instanceof Error ? error.message : 'Failed to start Canvas workflow.'
      );
    }
  };

  const resumeWorkflow = async (workflowRunId: string) => {
    if (!documentState.draftId) return;
    setActionFeedback('Resuming Canvas workflow...');
    try {
      const result = await Api.workCanvasResumeWorkflow(documentState.draftId, workflowRunId, {
        note: 'User resumed workflow from Canvas diagnostics.',
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setActionFeedback(`Workflow resumed: ${result.data.workflowRun.title}.`);
    } catch (error) {
      setActionFeedback(
        error instanceof Error ? error.message : 'Failed to resume Canvas workflow.'
      );
    }
  };

  const runWorkflowStep = async (workflowRunId: string) => {
    if (!documentState.draftId) return;
    setActionFeedback('Running approved Canvas workflow step...');
    try {
      const result = await Api.workCanvasRunWorkflowStep(documentState.draftId, workflowRunId, {
        approved: true,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      const output = result.data.outputResource;
      setActionFeedback(
        output
          ? `Workflow output created: ${output.title}. ${output.id}`
          : `Workflow step completed: ${result.data.workflowRun.title}.`
      );
    } catch (error) {
      setActionFeedback(
        error instanceof Error ? error.message : 'Failed to run Canvas workflow step.'
      );
    }
  };

  const updateWorkflowCollaboration = async (
    workflowRunId: string,
    lifecycle: 'draft' | 'in_review' | 'approved'
  ) => {
    if (!documentState.draftId) return;
    setActionFeedback('Updating Canvas workflow review metadata...');
    try {
      const result = await Api.workCanvasUpdateWorkflowCollaboration(
        documentState.draftId,
        workflowRunId,
        {
          reviewerId: workflowReviewerById[workflowRunId] || null,
          lifecycle,
        }
      );
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setActionFeedback(`Workflow review metadata updated: ${lifecycle}.`);
    } catch (error) {
      setActionFeedback(
        error instanceof Error ? error.message : 'Failed to update workflow review metadata.'
      );
    }
  };

  const addWorkflowComment = async (workflowRunId: string) => {
    if (!documentState.draftId) return;
    const body = (workflowCommentById[workflowRunId] || '').trim();
    if (!body) {
      setActionFeedback('Write a workflow comment before adding it.');
      return;
    }
    setActionFeedback('Adding Canvas workflow comment...');
    try {
      const result = await Api.workCanvasAddWorkflowComment(documentState.draftId, workflowRunId, {
        body,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setWorkflowCommentById((current) => ({ ...current, [workflowRunId]: '' }));
      setActionFeedback('Workflow comment added.');
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to add workflow comment.');
    }
  };

  const loadVersions = async () => {
    const draft = await ensurePersistedDraft();
    if (!draft?.draftId) return;
    setIsVersionsLoading(true);
    setIsVersionsOpen(true);
    try {
      const result = await Api.workCanvasGetVersions(draft.draftId);
      setVersions(result);
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to load Canvas versions.');
    } finally {
      setIsVersionsLoading(false);
    }
  };

  const restoreVersion = async (version: CanvasVersionSummary) => {
    if (!documentState.draftId) return;
    try {
      const result = await Api.workCanvasRestoreVersion(documentState.draftId, version.id, {
        baseUpdatedAt: documentState.updatedAt || null,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setLatestDiff(buildLineDiff(documentState.contentMd, version.contentMd));
      setActionFeedback(
        `Restored Canvas version from ${new Date(version.createdAt).toLocaleString()}.`
      );
      await loadVersions();
    } catch (error) {
      setActionFeedback(canvasActionErrorMessage(error, 'Failed to restore Canvas version.'));
    }
  };

  const showChangesFromLatestVersion = () => {
    const latest = versions[0];
    if (!latest) {
      setActionFeedback('No Canvas versions available yet.');
      return;
    }
    const diff = buildLineDiff(latest.contentMd, documentState.contentMd);
    setLatestDiff(diff);
    setActionFeedback(`Show changes: ${diff.summary}.`);
  };

  const handleCommandAction = (actionId: CanvasActionId) => {
    const availability = getCanvasActionAvailability(
      actionId,
      documentState,
      canvasRuntimeCapabilities
    );
    if (availability.status !== 'enabled') {
      handleUnavailableAction(availability);
      return;
    }

    if (actionId === 'copy') {
      void copyMarkdown();
      return;
    }

    if (actionId === 'save') {
      void persistDraft();
      return;
    }

    if (actionId === 'share') {
      void runShareAction();
      return;
    }

    const workspaceTarget = workspaceTargets[actionId];
    if (workspaceTarget) {
      void runWorkspaceAction(actionId, workspaceTarget);
      return;
    }

    const outputTarget = outputTargets[actionId];
    if (outputTarget) {
      void runOutputAction(actionId, outputTarget);
      return;
    }

    if (actionId === 'close') {
      if (onClose) {
        onClose();
      } else {
        setActionFeedback('Close is available when Canvas is opened from the split chat shell.');
      }
    }
  };

  const renderCommandButton = (actionId: CanvasActionId) => {
    const availability = getCanvasActionAvailability(
      actionId,
      documentState,
      canvasRuntimeCapabilities
    );
    const Icon = actionIcons[actionId];
    const isUnavailable = availability.status !== 'enabled';
    const isLoading = activeActionId === actionId;
    const isDirtySaveAction =
      actionId === 'save' &&
      (documentState.saveState === 'unsaved' || documentState.saveState === 'failed');
    const title =
      availability.status === 'enabled'
        ? availability.label
        : `${availability.label}: ${availability.reason || availability.status}`;

    return (
      <button
        key={actionId}
        type="button"
        onClick={() => handleCommandAction(actionId)}
        aria-label={availability.label}
        aria-disabled={isUnavailable}
        title={title}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          isUnavailable
            ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300'
            : isDirtySaveAction
              ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/15 dark:hover:text-red-300'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
        }`}
        data-action-status={isLoading ? 'loading' : availability.status}
        data-save-state={actionId === 'save' ? documentState.saveState : undefined}
      >
        {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}
        {availability.status === 'coming_soon' ? (
          <span className="sr-only">Coming soon</span>
        ) : null}
      </button>
    );
  };

  const selectionBlockActions = canvasSelection?.selectedText?.trim() ? (
    <div
      className="mb-5 rounded-2xl border border-primary-200 bg-primary-50/70 p-3 text-sm dark:border-primary-400/20 dark:bg-primary-400/10"
      data-testid="canvas-selection-block-actions"
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
        Turn selection into a block
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('table')}
        >
          Create table
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('chart')}
        >
          Create chart
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('diagram')}
        >
          Create diagram
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('research')}
        >
          Create research
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('decision')}
        >
          Create decision
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 text-slate-950 dark:bg-navy-950 dark:text-slate-100">
      <div className="flex h-[42px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur dark:border-white/[0.06] dark:bg-navy-950/60">
        <div className="min-w-0 flex-1">
          <label htmlFor="canvas-document-title" className="sr-only">
            Document title
          </label>
          <input
            id="canvas-document-title"
            value={documentState.title}
            onChange={(event) => updateTitle(event.target.value)}
            onBlur={() => {
              if (documentState.draftId && documentState.title.trim()) void persistDraft();
            }}
            data-testid="canvas-active-title"
            aria-label="Canvas document title"
            className="w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-semibold text-slate-950 outline-none transition-colors hover:border-slate-200 hover:bg-white/60 focus:border-primary-300 focus:bg-white dark:text-white dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:focus:border-primary-500/50 dark:focus:bg-white/[0.06]"
          />
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTemplatesOpen((open) => !open);
                setIsDiagnosticsOpen(false);
              }}
              className={toolbarButtonClass}
              aria-label="Open Canvas templates"
              aria-expanded={isTemplatesOpen}
              title="New document"
            >
              <Plus size={14} />
            </button>
            {isTemplatesOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-navy-900"
                data-testid="canvas-templates-menu"
              >
                <div className="px-3 pb-2 pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                    DBR77 work templates
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                    Start from a business form Teresa can later convert into a decision, initiative,
                    report, or presentation.
                  </div>
                </div>
                {starterTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      selectTemplate(template);
                      setIsTemplatesOpen(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      documentState.activeStarterId === template.id
                        ? 'bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{template.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 opacity-75">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={`hidden md:flex ${toolbarGroupClass}`}
            data-testid="canvas-output-actions"
          >
            {outputActionIds.map(renderCommandButton)}
          </div>

          <div
            className={`hidden md:flex ${toolbarGroupClass}`}
            data-testid="canvas-workspace-actions"
          >
            {workspaceActionIds.map(renderCommandButton)}
          </div>

          <div className={toolbarGroupClass} data-testid="canvas-file-actions">
            {renderCommandButton('copy')}
            {renderCommandButton('save')}
            <button
              type="button"
              onClick={() => void openDocumentFolder()}
              className={toolbarButtonClass}
              aria-label="Open document folder"
              title="Open document folder"
            >
              <FolderOpen size={15} />
            </button>
            <button
              type="button"
              onClick={() => void exportDocument('markdown')}
              className={toolbarButtonClass}
              aria-label="Export Markdown"
              title="Export Markdown"
            >
              <Download size={15} />
            </button>
            <button
              type="button"
              onClick={() => void exportDocument('csv')}
              className={toolbarButtonClass}
              aria-label="Export CSV"
              title="Export CSV"
            >
              <Table2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => void exportDocument('json')}
              className={toolbarButtonClass}
              aria-label="Export metadata"
              title="Export metadata"
            >
              <FileText size={15} />
            </button>
            {(['pdf', 'docx', 'xlsx', 'pptx'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => void exportDocument(format)}
                className={toolbarButtonClass}
                aria-label={`Export ${format.toUpperCase()}`}
                title={`Export ${format.toUpperCase()}`}
              >
                <span className="text-[9px] font-bold uppercase">{format}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className={toolbarButtonClass}
              aria-label="Upload files"
              title="Upload files"
            >
              <Upload size={15} />
            </button>
            {renderCommandButton('close')}
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              className="hidden"
              aria-hidden="true"
              onChange={(event) => {
                void handleUploadFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          {pendingDataset ? (
            <div
              className="absolute right-5 top-16 z-10 w-80 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-[#1a1d25]"
              data-testid="canvas-dataset-actions"
            >
              <div className="font-semibold text-slate-900 dark:text-white">
                Dataset ready: {pendingDataset.filename}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                Deterministic Canvas analysis. No code execution.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {datasetArtifactActions.map((action) => (
                  <button
                    key={`${action.kind}-${action.analysisKind || 'default'}`}
                    type="button"
                    onClick={() =>
                      void createArtifactFromDataset(
                        action.kind,
                        action.analysisKind,
                        action.titlePrefix
                      )
                    }
                    className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPendingDataset(null)}
                  className="rounded-full px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="flex rounded-full bg-slate-100 p-1 dark:bg-white/10"
            data-testid="canvas-view-actions"
          >
            <button
              type="button"
              onClick={() => setMode('document')}
              aria-label="Dock view"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'document'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Dock
            </button>
            <button
              type="button"
              onClick={() => setMode('md')}
              aria-label="Markdown view"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'md'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              MD
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsDiagnosticsOpen((open) => !open);
                setIsTemplatesOpen(false);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Canvas diagnostics"
              aria-expanded={isDiagnosticsOpen}
              title="Canvas diagnostics"
            >
              <MoreHorizontal size={15} />
            </button>
            {isDiagnosticsOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-[#1a1d25]"
                data-testid="canvas-diagnostics-menu"
              >
                <div className="space-y-2 text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Lifecycle</span>
                    <strong className="font-semibold">
                      {lifecycleLabel(documentState.lifecycleState)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Format</span>
                    <strong className="font-semibold">Markdown canonical</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Projection</span>
                    <strong className="font-semibold" data-testid="canvas-projection-status">
                      {isProjectionRefreshing
                        ? 'Projection refreshing'
                        : projectionLabel(documentState.markdownProjectionStatus)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Save</span>
                    <strong className="font-semibold" data-testid="canvas-diagnostics-save-state">
                      {saveStateLabel(documentState.saveState)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Action</span>
                    <strong className="font-semibold" data-testid="canvas-diagnostics-action-state">
                      {activeActionId ? 'Running' : 'Idle'}
                    </strong>
                  </div>
                  {latestDiff ? (
                    <div className="rounded-xl bg-slate-100 p-2 text-[11px] dark:bg-white/10">
                      <div className="font-semibold text-slate-700 dark:text-slate-100">
                        Show changes
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-300">
                        {latestDiff.summary}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {documentState.markdownProjectionStatus === 'failed' ? (
                    <button
                      type="button"
                      onClick={retryProjection}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300"
                    >
                      <RefreshCw size={12} />
                      Retry projection
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={resetToTemplate}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                  >
                    <RefreshCw size={12} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadVersions()}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                  >
                    Versions
                  </button>
                  <button
                    type="button"
                    onClick={showChangesFromLatestVersion}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                  >
                    Show changes
                  </button>
                  <label className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-300">
                    <span className="sr-only">Workflow template</span>
                    <select
                      value={selectedWorkflowTemplate}
                      onChange={(event) =>
                        setSelectedWorkflowTemplate(event.target.value as CanvasWorkflowTemplate)
                      }
                      aria-label="Workflow template"
                      className="max-w-[190px] rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 outline-none hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
                    >
                      {workflowTemplateOptions.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void startWorkflow()}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-1 font-semibold text-primary-700 hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100"
                  >
                    Start workflow
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {
                    workflowTemplateOptions.find(
                      (template) => template.id === selectedWorkflowTemplate
                    )?.description
                  }
                </div>
                {documentState.workflowRuns?.length ? (
                  <div
                    className="mt-3 max-h-72 space-y-2 overflow-auto border-t border-slate-200 pt-3 dark:border-white/10"
                    data-testid="canvas-workflow-ledger"
                  >
                    {documentState.workflowRuns.map((workflow) => (
                      <div
                        key={workflow.id}
                        className="rounded-xl bg-slate-50 p-2 text-[11px] dark:bg-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-100">
                              {workflow.title}
                            </div>
                            <div className="mt-0.5 text-slate-500 dark:text-slate-300">
                              {workflow.status} · {workflow.conversationId}
                            </div>
                            <div className="mt-1 text-slate-500 dark:text-slate-300">
                              Owner: {workflow.collaboration?.ownerId || workflow.createdBy} ·
                              Reviewer: {workflow.collaboration?.reviewerId || 'not assigned'} ·
                              Lifecycle: {workflow.collaboration?.lifecycle || 'draft'}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => void runWorkflowStep(workflow.id)}
                              className="rounded-full bg-primary-600 px-2 py-0.5 font-semibold text-white hover:bg-primary-700"
                            >
                              Run next
                            </button>
                            <button
                              type="button"
                              onClick={() => void resumeWorkflow(workflow.id)}
                              className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                            >
                              Resume
                            </button>
                          </div>
                        </div>
                        <ol className="mt-2 space-y-1">
                          {workflow.steps.map((step) => (
                            <li key={step.id} className="text-slate-500 dark:text-slate-300">
                              <span className="font-semibold text-slate-700 dark:text-slate-100">
                                {step.status}
                              </span>{' '}
                              · {step.title}
                              {step.approvalRequired ? ' · approval required' : ''}
                            </li>
                          ))}
                        </ol>
                        {workflow.events?.length ? (
                          <div className="mt-3 rounded-lg bg-white/70 p-2 dark:bg-white/[0.04]">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                              Timeline
                            </div>
                            <ul className="mt-1 space-y-1 text-slate-500 dark:text-slate-300">
                              {workflow.events.slice(-4).map((event) => (
                                <li key={event.id}>
                                  <span className="font-semibold text-slate-700 dark:text-slate-100">
                                    {event.type.replaceAll('_', ' ')}
                                  </span>{' '}
                                  · {event.summary}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {workflow.outputs?.length ? (
                          <div className="mt-3 rounded-lg bg-primary-50 p-2 dark:bg-primary-400/10">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-primary-200">
                              Outputs
                            </div>
                            <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-200">
                              {workflow.outputs.map((output) => (
                                <li
                                  key={`${output.stepId}-${output.id}`}
                                  className="flex flex-wrap items-center gap-1"
                                >
                                  <span className="font-semibold">{output.type}</span>
                                  <span>· {output.title}</span>
                                  {output.url ? (
                                    <a
                                      href={output.url}
                                      className="font-semibold text-primary-700 hover:text-primary-900 dark:text-primary-200 dark:hover:text-primary-100"
                                    >
                                      Open
                                    </a>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="mt-3 space-y-2 border-t border-slate-200 pt-2 dark:border-white/10">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={
                                workflowReviewerById[workflow.id] ??
                                workflow.collaboration?.reviewerId ??
                                ''
                              }
                              onChange={(event) =>
                                setWorkflowReviewerById((current) => ({
                                  ...current,
                                  [workflow.id]: event.target.value,
                                }))
                              }
                              placeholder="Reviewer id"
                              aria-label={`Reviewer for ${workflow.title}`}
                              className="min-w-[160px] rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void updateWorkflowCollaboration(workflow.id, 'in_review')
                              }
                              className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100"
                            >
                              Send to review
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void updateWorkflowCollaboration(workflow.id, 'approved')
                              }
                              className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-400/20 dark:text-emerald-100"
                            >
                              Mark approved
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={workflowCommentById[workflow.id] || ''}
                              onChange={(event) =>
                                setWorkflowCommentById((current) => ({
                                  ...current,
                                  [workflow.id]: event.target.value,
                                }))
                              }
                              placeholder="Add workflow comment"
                              aria-label={`Comment for ${workflow.title}`}
                              className="min-w-[220px] flex-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() => void addWorkflowComment(workflow.id)}
                              className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                            >
                              Add comment
                            </button>
                          </div>
                          {workflow.collaboration?.comments?.length ? (
                            <ul className="space-y-1 text-slate-500 dark:text-slate-300">
                              {workflow.collaboration.comments.slice(-3).map((comment) => (
                                <li key={comment.id}>
                                  {comment.authorId}: {comment.body}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {isVersionsOpen ? (
                  <div className="mt-3 max-h-56 space-y-2 overflow-auto border-t border-slate-200 pt-3 dark:border-white/10">
                    {isVersionsLoading ? (
                      <div className="text-slate-500 dark:text-slate-400">Loading versions...</div>
                    ) : versions.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No versions yet.</div>
                    ) : (
                      versions.map((version) => (
                        <div
                          key={version.id}
                          className="rounded-xl bg-slate-50 p-2 text-[11px] dark:bg-white/[0.06]"
                        >
                          <div className="font-semibold text-slate-700 dark:text-slate-100">
                            {version.operationType}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-300">
                            {new Date(version.createdAt).toLocaleString()} · {version.summary}
                          </div>
                          <button
                            type="button"
                            onClick={() => void restoreVersion(version)}
                            className="mt-2 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                          >
                            Restore
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {actionFeedback ? (
        <div
          className="shrink-0 border-b border-slate-200/70 bg-white/60 px-4 py-2 text-xs text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-300"
          role="status"
          data-testid="canvas-action-feedback"
        >
          {actionFeedback}
        </div>
      ) : null}

      {pendingOperation ? (
        <section
          data-testid="canvas-operation-preview"
          className="shrink-0 border-b border-blue-200/70 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-200">
                Approval required
              </div>
              <div className="mt-1 font-semibold">
                {pendingOperation.preview.proposedChange || 'Review proposed Canvas change'}
              </div>
              <div className="mt-1 text-xs text-blue-800 dark:text-blue-100/80">
                {pendingOperation.preview.markdownDiff?.summary || 'No Markdown line changes.'}
                {pendingOperation.preview.affectedBlocks?.length
                  ? ` · ${pendingOperation.preview.affectedBlocks.length} affected block(s)`
                  : ''}
                {pendingOperation.preview.validationResult?.message
                  ? ` · ${pendingOperation.preview.validationResult.message}`
                  : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void applyPendingOperation()}
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                {pendingOperation.applyLabel}
              </button>
              <button
                type="button"
                onClick={rejectPendingOperation}
                className="rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-white dark:border-blue-300/30 dark:bg-white/10 dark:text-blue-100"
              >
                Reject
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 overflow-auto">
          <div className="flex min-h-full w-full max-w-[980px] px-3 pb-3 pt-2 lg:pl-2 lg:pr-8">
            {isHydrating ? (
              <div
                data-testid="canvas-loading-skeleton"
                className="min-h-[680px] flex-1 animate-pulse rounded-[1.35rem] border border-white/10 bg-[#1a1d25] p-10"
              >
                <div className="h-8 w-2/3 rounded bg-white/10" />
                <div className="mt-8 h-4 w-full rounded bg-white/10" />
                <div className="mt-3 h-4 w-5/6 rounded bg-white/10" />
                <div className="mt-8 h-32 rounded bg-white/10" />
              </div>
            ) : mode === 'md' ? (
              <div className="flex flex-1 flex-col">
                {selectionBlockActions}
                <textarea
                  value={documentState.contentMd}
                  onChange={(event) => updateMarkdown(event.target.value)}
                  onSelect={captureMarkdownSelection}
                  onKeyUp={captureMarkdownSelection}
                  data-testid="canvas-md-view"
                  className="min-h-[680px] flex-1 resize-y rounded-[1.35rem] border border-slate-200 bg-white p-6 font-mono text-sm leading-6 text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.08)] outline-none transition-colors focus:border-primary-300 dark:border-white/10 dark:bg-navy-900 dark:text-slate-100"
                  spellCheck={false}
                />
              </div>
            ) : (
              <article
                ref={documentViewRef}
                data-testid="canvas-document-view"
                onMouseUp={captureDocumentSelection}
                onKeyUp={captureDocumentSelection}
                className="min-h-[680px] flex-1 rounded-[1.35rem] border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-navy-900 dark:shadow-none md:px-12"
              >
                {selectionBlockActions}
                <CanvasMarkdownRenderer text={documentState.contentMd} />
                {documentState.blocks?.length ? (
                  <div className="mt-8" data-testid="canvas-artifact-blocks">
                    {documentState.blocks.map((block) => (
                      <CanvasArtifactBlockRenderer
                        key={block.id}
                        block={block}
                        onFeedback={setActionFeedback}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
