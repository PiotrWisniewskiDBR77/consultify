/**
 * Response Quality Indicator
 *
 * Visual indicator showing AI response quality metrics:
 * - Relevance score
 * - Groundedness (hallucination check)
 * - Completeness
 * - Overall quality
 *
 * Part of UX Excellence - Phase 4.4
 */

import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileCheck,
    Info,
    Shield,
    Sparkles,
    Target,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';

interface QualityMetrics {
    relevance: number;
    completeness: number;
    groundedness: number;
    coherence: number;
    overall: number;
    qualityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    recommendation?: string;
}

interface ResponseQualityIndicatorProps {
    messageId: string;
    metrics?: QualityMetrics | null;
    loading?: boolean;
    compact?: boolean;
    showDetails?: boolean;
    className?: string;
}

const DEFAULT_METRICS: QualityMetrics = {
    relevance: 0,
    completeness: 0,
    groundedness: 0,
    coherence: 0,
    overall: 0,
    qualityLevel: 'FAIR',
};

export const ResponseQualityIndicator: React.FC<ResponseQualityIndicatorProps> = ({
    messageId,
    metrics = DEFAULT_METRICS,
    loading = false,
    compact = false,
    showDetails: initialShowDetails = false,
    className = '',
}) => {
    const { t } = useTranslation();
    const [showDetails, setShowDetails] = useState(initialShowDetails);
    const [animatedScore, setAnimatedScore] = useState(0);

    // Animate score on mount
    useEffect(() => {
        if (metrics?.overall) {
            const target = Math.round(metrics.overall * 100);
            const duration = 1000;
            const steps = 20;
            const increment = target / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    setAnimatedScore(target);
                    clearInterval(timer);
                } else {
                    setAnimatedScore(Math.round(current));
                }
            }, duration / steps);

            return () => clearInterval(timer);
        }
        return undefined;
    }, [metrics?.overall]);

    const getQualityColor = (level: string) => {
        switch (level) {
            case 'EXCELLENT':
                return {
                    bg: 'bg-green-50 dark:bg-green-900/20',
                    border: 'border-green-200 dark:border-green-800',
                    text: 'text-green-700 dark:text-green-400',
                    icon: CheckCircle2,
                };
            case 'GOOD':
                return {
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                    border: 'border-blue-200 dark:border-blue-800',
                    text: 'text-blue-700 dark:text-blue-400',
                    icon: CheckCircle2,
                };
            case 'FAIR':
                return {
                    bg: 'bg-amber-50 dark:bg-amber-900/20',
                    border: 'border-amber-200 dark:border-amber-800',
                    text: 'text-amber-700 dark:text-amber-400',
                    icon: AlertTriangle,
                };
            case 'POOR':
                return {
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    border: 'border-red-200 dark:border-red-800',
                    text: 'text-red-700 dark:text-red-400',
                    icon: AlertCircle,
                };
            default:
                return {
                    bg: 'bg-gray-50 dark:bg-gray-900/20',
                    border: 'border-gray-200 dark:border-gray-800',
                    text: 'text-gray-700 dark:text-gray-400',
                    icon: Info,
                };
        }
    };

    const formatScore = (score: number) => Math.round(score * 100);

    const getScoreColor = (score: number) => {
        if (score >= 0.9) return 'text-green-600 dark:text-green-400';
        if (score >= 0.7) return 'text-blue-600 dark:text-blue-400';
        if (score >= 0.5) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    const qualityStyle = getQualityColor(metrics?.qualityLevel || 'FAIR');
    const QualityIcon = qualityStyle.icon;

    if (loading) {
        return (
            <div className={cn('animate-pulse flex items-center gap-2', className)}>
                <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
        );
    }

    if (!metrics) {
        return null;
    }

    // Compact view - just the badge
    if (compact) {
        return (
            <div
                className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                    qualityStyle.bg,
                    qualityStyle.text,
                    className,
                )}
                title={t('quality.overallScore', 'Quality Score: {{score}}%', { score: animatedScore })}
            >
                <QualityIcon size={12} />
                <span>{animatedScore}%</span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'rounded-lg border transition-all duration-200',
                qualityStyle.bg,
                qualityStyle.border,
                className,
            )}
        >
            {/* Header */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
                aria-expanded={showDetails}
                aria-controls={`quality-details-${messageId}`}
            >
                <div className="flex items-center gap-2">
                    <QualityIcon size={16} className={qualityStyle.text} />
                    <span className={cn('text-sm font-medium', qualityStyle.text)}>
                        {t(`quality.level.${metrics.qualityLevel}`, metrics.qualityLevel)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({animatedScore}%)</span>
                </div>
                {showDetails ? (
                    <ChevronUp size={14} className="text-gray-400" />
                ) : (
                    <ChevronDown size={14} className="text-gray-400" />
                )}
            </button>

            {/* Details panel */}
            {showDetails && (
                <div
                    id={`quality-details-${messageId}`}
                    className="px-3 pb-3 space-y-3 border-t border-gray-200/50 dark:border-gray-700/50"
                >
                    {/* Metric bars */}
                    <div className="space-y-2 pt-2">
                        {/* Relevance */}
                        <div className="flex items-center gap-2">
                            <Target size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-24">
                                {t('quality.relevance', 'Relevance')}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                                    style={{ width: `${formatScore(metrics.relevance)}%` }}
                                />
                            </div>
                            <span
                                className={cn('text-xs font-medium w-8 text-right', getScoreColor(metrics.relevance))}
                            >
                                {formatScore(metrics.relevance)}%
                            </span>
                        </div>

                        {/* Groundedness */}
                        <div className="flex items-center gap-2">
                            <Shield size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-24">
                                {t('quality.groundedness', 'Groundedness')}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                                    style={{ width: `${formatScore(metrics.groundedness)}%` }}
                                />
                            </div>
                            <span
                                className={cn(
                                    'text-xs font-medium w-8 text-right',
                                    getScoreColor(metrics.groundedness),
                                )}
                            >
                                {formatScore(metrics.groundedness)}%
                            </span>
                        </div>

                        {/* Completeness */}
                        <div className="flex items-center gap-2">
                            <FileCheck size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-24">
                                {t('quality.completeness', 'Completeness')}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                    style={{ width: `${formatScore(metrics.completeness)}%` }}
                                />
                            </div>
                            <span
                                className={cn(
                                    'text-xs font-medium w-8 text-right',
                                    getScoreColor(metrics.completeness),
                                )}
                            >
                                {formatScore(metrics.completeness)}%
                            </span>
                        </div>

                        {/* Coherence */}
                        <div className="flex items-center gap-2">
                            <Sparkles size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-24">
                                {t('quality.coherence', 'Coherence')}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                    style={{ width: `${formatScore(metrics.coherence)}%` }}
                                />
                            </div>
                            <span
                                className={cn('text-xs font-medium w-8 text-right', getScoreColor(metrics.coherence))}
                            >
                                {formatScore(metrics.coherence)}%
                            </span>
                        </div>
                    </div>

                    {/* Recommendation */}
                    {metrics.recommendation && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100/50 dark:bg-gray-800/50 rounded px-2 py-1.5">
                            <Info size={10} className="inline mr-1" />
                            {metrics.recommendation}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500 dark:text-gray-500 pt-1">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {t('quality.excellent', 'Excellent')} (90%+)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {t('quality.good', 'Good')} (70%+)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            {t('quality.fair', 'Fair')} (50%+)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResponseQualityIndicator;
