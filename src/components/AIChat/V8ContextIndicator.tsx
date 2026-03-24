import { Search, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useV8Gate } from '@/hooks/useV8Gate';
import { useV8Snapshots } from '@/hooks/useV8Chat';
import { useV8ConversationRetrievalTraces } from '@/hooks/useV8Retrieval';

interface V8ContextIndicatorProps {
  conversationId: string | null;
}

export function V8ContextIndicator({ conversationId }: V8ContextIndicatorProps) {
  const { t } = useTranslation();
  const { showV8Chat } = useV8Gate();
  const [isOpen, setIsOpen] = useState(false);

  const { data: snapshots, isLoading, isError } = useV8Snapshots(
    showV8Chat && conversationId ? conversationId : undefined,
  );
  const {
    data: retrievalTraces,
    isLoading: retrievalLoading,
    isError: retrievalError,
  } = useV8ConversationRetrievalTraces(showV8Chat && conversationId ? conversationId : undefined);

  if (!showV8Chat) return null;
  if ((isLoading || isError) && (retrievalLoading || retrievalError)) return null;

  const items = Array.isArray(snapshots) ? snapshots : [];
  const traces = Array.isArray(retrievalTraces) ? retrievalTraces : [];
  const latestTrace = traces.length > 0 ? traces[traces.length - 1] : null;

  if (items.length === 0 && traces.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="v8-context-indicator"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/35"
        title={t('v8.contextSnapshots', 'V8 Context Snapshots: {{count}}', { count: items.length })}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        V8 {items.length}
        {traces.length > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white/80 px-1.5 py-0.5 text-[10px] text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/50 dark:text-violet-300">
            <Search size={10} />
            RAG {traces.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="v8-context-panel"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('v8.contextSummary', 'Governed V8 context')}
          </div>

          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              {t('v8.contextSnapshotsLabel', 'Snapshots')}
            </div>
            <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
              {t('v8.contextSnapshotsCount', '{{count}} snapshot(s) captured for this conversation', {
                count: items.length,
              })}
            </div>
          </div>

          <div
            className={`mt-3 rounded-xl border p-3 ${
              traces.length > 0
                ? 'border-violet-200 bg-violet-50/80 dark:border-violet-900/60 dark:bg-violet-950/20'
                : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70'
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-900 dark:text-slate-100">
              <ShieldCheck size={13} />
              {t('v8.retrievalSummary', 'Governed retrieval')}
            </div>

            {latestTrace ? (
              <div
                data-testid="v8-retrieval-summary"
                className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-violet-200/80 bg-white/80 px-2 py-1.5 dark:border-violet-900/60 dark:bg-violet-950/40">
                    <div className="opacity-70">{t('v8.retrievalPreset', 'Preset')}</div>
                    <div className="mt-0.5 font-medium">{latestTrace.presetUsed}</div>
                  </div>
                  <div className="rounded-lg border border-violet-200/80 bg-white/80 px-2 py-1.5 dark:border-violet-900/60 dark:bg-violet-950/40">
                    <div className="opacity-70">{t('v8.retrievalResults', 'Results')}</div>
                    <div className="mt-0.5 font-medium">{latestTrace.resultsReturned}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-violet-800 dark:text-violet-200">
                  <span>{t('v8.retrievalDenied', 'Denied')}: {latestTrace.deniedEntries.length}</span>
                  <span>{t('v8.retrievalWarnings', 'Warnings')}: {latestTrace.freshnessWarnings.length}</span>
                  <span>{t('v8.retrievalLatency', 'Latency')}: {latestTrace.totalLatencyMs}ms</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'v8.retrievalEmpty',
                  'No governed retrieval traces recorded for this conversation yet.',
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
