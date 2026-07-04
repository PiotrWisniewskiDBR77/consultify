/**
 * LeanForm - DBR77 Lean 4.0 Assessment Form
 *
 * Three-phase Lean 4.0 assessment:
 * 1. POMIERZ (Measure) - Current state analysis
 * 2. ZOPTYMALIZUJ (Optimize) - Lean optimization
 * 3. AUTOMATYZUJ (Automate) - Automation potential
 *
 * Assesses both Processes and Workstations with waste identification
 * and automation technology recommendations.
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  Package,
  Ruler,
  Settings,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DBR77_LEAN_MATURITY_LEVELS,
  DBR77_PHASES,
  DBR77_WASTES,
  DBR77Phase,
  DBR77PhaseConfig,
  WasteType,
} from '../../../services/dbr77LeanStructure';

// Simplified types for the form
interface ProcessScore {
  name: string;
  department: string;
  leanMaturity: number; // 1-5
  automationPotential: number; // 1-5
  wastesIdentified: WasteType[];
  priority: number; // 1-5
}

interface WorkstationScore {
  name: string;
  department: string;
  headcount: number;
  leanMaturity: number; // 1-5
  automationPotential: number; // 1-5
  wastesIdentified: WasteType[];
  priority: number; // 1-5
}

interface ManagementScore {
  dailyManagement: number; // 1-5
  continuousImprovement: number; // 1-5
  peopleDevelopment: number; // 1-5
  performanceManagement: number; // 1-5
}

interface LeanFormData {
  processes: ProcessScore[];
  workstations: WorkstationScore[];
  management: ManagementScore;
  overallLeanMaturity: number;
  overallAutomationPotential: number;
}

interface LeanFormProps {
  data: LeanFormData;
  onChange: (data: LeanFormData) => void;
  onComplete?: () => void;
  readOnly?: boolean;
  showProgress?: boolean;
}

// Phase icons
const PHASE_ICONS: Record<DBR77Phase, React.ReactNode> = {
  MEASURE: <Ruler size={20} />,
  OPTIMIZE: <TrendingUp size={20} />,
  AUTOMATE: <Cpu size={20} />,
};

// Phase colors
const PHASE_COLORS: Record<DBR77Phase, string> = {
  MEASURE: 'blue',
  OPTIMIZE: 'green',
  AUTOMATE: 'purple',
};

// Waste icons
const WASTE_ICONS: Record<WasteType, React.ReactNode> = {
  TRANSPORTATION: <Truck size={16} />,
  INVENTORY: <Package size={16} />,
  MOTION: <ArrowRight size={16} />,
  WAITING: <Clock size={16} />,
  OVERPRODUCTION: <TrendingUp size={16} />,
  OVER_PROCESSING: <Settings size={16} />,
  DEFECTS: <XCircle size={16} />,
  SKILLS: <AlertTriangle size={16} />,
};

// Create empty form data
export function createEmptyLeanFormData(): LeanFormData {
  return {
    processes: [],
    workstations: [],
    management: {
      dailyManagement: 0,
      continuousImprovement: 0,
      peopleDevelopment: 0,
      performanceManagement: 0,
    },
    overallLeanMaturity: 0,
    overallAutomationPotential: 0,
  };
}

export const LeanForm: React.FC<LeanFormProps> = ({
  data,
  onChange,
  onComplete,
  readOnly = false,
  showProgress = true,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [activePhaseId, setActivePhaseId] = useState<DBR77Phase>('MEASURE');
  const [activeTab, setActiveTab] = useState<'processes' | 'workstations' | 'management'>(
    'processes'
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDepartment, setNewItemDepartment] = useState('');

  // Get phase IDs in order
  const phaseIds = useMemo(() => DBR77_PHASES.map((p) => p.id), []);

  // Get current phase config
  const currentPhase = DBR77_PHASES.find((p) => p.id === activePhaseId)!;

  // Calculate progress
  const progress = useMemo(() => {
    const totalProcesses = data.processes.length;
    const totalWorkstations = data.workstations.length;
    const filledProcesses = data.processes.filter((p) => p.leanMaturity > 0).length;
    const filledWorkstations = data.workstations.filter((w) => w.leanMaturity > 0).length;
    const managementFilled = Object.values(data.management).filter((v) => v > 0).length;

    const totalItems = totalProcesses + totalWorkstations + 4; // 4 management areas
    const filledItems = filledProcesses + filledWorkstations + managementFilled;

    return {
      totalProcesses,
      totalWorkstations,
      filledProcesses,
      filledWorkstations,
      managementFilled,
      percent: totalItems > 0 ? Math.round((filledItems / totalItems) * 100) : 0,
    };
  }, [data]);

  // Add new process
  const handleAddProcess = useCallback(() => {
    if (!newItemName.trim()) return;

    const newProcess: ProcessScore = {
      name: newItemName.trim(),
      department: newItemDepartment.trim(),
      leanMaturity: 0,
      automationPotential: 0,
      wastesIdentified: [],
      priority: 3,
    };

    const newProcesses = [...data.processes, newProcess];
    onChange({
      ...data,
      processes: newProcesses,
    });

    setNewItemName('');
    setNewItemDepartment('');
    setShowAddForm(false);
  }, [data, newItemName, newItemDepartment, onChange]);

  // Add new workstation
  const handleAddWorkstation = useCallback(() => {
    if (!newItemName.trim()) return;

    const newWorkstation: WorkstationScore = {
      name: newItemName.trim(),
      department: newItemDepartment.trim(),
      headcount: 1,
      leanMaturity: 0,
      automationPotential: 0,
      wastesIdentified: [],
      priority: 3,
    };

    const newWorkstations = [...data.workstations, newWorkstation];
    onChange({
      ...data,
      workstations: newWorkstations,
    });

    setNewItemName('');
    setNewItemDepartment('');
    setShowAddForm(false);
  }, [data, newItemName, newItemDepartment, onChange]);

  // Update process score
  const handleProcessScoreChange = useCallback(
    (index: number, field: keyof ProcessScore, value: any) => {
      if (readOnly) return;

      const newProcesses = [...data.processes];
      newProcesses[index] = { ...newProcesses[index], [field]: value };

      // Recalculate overall scores
      const avgLean =
        newProcesses.filter((p) => p.leanMaturity > 0).reduce((sum, p) => sum + p.leanMaturity, 0) /
          (newProcesses.filter((p) => p.leanMaturity > 0).length || 1) || 0;
      const avgAuto =
        newProcesses
          .filter((p) => p.automationPotential > 0)
          .reduce((sum, p) => sum + p.automationPotential, 0) /
          (newProcesses.filter((p) => p.automationPotential > 0).length || 1) || 0;

      onChange({
        ...data,
        processes: newProcesses,
        overallLeanMaturity: Math.round(avgLean * 10) / 10,
        overallAutomationPotential: Math.round(avgAuto * 10) / 10,
      });
    },
    [data, onChange, readOnly]
  );

  // Update workstation score
  const handleWorkstationScoreChange = useCallback(
    (index: number, field: keyof WorkstationScore, value: any) => {
      if (readOnly) return;

      const newWorkstations = [...data.workstations];
      newWorkstations[index] = { ...newWorkstations[index], [field]: value };

      onChange({
        ...data,
        workstations: newWorkstations,
      });
    },
    [data, onChange, readOnly]
  );

  // Update management score
  const handleManagementScoreChange = useCallback(
    (field: keyof ManagementScore, value: number) => {
      if (readOnly) return;

      onChange({
        ...data,
        management: {
          ...data.management,
          [field]: value,
        },
      });
    },
    [data, onChange, readOnly]
  );

  // Toggle waste for process/workstation
  const toggleWaste = useCallback(
    (type: 'process' | 'workstation', index: number, wasteType: WasteType) => {
      if (readOnly) return;

      if (type === 'process') {
        const newProcesses = [...data.processes];
        const wastes = newProcesses[index].wastesIdentified;
        if (wastes.includes(wasteType)) {
          newProcesses[index].wastesIdentified = wastes.filter((w) => w !== wasteType);
        } else {
          newProcesses[index].wastesIdentified = [...wastes, wasteType];
        }
        onChange({ ...data, processes: newProcesses });
      } else {
        const newWorkstations = [...data.workstations];
        const wastes = newWorkstations[index].wastesIdentified;
        if (wastes.includes(wasteType)) {
          newWorkstations[index].wastesIdentified = wastes.filter((w) => w !== wasteType);
        } else {
          newWorkstations[index].wastesIdentified = [...wastes, wasteType];
        }
        onChange({ ...data, workstations: newWorkstations });
      }
    },
    [data, onChange, readOnly]
  );

  // Toggle item expansion
  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Navigate between phases
  const goToPhase = useCallback(
    (direction: 'prev' | 'next') => {
      const currentIndex = phaseIds.indexOf(activePhaseId);
      if (direction === 'prev' && currentIndex > 0) {
        setActivePhaseId(phaseIds[currentIndex - 1]);
      } else if (direction === 'next' && currentIndex < phaseIds.length - 1) {
        setActivePhaseId(phaseIds[currentIndex + 1]);
      }
    },
    [activePhaseId, phaseIds]
  );

  // Render level selector
  const renderLevelSelector = (value: number, onSelect: (level: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {DBR77_LEAN_MATURITY_LEVELS.map((level) => {
          const isSelected = value === level.level;
          const isBelow = level.level < value;

          return (
            <button
              key={level.level}
              onClick={() => onSelect(level.level)}
              disabled={readOnly}
              className={`
                w-10 h-10 rounded-lg text-sm font-medium transition-all
                ${
                  isSelected
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : isBelow
                      ? 'bg-green-500/30 text-green-300'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-600'
                }
                ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              `}
              title={level.title}
            >
              {level.level}
            </button>
          );
        })}
      </div>
    );
  };

  // Render waste selector
  const renderWasteSelector = (
    selectedWastes: WasteType[],
    onToggle: (waste: WasteType) => void
  ) => {
    return (
      <div className="grid grid-cols-4 gap-2">
        {DBR77_WASTES.map((waste) => {
          const isSelected = selectedWastes.includes(waste.id);
          return (
            <button
              key={waste.id}
              onClick={() => onToggle(waste.id)}
              disabled={readOnly}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                ${
                  isSelected
                    ? `bg-${waste.color}-500/20 border border-${waste.color}-500 text-${waste.color}-400`
                    : 'bg-slate-200 dark:bg-navy-700 border border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-600'
                }
                ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              `}
              title={isPolish ? waste.description : waste.nameEN}
            >
              {WASTE_ICONS[waste.id]}
              <span>{isPolish ? waste.name : waste.nameEN}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Render process card
  const renderProcessCard = (process: ProcessScore, index: number) => {
    const isExpanded = expandedItems.has(`process-${index}`);

    return (
      <div
        key={`process-${index}`}
        className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden"
      >
        <button
          onClick={() => toggleItem(`process-${index}`)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-navy-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold">
                {process.leanMaturity > 0 ? process.leanMaturity : '-'}
              </span>
            </div>
            <div className="text-left">
              <h4 className="text-slate-900 dark:text-white font-medium">{process.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {process.department || 'No department'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {process.wastesIdentified.length > 0 && (
              <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded">
                {process.wastesIdentified.length} wastes
              </span>
            )}
            {isExpanded ? (
              <ChevronUp size={20} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown size={20} className="text-slate-500 dark:text-slate-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-navy-700 pt-4">
            {/* Lean Maturity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Lean Maturity (Dojrzałość Lean)
              </label>
              {renderLevelSelector(process.leanMaturity, (level) =>
                handleProcessScoreChange(index, 'leanMaturity', level)
              )}
            </div>

            {/* Automation Potential */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Automation Potential (Potencjał Automatyzacji)
              </label>
              {renderLevelSelector(process.automationPotential, (level) =>
                handleProcessScoreChange(index, 'automationPotential', level)
              )}
            </div>

            {/* Wastes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Identified Wastes (Zidentyfikowane Marnotrawstwa)
              </label>
              {renderWasteSelector(process.wastesIdentified, (waste) =>
                toggleWaste('process', index, waste)
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Priority (Priorytet)
              </label>
              {renderLevelSelector(process.priority, (level) =>
                handleProcessScoreChange(index, 'priority', level)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render workstation card
  const renderWorkstationCard = (workstation: WorkstationScore, index: number) => {
    const isExpanded = expandedItems.has(`workstation-${index}`);

    return (
      <div
        key={`workstation-${index}`}
        className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden"
      >
        <button
          onClick={() => toggleItem(`workstation-${index}`)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-navy-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <span className="text-primary-400 font-bold">
                {workstation.leanMaturity > 0 ? workstation.leanMaturity : '-'}
              </span>
            </div>
            <div className="text-left">
              <h4 className="text-slate-900 dark:text-white font-medium">{workstation.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {workstation.department || 'No department'} • {workstation.headcount} FTE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {workstation.wastesIdentified.length > 0 && (
              <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded">
                {workstation.wastesIdentified.length} wastes
              </span>
            )}
            {isExpanded ? (
              <ChevronUp size={20} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown size={20} className="text-slate-500 dark:text-slate-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-navy-700 pt-4">
            {/* Lean Maturity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Lean Maturity (Dojrzałość Lean)
              </label>
              {renderLevelSelector(workstation.leanMaturity, (level) =>
                handleWorkstationScoreChange(index, 'leanMaturity', level)
              )}
            </div>

            {/* Automation Potential */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Automation Potential (Potencjał Automatyzacji)
              </label>
              {renderLevelSelector(workstation.automationPotential, (level) =>
                handleWorkstationScoreChange(index, 'automationPotential', level)
              )}
            </div>

            {/* Wastes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Identified Wastes (Zidentyfikowane Marnotrawstwa)
              </label>
              {renderWasteSelector(workstation.wastesIdentified, (waste) =>
                toggleWaste('workstation', index, waste)
              )}
            </div>

            {/* Headcount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Headcount (FTE)
              </label>
              <input
                type="number"
                min="1"
                value={workstation.headcount}
                onChange={(e) =>
                  handleWorkstationScoreChange(index, 'headcount', parseInt(e.target.value) || 1)
                }
                disabled={readOnly}
                className="w-24 px-3 py-2 bg-navy-700 border border-navy-600 rounded-lg text-white"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render management section
  const renderManagementSection = () => {
    const areas = [
      { key: 'dailyManagement' as const, name: 'Daily Management', namePL: 'Zarządzanie Dzienne' },
      {
        key: 'continuousImprovement' as const,
        name: 'Continuous Improvement',
        namePL: 'Ciągłe Doskonalenie',
      },
      {
        key: 'peopleDevelopment' as const,
        name: 'People Development',
        namePL: 'Rozwój Pracowników',
      },
      {
        key: 'performanceManagement' as const,
        name: 'Performance Management',
        namePL: 'Zarządzanie Wydajnością',
      },
    ];

    return (
      <div className="space-y-4">
        {areas.map((area) => (
          <div
            key={area.key}
            className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4"
          >
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-3">
              {isPolish ? area.namePL : area.name}
            </label>
            {renderLevelSelector(data.management[area.key], (level) =>
              handleManagementScoreChange(area.key, level)
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Progress Bar */}
      {showProgress && (
        <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <BarChart3 size={20} className="text-primary-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {progress.totalProcesses} processes, {progress.totalWorkstations} workstations
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Lean Maturity:{' '}
                <span className="text-white font-medium">{data.overallLeanMaturity || '-'}</span>
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Automation:{' '}
                <span className="text-white font-medium">
                  {data.overallAutomationPotential || '-'}
                </span>
              </span>
            </div>
          </div>
          <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase Navigation */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {DBR77_PHASES.map((phase) => {
            const isActive = activePhaseId === phase.id;
            const color = PHASE_COLORS[phase.id];

            return (
              <button
                key={phase.id}
                onClick={() => setActivePhaseId(phase.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  border transition-all whitespace-nowrap
                  ${
                    isActive
                      ? `bg-${color}-500/15 border-${color}-500 text-${color}-400`
                      : 'bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                  }
                `}
              >
                <span className={`${isActive ? `text-${color}-400` : 'text-slate-500'}`}>
                  {PHASE_ICONS[phase.id]}
                </span>
                <span>{isPolish ? phase.name : phase.nameEN}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Phase Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-12 h-12 rounded-xl bg-${PHASE_COLORS[activePhaseId]}-500/20 flex items-center justify-center`}
            >
              <span className={`text-${PHASE_COLORS[activePhaseId]}-400`}>
                {PHASE_ICONS[activePhaseId]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isPolish ? currentPhase.name : currentPhase.nameEN}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? currentPhase.description : currentPhase.descriptionEN}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveTab('processes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'processes'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-navy-600 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
          >
            Processes ({data.processes.length})
          </button>
          <button
            onClick={() => setActiveTab('workstations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'workstations'
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-navy-600 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
          >
            Workstations ({data.workstations.length})
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'management'
                ? 'bg-green-500/20 text-green-400 border border-green-500'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-navy-600 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
          >
            Management
          </button>
        </div>

        {/* Content */}
        {activeTab === 'processes' && (
          <div className="space-y-4">
            {data.processes.map((process, index) => renderProcessCard(process, index))}

            {/* Add Process Button */}
            {!readOnly && (
              <div className="bg-slate-50 dark:bg-navy-800/50 border border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-4">
                {showAddForm && activeTab === 'processes' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Process name..."
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-navy-700 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newItemDepartment}
                      onChange={(e) => setNewItemDepartment(e.target.value)}
                      placeholder="Department..."
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-navy-700 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddProcess}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400"
                      >
                        Add Process
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-navy-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    + Add Process
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workstations' && (
          <div className="space-y-4">
            {data.workstations.map((workstation, index) =>
              renderWorkstationCard(workstation, index)
            )}

            {/* Add Workstation Button */}
            {!readOnly && (
              <div className="bg-slate-50 dark:bg-navy-800/50 border border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-4">
                {showAddForm && activeTab === 'workstations' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Workstation name..."
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-navy-700 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newItemDepartment}
                      onChange={(e) => setNewItemDepartment(e.target.value)}
                      placeholder="Department..."
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-navy-700 border border-slate-300 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddWorkstation}
                        className="px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF]"
                      >
                        Add Workstation
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-navy-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    + Add Workstation
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'management' && renderManagementSection()}
      </div>

      {/* Navigation Footer */}
      <div className="bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToPhase('prev')}
            disabled={phaseIds.indexOf(activePhaseId) === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-slate-100 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            <ChevronLeft size={16} />
            Previous Phase
          </button>

          {phaseIds.indexOf(activePhaseId) === phaseIds.length - 1 ? (
            <button
              onClick={onComplete}
              disabled={progress.percent < 50}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium
                bg-gradient-to-r from-emerald-500 to-emerald-600 text-white
                hover:from-emerald-400 hover:to-emerald-500
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Check size={16} />
              Complete Assessment
            </button>
          ) : (
            <button
              onClick={() => goToPhase('next')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF]
                transition-colors"
            >
              Next Phase
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeanForm;
