/**
 * ADMA Assessment Editor
 *
 * Full interactive editor for ADMA (Advanced Digital Maturity Assessment) assessments.
 * Structure: 5 Pillars, 12 Dimensions
 * Scale: 1-5 (Newcomer to Expert)
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Database,
  Grid2X2,
  List,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  Truck,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMA_DIMENSIONS,
  ADMA_MATURITY_LEVELS,
  ADMA_PILLARS,
  ADMADimension,
  ADMAPillarId,
  calculateOverallADMAScore,
  calculatePillarScore,
  getAllPillarIds,
  getDimensionsForPillar,
} from '@/services/admaStructure';
import { getAssessmentGuidanceLive } from '@/services/assessmentKnowledge/assessmentGuidanceRuntime';
import type { AssessmentGuidanceOutput } from '@/services/assessmentKnowledge/assessmentGuidanceService';

// ============================================
// TYPES
// ============================================

interface DimensionState {
  current: number; // 1-5
  target?: number;
  notes?: string;
  evidence?: string;
}

export interface ADMAEditorAnswers {
  dimensions?: Record<string, DimensionState>;
}

interface Props {
  assessmentId: string;
  readOnly?: boolean;
  leftOverride?: React.ReactNode;
  value: ADMAEditorAnswers | undefined;
  onChange: (next: ADMAEditorAnswers) => void;
  onPillarChange?: (pillarId: ADMAPillarId) => void;
  currentPillarId?: ADMAPillarId;
  onDimensionChange?: (dimensionId: string) => void;
  currentDimensionId?: string;
}

// ============================================
// CONSTANTS
// ============================================

const PILLAR_ICONS: Record<ADMAPillarId, React.ElementType> = {
  strategy: Target,
  smart_products: Cpu,
  smart_operations: Settings,
  smart_supply: Truck,
  data_driven: Database,
};

const PILLAR_COLORS: Record<ADMAPillarId, string> = {
  strategy: 'blue',
  smart_products: 'green',
  smart_operations: 'purple',
  smart_supply: 'orange',
  data_driven: 'cyan',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getDimensionState(
  answers: ADMAEditorAnswers | undefined,
  dimensionId: string
): DimensionState {
  const s = answers?.dimensions?.[dimensionId];
  if (!s) return { current: 1 };
  return {
    current: clamp(Number(s.current || 1), 1, 5),
    target: s.target ? clamp(Number(s.target), 1, 5) : undefined,
    notes: s.notes,
    evidence: s.evidence,
  };
}

function setDimensionState(
  answers: ADMAEditorAnswers | undefined,
  dimensionId: string,
  next: DimensionState
): ADMAEditorAnswers {
  return {
    ...(answers || {}),
    dimensions: {
      ...(answers?.dimensions || {}),
      [dimensionId]: next,
    },
  };
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Pillar Tab
 */
const PillarTab: React.FC<{
  pillarId: ADMAPillarId;
  isActive: boolean;
  score: number;
  onClick: () => void;
  isPolish: boolean;
}> = ({ pillarId, isActive, score, onClick, isPolish }) => {
  const config = ADMA_PILLARS[pillarId];
  const Icon = PILLAR_ICONS[pillarId];
  const color = PILLAR_COLORS[pillarId];

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        isActive
          ? `bg-${color}-100 dark:bg-${color}-900/30 border-2 border-${color}-500`
          : 'bg-c-surface-raised border-2 border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle'
      }`}
    >
      <Icon
        className={`w-4 h-4 ${isActive ? `text-${color}-600 dark:text-${color}-400` : 'text-c-text-muted'}`}
      />
      <div className="text-left">
        <div
          className={`font-medium text-xs ${isActive ? `text-${color}-700 dark:text-${color}-300` : 'text-c-text'}`}
        >
          {isPolish ? config.namePL : config.name}
        </div>
        <div className="text-xs text-c-text-muted">{score.toFixed(1)}/5</div>
      </div>
    </button>
  );
};

/**
 * Dimension Card
 */
const DimensionCard: React.FC<{
  dimension: ADMADimension;
  state: DimensionState;
  isActive: boolean;
  onClick: () => void;
  isPolish: boolean;
}> = ({ dimension, state, isActive, onClick, isPolish }) => {
  const progress = ((state.current - 1) / 4) * 100;
  const color = PILLAR_COLORS[dimension.pillar];

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl text-left transition-all ${
        isActive
          ? `bg-${color}-50 dark:bg-${color}-900/20 border-2 border-${color}-500`
          : 'bg-c-surface dark:bg-c-bg border border-c-border-subtle hover:border-c-border-subtle dark:hover:border-c-border-subtle'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-c-text">
          {isPolish ? dimension.namePL : dimension.name}
        </span>
        <span
          className={`text-sm font-bold ${isActive ? `text-${color}-600 dark:text-${color}-400` : 'text-c-text-secondary dark:text-c-text-muted'}`}
        >
          {state.current}
        </span>
      </div>
      <div className="w-full h-2 bg-c-surface-raised rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-c-text-muted mt-2 line-clamp-2">{dimension.description}</p>
    </button>
  );
};

/**
 * Level Selector with Characteristics
 */
const LevelSelector: React.FC<{
  currentLevel: number;
  targetLevel?: number;
  onChange: (level: number) => void;
  onTargetChange: (level: number | undefined) => void;
  readOnly?: boolean;
}> = ({ currentLevel, targetLevel, onChange, onTargetChange, readOnly }) => {
  const { t } = useTranslation();
  const currentLevelData = ADMA_MATURITY_LEVELS.find((l) => l.level === currentLevel);

  return (
    <div className="space-y-4">
      {/* Current Level */}
      <div>
        <label className="block text-sm font-medium text-c-text-secondary mb-2">
          {t('assessment.adma.editor.currentMaturityLevel', 'Current Maturity Level')}
        </label>
        <div className="flex gap-2">
          {ADMA_MATURITY_LEVELS.map((level) => (
            <button
              key={level.level}
              onClick={() => !readOnly && onChange(level.level)}
              disabled={readOnly}
              className={`flex-1 p-3 rounded-lg text-center transition-all ${
                currentLevel === level.level
                  ? 'bg-c-text text-c-surface'
                  : currentLevel > level.level
                    ? 'bg-c-accent-soft text-c-accent'
                    : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
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
        <label className="block text-sm font-medium text-c-text-secondary mb-2">
          {t('assessment.adma.editor.targetLevel', 'Target Level')}
        </label>
        <div className="flex gap-2">
          {ADMA_MATURITY_LEVELS.map((level) => (
            <button
              key={level.level}
              onClick={() =>
                !readOnly && onTargetChange(level.level === targetLevel ? undefined : level.level)
              }
              disabled={readOnly}
              className={`flex-1 p-2 rounded-lg text-center transition-all ${
                targetLevel === level.level
                  ? 'bg-c-success text-white'
                  : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="font-bold">{level.level}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Level Description */}
      {currentLevelData && (
        <div className="bg-c-surface-raised rounded-lg p-4">
          <h4 className="font-medium text-c-text mb-2">{currentLevelData.title}</h4>
          <p className="text-sm text-c-text-secondary dark:text-c-text-muted mb-3">
            {currentLevelData.description}
          </p>
          {currentLevelData.characteristics && (
            <div>
              <h5 className="text-xs font-medium text-c-text-muted uppercase mb-2">
                {t('assessment.adma.editor.characteristics', 'Characteristics')}
              </h5>
              <ul className="space-y-1">
                {currentLevelData.characteristics.map((char, i) => (
                  <li key={i} className="text-xs text-c-text-muted flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-c-success mt-0.5 shrink-0" />
                    {char}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Radar Chart (simplified SVG)
 */
const RadarChart: React.FC<{
  pillarScores: Record<ADMAPillarId, number>;
  isPolish: boolean;
}> = ({ pillarScores, isPolish }) => {
  const pillars = getAllPillarIds();
  const centerX = 150;
  const centerY = 150;
  const radius = 100;
  const angleStep = (2 * Math.PI) / pillars.length;

  // Calculate points for current scores
  const points = pillars.map((pillarId, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const score = pillarScores[pillarId] || 1;
    const r = (score / 5) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col items-center">
      <svg width="300" height="300" viewBox="0 0 300 300">
        {/* Grid circles */}
        {[1, 2, 3, 4, 5].map((level) => (
          <circle
            key={level}
            cx={centerX}
            cy={centerY}
            r={(level / 5) * radius}
            fill="none"
            stroke="var(--c-border-subtle)"
            strokeWidth="1"
          />
        ))}

        {/* Grid lines */}
        {pillars.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x2 = centerX + radius * Math.cos(angle);
          const y2 = centerY + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={x2}
              y2={y2}
              stroke="var(--c-border-subtle)"
              strokeWidth="1"
            />
          );
        })}

        {/* Score polygon */}
        <path
          d={pathD}
          fill="color-mix(in srgb, var(--c-tag-1) 30%, transparent)"
          stroke="var(--c-tag-1)"
          strokeWidth="2"
        />

        {/* Labels */}
        {pillars.map((pillarId, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelR = radius + 30;
          const x = centerX + labelR * Math.cos(angle);
          const y = centerY + labelR * Math.sin(angle);
          const config = ADMA_PILLARS[pillarId];

          return (
            <text
              key={pillarId}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-c-text-muted"
            >
              {isPolish ? config.namePL.split(' ')[0] : config.name.split(' ')[0]}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {pillars.map((pillarId) => {
          const config = ADMA_PILLARS[pillarId];
          const color = PILLAR_COLORS[pillarId];
          return (
            <div key={pillarId} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full bg-${color}-500`} />
              <span className="text-xs text-c-text-secondary dark:text-c-text-muted">
                {isPolish ? config.namePL : config.name}:{' '}
                {pillarScores[pillarId]?.toFixed(1) || '1.0'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Score Summary Panel
 */
const ScoreSummaryPanel: React.FC<{
  answers: ADMAEditorAnswers | undefined;
  isPolish: boolean;
}> = ({ answers, isPolish }) => {
  const { t } = useTranslation();
  const dimensionScores: Record<string, number> = {};
  ADMA_DIMENSIONS.forEach((dim) => {
    const state = getDimensionState(answers, dim.id);
    dimensionScores[dim.id] = state.current;
  });

  const pillarScores: Record<ADMAPillarId, number> = {} as Record<ADMAPillarId, number>;
  getAllPillarIds().forEach((pillarId) => {
    pillarScores[pillarId] = calculatePillarScore(dimensionScores, pillarId);
  });

  const overallScore = calculateOverallADMAScore(dimensionScores);

  return (
    <div className="bg-c-surface-raised rounded-xl p-4 space-y-4">
      <div className="text-center">
        <div className="text-4xl font-bold text-c-text">{overallScore.toFixed(1)}</div>
        <div className="text-sm text-c-text-muted">
          {t('assessment.adma.editor.overallMaturity', 'Overall Maturity')} / 5
        </div>
      </div>

      <RadarChart pillarScores={pillarScores} isPolish={isPolish} />
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ADMAAssessmentEditor: React.FC<Props> = ({
  assessmentId,
  readOnly = false,
  leftOverride,
  value,
  onChange,
  onPillarChange,
  currentPillarId,
  onDimensionChange,
  currentDimensionId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State
  const [activePillar, setActivePillar] = useState<ADMAPillarId>(currentPillarId || 'strategy');
  const [activeDimensionId, setActiveDimensionId] = useState<string>(
    currentDimensionId || ADMA_DIMENSIONS[0].id
  );
  const [viewMode, setViewMode] = useState<'dimensions' | 'radar' | 'matrix'>('dimensions');
  const [showNotes, setShowNotes] = useState(false);

  // Per-dimension×level AI guidance (canon-grounded; keyed by "dimensionId#level").
  const [guidance, setGuidance] = useState<
    Record<string, { loading: boolean; data?: AssessmentGuidanceOutput }>
  >({});

  // Computed
  const pillarDimensions = useMemo(() => getDimensionsForPillar(activePillar), [activePillar]);
  const activeDimension = useMemo(
    () => ADMA_DIMENSIONS.find((d) => d.id === activeDimensionId),
    [activeDimensionId]
  );

  // Calculate pillar scores
  const pillarScores = useMemo(() => {
    const dimensionScores: Record<string, number> = {};
    ADMA_DIMENSIONS.forEach((dim) => {
      const state = getDimensionState(value, dim.id);
      dimensionScores[dim.id] = state.current;
    });

    const scores: Record<ADMAPillarId, number> = {} as Record<ADMAPillarId, number>;
    getAllPillarIds().forEach((pillarId) => {
      scores[pillarId] = calculatePillarScore(dimensionScores, pillarId);
    });
    return scores;
  }, [value]);

  // Handlers
  const handlePillarChange = useCallback(
    (pillarId: ADMAPillarId) => {
      setActivePillar(pillarId);
      const dims = getDimensionsForPillar(pillarId);
      if (dims.length > 0) {
        setActiveDimensionId(dims[0].id);
      }
      onPillarChange?.(pillarId);
    },
    [onPillarChange]
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

  // Fetch canon-grounded AI guidance for one dimension×level (cached, non-blocking).
  const requestGuidance = useCallback((dimension: ADMADimension, level: number) => {
    const key = `${dimension.id}#${level}`;
    setGuidance((prev) => {
      if (prev[key]?.loading || prev[key]?.data) return prev;
      return { ...prev, [key]: { loading: true } };
    });
    const levelInfo = ADMA_MATURITY_LEVELS.find((l) => l.level === level);
    void getAssessmentGuidanceLive({
      framework: 'ADMA',
      dimensionId: dimension.id,
      dimensionName: dimension.namePL || dimension.name,
      levelNumber: level,
      levelTitle: levelInfo?.title,
      levelDescription: levelInfo?.description,
      language: 'pl',
    })
      .then((data) => setGuidance((prev) => ({ ...prev, [key]: { loading: false, data } })))
      .catch(() => setGuidance((prev) => ({ ...prev, [key]: { loading: false } })));
  }, []);

  const currentDimensionState = activeDimensionId
    ? getDimensionState(value, activeDimensionId)
    : null;

  // Manage panel support: allow parent to override the whole editor view.
  if (leftOverride) {
    return <div className="h-full bg-c-surface">{leftOverride}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-c-surface">
      {/* Header with Pillar Tabs */}
      <div className="border-b border-c-border-subtle p-3">
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('dimensions')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'dimensions'
                  ? 'bg-c-text text-c-surface'
                  : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              <List size={16} className="inline mr-1" />
              {t('assessment.adma.editor.viewDimensions', 'Dimensions')}
            </button>
            <button
              onClick={() => setViewMode('radar')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'radar'
                  ? 'bg-c-text text-c-surface'
                  : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              <Target size={16} className="inline mr-1" />
              {t('assessment.adma.editor.viewRadar', 'Radar')}
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'matrix'
                  ? 'bg-c-text text-c-surface'
                  : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              <Grid2X2 size={16} className="inline mr-1" />
              {t('assessment.adma.editor.viewMatrix', 'Matrix')}
            </button>
          </div>
        </div>

        {/* Pillar Tabs */}
        <div className="flex flex-wrap gap-2">
          {getAllPillarIds().map((pillarId) => (
            <PillarTab
              key={pillarId}
              pillarId={pillarId}
              isActive={activePillar === pillarId}
              score={pillarScores[pillarId]}
              onClick={() => handlePillarChange(pillarId)}
              isPolish={isPolish}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Dimensions List */}
        <div className="w-80 border-r border-c-border-subtle overflow-y-auto p-4">
          {viewMode === 'dimensions' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-c-text-muted uppercase tracking-wider">
                {isPolish ? ADMA_PILLARS[activePillar].namePL : ADMA_PILLARS[activePillar].name}
              </h3>
              <p className="text-xs text-c-text-muted mb-4">
                {isPolish
                  ? ADMA_PILLARS[activePillar].descriptionPL
                  : ADMA_PILLARS[activePillar].description}
              </p>
              {pillarDimensions.map((dim) => (
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

          {(viewMode === 'radar' || viewMode === 'matrix') && (
            <ScoreSummaryPanel answers={value} isPolish={isPolish} />
          )}
        </div>

        {/* Right Panel - Detail View */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'dimensions' && activeDimension && currentDimensionState && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Dimension Header */}
              <div>
                <h3 className="text-2xl font-bold text-c-text">
                  {isPolish ? activeDimension.namePL : activeDimension.name}
                </h3>
                <p className="text-c-text-secondary dark:text-c-text-muted mt-2">
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
              />

              {/* Gap Analysis */}
              {currentDimensionState.target &&
                currentDimensionState.target > currentDimensionState.current && (
                  <div className="bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] border-l-2 border-c-warning rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-c-warning" />
                      <span className="font-medium text-c-warning">
                        {t('assessment.adma.editor.gapAnalysis', 'Gap Analysis')}
                      </span>
                    </div>
                    <p className="text-sm text-c-warning">
                      {t(
                        'assessment.adma.editor.gapMessage',
                        'Gap: {{gap}} levels to reach target',
                        {
                          gap: currentDimensionState.target - currentDimensionState.current,
                        }
                      )}
                    </p>
                  </div>
                )}

              {/* Per-dimension AI guidance (canon-grounded, non-blocking) */}
              <div>
                {(() => {
                  const gLevel = currentDimensionState.current;
                  const gKey = `${activeDimension.id}#${gLevel}`;
                  const g = guidance[gKey];
                  if (!g) {
                    return (
                      <button
                        type="button"
                        onClick={() => requestGuidance(activeDimension, gLevel)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-c-info hover:underline"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {t(
                          'assessment.adma.editor.aiGuidanceCta',
                          'AI guidance (why it matters + how to score)'
                        )}
                      </button>
                    );
                  }
                  if (g.loading) {
                    return (
                      <div className="text-xs text-c-text-muted">
                        {t('assessment.adma.editor.generatingGuidance', 'Generating guidance…')}
                      </div>
                    );
                  }
                  if (!g.data) return null;
                  return (
                    <div className="rounded-lg border border-c-border-subtle bg-[color-mix(in_srgb,var(--c-info)_6%,transparent)] p-3 space-y-2 text-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-c-info">
                        <Sparkles className="w-3 h-3" />
                        {t('assessment.adma.editor.consultantGuidance', 'Consultant guidance')}
                        <span className="ml-auto font-normal normal-case text-c-text-muted">
                          {g.data.source === 'llm'
                            ? 'AI'
                            : t('assessment.adma.editor.canonSource', 'canon')}
                        </span>
                      </div>
                      <p className="text-c-text">
                        <span className="font-semibold">
                          {t('assessment.adma.editor.whyItMatters', 'Why it matters: ')}
                        </span>
                        {g.data.whyItMatters}
                      </p>
                      <p className="text-c-text-secondary dark:text-c-text-muted">
                        <span className="font-semibold">
                          {t('assessment.adma.editor.howToScore', 'How to score this level: ')}
                        </span>
                        {g.data.levelInterpretation}
                      </p>
                      <p className="text-xs text-c-text-muted">
                        <span className="font-semibold">
                          {t('assessment.adma.editor.canonLabel', 'Canon: ')}
                        </span>
                        {g.data.canonContext}
                      </p>
                      {g.data.pitfalls.length > 0 && (
                        <p className="text-xs text-c-text-muted">
                          <span className="font-semibold">
                            {t('assessment.adma.editor.watchOutFor', 'Watch out for: ')}
                          </span>
                          {g.data.pitfalls.join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-2 text-sm text-c-text-secondary dark:text-c-text-muted hover:text-c-text dark:hover:text-c-text"
                >
                  <MessageSquare size={16} />
                  {t('assessment.adma.editor.notesAndEvidence', 'Notes & Evidence')}
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
                    placeholder={t(
                      'assessment.adma.editor.notesPlaceholder',
                      'Add notes or evidence...'
                    )}
                    className="mt-2 w-full h-32 p-3 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface dark:bg-c-bg text-c-text resize-none disabled:opacity-60"
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'matrix' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-c-text">
                {t('assessment.adma.editor.matrixTitle', 'ADMA Maturity Matrix')}
              </h3>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table
                  /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full border-collapse"
                >
                  <thead>
                    <tr>
                      <th className="p-3 text-left bg-c-surface-raised border border-c-border-subtle">
                        {t('assessment.adma.editor.dimensionColumn', 'Dimension')}
                      </th>
                      {ADMA_MATURITY_LEVELS.map((level) => (
                        <th
                          key={level.level}
                          className="p-3 text-center bg-c-surface-raised border border-c-border-subtle min-w-[100px]"
                        >
                          <div className="font-bold">{level.level}</div>
                          <div className="text-xs text-c-text-muted">{level.title}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ADMA_DIMENSIONS.map((dim) => {
                      const state = getDimensionState(value, dim.id);
                      const color = PILLAR_COLORS[dim.pillar];

                      return (
                        <tr key={dim.id}>
                          <td className="p-3 border border-c-border-subtle font-medium text-c-text">
                            {isPolish ? dim.namePL : dim.name}
                          </td>
                          {ADMA_MATURITY_LEVELS.map((level) => {
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
                                className={`p-3 border border-c-border-subtle text-center cursor-pointer transition-all ${
                                  isCurrent
                                    ? `bg-${color}-500 text-white`
                                    : isAchieved
                                      ? `bg-${color}-100 dark:bg-${color}-900/30`
                                      : isTarget
                                        ? 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] border-c-success'
                                        : 'hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                                } ${readOnly ? 'cursor-default' : ''}`}
                              >
                                {isCurrent && <CheckCircle2 size={16} className="mx-auto" />}
                                {isTarget && !isCurrent && (
                                  <Target size={16} className="mx-auto text-c-success" />
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

          {viewMode === 'radar' && (
            <div className="flex flex-col items-center justify-center h-full">
              <ScoreSummaryPanel answers={value} isPolish={isPolish} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ADMAAssessmentEditor;
