/**
 * ExecutionScoreCard - Personal execution score display
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Flame, Target, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExecutionScore, ExecutionScoreCardProps } from '../../../types/myWork';
import { useExecutionScore } from '../../../hooks/useExecutionScore';

/**
 * ExecutionScoreCard Component
 */
export const ExecutionScoreCard: React.FC<Partial<ExecutionScoreCardProps> & { className?: string }> = ({
    score: externalScore,
    showTrend = true,
    showRank = false,
    showStreak = true,
    compact = false,
    className = ''
}) => {
    const { t } = useTranslation();
    const { score: hookScore, loading } = useExecutionScore({ autoLoad: !externalScore });
    
    const score = externalScore || hookScore;
    
    if (loading && !score) {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-xl p-6 animate-pulse ${className}`}>
                <div className="h-8 bg-slate-200 dark:bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-16 bg-slate-200 dark:bg-white/10 rounded w-1/2" />
            </div>
        );
    }
    
    if (!score) {
        return null;
    }
    
    const currentScore = score.current;
    const trend = score.trend;
    const vsLastWeek = score.vsLastWeek;
    const streak = score.streak?.current || 0;
    
    // Score color based on value
    const getScoreColor = (value: number) => {
        if (value >= 80) return 'text-green-500';
        if (value >= 60) return 'text-blue-500';
        if (value >= 40) return 'text-amber-500';
        return 'text-red-500';
    };
    
    // Trend icon
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400';
    
    if (compact) {
        return (
            <div className={`flex items-center gap-4 p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 ${className}`}>
                {/* Score */}
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${getScoreColor(currentScore)}`}>
                        {currentScore}
                    </span>
                    <span className="text-sm text-slate-400">/100</span>
                </div>
                
                {/* Trend */}
                {showTrend && (
                    <div className={`flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon size={16} />
                        <span className="text-xs font-medium">
                            {vsLastWeek > 0 ? '+' : ''}{vsLastWeek}
                        </span>
                    </div>
                )}
                
                {/* Streak */}
                {showStreak && streak > 0 && (
                    <div className="streak-badge">
                        <Flame size={12} />
                        {streak}
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 ${className}`}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        {t('myWork.dashboard.executionScore', 'Execution Score')}
                    </h3>
                    <div className="flex items-baseline gap-2">
                        <motion.span 
                            className={`text-4xl font-bold ${getScoreColor(currentScore)}`}
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                        >
                            {currentScore}
                        </motion.span>
                        <span className="text-lg text-slate-400">/100</span>
                    </div>
                </div>
                
                {/* Score Ring */}
                <div 
                    className="w-16 h-16 execution-score-ring flex items-center justify-center"
                    style={{ '--score-percent': `${currentScore}%` } as React.CSSProperties}
                >
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-navy-900 flex items-center justify-center">
                        <Target size={20} className={getScoreColor(currentScore)} />
                    </div>
                </div>
            </div>
            
            {/* Trend & Stats Row */}
            <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                {/* Trend */}
                {showTrend && (
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${
                            trend === 'up' ? 'bg-green-100 dark:bg-green-900/30' :
                            trend === 'down' ? 'bg-red-100 dark:bg-red-900/30' :
                            'bg-slate-100 dark:bg-white/5'
                        }`}>
                            <TrendIcon size={14} className={trendColor} />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${trendColor}`}>
                                {vsLastWeek > 0 ? '+' : ''}{vsLastWeek}%
                            </p>
                            <p className="text-[10px] text-slate-400">vs last week</p>
                        </div>
                    </div>
                )}
                
                {/* Streak */}
                {showStreak && (
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${
                            streak > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-slate-100 dark:bg-white/5'
                        }`}>
                            <Flame size={14} className={streak > 0 ? 'text-orange-500' : 'text-slate-400'} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-navy-900 dark:text-white">
                                {streak} {t('myWork.dashboard.days', 'days')}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                {t('myWork.dashboard.streak', 'streak')}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Rank */}
                {showRank && score.rank && (
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <Award size={14} className="text-purple-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-navy-900 dark:text-white">
                                Top {score.rank.percentile}%
                            </p>
                            <p className="text-[10px] text-slate-400">
                                #{score.rank.position} of {score.rank.totalInTeam}
                            </p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Score Breakdown (optional) */}
            {score.breakdown && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <div className="grid grid-cols-4 gap-2">
                        {Object.entries(score.breakdown).map(([key, value]) => (
                            <div key={key} className="text-center">
                                <p className="text-xs text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                <p className="text-sm font-semibold text-navy-900 dark:text-white">{value}%</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExecutionScoreCard;

