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
            setForm({ name: '', provider: 'openai', api_key: '', endpoint: '', model_id: '', is_active: true });
            loadProviders();
        } catch (err) {
            toast.error('Operation failed');
        }
    };

    // ... (rest of handleSubmit/hooks)

    // In render:
    // ...
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
    // ...
    // In Modal Form:
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
                                </form >
                            </div >
                        </div >
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
        </div >
    );
};
