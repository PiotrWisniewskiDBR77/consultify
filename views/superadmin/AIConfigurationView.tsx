import React, { useState, useEffect } from 'react';
import {
    Brain,
    Settings,
    MessageSquare,
    Wand2,
    FileText,
    Target,
    BarChart3,
    Zap,
    Save,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    DollarSign,
    Activity,
    Cpu,
    Eye,
    Hand,
    Sparkles,
    TrendingUp,
    Server,
    Plus,
    Trash2,
    Edit,
    X,
    Check,
    EyeOff,
    Wifi,
    WifiOff,
    Database
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../../components/shared/InfoButton';
import { LLMProvider } from '../../types';

// AI Capability definitions with their prompt keys
const AI_CAPABILITIES = [
    {
        id: 'chat',
        name: 'AI Chat',
        icon: MessageSquare,
        description: 'Main AI assistant for conversations',
        promptKey: 'system_chat',
        color: 'from-blue-500 to-blue-600'
    },
    {
        id: 'magic_wand',
        name: 'Magic Wand',
        icon: Wand2,
        description: 'Field auto-suggestions',
        promptKey: 'system_magic_wand',
        color: 'from-purple-500 to-purple-600'
    },
    {
        id: 'reports',
        name: 'Report Generator',
        icon: FileText,
        description: 'Report and analysis generation',
        promptKey: 'system_reports',
        color: 'from-emerald-500 to-emerald-600'
    },
    {
        id: 'initiative_analysis',
        name: 'Initiative Analysis',
        icon: Target,
        description: 'Initiative scoring and analysis',
        promptKey: 'system_initiative',
        color: 'from-amber-500 to-amber-600'
    },
    {
        id: 'max_mode',
        name: 'MAX Mode (Deep Reasoning)',
        icon: Sparkles,
        description: 'Deep analysis with chain-of-thought',
        promptKey: 'system_max_reasoner',
        color: 'from-rose-500 to-rose-600'
    },
    {
        id: 'coach',
        name: 'AI Coach',
        icon: Brain,
        description: 'PMO coaching and mentoring',
        promptKey: 'system_coach',
        color: 'from-cyan-500 to-cyan-600'
    }
];

// Tabs for AI Configuration
type AIConfigTab = 'functions' | 'providers' | 'routing' | 'usage' | 'health';

export const AIConfigurationView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AIConfigTab>('functions');
    const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
    const [prompts, setPrompts] = useState<Record<string, { content: string; updated_at?: string }>>({});
    const [editingPrompt, setEditingPrompt] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Usage stats
    const [usageStats, setUsageStats] = useState<any>(null);
    const [costStats, setCostStats] = useState<any>(null);

    // Health status
    const [healthStatus, setHealthStatus] = useState<any>(null);

    // Providers
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);
    const [providerForm, setProviderForm] = useState<Partial<LLMProvider>>({
        name: '',
        provider: 'openai',
        api_key: '',
        endpoint: '',
        model_id: '',
        is_active: true,
        visibility: 'admin',
        cost_per_1k: 0
    });

    // Ollama
    const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
    const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
    const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
    const [testingOllama, setTestingOllama] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Load prompts
            const promptsData = await Api.aiGetSystemPrompts();
            const promptsMap: Record<string, any> = {};
            promptsData.forEach((p: any) => {
                promptsMap[p.key] = { content: p.content, updated_at: p.updated_at };
            });
            setPrompts(promptsMap);

            // Load providers
            const providersData = await Api.getLLMProviders();
            setProviders(providersData);

            // Load usage stats
            try {
                const usage = await fetch('/api/llm/control/usage', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }).then(r => r.json());
                setUsageStats(usage);
            } catch (e) { console.error('Usage load failed:', e); }

            // Load costs
            try {
                const costs = await fetch('/api/llm/costs', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }).then(r => r.json());
                setCostStats(costs);
            } catch (e) { console.error('Costs load failed:', e); }

            // Load health
            try {
                const health = await fetch('/api/llm/diagnose').then(r => r.json());
                setHealthStatus(health);
            } catch (e) { console.error('Health load failed:', e); }

        } catch (err) {
            console.error('Failed to load AI config data:', err);
            toast.error('Failed to load AI configuration');
        }
        setLoading(false);
    };

    const selectCapability = (capabilityId: string) => {
        const cap = AI_CAPABILITIES.find(c => c.id === capabilityId);
        if (cap) {
            setSelectedCapability(capabilityId);
            setEditingPrompt(prompts[cap.promptKey]?.content || getDefaultPrompt(capabilityId));
        }
    };

    const getDefaultPrompt = (capabilityId: string): string => {
        const defaults: Record<string, string> = {
            chat: `You are a professional AI consultant for the TechnoLex platform.
Your role: Help users manage digital transformation projects.

RULES:
- Respond concisely and specifically
- Use DRD (Digital Readiness Diagnostic) methodology
- Cite knowledge base sources when possible
- Propose concrete actions, not just theories
- Be supportive but professional`,

            magic_wand: `You are an assistant for form field auto-completion.
Generate short, accurate suggestions based on screen and project context.

RESPONSE FORMAT:
- suggestion: main suggestion (max 500 chars)
- reasoning: brief justification
- confidence: high/medium/low
- alternatives: 2-3 alternative proposals`,

            reports: `You are a PMO reports and strategic analysis expert.
Generate professional reports compliant with ISO 21500 and PMBOK standards.`,

            initiative_analysis: `You are a strategic analyst evaluating transformation initiatives.

EVALUATION CRITERIA:
- Strategic Alignment (1-5)
- Business Impact (1-5)
- Technical Feasibility (1-5)
- Resource Requirements (S/M/L)
- Risk Level (Low/Medium/High)`,

            max_mode: `You are a top-level strategic expert.
Use deep reasoning (chain-of-thought) for complex problem analysis.

THINKING PROTOCOL:
1. <thinking> - internal step-by-step analysis
2. Consider all perspectives
3. Identify hidden assumptions
4. Evaluate trade-offs
5. </thinking> - summary for user`,

            coach: `You are a PMO coach and digital transformation mentor.
Help leaders develop change management competencies.`
        };
        return defaults[capabilityId] || '';
    };

    const savePrompt = async () => {
        if (!selectedCapability) return;

        const cap = AI_CAPABILITIES.find(c => c.id === selectedCapability);
        if (!cap) return;

        setSaving(true);
        try {
            await Api.aiUpdateSystemPrompt(cap.promptKey, { content: editingPrompt });
            setPrompts(prev => ({
                ...prev,
                [cap.promptKey]: { content: editingPrompt, updated_at: new Date().toISOString() }
            }));
            toast.success(`Saved instructions for ${cap.name}`);
        } catch (err) {
            toast.error('Failed to save');
        }
        setSaving(false);
    };

    // Provider management
    const handleProviderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingProviderId) {
                await Api.updateLLMProvider(editingProviderId, providerForm);
                toast.success('Provider updated');
            } else {
                await Api.addLLMProvider(providerForm);
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

    const resetProviderForm = () => {
        setProviderForm({
            name: '',
            provider: 'openai',
            api_key: '',
            endpoint: '',
            model_id: '',
            is_active: true,
            visibility: 'admin',
            cost_per_1k: 0
        });
    };

    const handleEditProvider = (p: LLMProvider) => {
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
                cost_per_1k: 0
            });
            toast.success(`Added ${modelName}`);
            loadInitialData();
        } catch (err) {
            toast.error('Failed to add model');
        }
    };

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

    const tabs = [
        { id: 'functions' as AIConfigTab, label: 'AI Functions', icon: Brain },
        { id: 'providers' as AIConfigTab, label: 'LLM Providers', icon: Cpu },
        { id: 'routing' as AIConfigTab, label: 'Model Routing', icon: Settings },
        { id: 'usage' as AIConfigTab, label: 'Usage & Costs', icon: BarChart3 },
        { id: 'health' as AIConfigTab, label: 'System Health', icon: Activity },
    ];

    return (
        <div className="h-full flex flex-col bg-navy-950 overflow-hidden relative">
            <InfoButton cardId="superadmin-ai-config" position="top-right" />
            {/* Header */}
            <div className="shrink-0 px-8 py-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Brain className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">AI Configuration</h1>
                            <p className="text-sm text-slate-400">Manage AI behavior, providers, and system health</p>
                        </div>
                    </div>
                    <InfoButton cardId="superadmin-ai-config" position="header-inline" size="md" showLabel label="Help" />
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-8 py-3 border-b border-white/5 flex gap-2 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {/* AI Functions Tab */}
                {activeTab === 'functions' && (
                    <div className="h-full flex">
                        {/* Capabilities List */}
                        <div className="w-80 border-r border-white/5 overflow-y-auto p-4">
                            <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 px-2">
                                AI Functions
                            </h3>
                            <div className="space-y-2">
                                {AI_CAPABILITIES.map(cap => {
                                    const Icon = cap.icon;
                                    const hasCustomPrompt = !!prompts[cap.promptKey]?.content;
                                    return (
                                        <button
                                            key={cap.id}
                                            onClick={() => selectCapability(cap.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${selectedCapability === cap.id
                                                ? 'bg-white/10 border border-blue-500/50'
                                                : 'hover:bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg bg-gradient-to-br ${cap.color}`}>
                                                <Icon size={18} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-white text-sm truncate">
                                                    {cap.name}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate">
                                                    {cap.description}
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                {hasCustomPrompt ? (
                                                    <CheckCircle size={14} className="text-emerald-400" />
                                                ) : (
                                                    <AlertTriangle size={14} className="text-amber-400" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Prompt Editor */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {selectedCapability ? (
                                <>
                                    <div className="shrink-0 p-4 border-b border-white/5 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-white">
                                                Instructions for: {AI_CAPABILITIES.find(c => c.id === selectedCapability)?.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Prompt key: <code className="text-blue-400">{AI_CAPABILITIES.find(c => c.id === selectedCapability)?.promptKey}</code>
                                            </p>
                                        </div>
                                        <button
                                            onClick={savePrompt}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                            Save
                                        </button>
                                    </div>
                                    <div className="flex-1 p-4 overflow-hidden">
                                        <textarea
                                            value={editingPrompt}
                                            onChange={e => setEditingPrompt(e.target.value)}
                                            placeholder="Enter AI instructions..."
                                            className="w-full h-full bg-navy-900 border border-white/10 rounded-xl p-4 text-white text-sm font-mono resize-none focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div className="shrink-0 p-4 border-t border-white/5 text-xs text-slate-500">
                                        💡 Tip: Use placeholders like <code className="text-blue-400">{"{{project_name}}"}</code>, <code className="text-blue-400">{"{{user_role}}"}</code>, <code className="text-blue-400">{"{{screen_context}}"}</code>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-500">
                                    <div className="text-center">
                                        <Brain size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>Select an AI function to edit its instructions</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Providers Tab */}
                {activeTab === 'providers' && (
                    <div className="p-8 overflow-y-auto h-full space-y-6">
                        {/* Ollama Local Models */}
                        <div className="bg-gradient-to-br from-purple-900/30 to-navy-900 border border-purple-500/20 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-purple-500/20">
                                    <Server size={20} className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Ollama Local Models</h3>
                                    <p className="text-sm text-slate-400">Connect to local Ollama for privacy-focused AI</p>
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
                                                        ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
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
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white">LLM Providers</h2>
                                <p className="text-slate-400 text-sm mt-1">Configure AI models available to tenants</p>
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
                                    onClick={() => {
                                        setEditingProviderId(null);
                                        resetProviderForm();
                                        setShowProviderModal(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                    <Plus size={16} /> Add Provider
                                </button>
                            </div>
                        </div>

                        <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-navy-950 text-slate-400 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Name</th>
                                        <th className="px-6 py-4 font-medium">Provider</th>
                                        <th className="px-6 py-4 font-medium">Model ID</th>
                                        <th className="px-6 py-4 font-medium">Visibility</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr>
                                    ) : providers.filter(p => showInactive || p.is_active).length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-500">No providers configured</td></tr>
                                    ) : (
                                        providers.filter(p => showInactive || p.is_active).map(p => (
                                            <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 font-medium text-white">{p.name}</td>
                                                <td className="px-6 py-4 text-slate-300 capitalize">{p.provider}</td>
                                                <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.model_id}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs ${p.visibility === 'public' ? 'bg-emerald-500/20 text-emerald-400' : p.visibility === 'beta' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'}`}>
                                                        {p.visibility}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {p.is_active ? (
                                                        <span className="text-emerald-400 flex items-center gap-1"><Check size={14} /> Active</span>
                                                    ) : (
                                                        <span className="text-slate-500">Inactive</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleTestConnection(p)}
                                                            title="Test Connection"
                                                            disabled={testingConnection}
                                                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                                                        >
                                                            <Wifi size={16} />
                                                        </button>
                                                        <button onClick={() => handleEditProvider(p)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button onClick={() => handleDeleteProvider(p.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Routing Tab */}
                {activeTab === 'routing' && (
                    <div className="p-8 overflow-y-auto h-full">
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Model Routing per Tier</h3>
                                <p className="text-sm text-slate-400 mb-6">
                                    Define which LLM model to use for different complexity levels.
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { tier: 'BUDGET', label: 'Budget Tier', desc: 'Simple questions, fast responses', default: 'gpt-4o-mini' },
                                        { tier: 'STANDARD', label: 'Standard Tier', desc: 'Most tasks (chat, magic wand)', default: 'gpt-4o' },
                                        { tier: 'PREMIUM', label: 'Premium Tier', desc: 'Complex analysis, reports', default: 'gpt-4o' },
                                        { tier: 'REASONING', label: 'Reasoning Tier', desc: 'MAX Mode, deep thinking', default: 'gpt-4o' },
                                    ].map(item => (
                                        <div key={item.tier} className="flex items-center gap-4 p-4 bg-navy-950/50 rounded-lg border border-white/5">
                                            <div className="flex-1">
                                                <div className="font-medium text-white">{item.label}</div>
                                                <div className="text-xs text-slate-500">{item.desc}</div>
                                            </div>
                                            <select className="bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none">
                                                <option>{item.default}</option>
                                                {providers.filter(p => p.is_active).map(p => (
                                                    <option key={p.id} value={p.model_id}>{p.model_id}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Usage Tab */}
                {activeTab === 'usage' && (
                    <div className="p-8 overflow-y-auto h-full">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <StatCard
                                icon={Zap}
                                label="Tokens Today"
                                value={usageStats?.user?.tokens_used_today?.toLocaleString() || '0'}
                                color="text-yellow-400"
                            />
                            <StatCard
                                icon={DollarSign}
                                label="Cost (30 days)"
                                value={`$${(costStats?.totals?.costUsd || 0).toFixed(4)}`}
                                color="text-emerald-400"
                            />
                            <StatCard
                                icon={Activity}
                                label="Requests (30 days)"
                                value={costStats?.totals?.requests?.toLocaleString() || '0'}
                                color="text-blue-400"
                            />
                            <StatCard
                                icon={TrendingUp}
                                label="Cache Hit Rate"
                                value={`${usageStats?.cache?.hitRate || 0}%`}
                                color="text-purple-400"
                            />
                        </div>

                        {costStats?.byModel && costStats.byModel.length > 0 && (
                            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Costs per Model</h3>
                                <div className="space-y-3">
                                    {costStats.byModel.map((m: any) => (
                                        <div key={m.model} className="flex items-center gap-4 p-3 bg-navy-950/50 rounded-lg">
                                            <div className="flex-1">
                                                <div className="text-sm text-white">{m.model}</div>
                                                <div className="text-xs text-slate-500">{m.requests} requests</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-emerald-400">${(m.cost || 0).toFixed(4)}</div>
                                                <div className="text-xs text-slate-500">{(m.tokens || 0).toLocaleString()} tokens</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Health Tab */}
                {activeTab === 'health' && (
                    <div className="p-8 overflow-y-auto h-full">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {/* System Status */}
                            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">AI System Status</h3>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${healthStatus?.status === 'OK'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-amber-500/20 text-amber-400'
                                        }`}>
                                        {healthStatus?.status || 'Unknown'}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {healthStatus?.checks?.map((check: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                            <span className="text-sm text-slate-300">{check.name}</span>
                                            <span className={`text-sm ${check.status === 'OK' ? 'text-emerald-400' :
                                                check.status === 'MISSING' ? 'text-amber-400' : 'text-slate-400'
                                                }`}>
                                                {check.status || check.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Capabilities Health */}
                            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Test Capabilities</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'connection', icon: Zap, label: 'Connection' },
                                        { id: 'eyes', icon: Eye, label: 'AI Eyes (Visual)' },
                                        { id: 'memory', icon: Database, label: 'AI Memory (RAG)' },
                                        { id: 'hands', icon: Hand, label: 'AI Hands (Tools)' },
                                    ].map(cap => (
                                        <button
                                            key={cap.id}
                                            className="flex items-center gap-3 p-4 bg-navy-950/50 border border-white/5 rounded-lg hover:bg-navy-950 hover:border-white/10 transition-colors"
                                        >
                                            <cap.icon size={20} className="text-blue-400" />
                                            <span className="text-sm text-white">{cap.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Provider Modal */}
            {showProviderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">{editingProviderId ? 'Edit Provider' : 'Add Provider'}</h2>
                            <button onClick={() => setShowProviderModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleProviderSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                                    <input required value={providerForm.name} onChange={e => setProviderForm({ ...providerForm, name: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Provider Type</label>
                                    <select value={providerForm.provider} onChange={e => setProviderForm({ ...providerForm, provider: e.target.value as any })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white">
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
                                        <optgroup label="Chinese Providers">
                                            <option value="deepseek">DeepSeek</option>
                                            <option value="qwen">Alibaba Qwen</option>
                                            <option value="z_ai">Zhipu AI (GLM)</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">API Key</label>
                                <input type="password" value={providerForm.api_key} onChange={e => setProviderForm({ ...providerForm, api_key: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" placeholder="sk-..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Model ID</label>
                                    <input required value={providerForm.model_id} onChange={e => setProviderForm({ ...providerForm, model_id: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Endpoint (Optional)</label>
                                    <input value={providerForm.endpoint} onChange={e => setProviderForm({ ...providerForm, endpoint: e.target.value })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white" placeholder="https://api..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Visibility</label>
                                    <select value={providerForm.visibility} onChange={e => setProviderForm({ ...providerForm, visibility: e.target.value as any })} className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white">
                                        <option value="admin">Admin Only</option>
                                        <option value="beta">Beta Users</option>
                                        <option value="public">Public</option>
                                    </select>
                                </div>
                                <div className="flex items-center pt-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={providerForm.is_active} onChange={e => setProviderForm({ ...providerForm, is_active: e.target.checked })} className="w-4 h-4 rounded bg-navy-950 border-white/10" />
                                        <span className="text-sm text-slate-300">Active</span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowProviderModal(false)} className="px-4 py-2 bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 rounded">Cancel</button>
                                <button
                                    type="button"
                                    onClick={() => handleTestConnection(providerForm)}
                                    disabled={!providerForm.provider || !providerForm.api_key || testingConnection}
                                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 rounded flex items-center gap-2"
                                >
                                    <Wifi size={16} /> Test
                                </button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded">Save Provider</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper component
const StatCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({ icon: Icon, label, value, color }) => (
    <div className="bg-navy-900 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
            <Icon size={18} className={color} />
            <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
    </div>
);

export default AIConfigurationView;

