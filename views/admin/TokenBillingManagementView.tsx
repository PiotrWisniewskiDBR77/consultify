import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { AdminLLMMultipliers } from './AdminLLMMultipliers';
import { AdminMarginConfig } from './AdminMarginConfig';
import { AdminTokenPackages } from './AdminTokenPackages';
import { RefreshCw, Zap, Package, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const TokenBillingManagementView = () => {
    const [stats, setStats] = useState({
        activeModels: 0,
        activePackages: 0,
        platformMargin: 0,
        balance: 0
    });
    const [loading, setLoading] = useState(true);

    const loadStats = async () => {
        setLoading(true);
        try {
            // Parallel fetch for overview numbers
            const [providers, packages, margins, balance] = await Promise.all([
                Api.getLLMProviders().catch(() => []),
                Api.getTokenPackages().catch(() => []),
                Api.getBillingMargins().catch(() => []),
                Api.getTokenBalance().catch(() => 0)
            ]);

            const platformMargin = margins.find((m: any) => m.source_type === 'platform');

            setStats({
                activeModels: providers.filter((p: any) => p.is_active).length,
                activePackages: packages.filter((p: any) => p.is_active).length,
                platformMargin: platformMargin ? platformMargin.margin_percent : 0,
                balance: balance
            });
        } catch (error) {
            console.error('Failed to load billing stats', error);
            // Don't block whole view if stats fail
            toast.error('Could not load some overview statistics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    return (
        <div className="p-8 h-full overflow-y-auto bg-navy-950">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Token Billing Management</h1>
                    <p className="text-slate-400 text-sm">Configure pricing, margins, and packages for the token economy.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/10"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard
                    title="Active AI Models"
                    value={stats.activeModels.toString()}
                    icon={<Zap size={20} className="text-yellow-400" />}
                    loading={loading}
                />
                <KPICard
                    title="Active Packages"
                    value={stats.activePackages.toString()}
                    icon={<Package size={20} className="text-blue-400" />}
                    loading={loading}
                />
                <KPICard
                    title="Platform Margin"
                    value={`${stats.platformMargin}%`}
                    icon={<TrendingUp size={20} className="text-emerald-400" />}
                    loading={loading}
                    subtext="Markup on base costs"
                />
                <KPICard
                    title="System Balance"
                    value={(stats.balance / 1000).toFixed(1) + 'k'}
                    icon={<DollarSign size={20} className="text-purple-400" />}
                    loading={loading}
                    subtext="Current admin tokens"
                />
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col gap-8">

                {/* Section 1: Pricing Model & Margins */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <AdminLLMMultipliers />
                    </div>
                    <div className="lg:col-span-1">
                        <AdminMarginConfig />
                    </div>
                </div>

                {/* Section 2: Token Packages */}
                <div>
                    <AdminTokenPackages />
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon, loading, subtext }: { title: string, value: string, icon: React.ReactNode, loading: boolean, subtext?: string }) => (
    <div className="bg-navy-900 border border-white/5 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-white/10 transition-colors">
        <div className="absolute top-0 right-0 p-4 opacity-50 bg-gradient-to-br from-white/5 to-transparent w-24 h-24 rounded-bl-full -mr-10 -mt-10" />
        <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</h3>
            <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
        </div>
        <div className="relative z-10">
            {loading ? (
                <div className="h-8 w-16 bg-white/10 animate-pulse rounded" />
            ) : (
                <div className="text-2xl font-bold text-white">{value}</div>
            )}
            {subtext && <p className="text-slate-500 text-xs mt-1">{subtext}</p>}
        </div>
    </div>
);
