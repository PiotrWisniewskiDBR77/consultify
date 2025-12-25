/**
 * AssessmentVersionHistory
 * Displays version history with options to view, compare, and restore
 */

import React, { useState, useEffect } from 'react';
import { 
    History, 
    Eye, 
    RotateCcw, 
    GitCompare, 
    Clock, 
    User, 
    ChevronDown, 
    ChevronUp,
    Check,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useAssessmentWorkflow, AssessmentVersion } from '../../hooks/useAssessmentWorkflow';

interface AssessmentVersionHistoryProps {
    assessmentId: string;
    onViewVersion?: (version: AssessmentVersion) => void;
    onRestoreVersion?: (version: number) => void;
    onCompareVersions?: (v1: number, v2: number) => void;
}

export const AssessmentVersionHistory: React.FC<AssessmentVersionHistoryProps> = ({
    assessmentId,
    onViewVersion,
    onRestoreVersion,
    onCompareVersions
}) => {
    const { 
        versions, 
        fetchVersions, 
        restoreVersion, 
        isLoading, 
        error 
    } = useAssessmentWorkflow(assessmentId);

    const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
    const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
    const [isRestoring, setIsRestoring] = useState<number | null>(null);
    const [showConfirmRestore, setShowConfirmRestore] = useState<number | null>(null);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const handleRestore = async (version: number) => {
        setIsRestoring(version);
        const success = await restoreVersion(version);
        setIsRestoring(null);
        setShowConfirmRestore(null);
        
        if (success && onRestoreVersion) {
            onRestoreVersion(version);
        }
    };

    const toggleCompareSelection = (version: number) => {
        setSelectedForCompare(prev => {
            if (prev.includes(version)) {
                return prev.filter(v => v !== version);
            }
            if (prev.length >= 2) {
                return [prev[1], version];
            }
            return [...prev, version];
        });
    };

    const handleCompare = () => {
        if (selectedForCompare.length === 2 && onCompareVersions) {
            const sorted = [...selectedForCompare].sort((a, b) => a - b);
            onCompareVersions(sorted[0], sorted[1]);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getVersionLabel = (version: AssessmentVersion, index: number, total: number) => {
        if (index === 0) return 'Aktualna wersja';
        if (index === total - 1) return 'Wersja początkowa';
        return `Wersja ${version.version}`;
    };

    if (isLoading && versions.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-12 text-red-500">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span>{error}</span>
            </div>
        );
    }

    if (versions.length === 0) {
        return (
            <div className="text-center py-12">
                <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">Brak historii wersji</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-navy-900 dark:text-white">Historia wersji</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {versions.length} wersji
                        </p>
                    </div>
                </div>

                {/* Compare Button */}
                {selectedForCompare.length === 2 && onCompareVersions && (
                    <button
                        onClick={handleCompare}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <GitCompare className="w-4 h-4" />
                        Porównaj wybrane
                    </button>
                )}
            </div>

            {/* Version List */}
            <div className="divide-y divide-slate-200 dark:divide-white/10">
                {versions.map((version, index) => {
                    const isExpanded = expandedVersion === version.version;
                    const isSelected = selectedForCompare.includes(version.version);
                    const isCurrent = index === 0;

                    return (
                        <div 
                            key={version.id} 
                            className={`transition-colors ${
                                isSelected 
                                    ? 'bg-purple-50 dark:bg-purple-900/20' 
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                            }`}
                        >
                            {/* Version Row */}
                            <div className="p-4 flex items-center gap-4">
                                {/* Compare Checkbox */}
                                {onCompareVersions && (
                                    <button
                                        onClick={() => toggleCompareSelection(version.version)}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                            isSelected
                                                ? 'bg-purple-600 border-purple-600 text-white'
                                                : 'border-slate-300 dark:border-slate-600 hover:border-purple-400'
                                        }`}
                                    >
                                        {isSelected && <Check className="w-3 h-3" />}
                                    </button>
                                )}

                                {/* Version Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-semibold ${
                                            isCurrent 
                                                ? 'text-purple-600 dark:text-purple-400' 
                                                : 'text-navy-900 dark:text-white'
                                        }`}>
                                            {getVersionLabel(version, index, versions.length)}
                                        </span>
                                        {isCurrent && (
                                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full">
                                                Aktualna
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {formatDate(version.createdAt)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <User className="w-3.5 h-3.5" />
                                            {version.createdByName || 'Nieznany'}
                                        </span>
                                    </div>
                                    {version.changeLog && (
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                                            {version.changeLog}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {/* View */}
                                    {onViewVersion && (
                                        <button
                                            onClick={() => onViewVersion(version)}
                                            className="p-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                            title="Podgląd"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    )}

                                    {/* Restore */}
                                    {!isCurrent && onRestoreVersion && (
                                        <button
                                            onClick={() => setShowConfirmRestore(version.version)}
                                            disabled={isRestoring !== null}
                                            className="p-2 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                            title="Przywróć"
                                        >
                                            {isRestoring === version.version ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RotateCcw className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}

                                    {/* Expand */}
                                    <button
                                        onClick={() => setExpandedVersion(isExpanded ? null : version.version)}
                                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronUp className="w-4 h-4" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && version.data && (
                                <div className="px-4 pb-4">
                                    <div className="bg-slate-50 dark:bg-navy-950/50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
                                            Oceny w tej wersji
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {version.data.axes && Object.entries(version.data.axes).map(([axis, data]: [string, any]) => (
                                                <div 
                                                    key={axis}
                                                    className="bg-white dark:bg-navy-900 rounded-lg p-3 border border-slate-200 dark:border-white/10"
                                                >
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mb-1">
                                                        {axis.replace(/([A-Z])/g, ' $1').trim()}
                                                    </p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-lg font-bold text-navy-900 dark:text-white">
                                                            {data?.actual || '-'}
                                                        </span>
                                                        <span className="text-sm text-slate-500">→</span>
                                                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                                            {data?.target || '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Confirm Restore Modal */}
                            {showConfirmRestore === version.version && (
                                <div className="px-4 pb-4">
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                                                    Potwierdź przywrócenie
                                                </h4>
                                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                                    Czy na pewno chcesz przywrócić tę wersję? 
                                                    Obecna wersja zostanie zapisana w historii.
                                                </p>
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleRestore(version.version)}
                                                        disabled={isRestoring !== null}
                                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {isRestoring === version.version ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            'Przywróć'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setShowConfirmRestore(null)}
                                                        className="px-4 py-2 bg-white dark:bg-navy-800 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                                                    >
                                                        Anuluj
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AssessmentVersionHistory;

