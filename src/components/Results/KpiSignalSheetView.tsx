import { ArrowLeft, ExternalLink, Save } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsCreateKpiTimeSeriesPayload,
} from '@/services/api/v8/results';

import type { KpiDrawerSection } from './kpiDomain';
import type { SignalSheetRecord } from './kpiSignalSheetTypes';

interface KpiSignalSheetViewProps {
  sheet: SignalSheetRecord;
  onBack: () => void;
  onRecorded?: () => void;
  onOpenKpi?: (kpiId: string, section?: KpiDrawerSection) => void;
}

interface DraftEntry {
  value: string;
  notes: string;
  source: string;
}

export const KpiSignalSheetView: React.FC<KpiSignalSheetViewProps> = ({
  sheet,
  onBack,
  onRecorded,
  onOpenKpi,
}) => {
  const { t } = useTranslation();
  const [periodStart, setPeriodStart] = useState(() => String(sheet.dueDate || '').slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>(() =>
    Object.fromEntries(
      sheet.items.map((item) => [
        item.id,
        {
          value: item.latestValue != null ? String(item.latestValue) : '',
          notes: '',
          source: '',
        },
      ])
    )
  );

  const completedCount = useMemo(
    () => Object.values(drafts).filter((entry) => String(entry.value || '').trim()).length,
    [drafts]
  );

  const handleSave = async () => {
    const filledItems = sheet.items.filter((item) => String(drafts[item.id]?.value || '').trim());
    if (!periodStart || filledItems.length === 0) {
      toast.error(
        t('results.kpi.signals.sheet.fillRequired', 'Fill at least one KPI value before saving.')
      );
      return;
    }

    setSubmitting(true);
    try {
      for (const item of filledItems) {
        const draft = drafts[item.id];
        const payload: V8ResultsCreateKpiTimeSeriesPayload = {
          value: Number(draft.value),
          periodStart: String(periodStart).slice(0, 10),
          source: draft.source.trim() || undefined,
          notes: draft.notes.trim() || undefined,
        };

        try {
          await V8ResultsApi.createKpiTimeSeriesValue(item.id, payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.post(`/benefits/kpis/${item.id}/time-series`, payload);
        }
      }

      toast.success(t('results.drawer.recorded', 'Measurement recorded'));
      onRecorded?.();
      onBack();
    } catch (error: any) {
      toast.error(
        error?.message || t('results.drawer.recordFailed', 'Failed to record measurement')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('results.kpi.signals.sheet.eyebrow', 'Data entry sheet')}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {sheet.title}
            </h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-600 dark:text-slate-300">
              {sheet.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {t('common.owner', 'Owner')}: {sheet.ownerLabel}
              </span>
              <span>·</span>
              <span>
                {t('common.due', 'Due')}: {sheet.dueLabel}
              </span>
              <span>·</span>
              <span>{sheet.phaseLabel}</span>
              <span>·</span>
              <span>{sheet.frequencyLabel}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-transparent px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <ArrowLeft size={16} />
              {t('common.back', 'Back')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 dark:bg-[#F4F7FB] px-4 py-2 text-sm font-medium text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <Save size={16} />
              {submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('results.kpi.signals.sheet.instructions', 'Collection guidance')}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{sheet.instructions}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('results.kpi.signals.sheet.requiredInputs', 'Data to provide')}
            </div>
            <div className="mt-3 space-y-2">
              {sheet.requiredInputs.map((input) => (
                <div
                  key={input}
                  className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] px-3 py-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  {input}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('results.kpi.signals.sheet.period', 'Submission window')}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('common.periodStart', 'Period start')}
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {t(
                'results.kpi.signals.sheet.progress',
                '{{completed}} of {{total}} KPI values prepared in this sheet.',
                { completed: completedCount, total: sheet.items.length }
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sheet.items.map((item) => {
            const draft = drafts[item.id] || { value: '', notes: '', source: '' };
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{item.initiativeName || t('common.noData', 'No data')}</span>
                      <span>·</span>
                      <span>
                        {t('common.owner', 'Owner')}: {item.ownerName || sheet.ownerLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenKpi?.(item.id, 'summary')}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 dark:border-white/[0.08] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <ExternalLink size={12} />
                    {t('common.open', 'Open')}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {t('results.columns.current', 'Current')}
                    </div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">
                      {item.latestValue ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {t('results.columns.target', 'Target')}
                    </div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">
                      {item.targetValue ?? '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[0.35fr_0.65fr]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('results.drawer.recordValue', 'Value')}
                    </label>
                    <input
                      type="number"
                      value={draft.value}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], value: event.target.value },
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
                      placeholder={item.unit || '0'}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('results.kpi.signals.sheet.source', 'Source')}
                    </label>
                    <input
                      value={draft.source}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], source: event.target.value },
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
                      placeholder={t(
                        'results.kpi.signals.sheet.sourcePlaceholder',
                        'ERP, MES, spreadsheet, manual count...'
                      )}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('common.notes', 'Notes')}
                  </label>
                  <textarea
                    value={draft.notes}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], notes: event.target.value },
                      }))
                    }
                    className="min-h-[92px] w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    placeholder={t(
                      'results.kpi.signals.sheet.notesPlaceholder',
                      'Add context, assumptions, anomalies, or evidence links.'
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KpiSignalSheetView;
