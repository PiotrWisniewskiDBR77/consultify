/**
 * ModelTierAssignments - SuperAdmin UI for Model-to-Tier Configuration
 *
 * Features:
 * - Assign models to multiple tiers (many-to-many)
 * - Drag & drop priority ordering within tiers
 * - Visual representation of tier hierarchy
 * - Real-time health status display
 */

import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Crown,
  GripVertical,
  Layers,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';

import { InfoButton } from '../shared/InfoButton';

interface LLMProvider {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  is_active: boolean;
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

interface TierAssignment {
  id: string;
  tier: string;
  priority: number;
  is_active: boolean;
  provider_id: string;
  name: string;
  provider: string;
  model_id: string;
  health_status: string;
}

interface TierData {
  [tier: string]: TierAssignment[];
}

const TIER_CONFIG = {
  BUDGET: {
    icon: Zap,
    color: 'emerald',
    description: 'Fast, cost-effective models for simple tasks',
    bgClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
    textClass: 'text-emerald-800 dark:text-emerald-300',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  STANDARD: {
    icon: Server,
    color: 'blue',
    description: 'Balanced performance for most use cases',
    bgClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
    textClass: 'text-blue-800 dark:text-blue-300',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  },
  PREMIUM: {
    icon: Crown,
    color: 'violet',
    description: 'High-quality output for complex tasks',
    bgClass: 'bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30',
    textClass: 'text-primary-800 dark:text-primary-300',
    badgeClass: 'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200',
  },
  REASONING: {
    icon: Brain,
    color: 'amber',
    description: 'Advanced reasoning for deep analysis',
    bgClass: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    textClass: 'text-amber-900 dark:text-amber-300',
    badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  },
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
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
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

const normalizeProviders = (value: unknown): LLMProvider[] => {
  if (!hasListShape(value, ['providers', 'items'])) {
    throw new Error('LLM providers response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['providers', 'items'])
    .map((provider) => {
      const health_status: LLMProvider['health_status'] =
        provider.health_status === 'healthy' ||
        provider.health_status === 'degraded' ||
        provider.health_status === 'unhealthy'
          ? provider.health_status
          : 'unknown';

      return {
        id: asText(provider.id, ''),
        name: asText(provider.name, ''),
        provider: asText(provider.provider, ''),
        model_id: asText(provider.model_id, ''),
        is_active: toBool(provider.is_active, true),
        health_status,
      };
    })
    .filter((provider) => provider.id);
};

const normalizeAssignmentRows = (value: unknown, fallbackTier: string): TierAssignment[] =>
  Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((assignment, index) => ({
          id: asText(assignment.id, `${fallbackTier}-${index + 1}`),
          tier: asText(assignment.tier, fallbackTier),
          priority: Number.isFinite(Number(assignment.priority))
            ? Number(assignment.priority)
            : index,
          is_active: toBool(assignment.is_active, true),
          provider_id: asText(assignment.provider_id, ''),
          name: asText(assignment.name, ''),
          provider: asText(assignment.provider, ''),
          model_id: asText(assignment.model_id, ''),
          health_status: asText(assignment.health_status, 'unknown'),
        }))
        .filter((assignment) => assignment.provider_id)
    : [];

const normalizeAssignments = (value: unknown): TierData => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !isRecord(payload.assignments)) {
    throw new Error('Tier assignments response was not an object');
  }

  return Object.fromEntries(
    Object.entries(payload.assignments).map(([tier, rows]) => [
      tier,
      normalizeAssignmentRows(rows, tier),
    ])
  );
};

const tierContainsProvider = (assignments: TierData, tier: string, providerId: string) =>
  (assignments[tier] || []).some((assignment) => assignment.provider_id === providerId);

export const ModelTierAssignments: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [assignments, setAssignments] = useState<TierData>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(
    new Set(['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'])
  );
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading !== false) setLoading(true);
    setLoadError(null);
    try {
      const [assignmentsRes, providersRes] = await Promise.all([
        fetch('/api/llm/tiers/assignments', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/llm/providers', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (!assignmentsRes.ok) {
        throw new Error('Tier assignments endpoint returned an error');
      }
      if (!providersRes.ok) {
        throw new Error('LLM providers endpoint returned an error');
      }

      const assignmentsData = await assignmentsRes.json();
      const providersData = await providersRes.json();
      const nextAssignments = normalizeAssignments(assignmentsData);
      const nextProviders = normalizeProviders(providersData);
      setAssignments(nextAssignments);
      setProviders(nextProviders.filter((p) => p.is_active));
      return { assignments: nextAssignments, providers: nextProviders };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load tier assignments';
      setLoadError(message);
      setAssignments({});
      setProviders([]);
      toast.error(message);
      return null;
    } finally {
      if (options.showLoading !== false) setLoading(false);
    }
  };

  const getUnassignedProviders = (tier: string) => {
    const assignedIds = new Set((assignments[tier] || []).map((a) => a.provider_id));
    return providers.filter((p) => !assignedIds.has(p.id));
  };

  const handleAddToTier = async (providerId: string, tier: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    const currentAssignments = assignments[tier] || [];
    const newPriority = currentAssignments.length;

    // Optimistic update
    const newAssignment: TierAssignment = {
      id: `${providerId}-${tier}`,
      tier,
      priority: newPriority,
      is_active: true,
      provider_id: providerId,
      name: provider.name,
      provider: provider.provider,
      model_id: provider.model_id,
      health_status: provider.health_status || 'unknown',
    };

    setAssignments((prev) => ({
      ...prev,
      [tier]: [...(prev[tier] || []), newAssignment],
    }));
    setActionError(null);

    // Save immediately
    try {
      const res = await fetch('/api/llm/tiers/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ providerId, tier, priority: newPriority }),
      });

      if (!res.ok) throw new Error('Failed to assign');
      const refreshed = await loadData({ showLoading: false });
      if (!refreshed || !tierContainsProvider(refreshed.assignments, tier, providerId)) {
        throw new Error('Tier assignment was not confirmed by the server');
      }
      toast.success(`Added ${provider.name} to ${tier}`);
    } catch (err: unknown) {
      // Revert optimistic update
      setAssignments((prev) => ({
        ...prev,
        [tier]: (prev[tier] || []).filter((a) => a.provider_id !== providerId),
      }));
      const message = err instanceof Error ? err.message : 'Failed to add model to tier';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleRemoveFromTier = async (providerId: string, tier: string) => {
    const assignment = (assignments[tier] || []).find((a) => a.provider_id === providerId);
    if (!assignment) return;

    // Optimistic update
    setAssignments((prev) => ({
      ...prev,
      [tier]: (prev[tier] || []).filter((a) => a.provider_id !== providerId),
    }));
    setActionError(null);

    try {
      const res = await fetch('/api/llm/tiers/assign', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ providerId, tier }),
      });

      if (!res.ok) throw new Error('Failed to remove');
      const refreshed = await loadData({ showLoading: false });
      if (!refreshed || tierContainsProvider(refreshed.assignments, tier, providerId)) {
        throw new Error('Tier assignment removal was not confirmed by the server');
      }
      toast.success(`Removed ${assignment.name} from ${tier}`);
    } catch (err: unknown) {
      // Revert
      setAssignments((prev) => ({
        ...prev,
        [tier]: tierContainsProvider(prev, tier, providerId)
          ? prev[tier] || []
          : [...(prev[tier] || []), assignment],
      }));
      const message = err instanceof Error ? err.message : 'Failed to remove model from tier';
      setActionError(message);
      toast.error(message);
    }
  };

  const handleReorder = async (tier: string, newOrder: TierAssignment[]) => {
    // Update local state immediately
    setAssignments((prev) => ({
      ...prev,
      [tier]: newOrder.map((item, idx) => ({ ...item, priority: idx })),
    }));

    // Save priority changes
    try {
      for (let i = 0; i < newOrder.length; i++) {
        await fetch('/api/llm/tiers/priority', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            providerId: newOrder[i].provider_id,
            tier,
            priority: i,
          }),
        });
      }
    } catch (_err) {
      toast.error('Failed to update priorities');
    }
  };

  const toggleTier = (tier: string) => {
    setExpandedTiers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tier)) {
        newSet.delete(tier);
      } else {
        newSet.add(tier);
      }
      return newSet;
    });
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={14} className="text-emerald-400" />;
      case 'degraded':
        return <AlertTriangle size={14} className="text-amber-400" />;
      case 'unhealthy':
        return <XCircle size={14} className="text-danger-400" />;
      default:
        return <Server size={14} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={32} className="animate-spin text-primary-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState title="Model tier assignments unavailable" description={loadError} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full relative bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white">
      <InfoButton cardId="superadmin-ai-model-tiers" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10">
              <Layers size={24} className="text-primary-400" />
            </div>
            Model Tier Assignments
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Assign models to performance tiers. Models can belong to multiple tiers. Drag to reorder
            priority within each tier.
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className="flex items-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
        >
          {actionError}
        </div>
      ) : null}

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-blue-800 dark:text-blue-200 font-medium">How It Works</h4>
            <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
              When a user selects a tier, the system automatically picks the best available model
              using round-robin selection. If all models in a tier fail, the system falls back to
              lower tiers automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Sections */}
      <div className="space-y-4">
        {Object.entries(TIER_CONFIG).map(([tier, config]) => {
          const TierIcon = config.icon;
          const tierAssignments = assignments[tier] || [];
          const isExpanded = expandedTiers.has(tier);
          const unassignedProviders = getUnassignedProviders(tier);

          return (
            <div key={tier} className={`rounded-xl border ${config.bgClass} overflow-hidden`}>
              {/* Tier Header */}
              <button
                onClick={() => toggleTier(tier)}
                className="w-full flex items-center justify-between p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.badgeClass}`}>
                    <TierIcon size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className={`font-semibold ${config.textClass}`}>{tier}</h3>
                    <p className="text-sm text-slate-700 dark:text-slate-400">
                      {config.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm ${config.badgeClass}`}>
                    {tierAssignments.length} models
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={20} className="text-slate-600 dark:text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-600 dark:text-slate-400" />
                  )}
                </div>
              </button>

              {/* Tier Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-200 dark:border-c-border-subtle"
                  >
                    <div className="p-4 space-y-3">
                      {/* Assigned Models (Reorderable) */}
                      {tierAssignments.length > 0 ? (
                        <Reorder.Group
                          axis="y"
                          values={tierAssignments}
                          onReorder={(newOrder) => handleReorder(tier, newOrder)}
                          className="space-y-2"
                        >
                          {tierAssignments.map((assignment, index) => (
                            <Reorder.Item
                              key={assignment.id}
                              value={assignment}
                              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-navy-800/50 border border-slate-200 dark:border-c-border-subtle rounded-xl cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical
                                size={16}
                                className="text-slate-500 dark:text-slate-400"
                              />
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-6">
                                #{index + 1}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-900 dark:text-white font-medium">
                                    {assignment.name}
                                  </span>
                                  {getHealthIcon(assignment.health_status)}
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {assignment.provider} • {assignment.model_id}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromTier(assignment.provider_id, tier);
                                }}
                                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.03] rounded-lg transition-colors hover:text-danger-600 dark:hover:text-danger-400"
                                title="Remove model from tier"
                              >
                                <Trash2 size={16} />
                              </button>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      ) : (
                        <div className="text-center py-6 text-slate-600 dark:text-slate-400">
                          No models assigned to this tier
                        </div>
                      )}

                      {/* Add Model Dropdown */}
                      {unassignedProviders.length > 0 && (
                        <div className="pt-2">
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddToTier(e.target.value, tier);
                              }
                            }}
                            className="w-full px-4 py-3 bg-white dark:bg-navy-900/30 border border-dashed border-slate-300 dark:border-c-border rounded-xl text-slate-700 dark:text-slate-300 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                          >
                            <option value="">+ Add model to {tier}</option>
                            {unassignedProviders.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.provider} - {p.model_id})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Available Providers Reference */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-c-border-subtle p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Server size={20} className="text-slate-600 dark:text-slate-400" />
          Available Providers ({providers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map((p) => {
            const assignedTiers = Object.entries(assignments)
              .filter(([, items]) => items.some((a) => a.provider_id === p.id))
              .map(([tier]) => tier);

            return (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900/30 rounded-lg border border-slate-200 dark:border-c-border-subtle"
              >
                <div className="flex items-center gap-2">
                  {getHealthIcon(p.health_status)}
                  <div>
                    <div className="text-sm text-slate-900 dark:text-white">{p.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{p.model_id}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {assignedTiers.map((tier) => (
                    <span
                      key={tier}
                      className={`px-2 py-0.5 rounded text-xs ${
                        TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.badgeClass ||
                        'bg-slate-100 text-slate-700 dark:bg-navy-800/20 dark:text-slate-200'
                      }`}
                    >
                      {tier.charAt(0)}
                    </span>
                  ))}
                  {assignedTiers.length === 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Not assigned</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ModelTierAssignments;
