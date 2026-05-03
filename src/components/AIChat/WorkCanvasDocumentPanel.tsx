import {
  Copy,
  FileText,
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
  X,
} from 'lucide-react';
import React from 'react';

import type {
  ActiveCanvasDocument,
  CanvasActionAvailability,
  CanvasActionId,
  CanvasRuntimeCapabilities,
  CanvasDocumentState,
  CanvasDiffSummary,
  CanvasEditOperation,
  CanvasLifecycleState,
  CanvasMode,
  CanvasProjectionStatus,
  CanvasSaveState,
  CanvasSelection,
  CanvasStarterId,
  CanvasVersionSummary,
} from '@/types/canvasWorkspace';
import {
  mapDraftResponseToCanvasDocumentState,
  starterIdToCanvasKind,
} from '@/utils/canvas/canvasDraftAdapter';
import { getCanvasActionAvailability } from '@/utils/canvas/canvasActionAvailability';
import { Api } from '@/services/api';

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
  onActiveDocumentChange?: (document: ActiveCanvasDocument) => void;
  onAskTeresaSelection?: (selection: CanvasSelection, document: ActiveCanvasDocument) => void;
  onCanvasSelectionChange?: (selection: CanvasSelection | null) => void;
  onClose?: () => void;
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

const workspaceActionIds: CanvasActionId[] = [
  'send-to-idea',
  'save-as-note',
  'create-initiative',
];

const outputActionIds: CanvasActionId[] = [
  'create-presentation',
  'create-table',
  'create-report',
];

const fileActionIds: CanvasActionId[] = ['copy', 'share', 'save', 'close'];

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

function getInitialMode(): CanvasMode {
  if (typeof window === 'undefined') return 'document';
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'md' ? 'md' : 'document';
}

function createDocumentState(
  template: StarterTemplate,
  projectionStatus: CanvasProjectionStatus = 'synced'
): CanvasDocumentState {
  return {
    title: template.title,
    contentMd: template.markdown,
    canonicalFormat: 'markdown',
    kind: starterIdToCanvasKind(template.id),
    markdownProjectionStatus: projectionStatus,
    saveState: 'unsaved',
    lifecycleState: 'draft',
    activeStarterId: template.id,
    projectionError: projectionStatus === 'failed' ? 'Projection needs regeneration.' : null,
  };
}

function saveLabel(saveState: CanvasSaveState): string {
  if (saveState === 'saving') return 'Saving...';
  if (saveState === 'saved') return 'Saved';
  if (saveState === 'failed') return 'Save failed';
  return 'Unsaved';
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

function statusClass(saveState: CanvasSaveState): string {
  if (saveState === 'saved') return 'bg-emerald-500/10 text-emerald-300';
  if (saveState === 'saving') return 'bg-blue-500/10 text-blue-300';
  if (saveState === 'failed') return 'bg-red-500/10 text-red-300';
  return 'bg-amber-500/10 text-amber-300';
}

function previewText(text: string, max = 96): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
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

export function WorkCanvasDocumentPanel({
  conversationId,
  initialProjectionStatus = 'synced',
  onActiveDocumentChange,
  onAskTeresaSelection,
  onCanvasSelectionChange,
  onClose,
}: WorkCanvasDocumentPanelProps) {
  const [mode, setMode] = React.useState<CanvasMode>(() => getInitialMode());
  const [documentState, setDocumentState] = React.useState<CanvasDocumentState>(() =>
    createDocumentState(starterTemplates[1], initialProjectionStatus)
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
  const documentViewRef = React.useRef<HTMLElement | null>(null);
  const lastSavedContentRef = React.useRef(documentState.contentMd);
  const latestContentRef = React.useRef(documentState.contentMd);
  const autosaveTimerRef = React.useRef<number | null>(null);

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
              kind: 'document',
              title: draft.title,
              content: draft.contentMd,
              canonicalFormat: draft.canonicalFormat,
              contentMd: draft.contentMd,
              saveState: 'saved',
              lifecycleState: draft.lifecycleState,
              provenance: { source: 'chat-work-canvas-panel', starterId: draft.activeStarterId },
            }),
          }
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Failed to save Canvas draft');
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
        }
        return nextState;
      } catch (error) {
        setDocumentState((current) => ({
          ...current,
          saveState: 'failed',
          projectionError: error instanceof Error ? error.message : 'Save failed',
        }));
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

  const updateMarkdown = (contentMd: string) => {
    setDocumentState((current) => ({
      ...current,
      contentMd,
      saveState: 'unsaved',
      markdownProjectionStatus: 'synced',
      projectionError: null,
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
      documentState.contentMd === lastSavedContentRef.current
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

  const clearCanvasSelection = () => {
    window.getSelection()?.removeAllRanges();
    setCanvasSelection(null);
  };

  const askTeresaAboutSelection = () => {
    if (!canvasSelection) return;
    onAskTeresaSelection?.(canvasSelection, {
      draftId: documentState.draftId,
      title: documentState.title,
      saveState: documentState.saveState,
      lifecycleState: documentState.lifecycleState,
      activeStarterId: documentState.activeStarterId,
    });
    setActionFeedback(`Selected context sent to Teresa: "${previewText(canvasSelection.selectedText, 72)}"`);
  };

  const applyCanvasOperation = async (operation: CanvasEditOperation) => {
    setActiveActionId('save');
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) throw new Error('Canvas draft could not be saved before operation.');
      const result = await Api.workCanvasApplyOperation(draft.draftId, { operation });
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      if (result.data.diff) setLatestDiff(result.data.diff);
      setActionFeedback(result.data.diff?.summary || 'Canvas operation applied.');
      clearCanvasSelection();
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to apply Canvas operation.');
    } finally {
      setActiveActionId(null);
    }
  };

  const replaceSelectedText = () => {
    if (!canvasSelection) return;
    const replacementMd = window.prompt('Replace selected Canvas text with:', canvasSelection.selectedText);
    if (replacementMd === null) return;
    void applyCanvasOperation({
      type: 'replace_selection',
      selectedText: canvasSelection.selectedText,
      replacementMd,
      reason: 'Manual selected-context replacement',
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
      setActionFeedback(error instanceof Error ? error.message : `Failed to save Canvas to ${target}.`);
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
      if (!draft?.draftId) throw new Error('Canvas draft could not be saved before output creation.');
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
      const result = await Api.workCanvasRestoreVersion(documentState.draftId, version.id);
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setLatestDiff(buildLineDiff(documentState.contentMd, version.contentMd));
      setActionFeedback(`Restored Canvas version from ${new Date(version.createdAt).toLocaleString()}.`);
      await loadVersions();
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Failed to restore Canvas version.');
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
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
        }`}
        data-action-status={isLoading ? 'loading' : availability.status}
      >
        {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}
        {availability.status === 'coming_soon' ? (
          <span className="sr-only">Coming soon</span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-950 dark:bg-[#101217] dark:text-slate-100">
      <div className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/90 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-[#151820]/90">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <FileText size={13} strokeWidth={1.8} />
            Canvas
          </div>
          <h2 className="mt-1 truncate text-[15px] font-semibold text-slate-950 dark:text-white" data-testid="canvas-active-title">
            {documentState.title}
          </h2>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <span
            data-testid="canvas-save-state"
            className={`hidden rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${statusClass(documentState.saveState)}`}
          >
            {saveLabel(documentState.saveState)}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTemplatesOpen((open) => !open);
                setIsDiagnosticsOpen(false);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Open Canvas templates"
              aria-expanded={isTemplatesOpen}
            >
              <Plus size={14} />
              New
            </button>
            {isTemplatesOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1a1d25]"
                data-testid="canvas-templates-menu"
              >
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
            className="hidden items-center gap-1 rounded-full border border-slate-200 px-1 dark:border-white/10 md:flex"
            data-testid="canvas-workspace-actions"
          >
            {workspaceActionIds.map(renderCommandButton)}
          </div>

          <div
            className="hidden items-center gap-1 rounded-full border border-slate-200 px-1 dark:border-white/10 md:flex"
            data-testid="canvas-output-actions"
          >
            {outputActionIds.map(renderCommandButton)}
          </div>

          <div
            className="flex rounded-full bg-slate-100 p-1 dark:bg-white/10"
            data-testid="canvas-view-actions"
          >
            <button
              type="button"
              onClick={() => setMode('document')}
              aria-label="Document view"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'document'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Document
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

          <div
            className="flex items-center gap-1 rounded-full border border-slate-200 px-1 dark:border-white/10"
            data-testid="canvas-file-actions"
          >
            {fileActionIds.map(renderCommandButton)}
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
                    <strong className="font-semibold">{lifecycleLabel(documentState.lifecycleState)}</strong>
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
                  {latestDiff ? (
                    <div className="rounded-xl bg-slate-100 p-2 text-[11px] dark:bg-white/10">
                      <div className="font-semibold text-slate-700 dark:text-slate-100">Show changes</div>
                      <div className="mt-1 text-slate-500 dark:text-slate-300">{latestDiff.summary}</div>
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
                </div>
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
          className="shrink-0 border-b border-slate-200/70 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
          role="status"
        >
          {actionFeedback}
        </div>
      ) : null}

      {canvasSelection ? (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-primary-200/70 bg-primary-50 px-4 py-2 text-xs text-primary-900 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-100"
          data-testid="canvas-selection-bar"
        >
          <span className="font-semibold">Selected context</span>
          <span className="max-w-[520px] truncate">"{previewText(canvasSelection.selectedText)}"</span>
          <button
            type="button"
            onClick={askTeresaAboutSelection}
            className="rounded-full bg-primary-600 px-2.5 py-1 font-semibold text-white hover:bg-primary-700"
          >
            Ask Teresa
          </button>
          <button
            type="button"
            onClick={replaceSelectedText}
            className="rounded-full bg-white px-2.5 py-1 font-semibold text-primary-700 hover:text-primary-950 dark:bg-white/10 dark:text-primary-100"
          >
            Replace selection
          </button>
          <button
            type="button"
            onClick={clearCanvasSelection}
            className="rounded-full px-2.5 py-1 font-semibold text-primary-700 hover:bg-primary-100 dark:text-primary-100 dark:hover:bg-white/10"
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[980px] px-5 py-6 lg:px-8">
            {isHydrating ? (
              <div data-testid="canvas-loading-skeleton" className="min-h-[680px] animate-pulse rounded-[1.35rem] border border-white/10 bg-[#1a1d25] p-10">
                <div className="h-8 w-2/3 rounded bg-white/10" />
                <div className="mt-8 h-4 w-full rounded bg-white/10" />
                <div className="mt-3 h-4 w-5/6 rounded bg-white/10" />
                <div className="mt-8 h-32 rounded bg-white/10" />
              </div>
            ) : mode === 'md' ? (
              <textarea
                value={documentState.contentMd}
                onChange={(event) => updateMarkdown(event.target.value)}
                onSelect={captureMarkdownSelection}
                onKeyUp={captureMarkdownSelection}
                data-testid="canvas-md-view"
                className="min-h-[680px] w-full resize-y rounded-[1.35rem] border border-slate-200 bg-white p-6 font-mono text-sm leading-6 text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.08)] outline-none transition-colors focus:border-primary-300 dark:border-white/10 dark:bg-[#0f1117] dark:text-slate-100"
                spellCheck={false}
              />
            ) : (
              <article
                ref={documentViewRef}
                data-testid="canvas-document-view"
                onMouseUp={captureDocumentSelection}
                onKeyUp={captureDocumentSelection}
                className="min-h-[680px] rounded-[1.35rem] border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#1a1d25] dark:shadow-none md:px-12"
              >
                <CanvasMarkdownRenderer text={documentState.contentMd} />
              </article>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

