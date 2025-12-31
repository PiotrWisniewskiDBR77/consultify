import React, { useState, useEffect } from 'react';
import { User, LLMProvider, AIPreferences, UserAIProvider } from '../../types';
import { InfoButton } from '../shared/InfoButton';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    Bot, MessageSquare, Zap, Brain, Save, Check, FileText, ExternalLink, Shield,
    Server, Key, Plus, Trash2, Wifi, Cpu, Globe, Lock, Sparkles, AlertCircle, ChevronRight,
    Settings, LayoutGrid, Terminal, User as UserIcon, Activity, Fingerprint, Eye, MoreHorizontal
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
    autonomyLevel: 'human_loop'
};

type SettingsTab = 'org' | 'api' | 'local' | 'behavior' | 'governance';

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
                        <h2 className="text-xl font-bold text-white tracking-tight">AI Settings</h2>
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
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
                <NavTab id="org" label="LLM Providers" icon={<Shield size={16} />} active={activeTab === 'org'} onClick={() => setActiveTab('org')} />
                <NavTab id="api" label="API Keys" icon={<Key size={16} />} active={activeTab === 'api'} onClick={() => setActiveTab('api')} />
                <NavTab id="local" label="Local Inference" icon={<Terminal size={16} />} active={activeTab === 'local'} onClick={() => setActiveTab('local')} />
                <div className="w-px h-6 bg-white/10 mx-2" />
                <NavTab id="behavior" label="Persona & Context" icon={<UserIcon size={16} />} active={activeTab === 'behavior'} onClick={() => setActiveTab('behavior')} />
                <NavTab id="governance" label="Governance" icon={<Eye size={16} />} active={activeTab === 'governance'} onClick={() => setActiveTab('governance')} />
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">

                {/* 1. Organization Models - TABLE VIEW */}
                {activeTab === 'org' && (
                    <div className="animate-in fade-in duration-300">
                        <SectionHeader title="Organization Models" subtitle="Select approved models for your workspace." />

                        <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        <th className="px-6 py-4">Name & Description</th>
                                        <th className="px-6 py-4">Provider</th>
                                        <th className="px-6 py-4">Model ID</th>
                                        <th className="px-6 py-4">Verification</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {orgProviders.map(p => {
                                        const isSelected = selectedOrgModels.includes(p.id);
                                        return (
                                            <tr
                                                key={p.id}
                                                onClick={() => handleOrgModelToggle(p.id)}
                                                className={`cursor-pointer transition-colors hover:bg-white/5 ${isSelected ? 'bg-blue-500/5' : ''}`}
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
                                                <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                    {p.model_id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-xs text-green-400">
                                                        <Shield size={12} />
                                                        Verified
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all ${isSelected
                                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-white/5 text-slate-500 border border-white/10'
                                                        }`}>
                                                        {isSelected ? 'Active' : 'Disabled'}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {orgProviders.length === 0 && (
                                <div className="p-12 text-center text-slate-500">No organization models available.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. API Keys (BYOK) - TABLE VIEW */}
                {activeTab === 'api' && (
                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-end mb-6">
                            <SectionHeader title="Bring Your Own Keys (BYOK)" subtitle="Securely store personal API keys in local storage." />
                            {!showAddProvider && (
                                <button onClick={() => setShowAddProvider(true)} className="text-xs uppercase tracking-wider font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded hover:bg-blue-500/10 transition-colors flex items-center gap-2">
                                    <Plus size={14} /> Add Key
                                </button>
                            )}
                        </div>

                        {/* Premium Add Form */}
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

                {/* 4. Persona & Context (SAME AS BEFORE) */}
                {activeTab === 'behavior' && (
                    <div className="animate-in fade-in duration-300 max-w-4xl">
                        <SectionHeader title="User Persona" subtitle="Define your role to tailor AI responses." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                {[
                                    { id: 'executive', label: 'Executive / Strategy', desc: 'High-level summaries, strategic insights, no jargon.' },
                                    { id: 'manager', label: 'Project Manager', desc: 'Action-oriented, timeline-focused, risk-aware.' },
                                    { id: 'analyst', label: 'Business Analyst', desc: 'Data-driven, detailed, structured output.' },
                                    { id: 'developer', label: 'Developer / Technical', desc: 'Code-centric, technical depth, system architecture.' }
                                ].map(role => (
                                    <button
                                        key={role.id}
                                        onClick={() => setPreferences(p => ({ ...p, userRole: role.id }))}
                                        className={`w-full text-left p-4 rounded-lg border transition-all ${preferences.userRole === role.id
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

                            <div>
                                <SectionHeader title="Interaction Style" subtitle="How should the AI communicate?" />
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Tone</label>
                                        <div className="flex gap-2">
                                            {['Professional', 'Casual', 'Technical'].map(tone => (
                                                <button
                                                    key={tone}
                                                    onClick={() => setPreferences(p => ({ ...p, writingTone: tone.toLowerCase() as any }))}
                                                    className={`flex-1 py-2 text-xs font-medium rounded border ${preferences.writingTone === tone.toLowerCase()
                                                        ? 'bg-white text-black border-white'
                                                        : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                                                        }`}
                                                >
                                                    {tone}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Verbosity</label>
                                        <div className="flex gap-2">
                                            {['Concise', 'Balanced', 'Detailed'].map(style => (
                                                <button
                                                    key={style}
                                                    onClick={() => setPreferences(p => ({ ...p, responseStyle: style.toLowerCase() as any }))}
                                                    className={`flex-1 py-2 text-xs font-medium rounded border ${preferences.responseStyle === style.toLowerCase()
                                                        ? 'bg-white text-black border-white'
                                                        : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                                                        }`}
                                                >
                                                    {style}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Governance (SAME AS BEFORE) */}
                {activeTab === 'governance' && (
                    <div className="animate-in fade-in duration-300 max-w-4xl">
                        <SectionHeader title="Human-in-the-Loop Governance" subtitle="Set autonomy levels and supervision rules." />

                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-8 flex items-start gap-3">
                            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-sm font-semibold text-red-200">Critical Safety Protocol</h4>
                                <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                                    Consultify AI operates under strict Human-in-the-Loop (HITL) protocols.
                                    All strategic decisions, budget approvals, and external communications must be verified by a human operator.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {[
                                { id: 'strict', icon: <Lock size={18} />, label: 'Strict Supervision', desc: 'AI requires approval for every action. No autonomous changes.' },
                                { id: 'human_loop', icon: <UserIcon size={18} />, label: 'Human-in-the-Loop', desc: 'AI drafts content; Human reviews and approves execution.' },
                                { id: 'autonomous', icon: <Zap size={18} />, label: 'Semi-Autonomous', desc: 'AI handles low-risk tasks (e.g. scheduling) automatically.' }
                            ].map(level => (
                                <button
                                    key={level.id}
                                    onClick={() => setPreferences(p => ({ ...p, autonomyLevel: level.id }))}
                                    className={`p-6 rounded-xl border text-left transition-all ${preferences.autonomyLevel === level.id
                                        ? 'bg-white/10 border-white shadow-xl'
                                        : 'bg-black/20 border-white/5 opacity-60 hover:opacity-100 hover:border-white/20'
                                        }`}
                                >
                                    <div className={`mb-4 ${preferences.autonomyLevel === level.id ? 'text-white' : 'text-slate-500'}`}>{level.icon}</div>
                                    <div className="font-bold text-sm text-white mb-2">{level.label}</div>
                                    <p className="text-xs text-slate-400 leading-relaxed">{level.desc}</p>
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-white/5 pt-8">
                            <SectionHeader title="Support & Escalation Plan" subtitle="Define how the AI should handle uncertainty." />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Escalation Threshold</label>
                                    <select
                                        value={preferences.supportLevel}
                                        onChange={e => setPreferences(p => ({ ...p, supportLevel: e.target.value }))}
                                        className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                                    >
                                        <option value="high">High - Ask whenever confidence &lt; 90%</option>
                                        <option value="standard">Standard - Ask whenever confidence &lt; 70%</option>
                                        <option value="low">Low - Attempt resolutions before asking</option>
                                    </select>
                                </div>
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
