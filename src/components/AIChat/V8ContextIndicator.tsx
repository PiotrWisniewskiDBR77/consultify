import {
  AlertTriangle,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useV8CreateHandoff, useV8Handoffs, useV8Snapshots } from '@/hooks/useV8Chat';
import { useV8Gate } from '@/hooks/useV8Gate';
import { useV8ConversationRetrievalTraces } from '@/hooks/useV8Retrieval';
import { CHAT_HEADER_SELECTOR_CLASS } from '@/components/AIChat/chatHeaderControlStyles';

interface V8ContextIndicatorProps {
  conversationId: string | null;
  defaultGoal?: string;
}

export function V8ContextIndicator({ conversationId, defaultGoal = '' }: V8ContextIndicatorProps) {
  const { t } = useTranslation();
  const { showV8Chat } = useV8Gate();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    data: snapshots,
    isLoading,
    isError,
    refetch: refetchSnapshots,
  } = useV8Snapshots(showV8Chat && conversationId ? conversationId : undefined);
  const {
    data: handoffs,
    isLoading: handoffsLoading,
    isError: handoffsError,
    refetch: refetchHandoffs,
  } = useV8Handoffs(showV8Chat && conversationId ? conversationId : undefined);
  const createHandoff = useV8CreateHandoff();
  const {
    data: retrievalTraces,
    isLoading: retrievalLoading,
    isError: retrievalError,
    refetch: refetchRetrieval,
  } = useV8ConversationRetrievalTraces(showV8Chat && conversationId ? conversationId : undefined);

  const items = Array.isArray(snapshots) ? snapshots : [];
  const handoffItems = Array.isArray(handoffs) ? handoffs : [];
  const traces = Array.isArray(retrievalTraces) ? retrievalTraces : [];
  const latestSnapshot = items.length > 0 ? items[items.length - 1] : null;
  const latestTrace = traces.length > 0 ? traces[traces.length - 1] : null;
  const latestHandoff = handoffItems.length > 0 ? handoffItems[handoffItems.length - 1] : null;
  const isAnyLoading = isLoading || retrievalLoading || handoffsLoading;
  const isDegraded = isError || retrievalError || handoffsError;
  const normalizedGoal = defaultGoal.trim();
  const canCreateHandoff =
    Boolean(conversationId) &&
    Boolean(latestSnapshot?.snapshotId) &&
    normalizedGoal.length > 0 &&
    latestHandoff?.goal !== normalizedGoal;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  const handleRetry = async () => {
    const retries: Array<Promise<unknown>> = [];
    if (typeof refetchSnapshots === 'function') retries.push(refetchSnapshots());
    if (typeof refetchHandoffs === 'function') retries.push(refetchHandoffs());
    if (typeof refetchRetrieval === 'function') retries.push(refetchRetrieval());
    await Promise.allSettled(retries);
  };

  if (!showV8Chat || !conversationId) return null;
  if (
    !isAnyLoading &&
    !isDegraded &&
    items.length === 0 &&
    traces.length === 0 &&
    handoffItems.length === 0
  )
    return null;

  const handleCreateHandoff = async () => {
    if (!conversationId || !latestSnapshot?.snapshotId || !normalizedGoal) return;
    try {
      await createHandoff.mutateAsync({
        conversationId,
        contextSnapshotId: latestSnapshot.snapshotId,
        goal: normalizedGoal,
      });
      toast.success(
        t('v8.handoffCreated', 'Governed handoff created from the active conversation')
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.handoffCreateFailed', 'Failed to create governed handoff')
      );
    }
  };

  return (
    <div className="relative" data-chat-header-control-variant="status-selector">
      <button
        ref={triggerRef}
        type="button"
        data-testid="v8-context-indicator"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className={`${CHAT_HEADER_SELECTOR_CLASS} px-2 text-[11px] font-medium ${
          isDegraded
            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
        }`}
        title={t('v8.contextSnapshots', 'V8 Context Snapshots: {{count}}', { count: items.length })}
      >
        {isDegraded ? (
          <AlertTriangle size={11} aria-hidden="true" />
        ) : isAnyLoading ? (
          <Loader2 size={11} className="animate-spin" aria-hidden="true" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        )}
        V8 {items.length}
        {traces.length > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white/80 px-1.5 py-0.5 text-[10px] text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300">
            <Search size={10} />
            RAG {traces.length}
          </span>
        )}
        {handoffItems.length > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white/80 px-1.5 py-0.5 text-[10px] text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300">
            <GitBranch size={10} />H {handoffItems.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          data-testid="v8-context-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
          className="fixed inset-x-3 top-14 z-30 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:max-h-[min(70vh,640px)] sm:w-[min(360px,calc(100vw-24px))] dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex items-start justify-between gap-3">
            <div
              id={`${panelId}-title`}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('v8.contextSummary', 'Governed V8 context')}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:hover:bg-slate-900 dark:hover:text-slate-100"
              aria-label={t('common.close', 'Close')}
            >
              <X size={16} />
            </button>
          </div>

          {isDegraded && (
            <div
              data-testid="v8-context-degraded"
              role="alert"
              className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="font-medium">
                {t('v8.contextUnavailable', 'Some governed context is unavailable')}
              </div>
              <div className="mt-1">
                {t(
                  'v8.contextUnavailableHint',
                  'No missing source is treated as loaded. Retry, or continue without creating a handoff.'
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-medium hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:border-amber-700 dark:bg-amber-950/60 dark:hover:bg-amber-900/50"
              >
                <RefreshCw size={14} />
                {t('common.tryAgain', 'Try again')}
              </button>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              {t('v8.contextSnapshotsLabel', 'Snapshots')}
            </div>
            <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
              {t(
                'v8.contextSnapshotsCount',
                '{{count}} snapshot(s) captured for this conversation',
                {
                  count: items.length,
                }
              )}
            </div>
          </div>

          <div
            className={`mt-3 rounded-xl border p-3 ${
              handoffItems.length > 0
                ? 'border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20'
                : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70'
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-900 dark:text-slate-100">
              <GitBranch size={13} />
              {t('v8.handoffSummary', 'Governed handoffs')}
            </div>

            {latestHandoff ? (
              <div
                data-testid="v8-handoff-summary"
                className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-sky-200/80 bg-white/80 px-2 py-1.5 dark:border-sky-900/60 dark:bg-sky-950/40">
                    <div className="opacity-70">{t('v8.handoffCount', 'Handoffs')}</div>
                    <div className="mt-0.5 font-medium">{handoffItems.length}</div>
                  </div>
                  <div className="rounded-lg border border-sky-200/80 bg-white/80 px-2 py-1.5 dark:border-sky-900/60 dark:bg-sky-950/40">
                    <div className="opacity-70">{t('v8.handoffIntent', 'Intent')}</div>
                    <div className="mt-0.5 font-medium">
                      {latestHandoff.intentClassification?.intentType || 'unknown'}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-sky-200/80 bg-white/80 px-2 py-1.5 dark:border-sky-900/60 dark:bg-sky-950/40">
                  <div className="opacity-70">{t('v8.handoffGoal', 'Latest goal')}</div>
                  <div className="mt-0.5 font-medium">{latestHandoff.goal}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-sky-800 dark:text-sky-200">
                  <span>
                    {t('v8.handoffRun', 'Run')}: {latestHandoff.executionRunId}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t('v8.handoffEmpty', 'No governed handoffs recorded for this conversation yet.')}
              </div>
            )}

            {canCreateHandoff && (
              <button
                type="button"
                data-testid="v8-handoff-create"
                onClick={handleCreateHandoff}
                disabled={createHandoff.isPending}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60"
              >
                {createHandoff.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {t('v8.handoffCreateAction', 'Create governed handoff')}
              </button>
            )}
          </div>

          <div
            className={`mt-3 rounded-xl border p-3 ${
              traces.length > 0
                ? 'border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20'
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
                  <div className="rounded-lg border border-sky-200/80 bg-white/80 px-2 py-1.5 dark:border-sky-900/60 dark:bg-sky-950/40">
                    <div className="opacity-70">{t('v8.retrievalPreset', 'Preset')}</div>
                    <div className="mt-0.5 font-medium">{latestTrace.presetUsed}</div>
                  </div>
                  <div className="rounded-lg border border-sky-200/80 bg-white/80 px-2 py-1.5 dark:border-sky-900/60 dark:bg-sky-950/40">
                    <div className="opacity-70">{t('v8.retrievalResults', 'Results')}</div>
                    <div className="mt-0.5 font-medium">{latestTrace.resultsReturned}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-sky-800 dark:text-sky-200">
                  <span>
                    {t('v8.retrievalDenied', 'Denied')}: {latestTrace.deniedEntries.length}
                  </span>
                  <span>
                    {t('v8.retrievalWarnings', 'Warnings')}: {latestTrace.freshnessWarnings.length}
                  </span>
                  <span>
                    {t('v8.retrievalLatency', 'Latency')}: {latestTrace.totalLatencyMs}ms
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'v8.retrievalEmpty',
                  'No governed retrieval traces recorded for this conversation yet.'
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
