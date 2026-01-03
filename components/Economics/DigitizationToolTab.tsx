/**
 * Digitization Tool Tab
 * 
 * Main evaluation tool for assessing digital maturity
 * Features axis selection, area evaluation, and score visualization
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    ChevronRight, ChevronDown, Check, AlertCircle, Info,
    Workflow, Package, Building, Database, Users, Shield,
    Save, RefreshCw, Keyboard
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { 
    DigitizationAnalysis, AxisScore, AreaScore 
} from './types';
import { DIGITIZATION_AXES, getLevelColor } from '../../data/digitizationEvaluationData';

interface DigitizationToolTabProps {
    analysis: DigitizationAnalysis;
    onUpdate: (analysis: DigitizationAnalysis) => void;
}

const AXIS_ICONS: Record<string, any> = {
    digital_processes: Workflow,
    digital_products: Package,
    digital_business_models: Building,
    big_data: Database,
    transformation_culture: Users,
    cybersecurity: Shield,
};

export const DigitizationToolTab: React.FC<DigitizationToolTabProps> = ({ analysis, onUpdate }) => {
    const [selectedAxisId, setSelectedAxisId] = useState<string>(DIGITIZATION_AXES[0]?.id || '');
    const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Map<string, { currentLevel: number; targetLevel: number }>>(new Map());
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

    const selectedAxis = useMemo(() => 
        DIGITIZATION_AXES.find(a => a.id === selectedAxisId), 
        [selectedAxisId]
    );

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + S - Save changes
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (pendingChanges.size > 0) {
                    saveChanges();
                }
            }
            
            // Arrow Up/Down - Navigate between axes
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const currentIndex = DIGITIZATION_AXES.findIndex(a => a.id === selectedAxisId);
                if (currentIndex !== -1) {
                    let newIndex;
                    if (e.key === 'ArrowUp') {
                        newIndex = currentIndex > 0 ? currentIndex - 1 : DIGITIZATION_AXES.length - 1;
                    } else {
                        newIndex = currentIndex < DIGITIZATION_AXES.length - 1 ? currentIndex + 1 : 0;
                    }
                    setSelectedAxisId(DIGITIZATION_AXES[newIndex].id);
                }
            }
            
            // ? - Show keyboard shortcuts help
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                setShowKeyboardHelp(prev => !prev);
            }
            
            // Escape - Close keyboard help or clear selection
            if (e.key === 'Escape') {
                setShowKeyboardHelp(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedAxisId, pendingChanges]);

    const getAxisScore = useCallback((axisId: string): AxisScore | undefined => {
        return analysis.axisScores?.[axisId];
    }, [analysis.axisScores]);

    const getAreaScore = useCallback((axisId: string, areaId: string): AreaScore | undefined => {
        const axisScore = getAxisScore(axisId);
        return axisScore?.areaScores?.[areaId];
    }, [getAxisScore]);

    const toggleArea = (areaId: string) => {
        setExpandedAreas(prev => {
            const next = new Set(prev);
            if (next.has(areaId)) {
                next.delete(areaId);
            } else {
                next.add(areaId);
            }
            return next;
        });
    };

    const handleScoreChange = useCallback(async (
        axisId: string, 
        areaId: string, 
        areaCode: string,
        currentLevel: number, 
        targetLevel: number
    ) => {
        const key = `${axisId}:${areaId}`;
        setPendingChanges(prev => {
            const next = new Map(prev);
            next.set(key, { currentLevel, targetLevel });
            return next;
        });
    }, []);

    const saveChanges = useCallback(async () => {
        if (pendingChanges.size === 0) return;

        setIsSaving(true);
        try {
            const scores = Array.from(pendingChanges.entries()).map(([key, value]) => {
                const [axisId, areaId] = key.split(':');
                const axis = DIGITIZATION_AXES.find(a => a.id === axisId);
                const area = axis?.areas.find(ar => ar.id === areaId);
                return {
                    axisId,
                    areaId,
                    areaCode: area?.code || areaId,
                    currentLevel: value.currentLevel,
                    targetLevel: value.targetLevel,
                };
            });

            const updated = await Api.updateDigitizationScores(analysis.id, scores);
            onUpdate(updated);
            setPendingChanges(new Map());
            toast.success('Zmiany zapisane');
        } catch (e) {
            toast.error('Nie udało się zapisać zmian');
        } finally {
            setIsSaving(false);
        }
    }, [analysis.id, pendingChanges, onUpdate]);

    const getCurrentLevel = (axisId: string, areaId: string): number => {
        const key = `${axisId}:${areaId}`;
        if (pendingChanges.has(key)) {
            return pendingChanges.get(key)!.currentLevel;
        }
        return getAreaScore(axisId, areaId)?.currentLevel || 0;
    };

    const getTargetLevel = (axisId: string, areaId: string): number => {
        const key = `${axisId}:${areaId}`;
        if (pendingChanges.has(key)) {
            return pendingChanges.get(key)!.targetLevel;
        }
        return getAreaScore(axisId, areaId)?.targetLevel || 0;
    };

    return (
        <div className="flex h-full">
            {/* Axis Sidebar */}
            <div className="w-72 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 shrink-0 overflow-y-auto">
                <div className="p-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Osie oceny
                    </h3>
                    <div className="space-y-2">
                        {DIGITIZATION_AXES.map(axis => {
                            const Icon = AXIS_ICONS[axis.id] || Workflow;
                            const axisScore = getAxisScore(axis.id);
                            const progress = axisScore 
                                ? Math.round((axisScore.completedAreas / axisScore.totalAreas) * 100) 
                                : 0;

                            return (
                                <button
                                    key={axis.id}
                                    onClick={() => setSelectedAxisId(axis.id)}
                                    className={`w-full text-left p-3 rounded-xl transition-all ${
                                        selectedAxisId === axis.id
                                            ? 'bg-emerald-500/10 border-emerald-500/30 border'
                                            : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${axis.color}20` }}
                                        >
                                            <Icon size={20} style={{ color: axis.color }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate ${
                                                selectedAxisId === axis.id 
                                                    ? 'text-emerald-600 dark:text-emerald-400' 
                                                    : 'text-navy-900 dark:text-white'
                                            }`}>
                                                {axis.namePl}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full transition-all"
                                                        style={{ 
                                                            width: `${progress}%`,
                                                            backgroundColor: axis.color 
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400">{progress}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {selectedAxis && (
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                                    {selectedAxis.namePl}
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    {selectedAxis.descriptionPl}
                                </p>
                            </div>
                            {pendingChanges.size > 0 && (
                                <button
                                    onClick={saveChanges}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 
                                        text-white rounded-xl font-medium transition-colors disabled:opacity-50
                                        shadow-lg shadow-emerald-600/20"
                                >
                                    {isSaving ? (
                                        <RefreshCw size={16} className="animate-spin" />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    Zapisz ({pendingChanges.size})
                                </button>
                            )}
                        </div>

                        {/* Areas */}
                        <div className="space-y-3">
                            {selectedAxis.areas.map(area => {
                                const isExpanded = expandedAreas.has(area.id);
                                const currentLevel = getCurrentLevel(selectedAxis.id, area.id);
                                const targetLevel = getTargetLevel(selectedAxis.id, area.id);
                                const hasPending = pendingChanges.has(`${selectedAxis.id}:${area.id}`);

                                return (
                                    <div 
                                        key={area.id}
                                        className={`bg-white dark:bg-navy-800 border rounded-xl overflow-hidden transition-all ${
                                            hasPending 
                                                ? 'border-emerald-500/50 ring-2 ring-emerald-500/10' 
                                                : 'border-slate-200 dark:border-white/10'
                                        }`}
                                    >
                                        {/* Area Header */}
                                        <div 
                                            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
                                            onClick={() => toggleArea(area.id)}
                                        >
                                            <button className="text-slate-400">
                                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </button>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-slate-400">{area.code}</span>
                                                    <span className="font-medium text-navy-900 dark:text-white">{area.namePl}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-xs text-slate-400 mb-1">Aktualny</p>
                                                    <div 
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white"
                                                        style={{ backgroundColor: getLevelColor(currentLevel) }}
                                                    >
                                                        {currentLevel || '-'}
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs text-slate-400 mb-1">Docelowy</p>
                                                    <div 
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold border-2"
                                                        style={{ 
                                                            borderColor: getLevelColor(targetLevel),
                                                            color: getLevelColor(targetLevel)
                                                        }}
                                                    >
                                                        {targetLevel || '-'}
                                                    </div>
                                                </div>
                                                {currentLevel > 0 && (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                        <Check size={14} className="text-emerald-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 dark:border-white/5 p-4 space-y-4">
                                                {/* Level Selector */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                            Poziom aktualny
                                                        </label>
                                                        <div className="flex gap-1">
                                                            {[0, 1, 2, 3, 4, 5, 6, 7].map(level => (
                                                                <button
                                                                    key={level}
                                                                    onClick={() => handleScoreChange(
                                                                        selectedAxis.id, 
                                                                        area.id, 
                                                                        area.code,
                                                                        level, 
                                                                        targetLevel
                                                                    )}
                                                                    className={`w-9 h-9 rounded-lg font-medium transition-all ${
                                                                        currentLevel === level
                                                                            ? 'text-white shadow-lg'
                                                                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                                                                    }`}
                                                                    style={currentLevel === level ? { 
                                                                        backgroundColor: getLevelColor(level) 
                                                                    } : undefined}
                                                                >
                                                                    {level}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                                                            Poziom docelowy
                                                        </label>
                                                        <div className="flex gap-1">
                                                            {[0, 1, 2, 3, 4, 5, 6, 7].map(level => (
                                                                <button
                                                                    key={level}
                                                                    onClick={() => handleScoreChange(
                                                                        selectedAxis.id, 
                                                                        area.id, 
                                                                        area.code,
                                                                        currentLevel, 
                                                                        level
                                                                    )}
                                                                    className={`w-9 h-9 rounded-lg font-medium transition-all ${
                                                                        targetLevel === level
                                                                            ? 'border-2 shadow-lg'
                                                                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                                                                    }`}
                                                                    style={targetLevel === level ? { 
                                                                        borderColor: getLevelColor(level),
                                                                        color: getLevelColor(level),
                                                                        backgroundColor: `${getLevelColor(level)}10`
                                                                    } : undefined}
                                                                >
                                                                    {level}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Level Description */}
                                                {currentLevel > 0 && area.levels[currentLevel - 1] && (
                                                    <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <Info size={16} className="text-emerald-500 mt-0.5" />
                                                            <div>
                                                                <p className="font-medium text-navy-900 dark:text-white">
                                                                    Poziom {currentLevel}: {area.levels[currentLevel - 1].namePl}
                                                                </p>
                                                                <p className="text-sm text-slate-500 mt-1">
                                                                    {area.levels[currentLevel - 1].descriptionPl}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Keyboard Shortcuts Help */}
            {showKeyboardHelp && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Keyboard size={20} className="text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                Skróty klawiszowe
                            </h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                                <span className="text-slate-600 dark:text-slate-300">Zapisz zmiany</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-sm font-mono">Ctrl+S</kbd>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                                <span className="text-slate-600 dark:text-slate-300">Poprzednia oś</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-sm font-mono">↑</kbd>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5">
                                <span className="text-slate-600 dark:text-slate-300">Następna oś</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-sm font-mono">↓</kbd>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-slate-600 dark:text-slate-300">Pokaż/ukryj pomoc</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-sm font-mono">?</kbd>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowKeyboardHelp(false)}
                            className="w-full mt-4 px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 
                                rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors font-medium"
                        >
                            Zamknij (Esc)
                        </button>
                    </div>
                </div>
            )}

            {/* Keyboard hint in corner */}
            <div className="fixed bottom-4 right-4 z-40">
                <button
                    onClick={() => setShowKeyboardHelp(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 dark:bg-white/10 backdrop-blur-sm
                        text-white/80 rounded-lg text-sm hover:bg-slate-700/80 dark:hover:bg-white/20 transition-colors"
                >
                    <Keyboard size={14} />
                    <span>Naciśnij ? aby zobaczyć skróty</span>
                </button>
            </div>
        </div>
    );
};

export default DigitizationToolTab;

