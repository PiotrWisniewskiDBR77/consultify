/**
 * PortfolioHealthScore - Executive-grade health score visualization
 * BCG/McKinsey style: Large, prominent, data-dense
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Target,
    Zap
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HealthBreakdown {
    execution: number;      // Task completion rate
    decisions: number;      // Decision velocity
    capacity: number;       // Team utilization
    risk: number;           // Risk mitigation
}

interface PortfolioHealthProps {
    score?: number;
    previousScore?: number;
    breakdown?: HealthBreakdown;
    trend?: 'up' | 'down' | 'stable';
    loading?: boolean;
    compact?: boolean;
}

// Animated number counter
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ 
    value, 
    duration = 1000 
}) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            setDisplayValue(Math.floor(easeOutQuart * value));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <span>{displayValue}</span>;
};

// Score ring SVG component
const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 200 }) => {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const getScoreColor = (value: number) => {
        if (value >= 80) return '#10B981'; // Emerald
        if (value >= 60) return '#06B6D4'; // Cyan
        if (value >= 40) return '#F59E0B'; // Amber
        return '#F43F5E'; // Rose
    };

    const getGlowColor = (value: number) => {
        if (value >= 80) return 'rgba(16, 185, 129, 0.4)';
        if (value >= 60) return 'rgba(6, 182, 212, 0.4)';
        if (value >= 40) return 'rgba(245, 158, 11, 0.4)';
        return 'rgba(244, 63, 94, 0.4)';
    };

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            {/* Background ring */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-200 dark:text-white/10"
            />
            {/* Score ring with glow */}
            <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={getScoreColor(score)}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{
                    filter: `drop-shadow(0 0 8px ${getGlowColor(score)})`
                }}
            />
        </svg>
    );
};

// Breakdown bar component
const BreakdownBar: React.FC<{ 
    label: string; 
    value: number; 
    icon: React.ReactNode;
    color: string;
}> = ({ label, value, icon, color }) => {
    return (
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {label}
                    </span>
                    <span className="text-sm font-bold text-navy-900 dark:text-white tabular-nums">
                        {value}%
                    </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                            value >= 80 ? 'bg-emerald-500' :
                            value >= 60 ? 'bg-cyan-500' :
                            value >= 40 ? 'bg-amber-500' :
                            'bg-rose-500'
                        }`}
                    />
                </div>
            </div>
        </div>
    );
};

export const PortfolioHealthScore: React.FC<PortfolioHealthProps> = ({
    score = 0,
    previousScore,
    breakdown,
    trend = 'stable',
    loading = false,
    compact = false
}) => {
    const { t } = useTranslation();

    const scoreDiff = previousScore !== undefined ? score - previousScore : 0;
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-slate-400';

    const getScoreLabel = (value: number) => {
        if (value >= 80) return { label: t('executive.health.excellent', 'Excellent'), color: 'text-emerald-500' };
        if (value >= 60) return { label: t('executive.health.good', 'Good'), color: 'text-cyan-500' };
        if (value >= 40) return { label: t('executive.health.attention', 'Needs Attention'), color: 'text-amber-500' };
        return { label: t('executive.health.critical', 'Critical'), color: 'text-rose-500' };
    };

    const scoreInfo = getScoreLabel(score);

    if (loading) {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 ${compact ? 'p-4' : 'p-6'} animate-pulse`}>
                <div className="flex items-center justify-center">
                    <div className="w-48 h-48 rounded-full bg-slate-200 dark:bg-white/10" />
                </div>
            </div>
        );
    }

    if (compact) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-center gap-4"
            >
                <div className="relative">
                    <ScoreRing score={score} size={80} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-navy-900 dark:text-white tabular-nums">
                            <AnimatedNumber value={score} />
                        </span>
                    </div>
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                        {t('executive.health.portfolio', 'Portfolio Health')}
                    </p>
                    <p className={`text-sm font-semibold ${scoreInfo.color}`}>
                        {scoreInfo.label}
                    </p>
                    {scoreDiff !== 0 && (
                        <div className={`flex items-center gap-1 mt-1 ${trendColor}`}>
                            <TrendIcon size={12} />
                            <span className="text-xs font-medium">
                                {scoreDiff > 0 ? '+' : ''}{scoreDiff}%
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                            <Activity size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                {t('executive.health.title', 'Portfolio Health')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t('executive.health.subtitle', 'Overall execution performance')}
                            </p>
                        </div>
                    </div>
                    
                    {/* Trend Badge */}
                    {scoreDiff !== 0 && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                            trend === 'up' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                            trend === 'down' ? 'bg-rose-100 dark:bg-rose-900/30' :
                            'bg-slate-100 dark:bg-white/5'
                        }`}>
                            <TrendIcon size={14} className={trendColor} />
                            <span className={`text-sm font-semibold ${trendColor}`}>
                                {scoreDiff > 0 ? '+' : ''}{scoreDiff}%
                            </span>
                            <span className="text-xs text-slate-400">vs last week</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Score Display */}
            <div className="p-6">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                    {/* Score Ring */}
                    <div className="relative flex-shrink-0">
                        <ScoreRing score={score} size={200} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold text-navy-900 dark:text-white tabular-nums">
                                <AnimatedNumber value={score} duration={1500} />
                            </span>
                            <span className={`text-sm font-semibold mt-1 ${scoreInfo.color}`}>
                                {scoreInfo.label}
                            </span>
                        </div>
                    </div>

                    {/* Breakdown Grid */}
                    {breakdown && (
                        <div className="flex-1 w-full space-y-4">
                            <BreakdownBar
                                label={t('executive.health.execution', 'Execution')}
                                value={breakdown.execution}
                                icon={<Target size={16} className="text-white" />}
                                color="bg-emerald-500"
                            />
                            <BreakdownBar
                                label={t('executive.health.decisions', 'Decision Velocity')}
                                value={breakdown.decisions}
                                icon={<Zap size={16} className="text-white" />}
                                color="bg-cyan-500"
                            />
                            <BreakdownBar
                                label={t('executive.health.capacity', 'Team Capacity')}
                                value={breakdown.capacity}
                                icon={<CheckCircle2 size={16} className="text-white" />}
                                color="bg-violet-500"
                            />
                            <BreakdownBar
                                label={t('executive.health.risk', 'Risk Mitigation')}
                                value={breakdown.risk}
                                icon={<AlertTriangle size={16} className="text-white" />}
                                color="bg-amber-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Status */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                        {t('executive.health.lastUpdated', 'Last updated')}: {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {t('executive.health.live', 'Live')}
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

export default PortfolioHealthScore;









