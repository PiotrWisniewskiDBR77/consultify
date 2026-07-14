import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '../../../services/api';

type TraceRun = Record<string, any>;

function safeParseJson(raw: unknown): any {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const ChatTracesViewer: React.FC = () => {
  const [runs, setRuns] = useState<TraceRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ run: any; events: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.listChatTraces({ limit: 50, offset: 0 });
      setRuns(Array.isArray((data as any)?.runs) ? (data as any).runs : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load traces');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    setDetailLoading(true);
    setError(null);
    try {
      const data = await Api.getChatTrace(runId);
      setSelected({
        run: (data as any)?.run || null,
        events: Array.isArray((data as any)?.events) ? (data as any).events : [],
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load trace');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selectedRequest = useMemo(
    () => safeParseJson((selected?.run as any)?.request_json),
    [selected]
  );
  const selectedContext = useMemo(
    () => safeParseJson((selected?.run as any)?.context_json),
    [selected]
  );
  const selectedEval = useMemo(() => safeParseJson((selected?.run as any)?.eval_json), [selected]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">Chat traces</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Per-run backend traces for streaming chat.
            </div>
          </div>
          <button
            onClick={fetchList}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-700"
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-danger-600 dark:text-danger-400 border-b border-slate-200 dark:border-navy-700">
            {error}
          </div>
        )}

        <div className="max-h-[70vh] overflow-auto">
          <table
            /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full text-sm"
          >
            <thead className="sticky top-0 bg-slate-50 dark:bg-navy-900 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Started</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Model</th>
                <th className="text-right px-4 py-2 font-medium">Latency</th>
                <th className="text-right px-4 py-2 font-medium">Chars</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const id = String(r.id || '');
                const isActive = selectedRunId === id;
                return (
                  <tr
                    key={id}
                    className={`border-t border-slate-100 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer ${
                      isActive ? 'bg-slate-50 dark:bg-navy-700' : ''
                    }`}
                    onClick={() => id && fetchDetail(id)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                      {String(r.started_at || '')
                        .slice(0, 19)
                        .replace('T', ' ')}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          r.status === 'completed'
                            ? 'border-green-200 text-green-700 dark:border-green-700/40 dark:text-green-300'
                            : r.status === 'error'
                              ? 'border-danger-200 text-danger-700 dark:border-danger-700/40 dark:text-danger-300'
                              : 'border-slate-200 text-slate-600 dark:border-navy-600 dark:text-slate-300'
                        }`}
                      >
                        {String(r.status || '')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      <div className="truncate max-w-[220px]">
                        {String(r.model_provider || '')}/{String(r.model_id || '')}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {r.latency_ms ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {r.output_chars ?? '—'}
                    </td>
                  </tr>
                );
              })}
              {runs.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    No traces found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <div className="font-semibold text-slate-800 dark:text-slate-100">Trace details</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {selectedRunId ? `Run: ${selectedRunId}` : 'Select a run from the list.'}
          </div>
        </div>

        {detailLoading && (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
        )}

        {!detailLoading && selected?.run && (
          <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Status</div>
                <div className="text-slate-800 dark:text-slate-100">
                  {String(selected.run.status)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Latency</div>
                <div className="text-slate-800 dark:text-slate-100">
                  {selected.run.latency_ms ?? '—'} ms
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Model</div>
                <div className="text-slate-800 dark:text-slate-100">
                  {String(selected.run.model_provider || '')}/{String(selected.run.model_id || '')}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Pipeline trace</div>
                <div className="text-slate-800 dark:text-slate-100">
                  {String(selected.run.pipeline_trace_id || '—')}
                </div>
              </div>
            </div>

            {(selectedRequest || selectedContext) && (
              <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Request / Context
                </div>
                <pre className="p-3 text-xs overflow-auto text-slate-700 dark:text-slate-200">
                  {JSON.stringify({ request: selectedRequest, context: selectedContext }, null, 2)}
                </pre>
              </div>
            )}

            {selectedEval && (
              <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Eval (heuristic)
                </div>
                <pre className="p-3 text-xs overflow-auto text-slate-700 dark:text-slate-200">
                  {JSON.stringify(selectedEval, null, 2)}
                </pre>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Events
              </div>
              <div className="divide-y divide-slate-100 dark:divide-navy-700">
                {(selected.events || []).map((e: any) => (
                  <div key={String(e.id)} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {String(e.type)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {String(e.ts || '')
                          .slice(0, 19)
                          .replace('T', ' ')}
                      </div>
                    </div>
                    {e.data_json && (
                      <pre className="mt-2 text-xs overflow-auto text-slate-700 dark:text-slate-200">
                        {JSON.stringify(safeParseJson(e.data_json) || e.data_json, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {(selected.events || []).length === 0 && (
                  <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No events.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {!detailLoading && !selected?.run && (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
            Select a run to view details.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatTracesViewer;
