import { CheckCircle, RefreshCw, Save, Shield, ShieldAlert } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

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

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const AIGovernanceTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  const [contextPolicy, setContextPolicy] = useState<ContextPolicy | null>(null);
  const [policySummary, setPolicySummary] = useState<PolicySummary | null>(null);
  const [sanityReport, setSanityReport] = useState<SanityReport | null>(null);

  const [hasChanges, setHasChanges] = useState(false);

  const errorCount = useMemo(() => {
    if (!sanityReport?.healthChecks) return 0;
    return sanityReport.healthChecks.filter((c) => c.status === 'error').length;
  }, [sanityReport]);

  const warnCount = useMemo(() => {
    if (!sanityReport?.healthChecks) return 0;
    return sanityReport.healthChecks.filter((c) => c.status === 'warn').length;
  }, [sanityReport]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ctxRes, polRes] = await Promise.all([
        fetch('/api/ai-governance/context-policy', { headers: authHeaders() }),
        fetch('/api/ai-governance/policy', { headers: authHeaders() }),
      ]);

      const ctxJson = await ctxRes.json();
      const polJson = await polRes.json();

      if (!ctxRes.ok) throw new Error(ctxJson?.error || 'Failed to load context policy');
      if (!polRes.ok) throw new Error(polJson?.error || 'Failed to load AI policy');

      setContextPolicy(ctxJson?.data || null);
      setPolicySummary(polJson?.data?.summary || null);
      setHasChanges(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load governance settings');
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    setRefreshingHealth(true);
    try {
      const res = await fetch('/api/ai-governance/health', { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load health report');
      setSanityReport(json?.data || null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load health report');
    } finally {
      setRefreshingHealth(false);
    }
  };

  useEffect(() => {
    loadAll();
    loadHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateContextCategory = (key: ContextCategory, value: boolean) => {
    setContextPolicy((prev) => {
      if (!prev) return prev;
      return { ...prev, categories: { ...prev.categories, [key]: value } };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!contextPolicy || !policySummary) return;
    setSaving(true);
    try {
      const [ctxRes, polRes] = await Promise.all([
        fetch('/api/ai-governance/context-policy', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(contextPolicy),
        }),
        fetch('/api/ai-governance/policy', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            internetEnabled: policySummary.internetEnabled,
            auditRequired: policySummary.auditRequired,
            policyLevel: policySummary.currentLevel,
          }),
        }),
      ]);

      const ctxJson = await ctxRes.json();
      const polJson = await polRes.json();

      if (!ctxRes.ok) throw new Error(ctxJson?.error || 'Failed to save context policy');
      if (!polRes.ok) throw new Error(polJson?.error || 'Failed to save policy');

      toast.success('Governance settings saved');
      setHasChanges(false);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
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
              loadAll();
              loadHealth();
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
            title="Save"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      {/* Context policy */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          Context policy
        </h3>

        {!contextPolicy ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm">No policy loaded.</div>
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
                    setContextPolicy((prev) => (prev ? { ...prev, piiRedaction: e.target.value as any } : prev));
                    setHasChanges(true);
                  }}
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
                    setContextPolicy((prev) => (prev ? { ...prev, retention: e.target.value as any } : prev));
                    setHasChanges(true);
                  }}
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
          <div className="text-slate-500 dark:text-slate-400 text-sm">No policy loaded.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                <span className="text-sm text-slate-700 dark:text-slate-200">Internet enabled</span>
                <input
                  type="checkbox"
                  checked={!!policySummary.internetEnabled}
                  onChange={(e) => {
                    setPolicySummary((prev) => (prev ? { ...prev, internetEnabled: e.target.checked } : prev));
                    setHasChanges(true);
                  }}
                  className="w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                <span className="text-sm text-slate-700 dark:text-slate-200">Audit required</span>
                <input
                  type="checkbox"
                  checked={!!policySummary.auditRequired}
                  onChange={(e) => {
                    setPolicySummary((prev) => (prev ? { ...prev, auditRequired: e.target.checked } : prev));
                    setHasChanges(true);
                  }}
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

            <p className="text-sm text-slate-500 dark:text-slate-400">{policySummary.description}</p>
          </>
        )}
      </div>

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
            {refreshingHealth ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        {!sanityReport ? (
          <div className="text-slate-500 dark:text-slate-400 text-sm">No report loaded.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              {errorCount > 0 ? (
                <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert size={16} /> {errorCount} errors
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle size={16} /> No errors
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">{warnCount} warnings</span>
              <span className="text-slate-400 dark:text-slate-500">
                {new Date(sanityReport.timestamp).toLocaleString()}
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
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {c.status}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.detail}</div>
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

