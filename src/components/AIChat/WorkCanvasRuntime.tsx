import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '@/types/workspace';

import { UnifiedChatPanel } from './UnifiedChatPanel';

type CanvasKind =
  | 'markdown'
  | 'table'
  | 'checklist'
  | 'research'
  | 'decision'
  | 'document'
  | 'sheet'
  | 'deck';

type Draft = {
  id: string;
  conversationId: string;
  kind: CanvasKind;
  title: string;
  content: unknown;
  saveState: string;
  lifecycleState: string;
  artifactId?: string | null;
};

type Proposal = {
  id: string;
  target: string;
  title: string;
  summary: string;
  status: 'proposed' | 'approved' | 'rejected';
  targetObjectId?: string | null;
  readBack?: Record<string, unknown> | null;
};

const kindLabels: Record<string, string> = {
  document: 'Document canvas',
  sheet: 'Sheet canvas',
  deck: 'Deck canvas',
};

const targetLabels: Record<string, string> = {
  idea: 'Idea',
  initiative: 'Initiative',
  task: 'Task',
  project_brief: 'Brief',
  decision: 'Decision',
  research_report: 'Research Report',
  client_deliverable: 'Client Deliverable',
};

function authHeaders() {
  const token = window.localStorage.getItem('token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/work-canvas${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      json?.error?.message || json?.error || `Work Canvas request failed: ${response.status}`
    );
  }
  return json as T;
}

function buildContent(kind: CanvasKind, title: string): unknown {
  if (kind === 'research') {
    return {
      mission: title,
      questions: ['What facts are confirmed?', 'Which assumptions need validation?'],
    };
  }
  return `# ${title}

This is a right-side Work Canvas draft. Keep the chat open on the left and shape this output here before saving, approving or exporting it through governed actions.

## Request

${title}
`;
}

function createLocalDraft(kind: CanvasKind, title: string, conversationId: string): Draft {
  return {
    id: `local-${Date.now()}`,
    conversationId,
    kind,
    title,
    content: buildContent(kind, title),
    saveState: 'unsaved',
    lifecycleState: 'draft',
  };
}

function defaultTitleForKind(kind: CanvasKind): string {
  return kind === 'research'
    ? 'Uruchom głębsze badanie i pokaż evidence.'
    : 'Start a company work note';
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function canvasText(draft: Draft): string {
  return typeof draft.content === 'string' ? draft.content : JSON.stringify(draft.content, null, 2);
}

function filenameFor(title: string) {
  return `${
    title
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '') || 'work-canvas'
  }.txt`;
}

function WorkCanvasPreview({ draft }: { draft: Draft }) {
  if (draft.kind === 'research') {
    const content = draft.content as { mission?: string; questions?: string[] };
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm font-semibold text-indigo-800">Deep research mission</div>
          <p className="mt-2 text-sm text-indigo-900">{content.mission || draft.title}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Research questions</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {(content.questions || []).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (draft.kind === 'document' || draft.kind === 'sheet' || draft.kind === 'deck') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm font-semibold text-indigo-800">{kindLabels[draft.kind]}</div>
          <p className="mt-2 text-sm text-indigo-900">
            Use the left chat to shape this output. This right side stays the governed canvas
            preview.
          </p>
        </div>
        <RenderedMarkdown text={canvasText(draft)} />
      </div>
    );
  }

  return <RenderedMarkdown text={canvasText(draft)} />;
}

function RenderedMarkdown({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div className="space-y-3 text-slate-800">
      {lines.map((line, index) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={`${line}-${index}`} className="text-2xl font-semibold text-slate-950">
              {line.replace(/^# /, '')}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={`${line}-${index}`} className="text-lg font-semibold text-slate-900">
              {line.replace(/^## /, '')}
            </h2>
          );
        }
        return (
          <p key={`${line}-${index}`} className="text-sm leading-6 text-slate-700">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function ReadBackView({ readBack }: { readBack: Record<string, unknown> }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/70 p-3 text-xs">
      {Object.entries(readBack).map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="font-semibold capitalize text-slate-500">
            {key.replace(/([A-Z])/g, ' $1')}
          </dt>
          <dd className="text-slate-800">{String(value)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function WorkCanvasRuntime() {
  const [params, setParams] = useSearchParams();
  const initialKind = (params.get('kind') || 'document') as CanvasKind;
  const conversationIdParam = params.get('conversationId') || '';
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);
  const createConversation = useConversationStore((state) => state.createConversation);
  const [draft, setDraft] = React.useState<Draft>(() =>
    createLocalDraft(
      initialKind,
      defaultTitleForKind(initialKind),
      conversationIdParam || activeConversationId || ''
    )
  );
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [saveReadBack, setSaveReadBack] = React.useState<Record<string, unknown> | null>(null);
  const [mode, setMode] = React.useState<'preview' | 'source'>('preview');
  const [activeKind, setActiveKind] = React.useState<CanvasKind>(initialKind);
  const [error, setError] = React.useState<string | null>(null);
  const [isHydrating, setIsHydrating] = React.useState(false);
  const [isConversationSynced, setIsConversationSynced] = React.useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = React.useState(false);
  const draftRef = React.useRef(draft);
  const initialDraftPromiseRef = React.useRef<Promise<Draft> | null>(null);
  const draftIdParam = params.get('draftId');
  const workspaceContext = React.useMemo(
    () =>
      createWorkspaceContext(AppView.WORDY, getDefaultWorkspaceType(AppView.WORDY), {
        entityName: 'Work Canvas',
      }),
    []
  );

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useEffect(() => {
    const clearInvalidActiveConversation = (conversationId: string | null) => {
      if (conversationId && !isUuidLike(conversationId)) {
        setActiveConversation(null);
      }
    };

    clearInvalidActiveConversation(useConversationStore.getState().activeConversationId);
    const unsubscribe = useConversationStore.subscribe((state) => {
      clearInvalidActiveConversation(state.activeConversationId);
    });
    return unsubscribe;
  }, [setActiveConversation]);

  const updateCanvasParams = React.useCallback(
    (updates: Partial<Record<'draftId' | 'conversationId' | 'kind', string | null>>) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        let changed = false;
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === '') {
            if (next.has(key)) changed = true;
            next.delete(key);
          } else {
            if (next.get(key) !== value) changed = true;
            next.set(key, value);
          }
        });
        if (!changed) return current;
        return next;
      });
    },
    [setParams]
  );

  const ensureCanvasConversation = React.useCallback(
    async (preferredConversationId?: string | null) => {
      const preferred = String(preferredConversationId || '').trim();
      if (preferred) {
        const currentActive = useConversationStore.getState().activeConversationId;
        if (!isUuidLike(preferred)) {
          if (currentActive && !isUuidLike(currentActive)) {
            setActiveConversation(null);
          }
          return preferred;
        }
        if (
          isUuidLike(preferred) &&
          useConversationStore.getState().activeConversationId !== preferred
        ) {
          setActiveConversation(preferred);
        }
        return preferred;
      }

      const existing = useConversationStore.getState().activeConversationId;
      if (existing) return existing;

      const conversation = await createConversation({
        title: 'Work Canvas',
      });
      return conversation.id;
    },
    [createConversation, setActiveConversation]
  );

  const createInitialDraft = React.useCallback(
    async (kind: CanvasKind, conversationId: string) => {
      const title = defaultTitleForKind(kind);
      const localDraft = createLocalDraft(kind, title, conversationId);
      setDraft(localDraft);
      draftRef.current = localDraft;
      setActiveKind(kind);

      const result = await api<{ data: Draft }>('/drafts', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          kind,
          title,
          content: localDraft.content,
          sources: [],
          provenance: { source: 'work-canvas-runtime', conversationId },
        }),
      });
      setDraft(result.data);
      draftRef.current = result.data;
      setActiveKind(result.data.kind);
      updateCanvasParams({
        draftId: result.data.id,
        conversationId: result.data.conversationId,
        kind: result.data.kind,
      });
      return result.data;
    },
    [updateCanvasParams]
  );

  React.useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      setIsHydrating(true);
      setIsConversationSynced(false);
      setError(null);
      try {
        const draftId = draftIdParam;
        if (draftId) {
          const result = await api<{ data: { draft: Draft; proposals: Proposal[] } }>(
            `/drafts/${encodeURIComponent(draftId)}`
          );
          if (cancelled) return;
          setDraft(result.data.draft);
          draftRef.current = result.data.draft;
          setActiveKind(result.data.draft.kind);
          setProposals(result.data.proposals || []);
          await ensureCanvasConversation(result.data.draft.conversationId);
          if (cancelled) return;
          setIsConversationSynced(true);
          updateCanvasParams({
            draftId: result.data.draft.id,
            conversationId: result.data.draft.conversationId,
            kind: result.data.draft.kind,
          });
          return;
        }

        const conversationId = await ensureCanvasConversation(
          conversationIdParam || useConversationStore.getState().activeConversationId
        );
        if (cancelled) return;
        setIsConversationSynced(true);
        updateCanvasParams({ conversationId, kind: initialKind });
        if (!initialDraftPromiseRef.current) {
          initialDraftPromiseRef.current = createInitialDraft(initialKind, conversationId);
        }
        await initialDraftPromiseRef.current;
      } catch (caught) {
        if (cancelled) return;
        setIsConversationSynced(true);
        setError(caught instanceof Error ? caught.message : 'Failed to hydrate Work Canvas');
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    createInitialDraft,
    draftIdParam,
    ensureCanvasConversation,
    conversationIdParam,
    initialKind,
    updateCanvasParams,
  ]);

  const persistDraft = React.useCallback(async () => {
    const current = draftRef.current;
    if (!current.id.startsWith('local-')) return current;
    const conversationId = await ensureCanvasConversation(
      current.conversationId ||
        conversationIdParam ||
        useConversationStore.getState().activeConversationId
    );
    const result = await api<{ data: Draft }>('/drafts', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        kind: current.kind,
        title: current.title,
        content: current.content,
        sources: [],
        provenance: { source: 'work-canvas-runtime', conversationId },
      }),
    });
    setDraft(result.data);
    draftRef.current = result.data;
    updateCanvasParams({
      draftId: result.data.id,
      conversationId: result.data.conversationId,
      kind: result.data.kind,
    });
    return result.data;
  }, [conversationIdParam, ensureCanvasConversation, updateCanvasParams]);

  const switchKind = (kind: CanvasKind) => {
    setActiveKind(kind);
    const title = kind === 'research' ? defaultTitleForKind(kind) : draft.title;
    setDraft((current) => {
      const updated = {
        ...current,
        kind,
        title,
        content: buildContent(kind, title),
        saveState: 'unsaved',
        lifecycleState: 'draft',
      } as Draft;
      draftRef.current = updated;
      return updated;
    });
    updateCanvasParams({ kind });
    if (!draftRef.current.id.startsWith('local-')) {
      void api<{ data: Draft }>(`/drafts/${encodeURIComponent(draftRef.current.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          kind,
          title,
          content: buildContent(kind, title),
          saveState: 'unsaved',
          lifecycleState: 'draft',
        }),
      }).then((result) => {
        setDraft(result.data);
        draftRef.current = result.data;
        updateCanvasParams({
          draftId: result.data.id,
          conversationId: result.data.conversationId,
          kind: result.data.kind,
        });
      });
    }
    setProposals([]);
    setSaveReadBack(null);
  };

  const displayDraft = React.useMemo<Draft>(() => {
    if (activeKind === draft.kind) return draft;
    const title =
      activeKind === 'research' ? 'Uruchom głębsze badanie i pokaż evidence.' : draft.title;
    return {
      ...draft,
      kind: activeKind,
      title,
      content: buildContent(activeKind, title),
      saveState: 'unsaved',
      lifecycleState: 'draft',
    };
  }, [activeKind, draft]);

  const propose = async (target: string) => {
    setError(null);
    const persisted = await persistDraft();
    const result = await api<{ data: Proposal }>(
      `/drafts/${encodeURIComponent(persisted.id)}/proposals`,
      {
        method: 'POST',
        body: JSON.stringify({
          target,
          payload: { title: `${targetLabels[target] || target}: ${persisted.title}` },
        }),
      }
    );
    setProposals((current) => [
      result.data,
      ...current.filter((item) => item.id !== result.data.id),
    ]);
  };

  const decide = async (proposalId: string, decision: 'approve' | 'reject') => {
    const result = await api<{ data: Proposal }>(
      `/proposals/${encodeURIComponent(proposalId)}/${decision}`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: decision === 'reject' ? 'Rejected from Work Canvas' : undefined,
        }),
      }
    );
    setProposals((current) =>
      current.map((item) => (item.id === result.data.id ? result.data : item))
    );
  };

  const saveArtifact = async () => {
    setError(null);
    const persisted = await persistDraft();
    const result = await api<{ data: Draft; readBack?: Record<string, unknown> }>(
      `/drafts/${encodeURIComponent(persisted.id)}/save-as-artifact`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    setDraft(result.data);
    draftRef.current = result.data;
    setSaveReadBack(result.readBack || null);
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(canvasText(displayDraft));
  };

  const download = () => {
    const blob = new Blob([canvasText(displayDraft)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFor(displayDraft.title);
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderChatPanel = () => (
    isConversationSynced ? (
      <UnifiedChatPanel
        mode="split"
        workspaceContext={workspaceContext}
        showModeToggle={false}
        showHistoryTrigger={true}
        showFocusMode={false}
        systemPrompt={`You are Teresa assisting with Work Canvas draft titled: ${displayDraft.title}`}
        roleName="Teresa"
      />
    ) : (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Connecting Work Canvas to the current chat...
      </div>
    )
  );

  return (
    <div className="relative flex h-[calc(100vh-6rem)] min-h-[720px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
      {isMobileChatOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Work Canvas chat
              </p>
              <p className="text-sm font-semibold text-slate-950">{displayDraft.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileChatOpen(false)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1">{renderChatPanel()}</div>
        </div>
      ) : null}
      <aside className="hidden w-[420px] shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="h-full">{renderChatPanel()}</div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Consultify Work Canvas
              </div>
              <h1 className="mt-1 text-lg font-semibold text-slate-950">{displayDraft.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsMobileChatOpen(true)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 lg:hidden"
              >
                Chat
              </button>
              {(
                [
                  'markdown',
                  'table',
                  'checklist',
                  'research',
                  'decision',
                  'document',
                  'sheet',
                  'deck',
                ] as CanvasKind[]
              ).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => switchKind(kind)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    activeKind === kind ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {kind}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void saveArtifact()}
                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Save artifact
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(targetLabels).map(([target, label]) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => void propose(target)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Draft version</span>
              <span>
                Save: <strong>{displayDraft.saveState}</strong>
              </span>
              <span>
                Lifecycle: <strong>{displayDraft.lifecycleState}</strong>
              </span>
            </div>
          </div>
          {error ? (
            <div className="mt-3 rounded-xl bg-red-50 p-2 text-xs text-red-700">{error}</div>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-5">
          <div className="grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {displayDraft.kind === 'document' ||
              displayDraft.kind === 'sheet' ||
              displayDraft.kind === 'deck' ? (
                <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
                  This lane now uses the shared split screen: chat on the left, canvas preview on
                  the right. Native KIMI export remains available through the dedicated lane
                  runtime.
                </div>
              ) : null}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('preview')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      mode === 'preview' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('source')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      mode === 'source' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Source
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copy()}
                    className="rounded-full border px-3 py-1.5 text-xs"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="rounded-full border px-3 py-1.5 text-xs"
                  >
                    Download
                  </button>
                </div>
              </div>
              {mode === 'source' ? (
                <pre className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                  {canvasText(displayDraft)}
                </pre>
              ) : (
                <WorkCanvasPreview draft={displayDraft} />
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-950">Governance preview</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Lightweight chips stay simple in UI, but every durable conversion is treated as a
                  preview/proposal before it becomes a business mutation.
                </p>
                {proposals.length ? (
                  <div className="mt-4 space-y-3">
                    {proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3"
                      >
                        <p className="text-sm font-semibold text-indigo-950">{proposal.title}</p>
                        <p className="mt-1 text-xs leading-5 text-indigo-800">{proposal.summary}</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                          Status: {proposal.status}
                        </p>
                        {proposal.readBack ? <ReadBackView readBack={proposal.readBack} /> : null}
                        {proposal.status === 'proposed' ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void decide(proposal.id, 'approve')}
                              className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Approve proposal
                            </button>
                            <button
                              type="button"
                              onClick={() => void decide(proposal.id, 'reject')}
                              className="rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setProposals((current) =>
                              current.filter((item) => item.id !== proposal.id)
                            )
                          }
                          className="mt-3 text-xs font-semibold text-indigo-700"
                        >
                          Dismiss proposal
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                    Select Idea, Initiative, Task or Brief to create a proposal preview.
                  </p>
                )}
                {saveReadBack ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-950">Artifact read-back</p>
                    <ReadBackView readBack={saveReadBack} />
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </main>
        {isHydrating ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/40">
            <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
              Loading canvas...
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default WorkCanvasRuntime;
