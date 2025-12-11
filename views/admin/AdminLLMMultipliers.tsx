import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { RefreshCw, Save, DollarSign, Zap, Edit2, X, Check } from 'lucide-react';
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

    if (loading && providers.length === 0) return <div className="text-slate-500 p-4">Loading...</div>;

    return (
        <div className="bg-navy-900 border border-white/10 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        LLM Markup Multipliers
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Control profit margins for each AI model.</p>
                </div>
                <button
                    onClick={fetchProviders}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-white/70" />
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                            <th className="py-3 font-medium">Provider / Model</th>
                            <th className="py-3 font-medium">Base Cost / 1k</th>
                            <th className="py-3 font-medium">Multiplier (x)</th>
                            <th className="py-3 font-medium">Effective Cost / 1k (Tokens)</th>
                            <th className="py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {providers.map(p => {
                            const isEditing = editingId === p.id;
                            const effectiveCost = (p.cost_per_1k * (p.markup_multiplier || 1.0)).toFixed(4);

                            return (
                                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-3 text-white">
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.provider} ({p.model_id})</div>
                                    </td>

                                    <td className="py-3 text-slate-300">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.0001"
                                                value={editForm.cost_per_1k}
                                                onChange={e => setEditForm({ ...editForm, cost_per_1k: parseFloat(e.target.value) })}
                                                className="w-24 bg-navy-950 border border-white/20 rounded px-2 py-1 text-white"
                                            />
                                        ) : (
                                            `$${p.cost_per_1k}`
                                        )}
                                    </td>

                                    <td className="py-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1.0"
                                                max="100.0"
                                                value={editForm.markup_multiplier}
                                                onChange={e => setEditForm({ ...editForm, markup_multiplier: parseFloat(e.target.value) })}
                                                className="w-20 bg-navy-950 border border-white/20 rounded px-2 py-1 text-yellow-400 font-bold"
                                            />
                                        ) : (
                                            <span className="text-yellow-400 font-bold">{p.markup_multiplier || 1.0}x</span>
                                        )}
                                    </td>

                                    <td className="py-3 text-slate-300">
                                        {/* Since 1 platform token = $0.01 (approx, depends on margin config), we can estimate cost in tokens.
                                           Actually, existing token logic uses 'platform_tokens' deducted = tokens * multiplier. 
                                           So cost to USER is tokens deducted. 
                                           But here we show 'Effective Cost / 1k TOKENS'.
                                           Wait. If multiplier is 2.0, user pays 2000 platform tokens for 1000 raw tokens.
                                        */}
                                        <span className="text-emerald-400 font-mono">
                                            {(1000 * (isEditing ? editForm.markup_multiplier : (p.markup_multiplier || 1.0))).toFixed(0)} Tokens
                                        </span>
                                        <span className="text-xs text-slate-500 ml-1">
                                            (per 1k in)
                                        </span>
                                    </td>

                                    <td className="py-3 text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => saveEdit(p.id)} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={cancelEdit} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startEdit(p)} className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded">
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                <p><strong>Note:</strong> Platform Tokens are deducted based on <code>Raw Tokens * Multiplier</code>. Example: If Multiplier is 2.0x, a request using 1,000 tokens will deduct 2,000 Platform Tokens from the user's balance.</p>
            </div>
        </div>
    );
};
