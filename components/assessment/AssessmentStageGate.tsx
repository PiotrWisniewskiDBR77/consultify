/**
 * Assessment Stage Gate Component
 * Visual gate system for assessment workflow transitions
 * Shows readiness criteria and approval status for each stage
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle, XCircle, AlertTriangle, Lock, Unlock, ChevronRight,
    Settings, Target, Lightbulb, Route, Play, Flag, ArrowRight,
    Loader2, Info, Shield, Zap
} from 'lucide-react';
import axios from 'axios';

// Gate Types and Phases
const GATE_TYPES = {
    READINESS_GATE: 'READINESS_GATE',     // Context → Assessment
    DESIGN_GATE: 'DESIGN_GATE',           // Assessment → Initiatives
    PLANNING_GATE: 'PLANNING_GATE',       // Initiatives → Roadmap
    EXECUTION_GATE: 'EXECUTION_GATE',     // Roadmap → Execution
    CLOSURE_GATE: 'CLOSURE_GATE'          // Execution → Stabilization
};

const PHASE_CONFIG = {
    Context: {
        icon: Settings,
        color: 'blue',
        label: 'Context',
        description: 'Define strategic context'
    },
    Assessment: {
        icon: Target,
        color: 'purple',
        label: 'Assessment',
        description: 'Evaluate DRD maturity'
    },
    Initiatives: {
        icon: Lightbulb,
        color: 'amber',
        label: 'Initiatives',
        description: 'Define improvement initiatives'
    },
    Roadmap: {
        icon: Route,
        color: 'green',
        label: 'Roadmap',
        description: 'Plan transformation roadmap'
    },
    Execution: {
        icon: Play,
        color: 'indigo',
        label: 'Execution',
        description: 'Execute transformation'
    },
    Stabilization: {
        icon: Flag,
        color: 'emerald',
        label: 'Stabilization',
        description: 'Stabilize and optimize'
    }
};

interface Criterion {
    criterion: string;
    isMet: boolean;
    evidence: string;
}

interface GateStatus {
    gateType: string;
    projectId: string;
    status: 'READY' | 'NOT_READY';
    completionCriteria: Criterion[];
    missingElements: string[];
}

interface Props {
    projectId: string;
    currentPhase: string;
    onPhaseChange?: (newPhase: string) => void;
}

export const AssessmentStageGate: React.FC<Props> = ({
    projectId,
    currentPhase,
    onPhaseChange
}) => {
    const { t } = useTranslation();
    const [gateStatuses, setGateStatuses] = useState<Record<string, GateStatus | null>>({});
    const [loading, setLoading] = useState(true);
    const [passingGate, setPassingGate] = useState<string | null>(null);
    const [selectedGate, setSelectedGate] = useState<string | null>(null);

    const phases = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
    const currentPhaseIndex = phases.indexOf(currentPhase);

    useEffect(() => {
        loadGateStatuses();
    }, [projectId, currentPhase]);

    const loadGateStatuses = async () => {
        setLoading(true);
        try {
            // Load gate status for next phase transition
            const gateTypes = Object.values(GATE_TYPES);
            const statusPromises = gateTypes.map(async (gateType) => {
                try {
                    const res = await axios.get(`/api/stage-gates/${projectId}/evaluate/${gateType}`);
                    return { gateType, status: res.data };
                } catch {
                    return { gateType, status: null };
                }
            });

            const results = await Promise.all(statusPromises);
            const statuses: Record<string, GateStatus | null> = {};
            results.forEach(r => {
                statuses[r.gateType] = r.status;
            });
            setGateStatuses(statuses);
        } catch (error) {
            console.error('Error loading gate statuses:', error);
        } finally {
            setLoading(false);
        }
    };

    const getGateForTransition = (fromPhase: string, toPhase: string): string | null => {
        const gateMap: Record<string, string> = {
            'Context_Assessment': GATE_TYPES.READINESS_GATE,
            'Assessment_Initiatives': GATE_TYPES.DESIGN_GATE,
            'Initiatives_Roadmap': GATE_TYPES.PLANNING_GATE,
            'Roadmap_Execution': GATE_TYPES.EXECUTION_GATE,
            'Execution_Stabilization': GATE_TYPES.CLOSURE_GATE
        };
        return gateMap[`${fromPhase}_${toPhase}`] || null;
    };

    const handlePassGate = async (gateType: string, toPhase: string) => {
        setPassingGate(gateType);
        try {
            await axios.post(`/api/stage-gates/${projectId}/pass/${gateType}`, {
                notes: `Passing ${gateType} to proceed to ${toPhase}`
            });
            
            onPhaseChange?.(toPhase);
            loadGateStatuses();
        } catch (error) {
            console.error('Error passing gate:', error);
        } finally {
            setPassingGate(null);
        }
    };

    const getPhaseStatus = (phase: string, index: number) => {
        if (index < currentPhaseIndex) return 'completed';
        if (index === currentPhaseIndex) return 'current';
        return 'pending';
    };

    const colorClasses = {
        blue: { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' },
        purple: { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500' },
        amber: { bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500' },
        green: { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-500' },
        indigo: { bg: 'bg-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500' },
        emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500' }
    };

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-navy-800 dark:to-navy-900">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-navy-900 dark:text-white">
                                Stage Gate Control
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Phase transitions require gate approval
                            </p>
                        </div>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        Current: <span className="font-medium text-purple-600 dark:text-purple-400">{currentPhase}</span>
                    </div>
                </div>
            </div>

            {/* Phase Timeline */}
            <div className="p-6">
                <div className="relative">
                    {/* Connection Line */}
                    <div className="absolute top-6 left-6 right-6 h-0.5 bg-slate-200 dark:bg-white/10" />
                    
                    <div className="relative flex justify-between">
                        {phases.map((phase, index) => {
                            const config = PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG];
                            const PhaseIcon = config.icon;
                            const status = getPhaseStatus(phase, index);
                            const colors = colorClasses[config.color as keyof typeof colorClasses];
                            const nextPhase = phases[index + 1];
                            const gateType = nextPhase ? getGateForTransition(phase, nextPhase) : null;
                            const gateStatus = gateType ? gateStatuses[gateType] : null;

                            return (
                                <React.Fragment key={phase}>
                                    {/* Phase Node */}
                                    <div className="flex flex-col items-center z-10">
                                        <div
                                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                                status === 'completed' 
                                                    ? 'bg-green-500 text-white' 
                                                    : status === 'current'
                                                    ? `${colors.bg} text-white ring-4 ring-offset-2 ring-offset-white dark:ring-offset-navy-900 ${colors.border}`
                                                    : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            {status === 'completed' ? (
                                                <CheckCircle className="w-6 h-6" />
                                            ) : (
                                                <PhaseIcon className="w-5 h-5" />
                                            )}
                                        </div>
                                        <span className={`mt-2 text-xs font-medium ${
                                            status === 'current' 
                                                ? 'text-navy-900 dark:text-white' 
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {config.label}
                                        </span>
                                    </div>

                                    {/* Gate Indicator */}
                                    {index < phases.length - 1 && (
                                        <div className="flex-1 flex items-start justify-center pt-3 z-10">
                                            {index === currentPhaseIndex && gateStatus && (
                                                <button
                                                    onClick={() => setSelectedGate(gateType)}
                                                    className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-all hover:scale-105 ${
                                                        gateStatus.status === 'READY'
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300 dark:border-green-700'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                                                    }`}
                                                >
                                                    {gateStatus.status === 'READY' ? (
                                                        <>
                                                            <Unlock size={12} />
                                                            Ready
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lock size={12} />
                                                            {gateStatus.missingElements?.length || 0} items
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {index < currentPhaseIndex && (
                                                <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <CheckCircle size={12} className="inline-block" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Gate Details Panel */}
                {selectedGate && gateStatuses[selectedGate] && (
                    <GateDetailsPanel
                        gateType={selectedGate}
                        gateStatus={gateStatuses[selectedGate]!}
                        onClose={() => setSelectedGate(null)}
                        onPass={() => {
                            const toPhase = phases[currentPhaseIndex + 1];
                            handlePassGate(selectedGate, toPhase);
                            setSelectedGate(null);
                        }}
                        isPassing={passingGate === selectedGate}
                    />
                )}

                {/* Quick Actions */}
                {currentPhaseIndex < phases.length - 1 && (
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    Next phase: <span className="font-medium">{phases[currentPhaseIndex + 1]}</span>
                                </span>
                            </div>
                            
                            {(() => {
                                const nextPhase = phases[currentPhaseIndex + 1];
                                const gateType = getGateForTransition(currentPhase, nextPhase);
                                const gateStatus = gateType ? gateStatuses[gateType] : null;
                                
                                if (!gateStatus) return null;
                                
                                return gateStatus.status === 'READY' ? (
                                    <button
                                        onClick={() => handlePassGate(gateType!, nextPhase)}
                                        disabled={passingGate !== null}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                    >
                                        {passingGate ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Zap className="w-4 h-4" />
                                        )}
                                        Proceed to {nextPhase}
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setSelectedGate(gateType)}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                                    >
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        View Requirements
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Gate Details Panel
const GateDetailsPanel: React.FC<{
    gateType: string;
    gateStatus: GateStatus;
    onClose: () => void;
    onPass: () => void;
    isPassing: boolean;
}> = ({ gateType, gateStatus, onClose, onPass, isPassing }) => {
    const gateLabels: Record<string, { title: string; description: string }> = {
        [GATE_TYPES.READINESS_GATE]: {
            title: 'Readiness Gate',
            description: 'Validates strategic context is complete before assessment'
        },
        [GATE_TYPES.DESIGN_GATE]: {
            title: 'Design Gate',
            description: 'Ensures assessment is complete before initiative planning'
        },
        [GATE_TYPES.PLANNING_GATE]: {
            title: 'Planning Gate',
            description: 'Confirms initiatives are defined before roadmap creation'
        },
        [GATE_TYPES.EXECUTION_GATE]: {
            title: 'Execution Gate',
            description: 'Validates roadmap is baselined before execution'
        },
        [GATE_TYPES.CLOSURE_GATE]: {
            title: 'Closure Gate',
            description: 'Ensures all work is complete before stabilization'
        }
    };

    const gateInfo = gateLabels[gateType] || { title: 'Stage Gate', description: '' };
    const isReady = gateStatus.status === 'READY';
    const metCriteria = gateStatus.completionCriteria?.filter(c => c.isMet).length || 0;
    const totalCriteria = gateStatus.completionCriteria?.length || 0;

    return (
        <div className="mt-6 p-4 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-white/10">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isReady ? 'bg-green-500' : 'bg-amber-500'
                    }`}>
                        {isReady ? (
                            <Unlock className="w-5 h-5 text-white" />
                        ) : (
                            <Lock className="w-5 h-5 text-white" />
                        )}
                    </div>
                    <div>
                        <h4 className="font-semibold text-navy-900 dark:text-white">
                            {gateInfo.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {gateInfo.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                    ✕
                </button>
            </div>

            {/* Progress */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                    <span>Completion Criteria</span>
                    <span>{metCriteria}/{totalCriteria} met</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${isReady ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${(metCriteria / totalCriteria) * 100}%` }}
                    />
                </div>
            </div>

            {/* Criteria List */}
            <div className="space-y-2 mb-4">
                {gateStatus.completionCriteria?.map((criterion, index) => (
                    <div 
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                            criterion.isMet 
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}
                    >
                        {criterion.isMet ? (
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${
                            criterion.isMet 
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-red-700 dark:text-red-300'
                        }`}>
                            {criterion.criterion}
                        </span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
                {isReady && (
                    <button
                        onClick={onPass}
                        disabled={isPassing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {isPassing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle className="w-4 h-4" />
                        )}
                        Pass Gate
                    </button>
                )}
            </div>
        </div>
    );
};

