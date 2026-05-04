import { CheckCircle, RefreshCw, Save, Shield, ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

type ContextCategory =
  | 'ORG_PROFILE'
  | 'ORG_TERMINOLOGY'
  | 'ORG_PATTERNS'
  | 'ORG_STRATEGY'
  | 'ORG_SECURITY_POSTURE'
  | 'ORG_FINANCIAL_SUMMARY'
  | 'ORG_DOCUMENTS';

type ContextPolicy = {
  categories: Record<ContextCategory, boolean>;
  piiRedaction: 'inherit' | 'off' | 'on';
  retention: 'standard' | 'strict';
};

type PolicySummary = {
  currentLevel: string;
  description: string;
  internetEnabled: boolean;
  auditRequired: boolean;
};

type SanityReport = {
  duplicateMounts: Array<{ path: string; count: number }>;
  healthChecks: Array<{ name: string; status: 'ok' | 'warn' | 'error'; detail: string }>;
  timestamp: string;
};

const CONTEXT_CATEGORIES: ContextCategory[] = [
  'ORG_PROFILE',
  'ORG_TERMINOLOGY',
  'ORG_PATTERNS',
  'ORG_STRATEGY',
  'ORG_SECURITY_POSTURE',
  'ORG_FINANCIAL_SUMMARY',
  'ORG_DOCUMENTS',
];

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

const toBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const normalizeContextPolicy = (value: unknown): ContextPolicy => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !isRecord(payload.categories)) {
    throw new Error('Governance context policy response was incomplete');
  }
  const categories = payload.categories;

  return {
    categories: CONTEXT_CATEGORIES.reduce(
      (acc, key) => ({ ...acc, [key]: toBool(categories[key], false) }),
      {} as Record<ContextCategory, boolean>
    ),
    piiRedaction:
      payload.piiRedaction === 'off' || payload.piiRedaction === 'on'
        ? payload.piiRedaction
        : 'inherit',
    retention: payload.retention === 'strict' ? 'strict' : 'standard',
  };
};

const normalizePolicySummary = (value: unknown): PolicySummary => {
  const payload = getObjectPayload(value);
  const summary = isRecord(payload) && isRecord(payload.summary) ? payload.summary : payload;
  if (!isRecord(summary) || !('currentLevel' in summary)) {
    throw new Error('Governance policy response was incomplete');
  }

  return {
    currentLevel: asText(summary.currentLevel, 'unknown'),
    description: asText(summary.description, 'No description provided'),
    internetEnabled: toBool(summary.internetEnabled, false),
    auditRequired: toBool(summary.auditRequired, false),
  };
};

const normalizeSanityReport = (value: unknown): SanityReport => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.healthChecks)) {
    throw new Error('Governance health response was incomplete');
  }

  return {
    duplicateMounts: Array.isArray(payload.duplicateMounts)
      ? payload.duplicateMounts.filter(isRecord).map((item) => ({
          path: asText(item.path, 'unknown'),
          count: Number.isFinite(Number(item.count)) ? Number(item.count) : 0,
        }))
      : [],
    healthChecks: payload.healthChecks.filter(isRecord).map((item) => {
      const status = item.status === 'warn' || item.status === 'error' ? item.status : 'ok';
      return {
        name: asText(item.name, 'unknown'),
        status,
        detail: asText(item.detail, 'No detail provided'),
      };
    }),
    timestamp: asText(payload.timestamp, ''),
  };
};

function formatDateTime(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

export const AIGovernanceTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  const [contextPolicy, setContextPolicy] = useState<ContextPolicy | null>(null);
  const [policySummary, setPolicySummary] = useState<PolicySummary | null>(null);
  const [sanityReport, setSanityReport] = useState<SanityReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [hasChanges, setHasChanges] = useState(false);

  const errorCount = useMemo(() => {
    if (!sanityReport?.healthChecks) return 0;
    return sanityReport.healthChecks.filter((c) => c.status === 'error').length;
  }, [sanityReport]);

  const warnCount = useMemo(() => {
    if (!sanityReport?.healthChecks) return 0;
    return sanityReport.healthChecks.filter((c) => c.status === 'warn').length;
  }, [sanityReport]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const [ctxJson, polJson] = await Promise.all([
        Api.getAIGovernanceContextPolicy(),
        Api.getAIGovernancePolicy(),
      ]);

      const nextContextPolicy = normalizeContextPolicy(ctxJson);
      const nextPolicySummary = normalizePolicySummary(polJson);
      setContextPolicy(nextContextPolicy);
      setPolicySummary(nextPolicySummary);
      setHasChanges(false);
      return { contextPolicy: nextContextPolicy, policySummary: nextPolicySummary };
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load governance settings');
      setContextPolicy(null);
      setPolicySummary(null);
      setHasChanges(false);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setRefreshingHealth(true);
    setHealthError(null);
    try {
      const json = await Api.getAIGovernanceHealth();
      setSanityReport(normalizeSanityReport(json));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load health report');
      setSanityReport(null);
      setHealthError(message);
      toast.error(message);
    } finally {
      setRefreshingHealth(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    void loadHealth();
  }, [loadAll, loadHealth]);

  const updateContextCategory = (key: ContextCategory, value: boolean) => {
    if (loadError) return;
    setContextPolicy((prev) => {
      if (!prev) return prev;
      return { ...prev, categories: { ...prev.categories, [key]: value } };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (loadError || !contextPolicy || !policySummary) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all([
        Api.updateAIGovernanceContextPolicy(contextPolicy),
        Api.updateAIGovernancePolicy({
          internetEnabled: policySummary.internetEnabled,
          auditRequired: policySummary.auditRequired,
          policyLevel: policySummary.currentLevel,
        }),
      ]);

      const refreshed = await loadAll();
      if (!refreshed) {
        throw new Error('Governance settings save was not confirmed by the server');
      }
      toast.success('Governance settings saved');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Save failed');
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield size={22} className="text-indigo-500" />
            AI Governance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organization policy, context policy, and runtime guardrails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void loadAll();
              void loadHealth();
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || !!loadError}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
            title={loadError || 'Save'}
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <DegradedState title="AI governance unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {saveError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {saveError}
            </div>
          )}

          {/* Context policy */}
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Context policy
            </h3>

            {!contextPolicy ? (
              <DegradedState
                title="Context policy unavailable"
                description="The governance context policy endpoint returned no policy."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      ['ORG_PROFILE', 'Org profile'],
                      ['ORG_TERMINOLOGY', 'Org terminology'],
                      ['ORG_PATTERNS', 'Org patterns'],
                      ['ORG_STRATEGY', 'Org strategy'],
                      ['ORG_SECURITY_POSTURE', 'Security posture'],
                      ['ORG_FINANCIAL_SUMMARY', 'Financial summary'],
                      ['ORG_DOCUMENTS', 'Org documents (RAG)'],
                    ] as Array<[ContextCategory, string]>
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
                      <input
                        type="checkbox"
                        checked={!!contextPolicy.categories?.[key]}
                        onChange={(e) => updateContextCategory(key, e.target.checked)}
                        disabled={!!loadError}
                        className="w-4 h-4"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      PII redaction
                    </label>
                    <select
                      value={contextPolicy.piiRedaction}
                      onChange={(e) => {
                        setContextPolicy((prev) =>
                          prev
                            ? {
                                ...prev,
                                piiRedaction: e.target.value as ContextPolicy['piiRedaction'],
                              }
                            : prev
                        );
                        setHasChanges(true);
                      }}
                      disabled={!!loadError}
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="inherit">Inherit</option>
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Retention mode
                    </label>
                    <select
                      value={contextPolicy.retention}
                      onChange={(e) => {
                        setContextPolicy((prev) =>
                          prev
                            ? { ...prev, retention: e.target.value as ContextPolicy['retention'] }
                            : prev
                        );
                        setHasChanges(true);
                      }}
                      disabled={!!loadError}
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="standard">Standard</option>
                      <option value="strict">Strict</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Org AI policy */}
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Internet & audit policy
            </h3>

            {!policySummary ? (
              <DegradedState
                title="Internet policy unavailable"
                description="The governance policy endpoint returned no policy summary."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      Internet enabled
                    </span>
                    <input
                      type="checkbox"
                      checked={!!policySummary.internetEnabled}
                      onChange={(e) => {
                        setPolicySummary((prev) =>
                          prev ? { ...prev, internetEnabled: e.target.checked } : prev
                        );
                        setHasChanges(true);
                      }}
                      disabled={!!loadError}
                      className="w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      Audit required
                    </span>
                    <input
                      type="checkbox"
                      checked={!!policySummary.auditRequired}
                      onChange={(e) => {
                        setPolicySummary((prev) =>
                          prev ? { ...prev, auditRequired: e.target.checked } : prev
                        );
                        setHasChanges(true);
                      }}
                      disabled={!!loadError}
                      className="w-4 h-4"
                    />
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Current level</div>
                    <div className="text-sm text-slate-900 dark:text-white font-medium">
                      {policySummary.currentLevel}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {policySummary.description}
                </p>
              </>
            )}
          </div>
        </>
      )}

      {/* Health */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Sanity check
          </h3>
          <button
            onClick={loadHealth}
            disabled={refreshingHealth}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {refreshingHealth ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>
        </div>

        {healthError ? (
          <DegradedState title="Governance health unavailable" description={healthError} />
        ) : !sanityReport ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm">No report loaded.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              {errorCount > 0 ? (
                <span className="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <ShieldAlert size={16} /> {errorCount} errors
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle size={16} /> No errors
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">{warnCount} warnings</span>
              <span className="text-slate-400 dark:text-slate-500">
                {formatDateTime(sanityReport.timestamp)}
              </span>
            </div>

            {sanityReport.duplicateMounts?.length > 0 && (
              <div className="text-sm">
                <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Duplicate route mounts
                </div>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
                  {sanityReport.duplicateMounts.map((d) => (
                    <li key={d.path}>
                      {d.path} ({d.count})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sanityReport.healthChecks?.map((c) => (
                <div
                  key={c.name}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {c.name}
                    </div>
                    <div
                      className={`text-xs uppercase font-bold tracking-wide ${
                        c.status === 'ok'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : c.status === 'warn'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {c.status}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {c.detail}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIGovernanceTab;
