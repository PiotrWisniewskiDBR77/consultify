/**
 * Read-only superadmin view: V8 Prompt OS runtime summary (V8PromptOsApi.getRuntimeSummary).
 */

import { RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { V8PromptOsApi, type V8PromptOsRuntimeSummary } from '../../../services/api/v8/prompt-os';
import { Button } from '../../ui/primitives/Button';

export const PromptOsRuntimeSummaryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<V8PromptOsRuntimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await V8PromptOsApi.getRuntimeSummary();
      setSummary(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('superadmin.promptOsRuntime.title', { defaultValue: 'Prompt OS runtime (V8)' })}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('superadmin.promptOsRuntime.subtitle', {
              defaultValue: 'Read-only summary from GET /api/v8/prompt-os/runtime/summary',
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2"
          aria-label={t('superadmin.promptOsRuntime.refresh', { defaultValue: 'Refresh' })}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t('superadmin.promptOsRuntime.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {t('superadmin.promptOsRuntime.loadError', {
            defaultValue: 'Could not load summary: {{message}}',
            message: error,
          })}
        </div>
      )}

      {loading && !summary && !error && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('superadmin.promptOsRuntime.loading', { defaultValue: 'Loading runtime summary…' })}
        </p>
      )}

      {summary && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 p-4 shadow-sm">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.contract', { defaultValue: 'Contract' })}
            </dt>
            <dd className="mt-1 font-mono text-sm text-slate-900 dark:text-white">{summary.contract}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.presetCount', { defaultValue: 'Presets' })}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{summary.presetCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.bundleCount', { defaultValue: 'Bundles' })}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{summary.bundleCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.activeBundleCount', { defaultValue: 'Active bundles' })}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{summary.activeBundleCount}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.purposeFamilies', {
                defaultValue: 'Purpose families supported',
              })}
            </dt>
            <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">
              {summary.purposeFamiliesSupported.length
                ? summary.purposeFamiliesSupported.join(', ')
                : t('superadmin.promptOsRuntime.none', { defaultValue: '—' })}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
};
