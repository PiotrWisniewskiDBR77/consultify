import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { RefreshCw, Save, Zap, Edit2, X, Check, HelpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Provider {
    id: string;
    name: string;
    provider: string;
    model_id: string;
    cost_per_1k: number;
    markup_multiplier: number;
    is_active: number;
}

export const AdminLLMMultipliers = () => {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ markup_multiplier: number; cost_per_1k: number }>({ markup_multiplier: 1.0, cost_per_1k: 0 });

    const fetchProviders = async () => {
        setLoading(true);
        try {
            const data = await Api.getLLMProviders();
            setProviders(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load providers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
    }, []);

    const startEdit = (provider: Provider) => {
        setEditingId(provider.id);
        setEditForm({
            markup_multiplier: provider.markup_multiplier || 1.0,
            cost_per_1k: provider.cost_per_1k || 0
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async (id: string) => {
        try {
            await Api.updateLLMProvider(id, {
                markup_multiplier: editForm.markup_multiplier,
                cost_per_1k: editForm.cost_per_1k
            });
            toast.success('Updated successfully');
            setEditingId(null);
            fetchProviders();
        } catch (err) {
            console.error(err);
            toast.error('Failed to update');
        }
    };

    const getProviderBadgeColor = (provider: string) => {
        switch (provider.toLowerCase()) {
            case 'openai': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'anthropic': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'google': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default: return 'bg-slate-700/50 text-slate-300 border-white/10';
        }
    };

    return (
        <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden shadow-lg h-full flex flex-col relative w-full">
            <div className="absolute top-0 right-0 p-32 bg-yellow-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="p-6 border-b border-white/5 flex justify-between items-center relative z-10">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400/20" />
                        AI Cost & Pricing Models
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Configure base costs and profit margins for each model.</p>
                </div>
                <button
                    onClick={fetchProviders}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-4 h-4 text-white/70 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-navy-950/90 backdrop-blur-sm z-10">
                        <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-xs">
                            <th className="py-4 px-6 font-medium">Provider / Model</th>
                            <th className="py-4 px-6 font-medium">Base Cost <span className="text-[10px] normal-case opacity-50">(per 1k in)</span></th>
                            <th className="py-4 px-6 font-medium">Markup Multiplier</th>
                            <th className="py-4 px-6 font-medium">User Price <span className="text-[10px] normal-case opacity-50">(Tokens deducted per 1k)</span></th>
                            <th className="py-4 px-6 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {providers.map(p => {
                            const isEditing = editingId === p.id;
                            // Calculation: We bill the user X tokens for every 1000 input tokens.
                            // X = 1000 * Multiplier.
                            // Example: 1000 input tokens * 1.5x = 1500 Platform Tokens deducted.
                            const currentMultiplier = isEditing ? editForm.markup_multiplier : (p.markup_multiplier || 1.0);
                            const userCostInTokens = (1000 * currentMultiplier).toFixed(0);

                            return (
                                <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="py-4 px-6 text-white min-w-[200px]">
                                        <div className="flex items-center gap-3">
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getProviderBadgeColor(p.provider)}`}>
                                                {p.provider}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{p.name || p.model_id}</div>
                                                <div className="text-xs text-slate-500 font-mono">{p.model_id}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="py-4 px-6 text-slate-300">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500">$</span>
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    value={editForm.cost_per_1k}
                                                    onChange={e => setEditForm({ ...editForm, cost_per_1k: parseFloat(e.target.value) })}
                                                    className="w-24 bg-navy-950 border border-blue-500/50 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        ) : (
                                            <span className="font-mono text-slate-400">${p.cost_per_1k}</span>
                                        )}
                                    </td>

                                    <td className="py-4 px-6">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="1.0"
                                                    max="100.0"
                                                    value={editForm.markup_multiplier}
                                                    onChange={e => setEditForm({ ...editForm, markup_multiplier: parseFloat(e.target.value) })}
                                                    className="w-20 bg-navy-950 border border-yellow-500/50 rounded px-2 py-1 text-yellow-400 font-bold focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                                />
                                                <span className="text-slate-500">x</span>
                                            </div>
                                        ) : (
                                            <span className={`font-bold px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>
                                                {p.markup_multiplier || 1.0}x
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-4 px-6 text-slate-300">
                                        <div className="flex flex-col">
                                            <span className="text-emerald-400 font-bold font-mono text-base">
                                                {parseInt(userCostInTokens).toLocaleString()} Tokens
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                per 1,000 input tokens
                                            </span>
                                        </div>
                                    </td>

                                    <td className="py-4 px-6 text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => saveEdit(p.id)} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded border border-green-500/20 transition-all">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={cancelEdit} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/20 transition-all">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(p)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Edit Pricing"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {providers.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-500">
                                    No providers found. Check database configuration.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-navy-950/50 border-t border-white/5 text-xs text-slate-400 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p>
                    <strong>Pricing Logic:</strong> User Tokens are deducted based on the <code>Markup Multiplier</code>.
                    If a model costs $0.01/1k and you set a 2.0x multiplier, user pays 2000 platform tokens ($0.02 value approx) for 1000 input tokens.
                </p>
            </div>
        </div>
    );
};
