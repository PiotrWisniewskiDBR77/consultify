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

type ResearchSessionView = {
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

const STATUS_ICON = {
  planned: Clock3,
  approved: CheckCircle2,
  running: RefreshCw,
  paused: Pause,
  completed: FileText,
  failed: AlertTriangle,
  archived: Archive,
};

export const ResearchSessionsDock: React.FC = () => {
  const [sessions, setSessions] = React.useState<ResearchSessionView[]>([]);
  const [selected, setSelected] = React.useState<ResearchSessionView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.listResearchSessions({ limit: 50 });
      const next = Array.isArray(res?.sessions) ? res.sessions : [];
      setSessions(next);
      if (!selected && next.length > 0) setSelected(next[0]);
      if (selected) {
        const fresh = next.find(
          (session: ResearchSessionView) => session.sessionId === selected.sessionId
        );
        if (fresh) setSelected(fresh);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load research sessions');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  React.useEffect(() => {
    load();
  }, [load]);

  const refreshSelected = async (sessionId: string) => {
    const res = await Api.getResearchSession(sessionId);
    if (res?.session) setSelected(res.session);
    await load();
  };

  const approve = async (sessionId: string) => {
    await Api.approveResearchSession(sessionId);
    await refreshSelected(sessionId);
  };

  const start = async (sessionId: string) => {
    await Api.startResearchSession(sessionId);
    await refreshSelected(sessionId);
  };

  const cancel = async (sessionId: string) => {
    await Api.cancelResearchSessionV1(sessionId);
    await refreshSelected(sessionId);
  };

  const resume = async (sessionId: string) => {
    await Api.resumeResearchSession(sessionId);
    await refreshSelected(sessionId);
  };

  const retry = async (sessionId: string) => {
    await Api.retryResearchSession(sessionId);
    await refreshSelected(sessionId);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-300 font-semibold">
          Consultify AI OS
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Research Sessions</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Reproducible Deep Research with lifecycle, evidence graph, citations and final report
          artifacts.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Session Dock</h2>
              <p className="text-xs text-slate-500">Start, pause, resume and retry research.</p>
            </div>
            <button type="button" onClick={load} className="text-xs rounded-md border px-3 py-1.5">
              Refresh
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-navy-800">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading research sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No research sessions yet.</div>
            ) : (
              sessions.map((session) => {
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
              })
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
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white"
                  >
                    Approve
                  </button>
                )}
                {selected.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => start(selected.sessionId)}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white"
                  >
                    <Play size={12} className="inline mr-1" />
                    Start
                  </button>
                )}
                {selected.status === 'running' && (
                  <button
                    type="button"
                    onClick={() => cancel(selected.sessionId)}
                    className="rounded-md border px-3 py-1.5 text-xs"
                  >
                    Pause
                  </button>
                )}
                {selected.status === 'paused' && (
                  <button
                    type="button"
                    onClick={() => resume(selected.sessionId)}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white"
                  >
                    Resume
                  </button>
                )}
                {selected.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => retry(selected.sessionId)}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white"
                  >
                    Retry
                  </button>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-navy-950 p-3 text-sm">
                <div className="text-xs text-slate-500">Progress</div>
                <div className="mt-1 text-slate-700 dark:text-slate-200">
                  {selected.progress?.stage || selected.status} · {selected.progress?.percent ?? 0}%
                </div>
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
                        className="rounded-lg border border-slate-100 dark:border-navy-800 p-2 text-xs"
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
