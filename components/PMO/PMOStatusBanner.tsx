import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ArrowRight, Clock } from 'lucide-react';
import { usePMOStore, PMOSystemMessage, PMOBlockingIssue } from '../../store/usePMOStore';

interface PMOStatusBannerProps {
    compact?: boolean;
    showBlockingCount?: boolean;
}

/**
 * PMO Status Banner Component
 * Displays current phase, system messages, and blocking issue indicators
 * Non-intrusive banner for phase-driven UI behavior
 */
export const PMOStatusBanner: React.FC<PMOStatusBannerProps> = ({
    compact = false,
    showBlockingCount = true
}) => {
    const { t } = useTranslation();
    const {
        currentPhase,
        phaseNumber,
        totalPhases,
        gateStatus,
        systemMessages,
        blockingIssues,
        isLoading
    } = usePMOStore();

    if (isLoading || !currentPhase) {
        return null;
    }

    const warningMessages = systemMessages.filter(m => m.severity === 'warning');
    const criticalMessages = systemMessages.filter(m => m.severity === 'critical');
    const infoMessages = systemMessages.filter(m => m.severity === 'info');
    const hasBlockers = blockingIssues.length > 0;

    // Phase color mapping
    const phaseColors: Record<string, string> = {
        'Context': 'from-blue-500 to-blue-600',
        'Assessment': 'from-indigo-500 to-indigo-600',
        'Initiatives': 'from-purple-500 to-purple-600',
        'Roadmap': 'from-violet-500 to-violet-600',
        'Execution': 'from-emerald-500 to-emerald-600',
        'Stabilization': 'from-teal-500 to-teal-600'
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertCircle size={14} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
            default: return <Info size={14} className="text-blue-500" />;
        }
    };

    const getSeverityClass = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300';
            case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-300';
            default: return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30 text-blue-700 dark:text-blue-300';
        }
    };

    // Compact mode - just phase indicator
    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded-md text-xs font-medium text-white bg-gradient-to-r ${phaseColors[currentPhase] || 'from-slate-500 to-slate-600'}`}>
                    {t('pmo.phase', 'Phase')} {phaseNumber}/{totalPhases}: {currentPhase}
                </div>
                {hasBlockers && showBlockingCount && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-xs font-medium">
                        <AlertCircle size={12} />
                        {blockingIssues.length}
                    </div>
                )}
                {gateStatus === 'READY' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-xs font-medium">
                        <CheckCircle2 size={12} />
                        {t('pmo.gateReady', 'Ready')}
                    </div>
                )}
            </div>
        );
    }

    // Full banner mode
    return (
        <div className="space-y-2">
            {/* Phase Header */}
            <div className="flex items-center justify-between bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 p-3">
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r ${phaseColors[currentPhase] || 'from-slate-500 to-slate-600'} shadow-sm`}>
                        {t('pmo.phase', 'Phase')} {phaseNumber}/{totalPhases}
                    </div>
                    <div>
                        <div className="font-semibold text-navy-900 dark:text-white">
                            {currentPhase}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {t(`pmo.phases.${currentPhase?.toLowerCase()}`, currentPhase)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Gate Status */}
                    {gateStatus && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${gateStatus === 'READY'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                            {gateStatus === 'READY' ? (
                                <>
                                    <CheckCircle2 size={12} />
                                    {t('pmo.readyForNextPhase', 'Ready for next phase')}
                                </>
                            ) : (
                                <>
                                    <Clock size={12} />
                                    {t('pmo.phaseInProgress', 'In progress')}
                                </>
                            )}
                        </div>
                    )}

                    {/* Blocking Issues Count */}
                    {hasBlockers && showBlockingCount && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-xs font-medium cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                            <AlertCircle size={12} />
                            {blockingIssues.length} {t('pmo.blocking', 'blocking')}
                        </div>
                    )}
                </div>
            </div>

            {/* System Messages */}
            {(criticalMessages.length > 0 || warningMessages.length > 0 || infoMessages.length > 0) && (
                <div className="space-y-1">
                    {/* Critical messages first */}
                    {criticalMessages.map((msg, idx) => (
                        <div key={`critical-${idx}`} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${getSeverityClass('critical')}`}>
                            {getSeverityIcon('critical')}
                            <span>{msg.message}</span>
                        </div>
                    ))}

                    {/* Warning messages */}
                    {warningMessages.map((msg, idx) => (
                        <div key={`warning-${idx}`} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${getSeverityClass('warning')}`}>
                            {getSeverityIcon('warning')}
                            <span>{msg.message}</span>
                        </div>
                    ))}

                    {/* Info messages (show first one only in full mode) */}
                    {infoMessages.length > 0 && (
                        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${getSeverityClass('info')}`}>
                            {getSeverityIcon('info')}
                            <span>{infoMessages[0].message}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * PMO Phase Indicator - Minimal inline indicator
 */
export const PMOPhaseIndicator: React.FC = () => {
    const { currentPhase, phaseNumber, totalPhases, isLoading } = usePMOStore();

    if (isLoading || !currentPhase) return null;

    return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">{currentPhase}</span>
            <span className="opacity-60">({phaseNumber}/{totalPhases})</span>
        </span>
    );
};

/**
 * PMO Blocking Badge - Shows count of blocking issues
 */
export const PMOBlockingBadge: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
    const { blockingIssues } = usePMOStore();

    if (blockingIssues.length === 0) return null;

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
            <AlertCircle size={10} />
            {blockingIssues.length} blocking
        </button>
    );
};
