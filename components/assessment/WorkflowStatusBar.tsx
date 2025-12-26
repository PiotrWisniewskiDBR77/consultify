/**
 * WorkflowStatusBar
 * 
 * Visual timeline showing current workflow state for an assessment.
 * Displays: DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED
 * With color-coded status indicators.
 */

import React, { useState, useEffect } from 'react';
import {
    FileEdit,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    ChevronRight,
    Loader2
} from 'lucide-react';

type WorkflowStatus = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';

interface WorkflowStage {
    id: WorkflowStatus;
    label: string;
    icon: React.ReactNode;
    description: string;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
    {
        id: 'DRAFT',
        label: 'Draft',
        icon: <FileEdit size={16} />,
        description: 'Ocena w trakcie edycji'
    },
    {
        id: 'IN_REVIEW',
        label: 'W recenzji',
        icon: <Users size={16} />,
        description: 'Recenzenci weryfikują ocenę'
    },
    {
        id: 'AWAITING_APPROVAL',
        label: 'Oczekuje na zatwierdzenie',
        icon: <Clock size={16} />,
        description: 'Wszystkie recenzje zakończone'
    },
    {
        id: 'APPROVED',
        label: 'Zatwierdzony',
        icon: <CheckCircle2 size={16} />,
        description: 'Ocena zatwierdzona'
    }
];

interface WorkflowStatusBarProps {
    assessmentId: string;
    currentStatus: WorkflowStatus;
    reviewCount?: number;
    completedReviews?: number;
    onStatusClick?: (status: WorkflowStatus) => void;
}

export const WorkflowStatusBar: React.FC<WorkflowStatusBarProps> = ({
    assessmentId,
    currentStatus,
    reviewCount = 0,
    completedReviews = 0,
    onStatusClick
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [workflowData, setWorkflowData] = useState<any>(null);

    // Fetch workflow status on mount
    useEffect(() => {
        const fetchWorkflowStatus = async () => {
            if (!assessmentId) return;
            
            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/assessment-workflow/${assessmentId}/status`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setWorkflowData(data);
                }
            } catch (err) {
                console.error('[WorkflowStatusBar] Error fetching status:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWorkflowStatus();
    }, [assessmentId]);

    // Determine actual status from workflow data or prop
    const actualStatus = workflowData?.status || currentStatus;

    // Get stage index for current status
    const getCurrentStageIndex = () => {
        if (actualStatus === 'REJECTED') return -1; // Special case
        return WORKFLOW_STAGES.findIndex(s => s.id === actualStatus);
    };

    const currentStageIndex = getCurrentStageIndex();

    // Determine stage state
    const getStageState = (index: number, stage: WorkflowStage) => {
        if (actualStatus === 'REJECTED') {
            return index === 0 ? 'current' : 'pending';
        }
        if (index < currentStageIndex) return 'completed';
        if (index === currentStageIndex) return 'current';
        return 'pending';
    };

    // Get colors based on state
    const getStateColors = (state: string) => {
        switch (state) {
            case 'completed':
                return {
                    bg: 'bg-green-500',
                    text: 'text-green-600 dark:text-green-400',
                    border: 'border-green-500',
                    connector: 'bg-green-500'
                };
            case 'current':
                return {
                    bg: 'bg-purple-500',
                    text: 'text-purple-600 dark:text-purple-400',
                    border: 'border-purple-500',
                    connector: 'bg-purple-200 dark:bg-purple-900/50'
                };
            default:
                return {
                    bg: 'bg-slate-300 dark:bg-slate-600',
                    text: 'text-slate-400 dark:text-slate-500',
                    border: 'border-slate-300 dark:border-slate-600',
                    connector: 'bg-slate-200 dark:bg-slate-700'
                };
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 px-4 py-3">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
                {/* Workflow Timeline */}
                <div className="flex items-center flex-1">
                    {WORKFLOW_STAGES.map((stage, index) => {
                        const state = getStageState(index, stage);
                        const colors = getStateColors(state);
                        const isLast = index === WORKFLOW_STAGES.length - 1;

                        return (
                            <React.Fragment key={stage.id}>
                                {/* Stage Node */}
                                <div
                                    className={`flex items-center gap-2 cursor-pointer group ${
                                        onStatusClick ? 'hover:opacity-80' : ''
                                    }`}
                                    onClick={() => onStatusClick?.(stage.id)}
                                    title={stage.description}
                                >
                                    {/* Icon Circle */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center transition-all
                                        ${state === 'current' 
                                            ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-navy-950' 
                                            : state === 'completed'
                                                ? 'bg-green-100 dark:bg-green-900/30'
                                                : 'bg-slate-100 dark:bg-navy-800'
                                        }
                                    `}>
                                        <span className={colors.text}>
                                            {state === 'completed' ? <CheckCircle2 size={16} /> : stage.icon}
                                        </span>
                                    </div>

                                    {/* Label */}
                                    <div className="hidden sm:block">
                                        <span className={`text-xs font-medium ${colors.text}`}>
                                            {stage.label}
                                        </span>
                                        {stage.id === 'IN_REVIEW' && reviewCount > 0 && (
                                            <span className="ml-1 text-xs text-slate-400">
                                                ({completedReviews}/{reviewCount})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Connector Line */}
                                {!isLast && (
                                    <div className="flex-1 mx-2 sm:mx-4 h-0.5 min-w-[24px] max-w-[60px]">
                                        <div className={`h-full ${
                                            state === 'completed' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                                        }`} />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Rejected Badge (if applicable) */}
                {actualStatus === 'REJECTED' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/20 rounded-full">
                        <XCircle size={14} className="text-red-500" />
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            Odrzucony
                        </span>
                    </div>
                )}

                {/* Review Progress (if in review) */}
                {actualStatus === 'IN_REVIEW' && reviewCount > 0 && (
                    <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Recenzje:</span>
                        <div className="flex gap-1">
                            {Array.from({ length: reviewCount }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full ${
                                        i < completedReviews
                                            ? 'bg-green-500'
                                            : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

