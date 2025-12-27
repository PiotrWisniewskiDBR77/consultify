/**
 * WorkloadHeatmap - Team workload visualization
 * Part of My Work Module PMO Upgrade
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TeamWorkload, UserWorkload, WorkloadHeatmapProps } from '../../../types/myWork';

interface ExtendedWorkloadHeatmapProps extends Partial<WorkloadHeatmapProps> {
    className?: string;
    onUserClick?: (userId: string) => void;
}

/**
 * Get color class based on allocation percentage
 */
const getAllocationColor = (allocation: number): string => {
    if (allocation >= 100) return 'workload-overloaded';
    if (allocation >= 80) return 'workload-high';
    if (allocation >= 50) return 'workload-normal';
    return 'workload-available';
};

/**
 * Get text color based on allocation
 */
const getAllocationTextColor = (allocation: number): string => {
    if (allocation >= 100) return 'text-red-700 dark:text-red-300';
    if (allocation >= 80) return 'text-amber-700 dark:text-amber-300';
    if (allocation >= 50) return 'text-blue-700 dark:text-blue-300';
    return 'text-green-700 dark:text-green-300';
};

/**
 * User row in heatmap
 */
const UserWorkloadRow: React.FC<{
    user: UserWorkload;
    onClick?: () => void;
}> = ({ user, onClick }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
            onClick={onClick}
        >
            {/* Avatar */}
            <div className="shrink-0">
                {user.avatarUrl ? (
                    <img 
                        src={user.avatarUrl} 
                        alt={user.userName}
                        className="w-8 h-8 rounded-full"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {user.userName.charAt(0)}
                    </div>
                )}
            </div>
            
            {/* Name & Status */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                    {user.userName}
                </p>
                <p className="text-xs text-slate-500">
                    {user.taskCount} tasks • {user.hoursAllocated}h / {user.hoursCapacity}h
                </p>
            </div>
            
            {/* Daily heatmap cells */}
            <div className="flex gap-1">
                {user.dailyBreakdown?.slice(0, 7).map((day, idx) => (
                    <div
                        key={idx}
                        className={`w-6 h-6 rounded ${getAllocationColor(day.allocation)} flex items-center justify-center`}
                        title={`${new Date(day.date).toLocaleDateString()}: ${day.allocation}%`}
                    >
                        <span className={`text-[8px] font-bold ${getAllocationTextColor(day.allocation)}`}>
                            {day.taskCount}
                        </span>
                    </div>
                ))}
            </div>
            
            {/* Overall allocation */}
            <div className={`
                shrink-0 w-16 text-right
                ${getAllocationTextColor(user.allocation)}
            `}>
                <span className="text-sm font-semibold">{user.allocation}%</span>
            </div>
            
            {/* Status indicator */}
            {user.status === 'overloaded' && (
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
            )}
        </motion.div>
    );
};

/**
 * WorkloadHeatmap Component
 */
export const WorkloadHeatmap: React.FC<ExtendedWorkloadHeatmapProps> = ({
    workload,
    onUserClick,
    showLegend = true,
    className = ''
}) => {
    const { t } = useTranslation();
    
    // Mock data for demo purposes if no workload provided
    const displayWorkload: TeamWorkload = workload || {
        period: {
            start: new Date().toISOString().split('T')[0],
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        members: [],
        teamAverage: 0,
        overloadedCount: 0,
        underutilizedCount: 0
    };
    
    // Calculate day labels
    const dayLabels = useMemo(() => {
        const labels = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        }
        return labels;
    }, []);
    
    if (!displayWorkload.members || displayWorkload.members.length === 0) {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 ${className}`}>
                <div className="flex items-center gap-2 mb-4">
                    <Users size={18} className="text-slate-400" />
                    <h3 className="font-semibold text-navy-900 dark:text-white">
                        {t('myWork.dashboard.teamWorkload', 'Team Workload')}
                    </h3>
                </div>
                
                <div className="text-center py-8 text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('myWork.dashboard.noWorkloadData', 'No workload data available')}</p>
                    <p className="text-xs mt-1">{t('myWork.dashboard.addTeamMembers', 'Add team members to see workload')}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <Users size={18} className="text-slate-400" />
                    <h3 className="font-semibold text-navy-900 dark:text-white">
                        {t('myWork.dashboard.teamWorkload', 'Team Workload')}
                    </h3>
                </div>
                
                {/* Summary stats */}
                <div className="flex items-center gap-4 text-xs">
                    {displayWorkload.overloadedCount > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle size={12} />
                            {displayWorkload.overloadedCount} overloaded
                        </span>
                    )}
                    <span className="text-slate-500">
                        Avg: {displayWorkload.teamAverage}%
                    </span>
                </div>
            </div>
            
            {/* Day headers */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-white/5">
                <div className="w-8" /> {/* Avatar spacer */}
                <div className="flex-1" /> {/* Name spacer */}
                <div className="flex gap-1">
                    {dayLabels.map((day, idx) => (
                        <div key={idx} className="w-6 text-center">
                            <span className="text-[10px] text-slate-400">{day}</span>
                        </div>
                    ))}
                </div>
                <div className="w-16 text-right">
                    <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="w-4" /> {/* Status icon spacer */}
            </div>
            
            {/* User rows */}
            <div className="p-2 max-h-[300px] overflow-y-auto mywork-scrollbar">
                {displayWorkload.members.map((user) => (
                    <UserWorkloadRow
                        key={user.userId}
                        user={user}
                        onClick={() => onUserClick?.(user.userId)}
                    />
                ))}
            </div>
            
            {/* Legend */}
            {showLegend && (
                <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded workload-available" />
                        <span className="text-[10px] text-slate-500">Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded workload-normal" />
                        <span className="text-[10px] text-slate-500">Normal</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded workload-high" />
                        <span className="text-[10px] text-slate-500">High</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded workload-overloaded" />
                        <span className="text-[10px] text-slate-500">Overloaded</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkloadHeatmap;



