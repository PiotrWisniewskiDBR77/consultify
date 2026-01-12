/**
 * DBR77 Lean 4.0 Assessment Map Component
 *
 * Autorska metoda DBR77: Pomierz → Zoptymalizuj → Automatyzuj
 *
 * Features:
 * - 3 Phase Tabs (Measure, Optimize, Automate)
 * - 2 Dimensions (Processes, Workstations)
 * - 8 Wastes (TIMWOODS) identification
 * - Automation potential assessment
 */

import {
    AlertTriangle,
    BarChart3,
    ChevronDown,
    ChevronRight,
    Clock,
    Cpu,
    Edit3,
    Info,
    Move,
    Package,
    Plus,
    PlusCircle,
    Ruler,
    Settings,
    Target,
    Trash2,
    TrendingUp,
    Truck,
    Users,
    UserX,
    XCircle,
    Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    AutomationTech,
    calculateAutomationPotential,
    calculateLeanMaturity,
    calculateTotalSavings,
    createEmptyDBR77Assessment,
    createEmptyProcessAssessment,
    createEmptyWorkstationAssessment,
    DBR77_AUTOMATION_TECHNOLOGIES,
    DBR77_LEAN_MATURITY_LEVELS,
    DBR77_PHASES,
    DBR77_ROLE_EVOLUTION,
    DBR77_WASTES,
    DBR77AssessmentData,
    DBR77Dimension,
    DBR77Phase,
    getTopWastes,
    ProcessAssessment,
    RoleEvolution,
    WasteType,
    WorkstationAssessment,
} from '../../../services/dbr77LeanStructure';

// ============================================
// TYPES
// ============================================

interface DBR77LeanMapProps {
    data?: DBR77AssessmentData;
    onChange?: (data: DBR77AssessmentData) => void;
    readOnly?: boolean;
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Phase Tab Selector
 */
const DBR77PhaseSelector: React.FC<{
    activePhase: DBR77Phase;
    onPhaseChange: (phase: DBR77Phase) => void;
}> = ({ activePhase, onPhaseChange }) => {
    const IconMap: Record<string, React.FC<{ className?: string; size?: number }>> = {
        Ruler: Ruler,
        TrendingUp: TrendingUp,
        Cpu: Cpu,
    };

    return (
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-navy-800 rounded-xl">
            {DBR77_PHASES.map((phase) => {
                const Icon = IconMap[phase.icon] || Ruler;
                const isActive = activePhase === phase.id;

                return (
                    <button
                        key={phase.id}
                        onClick={() => onPhaseChange(phase.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                            isActive
                                ? `bg-${phase.color}-500 text-white shadow-lg`
                                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-700'
                        }`}
                    >
                        <Icon size={18} />
                        <div className="text-left">
                            <div className="font-bold">{phase.name}</div>
                            <div className="text-xs opacity-80">{phase.nameEN}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Dimension Toggle
 */
const DBR77DimensionToggle: React.FC<{
    activeDimension: DBR77Dimension;
    onDimensionChange: (dim: DBR77Dimension) => void;
    processCount: number;
    workstationCount: number;
}> = ({ activeDimension, onDimensionChange, processCount, workstationCount }) => (
    <div className="flex gap-2">
        <button
            onClick={() => onDimensionChange('PROCESSES')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeDimension === 'PROCESSES'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
            }`}
        >
            <Settings size={18} />
            <span>Procesy</span>
            <span className="px-2 py-0.5 rounded bg-white/20 text-xs">{processCount}</span>
        </button>
        <button
            onClick={() => onDimensionChange('WORKSTATIONS')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeDimension === 'WORKSTATIONS'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
            }`}
        >
            <Users size={18} />
            <span>Stanowiska</span>
            <span className="px-2 py-0.5 rounded bg-white/20 text-xs">{workstationCount}</span>
        </button>
    </div>
);

/**
 * Waste Selector (8 wastes - TIMWOODS)
 */
const WasteSelector: React.FC<{
    selectedWastes: WasteType[];
    wasteImpact: Partial<Record<WasteType, number>>;
    onChange: (wastes: WasteType[], impact: Partial<Record<WasteType, number>>) => void;
    readOnly?: boolean;
}> = ({ selectedWastes, wasteImpact, onChange, readOnly }) => {
    const IconMap: Record<string, React.FC<{ className?: string; size?: number }>> = {
        Truck: Truck,
        Package: Package,
        Move: Move,
        Clock: Clock,
        PlusCircle: PlusCircle,
        Settings: Settings,
        XCircle: XCircle,
        UserX: UserX,
    };

    const toggleWaste = (wasteId: WasteType) => {
        if (readOnly) return;

        const newSelected = selectedWastes.includes(wasteId)
            ? selectedWastes.filter((w) => w !== wasteId)
            : [...selectedWastes, wasteId];

        const newImpact = { ...wasteImpact };
        if (!selectedWastes.includes(wasteId)) {
            newImpact[wasteId] = 3; // Default impact
        } else {
            delete newImpact[wasteId];
        }

        onChange(newSelected, newImpact);
    };

    const updateImpact = (wasteId: WasteType, impact: number) => {
        if (readOnly) return;
        onChange(selectedWastes, { ...wasteImpact, [wasteId]: impact });
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Zidentyfikowane Marnotrawstwa (TIMWOODS)
            </label>
            <div className="grid grid-cols-4 gap-2">
                {DBR77_WASTES.map((waste) => {
                    const Icon = IconMap[waste.icon] || Package;
                    const isSelected = selectedWastes.includes(waste.id);
                    const impact = wasteImpact[waste.id] || 0;

                    return (
                        <div key={waste.id} className="relative group">
                            <button
                                onClick={() => toggleWaste(waste.id)}
                                disabled={readOnly}
                                className={`w-full p-2 rounded-lg text-center transition-all ${
                                    isSelected
                                        ? `bg-${waste.color}-100 dark:bg-${waste.color}-900/30 border-2 border-${waste.color}-500`
                                        : 'bg-slate-100 dark:bg-navy-800 border-2 border-transparent hover:border-slate-300'
                                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                                <Icon
                                    size={20}
                                    className={`mx-auto mb-1 ${isSelected ? `text-${waste.color}-500` : 'text-slate-400'}`}
                                />
                                <div
                                    className={`text-xs font-medium ${isSelected ? `text-${waste.color}-700 dark:text-${waste.color}-400` : 'text-slate-500'}`}
                                >
                                    {waste.name}
                                </div>
                            </button>

                            {/* Impact slider */}
                            {isSelected && (
                                <div className="mt-1 flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => updateImpact(waste.id, level)}
                                            disabled={readOnly}
                                            className={`flex-1 h-2 rounded ${
                                                impact >= level
                                                    ? `bg-${waste.color}-500`
                                                    : 'bg-slate-200 dark:bg-navy-700'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {waste.description}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Process Card
 */
const ProcessCard: React.FC<{
    process: ProcessAssessment;
    activePhase: DBR77Phase;
    onChange: (process: ProcessAssessment) => void;
    onDelete: () => void;
    readOnly?: boolean;
    expanded?: boolean;
    onToggleExpand: () => void;
}> = ({ process, activePhase, onChange, onDelete, readOnly, expanded, onToggleExpand }) => {
    const phaseConfig = DBR77_PHASES.find((p) => p.id === activePhase)!;

    return (
        <div
            className={`bg-white dark:bg-navy-950/50 rounded-xl border-2 transition-all ${
                expanded ? `border-${phaseConfig.color}-500 shadow-lg` : 'border-slate-200 dark:border-white/10'
            }`}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <button onClick={onToggleExpand} className="flex items-center gap-3 flex-1">
                    <div
                        className={`w-10 h-10 rounded-lg bg-${phaseConfig.color}-100 dark:bg-${phaseConfig.color}-900/30 flex items-center justify-center`}
                    >
                        <Settings className={`w-5 h-5 text-${phaseConfig.color}-500`} />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-navy-900 dark:text-white">{process.name}</h4>
                        <p className="text-xs text-slate-500">
                            {process.department} • {process.category}
                        </p>
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    {/* Quick Stats */}
                    {activePhase === 'MEASURE' && (
                        <div className="text-right text-xs">
                            <div className="text-slate-500">
                                OEE: <span className="font-bold">{process.currentState.oee}%</span>
                            </div>
                            <div className="text-slate-500">
                                Lead: <span className="font-bold">{process.currentState.leadTime}d</span>
                            </div>
                        </div>
                    )}
                    {activePhase === 'OPTIMIZE' && (
                        <div className="text-right text-xs">
                            <div className="text-slate-500">
                                5S: <span className="font-bold">{process.leanAssessment.fiveSLevel}/5</span>
                            </div>
                            <div className="text-slate-500">
                                Waste:{' '}
                                <span className="font-bold">{process.leanAssessment.wasteIdentified.length}</span>
                            </div>
                        </div>
                    )}
                    {activePhase === 'AUTOMATE' && (
                        <div className="text-right text-xs">
                            <div className="text-slate-500">
                                Feasibility:{' '}
                                <span className="font-bold">{process.automationPotential.feasibility}/5</span>
                            </div>
                            <div className="text-green-600">
                                Savings:{' '}
                                <span className="font-bold">
                                    {(process.automationPotential.estimatedSavings / 1000).toFixed(0)}k PLN
                                </span>
                            </div>
                        </div>
                    )}

                    {!readOnly && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-200 dark:border-white/10 pt-3 space-y-4">
                    {/* Phase-specific content */}
                    {activePhase === 'MEASURE' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs text-slate-500">Cycle Time (s)</label>
                                <input
                                    type="number"
                                    value={process.currentState.cycleTime}
                                    onChange={(e) =>
                                        onChange({
                                            ...process,
                                            currentState: {
                                                ...process.currentState,
                                                cycleTime: Number(e.target.value),
                                            },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Lead Time (days)</label>
                                <input
                                    type="number"
                                    value={process.currentState.leadTime}
                                    onChange={(e) =>
                                        onChange({
                                            ...process,
                                            currentState: { ...process.currentState, leadTime: Number(e.target.value) },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">OEE (%)</label>
                                <input
                                    type="number"
                                    value={process.currentState.oee}
                                    onChange={(e) =>
                                        onChange({
                                            ...process,
                                            currentState: { ...process.currentState, oee: Number(e.target.value) },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Defect Rate (%)</label>
                                <input
                                    type="number"
                                    value={process.currentState.defectRate}
                                    onChange={(e) =>
                                        onChange({
                                            ...process,
                                            currentState: {
                                                ...process.currentState,
                                                defectRate: Number(e.target.value),
                                            },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {activePhase === 'OPTIMIZE' && (
                        <>
                            <WasteSelector
                                selectedWastes={process.leanAssessment.wasteIdentified}
                                wasteImpact={process.leanAssessment.wasteImpact}
                                onChange={(wastes, impact) =>
                                    onChange({
                                        ...process,
                                        leanAssessment: {
                                            ...process.leanAssessment,
                                            wasteIdentified: wastes,
                                            wasteImpact: impact as Record<WasteType, number>,
                                        },
                                    })
                                }
                                readOnly={readOnly}
                            />

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500">5S Level (1-5)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={process.leanAssessment.fiveSLevel}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                leanAssessment: {
                                                    ...process.leanAssessment,
                                                    fiveSLevel: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Visual Mgmt (1-5)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={process.leanAssessment.visualManagement}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                leanAssessment: {
                                                    ...process.leanAssessment,
                                                    visualManagement: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Flow Level (1-5)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={process.leanAssessment.continuousFlow}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                leanAssessment: {
                                                    ...process.leanAssessment,
                                                    continuousFlow: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={process.leanAssessment.standardWorkDefined}
                                            onChange={(e) =>
                                                onChange({
                                                    ...process,
                                                    leanAssessment: {
                                                        ...process.leanAssessment,
                                                        standardWorkDefined: e.target.checked,
                                                    },
                                                })
                                            }
                                            disabled={readOnly}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Standard Work</span>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {activePhase === 'AUTOMATE' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500">Feasibility (1-5)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={process.automationPotential.feasibility}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                automationPotential: {
                                                    ...process.automationPotential,
                                                    feasibility: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Est. Savings (PLN/yr)</label>
                                    <input
                                        type="number"
                                        value={process.automationPotential.estimatedSavings}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                automationPotential: {
                                                    ...process.automationPotential,
                                                    estimatedSavings: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Implementation (mo)</label>
                                    <input
                                        type="number"
                                        value={process.automationPotential.implementationTime}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                automationPotential: {
                                                    ...process.automationPotential,
                                                    implementationTime: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Complexity</label>
                                    <select
                                        value={process.automationPotential.complexity}
                                        onChange={(e) =>
                                            onChange({
                                                ...process,
                                                automationPotential: {
                                                    ...process.automationPotential,
                                                    complexity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH',
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                    </select>
                                </div>
                            </div>

                            {/* Technology Selection */}
                            <div>
                                <label className="text-xs text-slate-500 mb-2 block">Recommended Technologies</label>
                                <div className="flex flex-wrap gap-2">
                                    {DBR77_AUTOMATION_TECHNOLOGIES.map((tech) => {
                                        const isSelected = process.automationPotential.recommendedTechnologies.includes(
                                            tech.id,
                                        );
                                        return (
                                            <button
                                                key={tech.id}
                                                onClick={() => {
                                                    if (readOnly) return;
                                                    const newTechs = isSelected
                                                        ? process.automationPotential.recommendedTechnologies.filter(
                                                              (t) => t !== tech.id,
                                                          )
                                                        : [
                                                              ...process.automationPotential.recommendedTechnologies,
                                                              tech.id,
                                                          ];
                                                    onChange({
                                                        ...process,
                                                        automationPotential: {
                                                            ...process.automationPotential,
                                                            recommendedTechnologies: newTechs,
                                                        },
                                                    });
                                                }}
                                                disabled={readOnly}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                    isSelected
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                                            >
                                                {tech.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Workstation Card
 */
const WorkstationCard: React.FC<{
    workstation: WorkstationAssessment;
    activePhase: DBR77Phase;
    onChange: (ws: WorkstationAssessment) => void;
    onDelete: () => void;
    readOnly?: boolean;
    expanded?: boolean;
    onToggleExpand: () => void;
}> = ({ workstation, activePhase, onChange, onDelete, readOnly, expanded, onToggleExpand }) => {
    const phaseConfig = DBR77_PHASES.find((p) => p.id === activePhase)!;
    const roleEvolutionConfig = DBR77_ROLE_EVOLUTION[workstation.automationPotential.roleEvolution];

    return (
        <div
            className={`bg-white dark:bg-navy-950/50 rounded-xl border-2 transition-all ${
                expanded ? `border-${phaseConfig.color}-500 shadow-lg` : 'border-slate-200 dark:border-white/10'
            }`}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <button onClick={onToggleExpand} className="flex items-center gap-3 flex-1">
                    <div
                        className={`w-10 h-10 rounded-lg bg-${phaseConfig.color}-100 dark:bg-${phaseConfig.color}-900/30 flex items-center justify-center`}
                    >
                        <Users className={`w-5 h-5 text-${phaseConfig.color}-500`} />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-navy-900 dark:text-white">{workstation.name}</h4>
                        <p className="text-xs text-slate-500">
                            {workstation.department} • {workstation.headcount} FTE
                        </p>
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    {activePhase === 'AUTOMATE' && (
                        <span
                            className={`px-2 py-1 rounded text-xs font-medium bg-${roleEvolutionConfig.color}-100 text-${roleEvolutionConfig.color}-700`}
                        >
                            {roleEvolutionConfig.name}
                        </span>
                    )}

                    {!readOnly && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
            </div>

            {/* Expanded Content - similar structure to ProcessCard */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-200 dark:border-white/10 pt-3 space-y-4">
                    {activePhase === 'MEASURE' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs text-slate-500">Tasks/Day</label>
                                <input
                                    type="number"
                                    value={workstation.currentState.tasksPerDay}
                                    onChange={(e) =>
                                        onChange({
                                            ...workstation,
                                            currentState: {
                                                ...workstation.currentState,
                                                tasksPerDay: Number(e.target.value),
                                            },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Avg Task Time (min)</label>
                                <input
                                    type="number"
                                    value={workstation.currentState.avgTaskTime}
                                    onChange={(e) =>
                                        onChange({
                                            ...workstation,
                                            currentState: {
                                                ...workstation.currentState,
                                                avgTaskTime: Number(e.target.value),
                                            },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Error Rate (%)</label>
                                <input
                                    type="number"
                                    value={workstation.currentState.errorRate}
                                    onChange={(e) =>
                                        onChange({
                                            ...workstation,
                                            currentState: {
                                                ...workstation.currentState,
                                                errorRate: Number(e.target.value),
                                            },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Overtime (h/week)</label>
                                <input
                                    type="number"
                                    value={workstation.currentState.overtimeHours}
                                    onChange={(e) =>
                                        onChange({
                                            ...workstation,
                                            currentState: {
                                                ...workstation.currentState,
                                                overtimeHours: Number(e.target.value),
                                            },
                                        })
                                    }
                                    disabled={readOnly}
                                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {activePhase === 'OPTIMIZE' && (
                        <>
                            <WasteSelector
                                selectedWastes={workstation.leanAssessment.wasteInRole}
                                wasteImpact={workstation.leanAssessment.wasteImpact}
                                onChange={(wastes, impact) =>
                                    onChange({
                                        ...workstation,
                                        leanAssessment: {
                                            ...workstation.leanAssessment,
                                            wasteInRole: wastes,
                                            wasteImpact: impact as Record<WasteType, number>,
                                        },
                                    })
                                }
                                readOnly={readOnly}
                            />

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500">5S Level (1-5)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={workstation.leanAssessment.workplaceOrganization}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                leanAssessment: {
                                                    ...workstation.leanAssessment,
                                                    workplaceOrganization: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Cross-Training (1-5)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={workstation.leanAssessment.crossTraining}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                leanAssessment: {
                                                    ...workstation.leanAssessment,
                                                    crossTraining: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Kaizen/month</label>
                                    <input
                                        type="number"
                                        value={workstation.leanAssessment.kaizen}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                leanAssessment: {
                                                    ...workstation.leanAssessment,
                                                    kaizen: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={workstation.leanAssessment.standardizedWork}
                                            onChange={(e) =>
                                                onChange({
                                                    ...workstation,
                                                    leanAssessment: {
                                                        ...workstation.leanAssessment,
                                                        standardizedWork: e.target.checked,
                                                    },
                                                })
                                            }
                                            disabled={readOnly}
                                            className="w-4 h-4 rounded"
                                        />
                                        <span className="text-sm">Standard Work</span>
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {activePhase === 'AUTOMATE' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500">Auto. Tasks (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={workstation.automationPotential.taskAutomationPercent}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                automationPotential: {
                                                    ...workstation.automationPotential,
                                                    taskAutomationPercent: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Augment. Tasks (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={workstation.automationPotential.augmentationPercent}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                automationPotential: {
                                                    ...workstation.automationPotential,
                                                    augmentationPercent: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Est. Savings (PLN/yr)</label>
                                    <input
                                        type="number"
                                        value={workstation.automationPotential.estimatedSavings}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                automationPotential: {
                                                    ...workstation.automationPotential,
                                                    estimatedSavings: Number(e.target.value),
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Role Evolution</label>
                                    <select
                                        value={workstation.automationPotential.roleEvolution}
                                        onChange={(e) =>
                                            onChange({
                                                ...workstation,
                                                automationPotential: {
                                                    ...workstation.automationPotential,
                                                    roleEvolution: e.target.value as RoleEvolution,
                                                },
                                            })
                                        }
                                        disabled={readOnly}
                                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-navy-900 text-sm"
                                    >
                                        {Object.entries(DBR77_ROLE_EVOLUTION).map(([key, config]) => (
                                            <option key={key} value={key}>
                                                {config.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Legal Notice Banner
 */
const DBR77LegalNotice: React.FC = () => (
    <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-sm text-cyan-800 dark:text-cyan-200">
            <strong>Metoda DBR77 Lean 4.0</strong> (Pomierz-Zoptymalizuj-Automatyzuj) jest{' '}
            <strong>autorską metodą Consultify</strong>, łączącą klasyczne narzędzia Lean z oceną potencjału
            automatyzacji i AI. Metoda pozwala na kompleksową analizę procesów i stanowisk pracy.
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const DBR77LeanMap: React.FC<DBR77LeanMapProps> = ({ data: initialData, onChange, readOnly = false }) => {
    const { t } = useTranslation();

    // State
    const [data, setData] = useState<DBR77AssessmentData>(() => initialData || createEmptyDBR77Assessment());
    const [activePhase, setActivePhase] = useState<DBR77Phase>('MEASURE');
    const [activeDimension, setActiveDimension] = useState<DBR77Dimension>('PROCESSES');
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Handlers
    const handleProcessChange = useCallback(
        (updatedProcess: ProcessAssessment) => {
            setData((prev) => {
                const newData = {
                    ...prev,
                    processes: prev.processes.map((p) => (p.id === updatedProcess.id ? updatedProcess : p)),
                };
                onChange?.(newData);
                return newData;
            });
        },
        [onChange],
    );

    const handleWorkstationChange = useCallback(
        (updatedWs: WorkstationAssessment) => {
            setData((prev) => {
                const newData = {
                    ...prev,
                    workstations: prev.workstations.map((ws) => (ws.id === updatedWs.id ? updatedWs : ws)),
                };
                onChange?.(newData);
                return newData;
            });
        },
        [onChange],
    );

    const addProcess = useCallback(() => {
        const id = `process-${Date.now()}`;
        const newProcess = createEmptyProcessAssessment(id, `Nowy Proces ${data.processes.length + 1}`);
        setData((prev) => {
            const newData = { ...prev, processes: [...prev.processes, newProcess] };
            onChange?.(newData);
            return newData;
        });
        setExpandedItems((prev) => new Set([...prev, id]));
    }, [data.processes.length, onChange]);

    const addWorkstation = useCallback(() => {
        const id = `workstation-${Date.now()}`;
        const newWs = createEmptyWorkstationAssessment(id, `Nowe Stanowisko ${data.workstations.length + 1}`);
        setData((prev) => {
            const newData = { ...prev, workstations: [...prev.workstations, newWs] };
            onChange?.(newData);
            return newData;
        });
        setExpandedItems((prev) => new Set([...prev, id]));
    }, [data.workstations.length, onChange]);

    const deleteProcess = useCallback(
        (id: string) => {
            setData((prev) => {
                const newData = { ...prev, processes: prev.processes.filter((p) => p.id !== id) };
                onChange?.(newData);
                return newData;
            });
        },
        [onChange],
    );

    const deleteWorkstation = useCallback(
        (id: string) => {
            setData((prev) => {
                const newData = { ...prev, workstations: prev.workstations.filter((ws) => ws.id !== id) };
                onChange?.(newData);
                return newData;
            });
        },
        [onChange],
    );

    const toggleExpand = useCallback((id: string) => {
        setExpandedItems((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    // Stats
    const stats = useMemo(
        () => ({
            leanMaturity: calculateLeanMaturity(data),
            automationPotential: calculateAutomationPotential(data),
            totalSavings: calculateTotalSavings(data),
            topWastes: getTopWastes(data, 3),
            totalHeadcount: data.workstations.reduce((sum, ws) => sum + ws.headcount, 0),
        }),
        [data],
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-white/10 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            <Zap className="text-cyan-500" />
                            Lean 4.0 Assessment
                        </h2>
                        <p className="text-sm text-slate-500">Metoda DBR77: Pomierz → Zoptymalizuj → Automatyzuj</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl text-center">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {stats.leanMaturity.toFixed(1)}
                            </div>
                            <div className="text-xs text-green-600/70">Lean Maturity</div>
                        </div>
                        <div className="bg-purple-100 dark:bg-purple-900/30 px-4 py-2 rounded-xl text-center">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {stats.automationPotential.toFixed(1)}
                            </div>
                            <div className="text-xs text-purple-600/70">Auto Potential</div>
                        </div>
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 px-4 py-2 rounded-xl text-center">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {(stats.totalSavings / 1000).toFixed(0)}k
                            </div>
                            <div className="text-xs text-emerald-600/70">Est. Savings PLN</div>
                        </div>
                    </div>
                </div>

                {/* Phase Selector */}
                <DBR77PhaseSelector activePhase={activePhase} onPhaseChange={setActivePhase} />
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Legal Notice */}
                <DBR77LegalNotice />

                {/* Dimension Toggle */}
                <DBR77DimensionToggle
                    activeDimension={activeDimension}
                    onDimensionChange={setActiveDimension}
                    processCount={data.processes.length}
                    workstationCount={data.workstations.length}
                />

                {/* Items */}
                <div className="space-y-3">
                    {activeDimension === 'PROCESSES' ? (
                        <>
                            {data.processes.map((process) => (
                                <ProcessCard
                                    key={process.id}
                                    process={process}
                                    activePhase={activePhase}
                                    onChange={handleProcessChange}
                                    onDelete={() => deleteProcess(process.id)}
                                    readOnly={readOnly}
                                    expanded={expandedItems.has(process.id)}
                                    onToggleExpand={() => toggleExpand(process.id)}
                                />
                            ))}

                            {!readOnly && (
                                <button
                                    onClick={addProcess}
                                    className="w-full p-4 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all"
                                >
                                    <Plus size={20} />
                                    <span>Dodaj Proces</span>
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {data.workstations.map((ws) => (
                                <WorkstationCard
                                    key={ws.id}
                                    workstation={ws}
                                    activePhase={activePhase}
                                    onChange={handleWorkstationChange}
                                    onDelete={() => deleteWorkstation(ws.id)}
                                    readOnly={readOnly}
                                    expanded={expandedItems.has(ws.id)}
                                    onToggleExpand={() => toggleExpand(ws.id)}
                                />
                            ))}

                            {!readOnly && (
                                <button
                                    onClick={addWorkstation}
                                    className="w-full p-4 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:border-purple-500 hover:text-purple-500 transition-all"
                                >
                                    <Plus size={20} />
                                    <span>Dodaj Stanowisko</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DBR77LeanMap;
