/**
 * Benefits Tracking Dashboard
 * 
 * Comprehensive dashboard for tracking planned vs actual benefits realization.
 * Includes variance analysis, trend visualization, and measurement entry.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    TrendingUp, TrendingDown, Target, AlertTriangle,
    Plus, Calendar, Check, X, Loader2, BarChart2,
    ArrowUpRight, ArrowDownRight, Minus, Edit2, Trash2
} from 'lucide-react';
import { 
    BarChart, Bar, LineChart, Line, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Area, ReferenceLine
} from 'recharts';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface BenefitTrackingEntry {
    id: string;
    analysisId: string;
    trackingPeriod: string;
    plannedBenefits: number;
    actualBenefits: number;
    variance: number;
    trackedAt: string;
    createdBy?: string;
}

interface BenefitsTrackingDashboardProps {
    analysisId: string;
    analysisName: string;
    currency?: string;
    onClose?: () => void;
}

export const BenefitsTrackingDashboard: React.FC<BenefitsTrackingDashboardProps> = ({
    analysisId,
    analysisName,
    currency = 'PLN',
    onClose
}) => {
    const [benefits, setBenefits] = useState<BenefitTrackingEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showMeasurementModal, setShowMeasurementModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<BenefitTrackingEntry | null>(null);

    // Load benefits data
    useEffect(() => {
        const loadBenefits = async () => {
            setIsLoading(true);
            try {
                const response = await Api.getAnalysisBenefits(analysisId);
                setBenefits(response.benefits || []);
            } catch (error) {
                console.error('Failed to load benefits:', error);
                toast.error('Nie udało się załadować danych');
            } finally {
                setIsLoading(false);
            }
        };

        loadBenefits();
    }, [analysisId]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    };

    // Calculate summary statistics
    const stats = useMemo(() => {
        if (benefits.length === 0) {
            return {
                totalPlanned: 0,
                totalActual: 0,
                totalVariance: 0,
                variancePercent: 0,
                trend: 'neutral' as const,
                periodsOnTrack: 0,
                periodsBehind: 0,
                periodsAhead: 0
            };
        }

        const totalPlanned = benefits.reduce((sum, b) => sum + (b.plannedBenefits || 0), 0);
        const totalActual = benefits.reduce((sum, b) => sum + (b.actualBenefits || 0), 0);
        const totalVariance = totalActual - totalPlanned;
        const variancePercent = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;

        const periodsOnTrack = benefits.filter(b => Math.abs(b.variance) <= b.plannedBenefits * 0.1).length;
        const periodsBehind = benefits.filter(b => b.variance < -b.plannedBenefits * 0.1).length;
        const periodsAhead = benefits.filter(b => b.variance > b.plannedBenefits * 0.1).length;

        // Determine trend from last 3 periods
        const recentBenefits = benefits.slice(-3);
        let trend: 'up' | 'down' | 'neutral' = 'neutral';
        if (recentBenefits.length >= 2) {
            const variances = recentBenefits.map(b => b.variance);
            const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
            trend = avgVariance > 0 ? 'up' : avgVariance < 0 ? 'down' : 'neutral';
        }

        return {
            totalPlanned,
            totalActual,
            totalVariance,
            variancePercent,
            trend,
            periodsOnTrack,
            periodsBehind,
            periodsAhead
        };
    }, [benefits]);

    // Prepare chart data
    const chartData = useMemo(() => {
        return benefits.map(b => ({
            period: b.trackingPeriod,
            planned: b.plannedBenefits,
            actual: b.actualBenefits,
            variance: b.variance,
            variancePercent: b.plannedBenefits > 0 
                ? ((b.actualBenefits - b.plannedBenefits) / b.plannedBenefits) * 100 
                : 0
        })).sort((a, b) => a.period.localeCompare(b.period));
    }, [benefits]);

    const handleSaveMeasurement = async (data: {
        trackingPeriod: string;
        plannedBenefits: number;
        actualBenefits: number;
    }) => {
        try {
            await Api.updateAnalysisBenefits(analysisId, data);
            
            // Reload benefits
            const response = await Api.getAnalysisBenefits(analysisId);
            setBenefits(response.benefits || []);
            
            setShowMeasurementModal(false);
            setEditingEntry(null);
            toast.success('Pomiar zapisany');
        } catch (error: any) {
            toast.error(error.message || 'Nie udało się zapisać pomiaru');
        }
    };

    const handleEditEntry = (entry: BenefitTrackingEntry) => {
        setEditingEntry(entry);
        setShowMeasurementModal(true);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-white/10">
                    <p className="font-bold text-navy-900 dark:text-white mb-2">{label}</p>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Plan:</span>
                            <span className="font-medium text-navy-900 dark:text-white">
                                {formatCurrency(data.planned)}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Realizacja:</span>
                            <span className={`font-medium ${data.actual >= data.planned ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(data.actual)}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 dark:border-white/10">
                            <span className="text-slate-500">Odchylenie:</span>
                            <span className={`font-bold ${data.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatPercent(data.variancePercent)}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <Target size={24} className="text-emerald-500" />
                        Śledzenie korzyści
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {analysisName}
                    </p>
                </div>
                <button
                    onClick={() => setShowMeasurementModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus size={18} />
                    Dodaj pomiar
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Plan całkowity"
                    value={formatCurrency(stats.totalPlanned)}
                    icon={<Target size={20} />}
                    color="blue"
                />
                <SummaryCard
                    title="Realizacja"
                    value={formatCurrency(stats.totalActual)}
                    icon={stats.totalActual >= stats.totalPlanned ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    color={stats.totalActual >= stats.totalPlanned ? 'green' : 'red'}
                />
                <SummaryCard
                    title="Odchylenie"
                    value={formatPercent(stats.variancePercent)}
                    subtitle={formatCurrency(stats.totalVariance)}
                    icon={stats.totalVariance >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    color={stats.totalVariance >= 0 ? 'green' : 'red'}
                />
                <SummaryCard
                    title="Status okresów"
                    value={`${stats.periodsOnTrack} / ${benefits.length}`}
                    subtitle="zgodnych z planem"
                    icon={<Check size={20} />}
                    color={stats.periodsOnTrack >= benefits.length * 0.7 ? 'green' : 'orange'}
                />
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
                <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart2 size={20} className="text-blue-500" />
                        Porównanie plan vs realizacja
                    </h3>
                    <ResponsiveContainer width="100%" height={350}>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                            <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 12 }} />
                            <YAxis 
                                tickFormatter={(value) => formatCurrency(value).replace(' PLN', 'k')} 
                                tick={{ fill: '#64748b', fontSize: 12 }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                            
                            <Bar dataKey="planned" name="Plan" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="actual" name="Realizacja" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                            <Line 
                                type="monotone" 
                                dataKey="variance" 
                                name="Odchylenie" 
                                stroke="#f59e0b" 
                                strokeWidth={2}
                                dot={{ fill: '#f59e0b', r: 4 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Tracking History Table */}
            <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                        Historia pomiarów
                    </h3>
                </div>
                
                {benefits.length === 0 ? (
                    <div className="p-12 text-center">
                        <Target size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h4 className="text-lg font-medium text-navy-900 dark:text-white mb-2">
                            Brak pomiarów
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Rozpocznij śledzenie korzyści dodając pierwszy pomiar
                        </p>
                        <button
                            onClick={() => setShowMeasurementModal(true)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium"
                        >
                            Dodaj pomiar
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-navy-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Okres
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Plan
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Realizacja
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Odchylenie
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Akcje
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {benefits.map((entry) => {
                                    const variancePercent = entry.plannedBenefits > 0 
                                        ? ((entry.actualBenefits - entry.plannedBenefits) / entry.plannedBenefits) * 100 
                                        : 0;
                                    const isOnTrack = Math.abs(variancePercent) <= 10;
                                    const isAhead = variancePercent > 10;
                                    
                                    return (
                                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-slate-400" />
                                                    <span className="font-medium text-navy-900 dark:text-white">
                                                        {entry.trackingPeriod}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-slate-600 dark:text-slate-400">
                                                    {formatCurrency(entry.plannedBenefits)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className={`font-medium ${entry.actualBenefits >= entry.plannedBenefits ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {formatCurrency(entry.actualBenefits)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className={`font-bold ${entry.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {formatPercent(variancePercent)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                    isOnTrack 
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                                        : isAhead 
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                                }`}>
                                                    {isOnTrack ? 'Zgodny' : isAhead ? 'Powyżej' : 'Poniżej'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleEditEntry(entry)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Measurement Modal */}
            {showMeasurementModal && (
                <MeasurementModal
                    initialData={editingEntry}
                    onSave={handleSaveMeasurement}
                    onClose={() => {
                        setShowMeasurementModal(false);
                        setEditingEntry(null);
                    }}
                    currency={currency}
                />
            )}
        </div>
    );
};

// Summary Card Component
const SummaryCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    color: 'blue' | 'green' | 'red' | 'orange';
}> = ({ title, value, subtitle, icon, color }) => {
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400',
        green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        red: 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400',
        orange: 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-600 dark:text-orange-400'
    };

    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</span>
                {icon}
            </div>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
    );
};

// Measurement Modal Component
const MeasurementModal: React.FC<{
    initialData?: BenefitTrackingEntry | null;
    onSave: (data: { trackingPeriod: string; plannedBenefits: number; actualBenefits: number }) => Promise<void>;
    onClose: () => void;
    currency: string;
}> = ({ initialData, onSave, onClose, currency }) => {
    const [trackingPeriod, setTrackingPeriod] = useState(initialData?.trackingPeriod || '');
    const [plannedBenefits, setPlannedBenefits] = useState(initialData?.plannedBenefits || 0);
    const [actualBenefits, setActualBenefits] = useState(initialData?.actualBenefits || 0);
    const [isSaving, setIsSaving] = useState(false);

    // Generate period suggestions
    const periodSuggestions = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        
        return [
            `Q${quarter} ${year}`,
            `Q${quarter > 1 ? quarter - 1 : 4} ${quarter > 1 ? year : year - 1}`,
            `Miesiąc ${now.getMonth() + 1}/${year}`,
            `Rok ${year}`
        ];
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackingPeriod.trim()) {
            toast.error('Podaj okres pomiaru');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                trackingPeriod: trackingPeriod.trim(),
                plannedBenefits,
                actualBenefits
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-800 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                        {initialData ? 'Edytuj pomiar' : 'Nowy pomiar'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Period Selection */}
                    <div>
                        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                            Okres pomiaru
                        </label>
                        <input
                            type="text"
                            value={trackingPeriod}
                            onChange={(e) => setTrackingPeriod(e.target.value)}
                            placeholder="np. Q1 2025"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 text-navy-900 dark:text-white"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {periodSuggestions.map(suggestion => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => setTrackingPeriod(suggestion)}
                                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-navy-600"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Planned Benefits */}
                    <div>
                        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                            Planowane korzyści ({currency})
                        </label>
                        <input
                            type="number"
                            value={plannedBenefits}
                            onChange={(e) => setPlannedBenefits(parseFloat(e.target.value) || 0)}
                            min={0}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 text-navy-900 dark:text-white text-right"
                        />
                    </div>

                    {/* Actual Benefits */}
                    <div>
                        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                            Rzeczywiste korzyści ({currency})
                        </label>
                        <input
                            type="number"
                            value={actualBenefits}
                            onChange={(e) => setActualBenefits(parseFloat(e.target.value) || 0)}
                            min={0}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 text-navy-900 dark:text-white text-right"
                        />
                    </div>

                    {/* Variance Preview */}
                    {plannedBenefits > 0 && (
                        <div className={`p-4 rounded-lg ${
                            actualBenefits >= plannedBenefits 
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Odchylenie:</span>
                                <span className={`font-bold ${actualBenefits >= plannedBenefits ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {((actualBenefits - plannedBenefits) / plannedBenefits * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-navy-700 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Zapisywanie...
                                </>
                            ) : (
                                <>
                                    <Check size={18} />
                                    Zapisz
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BenefitsTrackingDashboard;

