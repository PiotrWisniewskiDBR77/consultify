/**
 * M16/6.5 — Model version history panel.
 *
 * Lists all saved snapshots of a financial model (financial_model_versions).
 * Optionally shows an assumption diff between any two selected versions.
 * Mounted behind ff_modelVersioning flag in FinancialModelWorkspace (#82c —
 * moved here from the now-unused FinanceModelDocumentView full-view).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { V8FinanceApi } from '@/services/api/v8/finance';

interface ModelVersion {
  id: string;
  modelId: string;
  versionNumber: number;
  scenarioLabel?: string;
  status?: string;
  createdAt: string;
  createdBy?: string;
}

interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  assumptionChanges: { key: string; from: unknown; to: unknown }[];
}

interface Props {
  modelId: string;
}

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export const ModelVersionHistory: React.FC<Props> = ({ modelId }) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFrom, setSelectedFrom] = useState<string>('');
  const [selectedTo, setSelectedTo] = useState<string>('');
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelId) return;
    setLoading(true);
    V8FinanceApi.getModelVersions(modelId)
      .then((res: any) => {
        setVersions(Array.isArray(res?.data?.versions) ? res.data.versions : []);
      })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [modelId]);

  const loadDiff = useCallback(async () => {
    if (!selectedFrom || !selectedTo || selectedFrom === selectedTo) return;
    setDiffLoading(true);
    setDiff(null);
    setDiffError(null);
    try {
      const res: any = await V8FinanceApi.getModelVersionDiff(modelId, selectedFrom, selectedTo);
      setDiff(res?.data?.diff ?? null);
    } catch (e: any) {
      setDiffError(e?.response?.data?.error || t('finance.versions.diffFailed', 'Diff failed'));
    } finally {
      setDiffLoading(false);
    }
  }, [modelId, selectedFrom, selectedTo, t]);

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">{t('common.loading', 'Loading…')}</div>;
  }

  if (versions.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-400">
        {t(
          'finance.versions.empty',
          'No saved versions yet. Approve a model to create a snapshot.'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Version list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/[0.08]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02]">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('finance.versions.version', 'Version')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('finance.versions.scenario', 'Scenario')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('finance.versions.status', 'Status')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('finance.versions.created', 'Created')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('finance.versions.compareFrom', 'From')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t('finance.versions.compareTo', 'To')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {versions.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-mono text-sm text-slate-700 dark:text-slate-200">
                  v{v.versionNumber}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {v.scenarioLabel || '—'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      v.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : v.status === 'merged'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                    }`}
                  >
                    {v.status || 'draft'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {new Date(v.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="radio"
                    name="compareFrom"
                    value={v.id}
                    checked={selectedFrom === v.id}
                    onChange={() => setSelectedFrom(v.id)}
                    className="accent-blue-600"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="radio"
                    name="compareTo"
                    value={v.id}
                    checked={selectedTo === v.id}
                    onChange={() => setSelectedTo(v.id)}
                    className="accent-blue-600"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Diff controls */}
      {selectedFrom && selectedTo && selectedFrom !== selectedTo && (
        <div className="flex items-center gap-3">
          <button
            onClick={loadDiff}
            disabled={diffLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {diffLoading
              ? t('common.loading', 'Loading…')
              : t('finance.versions.showDiff', 'Show diff')}
          </button>
          {(selectedFrom || selectedTo) && (
            <button
              onClick={() => {
                setSelectedFrom('');
                setSelectedTo('');
                setDiff(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {t('common.clear', 'Clear')}
            </button>
          )}
        </div>
      )}

      {diffError && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {diffError}
        </div>
      )}

      {/* Diff result */}
      {diff && (
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
          <div className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('finance.versions.diffTitle', 'Assumption diff')}:{' '}
            </span>
            <span className="text-sm text-slate-500">
              v{diff.fromVersion} → v{diff.toVersion}
            </span>
            {diff.assumptionChanges.length === 0 && (
              <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-400">
                {t('finance.versions.noDiff', 'No assumption changes')}
              </span>
            )}
          </div>
          {diff.assumptionChanges.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    {t('finance.versions.key', 'Assumption')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-rose-500">
                    {t('finance.versions.from', 'Before (v' + diff.fromVersion + ')')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-emerald-600">
                    {t('finance.versions.to', 'After (v' + diff.toVersion + ')')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {diff.assumptionChanges.map((ch) => (
                  <tr key={ch.key}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {ch.key}
                    </td>
                    <td className="px-3 py-2 text-xs text-rose-600 dark:text-rose-300 line-through opacity-70">
                      {fmt(ch.from)}
                    </td>
                    <td className="px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      {fmt(ch.to)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelVersionHistory;
