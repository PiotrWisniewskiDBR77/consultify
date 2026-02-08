/**
 * SIRI Assessment Editor
 *
 * Full interactive editor for SIRI (Smart Industry Readiness Index) assessments.
 * Structure: 3 Building Blocks, 8 Dimensions, 16 Prioritisation Areas
 * Scale: 0-5 (Not Started to Intelligent)
 */

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Grid2X2,
  HelpCircle,
  List,
  MessageSquare,
  Settings,
  Target,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calculateBlockScore,
  calculateOverallSIRIScore,
  getDimensionsForBlock,
  getPrioritisationAreasForDimension,
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  SIRI_PRIORITISATION_AREAS,
  SIRIBuildingBlock,
  SIRIDimension,
  SIRIPrioritisationArea,
} from '@/services/siriStructure';

// ============================================
// TYPES
// ============================================

interface DimensionState {
  current: number; // 0-5
  target?: number;
  notes?: string;
  evidence?: string;
}

interface PrioritisationState {
  score: number; // 0-5
  notes?: string;
}

export interface SIRIEditorAnswers {
  dimensions?: Record<string, DimensionState>;
  prioritisation?: Record<string, PrioritisationState>;
}

interface Props {
  assessmentId: string;
  readOnly?: boolean;
  leftOverride?: React.ReactNode;
  value: SIRIEditorAnswers | undefined;
  onChange: (next: SIRIEditorAnswers) => void;
  onBlockChange?: (blockId: SIRIBuildingBlock) => void;
  currentBlockId?: SIRIBuildingBlock;
  onDimensionChange?: (dimensionId: string) => void;
  currentDimensionId?: string;
}

// ============================================
// CONSTANTS
// ============================================

const BLOCK_ICONS: Record<SIRIBuildingBlock, React.ElementType> = {
  PROCESS: Settings,
  TECHNOLOGY: Cpu,
  ORGANIZATION: Users,
};

const BLOCK_COLORS: Record<SIRIBuildingBlock, string> = {
  PROCESS: 'blue',
  TECHNOLOGY: 'green',
  ORGANIZATION: 'purple',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getDimensionState(
  answers: SIRIEditorAnswers | undefined,
  dimensionId: string
): DimensionState {
  const s = answers?.dimensions?.[dimensionId];
  if (!s) return { current: 0 };
  return {
    current: clamp(Number(s.current || 0), 0, 5),
    target: s.target ? clamp(Number(s.target), 0, 5) : undefined,
    notes: s.notes,
    evidence: s.evidence,
  };
}

function setDimensionState(
  answers: SIRIEditorAnswers | undefined,
  dimensionId: string,
  next: DimensionState
): SIRIEditorAnswers {
  return {
    ...(answers || {}),
    dimensions: {
      ...(answers?.dimensions || {}),
      [dimensionId]: next,
    },
  };
}

function getPrioritisationState(
  answers: SIRIEditorAnswers | undefined,
  areaId: string
): PrioritisationState {
  const s = answers?.prioritisation?.[areaId];
  if (!s) return { score: 0 };
  return {
    score: clamp(Number(s.score || 0), 0, 5),
    notes: s.notes,
  };
}

function setPrioritisationState(
  answers: SIRIEditorAnswers | undefined,
  areaId: string,
  next: PrioritisationState
): SIRIEditorAnswers {
  return {
    ...(answers || {}),
    prioritisation: {
      ...(answers?.prioritisation || {}),
      [areaId]: next,
    },
  };
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Building Block Tab
 */
const BlockTab: React.FC<{
  block: SIRIBuildingBlock;
  isActive: boolean;
  score: number;
  onClick: () => void;
  isPolish: boolean;
}> = ({ block, isActive, score, onClick, isPolish }) => {
  const config = SIRI_BUILDING_BLOCKS[block];
  const Icon = BLOCK_ICONS[block];
  const color = BLOCK_COLORS[block];

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${
        isActive
          ? `bg-${color}-100 dark:bg-${color}-900/30 border-2 border-${color}-500`
          : 'bg-slate-50 dark:bg-navy-800 border-2 border-transparent hover:border-slate-200 dark:hover:border-navy-600'
      }`}
    >
      <Icon
        className={`w-5 h-5 ${isActive ? `text-${color}-600 dark:text-${color}-400` : 'text-slate-500 dark:text-slate-400'}`}
      />
      <div className="text-left">
        <div
          className={`font-medium text-sm ${isActive ? `text-${color}-700 dark:text-${color}-300` : 'text-navy-900 dark:text-white'}`}
        >
          {isPolish ? config.namePL : config.name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wynik' : 'Score'}: {score.toFixed(1)}/5
        </div>
      </div>
    </button>
  );
};

/**
 * Dimension Card
 */
const DimensionCard: React.FC<{
  dimension: SIRIDimension;
  state: DimensionState;
  isActive: boolean;
  onClick: () => void;
  isPolish: boolean;
}> = ({ dimension, state, isActive, onClick, isPolish }) => {
  const progress = (state.current / 5) * 100;
  const color = BLOCK_COLORS[dimension.buildingBlock];

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl text-left transition-all ${
        isActive
          ? `bg-${color}-50 dark:bg-${color}-900/20 border-2 border-${color}-500`
          : 'bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-navy-900 dark:text-white">{dimension.name}</span>
        <span
          className={`text-sm font-bold ${isActive ? `text-${color}-600 dark:text-${color}-400` : 'text-slate-600 dark:text-slate-400'}`}
        >
          {state.current.toFixed(1)}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
        {dimension.description}
      </p>
    </button>
  );
};

/**
 * Level Selector
 */
const LevelSelector: React.FC<{
  currentLevel: number;
  targetLevel?: number;
  onChange: (level: number) => void;
  onTargetChange: (level: number | undefined) => void;
  readOnly?: boolean;
  isPolish: boolean;
}> = ({ currentLevel, targetLevel, onChange, onTargetChange, readOnly, isPolish }) => {
  return (
    <div className="space-y-4">
      {/* Current Level */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {isPolish ? 'Aktualny poziom' : 'Current Level'}
        </label>
        <div className="flex gap-2">
          {SIRI_MATURITY_LEVELS.map((level) => (
            <button
              key={level.level}
              onClick={() => !readOnly && onChange(level.level)}
              disabled={readOnly}
              className={`flex-1 p-3 rounded-lg text-center transition-all ${
                currentLevel === level.level
                  ? 'bg-blue-500 text-white'
                  : currentLevel > level.level
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="font-bold text-lg">{level.level}</div>
              <div className="text-xs truncate">{level.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Level */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {isPolish ? 'Poziom docelowy' : 'Target Level'}
        </label>
        <div className="flex gap-2">
          {SIRI_MATURITY_LEVELS.map((level) => (
            <button
              key={level.level}
              onClick={() =>
                !readOnly && onTargetChange(level.level === targetLevel ? undefined : level.level)
              }
              disabled={readOnly}
              className={`flex-1 p-2 rounded-lg text-center transition-all ${
                targetLevel === level.level
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="font-bold">{level.level}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Level Description */}
      <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-4">
        <h4 className="font-medium text-navy-900 dark:text-white mb-2">
          {SIRI_MATURITY_LEVELS[currentLevel]?.title || 'Not Started'}
        </h4>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {SIRI_MATURITY_LEVELS[currentLevel]?.description || 'No level selected'}
        </p>
        {SIRI_MATURITY_LEVELS[currentLevel]?.indicators && (
          <ul className="mt-3 space-y-1">
            {SIRI_MATURITY_LEVELS[currentLevel].indicators?.map((indicator, i) => (
              <li
                key={i}
                className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2"
              >
                <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />
                {indicator}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Prioritisation Area Card
 */
const PrioritisationAreaCard: React.FC<{
  area: SIRIPrioritisationArea;
  state: PrioritisationState;
  onChange: (score: number) => void;
  readOnly?: boolean;
  isPolish: boolean;
}> = ({ area, state, onChange, readOnly, isPolish }) => {
  return (
    <div className="bg-white dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-navy-900 dark:text-white">
            {isPolish ? area.namePL : area.name}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">{area.description}</p>
        </div>
        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{state.score}</div>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={() => !readOnly && onChange(level)}
            disabled={readOnly}
            className={`flex-1 h-8 rounded transition-all ${
              state.score === level
                ? 'bg-blue-500 text-white'
                : state.score > level
                  ? 'bg-blue-200 dark:bg-blue-900/50'
                  : 'bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700'
            } ${readOnly ? 'cursor-not-allowed' : ''}`}
          >
            <span className="text-xs font-medium">{level}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Score Summary Panel
 */
const ScoreSummaryPanel: React.FC<{
  answers: SIRIEditorAnswers | undefined;
  isPolish: boolean;
}> = ({ answers, isPolish }) => {
  const dimensionScores: Record<string, number> = {};
  SIRI_DIMENSIONS.forEach((dim) => {
    const state = getDimensionState(answers, dim.id);
    dimensionScores[dim.id] = state.current;
  });

  const blockScores = {
    PROCESS: calculateBlockScore(dimensionScores, 'PROCESS'),
    TECHNOLOGY: calculateBlockScore(dimensionScores, 'TECHNOLOGY'),
    ORGANIZATION: calculateBlockScore(dimensionScores, 'ORGANIZATION'),
  };

  const overallScore = calculateOverallSIRIScore(dimensionScores);

  return (
    <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 space-y-4">
      <div className="text-center">
        <div className="text-4xl font-bold text-navy-900 dark:text-white">
          {overallScore.toFixed(1)}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wynik ogólny' : 'Overall Score'} / 5
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'] as SIRIBuildingBlock[]).map((block) => {
          const config = SIRI_BUILDING_BLOCKS[block];
          const color = BLOCK_COLORS[block];
          return (
            <div key={block} className="text-center">
              <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>
                {blockScores[block].toFixed(1)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPolish ? config.namePL : config.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const SIRIAssessmentEditor: React.FC<Props> = ({
  assessmentId,
  readOnly = false,
  leftOverride,
  value,
  onChange,
  onBlockChange,
  currentBlockId,
  onDimensionChange,
  currentDimensionId,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State
  const [activeBlock, setActiveBlock] = useState<SIRIBuildingBlock>(currentBlockId || 'PROCESS');
  const [activeDimensionId, setActiveDimensionId] = useState<string>(
    currentDimensionId || SIRI_DIMENSIONS[0].id
  );
  const [viewMode, setViewMode] = useState<'dimensions' | 'prioritisation' | 'matrix'>(
    'dimensions'
  );
  const [showNotes, setShowNotes] = useState(false);

  // Computed
  const blockDimensions = useMemo(() => getDimensionsForBlock(activeBlock), [activeBlock]);
  const activeDimension = useMemo(
    () => SIRI_DIMENSIONS.find((d) => d.id === activeDimensionId),
    [activeDimensionId]
  );
  const dimensionPrioritisationAreas = useMemo(
    () => (activeDimensionId ? getPrioritisationAreasForDimension(activeDimensionId) : []),
    [activeDimensionId]
  );

  // Calculate block scores
  const blockScores = useMemo(() => {
    const dimensionScores: Record<string, number> = {};
    SIRI_DIMENSIONS.forEach((dim) => {
      const state = getDimensionState(value, dim.id);
      dimensionScores[dim.id] = state.current;
    });

    return {
      PROCESS: calculateBlockScore(dimensionScores, 'PROCESS'),
      TECHNOLOGY: calculateBlockScore(dimensionScores, 'TECHNOLOGY'),
      ORGANIZATION: calculateBlockScore(dimensionScores, 'ORGANIZATION'),
    };
  }, [value]);

  // Handlers
  const handleBlockChange = useCallback(
    (block: SIRIBuildingBlock) => {
      setActiveBlock(block);
      const dims = getDimensionsForBlock(block);
      if (dims.length > 0) {
        setActiveDimensionId(dims[0].id);
      }
      onBlockChange?.(block);
    },
    [onBlockChange]
  );

  const handleDimensionChange = useCallback(
    (dimensionId: string) => {
      setActiveDimensionId(dimensionId);
      onDimensionChange?.(dimensionId);
    },
    [onDimensionChange]
  );

  const handleLevelChange = useCallback(
    (level: number) => {
      if (readOnly || !activeDimensionId) return;
      const currentState = getDimensionState(value, activeDimensionId);
      const next = setDimensionState(value, activeDimensionId, {
        ...currentState,
        current: level,
      });
      onChange(next);
    },
    [value, onChange, activeDimensionId, readOnly]
  );

  const handleTargetChange = useCallback(
    (target: number | undefined) => {
      if (readOnly || !activeDimensionId) return;
      const currentState = getDimensionState(value, activeDimensionId);
      const next = setDimensionState(value, activeDimensionId, {
        ...currentState,
        target,
      });
      onChange(next);
    },
    [value, onChange, activeDimensionId, readOnly]
  );

  const handlePrioritisationChange = useCallback(
    (areaId: string, score: number) => {
      if (readOnly) return;
      const currentState = getPrioritisationState(value, areaId);
      const next = setPrioritisationState(value, areaId, {
        ...currentState,
        score,
      });
      onChange(next);
    },
    [value, onChange, readOnly]
  );

  const handleNotesChange = useCallback(
    (notes: string) => {
      if (readOnly || !activeDimensionId) return;
      const currentState = getDimensionState(value, activeDimensionId);
      const next = setDimensionState(value, activeDimensionId, {
        ...currentState,
        notes,
      });
      onChange(next);
    },
    [value, onChange, activeDimensionId, readOnly]
  );

  const currentDimensionState = activeDimensionId
    ? getDimensionState(value, activeDimensionId)
    : null;

  // Manage panel support: allow parent to override the whole editor view.
  if (leftOverride) {
    return <div className="h-full bg-white dark:bg-navy-900">{leftOverride}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-900">
      {/* Header with Building Block Tabs */}
      <div className="border-b border-slate-200 dark:border-navy-700 p-3">
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('dimensions')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'dimensions'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              <List size={16} className="inline mr-1" />
              {isPolish ? 'Wymiary' : 'Dimensions'}
            </button>
            <button
              onClick={() => setViewMode('prioritisation')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'prioritisation'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              <Target size={16} className="inline mr-1" />
              {isPolish ? 'Priorytetyzacja' : 'Prioritisation'}
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'matrix'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              <Grid2X2 size={16} className="inline mr-1" />
              {isPolish ? 'Macierz' : 'Matrix'}
            </button>
          </div>
        </div>

        {/* Building Block Tabs */}
        <div className="flex gap-3">
          {(['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'] as SIRIBuildingBlock[]).map((block) => (
            <BlockTab
              key={block}
              block={block}
              isActive={activeBlock === block}
              score={blockScores[block]}
              onClick={() => handleBlockChange(block)}
              isPolish={isPolish}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Dimensions/Prioritisation List */}
        <div className="w-80 border-r border-slate-200 dark:border-navy-700 overflow-y-auto p-4">
          {viewMode === 'dimensions' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Wymiary' : 'Dimensions'}
              </h3>
              {blockDimensions.map((dim) => (
                <DimensionCard
                  key={dim.id}
                  dimension={dim}
                  state={getDimensionState(value, dim.id)}
                  isActive={activeDimensionId === dim.id}
                  onClick={() => handleDimensionChange(dim.id)}
                  isPolish={isPolish}
                />
              ))}
            </div>
          )}

          {viewMode === 'prioritisation' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Obszary priorytetyzacji' : 'Prioritisation Areas'}
              </h3>
              {SIRI_PRIORITISATION_AREAS.filter((a) => a.buildingBlock === activeBlock).map(
                (area) => (
                  <PrioritisationAreaCard
                    key={area.id}
                    area={area}
                    state={getPrioritisationState(value, area.id)}
                    onChange={(score) => handlePrioritisationChange(area.id, score)}
                    readOnly={readOnly}
                    isPolish={isPolish}
                  />
                )
              )}
            </div>
          )}

          {viewMode === 'matrix' && <ScoreSummaryPanel answers={value} isPolish={isPolish} />}
        </div>

        {/* Right Panel - Detail View */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'dimensions' && activeDimension && currentDimensionState && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Dimension Header */}
              <div>
                <h3 className="text-2xl font-bold text-navy-900 dark:text-white">
                  {activeDimension.name}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  {activeDimension.description}
                </p>
              </div>

              {/* Level Selector */}
              <LevelSelector
                currentLevel={currentDimensionState.current}
                targetLevel={currentDimensionState.target}
                onChange={handleLevelChange}
                onTargetChange={handleTargetChange}
                readOnly={readOnly}
                isPolish={isPolish}
              />

              {/* Gap Analysis */}
              {currentDimensionState.target &&
                currentDimensionState.target > currentDimensionState.current && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {isPolish ? 'Analiza luki' : 'Gap Analysis'}
                      </span>
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-500">
                      {isPolish
                        ? `Luka: ${currentDimensionState.target - currentDimensionState.current} poziomów do osiągnięcia celu`
                        : `Gap: ${currentDimensionState.target - currentDimensionState.current} levels to reach target`}
                    </p>
                  </div>
                )}

              {/* Notes */}
              <div>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white"
                >
                  <MessageSquare size={16} />
                  {isPolish ? 'Notatki i dowody' : 'Notes & Evidence'}
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${showNotes ? 'rotate-180' : ''}`}
                  />
                </button>
                {showNotes && (
                  <textarea
                    value={currentDimensionState.notes || ''}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    disabled={readOnly}
                    placeholder={
                      isPolish ? 'Dodaj notatki lub dowody...' : 'Add notes or evidence...'
                    }
                    className="mt-2 w-full h-32 p-3 border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-950 text-navy-900 dark:text-white resize-none disabled:opacity-60"
                  />
                )}
              </div>

              {/* Prioritisation Areas for this Dimension */}
              {dimensionPrioritisationAreas.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {isPolish
                      ? 'Powiązane obszary priorytetyzacji'
                      : 'Related Prioritisation Areas'}
                  </h4>
                  <div className="space-y-3">
                    {dimensionPrioritisationAreas.map((area) => (
                      <PrioritisationAreaCard
                        key={area.id}
                        area={area}
                        state={getPrioritisationState(value, area.id)}
                        onChange={(score) => handlePrioritisationChange(area.id, score)}
                        readOnly={readOnly}
                        isPolish={isPolish}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === 'matrix' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                {isPolish ? 'Macierz dojrzałości SIRI' : 'SIRI Maturity Matrix'}
              </h3>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 text-left bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                        {isPolish ? 'Wymiar' : 'Dimension'}
                      </th>
                      {SIRI_MATURITY_LEVELS.map((level) => (
                        <th
                          key={level.level}
                          className="p-3 text-center bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 min-w-[100px]"
                        >
                          <div className="font-bold">{level.level}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {level.title}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SIRI_DIMENSIONS.map((dim) => {
                      const state = getDimensionState(value, dim.id);
                      const color = BLOCK_COLORS[dim.buildingBlock];

                      return (
                        <tr key={dim.id}>
                          <td className="p-3 border border-slate-200 dark:border-navy-700 font-medium text-navy-900 dark:text-white">
                            {dim.name}
                          </td>
                          {SIRI_MATURITY_LEVELS.map((level) => {
                            const isAchieved = state.current >= level.level;
                            const isTarget = state.target === level.level;
                            const isCurrent = state.current === level.level;

                            return (
                              <td
                                key={level.level}
                                onClick={() => {
                                  if (!readOnly) {
                                    setActiveDimensionId(dim.id);
                                    handleLevelChange(level.level);
                                  }
                                }}
                                className={`p-3 border border-slate-200 dark:border-navy-700 text-center cursor-pointer transition-all ${
                                  isCurrent
                                    ? `bg-${color}-500 text-white`
                                    : isAchieved
                                      ? `bg-${color}-100 dark:bg-${color}-900/30`
                                      : isTarget
                                        ? 'bg-green-100 dark:bg-green-900/30 border-green-500'
                                        : 'hover:bg-slate-100 dark:hover:bg-navy-800'
                                } ${readOnly ? 'cursor-default' : ''}`}
                              >
                                {isCurrent && <CheckCircle2 size={16} className="mx-auto" />}
                                {isTarget && !isCurrent && (
                                  <Target size={16} className="mx-auto text-green-500" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SIRIAssessmentEditor;
