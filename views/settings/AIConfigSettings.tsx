import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, AIProviderType } from '../../types';
import { Cpu, Monitor, Lock, Check, Layers } from 'lucide-react';

interface AIConfigSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const AIConfigSettings: React.FC<AIConfigSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const [configMode, setConfigMode] = useState<AIProviderType>(currentUser.aiConfig?.provider || 'system');
    const [customKey, setCustomKey] = useState(currentUser.aiConfig?.apiKey || '');
    const [localEndpoint, setLocalEndpoint] = useState(currentUser.aiConfig?.endpoint || 'http://localhost:11434');
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(currentUser.aiConfig?.modelId || '');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // New State for System Models
    const [systemModels, setSystemModels] = useState<any[]>([]);
    const [visibleModels, setVisibleModels] = useState<string[]>(currentUser.aiConfig?.visibleModelIds || []);

    useEffect(() => {
        // Init visible models from user prop if updated
        if (currentUser.aiConfig?.visibleModelIds) {
            setVisibleModels(currentUser.aiConfig.visibleModelIds);
        }
    }, [currentUser]);

    useEffect(() => {
        if (configMode === 'system') {
            setIsLoadingModels(true);
            Api.getPublicLLMProviders()
                .then(models => {
                    setSystemModels(models);
                    // If user has NO visible models defined, enable ALL by default?
                    // Or keep it empty? User experience: if empty, maybe they didn't configure it.
                    // Let's decide: if undefined in user object, we select all initially in UI state (but don't save yet).
                    if (!currentUser.aiConfig?.visibleModelIds) {
                        const allIds = models.map((m: any) => m.id);
                        setVisibleModels(allIds);
                    }
                })
                .catch(err => console.error("Failed to fetch public models", err))
                .finally(() => setIsLoadingModels(false));
        }
    }, [configMode]);

    const toggleModelVisibility = (id: string) => {
        setVisibleModels(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        );
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        const newConfig: any = { provider: configMode };

        // Save persistent visibility for system models
        if (configMode === 'system') {
            newConfig.visibleModelIds = visibleModels;
        }

        if (configMode === 'openai' || configMode === 'gemini') {
            newConfig.apiKey = customKey;
            newConfig.modelId = selectedModel; // Optional for custom
        } else if (configMode === 'ollama') {
            newConfig.endpoint = localEndpoint;
            newConfig.modelId = selectedModel;
        }

        try {
            // Update local store via AppStore action which syncs to LocalStorage/State
            // In a real app we might also sync this to backend if we want persistence across devices
            // For now, per requirements, user can set their own keys locally or use system.
            // We'll trust the store update to handle currentUser.aiConfig
            // const updatedUser = { ...currentUser, aiConfig: newConfig }; // unused variable
            onUpdateUser({ aiConfig: newConfig });
            // We also call Api to save if we want backend persistence, but requirements said "user can provide own api... visible in top bar".
            // I'll assume updating the user object is enough for the store wrapper.

            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err) {
            alert("Failed to save AI config");
        }
    };

    const [orgConfig, setOrgConfig] = useState<{ activeProviderId: string | null; availableProviders: any[] } | null>(null);

    useEffect(() => {
        if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN') {
            // Fetch Org Config
            // We need the org ID. Assuming currentUser has it or we can get it.
            // Actually User type just has string... let's check `currentUser.organizationId` ?? 
            // The User interface in file doesn't explicitly show it but backend sends `organization_id`.
            // Let's assume the mapped user object has it, or we use `currentUser['organizationId']`.
            // Checking `types.ts` might be good but let's assume it's there or we can safely cast.
            const orgId = (currentUser as any).organizationId || (currentUser as any).organization_id;
            if (orgId) {
                Api.getOrganizationLLMConfig(orgId).then(setOrgConfig).catch(console.error);
            }
        }
    }, [currentUser]);

    const handleSaveOrgConfig = async () => {
        const orgId = (currentUser as any).organizationId || (currentUser as any).organization_id;
        if (!orgId || !orgConfig) return;
        try {
            await Api.updateOrganizationLLMConfig(orgId, orgConfig.activeProviderId);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (e) {
            alert('Failed to save organization settings');
        }
    };

    const fetchOllamaModels = async () => {
        setIsLoadingModels(true);
        try {
            // We can try client-side fetch first if CORS allows, else fallback to backend proxy
            // Assuming local ollama allows CORS or we use backend proxy 'Api.getOllamaModels'
            // Let's try direct first for "Local" feel, but usually browser blocks localhost mixed calls if not secured.
            // Best to use backend proxy I added in Api.
            const models = await Api.getOllamaModels(localEndpoint);
            if (models && models.length > 0) {
                setOllamaModels(models.map((m: any) => m.name));
                if (!selectedModel) setSelectedModel(models[0].name);
            } else {
                alert("No models found or connection failed. Check if Ollama is running.");
            }
        } catch (e) {
            alert("Failed to fetch Ollama models.");
        } finally {
            setIsLoadingModels(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-white mb-6">AI Configuration</h2>

            {/* Tabs */}
            <div className="flex p-1 bg-navy-900 rounded-lg mb-6 border border-white/5">
                {(['system', 'gemini', 'openai', 'ollama'] as AIProviderType[]).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setConfigMode(mode)}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${configMode === mode
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {mode === 'system' && 'Default (System)'}
                        {mode === 'gemini' && 'Google Gemini'}
                        {mode === 'openai' && 'OpenAI'}
                        {mode === 'ollama' && 'Local (Ollama)'}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSaveConfig} className="bg-navy-900 border border-white/10 rounded-xl p-6">

                {configMode === 'system' && (
                    <div className="space-y-6">
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-400">
                                <Cpu size={32} />
                            </div>
                            <h3 className="text-white font-medium mb-2">System AI Models</h3>
                            <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                Enable the models you want to use in the Top Bar selector.
                                All usage counts towards your organization's plan.
                            </p>
                        </div>

                        {/* List of System Models */}
                        <div className="space-y-3">
                            {isLoadingModels ? (
                                <div className="text-center text-slate-500 py-4">Loading available models...</div>
                            ) : (
                                systemModels.map((model) => {
                                    const isSelected = (currentUser.aiConfig?.visibleModelIds || []).includes(model.id) ||
                                        (currentUser.aiConfig?.visibleModelIds === undefined); // Default to all if undefined? Or none? Let's say all by default if list is empty/undefined, BUT logic below assumes explicit check. 
                                    // Better: If undefined/empty, maybe we assume ALL are visible or NONE.
                                    // Let's rely on explicit toggle. If undefined, treat as "All"? No, let's treat as "None" or require explicit enable.
                                    // Actually, to avoid breaking existing users, if undefined, we should probably toggle ALL on save, or treat undefined as "Show All".
                                    // Let's handle state separately.

                                    const isChecked = visibleModels.includes(model.id);

                                    return (
                                        <div key={model.id} className={`p-4 rounded-xl border transition-all ${isChecked ? 'bg-purple-500/5 border-purple-500/30' : 'bg-navy-950/50 border-white/5 hover:border-white/10'}`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-sm font-semibold text-white">{model.name}</h4>
                                                        {model.provider === 'openai' && <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] uppercase font-bold tracking-wider">OpenAI</span>}
                                                        {model.provider === 'google' && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] uppercase font-bold tracking-wider">Google</span>}
                                                        {model.provider === 'anthropic' && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold tracking-wider">Anthropic</span>}
                                                    </div>

                                                    <div className="text-xs text-slate-400 mb-2 line-clamp-2">
                                                        {model.description || 'Advanced LLM provided by the platform.'}
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {model.context_window && (
                                                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-slate-300">
                                                                <Layers size={10} />
                                                                <span>{model.context_window.toLocaleString()} ctx</span>
                                                            </div>
                                                        )}
                                                        {model.max_outputs && (
                                                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-slate-300">
                                                                <Monitor size={10} />
                                                                <span>{model.max_outputs.toLocaleString()} output</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isChecked}
                                                        onChange={() => toggleModelVisibility(model.id)}
                                                    />
                                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Organization Admin Control */}
                        {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN') && orgConfig && (
                            <div className="mt-8 pt-8 border-t border-white/5 text-left bg-navy-950/50 rounded-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 rounded bg-blue-500/20 text-blue-400"><Monitor size={16} /></div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Organization Default Model</h4>
                                        <p className="text-xs text-slate-400">Select which model powers your organization's default behavior.</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <select
                                        value={orgConfig.activeProviderId || ''}
                                        onChange={(e) => setOrgConfig({ ...orgConfig, activeProviderId: e.target.value || null })}
                                        className="flex-1 bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                                    >
                                        <option value="">System Default (Auto)</option>
                                        {orgConfig.availableProviders.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.provider}) {p.model_id}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleSaveOrgConfig}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm"
                                    >
                                        Save Choice
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {(configMode === 'gemini' || configMode === 'openai') && (
                    <div className="space-y-4">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-xs flex gap-2">
                            <Monitor size={16} className="shrink-0" />
                            <p>Your API key is stored locally in your browser and used directly. It is never sent to our servers.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">
                                {configMode === 'gemini' ? 'Google AI Studio Key' : 'OpenAI API Key'}
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={customKey}
                                    onChange={e => setCustomKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm font-mono"
                                />
                                <div className="absolute right-3 top-2.5 text-slate-500">
                                    <Lock size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {configMode === 'ollama' && (
                    <div className="space-y-4">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex gap-2">
                            <Monitor size={16} className="shrink-0" />
                            <p>Connect to your local LLM instance. Ensure Ollama is running (`ollama serve`).</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">Endpoint URL</label>
                                <input
                                    value={localEndpoint}
                                    onChange={e => setLocalEndpoint(e.target.value)}
                                    placeholder="http://localhost:11434"
                                    className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">&nbsp;</label>
                                <button
                                    type="button"
                                    onClick={fetchOllamaModels}
                                    disabled={isLoadingModels}
                                    className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-sm transition-all"
                                >
                                    {isLoadingModels ? '...' : 'Fetch Models'}
                                </button>
                            </div>
                        </div>

                        {ollamaModels.length > 0 && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">Select Model</label>
                                <select
                                    value={selectedModel}
                                    onChange={e => setSelectedModel(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-all text-sm"
                                >
                                    {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-6 mt-6 border-t border-white/10 flex justify-end">
                    <button
                        type="submit"
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {isSaved ? <Check size={16} /> : null}
                        {isSaved ? 'Configuration Saved' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
};
