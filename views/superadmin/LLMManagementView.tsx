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
    Server,
    Settings,
    Trash2,
    TrendingUp,
    Wifi,
    WifiOff,
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

    // Providers
    const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);
    const [providerForm, setProviderForm] = useState<Partial<LLMProviderConfig>>({
        name: '',
        provider: 'openai',
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

    // Ollama
    const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
    const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
    const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
    const [testingOllama, setTestingOllama] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);

    // Usage stats
    const [usageStats, setUsageStats] = useState<any>(null);
    const [costStats, setCostStats] = useState<any>(null);

    // Health status
    const [healthStatus, setHealthStatus] = useState<any>(null);

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

    const handleProviderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingProviderId) {
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
            provider: 'openai',
            api_key: '',
            endpoint: '',
            model_id: '',
            is_active: true,
            visibility: 'admin',
            cost_per_1k: 0,
            tier: 'STANDARD',
        });
    };

    const handleEditProvider = (p: LLMProviderConfig) => {
        setEditingProviderId(p.id);
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

    const testOllamaConnection = async () => {
        setTestingOllama(true);
        try {
            const result = await Api.testOllamaConnection(ollamaEndpoint);
            if (result.success) {
                setOllamaConnected(true);
                setOllamaModels(result.models || []);
                toast.success(result.message || 'Connected to Ollama!');
            } else {
                setOllamaConnected(false);
                setOllamaModels([]);
                toast.error(result.error || 'Connection failed');
            }
        } catch (err) {
            setOllamaConnected(false);
            setOllamaModels([]);
            toast.error('Failed to connect to Ollama');
        }
        setTestingOllama(false);
    };

    const addOllamaModel = async (modelName: string) => {
        try {
            await Api.addLLMProvider({
                name: `Ollama - ${modelName}`,
                provider: 'ollama',
                api_key: '',
                endpoint: ollamaEndpoint,
                model_id: modelName,
                is_active: true,
                visibility: 'public',
                cost_per_1k: 0,
                tier: 'budget',
            } as any);
            toast.success(`Added ${modelName}`);
            loadInitialData();
        } catch (err) {
            toast.error('Failed to add model');
        }
    };

    const handleTestConnection = async (config: Partial<LLMProviderConfig>) => {
        setTestingConnection(true);
        try {
            const result = await Api.testLLMConnection(config as any);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(`Connection Failed: ${result.message}`);
            }
        } catch (err) {
            toast.error('Test failed to execute');
        }
        setTestingConnection(false);
    };

    const tabs = [
        { id: 'providers' as LLMConfigTab, label: 'Providers', icon: Cpu },
        { id: 'routing' as LLMConfigTab, label: 'Routing', icon: Settings },
        { id: 'usage' as LLMConfigTab, label: 'Usage', icon: BarChart3 },
        { id: 'health' as LLMConfigTab, label: 'Health', icon: Activity },
    ];

    return (
        <div className="h-full flex flex-col bg-navy-950 overflow-hidden relative">
            <InfoButton cardId="superadmin-llm-management" position="top-right" />

            {/* Header */}
            <div className="shrink-0 px-8 py-6 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                        <Cpu size={20} className="text-slate-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-slate-50 tracking-tight">LLM Management</h1>
                        <p className="text-sm text-slate-500">Configure AI providers, routing, and monitor usage</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-8 py-3 border-b border-white/[0.04] flex gap-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
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
                        {/* Ollama Local Models */}
                        <Card variant="bordered" padding="lg">
                            <div className="flex items-center gap-3 mb-4">
                                <Server size={18} className="text-slate-400" />
                                <div>
                                    <h3 className="text-base font-medium text-slate-100">Ollama Local Models</h3>
                                    <p className="text-xs text-slate-500">
                                        Connect to local Ollama for privacy-focused AI
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={ollamaEndpoint}
                                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                                    placeholder="http://localhost:11434"
                                    className="flex-1 px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={testOllamaConnection}
                                    loading={testingOllama}
                                    icon={ollamaConnected ? Wifi : WifiOff}
                                >
                                    Test
                                </Button>
                            </div>

                            {ollamaConnected === true && ollamaModels.length > 0 && (
                                <div className="border border-white/[0.04] rounded-lg p-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                                        Available Models
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {ollamaModels.map((model) => {
                                            const alreadyAdded = providers.some(
                                                (p) => p.provider === 'ollama' && p.model_id === model.name,
                                            );
                                            return (
                                                <button
                                                    key={model.name}
                                                    onClick={() => !alreadyAdded && addOllamaModel(model.name)}
                                                    disabled={alreadyAdded}
                                                    className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                                                        alreadyAdded
                                                            ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {alreadyAdded && <Check size={12} />}
                                                    {model.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {ollamaConnected === false && (
                                <p className="text-red-400 text-sm">Unable to connect. Make sure Ollama is running.</p>
                            )}
                        </Card>

                        {/* Cloud Providers */}
                        <div className="flex justify-between items-center">
                            <SectionHeader title="LLM Providers" subtitle="Configure AI models available to tenants" />
                            <div className="flex gap-2">
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
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/[0.06]">
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Provider
                                            </th>
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Model ID
                                            </th>
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Tier
                                            </th>
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Visibility
                                            </th>
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500" />
                                                </td>
                                            </tr>
                                        ) : providers.filter((p) => showInactive || p.is_active).length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                                                    No providers configured
                                                </td>
                                            </tr>
                                        ) : (
                                            providers
                                                .filter((p) => showInactive || p.is_active)
                                                .map((p) => (
                                                    <tr
                                                        key={p.id}
                                                        className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                                                    >
                                                        <td className="px-4 py-3 text-sm font-medium text-slate-200">
                                                            {p.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-400 capitalize">
                                                            {p.provider}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                                            {p.model_id}
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
                                                            <div className="flex items-center justify-end gap-1">
                                                                <IconButton
                                                                    icon={Wifi}
                                                                    onClick={() => handleTestConnection(p)}
                                                                    label="Test Connection"
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
                                                <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                                            </div>
                                            <div className="text-xs text-slate-500">
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
                                                <div className="text-xs text-slate-500">{m.requests} requests</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-slate-100 tabular-nums">
                                                    ${(m.cost || 0).toFixed(4)}
                                                </div>
                                                <div className="text-xs text-slate-500 tabular-nums">
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
                                                          : 'text-slate-400'
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
                                            <cap.icon size={18} className="text-slate-400" />
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
                                {editingProviderId ? 'Edit Provider' : 'Add Provider'}
                            </h2>
                            <IconButton icon={X} onClick={() => setShowProviderModal(false)} label="Close" />
                        </div>
                        <form onSubmit={handleProviderSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
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
                                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
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
                                            <option value="openai">OpenAI (GPT-4)</option>
                                            <option value="anthropic">Anthropic (Claude)</option>
                                            <option value="google">Google Gemini</option>
                                        </optgroup>
                                        <optgroup label="Open Source / Fast">
                                            <option value="mistral">Mistral AI</option>
                                            <option value="groq">Groq (Ultra Fast)</option>
                                            <option value="together">Together AI</option>
                                            <option value="ollama">Ollama (Local)</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={providerForm.api_key}
                                    onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500/50"
                                    placeholder="sk-..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
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
                                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
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
                                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
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
                                    onClick={() => handleTestConnection(providerForm)}
                                    disabled={!providerForm.provider || !providerForm.api_key || testingConnection}
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
