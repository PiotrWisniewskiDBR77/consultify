/**
 * WorkloadView - Team capacity heatmap
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Team member capacity visualization
 * - Workload status indicators
 * - Overload warnings
 * - Team average summary
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    AlertTriangle,
    CheckCircle2,
    User,
    Loader2,
    RefreshCw,
    BarChart3
} from 'lucide-react';
import { Api } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

interface TeamMember {
    id: string;
    name: string;
    initials: string;
    role: string;
    capacity: number; // Percentage 0-150+
    tasksAssigned: number;
    tasksCompleted: number;
    avatarUrl?: string;
}

/**
 * Capacity Bar Component
 */
const CapacityBar: React.FC<{ capacity: number }> = ({ capacity }) => {
    const getCapacityColor = (value: number) => {
        if (value > 100) return 'bg-red-500';
        if (value > 80) return 'bg-orange-500';
        if (value > 50) return 'bg-blue-500';
        return 'bg-green-500';
    };

    return (
        <div className="flex-1 h-6 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden relative">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(capacity, 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${getCapacityColor(capacity)} rounded-full`}
            />
            {capacity > 100 && (
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(capacity - 100, 50)}%` }}
                    transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
                    className="absolute top-0 right-0 h-full bg-red-300 dark:bg-red-700 opacity-50"
                    style={{ width: `${Math.min(capacity - 100, 50)}%` }}
                />
            )}
        </div>
    );
};

/**
 * Status Badge Component
 */
const StatusBadge: React.FC<{ capacity: number }> = ({ capacity }) => {
    const { t } = useTranslation();
    
    if (capacity > 100) {
        return (
            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium flex items-center gap-1">
                <AlertTriangle size={10} />
                {t('workload.overloaded', 'Overloaded')}
            </span>
        );
    }
    if (capacity < 50) {
        return (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={10} />
                {t('workload.available', 'Available')}
            </span>
        );
    }
    return (
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 font-medium">
            {t('workload.ok', 'OK')}
        </span>
    );
};

/**
 * Team Member Row Component
 */
const TeamMemberRow: React.FC<{ member: TeamMember }> = ({ member }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 hover:shadow-sm transition-shadow"
        >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                    member.initials
                )}
            </div>

            {/* Name & Role */}
            <div className="w-32 min-w-0 shrink-0">
                <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                    {member.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {member.role}
                </p>
            </div>

            {/* Capacity Bar */}
            <CapacityBar capacity={member.capacity} />

            {/* Percentage */}
            <span className={`w-14 text-sm font-bold text-right shrink-0 ${
                member.capacity > 100 ? 'text-red-500' : 
                member.capacity > 80 ? 'text-orange-500' : 
                'text-navy-900 dark:text-white'
            }`}>
                {member.capacity}%
            </span>

            {/* Status */}
            <div className="w-24 shrink-0">
                <StatusBadge capacity={member.capacity} />
            </div>

            {/* Tasks */}
            <div className="text-right shrink-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {member.tasksCompleted}/{member.tasksAssigned}
                </p>
            </div>
        </motion.div>
    );
};

/**
 * WorkloadView Component - Main Export
 */
export const WorkloadView: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    
    const currentProjectId = useAppStore(state => state.currentProjectId);

    useEffect(() => {
        fetchWorkload();
    }, [currentProjectId]);

    const fetchWorkload = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            
            const url = currentProjectId 
                ? `/my-work/team-workload?projectId=${currentProjectId}`
                : `/my-work/team-workload`;
            
            const response = await Api.get(url);
            if (response && Array.isArray(response)) {
                setTeamMembers(response);
            }
        } catch (error) {
            console.error('Failed to fetch workload:', error);
            // Use mock data for demo
            setTeamMembers([
                { id: '1', name: 'Anna Kowalska', initials: 'AK', role: 'Project Manager', capacity: 95, tasksAssigned: 8, tasksCompleted: 6 },
                { id: '2', name: 'Piotr Nowak', initials: 'PN', role: 'Developer', capacity: 120, tasksAssigned: 12, tasksCompleted: 5 },
                { id: '3', name: 'Marta Wiśniewska', initials: 'MW', role: 'Designer', capacity: 65, tasksAssigned: 5, tasksCompleted: 3 },
                { id: '4', name: 'Jan Kowalczyk', initials: 'JK', role: 'Analyst', capacity: 40, tasksAssigned: 3, tasksCompleted: 2 },
                { id: '5', name: 'Karolina Mazur', initials: 'KM', role: 'QA Engineer', capacity: 85, tasksAssigned: 7, tasksCompleted: 4 },
            ]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Calculate team stats
    const avgCapacity = teamMembers.length > 0 
        ? Math.round(teamMembers.reduce((sum, m) => sum + m.capacity, 0) / teamMembers.length)
        : 0;
    const overloadedCount = teamMembers.filter(m => m.capacity > 100).length;
    const availableCount = teamMembers.filter(m => m.capacity < 50).length;

    if (loading) {
        return (
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 p-8 flex items-center justify-center">
                <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-lg shadow-sm">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-navy-900 dark:text-white">
                                {t('workload.title', 'Team Workload')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {teamMembers.length} {t('workload.members', 'team members')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchWorkload(true)}
                        disabled={refreshing}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="p-5 border-b border-slate-200 dark:border-white/5">
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            {t('workload.avgCapacity', 'Avg Capacity')}
                        </p>
                        <p className={`text-2xl font-bold ${
                            avgCapacity > 80 ? 'text-orange-500' : 'text-navy-900 dark:text-white'
                        }`}>
                            {avgCapacity}%
                        </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                            {t('workload.overloaded', 'Overloaded')}
                        </p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {overloadedCount}
                        </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
                            {t('workload.available', 'Available')}
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {availableCount}
                        </p>
                    </div>
                </div>
            </div>

            {/* Team Members List */}
            <div className="p-5">
                {teamMembers.length > 0 ? (
                    <div className="space-y-2">
                        {/* Header Row */}
                        <div className="flex items-center gap-4 px-3 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <div className="w-10 shrink-0"></div>
                            <div className="w-32 shrink-0">{t('workload.member', 'Member')}</div>
                            <div className="flex-1">{t('workload.capacity', 'Capacity')}</div>
                            <div className="w-14 text-right shrink-0">%</div>
                            <div className="w-24 shrink-0">{t('workload.status', 'Status')}</div>
                            <div className="text-right shrink-0">{t('workload.tasks', 'Tasks')}</div>
                        </div>
                        
                        {/* Member Rows */}
                        {teamMembers.map((member, index) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <TeamMemberRow member={member} />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400">
                        <User size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">{t('workload.noMembers', 'No team members found')}</p>
                    </div>
                )}
            </div>

            {/* Team Summary Footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-navy-800/50 rounded-b-2xl">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                        {t('workload.teamAverage', 'Team Average')}:
                    </span>
                    <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${
                                    avgCapacity > 100 ? 'bg-red-500' :
                                    avgCapacity > 80 ? 'bg-orange-500' :
                                    'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(avgCapacity, 100)}%` }}
                            />
                        </div>
                        <span className="font-bold text-navy-900 dark:text-white">
                            {avgCapacity}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkloadView;
