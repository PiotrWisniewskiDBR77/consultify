/**
 * RoutingRulesTab - Configuration > Routing Rules
 * NEW: Intelligent routing configuration
 */

import {
  AlertCircle,
  ArrowRight,
  Check,
  Edit2,
  Globe,
  Layers,
  Plus,
  RefreshCw,
  Route,
  Scale,
  Server,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

interface RoutingRule {
  id: string;
  name: string;
  description: string;
  type: 'cost' | 'latency' | 'health' | 'geographic' | 'load_balance';
  priority: number;
  isActive: boolean;
  config: Record<string, any>;
}

interface TierRouting {
  tier: string;
  label: string;
  description: string;
  defaultModel: string;
  fallbackModel: string;
}

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

const normalizeRules = (value: unknown): RoutingRule[] => {
  if (!hasListShape(value, ['rules', 'items'])) {
    throw new Error('Routing rules response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['rules', 'items'])
    .map((rule, index) => ({
      id: asText(rule.id, `rule-${index + 1}`),
      name: asText(rule.name, 'Untitled rule'),
      description: asText(rule.description, ''),
      type: (['cost', 'latency', 'health', 'geographic', 'load_balance'].includes(
        String(rule.type || '')
      )
        ? rule.type
        : 'health') as RoutingRule['type'],
      priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : index + 1,
      isActive: toBool(rule.isActive ?? rule.is_active, false),
      config: isRecord(rule.config) ? rule.config : {},
    }))
    .filter((rule) => rule.id);
};

const normalizeProviders = (value: unknown) => {
  if (!hasListShape(value, ['providers', 'items'])) {
    throw new Error('LLM providers response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['providers', 'items']);
};

const getAssignmentsPayload = (value: unknown): Record<string, any[]> => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !isRecord(payload.assignments)) {
    throw new Error('Tier assignments response was not an object');
  }
  return Object.fromEntries(
    Object.entries(payload.assignments).map(([tier, rows]) => [
      tier,
      Array.isArray(rows) ? rows : [],
    ])
  );
};

const getCreatedRuleId = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload)) return '';
  return asText(payload.id, '') || (isRecord(payload.rule) ? asText(payload.rule.id, '') : '');
};

export const RoutingRulesTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [suggestedRules, setSuggestedRules] = useState<RoutingRule[]>([]);
  const [tierRoutings, setTierRoutings] = useState<TierRouting[]>([]);
  const [providerModelOptions, setProviderModelOptions] = useState<string[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [ruleForm, setRuleForm] = useState<{
    name: string;
    description: string;
    type: RoutingRule['type'];
    priority: number;
    isActive: boolean;
    tiersCsv: string;
    purposesCsv: string;
    config: Record<string, any>;
  }>({
    name: '',
    description: '',
    type: 'health',
    priority: 1,
    isActive: true,
    tiersCsv: '',
    purposesCsv: '',
    config: {},
  });

  useEffect(() => {
    loadRoutingConfig();
  }, []);

  const loadRoutingConfig = async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const [assignmentsRes, providersRes, healthRes, rulesRes] = await Promise.allSettled([
        Api.getLLMTierAssignments(),
        Api.getLLMProviders(),
        Api.getLLMHealthDetailed(),
        Api.getLLMRoutingRules(),
      ]);

      const criticalErrors = [
        assignmentsRes.status === 'rejected'
          ? normalizeApiErrorMessage(assignmentsRes.reason, 'Tier assignments are unavailable')
          : null,
        providersRes.status === 'rejected'
          ? normalizeApiErrorMessage(providersRes.reason, 'LLM providers are unavailable')
          : null,
        rulesRes.status === 'rejected'
          ? normalizeApiErrorMessage(rulesRes.reason, 'Routing rules are unavailable')
          : null,
      ].filter(Boolean);

      if (criticalErrors.length) {
        setLoadError(criticalErrors.join(' '));
        setRules([]);
        setTierRoutings([]);
        setSuggestedRules([]);
        setProviderModelOptions([]);
        setProviders([]);
        return;
      }

      const assignmentsPayload =
        assignmentsRes.status === 'fulfilled' ? assignmentsRes.value : null;
      const providersPayload = providersRes.status === 'fulfilled' ? providersRes.value : [];
      const healthPayload = healthRes.status === 'fulfilled' ? healthRes.value : null;
      const rulesPayload = rulesRes.status === 'fulfilled' ? rulesRes.value : [];

      const providers: any[] = normalizeProviders(providersPayload);
      const assignments = getAssignmentsPayload(assignmentsPayload);
      const nextRules = normalizeRules(rulesPayload);
      setProviders(providers);

      const providerModelIds = Array.from(
        new Set(providers.map((p) => String(p?.model_id || '').trim()).filter((v) => !!v))
      );
      setProviderModelOptions(providerModelIds);

      // Tier routing (derive default model = first priority in tier, fallback model = second)
      const tierMeta: Array<{ tier: string; label: string; description: string }> = [
        { tier: 'BUDGET', label: 'Budget Tier', description: 'Simple questions, fast responses' },
        { tier: 'STANDARD', label: 'Standard Tier', description: 'Most tasks (chat, magic wand)' },
        { tier: 'PREMIUM', label: 'Premium Tier', description: 'Complex analysis, reports' },
        { tier: 'REASONING', label: 'Reasoning Tier', description: 'MAX Mode, deep thinking' },
      ];

      const nextTierRoutings: TierRouting[] = tierMeta.map((t) => {
        const rows = Array.isArray(assignments?.[t.tier]) ? assignments[t.tier] : [];
        const sorted = [...rows].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
        const defaultModel = String(sorted?.[0]?.model_id || sorted?.[0]?.modelId || '').trim();
        const fallbackModel = String(sorted?.[1]?.model_id || sorted?.[1]?.modelId || '').trim();
        return {
          tier: t.tier,
          label: t.label,
          description: t.description,
          defaultModel: defaultModel || '—',
          fallbackModel: fallbackModel || '—',
        };
      });
      setTierRoutings(nextTierRoutings);

      // Routing rules (best-effort derived “policy-like” rules from existing live signals)
      const healthSummary = healthPayload?.summary || healthPayload?.data?.summary || null;
      const hasUnhealthy =
        typeof healthSummary?.unhealthy === 'number' ? healthSummary.unhealthy > 0 : false;
      const hasDegraded =
        typeof healthSummary?.degraded === 'number' ? healthSummary.degraded > 0 : false;

      const activeProviders = providers.filter((p) => Boolean(p?.is_active));
      const byTier: Record<string, any[]> = {};
      for (const p of activeProviders) {
        const tier = String(p?.tier || 'standard').toUpperCase();
        byTier[tier] ||= [];
        byTier[tier].push(p);
      }
      const cheapestProvider = Object.values(byTier)
        .flat()
        .sort((a, b) => Number(a?.cost_per_1k || 0) - Number(b?.cost_per_1k || 0))[0];

      setSuggestedRules([
        {
          id: 'derived-health-failover',
          name: 'Health Check Failover',
          description: 'Failover when provider health indicates degraded/unhealthy state',
          type: 'health',
          priority: 1,
          isActive: hasUnhealthy || hasDegraded,
          config: {},
        },
        {
          id: 'derived-cost-optimization',
          name: 'Cost Optimization',
          description: 'Prefer lowest cost-per-1k provider for eligible tiers',
          type: 'cost',
          priority: 2,
          isActive: true,
          config: { threshold: Number(cheapestProvider?.cost_per_1k || 0) },
        },
      ]);

      setRules(nextRules);
      return { rules: nextRules };
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load routing configuration');
      setLoadError(message);
      setRules([]);
      setTierRoutings([]);
      setSuggestedRules([]);
      setProviderModelOptions([]);
      setProviders([]);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (rule: RoutingRule) => {
    try {
      setActionError(null);
      const next = !rule.isActive;
      await Api.toggleLLMRoutingRule(rule.id, next);
      const refreshed = await loadRoutingConfig();
      const refreshedRule = refreshed?.rules.find((candidate) => candidate.id === rule.id);
      if (!refreshedRule || refreshedRule.isActive !== next) {
        throw new Error('Routing rule toggle was not confirmed by the server');
      }
      toast.success(next ? 'Rule enabled' : 'Rule disabled');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to toggle rule');
      setActionError(message);
      toast.error(message);
    }
  };

  const openCreateModal = (prefill?: Partial<RoutingRule>) => {
    setEditingRule(null);
    const cfg = (prefill?.config || {}) as any;
    const tiersCsv = Array.isArray(cfg?.tiers) ? cfg.tiers.join(', ') : '';
    const purposesCsv = Array.isArray(cfg?.purposes) ? cfg.purposes.join(', ') : '';
    setRuleForm({
      name: prefill?.name || '',
      description: prefill?.description || '',
      type: (prefill?.type as any) || 'health',
      priority: typeof prefill?.priority === 'number' ? prefill.priority : 1,
      isActive: prefill?.isActive ?? true,
      tiersCsv,
      purposesCsv,
      config: { ...(prefill?.config || {}) },
    });
    setShowAddRule(true);
  };

  const openEditModal = (rule: RoutingRule) => {
    setEditingRule(rule);
    const cfg: any = rule.config || {};
    setRuleForm({
      name: rule.name || '',
      description: rule.description || '',
      type: rule.type,
      priority: Number(rule.priority || 0),
      isActive: !!rule.isActive,
      tiersCsv: Array.isArray(cfg?.tiers) ? cfg.tiers.join(', ') : '',
      purposesCsv: Array.isArray(cfg?.purposes) ? cfg.purposes.join(', ') : '',
      config: { ...(cfg || {}) },
    });
    setShowAddRule(true);
  };

  const closeModal = () => {
    setShowAddRule(false);
    setEditingRule(null);
    setSaving(false);
  };

  const saveRule = async () => {
    const name = String(ruleForm.name || '').trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }

    const tiers = ruleForm.tiersCsv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.toUpperCase());
    const purposes = ruleForm.purposesCsv
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const config: any = { ...(ruleForm.config || {}) };
    if (tiers.length) config.tiers = tiers;
    else delete config.tiers;
    if (purposes.length) config.purposes = purposes;
    else delete config.purposes;

    // Validate weights JSON if present
    if (ruleForm.type === 'load_balance') {
      const w = config?.weights;
      if (w && typeof w === 'string') {
        try {
          const parsed = JSON.parse(w);
          config.weights = parsed;
        } catch {
          toast.error('Weights must be valid JSON');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description: ruleForm.description,
        type: ruleForm.type,
        priority: Number(ruleForm.priority || 0),
        isActive: !!ruleForm.isActive,
        config,
      };

      if (editingRule) {
        await Api.updateLLMRoutingRule(editingRule.id, payload);
      } else {
        const result = await Api.createLLMRoutingRule(payload);
        const createdId = getCreatedRuleId(result);
        if (createdId) {
          payload.config = { ...payload.config, __createdId: createdId };
        }
      }

      const refreshed = await loadRoutingConfig();
      const confirmed = editingRule
        ? refreshed?.rules.some(
            (rule) =>
              rule.id === editingRule.id &&
              rule.name === payload.name &&
              rule.priority === payload.priority
          )
        : refreshed?.rules.some(
            (rule) =>
              rule.id === (payload.config as any).__createdId ||
              (rule.name === payload.name && rule.type === payload.type)
          );
      if (!confirmed) {
        throw new Error('Routing rule save was not confirmed by the server');
      }
      toast.success(editingRule ? 'Rule updated' : 'Rule created');
      closeModal();
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to save rule');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!editingRule) return;
    if (!confirm(`Delete rule "${editingRule.name}"?`)) return;
    setSaving(true);
    try {
      await Api.deleteLLMRoutingRule(editingRule.id);
      const refreshed = await loadRoutingConfig();
      if (!refreshed || refreshed.rules.some((rule) => rule.id === editingRule.id)) {
        throw new Error('Routing rule deletion was not confirmed by the server');
      }
      toast.success('Rule deleted');
      closeModal();
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete rule');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRuleQuick = async (rule: RoutingRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await Api.deleteLLMRoutingRule(rule.id);
      const refreshed = await loadRoutingConfig();
      if (!refreshed || refreshed.rules.some((candidate) => candidate.id === rule.id)) {
        throw new Error('Routing rule deletion was not confirmed by the server');
      }
      toast.success('Rule deleted');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to delete rule');
      setActionError(message);
      toast.error(message);
      await loadRoutingConfig();
    }
  };

  const getTypeIcon = (type: RoutingRule['type']) => {
    switch (type) {
      case 'cost':
        return <Scale size={16} className="text-emerald-400" />;
      case 'latency':
        return <Zap size={16} className="text-amber-400" />;
      case 'health':
        return <AlertCircle size={16} className="text-blue-400" />;
      case 'geographic':
        return <Globe size={16} className="text-purple-400" />;
      case 'load_balance':
        return <Layers size={16} className="text-cyan-400" />;
      default:
        return <Settings size={16} />;
    }
  };

  const getTypeBadgeColor = (type: RoutingRule['type']) => {
    switch (type) {
      case 'cost':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'latency':
        return 'bg-amber-500/10 text-amber-400';
      case 'health':
        return 'bg-blue-500/10 text-blue-400';
      case 'geographic':
        return 'bg-purple-500/10 text-purple-400';
      case 'load_balance':
        return 'bg-cyan-500/10 text-cyan-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Route size={24} className="text-indigo-500" />
            Routing Rules
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure intelligent model routing and failover policies (persisted; applied by
            ModelRouter)
          </p>
        </div>
        <button
          onClick={() => openCreateModal()}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          title={loadError || undefined}
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState title="Routing configuration unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {actionError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              {actionError}
            </div>
          ) : null}

          {/* Model Routing per Tier */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Server size={18} className="text-slate-500" />
              Model Routing per Tier
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Define which LLM model to use for different complexity levels.
            </p>

            <div className="space-y-4">
              {tierRoutings.map((item) => (
                <div
                  key={item.tier}
                  className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.defaultModel}
                      disabled
                      className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 outline-none opacity-70 cursor-not-allowed"
                    >
                      {item.defaultModel && !providerModelOptions.includes(item.defaultModel) && (
                        <option value={item.defaultModel}>{item.defaultModel}</option>
                      )}
                      {providerModelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="o1-preview">o1-preview</option>
                      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                      <option value="claude-3-haiku">claude-3-haiku</option>
                      <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                    </select>
                    <ArrowRight size={16} className="text-slate-400" />
                    <select
                      value={item.fallbackModel}
                      disabled
                      className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 outline-none opacity-70 cursor-not-allowed"
                    >
                      <option value="">No fallback</option>
                      {item.fallbackModel &&
                        item.fallbackModel !== '' &&
                        !providerModelOptions.includes(item.fallbackModel) && (
                          <option value={item.fallbackModel}>{item.fallbackModel}</option>
                        )}
                      {providerModelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                      <option value="claude-3-haiku">claude-3-haiku</option>
                      <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                      <option value="groq-llama">groq-llama</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Routing Rules */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Route size={18} className="text-slate-500" />
              Persisted Routing Rules
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Rules are evaluated in priority order (lower first). Applicable rules can
              filter/reorder candidates.
            </p>

            <div className="space-y-3">
              {rules.length === 0 ? (
                <div className="py-10 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-900/40">
                  No routing rules yet. Add one to control routing behavior.
                </div>
              ) : (
                rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                      rule.isActive
                        ? 'bg-slate-50 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700'
                        : 'bg-slate-100 dark:bg-navy-950/50 border-slate-200 dark:border-navy-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 font-mono text-sm">
                      {rule.priority}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {rule.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(rule.type)}`}
                        >
                          {getTypeIcon(rule.type)}
                          <span className="ml-1">{rule.type}</span>
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {rule.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRule(rule)}
                        className={`p-2 rounded-lg transition-colors ${
                          rule.isActive
                            ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            : 'bg-slate-200 dark:bg-navy-700 text-slate-500 hover:text-emerald-500'
                        }`}
                        title={rule.isActive ? 'Disable' : 'Enable'}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-2 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteRuleQuick(rule)}
                        className="p-2 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-200 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Suggested (Derived) Rules */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings size={18} className="text-slate-500" />
              Suggestions (derived from live signals)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              These are computed from current providers/health. You can convert them into persisted
              rules.
            </p>

            <div className="space-y-3">
              {suggestedRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-slate-50 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 font-mono text-sm">
                    {rule.priority}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {rule.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(rule.type)}`}
                      >
                        {getTypeIcon(rule.type)}
                        <span className="ml-1">{rule.type}</span>
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {rule.description}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openCreateModal({
                        ...rule,
                        id: '',
                        name: rule.name,
                        description: rule.description,
                        isActive: rule.isActive,
                        config: rule.config,
                      } as any)
                    }
                  >
                    Create from suggestion
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Circuit Breaker Settings */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-slate-500" />
              Circuit Breaker Configuration
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Failure Threshold
                </label>
                <input
                  type="number"
                  defaultValue={5}
                  disabled
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white opacity-70 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Number of failures before circuit opens
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Cooldown Period (seconds)
                </label>
                <input
                  type="number"
                  defaultValue={60}
                  disabled
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white opacity-70 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Wait time before retrying failed provider
                </p>
              </div>
            </div>
          </div>

          <Modal
            open={showAddRule}
            onClose={closeModal}
            title={editingRule ? 'Edit Routing Rule' : 'New Routing Rule'}
            description="Persisted rules are applied by ModelRouter at runtime."
            size="xl"
            footer={
              <div className="flex items-center justify-between w-full">
                <div>
                  {editingRule && (
                    <Button variant="danger" size="sm" onClick={deleteRule} loading={saving}>
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={closeModal} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={saveRule} loading={saving}>
                    Save
                  </Button>
                </div>
              </div>
            }
          >
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Name
                  </label>
                  <input
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="e.g., EU latency guard"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={ruleForm.type}
                    onChange={(e) =>
                      setRuleForm((p) => ({
                        ...p,
                        type: e.target.value as any,
                        config: {},
                      }))
                    }
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="health">health</option>
                    <option value="cost">cost</option>
                    <option value="latency">latency</option>
                    <option value="geographic">geographic</option>
                    <option value="load_balance">load_balance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder="What does this rule do?"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Priority (lower first)
                  </label>
                  <input
                    type="number"
                    value={ruleForm.priority}
                    onChange={(e) =>
                      setRuleForm((p) => ({ ...p, priority: parseInt(e.target.value || '0', 10) }))
                    }
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2 flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={ruleForm.isActive}
                      onChange={(e) => setRuleForm((p) => ({ ...p, isActive: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Applies to tiers (CSV, optional)
                  </label>
                  <input
                    value={ruleForm.tiersCsv}
                    onChange={(e) => setRuleForm((p) => ({ ...p, tiersCsv: e.target.value }))}
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="BUDGET, STANDARD"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Applies to purposes (CSV, optional)
                  </label>
                  <input
                    value={ruleForm.purposesCsv}
                    onChange={(e) => setRuleForm((p) => ({ ...p, purposesCsv: e.target.value }))}
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="chat_simple, full_report"
                  />
                </div>
              </div>

              {/* Type-specific config */}
              {ruleForm.type === 'cost' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Max cost per 1k (threshold)
                    </label>
                    <input
                      type="number"
                      value={ruleForm.config.threshold ?? ''}
                      onChange={(e) =>
                        setRuleForm((p) => ({
                          ...p,
                          config: { ...p.config, threshold: Number(e.target.value) },
                        }))
                      }
                      className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                      placeholder="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Fallback provider (optional)
                    </label>
                    <select
                      value={ruleForm.config.fallbackProvider || ''}
                      onChange={(e) =>
                        setRuleForm((p) => ({
                          ...p,
                          config: { ...p.config, fallbackProvider: e.target.value || undefined },
                        }))
                      }
                      className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    >
                      <option value="">—</option>
                      {providers.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.provider} · {p.model_id || p.name || p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {ruleForm.type === 'latency' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Max avg latency (ms) over last 30 minutes
                  </label>
                  <input
                    type="number"
                    value={ruleForm.config.threshold ?? ''}
                    onChange={(e) =>
                      setRuleForm((p) => ({
                        ...p,
                        config: { ...p.config, threshold: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="1200"
                  />
                </div>
              )}

              {ruleForm.type === 'geographic' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Region (e.g., EU, US, SG)
                  </label>
                  <input
                    value={ruleForm.config.region ?? ''}
                    onChange={(e) =>
                      setRuleForm((p) => ({
                        ...p,
                        config: { ...p.config, region: e.target.value },
                      }))
                    }
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    placeholder="EU"
                  />
                </div>
              )}

              {ruleForm.type === 'load_balance' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Strategy
                    </label>
                    <select
                      value={ruleForm.config.strategy || 'round_robin'}
                      onChange={(e) =>
                        setRuleForm((p) => ({
                          ...p,
                          config: { ...p.config, strategy: e.target.value },
                        }))
                      }
                      className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    >
                      <option value="round_robin">round_robin</option>
                      <option value="weighted_random">weighted_random</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Weights (JSON object; keys = provider row id or provider name)
                    </label>
                    <textarea
                      value={
                        typeof ruleForm.config.weights === 'string'
                          ? ruleForm.config.weights
                          : JSON.stringify(ruleForm.config.weights || {}, null, 2)
                      }
                      onChange={(e) =>
                        setRuleForm((p) => ({
                          ...p,
                          config: { ...p.config, weights: e.target.value },
                        }))
                      }
                      rows={6}
                      className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};

export default RoutingRulesTab;
