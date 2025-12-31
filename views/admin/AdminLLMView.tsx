import React, { useState, useEffect, useCallback } from 'react';
import { Api } from '../../services/api';
import { LLMProvider } from '../../types';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Trash2, Edit, Save, X, Check, Eye, EyeOff, Server, RefreshCw, Wifi, WifiOff, Activity, AlertTriangle, CheckCircle, XCircle, Zap, Clock, ArrowRight } from 'lucide-react';
import { InfoButton } from '../../components/shared/InfoButton';

// Health Status Types
interface ProviderStatus {
    id: string;
    provider: string;
    name: string;
    model: string;
    endpoint: string;
    isConfigured: boolean;
    isActive: boolean;
    isDefault: boolean;
    tier: string;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastHealthCheck: string | null;
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsTools: boolean;
    priority: number;
    costPer1k: number;
}

interface HealthSummary {
    total: number;
    configured: number;
    active: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
}

interface LLMStatus {
    success: boolean;
    timestamp: string;
    providers: ProviderStatus[];
    defaultProvider: { provider: string; model: string; name: string } | null;
    fallbackChains: Record<string, string[]>;
    circuitBreakers: Record<string, { state: string; failures: number; lastFailure?: number; lastSuccess?: number }>;
    summary: HealthSummary;
    startupValidation: {
        timestamp: string;
        duration: number;
        healthy: number;
        criticalErrors: string[];
    } | null;
}

export const AdminLLMView: React.FC = () => {
    // Providers State
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    // Health Status State (new)
    const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [refreshingHealth, setRefreshingHealth] = useState(false);

    // Ollama Configuration State
    const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
    const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
    const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
    const [testingOllama, setTestingOllama] = useState(false);

    // Prompts State
    const [activeTab, setActiveTab] = useState<'providers' | 'prompts' | 'health'>('providers');
    const [prompts, setPrompts] = useState<any[]>([]);
    const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

    const [form, setForm] = useState<Partial<LLMProvider>>({
        name: '',
        provider: 'openai',
        api_key: '',
        endpoint: '',
        model_id: '',
        is_active: true,
        visibility: 'admin',
        cost_per_1k: 0
    });

    const loadProviders = async () => {
        try {
            const data = await Api.getLLMProviders();
            setProviders(data);
            setLoading(false);
        } catch (err) {
            toast.error('Failed to load providers');
            setLoading(false);
        }
    };

    const loadPrompts = async () => {
        try {
            const data = await Api.aiGetSystemPrompts();
            setPrompts(data);
        } catch (e) {
            console.error(e);
        }
    };

    // Load LLM status (new)
    const loadLLMStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const response = await fetch('/api/llm/status');
            const data = await response.json();
            if (data.success) {
                setLLMStatus(data);
            }
        } catch (e) {
            console.error('Failed to load LLM status:', e);
        }
        setLoadingStatus(false);
    }, []);

    // Refresh all provider health
    const refreshAllHealth = async () => {
        setRefreshingHealth(true);
        try {
            const response = await fetch('/api/llm/status/refresh', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                toast.success(`Health check complete: ${data.summary?.healthy || 0} healthy providers`);
                await loadLLMStatus();
            } else {
                toast.error(data.error || 'Health check failed');
            }
        } catch (e) {
            toast.error('Failed to refresh health');
        }
        setRefreshingHealth(false);
    };

    // Test single provider
    const testSingleProvider = async (provider: string) => {
        setTestingProvider(provider);
        try {
            const response = await fetch(`/api/llm/status/test/${provider}`, { method: 'POST' });
            const data = await response.json();
            if (data.success && data.reachable) {
                toast.success(`${provider} is healthy (${data.latency}ms)`);
            } else {
                toast.error(`${provider}: ${data.error || 'Connection failed'}`);
            }
            await loadLLMStatus();
        } catch (e) {
            toast.error(`Test failed for ${provider}`);
        }
        setTestingProvider(null);
    };

    // Get status icon
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={16} className="text-green-400" />;
            case 'degraded': return <AlertTriangle size={16} className="text-yellow-400" />;
            case 'unhealthy': return <XCircle size={16} className="text-red-400" />;
            default: return <Activity size={16} className="text-slate-400" />;
        }
    };

    // Get status color class
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'degraded': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'unhealthy': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    useEffect(() => {
        const initLLMData = async () => {
            try {
                const data = await Api.getLLMProviders();
                setProviders(data);
                setLoading(false);
            } catch (err) {
                toast.error('Failed to load providers');
                setLoading(false);
            }
            try {
                const promptsData = await Api.aiGetSystemPrompts();
                setPrompts(promptsData);
            } catch (e) {
                console.error(e);
            }
            // Load LLM status
            loadLLMStatus();
        };
        initLLMData();
    }, [loadLLMStatus]);

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
                cost_per_1k: 0
            });
            toast.success(`Added ${modelName}`);
            loadProviders();
        } catch (err) {
            toast.error('Failed to add model');
        }
    };

    const [testingConnection, setTestingConnection] = useState(false);

    const handleTestConnection = async (config: Partial<LLMProvider>) => {
        setTestingConnection(true);
        try {
            const result = await Api.testLLMConnection(config);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await Api.updateLLMProvider(editingId, form);
                toast.success('Provider updated');
            } else {
                await Api.addLLMProvider(form);
                toast.success('Provider added');
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ name: '', provider: 'openai', api_key: '', endpoint: '', model_id: '', is_active: true, visibility: 'admin' });
            loadProviders();
        } catch (err) {
            toast.error('Operation failed');
        }
    };

    const handleUpdatePrompt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPrompt) return;
        try {
            await Api.aiUpdateSystemPrompt(editingPrompt.key, {
                content: editingPrompt.content,
                description: editingPrompt.description,
                context_config: editingPrompt.context_config,
                updatedBy: 'SuperAdmin' // In real app, use currentUser.email
            });
            toast.success('System Prompt Updated');
            setEditingPrompt(null);
            loadPrompts();
        } catch (e) {
            toast.error('Failed to update prompt');
        }
    };

    const handleEdit = (p: LLMProvider) => {
        setEditingId(p.id);
        setForm(p);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await Api.deleteLLMProvider(id);
            toast.success('Provider deleted');
            loadProviders();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    return (
        <div className="space-y-6 relative">
            <InfoButton cardId="admin-llm" position="top-right" />
            {/* TABS */}
            <div className="flex gap-4 border-b border-white/5 pb-1">
                <button
                    onClick={() => setActiveTab('providers')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'providers' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    LLM Providers
                </button>
                <button
                    onClick={() => setActiveTab('health')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'health' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    <Activity size={14} />
                    Health Dashboard
                    {llmStatus && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                            llmStatus.summary.healthy > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {llmStatus.summary.healthy}/{llmStatus.summary.configured}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('prompts')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prompts' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    System Personas (Prompts)
                </button>
            </div>

            {activeTab === 'health' ? (
                /* HEALTH DASHBOARD TAB */
                <div className="space-y-6">
                    {/* Health Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-green-900/30 to-navy-900 border border-green-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={18} className="text-green-400" />
                                <span className="text-xs uppercase tracking-wider text-green-400">Healthy</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{llmStatus?.summary.healthy || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-yellow-900/30 to-navy-900 border border-yellow-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={18} className="text-yellow-400" />
                                <span className="text-xs uppercase tracking-wider text-yellow-400">Degraded</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{llmStatus?.summary.degraded || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-red-900/30 to-navy-900 border border-red-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle size={18} className="text-red-400" />
                                <span className="text-xs uppercase tracking-wider text-red-400">Unhealthy</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{llmStatus?.summary.unhealthy || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/50 to-navy-900 border border-white/10 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Server size={18} className="text-slate-400" />
                                <span className="text-xs uppercase tracking-wider text-slate-400">Total</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{llmStatus?.summary.configured || 0}<span className="text-sm text-slate-500">/{llmStatus?.summary.total || 0}</span></p>
                        </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            {llmStatus?.defaultProvider && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-400">Default:</span>
                                    <span className="text-white font-medium">{llmStatus.defaultProvider.name}</span>
                                    <span className="text-slate-500">({llmStatus.defaultProvider.model})</span>
                                </div>
                            )}
                            {llmStatus?.startupValidation && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Clock size={12} />
                                    Last check: {new Date(llmStatus.startupValidation.timestamp).toLocaleTimeString()}
                                    ({llmStatus.startupValidation.duration}ms)
                                </div>
                            )}
                        </div>
                        <button
                            onClick={refreshAllHealth}
                            disabled={refreshingHealth}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <RefreshCw size={16} className={refreshingHealth ? 'animate-spin' : ''} />
                            {refreshingHealth ? 'Refreshing...' : 'Refresh All'}
                        </button>
                    </div>

                    {/* Critical Errors */}
                    {llmStatus?.startupValidation?.criticalErrors && llmStatus.startupValidation.criticalErrors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <h3 className="text-red-400 font-semibold flex items-center gap-2 mb-2">
                                <AlertTriangle size={16} />
                                Critical Errors
                            </h3>
                            <ul className="space-y-1">
                                {llmStatus.startupValidation.criticalErrors.map((err, i) => (
                                    <li key={i} className="text-red-300 text-sm">• {err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Provider Health Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {llmStatus?.providers.map((p) => (
                            <div
                                key={p.id || p.provider}
                                className={`border rounded-xl p-4 transition-all ${getStatusClass(p.healthStatus)}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-semibold text-white">{p.name || p.provider}</h4>
                                        <p className="text-xs text-slate-400 font-mono">{p.model}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(p.healthStatus)}
                                        <span className="text-xs capitalize">{p.healthStatus}</span>
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-1 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-xs ${p.isDefault ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700/50 text-slate-400'}`}>
                                        {p.isDefault ? '★ Default' : p.tier}
                                    </span>
                                    {p.supportsVision && <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">Vision</span>}
                                    {p.supportsTools && <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-300">Tools</span>}
                                    {!p.isConfigured && <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-300">No API Key</span>}
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">
                                        Priority: {p.priority} | ${p.costPer1k}/1k
                                    </span>
                                    <button
                                        onClick={() => testSingleProvider(p.provider)}
                                        disabled={testingProvider === p.provider || !p.isConfigured}
                                        className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded flex items-center gap-1 transition-colors"
                                    >
                                        {testingProvider === p.provider ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                            <Wifi size={12} />
                                        )}
                                        Test
                                    </button>
                                </div>

                                {/* Circuit Breaker Status */}
                                {llmStatus.circuitBreakers[p.provider] && (
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Zap size={10} className={
                                                llmStatus.circuitBreakers[p.provider].state === 'CLOSED' ? 'text-green-400' :
                                                llmStatus.circuitBreakers[p.provider].state === 'OPEN' ? 'text-red-400' :
                                                'text-yellow-400'
                                            } />
                                            <span className="text-slate-400">
                                                Circuit: {llmStatus.circuitBreakers[p.provider].state}
                                            </span>
                                            {llmStatus.circuitBreakers[p.provider].failures > 0 && (
                                                <span className="text-red-400">
                                                    ({llmStatus.circuitBreakers[p.provider].failures} failures)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Fallback Chains */}
                    {llmStatus?.fallbackChains && (
                        <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <ArrowRight size={18} className="text-purple-400" />
                                Fallback Chains
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(llmStatus.fallbackChains).map(([tier, chain]) => (
                                    <div key={tier} className="bg-navy-950/50 rounded-lg p-3">
                                        <span className="text-xs uppercase tracking-wider text-purple-400 mb-2 block">{tier}</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {(chain as string[]).map((provider, idx) => (
                                                <React.Fragment key={provider}>
                                                    {idx > 0 && <ArrowRight size={12} className="text-slate-600" />}
                                                    <span className={`text-sm px-2 py-0.5 rounded ${
                                                        llmStatus.providers.find(p => p.provider === provider)?.healthStatus === 'healthy'
                                                            ? 'bg-green-500/20 text-green-300'
                                                            : 'bg-slate-700/50 text-slate-400'
                                                    }`}>
                                                        {provider}
                                                    </span>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'providers' ? (
                <>
                    {/* Ollama Local Model Configuration */}
                    <div className="bg-gradient-to-br from-purple-900/30 to-navy-900 border border-purple-500/20 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                                <Server size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Ollama Local Models</h3>
                                <p className="text-sm text-slate-400">Connect to a local Ollama instance for privacy-focused AI</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mb-4">
                            <input
                                type="text"
                                value={ollamaEndpoint}
                                onChange={(e) => setOllamaEndpoint(e.target.value)}
                                placeholder="http://localhost:11434"
                                className="flex-1 bg-navy-950 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                            />
                            <button
                                onClick={testOllamaConnection}
                                disabled={testingOllama}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {testingOllama ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : ollamaConnected ? (
                                    <Wifi size={16} />
                                ) : (
                                    <WifiOff size={16} />
                                )}
                                {testingOllama ? 'Testing...' : 'Test Connection'}
                            </button>
                        </div>

                        {ollamaConnected === true && ollamaModels.length > 0 && (
                            <div className="bg-navy-950/50 rounded-lg p-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Available Models (click to add)</p>
                                <div className="flex flex-wrap gap-2">
                                    {ollamaModels.map((model) => {
                                        const alreadyAdded = providers.some(p => p.provider === 'ollama' && p.model_id === model.name);
                                        return (
                                            <button
                                                key={model.name}
                                                onClick={() => !alreadyAdded && addOllamaModel(model.name)}
                                                disabled={alreadyAdded}
                                                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${alreadyAdded
                                                    ? 'bg-green-500/20 text-green-400 cursor-default'
                                                    : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
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
                    </div>

                    {/* Cloud Providers */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-purple-500" />
                                LLM Gateway Management
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">Configure AI models available to tenants.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowInactive(!showInactive)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${showInactive ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}
                            >
                                {showInactive ? <Eye size={16} /> : <EyeOff size={16} />}
                                {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                            </button>
                            <button
                                onClick={() => { setEditingId(null); setForm({ name: '', provider: 'openai', api_key: '', endpoint: '', is_active: true, visibility: 'admin' }); setShowModal(true); }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                <Plus size={16} /> Add Provider
                            </button>
                        </div>
                    </div>

                    <div className="bg-navy-900 border border-white/5 rounded-xl overflow-auto custom-scrollbar">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-navy-950 text-slate-400 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Provider</th>
                                    <th className="px-6 py-4">Model ID</th>
                                    <th className="px-6 py-4">Pricing</th>
                                    <th className="px-6 py-4">Visibility</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? <tr><td colSpan={8} className="p-8 text-center">Loading...</td></tr> : providers
                                    .filter(p => showInactive || p.is_active)
                                    .map(p => (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                                            <td className="px-6 py-4 capitalize">{p.provider}</td>
                                            <td className="px-6 py-4 font-mono text-xs">{p.model_id}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                                I: ${p.input_cost_per_1k || 0}<br />
                                                O: ${p.output_cost_per_1k || 0}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs ${p.visibility === 'public' ? 'bg-green-500/20 text-green-400' : p.visibility === 'beta' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'}`}>
                                                    {p.visibility}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {p.is_active ? <span className="text-green-400 flex items-center gap-1"><Check size={14} /> Active</span> : <span className="text-slate-500">Inactive</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleTestConnection(p)}
                                                        title="Test Connection"
                                                        disabled={testingConnection}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-green-400 transition-colors"
                                                    >
                                                        <Wifi size={16} />
                                                    </button>
                                                    <button onClick={() => handleEdit(p)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><Edit size={16} /></button>
                                                    <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Modal */}
                    {showModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                            <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white">{editingId ? 'Edit Provider' : 'Add Provider'}</h2>
                                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                                </div>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Provider Type</label>
                                            <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value as any })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white">
                                                <optgroup label="— Major Providers —">
                                                    <option value="openai">OpenAI (GPT-4)</option>
                                                    <option value="anthropic">Anthropic (Claude)</option>
                                                    <option value="google">Google Gemini</option>
                                                </optgroup>
                                                <optgroup label="— Open Source / Fast —">
                                                    <option value="mistral">Mistral AI</option>
                                                    <option value="groq">Groq (Ultra Fast)</option>
                                                    <option value="together">Together AI</option>
                                                    <option value="nvidia">NVIDIA NIM</option>
                                                    <option value="ollama">Ollama (Local)</option>
                                                </optgroup>
                                                <optgroup label="— Chinese Providers —">
                                                    <option value="deepseek">DeepSeek</option>
                                                    <option value="qwen">Alibaba Qwen</option>
                                                    <option value="ernie">Baidu ERNIE</option>
                                                    <option value="z_ai">Zhipu AI (GLM)</option>
                                                </optgroup>
                                                <optgroup label="— Search / Tools —">
                                                    <option value="tavily">Tavily Search</option>
                                                    <option value="google_search">Google Search</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">API Key</label>
                                        <div className="relative">
                                            <input type="password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" placeholder="sk-..." />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Model ID (e.g. gpt-4)</label>
                                            <input required value={form.model_id} onChange={e => setForm({ ...form, model_id: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Endpoint (Optional)</label>
                                            <input value={form.endpoint} onChange={e => setForm({ ...form, endpoint: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" placeholder="https://api..." />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Input Pricing ($/1k)</label>
                                            <input type="number" step="0.000001" value={form.input_cost_per_1k || 0} onChange={e => setForm({ ...form, input_cost_per_1k: parseFloat(e.target.value) })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Output Pricing ($/1k)</label>
                                            <input type="number" step="0.000001" value={form.output_cost_per_1k || 0} onChange={e => setForm({ ...form, output_cost_per_1k: parseFloat(e.target.value) })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Visibility</label>
                                            <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as any })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white">
                                                <option value="admin">Admin Only</option>
                                                <option value="beta">Beta Users</option>
                                                <option value="public">Public</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center pt-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded bg-navy-950 border-white/10" />
                                                <span className="text-sm text-slate-300">Active</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 rounded">Cancel</button>
                                        <button
                                            type="button"
                                            onClick={() => handleTestConnection(form)}
                                            disabled={!form.provider || !form.api_key || testingConnection}
                                            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 rounded flex items-center gap-2"
                                        >
                                            <Wifi size={16} /> Test
                                        </button>
                                        <button type="submit" className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded">Save Provider</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        {prompts.map(p => (
                            <div
                                key={p.key}
                                onClick={() => setEditingPrompt(p)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${editingPrompt?.key === p.key ? 'bg-purple-500/20 border-purple-500' : 'bg-navy-900 border-white/5 hover:border-white/20'}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-white">{p.key}</h3>
                                    <span className="text-xs text-slate-400">{new Date(p.updated_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-2">{p.description}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 h-fit">
                        {editingPrompt ? (
                            <form onSubmit={handleUpdatePrompt}>
                                <h3 className="text-lg font-bold mb-4">Edit Persona: {editingPrompt.key}</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                                        <input
                                            value={editingPrompt.description}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                                            className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">System Prompt</label>
                                        <textarea
                                            value={editingPrompt.content}
                                            onChange={e => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                                            className="w-full h-96 bg-navy-950 border border-white/10 rounded p-4 text-white font-mono text-sm leading-relaxed focus:border-purple-500 outline-none resize-none"
                                        />
                                    </div>

                                    {/* Context Injection Controls */}
                                    <div className="bg-navy-950 border border-white/5 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                            <Shield size={14} className="text-purple-400" />
                                            Context Injection Governance
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'include_project_context', label: 'Project Context (Goals, Risks)' },
                                                { id: 'include_user_profile', label: 'User Profile (Role, Bio)' },
                                                { id: 'include_assessment_data', label: 'Live Assessment Data' },
                                                { id: 'include_kb_articles', label: 'Knowledge Base (RAG)' },
                                                { id: 'include_task_history', label: 'Task History & Comments' }
                                            ].map(opt => {
                                                const config = typeof editingPrompt.context_config === 'string'
                                                    ? JSON.parse(editingPrompt.context_config || '{}')
                                                    : (editingPrompt.context_config || {});

                                                return (
                                                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${config[opt.id] ? 'bg-purple-600 border-purple-600' : 'border-white/20 group-hover:border-white/40'}`}>
                                                            {config[opt.id] && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={!!config[opt.id]}
                                                            onChange={e => {
                                                                const newConfig = { ...config, [opt.id]: e.target.checked };
                                                                setEditingPrompt({ ...editingPrompt, context_config: newConfig });
                                                            }}
                                                        />
                                                        <span className="text-xs text-slate-300 group-hover:text-white transition-colors">{opt.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center gap-2">
                                            <Save size={16} /> Save Persona
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div className="h-96 flex items-center justify-center text-slate-500">
                                Select a persona to edit
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
