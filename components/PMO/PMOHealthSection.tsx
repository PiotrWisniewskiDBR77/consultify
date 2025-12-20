import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Shield, Target, HelpCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Step A: PMO Health Section
 * Displays canonical PMOHealthSnapshot in UI
 * Uses same endpoint as AI context for consistency
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

interface PMOHealthSectionProps {
    projectId: string;
    onExplainClick?: (snapshot: PMOHealthSnapshot) => void;
}

export const PMOHealthSection: React.FC<PMOHealthSectionProps> = ({ projectId, onExplainClick }) => {
    const [snapshot, setSnapshot] = useState<PMOHealthSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) {
            setSnapshot(null);
            setLoading(false);
            return;
        }

        const fetchHealth = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/pmo/health/${projectId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSnapshot(data);
                    setError(null);
                } else {
                    throw new Error('Failed to fetch PMO health');
                }
            } catch (err: any) {
                console.error('[PMOHealth] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
    }, [projectId]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-1/3 mb-3"></div>
                <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-2/3"></div>
            </div>
        );
    }

    if (error || !snapshot) {
        return (
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {error || 'Select a project to view PMO health'}
                </p>
            </div>
        );
    }

    const hasBlockers = snapshot.blockers.length > 0;
    const hasOverdue = snapshot.tasks.overdueCount > 0 || snapshot.decisions.overdueCount > 0;
    const healthStatus = !hasBlockers && !hasOverdue ? 'healthy' : hasOverdue ? 'warning' : 'critical';

    return (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-purple-500" />
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">PMO Health</h3>
                </div>
                {onExplainClick && (
                    <button
                        onClick={() => onExplainClick(snapshot)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                        title="Ask AI to explain current PMO status"
                    >
                        <HelpCircle size={12} />
                        Explain This
                    </button>
                )}
            </div>

            {/* Phase & Gate */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Phase</div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {snapshot.phase.number}/6
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                            {snapshot.phase.name}
                        </span>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-navy-900 rounded-lg p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Gate Status</div>
                    <div className="flex items-center gap-2">
                        {snapshot.stageGate.isReady ? (
                            <>
                                <CheckCircle2 size={14} className="text-green-500" />
                                <span className="text-xs text-green-600 dark:text-green-400">Ready</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={14} className="text-amber-500" />
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                    {snapshot.stageGate.missingCriteria.length} missing
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Counts Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className={`rounded-lg p-2 text-center ${snapshot.tasks.overdueCount > 0
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-slate-50 dark:bg-navy-900'
                    }`}>
                    <div className={`text-lg font-bold ${snapshot.tasks.overdueCount > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-900 dark:text-white'
                        }`}>
                        {snapshot.tasks.overdueCount}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Overdue</div>
                </div>

                <div className={`rounded-lg p-2 text-center ${snapshot.decisions.pendingCount > 0
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : 'bg-slate-50 dark:bg-navy-900'
                    }`}>
                    <div className={`text-lg font-bold ${snapshot.decisions.pendingCount > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-white'
                        }`}>
                        {snapshot.decisions.pendingCount}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Pending</div>
                </div>

                <div className={`rounded-lg p-2 text-center ${snapshot.blockers.length > 0
                        ? 'bg-purple-50 dark:bg-purple-900/20'
                        : 'bg-slate-50 dark:bg-navy-900'
                    }`}>
                    <div className={`text-lg font-bold ${snapshot.blockers.length > 0
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-slate-900 dark:text-white'
                        }`}>
                        {snapshot.blockers.length}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Blockers</div>
                </div>
            </div>

            {/* Top Blockers */}
            {snapshot.blockers.length > 0 && (
                <div className="border-t border-slate-100 dark:border-white/5 pt-3">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Top Blockers</div>
                    <div className="space-y-1">
                        {snapshot.blockers.slice(0, 3).map((blocker, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${blocker.type === 'TASK' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                        blocker.type === 'DECISION' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    }`}>
                                    {blocker.type}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300 truncate flex-1">
                                    {blocker.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timestamp */}
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Updated: {new Date(snapshot.updatedAt).toLocaleTimeString()}
                </span>
            </div>
        </div>
    );
};

export default PMOHealthSection;
