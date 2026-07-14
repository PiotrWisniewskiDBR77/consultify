/**
 * Read-only superadmin view: V8 Prompt OS runtime summary (V8PromptOsApi.getRuntimeSummary).
 */

import { RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { V8PromptOsApi, type V8PromptOsRuntimeSummary } from '../../../../services/api/v8/prompt-os';
import { normalizeApiErrorMessage } from '../../../../utils/apiError';
import { Button } from '../../../../components/ui/primitives/Button';
import { DegradedState } from '../../../../components/Admin/AdminState';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeRuntimeSummary = (value: unknown): V8PromptOsRuntimeSummary => {
  const payload = getObjectPayload(value);
  if (
    !isRecord(payload) ||
    !('contract' in payload) ||
    !Array.isArray(payload.purposeFamiliesSupported) ||
    !('presetCount' in payload) ||
    !('bundleCount' in payload) ||
    !('activeBundleCount' in payload)
  ) {
    throw new Error('Prompt OS runtime summary response was incomplete');
  }

  return {
    contract: asText(payload.contract, ''),
    purposeFamiliesSupported: payload.purposeFamiliesSupported
      .map((item) => asText(item, ''))
      .filter(Boolean),
    presetCount: toNumber(payload.presetCount, 0),
    bundleCount: toNumber(payload.bundleCount, 0),
    activeBundleCount: toNumber(payload.activeBundleCount, 0),
  };
};

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
      setSummary(normalizeRuntimeSummary(data));
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Could not load Prompt OS runtime summary');
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
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 p-4 shadow-sm">
          <DegradedState title="Prompt OS runtime unavailable" description={error} />
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
            <dd className="mt-1 font-mono text-sm text-slate-900 dark:text-white">
              {summary.contract}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.presetCount', { defaultValue: 'Presets' })}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {summary.presetCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.bundleCount', { defaultValue: 'Bundles' })}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {summary.bundleCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {t('superadmin.promptOsRuntime.fields.activeBundleCount', {
                defaultValue: 'Active bundles',
              })}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {summary.activeBundleCount}
            </dd>
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
