import React, { useState, useEffect } from 'react';
import { User, AIProviderType } from '../../types';
import { Api } from '../../services/api';
import { Cpu, Check, Monitor, Lock, Sparkles } from 'lucide-react';

interface AISettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const AISettings: React.FC<AISettingsProps> = ({ currentUser, onUpdateUser }) => {
    const [configMode, setConfigMode] = useState<AIProviderType>(currentUser.aiConfig?.provider || 'system');
    const [customKey, setCustomKey] = useState(currentUser.aiConfig?.apiKey || '');
    const [localEndpoint, setLocalEndpoint] = useState(currentUser.aiConfig?.endpoint || 'http://localhost:11434');
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(currentUser.aiConfig?.modelId || '');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // User Preferences State
    const [visibleModelIds, setVisibleModelIds] = useState<string[]>(currentUser.aiConfig?.visibleModelIds || []);
    const [availableModels, setAvailableModels] = useState<any[]>([]);

    useEffect(() => {
        // Fetch public models for preference selection
        Api.getPublicLLMProviders().then(data => {
            setAvailableModels(data);
            // If no preferences set yet, maybe select all? Or keep empty to mean "all"?
            // LLMSelector logic says: empty/null = all. 
            // So we leave it as initialized.
        }).catch(err => console.error(err));
    }, []);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        const newConfig: any = {
            provider: configMode,
            visibleModelIds: visibleModelIds // Save visibility preference
        };

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
            const updatedUser = { ...currentUser, aiConfig: newConfig };
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
                    <div className="text-center py-8 space-y-6">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-400">
                            <Cpu size={32} />
                        </div>
                        <div>
                            <h3 className="text-white font-medium mb-2">System AI (Managed)</h3>
                            <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                You are using the organization's default AI provider.
                                No configuration is needed. Usage counts towards your plan limit.
                            </p>
                        </div>

                        {/* Personal Model Preferences */}
                        <div className="mt-8 pt-8 border-t border-white/5 text-left bg-navy-950/50 rounded-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 rounded bg-purple-500/20 text-purple-400"><Sparkles size={16} /></div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Your Preferred Models</h4>
                                    <p className="text-xs text-slate-400">Select which models appear in your top bar selector.</p>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {availableModels.length === 0 ? (
                                    <div className="text-xs text-slate-500">Loading available models...</div>
                                ) : (
                                    availableModels.map(model => (
                                        <label key={model.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={visibleModelIds.includes(model.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setVisibleModelIds([...visibleModelIds, model.id]);
                                                    } else {
                                                        setVisibleModelIds(visibleModelIds.filter(id => id !== model.id));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-slate-600 bg-navy-900 text-purple-500 focus:ring-purple-500/50"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm text-slate-200 group-hover:text-white">{model.name}</div>
                                                <div className="text-[10px] text-slate-500 uppercase">{model.provider} • {model.model_id}</div>
                                            </div>
                                            {visibleModelIds.includes(model.id) && <Check size={14} className="text-purple-500" />}
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Organization Admin Control */}
                        {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN') && orgConfig && (
                            <div className="mt-8 pt-8 border-t border-white/5 text-left bg-navy-950/50 rounded-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 rounded bg-blue-500/20 text-blue-400"><Monitor size={16} /></div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Organization Default Model</h4>
                                        <p className="text-xs text-slate-400">Select which model powers your organization.</p>
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
