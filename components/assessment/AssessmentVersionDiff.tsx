/**
 * AssessmentVersionDiff
 * Side-by-side comparison of two assessment versions
 */

import React, { useState, useEffect } from 'react';
import { 
    GitCompare, 
    ArrowRight, 
    TrendingUp, 
    TrendingDown, 
    Minus,
    Clock,
    User,
    X,
    Loader2,
    AlertCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { DRDAxis } from '../../types';

interface VersionData {
    id: string;
    version: number;
    createdAt: string;
    createdBy: string;
    createdByName?: string;
    changeLog?: string;
    data: {
        axes?: Record<string, {
            actual?: number;
            target?: number;
            justification?: string;
        }>;
    };
}

interface AssessmentVersionDiffProps {
    assessmentId: string;
    version1: number;
    version2: number;
    onClose?: () => void;
}

interface AxisDiff {
    axisId: string;
    axisName: string;
    v1Actual: number | null;
    v2Actual: number | null;
    v1Target: number | null;
    v2Target: number | null;
    v1Justification: string;
    v2Justification: string;
    actualChange: number;
    targetChange: number;
    hasChanges: boolean;
}

const AXIS_NAMES: Record<string, string> = {
    processes: 'Procesy Cyfrowe',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura Organizacyjna',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI'
};

export const AssessmentVersionDiff: React.FC<AssessmentVersionDiffProps> = ({
    assessmentId,
    version1,
    version2,
    onClose
}) => {
    const [v1Data, setV1Data] = useState<VersionData | null>(null);
    const [v2Data, setV2Data] = useState<VersionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedAxis, setExpandedAxis] = useState<string | null>(null);

    // Ensure v1 < v2 for consistent display
    const olderVersion = Math.min(version1, version2);
    const newerVersion = Math.max(version1, version2);

    useEffect(() => {
        const fetchVersions = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem('token');
                
                // Fetch both versions
                const [res1, res2] = await Promise.all([
                    fetch(`/api/assessment-workflow/${assessmentId}/versions/${olderVersion}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`/api/assessment-workflow/${assessmentId}/versions/${newerVersion}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (!res1.ok || !res2.ok) {
                    throw new Error('Nie udało się pobrać wersji');
                }

                const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
                setV1Data(data1);
                setV2Data(data2);

            } catch (err: any) {
                console.error('[AssessmentVersionDiff] Error:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchVersions();
    }, [assessmentId, olderVersion, newerVersion]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate diffs for all axes
    const axisDiffs: AxisDiff[] = Object.keys(AXIS_NAMES).map(axisId => {
        const v1Axis = v1Data?.data?.axes?.[axisId];
        const v2Axis = v2Data?.data?.axes?.[axisId];

        const v1Actual = v1Axis?.actual ?? null;
        const v2Actual = v2Axis?.actual ?? null;
        const v1Target = v1Axis?.target ?? null;
        const v2Target = v2Axis?.target ?? null;
        const v1Justification = v1Axis?.justification || '';
        const v2Justification = v2Axis?.justification || '';

        const actualChange = (v2Actual ?? 0) - (v1Actual ?? 0);
        const targetChange = (v2Target ?? 0) - (v1Target ?? 0);

        const hasChanges = actualChange !== 0 || 
                          targetChange !== 0 || 
                          v1Justification !== v2Justification;

        return {
            axisId,
            axisName: AXIS_NAMES[axisId],
            v1Actual,
            v2Actual,
            v1Target,
            v2Target,
            v1Justification,
            v2Justification,
            actualChange,
            targetChange,
            hasChanges
        };
    });

    const changedAxes = axisDiffs.filter(d => d.hasChanges);
    const unchangedAxes = axisDiffs.filter(d => !d.hasChanges);

    // Summary stats
    const totalActualChange = axisDiffs.reduce((sum, d) => sum + d.actualChange, 0);
    const totalTargetChange = axisDiffs.reduce((sum, d) => sum + d.targetChange, 0);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-8 flex items-center gap-4">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    <span className="text-navy-900 dark:text-white">Ładowanie porównania...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-8 max-w-md">
                    <div className="flex items-center gap-3 text-red-500 mb-4">
                        <AlertCircle className="w-6 h-6" />
                        <span className="font-semibold">Błąd</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{error}</p>
                    <button
                        onClick={onClose}
                        className="mt-4 w-full py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg transition-colors"
                    >
                        Zamknij
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-navy-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <GitCompare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                                Porównanie wersji
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Wersja {olderVersion} → Wersja {newerVersion}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Version Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 shrink-0">
                    {/* Older Version */}
                    <div className="p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded">
                                Wersja {olderVersion}
                            </span>
                            <span className="text-xs text-slate-500">Starsza</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {v1Data && formatDate(v1Data.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {v1Data?.createdByName || 'Nieznany'}
                            </span>
                        </div>
                    </div>

                    {/* Newer Version */}
                    <div className="p-4 bg-white dark:bg-navy-900 rounded-xl border border-purple-200 dark:border-purple-500/30">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium rounded">
                                Wersja {newerVersion}
                            </span>
                            <span className="text-xs text-purple-500">Nowsza</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {v2Data && formatDate(v2Data.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {v2Data?.createdByName || 'Nieznany'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="p-4 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Zmiany:</span>
                            <span className="font-semibold text-navy-900 dark:text-white">
                                {changedAxes.length} z {axisDiffs.length} osi
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Ocena:</span>
                            <span className={`font-semibold flex items-center gap-1 ${
                                totalActualChange > 0 ? 'text-green-600' : 
                                totalActualChange < 0 ? 'text-red-600' : 'text-slate-600'
                            }`}>
                                {totalActualChange > 0 ? <TrendingUp className="w-4 h-4" /> :
                                 totalActualChange < 0 ? <TrendingDown className="w-4 h-4" /> :
                                 <Minus className="w-4 h-4" />}
                                {totalActualChange > 0 ? '+' : ''}{totalActualChange.toFixed(1)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Cel:</span>
                            <span className={`font-semibold flex items-center gap-1 ${
                                totalTargetChange > 0 ? 'text-green-600' : 
                                totalTargetChange < 0 ? 'text-red-600' : 'text-slate-600'
                            }`}>
                                {totalTargetChange > 0 ? <TrendingUp className="w-4 h-4" /> :
                                 totalTargetChange < 0 ? <TrendingDown className="w-4 h-4" /> :
                                 <Minus className="w-4 h-4" />}
                                {totalTargetChange > 0 ? '+' : ''}{totalTargetChange.toFixed(1)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Diff Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Changed Axes */}
                    {changedAxes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                Zmienione osie ({changedAxes.length})
                            </h3>
                            <div className="space-y-3">
                                {changedAxes.map(diff => (
                                    <div 
                                        key={diff.axisId}
                                        className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden"
                                    >
                                        {/* Axis Header */}
                                        <button
                                            onClick={() => setExpandedAxis(
                                                expandedAxis === diff.axisId ? null : diff.axisId
                                            )}
                                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold text-navy-900 dark:text-white">
                                                    {diff.axisName}
                                                </span>
                                                
                                                {/* Score Changes */}
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="text-slate-500">Ocena:</span>
                                                        <span className="font-medium text-slate-600 dark:text-slate-300">
                                                            {diff.v1Actual ?? '-'}
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-slate-400" />
                                                        <span className={`font-medium ${
                                                            diff.actualChange > 0 ? 'text-green-600' :
                                                            diff.actualChange < 0 ? 'text-red-600' :
                                                            'text-slate-600 dark:text-slate-300'
                                                        }`}>
                                                            {diff.v2Actual ?? '-'}
                                                        </span>
                                                        {diff.actualChange !== 0 && (
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                                diff.actualChange > 0 
                                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            }`}>
                                                                {diff.actualChange > 0 ? '+' : ''}{diff.actualChange}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="text-slate-500">Cel:</span>
                                                        <span className="font-medium text-slate-600 dark:text-slate-300">
                                                            {diff.v1Target ?? '-'}
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-slate-400" />
                                                        <span className={`font-medium ${
                                                            diff.targetChange > 0 ? 'text-green-600' :
                                                            diff.targetChange < 0 ? 'text-red-600' :
                                                            'text-slate-600 dark:text-slate-300'
                                                        }`}>
                                                            {diff.v2Target ?? '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {expandedAxis === diff.axisId ? (
                                                <ChevronUp className="w-5 h-5 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-slate-400" />
                                            )}
                                        </button>

                                        {/* Justification Diff */}
                                        {expandedAxis === diff.axisId && (
                                            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950/30">
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                                    Uzasadnienie
                                                </p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-slate-400 mb-1">Wersja {olderVersion}</p>
                                                        <div className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-slate-300 min-h-[80px]">
                                                            {diff.v1Justification || <span className="text-slate-400 italic">Brak uzasadnienia</span>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-purple-500 mb-1">Wersja {newerVersion}</p>
                                                        <div className="p-3 bg-white dark:bg-navy-900 rounded-lg border border-purple-200 dark:border-purple-500/30 text-sm text-slate-600 dark:text-slate-300 min-h-[80px]">
                                                            {diff.v2Justification || <span className="text-slate-400 italic">Brak uzasadnienia</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unchanged Axes */}
                    {unchangedAxes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                Bez zmian ({unchangedAxes.length})
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {unchangedAxes.map(diff => (
                                    <div 
                                        key={diff.axisId}
                                        className="p-3 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10"
                                    >
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                            {diff.axisName}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Ocena: {diff.v1Actual ?? '-'} / Cel: {diff.v1Target ?? '-'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-white/10 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                    >
                        Zamknij
                    </button>
                </div>
            </div>
        </div>
    );
};

