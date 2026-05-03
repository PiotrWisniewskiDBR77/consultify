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
  CanvasDocumentState,
  CanvasLifecycleState,
  CanvasMode,
  CanvasProjectionStatus,
  CanvasSaveState,
  CanvasStarterId,
} from '@/types/canvasWorkspace';
import {
  mapDraftResponseToCanvasDocumentState,
  starterIdToCanvasKind,
} from '@/utils/canvas/canvasDraftAdapter';
import { getCanvasActionAvailability } from '@/utils/canvas/canvasActionAvailability';

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

export function WorkCanvasDocumentPanel({
  conversationId,
  initialProjectionStatus = 'synced',
  onActiveDocumentChange,
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

  const persistDraft = React.useCallback(
    async (draft: CanvasDocumentState = documentState) => {
      if (!conversationId) {
        setDocumentState((current) => ({ ...current, saveState: 'unsaved' }));
        return;
      }

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
              conversationId,
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
        setDocumentState((current) =>
          mapDraftResponseToCanvasDocumentState(savedDraft, {
            ...current,
            draftId: current.draftId || draft.draftId,
            saveState: 'saved',
            projectionError: null,
          })
        );
      } catch (error) {
        setDocumentState((current) => ({
          ...current,
          saveState: 'failed',
          projectionError: error instanceof Error ? error.message : 'Save failed',
        }));
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

  const handleCommandAction = (actionId: CanvasActionId) => {
    const availability = getCanvasActionAvailability(actionId, documentState);
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

    if (actionId === 'close') {
      if (onClose) {
        onClose();
      } else {
        setActionFeedback('Close is available when Canvas is opened from the split chat shell.');
      }
    }
  };

  const renderCommandButton = (actionId: CanvasActionId) => {
    const availability = getCanvasActionAvailability(actionId, documentState);
    const Icon = actionIcons[actionId];
    const isUnavailable = availability.status !== 'enabled';
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
        data-action-status={availability.status}
      >
        <Icon size={15} />
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
                </div>
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
                data-testid="canvas-md-view"
                className="min-h-[680px] w-full resize-y rounded-[1.35rem] border border-slate-200 bg-white p-6 font-mono text-sm leading-6 text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.08)] outline-none transition-colors focus:border-primary-300 dark:border-white/10 dark:bg-[#0f1117] dark:text-slate-100"
                spellCheck={false}
              />
            ) : (
              <article
                data-testid="canvas-document-view"
                className="min-h-[680px] rounded-[1.35rem] border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#1a1d25] dark:shadow-none md:px-12"
              >
                <CanvasMarkdownRenderer text={documentState.contentMd} />
              </article>
            )}
          </div>
        </main>
      </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-slate-200/60 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-black/5 xl:block">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Start pracy
          </div>
          <div className="space-y-1.5">
            {starterTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                  documentState.activeStarterId === template.id
                    ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-white/10'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <div className="font-semibold">{template.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 opacity-75">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[820px] px-5 py-8 lg:px-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>Markdown canonical</span>
              <span aria-hidden="true">/</span>
              <span data-testid="canvas-projection-status">
                {isProjectionRefreshing
                  ? 'Projection refreshing'
                  : projectionLabel(documentState.markdownProjectionStatus)}
              </span>
              {documentState.markdownProjectionStatus === 'failed' ? (
                <button
                  type="button"
                  onClick={retryProjection}
                  className="rounded-full px-2 py-0.5 text-amber-300 hover:bg-amber-500/10"
                >
                  Retry projection
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetToTemplate}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <RefreshCw size={12} />
                Reset
              </button>
            </div>

            {isHydrating ? (
              <div data-testid="canvas-loading-skeleton" className="min-h-[640px] animate-pulse rounded-[1.35rem] border border-white/10 bg-[#1a1d25] p-10">
                <div className="h-8 w-2/3 rounded bg-white/10" />
                <div className="mt-8 h-4 w-full rounded bg-white/10" />
                <div className="mt-3 h-4 w-5/6 rounded bg-white/10" />
                <div className="mt-8 h-32 rounded bg-white/10" />
              </div>
            ) : mode === 'md' ? (
              <textarea
                value={documentState.contentMd}
                onChange={(event) => updateMarkdown(event.target.value)}
                data-testid="canvas-md-view"
                className="min-h-[640px] w-full resize-y rounded-[1.35rem] border border-slate-200 bg-white p-6 font-mono text-sm leading-6 text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.08)] outline-none transition-colors focus:border-primary-300 dark:border-white/10 dark:bg-[#0f1117] dark:text-slate-100"
                spellCheck={false}
              />
            ) : (
              <article
                data-testid="canvas-document-view"
                className="min-h-[640px] rounded-[1.35rem] border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#1a1d25] dark:shadow-none md:px-12"
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

