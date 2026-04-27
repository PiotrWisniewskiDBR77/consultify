/**
 * ComplianceTab - Security > Compliance
 * AI-specific compliance checks and data residency
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Info,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: 'data_privacy' | 'security' | 'regulatory' | 'operational';
  status: 'compliant' | 'warning' | 'non_compliant' | 'not_applicable';
  lastChecked: string;
  details?: string;
}

interface DataResidencyConfig {
  region: string;
  label: string;
  providers: string[];
  isActive: boolean;
  dataTypes: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && (isRecord(data.data) || Array.isArray(data.data)) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeGovernanceHealth = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.healthChecks)) {
    throw new Error('Compliance governance health response was incomplete');
  }

  return {
    timestamp: asText(payload.timestamp, new Date().toISOString()),
    healthChecks: payload.healthChecks.filter(isRecord).map((check) => ({
      name: asText(check.name, 'Unknown check'),
      status:
        check.status === 'ok' || check.status === 'warn' || check.status === 'error'
          ? check.status
          : 'warn',
      detail: asText(check.detail, ''),
    })),
    duplicateMounts: Array.isArray(payload.duplicateMounts)
      ? payload.duplicateMounts.filter(isRecord).map((mount) => ({
          path: asText(mount.path, ''),
          count: toNumber(mount.count, 0),
        }))
      : [],
  };
};

const normalizeProviderNames = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!Array.isArray(payload)) {
    throw new Error('Compliance providers response was not a list');
  }

  return Array.from(
    new Set(
      payload
        .filter(isRecord)
        .map((provider) => asText(provider.name, asText(provider.provider, '')).trim())
        .filter(Boolean)
    )
  );
};

export const ComplianceTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [residencyConfigs, setResidencyConfigs] = useState<DataResidencyConfig[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadCompliance();
  }, []);

  const loadCompliance = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [healthPayload, providersPayload] = await Promise.all([
        Api.getAIGovernanceHealth(),
        Api.getLLMProviders(),
      ]);

      const nowIso = new Date().toISOString();

      // Compliance checks (DB + services + env) from AI governance sanity report
      const report = normalizeGovernanceHealth(healthPayload);
      const healthChecks = report.healthChecks;
      const duplicates = report.duplicateMounts;

      const mapStatus = (s: string): ComplianceCheck['status'] => {
        if (s === 'ok') return 'compliant';
        if (s === 'warn') return 'warning';
        return 'non_compliant';
      };
      const mapCategory = (name: string): ComplianceCheck['category'] => {
        if (name.startsWith('service:')) return 'security';
        if (name.startsWith('db:')) return 'operational';
        if (name.startsWith('env:')) return 'operational';
        return 'operational';
      };

      const nextChecks: ComplianceCheck[] = [
        ...healthChecks.map((c, idx) => ({
          id: `sanity-${idx}-${c.name}`,
          name: c.name,
          description: c.detail,
          category: mapCategory(String(c.name || '')),
          status: mapStatus(c.status),
          lastChecked: String(report.timestamp || nowIso),
        })),
        ...(duplicates.length
          ? [
              {
                id: 'sanity-duplicate-mounts',
                name: 'Route mounts duplication',
                description: 'Duplicate route mounts detected in API gateway',
                category: 'operational' as const,
                status: 'warning' as const,
                lastChecked: String(report.timestamp || nowIso),
                details: duplicates.map((d) => `${d.path} × ${d.count}`).join(', '),
              },
            ]
          : []),
      ];
      setChecks(nextChecks);

      // Data residency: best-effort summary of configured LLM providers (real DB-backed list)
      const providerNames = normalizeProviderNames(providersPayload);

      setResidencyConfigs([
        {
          region: 'global',
          label: 'Configured providers',
          providers: providerNames,
          isActive: providerNames.length > 0,
          dataTypes: ['Conversations', 'Documents', 'Knowledge Base'],
        },
      ]);

      setLastScanTime(nowIso);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load compliance data');
      setChecks([]);
      setResidencyConfigs([]);
      setLastScanTime(null);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const runComplianceScan = () => {
    toast.success('Compliance scan initiated');
    loadCompliance();
  };

  const getStatusIcon = (status: ComplianceCheck['status']) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" />;
      case 'non_compliant':
        return <XCircle size={18} className="text-red-500" />;
      case 'not_applicable':
        return <Info size={18} className="text-slate-400" />;
    }
  };

  const getStatusBadge = (status: ComplianceCheck['status']) => {
    const styles = {
      compliant: 'bg-emerald-500/10 text-emerald-500',
      warning: 'bg-amber-500/10 text-amber-500',
      non_compliant: 'bg-red-500/10 text-red-500',
      not_applicable: 'bg-slate-500/10 text-slate-400',
    };
    const labels = {
      compliant: 'Compliant',
      warning: 'Warning',
      non_compliant: 'Non-Compliant',
      not_applicable: 'N/A',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getCategoryLabel = (category: ComplianceCheck['category']) => {
    const labels = {
      data_privacy: 'Data Privacy',
      security: 'Security',
      regulatory: 'Regulatory',
      operational: 'Operational',
    };
    return labels[category];
  };

  const complianceScore = Math.round(
    checks.filter((c) => c.status !== 'not_applicable').length > 0
      ? (checks.filter((c) => c.status === 'compliant').length /
          checks.filter((c) => c.status !== 'not_applicable').length) *
          100
      : 0
  );

  const groupedChecks = checks.reduce(
    (acc, check) => {
      if (!acc[check.category]) acc[check.category] = [];
      acc[check.category].push(check);
      return acc;
    },
    {} as Record<string, ComplianceCheck[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={24} className="text-indigo-500" />
            AI Compliance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor AI compliance status and data residency configuration
          </p>
        </div>
        <button
          onClick={runComplianceScan}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw size={16} />
          Run Scan
        </button>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState title="AI compliance unavailable" description={loadError} />
        </div>
      ) : null}

      {!loadError ? (
        <>
          {/* Score Card */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Compliance Score</span>
                <ShieldCheck size={20} className="text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-emerald-500">{complianceScore}%</div>
              <div className="text-xs text-slate-400 mt-1">
                {checks.filter((c) => c.status === 'compliant').length} of{' '}
                {checks.filter((c) => c.status !== 'not_applicable').length} checks passed
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Warnings</span>
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-amber-500">
                {checks.filter((c) => c.status === 'warning').length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Require attention</div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Non-Compliant</span>
                <XCircle size={20} className="text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-500">
                {checks.filter((c) => c.status === 'non_compliant').length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Critical issues</div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">Last Scan</span>
                <Clock size={20} className="text-slate-400" />
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : 'Never'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {lastScanTime ? new Date(lastScanTime).toLocaleDateString() : ''}
              </div>
            </div>
          </div>

          {/* Compliance Checks */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={18} className="text-slate-500" />
                Compliance Checks
              </h3>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-navy-700">
              {Object.entries(groupedChecks).map(([category, categoryChecks]) => (
                <div key={category} className="p-6">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase mb-4">
                    {getCategoryLabel(category as ComplianceCheck['category'])}
                  </h4>
                  <div className="space-y-3">
                    {categoryChecks.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
                      >
                        {getStatusIcon(check.status)}
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {check.name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {check.description}
                          </div>
                          {check.details && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              {check.details}
                            </div>
                          )}
                        </div>
                        {getStatusBadge(check.status)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Residency */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe size={18} className="text-slate-500" />
                Data Residency Configuration
              </h3>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4">
              {residencyConfigs.map((config) => (
                <div
                  key={config.region}
                  className={`p-4 rounded-xl border ${
                    config.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-slate-50 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe
                        size={16}
                        className={config.isActive ? 'text-emerald-500' : 'text-slate-400'}
                      />
                      <span className="font-medium text-slate-900 dark:text-white">
                        {config.label}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        config.isActive
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-500'
                      }`}
                    >
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Providers:</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {config.providers.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 bg-white dark:bg-navy-800 rounded text-xs text-slate-600 dark:text-slate-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {config.dataTypes.length > 0 && (
                    <>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        Data Types:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {config.dataTypes.map((dt) => (
                          <span
                            key={dt}
                            className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded text-xs text-indigo-600 dark:text-indigo-400"
                          >
                            {dt}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ComplianceTab;
