/**
 * EnterpriseFeatureFlags - Advanced Feature Flag Management
 *
 * Features:
 * - Boolean, percentage rollout, and targeting rules
 * - A/B testing with variants
 * - User targeting by segments
 * - Environment management
 * - Audit history
 * - Real-time evaluation preview
 */

import {
  Beaker,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Edit,
  Eye,
  Flag,
  History,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Target,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { EmptyState, LoadingState } from '../../shared/states';

interface FeatureFlag {
  id: string;
  flag_key: string;
  name: string;
  description?: string;
  enabled: boolean;
  flag_type: 'boolean' | 'percentage' | 'targeting' | 'ab_test';
  targeting_rules: TargetingRule[];
  rollout_percentage: number;
  environment: string;
  organization_id?: string;
  variants?: Variant[];
  created_at: string;
  updated_at: string;
}

interface TargetingRule {
  id: string;
  type: 'email_domain' | 'org_id' | 'user_id' | 'role' | 'percentage' | 'attribute';
  attribute?: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'gt' | 'lt';
  values: string[];
  enabled: boolean;
}

interface Variant {
  id: string;
  name: string;
  weight: number;
  value: unknown;
}

interface FlagHistory {
  id: string;
  change_type: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string;
  changed_at: string;
}

type FeatureFlagFormData = Pick<
  FeatureFlag,
  | 'flag_key'
  | 'name'
  | 'description'
  | 'enabled'
  | 'flag_type'
  | 'rollout_percentage'
  | 'environment'
  | 'targeting_rules'
  | 'variants'
>;

const FLAG_TYPE_CONFIG = {
  boolean: {
    icon: ToggleRight,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    label: 'Boolean',
  },
  percentage: { icon: Percent, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Percentage' },
  targeting: {
    icon: Target,
    color: 'text-c-accent',
    bg: 'bg-c-accent/20',
    label: 'Targeting',
  },
  ab_test: { icon: Beaker, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'A/B Test' },
};

const ENVIRONMENTS = ['development', 'staging', 'production'];
const fallbackFlagTypeConfig = {
  icon: Flag,
  color: 'text-c-text-secondary',
  bg: 'bg-c-surface-raised/20',
  label: 'Unknown',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeFeatureFlags = (payload: unknown): FeatureFlag[] => {
  if (Array.isArray(payload)) return payload as FeatureFlag[];
  if (isRecord(payload)) {
    if (Array.isArray(payload.flags)) return payload.flags as FeatureFlag[];
    if (Array.isArray(payload.featureFlags)) return payload.featureFlags as FeatureFlag[];
    if (Array.isArray(payload.data)) return payload.data as FeatureFlag[];
  }
  throw new Error('Feature flags response was not a list');
};

const getCreatedFeatureFlagId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const flag = isRecord(result.flag) ? result.flag : null;
  return String(
    result.id || flag?.id || data?.id || (isRecord(data?.flag) ? data.flag.id : '') || ''
  );
};

const flagMatchesSave = (flag: FeatureFlag, expected: FeatureFlagFormData, id?: string) =>
  (!id || flag.id === id) &&
  flag.flag_key === expected.flag_key &&
  flag.name === expected.name &&
  flag.environment === expected.environment &&
  flag.flag_type === expected.flag_type &&
  flag.enabled === expected.enabled;

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

export const EnterpriseFeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [selectedFlagHistory, setSelectedFlagHistory] = useState<string | null>(null);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [testContext, setTestContext] = useState({ userId: '', email: '', orgId: '', role: '' });
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { environment?: string } = {};
      if (filterEnvironment !== 'all') {
        filters.environment = filterEnvironment;
      }
      const data = await Api.getFeatureFlags(filters);
      const normalized = normalizeFeatureFlags(data);
      setFlags(normalized);
      setLoadError(null);
      return normalized;
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to load feature flags');
      setLoadError(message);
      setFlags([]);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filterEnvironment]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    setActionError(null);
    try {
      const expectedEnabled = !flag.enabled;
      await Api.toggleFeatureFlag(flag.id, expectedEnabled);
      const refreshed = await fetchFlags();
      if (
        !refreshed?.some(
          (refreshedFlag) =>
            refreshedFlag.id === flag.id && refreshedFlag.enabled === expectedEnabled
        )
      ) {
        throw new Error('Feature flag toggle was not confirmed by the server');
      }
      toast.success(`Feature flag ${expectedEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to toggle feature flag');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;

    setActionError(null);
    try {
      await Api.deleteFeatureFlag(id);
      const refreshed = await fetchFlags();
      if (!refreshed || refreshed.some((flag) => flag.id === id)) {
        throw new Error('Feature flag deletion was not confirmed by the server');
      }
      toast.success('Feature flag deleted');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete feature flag');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleSaved = async (
    expected: FeatureFlagFormData,
    flag?: FeatureFlag | null,
    savedId?: string
  ) => {
    setActionError(null);
    if (!flag && !savedId) {
      const message = 'Feature flag creation response was incomplete';
      setActionError(message);
      throw new Error(message);
    }
    const refreshed = await fetchFlags();
    const expectedId = flag?.id || savedId;
    if (!refreshed?.some((refreshedFlag) => flagMatchesSave(refreshedFlag, expected, expectedId))) {
      const message = flag
        ? 'Feature flag update was not confirmed by the server'
        : 'Feature flag creation was not confirmed by the server';
      setActionError(message);
      throw new Error(message);
    }
    setShowCreateModal(false);
    setEditingFlag(null);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Flag key copied');
  };

  const evaluateFlag = (
    flag: FeatureFlag
  ): { enabled: boolean; variant?: string; reason: string } => {
    if (!flag.enabled) {
      return { enabled: false, reason: 'Flag is disabled globally' };
    }

    if (flag.flag_type === 'boolean') {
      return { enabled: true, reason: 'Boolean flag enabled' };
    }

    if (flag.flag_type === 'percentage') {
      // Simple hash-based percentage
      if (testContext.userId) {
        const hash = hashCode(testContext.userId + flag.flag_key);
        const bucket = Math.abs(hash % 100);
        if (bucket < flag.rollout_percentage) {
          return {
            enabled: true,
            reason: `User in rollout (${bucket}% < ${flag.rollout_percentage}%)`,
          };
        }
        return {
          enabled: false,
          reason: `User not in rollout (${bucket}% >= ${flag.rollout_percentage}%)`,
        };
      }
      return { enabled: false, reason: 'No user context for percentage evaluation' };
    }

    if (flag.flag_type === 'targeting') {
      for (const rule of flag.targeting_rules || []) {
        if (!rule.enabled) continue;
        if (evaluateRule(rule, testContext)) {
          return { enabled: true, reason: `Matched rule: ${rule.type}` };
        }
      }
      return { enabled: false, reason: 'No targeting rules matched' };
    }

    if (flag.flag_type === 'ab_test' && flag.variants) {
      if (testContext.userId) {
        const hash = hashCode(testContext.userId + flag.flag_key);
        const totalWeight = flag.variants.reduce((acc, v) => acc + v.weight, 0);
        let bucket = Math.abs(hash % totalWeight);
        for (const variant of flag.variants) {
          bucket -= variant.weight;
          if (bucket < 0) {
            return {
              enabled: true,
              variant: variant.name,
              reason: `A/B test variant: ${variant.name}`,
            };
          }
        }
      }
      return { enabled: false, reason: 'No user context for A/B evaluation' };
    }

    return { enabled: false, reason: 'Unknown flag type' };
  };

  const evaluateRule = (rule: TargetingRule, context: typeof testContext): boolean => {
    let value = '';
    switch (rule.type) {
      case 'email_domain':
        value = context.email.split('@')[1] || '';
        break;
      case 'org_id':
        value = context.orgId;
        break;
      case 'user_id':
        value = context.userId;
        break;
      case 'role':
        value = context.role;
        break;
      default:
        return false;
    }

    switch (rule.operator) {
      case 'equals':
        return rule.values.includes(value);
      case 'in':
        return rule.values.includes(value);
      case 'not_in':
        return !rule.values.includes(value);
      case 'contains':
        return rule.values.some((v) => value.includes(v));
      case 'starts_with':
        return rule.values.some((v) => value.startsWith(v));
      case 'ends_with':
        return rule.values.some((v) => value.endsWith(v));
      default:
        return false;
    }
  };

  const hashCode = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash;
  };

  const filteredFlags = flags.filter((flag) => {
    const matchesSearch =
      !searchTerm ||
      flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.flag_key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || flag.flag_type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="p-8">
        <LoadingState template="list" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text">Feature Flags</h2>
          <p className="text-c-text-secondary text-sm">
            Control feature availability with targeting, A/B testing, and percentage rollouts
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create Flag
        </button>
      </div>

      {/* Stats */}
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger/30 bg-c-danger/5 p-4 text-sm text-c-danger"
        >
          {actionError}
        </div>
      )}

      {loadError ? (
        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
          <DegradedState title="Feature flag overview unavailable" description={loadError} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
            <div className="text-sm text-c-text-secondary">Total Flags</div>
            <div className="text-2xl font-bold text-c-text">{flags.length}</div>
          </div>
          <div className="p-4 bg-c-success/10 rounded-xl border border-c-success/30">
            <div className="text-sm text-c-text-secondary">Enabled</div>
            <div className="text-2xl font-bold text-c-success">
              {flags.filter((f) => f.enabled).length}
            </div>
          </div>
          <div className="p-4 bg-c-info/10 rounded-xl border border-c-info/30">
            <div className="text-sm text-c-text-secondary">Rollouts</div>
            <div className="text-2xl font-bold text-c-info">
              {flags.filter((f) => f.flag_type === 'percentage').length}
            </div>
          </div>
          <div className="p-4 bg-c-warning/10 rounded-xl border border-c-warning/30">
            <div className="text-sm text-c-text-secondary">A/B Tests</div>
            <div className="text-2xl font-bold text-c-warning">
              {flags.filter((f) => f.flag_type === 'ab_test').length}
            </div>
          </div>
          <div className="p-4 bg-c-accent-soft rounded-xl border border-c-accent/30">
            <div className="text-sm text-c-text-secondary">Production</div>
            <div className="text-2xl font-bold text-c-accent">
              {flags.filter((f) => f.environment === 'production' && f.enabled).length}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-64 relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-c-text-muted"
            size={16}
          />
          <input
            type="text"
            placeholder="Search flags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!!loadError}
            className="w-full pl-10 pr-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text placeholder-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
        </div>
        <select
          value={filterEnvironment}
          onChange={(e) => setFilterEnvironment(e.target.value)}
          disabled={!!loadError}
          className="px-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <option value="all">All Environments</option>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {env.charAt(0).toUpperCase() + env.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          disabled={!!loadError}
          className="px-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <option value="all">All Types</option>
          {Object.entries(FLAG_TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
        <button
          onClick={fetchFlags}
          disabled={loading}
          className="p-2 bg-c-surface hover:bg-c-surface-raised border border-c-border-subtle rounded-lg"
        >
          <RefreshCw className="w-4 h-4 text-c-text-secondary" />
        </button>
      </div>

      {/* Test Context Panel */}
      {!loadError && (
        <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-c-info" />
            <span className="text-sm font-medium text-c-text">Test Evaluation Context</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-c-text-muted mb-1">User ID</label>
              <input
                type="text"
                value={testContext.userId}
                onChange={(e) => setTestContext({ ...testContext, userId: e.target.value })}
                className="w-full px-2 py-1.5 bg-c-surface-raised border border-c-border-subtle rounded text-sm text-c-text"
                placeholder="user-123"
              />
            </div>
            <div>
              <label className="block text-xs text-c-text-muted mb-1">Email</label>
              <input
                type="text"
                value={testContext.email}
                onChange={(e) => setTestContext({ ...testContext, email: e.target.value })}
                className="w-full px-2 py-1.5 bg-c-surface-raised border border-c-border-subtle rounded text-sm text-c-text"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-c-text-muted mb-1">Organization ID</label>
              <input
                type="text"
                value={testContext.orgId}
                onChange={(e) => setTestContext({ ...testContext, orgId: e.target.value })}
                className="w-full px-2 py-1.5 bg-c-surface-raised border border-c-border-subtle rounded text-sm text-c-text"
                placeholder="org-abc"
              />
            </div>
            <div>
              <label className="block text-xs text-c-text-muted mb-1">Role</label>
              <input
                type="text"
                value={testContext.role}
                onChange={(e) => setTestContext({ ...testContext, role: e.target.value })}
                className="w-full px-2 py-1.5 bg-c-surface-raised border border-c-border-subtle rounded text-sm text-c-text"
                placeholder="admin"
              />
            </div>
          </div>
        </div>
      )}

      {/* Flags List */}
      <div className="space-y-2">
        {loadError ? (
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
            <DegradedState title="Feature flags unavailable" description={loadError} />
          </div>
        ) : filteredFlags.length === 0 ? (
          <EmptyState
            variant="new"
            icon={Flag}
            title="No feature flags found"
            description="Create a flag to control feature availability with targeting, rollouts, or A/B tests."
          />
        ) : (
          filteredFlags.map((flag) => {
            const typeConfig = FLAG_TYPE_CONFIG[flag.flag_type] || fallbackFlagTypeConfig;
            const TypeIcon = typeConfig.icon;
            const isExpanded = expandedFlag === flag.id;
            const evaluation = evaluateFlag(flag);

            return (
              <div
                key={flag.id}
                className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden hover:border-c-border-strong transition-colors"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedFlag(isExpanded ? null : flag.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
                        <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-c-text font-medium">{flag.name}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyKey(flag.flag_key);
                            }}
                            aria-label={`Copy flag key for ${flag.name}`}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded hover:bg-c-border"
                          >
                            <Code className="w-3 h-3" />
                            {flag.flag_key}
                          </button>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${typeConfig.bg} ${typeConfig.color}`}
                          >
                            {typeConfig.label}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded">
                            {flag.environment}
                          </span>
                        </div>
                        {flag.description && (
                          <p className="text-sm text-c-text-muted">{flag.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Evaluation Preview */}
                      <div
                        className={`px-3 py-1 text-xs rounded-full ${
                          evaluation.enabled
                            ? 'bg-c-success/20 text-c-success'
                            : 'bg-c-surface-raised text-c-text-secondary'
                        }`}
                      >
                        {evaluation.enabled ? evaluation.variant || 'ON' : 'OFF'}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(flag);
                        }}
                        aria-label={`${flag.enabled ? 'Disable' : 'Enable'} ${flag.name}`}
                        className={`p-2 rounded-lg transition-colors ${
                          flag.enabled
                            ? 'bg-c-success/20 text-c-success hover:bg-c-success/30'
                            : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border'
                        }`}
                      >
                        {flag.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFlag(flag);
                          setShowCreateModal(true);
                        }}
                        aria-label={`Edit ${flag.name}`}
                        className="p-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-border transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFlagHistory(flag.id);
                        }}
                        aria-label={`View history for ${flag.name}`}
                        className="p-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-border transition-colors"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(flag.id);
                        }}
                        aria-label={`Delete ${flag.name}`}
                        className="p-2 rounded-lg bg-c-danger/20 text-c-danger hover:bg-c-danger/30 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-c-text-secondary" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-c-text-secondary" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-c-border-subtle">
                    <div className="pt-4 space-y-4">
                      {/* Evaluation Reason */}
                      <div className="p-3 bg-c-surface-raised rounded-lg border border-c-border-subtle">
                        <div className="text-xs text-c-text-muted mb-1">Evaluation Reason</div>
                        <div className="text-sm text-c-text-secondary">{evaluation.reason}</div>
                      </div>

                      {/* Percentage Rollout */}
                      {flag.flag_type === 'percentage' && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-c-text-secondary">Rollout Progress</span>
                            <span className="text-c-text">{flag.rollout_percentage}%</span>
                          </div>
                          <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-c-info to-c-info rounded-full"
                              style={{ width: `${flag.rollout_percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Targeting Rules */}
                      {flag.flag_type === 'targeting' && flag.targeting_rules?.length > 0 && (
                        <div>
                          <div className="text-sm text-c-text-secondary mb-2">Targeting Rules</div>
                          <div className="space-y-2">
                            {flag.targeting_rules.map((rule, i) => (
                              <div
                                key={rule.id || i}
                                className={`p-2 rounded-lg ${
                                  rule.enabled
                                    ? 'bg-c-accent/10 border border-c-accent/30'
                                    : 'bg-c-surface  border border-c-border-subtle dark:border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <span
                                    className={
                                      rule.enabled ? 'text-c-accent' : 'text-c-text-muted '
                                    }
                                  >
                                    {rule.type}
                                  </span>
                                  <span className="text-c-text-muted">{rule.operator}</span>
                                  <code className="text-xs bg-c-surface px-1 rounded text-c-text-secondary border border-c-border-subtle dark:border-transparent">
                                    {rule.values.join(', ')}
                                  </code>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* A/B Test Variants */}
                      {flag.flag_type === 'ab_test' && flag.variants && (
                        <div>
                          <div className="text-sm text-c-text-secondary mb-2">Variants</div>
                          <div className="space-y-2">
                            {flag.variants.map((variant) => (
                              <div
                                key={variant.id}
                                className={`p-3 rounded-lg ${
                                  evaluation.variant === variant.name
                                    ? 'bg-amber-500/20 border border-amber-500/30'
                                    : 'bg-c-surface  border border-c-border-subtle dark:border-transparent'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`font-medium ${
                                      evaluation.variant === variant.name
                                        ? 'text-amber-400'
                                        : 'text-c-text-secondary '
                                    }`}
                                  >
                                    {variant.name}
                                  </span>
                                  <span className="text-sm text-c-text-secondary">
                                    {variant.weight}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-c-text-muted">Created</span>
                          <div className="text-c-text-secondary">{formatDate(flag.created_at)}</div>
                        </div>
                        <div>
                          <span className="text-c-text-muted">Updated</span>
                          <div className="text-c-text-secondary">{formatDate(flag.updated_at)}</div>
                        </div>
                        {flag.organization_id && (
                          <div>
                            <span className="text-c-text-muted">Org-specific</span>
                            <div className="text-c-text-secondary">
                              {flag.organization_id.slice(0, 8)}...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <FeatureFlagModal
          flag={editingFlag}
          onClose={() => {
            setShowCreateModal(false);
            setEditingFlag(null);
          }}
          onSave={handleSaved}
        />
      )}

      {/* History Modal */}
      {selectedFlagHistory && (
        <FlagHistoryModal
          flagId={selectedFlagHistory}
          onClose={() => setSelectedFlagHistory(null)}
        />
      )}
    </div>
  );
};

// Feature Flag Modal Component
const FeatureFlagModal: React.FC<{
  flag?: FeatureFlag | null;
  onClose: () => void;
  onSave: (
    expected: FeatureFlagFormData,
    flag?: FeatureFlag | null,
    savedId?: string
  ) => Promise<void>;
}> = ({ flag, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    flag_key: flag?.flag_key || '',
    name: flag?.name || '',
    description: flag?.description || '',
    enabled: flag?.enabled || false,
    flag_type: flag?.flag_type || 'boolean',
    rollout_percentage: flag?.rollout_percentage || 0,
    environment: flag?.environment || 'production',
    targeting_rules: flag?.targeting_rules || [],
    variants: flag?.variants || [
      { id: '1', name: 'control', weight: 50, value: null },
      { id: '2', name: 'variant_a', weight: 50, value: null },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      let savedId = flag?.id;
      if (flag) {
        await Api.updateFeatureFlag(flag.id, formData);
      } else {
        const result = await Api.createFeatureFlag(formData);
        savedId = getCreatedFeatureFlagId(result);
      }
      await onSave(formData, flag, savedId);
      toast.success(flag ? 'Feature flag updated' : 'Feature flag created');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to save feature flag');
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-white/10 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-c-text-secondary">
            {flag ? 'Edit Feature Flag' : 'Create Feature Flag'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-c-surface dark:hover:bg-c-surface/40 rounded-lg"
          >
            <X size={20} className="text-c-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-3 text-sm text-danger-600 dark:text-danger-300"
            >
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Flag Key *
              </label>
              <input
                type="text"
                required
                value={formData.flag_key}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    flag_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                  })
                }
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-white/10 rounded-lg text-c-text-secondary"
                placeholder="new_feature"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">Name *</label>
              <input
                type="text"
                required
                aria-label="Flag Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-white/10 rounded-lg text-c-text-secondary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-white/10 rounded-lg text-c-text-secondary"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">Type *</label>
              <select
                value={formData.flag_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    flag_type: e.target.value as FeatureFlag['flag_type'],
                  })
                }
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-white/10 rounded-lg text-c-text-secondary"
              >
                {Object.entries(FLAG_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Environment *
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-white/10 rounded-lg text-c-text-secondary"
              >
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>
                    {env.charAt(0).toUpperCase() + env.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.flag_type === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Rollout Percentage: {formData.rollout_percentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.rollout_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-c-accent bg-c-surface border-c-border-subtle dark:border-white/10 rounded"
            />
            <label htmlFor="enabled" className="text-sm text-c-text-secondary">
              Enable flag immediately
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-c-text-secondary hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {flag ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Flag History Modal Component
const FlagHistoryModal: React.FC<{
  flagId: string;
  onClose: () => void;
}> = ({ flagId, onClose }) => {
  const [history, setHistory] = useState<FlagHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await Api.getFeatureFlagHistory(flagId);
        setHistory(data);
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load flag history');
        setHistory([]);
        toast.error('Failed to load flag history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [flagId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-c-surface rounded-xl border border-white/10 p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-c-text">Feature Flag History</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-c-surface dark:hover:bg-c-surface/40 rounded-lg"
          >
            <X size={20} className="text-c-text-secondary" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-c-text-secondary animate-spin" />
          </div>
        ) : loadError ? (
          <DegradedState title="Feature flag history unavailable" description={loadError} />
        ) : (
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-c-text-secondary text-center py-8">No history available</p>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-c-surface/30 rounded-lg border border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-c-text">{item.change_type}</span>
                    <span className="text-xs text-c-text-muted">
                      {new Date(item.changed_at).toLocaleString()}
                    </span>
                  </div>
                  {item.changed_by && (
                    <p className="text-xs text-c-text-secondary">Changed by: {item.changed_by}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterpriseFeatureFlags;
