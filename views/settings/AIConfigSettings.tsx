import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, AIProviderType } from '../../types';
import { Cpu, Monitor, Lock, Check, Layers } from 'lucide-react';

interface AIConfigSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, AIProviderType, PrivateModel } from '../../types';
import { Cpu, Monitor, Lock, Check, Layers, Plus, Trash2, X } from 'lucide-react';

interface AIConfigSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const AIConfigSettings: React.FC<AIConfigSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const [activeTab, setActiveTab] = useState<'system' | 'private'>('system');
    const [isSaved, setIsSaved] = useState(false);

    // System Models State
    const [systemModels, setSystemModels] = useState<any[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [visibleModelIds, setVisibleModelIds] = useState<string[]>(currentUser.aiConfig?.visibleModelIds || []);

    // Private Models State
    const [privateModels, setPrivateModels] = useState<PrivateModel[]>(currentUser.aiConfig?.privateModels || []);
    const [showAddForm, setShowAddForm] = useState(false);

    // New Model Form State
    const [newModel, setNewModel] = useState<Partial<PrivateModel>>({
        provider: 'openai',
        name: '',
        modelId: '',
        apiKey: '',
        endpoint: ''
    });

    useEffect(() => {
        // Init from props
        if (currentUser.aiConfig) {
            setVisibleModelIds(currentUser.aiConfig.visibleModelIds || []);
            setPrivateModels(currentUser.aiConfig.privateModels || []);
        }
    }, [currentUser]);

    useEffect(() => {
        setIsLoadingModels(true);
        Api.getPublicLLMProviders()
            .then(models => {
                setSystemModels(models);
                // If user encounters this for the first time (undefined), maybe select all by default?
                // logic: if visibleModelIds is undefined in DB, it comes as undefined here. 
                // We'll handle "if undefined, treat as all" in the selector logic or init it here.
                // Let's init it here so they can uncheck.
                if (!currentUser.aiConfig?.visibleModelIds) {
                    setVisibleModelIds(models.map((m: any) => m.id));
                }
            })
            .catch(err => console.error("Failed to fetch public models", err))
            .finally(() => setIsLoadingModels(false));
    }, []);

    const handleSave = async () => {
        const newConfig = {
            ...currentUser.aiConfig,
            visibleModelIds,
            privateModels
        };

        try {
            onUpdateUser({ aiConfig: newConfig });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err) {
            alert("Failed to save AI config");
        }
    };

    const toggleSystemModel = (id: string) => {
        setVisibleModelIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const addPrivateModel = () => {
        if (!newModel.name || !newModel.provider || !newModel.modelId) {
            alert("Please fill in Name, Provider and Model ID");
            return;
        }

        const id = `private-${Date.now()}`;
        const modelToAdd: PrivateModel = {
            id,
            name: newModel.name,
            provider: newModel.provider as AIProviderType,
            modelId: newModel.modelId,
            apiKey: newModel.apiKey,
            endpoint: newModel.endpoint
        };

        setPrivateModels([...privateModels, modelToAdd]);
        setNewModel({ provider: 'openai', name: '', modelId: '', apiKey: '', endpoint: '' });
        setShowAddForm(false);
    };

    const removePrivateModel = (id: string) => {
        if (confirm('Are you sure you want to remove this model?')) {
            setPrivateModels(prev => prev.filter(m => m.id !== id));
        }
    };

    return (
        <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">AI Model Selection</h2>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    {isSaved ? <Check size={16} /> : null}
                    {isSaved ? 'Saved' : 'Save Changes'}
                </button>
            </div>

            {/* Top Tabs */}
            <div className="flex border-b border-white/10 mb-6">
                <button
                    onClick={() => setActiveTab('system')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'system'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                >
                    System Models
                </button>
                <button
                    onClick={() => setActiveTab('private')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'private'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                >
                    My Private Models
                </button>
            </div>

            {activeTab === 'system' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-400 mb-4">
                        Select which standard models you want to appear in your quick selection menu.
                    </p>

                    {isLoadingModels ? (
                        <div className="text-slate-500 text-center py-8">Loading models...</div>
                    ) : (
                        <div className="grid gap-3">
                            {systemModels.map(model => (
                                <div
                                    key={model.id}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${visibleModelIds.includes(model.id)
                                            ? 'bg-purple-500/10 border-purple-500/30'
                                            : 'bg-navy-950 border-white/5 hover:border-white/10'
                                        }`}
                                    onClick={() => toggleSystemModel(model.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${visibleModelIds.includes(model.id)
                                                ? 'bg-purple-600 border-purple-600'
                                                : 'border-slate-600'
                                            }`}>
                                            {visibleModelIds.includes(model.id) && <Check size={12} className="text-white" />}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-medium text-white">{model.name}</h4>
                                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                                                    {model.provider}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-1">{model.description || model.model_id}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'private' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">
                            Add your own API keys or local models. These are only visible to you.
                        </p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-medium rounded-lg flex items-center gap-2 border border-white/5"
                        >
                            <Plus size={14} />
                            Add Model
                        </button>
                    </div>

                    {showAddForm && (
                        <div className="p-4 bg-navy-900 border border-white/10 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-start">
                                <h3 className="text-sm font-medium text-white">Add New Model</h3>
                                <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Name (Display Label)</label>
                                    <input
                                        value={newModel.name}
                                        onChange={e => setNewModel({ ...newModel, name: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                        placeholder="e.g. My GPT-4"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Provider</label>
                                    <select
                                        value={newModel.provider}
                                        onChange={e => setNewModel({ ...newModel, provider: e.target.value as AIProviderType })}
                                        className="w-full bg-navy-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                    >
                                        <option value="openai">OpenAI</option>
                                        <option value="gemini">Google Gemini</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="ollama">Ollama (Local)</option>
                                    </select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs text-slate-400">Model ID (Technical Name)</label>
                                    <input
                                        value={newModel.modelId}
                                        onChange={e => setNewModel({ ...newModel, modelId: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                                        placeholder={newModel.provider === 'ollama' ? 'llama3' : 'gpt-4-turbo'}
                                    />
                                    {newModel.provider === 'ollama' && (
                                        <p className="text-[10px] text-slate-500">Run `ollama list` to see available names.</p>
                                    )}
                                </div>

                                {newModel.provider === 'ollama' ? (
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs text-slate-400">Endpoint URL</label>
                                        <input
                                            value={newModel.endpoint}
                                            onChange={e => setNewModel({ ...newModel, endpoint: e.target.value })}
                                            className="w-full bg-navy-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
                                            placeholder="http://localhost:11434"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs text-slate-400">API Key</label>
                                        <input
                                            type="password"
                                            value={newModel.apiKey}
                                            onChange={e => setNewModel({ ...newModel, apiKey: e.target.value })}
                                            className="w-full bg-navy-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
                                            placeholder="sk-..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={addPrivateModel}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg"
                                >
                                    Add Model
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {privateModels.length === 0 ? (
                            <div className="text-center py-8 bg-navy-950/30 rounded-xl border border-dashed border-white/5 text-slate-500 text-sm">
                                You haven't added any private models yet.
                            </div>
                        ) : (
                            privateModels.map(model => (
                                <div key={model.id} className="flex items-center justify-between p-4 bg-navy-950 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                                            {model.provider === 'ollama' ? <Monitor size={14} /> : <Lock size={14} />}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-white">{model.name}</h4>
                                            <p className="text-xs text-slate-500">{model.provider} • {model.modelId}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removePrivateModel(model.id)}
                                        className="p-2 hover:bg-red-500/10 hover:text-red-400 text-slate-500 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
