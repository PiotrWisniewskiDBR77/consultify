import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  FileText,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import React from 'react';

import { Api } from '../../services/api';

export type ResearchSessionView = {
  sessionId: string;
  status: 'planned' | 'approved' | 'running' | 'paused' | 'completed' | 'failed' | 'archived';
  mission: string;
  scope?: string | null;
  allowedSources?: string[];
  progress?: { stage?: string; percent?: number; totalSources?: number; citationCount?: number };
  evidenceGraph?: Array<{
    nodeId: string;
    sourceClass: string;
    claim?: string;
    confidence?: number;
    contradiction?: boolean;
    freshness?: string;
  }>;
  finalArtifact?: { artifactId: string; title: string; contentMarkdown: string };
  error?: string | null;
  updatedAt?: string;
};

const SOURCE_OPTIONS: Array<'web' | 'attachment' | 'product' | 'org'> = [
  'web',
  'attachment',
  'product',
  'org',
];

const STATUS_ICON = {
  planned: Clock3,
  approved: CheckCircle2,
  running: RefreshCw,
  paused: Pause,
  completed: FileText,
  failed: AlertTriangle,
  archived: Archive,
};

const LOAD_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}

interface ResearchSessionsDockProps {
  compact?: boolean;
  initialMission?: string;
  selectedSessionId?: string | null;
  onSessionSelected?: (session: ResearchSessionView | null) => void;
}

export const ResearchSessionsDock: React.FC<ResearchSessionsDockProps> = ({
  compact = false,
  initialMission = '',
  selectedSessionId = null,
  onSessionSelected,
}) => {
  const [sessions, setSessions] = React.useState<ResearchSessionView[]>([]);
  const [selected, setSelected] = React.useState<ResearchSessionView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyById, setBusyById] = React.useState<Record<string, boolean>>({});
  const [mission, setMission] = React.useState(initialMission);
  const [scope, setScope] = React.useState('');
  const [questions, setQuestions] = React.useState('');
  const [allowedSources, setAllowedSources] = React.useState<
    Array<'web' | 'attachment' | 'product' | 'org'>
  >(['web', 'attachment', 'product', 'org']);
  const sessionsRef = React.useRef<ResearchSessionView[]>([]);
  const selectedSessionIdRef = React.useRef<string | null>(null);
  const loadSeqRef = React.useRef(0);

  React.useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  React.useEffect(() => {
    selectedSessionIdRef.current = selected?.sessionId || null;
    onSessionSelected?.(selected);
  }, [selected?.sessionId]);

  React.useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId || selected?.sessionId || null;
  }, [selected?.sessionId, selectedSessionId]);

  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    const requestId = ++loadSeqRef.current;
    const hasCachedSessions = sessionsRef.current.length > 0;
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await withTimeout(
        Api.listResearchSessions({ limit: 50 }),
        LOAD_TIMEOUT_MS,
        'Research sessions refresh timed out. Please try Refresh again.'
      );
      if (requestId !== loadSeqRef.current) return;
      const next = Array.isArray(res?.sessions) ? res.sessions : [];
      setSessions(next);
      const selectedSessionId = selectedSessionIdRef.current;
      if (!selectedSessionId && next.length > 0) {
        setSelected(next[0]);
        return;
      }
      if (selectedSessionId) {
        const fresh = next.find(
          (session: ResearchSessionView) => session.sessionId === selectedSessionId
        );
        if (fresh) setSelected(fresh);
        if (!fresh && next.length > 0) setSelected(next[0]);
      }
    } catch (err: any) {
      if (requestId !== loadSeqRef.current) return;
      setError(err?.message || 'Failed to load research sessions');
      if (hasCachedSessions) {
        setSessions([...sessionsRef.current]);
      }
    } finally {
      if (requestId === loadSeqRef.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const hasRunning = sessions.some((session) => session.status === 'running');
    if (!hasRunning) return undefined;
    const timer = window.setInterval(() => {
      load({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load, sessions]);

  const refreshSelected = async (sessionId: string) => {
    const res = await Api.getResearchSession(sessionId);
    if (res?.session) setSelected(res.session);
    await load({ silent: true });
  };

  const withBusy = async (sessionId: string, action: () => Promise<void>) => {
    setBusyById((prev) => ({ ...prev, [sessionId]: true }));
    setError(null);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Research action failed');
    } finally {
      setBusyById((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }
  };

  const createSession = async () => {
    if (!mission.trim()) {
      setError('Mission is required to create a research session.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await Api.createResearchSession({
        mission: mission.trim(),
        scope: scope.trim() || undefined,
        questions: questions
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        allowedSources,
        expectedOutput: 'research_report',
      });
      if (res?.success === false) throw new Error(res?.error || 'Failed to create session');
      if (res?.session) {
        setSelected(res.session);
        setSessions((prev) => [
          res.session,
          ...prev.filter((session) => session.sessionId !== res.session.sessionId),
        ]);
      }
      setMission('');
      setScope('');
      setQuestions('');
      setLoading(false);
      void load({ silent: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to create research session');
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (source: 'web' | 'attachment' | 'product' | 'org') => {
    setAllowedSources((prev) => {
      const next = prev.includes(source)
        ? prev.filter((item) => item !== source)
        : [...prev, source];
      return next.length > 0 ? next : prev;
    });
  };

  const approve = async (sessionId: string) => {
    await withBusy(sessionId, async () => {
      const res = await Api.approveResearchSession(sessionId);
      if (res?.session) {
        setSelected(res.session);
        setSessions((prev) =>
          prev.map((session) => (session.sessionId === sessionId ? res.session : session))
        );
      }
      void refreshSelected(sessionId);
    });
  };

  const start = async (sessionId: string) => {
    await withBusy(sessionId, async () => {
      const res = await Api.startResearchSession(sessionId);
      if (res?.session) setSelected(res.session);
      void refreshSelected(sessionId);
    });
  };

  const cancel = async (sessionId: string) => {
    await withBusy(sessionId, async () => {
      const res = await Api.cancelResearchSessionV1(sessionId);
      if (res?.session) setSelected(res.session);
      void refreshSelected(sessionId);
    });
  };

  const resume = async (sessionId: string) => {
    await withBusy(sessionId, async () => {
      const res = await Api.resumeResearchSession(sessionId);
      if (res?.session) setSelected(res.session);
      void refreshSelected(sessionId);
    });
  };

  const retry = async (sessionId: string) => {
    await withBusy(sessionId, async () => {
      const res = await Api.retryResearchSession(sessionId);
      if (res?.session) setSelected(res.session);
      void refreshSelected(sessionId);
    });
  };

  return (
    <div className={compact ? 'space-y-4 p-4' : 'p-6 space-y-6'}>
      {!compact ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-c-text-secondary dark:text-c-text-secondary font-semibold">
            Consultify AI OS
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Research Sessions
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Reproducible Deep Research with lifecycle, evidence graph, citations and final report
            artifacts.
          </p>
        </div>
      ) : null}

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div
        className={
          compact ? 'grid gap-4' : 'grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]'
        }
      >
        <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
          <div className="border-b border-slate-200 dark:border-navy-700 p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Create Session</h2>
              <p className="text-xs text-slate-500">
                Plan research first, then approve and run it as a governed background job.
              </p>
            </div>
            <input
              value={mission}
              onChange={(event) => setMission(event.target.value)}
              placeholder="Mission, e.g. assess ERP modernization risks"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <textarea
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              placeholder="Scope and constraints"
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <textarea
              value={questions}
              onChange={(event) => setQuestions(event.target.value)}
              placeholder="Optional questions, one per line"
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => toggleSource(source)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    allowedSources.includes(source)
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200'
                      : 'border-slate-200 text-slate-500 dark:border-navy-700'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={createSession}
              disabled={loading || !mission.trim()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-navy-950"
            >
              Create planned session
            </button>
          </div>
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Session Dock</h2>
              <p className="text-xs text-slate-500">
                Start, pause, resume and retry research. Running jobs auto-refresh every 5 seconds.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs rounded-md border px-3 py-1.5"
            >
              {loading && sessions.length > 0 ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-navy-800">
            {loading && sessions.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Loading research sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No research sessions yet.</div>
            ) : (
              <>
                {loading && (
                  <div className="px-4 py-2 text-xs text-slate-500">
                    Refreshing sessions in the background...
                  </div>
                )}
                {sessions.map((session) => {
                  const Icon = STATUS_ICON[session.status] || Clock3;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => setSelected(session)}
                      className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-navy-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
                          <Icon
                            size={12}
                            className={session.status === 'running' ? 'animate-spin' : ''}
                          />
                          {session.status}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {session.progress?.stage || 'planned'}
                        </span>
                      </div>
                      <div className="mt-2 font-medium text-slate-900 dark:text-white">
                        {session.mission}
                      </div>
                      <div className="text-xs text-slate-500">
                        Sources: {(session.allowedSources || []).join(', ') || 'all'}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">Select a research session.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {selected.mission}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{selected.scope}</p>
                </div>
                <span className="rounded-full border px-2 py-0.5 text-xs">{selected.status}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.status === 'planned' && (
                  <button
                    type="button"
                    onClick={() => approve(selected.sessionId)}
                    disabled={busyById[selected.sessionId]}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white"
                  >
                    {busyById[selected.sessionId] ? 'Approving...' : 'Approve'}
                  </button>
                )}
                {selected.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => start(selected.sessionId)}
                    disabled={busyById[selected.sessionId]}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white"
                  >
                    <Play size={12} className="inline mr-1" />
                    {busyById[selected.sessionId] ? 'Starting...' : 'Start'}
                  </button>
                )}
                {selected.status === 'running' && (
                  <button
                    type="button"
                    onClick={() => cancel(selected.sessionId)}
                    disabled={busyById[selected.sessionId]}
                    className="rounded-md border px-3 py-1.5 text-xs"
                  >
                    {busyById[selected.sessionId] ? 'Pausing...' : 'Pause'}
                  </button>
                )}
                {selected.status === 'paused' && (
                  <button
                    type="button"
                    onClick={() => resume(selected.sessionId)}
                    disabled={busyById[selected.sessionId]}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white"
                  >
                    {busyById[selected.sessionId] ? 'Resuming...' : 'Resume'}
                  </button>
                )}
                {selected.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => retry(selected.sessionId)}
                    disabled={busyById[selected.sessionId]}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white"
                  >
                    {busyById[selected.sessionId] ? 'Retrying...' : 'Retry'}
                  </button>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-navy-950 p-3 text-sm">
                <div className="text-xs text-slate-500">Progress</div>
                <div className="mt-1 text-slate-700 dark:text-slate-200">
                  {selected.progress?.stage || selected.status} · {selected.progress?.percent ?? 0}%
                </div>
                {selected.status === 'running' && (
                  <div className="mt-1 text-xs text-slate-500">
                    Background job accepted. This panel refreshes while the report is generated.
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Evidence Graph
                </h3>
                <div className="mt-2 space-y-2 max-h-64 overflow-auto">
                  {(selected.evidenceGraph || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No evidence captured yet.</p>
                  ) : (
                    (selected.evidenceGraph || []).map((node) => (
                      <div
                        key={node.nodeId}
                        className="rounded-lg border border-slate-200 dark:border-navy-800 p-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{node.sourceClass}</span>
                          <span>{Math.round((node.confidence || 0) * 100)}%</span>
                        </div>
                        <p className="mt-1 text-slate-700 dark:text-slate-200">{node.claim}</p>
                        {node.contradiction && (
                          <p className="mt-1 text-amber-600">Potential contradiction detected.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selected.finalArtifact && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Final Artifact
                  </h3>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-50 dark:bg-navy-950 p-3 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {selected.finalArtifact.contentMarkdown}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ResearchSessionsDock;
