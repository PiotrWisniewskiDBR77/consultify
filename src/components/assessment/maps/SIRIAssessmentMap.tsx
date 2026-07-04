/**
 * SIRI Assessment Map Component
 *
 * Smart Industry Readiness Index assessment visualization:
 * - 3 Building Blocks (Process, Technology, Organization)
 * - 8 Dimensions with radar charts
 * - 16 Prioritisation Areas heatmap
 * - Legal notice (Singapore EDB)
 */

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  HelpCircle,
  Info,
  Save,
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
  createEmptySIRIAssessment,
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  SIRI_PRIORITISATION_AREAS,
  SIRIAssessmentData,
  SIRIBuildingBlock,
  SIRIDimension,
  SIRIPrioritisationArea,
} from '../../../services/siriStructure';

// ============================================
// COLOR CLASSES HELPER (Tailwind requires full class names)
// ============================================

type ColorKey = 'blue' | 'green' | 'purple';

interface ColorClasses {
  bg100: string;
  bg200: string;
  bg300: string;
  bg500: string;
  bg700: string;
  bg900_30: string;
  text400: string;
  text600: string;
  text900: string;
  border500: string;
  shadow: string;
}

const COLOR_CLASSES: Record<ColorKey, ColorClasses> = {
  blue: {
    bg100: 'bg-blue-100 dark:bg-blue-900/30',
    bg200: 'bg-blue-200 dark:bg-blue-900/50',
    bg300: 'bg-blue-300 dark:bg-blue-700',
    bg500: 'bg-blue-500',
    bg700: 'bg-blue-700',
    bg900_30: 'bg-blue-900/30',
    text400: 'text-blue-400',
    text600: 'text-blue-600 dark:text-blue-400',
    text900: 'text-blue-900 dark:text-white',
    border500: 'border-blue-500',
    shadow: 'shadow-blue-500/10',
  },
  green: {
    bg100: 'bg-green-100 dark:bg-green-900/30',
    bg200: 'bg-green-200 dark:bg-green-900/50',
    bg300: 'bg-green-300 dark:bg-green-700',
    bg500: 'bg-green-500',
    bg700: 'bg-green-700',
    bg900_30: 'bg-green-900/30',
    text400: 'text-green-400',
    text600: 'text-green-600 dark:text-green-400',
    text900: 'text-green-900 dark:text-white',
    border500: 'border-green-500',
    shadow: 'shadow-green-500/10',
  },
  purple: {
    bg100: 'bg-teal-100 dark:bg-teal-900/30',
    bg200: 'bg-teal-200 dark:bg-teal-900/50',
    bg300: 'bg-teal-300 dark:bg-teal-700',
    bg500: 'bg-teal-600',
    bg700: 'bg-teal-700',
    bg900_30: 'bg-teal-900/30',
    text400: 'text-teal-400',
    text600: 'text-teal-600 dark:text-teal-400',
    text900: 'text-teal-900 dark:text-white',
    border500: 'border-teal-500',
    shadow: 'shadow-teal-500/10',
  },
};

const getColorClasses = (color: string): ColorClasses => {
  return COLOR_CLASSES[color as ColorKey] || COLOR_CLASSES.blue;
};

// ============================================
// TYPES
// ============================================

interface SIRIAssessmentMapProps {
  data?: SIRIAssessmentData;
  onChange?: (data: SIRIAssessmentData) => void;
  readOnly?: boolean;
  showLegalNotice?: boolean;
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Building Block Card with radar visualization
 */
const SIRIBuildingBlockCard: React.FC<{
  block: SIRIBuildingBlock;
  dimensions: SIRIDimension[];
  scores: Record<string, { current: number; target: number }>;
  onDimensionChange: (dimensionId: string, current: number, target: number) => void;
  readOnly?: boolean;
  expanded?: boolean;
  onToggleExpand: () => void;
}> = ({ block, dimensions, scores, onDimensionChange, readOnly, expanded, onToggleExpand }) => {
  const config = SIRI_BUILDING_BLOCKS[block];
  const colors = getColorClasses(config.color);

  const blockScore = useMemo(() => {
    const currentScores: Record<string, number> = {};
    dimensions.forEach((d) => {
      currentScores[d.id] = scores[d.id]?.current || 0;
    });
    return calculateBlockScore(currentScores, block);
  }, [dimensions, scores, block]);

  const IconComponent = block === 'PROCESS' ? Settings : block === 'TECHNOLOGY' ? Cpu : Users;

  return (
    <div
      className={`bg-white dark:bg-navy-950/50 rounded-xl border-2 transition-all ${
        expanded
          ? `${colors.border500} shadow-lg ${colors.shadow}`
          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-c-border'
      }`}
    >
      {/* Header */}
      <button onClick={onToggleExpand} className="w-full p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${colors.bg100} flex items-center justify-center`}>
            <IconComponent className={`w-6 h-6 ${colors.text600}`} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-navy-900 dark:text-white">{config.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{config.namePL}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Score Badge */}
          <div className={`px-3 py-1.5 rounded-lg ${colors.bg100}`}>
            <span className={`text-lg font-bold ${colors.text600}`}>{blockScore.toFixed(1)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/5</span>
          </div>
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 py-3">{config.description}</p>

          {/* Mini Radar Chart (simplified bars) */}
          <div className="mb-4 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Radar Overview
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${colors.bg500}`}></div>
                  Current
                </span>
                <span className="flex items-center gap-1">
                  <div
                    className={`w-2 h-2 rounded-full ${colors.bg300} border ${colors.border500}`}
                  ></div>
                  Target
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {dimensions.map((dim) => {
                const score = scores[dim.id] || { current: 0, target: 0 };
                return (
                  <div key={dim.id} className="flex items-center gap-2">
                    <span className="w-24 text-xs text-slate-600 dark:text-slate-400 truncate">
                      {dim.name}
                    </span>
                    <div className="flex-1 h-4 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden relative">
                      <div
                        className={`absolute inset-y-0 left-0 ${colors.bg200} rounded-full`}
                        style={{ width: `${(score.target / 5) * 100}%` }}
                      />
                      <div
                        className={`absolute inset-y-0 left-0 ${colors.bg500} rounded-full`}
                        style={{ width: `${(score.current / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-xs font-mono text-right">
                      {score.current}/{score.target}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dimension Cards */}
          <div className="space-y-3">
            {dimensions.map((dim) => (
              <SIRIDimensionCard
                key={dim.id}
                dimension={dim}
                current={scores[dim.id]?.current || 0}
                target={scores[dim.id]?.target || 0}
                onChange={(current, target) => onDimensionChange(dim.id, current, target)}
                readOnly={readOnly}
                colorClasses={colors}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Dimension Card with level selector
 */
const SIRIDimensionCard: React.FC<{
  dimension: SIRIDimension;
  current: number;
  target: number;
  onChange: (current: number, target: number) => void;
  readOnly?: boolean;
  colorClasses: ColorClasses;
}> = ({ dimension, current, target, onChange, readOnly, colorClasses }) => {
  const [showLevels, setShowLevels] = useState(false);
  const gap = Math.max(0, target - current);

  return (
    <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-navy-900 dark:text-white text-sm">{dimension.name}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
            {dimension.description}
          </p>
        </div>
        <button
          onClick={() => setShowLevels(!showLevels)}
          className="p-1 hover:bg-white dark:hover:bg-navy-800 rounded"
        >
          <HelpCircle size={14} className="text-slate-600 dark:text-slate-500" />
        </button>
      </div>

      {/* Score Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Current</label>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => !readOnly && onChange(level, target)}
                disabled={readOnly}
                className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                  current === level
                    ? `${colorClasses.bg500} text-white`
                    : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Target</label>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => !readOnly && onChange(current, level)}
                disabled={readOnly}
                className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                  target === level
                    ? `${colorClasses.bg300} ${colorClasses.text900} border-2 ${colorClasses.border500}`
                    : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        {gap > 0 && (
          <div className="w-16 text-center">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Gap</div>
            <div className="bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 px-2 py-1 rounded font-bold text-sm">
              {gap}
            </div>
          </div>
        )}
      </div>

      {/* Level Details */}
      {showLevels && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
          <div className="grid grid-cols-6 gap-1 text-xs">
            {SIRI_MATURITY_LEVELS.map((level) => (
              <div
                key={level.level}
                className={`p-2 rounded ${
                  current === level.level ? colorClasses.bg100 : 'bg-white dark:bg-navy-900'
                }`}
              >
                <div className="font-bold text-navy-900 dark:text-white">{level.level}</div>
                <div className="text-slate-500 dark:text-slate-400">{level.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Prioritisation Heatmap
 */
const SIRIPrioritisationHeatmap: React.FC<{
  areas: SIRIPrioritisationArea[];
  scores: Record<string, number>;
  onChange?: (areaId: string, score: number) => void;
  readOnly?: boolean;
}> = ({ areas, scores, onChange, readOnly }) => {
  const getColorClass = (score: number): string => {
    if (score === 0) return 'bg-slate-200 dark:bg-navy-800';
    if (score <= 1) return 'bg-danger-400';
    if (score <= 2) return 'bg-amber-400';
    if (score <= 3) return 'bg-yellow-400';
    if (score <= 4) return 'bg-green-400';
    return 'bg-emerald-500';
  };

  const groupedAreas = useMemo(() => {
    const grouped: Record<SIRIBuildingBlock, SIRIPrioritisationArea[]> = {
      PROCESS: [],
      TECHNOLOGY: [],
      ORGANIZATION: [],
    };
    areas.forEach((area) => {
      grouped[area.buildingBlock].push(area);
    });
    return grouped;
  }, [areas]);

  return (
    <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
          <BarChart3 size={18} />
          Prioritisation Matrix
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Score:</span>
          {[0, 1, 2, 3, 4, 5].map((score) => (
            <div key={score} className="flex items-center gap-1">
              <div className={`w-4 h-4 rounded ${getColorClass(score)}`}></div>
              <span className="text-slate-600 dark:text-slate-400">{score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {(Object.keys(groupedAreas) as SIRIBuildingBlock[]).map((block) => (
          <div key={block}>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
              {SIRI_BUILDING_BLOCKS[block].name}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {groupedAreas[block].map((area) => {
                const score = scores[area.id] || 0;
                return (
                  <div key={area.id} className="relative group">
                    <div
                      className={`p-3 rounded-lg ${getColorClass(score)} transition-all cursor-pointer hover:opacity-90`}
                      onClick={() => {
                        if (!readOnly && onChange) {
                          const newScore = (score + 1) % 6;
                          onChange(area.id, newScore);
                        }
                      }}
                    >
                      <div
                        className={`text-xs font-medium ${score > 2 ? 'text-white' : 'text-navy-900'}`}
                      >
                        {area.namePL}
                      </div>
                      <div
                        className={`text-lg font-bold ${score > 2 ? 'text-white' : 'text-navy-900'}`}
                      >
                        {score}
                      </div>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-transparent text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {area.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Legal Notice Banner
 */
const SIRILegalNotice: React.FC = () => (
  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    <div className="text-sm text-amber-800 dark:text-amber-200">
      <strong>SIRI (Smart Industry Readiness Index)</strong> jest narzędziem opracowanym przez{' '}
      <strong>Singapore Economic Development Board (EDB)</strong> we współpracy z{' '}
      <strong>TÜV SÜD</strong>. Wykorzystanie struktury SIRI w Consultify ma wyłącznie{' '}
      <strong>cel edukacyjny</strong> i służy do nauki metodologii Industry 4.0. Oficjalna
      certyfikacja SIRI wymaga akredytowanego audytora.
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const SIRIAssessmentMap: React.FC<SIRIAssessmentMapProps> = ({
  data: initialData,
  onChange,
  readOnly = false,
  showLegalNotice = true,
}) => {
  const { t } = useTranslation();

  // Initialize data
  const [data, setData] = useState<SIRIAssessmentData>(
    () => initialData || createEmptySIRIAssessment()
  );

  // Track expanded building blocks
  const [expandedBlocks, setExpandedBlocks] = useState<Set<SIRIBuildingBlock>>(
    new Set(['PROCESS'])
  );

  // Handlers
  const handleDimensionChange = useCallback(
    (dimensionId: string, current: number, target: number) => {
      setData((prev) => {
        const newData = {
          ...prev,
          dimensions: {
            ...prev.dimensions,
            [dimensionId]: {
              ...prev.dimensions[dimensionId],
              current,
              target,
              gap: Math.max(0, target - current),
            },
          },
        };

        // Recalculate building block scores
        const currentScores: Record<string, number> = {};
        Object.entries(newData.dimensions).forEach(([id, score]) => {
          currentScores[id] = score.current;
        });

        (Object.keys(SIRI_BUILDING_BLOCKS) as SIRIBuildingBlock[]).forEach((block) => {
          const blockScore = calculateBlockScore(currentScores, block);
          newData.buildingBlocks[block] = {
            ...newData.buildingBlocks[block],
            score: blockScore,
            dimensionScores: currentScores,
          };
        });

        // Recalculate overall score
        newData.overallScore = calculateOverallSIRIScore(currentScores);

        onChange?.(newData);
        return newData;
      });
    },
    [onChange]
  );

  const handlePrioritisationChange = useCallback(
    (areaId: string, score: number) => {
      setData((prev) => {
        const newData = {
          ...prev,
          prioritisationMatrix: {
            ...prev.prioritisationMatrix,
            [areaId]: score,
          },
        };
        onChange?.(newData);
        return newData;
      });
    },
    [onChange]
  );

  const toggleBlockExpand = useCallback((block: SIRIBuildingBlock) => {
    setExpandedBlocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(block)) {
        newSet.delete(block);
      } else {
        newSet.add(block);
      }
      return newSet;
    });
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const dimensionScores = Object.values(data.dimensions);
    const filledDimensions = dimensionScores.filter((d) => d.current > 0).length;
    const totalGap = dimensionScores.reduce((sum, d) => sum + d.gap, 0);
    const avgCurrent =
      dimensionScores.length > 0
        ? dimensionScores.reduce((sum, d) => sum + d.current, 0) / dimensionScores.length
        : 0;

    return {
      overall: data.overallScore,
      filledDimensions,
      totalDimensions: SIRI_DIMENSIONS.length,
      totalGap,
      avgCurrent: avgCurrent.toFixed(1),
      progress: Math.round((filledDimensions / SIRI_DIMENSIONS.length) * 100),
    };
  }, [data]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 overflow-hidden">
      {/* Header with Stats */}
      <div className="shrink-0 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <Cpu className="text-blue-500" />
              SIRI Assessment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Smart Industry Readiness Index - Industry 4.0 Maturity
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Overall Score */}
            <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.overall.toFixed(1)}
              </div>
              <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Overall Score</div>
            </div>
            {/* Progress */}
            <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.progress}%
              </div>
              <div className="text-xs text-green-600/70 dark:text-green-400/70">
                {stats.filledDimensions}/{stats.totalDimensions} dims
              </div>
            </div>
            {/* Total Gap */}
            <div className="bg-danger-100 dark:bg-danger-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                {stats.totalGap}
              </div>
              <div className="text-xs text-danger-600/70 dark:text-danger-400/70">Total Gap</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Legal Notice */}
        {showLegalNotice && <SIRILegalNotice />}

        {/* Building Blocks */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target size={18} />
            Building Blocks Assessment
          </h3>

          {(Object.keys(SIRI_BUILDING_BLOCKS) as SIRIBuildingBlock[]).map((block) => {
            const dimensions = SIRI_DIMENSIONS.filter((d) => d.buildingBlock === block);
            const scores: Record<string, { current: number; target: number }> = {};
            dimensions.forEach((d) => {
              scores[d.id] = {
                current: data.dimensions[d.id]?.current || 0,
                target: data.dimensions[d.id]?.target || 0,
              };
            });

            return (
              <SIRIBuildingBlockCard
                key={block}
                block={block}
                dimensions={dimensions}
                scores={scores}
                onDimensionChange={handleDimensionChange}
                readOnly={readOnly}
                expanded={expandedBlocks.has(block)}
                onToggleExpand={() => toggleBlockExpand(block)}
              />
            );
          })}
        </div>

        {/* Prioritisation Matrix */}
        <div className="mt-6">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2 mb-4">
            <TrendingUp size={18} />
            Prioritisation Areas (16)
          </h3>
          <SIRIPrioritisationHeatmap
            areas={SIRI_PRIORITISATION_AREAS}
            scores={data.prioritisationMatrix}
            onChange={handlePrioritisationChange}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
};

export default SIRIAssessmentMap;
