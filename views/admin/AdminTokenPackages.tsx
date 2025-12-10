import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { Package, Plus, Edit2, Check, X, Trash2, Coins } from 'lucide-react';

export const AdminTokenPackages = () => {
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPkg, setEditingPkg] = useState<any>(null); // null = list mode, {} = create mode, {id...} = edit mode
    const [error, setError] = useState<string | null>(null);

    const loadPackages = async () => {
        setLoading(true);
        try {
            const data = await Api.getTokenPackages();
            setPackages(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPackages();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.upsertTokenPackage({
                ...editingPkg,
                tokens: parseInt(editingPkg.tokens),
                priceUsd: parseFloat(editingPkg.price_usd),
                bonusPercent: parseInt(editingPkg.bonus_percent || 0),
                sortOrder: parseInt(editingPkg.sort_order || 0),
                isPopular: editingPkg.is_popular ? 1 : 0
            });
            setEditingPkg(null);
            loadPackages();
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading && !packages.length) return <div className="text-white/50">Loading packages...</div>;

    return (
        <div className="bg-navy-900 border border-white/10 rounded-lg p-6 mt-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-400" />
                        Token Packages
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Manage purchasable token bundles.</p>
                </div>
                <button
                    onClick={() => setEditingPkg({ name: '', tokens: 100000, price_usd: 10, bonus_percent: 0, is_popular: false })}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Package
                </button>
            </div>

            {editingPkg ? (
                <form onSubmit={handleSave} className="bg-navy-950/50 border border-white/10 p-4 rounded-lg animate-fade-in-up">
                    <h3 className="text-white font-bold mb-4">{editingPkg.id ? 'Edit Package' : 'Create Package'}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Package Name</label>
                            <input
                                required
                                type="text"
                                value={editingPkg.name}
                                onChange={e => setEditingPkg({ ...editingPkg, name: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white"
                                placeholder="e.g. Starter, Pro"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Stripe Price ID</label>
                            <input
                                type="text"
                                value={editingPkg.stripe_price_id || ''}
                                onChange={e => setEditingPkg({ ...editingPkg, stripe_price_id: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white"
                                placeholder="price_..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Tokens</label>
                            <input
                                required
                                type="number"
                                value={editingPkg.tokens}
                                onChange={e => setEditingPkg({ ...editingPkg, tokens: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Price (USD)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                value={editingPkg.price_usd}
                                onChange={e => setEditingPkg({ ...editingPkg, price_usd: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Bonus Tokens (%)</label>
                            <input
                                type="number"
                                value={editingPkg.bonus_percent}
                                onChange={e => setEditingPkg({ ...editingPkg, bonus_percent: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Sort Order</label>
                            <input
                                type="number"
                                value={editingPkg.sort_order || 0}
                                onChange={e => setEditingPkg({ ...editingPkg, sort_order: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!editingPkg.is_popular}
                                onChange={e => setEditingPkg({ ...editingPkg, is_popular: e.target.checked })}
                                className="form-checkbox bg-transparent border-white/20 text-blue-500 rounded"
                            />
                            Mark as "Popular" (Highlighted)
                        </label>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setEditingPkg(null)}
                            className="px-3 py-2 text-slate-400 hover:text-white transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
                        >
                            Save Package
                        </button>
                    </div>
                </form>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-xs text-slate-500 uppercase">
                                <th className="p-3">Order</th>
                                <th className="p-3">Name</th>
                                <th className="p-3 text-right">Tokens</th>
                                <th className="p-3 text-right">Price</th>
                                <th className="p-3 text-right">Bonus</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map(pkg => (
                                <tr key={pkg.id} className="border-b border-white/5 hover:bg-white/5 group">
                                    <td className="p-3 text-slate-400">{pkg.sort_order}</td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white">{pkg.name}</span>
                                            {pkg.is_popular === 1 && (
                                                <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">POPULAR</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500">{pkg.description || 'No description'}</div>
                                    </td>
                                    <td className="p-3 text-right text-emerald-400 font-mono">
                                        {pkg.tokens.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right text-white font-mono">
                                        ${pkg.price_usd.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-right text-slate-400">
                                        {pkg.bonus_percent > 0 ? `+${pkg.bonus_percent}%` : '-'}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className={`inline-flex w-2 h-2 rounded-full ${pkg.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                    </td>
                                    <td className="p-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditingPkg(pkg)}
                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
