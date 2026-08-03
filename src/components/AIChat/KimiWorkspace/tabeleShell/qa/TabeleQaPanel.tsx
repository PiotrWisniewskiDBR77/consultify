/**
 * TabeleQaPanel — orchestrator panel rendered in the right rail when
 * the user clicks the QA Report icon in `<TabeleRightRail>`.
 *
 * Composes:
 *   - `<QaHealthBar>` (top, overall + 5-axis stacked bar)
 *   - `<QaAxisCard>` × 5 ("Why this score?" expansions)
 *   - `<QaSuggestionList>` (bottom, actionable)
 *
 * Wires:
 *   - "Recompute" button → `recomputeQaReport(tableId)`.
 *   - "Open in AI Editor" → forwarded via `onOpenInAiEditor` callback so
 *     the parent shell can swap the right-rail tool to ai-editor and
 *     prefill the level/payload (handled in `<TabeleAiEditorPanel>`).
 *   - "Mark not applicable" → `dismissQaSuggestion(...)` then optimistic
 *     local filter, followed by a recompute to refresh.
 *
 * Block C · EPIC-T11 · Sprint C-S5.
 */

import { Loader2, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  dismissQaSuggestion,
  getLatestQaReport,
  type QaReport,
  type QaSuggestion,
  recomputeQaReport,
} from '@/services/api/tablePlatform.api';

import { QaAxisCard } from './QaAxisCard';
import { QaHealthBar } from './QaHealthBar';
import { QaSuggestionList } from './QaSuggestionList';

export interface TabeleQaPanelProps {
  tableId: string;
  /** Forwarded by the parent shell to swap to the AI Editor panel and
   *  prefill it with the suggestion's recommended action. */
  onOpenInAiEditor?: (suggestion: QaSuggestion) => void;
  /** Test seam: when set, the component skips network calls and uses
   *  the supplied report. */
  testInitialReport?: QaReport | null;
}

export const TabeleQaPanel: React.FC<TabeleQaPanelProps> = ({
  tableId,
  onOpenInAiEditor,
  testInitialReport,
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<QaReport | null>(testInitialReport ?? null);
  const [loading, setLoading] = useState(testInitialReport === undefined);
  const [computing, setComputing] = useState(false);
  const [optimisticDismissed, setOptimisticDismissed] = useState<Set<string>>(new Set());

  const loadLatest = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const latest = await getLatestQaReport(tableId);
      setReport(latest);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.qa.loadFailed', {
          defaultValue: 'Failed to load QA report: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.qa.unknownError', 'unknown error'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, [tableId, t]);

  useEffect(() => {
    if (testInitialReport !== undefined) return;
    void loadLatest();
  }, [loadLatest, testInitialReport]);

  const handleRecompute = useCallback(async () => {
    if (!tableId) return;
    setComputing(true);
    try {
      const fresh = await recomputeQaReport(tableId, 'on_demand');
      setReport(fresh);
      setOptimisticDismissed(new Set());
      toast.success(t('kimi.tabeleShell.qa.refreshed', 'QA report refreshed'));
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.qa.recomputeFailed', {
          defaultValue: 'Failed to recompute: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.qa.unknownError', 'unknown error'),
        })
      );
    } finally {
      setComputing(false);
    }
  }, [tableId, t]);

  const handleDismiss = useCallback(
    async (s: QaSuggestion) => {
      try {
        // Optimistic UI: remove now, refresh in the background.
        setOptimisticDismissed((prev) => {
          const next = new Set(prev);
          next.add(s.fingerprint);
          return next;
        });
        await dismissQaSuggestion(tableId, s.id, s.fingerprint);
        toast.success(t('kimi.tabeleShell.qa.dismissed', 'Suggestion marked not applicable'));
      } catch (e) {
        // Rollback on error.
        setOptimisticDismissed((prev) => {
          const next = new Set(prev);
          next.delete(s.fingerprint);
          return next;
        });
        toast.error(
          t('kimi.tabeleShell.qa.dismissFailed', {
            defaultValue: 'Failed to dismiss: {{reason}}',
            reason: (e as Error)?.message ?? t('kimi.tabeleShell.qa.unknownError', 'unknown error'),
          })
        );
      }
    },
    [tableId, t]
  );

  const visibleSuggestions = (report?.suggestions ?? []).filter(
    (s) => !optimisticDismissed.has(s.fingerprint)
  );

  return (
    <section
      className="flex h-full flex-col gap-3 p-3"
      data-testid="tabele-qa-panel"
      aria-label={t('kimi.tabeleShell.qa.ariaLabel', 'Tabele QA report')}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">
          {t('kimi.tabeleShell.qa.title', 'QA Report')}
        </h3>
        <button
          type="button"
          onClick={handleRecompute}
          disabled={computing || !tableId}
          className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs text-c-text hover:bg-c-surface-raised disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          data-testid="qa-recompute-button"
          aria-label={t('kimi.tabeleShell.qa.recomputeAriaLabel', 'Recompute QA report')}
        >
          {computing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {t('kimi.tabeleShell.qa.recompute', 'Recompute')}
        </button>
      </header>

      <QaHealthBar report={report} computing={loading || computing} />

      {report && (
        <div className="space-y-1.5" data-testid="qa-axes">
          <QaAxisCard axisName="completeness" detail={report.axes.completeness} />
          <QaAxisCard axisName="sourceCoverage" detail={report.axes.sourceCoverage} />
          <QaAxisCard axisName="methodology" detail={report.axes.methodology} />
          <QaAxisCard axisName="freshness" detail={report.axes.freshness} />
          <QaAxisCard axisName="formulaConsistency" detail={report.axes.formulaConsistency} />
        </div>
      )}

      <div>
        <h4 className="mb-1.5 text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.qa.suggestions', 'Suggestions')}
        </h4>
        <QaSuggestionList
          suggestions={visibleSuggestions}
          onOpenInAiEditor={onOpenInAiEditor}
          onDismiss={handleDismiss}
        />
      </div>
    </section>
  );
};

export default TabeleQaPanel;
