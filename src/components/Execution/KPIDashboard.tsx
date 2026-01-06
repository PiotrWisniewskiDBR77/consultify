/**
 * KPIDashboard Component
 *
 * PMO KPI Monitoring & Performance Tracking
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Performance Measurement (Clause 4.5.2)
 * - PMI PMBOK 7th Edition - Earned Value Management / KPIs
 * - PRINCE2 - Benefits Realization
 *
 * PMO Domain: PERFORMANCE_MONITORING, BENEFITS_REALIZATION
 */

import {
    AlertTriangle,
    BarChart3,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Edit2,
    LineChart,
    Plus,
    Target,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';

export type KPIStatus = 'ON_TARGET' | 'AT_RISK' | 'OFF_TARGET' | 'ACHIEVED';
export type KPICategory = 'DELIVERY' | 'QUALITY' | 'FINANCIAL' | 'ADOPTION' | 'SATISFACTION';

export interface KPI {
    id: string;
    name: string;
    description: string;
    category: KPICategory;
    status: KPIStatus;
    target: number;
    actual: number;
    unit: string;
    trend: 'UP' | 'DOWN' | 'STABLE';
    lastUpdated: string;
    linkedInitiativeId?: string;
    linkedInitiativeName?: string;
    history?: Array<{ date: string; value: number }>;
}

interface KPIDashboardProps {
    projectId: string;
    kpis?: KPI[];
    onAddKPI?: () => void;
    onUpdateKPI?: (kpiId: string, value: number) => void;
    onCreateCorrectiveAction?: (kpiId: string) => void;
}

const STATUS_CONFIG: Record<KPIStatus, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
    ON_TARGET: {
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        icon: <CheckCircle2 size={14} />,
        label: 'On Target',
    },
    AT_RISK: {
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-900/20',
        icon: <AlertTriangle size={14} />,
        label: 'At Risk',
    },
    OFF_TARGET: {
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        icon: <TrendingDown size={14} />,
        label: 'Off Target',
    },
    ACHIEVED: {
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/20',
        icon: <Target size={14} />,
        label: 'Achieved',
    },
};

const CATEGORY_COLORS: Record<KPICategory, string> = {
    DELIVERY: 'bg-blue-500',
    QUALITY: 'bg-purple-500',
    FINANCIAL: 'bg-green-500',
    ADOPTION: 'bg-amber-500',
    SATISFACTION: 'bg-cyan-500',
};

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
    projectId,
    kpis = [],
    onAddKPI,
    onUpdateKPI,
    onCreateCorrectiveAction,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<'all' | KPICategory>('all');
    const [selectedPeriod, setSelectedPeriod] = useState<string>(new Date().toISOString().slice(0, 7));

    // Mock KPIs
    const [localKPIs] = useState<KPI[]>([
        {
            id: 'kpi-1',
            name: 'Initiative Completion Rate',
            description: 'Percentage of initiatives completed on schedule',
            category: 'DELIVERY',
            status: 'ON_TARGET',
            target: 85,
            actual: 88,
            unit: '%',
            trend: 'UP',
            lastUpdated: '2024-12-28',
            history: [
                { date: '2024-10', value: 75 },
                { date: '2024-11', value: 82 },
                { date: '2024-12', value: 88 },
            ],
        },
        {
            id: 'kpi-2',
            name: 'Budget Variance',
            description: 'Actual spending vs planned budget',
            category: 'FINANCIAL',
            status: 'AT_RISK',
            target: 0,
            actual: 8,
            unit: '%',
            trend: 'UP',
            lastUpdated: '2024-12-28',
            linkedInitiativeName: 'Digital Process Automation',
        },
        {
            id: 'kpi-3',
            name: 'User Adoption Rate',
            description: 'Percentage of target users actively using new systems',
            category: 'ADOPTION',
            status: 'OFF_TARGET',
            target: 70,
            actual: 52,
            unit: '%',
            trend: 'STABLE',
            lastUpdated: '2024-12-28',
        },
        {
            id: 'kpi-4',
            name: 'Defect Rate',
            description: 'Number of critical defects per release',
            category: 'QUALITY',
            status: 'ON_TARGET',
            target: 5,
            actual: 3,
            unit: 'defects',
            trend: 'DOWN',
            lastUpdated: '2024-12-28',
        },
        {
            id: 'kpi-5',
            name: 'Stakeholder Satisfaction',
            description: 'Average satisfaction score from surveys',
            category: 'SATISFACTION',
            status: 'ON_TARGET',
            target: 4.0,
            actual: 4.2,
            unit: '/5',
            trend: 'UP',
            lastUpdated: '2024-12-28',
        },
        {
            id: 'kpi-6',
            name: 'Process Efficiency Gain',
            description: 'Reduction in process cycle time',
            category: 'DELIVERY',
            status: 'ACHIEVED',
            target: 30,
            actual: 35,
            unit: '%',
            trend: 'UP',
            lastUpdated: '2024-12-28',
            linkedInitiativeName: 'Workflow Automation',
        },
    ]);

    const filteredKPIs =
        selectedCategory === 'all' ? localKPIs : localKPIs.filter((kpi) => kpi.category === selectedCategory);

    // Summary Stats
    const stats = {
        total: localKPIs.length,
        onTarget: localKPIs.filter((k) => k.status === 'ON_TARGET').length,
        atRisk: localKPIs.filter((k) => k.status === 'AT_RISK').length,
        offTarget: localKPIs.filter((k) => k.status === 'OFF_TARGET').length,
        achieved: localKPIs.filter((k) => k.status === 'ACHIEVED').length,
    };

    const getProgressPercent = (actual: number, target: number, isLowerBetter: boolean = false) => {
        if (isLowerBetter) {
            return target > 0 ? Math.max(0, Math.min(100, ((target - actual) / target) * 100 + 100)) : 100;
        }
        return target > 0 ? Math.min(100, (actual / target) * 100) : 0;
    };

    const renderTrendIndicator = (trend: 'UP' | 'DOWN' | 'STABLE') => {
        switch (trend) {
            case 'UP':
                return <TrendingUp size={14} className="text-green-500" />;
            case 'DOWN':
                return <TrendingDown size={14} className="text-red-500" />;
            default:
                return <span className="w-3 h-0.5 bg-slate-400 rounded" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="text-purple-500" size={24} />
                        KPI Dashboard
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Track transformation metrics and performance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="month"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                    />
                    <button
                        onClick={onAddKPI}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} />
                        Add KPI
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4">
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total KPIs</div>
                    <div className="text-2xl font-bold text-navy-900 dark:text-white">{stats.total}</div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">On Target</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.onTarget}</div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">At Risk</div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.atRisk}</div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Off Target</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.offTarget}</div>
                </div>
                <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Achieved</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.achieved}</div>
                </div>
            </div>

            {/* Off Target Alert */}
            {stats.offTarget > 0 && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                            {stats.offTarget} KPI{stats.offTarget > 1 ? 's are' : ' is'} off target
                        </p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                            Review and create corrective actions to get back on track
                        </p>
                    </div>
                </div>
            )}

            {/* Category Filter */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                {(['all', 'DELIVERY', 'QUALITY', 'FINANCIAL', 'ADOPTION', 'SATISFACTION'] as const).map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                            selectedCategory === cat
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                        }`}
                    >
                        {cat !== 'all' && <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat]}`} />}
                        {cat === 'all' ? 'All Categories' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
                {filteredKPIs.map((kpi) => {
                    const statusConfig = STATUS_CONFIG[kpi.status];
                    const isLowerBetter = ['Budget Variance', 'Defect Rate'].some((n) => kpi.name.includes(n));
                    const progressPercent = getProgressPercent(kpi.actual, kpi.target, isLowerBetter);
                    const needsAction = kpi.status === 'OFF_TARGET' || kpi.status === 'AT_RISK';

                    return (
                        <div
                            key={kpi.id}
                            className={`bg-white dark:bg-navy-900 rounded-xl border-2 p-4 transition-all ${
                                kpi.status === 'OFF_TARGET'
                                    ? 'border-red-200 dark:border-red-500/30'
                                    : 'border-slate-200 dark:border-white/10'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[kpi.category]}`} />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                                        {kpi.category}
                                    </span>
                                </div>
                                <span
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                                >
                                    {statusConfig.icon}
                                    {statusConfig.label}
                                </span>
                            </div>

                            <h4 className="font-bold text-navy-900 dark:text-white mb-1">{kpi.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
                                {kpi.description}
                            </p>

                            {/* Value Display */}
                            <div className="flex items-end justify-between mb-3">
                                <div>
                                    <div className="text-3xl font-bold text-navy-900 dark:text-white flex items-baseline gap-1">
                                        {kpi.actual}
                                        <span className="text-sm font-normal text-slate-400">{kpi.unit}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        Target: {kpi.target}
                                        {kpi.unit}
                                        {renderTrendIndicator(kpi.trend)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div
                                        className={`text-2xl font-bold ${
                                            progressPercent >= 100
                                                ? 'text-green-600'
                                                : progressPercent >= 80
                                                  ? 'text-amber-600'
                                                  : 'text-red-600'
                                        }`}
                                    >
                                        {Math.round(progressPercent)}%
                                    </div>
                                    <div className="text-xs text-slate-400">of target</div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden mb-4">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        progressPercent >= 100
                                            ? 'bg-green-500'
                                            : progressPercent >= 80
                                              ? 'bg-amber-500'
                                              : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                />
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Calendar size={12} />
                                    Updated {new Date(kpi.lastUpdated).toLocaleDateString()}
                                </div>
                                {needsAction && (
                                    <button
                                        onClick={() => onCreateCorrectiveAction?.(kpi.id)}
                                        className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                                    >
                                        Create Action
                                        <ChevronRight size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Linked Initiative */}
                            {kpi.linkedInitiativeName && (
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                    <span className="text-xs text-slate-500">
                                        Linked: <span className="text-purple-500">{kpi.linkedInitiativeName}</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};




