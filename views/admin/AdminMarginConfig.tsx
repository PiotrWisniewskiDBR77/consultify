import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { RefreshCw, Save, DollarSign, Percent, AlertCircle } from 'lucide-react';

export const AdminMarginConfig = () => {
    const [margins, setMargins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadMargins = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await Api.getBillingMargins();
            setMargins(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMargins();
    }, []);

    const handleChange = (sourceType: string, field: string, value: any) => {
        setMargins(prev => prev.map(m => {
            if (m.source_type === sourceType) {
                return { ...m, [field]: value };
            }
            return m;
        }));
    };

    const handleSave = async (sourceType: string) => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const margin = margins.find(m => m.source_type === sourceType);
            if (!margin) return;

            await Api.updateBillingMargin(sourceType, {
                baseCostPer1k: parseFloat(margin.base_cost_per_1k),
                marginPercent: parseFloat(margin.margin_percent),
                minCharge: parseFloat(margin.min_charge),
                isActive: margin.is_active ? 1 : 0
            });
            setSuccess(`Updated ${margin.display_name} settings`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading && margins.length === 0) {
        return <div className="text-white/50 p-4">Loading margins...</div>;
    }

    return (
        <div className="bg-navy-900 border border-white/10 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                        Billing Margins
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Configure pricing models for different token sources.</p>
                </div>
                <button
                    onClick={loadMargins}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-white/70" />
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded mb-4">
                    {success}
                </div>
            )}

            <div className="space-y-4">
                {margins.map(margin => (
                    <div key={margin.id} className="bg-navy-950/50 border border-white/5 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-white font-medium">{margin.display_name}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{margin.source_type.replace('_', ' ')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!margin.is_active}
                                        onChange={(e) => handleChange(margin.source_type, 'is_active', e.target.checked)}
                                        className="form-checkbox bg-transparent border-white/20 rounded text-emerald-500"
                                    />
                                    Active
                                </label>
                                <button
                                    onClick={() => handleSave(margin.source_type)}
                                    disabled={saving}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-3 h-3" />
                                    Save
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {margin.source_type === 'platform' && (
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Base Cost ($ per 1K)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={margin.base_cost_per_1k}
                                            onChange={(e) => handleChange(margin.source_type, 'base_cost_per_1k', e.target.value)}
                                            className="w-full bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white pl-6"
                                        />
                                        <span className="absolute left-2 top-1.5 text-slate-500 text-sm">$</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">Our cost from provider</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Margin</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={margin.margin_percent}
                                        onChange={(e) => handleChange(margin.source_type, 'margin_percent', e.target.value)}
                                        className="w-full bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white pr-6"
                                    />
                                    <span className="absolute right-2 top-1.5 text-slate-500 text-sm">%</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Markup added to cost/value</p>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Min Charge ($)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={margin.min_charge}
                                        onChange={(e) => handleChange(margin.source_type, 'min_charge', e.target.value)}
                                        className="w-full bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white pl-6"
                                    />
                                    <span className="absolute left-2 top-1.5 text-slate-500 text-sm">$</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Minimum fee per request</p>
                            </div>
                        </div>

                        {/* Revenue Simulation based on inputs */}
                        <div className="mt-3 p-2 bg-white/5 rounded text-xs flex items-center justify-between text-slate-300">
                            <span>Cost Calculation Logic:</span>
                            {margin.source_type === 'platform' ? (
                                <span className="font-mono">
                                    (Base ${margin.base_cost_per_1k}/1k) + {margin.margin_percent}% =
                                    <span className="text-emerald-400 font-bold ml-1">
                                        ${(margin.base_cost_per_1k * (1 + margin.margin_percent / 100)).toFixed(4)}/1k
                                    </span>
                                </span>
                            ) : (
                                <span className="font-mono">
                                    (Est. Value) x {margin.margin_percent}% Fee
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
