/**
 * LLM Management View
 *
 * Redesigned with elegant technological minimalism:
 * - No colorful gradients
 * - Clean tables
 * - Subtle interactions
 */

import {
  Activity,
  BarChart3,
  Copy,
  Cpu,
  Database,
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  Hand,
  Loader2,
  Plus,
  Settings,
  Trash2,
  TrendingUp,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../components/standard/StandardTable';
import { Api } from '../../services/api';
import { LLMProviderConfig } from '../../types/domain/ai';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { StatusBadge } from './components/shared/AdminTable';
import { Button, IconButton } from './components/shared/Button';
import { Card } from './components/shared/Card';
import { MetricCard } from './components/shared/MetricCard';
import { SectionHeader } from './components/shared/PageHeader';

type LLMConfigTab = 'providers' | 'routing' | 'usage' | 'health';

const FALLBACK_PROVIDER_MODELS: Record<string, { id: string; label: string; tier?: string }[]> = {
  openrouter: [
    { id: 'openai/gpt-4o', label: 'GPT-4o', tier: 'STANDARD' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', tier: 'BUDGET' },
    { id: 'openai/o3-mini', label: 'o3-mini (Reasoning)', tier: 'REASONING' },
    { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'PREMIUM' },
    { id: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', tier: 'PREMIUM' },
    { id: 'anthropic/claude-3-5-haiku', label: 'Claude 3.5 Haiku', tier: 'STANDARD' },
    { id: 'anthropic/claude-3-7-sonnet', label: 'Claude 3.7 Sonnet', tier: 'PREMIUM' },
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', tier: 'BUDGET' },
    { id: 'google/gemini-2.0-pro-exp-02-05', label: 'Gemini 2.0 Pro', tier: 'PREMIUM' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', tier: 'BUDGET' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (Reasoning)', tier: 'REASONING' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', tier: 'STANDARD' },
    { id: 'mistralai/mistral-large', label: 'Mistral Large', tier: 'STANDARD' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', tier: 'STANDARD' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tier: 'BUDGET' },
    { id: 'o3-mini', label: 'o3-mini (Reasoning)', tier: 'REASONING' },
    { id: 'o1', label: 'o1 (Reasoning)', tier: 'REASONING' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', tier: 'PREMIUM' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'PREMIUM' },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', tier: 'PREMIUM' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', tier: 'STANDARD' },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', tier: 'PREMIUM' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', tier: 'PREMIUM' },
  ],
  google: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tier: 'BUDGET' },
    { id: 'gemini-2.0-pro-exp-02-05', label: 'Gemini 2.0 Pro', tier: 'PREMIUM' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', tier: 'STANDARD' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', tier: 'BUDGET' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tier: 'BUDGET' },
    { id: 'gemini-2.0-pro-exp-02-05', label: 'Gemini 2.0 Pro', tier: 'PREMIUM' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', tier: 'STANDARD' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', tier: 'BUDGET' },
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat', tier: 'BUDGET' },
    { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoning)', tier: 'REASONING' },
  ],
  mistral: [
    { id: 'mistral-large-latest', label: 'Mistral Large', tier: 'STANDARD' },
    { id: 'mistral-small-latest', label: 'Mistral Small', tier: 'BUDGET' },
    { id: 'codestral-latest', label: 'Codestral', tier: 'STANDARD' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tier: 'STANDARD' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)', tier: 'BUDGET' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', tier: 'BUDGET' },
  ],
  replicate: [
    { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro (Image)', tier: 'STANDARD' },
    { id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell (Fast)', tier: 'BUDGET' },
    { id: 'stability-ai/sdxl', label: 'Stable Diffusion XL', tier: 'BUDGET' },
  ],
  zai: [
    { id: 'glm-4-plus', label: 'GLM-4 Plus', tier: 'STANDARD' },
    { id: 'glm-4-flash', label: 'GLM-4 Flash', tier: 'BUDGET' },
  ],
};

const formatModelLabel = (modelId: string) => {
  const compact =
    String(modelId || '')
      .split('/')
      .pop() || String(modelId || '');
  return compact.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const getProviderModelChoices = (provider: string, providers: any[]) => {
  const providerKey = String(provider || '')
    .trim()
    .toLowerCase();
  const dynamic = Array.from(
    new Map(
      (providers || [])
        .filter(
          (row) =>
            String(row?.provider || '')
              .trim()
              .toLowerCase() === providerKey
        )
        .map((row) => {
          const modelId = String(row?.model_id || '').trim();
          if (!modelId) return null;
          return [
            modelId,
            {
              id: modelId,
              label: String(row?.name || '').trim() || formatModelLabel(modelId),
              tier:
                String(row?.tier || '')
                  .trim()
                  .toUpperCase() || undefined,
            },
          ] as const;
        })
        .filter(Boolean) as Array<readonly [string, { id: string; label: string; tier?: string }]>
    ).values()
  );

  const fallback = FALLBACK_PROVIDER_MODELS[providerKey] || [];
  const merged = new Map<string, { id: string; label: string; tier?: string }>();
  for (const item of [...dynamic, ...fallback]) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values());
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

const providerMatchesForm = (
  provider: LLMProviderConfig,
  expected: Partial<LLMProviderConfig> & { id?: string | null }
) =>
  (!expected.id || provider.id === expected.id) &&
  (!expected.name || provider.name === expected.name) &&
  (!expected.model_id || provider.model_id === expected.model_id);

export const LLMManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LLMConfigTab>('providers');
  const [loading, setLoading] = useState(true);
  const [applyingPreset, setApplyingPreset] = useState(false);

  // Providers
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
  const [providerActionError, setProviderActionError] = useState<string | null>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [cloningFromProviderId, setCloningFromProviderId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [providerForm, setProviderForm] = useState<Partial<LLMProviderConfig>>({
    name: '',
    provider: 'openrouter',
    apiKey: '',
    api_key: '',
    baseUrl: '',
    endpoint: '',
    model: '',
    model_id: '',
    isEnabled: true,
    is_active: true,
    isDefault: false,
    tier: 'standard',
    maxTokens: 4096,
    contextWindow: 4096,
    capabilities: ['text'],
    visibility: 'admin',
    cost_per_1k: 0,
    costPerInputToken: 0,
    costPerOutputToken: 0,
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [lastTestReport, setLastTestReport] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  type ProviderTestResult = {
    status: 'testing' | 'ok' | 'error';
    message: string;
    latency?: number;
  };
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, ProviderTestResult>
  >({});
  const canTestProviderForm = (() => {
    const isExistingRow =
      typeof (providerForm as any)?.id === 'string' && String((providerForm as any).id).trim();
    if (testingConnection) return false;
    if (isExistingRow) return !!providerForm.provider;
    return !!providerForm.provider && !!providerForm.api_key;
  })();

  // Usage stats
  const [usageStats, setUsageStats] = useState<any>(null);
  const [costStats, setCostStats] = useState<any>(null);

  // Health status
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentsData, setIncidentsData] = useState<any>(null);
  const providerModelChoices = useMemo(
    () => getProviderModelChoices(String(providerForm.provider || ''), providers),
    [providerForm.provider, providers]
  );

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab !== 'health') return;
    // Load incidents timeline when viewing health/ops
    const loadIncidents = async () => {
      setIncidentsLoading(true);
      try {
        const result = await (Api as any).getLLMIncidents?.({ provider: 'openrouter' });
        setIncidentsData(result);
      } catch (e) {
        // ignore; health tab should still work without timeline
        setIncidentsData(null);
      } finally {
        setIncidentsLoading(false);
      }
    };
    loadIncidents();
  }, [activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    let loadedProviders: LLMProviderConfig[] | null = null;
    try {
      setProviderLoadError(null);
      setProviderActionError(null);
      const providersData = await Api.getLLMProviders();
      const nextProviders = getListPayload<LLMProviderConfig>(providersData, [
        'providers',
        'items',
      ]);
      if (!hasListShape(providersData, ['providers', 'items'])) {
        throw new Error('LLM providers response was not a list');
      }
      setProviders(nextProviders);
      loadedProviders = nextProviders;

      try {
        const usage = await Api.getLLMControlUsage();
        setUsageStats(getObjectPayload(usage));
      } catch (e) {
        console.error('Usage load failed:', e);
      }

      try {
        const costs = await Api.getLLMCosts();
        setCostStats(getObjectPayload(costs));
      } catch (e) {
        console.error('Costs load failed:', e);
      }

      try {
        const health = await Api.diagnoseLLM();
        setHealthStatus(getObjectPayload(health));
      } catch (e) {
        console.error('Health load failed:', e);
      }
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load LLM configuration');
      setProviderLoadError(message);
      setProviders([]);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
    return loadedProviders;
  };

  const handleApplyRecommendedPreset = async () => {
    if (applyingPreset) return;
    setApplyingPreset(true);
    try {
      const result = await (Api as any).applyRecommendedAiModelPresetV3?.({});
      const createdProviders = Number(result?.createdProviders || 0);
      const updatedProviders = Number(result?.updatedProviders || 0);
      const createdPurposes = Number(result?.createdPurposes || 0);
      const createdPurposeAssignments = Number(result?.createdPurposeAssignments || 0);
      toast.success(
        `Preset applied: +${createdProviders} providers, ~${updatedProviders} updated, +${createdPurposes} purposes, +${createdPurposeAssignments} assignments`
      );
      await loadInitialData();
    } catch (e: any) {
      toast.error(String(e?.message || e || 'Failed to apply preset'));
    } finally {
      setApplyingPreset(false);
    }
  };

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProvider) return;
    setSavingProvider(true);
    setProviderActionError(null);
    try {
      let successMessage = 'Provider added';
      let expectedProvider: Partial<LLMProviderConfig> & { id?: string | null } = {
        name: providerForm.name,
        model_id: providerForm.model_id,
      };
      if (cloningFromProviderId) {
        const result = await (Api as any).cloneLLMProviderModel(cloningFromProviderId, {
          name: providerForm.name,
          model_id: providerForm.model_id,
          tier: providerForm.tier,
          visibility: providerForm.visibility,
          is_active: !!providerForm.is_active,
          priority: providerForm.priority,
          ...(providerForm.api_key ? { api_key: providerForm.api_key } : {}),
        });
        const payload = getObjectPayload(result) as any;
        expectedProvider = {
          id: payload?.id,
          name: providerForm.name,
          model_id: providerForm.model_id,
        };
        successMessage = 'Model cloned';
      } else if (editingProviderId) {
        if (providerForm.tier) {
          await Api.updateProviderTier(editingProviderId, providerForm.tier);
        }
        await Api.updateLLMProvider(editingProviderId, providerForm as any);
        expectedProvider = { ...providerForm, id: editingProviderId };
        successMessage = 'Provider updated';
      } else {
        const result = await Api.addLLMProvider(providerForm as any);
        const payload = getObjectPayload(result) as any;
        expectedProvider = {
          id: payload?.id,
          name: providerForm.name,
          model_id: providerForm.model_id,
        };
      }
      const refreshed = await loadInitialData();
      if (!refreshed?.some((provider) => providerMatchesForm(provider, expectedProvider))) {
        throw new Error('LLM provider operation was not confirmed by the server');
      }
      toast.success(successMessage);
      setShowProviderModal(false);
      setEditingProviderId(null);
      setCloningFromProviderId(null);
      resetProviderForm();
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Provider operation failed');
      setProviderActionError(message);
      toast.error(message);
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTierChange = async (providerId: string, newTier: string) => {
    setProviderActionError(null);
    try {
      await Api.updateProviderTier(providerId, newTier);
      const refreshed = await loadInitialData();
      const refreshedProvider = refreshed?.find((provider) => provider.id === providerId);
      if (!refreshedProvider || String(refreshedProvider.tier || '') !== newTier) {
        throw new Error('LLM provider tier update was not confirmed by the server');
      }
      toast.success('Tier updated');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to update tier');
      setProviderActionError(message);
      toast.error(message);
    }
  };

  const resetProviderForm = () => {
    setProviderForm({
      name: '',
      provider: 'openrouter',
      api_key: '',
      endpoint: '',
      model_id: '',
      is_active: true,
      visibility: 'admin',
      cost_per_1k: 0,
      tier: 'STANDARD',
    });
  };

  const handleCloneModel = (p: LLMProviderConfig) => {
    setEditingProviderId(null);
    setCloningFromProviderId(p.id);
    setProviderForm({
      ...p,
      name: `${p.name} — new model`,
      model_id: '',
      // secret is reused server-side; never shown in UI
      api_key: '',
    });
    setShowProviderModal(true);
  };

  const handleEditProvider = (p: LLMProviderConfig) => {
    setEditingProviderId(p.id);
    setCloningFromProviderId(null);
    setProviderForm(p);
    setShowProviderModal(true);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;
    setProviderActionError(null);
    try {
      await Api.deleteLLMProvider(id);
      const refreshed = await loadInitialData();
      if (!refreshed || refreshed.some((provider) => provider.id === id)) {
        throw new Error('LLM provider deletion was not confirmed by the server');
      }
      toast.success('Provider deleted');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Delete failed');
      setProviderActionError(message);
      toast.error(message);
    }
  };

  const handleTestConnection = async (config: Partial<LLMProviderConfig>) => {
    const pid = String((config as any)?.id || '');
    setTestingConnection(true);
    setLastTestReport('Testing connection…');
    if (pid)
      setProviderTestResults((prev) => ({
        ...prev,
        [pid]: { status: 'testing', message: 'Testing…' },
      }));
    try {
      const isExistingRow =
        typeof (config as any)?.id === 'string' && String((config as any).id).trim();
      const payload = isExistingRow
        ? {
            providerId: (config as any).id,
            provider: (config as any).provider,
            model_id: (config as any).model_id,
            endpoint: (config as any).endpoint,
          }
        : config;

      const result = await Api.testLLMConnection(payload as any);
      if (result.success) {
        toast.success(result.message);
        setLastTestReport(`OK: ${result.message}`);
        if (pid)
          setProviderTestResults((prev) => ({
            ...prev,
            [pid]: { status: 'ok', message: result.message, latency: (result as any).latency },
          }));
      } else {
        toast.error(`Connection Failed: ${result.message}`);
        setLastTestReport(`ERROR: ${result.message}`);
        if (pid)
          setProviderTestResults((prev) => ({
            ...prev,
            [pid]: { status: 'error', message: result.message },
          }));
      }
    } catch (err) {
      const msg = (err as any)?.message || 'Test failed to execute';
      toast.error(msg);
      setLastTestReport(`ERROR: ${msg}`);
      if (pid)
        setProviderTestResults((prev) => ({ ...prev, [pid]: { status: 'error', message: msg } }));
    }
    setTestingConnection(false);
  };

  const handleTestAll = async () => {
    const active = providers.filter((p) => p.is_active && (p as any).is_configured);
    if (!active.length) return;
    setTestingAll(true);
    setProviderTestResults((prev) => {
      const next = { ...prev };
      active.forEach((p) => {
        next[p.id] = { status: 'testing', message: 'Testing…' };
      });
      return next;
    });
    await Promise.allSettled(
      active.map(async (p) => {
        try {
          const result = await Api.testLLMConnection({
            providerId: p.id,
            provider: p.provider,
            model_id: (p as any).model_id,
          } as any);
          setProviderTestResults((prev) => ({
            ...prev,
            [p.id]: result.success
              ? { status: 'ok', message: result.message, latency: (result as any).latency }
              : { status: 'error', message: result.message },
          }));
        } catch (err) {
          setProviderTestResults((prev) => ({
            ...prev,
            [p.id]: { status: 'error', message: (err as any)?.message || 'Failed' },
          }));
        }
      })
    );
    setTestingAll(false);
  };

  const tabs = [
    { id: 'providers' as LLMConfigTab, label: 'Providers', icon: Cpu },
    { id: 'routing' as LLMConfigTab, label: 'Routing', icon: Settings },
    { id: 'usage' as LLMConfigTab, label: 'Usage', icon: BarChart3 },
    { id: 'health' as LLMConfigTab, label: 'Health', icon: Activity },
  ];

  // Ollama is a per-user/local setup (endpoint + models depend on a machine),
  // so it should not be managed from the platform SuperAdmin panel.
  const managedProviders = providers.filter((p) => p.provider !== 'ollama');

  const providerColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        render: (row: TableRow) => (
          <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{row.name}</span>
        ),
      },
      {
        id: 'provider',
        label: 'Provider',
        render: (row: TableRow) => (
          <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
            {row.provider}
          </span>
        ),
      },
      {
        id: 'model_id',
        label: 'Model ID',
        render: (row: TableRow) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {row.model_id}
          </span>
        ),
      },
      {
        id: 'kind',
        label: 'Kind',
        render: (row: TableRow) => (
          <span className="text-xs text-slate-700 dark:text-slate-300">
            {String((row.__provider as any).kind || 'TEXT_LLM')}
          </span>
        ),
      },
      {
        id: 'tier',
        label: 'Tier',
        render: (row: TableRow) => {
          const p = row.__provider as LLMProviderConfig;
          return (
            <select
              value={p.tier || 'STANDARD'}
              onChange={(e) => handleTierChange(p.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="text-xs px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="BUDGET">Budget</option>
              <option value="STANDARD">Standard</option>
              <option value="PREMIUM">Premium</option>
              <option value="REASONING">Reasoning</option>
            </select>
          );
        },
      },
      {
        id: 'visibility',
        label: 'Visibility',
        render: (row: TableRow) => (
          <StatusBadge
            variant={
              row.visibility === 'public'
                ? 'success'
                : row.visibility === 'beta'
                  ? 'warning'
                  : 'neutral'
            }
            label={row.visibility || 'admin'}
            dot={false}
          />
        ),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row: TableRow) => {
          const p = row.__provider as LLMProviderConfig;
          if (!p.is_active) {
            return <StatusBadge variant="neutral" label="Inactive" />;
          }
          const live = providerTestResults[p.id];
          const hs = (p as any).health_status as string | null | undefined;
          const lastCheck = (p as any).last_health_check as string | null | undefined;
          const checkedAgo = lastCheck
            ? (() => {
                const diff = Date.now() - new Date(lastCheck).getTime();
                const mins = Math.floor(diff / 60000);
                return mins < 1 ? 'just now' : `${mins}m ago`;
              })()
            : null;

          // Live test result takes priority
          if (live) {
            const badge =
              live.status === 'testing' ? (
                <span className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                  <Loader2 size={11} className="animate-spin" /> Testing…
                </span>
              ) : live.status === 'ok' ? (
                <StatusBadge
                  variant="success"
                  label={live.latency ? `OK · ${live.latency}ms` : 'OK'}
                />
              ) : (
                <StatusBadge variant="error" label="Failed" />
              );
            return (
              <div className="flex flex-col gap-0.5">
                {badge}
                {live.status === 'error' && (
                  <span
                    className="text-[10px] text-danger-400 max-w-[140px] truncate"
                    title={live.message}
                  >
                    {live.message}
                  </span>
                )}
              </div>
            );
          }

          // Fallback to sentinel health_status
          const badge =
            hs === 'healthy' ? (
              <StatusBadge variant="success" label="Healthy" />
            ) : hs === 'degraded' ? (
              <StatusBadge variant="warning" label="Degraded" />
            ) : hs === 'unhealthy' ? (
              <StatusBadge variant="error" label="Unhealthy" />
            ) : (
              <StatusBadge variant="neutral" label="Untested" />
            );
          return (
            <div className="flex flex-col gap-0.5">
              {badge}
              {checkedAgo && <span className="text-[10px] text-slate-500">{checkedAgo}</span>}
            </div>
          );
        },
      },
      {
        id: 'config',
        label: 'Config',
        render: (row: TableRow) => (
          <StatusBadge
            variant={(row.__provider as any).is_configured ? 'success' : 'warning'}
            label={(row.__provider as any).is_configured ? 'Configured' : 'Missing key'}
          />
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        render: (row: TableRow) => {
          const p = row.__provider as LLMProviderConfig;
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                icon={Wifi}
                onClick={() => handleTestConnection(p)}
                label="Test Connection"
                size="sm"
                loading={testingConnection}
                disabled={testingConnection}
              />
              <IconButton
                icon={Copy}
                onClick={() => handleCloneModel(p)}
                label="Clone Model"
                size="sm"
              />
              <IconButton
                icon={Edit}
                onClick={() => handleEditProvider(p)}
                label="Edit"
                size="sm"
              />
              <IconButton
                icon={Trash2}
                onClick={() => handleDeleteProvider(p.id)}
                label="Delete"
                variant="danger"
                size="sm"
              />
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providerTestResults, testingConnection]
  );

  const providerRows: TableRow[] = useMemo(
    () =>
      managedProviders
        .filter((p) => showInactive || p.is_active)
        .map((p) => ({
          ...p,
          id: String(p.id),
          __provider: p,
        })),
    [managedProviders, showInactive]
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-950 text-slate-900 dark:text-slate-100 overflow-hidden relative">
      <InfoButton cardId="superadmin-llm-management" position="top-right" />

      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-slate-200 dark:border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Cpu size={20} className="text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
              LLM Management
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Configure AI providers, routing, and monitor usage
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-8 py-3 border-b border-slate-200 dark:border-white/[0.04] flex gap-1 relative z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="p-8 overflow-y-auto h-full space-y-6">
            {/* Cloud Providers */}
            <div className="flex justify-between items-center">
              <SectionHeader
                title="LLM Providers"
                subtitle="Configure AI models available to tenants"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={handleApplyRecommendedPreset}
                  icon={Settings}
                  size="sm"
                  disabled={applyingPreset || !!providerLoadError}
                >
                  {applyingPreset ? 'Applying preset...' : 'Apply v3 recommended preset'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleTestAll}
                  icon={testingAll ? Loader2 : Wifi}
                  size="sm"
                  disabled={testingAll || !!providerLoadError}
                >
                  {testingAll ? 'Testing…' : 'Test All'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowInactive(!showInactive)}
                  icon={showInactive ? Eye : EyeOff}
                  size="sm"
                  disabled={!!providerLoadError}
                >
                  {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditingProviderId(null);
                    resetProviderForm();
                    setShowProviderModal(true);
                  }}
                  icon={Plus}
                  size="sm"
                  disabled={!!providerLoadError}
                >
                  Add Provider
                </Button>
              </div>
            </div>

            <Card variant="bordered" padding="none">
              {providerActionError && (
                <div
                  role="alert"
                  className="m-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200"
                >
                  {providerActionError}
                </div>
              )}
              {providerLoadError ? (
                <div className="p-6">
                  <DegradedState
                    title="LLM providers unavailable"
                    description={providerLoadError}
                  />
                </div>
              ) : (
                <>
                  {lastTestReport && (
                    <div className="px-4 py-3 text-xs border-b border-slate-200 dark:border-white/[0.04] text-slate-700 dark:text-slate-300">
                      <span className="text-slate-600 dark:text-slate-400">Last test:</span>{' '}
                      <span className="font-medium">{lastTestReport}</span>
                    </div>
                  )}
                  <StandardTable
                    columns={providerColumns}
                    data={providerRows}
                    loading={loading}
                    empty={{ title: 'No providers configured' }}
                    persistKey="superadmin.llmManagement.providers"
                    canvasClassName="p-0"
                  />
                </>
              )}
            </Card>
          </div>
        )}

        {/* Routing Tab */}
        {activeTab === 'routing' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="max-w-3xl mx-auto">
              <Card variant="bordered" padding="lg">
                <SectionHeader
                  title="Model Routing per Tier"
                  subtitle="Configure which models serve each performance tier"
                />
                <div className="space-y-3 mt-4">
                  {[
                    {
                      tier: 'BUDGET',
                      label: 'Budget Tier',
                      desc: 'Simple questions, fast responses',
                    },
                    {
                      tier: 'STANDARD',
                      label: 'Standard Tier',
                      desc: 'Most tasks (chat, magic wand)',
                    },
                    { tier: 'PREMIUM', label: 'Premium Tier', desc: 'Complex analysis, reports' },
                    {
                      tier: 'REASONING',
                      label: 'Reasoning Tier',
                      desc: 'Deep thinking models (o1, etc.)',
                    },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="flex items-center gap-4 p-4 border border-slate-200 dark:border-white/[0.04] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-200">
                          {item.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.desc}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Auto-selected from active {item.tier} providers
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="p-8 overflow-y-auto h-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card variant="bordered" padding="md">
                <MetricCard
                  icon={Zap}
                  label="Tokens Today"
                  value={usageStats?.user?.tokens_used_today?.toLocaleString() || '0'}
                />
              </Card>
              <Card variant="bordered" padding="md">
                <MetricCard
                  icon={DollarSign}
                  label="Cost (30d)"
                  value={`$${(costStats?.totals?.costUsd || 0).toFixed(4)}`}
                />
              </Card>
              <Card variant="bordered" padding="md">
                <MetricCard
                  icon={Activity}
                  label="Requests (30d)"
                  value={costStats?.totals?.requests?.toLocaleString() || '0'}
                />
              </Card>
              <Card variant="bordered" padding="md">
                <MetricCard
                  icon={TrendingUp}
                  label="Cache Hit Rate"
                  value={`${usageStats?.cache?.hitRate || 0}%`}
                />
              </Card>
            </div>

            {costStats?.byModel && costStats.byModel.length > 0 && (
              <Card variant="bordered" padding="lg">
                <SectionHeader title="Costs per Model" />
                <div className="space-y-2 mt-4">
                  {costStats.byModel.map((m: any) => (
                    <div
                      key={m.model}
                      className="flex items-center gap-4 p-3 border border-slate-200 dark:border-white/[0.04] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-sm text-slate-900 dark:text-slate-200">{m.model}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {m.requests} requests
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                          ${(m.cost || 0).toFixed(4)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {(m.tokens || 0).toLocaleString()} tokens
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="max-w-3xl mx-auto space-y-6">
              <Card variant="bordered" padding="lg">
                <SectionHeader
                  title="LLM Downtime Timeline (last 24h)"
                  subtitle="Incidents derived from periodic provider health checks"
                />
                <div className="mt-4 space-y-2">
                  {incidentsLoading ? (
                    <div className="text-sm text-slate-700 dark:text-slate-300">Loading…</div>
                  ) : incidentsData?.success ? (
                    <>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Uptime:{' '}
                        <span className="font-medium text-slate-900 dark:text-slate-200">
                          {incidentsData?.uptime?.uptimePct}%
                        </span>
                        {' · '}
                        Incidents:{' '}
                        <span className="font-medium text-slate-900 dark:text-slate-200">
                          {(incidentsData?.incidents || []).length}
                        </span>
                      </div>
                      {(incidentsData?.incidents || []).length === 0 ? (
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          No downtime detected.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(incidentsData?.incidents || [])
                            .slice(0, 20)
                            .map((inc: any, idx: number) => {
                              const start = inc?.start
                                ? new Date(inc.start).toLocaleString()
                                : 'n/a';
                              const end = inc?.end ? new Date(inc.end).toLocaleString() : 'ongoing';
                              const durMin =
                                typeof inc?.durationMs === 'number'
                                  ? Math.round(inc.durationMs / 60000)
                                  : null;
                              return (
                                <div
                                  key={idx}
                                  className="p-3 border border-slate-200 dark:border-white/[0.04] rounded-lg bg-slate-50 dark:bg-white/[0.02]"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm text-slate-700 dark:text-slate-200">
                                      <span className="font-medium">Down</span>{' '}
                                      <span className="text-slate-600 dark:text-slate-400">
                                        ({durMin !== null ? `${durMin} min` : 'n/a'})
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      samples: {inc?.samples || 0}
                                    </div>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {start} → {end}
                                  </div>
                                  {inc?.lastError && (
                                    <div className="mt-2 text-xs text-amber-300/90">
                                      {String(inc.lastError).slice(0, 220)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      No incident data available yet (health events start accumulating after the
                      server runs for a while).
                    </div>
                  )}
                </div>
              </Card>

              <Card variant="bordered" padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader title="AI System Status" />
                  <StatusBadge
                    variant={healthStatus?.status === 'OK' ? 'success' : 'warning'}
                    label={healthStatus?.status || 'Unknown'}
                  />
                </div>
                <div className="space-y-2">
                  {healthStatus?.checks?.map((check: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 border-b border-slate-200/70 dark:border-white/[0.04] last:border-0"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {check.name}
                      </span>
                      <span
                        className={`text-sm ${
                          check.status === 'OK'
                            ? 'text-emerald-400'
                            : check.status === 'MISSING'
                              ? 'text-amber-400'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {check.status || check.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card variant="bordered" padding="lg">
                <SectionHeader title="Test Capabilities" subtitle="Verify AI system components" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[
                    { id: 'connection', icon: Zap, label: 'Connection' },
                    { id: 'eyes', icon: Eye, label: 'AI Eyes (Visual)' },
                    { id: 'memory', icon: Database, label: 'AI Memory (RAG)' },
                    { id: 'hands', icon: Hand, label: 'AI Hands (Tools)' },
                  ].map((cap) => (
                    <button
                      key={cap.id}
                      className="flex items-center gap-3 p-4 border border-slate-200 dark:border-white/[0.04] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.02] dark:hover:border-white/[0.08] transition-colors"
                    >
                      <cap.icon size={18} className="text-slate-700 dark:text-slate-300" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {cap.label}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Provider Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {cloningFromProviderId
                  ? 'Clone Model'
                  : editingProviderId
                    ? 'Edit Provider'
                    : 'Add Provider'}
              </h2>
              <IconButton icon={X} onClick={() => setShowProviderModal(false)} label="Close" />
            </div>
            <form onSubmit={handleProviderSubmit} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    required
                    value={providerForm.name}
                    onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Provider Type
                  </label>
                  <select
                    value={providerForm.provider}
                    onChange={(e) => {
                      const newProvider = e.target.value as any;
                      const nextChoices = getProviderModelChoices(newProvider, providers);
                      const defaultModel = nextChoices[0];
                      setProviderForm({
                        ...providerForm,
                        provider: newProvider,
                        ...(defaultModel && !providerForm.model_id
                          ? {
                              model_id: defaultModel.id,
                              tier: defaultModel.tier || providerForm.tier,
                            }
                          : {}),
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <optgroup label="Major Providers">
                      <option value="openrouter">OpenRouter (Unified Gateway)</option>
                      <option value="openai">OpenAI (GPT-4)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="google">Gemini (Google)</option>
                      <option value="gemini">Gemini (alias)</option>
                    </optgroup>
                    <optgroup label="Open Source / Fast">
                      <option value="mistral">Mistral AI</option>
                      <option value="groq">Groq (Ultra Fast)</option>
                      <option value="together">Together AI</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="zai">z.ai (Zhipu)</option>
                      <option value="z_ai">z.ai (alias)</option>
                      <option value="qwen">Qwen (OpenAI-compatible)</option>
                    </optgroup>
                    <optgroup label="Images">
                      <option value="replicate">Replicate (Images)</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Kind
                  </label>
                  <select
                    value={(providerForm as any).kind || 'TEXT_LLM'}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, kind: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="TEXT_LLM">TEXT_LLM</option>
                    <option value="IMAGE_MODEL">IMAGE_MODEL</option>
                    <option value="BUSINESS_MODEL">BUSINESS_MODEL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Provider Type (infra)
                  </label>
                  <select
                    value={(providerForm as any).provider_type || 'direct'}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, provider_type: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="direct">direct</option>
                    <option value="aggregator">aggregator</option>
                    <option value="hosted">hosted</option>
                    <option value="local">local</option>
                    <option value="customer_managed">customer_managed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Origin vendor
                  </label>
                  <input
                    value={(providerForm as any).origin_vendor || ''}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, origin_vendor: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                    placeholder="openai / anthropic / google / deepseek / zhipu / replicate / openrouter"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Execution regions
                  </label>
                  <input
                    value={(providerForm as any).execution_regions || ''}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, execution_regions: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                    placeholder='e.g. ["EU","US"] or EU,US'
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  placeholder="sk-..."
                  autoComplete="new-password"
                />
                {cloningFromProviderId ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Leave empty to reuse the source provider key, or enter a new one.
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Model ID
                  </label>
                  {providerModelChoices.length ? (
                    <>
                      <select
                        value={
                          providerModelChoices.find((m) => m.id === providerForm.model_id)
                            ? providerForm.model_id
                            : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value === '__custom__') return;
                          const chosen = providerModelChoices.find((m) => m.id === e.target.value);
                          setProviderForm({
                            ...providerForm,
                            model_id: e.target.value,
                            ...(chosen?.tier ? { tier: chosen.tier } : {}),
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 mb-1.5"
                      >
                        {providerModelChoices.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} — {m.id}
                          </option>
                        ))}
                        <option value="__custom__">↳ custom (wpisz poniżej)</option>
                      </select>
                      <input
                        required
                        value={providerForm.model_id}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, model_id: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                        placeholder="lub wpisz własne ID modelu"
                      />
                    </>
                  ) : (
                    <input
                      required
                      value={providerForm.model_id}
                      onChange={(e) =>
                        setProviderForm({ ...providerForm, model_id: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                      placeholder="np. gpt-4o, claude-3-5-sonnet-20241022"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Performance Tier
                  </label>
                  <select
                    value={providerForm.tier || 'STANDARD'}
                    onChange={(e) => setProviderForm({ ...providerForm, tier: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="BUDGET">Budget</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="REASONING">Reasoning</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Visibility
                  </label>
                  <select
                    value={providerForm.visibility}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, visibility: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="admin">Admin Only</option>
                    <option value="beta">Beta Users</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={providerForm.is_active}
                      onChange={(e) =>
                        setProviderForm({ ...providerForm, is_active: e.target.checked })
                      }
                      className="w-4 h-4 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-white/10"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button variant="ghost" onClick={() => setShowProviderModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleTestConnection(providerForm);
                  }}
                  disabled={!canTestProviderForm}
                  icon={Wifi}
                  loading={testingConnection}
                >
                  Test
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  className="flex-1"
                  disabled={savingProvider}
                  loading={savingProvider}
                >
                  {savingProvider ? 'Saving…' : 'Save Provider'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMManagementView;
