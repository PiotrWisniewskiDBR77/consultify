/**
 * HeatmapMatrix
 * 
 * Visual gap priority matrix:
 * - 7 axes x priority categories
 * - Color-coded cells (Red/Yellow/Green)
 * - Interactive cell click for details
 * - Clear legend and tooltips
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// DRD 7 Axes
const DRD_AXES = {
    processes: { namePl: 'Procesy Cyfrowe', nameEn: 'Digital Processes', icon: '⚙️' },
    digitalProducts: { namePl: 'Produkty Cyfrowe', nameEn: 'Digital Products', icon: '📦' },
    businessModels: { namePl: 'Modele Biznesowe', nameEn: 'Business Models', icon: '💼' },
    dataManagement: { namePl: 'Zarządzanie Danymi', nameEn: 'Data Management', icon: '📊' },
    culture: { namePl: 'Kultura Transformacji', nameEn: 'Transformation Culture', icon: '🎯' },
    cybersecurity: { namePl: 'Cyberbezpieczeństwo', nameEn: 'Cybersecurity', icon: '🔒' },
    aiMaturity: { namePl: 'Dojrzałość AI', nameEn: 'AI Maturity', icon: '🤖' }
};

interface AxisData {
    actual?: number;
    target?: number;
    justification?: string;
}

interface HeatmapMatrixProps {
    axisData: Record<string, AxisData>;
    onCellClick?: (axisId: string, priority: string) => void;
    className?: string;
}

// Priority configuration
const PRIORITIES = [
    { 
        id: 'critical', 
        labelPl: 'Krytyczny', 
        labelEn: 'Critical',
        description: 'Luka ≥3 poziomów',
        color: '#ef4444',
        bgColor: '#fef2f2',
        darkBgColor: 'rgba(239, 68, 68, 0.15)',
        icon: AlertTriangle
    },
    { 
        id: 'high', 
        labelPl: 'Wysoki', 
        labelEn: 'High',
        description: 'Luka 2 poziomów',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        darkBgColor: 'rgba(245, 158, 11, 0.15)',
        icon: TrendingUp
    },
    { 
        id: 'medium', 
        labelPl: 'Średni', 
        labelEn: 'Medium',
        description: 'Luka 1 poziomu',
        color: '#3b82f6',
        bgColor: '#dbeafe',
        darkBgColor: 'rgba(59, 130, 246, 0.15)',
        icon: Minus
    },
    { 
        id: 'low', 
        labelPl: 'Niski', 
        labelEn: 'Low',
        description: 'Luka <1 lub cel osiągnięty',
        color: '#10b981',
        bgColor: '#d1fae5',
        darkBgColor: 'rgba(16, 185, 129, 0.15)',
        icon: CheckCircle
    }
];

// Helper to calculate priority from gap
const getPriorityFromGap = (gap: number): typeof PRIORITIES[0] => {
    if (gap >= 3) return PRIORITIES[0]; // Critical
    if (gap >= 2) return PRIORITIES[1]; // High
    if (gap >= 1) return PRIORITIES[2]; // Medium
    return PRIORITIES[3]; // Low
};

export const HeatmapMatrix: React.FC<HeatmapMatrixProps> = ({
    axisData,
    onCellClick,
    className = ''
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    
    const [selectedCell, setSelectedCell] = useState<{ axisId: string; priority: string } | null>(null);
    const [hoveredCell, setHoveredCell] = useState<string | null>(null);

    // Process axis data
    const processedData = useMemo(() => {
        return Object.entries(DRD_AXES).map(([axisId, config]) => {
            const data = axisData[axisId] || {};
            const gap = Math.max(0, (data.target || 0) - (data.actual || 0));
            const priority = getPriorityFromGap(gap);

            return {
                axisId,
                name: isPolish ? config.namePl : config.nameEn,
                icon: config.icon,
                actual: data.actual || 0,
                target: data.target || 0,
                gap,
                priority,
                justification: data.justification
            };
        });
    }, [axisData, isPolish]);

    // Summary stats
    const stats = useMemo(() => {
        const counts = {
            critical: processedData.filter(d => d.priority.id === 'critical').length,
            high: processedData.filter(d => d.priority.id === 'high').length,
            medium: processedData.filter(d => d.priority.id === 'medium').length,
            low: processedData.filter(d => d.priority.id === 'low').length
        };
        const totalGap = processedData.reduce((sum, d) => sum + d.gap, 0);
        const avgGap = totalGap / processedData.length;

        return { counts, totalGap, avgGap };
    }, [processedData]);

    // Handle cell click
    const handleCellClick = (axisId: string, priorityId: string) => {
        setSelectedCell({ axisId, priority: priorityId });
        onCellClick?.(axisId, priorityId);
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
                {PRIORITIES.map((priority) => {
                    const count = stats.counts[priority.id as keyof typeof stats.counts];
                    const Icon = priority.icon;

                    return (
                        <div
                            key={priority.id}
                            className="p-4 rounded-xl border transition-all hover:shadow-md"
                            style={{ 
                                backgroundColor: priority.bgColor,
                                borderColor: priority.color + '40'
                            }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-5 h-5" style={{ color: priority.color }} />
                                <span className="font-semibold" style={{ color: priority.color }}>
                                    {isPolish ? priority.labelPl : priority.labelEn}
                                </span>
                            </div>
                            <div className="text-3xl font-bold text-navy-900 dark:text-white">
                                {count}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {count === 1 ? (isPolish ? 'oś' : 'axis') : (isPolish ? 'osi' : 'axes')}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Heatmap grid */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[200px_1fr_80px_80px_80px_100px] gap-px bg-slate-200 dark:bg-white/10">
                    <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 font-semibold text-sm text-slate-700 dark:text-slate-300">
                        {isPolish ? 'Oś Transformacji' : 'Transformation Axis'}
                    </div>
                    <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 font-semibold text-sm text-slate-700 dark:text-slate-300 text-center">
                        {isPolish ? 'Wizualizacja' : 'Visualization'}
                    </div>
                    <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 font-semibold text-sm text-slate-700 dark:text-slate-300 text-center">
                        {isPolish ? 'Aktualny' : 'Actual'}
                    </div>
                    <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 font-semibold text-sm text-slate-700 dark:text-slate-300 text-center">
                        {isPolish ? 'Docelowy' : 'Target'}
                    </div>
                    <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 font-semibold text-sm text-slate-700 dark:text-slate-300 text-center">
                        {isPolish ? 'Luka' : 'Gap'}
                    </div>
                    <div className="bg-slate-100 dark:bg-navy-800 px-4 py-3 font-semibold text-sm text-slate-700 dark:text-slate-300 text-center">
                        {isPolish ? 'Priorytet' : 'Priority'}
                    </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                    {processedData.map((axis, index) => {
                        const isHovered = hoveredCell === axis.axisId;
                        const barWidth = (axis.actual / 7) * 100;
                        const targetPosition = (axis.target / 7) * 100;

                        return (
                            <motion.div
                                key={axis.axisId}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`
                                    grid grid-cols-[200px_1fr_80px_80px_80px_100px] gap-px
                                    transition-colors cursor-pointer
                                    ${isHovered ? 'bg-slate-50 dark:bg-white/5' : 'bg-white dark:bg-navy-900'}
                                `}
                                onMouseEnter={() => setHoveredCell(axis.axisId)}
                                onMouseLeave={() => setHoveredCell(null)}
                                onClick={() => handleCellClick(axis.axisId, axis.priority.id)}
                            >
                                {/* Axis name */}
                                <div className="px-4 py-3 flex items-center gap-2">
                                    <span className="text-lg">{axis.icon}</span>
                                    <span className="font-medium text-navy-900 dark:text-white text-sm">
                                        {axis.name}
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="px-4 py-3 flex items-center">
                                    <div className="w-full h-6 bg-slate-100 dark:bg-white/5 rounded-lg relative overflow-hidden">
                                        {/* Actual bar */}
                                        <motion.div
                                            className="absolute left-0 top-0 bottom-0 rounded-lg"
                                            style={{ backgroundColor: axis.priority.color }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${barWidth}%` }}
                                            transition={{ duration: 0.8, delay: index * 0.05 }}
                                        />
                                        {/* Target marker */}
                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 bg-green-600"
                                            style={{ left: `${targetPosition}%` }}
                                        />
                                        {/* Value label */}
                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-navy-900 dark:text-white">
                                            {axis.actual.toFixed(1)} → {axis.target.toFixed(1)}
                                        </span>
                                    </div>
                                </div>

                                {/* Actual value */}
                                <div className="px-4 py-3 flex items-center justify-center">
                                    <span className="text-lg font-bold text-navy-900 dark:text-white tabular-nums">
                                        {axis.actual.toFixed(1)}
                                    </span>
                                </div>

                                {/* Target value */}
                                <div className="px-4 py-3 flex items-center justify-center">
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                                        {axis.target.toFixed(1)}
                                    </span>
                                </div>

                                {/* Gap */}
                                <div className="px-4 py-3 flex items-center justify-center">
                                    <span 
                                        className="px-2 py-1 rounded-lg text-sm font-bold"
                                        style={{ 
                                            backgroundColor: axis.priority.bgColor,
                                            color: axis.priority.color
                                        }}
                                    >
                                        {axis.gap > 0 ? '+' : ''}{axis.gap.toFixed(1)}
                                    </span>
                                </div>

                                {/* Priority badge */}
                                <div className="px-4 py-3 flex items-center justify-center">
                                    <span 
                                        className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-white"
                                        style={{ backgroundColor: axis.priority.color }}
                                    >
                                        {isPolish ? axis.priority.labelPl : axis.priority.labelEn}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm">
                {PRIORITIES.map((priority) => (
                    <div key={priority.id} className="flex items-center gap-2">
                        <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: priority.color }}
                        />
                        <span className="text-slate-600 dark:text-slate-400">
                            {isPolish ? priority.labelPl : priority.labelEn}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs">
                            ({priority.description})
                        </span>
                    </div>
                ))}
            </div>

            {/* Detail modal */}
            <AnimatePresence>
                {selectedCell && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setSelectedCell(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-navy-800 rounded-2xl shadow-2xl max-w-lg w-full p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {(() => {
                                const axis = processedData.find(d => d.axisId === selectedCell.axisId);
                                if (!axis) return null;

                                return (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{axis.icon}</span>
                                                <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                                                    {axis.name}
                                                </h3>
                                            </div>
                                            <button
                                                onClick={() => setSelectedCell(null)}
                                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 mb-6">
                                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                                                <div className="text-2xl font-bold text-blue-600">{axis.actual.toFixed(1)}</div>
                                                <div className="text-xs text-slate-500">{isPolish ? 'Aktualny' : 'Actual'}</div>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 dark:bg-green-500/10 rounded-xl">
                                                <div className="text-2xl font-bold text-green-600">{axis.target.toFixed(1)}</div>
                                                <div className="text-xs text-slate-500">{isPolish ? 'Docelowy' : 'Target'}</div>
                                            </div>
                                            <div 
                                                className="text-center p-4 rounded-xl"
                                                style={{ backgroundColor: axis.priority.bgColor }}
                                            >
                                                <div className="text-2xl font-bold" style={{ color: axis.priority.color }}>
                                                    +{axis.gap.toFixed(1)}
                                                </div>
                                                <div className="text-xs text-slate-500">{isPolish ? 'Luka' : 'Gap'}</div>
                                            </div>
                                        </div>

                                        <div 
                                            className="p-4 rounded-xl mb-4"
                                            style={{ 
                                                backgroundColor: axis.priority.bgColor,
                                                borderLeft: `4px solid ${axis.priority.color}`
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                {React.createElement(axis.priority.icon, { 
                                                    className: 'w-5 h-5',
                                                    style: { color: axis.priority.color }
                                                })}
                                                <span className="font-semibold" style={{ color: axis.priority.color }}>
                                                    {isPolish ? 'Priorytet' : 'Priority'}: {isPolish ? axis.priority.labelPl : axis.priority.labelEn}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                {axis.priority.description}
                                            </p>
                                        </div>

                                        {axis.justification && (
                                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                                                <h4 className="font-medium text-navy-900 dark:text-white mb-2">
                                                    {isPolish ? 'Uzasadnienie' : 'Justification'}
                                                </h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {axis.justification}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HeatmapMatrix;

