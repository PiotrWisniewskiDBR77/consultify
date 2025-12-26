/**
 * GanttChart
 * 
 * Interactive timeline visualization for transformation roadmap:
 * - Q1-Q4 quarters, expandable to months
 * - Phase duration bars with milestones
 * - Dependencies (connecting lines)
 * - Zoom levels: Month/Quarter/Year
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    Flag,
    CheckCircle,
    Clock,
    AlertCircle
} from 'lucide-react';

interface Phase {
    id: string;
    name: string;
    namePl: string;
    startMonth: number; // 1-24 (2 years)
    duration: number; // in months
    color: string;
    status?: 'completed' | 'in_progress' | 'pending' | 'at_risk';
    milestones?: Array<{
        month: number;
        label: string;
        labelPl: string;
    }>;
    dependencies?: string[]; // IDs of phases this depends on
}

interface GanttChartProps {
    phases?: Phase[];
    startYear?: number;
    className?: string;
}

// Default transformation phases
const DEFAULT_PHASES: Phase[] = [
    {
        id: 'foundation',
        name: 'Foundation',
        namePl: 'Fundamenty',
        startMonth: 1,
        duration: 6,
        color: '#3b82f6',
        status: 'in_progress',
        milestones: [
            { month: 2, label: 'Data Governance', labelPl: 'Data Governance' },
            { month: 4, label: 'Security Framework', labelPl: 'Framework Bezpieczeństwa' },
            { month: 6, label: 'Foundation Complete', labelPl: 'Zakończenie Fundamentów' }
        ]
    },
    {
        id: 'quick_wins',
        name: 'Quick Wins',
        namePl: 'Quick Wins',
        startMonth: 3,
        duration: 6,
        color: '#10b981',
        status: 'pending',
        dependencies: ['foundation'],
        milestones: [
            { month: 5, label: 'Process Automation', labelPl: 'Automatyzacja Procesów' },
            { month: 9, label: 'Quick Wins Delivered', labelPl: 'Quick Wins Dostarczone' }
        ]
    },
    {
        id: 'strategic',
        name: 'Strategic Initiatives',
        namePl: 'Inicjatywy Strategiczne',
        startMonth: 6,
        duration: 12,
        color: '#8b5cf6',
        status: 'pending',
        dependencies: ['foundation'],
        milestones: [
            { month: 10, label: 'Digital Products MVP', labelPl: 'MVP Produktów Cyfrowych' },
            { month: 14, label: 'New Business Models', labelPl: 'Nowe Modele Biznesowe' },
            { month: 18, label: 'Strategic Complete', labelPl: 'Strategia Zakończona' }
        ]
    },
    {
        id: 'ai_integration',
        name: 'AI Integration',
        namePl: 'Integracja AI',
        startMonth: 12,
        duration: 12,
        color: '#f59e0b',
        status: 'pending',
        dependencies: ['strategic'],
        milestones: [
            { month: 16, label: 'AI Pilots', labelPl: 'Piloty AI' },
            { month: 20, label: 'AI at Scale', labelPl: 'AI na Skalę' },
            { month: 24, label: 'Full AI Maturity', labelPl: 'Pełna Dojrzałość AI' }
        ]
    }
];

// Status icons and colors
const STATUS_CONFIG = {
    completed: { icon: CheckCircle, color: '#10b981', label: 'Completed', labelPl: 'Zakończone' },
    in_progress: { icon: Clock, color: '#3b82f6', label: 'In Progress', labelPl: 'W trakcie' },
    pending: { icon: Clock, color: '#94a3b8', label: 'Pending', labelPl: 'Oczekujące' },
    at_risk: { icon: AlertCircle, color: '#ef4444', label: 'At Risk', labelPl: 'Zagrożone' }
};

export const GanttChart: React.FC<GanttChartProps> = ({
    phases = DEFAULT_PHASES,
    startYear = new Date().getFullYear(),
    className = ''
}) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    const [zoom, setZoom] = useState<'month' | 'quarter' | 'year'>('quarter');
    const [scrollOffset, setScrollOffset] = useState(0);

    // Calculate timeline range
    const maxMonth = Math.max(...phases.map(p => p.startMonth + p.duration));
    const totalMonths = Math.ceil(maxMonth / 12) * 12; // Round to full years

    // Generate timeline headers
    const timelineHeaders = useMemo(() => {
        const headers: Array<{ label: string; span: number; key: string }> = [];

        if (zoom === 'month') {
            for (let m = 1; m <= totalMonths; m++) {
                const monthNames = isPolish 
                    ? ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']
                    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const year = startYear + Math.floor((m - 1) / 12);
                const monthIndex = (m - 1) % 12;
                headers.push({
                    label: `${monthNames[monthIndex]} ${year}`,
                    span: 1,
                    key: `m${m}`
                });
            }
        } else if (zoom === 'quarter') {
            for (let q = 0; q < totalMonths / 3; q++) {
                const year = startYear + Math.floor(q / 4);
                const quarter = (q % 4) + 1;
                headers.push({
                    label: `Q${quarter} ${year}`,
                    span: 3,
                    key: `q${q}`
                });
            }
        } else {
            for (let y = 0; y < totalMonths / 12; y++) {
                headers.push({
                    label: `${startYear + y}`,
                    span: 12,
                    key: `y${y}`
                });
            }
        }

        return headers;
    }, [zoom, totalMonths, startYear, isPolish]);

    // Cell width based on zoom
    const cellWidth = zoom === 'month' ? 60 : zoom === 'quarter' ? 120 : 200;
    const totalWidth = totalMonths * (zoom === 'month' ? cellWidth : zoom === 'quarter' ? cellWidth / 3 : cellWidth / 12);

    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-800/50">
                <h3 className="font-semibold text-navy-900 dark:text-white">
                    {isPolish ? 'Roadmapa Transformacji' : 'Transformation Roadmap'}
                </h3>
                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="flex items-center bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-white/10">
                        <button
                            onClick={() => setZoom('year')}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                zoom === 'year' 
                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {isPolish ? 'Rok' : 'Year'}
                        </button>
                        <button
                            onClick={() => setZoom('quarter')}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors border-x border-slate-200 dark:border-white/10 ${
                                zoom === 'quarter' 
                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {isPolish ? 'Kwartał' : 'Quarter'}
                        </button>
                        <button
                            onClick={() => setZoom('month')}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                zoom === 'month' 
                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {isPolish ? 'Miesiąc' : 'Month'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 flex items-center gap-6 text-xs">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: config.color }}
                        />
                        <span className="text-slate-600 dark:text-slate-400">
                            {isPolish ? config.labelPl : config.label}
                        </span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <Flag className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-600 dark:text-slate-400">
                        {isPolish ? 'Kamień milowy' : 'Milestone'}
                    </span>
                </div>
            </div>

            {/* Chart area */}
            <div className="overflow-x-auto">
                <div style={{ minWidth: totalWidth + 200 }}>
                    {/* Timeline header */}
                    <div className="flex border-b border-slate-200 dark:border-white/10">
                        <div className="w-48 flex-shrink-0 px-4 py-2 bg-slate-50 dark:bg-navy-800/50 font-medium text-sm text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-white/10">
                            {isPolish ? 'Faza' : 'Phase'}
                        </div>
                        <div className="flex">
                            {timelineHeaders.map((header) => (
                                <div
                                    key={header.key}
                                    className="flex-shrink-0 px-2 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/5"
                                    style={{ width: cellWidth * header.span / (zoom === 'month' ? 1 : zoom === 'quarter' ? 3 : 12) }}
                                >
                                    {header.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Phase rows */}
                    {phases.map((phase, phaseIndex) => {
                        const status = STATUS_CONFIG[phase.status || 'pending'];
                        const barStart = ((phase.startMonth - 1) / totalMonths) * 100;
                        const barWidth = (phase.duration / totalMonths) * 100;

                        return (
                            <motion.div
                                key={phase.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: phaseIndex * 0.1 }}
                                className="flex border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                {/* Phase name */}
                                <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-slate-200 dark:border-white/10">
                                    <div className="flex items-center gap-2">
                                        {React.createElement(status.icon, {
                                            className: 'w-4 h-4',
                                            style: { color: status.color }
                                        })}
                                        <div>
                                            <p className="font-medium text-sm text-navy-900 dark:text-white">
                                                {isPolish ? phase.namePl : phase.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {phase.duration} {isPolish ? 'mies.' : 'mo.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline bar area */}
                                <div className="flex-1 relative py-2" style={{ minWidth: totalWidth }}>
                                    {/* Grid lines */}
                                    <div className="absolute inset-0 flex">
                                        {timelineHeaders.map((header, i) => (
                                            <div
                                                key={header.key}
                                                className="flex-shrink-0 border-r border-slate-100 dark:border-white/5"
                                                style={{ width: cellWidth * header.span / (zoom === 'month' ? 1 : zoom === 'quarter' ? 3 : 12) }}
                                            />
                                        ))}
                                    </div>

                                    {/* Phase bar */}
                                    <motion.div
                                        className="absolute h-8 rounded-lg flex items-center px-2 shadow-sm"
                                        style={{
                                            left: `${barStart}%`,
                                            width: `${barWidth}%`,
                                            backgroundColor: phase.color,
                                            top: '50%',
                                            transform: 'translateY(-50%)'
                                        }}
                                        initial={{ scaleX: 0, originX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: 0.3 + phaseIndex * 0.1, duration: 0.5 }}
                                    >
                                        <span className="text-xs font-medium text-white truncate">
                                            {isPolish ? phase.namePl : phase.name}
                                        </span>
                                    </motion.div>

                                    {/* Milestones */}
                                    {phase.milestones?.map((milestone, i) => {
                                        const milestonePos = ((milestone.month - 1) / totalMonths) * 100;
                                        return (
                                            <div
                                                key={i}
                                                className="absolute top-1/2 -translate-y-1/2 z-10 group"
                                                style={{ left: `${milestonePos}%` }}
                                            >
                                                <div 
                                                    className="w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center cursor-pointer transform hover:scale-125 transition-transform"
                                                    style={{ borderColor: phase.color }}
                                                >
                                                    <Flag className="w-2 h-2" style={{ color: phase.color }} />
                                                </div>
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-navy-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    {isPolish ? milestone.labelPl : milestone.label}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Summary footer */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                        {isPolish ? 'Całkowity czas transformacji' : 'Total transformation time'}: <strong className="text-navy-900 dark:text-white">{maxMonth} {isPolish ? 'miesięcy' : 'months'}</strong>
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                        {phases.length} {isPolish ? 'faz' : 'phases'} • {phases.reduce((sum, p) => sum + (p.milestones?.length || 0), 0)} {isPolish ? 'kamieni milowych' : 'milestones'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;

