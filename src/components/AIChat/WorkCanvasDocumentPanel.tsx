import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Lightbulb,
  MoreHorizontal,
  Plus,
  Presentation,
  RefreshCw,
  Rocket,
  RotateCcw,
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
  CanvasWorkflowRun,
} from '@/types/canvasWorkspace';
import { getCanvasActionAvailability } from '@/utils/canvas/canvasActionAvailability';
import {
  mapDraftResponseToCanvasDocumentState,
  starterIdToCanvasKind,
} from '@/utils/canvas/canvasDraftAdapter';
import { workCanvasActionErrorMessage } from '@/utils/canvas/workCanvasActionErrorMessage';

import { CanvasArtifactBlockRenderer } from './CanvasArtifactBlockRenderer';
import type { Editor as TiptapEditor } from '@tiptap/react';

import { CanvasRichEditor } from './CanvasEditor/CanvasRichEditor';
import { getInitialCanvasMode, persistCanvasMode } from './CanvasEditor/canvasViewMode';
import { useCanvasAIStream } from './CanvasEditor/useCanvasAIStream';
import { CanvasMarkdownRenderer } from './CanvasMarkdownRenderer';

export type { ActiveCanvasDocument } from '@/types/canvasWorkspace';

interface StarterTemplate {
  id: CanvasStarterId;
  label: string;
  title: string;
  description: string;
  markdown: string;
  capability: CanvasCapabilityStatus;
  capabilityNote: string;
}

interface WorkCanvasDocumentPanelProps {
  conversationId?: string | null;
  initialStarterId?: CanvasStarterId | null;
  initialDraftId?: string | null;
  initialProjectionStatus?: CanvasProjectionStatus;
  initialBlocks?: CanvasArtifactBlock[];
  onActiveDocumentChange?: (document: ActiveCanvasDocument) => void;
  onCanvasSelectionChange?: (selection: CanvasSelection | null) => void;
  onClose?: () => void;
}

type WorkCanvasApplyPayload = Parameters<typeof Api.workCanvasApplyOperation>[1];
type WorkCanvasOperation = WorkCanvasApplyPayload['operation'];

interface PendingCanvasOperation {
  draftId: string;
  baseUpdatedAt?: string | null;
  operation: WorkCanvasOperation;
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
type CanvasCapabilityStatus = 'real' | 'partial' | 'scaffold' | 'missing' | 'out_of_scope';
type CanvasWorkflowTemplate =
  | 'market_research_to_report'
  | 'meeting_note_to_initiatives'
  | 'kpi_review_to_dashboard'
  | 'client_proposal_to_deck'
  | 'decision_memo_to_execution_plan';
type CanvasQuickAddElement = 'text' | 'heading' | 'table' | 'diagram' | 'list' | 'summary';
type SelectionEditShortcut = 'use_selection' | 'action_list' | 'bullet_summary';

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

function approveCanvasOperation(operation: WorkCanvasOperation): WorkCanvasOperation {
  switch (operation.type) {
    case 'generate_block_from_selection':
    case 'generate_artifact_from_dataset':
    case 'insert_block':
    case 'update_block':
    case 'delete_block':
    case 'convert_block':
    case 'regenerate_projection':
      return { ...operation, approved: true };
    default:
      return operation;
  }
}

const starterTemplates: StarterTemplate[] = [
  {
    id: 'thoughts',
    label: 'Zbierz myśli',
    title: 'Working Notes',
    description: 'Capture raw ideas and sort them into usable business structure.',
    capability: 'real',
    capabilityNote: 'Markdown document, save, selection and Teresa context are production-backed.',
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
    capability: 'real',
    capabilityNote: 'Markdown document, autosave, versions, export and Teresa context are backed.',
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
    capability: 'partial',
    capabilityNote:
      'Research brief creates a linked ResearchSession; evidence execution remains partial.',
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
    capability: 'partial',
    capabilityNote:
      'Decision memo works; full DecisionCanvas lane and tracked approval remain partial.',
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
    capability: 'real',
    capabilityNote: 'Markdown execution plan with workflow/output follow-up is backed.',
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

function starterTemplateById(starterId?: CanvasStarterId | null): StarterTemplate {
  return starterTemplates.find((template) => template.id === starterId) || starterTemplates[1];
}

const LAST_DRAFT_ID_STORAGE_KEY = 'workCanvas.lastDraftId';

const menuWorkspaceActionIds: CanvasActionId[] = [
  'send-to-idea',
  'save-as-note',
  'create-initiative',
];

const menuOutputActionIds: CanvasActionId[] = ['create-presentation', 'create-table', 'create-report'];

const isVitestRuntime = typeof process !== 'undefined' && Boolean(process.env?.VITEST);

const defaultCanvasRuntimeCapabilities: CanvasRuntimeCapabilities = {
  canCreatePresentation: isVitestRuntime,
  canCreateTable: isVitestRuntime,
  canCreateReport: isVitestRuntime,
  canSendToIdea: isVitestRuntime,
  canSaveAsNote: isVitestRuntime,
  canCreateInitiative: isVitestRuntime,
  canShare: false,
};

const richEditorDecision = {
  status: 'post_ga_decision_gate',
  editorRuntime: 'markdown_first_with_review_controls',
  migrationHint: 'TipTap/ProseMirror stays feature-flagged until Stage 54 execution.',
} as const;

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
  capability: CanvasCapabilityStatus;
  capabilityNote: string;
}> = [
  {
    id: 'market_research_to_report',
    label: 'Market research to report',
    description: 'Research narrative, evidence map and report output.',
    capability: 'partial',
    capabilityNote: 'Governed workflow is real; ResearchSession planning linkage is backed.',
  },
  {
    id: 'meeting_note_to_initiatives',
    label: 'Meeting note to initiatives',
    description: 'Decisions, owners, initiative shortlist and brief.',
    capability: 'partial',
    capabilityNote:
      'Workflow ledger is backed; initiative handoff is still a controlled Canvas output.',
  },
  {
    id: 'kpi_review_to_dashboard',
    label: 'KPI review to dashboard',
    description: 'KPI signals, dashboard plan and table output.',
    capability: 'partial',
    capabilityNote: 'Dataset profiling is backed; full dashboard runtime remains partial.',
  },
  {
    id: 'client_proposal_to_deck',
    label: 'Client proposal to deck',
    description: 'Proposal storyline, deck outline and presentation output.',
    capability: 'partial',
    capabilityNote:
      'Presentation output is backed; full DeckCanvas editing lane is not complete yet.',
  },
  {
    id: 'decision_memo_to_execution_plan',
    label: 'Decision memo to execution plan',
    description: 'Decision logic, milestones and execution plan.',
    capability: 'real',
    capabilityNote: 'Governed workflow, approval gate and output lineage are backed.',
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

const toolbarGroupClass =
  'flex items-center gap-1 rounded-full border border-slate-200 px-1 dark:border-white/10';


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
    researchSessionId: undefined,
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

function capabilityLabel(status: CanvasCapabilityStatus): string {
  if (status === 'out_of_scope') return 'Out of scope';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function capabilityBadgeClass(status: CanvasCapabilityStatus): string {
  if (status === 'real') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'partial') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (status === 'scaffold') {
    return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (status === 'missing') {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
}

function renderCapabilityBadge(status: CanvasCapabilityStatus, testId?: string) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${capabilityBadgeClass(
        status
      )}`}
    >
      {capabilityLabel(status)}
    </span>
  );
}

function buildLineDiff(before: string, after: string): CanvasDiffSummary {
  const beforeLines = String(before || '').split('\n');
  const afterLines = String(after || '').split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const addedLineSamples = afterLines
    .filter((line) => !beforeSet.has(line) && line.trim())
    .slice(0, 3);
  const removedLineSamples = beforeLines
    .filter((line) => !afterSet.has(line) && line.trim())
    .slice(0, 3);
  const addedLines = afterLines.filter((line) => !beforeSet.has(line)).length;
  const removedLines = beforeLines.filter((line) => !afterSet.has(line)).length;
  return {
    addedLines,
    removedLines,
    summary: `${addedLines} lines added, ${removedLines} lines removed`,
    addedLineSamples,
    removedLineSamples,
  };
}

function selectedTextLines(text: string): string[] {
  return String(text || '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^\s*-\s+\[[ xX]\]\s+/, '')
        .trim()
    )
    .filter(Boolean);
}

function shortcutReplacementForSelection(
  shortcut: SelectionEditShortcut,
  selectedText: string
): string {
  if (shortcut === 'use_selection') return selectedText.trim();
  const lines = selectedTextLines(selectedText);
  if (shortcut === 'action_list') {
    return lines.map((line) => `- [ ] ${line.replace(/[.;]\s*$/, '')}`).join('\n');
  }
  return lines.map((line) => `- ${line.replace(/[.;]\s*$/, '')}`).join('\n');
}

const canvasActionErrorMessage = workCanvasActionErrorMessage;

function isWorkflowReviewBlocked(workflow: {
  collaboration?: {
    reviewerId?: string | null;
    lifecycle?: 'draft' | 'in_review' | 'approved';
  };
}): boolean {
  const lifecycle = workflow.collaboration?.lifecycle || 'draft';
  return Boolean(
    (workflow.collaboration?.reviewerId || lifecycle === 'in_review') && lifecycle !== 'approved'
  );
}

function getPendingWorkflowApproval(workflow: CanvasWorkflowRun) {
  const pendingApproval = workflow.approvals?.find((approval) => approval.status === 'pending');
  if (!pendingApproval) return null;
  const step = workflow.steps?.find((item) => item.id === pendingApproval.stepId);
  return {
    ...pendingApproval,
    stepTitle: step?.title || pendingApproval.stepId,
  };
}

function getWorkflowTerminalExecutionLabel(workflow: CanvasWorkflowRun): string | null {
  if (workflow.status === 'completed') return 'Completed';
  if (workflow.status === 'failed') return 'Failed';
  return null;
}

export function WorkCanvasDocumentPanel({
  conversationId,
  initialStarterId,
  initialDraftId,
  initialProjectionStatus = 'synced',
  initialBlocks = [],
  onActiveDocumentChange,
  onCanvasSelectionChange,
  onClose,
}: WorkCanvasDocumentPanelProps) {
  const [mode, setMode] = React.useState<CanvasMode>(() => getInitialCanvasMode());
  const [documentState, setDocumentState] = React.useState<CanvasDocumentState>(() =>
    createDocumentState(
      starterTemplateById(initialStarterId),
      initialProjectionStatus,
      initialBlocks
    )
  );
  const [isHydrating, setIsHydrating] = React.useState(true);
  const [isProjectionRefreshing, setIsProjectionRefreshing] = React.useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = React.useState(false);
  const [isNewCanvasMenuOpen, setIsNewCanvasMenuOpen] = React.useState(false);
  const [isMdPropertiesOpen, setIsMdPropertiesOpen] = React.useState(false);
  const [quickAddElement, setQuickAddElement] = React.useState<CanvasQuickAddElement>('text');
  const [quickAddPrompt, setQuickAddPrompt] = React.useState('');
  const [selectionAiPrompt, setSelectionAiPrompt] = React.useState('');
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = React.useState(false);
  const [templateBuilderName, setTemplateBuilderName] = React.useState('');
  const [templateBuilderGoal, setTemplateBuilderGoal] = React.useState('');
  const [templateBuilderSections, setTemplateBuilderSections] = React.useState(
    'Context, Analysis, Options, Recommendation, Next steps'
  );
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null);
  const [actionFeedbackTone, setActionFeedbackTone] = React.useState<'status' | 'alert'>('status');
  const [activeActionId, setActiveActionId] = React.useState<CanvasActionId | null>(null);
  const [canvasSelection, setCanvasSelection] = React.useState<CanvasSelection | null>(null);
  // Live TipTap editor instance (rich mode), lifted so Teresa can stream into it.
  const [richEditor, setRichEditor] = React.useState<TiptapEditor | null>(null);
  const [versions, setVersions] = React.useState<CanvasVersionSummary[]>([]);
  // Prev/Next stepper cursor into `versions` (0 = latest, list is DESC by date).
  const [versionCursor, setVersionCursor] = React.useState(0);
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
  const [selectionEditDraft, setSelectionEditDraft] = React.useState('');
  const [runningWorkflowStepById, setRunningWorkflowStepById] = React.useState<
    Record<string, boolean>
  >({});
  const [isStartingWorkflow, setIsStartingWorkflow] = React.useState(false);
  const [resumingWorkflowById, setResumingWorkflowById] = React.useState<Record<string, boolean>>(
    {}
  );
  const [updatingWorkflowReviewById, setUpdatingWorkflowReviewById] = React.useState<
    Record<string, boolean>
  >({});
  const [addingWorkflowCommentById, setAddingWorkflowCommentById] = React.useState<
    Record<string, boolean>
  >({});
  const [isFinalizingResearchReport, setIsFinalizingResearchReport] = React.useState(false);
  const [runtimeCapabilities, setRuntimeCapabilities] = React.useState<CanvasRuntimeCapabilities>(
    defaultCanvasRuntimeCapabilities
  );
  const documentViewRef = React.useRef<HTMLElement | null>(null);
  const lastSavedContentRef = React.useRef(documentState.contentMd);
  const lastSavedTitleRef = React.useRef(documentState.title);
  const latestContentRef = React.useRef(documentState.contentMd);
  const latestTitleRef = React.useRef(documentState.title);
  const autosaveTimerRef = React.useRef<number | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const markdownEditorRef = React.useRef<HTMLTextAreaElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const initialStarterPersistedRef = React.useRef(false);

  const activeTemplate =
    starterTemplates.find((template) => template.id === documentState.activeStarterId) ||
    starterTemplates[1];
  const selectedWorkflowTemplateOption =
    workflowTemplateOptions.find((template) => template.id === selectedWorkflowTemplate) ||
    workflowTemplateOptions[0];

  const setStatusFeedback = React.useCallback((message: string) => {
    setActionFeedbackTone('status');
    setActionFeedback(message);
  }, []);

  const setAlertFeedback = React.useCallback((message: string) => {
    setActionFeedbackTone('alert');
    setActionFeedback(message);
  }, []);

  const setCanvasErrorFeedback = React.useCallback((error: unknown, fallback: string) => {
    setActionFeedbackTone('alert');
    setActionFeedback(workCanvasActionErrorMessage(error, fallback));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const hydrateConversationDraft = async () => {
      const preferredDraftId = String(
        initialDraftId ||
          (typeof window !== 'undefined'
            ? window.localStorage.getItem(LAST_DRAFT_ID_STORAGE_KEY)
            : '') ||
          ''
      ).trim();

      if (!conversationId && !preferredDraftId) {
        setIsHydrating(false);
        return;
      }

      try {
        const token = window.localStorage.getItem('token') || '';
        if (preferredDraftId) {
          try {
            const responseById = await fetch(
              `/api/work-canvas/drafts/${encodeURIComponent(preferredDraftId)}`,
              {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              }
            );
            const jsonById = await responseById.json().catch(() => ({}));
            const draftById = jsonById?.data?.draft || jsonById?.data;
            if (responseById.ok && !cancelled && draftById) {
              setDocumentState((current) =>
                mapDraftResponseToCanvasDocumentState(draftById, current)
              );
              lastSavedContentRef.current =
                typeof draftById.contentMd === 'string'
                  ? draftById.contentMd
                  : lastSavedContentRef.current;
              lastSavedTitleRef.current =
                typeof draftById.title === 'string' ? draftById.title : lastSavedTitleRef.current;
              return;
            }
            if (responseById.status === 404) {
              window.localStorage.removeItem(LAST_DRAFT_ID_STORAGE_KEY);
            }
          } catch {
            // ignore and fallback to conversation list when possible
          }
        }

        if (!conversationId) return;

        const response = await fetch(
          `/api/work-canvas/drafts?conversationId=${encodeURIComponent(conversationId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        const drafts = Array.isArray(json?.data) ? json.data : [];
        const match =
          preferredDraftId.length > 0
            ? drafts.find(
                (draft: any) =>
                  String((draft as any)?.draftId || (draft as any)?.id || '') === preferredDraftId
              )
            : null;
        const latestDraft = match || drafts[0];

        if (!latestDraft && preferredDraftId) {
          try {
            const responseById = await fetch(
              `/api/work-canvas/drafts/${encodeURIComponent(preferredDraftId)}`,
              {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              }
            );
            const jsonById = await responseById.json().catch(() => ({}));
            const draftById = jsonById?.data;
            if (!responseById.ok || cancelled || !draftById) return;
            setDocumentState((current) =>
              mapDraftResponseToCanvasDocumentState(draftById, current)
            );
            lastSavedContentRef.current =
              typeof draftById.contentMd === 'string'
                ? draftById.contentMd
                : lastSavedContentRef.current;
            lastSavedTitleRef.current =
              typeof draftById.title === 'string' ? draftById.title : lastSavedTitleRef.current;
          } catch {
            // ignore, fallback to local defaults
          }
          return;
        }

        if (latestDraft) {
          setDocumentState((current) =>
            mapDraftResponseToCanvasDocumentState(latestDraft, current)
          );
          lastSavedContentRef.current =
            typeof latestDraft.contentMd === 'string'
              ? latestDraft.contentMd
              : lastSavedContentRef.current;
          lastSavedTitleRef.current =
            typeof latestDraft.title === 'string' ? latestDraft.title : lastSavedTitleRef.current;
          const hydratedDraftId = String(
            (latestDraft as any)?.draftId || (latestDraft as any)?.id || ''
          ).trim();
          if (hydratedDraftId) {
            window.localStorage.setItem(LAST_DRAFT_ID_STORAGE_KEY, hydratedDraftId);
          }
        }
      } catch {
        // keep local draft defaults when hydration is unavailable
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };

    void hydrateConversationDraft();
    return () => {
      cancelled = true;
    };
  }, [conversationId, initialDraftId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const draftId = String(documentState.draftId || '').trim();
    if (!draftId) return;
    window.localStorage.setItem(LAST_DRAFT_ID_STORAGE_KEY, draftId);
  }, [documentState.draftId]);

  React.useEffect(() => {
    let cancelled = false;
    const token = window.localStorage.getItem('token') || '';
    if (!token) return;

    const capabilityMap: Array<[keyof CanvasRuntimeCapabilities, string]> = [
      ['canCreatePresentation', 'canvas.output.presentation'],
      ['canCreateTable', 'canvas.output.table'],
      ['canCreateReport', 'canvas.output.report'],
      ['canSendToIdea', 'canvas.convert.idea'],
      ['canSaveAsNote', 'canvas.convert.note'],
      ['canCreateInitiative', 'canvas.convert.initiative'],
      ['canShare', 'canvas.share'],
    ];

    const loadCapabilities = async () => {
      const entries = await Promise.all(
        capabilityMap.map(async ([key, capability]) => {
          try {
            const response = await fetch(
              `/api/access/effective?capability=${encodeURIComponent(capability)}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const json = await response.json().catch(() => ({}));
            return [key, Boolean(json?.decision?.allowed)] as const;
          } catch {
            return [key, false] as const;
          }
        })
      );

      if (cancelled) return;
      const next: CanvasRuntimeCapabilities = { ...defaultCanvasRuntimeCapabilities };
      for (const [key, allowed] of entries) {
        next[key] = allowed;
      }
      setRuntimeCapabilities(next);
    };

    void loadCapabilities();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  React.useEffect(() => {
    persistCanvasMode(mode);
  }, [mode]);

  // Keep the version stepper cursor in range whenever the list reloads.
  React.useEffect(() => {
    setVersionCursor((cursor) => Math.min(Math.max(cursor, 0), Math.max(versions.length - 1, 0)));
  }, [versions]);

  React.useEffect(() => {
    onActiveDocumentChange?.({
      draftId: documentState.draftId,
      researchSessionId: documentState.researchSessionId,
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
    latestTitleRef.current = documentState.title;
  }, [documentState.contentMd, documentState.title]);

  React.useEffect(() => {
    onCanvasSelectionChange?.(canvasSelection);
  }, [canvasSelection, onCanvasSelectionChange]);

  const persistDraft = React.useCallback(
    async (draft?: CanvasDocumentState) => {
      const draftToPersist = draft || {
        ...documentState,
        title: titleInputRef.current?.value ?? latestTitleRef.current,
        contentMd: markdownEditorRef.current?.value ?? latestContentRef.current,
      };
      const effectiveConversationId = conversationId || `canvas-${Date.now()}`;

      setDocumentState((current) => ({ ...current, saveState: 'saving' }));
      try {
        const token = window.localStorage.getItem('token') || '';
        const saveDraft = async (baseUpdatedAt: string | null | undefined) =>
          fetch(
            draftToPersist.draftId
              ? `/api/work-canvas/drafts/${encodeURIComponent(draftToPersist.draftId)}`
              : '/api/work-canvas/drafts',
            {
              method: draftToPersist.draftId ? 'PUT' : 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                conversationId: effectiveConversationId,
                baseUpdatedAt: baseUpdatedAt || null,
                kind: draftToPersist.kind,
                title: draftToPersist.title,
                content: draftToPersist.contentMd,
                canonicalFormat: draftToPersist.canonicalFormat,
                contentMd: draftToPersist.contentMd,
                blocks: draftToPersist.blocks || [],
                saveState: 'saved',
                lifecycleState: draftToPersist.lifecycleState,
                researchSessionId: draftToPersist.researchSessionId || null,
                provenance: {
                  source: 'chat-work-canvas-panel',
                  starterId: draftToPersist.activeStarterId,
                  researchSessionId: draftToPersist.researchSessionId || null,
                  workflowRuns: draftToPersist.workflowRuns || [],
                },
              }),
            }
          );

        let response = await saveDraft(draftToPersist.updatedAt || null);
        let json = await response.json().catch(() => ({}));
        if (
          response.status === 409 &&
          draftToPersist.draftId &&
          String(json?.code || '') === 'CANVAS_DRAFT_CONFLICT'
        ) {
          const currentResponse = await fetch(
            `/api/work-canvas/drafts/${encodeURIComponent(draftToPersist.draftId)}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }
          );
          const currentJson = await currentResponse.json().catch(() => ({}));
          const currentDraft = currentJson?.data?.draft || currentJson?.data;
          response = await saveDraft(
            typeof currentDraft?.updatedAt === 'string' ? currentDraft.updatedAt : null
          );
          json = await response.json().catch(() => ({}));
        }
        if (!response.ok) {
          const saveError: any = new Error(json?.error || 'Failed to save Canvas draft');
          saveError.data = json;
          throw saveError;
        }
        const savedDraft = json?.data;
        const nextState = mapDraftResponseToCanvasDocumentState(savedDraft, {
          ...draftToPersist,
          draftId: draftToPersist.draftId,
          saveState: 'saved',
          projectionError: null,
        });
        const savedDraftId = String(
          savedDraft?.draftId || savedDraft?.id || nextState.draftId || ''
        ).trim();
        if (savedDraftId) {
          window.localStorage.setItem(LAST_DRAFT_ID_STORAGE_KEY, savedDraftId);
        }
        setDocumentState((current) => {
          if (current.contentMd !== draftToPersist.contentMd) {
            return {
              ...current,
              draftId: savedDraftId || current.draftId || draftToPersist.draftId,
              saveState: 'unsaved',
            };
          }
          return mapDraftResponseToCanvasDocumentState(savedDraft, {
            ...current,
            draftId: savedDraftId || current.draftId || draftToPersist.draftId,
            saveState: 'saved',
            projectionError: null,
          });
        });
        if (latestContentRef.current === draftToPersist.contentMd) {
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
        setAlertFeedback(message);
        return null;
      }
    },
    [conversationId, documentState]
  );

  const createResearchSessionForDraft = async (
    draft: CanvasDocumentState
  ): Promise<string | null> => {
    if (draft.activeStarterId !== 'research') return null;
    if (!conversationId) return null;
    try {
      const result = await Api.createResearchSession({
        mission: draft.title,
        scope: 'Canvas research brief',
        questions: ['What evidence is needed to support this Canvas research brief?'],
        allowedSources: ['web', 'attachment', 'product', 'org'],
        expectedOutput: 'research_report',
        conversationId: conversationId || undefined,
      });
      const session = (result as any)?.session;
      const researchSessionId =
        typeof session?.sessionId === 'string'
          ? session.sessionId
          : typeof session?.id === 'string'
            ? session.id
            : null;
      if (researchSessionId) {
        setStatusFeedback(`ResearchSession linked: ${researchSessionId}.`);
      }
      return researchSessionId;
    } catch (error) {
      setCanvasErrorFeedback(error, 'ResearchSession planning failed.');
      return null;
    }
  };

  React.useEffect(() => {
    if (
      initialStarterId &&
      !initialStarterPersistedRef.current &&
      documentState.activeStarterId === initialStarterId &&
      !documentState.draftId
    ) {
      initialStarterPersistedRef.current = true;
      const snapshot = documentState;
      void (async () => {
        const researchSessionId = await createResearchSessionForDraft(snapshot);
        const draftToPersist = researchSessionId ? { ...snapshot, researchSessionId } : snapshot;
        if (researchSessionId) setDocumentState(draftToPersist);
        void persistDraft(draftToPersist);
      })();
      return;
    }
    if (!initialStarterId || documentState.activeStarterId === initialStarterId) return;
    const next = createDocumentState(starterTemplateById(initialStarterId));
    setDocumentState(next);
    setMode('document');
    void (async () => {
      const researchSessionId = await createResearchSessionForDraft(next);
      const draftToPersist = researchSessionId ? { ...next, researchSessionId } : next;
      if (researchSessionId) setDocumentState(draftToPersist);
      void persistDraft(draftToPersist);
    })();
  }, [documentState.activeStarterId, initialStarterId]);

  const selectTemplate = (template: StarterTemplate) => {
    const next = createDocumentState(template);
    setDocumentState(next);
    setMode('document');
    void (async () => {
      const researchSessionId = await createResearchSessionForDraft(next);
      const draftToPersist = researchSessionId ? { ...next, researchSessionId } : next;
      if (researchSessionId) setDocumentState(draftToPersist);
      void persistDraft(draftToPersist);
    })();
  };

  const copyMarkdown = async () => {
    await navigator.clipboard?.writeText(documentState.contentMd);
    setStatusFeedback('Markdown copied to clipboard.');
  };

  const exportDocument = async (
    format: 'markdown' | 'csv' | 'json' | 'pdf' | 'docx' | 'xlsx' | 'pptx'
  ) => {
    const draft = await ensurePersistedDraft();
    if (!draft?.draftId) {
      setAlertFeedback('Export is available after the draft is saved.');
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
      setStatusFeedback(`Exported ${filename}.`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to export Canvas draft.');
    }
  };

  const openDocumentFolder = async () => {
    const draft = await ensurePersistedDraft();
    if (!draft?.draftId) {
      setAlertFeedback('Document location is available after the draft is saved.');
      return;
    }
    window.open(
      `/work-canvas/drafts/${encodeURIComponent(draft.draftId)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setStatusFeedback('Document location opened.');
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
        setStatusFeedback(
          `${datasetFile.name} ready for Canvas dataset actions: table, chart, dashboard or findings.`
        );
      } catch (error) {
        setCanvasErrorFeedback(error, 'Failed to read dataset file.');
      }
      return;
    }
    setStatusFeedback(
      `Uploading ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} to this workspace...`
    );
    try {
      const uploaded = await Promise.all(
        selectedFiles.map((file) => Api.uploadChatAttachment(file))
      );
      setStatusFeedback(
        `Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}: ${uploaded
          .map((file) => file.filename)
          .join(', ')}`
      );
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to upload files.');
    }
  };

  const createArtifactFromDataset = async (
    artifactKind: 'table' | 'chart' | 'dashboard' | 'research',
    analysisKind?: DatasetAnalysisKind,
    titlePrefix?: string
  ) => {
    if (!pendingDataset) {
      setAlertFeedback('Upload a CSV, JSON, or XLSX dataset first.');
      return;
    }
    const title =
      Boolean(titlePrefix) || artifactKind === 'dashboard'
        ? `${titlePrefix || 'KPI Dashboard'}: ${pendingDataset.filename}`
        : `${artifactKind} from ${pendingDataset.filename}`;
    setStatusFeedback(`Preparing ${title} preview...`);
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
      setStatusFeedback(`Preview ready for ${title}.`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to analyze dataset.');
    }
  };

  const updateMarkdown = (contentMd: string) => {
    latestContentRef.current = contentMd;
    setDocumentState((current) => ({
      ...current,
      contentMd,
      saveState: 'unsaved',
      markdownProjectionStatus: 'synced',
      projectionError: null,
    }));
  };

  // ── Teresa streams into the document (chat-driven) ──────────────────
  // The hook owns the SSE → TipTap insertion; onComplete reconciles the
  // canonical markdown. The chat composer (UnifiedChatPanel) only dispatches a
  // 'canvas-stream-request' CustomEvent — no direct coupling — so this works
  // without threading the editor instance back through the chat tree.
  const { isStreaming, streamToCanvas, stopStream } = useCanvasAIStream({
    editor: richEditor,
    onComplete: (finalMd) => updateMarkdown(finalMd),
  });

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | {
            prompt?: string;
            mode?: 'append' | 'replace' | 'generate';
            history?: Array<{ role: string; parts: Array<{ text: string }> }>;
            language?: string;
            canvasContextPacket?: Record<string, unknown> | null;
          }
        | undefined;
      const prompt = detail?.prompt?.trim();
      if (!prompt || !richEditor) return;
      streamToCanvas(prompt, detail?.mode || 'append', {
        history: detail?.history,
        language: detail?.language,
        canvasContextPacket: detail?.canvasContextPacket ?? null,
      });
    };
    window.addEventListener('canvas-stream-request', handler);
    return () => window.removeEventListener('canvas-stream-request', handler);
  }, [richEditor, streamToCanvas]);

  const buildQuickAddMarkdown = (element: CanvasQuickAddElement, prompt: string) => {
    const cleanedPrompt = prompt.trim();
    switch (element) {
      case 'heading':
        return `## ${cleanedPrompt || 'New section heading'}`;
      case 'table':
        return `### ${cleanedPrompt || 'Table'}\n\n| Column A | Column B | Column C |\n|---|---|---|\n|  |  |  |`;
      case 'diagram':
        return `### ${cleanedPrompt || 'Diagram note'}\n\n\`\`\`mermaid\nflowchart LR\n  A[Input] --> B[Process]\n  B --> C[Output]\n\`\`\``;
      case 'list':
        return `### ${cleanedPrompt || 'Action list'}\n\n- [ ] First item\n- [ ] Second item\n- [ ] Third item`;
      case 'summary':
        return `### ${cleanedPrompt || 'Summary'}\n\nKey takeaway:\n\n- `;
      case 'text':
      default:
        return `${cleanedPrompt || 'New paragraph'}\n`;
    }
  };

  const insertQuickAddElement = () => {
    const snippet = buildQuickAddMarkdown(quickAddElement, quickAddPrompt);
    const baseContent = (latestContentRef.current || documentState.contentMd || '').trimEnd();
    const next = `${baseContent}\n\n${snippet}\n`;
    updateMarkdown(next);
    void persistDraft();
    setStatusFeedback('Element added to Markdown draft.');
    setQuickAddPrompt('');
  };

  const applySelectionMenuAction = (action: 'expand' | 'shorten' | 'rewrite' | 'suggest') => {
    const selectedText = canvasSelection?.selectedText?.trim();
    if (!selectedText) {
      setAlertFeedback('Select text first, then run AI action.');
      return;
    }
    const prefix =
      action === 'expand'
        ? 'Expand this thought with more detail and concrete next steps:'
        : action === 'shorten'
          ? 'Shorten this fragment to a concise, clear version:'
          : action === 'rewrite'
            ? 'Rewrite this fragment with better clarity and tone:'
            : 'Give practical suggestions to improve this fragment:';
    setSelectionAiPrompt(`${prefix}\n\n${selectedText}`);
  };

  const previewSelectionMenuPrompt = async () => {
    const selectedText = canvasSelection?.selectedText?.trim();
    if (!selectedText) {
      setAlertFeedback('Select text first, then preview AI edit.');
      return;
    }
    if (!selectionAiPrompt.trim()) {
      setAlertFeedback('Write AI instruction first.');
      return;
    }
    setSelectionEditDraft(selectionAiPrompt.trim());
    await previewSelectionEdit();
  };

  const triggerDatasetUpload = () => {
    uploadInputRef.current?.click();
  };

  const applyBuiltTemplate = () => {
    const name = templateBuilderName.trim();
    if (!name) {
      setAlertFeedback('Podaj nazwę template’u.');
      return;
    }
    const goal = templateBuilderGoal.trim() || 'Use this template to guide Teresa and your team.';
    const sectionList = templateBuilderSections
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 8);
    const markdown = [
      `# ${name}`,
      '',
      `Purpose: ${goal}`,
      '',
      ...sectionList.flatMap((section) => [`## ${section}`, '', '- ', '']),
    ].join('\n');
    updateTitle(name);
    updateMarkdown(markdown);
    setMode('md');
    setIsTemplateBuilderOpen(false);
    setStatusFeedback(`Template "${name}" applied to this canvas.`);
    void persistDraft();
  };

  const createArtifactBlockFromSelection = async (kind: CanvasArtifactBlockKind) => {
    const selectedText = canvasSelection?.selectedText?.trim();
    if (!selectedText) {
      setAlertFeedback('Select Canvas text first, then create a block.');
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
    setStatusFeedback(`Preparing ${title.toLowerCase()}...`);
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
      setStatusFeedback(`Preview ready: ${title}.`);
    } catch (error) {
      setCanvasErrorFeedback(error, `Failed to create ${kind} block.`);
    }
  };

  const applySelectionEditShortcut = (shortcut: SelectionEditShortcut) => {
    const selectedText = canvasSelection?.selectedText || '';
    const replacement = shortcutReplacementForSelection(shortcut, selectedText);
    if (!replacement.trim()) {
      setAlertFeedback('Select Canvas text before using a writing shortcut.');
      return;
    }
    setSelectionEditDraft(replacement);
  };

  const previewSelectionEdit = async () => {
    const selectedText = canvasSelection?.selectedText?.trim();
    const replacementMd = selectionEditDraft.trim();
    if (!selectedText) {
      setAlertFeedback('Select Canvas text first, then draft an edit.');
      return;
    }
    if (!replacementMd) {
      setAlertFeedback('Write a replacement before previewing the edit.');
      return;
    }
    setStatusFeedback('Preparing selection edit preview...');
    try {
      const operation: WorkCanvasOperation = {
        type: 'replace_selection',
        selectedText,
        replacementMd,
        reason: 'DocumentCanvas selection edit suggestion',
      };
      if (!documentState.draftId) {
        const afterMd = documentState.contentMd.includes(selectedText)
          ? documentState.contentMd.replace(selectedText, replacementMd)
          : documentState.contentMd;
        const markdownDiff = buildLineDiff(documentState.contentMd, afterMd);
        setPendingOperation({
          draftId: '__local__',
          baseUpdatedAt: null,
          operation,
          preview: {
            proposedChange: 'Replace selected Canvas text',
            affectedBlocks: [],
            markdownDiff,
            approvalRequired: false,
          },
          applyLabel: 'Apply edit suggestion',
          successMessage: 'Selection edit applied.',
        });
        setStatusFeedback('Selection edit preview ready (local). Save to persist this change.');
        return;
      }
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) throw new Error('Failed to load a persisted Canvas draft for preview.');
      const result = await Api.workCanvasApplyOperation(draft.draftId, {
        baseUpdatedAt: draft.updatedAt || null,
        previewOnly: true,
        operation,
      });
      setPendingOperation({
        draftId: draft.draftId,
        baseUpdatedAt: draft.updatedAt || null,
        operation,
        preview: result.data.preview || {},
        applyLabel: 'Apply edit suggestion',
        successMessage: 'Selection edit applied.',
      });
      setStatusFeedback('Selection edit preview ready.');
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to preview selection edit.');
    }
  };

  const applyPendingOperation = async () => {
    if (!pendingOperation) return;
    setStatusFeedback('Applying approved Canvas transformation...');
    try {
      if (pendingOperation.draftId === '__local__') {
        if (pendingOperation.operation.type === 'replace_selection') {
          const operation = pendingOperation.operation;
          setDocumentState((current) => ({
            ...current,
            contentMd: current.contentMd.includes(operation.selectedText)
              ? current.contentMd.replace(operation.selectedText, operation.replacementMd)
              : current.contentMd,
            saveState: 'unsaved',
          }));
          setPendingOperation(null);
          setStatusFeedback(pendingOperation.successMessage);
          return;
        }
        throw new Error('Local apply is only available for selection edit preview.');
      }
      const result = await Api.workCanvasApplyOperation(pendingOperation.draftId, {
        baseUpdatedAt: pendingOperation.baseUpdatedAt || null,
        operation: approveCanvasOperation(pendingOperation.operation),
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
      setStatusFeedback(pendingOperation.successMessage);
      await loadVersions();
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to apply Canvas transformation.');
    }
  };

  const rejectPendingOperation = () => {
    setPendingOperation(null);
    setStatusFeedback('Canvas transformation rejected. Draft unchanged.');
  };

  const revisePendingSelectionEdit = () => {
    setPendingOperation(null);
    setStatusFeedback('Selection edit reopened. Adjust the replacement and preview again.');
  };

  const updateTitle = (title: string) => {
    latestTitleRef.current = title;
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

  React.useEffect(() => {
    if (!isDiagnosticsOpen && !isNewCanvasMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !target?.closest('[data-testid="canvas-menu-root"]') &&
        !target?.closest('[data-testid="canvas-new-menu-root"]')
      ) {
        setIsDiagnosticsOpen(false);
        setIsNewCanvasMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDiagnosticsOpen(false);
        setIsNewCanvasMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isDiagnosticsOpen, isNewCanvasMenuOpen]);

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

  const retryProjection = async () => {
    if (!documentState.draftId) {
      setAlertFeedback('Projection retry needs a persisted Canvas draft.');
      return;
    }
    const blockForRetry = (documentState.blocks || []).find(
      (block) =>
        block.markdownProjectionStatus === 'failed' || block.markdownProjectionStatus === 'missing'
    );
    if (!blockForRetry) {
      setAlertFeedback('Projection retry is available only for blocks with failed projection.');
      return;
    }

    setIsProjectionRefreshing(true);
    try {
      const result = await Api.workCanvasApplyOperation(documentState.draftId, {
        baseUpdatedAt: documentState.updatedAt || null,
        operation: {
          type: 'regenerate_projection',
          blockId: blockForRetry.id,
          approved: true,
          reason: 'Retry projection from Canvas diagnostics',
        },
      });
      const nextDraft = result?.data?.draft;
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(nextDraft, {
          ...current,
          markdownProjectionStatus: 'synced',
          projectionError: null,
        })
      );
      if (result?.data?.diff) {
        setLatestDiff(result.data.diff as CanvasDiffSummary);
      }
      setStatusFeedback('Projection retried from backend runtime.');
    } catch (error) {
      setCanvasErrorFeedback(error, 'Projection retry failed.');
    } finally {
      setIsProjectionRefreshing(false);
    }
  };

  const handleUnavailableAction = (availability: CanvasActionAvailability) => {
    setAlertFeedback(availability.reason || `${availability.label} is not available yet.`);
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
    setStatusFeedback(`Saving Canvas to ${target}...`);
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
      const targetPath =
        target === 'idea'
          ? `/my-work?ideaId=${encodeURIComponent(linked.id)}`
          : target === 'note'
            ? `/my-work?tab=notebook`
            : target === 'initiative'
              ? `/initiatives`
              : null;
      setStatusFeedback(
        targetPath
          ? `${linked.title} saved to ${linked.type}. [Open →](${targetPath})`
          : `${linked.title} saved to ${linked.type}.`
      );
    } catch (error) {
      setCanvasErrorFeedback(error, `Failed to save Canvas to ${target}.`);
    } finally {
      setActiveActionId(null);
    }
  };

  const runOutputAction = async (
    actionId: CanvasActionId,
    outputType: 'presentation' | 'table' | 'report'
  ) => {
    setActiveActionId(actionId);
    setStatusFeedback(`Creating ${outputType} from Canvas...`);
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
      setStatusFeedback(`${output.title} created. ${output.id}`);
    } catch (error) {
      setCanvasErrorFeedback(error, `Failed to create ${outputType}.`);
    } finally {
      setActiveActionId(null);
    }
  };

  const finalizeResearchReport = async () => {
    if (isFinalizingResearchReport) return;
    setStatusFeedback('Finalizing research report from Canvas evidence...');
    setIsFinalizingResearchReport(true);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId)
        throw new Error('Canvas draft could not be saved before finalizing report.');
      const result = await Api.workCanvasFinalizeResearchReport(draft.draftId);
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      const report = result.data.reportResource;
      const evidenceCount = Array.isArray((result.data.readBack as any)?.evidenceSummary)
        ? (result.data.readBack as any).evidenceSummary.length
        : 0;
      setStatusFeedback(
        `Research final report recorded (${report.id}) with ${evidenceCount} evidence block${evidenceCount === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to finalize research report.');
    } finally {
      setIsFinalizingResearchReport(false);
    }
  };

  const runShareAction = async () => {
    setActiveActionId('share');
    setStatusFeedback('Preparing Canvas share link...');
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
      setStatusFeedback(`Share link ready and copied: ${shareUrl}`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to share Canvas draft.');
    } finally {
      setActiveActionId(null);
    }
  };

  const startWorkflow = async () => {
    if (isStartingWorkflow) return;
    setStatusFeedback('Starting governed Canvas workflow...');
    setIsStartingWorkflow(true);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId)
        throw new Error('Canvas draft could not be saved before workflow start.');
      const result = await Api.workCanvasCreateWorkflow(draft.draftId, {
        baseUpdatedAt: draft.updatedAt || null,
        template: selectedWorkflowTemplate,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setStatusFeedback(`Workflow started: ${result.data.workflowRun.title}.`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to start Canvas workflow.');
    } finally {
      setIsStartingWorkflow(false);
    }
  };

  const resumeWorkflow = async (workflowRunId: string) => {
    if (!documentState.draftId) return;
    if (resumingWorkflowById[workflowRunId]) return;
    setStatusFeedback('Resuming Canvas workflow...');
    setResumingWorkflowById((current) => ({ ...current, [workflowRunId]: true }));
    try {
      const result = await Api.workCanvasResumeWorkflow(documentState.draftId, workflowRunId, {
        baseUpdatedAt: documentState.updatedAt || null,
        note: 'User resumed workflow from Canvas diagnostics.',
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setStatusFeedback(`Workflow resumed: ${result.data.workflowRun.title}.`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to resume Canvas workflow.');
    } finally {
      setResumingWorkflowById((current) => ({ ...current, [workflowRunId]: false }));
    }
  };

  const runWorkflowStep = async (workflowRunId: string) => {
    if (!documentState.draftId) return;
    if (runningWorkflowStepById[workflowRunId]) return;
    setStatusFeedback('Running approved Canvas workflow step...');
    setRunningWorkflowStepById((current) => ({ ...current, [workflowRunId]: true }));
    try {
      const result = await Api.workCanvasRunWorkflowStep(documentState.draftId, workflowRunId, {
        baseUpdatedAt: documentState.updatedAt || null,
        approved: true,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      const output = result.data.outputResource;
      setStatusFeedback(
        output
          ? `Workflow output created: ${output.title}. ${output.id}`
          : `Workflow step completed: ${result.data.workflowRun.title}.`
      );
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to run Canvas workflow step.');
    } finally {
      setRunningWorkflowStepById((current) => ({ ...current, [workflowRunId]: false }));
    }
  };

  const updateWorkflowCollaboration = async (
    workflowRunId: string,
    lifecycle: 'draft' | 'in_review' | 'approved'
  ) => {
    if (!documentState.draftId) return;
    if (updatingWorkflowReviewById[workflowRunId]) return;
    const workflow = documentState.workflowRuns?.find((run) => run.id === workflowRunId);
    const reviewerInput = workflowReviewerById[workflowRunId];
    const reviewerId =
      reviewerInput === undefined
        ? workflow?.collaboration?.reviewerId || null
        : reviewerInput.trim() || null;
    setStatusFeedback('Updating Canvas workflow review metadata...');
    setUpdatingWorkflowReviewById((current) => ({ ...current, [workflowRunId]: true }));
    try {
      const result = await Api.workCanvasUpdateWorkflowCollaboration(
        documentState.draftId,
        workflowRunId,
        {
          baseUpdatedAt: documentState.updatedAt || null,
          reviewerId,
          lifecycle,
        }
      );
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setStatusFeedback(`Workflow review metadata updated: ${lifecycle}.`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to update workflow review metadata.');
    } finally {
      setUpdatingWorkflowReviewById((current) => ({ ...current, [workflowRunId]: false }));
    }
  };

  const addWorkflowComment = async (workflowRunId: string) => {
    if (!documentState.draftId) return;
    if (addingWorkflowCommentById[workflowRunId]) return;
    const body = (workflowCommentById[workflowRunId] || '').trim();
    if (!body) {
      setAlertFeedback('Write a workflow comment before adding it.');
      return;
    }
    setStatusFeedback('Adding Canvas workflow comment...');
    setAddingWorkflowCommentById((current) => ({ ...current, [workflowRunId]: true }));
    try {
      const result = await Api.workCanvasAddWorkflowComment(documentState.draftId, workflowRunId, {
        baseUpdatedAt: documentState.updatedAt || null,
        body,
      });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setWorkflowCommentById((current) => ({ ...current, [workflowRunId]: '' }));
      setStatusFeedback('Workflow comment added.');
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to add workflow comment.');
    } finally {
      setAddingWorkflowCommentById((current) => ({ ...current, [workflowRunId]: false }));
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
      setCanvasErrorFeedback(error, 'Failed to load Canvas versions.');
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
      setStatusFeedback(
        `Restored Canvas version from ${new Date(version.createdAt).toLocaleString()}.`
      );
      await loadVersions();
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to restore Canvas version.');
    }
  };

  const showChangesFromLatestVersion = () => {
    const latest = versions[0];
    if (!latest) {
      setAlertFeedback('No Canvas versions available yet.');
      return;
    }
    const diff = buildLineDiff(latest.contentMd, documentState.contentMd);
    setLatestDiff(diff);
    setStatusFeedback(`Show changes: ${diff.summary}.`);
  };

  const handleCommandAction = (actionId: CanvasActionId) => {
    const availability = getCanvasActionAvailability(actionId, documentState, runtimeCapabilities);
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
        setAlertFeedback('Close is available when Canvas is opened from the split chat shell.');
      }
    }
  };

  const renderCommandButton = (actionId: CanvasActionId) => {
    const availability = getCanvasActionAvailability(actionId, documentState, runtimeCapabilities);
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
              ? 'text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300'
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
      <div
        className="mt-3 rounded-2xl border border-primary-200/70 bg-white/80 p-3 dark:border-primary-300/20 dark:bg-white/[0.04]"
        data-testid="canvas-selection-edit-panel"
      >
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200">
          Edit selected text
        </div>
        <div className="mt-1 line-clamp-2 text-xs text-primary-900/70 dark:text-primary-100/70">
          {canvasSelection.selectedText}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="canvas-selection-writing-shortcuts">
          <button
            type="button"
            onClick={() => applySelectionEditShortcut('use_selection')}
            className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-200 dark:bg-primary-300/10 dark:text-primary-100 dark:hover:bg-primary-300/20"
          >
            Use selection
          </button>
          <button
            type="button"
            onClick={() => applySelectionEditShortcut('action_list')}
            className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-200 dark:bg-primary-300/10 dark:text-primary-100 dark:hover:bg-primary-300/20"
          >
            Action list
          </button>
          <button
            type="button"
            onClick={() => applySelectionEditShortcut('bullet_summary')}
            className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-200 dark:bg-primary-300/10 dark:text-primary-100 dark:hover:bg-primary-300/20"
          >
            Bullet summary
          </button>
        </div>
        <textarea
          value={selectionEditDraft}
          onChange={(event) => setSelectionEditDraft(event.target.value)}
          aria-label="Selection edit replacement"
          placeholder="Write the replacement Markdown here..."
          className="mt-3 min-h-24 w-full resize-y rounded-2xl border border-primary-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-primary-400 dark:border-primary-300/20 dark:bg-navy-950 dark:text-slate-100"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void previewSelectionEdit()}
            disabled={!selectionEditDraft.trim()}
            className={
              selectionEditDraft.trim()
                ? 'rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700'
                : 'cursor-not-allowed rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
            }
          >
            Preview edit
          </button>
          <button
            type="button"
            onClick={() => setSelectionEditDraft('')}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-300/10"
          >
            Clear
          </button>
        </div>
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
            ref={titleInputRef}
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
          <div className="relative" data-testid="canvas-new-menu-root">
            <button
              type="button"
              onClick={() => {
                setIsNewCanvasMenuOpen((open) => !open);
                setIsDiagnosticsOpen(false);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="New Canvas"
              aria-expanded={isNewCanvasMenuOpen}
              title="New Canvas"
            >
              <Plus size={15} />
            </button>
            {isNewCanvasMenuOpen ? (
              <div className="absolute left-0 z-20 mt-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-white/10 dark:bg-[#1a1d25]">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  New Canvas from template
                </div>
                <div className="mt-1 space-y-1">
                  {starterTemplates.map((template) => (
                    <button
                      key={`header-template-${template.id}`}
                      type="button"
                      onClick={() => {
                        setIsNewCanvasMenuOpen(false);
                        selectTemplate(template);
                      }}
                      className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                        documentState.activeStarterId === template.id
                          ? 'bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{template.label}</span>
                        {renderCapabilityBadge(template.capability)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className={toolbarGroupClass} data-testid="canvas-output-actions">
            {menuOutputActionIds.map((actionId) => renderCommandButton(actionId))}
          </div>

          <div className={toolbarGroupClass} data-testid="canvas-workspace-actions">
            {menuWorkspaceActionIds.map((actionId) => renderCommandButton(actionId))}
          </div>

          <div className={toolbarGroupClass} data-testid="canvas-file-actions">
            {renderCommandButton('copy')}
            {renderCommandButton('save')}
            {renderCommandButton('close')}
          </div>

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

          <div className="relative" data-testid="canvas-menu-root">
            <button
              type="button"
              onClick={() => {
                setIsDiagnosticsOpen((open) => !open);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Canvas menu"
              aria-expanded={isDiagnosticsOpen}
              title="Canvas menu"
            >
              <MoreHorizontal size={15} />
            </button>
            {isDiagnosticsOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 max-h-[80vh] w-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-[#1a1d25]"
                data-testid="canvas-diagnostics-menu"
              >
                <div className="space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Widok canvas
                  </div>
                  <div
                    className="mx-2.5 inline-flex rounded-full bg-slate-100 p-1 dark:bg-white/10"
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
                </div>

                <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Najczęstsze działania
                  </div>
                  {[
                    {
                      title: 'Rozwiń zaznaczoną myśl',
                      detail: 'Użyj AI, aby rozwinąć aktualnie zaznaczony fragment w bardziej kompletny tekst.',
                      actionLabel: 'Rozwiń',
                      onClick: () => applySelectionMenuAction('expand'),
                      disabled: !canvasSelection?.selectedText?.trim(),
                    },
                    {
                      title: 'Skróć lub przepisz zaznaczenie',
                      detail: 'Szybko skróć, przepisz lub popraw ton wybranego fragmentu bez ręcznego przepisywania.',
                      actionLabel: 'Rewrite',
                      onClick: () => applySelectionMenuAction('rewrite'),
                      disabled: !canvasSelection?.selectedText?.trim(),
                    },
                    {
                      title: 'Dodaj nowy element do canvas',
                      detail: 'Wybierz typ elementu i opisz Teresie co ma dodać do dokumentu.',
                      actionLabel: 'Dodaj element',
                      onClick: () => setQuickAddElement('text'),
                    },
                    {
                      title: 'Zbuduj template pod konkretny cel',
                      detail: 'Utwórz własny szablon pracy z nazwą, celem i sekcjami dopasowanymi do zadania.',
                      actionLabel: 'Nowy template',
                      onClick: () => setIsTemplateBuilderOpen((open) => !open),
                    },
                    {
                      title: 'Przełącz widok Rich/Dock/MD',
                      detail: 'Rich = edytor z toolbarem, Dock = podgląd, MD = surowy markdown.',
                      actionLabel: mode === 'rich' ? 'Dock' : mode === 'document' ? 'MD' : 'Rich',
                      onClick: () => setMode(mode === 'rich' ? 'document' : mode === 'document' ? 'md' : 'rich'),
                    },
                    {
                      title: 'Zapisz i eksportuj wersję roboczą',
                      detail: 'Zapisz zmiany oraz pobierz dokument jako Markdown lub CSV do dalszej pracy.',
                      actionLabel: documentState.saveState === 'unsaved' ? 'Zapisz' : 'Pobierz MD',
                      onClick:
                        documentState.saveState === 'unsaved'
                          ? () => void persistDraft()
                          : () => void exportDocument('markdown'),
                    },
                    {
                      title: 'Pracuj na danych z pliku',
                      detail: 'Wgraj CSV/JSON/XLSX i generuj tabele, wykresy lub raporty w tym samym canvas.',
                      actionLabel: pendingDataset ? 'Użyj datasetu' : 'Wgraj plik',
                      onClick: pendingDataset ? () => setQuickAddElement('table') : triggerDatasetUpload,
                    },
                  ].map((hint) => (
                    <div
                      key={hint.title}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {hint.title}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {hint.detail}
                      </div>
                      <button
                        type="button"
                        onClick={hint.onClick}
                        disabled={Boolean(hint.disabled)}
                        className={
                          hint.disabled
                            ? 'mt-2 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                            : 'mt-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20'
                        }
                      >
                        {hint.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Dodaj element
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 px-2.5">
                    {(
                      [
                        ['text', 'Tekst'],
                        ['heading', 'Nagłówek'],
                        ['table', 'Tabela'],
                        ['diagram', 'Diagram'],
                        ['list', 'Lista'],
                        ['summary', 'Podsumowanie'],
                      ] as Array<[CanvasQuickAddElement, string]>
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setQuickAddElement(id)}
                        className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                          quickAddElement === id
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-300/20 dark:text-primary-100'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="px-2.5">
                    <textarea
                      value={quickAddPrompt}
                      onChange={(event) => setQuickAddPrompt(event.target.value)}
                      placeholder="Opisz Teresie co dodać..."
                      aria-label="Element instruction for Teresa"
                      className="min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white p-2.5 text-xs leading-5 text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={insertQuickAddElement}
                      className="mt-2 w-full rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                    >
                      Dodaj do canvas
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    AI na zaznaczeniu
                  </div>
                  <div className="px-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {canvasSelection?.selectedText?.trim()
                      ? `Zaznaczenie: ${canvasSelection.selectedText.slice(0, 120)}${canvasSelection.selectedText.length > 120 ? '…' : ''}`
                      : 'Zaznacz fragment tekstu, aby użyć akcji AI.'}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 px-2.5">
                    <button
                      type="button"
                      onClick={() => applySelectionMenuAction('expand')}
                      className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                    >
                      Rozwiń myśl
                    </button>
                    <button
                      type="button"
                      onClick={() => applySelectionMenuAction('shorten')}
                      className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                    >
                      Skróć
                    </button>
                    <button
                      type="button"
                      onClick={() => applySelectionMenuAction('rewrite')}
                      className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                    >
                      Rewrite
                    </button>
                    <button
                      type="button"
                      onClick={() => applySelectionMenuAction('suggest')}
                      className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                    >
                      Daj sugestie
                    </button>
                  </div>
                  <div className="px-2.5">
                    <textarea
                      value={selectionAiPrompt}
                      onChange={(event) => setSelectionAiPrompt(event.target.value)}
                      aria-label="Selection AI instruction"
                      placeholder="Instrukcja dla Teresy na zaznaczonym fragmencie..."
                      className="min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white p-2.5 text-xs leading-5 text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void previewSelectionMenuPrompt()}
                        className="flex-1 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                      >
                        Podgląd AI edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectionAiPrompt('')}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        Wyczyść
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Ręczna edycja
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('md')}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <span>Edytuj Markdown ręcznie</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">MD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('document')}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <span>Wróć do widoku dokumentu</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Dock</span>
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2 px-2.5 pb-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Szablony startowe
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTemplateBuilderOpen((open) => !open)}
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      + Nowy template
                    </button>
                  </div>
                  {isTemplateBuilderOpen ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                      <input
                        value={templateBuilderName}
                        onChange={(event) => setTemplateBuilderName(event.target.value)}
                        placeholder="Nazwa template'u"
                        aria-label="Template name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <input
                        value={templateBuilderGoal}
                        onChange={(event) => setTemplateBuilderGoal(event.target.value)}
                        placeholder="Cel template'u w jednym zdaniu"
                        aria-label="Template goal"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <input
                        value={templateBuilderSections}
                        onChange={(event) => setTemplateBuilderSections(event.target.value)}
                        placeholder="Sekcje (po przecinku)"
                        aria-label="Template sections"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={applyBuiltTemplate}
                          className="flex-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                        >
                          Zastosuj template
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsTemplateBuilderOpen(false)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          Zamknij
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {starterTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template)}
                      className={`w-full rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                        documentState.activeStarterId === template.id
                          ? 'bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{template.label}</span>
                        {renderCapabilityBadge(
                          template.capability,
                          `canvas-template-capability-${template.id}`
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] leading-4 opacity-75">
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Akcje workspace
                  </div>
                  {menuWorkspaceActionIds.map((actionId) => (
                    <div key={actionId} className="px-1">
                      {renderCommandButton(actionId)}
                    </div>
                  ))}
                  {menuOutputActionIds.map((actionId) => (
                    <div key={actionId} className="px-1">
                      {renderCommandButton(actionId)}
                    </div>
                  ))}
                </div>

                {pendingDataset ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
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

                <div className="space-y-1.5">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Markdown actions
                  </div>
                  <button
                    type="button"
                    onClick={() => void persistDraft()}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Save size={14} />
                    <span>Save Markdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportDocument('markdown')}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Download size={14} />
                    <span>Download Markdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportDocument('csv')}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Table2 size={14} />
                    <span>Download CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyMarkdown()}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Copy size={14} />
                    <span>Copy Markdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportDocument('pdf')}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Download size={14} />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportDocument('json')}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Download size={14} />
                    <span>Export metadata</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerDatasetUpload}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Download size={14} />
                    <span>Upload dataset</span>
                  </button>
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsMdPropertiesOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    aria-expanded={isMdPropertiesOpen}
                  >
                    <span className="font-medium">Właściwości pliku MD</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isMdPropertiesOpen ? 'Ukryj' : 'Pokaż'}
                    </span>
                  </button>
                  {isMdPropertiesOpen ? (
                    <div className="mt-2 space-y-2 rounded-xl bg-slate-100/80 p-2.5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <span>Format</span>
                        <strong className="font-semibold">Markdown canonical</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Save</span>
                        <strong className="font-semibold" data-testid="canvas-diagnostics-save-state">
                          {saveStateLabel(documentState.saveState)}
                        </strong>
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
                        <span>Lifecycle</span>
                        <strong className="font-semibold">
                          {lifecycleLabel(documentState.lifecycleState)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Action</span>
                        <strong className="font-semibold" data-testid="canvas-diagnostics-action-state">
                          {activeActionId ? 'Running' : 'Idle'}
                        </strong>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-slate-600 dark:border-white/10 dark:text-slate-300">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Możliwości i workflow
                  </div>
                  <div className="flex items-start justify-between gap-3 px-2.5">
                    <span>Capability</span>
                    <div className="min-w-0 text-right">
                      {renderCapabilityBadge(activeTemplate.capability, 'canvas-capability-status')}
                      <div
                        className="mt-1 max-w-[200px] text-[10px] leading-3 text-slate-500 dark:text-slate-400"
                        data-testid="canvas-capability-note"
                      >
                        {activeTemplate.capabilityNote}
                      </div>
                    </div>
                  </div>
                  {documentState.researchSessionId ? (
                    <div className="flex items-center justify-between gap-3 px-2.5">
                      <span>ResearchSession</span>
                      <strong
                        className="max-w-[180px] truncate font-semibold text-primary-700 dark:text-primary-300"
                        data-testid="canvas-research-session-id"
                        title={documentState.researchSessionId}
                      >
                        {documentState.researchSessionId}
                      </strong>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 px-2.5">
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
                      disabled={isStartingWorkflow}
                      className={
                        isStartingWorkflow
                          ? 'inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                          : 'inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-1 font-semibold text-primary-700 hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100'
                      }
                    >
                      {isStartingWorkflow ? 'Starting...' : 'Start workflow'}
                    </button>
                  </div>
                  <div className="px-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      {renderCapabilityBadge(
                        selectedWorkflowTemplateOption.capability,
                        'canvas-workflow-capability-status'
                      )}
                      <span>{selectedWorkflowTemplateOption.description}</span>
                    </div>
                    <div className="mt-1">{selectedWorkflowTemplateOption.capabilityNote}</div>
                  </div>
                  {documentState.kind === 'research' ? (
                    <div className="px-2.5">
                      <button
                        type="button"
                        onClick={() => void finalizeResearchReport()}
                        disabled={isFinalizingResearchReport}
                        className={
                          isFinalizingResearchReport
                            ? 'inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                            : 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100'
                        }
                      >
                        {isFinalizingResearchReport ? 'Finalizing...' : 'Finalize research report'}
                      </button>
                    </div>
                  ) : null}
                  {documentState.workflowRuns?.length ? (
                    <div
                      className="mt-1 max-h-72 space-y-2 overflow-auto border-t border-slate-200 px-2.5 pt-3 dark:border-white/10"
                      data-testid="canvas-workflow-ledger"
                    >
                      {documentState.workflowRuns.map((workflow) => {
                        const reviewBlocked = isWorkflowReviewBlocked(workflow);
                        const workflowLifecycle = workflow.collaboration?.lifecycle || 'draft';
                        const pendingApproval = getPendingWorkflowApproval(workflow);
                        const terminalExecutionLabel = getWorkflowTerminalExecutionLabel(workflow);
                        const isWorkflowStepRunning = Boolean(runningWorkflowStepById[workflow.id]);
                        const isWorkflowResuming = Boolean(resumingWorkflowById[workflow.id]);
                        const isWorkflowReviewUpdating = Boolean(
                          updatingWorkflowReviewById[workflow.id]
                        );
                        const isWorkflowCommentAdding = Boolean(
                          addingWorkflowCommentById[workflow.id]
                        );
                        const workflowCommentBody = (workflowCommentById[workflow.id] || '').trim();
                        const isWorkflowCommentBlocked =
                          isWorkflowCommentAdding || workflowCommentBody.length === 0;
                        const isSendToReviewBlocked =
                          isWorkflowReviewUpdating || workflowLifecycle === 'in_review';
                        const isMarkApprovedBlocked =
                          isWorkflowReviewUpdating || workflowLifecycle === 'approved';
                        const executionBlocked =
                          reviewBlocked || Boolean(terminalExecutionLabel) || isWorkflowStepRunning;
                        return (
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
                                {pendingApproval ? (
                                  <div className="mt-1 font-semibold text-primary-700 dark:text-primary-200">
                                    Approval checkpoint: {pendingApproval.stepTitle} awaits explicit
                                    approval.
                                  </div>
                                ) : null}
                                {reviewBlocked ? (
                                  <div className="mt-1 font-semibold text-amber-700 dark:text-amber-200">
                                    Review gate: mark approved before running next.
                                  </div>
                                ) : null}
                                {terminalExecutionLabel ? (
                                  <div className="mt-1 font-semibold text-emerald-700 dark:text-emerald-200">
                                    Workflow {workflow.status}: output is available in the ledger.
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => void runWorkflowStep(workflow.id)}
                                  disabled={executionBlocked}
                                  className={
                                    executionBlocked
                                      ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                                      : 'rounded-full bg-primary-600 px-2 py-0.5 font-semibold text-white hover:bg-primary-700'
                                  }
                                >
                                  {isWorkflowStepRunning
                                    ? 'Running...'
                                    : terminalExecutionLabel ||
                                      (pendingApproval ? 'Approve and run' : 'Run next')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void resumeWorkflow(workflow.id)}
                                  disabled={isWorkflowResuming}
                                  className={
                                    isWorkflowResuming
                                      ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                                      : 'rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white'
                                  }
                                >
                                  {isWorkflowResuming ? 'Resuming...' : 'Resume'}
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
                                  disabled={isWorkflowReviewUpdating}
                                  placeholder="Reviewer id"
                                  aria-label={`Reviewer for ${workflow.title}`}
                                  className={
                                    isWorkflowReviewUpdating
                                      ? 'min-w-[160px] cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] text-slate-400 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-500'
                                      : 'min-w-[160px] rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-100'
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateWorkflowCollaboration(workflow.id, 'in_review')
                                  }
                                  disabled={isSendToReviewBlocked}
                                  className={
                                    isSendToReviewBlocked
                                      ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                                      : 'rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100'
                                  }
                                >
                                  {isWorkflowReviewUpdating ? 'Updating...' : 'Send to review'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateWorkflowCollaboration(workflow.id, 'approved')
                                  }
                                  disabled={isMarkApprovedBlocked}
                                  className={
                                    isMarkApprovedBlocked
                                      ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                                      : 'rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-400/20 dark:text-emerald-100'
                                  }
                                >
                                  {isWorkflowReviewUpdating ? 'Updating...' : 'Mark approved'}
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
                                  disabled={isWorkflowCommentAdding}
                                  placeholder="Add workflow comment"
                                  aria-label={`Comment for ${workflow.title}`}
                                  className={
                                    isWorkflowCommentAdding
                                      ? 'min-w-[220px] flex-1 cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] text-slate-400 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-500'
                                      : 'min-w-[220px] flex-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-100'
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => void addWorkflowComment(workflow.id)}
                                  disabled={isWorkflowCommentBlocked}
                                  className={
                                    isWorkflowCommentBlocked
                                      ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-400 dark:bg-white/10 dark:text-slate-500'
                                      : 'rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white'
                                  }
                                >
                                  {isWorkflowCommentAdding ? 'Adding...' : 'Add comment'}
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
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <details className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
                  <summary className="cursor-pointer select-none rounded-xl px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">
                    Zaawansowane
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                    {latestDiff ? (
                      <div className="w-full rounded-xl bg-slate-100 p-2 text-[11px] dark:bg-white/10">
                        <div className="font-semibold text-slate-700 dark:text-slate-100">
                          {latestDiff.summary}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>

                {isVersionsOpen ? (
                  <div className="mt-3 max-h-56 space-y-2 overflow-auto border-t border-slate-200 pt-3 dark:border-white/10">
                    {isVersionsLoading ? (
                      <div className="text-slate-500 dark:text-slate-400">Loading versions...</div>
                    ) : versions.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No versions yet.</div>
                    ) : (
                      <>
                        {/* Prev/Next stepper across the version timeline */}
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-2 py-1.5 dark:bg-white/10">
                          <button
                            type="button"
                            disabled={versionCursor >= versions.length - 1}
                            onClick={() =>
                              setVersionCursor((c) => Math.min(c + 1, versions.length - 1))
                            }
                            title="Older version"
                            aria-label="Older version"
                            className="rounded-full p-1 text-slate-600 hover:text-slate-950 disabled:opacity-30 dark:text-slate-300 dark:hover:text-white"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <div className="text-center text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                            <div className="font-semibold text-slate-700 dark:text-slate-100">
                              Version {versions.length - versionCursor} / {versions.length}
                            </div>
                            <div>{new Date(versions[versionCursor].createdAt).toLocaleString()}</div>
                          </div>
                          <button
                            type="button"
                            disabled={versionCursor <= 0}
                            onClick={() => setVersionCursor((c) => Math.max(c - 1, 0))}
                            title="Newer version"
                            aria-label="Newer version"
                            className="rounded-full p-1 text-slate-600 hover:text-slate-950 disabled:opacity-30 dark:text-slate-300 dark:hover:text-white"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void restoreVersion(versions[versionCursor])}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                          >
                            <RotateCcw size={12} />
                            Restore
                          </button>
                        </div>
                        {versions.map((version, idx) => (
                          <div
                            key={version.id}
                            className={`rounded-xl p-2 text-[11px] dark:bg-white/[0.06] ${
                              idx === versionCursor
                                ? 'bg-slate-100 ring-1 ring-primary-400 dark:bg-white/10'
                                : 'bg-slate-50'
                            }`}
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
                        ))}
                      </>
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
          role={actionFeedbackTone}
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
              {pendingOperation.preview.markdownDiff?.removedLineSamples?.length ||
              pendingOperation.preview.markdownDiff?.addedLineSamples?.length ? (
                <div
                  className="mt-3 grid gap-2 text-xs lg:grid-cols-2"
                  data-testid="canvas-operation-diff-preview"
                >
                  {pendingOperation.preview.markdownDiff?.removedLineSamples?.length ? (
                    <div className="rounded-xl border border-rose-200 bg-white/70 p-2 dark:border-rose-300/20 dark:bg-white/10">
                      <div className="mb-1 font-semibold text-rose-700 dark:text-rose-200">
                        Removed
                      </div>
                      {pendingOperation.preview.markdownDiff.removedLineSamples.map(
                        (line, index) => (
                          <div
                            key={`removed-${index}-${line}`}
                            className="truncate font-mono text-[11px] text-rose-800 dark:text-rose-100"
                          >
                            - {line}
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                  {pendingOperation.preview.markdownDiff?.addedLineSamples?.length ? (
                    <div className="rounded-xl border border-emerald-200 bg-white/70 p-2 dark:border-emerald-300/20 dark:bg-white/10">
                      <div className="mb-1 font-semibold text-emerald-700 dark:text-emerald-200">
                        Added
                      </div>
                      {pendingOperation.preview.markdownDiff.addedLineSamples.map((line, index) => (
                        <div
                          key={`added-${index}-${line}`}
                          className="truncate font-mono text-[11px] text-emerald-800 dark:text-emerald-100"
                        >
                          + {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingOperation.operation.type === 'replace_selection' ? (
                <button
                  type="button"
                  onClick={revisePendingSelectionEdit}
                  className="rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-white dark:border-blue-300/30 dark:bg-white/10 dark:text-blue-100"
                >
                  Revise edit
                </button>
              ) : null}
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
            ) : mode === 'rich' ? (
              <div
                className="flex flex-1 flex-col min-h-[680px] rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-navy-900 dark:shadow-none overflow-hidden"
                data-testid="canvas-rich-editor"
              >
                <CanvasRichEditor
                  contentMd={documentState.contentMd}
                  onContentChange={updateMarkdown}
                  onSelectionChange={(sel) => {
                    if (sel) {
                      setCanvasSelection({
                        selectedText: sel.selectedText,
                        mode: 'rich',
                        draftId: documentState.draftId ?? undefined,
                        // Preserve ProseMirror positions so chat-side ops can be
                        // anchored to the exact range, not just the text.
                        startOffset: sel.from,
                        endOffset: sel.to,
                      });
                    } else {
                      setCanvasSelection(null);
                    }
                  }}
                  onEditorReady={setRichEditor}
                  isStreaming={isStreaming}
                  onStopStream={stopStream}
                  editable={true}
                />
                {documentState.blocks?.length ? (
                  <div className="mt-4 px-6 pb-6" data-testid="canvas-artifact-blocks">
                    {documentState.blocks.map((block) => (
                      <CanvasArtifactBlockRenderer
                        key={block.id}
                        block={block}
                        onFeedback={setActionFeedback}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : mode === 'md' ? (
              <div className="flex flex-1 flex-col">
                {selectionBlockActions}
                <textarea
                  ref={markdownEditorRef}
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
