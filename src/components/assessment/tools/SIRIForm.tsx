/**
 * SIRIForm - Smart Industry Readiness Index Form
 *
 * SIRI assessment form with live scoring.
 * Structure:
 * - 3 Building Blocks: Process, Technology, Organization
 * - 8 Dimensions
 * - 16 Prioritisation Areas
 * - Scale: 0-5 (0 = Not Started)
 */

import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Layers,
  Settings,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calculateBlockScore,
  calculateOverallSIRIScore,
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  SIRI_PRIORITISATION_AREAS,
  SIRIBuildingBlock,
  SIRIDimension,
  SIRIPrioritisationArea,
} from '../../../services/siriStructure';

// Types
interface DimensionScore {
  current: number;
  target: number;
  gap: number;
  areaScores?: Record<string, number>;
  notes?: string;
  evidence?: string;
  confidence?: 'low' | 'medium' | 'high';
}

interface SIRIFormData {
  buildingBlocks?: Record<SIRIBuildingBlock, { score: number; target?: number }>;
  dimensions?: Record<string, DimensionScore>;
  prioritisationMatrix?: Record<string, number>;
  overallScore?: number;
}

interface SIRIFormProps {
  data: SIRIFormData;
  onChange: (data: SIRIFormData) => void;
  onComplete?: () => void;
  readOnly?: boolean;
  showProgress?: boolean;
}

// Building block icons
const BLOCK_ICONS: Record<SIRIBuildingBlock, React.ReactNode> = {
  PROCESS: <Settings size={24} />,
  TECHNOLOGY: <Cpu size={24} />,
  ORGANIZATION: <Users size={24} />,
};

// Building block colors
const BLOCK_COLORS: Record<SIRIBuildingBlock, string> = {
  PROCESS: 'blue',
  TECHNOLOGY: 'green',
  ORGANIZATION: 'purple',
};

export const SIRIForm: React.FC<SIRIFormProps> = ({
  data,
  onChange,
  onComplete,
  readOnly = false,
  showProgress = true,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [activeBlock, setActiveBlock] = useState<SIRIBuildingBlock>('PROCESS');
  const [activeDimensionId, setActiveDimensionId] = useState<string | null>(null);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  // Get dimensions for current block
  const blockDimensions = useMemo(() => {
    return SIRI_DIMENSIONS.filter((d) => d.buildingBlock === activeBlock);
  }, [activeBlock]);

  // Calculate scores
  const scores = useMemo(() => {
    const dimensions = data.dimensions || {};
    const blockScores: Record<SIRIBuildingBlock, { current: number; target: number }> = {
      PROCESS: { current: 0, target: 0 },
      TECHNOLOGY: { current: 0, target: 0 },
      ORGANIZATION: { current: 0, target: 0 },
    };

    // Calculate block scores
    (['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'] as SIRIBuildingBlock[]).forEach((block) => {
      const blockConfig = SIRI_BUILDING_BLOCKS[block];
      const dimScores = blockConfig.dimensionIds.map((id) => dimensions[id]).filter(Boolean);

      if (dimScores.length > 0) {
        blockScores[block] = {
          current:
            Math.round(
              (dimScores.reduce((sum, d) => sum + (d?.current || 0), 0) / dimScores.length) * 10
            ) / 10,
          target:
            Math.round(
              (dimScores.reduce((sum, d) => sum + (d?.target || 0), 0) / dimScores.length) * 10
            ) / 10,
        };
      }
    });

    // Calculate overall
    const allDims = Object.values(dimensions).filter(Boolean);
    const overall =
      allDims.length > 0
        ? Math.round(
            (allDims.reduce((sum, d) => sum + (d?.current || 0), 0) / allDims.length) * 10
          ) / 10
        : 0;

    return { blockScores, overall };
  }, [data.dimensions]);

  const progress = useMemo(() => {
    const dimensions = data.dimensions || {};
    const filledDims = Object.values(dimensions).filter(
      (d) => d && (d.current > 0 || d.target > 0)
    ).length;
    const withEvidence = Object.values(dimensions).filter(
      (d) => d && d.evidence && d.evidence.trim().length > 0
    ).length;

    return {
      completed: filledDims,
      total: SIRI_DIMENSIONS.length,
      percent: Math.round((filledDims / SIRI_DIMENSIONS.length) * 100),
      evidenceCount: withEvidence,
    };
  }, [data.dimensions]);

  // Handle dimension score change
  const handleDimensionScoreChange = useCallback(
    (dimensionId: string, type: 'current' | 'target', value: number) => {
      if (readOnly) return;

      const dimensions = { ...data.dimensions };
      const current = dimensions[dimensionId] || { current: 0, target: 0, gap: 0 };

      const updated = {
        ...current,
        [type]: value,
        gap: type === 'current' ? (current.target || 0) - value : value - (current.current || 0),
      };

      dimensions[dimensionId] = updated;

      // Recalculate overall
      const allDims = Object.values(dimensions).filter(Boolean);
      const overall =
        allDims.length > 0
          ? Math.round(
              (allDims.reduce((sum, d) => sum + (d?.current || 0), 0) / allDims.length) * 10
            ) / 10
          : 0;

      onChange({
        ...data,
        dimensions,
        overallScore: overall,
      });
    },
    [data, onChange, readOnly]
  );

  // Handle prioritisation area score change
  const handleAreaScoreChange = useCallback(
    (areaId: string, value: number) => {
      if (readOnly) return;

      const matrix = { ...data.prioritisationMatrix };
      matrix[areaId] = value;

      // Update related dimension scores
      const area = SIRI_PRIORITISATION_AREAS.find((a) => a.id === areaId);
      if (area) {
        const dimensions = { ...data.dimensions };
        const dimAreas = SIRI_PRIORITISATION_AREAS.filter((a) => a.dimension === area.dimension);
        const areaScores = dimAreas.reduce(
          (acc, a) => {
            acc[a.id] = matrix[a.id] || 0;
            return acc;
          },
          {} as Record<string, number>
        );

        const avgScore =
          dimAreas.length > 0
            ? Math.round(
                (dimAreas.reduce((sum, a) => sum + (matrix[a.id] || 0), 0) / dimAreas.length) * 10
              ) / 10
            : 0;

        const currentDim = dimensions[area.dimension] || { current: 0, target: 0, gap: 0 };
        dimensions[area.dimension] = {
          ...currentDim,
          current: avgScore,
          areaScores,
        };

        onChange({
          ...data,
          dimensions,
          prioritisationMatrix: matrix,
        });
      } else {
        onChange({
          ...data,
          prioritisationMatrix: matrix,
        });
      }
    },
    [data, onChange, readOnly]
  );

  const handleDimensionNotesChange = useCallback(
    (dimensionId: string, field: 'notes' | 'evidence' | 'confidence', value: string) => {
      if (readOnly) return;
      const dimensions = { ...data.dimensions };
      const current = dimensions[dimensionId] || { current: 0, target: 0, gap: 0 };
      dimensions[dimensionId] = { ...current, [field]: value };
      onChange({ ...data, dimensions });
    },
    [data, onChange, readOnly]
  );

  // Toggle area expansion
  const toggleArea = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  // Render level selector (0-5)
  const renderLevelSelector = (
    currentValue: number,
    onSelect: (value: number) => void,
    colorClass: string = 'blue'
  ) => {
    return (
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={() => onSelect(level)}
            disabled={readOnly}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
              currentValue === level
                ? `bg-${colorClass}-600 text-white`
                : currentValue > level
                  ? `bg-${colorClass}-100 dark:bg-${colorClass}-900/30 text-${colorClass}-600 dark:text-${colorClass}-400`
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-500'
            } ${readOnly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'}`}
          >
            {level}
          </button>
        ))}
      </div>
    );
  };

  // Render dimension card
  const renderDimensionCard = (dimension: SIRIDimension) => {
    const dimData = data.dimensions?.[dimension.id] || { current: 0, target: 0, gap: 0 };
    const isExpanded = activeDimensionId === dimension.id;
    const areas = SIRI_PRIORITISATION_AREAS.filter((a) => a.dimension === dimension.id);
    const blockColor = BLOCK_COLORS[dimension.buildingBlock];

    return (
      <div
        key={dimension.id}
        className={`bg-white dark:bg-navy-900 rounded-xl border transition-all ${
          isExpanded
            ? `border-${blockColor}-300 dark:border-${blockColor}-500/50 shadow-lg`
            : 'border-slate-200 dark:border-navy-700'
        }`}
      >
        {/* Dimension Header */}
        <button
          className="w-full px-4 py-3 flex items-center justify-between text-left"
          onClick={() => setActiveDimensionId(isExpanded ? null : dimension.id)}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-lg bg-${blockColor}-100 dark:bg-${blockColor}-900/30 text-${blockColor}-600 dark:text-${blockColor}-400 flex items-center justify-center`}
            >
              <Layers size={20} />
            </span>
            <div>
              <span className="font-medium text-navy-900 dark:text-white block">
                {dimension.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {areas.length} {t('assessment.form.areas', 'areas')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Scores */}
            <div className="flex items-center gap-3 text-sm">
              <div className="text-center">
                <span className={`text-${blockColor}-600 dark:text-${blockColor}-400 font-medium`}>
                  {dimData.current || 0}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-xs block">
                  {t('assessment.form.cur', 'Cur.')}
                </span>
              </div>
              <div className="text-center">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {dimData.target || 0}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-xs block">
                  {t('assessment.form.tgt', 'Tgt.')}
                </span>
              </div>
              {(dimData.gap || 0) > 0 && (
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-xs">
                  Gap: {dimData.gap}
                </span>
              )}
            </div>
            <ChevronRight
              size={20}
              className={`text-slate-500 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </button>

        {/* Dimension Details */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700 pt-4 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">{dimension.description}</p>

            {/* Target Score */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('assessment.form.targetLevel', 'Target Level')}
              </label>
              {renderLevelSelector(
                dimData.target || 0,
                (v) => handleDimensionScoreChange(dimension.id, 'target', v),
                'green'
              )}
            </div>

            {/* Prioritisation Areas */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('assessment.form.prioritisationAreas', 'Prioritisation Areas:')}
              </p>
              <div className="space-y-2">
                {areas.map((area) => {
                  const areaScore = data.prioritisationMatrix?.[area.id] || 0;
                  const isAreaExpanded = expandedAreas.has(area.id);

                  return (
                    <div
                      key={area.id}
                      className="bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-700"
                    >
                      <button
                        className="w-full px-3 py-2 flex items-center justify-between text-left"
                        onClick={() => toggleArea(area.id)}
                      >
                        <span className="text-sm text-navy-900 dark:text-white">
                          {isPolish ? area.namePL : area.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              areaScore >= 4
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                : areaScore >= 2
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {areaScore}/5
                          </span>
                          <ChevronRight
                            size={16}
                            className={`text-slate-500 dark:text-slate-400 transition-transform ${isAreaExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </button>
                      {isAreaExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t border-slate-200 dark:border-navy-700">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {area.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {t('assessment.form.score', 'Score:')}
                            </span>
                            {renderLevelSelector(
                              areaScore,
                              (v) => handleAreaScoreChange(area.id, v),
                              blockColor
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Maturity Levels Reference */}
            <details className="text-sm">
              <summary className="text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary-600">
                {t('assessment.form.maturityLevelDescriptions', 'Maturity Level Descriptions')}
              </summary>
              <div className="mt-2 space-y-2 pl-4">
                {SIRI_MATURITY_LEVELS.map((level) => (
                  <div key={level.level} className="flex gap-2">
                    <span className="w-6 h-6 rounded bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                      {level.level}
                    </span>
                    <div>
                      <span className="font-medium text-navy-900 dark:text-white">
                        {level.title}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {level.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            {/* Notes & Evidence */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-navy-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('assessment.notes', 'Notes')}
                </label>
                <textarea
                  value={dimData.notes || ''}
                  onChange={(e) =>
                    handleDimensionNotesChange(dimension.id, 'notes', e.target.value)
                  }
                  placeholder={t(
                    'assessment.notesPlaceholder',
                    'Key observations, context, rationale for the score...'
                  )}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                  rows={2}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('assessment.evidence', 'Evidence')}
                </label>
                <textarea
                  value={dimData.evidence || ''}
                  onChange={(e) =>
                    handleDimensionNotesChange(dimension.id, 'evidence', e.target.value)
                  }
                  placeholder={t(
                    'assessment.evidencePlaceholder',
                    'Systems, documents, metrics, processes that support this score...'
                  )}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                  rows={2}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('assessment.confidence', 'Assessment Confidence')}
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleDimensionNotesChange(dimension.id, 'confidence', level)}
                      disabled={readOnly}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        dimData.confidence === level
                          ? level === 'high'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 ring-1 ring-green-500'
                            : level === 'medium'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500'
                              : 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 ring-1 ring-danger-500'
                          : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                      } ${readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
                    >
                      {level === 'low'
                        ? t('assessment.confidenceLow', 'Low')
                        : level === 'medium'
                          ? t('assessment.confidenceMedium', 'Medium')
                          : t('assessment.confidenceHigh', 'High')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Navigate blocks
  const blocks: SIRIBuildingBlock[] = ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'];
  const currentBlockIndex = blocks.indexOf(activeBlock);

  const handlePrevBlock = () => {
    if (currentBlockIndex > 0) {
      setActiveBlock(blocks[currentBlockIndex - 1]);
      setActiveDimensionId(null);
    }
  };

  const handleNextBlock = () => {
    if (currentBlockIndex < blocks.length - 1) {
      setActiveBlock(blocks[currentBlockIndex + 1]);
      setActiveDimensionId(null);
    } else if (onComplete) {
      onComplete();
    }
  };

  const blockConfig = SIRI_BUILDING_BLOCKS[activeBlock];
  const blockColor = BLOCK_COLORS[activeBlock];

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      {showProgress && (
        <div className="px-6 py-4 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('assessment.form.siriProgress', 'SIRI Assessment Progress')}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {progress.completed}/{progress.total} {t('assessment.dimensions', 'dimensions')} (
              {progress.percent}%)
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('assessment.overallScore', 'Overall Score')}:{' '}
              <span className="font-medium text-navy-900 dark:text-white">{scores.overall}/5</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('assessment.withEvidence', 'With evidence')}:{' '}
              <span className="font-medium text-navy-900 dark:text-white">
                {progress.evidenceCount}/{progress.completed}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Building Block Tabs */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-navy-700">
        <div className="flex gap-2">
          {blocks.map((block) => {
            const config = SIRI_BUILDING_BLOCKS[block];
            const color = BLOCK_COLORS[block];
            const isActive = activeBlock === block;
            const blockScore = scores.blockScores[block];
            const isComplete = blockScore.current > 0;

            return (
              <button
                key={block}
                onClick={() => setActiveBlock(block)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? `bg-${color}-600 text-white`
                    : isComplete
                      ? `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-400 border border-${color}-200 dark:border-${color}-500/30`
                      : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                }`}
              >
                {BLOCK_ICONS[block]}
                <div className="text-left">
                  <span className="block">{config.name}</span>
                  {blockScore.current > 0 && (
                    <span className="text-xs opacity-80">
                      {blockScore.current}/{blockScore.target || 5}
                    </span>
                  )}
                </div>
                {isComplete && !isActive && <Check size={14} className={`text-${color}-500`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Block Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Block Header */}
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-xl bg-${blockColor}-100 dark:bg-${blockColor}-900/30 flex items-center justify-center text-${blockColor}-600 dark:text-${blockColor}-400`}
            >
              {BLOCK_ICONS[activeBlock]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                {blockConfig.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {blockConfig.name} - {blockConfig.description}
              </p>
            </div>
          </div>

          {/* Block Score Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div
              className={`bg-${blockColor}-50 dark:bg-${blockColor}-900/20 rounded-xl p-4 border border-${blockColor}-200 dark:border-${blockColor}-500/30`}
            >
              <p className={`text-sm text-${blockColor}-600 dark:text-${blockColor}-400 mb-1`}>
                {t('assessment.form.currentLevel', 'Current Level')}
              </p>
              <p
                className={`text-2xl font-bold text-${blockColor}-700 dark:text-${blockColor}-300`}
              >
                {scores.blockScores[activeBlock].current || '-'}/5
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-500/30">
              <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                {t('assessment.form.targetLevel', 'Target Level')}
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {scores.blockScores[activeBlock].target || '-'}/5
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">
                {t('assessment.gap', 'Gap')}
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {scores.blockScores[activeBlock].target
                  ? scores.blockScores[activeBlock].target - scores.blockScores[activeBlock].current
                  : '-'}
              </p>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('assessment.form.dimensions', 'Dimensions')}
            </h3>
            {blockDimensions.map((dim) => renderDimensionCard(dim))}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="px-6 py-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
        <button
          onClick={handlePrevBlock}
          disabled={currentBlockIndex === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            currentBlockIndex === 0
              ? 'text-slate-500 dark:text-slate-400 cursor-not-allowed'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          <ChevronLeft size={20} />
          {t('assessment.form.previousBlock', 'Previous Block')}
        </button>

        <button
          onClick={handleNextBlock}
          className={`flex items-center gap-2 px-4 py-2 bg-${blockColor}-600 hover:bg-${blockColor}-500 text-white rounded-lg font-medium transition-colors`}
        >
          {currentBlockIndex === blocks.length - 1
            ? t('assessment.form.completeAssessment', 'Complete Assessment')
            : t('assessment.form.nextBlock', 'Next Block')}
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default SIRIForm;
