import React, { useState, useEffect } from 'react';
import { DRDAxis, MaturityLevel, AxisAssessment } from '../../types';
import { ArrowRight, Info, CheckCircle2, AlertTriangle, BrainCircuit, TrendingUp, Lightbulb, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LevelNavigator } from './LevelNavigator';
import { LevelSelector } from './LevelSelector';
import { LevelDetailCard } from './LevelDetailCard';

interface AssessmentAxisWorkspaceProps {
    axis: DRDAxis;
    data: Partial<AxisAssessment>;
    onChange: (data: Partial<AxisAssessment>) => void;
    onNext: () => void;
    context: {
        goals: string[];
        challenges: string[];
        industry: string;
    };
}

export const AssessmentAxisWorkspace: React.FC<AssessmentAxisWorkspaceProps> = ({
    axis,
    data,
    onChange,
    onNext,
    context
}) => {
    const { t } = useTranslation();

    // Fetch translated content
    const axisContent = t(`assessment.axisContent.${axis}`, { returnObjects: true }) as { title: string; intro?: string; levels?: Record<string, string>, areas?: Record<string, { title: string, levels: Record<string, string> }> };
    const workspaceT = t('assessment.workspace', { returnObjects: true }) as any;

    // Resolve areas
    const axisAreas = axisContent.areas || null;
    const hasSubAreas = !!axisAreas;

    // --- State Management ---
    const [currentAreaKey, setCurrentAreaKey] = useState<string | null>(null);
    const [currentLevelView, setCurrentLevelView] = useState<number>(1); // New state for Level View

    // Initialize first area
    useEffect(() => {
        if (hasSubAreas && !currentAreaKey) {
            const firstKey = Object.keys(axisAreas)[0];
            if (firstKey) setCurrentAreaKey(firstKey);
        }
    }, [hasSubAreas, axisAreas, currentAreaKey]);

    // Backfill logic
    useEffect(() => {
        if (hasSubAreas && (!data.areaScores || Object.keys(data.areaScores).length === 0)) {
            if (data.actual || data.target) {
                const initialScores: Record<string, number[]> = {};
                Object.keys(axisAreas).forEach(key => {
                    initialScores[key] = [data.actual || 0, data.target || 0];
                });
                onChange({ ...data, areaScores: initialScores });
            }
        }
    }, [hasSubAreas, data.actual, data.target, axisAreas]);

    // --- Logic ---
    const updateAggregateScores = (newAreaScores: Record<string, number[]>) => {
        let totalActual = 0;
        let totalTarget = 0;
        let countActual = 0;
        let countTarget = 0;

        Object.values(newAreaScores).forEach(scores => {
            if (scores[0] > 0) { totalActual += scores[0]; countActual++; }
            if (scores[1] > 0) { totalTarget += scores[1]; countTarget++; }
        });

        const avgActual = countActual > 0 ? Math.round(totalActual / countActual) as MaturityLevel : undefined;
        const avgTarget = countTarget > 0 ? Math.round(totalTarget / countTarget) as MaturityLevel : undefined;

        onChange({
            ...data,
            areaScores: newAreaScores,
            actual: avgActual,
            target: avgTarget
        });
    };

    const handleLevelSelect = (type: 'actual' | 'target', level: number) => {
        if (!hasSubAreas) {
            // Simple Mode
            onChange({ ...data, [type]: level });
            return;
        }

        // Detailed Mode
        if (currentAreaKey) {
            const currentScores = data.areaScores?.[currentAreaKey] || [0, 0];
            const newScores = [...currentScores];

            if (type === 'actual') newScores[0] = level;
            else newScores[1] = level;

            const updatedAreaScores = {
                ...(data.areaScores || {}),
                [currentAreaKey]: newScores
            };
            updateAggregateScores(updatedAreaScores);
        }
    };

    // --- Helpers ---
    const activeArea = currentAreaKey && axisAreas ? axisAreas[currentAreaKey] : null;
    const activeScores = currentAreaKey && data.areaScores ? (data.areaScores[currentAreaKey] || [0, 0]) : [0, 0];

    // Main Levels for fallback
    const mainLevelsRecord = axisContent.levels
        ? (Array.isArray(axisContent.levels)
            ? axisContent.levels.reduce((acc, val, idx) => ({ ...acc, [idx + 1]: val }), {})
            : axisContent.levels)
        : {};

    // --- Render ---
    return (
        <div
            data-tour="drd-workspace"
            className="flex flex-col h-full bg-white dark:bg-navy-900 text-navy-900 dark:text-white overflow-hidden"
        >
            {/* Header */}
            <div className="h-20 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 bg-white dark:bg-navy-900 shrink-0 z-20 relative">
                <div className="flex items-center gap-6">
                    {/* Axis Label */}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {workspaceT.assessmentArea || 'ASSESSMENT AREA'}
                        </label>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            {t(`sidebar.fullStep1_${axis === 'cybersecurity' ? 'cyber' : axis === 'aiMaturity' ? 'ai' : axis === 'processes' ? 'proc' : axis === 'digitalProducts' ? 'prod' : axis === 'businessModels' ? 'model' : axis === 'dataManagement' ? 'data' : axis === 'culture' ? 'cult' : 'proc'}`) || axisContent?.title || axis}
                            <Info size={14} className="text-slate-500 cursor-pointer hover:text-navy-900 dark:hover:text-white transition-colors" />
                        </h2>
                    </div>

                    {/* Sub-Area Selector (If applicable) */}
                    {hasSubAreas && (
                        <div className="relative group ml-4 pl-4 border-l border-slate-200 dark:border-white/10">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5 block">{workspaceT.functionalArea || 'FUNCTIONAL AREA'}</span>

                            {/* Dropdown Trigger */}
                            <div className="flex items-center gap-2 cursor-pointer text-navy-900 dark:text-white font-bold text-sm bg-slate-100 dark:bg-navy-950/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all">
                                {activeArea?.title || workspaceT.selectArea || 'Select Area'}
                                <ChevronDown size={14} className="text-slate-400" />
                            </div>

                            {/* Dropdown Menu */}
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50">
                                {Object.entries(axisAreas).map(([key, area]: [string, any]) => {
                                    const scores = data.areaScores?.[key] || [0, 0];
                                    const isCompleted = scores[0] > 0 && scores[1] > 0;

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setCurrentAreaKey(key)}
                                            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${key === currentAreaKey ? 'bg-purple-50 dark:bg-purple-600/10 text-purple-600 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            <span className="text-sm font-medium">{area.title}</span>
                                            {isCompleted && <CheckCircle2 size={14} className="text-green-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    {/* Overall Progress */}
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-navy-950/50 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/5">
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{workspaceT.axisProgress || 'AXIS PROGRESS'}</span>
                        <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                        <div className="flex gap-4 text-sm">
                            <div>
                                <span className="text-xs text-slate-500 block">{workspaceT.approved || 'Approved'}</span>
                                <span className="font-bold text-blue-400">
                                    {(() => {
                                        if (hasSubAreas) {
                                            const total = Object.keys(axisAreas).length;
                                            const completed = Object.values(data.areaScores || {}).filter(s => s[0] > 0 && s[1] > 0).length;
                                            return `${completed}/${total}`;
                                        }
                                        return (data.actual && data.target) ? '1/1' : '0/1';
                                    })()}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-slate-500 block">{workspaceT.remaining || 'Remaining'}</span>
                                <span className="font-bold text-purple-400">
                                    {(() => {
                                        if (hasSubAreas) {
                                            const total = Object.keys(axisAreas).length;
                                            const completed = Object.values(data.areaScores || {}).filter(s => s[0] > 0 && s[1] > 0).length;
                                            return total - completed;
                                        }
                                        return (data.actual && data.target) ? '0' : '1';
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onNext}
                        disabled={!data.actual || !data.target}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${data.actual && data.target
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {workspaceT.confirmNext || 'Potwierdź i Dalej'}
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Split View Container */}
            <div className="flex-1 flex overflow-hidden">

                {/* 1. Sidebar (Level Navigation) */}
                <LevelNavigator
                    levels={(hasSubAreas && activeArea ? activeArea.levels : mainLevelsRecord) as Record<string, string>}
                    currentLevel={currentLevelView}
                    onSelectLevel={setCurrentLevelView}
                    actualScore={hasSubAreas ? activeScores[0] : (data.actual || 0)}
                    targetScore={hasSubAreas ? activeScores[1] : (data.target || 0)}
                />

                {/* 2. Main Content (Level Detail) */}
                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy-900 relative">
                    <div className="max-w-4xl mx-auto p-8 lg:p-12">

                        <LevelDetailCard
                            level={currentLevelView}
                            title={(hasSubAreas && activeArea ? activeArea.levels[currentLevelView] : mainLevelsRecord[currentLevelView]) || `${t('common.level')} ${currentLevelView}`}
                            description={
                                /* Try to get specific description if available, else generic */
                                (hasSubAreas && activeArea
                                    ? t(`assessment.axisContent.${axis}.areas.${currentAreaKey}.level${currentLevelView}Desc`)
                                    : t(`assessment.axisContent.${axis}.level${currentLevelView}Desc`)) as string ||
                                (t('assessment.card.defaultDesc') as string) || "This level represents a specific stage of maturity in your digital transformation. Read the helper questions below to better understand this stage."
                            }
                            helperQuestions={(() => {
                                const key = hasSubAreas && activeArea
                                    ? `assessment.axisContent.${axis}.areas.${currentAreaKey}.level${currentLevelView}Questions`
                                    : `assessment.axisContent.${axis}.level${currentLevelView}Questions`;

                                const questions = t(key, { returnObjects: true });
                                return Array.isArray(questions) ? questions : [
                                    "Does your organization have formalized procedures for this area?",
                                    "Are data collected automatically or manually?",
                                    "Are decisions made based on real-time data?"
                                ];
                            })()}
                            formula={
                                (hasSubAreas && activeArea
                                    ? t(`assessment.axisContent.${axis}.areas.${currentAreaKey}.level${currentLevelView}Formula`)
                                    : t(`assessment.axisContent.${axis}.level${currentLevelView}Formula`)) as string
                            }

                            // Check bits for checklist behavior
                            isActual={(() => {
                                const score = hasSubAreas ? (data.areaScores?.[currentAreaKey || '']?.[0] || 0) : (data.actual || 0);
                                return (score & (1 << (currentLevelView - 1))) !== 0;
                            })()}
                            isTarget={(() => {
                                const score = hasSubAreas ? (data.areaScores?.[currentAreaKey || '']?.[1] || 0) : (data.target || 0);
                                return (score & (1 << (currentLevelView - 1))) !== 0;
                            })()}

                            onSetActual={() => {
                                const bit = 1 << (currentLevelView - 1);
                                if (hasSubAreas && currentAreaKey) {
                                    const currentScores = [...(data.areaScores?.[currentAreaKey] || [0, 0])];
                                    // Toggle Actual
                                    if ((currentScores[0] & bit) !== 0) {
                                        currentScores[0] &= ~bit;
                                    } else {
                                        currentScores[0] |= bit;
                                        currentScores[1] &= ~bit; // Mutually exclusive
                                    }

                                    const newAreaScores = { ...(data.areaScores || {}), [currentAreaKey]: currentScores };

                                    // Recalculate aggregates using Population Count (Number of set bits)
                                    let totalActual = 0;
                                    let totalTarget = 0;
                                    let countActual = 0;
                                    let countTarget = 0;
                                    const popcount = (n: number) => n.toString(2).replace(/0/g, "").length;

                                    Object.values(newAreaScores).forEach(scores => {
                                        // Count "Done" if actual > 0
                                        if (scores[0] > 0) {
                                            totalActual += popcount(scores[0]);
                                            countActual++;
                                        }
                                        if (scores[1] > 0) {
                                            // For target, we might want max level or count. Let's use count for consistency.
                                            totalTarget += popcount(scores[1]);
                                            countTarget++;
                                        }
                                    });

                                    const updates: Partial<AxisAssessment> = {
                                        areaScores: newAreaScores,
                                        actual: countActual > 0 ? Math.round(totalActual / countActual) as MaturityLevel : undefined,
                                        target: countTarget > 0 ? Math.round(totalTarget / countTarget) as MaturityLevel : undefined
                                    };
                                    onChange({ ...data, ...updates });
                                } else {
                                    // Simple Mode
                                    let actual = (data.actual || 0) as number;
                                    let target = (data.target || 0) as number;
                                    if ((actual & bit) !== 0) actual &= ~bit;
                                    else { actual |= bit; target &= ~bit; }
                                    onChange({ ...data, actual: actual as MaturityLevel, target: target as MaturityLevel });
                                }
                            }}
                            onSetTarget={() => {
                                const bit = 1 << (currentLevelView - 1);
                                if (hasSubAreas && currentAreaKey) {
                                    const currentScores = [...(data.areaScores?.[currentAreaKey] || [0, 0])];
                                    // Toggle Target
                                    if ((currentScores[1] & bit) !== 0) {
                                        currentScores[1] &= ~bit;
                                    } else {
                                        currentScores[1] |= bit;
                                        currentScores[0] &= ~bit; // Mutually exclusive
                                    }

                                    const newAreaScores = { ...(data.areaScores || {}), [currentAreaKey]: currentScores };

                                    // Recalculate aggregates
                                    let totalActual = 0;
                                    let totalTarget = 0;
                                    let countActual = 0;
                                    let countTarget = 0;
                                    const popcount = (n: number) => n.toString(2).replace(/0/g, "").length;

                                    Object.values(newAreaScores).forEach(scores => {
                                        if (scores[0] > 0) { totalActual += popcount(scores[0]); countActual++; }
                                        if (scores[1] > 0) { totalTarget += popcount(scores[1]); countTarget++; }
                                    });

                                    const updates: Partial<AxisAssessment> = {
                                        areaScores: newAreaScores,
                                        actual: countActual > 0 ? Math.round(totalActual / countActual) as MaturityLevel : undefined,
                                        target: countTarget > 0 ? Math.round(totalTarget / countTarget) as MaturityLevel : undefined
                                    };
                                    onChange({ ...data, ...updates });
                                } else {
                                    // Simple Mode
                                    let actual = (data.actual || 0) as number;
                                    let target = (data.target || 0) as number;
                                    if ((target & bit) !== 0) target &= ~bit;
                                    else { target |= bit; actual &= ~bit; }
                                    onChange({ ...data, actual: actual as MaturityLevel, target: target as MaturityLevel });
                                }
                            }}
                            onSetNA={() => {
                                const bit = 1 << (currentLevelView - 1);
                                if (hasSubAreas && currentAreaKey) {
                                    const currentScores = [...(data.areaScores?.[currentAreaKey] || [0, 0])];
                                    // Clear both bits
                                    currentScores[0] &= ~bit;
                                    currentScores[1] &= ~bit;

                                    const newAreaScores = { ...(data.areaScores || {}), [currentAreaKey]: currentScores };

                                    // Recalculate aggregates
                                    let totalActual = 0;
                                    let totalTarget = 0;
                                    let countActual = 0;
                                    let countTarget = 0;
                                    const popcount = (n: number) => n.toString(2).replace(/0/g, "").length;

                                    Object.values(newAreaScores).forEach(scores => {
                                        if (scores[0] > 0) { totalActual += popcount(scores[0]); countActual++; }
                                        if (scores[1] > 0) { totalTarget += popcount(scores[1]); countTarget++; }
                                    });

                                    const updates: Partial<AxisAssessment> = {
                                        areaScores: newAreaScores,
                                        actual: countActual > 0 ? Math.round(totalActual / countActual) as MaturityLevel : undefined,
                                        target: countTarget > 0 ? Math.round(totalTarget / countTarget) as MaturityLevel : undefined
                                    };
                                    onChange({ ...data, ...updates });
                                } else {
                                    // Simple Mode
                                    let actual = (data.actual || 0) as number;
                                    let target = (data.target || 0) as number;
                                    actual &= ~bit;
                                    target &= ~bit;
                                    onChange({ ...data, actual: actual as MaturityLevel, target: target as MaturityLevel });
                                }
                            }}
                            notes={data.justification || ''} // Using justification as notes placeholder for now
                            onNotesChange={(text: string) => onChange({ ...data, justification: text })}
                            onAiAssist={() => {
                                // Placeholder for AI integration
                                const currentNotes = data.justification || '';
                                onChange({
                                    ...data,
                                    justification: currentNotes + (currentNotes ? "\n\n" : "") + "[Sugestia AI]: Biorąc pod uwagę Twój obecny poziom, warto skupić się najpierw na dokumentacji procesowej."
                                });
                            }}
                        />

                    </div>
                </div>

            </div>
        </div>
    );
};
