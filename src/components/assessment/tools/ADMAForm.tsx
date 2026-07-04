/**
 * ADMAForm - Advanced Digital Maturity Assessment Form
 *
 * 5-pillar digital maturity assessment form with live scoring.
 * Pillars:
 * 1. Strategy & Organization
 * 2. Smart Products
 * 3. Smart Operations
 * 4. Smart Supply Chain
 * 5. Data-Driven Services
 *
 * Each pillar has 2-3 dimensions with 5-level maturity scale (1-5).
 */

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Database,
  Settings,
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
} from '../../../services/admaStructure';

// Types
interface DimensionScore {
  current: number;
  target: number;
  evidence?: string;
  notes?: string;
  confidence?: 'low' | 'medium' | 'high';
}

interface PillarScore {
  current: number;
  target: number;
  gap: number;
  dimensionScores: Record<string, DimensionScore>;
}

interface ADMAFormData {
  pillars: Record<ADMAPillarId, PillarScore>;
  overallMaturity: number;
}

interface ADMAFormProps {
  data: ADMAFormData;
  onChange: (data: ADMAFormData) => void;
  onComplete?: () => void;
  readOnly?: boolean;
  showProgress?: boolean;
}

// Pillar icons
const PILLAR_ICONS: Record<ADMAPillarId, React.ReactNode> = {
  strategy: <Target size={20} />,
  smart_products: <Cpu size={20} />,
  smart_operations: <Settings size={20} />,
  smart_supply: <Truck size={20} />,
  data_driven: <Database size={20} />,
};

// Pillar colors
const PILLAR_COLORS: Record<ADMAPillarId, string> = {
  strategy: 'blue',
  smart_products: 'green',
  smart_operations: 'purple',
  smart_supply: 'orange',
  data_driven: 'cyan',
};

// Create empty form data
export function createEmptyADMAFormData(): ADMAFormData {
  const pillars: Record<ADMAPillarId, PillarScore> = {} as Record<ADMAPillarId, PillarScore>;

  (Object.keys(ADMA_PILLARS) as ADMAPillarId[]).forEach((pillarId) => {
    const dimensionScores: Record<string, DimensionScore> = {};
    ADMA_PILLARS[pillarId].dimensionIds.forEach((dimId) => {
      dimensionScores[dimId] = { current: 0, target: 0 };
    });
    pillars[pillarId] = { current: 0, target: 0, gap: 0, dimensionScores };
  });

  return {
    pillars,
    overallMaturity: 0,
  };
}

export const ADMAForm: React.FC<ADMAFormProps> = ({
  data,
  onChange,
  onComplete,
  readOnly = false,
  showProgress = true,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [activePillarId, setActivePillarId] = useState<ADMAPillarId>('strategy');
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());

  // Get pillar IDs in order
  const pillarIds = useMemo(() => Object.keys(ADMA_PILLARS) as ADMAPillarId[], []);

  // Get current pillar config
  const currentPillar = ADMA_PILLARS[activePillarId];
  const currentPillarData = data.pillars[activePillarId] || {
    current: 0,
    target: 0,
    gap: 0,
    dimensionScores: {},
  };

  // Get dimensions for current pillar
  const currentDimensions = useMemo(() => {
    return ADMA_DIMENSIONS.filter((d) => d.pillar === activePillarId);
  }, [activePillarId]);

  const progress = useMemo(() => {
    let filledDimensions = 0;
    let withEvidence = 0;
    const totalDimensions = ADMA_DIMENSIONS.length;
    let totalScore = 0;
    let count = 0;

    Object.values(data.pillars).forEach((pillar) => {
      Object.values(pillar.dimensionScores).forEach((dim) => {
        if (dim.current > 0) {
          filledDimensions++;
          totalScore += dim.current;
          count++;
          if (dim.evidence && dim.evidence.trim().length > 0) withEvidence++;
        }
      });
    });

    return {
      completedDimensions: filledDimensions,
      totalDimensions,
      avgScore: count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0,
      percent: Math.round((filledDimensions / totalDimensions) * 100),
      evidenceCount: withEvidence,
    };
  }, [data]);

  // Handle dimension score change
  const handleDimensionScoreChange = useCallback(
    (dimensionId: string, type: 'current' | 'target', value: number) => {
      if (readOnly) return;

      const newDimensionScores = { ...currentPillarData.dimensionScores };
      const currentDimScore = newDimensionScores[dimensionId] || { current: 0, target: 0 };

      newDimensionScores[dimensionId] = {
        ...currentDimScore,
        [type]: value,
      };

      // Calculate pillar average
      const scores = Object.values(newDimensionScores);
      const avgCurrent =
        scores.length > 0
          ? Math.round((scores.reduce((sum, s) => sum + s.current, 0) / scores.length) * 10) / 10
          : 0;
      const avgTarget =
        scores.length > 0
          ? Math.round((scores.reduce((sum, s) => sum + s.target, 0) / scores.length) * 10) / 10
          : 0;

      const newPillars = {
        ...data.pillars,
        [activePillarId]: {
          current: avgCurrent,
          target: avgTarget,
          gap: Math.round((avgTarget - avgCurrent) * 10) / 10,
          dimensionScores: newDimensionScores,
        },
      };

      // Calculate overall maturity
      const allDimScores: Record<string, number> = {};
      Object.values(newPillars).forEach((pillar) => {
        Object.entries(pillar.dimensionScores).forEach(([dimId, score]) => {
          allDimScores[dimId] = score.current;
        });
      });
      const overallMaturity = calculateOverallADMAScore(allDimScores);

      onChange({
        pillars: newPillars,
        overallMaturity,
      });
    },
    [activePillarId, currentPillarData, data, onChange, readOnly]
  );

  const handleDimensionMetaChange = useCallback(
    (dimensionId: string, field: 'notes' | 'evidence' | 'confidence', value: string) => {
      if (readOnly) return;
      const newDimensionScores = { ...currentPillarData.dimensionScores };
      const currentDimScore = newDimensionScores[dimensionId] || { current: 0, target: 0 };
      newDimensionScores[dimensionId] = { ...currentDimScore, [field]: value };
      const newPillars = {
        ...data.pillars,
        [activePillarId]: { ...currentPillarData, dimensionScores: newDimensionScores },
      };
      onChange({ pillars: newPillars, overallMaturity: data.overallMaturity });
    },
    [activePillarId, currentPillarData, data, onChange, readOnly]
  );

  // Toggle dimension expansion
  const toggleDimension = useCallback((dimensionId: string) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimensionId)) {
        next.delete(dimensionId);
      } else {
        next.add(dimensionId);
      }
      return next;
    });
  }, []);

  // Navigate between pillars
  const goToPillar = useCallback(
    (direction: 'prev' | 'next') => {
      const currentIndex = pillarIds.indexOf(activePillarId);
      if (direction === 'prev' && currentIndex > 0) {
        setActivePillarId(pillarIds[currentIndex - 1]);
      } else if (direction === 'next' && currentIndex < pillarIds.length - 1) {
        setActivePillarId(pillarIds[currentIndex + 1]);
      }
    },
    [activePillarId, pillarIds]
  );

  // Render level selector
  const renderLevelSelector = (
    dimension: ADMADimension,
    type: 'current' | 'target',
    value: number
  ) => {
    const color = PILLAR_COLORS[activePillarId];

    return (
      <div className="flex items-center gap-1">
        {ADMA_MATURITY_LEVELS.map((level) => {
          const isSelected = value === level.level;
          const isBelow = level.level < value;

          return (
            <button
              key={level.level}
              onClick={() => handleDimensionScoreChange(dimension.id, type, level.level)}
              disabled={readOnly}
              className={`
                w-10 h-10 rounded-lg text-sm font-medium transition-all
                ${
                  isSelected
                    ? `bg-${color}-500 text-white shadow-lg shadow-${color}-500/30`
                    : isBelow
                      ? `bg-${color}-500/30 text-${color}-300`
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

  // Render dimension card
  const renderDimensionCard = (dimension: ADMADimension) => {
    const dimScore = currentPillarData.dimensionScores[dimension.id] || { current: 0, target: 0 };
    const isExpanded = expandedDimensions.has(dimension.id);
    const color = PILLAR_COLORS[activePillarId];
    const gap = dimScore.target - dimScore.current;

    return (
      <div
        key={dimension.id}
        className={`bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden transition-all ${
          isExpanded ? 'ring-1 ring-' + color + '-500/30' : ''
        }`}
      >
        {/* Dimension Header */}
        <button
          onClick={() => toggleDimension(dimension.id)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-navy-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}
            >
              <span className={`text-${color}-400 font-bold`}>
                {dimScore.current > 0 ? dimScore.current : '-'}
              </span>
            </div>
            <div className="text-left">
              <h4 className="text-slate-900 dark:text-white font-medium">
                {isPolish ? dimension.namePL : dimension.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dimension.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Gap indicator */}
            {dimScore.current > 0 && dimScore.target > 0 && (
              <div
                className={`px-2 py-1 rounded text-xs font-medium ${
                  gap > 0
                    ? 'bg-amber-500/20 text-amber-400'
                    : gap < 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-500/20 text-slate-600'
                }`}
              >
                Gap: {gap > 0 ? '+' : ''}
                {gap}
              </div>
            )}
            {isExpanded ? (
              <ChevronUp size={20} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown size={20} className="text-slate-500 dark:text-slate-400" />
            )}
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-navy-700 pt-4">
            {/* Current Level */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Current Level (Stan Obecny)
              </label>
              {renderLevelSelector(dimension, 'current', dimScore.current)}
              {dimScore.current > 0 && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {ADMA_MATURITY_LEVELS[dimScore.current - 1]?.title}:
                  </span>{' '}
                  {ADMA_MATURITY_LEVELS[dimScore.current - 1]?.description}
                </p>
              )}
            </div>

            {/* Target Level */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Target Level (Cel)
              </label>
              {renderLevelSelector(dimension, 'target', dimScore.target)}
              {dimScore.target > 0 && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {ADMA_MATURITY_LEVELS[dimScore.target - 1]?.title}:
                  </span>{' '}
                  {ADMA_MATURITY_LEVELS[dimScore.target - 1]?.description}
                </p>
              )}
            </div>

            {/* Maturity Level Reference */}
            <div className="bg-slate-100 dark:bg-navy-900 rounded-lg p-3">
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Maturity Levels Reference
              </h5>
              <div className="grid grid-cols-5 gap-2 text-xs">
                {ADMA_MATURITY_LEVELS.map((level) => (
                  <div key={level.level} className="text-center">
                    <div
                      className={`w-6 h-6 rounded mx-auto mb-1 flex items-center justify-center ${
                        level.level <= dimScore.current
                          ? `bg-${color}-500 text-white`
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {level.level}
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">{level.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Evidence */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-navy-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('assessment.notes', 'Notes')}
                </label>
                <textarea
                  value={dimScore.notes || ''}
                  onChange={(e) => handleDimensionMetaChange(dimension.id, 'notes', e.target.value)}
                  placeholder={
                    isPolish
                      ? 'Kluczowe obserwacje, kontekst, uzasadnienie oceny...'
                      : 'Key observations, context, rationale for the score...'
                  }
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
                  value={dimScore.evidence || ''}
                  onChange={(e) =>
                    handleDimensionMetaChange(dimension.id, 'evidence', e.target.value)
                  }
                  placeholder={
                    isPolish
                      ? 'Systemy, dokumenty, metryki, procesy potwierdzające ocenę...'
                      : 'Systems, documents, metrics, processes that support this score...'
                  }
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
                      onClick={() => handleDimensionMetaChange(dimension.id, 'confidence', level)}
                      disabled={readOnly}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        dimScore.confidence === level
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

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Progress Bar */}
      {showProgress && (
        <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <BarChart3 size={20} className="text-primary-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {progress.completedDimensions} / {progress.totalDimensions} dimensions completed
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Overall Maturity:{' '}
                <span className="text-white font-medium">{data.overallMaturity || '-'}</span>
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Avg Score:{' '}
                <span className="text-white font-medium">{progress.avgScore || '-'}</span>
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('assessment.withEvidence', 'With evidence')}:{' '}
                <span className="text-white font-medium">
                  {progress.evidenceCount}/{progress.completedDimensions}
                </span>
              </span>
            </div>
          </div>
          <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Pillar Navigation */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {pillarIds.map((pillarId, index) => {
            const pillar = ADMA_PILLARS[pillarId];
            const pillarData = data.pillars[pillarId];
            const isActive = activePillarId === pillarId;
            const isCompleted = pillarData && pillarData.current > 0;
            const color = PILLAR_COLORS[pillarId];

            return (
              <button
                key={pillarId}
                onClick={() => setActivePillarId(pillarId)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  border transition-all whitespace-nowrap
                  ${
                    isActive
                      ? `bg-${color}-500/15 border-${color}-500 text-${color}-400`
                      : isCompleted
                        ? `bg-slate-100 dark:bg-navy-800 border-${color}-500/30 text-slate-700 dark:text-slate-300`
                        : 'bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                  }
                `}
              >
                <span className={`${isActive ? `text-${color}-400` : 'text-slate-500'}`}>
                  {PILLAR_ICONS[pillarId]}
                </span>
                <span>{isPolish ? pillar.namePL : pillar.name}</span>
                {isCompleted && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full bg-${color}-500/20 text-${color}-400`}
                  >
                    {pillarData.current}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Pillar Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-12 h-12 rounded-xl bg-${PILLAR_COLORS[activePillarId]}-500/20 flex items-center justify-center`}
            >
              <span className={`text-${PILLAR_COLORS[activePillarId]}-400`}>
                {PILLAR_ICONS[activePillarId]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isPolish ? currentPillar.namePL : currentPillar.name}
              </h2>
              <p className="text-sm text-slate-600">
                {isPolish ? currentPillar.descriptionPL : currentPillar.description}
              </p>
            </div>
          </div>

          {/* Pillar Score Summary */}
          <div className="flex items-center gap-6 mt-4 p-4 bg-slate-100 dark:bg-navy-800 rounded-lg">
            <div>
              <span className="text-xs text-slate-600 uppercase tracking-wider">Current</span>
              <div className={`text-2xl font-bold text-${PILLAR_COLORS[activePillarId]}-400`}>
                {currentPillarData.current || '-'}
              </div>
            </div>
            <ArrowRight size={20} className="text-slate-600" />
            <div>
              <span className="text-xs text-slate-600 uppercase tracking-wider">Target</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {currentPillarData.target || '-'}
              </div>
            </div>
            {currentPillarData.gap !== 0 && (
              <div className="ml-auto">
                <span className="text-xs text-slate-600 uppercase tracking-wider">Gap</span>
                <div
                  className={`text-2xl font-bold ${
                    currentPillarData.gap > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {currentPillarData.gap > 0 ? '+' : ''}
                  {currentPillarData.gap}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Dimensions ({currentDimensions.length})
          </h3>
          {currentDimensions.map(renderDimensionCard)}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToPillar('prev')}
            disabled={pillarIds.indexOf(activePillarId) === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-slate-100 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            <ChevronLeft size={16} />
            Previous Pillar
          </button>

          {pillarIds.indexOf(activePillarId) === pillarIds.length - 1 ? (
            <button
              onClick={onComplete}
              disabled={progress.percent < 100}
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
              onClick={() => goToPillar('next')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF]
                transition-colors"
            >
              Next Pillar
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ADMAForm;
