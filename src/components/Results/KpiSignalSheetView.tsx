import { ArrowLeft, ExternalLink, Save } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  getKpiCurrentDefinitionVersion,
  listKpiMeasurements,
  listKpis,
  newKpiIdempotencyKey,
  recordKpiMeasurement,
  type KpiDefinitionDto,
} from '@/components/ResultsVNext/kpiApi';

import type { KpiDrawerSection } from './kpiDomain';
import type { SignalSheetRecord } from './kpiSignalSheetTypes';

interface KpiSignalSheetViewProps {
  sheet: SignalSheetRecord;
  onBack: () => void;
  onRecorded?: () => void;
  onOpenKpi?: (kpiId: string, section?: KpiDrawerSection) => void;
}

interface DraftEntry {
  canonicalKpiId: string;
  value: string;
  notes: string;
  source: string;
  idempotencyKey: string;
}

type RowResult = { status: 'saved' | 'failed'; message: string };

export const KpiSignalSheetView: React.FC<KpiSignalSheetViewProps> = ({
  sheet,
  onBack,
  onRecorded,
  onOpenKpi,
}) => {
  const { t } = useTranslation();
  const [periodStart, setPeriodStart] = useState(() => String(sheet.dueDate || '').slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [canonicalKpis, setCanonicalKpis] = useState<KpiDefinitionDto[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [rowResults, setRowResults] = useState<Record<string, RowResult>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>(() =>
    Object.fromEntries(
      sheet.items.map((item) => [
        item.id,
        {
          canonicalKpiId: '',
          value: item.latestValue != null ? String(item.latestValue) : '',
          notes: '',
          source: '',
          idempotencyKey: newKpiIdempotencyKey(),
        },
      ])
    )
  );

  useEffect(() => {
    let active = true;
    listKpis({ status: 'active', limit: 1000 })
      .then((kpis) => active && setCanonicalKpis(kpis))
      .catch((error: any) => {
        if (active) toast.error(error?.message || 'Failed to load canonical KPI registry');
      })
      .finally(() => active && setLoadingKpis(false));
    return () => {
      active = false;
    };
  }, []);

  const completedCount = useMemo(
    () => Object.values(drafts).filter((entry) => String(entry.value || '').trim()).length,
    [drafts]
  );

  const handleSave = async () => {
    const filledItems = sheet.items.filter(
      (item) =>
        String(drafts[item.id]?.value || '').trim() && rowResults[item.id]?.status !== 'saved'
    );
    if (!periodStart || filledItems.length === 0) {
      toast.error(
        t('results.kpi.signals.sheet.fillRequired', 'Fill at least one KPI value before saving.')
      );
      return;
    }

    setSubmitting(true);
    try {
      const nextResults: Record<string, RowResult> = {};
      for (const item of filledItems) {
        const draft = drafts[item.id];
        try {
          if (!draft.canonicalKpiId) {
            throw new Error('Select the exact KPI in the canonical registry.');
          }
          const numericValue = Number(draft.value);
          if (!Number.isFinite(numericValue)) throw new Error('Enter a valid numeric value.');
          const definition = await getKpiCurrentDefinitionVersion(draft.canonicalKpiId);
          if (!definition || definition.approvalStatus !== 'approved') {
            throw new Error('The selected KPI has no approved definition version.');
          }
          const date = String(periodStart).slice(0, 10);
          const periodStartIso = new Date(`${date}T00:00:00.000Z`).toISOString();
          const periodEndIso = new Date(`${date}T23:59:59.999Z`).toISOString();
          const measurement = await recordKpiMeasurement(draft.canonicalKpiId, {
            definitionVersionId: definition.definitionVersionId,
            periodStart: periodStartIso,
            periodEnd: periodEndIso,
            actualValue: numericValue,
            source: draft.source.trim() || 'Signal sheet',
            notes: draft.notes.trim() || null,
            reason: 'Signal sheet submission',
            idempotencyKey: draft.idempotencyKey,
          });
          const readback = await listKpiMeasurements(draft.canonicalKpiId, {
            periodStart: periodStartIso,
            periodEnd: periodEndIso,
            limit: 100,
            includeSuperseded: true,
          });
          if (!readback.some((row) => row.measurementId === measurement.measurementId)) {
            throw new Error('Canonical write completed but exact readback was not confirmed.');
          }
          nextResults[item.id] = { status: 'saved', message: 'Saved and verified' };
        } catch (error: any) {
          nextResults[item.id] = {
            status: 'failed',
            message: error?.message || 'Canonical measurement failed',
          };
        }
      }
      // Preserve already verified rows while a failed subset is retried.
      setRowResults((prev) => ({ ...prev, ...nextResults }));
      const saved = Object.values(nextResults).filter((row) => row.status === 'saved').length;
      const failed = Object.values(nextResults).length - saved;
      if (failed === 0) {
        toast.success(`${saved} canonical measurement${saved === 1 ? '' : 's'} saved and verified`);
        onRecorded?.();
      } else {
        toast.error(`${saved} saved, ${failed} failed. Review each row before retrying.`);
      }
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
            const draft = drafts[item.id] || {
              canonicalKpiId: '',
              value: '',
              notes: '',
              source: '',
              idempotencyKey: newKpiIdempotencyKey(),
            };
            const saved = rowResults[item.id]?.status === 'saved';
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
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('results.kpi.signals.sheet.canonicalKpi', 'Canonical KPI')}
                    </label>
                    <select
                      value={draft.canonicalKpiId}
                      disabled={loadingKpis || submitting || saved}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...prev[item.id],
                            canonicalKpiId: event.target.value,
                            idempotencyKey: newKpiIdempotencyKey(),
                          },
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="">
                        {loadingKpis ? 'Loading registry…' : 'Select exact KPI…'}
                      </option>
                      {canonicalKpis.map((kpi) => (
                        <option key={kpi.kpiId} value={kpi.kpiId}>
                          {kpi.kpiCode}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      No identity is inferred from the archived KPI. Select the governed target explicitly.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('results.drawer.recordValue', 'Value')}
                    </label>
                    <input
                      type="number"
                      disabled={saved}
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
                      disabled={saved}
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
                    disabled={saved}
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
                {rowResults[item.id] && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div
                      className={`text-xs font-medium ${
                        saved
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {rowResults[item.id].message}
                    </div>
                    {saved && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              idempotencyKey: newKpiIdempotencyKey(),
                            },
                          }));
                          setRowResults((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                        }}
                        className="rounded-full border border-slate-200/70 dark:border-white/[0.08] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                      >
                        {t('results.kpi.signals.sheet.recordAnother', 'Record another measurement')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KpiSignalSheetView;
