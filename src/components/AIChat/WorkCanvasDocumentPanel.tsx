import type { Editor as TiptapEditor } from '@tiptap/react';
import type { TFunction } from 'i18next';
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Copy,
  Download,
  FileText,
  FolderInput,
  Gavel,
  History,
  Lightbulb,
  MoreHorizontal,
  Plus,
  Presentation,
  RefreshCw,
  Rocket,
  Save,
  Share2,
  Sparkles,
  StickyNote,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type {
  WorkCanvasConversionProposal,
  WorkCanvasTarget,
} from '@/components/AIChat/WorkCanvas/types';
import { Api } from '@/services/api';
import { WorkCanvasApi } from '@/services/api/workCanvas';
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
import { isCanvasNewDocOptionsEnabled } from '@/utils/canvasNewDocOptionsFlag';

import { CanvasArtifactBlockRenderer } from './CanvasArtifactBlockRenderer';
import { CanvasArtifactSwitcher, type CanvasMountSelection } from './CanvasArtifactSwitcher';
import { markdownToHtml } from './CanvasEditor/canvasMarkdownConversion';
import { CanvasRichEditor } from './CanvasEditor/CanvasRichEditor';
import { CanvasVersionHistory } from './CanvasEditor/CanvasVersionHistory';
import { getInitialCanvasMode, persistCanvasMode } from './CanvasEditor/canvasViewMode';
import { useCanvasAIStream } from './CanvasEditor/useCanvasAIStream';
import { CanvasMarkdownRenderer } from './CanvasMarkdownRenderer';
import { CanvasPresentationView } from './CanvasPresentationView';

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
  /** Deliverables light (L1): deck montowany w gałęzi startera 'presentation'. */
  initialDeckId?: string | null;
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

/**
 * Explicit, caller-supplied values for a single save. Used by conflict
 * recovery, which must NOT depend on `persistDraft`'s captured `documentState`
 * closure (it still holds the pre-conflict `updatedAt`) nor on a state update
 * that has not been applied yet.
 */
interface CanvasPersistOverrides {
  draftId?: string;
  /** Optimistic-concurrency token sent as `baseUpdatedAt`. */
  baseUpdatedAt?: string | null;
  title?: string;
  contentMd?: string;
}

type PendingDatasetFormat = 'csv' | 'json' | 'xlsx';
type DatasetAnalysisKind = 'profile_summary' | 'aggregate_numeric' | 'filtered_table';
type CanvasCapabilityStatus = 'real' | 'partial' | 'scaffold' | 'missing' | 'out_of_scope';

// #87a — "Z canvasa" picker row (subset of the full work_canvas_drafts row
// returned by GET /work-canvas/drafts; only what the picker + seed need).
interface WorkCanvasDraftSummary {
  id: string;
  title: string;
  kind: string;
  contentMd?: string | null;
  updatedAt?: string | null;
}

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

// #87a — kanoniczny kanał zasiewu promptu do JEDNEJ dokowanej Teresy (D17,
// parytet z `IdeaTeresaSection`/`InsightViewer`/`AIConsultantPanel`). Teresa
// jest już dokowana po lewej w tym samym `UnifiedChatPanel` — ten kanwas jest
// jej prawym panelem, więc "seed" tylko prefilluje composer, NIGDY nie otwiera
// drugiego czatu.
function seedTeresaPrompt(prompt: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      'consultify.teresa.pendingPrompt',
      JSON.stringify({ prompt, ts: Date.now() })
    );
    window.dispatchEvent(new CustomEvent('consultify:teresa-pending-prompt'));
  } catch {
    // Non-critical — the document still gets created either way.
  }
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

type CanvasShareInfo = {
  token: string;
  url: string;
  expiresAt?: string;
};

// Reads provenance.share from a raw draft API payload (share POST response or
// draft hydration). Returns null when the draft has no active share.
function extractShareFromDraft(rawDraft: unknown): CanvasShareInfo | null {
  const provenance = (rawDraft as { provenance?: { share?: unknown } } | null)?.provenance;
  const share = provenance?.share;
  if (!share || typeof share !== 'object') return null;
  const record = share as Record<string, unknown>;
  const token = typeof record.token === 'string' ? record.token.trim() : '';
  if (!token) return null;
  return {
    token,
    url:
      typeof record.url === 'string' && record.url.length > 0
        ? record.url
        : `/public/artifacts/${token}`,
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : undefined,
  };
}

// Share urls are stored as app-relative paths (/public/artifacts/:token);
// recipients need the absolute origin-qualified form.
function absoluteShareUrl(share: CanvasShareInfo): string {
  if (/^https?:\/\//i.test(share.url)) return share.url;
  return typeof window !== 'undefined' ? `${window.location.origin}${share.url}` : share.url;
}

const menuWorkspaceActionIds: CanvasActionId[] = [
  'send-to-idea',
  'save-as-note',
  'create-initiative',
  // C3 — converge with WorkCanvasShell vocabulary. Decision was backend-ready
  // for ages; only the guard at /save-to-workspace and this menu list blocked
  // the chat-shell from exposing it.
  'create-decision',
  // C4.1 — Tasks bridge through TaskService.createTask. Same one-click path as
  // the other workspace actions; runs through runWorkspaceAction('task').
  'create-task',
];

const menuOutputActionIds: CanvasActionId[] = [
  'create-presentation',
  'create-table',
  'create-report',
];

const isVitestRuntime = typeof process !== 'undefined' && Boolean(process.env?.VITEST);

const defaultCanvasRuntimeCapabilities: CanvasRuntimeCapabilities = {
  canCreatePresentation: isVitestRuntime,
  canCreateTable: isVitestRuntime,
  canCreateReport: isVitestRuntime,
  canSendToIdea: isVitestRuntime,
  canSaveAsNote: isVitestRuntime,
  canCreateInitiative: isVitestRuntime,
  // C3 — new actions; defaults follow the same vitest-runtime gate as siblings.
  canCreateDecision: isVitestRuntime,
  // C4.1
  canCreateTask: isVitestRuntime,
  canShare: false,
};

const richEditorDecision = {
  status: 'post_ga_decision_gate',
  editorRuntime: 'markdown_first_with_review_controls',
  migrationHint: 'TipTap/ProseMirror stays feature-flagged until Stage 54 execution.',
} as const;

const workspaceTargets: Partial<
  Record<CanvasActionId, 'idea' | 'note' | 'initiative' | 'decision' | 'task'>
> = {
  'send-to-idea': 'idea',
  'save-as-note': 'note',
  'create-initiative': 'initiative',
  'create-decision': 'decision',
  // C4.1
  'create-task': 'task',
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
  // C3 — "Capture decision" mirrors the Decisions module icon family.
  'create-decision': Gavel,
  // C4.1 — Tasks bridge through TaskService.createTask.
  'create-task': CheckSquare,
};

// C4 — icons + labels for the "Utworzone z tego dokumentu" provenance ledger
// (draft.provenance.materializedTo[]). Mirrors the workspace-action icon family.
const materializedTargetIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  idea: Lightbulb,
  note: StickyNote,
  initiative: Rocket,
  decision: Gavel,
  task: CheckSquare,
};

type CanvasPanelTFn = TFunction;

function materializedTargetLabel(target: string, t: CanvasPanelTFn): string {
  if (target === 'idea') return t('canvas.panel.materialized.idea', 'Idea');
  if (target === 'note') return t('canvas.panel.materialized.note', 'Note');
  if (target === 'initiative') return t('canvas.panel.materialized.initiative', 'Initiative');
  if (target === 'decision') return t('canvas.panel.materialized.decision', 'Decision');
  if (target === 'task') return t('canvas.panel.materialized.task', 'Task');
  return target;
}

/**
 * C4 — render inline `[label](path)` links in the action-feedback strip as
 * clickable anchors. Several success messages (save-to-workspace, Table/
 * Document Studio handoffs) already embed Markdown links that previously
 * rendered as plain text.
 */
function renderFeedbackWithLinks(text: string): React.ReactNode {
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a
        key={`feedback-link-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

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

function lifecycleLabel(lifecycleState: CanvasLifecycleState, t: CanvasPanelTFn): string {
  if (lifecycleState === 'in_review') return t('canvas.panel.lifecycle.inReview', 'In review');
  if (lifecycleState === 'approved') return t('canvas.panel.lifecycle.approved', 'Approved');
  return t('canvas.panel.lifecycle.draft', 'Draft');
}

function projectionLabel(status: CanvasProjectionStatus, t: CanvasPanelTFn): string {
  if (status === 'stale') return t('canvas.panel.projection.stale', 'Projection stale');
  if (status === 'failed') return t('canvas.panel.projection.failed', 'Projection failed');
  if (status === 'missing') return t('canvas.panel.projection.missing', 'Projection missing');
  return t('canvas.panel.projection.synced', 'Projection synced');
}

function saveStateLabel(saveState: CanvasDocumentState['saveState'], t: CanvasPanelTFn): string {
  if (saveState === 'saving') return t('canvas.panel.saveState.saving', 'Saving');
  if (saveState === 'failed') return t('canvas.panel.saveState.failed', 'Save failed');
  if (saveState === 'unsaved') return t('canvas.panel.saveState.unsaved', 'Unsaved changes');
  if (saveState === 'conflict')
    return t('canvas.panel.saveState.conflict', 'Changed elsewhere — not saved');
  return t('canvas.panel.saveState.saved', 'Saved');
}

/** Short, locale-aware clock time for the "Saved at …" affordance. */
function formatLastSavedAt(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

function capabilityLabel(status: CanvasCapabilityStatus, t: CanvasPanelTFn): string {
  if (status === 'out_of_scope') return t('canvas.panel.capability.outOfScope', 'Out of scope');
  return t(`canvas.panel.capability.${status}`, status.charAt(0).toUpperCase() + status.slice(1));
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
    return 'bg-danger-500/10 text-danger-700 dark:text-danger-300';
  }
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
}

function CapabilityBadge({
  status,
  testId,
}: {
  status: CanvasCapabilityStatus;
  testId?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${capabilityBadgeClass(
        status
      )}`}
    >
      {capabilityLabel(status, t)}
    </span>
  );
}

function renderCapabilityBadge(status: CanvasCapabilityStatus, testId?: string) {
  return <CapabilityBadge status={status} testId={testId} />;
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

/**
 * Deliverables light (L1, krok 4): starter 'presentation' montuje żywy artefakt
 * decka (CardRenderer, read-mostly) zamiast dokumentu markdown. Gałęzie są w JSX
 * (nie warunkowe hooki), więc panel markdown nie odpala efektów draftowych
 * (autosave/hydration) dla decka.
 *
 * B2 (artifact lifecycle): wrapper trzyma lekki przełącznik artefaktów rozmowy
 * (CanvasArtifactSwitcher) — null = montuj wg propsów (zachowanie L1/L2 bez zmian).
 */
export function WorkCanvasDocumentPanel(props: WorkCanvasDocumentPanelProps) {
  const [mountOverride, setMountOverride] = React.useState<CanvasMountSelection | null>(null);

  // Nowe żądanie z czatu (inny deck/draft/starter lub inna rozmowa) wygrywa
  // z ręcznym przełączeniem — wracamy do montażu props-driven.
  React.useEffect(() => {
    setMountOverride(null);
  }, [props.conversationId, props.initialStarterId, props.initialDeckId, props.initialDraftId]);

  // A1 (Kimi-parity): zakończona generacja doc/sheet przełącza panel na keyed
  // mount tego draftu (`switched-doc-…`) — świeży panel hydratuje finalną treść
  // deterministycznie, bez polegania na synchronizacji in-place otwartego edytora.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDraftReady = (event: Event) => {
      const draftId = String((event as CustomEvent)?.detail?.draftId || '').trim();
      if (!draftId) return;
      setMountOverride({ kind: 'doc', draftId });
    };
    window.addEventListener('deliverables:draft-ready', onDraftReady);
    return () => window.removeEventListener('deliverables:draft-ready', onDraftReady);
  }, []);

  // Tryb B fix (UWAGA #1 / SPEC_ZADANIE_01): deterministyczny montaż.
  // Gdy canvas jest podparty draftem (initialDraftId), montuj ten draft jako
  // dokument zamiast szablonu „base" — niezależnie od kolejności reset(:704)
  // vs event `deliverables:draft-ready`(:711). To usuwa wyścig, w którym
  // reset mountOverride=null po zmianie propsa cofał panel do pustego szablonu
  // „Company Work Note" mimo realnie utworzonego draftu. Ręczne przełączenie
  // przez switcher (mountOverride) nadal wygrywa.
  // BUG N-5: a NEW draft requested from chat (distinct props.initialDraftId)
  // must mount as a fresh artifact (new keyed tab), never overwrite the
  // currently-open draft. A `mountOverride` left over from a prior
  // `deliverables:draft-ready` event (or in-flight switch) can still point at
  // the OLD draft when a different draftId arrives via props; in that case the
  // override is stale and the prop wins. Manual switcher selections to a
  // matching/absent draft, decks, or base still win as before.
  const overrideIsStaleForNewDraft =
    Boolean(props.initialDraftId) &&
    (mountOverride?.kind === 'doc' || mountOverride?.kind === 'sheet') &&
    mountOverride.draftId !== props.initialDraftId;
  const effectiveOverride = overrideIsStaleForNewDraft ? null : mountOverride;
  const mounted: CanvasMountSelection =
    effectiveOverride ||
    (props.initialStarterId === 'presentation'
      ? { kind: 'deck', deckId: props.initialDeckId || null }
      : props.initialDraftId
        ? { kind: 'doc', draftId: props.initialDraftId }
        : { kind: 'base' });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasArtifactSwitcher
        conversationId={props.conversationId}
        mounted={mounted}
        hasBaseDocument={props.initialStarterId !== 'presentation'}
        baseDraftId={props.initialDraftId}
        onSelect={setMountOverride}
      />
      <div className="min-h-0 flex-1">
        {mounted.kind === 'deck' ? (
          <CanvasPresentationView deckId={mounted.deckId} onClose={props.onClose} />
        ) : mounted.kind === 'doc' || mounted.kind === 'sheet' ? (
          // Sheets are GFM-table markdown drafts — same markdown mount as docs.
          <WorkCanvasMarkdownDocumentPanel
            key={`switched-${mounted.kind}-${mounted.draftId}`}
            {...props}
            initialStarterId="document"
            initialDraftId={mounted.draftId}
          />
        ) : (
          <WorkCanvasMarkdownDocumentPanel {...props} />
        )}
      </div>
    </div>
  );
}

function WorkCanvasMarkdownDocumentPanel({
  conversationId,
  initialStarterId,
  initialDraftId,
  initialProjectionStatus = 'synced',
  initialBlocks = [],
  onActiveDocumentChange,
  onCanvasSelectionChange,
  onClose,
}: WorkCanvasDocumentPanelProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
  // #87a — "+" New Canvas menu, 3 explicit start options (flag-gated, see
  // canvasNewDocOptionsFlag). "Z canvasa" lazy-loads the user's other Work
  // Canvas document drafts on first open of that section.
  const [otherCanvasDrafts, setOtherCanvasDrafts] = React.useState<WorkCanvasDraftSummary[]>([]);
  const [isOtherCanvasDraftsLoading, setIsOtherCanvasDraftsLoading] = React.useState(false);
  const [otherCanvasDraftsError, setOtherCanvasDraftsError] = React.useState<string | null>(null);
  const [otherCanvasDraftsLoaded, setOtherCanvasDraftsLoaded] = React.useState(false);
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
  // #17 (rewizja 07-12): persistent breadcrumb back to the source notebook
  // page for drafts created via "Expand into document" (notebook-expand
  // provenance). Unlike the one-time `actionFeedback` notice below, this stays
  // visible in the header for the lifetime of the mounted draft — Piotr's ask
  // was "easy return to THIS SPECIFIC note", not a toast that scrolls away.
  const [expandSourceNote, setExpandSourceNote] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [activeActionId, setActiveActionId] = React.useState<CanvasActionId | null>(null);
  // Active public share for the loaded draft (mirrors provenance.share).
  const [shareInfo, setShareInfo] = React.useState<CanvasShareInfo | null>(null);
  const [isRevokingShare, setIsRevokingShare] = React.useState(false);
  // Z138: local collapse for the share strip — hides the bar without revoking
  // the actual public link (distinct from "Revoke share", which is destructive).
  const [isShareStripDismissed, setIsShareStripDismissed] = React.useState(false);
  const [isSavingToOutputs, setIsSavingToOutputs] = React.useState(false);
  const [canvasSelection, setCanvasSelection] = React.useState<CanvasSelection | null>(null);
  // Live TipTap editor instance (rich mode), lifted so Teresa can stream into it.
  const [richEditor, setRichEditor] = React.useState<TiptapEditor | null>(null);
  /**
   * Set when the server rejects a save because the draft moved on elsewhere.
   * Holds both sides so the user can choose; nothing is written until they do.
   */
  const [canvasConflict, setCanvasConflict] = React.useState<{
    draftId: string;
    serverUpdatedAt: string | null;
    serverTitle: string | null;
    serverContentMd: string | null;
    localTitle: string;
    localContentMd: string;
  } | null>(null);
  const [versions, setVersions] = React.useState<CanvasVersionSummary[]>([]);
  // Prev/Next stepper cursor into `versions` (0 = latest, list is DESC by date).
  const [versionCursor, setVersionCursor] = React.useState(0);
  const [isVersionsOpen, setIsVersionsOpen] = React.useState(false);
  const [isVersionsLoading, setIsVersionsLoading] = React.useState(false);
  // B1 — toolbar version-history popover (separate from the diagnostics list).
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
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
  // persistDraft is defined further down; conflict recovery needs to call it.
  const persistDraftRef = React.useRef<
    | ((
        draft?: CanvasDocumentState,
        overrides?: CanvasPersistOverrides
      ) => Promise<CanvasDocumentState | null>)
    | null
  >(null);

  const lastSavedAtLabel = React.useMemo(
    () => formatLastSavedAt(documentState.lastSavedAt, i18n.language),
    [documentState.lastSavedAt, i18n.language]
  );
  const markdownEditorRef = React.useRef<HTMLTextAreaElement | null>(null);

  /**
   * Conflict recovery. Both branches are explicit user choices — neither runs
   * automatically, which is the whole point: the previous behaviour silently
   * re-saved local content over the other writer's version.
   *
   * Declared after the editor refs on purpose: "load theirs" has to push the
   * server version into the LIVE editors, not only into React state.
   */
  const resolveConflictKeepMine = React.useCallback(async () => {
    const conflict = canvasConflict;
    if (!conflict) return;
    // Adopt the server's updatedAt so the next save is accepted, then persist
    // the local content as a new version. History keeps the other version.
    setCanvasConflict(null);
    setDocumentState((current) => ({
      ...current,
      updatedAt: conflict.serverUpdatedAt,
      saveState: 'unsaved',
    }));
    // DEFECT-1: `persistDraft` is a useCallback closed over `documentState`, so
    // the ref still points at a closure holding the PRE-conflict `updatedAt`.
    // Relying on the state transition above would re-send the stale token and
    // 409 again forever. The conflict's own values are therefore passed
    // explicitly — the request carries the server's updatedAt as
    // `baseUpdatedAt` and the LOCAL title/content as the payload.
    await persistDraftRef.current?.(undefined, {
      draftId: conflict.draftId,
      baseUpdatedAt: conflict.serverUpdatedAt,
      title: conflict.localTitle,
      contentMd: conflict.localContentMd,
    });
  }, [canvasConflict]);

  const resolveConflictLoadTheirs = React.useCallback(() => {
    const conflict = canvasConflict;
    if (!conflict) return;
    const nextTitle = conflict.serverTitle ?? latestTitleRef.current;
    const nextContentMd = conflict.serverContentMd ?? latestContentRef.current;
    setCanvasConflict(null);
    // DEFECT-2: React state alone left the user staring at their own text —
    // the live editors keep their own document. Push the server version into
    // every surface that can hold content, and re-baseline the "last saved"
    // refs so the panel does not immediately consider itself dirty again.
    latestTitleRef.current = nextTitle;
    latestContentRef.current = nextContentMd;
    lastSavedTitleRef.current = nextTitle;
    lastSavedContentRef.current = nextContentMd;
    if (titleInputRef.current) titleInputRef.current.value = nextTitle;
    if (markdownEditorRef.current) markdownEditorRef.current.value = nextContentMd;
    if (richEditor && !richEditor.isDestroyed) {
      // emitUpdate:false — an external load must not bounce back through
      // onUpdate as a fresh local edit (same contract as CanvasRichEditor's
      // own external-sync effect).
      richEditor.commands.setContent(markdownToHtml(nextContentMd), { emitUpdate: false });
    }
    setDocumentState((current) => ({
      ...current,
      title: nextTitle,
      contentMd: nextContentMd,
      updatedAt: conflict.serverUpdatedAt,
      saveState: 'saved',
      lastSavedAt: conflict.serverUpdatedAt,
    }));
  }, [canvasConflict, richEditor]);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  // #87c — dedicated input for "Import Markdown", separate from uploadInputRef
  // (which is the CSV/JSON/XLSX dataset + generic chat-attachment uploader).
  const markdownImportInputRef = React.useRef<HTMLInputElement | null>(null);
  const initialStarterPersistedRef = React.useRef(false);
  // C3 (KROK 6, D-C-2): origin provenance of the loaded draft (e.g. notebook-expand
  // source fields). Persisted saves spread it back so the panel's own provenance
  // payload does not clobber the copy-with-provenance contract on first autosave.
  const draftOriginProvenanceRef = React.useRef<Record<string, unknown> | null>(null);
  const expandSourceNoticeShownRef = React.useRef(false);
  const handoffKeysRef = React.useRef(new Map<string, string>());
  const handoffFlightsRef = React.useRef(new Map<string, Promise<WorkCanvasConversionProposal>>());

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

  const showDurableHandoffReceipt = React.useCallback(
    (proposal: WorkCanvasConversionProposal, prefix = 'Created') => {
      const url =
        proposal.readBack && typeof proposal.readBack.url === 'string'
          ? proposal.readBack.url
          : null;
      const objectId = proposal.targetObjectId || 'unknown';
      setStatusFeedback(
        url
          ? `${prefix} ${proposal.target} (${objectId}). [Open created object](${url})`
          : `${prefix} ${proposal.target} (${objectId}).`
      );
    },
    [setStatusFeedback]
  );

  // C3 (KROK 6): remember the loaded draft's provenance (so saves preserve it)
  // and surface a one-time "Źródło: notatka …" notice for notebook-expand drafts.
  const captureDraftOriginProvenance = React.useCallback(
    (draft: any) => {
      const provenance =
        draft?.provenance && typeof draft.provenance === 'object'
          ? (draft.provenance as Record<string, unknown>)
          : null;
      draftOriginProvenanceRef.current = provenance;
      const isNotebookExpand =
        !!provenance &&
        String(provenance.source || provenance.originSource || '') === 'notebook-expand';
      const sourceId = isNotebookExpand ? String(provenance.sourceId || '').trim() : '';
      // #17: keep (or clear) the persistent "back to note" breadcrumb every
      // time a draft is (re)hydrated — independent of the one-time toast below,
      // so switching to an unrelated draft/deck doesn't leave a stale link.
      setExpandSourceNote(
        sourceId ? { id: sourceId, title: String(provenance!.sourceTitle || '').trim() } : null
      );
      if (isNotebookExpand && !expandSourceNoticeShownRef.current) {
        expandSourceNoticeShownRef.current = true;
        const sourceTitle = String(provenance!.sourceTitle || '').trim();
        setStatusFeedback(
          sourceTitle
            ? `${t('canvas.panel.source.note', 'Source: note')} „${sourceTitle}”`
            : t('canvas.panel.source.note', 'Source: note')
        );
      }
    },
    [setStatusFeedback, t]
  );

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
              setShareInfo(extractShareFromDraft(draftById));
              captureDraftOriginProvenance(draftById);
              const durableReceipt = (jsonById?.data?.proposals || [])
                .filter(
                  (proposal: WorkCanvasConversionProposal) =>
                    proposal.status === 'approved' && proposal.targetObjectId
                )
                .sort((a: WorkCanvasConversionProposal, b: WorkCanvasConversionProposal) =>
                  String(b.updatedAt || b.createdAt).localeCompare(
                    String(a.updatedAt || a.createdAt)
                  )
                )[0];
              if (durableReceipt) showDurableHandoffReceipt(durableReceipt, 'Previously created');
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
            // GET /drafts/:id returns envelope({ draft }) — align with the primary path.
            const draftById = jsonById?.data?.draft || jsonById?.data;
            if (!responseById.ok || cancelled || !draftById) return;
            setDocumentState((current) =>
              mapDraftResponseToCanvasDocumentState(draftById, current)
            );
            setShareInfo(extractShareFromDraft(draftById));
            captureDraftOriginProvenance(draftById);
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
          setShareInfo(extractShareFromDraft(latestDraft));
          captureDraftOriginProvenance(latestDraft);
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

  // Deliverables light (Kimi-parity): panel montuje się od razu po PLAN ze
  // szkieletem („…po zakończeniu generacji”), a gdy generacja w tle skończy,
  // czat emituje 'deliverables:draft-ready' i panel dociąga gotową treść.
  // Bezpiecznik: odświeżamy TYLKO jeśli edytor nadal pokazuje szkielet —
  // jeżeli użytkownik zdążył pisać, nie nadpisujemy jego pracy.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDraftReady = (event: Event) => {
      const readyDraftId = String((event as CustomEvent)?.detail?.draftId || '').trim();
      if (!readyDraftId || readyDraftId !== String(documentState.draftId || '').trim()) return;
      const stillSkeleton = String(documentState.contentMd || '').includes(
        'po zakończeniu generacji'
      );
      if (!stillSkeleton) return;
      void (async () => {
        try {
          const token = window.localStorage.getItem('token') || '';
          const response = await fetch(
            `/api/work-canvas/drafts/${encodeURIComponent(readyDraftId)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
          );
          const json = await response.json().catch(() => ({}));
          const draft = json?.data?.draft || json?.data;
          if (!response.ok || !draft) return;
          setDocumentState((current) => mapDraftResponseToCanvasDocumentState(draft, current));
          lastSavedContentRef.current =
            typeof draft.contentMd === 'string'
              ? draft.contentMd
              : typeof draft.content === 'string'
                ? draft.content
                : lastSavedContentRef.current;
          lastSavedTitleRef.current =
            typeof draft.title === 'string' ? draft.title : lastSavedTitleRef.current;
        } catch {
          /* poll w czacie i finalna notka dalej prowadzą użytkownika */
        }
      })();
    };
    window.addEventListener('deliverables:draft-ready', onDraftReady);
    return () => window.removeEventListener('deliverables:draft-ready', onDraftReady);
  }, [documentState.draftId, documentState.contentMd]);

  // N-13 (P1): reload w trakcie streamingu hydratuje draft, którego projekcja
  // markdown nie jest jeszcze 'synced' (generacja/projekcja trwa) — wtedy panel
  // zamrażał wersję CZĘŚCIOWĄ mimo że draft w DB doreżyserowuje się do pełnego.
  // Fix: dla świeżo zhydratowanego draftu w stanie nie-'synced' uruchom krótki
  // re-poll GET /drafts/:id z backoffem; po osiągnięciu 'synced' zhydratuj pełną
  // treść. Guard antyklobber: hydratujemy TYLKO gdy live editor nadal pokazuje
  // tę samą treść co w chwili startu re-pollu (użytkownik nie zaczął pisać) i
  // gdy nie ma niezapisanych zmian (saveState !== 'unsaved').
  const reHydrateProjectionRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isHydrating) return;
    const draftId = String(documentState.draftId || '').trim();
    if (!draftId) return;
    if (documentState.markdownProjectionStatus === 'synced') return;
    // Re-poll tylko RAZ na świeżo zamontowany draft w stanie nie-'synced'.
    if (reHydrateProjectionRef.current === draftId) return;
    reHydrateProjectionRef.current = draftId;

    let cancelled = false;
    let timer: number | null = null;
    // Snapshot treści w chwili startu — jeśli zmieni się (user pisze), przerwij.
    const baselineContent = latestContentRef.current;
    const backoffMs = [1000, 2000, 3000, 5000, 5000, 5000];

    const userHasEdited = () =>
      latestContentRef.current !== baselineContent ||
      (markdownEditorRef.current != null && markdownEditorRef.current.value !== baselineContent);

    const attempt = async (index: number) => {
      if (cancelled || index >= backoffMs.length) return;
      // Nie klobruj — jeśli user zaczął edytować, porzuć re-poll.
      if (userHasEdited()) return;
      try {
        const token = window.localStorage.getItem('token') || '';
        const response = await fetch(`/api/work-canvas/drafts/${encodeURIComponent(draftId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await response.json().catch(() => ({}));
        const draft = json?.data?.draft || json?.data;
        if (cancelled) return;
        if (response.ok && draft) {
          const projection = String(draft.markdownProjectionStatus || '');
          if (projection === 'synced') {
            // Ostatni guard przed nadpisaniem: user nie pisał i nie ma pending.
            if (userHasEdited()) return;
            setDocumentState((current) => {
              if (current.saveState === 'unsaved') return current;
              return mapDraftResponseToCanvasDocumentState(draft, current);
            });
            lastSavedContentRef.current =
              typeof draft.contentMd === 'string'
                ? draft.contentMd
                : typeof draft.content === 'string'
                  ? draft.content
                  : lastSavedContentRef.current;
            lastSavedTitleRef.current =
              typeof draft.title === 'string' ? draft.title : lastSavedTitleRef.current;
            return;
          }
        }
      } catch {
        /* przejściowy błąd sieci — kolejna próba w backoffie */
      }
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void attempt(index + 1);
      }, backoffMs[index]);
    };

    timer = window.setTimeout(() => {
      void attempt(0);
    }, backoffMs[0]);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [isHydrating, documentState.draftId, documentState.markdownProjectionStatus]);

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
      // C3 — new capability; backend permission key follows the same family.
      ['canCreateDecision', 'canvas.convert.decision'],
      // C4.1
      ['canCreateTask', 'canvas.convert.task'],
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
    async (draft?: CanvasDocumentState, overrides?: CanvasPersistOverrides) => {
      const draftToPersist = draft || {
        ...documentState,
        title: titleInputRef.current?.value ?? latestTitleRef.current,
        contentMd: markdownEditorRef.current?.value ?? latestContentRef.current,
      };
      // BUG N-1: persist the FRESHEST local content, not the stale closure
      // snapshot. The debounced autosave captures `documentState` at schedule
      // time; a chat-driven append (onComplete → updateMarkdown) lands its
      // result in `latestContentRef`/the live editor moments later, and on a
      // 409 the retry would otherwise re-send the pre-append snapshot and
      // clobber the appended section. So for the CURRENTLY MOUNTED draft we
      // resolve title/content from the live editor → refs at persist time —
      // both the initial PUT and the 409 retry then carry the appended content.
      //
      // We only override when the draft being persisted IS the mounted doc
      // (matching draftId, or the no-arg autosave path). For `selectTemplate`
      // / starter-persist the explicit draft is a NEW document whose draftId
      // differs from the still-mounted one (and whose refs have not synced yet),
      // so we keep its content verbatim — preventing a stale-ref regression.
      const persistingMountedDraft =
        !draft ||
        (Boolean(draftToPersist.draftId) && draftToPersist.draftId === documentState.draftId);
      //
      // `overrides` (conflict recovery) beats both: the caller already knows
      // exactly which bytes and which concurrency token must go out, and must
      // not be second-guessed by a closure or a live editor.
      const effectiveDraftId = overrides?.draftId ?? draftToPersist.draftId;
      const effectiveTitle =
        typeof overrides?.title === 'string'
          ? overrides.title
          : persistingMountedDraft
            ? (titleInputRef.current?.value ?? latestTitleRef.current ?? draftToPersist.title)
            : draftToPersist.title;
      const effectiveContentMd =
        typeof overrides?.contentMd === 'string'
          ? overrides.contentMd
          : persistingMountedDraft
            ? (markdownEditorRef.current?.value ??
              latestContentRef.current ??
              draftToPersist.contentMd)
            : draftToPersist.contentMd;
      const effectiveBaseUpdatedAt =
        overrides && 'baseUpdatedAt' in overrides
          ? (overrides.baseUpdatedAt ?? null)
          : draftToPersist.updatedAt || null;
      // Guard (wzorzec W2-T2): szkielet generacji deliverables NIGDY nie jest
      // wart zapisu — serwer ma go od kroku PLAN, a zapis może NADPISAĆ finalną
      // treść dopisaną w tle przez generator (udokumentowany incydent: stale
      // panel autosave'ował szkielet po ukończonej generacji).
      if (String(effectiveContentMd || '').includes('po zakończeniu generacji')) {
        setDocumentState((current) => ({ ...current, saveState: 'saved' }));
        return null;
      }
      const effectiveConversationId = conversationId || `canvas-${Date.now()}`;

      setDocumentState((current) => ({ ...current, saveState: 'saving' }));
      try {
        const token = window.localStorage.getItem('token') || '';
        const saveDraft = async (baseUpdatedAt: string | null | undefined) =>
          fetch(
            effectiveDraftId
              ? `/api/work-canvas/drafts/${encodeURIComponent(effectiveDraftId)}`
              : '/api/work-canvas/drafts',
            {
              method: effectiveDraftId ? 'PUT' : 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                conversationId: effectiveConversationId,
                baseUpdatedAt: baseUpdatedAt || null,
                kind: draftToPersist.kind,
                title: effectiveTitle,
                content: effectiveContentMd,
                canonicalFormat: draftToPersist.canonicalFormat,
                contentMd: effectiveContentMd,
                blocks: draftToPersist.blocks || [],
                saveState: 'saved',
                lifecycleState: draftToPersist.lifecycleState,
                researchSessionId: draftToPersist.researchSessionId || null,
                provenance: {
                  // C3 (D-C-2): keep origin provenance (e.g. notebook-expand
                  // sourceType/sourceId/sourceTitle) — PUT replaces provenance
                  // wholesale, so the panel must echo it back on every save.
                  ...(draftOriginProvenanceRef.current || {}),
                  ...(draftOriginProvenanceRef.current?.source &&
                  draftOriginProvenanceRef.current.source !== 'chat-work-canvas-panel'
                    ? { originSource: draftOriginProvenanceRef.current.source }
                    : {}),
                  source: 'chat-work-canvas-panel',
                  starterId: draftToPersist.activeStarterId,
                  researchSessionId: draftToPersist.researchSessionId || null,
                  workflowRuns: draftToPersist.workflowRuns || [],
                },
              }),
            }
          );

        const response = await saveDraft(effectiveBaseUpdatedAt);
        const json = await response.json().catch(() => ({}));
        if (
          response.status === 409 &&
          effectiveDraftId &&
          String(json?.code || '') === 'CANVAS_DRAFT_CONFLICT'
        ) {
          // This used to re-read the server's updatedAt and immediately re-save
          // the local content under it, silently destroying whatever the other
          // writer had saved. A conflict is now surfaced instead: local edits
          // stay in the editor, nothing is overwritten, and the user chooses.
          const currentResponse = await fetch(
            `/api/work-canvas/drafts/${encodeURIComponent(effectiveDraftId)}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }
          );
          const currentJson = await currentResponse.json().catch(() => ({}));
          const currentDraft = currentJson?.data?.draft || currentJson?.data;
          setDocumentState((current) => ({ ...current, saveState: 'conflict' }));
          setCanvasConflict({
            draftId: effectiveDraftId,
            serverUpdatedAt:
              typeof currentDraft?.updatedAt === 'string' ? currentDraft.updatedAt : null,
            serverTitle: typeof currentDraft?.title === 'string' ? currentDraft.title : null,
            serverContentMd:
              typeof currentDraft?.contentMd === 'string'
                ? currentDraft.contentMd
                : typeof currentDraft?.content === 'string'
                  ? currentDraft.content
                  : null,
            localTitle: effectiveTitle,
            localContentMd: effectiveContentMd,
          });
          setAlertFeedback(
            t(
              'canvas.panel.conflict.detected',
              'This document changed elsewhere. Your edits were not saved yet.'
            )
          );
          return null;
        }
        if (!response.ok) {
          const saveError: any = new Error(json?.error || 'Failed to save Canvas draft');
          saveError.data = json;
          throw saveError;
        }
        const savedDraft = json?.data;
        // A save landed, so any earlier conflict is resolved.
        setCanvasConflict(null);
        const savedAt =
          typeof savedDraft?.updatedAt === 'string'
            ? savedDraft.updatedAt
            : new Date().toISOString();
        // Keep echoing the server's merged provenance on subsequent saves (C3/D-C-2).
        if (savedDraft?.provenance && typeof savedDraft.provenance === 'object') {
          draftOriginProvenanceRef.current = savedDraft.provenance as Record<string, unknown>;
        }
        const nextState = mapDraftResponseToCanvasDocumentState(savedDraft, {
          ...draftToPersist,
          // BUG N-1: the fallback base must reflect what we actually sent
          // (effective* values), not the stale snapshot, so a returned draft
          // missing contentMd/title still resolves to the appended content.
          title: effectiveTitle,
          contentMd: effectiveContentMd,
          draftId: effectiveDraftId,
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
          // BUG N-1: compare against the content we actually sent
          // (effectiveContentMd). If the live state moved on since persist
          // started (further edits/appends), keep `unsaved` so the next
          // autosave flushes the newer content.
          if (current.contentMd !== effectiveContentMd) {
            return {
              ...current,
              draftId: savedDraftId || current.draftId || effectiveDraftId,
              saveState: 'unsaved',
            };
          }
          return {
            ...mapDraftResponseToCanvasDocumentState(savedDraft, {
              ...current,
              draftId: savedDraftId || current.draftId || effectiveDraftId,
              saveState: 'saved',
              projectionError: null,
            }),
            lastSavedAt: savedAt,
          };
        });
        if (latestContentRef.current === effectiveContentMd) {
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

  // Keep the ref current so conflict recovery, declared earlier, can persist.
  React.useEffect(() => {
    persistDraftRef.current = persistDraft;
  }, [persistDraft]);

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
    // P0-1/D1: hydration is async — `!documentState.draftId` is true for a
    // moment even when this mount was given a concrete draft to load
    // (generation flows, reopen-from-chip). Persisting the starter template in
    // that window mints a competing boilerplate draft that steals
    // documentState.draftId from the hydrated one (orphan "Company Work Note"
    // drafts, draft-ready refresh rejected by its draftId guard). When any
    // hydration source exists, the draft already lives server-side — never
    // create another one here.
    const hydrationSourceDraftId =
      initialDraftId ||
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(LAST_DRAFT_ID_STORAGE_KEY)
        : null);
    if (
      initialStarterId &&
      !initialStarterPersistedRef.current &&
      documentState.activeStarterId === initialStarterId &&
      !documentState.draftId &&
      !hydrationSourceDraftId
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

  // #87a — `opts.seedTeresa` prefill the docked Teresa (left side of this same
  // split view) with a context-aware kickoff prompt via the canonical
  // pendingPrompt channel. Optional + default-off so the pre-existing kebab
  // "Starter Templates" call site (unrelated to #87a) keeps its old behavior.
  const selectTemplate = (
    template: StarterTemplate,
    opts?: { seedTeresa?: boolean; teresaPrompt?: string }
  ) => {
    const next = createDocumentState(template);
    setDocumentState(next);
    // Fresh draft — any share strip from the previous draft is stale.
    setShareInfo(null);
    setMode('document');
    if (opts?.seedTeresa) {
      seedTeresaPrompt(
        opts.teresaPrompt ||
          t('canvas.panel.newMenu.seedFromTemplate', {
            defaultValue:
              'I started a new document "{{title}}" from a template. Help me develop it — suggest what to fill in first.',
            title: template.title,
          })
      );
    }
    void (async () => {
      const researchSessionId = await createResearchSessionForDraft(next);
      const draftToPersist = researchSessionId ? { ...next, researchSessionId } : next;
      if (researchSessionId) setDocumentState(draftToPersist);
      void persistDraft(draftToPersist);
    })();
  };

  // #87a — option (a) Czysty: blank document, no starter markdown. Reuses the
  // exact same create/persist path as template selection (zero bespoke).
  const startBlankDocument = () => {
    const blankTemplate: StarterTemplate = {
      id: 'document',
      label: t('canvas.panel.newMenu.blank', 'Czysty dokument'),
      title: t('canvas.panel.newMenu.blankTitle', 'Nowy dokument'),
      description: t('canvas.panel.newMenu.blankDesc', 'Puste — zaczynasz od zera z Teresą.'),
      capability: 'real',
      capabilityNote: t(
        'canvas.panel.newMenu.blankCapabilityNote',
        'Markdown document, autosave, and Teresa context are production-backed.'
      ),
      markdown: '',
    };
    selectTemplate(blankTemplate, {
      seedTeresa: true,
      teresaPrompt: t(
        'canvas.panel.newMenu.seedBlank',
        'I am starting a blank document from scratch. Ask me questions to nail down the goal, context, and a first draft direction.'
      ),
    });
  };

  // #87a — option (c) Z canvasa: lazy-load the user's other Work Canvas
  // document drafts (GET /work-canvas/drafts, org+owner scoped by the
  // backend) for the picker. Only fetched once, on first menu open.
  const loadOtherCanvasDrafts = React.useCallback(async () => {
    setIsOtherCanvasDraftsLoading(true);
    setOtherCanvasDraftsError(null);
    try {
      const rows = await Api.workCanvasListDrafts(conversationId || undefined);
      const currentId = String(documentState.draftId || '').trim();
      const mapped: WorkCanvasDraftSummary[] = (Array.isArray(rows) ? rows : [])
        .filter((row: any) => row && typeof row === 'object' && String(row.id || '') !== currentId)
        .filter((row: any) => typeof row.contentMd === 'string' && row.contentMd.trim().length > 0)
        .slice(0, 20)
        .map((row: any) => ({
          id: String(row.id),
          title: String(row.title || t('canvas.panel.newMenu.untitled', 'Untitled')),
          kind: String(row.kind || 'document'),
          contentMd: row.contentMd as string,
          updatedAt: (row.updatedAt as string | undefined) || null,
        }));
      setOtherCanvasDrafts(mapped);
    } catch (error) {
      setOtherCanvasDraftsError(
        error instanceof Error
          ? error.message
          : t('canvas.panel.newMenu.fromCanvasError', 'Failed to load your other canvases.')
      );
    } finally {
      setIsOtherCanvasDraftsLoading(false);
      setOtherCanvasDraftsLoaded(true);
    }
  }, [conversationId, documentState.draftId, t]);

  // #87a — option (c) continued: duplicate the picked canvas's markdown into
  // this brand-new draft (COPY, not live-sync — mirrors the D-C-2 decision
  // used by notebook-expand / outputs-duplicate).
  const startFromOtherDraft = (draft: WorkCanvasDraftSummary) => {
    const fromCanvasTemplate: StarterTemplate = {
      id: 'document',
      label: draft.title,
      title: draft.title,
      description: '',
      capability: 'real',
      capabilityNote: '',
      markdown: draft.contentMd || '',
    };
    setIsNewCanvasMenuOpen(false);
    selectTemplate(fromCanvasTemplate, {
      seedTeresa: true,
      teresaPrompt: t('canvas.panel.newMenu.seedFromCanvas', {
        defaultValue:
          'I started this new document from an existing canvas ("{{title}}"). Help me develop it further from here.',
        title: draft.title,
      }),
    });
  };

  // #87a — lazy-load the "Z canvasa" list the first time the "+" menu opens
  // (flag ON only; the legacy flag-OFF menu never touches this).
  React.useEffect(() => {
    if (!isNewCanvasMenuOpen || !isCanvasNewDocOptionsEnabled()) return;
    if (otherCanvasDraftsLoaded || isOtherCanvasDraftsLoading) return;
    void loadOtherCanvasDrafts();
  }, [
    isNewCanvasMenuOpen,
    otherCanvasDraftsLoaded,
    isOtherCanvasDraftsLoading,
    loadOtherCanvasDrafts,
    showDurableHandoffReceipt,
  ]);

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

  const runGovernedHandoff = async (
    draft: CanvasDocumentState,
    target: WorkCanvasTarget
  ): Promise<WorkCanvasConversionProposal> => {
    if (!draft.draftId) throw new Error('Canvas draft must be persisted before handoff.');
    const payload = {
      title: draft.title,
      source: 'active_chat_canvas',
      contentMd: draft.contentMd,
    };
    const signature = JSON.stringify([draft.draftId, target, payload]);
    const existingFlight = handoffFlightsRef.current.get(signature);
    if (existingFlight) return existingFlight;

    let key = handoffKeysRef.current.get(signature);
    if (!key) {
      key =
        globalThis.crypto?.randomUUID?.() ||
        `canvas-handoff-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      handoffKeysRef.current.set(signature, key);
    }

    const flight = (async () => {
      const proposed = await WorkCanvasApi.createProposal(draft.draftId!, target, payload, key!);
      const approved =
        proposed.data.status === 'approved'
          ? proposed.data
          : (await WorkCanvasApi.approveProposal(proposed.data.id)).data;
      if (approved.status !== 'approved' || !approved.targetObjectId) {
        throw new Error('Canvas handoff did not produce a durable owner receipt.');
      }
      handoffKeysRef.current.delete(signature);
      return approved;
    })();
    handoffFlightsRef.current.set(signature, flight);
    try {
      return await flight;
    } finally {
      handoffFlightsRef.current.delete(signature);
    }
  };

  /**
   * Canvas → Outputs handoff (P1-3): persist + export the draft as a durable
   * artifact, then route to the Outputs Library so the user sees it land.
   */
  const saveToOutputs = async () => {
    if (isSavingToOutputs) return;
    setIsSavingToOutputs(true);
    setStatusFeedback('Saving to Outputs Library…');
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) {
        setAlertFeedback('Save to Outputs is available after the draft is saved.');
        return;
      }
      const receipt = await runGovernedHandoff(draft, 'client_deliverable');
      showDurableHandoffReceipt(receipt);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to save Canvas to Outputs.');
    } finally {
      setIsSavingToOutputs(false);
    }
  };

  /**
   * L-2 — send the current Canvas (kind='table') to Table Studio. Creates
   * a real tp_tables entry with typed fields inferred from the markdown
   * table. Disabled for non-table drafts.
   */
  const [isSendingToTableStudio, setIsSendingToTableStudio] = React.useState(false);
  const sendToTableStudio = async () => {
    if (isSendingToTableStudio) return;
    setIsSendingToTableStudio(true);
    setStatusFeedback('Sending Canvas to Table Studio…');
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) {
        setAlertFeedback('Table Studio handoff is available once the draft is saved.');
        return;
      }
      const receipt = await runGovernedHandoff(draft, 'table');
      showDurableHandoffReceipt(receipt);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to send Canvas to Table Studio.');
    } finally {
      setIsSendingToTableStudio(false);
    }
  };

  /**
   * L-1 — send the current Canvas to DocumentStudio. Materializes a
   * DocumentStudio artifact via the intake → plan → generate pipeline, then
   * opens it in the documents module. The previous bridge was a manual
   * .docx download → manual re-upload.
   */
  const [isSendingToDocumentStudio, setIsSendingToDocumentStudio] = React.useState(false);
  const sendToDocumentStudio = async () => {
    if (isSendingToDocumentStudio) return;
    setIsSendingToDocumentStudio(true);
    setStatusFeedback('Sending Canvas to Document Studio…');
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) {
        setAlertFeedback('Document Studio handoff is available once the draft is saved.');
        return;
      }
      const receipt = await runGovernedHandoff(draft, 'client_deliverable');
      showDurableHandoffReceipt(receipt);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to send Canvas to Document Studio.');
    } finally {
      setIsSendingToDocumentStudio(false);
    }
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

  // #87c — Import Markdown, the counterpart to the existing "Download
  // Markdown" export. Canvas content is canonical Markdown text already
  // (contentMd), so import is just "read the file → replace contentMd" —
  // updateMarkdown is the same setter every other content-replacing path in
  // this panel uses (manual MD edits, AI stream completion, dataset-driven
  // rewrites), so rich/md/document view all pick it up consistently.
  const triggerMarkdownImport = () => {
    markdownImportInputRef.current?.click();
  };

  const handleImportMarkdownFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.md$/i.test(file.name)) {
      setAlertFeedback(t('canvas.panel.import.invalidFile', 'Choose a .md (Markdown) file.'));
      return;
    }
    const hasExistingContent = Boolean(
      (latestContentRef.current || documentState.contentMd || '').trim()
    );
    if (
      hasExistingContent &&
      typeof window !== 'undefined' &&
      !window.confirm(
        t('canvas.panel.import.confirmReplace', {
          defaultValue: 'Replace the current document content with "{{filename}}"?',
          filename: file.name,
        })
      )
    ) {
      return;
    }
    try {
      const text = await file.text();
      updateMarkdown(text);
      setStatusFeedback(
        t('canvas.panel.import.success', {
          defaultValue: 'Imported {{filename}}.',
          filename: file.name,
        })
      );
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to import Markdown file.');
    }
  };

  // ── Teresa streams into the document (chat-driven) ──────────────────
  // The hook owns the SSE → TipTap insertion; onComplete reconciles the
  // canonical markdown. The chat composer (UnifiedChatPanel) only dispatches a
  // 'canvas-stream-request' CustomEvent — no direct coupling — so this works
  // without threading the editor instance back through the chat tree.
  const { isStreaming, streamToCanvas, stopStream } = useCanvasAIStream({
    editor: richEditor,
    onComplete: (finalMd) => {
      // BUG N-1: a chat-driven append/replace MUST be flushed with the FRESH
      // content, not left to the debounced autosave which would capture a
      // pre-append snapshot (and re-send it on a 409, clobbering the new
      // section). updateMarkdown writes latestContentRef + state; then we
      // persist directly with the final markdown. We cancel the pending
      // debounce first so the same draft isn't double-saved with stale data.
      updateMarkdown(finalMd);
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      void persistDraft({
        ...documentState,
        title: latestTitleRef.current,
        contentMd: finalMd,
      });
    },
  });

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | {
            prompt?: string;
            mode?: 'append' | 'replace' | 'generate' | 'patch';
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
        // B3 — patch ops record per-anchor provenance under the draft id.
        provenanceScope: documentState.draftId ?? null,
      });
    };
    window.addEventListener('canvas-stream-request', handler);
    return () => window.removeEventListener('canvas-stream-request', handler);
  }, [richEditor, streamToCanvas, documentState.draftId]);

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
      setAlertFeedback(t('canvas.panel.templates.nameRequired', 'Provide a template name.'));
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
    target: 'idea' | 'note' | 'initiative' | 'decision' | 'task'
  ) => {
    setActiveActionId(actionId);
    setStatusFeedback(`Saving Canvas to ${target}...`);
    try {
      const draft = await ensurePersistedDraft();
      if (!draft?.draftId) throw new Error('Canvas draft could not be saved before handoff.');
      const receipt = await runGovernedHandoff(draft, target);
      showDurableHandoffReceipt(receipt);
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
      const share: CanvasShareInfo = {
        token: result.data.share.token,
        url: result.data.share.url,
        expiresAt: result.data.share.expiresAt,
      };
      const shareUrl = absoluteShareUrl(share);
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setShareInfo(share);
      setIsShareStripDismissed(false);
      await navigator.clipboard?.writeText(shareUrl);
      setStatusFeedback(`Share link ready and copied: ${shareUrl}`);
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to share Canvas draft.');
    } finally {
      setActiveActionId(null);
    }
  };

  const revokeShareAction = async () => {
    if (isRevokingShare) return;
    const draftId = documentState.draftId;
    if (!draftId) {
      setShareInfo(null);
      return;
    }
    setIsRevokingShare(true);
    setStatusFeedback(t('canvas.panel.share.revoking', 'Revoking share link...'));
    try {
      const result = await Api.workCanvasRevokeShare(draftId);
      setDocumentState((current) =>
        mapDraftResponseToCanvasDocumentState(result.data.draft, {
          ...current,
          saveState: 'saved',
        })
      );
      setShareInfo(null);
      setStatusFeedback(
        t('canvas.panel.share.revoked', 'Share revoked — the public link no longer works.')
      );
    } catch (error) {
      setCanvasErrorFeedback(error, 'Failed to revoke Canvas share link.');
    } finally {
      setIsRevokingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareInfo) return;
    const shareUrl = absoluteShareUrl(shareInfo);
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setStatusFeedback(`Share link copied: ${shareUrl}`);
    } catch {
      setAlertFeedback(`Copy failed — share link: ${shareUrl}`);
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

  // B1 — same fetch as loadVersions but for the toolbar popover, without
  // toggling the diagnostics-menu version list open.
  const openVersionHistory = async () => {
    setIsHistoryOpen(true);
    const draft = await ensurePersistedDraft();
    if (!draft?.draftId) return;
    setIsVersionsLoading(true);
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
            ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300'
            : isDirtySaveAction
              ? 'text-danger-500 hover:bg-danger-500/10 hover:text-danger-600 dark:text-danger-400 dark:hover:bg-danger-500/15 dark:hover:text-danger-300'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
        }`}
        data-action-status={isLoading ? 'loading' : availability.status}
        data-save-state={actionId === 'save' ? documentState.saveState : undefined}
      >
        {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Icon size={15} />}
        {availability.status === 'coming_soon' ? (
          <span className="sr-only">{t('canvas.panel.comingSoon', 'Coming soon')}</span>
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
        {t('canvas.panel.selection.turnSelectionIntoBlock', 'Turn selection into a block')}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('table')}
        >
          {t('canvas.panel.selection.createTable', 'Create table')}
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('chart')}
        >
          {t('canvas.panel.selection.createChart', 'Create chart')}
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('diagram')}
        >
          {t('canvas.panel.selection.createDiagram', 'Create diagram')}
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('research')}
        >
          {t('canvas.panel.selection.createResearch', 'Create research')}
        </button>
        <button
          type="button"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200"
          onClick={() => createArtifactBlockFromSelection('decision')}
        >
          {t('canvas.panel.selection.createDecision', 'Create decision')}
        </button>
      </div>
      <div
        className="mt-3 rounded-2xl border border-primary-200/70 bg-white/80 p-3 dark:border-primary-300/20 dark:bg-white/[0.04]"
        data-testid="canvas-selection-edit-panel"
      >
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200">
          {t('canvas.panel.selection.editSelectedText', 'Edit selected text')}
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
            {t('canvas.panel.selection.useSelection', 'Use selection')}
          </button>
          <button
            type="button"
            onClick={() => applySelectionEditShortcut('action_list')}
            className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-200 dark:bg-primary-300/10 dark:text-primary-100 dark:hover:bg-primary-300/20"
          >
            {t('canvas.panel.selection.actionList', 'Action list')}
          </button>
          <button
            type="button"
            onClick={() => applySelectionEditShortcut('bullet_summary')}
            className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-200 dark:bg-primary-300/10 dark:text-primary-100 dark:hover:bg-primary-300/20"
          >
            {t('canvas.panel.selection.bulletSummary', 'Bullet summary')}
          </button>
        </div>
        <textarea
          value={selectionEditDraft}
          onChange={(event) => setSelectionEditDraft(event.target.value)}
          aria-label={t(
            'canvas.panel.selection.editReplacementLabel',
            'Selection edit replacement'
          )}
          placeholder={t(
            'canvas.panel.selection.editReplacementPlaceholder',
            'Write the replacement Markdown here...'
          )}
          className="mt-3 min-h-24 w-full resize-y rounded-2xl border border-primary-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-primary-400 dark:border-primary-300/20 dark:bg-navy-950 dark:text-slate-100"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void previewSelectionEdit()}
            disabled={!selectionEditDraft.trim()}
            className={
              selectionEditDraft.trim()
                ? 'rounded-full bg-c-text px-3 py-1.5 text-xs font-semibold text-c-bg shadow-sm hover:bg-c-text-secondary'
                : 'cursor-not-allowed rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
            }
          >
            {t('canvas.panel.selection.previewEdit', 'Preview edit')}
          </button>
          <button
            type="button"
            onClick={() => setSelectionEditDraft('')}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-300/10"
          >
            {t('canvas.panel.selection.clear', 'Clear')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-slate-50 text-slate-950 dark:bg-navy-950 dark:text-slate-100">
      <div className="flex min-h-[42px] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200/70 bg-white/70 px-4 py-1 backdrop-blur dark:border-white/[0.06] dark:bg-navy-950/60">
        {/* #17 (rewizja 07-12): "z canvasu musi być łatwy powrót do TEJ
            KONKRETNEJ notatki [nie tylko do listy]" — persistent breadcrumb,
            visible for the whole time this note-derived draft is open (not a
            one-time toast). Reuses the existing /my-work/notebook/<pageId>
            deep-link contract (MyWorkHub `parseMyWorkPathIntent` + NotebookContent
            `openPageId`) already used by the canvas save-as-note handoff. */}
        {expandSourceNote ? (
          <button
            type="button"
            onClick={() => navigate(`/my-work/notebook/${encodeURIComponent(expandSourceNote.id)}`)}
            data-testid="canvas-back-to-source-note"
            title={
              expandSourceNote.title
                ? t('canvas.panel.source.backToNoteTitled', 'Back to note "{{title}}"', {
                    title: expandSourceNote.title,
                  })
                : t('canvas.panel.source.backToNote', 'Back to source note')
            }
            className="inline-flex h-8 shrink-0 max-w-[180px] items-center gap-1 rounded-full border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronLeft size={13} className="shrink-0" />
            <StickyNote size={12} className="shrink-0 opacity-70" />
            <span className="truncate">
              {expandSourceNote.title || t('canvas.panel.source.note', 'Source: note')}
            </span>
          </button>
        ) : null}
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
            className="w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-semibold text-slate-950 outline-none transition-colors hover:border-slate-200 hover:bg-white/60 focus:border-slate-300 focus:bg-white dark:text-white dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:focus:border-white/20 dark:focus:bg-white/[0.06]"
          />
          {/* Save status lived only inside the diagnostics popover, so the
              document never showed whether it was saved. Announced politely so
              it is not silent for screen-reader users either. */}
          <div
            className="mt-0.5 flex items-center gap-1.5 px-1 text-[11px] text-c-text-muted"
            data-testid="canvas-save-status"
            role="status"
            aria-live="polite"
          >
            <span
              className={
                documentState.saveState === 'failed' || documentState.saveState === 'conflict'
                  ? 'text-c-text'
                  : undefined
              }
            >
              {saveStateLabel(documentState.saveState, t)}
            </span>
            {documentState.saveState === 'saved' && lastSavedAtLabel ? (
              <span data-testid="canvas-last-saved-at">
                {t('canvas.panel.saveState.at', 'at')} {lastSavedAtLabel}
              </span>
            ) : null}
          </div>
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
              aria-label={t('canvas.panel.newCanvas', 'New Canvas')}
              aria-expanded={isNewCanvasMenuOpen}
              title={t('canvas.panel.newCanvas', 'New Canvas')}
            >
              <Plus size={15} />
            </button>
            {isNewCanvasMenuOpen && isCanvasNewDocOptionsEnabled() ? (
              // #87a — 3 explicit start options: Czysty / Z szablonu / Z canvasa.
              <div
                data-testid="canvas-new-menu-v2"
                className="absolute left-0 z-20 mt-2 w-[300px] rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800"
              >
                {/* (a) Czysty — blank, on top, no preset (#87 doctrine). */}
                <button
                  type="button"
                  data-testid="canvas-new-menu-blank"
                  onClick={() => {
                    setIsNewCanvasMenuOpen(false);
                    startBlankDocument();
                  }}
                  className="w-full rounded-xl px-2.5 py-2 text-left text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <span className="font-semibold">
                    {t('canvas.panel.newMenu.blank', 'Czysty dokument')}
                  </span>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {t('canvas.panel.newMenu.blankDesc', 'Puste — zaczynasz od zera z Teresą.')}
                  </div>
                </button>

                <div className="my-1.5 border-t border-slate-100 dark:border-white/[0.06]" />

                {/* (b) Z szablonu — existing starterTemplates gallery, unchanged content. */}
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {t('canvas.panel.newMenu.fromTemplate', 'Z szablonu')}
                </div>
                <div className="mt-1 space-y-1">
                  {starterTemplates.map((template) => (
                    <button
                      key={`header-template-${template.id}`}
                      type="button"
                      onClick={() => {
                        setIsNewCanvasMenuOpen(false);
                        selectTemplate(template, {
                          seedTeresa: true,
                          teresaPrompt: t('canvas.panel.newMenu.seedFromTemplate', {
                            defaultValue:
                              'I started a new document "{{title}}" from a template. Help me develop it — suggest what to fill in first.',
                            title: template.title,
                          }),
                        });
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

                <div className="my-1.5 border-t border-slate-100 dark:border-white/[0.06]" />

                {/* (c) Z canvasa — pick one of the user's other Work Canvas drafts. */}
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {t('canvas.panel.newMenu.fromCanvas', 'Z canvasa')}
                </div>
                <div className="mt-1 max-h-[180px] space-y-1 overflow-y-auto">
                  {isOtherCanvasDraftsLoading ? (
                    <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.newMenu.fromCanvasLoading', 'Loading your canvases…')}
                    </div>
                  ) : otherCanvasDraftsError ? (
                    <div className="px-2.5 py-2 text-[11px] text-danger-600 dark:text-danger-300">
                      {otherCanvasDraftsError}
                    </div>
                  ) : otherCanvasDrafts.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.newMenu.fromCanvasEmpty', 'No other canvases yet.')}
                    </div>
                  ) : (
                    otherCanvasDrafts.map((draft) => (
                      <button
                        key={`header-from-canvas-${draft.id}`}
                        type="button"
                        data-testid="canvas-new-menu-from-canvas-item"
                        onClick={() => startFromOtherDraft(draft)}
                        className="w-full truncate rounded-xl px-2.5 py-2 text-left text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <span className="truncate font-semibold">{draft.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : isNewCanvasMenuOpen ? (
              <div className="absolute left-0 z-20 mt-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800">
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

          {/* Workspace destinations: create a platform entity from the Canvas
              content. Keep the concrete actions, but name the group after the
              user-visible outcome rather than the unexplained internal term
              "Promote" (CHAT-OWN-005). */}
          <div
            className="flex items-center gap-2 rounded-full border border-slate-200 px-2 py-0.5 dark:border-white/10"
            data-testid="canvas-workspace-destinations"
            title="Create a workspace item from this Canvas"
          >
            <span className="select-none px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Create in workspace
            </span>
            <div className="flex items-center gap-1" data-testid="canvas-workspace-actions">
              {menuWorkspaceActionIds.map((actionId) => renderCommandButton(actionId))}
            </div>
          </div>

          <div className={toolbarGroupClass} data-testid="canvas-file-actions">
            {renderCommandButton('copy')}
            {renderCommandButton('share')}
            {renderCommandButton('save')}
            {renderCommandButton('close')}
          </div>

          {/* B1 — version history popover anchor. #87c (rewizja 07-13): the
              always-visible top-level "Historia" icon was decluttering
              feedback — trigger moved into the "⋯" kebab (Manual editing
              section, canvas-history-menu-item) which calls the same
              openVersionHistory()/isHistoryOpen pair. The wrapper + popover
              stay HERE (not nested inside the kebab's scrollable dropdown)
              so CanvasVersionHistory's own `absolute right-0` positioning is
              unaffected — nesting it inside canvas-diagnostics-menu's
              `overflow-auto` would risk clipping the 400px popover. */}
          <div className="relative" data-testid="canvas-history-root">
            {isHistoryOpen ? (
              <CanvasVersionHistory
                versions={versions}
                isLoading={isVersionsLoading}
                onClose={() => setIsHistoryOpen(false)}
                onRestore={async (version) => {
                  await restoreVersion(version);
                }}
              />
            ) : null}
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

          {/* #87c — Import Markdown. Separate input from uploadInputRef so the
              accept filter stays scoped to .md and doesn't get swept into the
              CSV/JSON/XLSX dataset branch of handleUploadFiles. */}
          <input
            ref={markdownImportInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            aria-hidden="true"
            data-testid="canvas-import-markdown-input"
            onChange={(event) => {
              void handleImportMarkdownFile(event.target.files);
              event.target.value = '';
            }}
          />

          {pendingDataset ? (
            <div
              className="absolute right-5 top-16 z-10 w-80 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800"
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
              aria-label={t('canvas.panel.menuAria', 'Canvas menu')}
              aria-expanded={isDiagnosticsOpen}
              title={t('canvas.panel.menuAria', 'Canvas menu')}
            >
              <MoreHorizontal size={15} />
            </button>
            {isDiagnosticsOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 max-h-[80vh] w-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800"
                data-testid="canvas-diagnostics-menu"
              >
                {/* #87d — grupa WIDOK (zwijalna). Restrukturyzacja mega-kebaba:
                    14 sekcji → 8 nazwanych grup-akordeonów, żeby użytkownik nie
                    skrolował ściany. Zero utraty funkcji — każda pozycja została,
                    tylko pogrupowana. */}
                <details
                  className="group space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10"
                  open
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.groups.view', 'Widok')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div
                    className="mx-2.5 mt-1 inline-flex rounded-full bg-slate-100 p-1 dark:bg-white/10"
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
                </details>

                <details className="group mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.common.title', 'Most common actions')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  {[
                    {
                      title: t('canvas.panel.common.expandTitle', 'Expand selected idea'),
                      detail: t(
                        'canvas.panel.common.expandDetail',
                        'Use AI to expand the currently selected fragment into more complete text.'
                      ),
                      actionLabel: t('canvas.panel.common.expandAction', 'Expand'),
                      onClick: () => applySelectionMenuAction('expand'),
                      disabled: !canvasSelection?.selectedText?.trim(),
                    },
                    {
                      title: t(
                        'canvas.panel.common.rewriteTitle',
                        'Shorten or rewrite the selection'
                      ),
                      detail: t(
                        'canvas.panel.common.rewriteDetail',
                        'Quickly shorten, rewrite, or adjust the tone of the chosen fragment without rewriting by hand.'
                      ),
                      actionLabel: t('canvas.panel.common.rewriteAction', 'Rewrite'),
                      onClick: () => applySelectionMenuAction('rewrite'),
                      disabled: !canvasSelection?.selectedText?.trim(),
                    },
                    {
                      title: t('canvas.panel.common.addTitle', 'Add a new element to the canvas'),
                      detail: t(
                        'canvas.panel.common.addDetail',
                        'Choose an element type and describe to Teresa what to add to the document.'
                      ),
                      actionLabel: t('canvas.panel.common.addAction', 'Add element'),
                      onClick: () => setQuickAddElement('text'),
                    },
                    {
                      title: t(
                        'canvas.panel.hints.templateTitle',
                        'Build a template for a specific goal'
                      ),
                      detail: t(
                        'canvas.panel.hints.templateDetail',
                        'Create your own work template with a name, goal, and sections tailored to the task.'
                      ),
                      actionLabel: t('canvas.panel.hints.templateAction', 'New template'),
                      onClick: () => setIsTemplateBuilderOpen((open) => !open),
                    },
                    {
                      title: t('canvas.panel.hints.viewTitle', 'Switch Rich/Dock/MD view'),
                      detail: t(
                        'canvas.panel.hints.viewDetail',
                        'Rich = editor with toolbar, Dock = preview, MD = raw markdown.'
                      ),
                      actionLabel: mode === 'rich' ? 'Dock' : mode === 'document' ? 'MD' : 'Rich',
                      onClick: () =>
                        setMode(mode === 'rich' ? 'document' : mode === 'document' ? 'md' : 'rich'),
                    },
                    {
                      title: t('canvas.panel.hints.saveTitle', 'Save and export the draft'),
                      detail: t(
                        'canvas.panel.hints.saveDetail',
                        'Save changes and download the document as Markdown or CSV for further work.'
                      ),
                      actionLabel:
                        documentState.saveState === 'unsaved'
                          ? t('canvas.panel.hints.saveActionSave', 'Save')
                          : t('canvas.panel.hints.saveActionDownload', 'Download MD'),
                      onClick:
                        documentState.saveState === 'unsaved'
                          ? () => void persistDraft()
                          : () => void exportDocument('markdown'),
                    },
                    {
                      title: t('canvas.panel.hints.dataTitle', 'Work on data from a file'),
                      detail: t(
                        'canvas.panel.hints.dataDetail',
                        'Upload CSV/JSON/XLSX and generate tables, charts, or reports in the same canvas.'
                      ),
                      actionLabel: pendingDataset
                        ? t('canvas.panel.hints.dataActionUse', 'Use dataset')
                        : t('canvas.panel.hints.dataActionUpload', 'Upload file'),
                      onClick: pendingDataset
                        ? () => setQuickAddElement('table')
                        : triggerDatasetUpload,
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
                            ? 'mt-2 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
                            : 'mt-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20'
                        }
                      >
                        {hint.actionLabel}
                      </button>
                    </div>
                  ))}
                </details>

                <details className="group mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.addElement.title', 'Add element')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="mt-1 grid grid-cols-3 gap-1.5 px-2.5">
                    {(
                      [
                        ['text', t('canvas.panel.addElement.text', 'Text')],
                        ['heading', t('canvas.panel.addElement.heading', 'Heading')],
                        ['table', t('canvas.panel.addElement.table', 'Table')],
                        ['diagram', t('canvas.panel.addElement.diagram', 'Diagram')],
                        ['list', t('canvas.panel.addElement.list', 'List')],
                        ['summary', t('canvas.panel.addElement.summary', 'Summary')],
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
                      placeholder={t(
                        'canvas.panel.addElement.promptPlaceholder',
                        'Describe to Teresa what to add...'
                      )}
                      aria-label="Element instruction for Teresa"
                      className="min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white p-2.5 text-xs leading-5 text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={insertQuickAddElement}
                      className="mt-2 w-full rounded-xl bg-c-text px-3 py-2 text-xs font-semibold text-c-bg hover:bg-c-text-secondary"
                    >
                      {t('canvas.panel.addElement.submit', 'Add to canvas')}
                    </button>
                  </div>
                </details>

                {/* #87d — grupa EDYCJA I AI: łączy „AI on selection" + „Manual editing". */}
                <details className="group mt-3 border-b border-slate-200 dark:border-white/10" open>
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.groups.edit', 'Edycja i AI')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>

                  <div className="mt-1 space-y-1.5 pb-3">
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.selection.title', 'AI on selection')}
                    </div>
                    <div className="px-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {canvasSelection?.selectedText?.trim()
                        ? `${t('canvas.panel.selection.selected', 'Selection')}: ${canvasSelection.selectedText.slice(0, 120)}${canvasSelection.selectedText.length > 120 ? '…' : ''}`
                        : t(
                            'canvas.panel.selection.empty',
                            'Select a fragment of text to use AI actions.'
                          )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 px-2.5">
                      <button
                        type="button"
                        onClick={() => applySelectionMenuAction('expand')}
                        className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                      >
                        {t('canvas.panel.selection.expand', 'Expand idea')}
                      </button>
                      <button
                        type="button"
                        onClick={() => applySelectionMenuAction('shorten')}
                        className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                      >
                        {t('canvas.panel.selection.shorten', 'Shorten')}
                      </button>
                      <button
                        type="button"
                        onClick={() => applySelectionMenuAction('rewrite')}
                        className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                      >
                        {t('canvas.panel.selection.rewrite', 'Rewrite')}
                      </button>
                      <button
                        type="button"
                        onClick={() => applySelectionMenuAction('suggest')}
                        className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                      >
                        {t('canvas.panel.selection.suggest', 'Suggest')}
                      </button>
                    </div>
                    <div className="px-2.5">
                      <textarea
                        value={selectionAiPrompt}
                        onChange={(event) => setSelectionAiPrompt(event.target.value)}
                        aria-label="Selection AI instruction"
                        placeholder={t(
                          'canvas.panel.selection.promptPlaceholder',
                          'Instruction for Teresa on the selected fragment...'
                        )}
                        className="min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white p-2.5 text-xs leading-5 text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void previewSelectionMenuPrompt()}
                          className="flex-1 rounded-xl bg-c-text px-3 py-2 text-xs font-semibold text-c-bg hover:bg-c-text-secondary"
                        >
                          {t('canvas.panel.selection.preview', 'Preview AI edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectionAiPrompt('')}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                          {t('canvas.panel.selection.clear', 'Clear')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.manualEdit.title', 'Manual editing')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode('md')}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <span>
                        {t('canvas.panel.manualEdit.editMarkdown', 'Edit Markdown manually')}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">MD</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('document')}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <span>
                        {t('canvas.panel.manualEdit.backToDocument', 'Back to document view')}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Dock</span>
                    </button>
                    {/* #87c (rewizja 07-13) — "Historia" moved here from the
                      always-visible main bar (decluttering ask). Same
                      openVersionHistory()/isHistoryOpen pair as before; the
                      popover still renders from canvas-history-root above
                      (kept out of this scrollable dropdown to avoid clipping
                      the 400px-wide CanvasVersionHistory panel). */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDiagnosticsOpen(false);
                        void openVersionHistory();
                      }}
                      data-testid="canvas-history-menu-item"
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <History size={14} />
                      <span>{t('canvas.versionHistory.title', 'Version history')}</span>
                    </button>
                  </div>
                </details>

                <details className="group mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.templates.title', 'Starter templates')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="mt-1 flex items-center justify-end gap-2 px-2.5 pb-1">
                    <button
                      type="button"
                      onClick={() => setIsTemplateBuilderOpen((open) => !open)}
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      + {t('canvas.panel.templates.new', 'New template')}
                    </button>
                  </div>
                  {isTemplateBuilderOpen ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                      <input
                        value={templateBuilderName}
                        onChange={(event) => setTemplateBuilderName(event.target.value)}
                        placeholder={t('canvas.panel.templates.namePlaceholder', 'Template name')}
                        aria-label="Template name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <input
                        value={templateBuilderGoal}
                        onChange={(event) => setTemplateBuilderGoal(event.target.value)}
                        placeholder={t(
                          'canvas.panel.templates.goalPlaceholder',
                          'Template goal in one sentence'
                        )}
                        aria-label="Template goal"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <input
                        value={templateBuilderSections}
                        onChange={(event) => setTemplateBuilderSections(event.target.value)}
                        placeholder={t(
                          'canvas.panel.templates.sectionsPlaceholder',
                          'Sections (comma-separated)'
                        )}
                        aria-label="Template sections"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-white/15 dark:bg-navy-950 dark:text-slate-100"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={applyBuiltTemplate}
                          className="flex-1 rounded-lg bg-c-text px-2.5 py-1.5 text-xs font-semibold text-c-bg hover:bg-c-text-secondary"
                        >
                          {t('canvas.panel.templates.apply', 'Apply template')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsTemplateBuilderOpen(false)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          {t('canvas.panel.templates.close', 'Close')}
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
                </details>

                {/* #87d — grupa PLIK, EKSPORT I WORKSPACE: Workspace actions +
                    provenance + dataset + Markdown/eksporty (Word/Excel/PPTX/PDF/Studia). */}
                <details className="group mt-3 border-b border-slate-200 dark:border-white/10">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.groups.file', 'Plik, eksport i workspace')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>

                  <div className="mt-1 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.workspaceActions.title', 'Workspace actions')}
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

                  {/* C4 — provenance loop closure: append-only ledger of entities
                    materialized from this draft (provenance.materializedTo[],
                    written by both backend writers). */}
                  {(documentState.materializedTo?.length || 0) > 0 ? (
                    <div
                      className="mt-3 space-y-1 border-b border-slate-200 pb-3 dark:border-white/10"
                      data-testid="canvas-materialized-to"
                    >
                      <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Utworzone z tego dokumentu
                      </div>
                      {(documentState.materializedTo || []).map((entry, index) => {
                        const EntryIcon = materializedTargetIcons[entry.target] || FileText;
                        return (
                          <div
                            key={`${entry.entityId}-${index}`}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <span className="shrink-0 text-slate-400 dark:text-slate-500">
                              <EntryIcon size={13} />
                            </span>
                            <span className="min-w-0 flex-1 truncate" title={entry.title}>
                              {entry.title}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {materializedTargetLabel(entry.target, t)}
                            </span>
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 font-medium text-sky-600 hover:underline dark:text-sky-400"
                            >
                              Otwórz
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

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
                          {t('canvas.panel.dismiss', 'Dismiss')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.markdownActions', 'Markdown actions')}
                    </div>
                    {/* #87c — Import Markdown, the missing counterpart to the
                      "Download Markdown" export below. Placed first so the
                      in/out pair reads top-to-bottom. */}
                    <button
                      type="button"
                      onClick={triggerMarkdownImport}
                      data-testid="canvas-import-markdown"
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Upload size={14} />
                      <span>
                        {t('canvas.panel.import.uploadMarkdown', 'Import Markdown (.md)')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void persistDraft()}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Save size={14} />
                      <span>{t('canvas.panel.export.saveMarkdown', 'Save Markdown')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveToOutputs()}
                      disabled={isSavingToOutputs}
                      data-testid="canvas-save-to-outputs"
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-semibold text-crimson-700 transition-colors hover:bg-crimson-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-crimson-300 dark:hover:bg-crimson-900/20"
                    >
                      <FolderInput size={14} />
                      <span>
                        {isSavingToOutputs
                          ? t('canvas.panel.export.saving', 'Saving…')
                          : t('canvas.panel.export.saveToOutputs', 'Save to Outputs')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportDocument('markdown')}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Download size={14} />
                      <span>{t('canvas.panel.export.downloadMarkdown', 'Download Markdown')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportDocument('csv')}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Table2 size={14} />
                      <span>{t('canvas.panel.downloadCsv', 'Download CSV')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyMarkdown()}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Copy size={14} />
                      <span>{t('canvas.panel.copyMarkdown', 'Copy Markdown')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportDocument('pdf')}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Download size={14} />
                      <span>{t('canvas.panel.downloadPdf', 'Download PDF')}</span>
                    </button>
                    {/* L-1 — Document Studio bridge. Calls the same
                      materializeDocumentArtifact pipeline DocumentStudio's own
                      /generate uses, so the Canvas becomes a real Document
                      Studio artifact (visible in Outputs hub) rather than a
                      file the user had to manually re-upload. */}
                    <button
                      type="button"
                      onClick={() => void sendToDocumentStudio()}
                      disabled={isSendingToDocumentStudio}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Sparkles size={14} />
                      <span>
                        {isSendingToDocumentStudio
                          ? t('canvas.panel.sendingToDocumentStudio', 'Sending to Document Studio…')
                          : t('canvas.panel.sendToDocumentStudio', 'Send to Document Studio')}
                      </span>
                    </button>
                    {/* L-2 — Table Studio bridge. Disabled for non-table drafts
                      (narrative drafts have no column schema; naïve inference
                      would land all-text Tables — the audit's L-2 rationale). */}
                    <button
                      type="button"
                      onClick={() => void sendToTableStudio()}
                      disabled={isSendingToTableStudio || documentState.kind !== 'table'}
                      title={
                        documentState.kind === 'table'
                          ? t(
                              'canvas.panel.sendToTableStudioTitle',
                              'Send the current table to Table Studio'
                            )
                          : t(
                              'canvas.panel.sendToTableStudioDisabledTitle',
                              'Table Studio handoff requires a Canvas with kind=table.'
                            )
                      }
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Table2 size={14} />
                      <span>
                        {isSendingToTableStudio
                          ? t('canvas.panel.sendingToTableStudio', 'Sending to Table Studio…')
                          : t('canvas.panel.sendToTableStudio', 'Send to Table Studio')}
                      </span>
                    </button>
                    {/* C4.4 — exposes the existing backend exporters (exportDocxBuffer
                      / exportXlsxBuffer / exportPptxBuffer) for Word/Excel/PowerPoint.
                      Bridges Canvas to the Office-document side of the platform
                      without adding new backend code. */}
                    <button
                      type="button"
                      onClick={() => void exportDocument('docx')}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Download size={14} />
                      <span>{t('canvas.panel.export.downloadWord', 'Download Word (.docx)')}</span>
                    </button>
                    {/* M-4 — XLSX only makes sense when the Canvas has a typed table
                      (kind='table'); for narrative drafts the spreadsheet would
                      be a single-cell dump. Button is rendered but disabled with
                      a tooltip so users see the affordance + the constraint. */}
                    <button
                      type="button"
                      onClick={() => void exportDocument('xlsx')}
                      disabled={documentState.kind !== 'table'}
                      title={
                        documentState.kind === 'table'
                          ? t('canvas.panel.downloadExcelTitle', 'Download as Excel spreadsheet')
                          : t(
                              'canvas.panel.downloadExcelDisabledTitle',
                              'Excel export is available only for Canvas tables (kind=table).'
                            )
                      }
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-white/10 dark:disabled:hover:bg-transparent"
                    >
                      <Download size={14} />
                      <span>{t('canvas.panel.downloadExcel', 'Download Excel (.xlsx)')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportDocument('pptx')}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Download size={14} />
                      <span>
                        {t('canvas.panel.downloadPowerpoint', 'Download PowerPoint (.pptx)')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportDocument('json')}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Download size={14} />
                      <span>{t('canvas.panel.exportMetadata', 'Export metadata')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={triggerDatasetUpload}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <Download size={14} />
                      <span>{t('canvas.panel.uploadDataset', 'Upload dataset')}</span>
                    </button>
                  </div>
                </details>

                {/* #87d — grupa DIAGNOSTYKA I WORKFLOW: MD file properties +
                    Capabilities/workflow + ledger. */}
                <details className="group mt-3 border-b border-slate-200 pb-1 dark:border-white/10">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.groups.diagnostics', 'Diagnostyka i workflow')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
                  </summary>

                  <div className="mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsMdPropertiesOpen((open) => !open)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                      aria-expanded={isMdPropertiesOpen}
                    >
                      <span className="font-medium">
                        {t('canvas.panel.mdProps.title', 'MD file properties')}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isMdPropertiesOpen
                          ? t('canvas.panel.mdProps.hide', 'Hide')
                          : t('canvas.panel.mdProps.show', 'Show')}
                      </span>
                    </button>
                    {isMdPropertiesOpen ? (
                      <div className="mt-2 space-y-2 rounded-xl bg-slate-100/80 p-2.5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('canvas.panel.diagnostics.format', 'Format')}</span>
                          <strong className="font-semibold">
                            {t('canvas.panel.diagnostics.markdownCanonical', 'Markdown canonical')}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('canvas.panel.diagnostics.save', 'Save')}</span>
                          <strong
                            className="font-semibold"
                            data-testid="canvas-diagnostics-save-state"
                          >
                            {saveStateLabel(documentState.saveState, t)}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('canvas.panel.diagnostics.projection', 'Projection')}</span>
                          <strong className="font-semibold" data-testid="canvas-projection-status">
                            {isProjectionRefreshing
                              ? t('canvas.panel.projection.refreshing', 'Projection refreshing')
                              : projectionLabel(documentState.markdownProjectionStatus, t)}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('canvas.panel.diagnostics.lifecycle', 'Lifecycle')}</span>
                          <strong className="font-semibold">
                            {lifecycleLabel(documentState.lifecycleState, t)}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t('canvas.panel.diagnostics.action', 'Action')}</span>
                          <strong
                            className="font-semibold"
                            data-testid="canvas-diagnostics-action-state"
                          >
                            {activeActionId
                              ? t('canvas.panel.diagnostics.running', 'Running')
                              : t('canvas.panel.diagnostics.idle', 'Idle')}
                          </strong>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-slate-600 dark:border-white/10 dark:text-slate-300">
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t('canvas.panel.capabilities.title', 'Capabilities and workflow')}
                    </div>
                    <div className="flex items-start justify-between gap-3 px-2.5">
                      <span>{t('canvas.panel.diagnostics.capability', 'Capability')}</span>
                      <div className="min-w-0 text-right">
                        {renderCapabilityBadge(
                          activeTemplate.capability,
                          'canvas-capability-status'
                        )}
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
                        <span>
                          {t('canvas.panel.diagnostics.researchSession', 'ResearchSession')}
                        </span>
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
                        <span className="sr-only">
                          {t('canvas.panel.workflowTemplate', 'Workflow template')}
                        </span>
                        <select
                          value={selectedWorkflowTemplate}
                          onChange={(event) =>
                            setSelectedWorkflowTemplate(
                              event.target.value as CanvasWorkflowTemplate
                            )
                          }
                          aria-label={t('canvas.panel.workflowTemplate', 'Workflow template')}
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
                            ? 'inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
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
                              ? 'inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
                              : 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100'
                          }
                        >
                          {isFinalizingResearchReport
                            ? 'Finalizing...'
                            : 'Finalize research report'}
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
                          const terminalExecutionLabel =
                            getWorkflowTerminalExecutionLabel(workflow);
                          const isWorkflowStepRunning = Boolean(
                            runningWorkflowStepById[workflow.id]
                          );
                          const isWorkflowResuming = Boolean(resumingWorkflowById[workflow.id]);
                          const isWorkflowReviewUpdating = Boolean(
                            updatingWorkflowReviewById[workflow.id]
                          );
                          const isWorkflowCommentAdding = Boolean(
                            addingWorkflowCommentById[workflow.id]
                          );
                          const workflowCommentBody = (
                            workflowCommentById[workflow.id] || ''
                          ).trim();
                          const isWorkflowCommentBlocked =
                            isWorkflowCommentAdding || workflowCommentBody.length === 0;
                          const isSendToReviewBlocked =
                            isWorkflowReviewUpdating || workflowLifecycle === 'in_review';
                          const isMarkApprovedBlocked =
                            isWorkflowReviewUpdating || workflowLifecycle === 'approved';
                          const executionBlocked =
                            reviewBlocked ||
                            Boolean(terminalExecutionLabel) ||
                            isWorkflowStepRunning;
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
                                    Reviewer: {workflow.collaboration?.reviewerId || 'not assigned'}{' '}
                                    · Lifecycle: {workflow.collaboration?.lifecycle || 'draft'}
                                  </div>
                                  {pendingApproval ? (
                                    <div className="mt-1 font-semibold text-primary-700 dark:text-primary-200">
                                      Approval checkpoint: {pendingApproval.stepTitle} awaits
                                      explicit approval.
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
                                        ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
                                        : 'rounded-full bg-c-text px-2 py-0.5 font-semibold text-c-bg hover:bg-c-text-secondary'
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
                                        ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
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
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500">
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
                                        ? 'min-w-[160px] cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] text-slate-600 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-500'
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
                                        ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
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
                                        ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
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
                                        ? 'min-w-[220px] flex-1 cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] text-slate-600 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-500'
                                        : 'min-w-[220px] flex-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-slate-100'
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void addWorkflowComment(workflow.id)}
                                    disabled={isWorkflowCommentBlocked}
                                    className={
                                      isWorkflowCommentBlocked
                                        ? 'cursor-not-allowed rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-500'
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
                </details>

                <details className="group mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
                  <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                    <span>{t('canvas.panel.groups.advanced', 'Zaawansowane')}</span>
                    <ChevronDown
                      size={14}
                      className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    />
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
                    {/* #87d — dawny przycisk otwierał DRUGI, prymitywny podgląd
                        wersji (usunięty jako duplikat). Teraz kieruje do JEDYNEGO
                        kanonicznego CanvasVersionHistory (popover) — który też
                        ładuje wersje, więc „Show changes" nadal działa. */}
                    <button
                      type="button"
                      onClick={() => void openVersionHistory()}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                    >
                      <History size={12} />
                      Version history
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

                {/* #87d — USUNIĘTO prymitywny, drugi podgląd wersji (stepper +
                    lista Restore). Był duplikatem CanvasVersionHistory (popover,
                    renderowany z canvas-history-root). Jedyny podgląd wersji =
                    „Version history" w grupie „Edycja i AI" oraz w „Zaawansowane". */}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {canvasConflict ? (
        <div
          data-testid="canvas-conflict-banner"
          role="alertdialog"
          aria-label={t('canvas.panel.conflict.title', 'This document changed elsewhere')}
          /* DEFECT-3: the banner used to be absolutely positioned at
             top-[42px], overlaying the top of the editor toolbar. It is now a
             normal sibling in the panel's column flow (directly after the
             fixed 42px header row), so it pushes content down and the whole
             toolbar stays visible while the conflict is open. */
          className="shrink-0 border-b border-c-border bg-c-surface-raised px-4 py-2.5 text-[11px] text-c-text shadow-sm"
        >
          <p>
            {t(
              'canvas.panel.conflict.body',
              'Someone else saved this document while you were editing. Nothing was overwritten — choose how to continue.'
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="canvas-conflict-keep-mine"
              onClick={() => void resolveConflictKeepMine()}
              className="rounded-md border border-c-border px-2 py-1 text-c-text hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('canvas.panel.conflict.keepMine', 'Save mine as a new version')}
            </button>
            <button
              type="button"
              data-testid="canvas-conflict-load-theirs"
              onClick={() => resolveConflictLoadTheirs()}
              className="rounded-md border border-c-border px-2 py-1 text-c-text hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('canvas.panel.conflict.loadTheirs', 'Discard mine, load theirs')}
            </button>
          </div>
        </div>
      ) : null}

      {actionFeedback ? (
        <div
          className="shrink-0 border-b border-slate-200/70 bg-white/60 px-4 py-2 text-xs text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-300"
          role={actionFeedbackTone}
          data-testid="canvas-action-feedback"
        >
          {/* C4 — [Otwórz/Open →](path) deep-links render as clickable anchors. */}
          {renderFeedbackWithLinks(actionFeedback)}
        </div>
      ) : null}

      {shareInfo && !isShareStripDismissed ? (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/70 bg-white/60 px-4 py-2 text-xs text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-300"
          data-testid="canvas-share-strip"
        >
          <Share2 size={12} className="shrink-0 text-slate-400" />
          <span className="font-semibold">
            {t('canvas.panel.share.publicLink', 'Public link')}:
          </span>
          <a
            href={absoluteShareUrl(shareInfo)}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[280px] truncate font-mono text-[11px] text-primary-600 hover:underline dark:text-primary-300"
            data-testid="canvas-share-url"
          >
            {absoluteShareUrl(shareInfo)}
          </a>
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 shadow-sm hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
            title={t('canvas.panel.share.copyLinkTitle', 'Copy link')}
            data-testid="canvas-share-copy"
          >
            <Copy size={11} />
            {t('canvas.panel.share.copy', 'Copy')}
          </button>
          <button
            type="button"
            onClick={() => void revokeShareAction()}
            disabled={isRevokingShare}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-danger-600 shadow-sm hover:text-danger-700 disabled:opacity-60 dark:bg-white/10 dark:text-danger-400 dark:hover:text-danger-300"
            title={t('canvas.panel.share.revokeTitle', 'Revoke share')}
            data-testid="canvas-share-revoke"
          >
            {isRevokingShare ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
            {t('canvas.panel.share.revoke', 'Revoke share')}
          </button>
          {shareInfo.expiresAt ? (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {t('canvas.panel.share.expires', 'expires')}{' '}
              {new Date(shareInfo.expiresAt).toLocaleDateString()}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsShareStripDismissed(true)}
            className="ml-auto inline-flex shrink-0 items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            title={t('canvas.panel.share.collapse', 'Collapse (link stays active)')}
            aria-label={t('canvas.panel.share.collapse', 'Collapse (link stays active)')}
            data-testid="canvas-share-collapse"
          >
            <X size={13} />
          </button>
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
                    <div className="rounded-xl border border-danger-200 bg-white/70 p-2 dark:border-danger-300/20 dark:bg-white/10">
                      <div className="mb-1 font-semibold text-danger-700 dark:text-danger-200">
                        Removed
                      </div>
                      {pendingOperation.preview.markdownDiff.removedLineSamples.map(
                        (line, index) => (
                          <div
                            key={`removed-${index}-${line}`}
                            className="truncate font-mono text-[11px] text-danger-800 dark:text-danger-100"
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
                className="min-h-[680px] flex-1 animate-pulse rounded-[1.35rem] border border-white/10 bg-navy-800 p-10"
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
                  // C6 — per-span AI provenance audit keyed by draft id. localStorage
                  // foundation; server-side persistence deferred.
                  provenanceScope={documentState.draftId ?? undefined}
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
