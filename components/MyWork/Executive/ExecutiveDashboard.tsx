/**
 * ExecutiveDashboard - Main executive command center
 * BCG/McKinsey style: Data-dense, scannable, actionable
 * 
 * Layout:
 * - Personalized greeting with date
 * - Portfolio Health Score (prominent)
 * - KPI Grid (4 quadrants)
 * - Action Required Strip
 * - Two-column: Decision Queue + Team Performance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    RefreshCw,
    Sun,
    Moon,
    Sunrise,
    Calendar,
    Bell,
    Settings,
    Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PortfolioHealthScore } from './PortfolioHealthScore';
import { KPIGrid } from './KPIGrid';
import { ActionRequiredStrip } from './ActionRequiredStrip';
import { DecisionQueuePreview } from './DecisionQueuePreview';
import { TeamPerformancePreview } from './TeamPerformancePreview';
import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import toast from 'react-hot-toast';

interface ExecutiveDashboardProps {
    onNavigate?: (section: string) => void;
    onDecisionApprove?: (id: string) => void;
    onDecisionReject?: (id: string) => void;
}

// Get greeting based on time of day
const getGreeting = (t: (key: string, fallback: string) => string): { text: string; icon: React.ReactNode } => {
    const hour = new Date().getHours();
    if (hour < 12) {
        return { 
            text: t('executive.greeting.morning', 'Good morning'), 
            icon: <Sunrise size={24} className="text-amber-500" /> 
        };
    }
    if (hour < 18) {
        return { 
            text: t('executive.greeting.afternoon', 'Good afternoon'), 
            icon: <Sun size={24} className="text-orange-500" /> 
        };
    }
    return { 
        text: t('executive.greeting.evening', 'Good evening'), 
        icon: <Moon size={24} className="text-indigo-500" /> 
    };
};

// Format date in BCG style (e.g., "Monday, December 29, 2024")
const formatDate = (): string => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
    onNavigate,
    onDecisionApprove,
    onDecisionReject
}) => {
    const { t } = useTranslation();
    const user = useAppStore(state => state.user);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Dashboard data state
    const [healthScore, setHealthScore] = useState({
        score: 0,
        previousScore: 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
        breakdown: {
            execution: 0,
            decisions: 0,
            capacity: 0,
            risk: 0
        }
    });

    const [kpiData, setKpiData] = useState({
        tasks: { completed: 0, total: 0, overdueCount: 0, onTimeRate: 0, trend: 'stable' as const },
        decisions: { pending: 0, avgWaitDays: 0, critical: 0, trend: 'stable' as const },
        team: { avgCapacity: 0, overloaded: 0, available: 0, trend: 'stable' as const },
        risk: { level: 'low' as const, blockers: 0, escalations: 0, trend: 'stable' as const }
    });

    const [actionItems, setActionItems] = useState<any[]>([]);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    const greeting = getGreeting(t);
    const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Executive';

    // Fetch dashboard data
    const fetchDashboardData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // Parallel API calls for performance
            const [statsRes, decisionsRes, teamRes, tasksRes] = await Promise.allSettled([
                Api.get('/my-work/stats?period=week'),
                Api.get('/decisions?status=PENDING&limit=10'),
                Api.get('/my-work/team-workload'),
                Api.getTasks({ assignedToMe: true, status: 'todo,in_progress' })
            ]);

            // Process stats
            if (statsRes.status === 'fulfilled' && statsRes.value) {
                const stats = statsRes.value;
                const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                
                setHealthScore({
                    score: Math.round((completionRate + (stats.onTimeRate || 70)) / 2),
                    previousScore: Math.round((completionRate + (stats.onTimeRate || 70)) / 2) - 5,
                    trend: stats.trend || 'stable',
                    breakdown: {
                        execution: completionRate,
                        decisions: 75, // Placeholder
                        capacity: 82,  // Placeholder
                        risk: 68       // Placeholder
                    }
                });

                setKpiData(prev => ({
                    ...prev,
                    tasks: {
                        completed: stats.completed || 0,
                        total: stats.total || 0,
                        overdueCount: stats.byStatus?.overdue || 0,
                        onTimeRate: stats.onTimeRate || 0,
                        trend: stats.trend || 'stable'
                    }
                }));
            }

            // Process decisions
            if (decisionsRes.status === 'fulfilled' && decisionsRes.value) {
                const decisionList = Array.isArray(decisionsRes.value) ? decisionsRes.value : [];
                const pendingDecisions = decisionList.filter((d: any) => d.status === 'PENDING');
                
                setDecisions(pendingDecisions.map((d: any) => ({
                    id: d.id,
                    title: d.title,
                    type: d.decisionType || 'GENERAL',
                    priority: d.priority?.toLowerCase() || 'medium',
                    daysWaiting: Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
                    requestedBy: d.requestedByName,
                    projectName: d.projectName
                })));

                const criticalCount = pendingDecisions.filter((d: any) => d.priority === 'CRITICAL').length;
                setKpiData(prev => ({
                    ...prev,
                    decisions: {
                        pending: pendingDecisions.length,
                        avgWaitDays: 2.4,
                        critical: criticalCount,
                        trend: 'stable'
                    }
                }));

                // Build action items from critical decisions
                const urgentItems = pendingDecisions
                    .filter((d: any) => d.priority === 'CRITICAL' || d.priority === 'HIGH')
                    .slice(0, 3)
                    .map((d: any) => ({
                        id: d.id,
                        type: 'decision',
                        title: d.title,
                        urgency: d.priority === 'CRITICAL' ? 'critical' : 'high',
                        projectName: d.projectName,
                        owner: d.requestedByName,
                        daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)) - 7)
                    }));
                
                setActionItems(urgentItems);
            }

            // Process team data
            if (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)) {
                setTeamMembers(teamRes.value.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    initials: m.initials || m.name.split(' ').map((n: string) => n[0]).join(''),
                    capacity: m.capacity || 80,
                    tasksCompleted: m.tasksCompleted || 0,
                    tasksTotal: m.tasksAssigned || 0,
                    trend: 'stable'
                })));

                const avgCapacity = Math.round(
                    teamRes.value.reduce((sum: number, m: any) => sum + (m.capacity || 80), 0) / teamRes.value.length
                );
                const overloadedCount = teamRes.value.filter((m: any) => (m.capacity || 0) > 100).length;
                const availableCount = teamRes.value.filter((m: any) => (m.capacity || 100) < 50).length;

                setKpiData(prev => ({
                    ...prev,
                    team: {
                        avgCapacity,
                        overloaded: overloadedCount,
                        available: availableCount,
                        trend: 'stable'
                    }
                }));
            }

            // Process tasks for risk assessment
            if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
                const overdueTasks = tasksRes.value.filter((t: any) => {
                    if (!t.dueDate) return false;
                    return new Date(t.dueDate) < new Date();
                });
                
                const riskLevel = overdueTasks.length > 5 ? 'high' : 
                                  overdueTasks.length > 2 ? 'medium' : 'low';

                setKpiData(prev => ({
                    ...prev,
                    risk: {
                        level: riskLevel as any,
                        blockers: overdueTasks.length,
                        escalations: prev.risk.escalations,
                        trend: 'stable'
                    }
                }));
            }

            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            // Use mock data on error
            setHealthScore({
                score: 76,
                previousScore: 71,
                trend: 'up',
                breakdown: { execution: 78, decisions: 72, capacity: 82, risk: 68 }
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
        
        // Auto-refresh every 5 minutes
        const interval = setInterval(() => {
            fetchDashboardData(true);
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    // Handle decision actions
    const handleApprove = async (id: string) => {
        try {
            await Api.put(`/decisions/${id}/decide`, { status: 'APPROVED', outcome: '' });
            toast.success(t('executive.decisions.approved', 'Decision approved'));
            onDecisionApprove?.(id);
            fetchDashboardData(true);
        } catch (error) {
            toast.error(t('executive.decisions.error', 'Failed to approve'));
        }
    };

    const handleReject = async (id: string) => {
        try {
            await Api.put(`/decisions/${id}/decide`, { status: 'REJECTED', outcome: '' });
            toast.success(t('executive.decisions.rejected', 'Decision rejected'));
            onDecisionReject?.(id);
            fetchDashboardData(true);
        } catch (error) {
            toast.error(t('executive.decisions.error', 'Failed to reject'));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Greeting */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/30">
                        {greeting.icon}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            {greeting.text}, {userName}
                            <Sparkles size={20} className="text-amber-500" />
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Calendar size={14} />
                            {formatDate()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Last updated indicator */}
                    <span className="text-xs text-slate-400 mr-2">
                        {t('executive.lastUpdated', 'Updated')}: {lastUpdated.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    {/* Refresh button */}
                    <button
                        onClick={() => fetchDashboardData(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                        title={t('executive.refresh', 'Refresh')}
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </motion.div>

            {/* Portfolio Health + KPI Grid Row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Portfolio Health Score - Takes 1/3 on large screens */}
                <div className="xl:col-span-1">
                    <PortfolioHealthScore
                        score={healthScore.score}
                        previousScore={healthScore.previousScore}
                        trend={healthScore.trend}
                        breakdown={healthScore.breakdown}
                        loading={loading}
                    />
                </div>

                {/* KPI Grid - Takes 2/3 on large screens */}
                <div className="xl:col-span-2">
                    <KPIGrid
                        data={kpiData}
                        loading={loading}
                        onNavigate={onNavigate}
                    />
                </div>
            </div>

            {/* Action Required Strip */}
            <ActionRequiredStrip
                items={actionItems}
                loading={loading}
                onApprove={handleApprove}
                onReject={handleReject}
                onViewAll={() => onNavigate?.('inbox')}
                onItemClick={(item) => {
                    if (item.type === 'decision') {
                        onNavigate?.('decisions');
                    } else {
                        onNavigate?.('tasks');
                    }
                }}
            />

            {/* Two-Column: Decisions + Team Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DecisionQueuePreview
                    decisions={decisions}
                    loading={loading}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewAll={() => onNavigate?.('decisions')}
                    onDecisionClick={(id) => onNavigate?.('decisions')}
                />

                <TeamPerformancePreview
                    members={teamMembers}
                    loading={loading}
                    onViewAll={() => onNavigate?.('team')}
                    onMemberClick={(id) => onNavigate?.('team')}
                />
            </div>
        </div>
    );
};

export default ExecutiveDashboard;

