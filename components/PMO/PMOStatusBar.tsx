import React, { useState } from 'react';
import { usePMOContext } from '../../hooks/usePMOContext';
import {
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Target,
    XCircle,
    User,
    Calendar,
    FileQuestion
} from 'lucide-react';

/**
 * PMO Status Bar - Displays current phase, gate status, and blocking issues
 * Shows at the top of the app when a project is selected
 */
export const PMOStatusBar: React.FC = () => {
    const {
        currentPhase,
        phaseNumber,
        totalPhases,
        gateStatus,
        systemMessages,
        blockingIssues,
        isLoading,
        error,
        getCriticalMessages,
        getWarningMessages
    } = usePMOContext();

    const [isExpanded, setIsExpanded] = useState(false);

    // Don't render if loading or still initializing
    if (isLoading) {
        return (
            <div className="bg-navy-950 border-b border-white/5 text-white h-10 px-4 flex items-center">
                <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                    <span className="text-xs">Loading PMO context...</span>
                </div>
            </div>
        );
    }

    // Show minimal bar when no phase data (no project selected)
    if (!currentPhase) {
        return (
            <div className="bg-navy-950 border-b border-white/5 text-white h-10 px-4 flex items-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-xs text-slate-400">Select a project to see PMO governance status</span>
                </div>
            </div>
        );
    }

    const criticalMessages = getCriticalMessages();
    const warningMessages = getWarningMessages();
    const hasIssues = blockingIssues.length > 0 || criticalMessages.length > 0;

    // Phase colors
    const getPhaseColor = (phase: string | null) => {
        switch (phase) {
            case 'Context': return 'bg-blue-500';
            case 'Assessment': return 'bg-indigo-500';
            case 'Initiatives': return 'bg-purple-500';
            case 'Roadmap': return 'bg-pink-500';
            case 'Execution': return 'bg-orange-500';
            case 'Stabilization': return 'bg-green-500';
            default: return 'bg-slate-500';
        }
    };

    // Gate status indicator
    const GateIndicator = () => {
        if (gateStatus === 'READY') {
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium border border-green-500/30">
                    <CheckCircle2 size={12} />
                    Gate Ready
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium border border-amber-500/30">
                <Clock size={12} />
                Gate Not Ready
            </span>
        );
    };

    // Issue type icon
    const getIssueIcon = (type: string) => {
        switch (type) {
            case 'DECISION': return <FileQuestion size={14} className="text-purple-400" />;
            case 'TASK': return <Target size={14} className="text-blue-400" />;
            case 'INITIATIVE': return <AlertTriangle size={14} className="text-orange-400" />;
            default: return <XCircle size={14} className="text-red-400" />;
        }
    };

    return (
        <div className="bg-navy-950 border-b border-white/5 text-white">
            {/* Main Bar */}
            <div
                className="h-10 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    {/* Phase Badge */}
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getPhaseColor(currentPhase)} animate-pulse`} />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Phase {phaseNumber}/{totalPhases}
                        </span>
                        <span className="text-sm font-semibold text-white">
                            {currentPhase || 'Loading...'}
                        </span>
                    </div>

                    {/* Separator */}
                    <div className="w-px h-4 bg-white/10" />

                    {/* Gate Status */}
                    <GateIndicator />

                    {/* Issues Count */}
                    {hasIssues && (
                        <>
                            <div className="w-px h-4 bg-white/10" />
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                                <AlertTriangle size={14} />
                                {blockingIssues.length + criticalMessages.length} Issues
                            </span>
                        </>
                    )}
                </div>

                {/* Expand/Collapse */}
                <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[10px] uppercase tracking-wider">
                        {isExpanded ? 'Hide Details' : 'Show Details'}
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 bg-navy-900/50">
                    {/* System Messages */}
                    {(criticalMessages.length > 0 || warningMessages.length > 0) && (
                        <div className="pt-3 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">System Messages</h4>
                            {criticalMessages.map((msg, idx) => (
                                <div key={`crit-${idx}`} className="flex items-start gap-2 p-2 bg-red-500/10 rounded border border-red-500/20">
                                    <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-red-400">{msg.code}</span>
                                        <p className="text-xs text-red-300">{msg.message}</p>
                                    </div>
                                </div>
                            ))}
                            {warningMessages.map((msg, idx) => (
                                <div key={`warn-${idx}`} className="flex items-start gap-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-amber-400">{msg.code}</span>
                                        <p className="text-xs text-amber-300">{msg.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Blocking Issues */}
                    {blockingIssues.length > 0 && (
                        <div className="pt-3 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Blocking Issues</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {blockingIssues.map((issue) => (
                                    <div
                                        key={issue.id}
                                        className="flex items-start gap-2 p-2 bg-white/5 rounded border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        {getIssueIcon(issue.type)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-white truncate">{issue.title}</p>
                                            <p className="text-[10px] text-slate-400">{issue.reason}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">
                                                    {issue.type}
                                                </span>
                                                {issue.label && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                                                        {issue.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No Issues State */}
                    {!hasIssues && (
                        <div className="pt-3 flex items-center gap-2 text-green-400">
                            <CheckCircle2 size={16} />
                            <span className="text-xs">No blocking issues. Ready to proceed.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PMOStatusBar;
