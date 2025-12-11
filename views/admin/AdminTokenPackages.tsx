import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { Package, Plus, Edit2, Check, X, Trash2, Coins, ArrowRight, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
            toast.error('Failed to load packages');
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
            toast.success('Package saved successfully');
            setEditingPkg(null);
            loadPackages();
        } catch (err: any) {
            setError(err.message);
            toast.error('Failed to save package');
        }
    };

    if (loading && !packages.length) return <div className="text-white/50 p-6">Loading packages...</div>;

    return (
        <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden shadow-lg p-6 relative">
            <div className="absolute top-0 left-0 p-32 bg-blue-500/5 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none" />

            <div className="flex justify-between items-center mb-8 relative z-10">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-400" />
                        Token Packages
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Manage purchasable token bundles.</p>
                </div>
                <button
                    onClick={() => setEditingPkg({ name: '', tokens: 100000, price_usd: 10, bonus_percent: 0, is_popular: false })}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Create Package
                </button>
            </div>

            {editingPkg ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <form onSubmit={handleSave} className="bg-navy-900 border border-white/10 p-6 rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{editingPkg.id ? 'Edit Package' : 'Create New Package'}</h3>
                            <button type="button" onClick={() => setEditingPkg(null)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Package Name</label>
                                <input
                                    required
                                    type="text"
                                    value={editingPkg.name}
                                    onChange={e => setEditingPkg({ ...editingPkg, name: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                    placeholder="e.g. Starter, Pro"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Stripe Price ID</label>
                                <input
                                    type="text"
                                    value={editingPkg.stripe_price_id || ''}
                                    onChange={e => setEditingPkg({ ...editingPkg, stripe_price_id: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors font-mono text-sm"
                                    placeholder="price_..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Tokens Amount</label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        value={editingPkg.tokens}
                                        onChange={e => setEditingPkg({ ...editingPkg, tokens: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:border-blue-500 outline-none transition-colors font-mono"
                                    />
                                    <Coins className="absolute left-3 top-3.5 text-slate-500 w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Price (USD)</label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={editingPkg.price_usd}
                                        onChange={e => setEditingPkg({ ...editingPkg, price_usd: e.target.value })}
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white focus:border-blue-500 outline-none transition-colors font-mono"
                                    />
                                    <span className="absolute left-3 top-3.5 text-slate-500 text-sm">$</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Bonus Tokens (%)</label>
                                <input
                                    type="number"
                                    value={editingPkg.bonus_percent}
                                    onChange={e => setEditingPkg({ ...editingPkg, bonus_percent: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Sort Order</label>
                                <input
                                    type="number"
                                    value={editingPkg.sort_order || 0}
                                    onChange={e => setEditingPkg({ ...editingPkg, sort_order: e.target.value })}
                                    className="w-full bg-navy-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="flex items-center gap-3 p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
                                <input
                                    type="checkbox"
                                    checked={!!editingPkg.is_popular}
                                    onChange={e => setEditingPkg({ ...editingPkg, is_popular: e.target.checked })}
                                    className="w-5 h-5 rounded border-white/20 bg-navy-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-navy-900"
                                />
                                <div>
                                    <span className="text-white font-medium block">Mark as "Popular"</span>
                                    <span className="text-slate-400 text-xs block">Highlights this package with a badge and border.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                            <button
                                type="button"
                                onClick={() => setEditingPkg(null)}
                                className="px-6 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-blue-500/20 font-medium transition-all hover:scale-105"
                            >
                                Save Package
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {packages.map(pkg => (
                        <div
                            key={pkg.id}
                            className={`relative bg-navy-950 rounded-xl p-6 border transition-all hover:-translate-y-1 hover:shadow-xl group ${pkg.is_popular ? 'border-blue-500/50 shadow-blue-500/10' : 'border-white/5 hover:border-white/20'
                                }`}
                        >
                            {pkg.is_popular === 1 && (
                                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg shadow-lg">
                                    MOST POPULAR
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                                    <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Package</div>
                                </div>
                                <button
                                    onClick={() => setEditingPkg(pkg)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-white">${pkg.price_usd}</span>
                                    <span className="text-slate-500 text-sm">USD</span>
                                </div>
                                {pkg.bonus_percent > 0 && (
                                    <div className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                                        <Star size={10} fill="currentColor" />
                                        {pkg.bonus_percent}% Bonus Included
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-slate-400">Tokens</span>
                                    <span className="text-white font-mono">{pkg.tokens.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-slate-400">Total Value</span>
                                    <span className="text-emerald-400 font-mono font-medium">
                                        {(pkg.tokens * (1 + (pkg.bonus_percent / 100))).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-slate-400">Sort Order</span>
                                    <span className="text-slate-500">#{pkg.sort_order}</span>
                                </div>
                            </div>

                            <div className={`text-xs text-center py-1 rounded ${pkg.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {pkg.is_active ? 'Active' : 'Inactive'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
