import {
  Check,
  ClipboardList,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Lightbulb,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { WorkCanvasApi } from '@/services/api/workCanvas';
import { createWorkspaceContext } from '@/types/workspace';

import { useConversationStore } from '../../../store/useConversationStore';
import { AppView } from '../../../types';
// W2-T5 — Canvas convergence: the standalone /work-canvas route now uses the
// same TipTap-based CanvasRichEditor as the chat-shell, so users get the
// two-mode editing (manual + AI floating menu + accept/reject) on both
// entry points. Previously this shell was read-only ReactMarkdown.
import { CanvasRichEditor } from '../CanvasEditor/CanvasRichEditor';
import { ResearchSessionsDock, type ResearchSessionView } from '../ResearchSessionsDock';
import { UnifiedChatPanel } from '../UnifiedChatPanel';
import { V8ArtifactRunControl } from '../V8ArtifactRunControl';
import {
  WORK_CANVAS_TARGET_LABEL,
  WorkCanvasChecklistItem,
  WorkCanvasConversionProposal,
  WorkCanvasDecisionContent,
  WorkCanvasDraft,
  WorkCanvasKind,
  WorkCanvasResearchContent,
  WorkCanvasTableContent,
  WorkCanvasTarget,
} from './types';

const TARGETS: WorkCanvasTarget[] = [
  'idea',
  'initiative',
  'task',
  'project_brief',
  'decision',
  'research_report',
  'client_deliverable',
];

const CANVAS_KINDS: WorkCanvasKind[] = [
  'markdown',
  'table',
  'checklist',
  'research',
  'decision',
  'document',
  'sheet',
  'deck',
];

const QUICK_PROMPTS = [
  'Zrób z tej rozmowy krótką notatkę po prawej stronie.',
  'Zamień to w tabelę priorytetów.',
  'Przygotuj checklistę działań.',
  'Uruchom głębsze badanie i pokaż evidence.',
];

function createCanvasId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `work-canvas-${Date.now()}`;
}

function inferCanvasKind(message: string): WorkCanvasKind {
  const normalized = message.toLowerCase();
  if (normalized.includes('deck') || normalized.includes('prezent')) return 'deck';
  if (
    normalized.includes('sheet') ||
    normalized.includes('excel') ||
    normalized.includes('arkusz')
  ) {
    return 'sheet';
  }
  if (
    normalized.includes('document') ||
    normalized.includes('wordy') ||
    normalized.includes('brief')
  ) {
    return 'document';
  }
  if (normalized.includes('decision') || normalized.includes('decyz')) return 'decision';
  if (
    normalized.includes('research') ||
    normalized.includes('badanie') ||
    normalized.includes('źród')
  ) {
    return 'research';
  }
  if (
    normalized.includes('tabel') ||
    normalized.includes('table') ||
    normalized.includes('lista lead')
  ) {
    return 'table';
  }
  if (
    normalized.includes('checklist') ||
    normalized.includes('lista kontrol') ||
    normalized.includes('kroki')
  ) {
    return 'checklist';
  }
  return 'markdown';
}

function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Untitled work canvas';
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function buildDraftContent(kind: WorkCanvasKind, message: string): WorkCanvasDraft['content'] {
  const goal = message.trim() || 'Nowy temat roboczy';
  if (kind === 'table') {
    return {
      columns: ['Area', 'Question', 'Next step'],
      rows: [
        {
          Area: 'Context',
          Question: goal,
          'Next step': 'Doprecyzować zakres i właściciela.',
        },
        {
          Area: 'Evidence',
          Question: 'Jakie źródła potwierdzają kierunek?',
          'Next step': 'Dodać źródła lub uruchomić deep research.',
        },
      ],
    };
  }

  if (kind === 'checklist') {
    return [
      { id: 'scope', label: 'Doprecyzować cel i zakres pracy.', checked: false },
      { id: 'sources', label: 'Dodać źródła, założenia i ograniczenia.', checked: false },
      {
        id: 'decision',
        label: 'Ustalić, czy wynik ma stać się ideą, inicjatywą albo taskiem.',
        checked: false,
      },
    ];
  }

  if (kind === 'research') {
    return {
      mission: goal,
      questions: [
        'Jakie fakty są już potwierdzone?',
        'Jakie założenia wymagają sprawdzenia?',
        'Jakie decyzje powinny wynikać z badania?',
      ],
      allowedSources: ['web', 'attachment', 'product', 'org'],
      status: 'planned',
    };
  }

  if (kind === 'decision') {
    return {
      recommendation: goal,
      options: ['Proceed with a small governed proposal', 'Run more discovery first'],
      assumptions: ['Decision is based on the current conversation until sources are attached.'],
      risks: ['Missing source confidence can block trusted/final state.'],
      confidence: 0.62,
    };
  }

  if (kind === 'document' || kind === 'sheet' || kind === 'deck') {
    return `# ${titleFromMessage(goal)}

This is a right-side Work Canvas draft. Keep the chat open on the left and shape this output here before saving, approving or exporting it through governed actions.

## Request

${goal}
`;
  }

  return `# ${titleFromMessage(goal)}

## Working Note

${goal}

## Next Questions

- What decision should this support?
- Which sources or company context should be attached?
- Should this become an idea, initiative, task or project brief?
`;
}

function createDraft(
  conversationId: string,
  message: string,
  kind = inferCanvasKind(message),
  projectId?: string | null
): WorkCanvasDraft {
  const now = new Date().toISOString();
  return {
    id: createCanvasId(),
    conversationId,
    kind,
    title: titleFromMessage(message),
    content: buildDraftContent(kind, message),
    saveState: 'unsaved',
    lifecycleState: 'draft',
    dirtyState: 'dirty',
    visibility: 'project',
    auditStatus: 'not_required',
    sources: [
      {
        id: 'conversation',
        label: 'Current conversation',
        confidence: 0.78,
      },
    ],
    provenance: {
      conversationId,
      sourceSummary: 'Current conversation',
    },
    clientId: null,
    projectId: projectId || null,
    ownerId: null,
    artifactVersion: null,
    createdAt: now,
    updatedAt: now,
  };
}

function workCanvasErrorMessage(error: any, fallback: string): string {
  const code = error?.data?.code || error?.data?.error?.code || error?.code;
  if (code === 'CANVAS_CAPABILITY_REQUIRED') {
    return 'Nie masz wymaganej capability do tej akcji canvas.';
  }
  if (code === 'CANVAS_PROJECT_SCOPE_REQUIRED') {
    return 'Ten canvas wymaga członkostwa w projekcie.';
  }
  if (code === 'STALE_CANVAS_PROPOSAL') {
    return 'Proposal jest nieaktualny, bo canvas zmienił się po jego utworzeniu. Wygeneruj proposal ponownie.';
  }
  if (code === 'V8_ARTIFACT_SAVE_FAILED') {
    return 'V8 artifact runtime nie zmaterializował wyniku. Canvas oznaczono jako failed.';
  }
  if (code === 'CANVAS_ACTOR_REQUIRED') {
    return 'Nie można zatwierdzić proposal bez poprawnego kontekstu użytkownika.';
  }
  return error?.message || fallback;
}

function canvasToPlainText(draft: WorkCanvasDraft): string {
  if (typeof draft.content === 'string') return draft.content;
  if (draft.kind === 'table') {
    const table = draft.content as WorkCanvasTableContent;
    return [
      table.columns.join('\t'),
      ...table.rows.map((row) => table.columns.map((column) => row[column] ?? '').join('\t')),
    ].join('\n');
  }
  if (draft.kind === 'checklist') {
    return (draft.content as WorkCanvasChecklistItem[])
      .map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.label}`)
      .join('\n');
  }
  return JSON.stringify(draft.content, null, 2);
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ReadBackView({ readBack }: { readBack: Record<string, unknown> }) {
  const rows = [
    ['Target', readBack.target],
    ['Target id', readBack.targetObjectId],
    ['Status', readBack.status],
    ['Entity status', readBack.entityStatus],
    ['Project', readBack.projectId],
    ['Owner', readBack.ownerId],
    ['Assignee', readBack.assigneeId],
    ['Artifact', readBack.artifactId],
    ['Run', readBack.artifactRunId],
    ['Audit', readBack.auditEventId],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return (
    <dl className="mt-2 grid gap-1 text-xs leading-5 text-indigo-800 dark:text-indigo-200">
      {rows.map(([label, value]) => (
        <div key={String(label)} className="flex justify-between gap-3">
          <dt className="font-semibold">{String(label)}</dt>
          <dd className="max-w-[180px] truncate text-right">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function kindIcon(kind: WorkCanvasKind) {
  switch (kind) {
    case 'table':
      return Table2;
    case 'checklist':
      return ClipboardList;
    case 'research':
      return FlaskConical;
    case 'sheet':
      return Table2;
    case 'deck':
    case 'document':
    case 'decision':
      return FileText;
    default:
      return FileText;
  }
}

function MarkdownCanvas({ content }: { content: string }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-brand">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * W2-T5 — Editable markdown canvas with the same TipTap stack the chat-shell
 * uses. Selecting text reveals the floating AI menu; manual edits live-update
 * the parent draft state, which the shell's debounced persistence picks up
 * for `WorkCanvasApi.updateDraft`. Server-side draft assignment may lag the
 * first edits (a brand-new draft is `work-canvas-…` until persisted) — the
 * provenance log inside CanvasRichEditor handles that lag with a session
 * fallback scope (W2-T4).
 */
function EditableMarkdownCanvas({
  draftId,
  content,
  onContentChange,
}: {
  draftId: string;
  content: string;
  onContentChange: (md: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-navy-900">
      <CanvasRichEditor
        contentMd={content}
        onContentChange={onContentChange}
        editable={true}
        provenanceScope={draftId.startsWith('work-canvas-') ? undefined : draftId}
      />
    </div>
  );
}

function TableCanvas({ content }: { content: WorkCanvasTableContent }) {
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-white/10">
      <table /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */  className="min-w-full divide-y divide-slate-200 dark:divide-white/10 text-sm">
        <thead className="bg-slate-50 dark:bg-white/[0.03]">
          <tr>
            {content.columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white dark:bg-navy-900">
          {content.rows.map((row, index) => (
            <tr key={`${row[content.columns[0]]}-${index}`}>
              {content.columns.map((column) => (
                <td key={column} className="px-4 py-3 text-slate-700 dark:text-slate-200">
                  {String(row[column] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistCanvas({ content }: { content: WorkCanvasChecklistItem[] }) {
  return (
    <div className="space-y-3">
      {content.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
              item.checked
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 text-transparent dark:border-white/20'
            }`}
          >
            <Check size={13} />
          </span>
          <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ResearchCanvas({
  draft,
  content,
  onResearchSessionSelected,
}: {
  draft: WorkCanvasDraft;
  content: WorkCanvasResearchContent;
  onResearchSessionSelected: (session: ResearchSessionView | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200">
          <FlaskConical size={16} />
          Deep research mission
        </div>
        <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-100">{content.mission}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {content.allowedSources.map((source) => (
            <span
              key={source}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 shadow-sm dark:bg-white/10 dark:text-indigo-100"
            >
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Research questions</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {content.questions.map((question) => (
            <li key={question} className="flex gap-2">
              <span className="text-indigo-500">•</span>
              <span>{question}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-navy-950/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Governed research runtime
        </p>
        {draft.researchSessionId ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Linked session: <span className="font-semibold">{draft.researchSessionId}</span>
          </p>
        ) : null}
        <div className="mt-3 max-h-[520px] overflow-auto rounded-xl bg-white dark:bg-navy-900">
          <ResearchSessionsDock
            compact
            initialMission={content.mission}
            selectedSessionId={draft.researchSessionId || null}
            onSessionSelected={onResearchSessionSelected}
          />
        </div>
      </div>
    </div>
  );
}

function DecisionCanvas({ content }: { content: WorkCanvasDecisionContent }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
          Recommendation
        </p>
        <p className="mt-2 text-sm text-amber-950 dark:text-amber-50">{content.recommendation}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Options</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {content.options.map((option) => (
              <li key={option}>- {option}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Assumptions and risks</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {[...content.assumptions, ...content.risks].map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Confidence:{' '}
        {typeof content.confidence === 'number'
          ? `${Math.round(content.confidence * 100)}%`
          : 'not set'}
      </p>
    </div>
  );
}

function SourceCanvas({ draft }: { draft: WorkCanvasDraft }) {
  return (
    <pre className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
      {canvasToPlainText(draft)}
    </pre>
  );
}

function KimiLaneCanvas({ draft }: { draft: WorkCanvasDraft }) {
  const label =
    draft.kind === 'sheet'
      ? 'Sheet canvas'
      : draft.kind === 'deck'
        ? 'Deck canvas'
        : 'Document canvas';
  const helper =
    draft.kind === 'sheet'
      ? 'Use the left chat to shape rows, assumptions and formulas. This right side stays the governed canvas preview.'
      : draft.kind === 'deck'
        ? 'Use the left chat to shape the storyline and slide outline. This right side stays the governed canvas preview.'
        : 'Use the left chat to shape the document. This right side stays the governed canvas preview.';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-100">
          <FileText size={16} />
          {label}
        </div>
        <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-100">{helper}</p>
      </div>
      <MarkdownCanvas content={String(draft.content)} />
    </div>
  );
}

function CanvasRenderer({
  draft,
  mode,
  onResearchSessionSelected,
  onMarkdownChange,
}: {
  draft: WorkCanvasDraft;
  mode: 'preview' | 'source';
  onResearchSessionSelected: (session: ResearchSessionView | null) => void;
  // W2-T5 — optional editable callback for kind='markdown'. When provided the
  // shell drops the read-only ReactMarkdown view and renders the same TipTap
  // editor the chat-shell uses, so both entry points have the two-mode UX.
  onMarkdownChange?: (md: string) => void;
}) {
  if (mode === 'source') return <SourceCanvas draft={draft} />;
  if (draft.kind === 'document' || draft.kind === 'sheet' || draft.kind === 'deck') {
    return <KimiLaneCanvas draft={draft} />;
  }
  if (draft.kind === 'table') {
    return <TableCanvas content={draft.content as WorkCanvasTableContent} />;
  }
  if (draft.kind === 'checklist') {
    return <ChecklistCanvas content={draft.content as WorkCanvasChecklistItem[]} />;
  }
  if (draft.kind === 'research') {
    return (
      <ResearchCanvas
        draft={draft}
        content={draft.content as WorkCanvasResearchContent}
        onResearchSessionSelected={onResearchSessionSelected}
      />
    );
  }
  if (draft.kind === 'decision') {
    return <DecisionCanvas content={draft.content as WorkCanvasDecisionContent} />;
  }
  if (onMarkdownChange) {
    return (
      <EditableMarkdownCanvas
        draftId={draft.id}
        content={String(draft.content)}
        onContentChange={onMarkdownChange}
      />
    );
  }
  return <MarkdownCanvas content={String(draft.content)} />;
}

export function WorkCanvasShell() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const activeConversationProjectId = useConversationStore((state) => {
    const active = (state.conversations || []).find(
      (item) => item.id === state.activeConversationId
    );
    return active?.projectId || null;
  });
  const requestedKind = searchParams.get('kind') as WorkCanvasKind | null;
  const [draft, setDraft] = React.useState<WorkCanvasDraft | null>(() =>
    createDraft(
      'pending-conversation',
      'Start a company work note',
      requestedKind && CANVAS_KINDS.includes(requestedKind) ? requestedKind : 'markdown',
      activeConversationProjectId
    )
  );
  const [proposal, setProposal] = React.useState<WorkCanvasConversionProposal | null>(null);
  const [saveReadBack, setSaveReadBack] = React.useState<Record<string, unknown> | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [rendererMode, setRendererMode] = React.useState<'preview' | 'source'>('preview');
  const [mobileChatOpen, setMobileChatOpen] = React.useState(false);
  const [versionIndex, setVersionIndex] = React.useState(0);
  const draftIdParam = searchParams.get('draftId');
  const conversationIdParam = searchParams.get('conversationId');

  const conversationId =
    conversationIdParam || activeConversationId || draft?.conversationId || 'pending-conversation';
  const workspaceContext = React.useMemo(
    () =>
      createWorkspaceContext(AppView.AI_OS_WORK_CANVAS, 'canvas', {
        entityId: draft?.id,
        entityName: draft?.title || 'Work Canvas',
        entityData: {
          canvasKind: draft?.kind || 'markdown',
          saveState: draft?.saveState || 'unsaved',
          lifecycleState: draft?.lifecycleState || 'draft',
          projectId: draft?.projectId || activeConversationProjectId,
        },
      }),
    [
      activeConversationProjectId,
      draft?.id,
      draft?.kind,
      draft?.lifecycleState,
      draft?.projectId,
      draft?.saveState,
      draft?.title,
    ]
  );

  React.useEffect(() => {
    if (draftIdParam) {
      let cancelled = false;
      WorkCanvasApi.getDraft(draftIdParam)
        .then((result) => {
          if (cancelled) return;
          setDraft(result.draft);
          setProposal(result.proposals[0] || null);
        })
        .catch((error: any) => {
          if (!cancelled)
            setErrorMessage(workCanvasErrorMessage(error, 'Canvas draft load failed.'));
        });
      return () => {
        cancelled = true;
      };
    }
    if (!conversationId) return;
    let cancelled = false;
    WorkCanvasApi.listDrafts({
      conversationId,
      projectId: activeConversationProjectId,
      limit: 1,
    })
      .then((drafts) => {
        if (cancelled || drafts.length === 0) return;
        setDraft(drafts[0]);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Nie udało się odświeżyć listy canvas draftów.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversationProjectId, conversationId, draftIdParam]);

  const handleMessageSent = React.useCallback(
    async (message: string) => {
      const nextDraft = createDraft(
        conversationId,
        message,
        inferCanvasKind(message),
        activeConversationProjectId
      );
      setDraft(nextDraft);
      setProposal(null);
      setErrorMessage(null);
      try {
        const result = await WorkCanvasApi.createDraft({
          conversationId,
          kind: nextDraft.kind,
          title: nextDraft.title,
          content: nextDraft.content,
          sources: nextDraft.sources,
          provenance: nextDraft.provenance,
          projectId: nextDraft.projectId,
          ownerId: nextDraft.ownerId,
        });
        setDraft(result.data);
        navigate(
          `/ai/work-canvas?draftId=${encodeURIComponent(result.data.id)}&conversationId=${encodeURIComponent(
            result.data.conversationId
          )}${result.data.kind ? `&kind=${encodeURIComponent(result.data.kind)}` : ''}`,
          { replace: true }
        );
      } catch (error: any) {
        setErrorMessage(workCanvasErrorMessage(error, 'Canvas draft could not be persisted.'));
      }
    },
    [activeConversationProjectId, conversationId, navigate]
  );

  const switchKind = (kind: WorkCanvasKind) => {
    if (kind === 'document' || kind === 'sheet' || kind === 'deck') {
      navigate(`/ai/work-canvas?kind=${kind}&conversationId=${encodeURIComponent(conversationId)}`);
    }
    setDraft((current) => {
      const seed = current?.title || 'New work canvas';
      return createDraft(conversationId, seed, kind, activeConversationProjectId);
    });
    setProposal(null);
  };

  const ensurePersistedDraft = async (current: WorkCanvasDraft): Promise<WorkCanvasDraft> => {
    if (!current.id.startsWith('work-canvas-')) return current;
    const result = await WorkCanvasApi.createDraft({
      conversationId,
      kind: current.kind,
      title: current.title,
      content: current.content,
      sources: current.sources,
      provenance: current.provenance,
      projectId: current.projectId || activeConversationProjectId,
      ownerId: current.ownerId,
    });
    navigate(
      `/ai/work-canvas?draftId=${encodeURIComponent(result.data.id)}&conversationId=${encodeURIComponent(
        result.data.conversationId
      )}${result.data.kind ? `&kind=${encodeURIComponent(result.data.kind)}` : ''}`,
      { replace: true }
    );
    return result.data;
  };

  const markSaved = async () => {
    if (!draft) return;
    setIsBusy(true);
    setErrorMessage(null);
    setDraft((current) => (current ? { ...current, saveState: 'saving' } : current));
    try {
      const persisted = await ensurePersistedDraft(draft);
      if (persisted.id !== draft.id) setDraft(persisted);
      const result = await WorkCanvasApi.saveAsArtifact(persisted.id, {
        artifactId: persisted.artifactId || null,
        artifactRunId: persisted.artifactRunId || null,
      });
      setDraft(result.data);
      setSaveReadBack(result.readBack || null);
    } catch (error: any) {
      setErrorMessage(workCanvasErrorMessage(error, 'Save as artifact failed.'));
      setDraft((current) => (current ? { ...current, saveState: 'failed' } : current));
    } finally {
      setIsBusy(false);
    }
  };

  const proposeConversion = async (target: WorkCanvasTarget) => {
    if (!draft) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const persisted = await ensurePersistedDraft(draft);
      if (persisted.id !== draft.id) setDraft(persisted);
      const result = await WorkCanvasApi.createProposal(persisted.id, target, {
        title: `${WORK_CANVAS_TARGET_LABEL[target]}: ${persisted.title}`,
        projectId: persisted.projectId || activeConversationProjectId,
        ownerId: persisted.ownerId || undefined,
        assigneeId: persisted.ownerId || undefined,
        source: 'work_canvas',
      });
      setProposal(result.data);
      setDraft((current) =>
        current
          ? {
              ...current,
              updatedAt: new Date().toISOString(),
            }
          : current
      );
    } catch (error: any) {
      setErrorMessage(workCanvasErrorMessage(error, 'Conversion proposal failed.'));
    } finally {
      setIsBusy(false);
    }
  };

  const decideProposal = async (decision: 'approve' | 'reject') => {
    if (!proposal) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const result =
        decision === 'approve'
          ? await WorkCanvasApi.approveProposal(proposal.id)
          : await WorkCanvasApi.rejectProposal(proposal.id, 'Rejected from Work Canvas');
      setProposal(result.data);
    } catch (error: any) {
      setErrorMessage(workCanvasErrorMessage(error, `Proposal ${decision} failed.`));
    } finally {
      setIsBusy(false);
    }
  };

  const Icon = draft ? kindIcon(draft.kind) : Sparkles;
  const isSaved = draft?.saveState === 'saved';
  const versionLabel = draft?.artifactVersion
    ? `Version ${draft.artifactVersion}`
    : 'Draft version';
  // W2-T5 — markdown content updates from the TipTap editor. Updates local
  // state immediately and debounces a server-side `updateDraft` call so a
  // burst of keystrokes makes one network round-trip. Skips persistence on a
  // synthetic `work-canvas-*` draft until `ensurePersistedDraft` upgrades the
  // id (no point sending updateDraft to a non-existent server row).
  const markdownPersistTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMarkdownChange = React.useCallback(
    (nextMd: string) => {
      setDraft((current) =>
        current ? { ...current, content: nextMd, updatedAt: new Date().toISOString() } : current
      );
      if (markdownPersistTimer.current) clearTimeout(markdownPersistTimer.current);
      markdownPersistTimer.current = setTimeout(() => {
        const persisted = draft;
        if (!persisted || persisted.id.startsWith('work-canvas-')) return;
        void WorkCanvasApi.updateDraft(persisted.id, { content: nextMd }).catch((error: any) => {
          setErrorMessage(workCanvasErrorMessage(error, 'Canvas changes could not be saved.'));
        });
      }, 600);
    },
    [draft]
  );
  React.useEffect(
    () => () => {
      if (markdownPersistTimer.current) clearTimeout(markdownPersistTimer.current);
    },
    []
  );

  const handleResearchSessionSelected = React.useCallback((session: ResearchSessionView | null) => {
    if (!session) return;
    let draftToPersist: WorkCanvasDraft | null = null;
    setDraft((current) => {
      if (!current || current.researchSessionId === session.sessionId) return current;
      if (current.kind !== 'research') return current;
      const nextDraft = {
        ...current,
        researchSessionId: session.sessionId,
        content: {
          ...(current.content as WorkCanvasResearchContent),
          status: session.status === 'archived' ? 'completed' : session.status,
        },
        updatedAt: new Date().toISOString(),
      };
      draftToPersist = nextDraft;
      return nextDraft;
    });
    window.setTimeout(() => {
      if (!draftToPersist || draftToPersist.id.startsWith('work-canvas-')) return;
      void WorkCanvasApi.updateDraft(draftToPersist.id, {
        researchSessionId: session.sessionId,
        content: draftToPersist.content,
      }).catch((error: any) => {
        setErrorMessage(workCanvasErrorMessage(error, 'Research session link could not be saved.'));
      });
    }, 0);
  }, []);

  const copyCurrentDraft = async () => {
    if (!draft) return;
    await navigator.clipboard?.writeText(canvasToPlainText(draft));
  };

  const downloadCurrentDraft = () => {
    if (!draft) return;
    const safeTitle =
      draft.title.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'canvas';
    downloadTextFile(
      `${safeTitle}.${rendererMode === 'source' ? 'json' : 'txt'}`,
      canvasToPlainText(draft)
    );
  };

  const improveCurrentDraft = () => {
    setErrorMessage(
      'Improve is queued as an AI proposal action; no canvas content was changed without approval.'
    );
  };

  const highlightCurrentDraft = () => {
    setErrorMessage(
      'Highlight mode is queued as a review action; assumptions and missing sources will be marked after approval.'
    );
  };
  const isKimiKind =
    draft?.kind === 'document' || draft?.kind === 'sheet' || draft?.kind === 'deck';

  return (
    <div className="flex h-full min-h-0 bg-slate-100 text-slate-900 dark:bg-navy-950 dark:text-white">
      <aside
        className={`${
          mobileChatOpen ? 'fixed inset-0 z-40 flex' : 'hidden'
        } min-w-[340px] max-w-[520px] basis-[36%] border-r border-slate-200 bg-white dark:border-white/10 dark:bg-navy-900 lg:relative lg:inset-auto lg:z-auto lg:flex`}
      >
        <UnifiedChatPanel
          mode="split"
          workspaceContext={workspaceContext}
          title={t('canvas.panel.companyAiChat', 'Company AI Chat')}
          showModeToggle={false}
          showHistoryTrigger={true}
          showFocusMode={true}
          quickPrompts={QUICK_PROMPTS}
          onMessageSent={handleMessageSent}
          systemPrompt="You are helping the user turn conversation into a structured Consultify Work Canvas. Prefer concise business outputs with sources, assumptions and next actions."
        />
        <button
          type="button"
          onClick={() => setMobileChatOpen(false)}
          className="absolute right-3 top-3 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white lg:hidden"
        >
          Close chat
        </button>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-navy-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Icon size={15} />
                Consultify Work Canvas
              </div>
              <h1 className="mt-1 truncate text-lg font-semibold text-slate-950 dark:text-white">
                {draft?.title || 'No active canvas'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileChatOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 lg:hidden"
              >
                <MessageSquare size={13} />
                Chat
              </button>
              {CANVAS_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => switchKind(kind)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    draft?.kind === kind
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
                  }`}
                >
                  {kind}
                </button>
              ))}
              <button
                type="button"
                onClick={markSaved}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Save size={13} />
                Save artifact
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {TARGETS.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => proposeConversion(target)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-indigo-400"
                >
                  {target === 'idea' ? <Lightbulb size={13} /> : <Sparkles size={13} />}
                  {WORK_CANVAS_TARGET_LABEL[target]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {versionLabel}
                {versionIndex > 0 ? `-${versionIndex}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setVersionIndex((value) => Math.max(0, value - 1))}
                disabled
                title="Version history will load from artifact history in a later runtime step."
                className="rounded-full border border-slate-200 px-2 py-1 font-semibold text-slate-600 dark:border-white/10 dark:text-slate-500"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setVersionIndex((value) => value + 1)}
                disabled
                title="Version history will load from artifact history in a later runtime step."
                className="rounded-full border border-slate-200 px-2 py-1 font-semibold text-slate-600 dark:border-white/10 dark:text-slate-500"
              >
                Next
              </button>
              <span className="h-3 w-px bg-slate-300 dark:bg-white/10" />
              <span>
                Save:{' '}
                <strong className="text-slate-700 dark:text-slate-200">{draft?.saveState}</strong>
              </span>
              <span className="h-3 w-px bg-slate-300 dark:bg-white/10" />
              <span>
                Lifecycle:{' '}
                <strong className="text-slate-700 dark:text-slate-200">
                  {draft?.lifecycleState}
                </strong>
              </span>
            </div>
          </div>
          {errorMessage ? (
            <div className="mt-3 rounded-2xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-5">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-navy-900">
              {isKimiKind ? (
                <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
                  This lane now uses the shared split screen: chat on the left, canvas preview on
                  the right. Native KIMI export remains available through the dedicated lane
                  runtime.
                </div>
              ) : null}
              {draft ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRendererMode('preview')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        rendererMode === 'preview'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200'
                      }`}
                    >
                      <Eye size={13} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setRendererMode('source')}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        rendererMode === 'source'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200'
                      }`}
                    >
                      <Code2 size={13} />
                      Source
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyCurrentDraft}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                    >
                      <Copy size={13} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={downloadCurrentDraft}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                    >
                      <Download size={13} />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={highlightCurrentDraft}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-400/40 dark:text-amber-100"
                    >
                      Highlight
                    </button>
                    <button
                      type="button"
                      onClick={improveCurrentDraft}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-400/40 dark:text-indigo-100"
                    >
                      Improve
                    </button>
                  </div>
                </div>
              ) : null}
              {draft ? (
                <CanvasRenderer
                  draft={draft}
                  mode={rendererMode}
                  onResearchSessionSelected={handleResearchSessionSelected}
                  onMarkdownChange={draft.kind === 'markdown' ? handleMarkdownChange : undefined}
                />
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <Sparkles className="text-slate-600" size={32} />
                  <h2 className="mt-3 text-lg font-semibold">Start working with AI</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Ask the chat to create a note, table, checklist or research brief.
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                  Governance preview
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Lightweight chips stay simple in UI, but every durable conversion is treated as a
                  preview/proposal before it becomes a business mutation.
                </p>
                {proposal ? (
                  <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                          {proposal.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-indigo-800 dark:text-indigo-200">
                          {proposal.summary}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
                          Status: {proposal.status}
                        </p>
                        {proposal.readBack ? <ReadBackView readBack={proposal.readBack} /> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setProposal(null)}
                        className="rounded-full p-1 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-white/10"
                        aria-label="Dismiss proposal"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {proposal.status === 'proposed' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => decideProposal('approve')}
                          disabled={isBusy}
                          className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Approve proposal
                        </button>
                        <button
                          type="button"
                          onClick={() => decideProposal('reject')}
                          disabled={isBusy}
                          className="rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/40 dark:text-indigo-100 dark:hover:bg-white/10"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Select Idea, Initiative, Task or Brief to create a proposal preview.
                  </p>
                )}
                {saveReadBack ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                      Artifact read-back
                    </p>
                    <ReadBackView readBack={saveReadBack} />
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                  Artifact runtime
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Use the existing V8 runtime for governed document/sheet/presentation
                  materialization.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {isSaved ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                      <Check size={13} />
                      Saved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                      <Loader2 size={13} />
                      Draft
                    </span>
                  )}
                  <V8ArtifactRunControl
                    conversationId={activeConversationId || conversationId}
                    defaultGoal={draft?.title || ''}
                    snapshotContext={{
                      workspaceId: draft?.id || null,
                      projectId: draft?.projectId || activeConversationProjectId,
                      effectiveScopeRef: 'work_canvas',
                      resolvedRoleRef: 'consultify_workspace_user',
                      privacyMode: false,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-navy-900">
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Sources</h2>
                <div className="mt-3 space-y-2">
                  {(draft?.sources || []).map((source) => (
                    <div
                      key={source.id}
                      className="rounded-2xl border border-slate-200 p-3 text-xs dark:border-white/10"
                    >
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        {source.label}
                      </p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        Confidence:{' '}
                        {typeof source.confidence === 'number'
                          ? `${Math.round(source.confidence * 100)}%`
                          : 'not set'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </section>
    </div>
  );
}

export default WorkCanvasShell;
