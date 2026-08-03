import { ArrowRight, Check, Inbox, Loader2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { V8ResultsApi, type V8ResultsClosureBenefit } from '@/services/api/v8/results';

/**
 * M14 → M15 closure-handoff inbox (Decision B1b).
 *
 * Reader for benefits materialized by the closure handoff
 * (`initiative_benefits.source_tag = 'M14_CLOSURE_HANDOFF'`). Lists each
 * incoming benefit with its source KPI, owning initiative, target and closure
 * date, and lets the user promote it into a tracked sustainment KPI or dismiss
 * it. Deliberately a single, self-contained section — no page reload.
 */
export const M14HandoffInbox: React.FC<{ onPromoted?: () => void }> = ({ onPromoted }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<V8ResultsClosureBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await V8ResultsApi.getClosureBenefitsInbox();
      setItems(res?.items ?? []);
    } catch {
      setError(t('results.handoffInbox.loadError', 'Failed to load incoming benefits.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePromote = useCallback(
    async (benefit: V8ResultsClosureBenefit) => {
      setBusyId(benefit.id);
      try {
        await V8ResultsApi.promoteClosureBenefit(benefit.id);
        setItems((prev) => prev.filter((b) => b.id !== benefit.id));
        toast.success(
          t('results.handoffInbox.promoted', 'Promoted to tracked KPI: {{name}}', {
            name: benefit.kpiName,
          })
        );
        onPromoted?.();
      } catch {
        toast.error(t('results.handoffInbox.promoteError', 'Could not promote benefit.'));
      } finally {
        setBusyId(null);
      }
    },
    [t, onPromoted]
  );

  const handleDismiss = useCallback(
    async (benefit: V8ResultsClosureBenefit) => {
      setBusyId(benefit.id);
      try {
        await V8ResultsApi.dismissClosureBenefit(benefit.id);
        setItems((prev) => prev.filter((b) => b.id !== benefit.id));
        toast.success(t('results.handoffInbox.dismissed', 'Benefit dismissed.'));
      } catch {
        toast.error(t('results.handoffInbox.dismissError', 'Could not dismiss benefit.'));
      } finally {
        setBusyId(null);
      }
    },
    [t]
  );

  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  const formatTarget = (benefit: V8ResultsClosureBenefit): string => {
    if (benefit.targetValue == null) return '—';
    return benefit.unit ? `${benefit.targetValue} ${benefit.unit}` : String(benefit.targetValue);
  };

  return (
    <section className="p-4" aria-label={t('results.handoffInbox.title', 'Incoming benefits')}>
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-c-accent-soft text-c-accent">
          <Inbox size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-c-text">
            {t('results.handoffInbox.title', 'Incoming benefits')}
          </h2>
          <p className="text-xs text-c-text-secondary">
            {t(
              'results.handoffInbox.subtitle',
              'Benefits handed off from closed initiatives (M14 → M15).'
            )}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-c-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          {t('common.loading', 'Loading...')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-c-danger/40 bg-c-danger/5 p-4 text-sm text-c-danger">
          {error}
          <button
            type="button"
            className="ml-3 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={() => {
              void load();
            }}
          >
            {t('results.hub.retry', 'Retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-c-border-subtle py-16 text-center">
          <Inbox size={28} className="text-c-text-secondary/60" />
          <p className="text-sm text-c-text-secondary">
            {t('results.handoffInbox.empty', 'No new benefits from closed initiatives.')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((benefit) => (
            <li
              key={benefit.id}
              className="flex flex-col gap-3 rounded-lg border border-c-border bg-c-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} className="shrink-0 text-c-accent" />
                  <span className="truncate text-sm font-medium text-c-text">
                    {benefit.kpiName}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-c-text-secondary">
                  <span>
                    {t('results.handoffInbox.initiative', 'Initiative')}:{' '}
                    {benefit.initiativeName || '—'}
                  </span>
                  <span>
                    {t('results.handoffInbox.target', 'Target')}: {formatTarget(benefit)}
                  </span>
                  <span>
                    {t('results.handoffInbox.closedAt', 'Closed')}: {formatDate(benefit.closedAt)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === benefit.id}
                  onClick={() => {
                    void handlePromote(benefit);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-c-text px-3 py-1.5 text-xs font-medium text-c-surface hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {busyId === benefit.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  {t('results.handoffInbox.promote', 'Promote to tracked KPI')}
                </button>
                <button
                  type="button"
                  disabled={busyId === benefit.id}
                  onClick={() => {
                    void handleDismiss(benefit);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-c-border px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <X size={13} />
                  {t('results.handoffInbox.dismiss', 'Dismiss')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default M14HandoffInbox;
