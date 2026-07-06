import { Brain, DollarSign, Inbox, Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';

interface InboxAIEvalRun {
  id: string;
  ran_at: string;
  total_items: number;
  correct: number;
  accuracy: number;
  cost_usd: number | null;
}

interface InboxAICostSummary {
  totalCostUsd: number;
  callCount: number;
  days: number;
}

export const AIInboxAutomationSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { emitMyWorkEvent } = useAppStore();

  const didLoadThreshold = useRef(false);
  const [threshold, setThreshold] = useState(0.85);
  const [manualReviewCount, setManualReviewCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canonicalStats, setCanonicalStats] = useState<{
    total?: number;
    actionRequired?: number;
  } | null>(null);
  const [aiEvalRuns, setAiEvalRuns] = useState<InboxAIEvalRun[]>([]);
  const [aiCostSummary, setAiCostSummary] = useState<InboxAICostSummary | null>(null);

  useEffect(() => {
    const loadInboxAISettings = async () => {
      const data = await Api.get('/settings/preferences/inbox-ai').catch(() => null);
      const persistedThreshold = data?.preferences?.threshold;
      if (typeof persistedThreshold === 'number') {
        setThreshold(Math.max(0.5, Math.min(0.99, persistedThreshold)));
      }
      didLoadThreshold.current = true;
    };

    loadInboxAISettings();
  }, []);

  useEffect(() => {
    if (!didLoadThreshold.current) return;
    const timeout = window.setTimeout(() => {
      Api.put('/settings/preferences/inbox-ai', { threshold }).catch(() => {
        toast.error(
          isPolish
            ? 'Nie udało się zapisać progu auto-triage'
            : 'Failed to save auto-triage threshold'
        );
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [isPolish, threshold]);

  const fetchDiagnostics = useCallback(async () => {
    try {
      setLoading(true);
      await Api.materializeInbox().catch(() => null);
      const [statsRes, runsRes, costRes] = await Promise.all([
        Api.getCanonicalInboxStats().catch(() => null),
        Api.getInboxEvalRuns(5).catch(() => ({ runs: [] })),
        Api.getInboxEvalsCostSummary(30).catch(() => null),
      ]);

      setCanonicalStats(statsRes);
      setAiEvalRuns(Array.isArray(runsRes?.runs) ? runsRes.runs : []);
      setAiCostSummary(costRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleRunAutoTriage = async () => {
    setRunning(true);
    try {
      const data = await Api.post('/my-work/inbox/auto-triage', { threshold });
      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      const autoApplyItems = suggestions.filter((item: any) => item.autoApply);
      const manualItems = suggestions.filter((item: any) => !item.autoApply);

      setManualReviewCount(manualItems.length);

      for (const item of autoApplyItems) {
        try {
          await Api.post(`/my-work/inbox/${item.itemId}/triage`, {
            action: item.suggestedAction,
            itemKey: item.itemKey,
            fromAISuggestion: true,
            confidence: item.confidence,
          });
        } catch {
          // keep processing remaining suggestions
        }
      }

      if (autoApplyItems.length > 0) {
        toast.success(
          isPolish
            ? `${autoApplyItems.length} elementów automatycznie przetriage'owano`
            : `${autoApplyItems.length} items were auto-triaged`
        );
        emitMyWorkEvent({ type: 'item:triaged', entityType: 'inbox', entityId: 'bulk' });
      } else if (manualItems.length > 0) {
        toast.success(
          isPolish
            ? `${manualItems.length} sugestii czeka na ręczny przegląd`
            : `${manualItems.length} suggestions are waiting for manual review`
        );
      } else {
        toast.success(
          isPolish
            ? 'Brak pozycji spełniających warunki auto-triage'
            : 'No items matched auto-triage'
        );
      }

      await fetchDiagnostics();
    } catch {
      toast.error(isPolish ? 'Auto-triage nieudany' : 'Auto-triage failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {isPolish ? 'Automatyzacja inboxu AI' : 'AI inbox automation'}
          </h3>
          <p className="mt-1 text-sm text-c-text-muted">
            {isPolish
              ? 'Sterowanie auto-triage i diagnostyką inboxu zostało przeniesione z widoku Inbox do ustawień AI użytkownika.'
              : 'Auto-triage controls and inbox diagnostics were moved from Inbox into user AI settings.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
                <Brain size={18} className="text-blue-500" />
                {isPolish ? 'Próg auto-apply' : 'Auto-apply threshold'}
              </div>
              <p className="mt-1 text-sm text-c-text-muted">
                {isPolish
                  ? 'Po przekroczeniu tego progu AI może automatycznie wykonać sugerowaną akcję dla pozycji z inboxu.'
                  : 'Above this threshold, AI can automatically apply its suggested inbox action.'}
              </p>
            </div>
            <button
              onClick={handleRunAutoTriage}
              disabled={running}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-blue-300/40 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100/70 disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/15"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isPolish ? 'Uruchom auto-triage' : 'Run auto-triage'}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-c-text-secondary">
              {isPolish ? 'Bieżący próg' : 'Current threshold'}
            </span>
            <span className="font-semibold text-c-text">
              {Math.round(threshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-3 w-full accent-blue-600"
          />
          <p className="mt-3 text-xs text-c-text-muted">
            {isPolish
              ? `${manualReviewCount} sugestii z ostatniego uruchomienia czeka na ręczną decyzję.`
              : `${manualReviewCount} suggestions from the latest run are waiting for manual review.`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
              <Sparkles size={16} className="text-c-accent" />
              {isPolish ? 'Ewale i koszt' : 'Evals and cost'}
            </div>
            <div className="mt-4 flex items-center gap-6">
              <div>
                <div className="text-2xl font-semibold text-c-text">
                  {aiEvalRuns[0] ? `${Math.round((aiEvalRuns[0].accuracy || 0) * 100)}%` : '—'}
                </div>
                <div className="text-xs text-c-text-muted">
                  {isPolish ? 'ostatni eval accuracy' : 'latest eval accuracy'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-c-text">
                  {aiCostSummary ? `$${(aiCostSummary.totalCostUsd || 0).toFixed(2)}` : '—'}
                </div>
                <div className="text-xs text-c-text-muted">
                  {isPolish ? 'koszt 30 dni' : '30-day cost'}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-c-text-muted">
              {loading
                ? isPolish
                  ? 'Ładowanie diagnostyki AI...'
                  : 'Loading AI diagnostics...'
                : isPolish
                  ? `${aiCostSummary?.callCount || 0} wywołań, ${aiEvalRuns.length} ostatnich runów`
                  : `${aiCostSummary?.callCount || 0} calls, ${aiEvalRuns.length} recent runs`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
              <Inbox size={16} className="text-emerald-500" />
              {isPolish ? 'Canonical inbox' : 'Canonical inbox'}
            </div>
            <div className="mt-4 flex items-center gap-6">
              <div>
                <div className="text-2xl font-semibold text-c-text">
                  {canonicalStats?.total ?? 0}
                </div>
                <div className="text-xs text-c-text-muted">
                  {isPolish ? 'łączna liczba pozycji' : 'total items'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-c-text">
                  {canonicalStats?.actionRequired ?? 0}
                </div>
                <div className="text-xs text-c-text-muted">
                  {isPolish ? 'wymaga akcji' : 'action required'}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-c-text-muted">
              {isPolish
                ? 'Inbox materializuje canonical items przed odświeżeniem tych statystyk.'
                : 'Inbox materializes canonical items before refreshing these stats.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
              <DollarSign size={16} className="text-amber-500" />
              {isPolish ? 'Szybki kontekst' : 'Quick context'}
            </div>
            <div className="mt-4 space-y-3 text-sm text-c-text-secondary">
              <div className="flex items-center justify-between">
                <span>{isPolish ? 'Ostatnie runy eval' : 'Recent eval runs'}</span>
                <span className="font-semibold text-c-text">
                  {aiEvalRuns.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isPolish ? 'Koszt okna' : 'Cost window'}</span>
                <span className="font-semibold text-c-text">
                  {aiCostSummary?.days ?? 30}d
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isPolish ? 'Manual review' : 'Manual review'}</span>
                <span className="font-semibold text-c-text">
                  {manualReviewCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInboxAutomationSettings;
