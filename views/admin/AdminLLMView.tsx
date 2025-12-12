import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { LLMProvider } from '../../types';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Trash2, Edit, Save, X, Check, Eye, EyeOff, Server, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const AdminLLMView: React.FC = () => {
    // Providers State
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    // Ollama Configuration State
    const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
    const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
    const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
    const [testingOllama, setTestingOllama] = useState(false);

    // Prompts State
    const [activeTab, setActiveTab] = useState<'providers' | 'prompts'>('providers');
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
        };
        initLLMData();
    }, []);

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
        <div className="space-y-6">
            {/* TABS */}
            <div className="flex gap-4 border-b border-white/5 pb-1">
                <button
                    onClick={() => setActiveTab('providers')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'providers' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    LLM Providers
                </button>
                <button
                    onClick={() => setActiveTab('prompts')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prompts' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    System Personas (Prompts)
                </button>
            </div>

            {activeTab === 'providers' ? (
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
