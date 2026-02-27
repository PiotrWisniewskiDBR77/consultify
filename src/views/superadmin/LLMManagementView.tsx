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
  Check,
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
  RefreshCw,
  Settings,
  Trash2,
  TrendingUp,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { StatusBadge } from '../../components/Admin/shared/AdminTable';
import { Button, IconButton } from '../../components/Admin/shared/Button';
import { Card } from '../../components/Admin/shared/Card';
import { MetricCard } from '../../components/Admin/shared/MetricCard';
import { PageHeader, SectionHeader } from '../../components/Admin/shared/PageHeader';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { LLMProvider, LLMProviderConfig } from '../../types/domain/ai';

type LLMConfigTab = 'providers' | 'routing' | 'usage' | 'health';

export const LLMManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LLMConfigTab>('providers');
  const [loading, setLoading] = useState(true);
  const [applyingPreset, setApplyingPreset] = useState(false);

  // Providers
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [showProviderModal, setShowProviderModal] = useState(false);
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
    try {
      const providersData = await Api.getLLMProviders();
      setProviders(providersData);

      try {
        const usage = await fetch('/api/llm/control/usage', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => r.json());
        setUsageStats(usage);
      } catch (e) {
        console.error('Usage load failed:', e);
      }

      try {
        const costs = await fetch('/api/llm/costs', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => r.json());
        setCostStats(costs);
      } catch (e) {
        console.error('Costs load failed:', e);
      }

      try {
        const health = await fetch('/api/llm/diagnose').then((r) => r.json());
        setHealthStatus(health);
      } catch (e) {
        console.error('Health load failed:', e);
      }
    } catch (err) {
      console.error('Failed to load LLM data:', err);
      toast.error('Failed to load LLM configuration');
    }
    setLoading(false);
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
    try {
      if (cloningFromProviderId) {
        await (Api as any).cloneLLMProviderModel(cloningFromProviderId, {
          name: providerForm.name,
          model_id: providerForm.model_id,
          tier: providerForm.tier,
          visibility: providerForm.visibility,
          is_active: !!providerForm.is_active,
          priority: providerForm.priority,
        });
        toast.success('Model cloned');
      } else if (editingProviderId) {
        if (providerForm.tier) {
          await Api.updateProviderTier(editingProviderId, providerForm.tier);
        }
        await Api.updateLLMProvider(editingProviderId, providerForm as any);
        toast.success('Provider updated');
      } else {
        await Api.addLLMProvider(providerForm as any);
        toast.success('Provider added');
      }
      setShowProviderModal(false);
      setEditingProviderId(null);
      setCloningFromProviderId(null);
      resetProviderForm();
      loadInitialData();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleTierChange = async (providerId: string, newTier: string) => {
    try {
      await Api.updateProviderTier(providerId, newTier);
      toast.success('Tier updated');
      setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, tier: newTier } : p)));
    } catch (err) {
      toast.error('Failed to update tier');
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
    try {
      await Api.deleteLLMProvider(id);
      toast.success('Provider deleted');
      loadInitialData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleTestConnection = async (config: Partial<LLMProviderConfig>) => {
    setTestingConnection(true);
    setLastTestReport('Testing connection…');
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
      } else {
        toast.error(`Connection Failed: ${result.message}`);
        setLastTestReport(`ERROR: ${result.message}`);
      }
    } catch (err) {
      const msg = (err as any)?.message || 'Test failed to execute';
      toast.error(msg);
      setLastTestReport(`ERROR: ${msg}`);
    }
    setTestingConnection(false);
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

  return (
    <div className="h-full flex flex-col bg-navy-950 overflow-hidden relative">
      <InfoButton cardId="superadmin-llm-management" position="top-right" />

      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <Cpu size={20} className="text-slate-400 dark:text-slate-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-50 tracking-tight">LLM Management</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure AI providers, routing, and monitor usage
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-8 py-3 border-b border-white/[0.04] flex gap-1 relative z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 dark:text-slate-500 hover:text-white hover:bg-white/[0.04]'
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
                  disabled={applyingPreset}
                >
                  {applyingPreset ? 'Applying preset...' : 'Apply v3 recommended preset'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowInactive(!showInactive)}
                  icon={showInactive ? Eye : EyeOff}
                  size="sm"
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
                >
                  Add Provider
                </Button>
              </div>
            </div>

            <Card variant="bordered" padding="none">
              {lastTestReport && (
                <div className="px-4 py-3 text-xs border-b border-white/[0.04] text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Last test:</span>{' '}
                  <span className="font-medium">{lastTestReport}</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Model ID
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Kind
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Tier
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Visibility
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Config
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500 dark:text-slate-400" />
                        </td>
                      </tr>
                    ) : providers.filter((p) => showInactive || p.is_active).length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm"
                        >
                          No providers configured
                        </td>
                      </tr>
                    ) : (
                      managedProviders
                        .filter((p) => showInactive || p.is_active)
                        .map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-slate-200">
                              {p.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 capitalize">
                              {p.provider}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                              {p.model_id}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                              {String((p as any).kind || 'TEXT_LLM')}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={p.tier || 'STANDARD'}
                                onChange={(e) => handleTierChange(p.id, e.target.value)}
                                className="text-xs px-2 py-1 rounded bg-slate-800 border border-white/[0.06] text-slate-300 outline-none cursor-pointer"
                              >
                                <option value="BUDGET">Budget</option>
                                <option value="STANDARD">Standard</option>
                                <option value="PREMIUM">Premium</option>
                                <option value="REASONING">Reasoning</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                variant={
                                  p.visibility === 'public'
                                    ? 'success'
                                    : p.visibility === 'beta'
                                      ? 'warning'
                                      : 'neutral'
                                }
                                label={p.visibility || 'admin'}
                                dot={false}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                variant={p.is_active ? 'success' : 'neutral'}
                                label={p.is_active ? 'Active' : 'Inactive'}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                variant={(p as any).is_configured ? 'success' : 'warning'}
                                label={(p as any).is_configured ? 'Configured' : 'Missing key'}
                              />
                            </td>
                            <td className="px-4 py-3">
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
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
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
                      className="flex items-center gap-4 p-4 border border-white/[0.04] rounded-lg hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-200">{item.label}</div>
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
                      className="flex items-center gap-4 p-3 border border-white/[0.04] rounded-lg hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-sm text-slate-200">{m.model}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {m.requests} requests
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-100 tabular-nums">
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
                    <div className="text-sm text-slate-400 dark:text-slate-500">Loading…</div>
                  ) : incidentsData?.success ? (
                    <>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Uptime:{' '}
                        <span className="font-medium text-slate-200">
                          {incidentsData?.uptime?.uptimePct}%
                        </span>
                        {' · '}
                        Incidents:{' '}
                        <span className="font-medium text-slate-200">
                          {(incidentsData?.incidents || []).length}
                        </span>
                      </div>
                      {(incidentsData?.incidents || []).length === 0 ? (
                        <div className="text-sm text-slate-300">No downtime detected.</div>
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
                                  className="p-3 border border-white/[0.04] rounded-lg bg-white/[0.02]"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm text-slate-200">
                                      <span className="font-medium">Down</span>{' '}
                                      <span className="text-slate-400">
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
                    <div className="text-sm text-slate-400 dark:text-slate-500">
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
                      className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                    >
                      <span className="text-sm text-slate-300">{check.name}</span>
                      <span
                        className={`text-sm ${
                          check.status === 'OK'
                            ? 'text-emerald-400'
                            : check.status === 'MISSING'
                              ? 'text-amber-400'
                              : 'text-slate-400 dark:text-slate-500'
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
                      className="flex items-center gap-3 p-4 border border-white/[0.04] rounded-lg hover:bg-white/[0.02] hover:border-white/[0.08] transition-colors"
                    >
                      <cap.icon size={18} className="text-slate-400 dark:text-slate-500" />
                      <span className="text-sm text-slate-300">{cap.label}</span>
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
          <div className="bg-slate-900 border border-white/[0.06] rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-slate-100">
                {cloningFromProviderId
                  ? 'Clone Model'
                  : editingProviderId
                    ? 'Edit Provider'
                    : 'Add Provider'}
              </h2>
              <IconButton icon={X} onClick={() => setShowProviderModal(false)} label="Close" />
            </div>
            <form onSubmit={handleProviderSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    required
                    value={providerForm.name}
                    onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Provider Type
                  </label>
                  <select
                    value={providerForm.provider}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, provider: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                  className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  placeholder="sk-..."
                  disabled={!!cloningFromProviderId}
                />
                {cloningFromProviderId ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    API key is reused from the source provider (server-side).
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Model ID
                  </label>
                  <input
                    required
                    value={providerForm.model_id}
                    onChange={(e) => setProviderForm({ ...providerForm, model_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Performance Tier
                  </label>
                  <select
                    value={providerForm.tier || 'STANDARD'}
                    onChange={(e) => setProviderForm({ ...providerForm, tier: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
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
                      className="w-4 h-4 rounded bg-slate-800 border-white/10"
                    />
                    <span className="text-sm text-slate-300">Active</span>
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
                <Button variant="primary" type="submit" className="flex-1">
                  Save Provider
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
