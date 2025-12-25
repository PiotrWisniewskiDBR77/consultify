import React, { useRef, useState } from 'react';
import { DRDAxis, AxisAssessment } from '../../types';
import { BarChart2, TrendingUp, Settings, Smartphone, Briefcase, Database, Users, Lock, BrainCircuit, Pencil, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AssessmentMatrixCard } from './AssessmentMatrixCard';
import { getQuestionsForAxis } from '../../services/drdStructure';
import { ACTUAL_COLORS, TARGET_COLORS } from '../../utils/assessmentColors';

interface AssessmentSummaryWorkspaceProps {
    assessment: Partial<Record<DRDAxis, AxisAssessment>>;
    onNavigate: (axis: DRDAxis) => void;
    /** Name of the assessment */
    assessmentName?: string;
    /** Whether this is a new (unsaved) assessment */
    isNewAssessment?: boolean;
    /** Callback when name changes */
    onNameChange?: (name: string) => void;
}

export const AssessmentSummaryWorkspace: React.FC<AssessmentSummaryWorkspaceProps> = ({
    assessment,
    onNavigate,
    assessmentName = 'Nowy Assessment',
    isNewAssessment = true,
    onNameChange
}) => {
    const { t: translate } = useTranslation();
    const tSidebar = translate('sidebar', { returnObjects: true }) as any;
    const componentRef = useRef<HTMLDivElement>(null);

    // Local state for name editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [localName, setLocalName] = useState(assessmentName);

    const labels: Record<DRDAxis, string> = {
        processes: tSidebar.fullStep1_proc,
        digitalProducts: tSidebar.fullStep1_prod,
        businessModels: tSidebar.fullStep1_model,
        dataManagement: tSidebar.fullStep1_data,
        culture: tSidebar.fullStep1_cult,
        cybersecurity: "Cybersecurity",
        aiMaturity: tSidebar.fullStep1_ai,
    };

    const axes: DRDAxis[] = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

    // Calculate generic stats
    const totalGap = axes.reduce((acc, axis) => {
        const data = assessment[axis];
        if (data && data.actual && data.target) {
            return acc + Math.max(0, data.target - data.actual);
        }
        return acc;
    }, 0);

    const avgMaturity = (axes.reduce((acc, axis) => acc + (assessment[axis]?.actual || 0), 0) / 7).toFixed(1);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 text-navy-900 dark:text-white p-8 overflow-y-auto" ref={componentRef}>

            {/* Header - Editable Assessment Name */}
            <div className="flex justify-between items-start mb-8">
                <div className="flex-1 min-w-0">
                    {isEditingName || isNewAssessment ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={localName}
                                onChange={(e) => setLocalName(e.target.value)}
                                onBlur={() => {
                                    setIsEditingName(false);
                                    if (onNameChange && localName.trim()) {
                                        onNameChange(localName.trim());
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingName(false);
                                        if (onNameChange && localName.trim()) {
                                            onNameChange(localName.trim());
                                        }
                                    }
                                }}
                                autoFocus={isEditingName}
                                placeholder="Nazwa assessmentu..."
                                className="text-2xl font-bold bg-transparent border-b-2 border-purple-500 focus:border-purple-400 outline-none text-navy-900 dark:text-white placeholder-slate-400 w-full max-w-md"
                            />
                            <button
                                onClick={() => {
                                    setIsEditingName(false);
                                    if (onNameChange && localName.trim()) {
                                        onNameChange(localName.trim());
                                    }
                                }}
                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg transition-colors"
                                title="Zatwierdź"
                            >
                                <Check size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <h2 className="text-2xl font-bold text-navy-900 dark:text-white truncate">
                                {assessmentName}
                            </h2>
                            <button
                                onClick={() => setIsEditingName(true)}
                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 rounded-lg transition-all"
                                title="Edytuj nazwę"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <div className="bg-white dark:bg-navy-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                        <div className="text-3xl font-bold text-blue-400">{avgMaturity}</div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 font-bold">Avg Actual</div>
                    </div>
                    <div className="bg-white dark:bg-navy-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-center min-w-[100px]">
                        <div className="text-3xl font-bold text-red-400">{totalGap}</div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 font-bold">Total Gap Points</div>
                    </div>
                </div>
            </div>

            {/* Main Chart / Table */}
            <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-6 border-b border-slate-200 dark:border-white/5 pb-4">
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white">Wizualizacja Luk (Gap Map)</h3>
                    <div className="flex gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-sm ${ACTUAL_COLORS.bg}`}></div> Obecny</div>
                        <div className="flex items-center gap-2"><div className={`w-3 h-3 ${TARGET_COLORS.bgLight} border ${TARGET_COLORS.border} rounded-sm`}></div> Docelowy</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500/20 border border-dashed border-red-500 rounded-sm"></div> Luka</div>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-4 mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-200 dark:border-white/5 pb-2">
                    {axes.map(axis => <div key={axis}>{labels[axis]}</div>)}
                </div>

                {/* Visual Bars */}
                <div className="grid grid-cols-7 gap-4 h-64 items-end pb-4">
                    {axes.map(axis => {
                        const data = assessment[axis];
                        const actual = data?.actual || 0;
                        const target = data?.target || 0;
                        const gap = Math.max(0, target - actual);

                        return (
                            <div key={axis} className="flex flex-col items-center justify-end h-full gap-1 group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 bg-white text-navy-900 text-xs p-2 rounded shadow-lg transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                    Actual: {actual} → Target: {target}
                                </div>

                                {/* Gap Bar (Top) */}
                                {gap > 0 && (
                                    <div
                                        style={{ height: `${gap * 10}%` }}
                                        className="w-full bg-red-500/10 border border-dashed border-red-500/30 rounded-t relative overflow-hidden"
                                    >
                                    </div>
                                )}

                                {/* Actual Bar (Bottom) */}
                                <div
                                    style={{ height: `${actual * 10}%` }}
                                    className={`w-full rounded-b transition-all ${!data ? 'bg-slate-200 dark:bg-slate-800' : 'bg-gradient-to-t from-blue-900 to-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                                        }`}
                                ></div>

                                <div className="mt-2 text-xs font-mono text-slate-400">
                                    {actual} <span className="text-slate-600">/</span> <span className="text-purple-400 font-bold">{target}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* NEW: 7 Matrices Summary */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                    <BarChart2 className="text-blue-400" />
                    Szczegółowa Analiza Macierzy (Matrix Deep Dive)
                </h2>
                <div className="grid grid-cols-1 gap-6">
                    {axes.map(axis => {
                        // Map axis to icon
                        const iconMap: Record<DRDAxis, React.ReactNode> = {
                            processes: <Settings size={18} />,
                            digitalProducts: <Smartphone size={18} />,
                            businessModels: <Briefcase size={18} />,
                            dataManagement: <Database size={18} />,
                            culture: <Users size={18} />,
                            cybersecurity: <Lock size={18} />,
                            aiMaturity: <BrainCircuit size={18} />,
                        };

                        const axisIdMap: Record<string, number> = {
                            'processes': 1,
                            'digitalProducts': 2,
                            'businessModels': 3,
                            'dataManagement': 4,
                            'culture': 5,
                            'cybersecurity': 6,
                            'aiMaturity': 7
                        };
                        const realAreas = getQuestionsForAxis(axisIdMap[axis]);

                        // Calculate detailed averages from area scores
                        let totalActual = 0;
                        let totalTarget = 0;
                        let areaCount = 0;

                        realAreas.forEach(area => {
                            const scores = assessment[axis]?.areaScores?.[area.id] || [0, 0];
                            const actualBitmask = scores[0];
                            const targetBitmask = scores[1];

                            // Convert bitmask to highest level
                            // Level 1 = bit 0 (1), Level 5 = bit 4 (16)
                            // Math.log2(0) is -Infinity, so handle 0 case
                            const actualLevel = actualBitmask > 0 ? Math.floor(Math.log2(actualBitmask)) + 1 : 0;
                            const targetLevel = targetBitmask > 0 ? Math.floor(Math.log2(targetBitmask)) + 1 : 0;

                            totalActual += actualLevel;
                            totalTarget += targetLevel;
                            areaCount++;
                        });

                        const calculatedActual = areaCount > 0 ? Number((totalActual / areaCount).toFixed(1)) : 0;
                        const calculatedTarget = areaCount > 0 ? Number((totalTarget / areaCount).toFixed(1)) : 0;

                        return (
                            <div key={axis} id={`matrix-card-${axis}`}>
                                <AssessmentMatrixCard
                                    title={labels[axis]}
                                    icon={iconMap[axis]}
                                    actual={calculatedActual}
                                    target={calculatedTarget}
                                    areas={realAreas}
                                    scores={assessment[axis]?.areaScores}
                                    onNavigate={() => onNavigate(axis)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

