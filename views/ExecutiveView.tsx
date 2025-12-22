import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { useUserCan } from '../hooks/useUserCan';
import { SplitLayout } from '../components/SplitLayout';
import {
    Eye, AlertTriangle, CheckCircle2, Clock, Target, Flag,
`'ChevronRight'`
} from 'lucide-react';

/**
 * Step D: Executive View - Read-only reporting view for executives
 * Shows status, risks, decisions, schedule at a glance
 * No edit/delete/approve buttons - completely read-only
 */

interface PMOHealthSnapshot {
    projectId: string;
    projectName: string;
    phase: { number: number; name: string };
    stageGate: {
        gateType: string | null;
        isReady: boolean;
        missingCriteria: Array<{ criterion: string; evidence?: string }>;
        metCriteria: Array<{ criterion: string; evidence?: string }>;
    };
    blockers: Array<{ type: string; message: string; ref?: { entityType: string; entityId: string } }>;
    tasks: { overdueCount: number; dueSoonCount: number; blockedCount: number };
    decisions: { pendingCount: number; overdueCount: number };
    initiatives: { atRiskCount: number; blockedCount: number };
    updatedAt: string;
}

interface Task {
    id: string;
    title: string;
    status: string;
    due_date: string;
    priority: string;
}

interface Decision {
    id: string;
    title: string;
    status: string;
    created_at: string;
}

interface Initiative {
    id: string;
    name: string;
    status: string;
    risk_level: string;
}

export const ExecutiveView: React.FC = () => {
`'t'`
`'currentUser'`
    const { isAdmin, isManager, isSuperAdmin } = useUserCan();

    const [snapshot, setSnapshot] = useState<PMOHealthSnapshot | null>(null);
    const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
    const [pendingDecisions, setPendingDecisions] = useState<Decision[]>([]);
    const [atRiskInitiatives, setAtRiskInitiatives] = useState<Initiative[]>([]);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    // Permission check - only Admin, Manager, or SuperAdmin can view
    useEffect(() => {
        if (!isAdmin && !isManager && !isSuperAdmin) {
            setAccessDenied(true);
            setLoading(false);
        }
    }, [isAdmin, isManager, isSuperAdmin]);

    useEffect(() => {
        if (!currentProjectId || accessDenied) return;

        const fetchData = async () => {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            try {
                // Fetch PMO Health Snapshot
                const healthRes = await fetch(`/api/pmo/health/${currentProjectId}`, { headers });
                if (healthRes.ok) {
                    const healthData = await healthRes.json();
                    setSnapshot(healthData);
                }

                // Fetch overdue tasks (top 5)
                const tasksRes = await fetch(`/api/tasks?projectId=${currentProjectId}&status=overdue&limit=5`, { headers });
                if (tasksRes.ok) {
                    const tasksData = await tasksRes.json();
                    setOverdueTasks(tasksData.slice ? tasksData.slice(0, 5) : []);
                }

                // Fetch pending decisions
                const decisionsRes = await fetch(`/api/decisions?projectId=${currentProjectId}&status=PENDING&limit=10`, { headers });
                if (decisionsRes.ok) {
                    const decisionsData = await decisionsRes.json();
                    setPendingDecisions(decisionsData.slice ? decisionsData.slice(0, 10) : []);
                }

                // Fetch at-risk initiatives
                const initiativesRes = await fetch(`/api/initiatives?projectId=${currentProjectId}`, { headers });
                if (initiativesRes.ok) {
                    const initiativesData = await initiativesRes.json();
                    setAtRiskInitiatives(
                        (initiativesData || [])
                            .filter((i: Initiative) => i.risk_level === 'HIGH' || i.status === 'AT_RISK' || i.status === 'BLOCKED')
                            .slice(0, 5)
                    );
                }
            } catch (err) {
                console.error('[ExecutiveView] Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentProjectId, accessDenied]);

    const handleAiChat = async (text: string) => {
        addChatMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    };

    // Access Denied View
    if (accessDenied) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-navy-950">
                <div className="text-center">
                    <Lock size={48} className="mx-auto mb-4 text-slate-400" />
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        Access Restricted
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Executive View is available for Admin and Manager roles only.
                    </p>
                </div>
            </div>
        );
    }

    // Loading State
    if (loading) {
        return (
            <SplitLayout title="Executive View" onSendMessage={handleAiChat}>
                <div className="flex h-full items-center justify-center">
                    <div className="animate-pulse text-slate-400">Loading executive summary...</div>
                </div>
            </SplitLayout>
        );
    }

    // No Project Selected
    if (!currentProjectId) {
        return (
            <SplitLayout title="Executive View" onSendMessage={handleAiChat}>
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <Eye size={48} className="mx-auto mb-4 text-slate-400" />
                        <p className="text-slate-500 dark:text-slate-400">
                            Select a project to view executive summary.
                        </p>
                    </div>
                </div>
            </SplitLayout>
        );
    }

    return (
        <SplitLayout
            title="Executive View"
            subtitle="Read-only strategic overview"
            onSendMessage={handleAiChat}
        >
            <div className="flex h-full flex-col bg-slate-50 dark:bg-navy-950 overflow-auto p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Eye size={24} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            {snapshot?.projectName || 'Project'}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Lock size={12} />
                            <span>Read-Only View</span>
                        </div>
                    </div>
                </div>

                {/* Phase & Gate Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Target size={18} className="text-blue-500" />
                            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Current Phase</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {snapshot?.phase.number || '-'}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400">
                                <div className="text-sm font-medium">{snapshot?.phase.name || 'Unknown'}</div>
                                <div className="text-xs">of 6 phases</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={18} className="text-purple-500" />
                            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Gate Status</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            {snapshot?.stageGate.isReady ? (
                                <>
                                    <CheckCircle2 size={32} className="text-green-500" />
                                    <div>
                                        <div className="text-sm font-medium text-green-600 dark:text-green-400">Ready to Proceed</div>
                                        <div className="text-xs text-slate-500">All criteria met</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle size={32} className="text-amber-500" />
                                    <div>
                                        <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Not Ready</div>
                                        <div className="text-xs text-slate-500">
                                            {snapshot?.stageGate.missingCriteria.length || 0} criteria pending
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Blockers (Top 5) */}
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={18} className="text-red-500" />
                        <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                            Top Blockers ({snapshot?.blockers.length || 0})
                        </h2>
                    </div>
                    {snapshot?.blockers.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No active blockers</p>
                    ) : (
                        <div className="space-y-2">
                            {snapshot?.blockers.slice(0, 5).map((blocker, idx) => (
                                <div key={idx} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${blocker.type === 'TASK' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                            blocker.type === 'DECISION' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                        }`}>
                                        {blocker.type}
                                    </span>
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                                        {blocker.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending Decisions */}
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Flag size={18} className="text-amber-500" />
                        <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                            Pending Decisions ({snapshot?.decisions.pendingCount || 0})
                        </h2>
                    </div>
                    {pendingDecisions.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No pending decisions</p>
                    ) : (
                        <div className="space-y-2">
                            {pendingDecisions.map((decision) => (
                                <div key={decision.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                    <Clock size={14} className="text-amber-500 flex-shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                                        {decision.title}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(decision.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Overdue Tasks (Top 5) */}
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={18} className="text-red-500" />
                        <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                            Overdue Tasks ({snapshot?.tasks.overdueCount || 0})
                        </h2>
                    </div>
                    {overdueTasks.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No overdue tasks</p>
                    ) : (
                        <div className="space-y-2">
                            {overdueTasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                                        {task.title}
                                    </span>
                                    <span className="text-xs text-red-400">
                                        Due: {new Date(task.due_date).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* At-Risk Initiatives */}
                <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp size={18} className="text-orange-500" />
                        <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                            At-Risk Initiatives ({snapshot?.initiatives.atRiskCount || 0})
                        </h2>
                    </div>
                    {atRiskInitiatives.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No initiatives at risk</p>
                    ) : (
                        <div className="space-y-2">
                            {atRiskInitiatives.map((initiative) => (
                                <div key={initiative.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                    <Flag size={14} className="text-orange-500 flex-shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                                        {initiative.name}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${initiative.status === 'BLOCKED'
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                        }`}>
                                        {initiative.status || initiative.risk_level}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer - Timestamp */}
                <div className="mt-6 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        Last updated: {snapshot ? new Date(snapshot.updatedAt).toLocaleString() : '-'}
                    </span>
                </div>
            </div>
        </SplitLayout>
    );
};

export default ExecutiveView;
