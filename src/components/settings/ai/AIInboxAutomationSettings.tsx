import { Brain, DollarSign, Inbox, Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';

const INBOX_AI_SETTINGS_STORAGE_KEY = 'consultify-inbox-ai-settings';

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

function loadInboxAITriageThreshold(): number {
  try {
    const raw = localStorage.getItem(INBOX_AI_SETTINGS_STORAGE_KEY);
    if (!raw) return 0.85;
    const parsed = JSON.parse(raw) as { threshold?: unknown };
    const threshold = typeof parsed?.threshold === 'number' ? parsed.threshold : 0.85;
    return Math.max(0.5, Math.min(0.99, threshold));
  } catch {
    return 0.85;
  }
}

function saveInboxAITriageThreshold(threshold: number) {
  try {
    localStorage.setItem(
      INBOX_AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ threshold: Math.max(0.5, Math.min(0.99, threshold)) })
    );
  } catch {
    // ignore local storage write failures
  }
}

export const AIInboxAutomationSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { emitMyWorkEvent } = useAppStore();

  const [threshold, setThreshold] = useState(loadInboxAITriageThreshold);
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
    saveInboxAITriageThreshold(threshold);
  }, [threshold]);

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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPolish ? 'Automatyzacja inboxu AI' : 'AI inbox automation'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Sterowanie auto-triage i diagnostyką inboxu zostało przeniesione z widoku Inbox do ustawień AI użytkownika.'
              : 'Auto-triage controls and inbox diagnostics were moved from Inbox into user AI settings.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Brain size={18} className="text-cyan-500" />
                {isPolish ? 'Próg auto-apply' : 'Auto-apply threshold'}
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Po przekroczeniu tego progu AI może automatycznie wykonać sugerowaną akcję dla pozycji z inboxu.'
                  : 'Above this threshold, AI can automatically apply its suggested inbox action.'}
              </p>
            </div>
            <button
              onClick={handleRunAutoTriage}
              disabled={running}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-50 px-4 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-100/70 disabled:opacity-50 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/15"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isPolish ? 'Uruchom auto-triage' : 'Run auto-triage'}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              {isPolish ? 'Bieżący próg' : 'Current threshold'}
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
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
            className="mt-3 w-full accent-cyan-600"
          />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? `${manualReviewCount} sugestii z ostatniego uruchomienia czeka na ręczną decyzję.`
              : `${manualReviewCount} suggestions from the latest run are waiting for manual review.`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Sparkles size={16} className="text-violet-500" />
              {isPolish ? 'Ewale i koszt' : 'Evals and cost'}
            </div>
            <div className="mt-4 flex items-center gap-6">
              <div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {aiEvalRuns[0] ? `${Math.round((aiEvalRuns[0].accuracy || 0) * 100)}%` : '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? 'ostatni eval accuracy' : 'latest eval accuracy'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {aiCostSummary ? `$${(aiCostSummary.totalCostUsd || 0).toFixed(2)}` : '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? 'koszt 30 dni' : '30-day cost'}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {loading
                ? isPolish
                  ? 'Ładowanie diagnostyki AI...'
                  : 'Loading AI diagnostics...'
                : isPolish
                  ? `${aiCostSummary?.callCount || 0} wywołań, ${aiEvalRuns.length} ostatnich runów`
                  : `${aiCostSummary?.callCount || 0} calls, ${aiEvalRuns.length} recent runs`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Inbox size={16} className="text-emerald-500" />
              {isPolish ? 'Canonical inbox' : 'Canonical inbox'}
            </div>
            <div className="mt-4 flex items-center gap-6">
              <div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {canonicalStats?.total ?? 0}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? 'łączna liczba pozycji' : 'total items'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {canonicalStats?.actionRequired ?? 0}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? 'wymaga akcji' : 'action required'}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Inbox materializuje canonical items przed odświeżeniem tych statystyk.'
                : 'Inbox materializes canonical items before refreshing these stats.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <DollarSign size={16} className="text-amber-500" />
              {isPolish ? 'Szybki kontekst' : 'Quick context'}
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>{isPolish ? 'Ostatnie runy eval' : 'Recent eval runs'}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {aiEvalRuns.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isPolish ? 'Koszt okna' : 'Cost window'}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {aiCostSummary?.days ?? 30}d
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{isPolish ? 'Manual review' : 'Manual review'}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
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
