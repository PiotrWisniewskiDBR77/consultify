/**
 * Data Loss Prevention (DLP) View
 * Manages DLP policies and violations
 */

import {
  AlertCircle,
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { Card, CardWithHeader } from '../components/shared/Card';

interface DLPPolicy {
  id: string;
  name: string;
  description: string;
  policyType: string;
  rules: DLPRule[];
  enforcementAction: string;
  isActive: boolean;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface DLPRule {
  name: string;
  pattern?: string;
  keywords?: string[];
  severity: string;
}

interface DLPViolation {
  id: string;
  policyId: string;
  policyName: string;
  policyType: string;
  resourceType: string;
  resourceId: string;
  violationType: string;
  severity: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByEmail: string | null;
}

interface DLPStats {
  policies: {
    total: number;
    active: number;
  };
  violations: {
    total: number;
    unresolved: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

interface DLPDataSnapshot {
  policies: DLPPolicy[];
  violations: DLPViolation[];
  stats: DLPStats;
}

const POLICY_TYPES = [
  { value: 'data_classification', label: 'Data Classification' },
  { value: 'pii_detection', label: 'PII Detection' },
  { value: 'sensitive_data', label: 'Sensitive Data' },
  { value: 'financial_data', label: 'Financial Data' },
  { value: 'healthcare_data', label: 'Healthcare Data' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'credentials', label: 'Credentials' },
  { value: 'custom', label: 'Custom' },
];

const ENFORCEMENT_ACTIONS = [
  { value: 'warn', label: 'Warn' },
  { value: 'block', label: 'Block' },
  { value: 'encrypt', label: 'Encrypt' },
  { value: 'mask', label: 'Mask' },
  { value: 'log_only', label: 'Log Only' },
];

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const normalizeStats = (value: unknown): DLPStats => {
  const payload = getObjectPayload(value);
  const statsValue = isRecord(payload) ? (payload as Partial<DLPStats>) : {};
  return {
    policies: {
      total: safeNumber(statsValue.policies?.total),
      active: safeNumber(statsValue.policies?.active),
    },
    violations: {
      total: safeNumber(statsValue.violations?.total),
      unresolved: safeNumber(statsValue.violations?.unresolved),
      bySeverity: {
        critical: safeNumber(statsValue.violations?.bySeverity?.critical),
        high: safeNumber(statsValue.violations?.bySeverity?.high),
        medium: safeNumber(statsValue.violations?.bySeverity?.medium),
        low: safeNumber(statsValue.violations?.bySeverity?.low),
      },
    },
  };
};

const getCreatedPolicyId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const policy = isRecord(result.policy) ? result.policy : null;
  return String(
    result.id ||
      policy?.id ||
      data?.id ||
      (isRecord(data?.policy) ? data.policy.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.policy) ? nestedData.policy.id : '') ||
      ''
  );
};

const DLPView: React.FC = () => {
  const [policies, setPolicies] = useState<DLPPolicy[]>([]);
  const [violations, setViolations] = useState<DLPViolation[]>([]);
  const [stats, setStats] = useState<DLPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'policies' | 'violations'>('policies');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    policyType: 'pii_detection',
    enforcementAction: 'warn',
    rules: [] as DLPRule[],
  });
  const [newRule, setNewRule] = useState({
    name: '',
    pattern: '',
    keywords: '',
    severity: 'MEDIUM',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);

      const [policiesData, violationsData, statsData] = await Promise.all([
        Api.getDLPPolicies(),
        Api.getDLPViolations({ isResolved: false }),
        Api.getDLPStats(),
      ]);

      if (!hasListShape(policiesData, ['policies', 'items'])) {
        throw new Error('DLP policies response was not a list');
      }
      if (!hasListShape(violationsData, ['violations', 'items'])) {
        throw new Error('DLP violations response was not a list');
      }
      const policySnapshot = getListPayload<DLPPolicy>(policiesData, ['policies', 'items']);
      const violationSnapshot = getListPayload<DLPViolation>(violationsData, [
        'violations',
        'items',
      ]);
      const statsSnapshot = normalizeStats(statsData);
      setPolicies(policySnapshot);
      setViolations(violationSnapshot);
      setStats(statsSnapshot);
      return {
        policies: policySnapshot,
        violations: violationSnapshot,
        stats: statsSnapshot,
      } satisfies DLPDataSnapshot;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load DLP data');
      setLoadError(message);
      setPolicies([]);
      setViolations([]);
      setStats(null);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    if (!newRule.name) return;
    setFormData({
      ...formData,
      rules: [
        ...formData.rules,
        {
          name: newRule.name,
          pattern: newRule.pattern || undefined,
          keywords: newRule.keywords
            ? newRule.keywords
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
            : undefined,
          severity: newRule.severity,
        },
      ],
    });
    setNewRule({ name: '', pattern: '', keywords: '', severity: 'MEDIUM' });
  };

  const handleRemoveRule = (index: number) => {
    setFormData({
      ...formData,
      rules: formData.rules.filter((_, i) => i !== index),
    });
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await Api.createDLPPolicy({
        name: formData.name,
        policyType: formData.policyType,
        enforcementAction: formData.enforcementAction,
        description: formData.description,
        rules: formData.rules,
      });
      const createdId = getCreatedPolicyId(result);
      if (!createdId) {
        throw new Error('DLP policy creation response was incomplete');
      }
      const refreshed = await loadData();
      if (!refreshed?.policies.some((policy) => policy.id === createdId)) {
        throw new Error('DLP policy creation was not confirmed by the server');
      }
      toast.success('DLP policy created successfully');
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        policyType: 'pii_detection',
        enforcementAction: 'warn',
        rules: [],
      });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to create DLP policy');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePolicy = async (policyId: string, isActive: boolean) => {
    try {
      setError(null);
      await Api.toggleDLPPolicy(policyId, !isActive);
      const refreshed = await loadData();
      if (
        !refreshed?.policies.some(
          (policy) => policy.id === policyId && policy.isActive === !isActive
        )
      ) {
        throw new Error('DLP policy status was not confirmed by the server');
      }
      toast.success(`Policy ${!isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to toggle policy');
      setError(message);
      toast.error(message);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      setError(null);
      await Api.deleteDLPPolicy(policyId);
      const refreshed = await loadData();
      if (!refreshed || refreshed.policies.some((policy) => policy.id === policyId)) {
        throw new Error('DLP policy deletion was not confirmed by the server');
      }
      toast.success('Policy deleted successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete policy');
      setError(message);
      toast.error(message);
    }
  };

  const handleResolveViolation = async (violationId: string) => {
    try {
      setError(null);
      await Api.resolveDLPViolation(violationId);
      const refreshed = await loadData();
      if (!refreshed || refreshed.violations.some((violation) => violation.id === violationId)) {
        throw new Error('DLP violation resolution was not confirmed by the server');
      }
      toast.success('Violation resolved successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to resolve violation');
      setError(message);
      toast.error(message);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-danger-600/20 text-danger-400 rounded text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-500 rounded text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  const getPolicyTypeLabel = (type: string) => {
    return POLICY_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getEnforcementLabel = (action: string) => {
    return ENFORCEMENT_ACTIONS.find((a) => a.value === action)?.label || action;
  };

  if (loading && policies.length === 0) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="DLP data unavailable" description={loadError} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Policies</p>
                <p className="text-xl font-semibold">{stats?.policies.total || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Power className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Policies</p>
                <p className="text-xl font-semibold">{stats?.policies.active || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Violations</p>
                <p className="text-xl font-semibold">{stats?.violations.total || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Unresolved</p>
                <p className="text-xl font-semibold">{stats?.violations.unresolved || 0}</p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-600/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-danger-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Critical</p>
                <p className="text-xl font-semibold">
                  {stats?.violations.bySeverity.critical || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Card variant="bordered" className="p-4 border-danger-500/30 bg-danger-500/5">
          <div role="alert" className="flex items-center gap-2 text-danger-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-sm hover:text-danger-300"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-c-border">
        <button
          onClick={() => setActiveTab('policies')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'policies'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          Policies ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab('violations')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'violations'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200'
          }`}
        >
          Violations ({violations.length})
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {activeTab === 'policies' ? 'DLP Policies' : 'DLP Violations'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {activeTab === 'policies' && (
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!!loadError}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Policy
            </button>
          )}
        </div>
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <CardWithHeader title="Policies" subtitle={`${policies.length} policies`}>
          {loadError ? (
            <div className="p-6">
              <DegradedState title="DLP policies unavailable" description={loadError} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
              >
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Enforcement
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Rules
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {policies.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-slate-600 dark:text-slate-400"
                      >
                        No DLP policies found
                      </td>
                    </tr>
                  ) : (
                    policies.map((policy) => (
                      <tr
                        key={policy.id}
                        className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{policy.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-xs">
                              {policy.description}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-c-surface-raised rounded text-xs">
                            {getPolicyTypeLabel(policy.policyType)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              policy.enforcementAction === 'block'
                                ? 'bg-danger-500/10 text-danger-400'
                                : policy.enforcementAction === 'warn'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-500'
                            }`}
                          >
                            {getEnforcementLabel(policy.enforcementAction)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{policy.rules?.length || 0} rules</td>
                        <td className="py-3 px-4">
                          {policy.isActive ? (
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-500 rounded text-xs">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleTogglePolicy(policy.id, policy.isActive)}
                              aria-label={`${policy.isActive ? 'Deactivate' : 'Activate'} DLP policy ${policy.id}`}
                              className={`p-2 rounded-lg transition-colors ${
                                policy.isActive
                                  ? 'text-amber-400 hover:bg-amber-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={policy.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {policy.isActive ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeletePolicy(policy.id)}
                              aria-label={`Delete DLP policy ${policy.id}`}
                              className="p-2 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardWithHeader>
      )}

      {/* Violations Tab */}
      {activeTab === 'violations' && (
        <CardWithHeader title="Violations" subtitle={`${violations.length} unresolved violations`}>
          {loadError ? (
            <div className="p-6">
              <DegradedState title="DLP violations unavailable" description={loadError} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Policy
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Resource
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Violation
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Severity
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Detected
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {violations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-slate-600 dark:text-slate-400"
                      >
                        No unresolved violations
                      </td>
                    </tr>
                  ) : (
                    violations.map((violation) => (
                      <tr
                        key={violation.id}
                        className="border-b border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{violation.policyName}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {getPolicyTypeLabel(violation.policyType)}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm">{violation.resourceType}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                              {violation.resourceId}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-c-surface-raised rounded text-xs font-mono">
                            {violation.violationType}
                          </span>
                        </td>
                        <td className="py-3 px-4">{getSeverityBadge(violation.severity)}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDateTime(violation.detectedAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleResolveViolation(violation.id)}
                            aria-label={`Resolve DLP violation ${violation.id}`}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Resolve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardWithHeader>
      )}

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <Card variant="elevated" className="w-full max-w-2xl p-6 m-4">
            <h3 className="text-lg font-semibold mb-4">Create DLP Policy</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Policy name"
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                    Policy Type
                  </label>
                  <select
                    value={formData.policyType}
                    onChange={(e) => setFormData({ ...formData, policyType: e.target.value })}
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                  >
                    {POLICY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Policy description"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm h-20 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-500 mb-1">
                  Enforcement Action
                </label>
                <select
                  value={formData.enforcementAction}
                  onChange={(e) => setFormData({ ...formData, enforcementAction: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                >
                  {ENFORCEMENT_ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rules Section */}
              <div className="border-t border-c-border pt-4">
                <h4 className="font-medium mb-3">Detection Rules</h4>

                {/* Existing Rules */}
                {formData.rules.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.rules.map((rule, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-500">
                            {rule.pattern && `Pattern: ${rule.pattern}`}
                            {rule.keywords && ` Keywords: ${rule.keywords.join(', ')}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveRule(index)}
                          className="p-1 text-danger-400 hover:bg-danger-500/10 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Rule Form */}
                <div className="p-3 bg-c-surface-raised/50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-500 mb-1">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="e.g., Credit Card Numbers"
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-500 mb-1">
                        Severity
                      </label>
                      <select
                        value={newRule.severity}
                        onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                      >
                        {SEVERITY_LEVELS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-500 mb-1">
                      Regex Pattern (optional)
                    </label>
                    <input
                      type="text"
                      value={newRule.pattern}
                      onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                      placeholder="e.g., \d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}"
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-500 mb-1">
                      Keywords (comma-separated, optional)
                    </label>
                    <input
                      type="text"
                      value={newRule.keywords}
                      onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                      placeholder="e.g., ssn, social security, password"
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={handleAddRule}
                    disabled={!newRule.name}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Rule
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    name: '',
                    description: '',
                    policyType: 'pii_detection',
                    enforcementAction: 'warn',
                    rules: [],
                  });
                }}
                className="px-4 py-2 text-sm bg-c-surface-raised hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formData.name}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 rounded-lg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Policy
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DLPView;
