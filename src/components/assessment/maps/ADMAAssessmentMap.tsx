/**
 * ADMA Assessment Map Component
 *
 * Advanced Digital Maturity Assessment (European DIH) visualization:
 * - 5 Pillars with Pentagon Radar Chart
 * - 12 Dimensions across pillars
 * - Scale 1-5
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  HelpCircle,
  Info,
  Settings,
  Target,
  TrendingUp,
  Truck,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMA_DIMENSIONS,
  ADMA_MATURITY_LEVELS,
  ADMA_PILLARS,
  ADMAAssessmentData,
  ADMADimension,
  ADMAPillarId,
  calculateOverallADMAScore,
  calculatePillarScore,
  createEmptyADMAAssessment,
  getAllPillarIds,
  getPillarRadarData,
} from '../../../services/admaStructure';
import { ADMA_DEFAULT_PEER_SCORES } from '../../../services/admaTransformations';

// ============================================
// TYPES
// ============================================

interface ADMAAssessmentMapProps {
  data?: ADMAAssessmentData;
  onChange?: (data: ADMAAssessmentData) => void;
  readOnly?: boolean;
  showLegalNotice?: boolean;
  /** "Average Scan Responses" peer benchmark per pillar axis. Defaults to seed example values. */
  averagePeerScores?: number[];
  /** Factory of the Future constant benchmark per axis (default 4.0). */
  fofBenchmark?: number;
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Pentagon Radar Chart for 5 pillars
 */
const ADMAPentagonRadar: React.FC<{
  labels: string[];
  current: number[];
  target: number[];
  maxValue?: number;
  fofBenchmark?: number;
  averageScores?: number[];
}> = ({ labels, current, target, maxValue = 5, fofBenchmark = 4.0, averageScores }) => {
  const size = 280;
  const center = size / 2;
  const radius = size * 0.4;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const r = (value / maxValue) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const createPath = (values: number[]) => {
    return (
      values
        .map((value, i) => {
          const point = getPoint(i, value);
          return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
        })
        .join(' ') + ' Z'
    );
  };

  // Grid levels
  const gridLevels = [1, 2, 3, 4, 5];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      {/* Grid */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={labels
            .map((_, i) => {
              const point = getPoint(i, level);
              return `${point.x},${point.y}`;
            })
            .join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          className="text-slate-500 dark:text-slate-400"
        />
      ))}

      {/* Axis lines */}
      {labels.map((_, i) => {
        const point = getPoint(i, maxValue);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            strokeOpacity="0.1"
            className="text-slate-500 dark:text-slate-400"
          />
        );
      })}

      {/* Factory of the Future benchmark (constant fofBenchmark on every axis) — green */}
      {Number.isFinite(fofBenchmark) && (
        <path
          d={createPath(labels.map(() => fofBenchmark))}
          fill="none"
          stroke="rgb(34, 197, 94)"
          strokeWidth="2"
          strokeDasharray="2 2"
        />
      )}

      {/* Average Scan Responses (peers) — amber */}
      {averageScores && averageScores.length === labels.length && (
        <path
          d={createPath(averageScores)}
          fill="none"
          stroke="rgb(186, 117, 23)"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
      )}

      {/* Target area */}
      <path
        d={createPath(target)}
        fill="rgba(29, 158, 117, 0.15)"
        stroke="rgb(29, 158, 117)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />

      {/* Current area */}
      <path
        d={createPath(current)}
        fill="rgba(59, 130, 246, 0.2)"
        stroke="rgb(59, 130, 246)"
        strokeWidth="2"
      />

      {/* Points */}
      {current.map((value, i) => {
        const point = getPoint(i, value);
        return <circle key={i} cx={point.x} cy={point.y} r="4" fill="rgb(59, 130, 246)" />;
      })}

      {/* Labels */}
      {labels.map((label, i) => {
        const point = getPoint(i, maxValue + 0.8);
        return (
          <text
            key={i}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-slate-600 dark:fill-slate-400"
            style={{ fontSize: '10px' }}
          >
            {label.length > 12 ? label.substring(0, 12) + '...' : label}
          </text>
        );
      })}
    </svg>
  );
};

/**
 * Pillar Card with dimensions
 */
const ADMAPillarCard: React.FC<{
  pillarId: ADMAPillarId;
  dimensions: ADMADimension[];
  pillarScore: { current: number; target: number };
  dimensionScores: Record<string, { current: number; target: number }>;
  onDimensionChange: (dimensionId: string, current: number, target: number) => void;
  readOnly?: boolean;
  expanded?: boolean;
  onToggleExpand: () => void;
}> = ({
  pillarId,
  dimensions,
  pillarScore,
  dimensionScores,
  onDimensionChange,
  readOnly,
  expanded,
  onToggleExpand,
}) => {
  const config = ADMA_PILLARS[pillarId];

  const IconMap: Record<string, React.FC<{ className?: string; size?: number }>> = {
    Target: Target,
    Cpu: Cpu,
    Settings: Settings,
    Truck: Truck,
    Database: Database,
  };
  const IconComponent = IconMap[config.icon] || Target;

  const gap = Math.max(0, pillarScore.target - pillarScore.current);

  return (
    <div
      className={`bg-white dark:bg-navy-950/50 rounded-xl border-2 transition-all ${
        expanded
          ? `border-${config.color}-500 shadow-lg`
          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
      }`}
    >
      {/* Header */}
      <button onClick={onToggleExpand} className="w-full p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30 flex items-center justify-center`}
          >
            <IconComponent
              className={`w-5 h-5 text-${config.color}-600 dark:text-${config.color}-400`}
            />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-navy-900 dark:text-white text-sm">{config.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{config.namePL}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-bold text-${config.color}-600 dark:text-${config.color}-400`}
              >
                {pillarScore.current.toFixed(1)}
              </span>
              <span className="text-slate-600 dark:text-slate-400">/</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {pillarScore.target.toFixed(1)}
              </span>
            </div>
            {gap > 0 && <span className="text-xs text-danger-500">Gap: {gap.toFixed(1)}</span>}
          </div>
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700 pt-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{config.descriptionPL}</p>

          {/* Dimensions */}
          <div className="space-y-3">
            {dimensions.map((dim) => {
              const score = dimensionScores[dim.id] || { current: 0, target: 0 };
              return (
                <div key={dim.id} className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-navy-900 dark:text-white text-sm">
                        {dim.namePL}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{dim.name}</p>
                    </div>
                  </div>

                  {/* Score Selectors */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                        Current
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <button
                            key={level}
                            onClick={() =>
                              !readOnly && onDimensionChange(dim.id, level, score.target || level)
                            }
                            disabled={readOnly}
                            className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                              score.current === level
                                ? `bg-${config.color}-500 text-white`
                                : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30'
                            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                        Target
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <button
                            key={level}
                            onClick={() =>
                              !readOnly && onDimensionChange(dim.id, score.current || 1, level)
                            }
                            disabled={readOnly}
                            className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                              score.target === level
                                ? `bg-${config.color}-300 text-${config.color}-900 border-2 border-${config.color}-500`
                                : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30'
                            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Legal Notice Banner
 */
const ADMALegalNotice: React.FC = () => (
  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    <div className="text-sm text-amber-800 dark:text-amber-200">
      <strong>ADMA (Advanced Digital Maturity Assessment)</strong> jest narzędziem opracowanym przez{' '}
      <strong>European Commission</strong> w ramach programu{' '}
      <strong>Digital Innovation Hubs</strong>. Wykorzystanie w Consultify służy{' '}
      <strong>celom edukacyjnym</strong>.
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const ADMAAssessmentMap: React.FC<ADMAAssessmentMapProps> = ({
  data: initialData,
  onChange,
  readOnly = false,
  showLegalNotice = true,
  averagePeerScores = ADMA_DEFAULT_PEER_SCORES,
  fofBenchmark = 4.0,
}) => {
  const { t } = useTranslation();

  // Initialize data
  const [data, setData] = useState<ADMAAssessmentData>(
    () => initialData || createEmptyADMAAssessment()
  );

  // Track expanded pillars
  const [expandedPillars, setExpandedPillars] = useState<Set<ADMAPillarId>>(new Set(['strategy']));

  // Handlers
  const handleDimensionChange = useCallback(
    (dimensionId: string, current: number, target: number) => {
      setData((prev) => {
        const newData = {
          ...prev,
          dimensions: {
            ...prev.dimensions,
            [dimensionId]: {
              current,
              target,
              gap: Math.max(0, target - current),
            },
          },
        };

        // Recalculate pillar scores
        const currentScores: Record<string, number> = {};
        Object.entries(newData.dimensions).forEach(([id, score]) => {
          currentScores[id] = score.current;
        });

        getAllPillarIds().forEach((pillarId) => {
          const pillarScore = calculatePillarScore(currentScores, pillarId);
          const targetScores: Record<string, number> = {};
          Object.entries(newData.dimensions).forEach(([id, score]) => {
            targetScores[id] = score.target;
          });
          const pillarTarget = calculatePillarScore(targetScores, pillarId);

          newData.pillars[pillarId] = {
            current: pillarScore,
            target: pillarTarget,
            gap: Math.max(0, pillarTarget - pillarScore),
            dimensionScores: currentScores,
          };
        });

        // Recalculate overall score
        newData.overallMaturity = calculateOverallADMAScore(currentScores);

        onChange?.(newData);
        return newData;
      });
    },
    [onChange]
  );

  const togglePillarExpand = useCallback((pillarId: ADMAPillarId) => {
    setExpandedPillars((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pillarId)) {
        newSet.delete(pillarId);
      } else {
        newSet.add(pillarId);
      }
      return newSet;
    });
  }, []);

  // Calculate stats and radar data
  const stats = useMemo(() => {
    const dimensionScores = Object.values(data.dimensions);
    const filledDimensions = dimensionScores.filter((d) => d.current > 0).length;
    const totalGap = dimensionScores.reduce((sum, d) => sum + d.gap, 0);

    return {
      overall: data.overallMaturity,
      filledDimensions,
      totalDimensions: ADMA_DIMENSIONS.length,
      totalGap,
      progress: Math.round((filledDimensions / ADMA_DIMENSIONS.length) * 100),
    };
  }, [data]);

  const radarData = useMemo(() => {
    return getPillarRadarData(data.pillars);
  }, [data.pillars]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <Database className="text-green-500" />
              ADMA Assessment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Advanced Digital Maturity Assessment 2.0
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.overall.toFixed(1)}
              </div>
              <div className="text-xs text-green-600/70">Overall</div>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.progress}%
              </div>
              <div className="text-xs text-blue-600/70">Progress</div>
            </div>
            <div className="bg-danger-100 dark:bg-danger-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                {stats.totalGap.toFixed(1)}
              </div>
              <div className="text-xs text-danger-600/70">Total Gap</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Legal Notice */}
        {showLegalNotice && <ADMALegalNotice />}

        {/* Radar Chart */}
        <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4 mt-4">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} />
            5-Pillar Maturity Radar
          </h3>
          <div className="flex items-center justify-center">
            <ADMAPentagonRadar
              labels={radarData.labels}
              current={radarData.current}
              target={radarData.target}
              fofBenchmark={fofBenchmark}
              averageScores={averagePeerScores}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Current
            </span>
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full border-2 border-dashed border-teal-600"></div>
              Target
            </span>
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-dashed border-green-600"></div>
              Factory of the Future ({fofBenchmark.toFixed(1)})
            </span>
            {averagePeerScores && averagePeerScores.length === radarData.labels.length && (
              <span className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2 border-dashed"
                  style={{ backgroundColor: 'rgb(186, 117, 23)', borderColor: 'rgb(186, 117, 23)' }}
                ></div>
                Średnia (peers)
              </span>
            )}
          </div>
          {averagePeerScores === ADMA_DEFAULT_PEER_SCORES && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-400 mt-2">
              Średnia (peers) — dane przykładowe
            </p>
          )}
        </div>

        {/* Pillars */}
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target size={18} />
            Pillar Assessment
          </h3>

          {getAllPillarIds().map((pillarId) => {
            const dimensions = ADMA_DIMENSIONS.filter((d) => d.pillar === pillarId);
            const dimensionScores: Record<string, { current: number; target: number }> = {};
            dimensions.forEach((d) => {
              dimensionScores[d.id] = {
                current: data.dimensions[d.id]?.current || 0,
                target: data.dimensions[d.id]?.target || 0,
              };
            });

            return (
              <ADMAPillarCard
                key={pillarId}
                pillarId={pillarId}
                dimensions={dimensions}
                pillarScore={{
                  current: data.pillars[pillarId]?.current || 0,
                  target: data.pillars[pillarId]?.target || 0,
                }}
                dimensionScores={dimensionScores}
                onDimensionChange={handleDimensionChange}
                readOnly={readOnly}
                expanded={expandedPillars.has(pillarId)}
                onToggleExpand={() => togglePillarExpand(pillarId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ADMAAssessmentMap;
