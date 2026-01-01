import React, { useState, useEffect } from 'react';
import { User, LLMProvider, AIPreferences, UserAIProvider } from '../../types';
import { InfoButton } from '../shared/InfoButton';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    Bot, MessageSquare, Zap, Brain, Save, Check, FileText, ExternalLink, Shield,
    Server, Key, Plus, Trash2, Wifi, Cpu, Globe, Lock, Sparkles, AlertCircle, ChevronRight,
    Settings, LayoutGrid, Terminal, User as UserIcon, Activity, Fingerprint, Eye, MoreHorizontal,
    Sliders, Gauge, HardDrive, Network
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface AISettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

const defaultPreferences: AIPreferences = {
    responseStyle: 'balanced',
    writingTone: 'professional',
    autoSuggestions: true,
    contextRetention: 'session',
    preferredLanguage: 'auto',
    codeExplanations: true,
    showSources: true,
    userRole: 'analyst',
    supportLevel: 'standard',
    autonomyLevel: 'human_loop',

    // New Defaults
    modelTemperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    systemInstructions: '',
    enableWebSearch: true,
    enablePiiRedaction: false,
    dataRetentionPolicy: 'standard',
    contextWindowStrategy: 'auto'
};

type SettingsTab = 'org' | 'api' | 'local' | 'behavior' | 'privacy';

export const AISettings: React.FC<AISettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SettingsTab>('org');

    const [preferences, setPreferences] = useState<AIPreferences & { userRole: string, supportLevel: string, autonomyLevel: string }>(defaultPreferences as any);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Model Management State
    const [orgProviders, setOrgProviders] = useState<LLMProvider[]>([]);
    const [localProviders, setLocalProviders] = useState<UserAIProvider[]>([]);
    const [selectedOrgModels, setSelectedOrgModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);

    // New Provider Form
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [newProvider, setNewProvider] = useState<Partial<UserAIProvider>>({
        provider: 'openai',
        isEnabled: true,
        isLocal: false
    });

    useEffect(() => {
        setShowAddProvider(false);
        setNewProvider({ provider: 'openai', isEnabled: true, isLocal: false });
    }, [activeTab]);

    // Health Check State
    const [providerHealth, setProviderHealth] = useState<any>(null);

    useEffect(() => {
        const initData = async () => {
            setLoadingModels(true);
            try {
                // 1. Load Preferences
                const prefRes = await Api.get('/settings/preferences');
                if (prefRes.data?.ai) {
                    setPreferences(prev => ({ ...prev, ...prefRes.data.ai }));
                }

                // 2. Load Organization Providers
                const providers = await Api.getLLMProviders(true); // adminContext=true to get is_enabled_for_org
                // Filter only those active globally AND enabled for org
                const availableFn = providers.filter(p => p.is_active && p.is_enabled_for_org !== false);
                setOrgProviders(availableFn);

                // 3. Load User selection (from user.aiConfig.visibleModelIds)
                if (currentUser.aiConfig?.visibleModelIds) {
                    setSelectedOrgModels(currentUser.aiConfig.visibleModelIds);
                } else {
                    setSelectedOrgModels(availableFn.map(p => p.id));
                }

                // 4. Load Local/Personal Providers
                const stored = localStorage.getItem('user_ai_providers');
                if (stored) {
                    setLocalProviders(JSON.parse(stored));
                }

                // 5. Fetch Real-time Health
                try {
                    const health = await Api.checkLLMProvidersHealth();
                    setProviderHealth(health);
                } catch (e) {
                    console.error('Failed to fetch provider health', e);
                }

            } catch (e) {
                console.error('Failed to load AI settings', e);
                toast.error('Failed to load settings');
            } finally {
                setLoadingModels(false);
            }
        };
        initData();
    }, [currentUser.aiConfig]);

    const savePreferences = async () => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/ai', preferences);

            const updatedAiConfig = {
                ...currentUser.aiConfig,
                visibleModelIds: selectedOrgModels
            };

            onUpdateUser({ aiConfig: updatedAiConfig as any });
            localStorage.setItem('user_ai_providers', JSON.stringify(localProviders));

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            toast.success('Configuration Saved');
        } catch (e) {
            toast.error('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleOrgModelToggle = (modelId: string) => {
        setSelectedOrgModels(prev =>
            prev.includes(modelId)
                ? prev.filter(id => id !== modelId)
                : [...prev, modelId]
        );
        setSaved(false);
    };

    const handleAddProvider = () => {
        if (!newProvider.name || (!newProvider.apiKey && !newProvider.endpoint)) {
            toast.error('Please fill in required fields');
            return;
        }

        const isLocal = newProvider.provider === 'ollama';

        const provider: UserAIProvider = {
            id: crypto.randomUUID(),
            name: newProvider.name,
            provider: newProvider.provider as any,
            apiKey: newProvider.apiKey,
            endpoint: isLocal ? (newProvider.endpoint || 'http://localhost:11434') : undefined,
            isEnabled: true,
            isLocal: isLocal
        };

        const updated = [...localProviders, provider];
        setLocalProviders(updated);
        localStorage.setItem('user_ai_providers', JSON.stringify(updated));

        setShowAddProvider(false);
        setNewProvider({ provider: 'openai', isEnabled: true, isLocal: false });
        toast.success(isLocal ? 'Local provider added' : 'API key added');
    };

    const removeLocalProvider = (id: string) => {
        const updated = localProviders.filter(p => p.id !== id);
        setLocalProviders(updated);
        localStorage.setItem('user_ai_providers', JSON.stringify(updated));
        toast.success('Provider removed');
    };

    // Filter providers for current view
    const apiProviders = localProviders.filter(p => !p.isLocal);
    const localHostProviders = localProviders.filter(p => p.isLocal);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Minimalist Header */}
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                        <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">LLM Management</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mt-0.5">Enterprise Control Plane</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={savePreferences}
                        disabled={saving || saved || loadingModels}
                        className={`px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${saved
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-white text-black hover:bg-slate-200 border border-transparent shadow-lg shadow-white/5 hover:shadow-white/10'
                            }`}
                    >
                        {saved ? (
                            <>
                                <Check className="w-4 h-4" />
                                {t('common.saved', 'Synced')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {saving ? 'Syncing...' : 'Save Configuration'}
                            </>
                        )}
                    </button>
                    <InfoButton cardId="settings-ai" position="top-right" />
                </div>
            </div>

            {/* Navigation Tabs - High Tech Button Style */}
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
                <NavTab id="org" label="Model Registry" icon={<Shield size={16} />} active={activeTab === 'org'} onClick={() => setActiveTab('org')} />
                <NavTab id="api" label="BYOK Keys" icon={<Key size={16} />} active={activeTab === 'api'} onClick={() => setActiveTab('api')} />
                <NavTab id="local" label="Local Inference" icon={<Terminal size={16} />} active={activeTab === 'local'} onClick={() => setActiveTab('local')} />
                <div className="w-px h-6 bg-white/10 mx-2" />
                <NavTab id="behavior" label="Behavior & Context" icon={<Sliders size={16} />} active={activeTab === 'behavior'} onClick={() => setActiveTab('behavior')} />
                <NavTab id="privacy" label="Privacy & Controls" icon={<Lock size={16} />} active={activeTab === 'privacy'} onClick={() => setActiveTab('privacy')} />
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">

                {/* 1. Organization Models - TABLE VIEW */}
                {/* 1. Organization Models (Model Registry) */}
                {activeTab === 'org' && (
                    <div className="animate-in fade-in duration-300">
                        <SectionHeader title="Model Registry" subtitle="Manage available models and their visibility to users." />

                        <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        <th className="px-6 py-4">Name & Description</th>
                                        <th className="px-6 py-4">Provider</th>
                                        <th className="px-6 py-4">Model ID</th>
                                        <th className="px-6 py-4">System Status</th>
                                        <th className="px-6 py-4 text-right">User Access</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {orgProviders.map(p => {
                                        const isSelected = selectedOrgModels.includes(p.id);
                                        const health = providerHealth?.providers?.[p.provider];
                                        const isOnline = health?.available ?? true; // Default to true if check pending
                                        const latency = health?.latency;

                                        return (
                                            <tr
                                                key={p.id}
                                                className="hover:bg-white/5 transition-colors"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{p.name}</div>
                                                    <div className="text-xs text-slate-500">{p.description || 'No description provided'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-white/10 bg-white/5 text-xs text-slate-300 font-mono">
                                                        {p.provider}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                                    {p.id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {/* Health Status Indicator */}
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                                        <div className="flex flex-col">
                                                            <span className={`text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {isOnline ? 'Operational' : 'Offline'}
                                                            </span>
                                                            {isOnline && latency && (
                                                                <span className="text-[10px] text-slate-500">{latency}ms latency</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end">
                                                        <Toggle
                                                            enabled={isSelected}
                                                            onChange={() => handleOrgModelToggle(p.id)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. BYOK Keys (API Tab) */}
                {activeTab === 'api' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-end mb-6">
                            <SectionHeader title="Bring Your Own Keys" subtitle="Connect external providers securely." />
                            <button onClick={() => {
                                setNewProvider({ provider: 'openai', isEnabled: true, isLocal: false });
                                setShowAddProvider(true);
                            }} className="text-xs uppercase tracking-wider font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded hover:bg-blue-500/10 transition-colors flex items-center gap-2">
                                <Plus size={14} /> Add Key
                            </button>
                        </div>

                        {/* Add Form */}
                        {showAddProvider && (
                            <div className="mb-8 p-6 bg-gradient-to-br from-navy-900 to-black border border-white/10 rounded-xl shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                    <Key size={16} className="text-blue-500" />
                                    Add New API Key
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Provider</label>
                                        <div className="relative">
                                            <select
                                                value={newProvider.provider}
                                                onChange={e => setNewProvider({ ...newProvider, provider: e.target.value as any })}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white appearance-none focus:border-blue-500/50 outline-none transition-all"
                                            >
                                                <option value="openai">OpenAI</option>
                                                <option value="anthropic">Anthropic</option>
                                                <option value="google">Google Gemini</option>
                                                <option value="deepseek">DeepSeek</option>
                                            </select>
                                            <ChevronRight className="absolute right-4 top-3.5 text-slate-500 rotate-90 pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Friendly Name</label>
                                        <input
                                            placeholder="e.g. My Personal GPT-4 Key"
                                            value={newProvider.name}
                                            onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">API Secret Key</label>
                                        <div className="relative">
                                            <Key className="absolute left-4 top-3.5 text-slate-600" size={16} />
                                            <input
                                                type="password"
                                                placeholder="sk-..."
                                                value={newProvider.apiKey}
                                                onChange={e => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:border-blue-500/50 outline-none font-mono transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                                            <Lock size={10} />
                                            Stored locally in your browser. Never sent to our servers.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                                    <button onClick={() => setShowAddProvider(false)} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                                    <button onClick={handleAddProvider} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2">
                                        <Save size={16} /> Save Key
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        <th className="px-6 py-4">Friendly Name</th>
                                        <th className="px-6 py-4">Provider</th>
                                        <th className="px-6 py-4">API Key Hash</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {apiProviders.map(p => (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white flex items-center gap-3">
                                                    <div className="p-2 bg-white/5 rounded border border-white/5 group-hover:border-white/10 transition-colors">
                                                        <Globe size={16} className="text-blue-400" />
                                                    </div>
                                                    {p.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-400 capitalize bg-white/5 px-2 py-1 rounded border border-white/5">{p.provider}</span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                                •••••••••••••••••{p.apiKey?.slice(-4)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => removeLocalProvider(p.id)} className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors" title="Remove Key">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {apiProviders.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                <Key className="mx-auto mb-3 opacity-20" size={32} />
                                                No personal API keys added yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. Local Models - TABLE VIEW */}
                {activeTab === 'local' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-end mb-6">
                            <SectionHeader title="Local Inference Engine" subtitle="Connect to high-performance local models via Ollama." />
                            {!showAddProvider && (
                                <button onClick={() => {
                                    setNewProvider({ provider: 'ollama', isEnabled: true, isLocal: true });
                                    setShowAddProvider(true);
                                }} className="text-xs uppercase tracking-wider font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded hover:bg-emerald-500/10 transition-colors flex items-center gap-2">
                                    <Plus size={14} /> Connect Local
                                </button>
                            )}
                        </div>

                        {/* Premium Local Connect Form */}
                        {showAddProvider && (
                            <div className="mb-8 p-6 bg-gradient-to-br from-navy-900 to-black border border-white/10 rounded-xl shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                    <Terminal size={16} className="text-emerald-500" />
                                    Connect Local Instance
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Connection Name</label>
                                        <input
                                            placeholder="e.g. My MacBook Ollama"
                                            value={newProvider.name}
                                            onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-emerald-500/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Endpoint URL</label>
                                        <div className="relative">
                                            <Wifi className="absolute left-4 top-3.5 text-slate-600" size={16} />
                                            <input
                                                placeholder="http://localhost:11434"
                                                value={newProvider.endpoint}
                                                onChange={e => setNewProvider({ ...newProvider, endpoint: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-slate-600 focus:border-emerald-500/50 outline-none font-mono transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                                    <button onClick={() => setShowAddProvider(false)} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                                    <button onClick={handleAddProvider} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
                                        <Zap size={16} /> Connect
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        <th className="px-6 py-4">Instance Name</th>
                                        <th className="px-6 py-4">Endpoint Type</th>
                                        <th className="px-6 py-4">URL</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {localHostProviders.map(p => (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                                                        <Terminal size={16} className="text-emerald-400" />
                                                    </div>
                                                    <div>
                                                        <div>{p.name}</div>
                                                        <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Active
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-400">Ollama / OpenAI Compatible</span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                                                {p.endpoint}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => removeLocalProvider(p.id)} className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors" title="Disconnect">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {localHostProviders.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                <Server className="mx-auto mb-3 opacity-20" size={32} />
                                                No local inference engines connected.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. Behavior & Context Settings */}
                {activeTab === 'behavior' && (
                    <div className="animate-in fade-in duration-300 max-w-4xl">
                        <SectionHeader title="Model Behavior" subtitle="Configure granular generation parameters and persona." />

                        {/* System Instructions */}
                        <div className="mb-8">
                            <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                <span className="flex items-center gap-2">
                                    <Terminal size={14} />
                                    Global System Instructions
                                </span>
                                <span className="text-slate-600 font-normal normal-case">Applied to all chat sessions</span>
                            </label>
                            <textarea
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm font-mono text-slate-300 focus:border-white/20 focus:ring-0 transition-colors h-32 resize-y"
                                placeholder="e.g. You are a senior solutions architect. Always prioritize security and scalability in your responses..."
                                value={preferences.systemInstructions || ''}
                                onChange={(e) => setPreferences({ ...preferences, systemInstructions: e.target.value })}
                            />
                        </div>

                        {/* Sliders Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 p-6 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-medium text-white flex items-center gap-2">
                                        <Gauge size={16} className="text-blue-400" />
                                        Temperature
                                    </label>
                                    <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded text-blue-400">{preferences.modelTemperature ?? 0.7}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="2" step="0.1"
                                    value={preferences.modelTemperature ?? 0.7}
                                    onChange={(e) => setPreferences({ ...preferences, modelTemperature: parseFloat(e.target.value) })}
                                    className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-wider">
                                    <span>Precise</span>
                                    <span>Creative</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-medium text-white flex items-center gap-2">
                                        <HardDrive size={16} className="text-purple-400" />
                                        Max Output Tokens
                                    </label>
                                    <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded text-purple-400">{preferences.maxTokens ?? 4096}</span>
                                </div>
                                <input
                                    type="number"
                                    value={preferences.maxTokens ?? 4096}
                                    onChange={(e) => setPreferences({ ...preferences, maxTokens: parseInt(e.target.value) })}
                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500/50 outline-none transition-all font-mono"
                                />
                                <p className="text-[10px] text-slate-500 mt-2">Maximum length of generated response.</p>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-medium text-white flex items-center gap-2">
                                        <Sparkles size={16} className="text-amber-400" />
                                        Top P (Nucleus)
                                    </label>
                                    <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded text-amber-400">{preferences.topP ?? 1.0}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="1" step="0.05"
                                    value={preferences.topP ?? 1.0}
                                    onChange={(e) => setPreferences({ ...preferences, topP: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-medium text-white flex items-center gap-2">
                                        <Activity size={16} className="text-emerald-400" />
                                        Context Window
                                    </label>
                                </div>
                                <select
                                    value={preferences.contextWindowStrategy || 'auto'}
                                    onChange={(e) => setPreferences({ ...preferences, contextWindowStrategy: e.target.value as any })}
                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                                >
                                    <option value="auto">Auto (Recommended)</option>
                                    <option value="limit_8k">Limit to 8k (Cost Saving)</option>
                                    <option value="limit_16k">Limit to 16k</option>
                                    <option value="full">Full Context</option>
                                </select>
                            </div>
                        </div>

                        <SectionHeader title="Persona Definition" subtitle="Define your role to tailor AI responses." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { id: 'executive', label: 'Executive / Strategy', desc: 'Strategic insights, no jargon.' },
                                { id: 'manager', label: 'Project Manager', desc: 'Timeline-focused, risk-aware.' },
                                { id: 'analyst', label: 'Business Analyst', desc: 'Data-driven, detailed output.' },
                                { id: 'developer', label: 'Developer / Technical', desc: 'Code-centric, architecture focus.' }
                            ].map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setPreferences(p => ({ ...p, userRole: role.id }))}
                                    className={`text-left p-4 rounded-lg border transition-all ${preferences.userRole === role.id
                                        ? 'bg-blue-500/10 border-blue-500/50'
                                        : 'bg-white/5 border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <div className={`font-semibold text-sm mb-1 ${preferences.userRole === role.id ? 'text-blue-400' : 'text-white'}`}>
                                        {role.label}
                                    </div>
                                    <div className="text-xs text-slate-500">{role.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Privacy & Controls */}
                {activeTab === 'privacy' && (
                    <div className="animate-in fade-in duration-300 max-w-4xl">
                        <SectionHeader title="Data Privacy & Governance" subtitle="Manage how your data is handled and retained." />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* PII Redaction */}
                            <div className="p-6 rounded-xl border border-white/5 bg-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                                            <Fingerprint size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">PII Redaction</h3>
                                            <p className="text-xs text-slate-500">Auto-remove sensitive data</p>
                                        </div>
                                    </div>
                                    <Toggle
                                        enabled={preferences.enablePiiRedaction || false}
                                        onChange={() => setPreferences(p => ({ ...p, enablePiiRedaction: !p.enablePiiRedaction }))}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-4">
                                    Automatically detects and redacts emails, phone numbers, and credit card patterns before sending to the model.
                                </p>
                            </div>

                            {/* Web Search */}
                            <div className="p-6 rounded-xl border border-white/5 bg-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                            <Globe size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">Web Connectivity</h3>
                                            <p className="text-xs text-slate-500">Allow external searches</p>
                                        </div>
                                    </div>
                                    <Toggle
                                        enabled={preferences.enableWebSearch || false}
                                        onChange={() => setPreferences(p => ({ ...p, enableWebSearch: !p.enableWebSearch }))}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-4">
                                    Enables the model to search the web for real-time information. May increase latency.
                                </p>
                            </div>
                        </div>

                        {/* Retention Policy */}
                        <div className="p-6 rounded-xl border border-white/5 bg-white/5">
                            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
                                <Activity size={16} className="text-emerald-400" />
                                Data Retention Policy
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { id: 'none', label: 'Ephemeral', desc: 'No data saved', icon: <Trash2 size={16} /> },
                                    { id: '30days', label: '30 Days', desc: 'Standard rotation', icon: <Activity size={16} /> },
                                    { id: 'standard', label: 'Indefinite', desc: 'Full history', icon: <HardDrive size={16} /> }
                                ].map((policy) => (
                                    <button
                                        key={policy.id}
                                        onClick={() => setPreferences(p => ({ ...p, dataRetentionPolicy: policy.id as any }))}
                                        className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all gap-3 ${preferences.dataRetentionPolicy === policy.id
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                            : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                                            }`}
                                    >
                                        {policy.icon}
                                        <div className="text-center">
                                            <div className="font-semibold text-xs">{policy.label}</div>
                                            <div className="text-[10px] opacity-70">{policy.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Minimal Footer */}
            <div className="mt-12 border-t border-white/5 pt-6 flex justify-between items-center text-[10px] text-slate-600 uppercase tracking-widest">
                <span>AI Governance v2.4.0</span>
                <Link to="/legal/ai-policy" className="hover:text-slate-400 transition-colors">Safety Policy &rarr;</Link>
            </div>
        </div>
    );
};

// UI Components
const NavTab = ({ id, label, icon, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all font-medium text-xs whitespace-nowrap ${active
            ? 'bg-white text-black border-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)]'
            : 'text-slate-500 border-transparent hover:text-white hover:bg-white/5'
            }`}
    >
        {icon}
        {label}
    </button>
);

const SectionHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="mb-6">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
);

const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black ${enabled ? 'bg-blue-600' : 'bg-slate-700'
            }`}
    >
        <span
            className={`${enabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
        />
    </button>
);
