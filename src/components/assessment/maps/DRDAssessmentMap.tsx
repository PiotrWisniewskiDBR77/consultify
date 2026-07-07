/**
 * DRD Assessment Map Component
 *
 * Digital Readiness Diagnosis visualization (mirrors ADMAAssessmentMap /
 * SIRIAssessmentMap):
 * - 7 Axes with a 7-arm (heptagon) radar chart
 * - 34 assessment areas across the axes
 * - MIXED level scales per axis (5, 6 or 7) — the radar plots the
 *   scale-independent normalized % (level / levelCount × 100), so
 *   heterogeneous axes sit on one 0–100% grid.
 *
 * Design tokens: neutral slate/blue/teal + c-* semantic tokens. NO crimson
 * (`primary-*` = crimson) anywhere.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import DRD_STRUCTURE, { getAxisById } from '../../../services/drdStructure';
import type { DRDAssessmentData, DRDAxisId, DRDAxisScore } from '../../../types';

// ============================================
// TYPES
// ============================================

interface DRDAssessmentMapProps {
  data?: DRDAssessmentData;
  onChange?: (data: DRDAssessmentData) => void;
  readOnly?: boolean;
  showLegalNotice?: boolean;
}

// ============================================
// DATA HELPERS
// ============================================

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Build an all-zero DRDAssessmentData skeleton keyed by every axis id. */
function createEmptyDRDAssessment(): DRDAssessmentData {
  const axes = {} as DRDAssessmentData['axes'];
  for (const axis of DRD_STRUCTURE) {
    axes[axis.id as DRDAxisId] = {
      current: 0,
      target: 0,
      gap: 0,
      levelCount: axis.levelCount,
      normalizedCurrent: 0,
      normalizedTarget: 0,
      areas: {},
    };
  }
  return {
    axes,
    overallNormalized: 0,
    targetNormalized: 0,
    metadata: {
      assessmentDate: new Date().toISOString().slice(0, 10),
      version: '1.0',
      source: 'manual',
    },
  };
}

/** Recompute a single axis' aggregate (current/target/gap/normalized) from its area scores. */
function recomputeAxis(axisId: DRDAxisId, areas: DRDAxisScore['areas']): DRDAxisScore {
  const axis = getAxisById(axisId);
  const levelCount = axis?.levelCount || 5;
  const currents = Object.values(areas)
    .map((a) => a.current)
    .filter((v) => v > 0);
  const targets = Object.values(areas)
    .map((a) => a.target)
    .filter((v) => v > 0);
  const current = round1(avg(currents));
  const target = round1(avg(targets));
  return {
    current,
    target,
    gap: round1(Math.max(0, target - current)),
    levelCount,
    normalizedCurrent: levelCount > 0 ? Math.round((current / levelCount) * 100) : 0,
    normalizedTarget: levelCount > 0 ? Math.round((target / levelCount) * 100) : 0,
    areas,
  };
}

/** Recompute the normalized overall/target from all assessed axes. */
function recomputeOverall(axes: DRDAssessmentData['axes']): {
  overallNormalized: number;
  targetNormalized: number;
} {
  const list = Object.values(axes);
  const nc = list.filter((a) => a.current > 0).map((a) => a.normalizedCurrent);
  const nt = list.filter((a) => a.current > 0 || a.target > 0).map((a) => a.normalizedTarget);
  return {
    overallNormalized: Math.round(avg(nc)),
    targetNormalized: Math.round(avg(nt)),
  };
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * 7-arm (heptagon) radar chart. Values are normalized percentages (0–100),
 * so axes with different level scales are comparable on one grid.
 */
const DRDHeptagonRadar: React.FC<{
  labels: string[];
  current: number[];
  target: number[];
  maxValue?: number;
}> = ({ labels, current, target, maxValue = 100 }) => {
  const size = 300;
  const center = size / 2;
  const radius = size * 0.38;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const r = (value / maxValue) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const createPath = (values: number[]) =>
    values
      .map((value, i) => {
        const point = getPoint(i, value);
        return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
      })
      .join(' ') + ' Z';

  // Grid rings at 20/40/60/80/100%.
  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto">
      {/* Grid rings */}
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
          strokeOpacity="0.12"
          className="text-slate-500 dark:text-slate-400"
        />
      ))}

      {/* Axis spokes */}
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
            strokeOpacity="0.12"
            className="text-slate-500 dark:text-slate-400"
          />
        );
      })}

      {/* Target area — teal, dashed */}
      <path
        d={createPath(target)}
        fill="rgba(29, 158, 117, 0.15)"
        stroke="rgb(29, 158, 117)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />

      {/* Current area — blue */}
      <path
        d={createPath(current)}
        fill="rgba(59, 130, 246, 0.2)"
        stroke="rgb(59, 130, 246)"
        strokeWidth="2"
      />

      {/* Current points */}
      {current.map((value, i) => {
        const point = getPoint(i, value);
        return <circle key={i} cx={point.x} cy={point.y} r="3.5" fill="rgb(59, 130, 246)" />;
      })}

      {/* Labels */}
      {labels.map((label, i) => {
        const point = getPoint(i, maxValue + 12);
        return (
          <text
            key={i}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-600 dark:fill-slate-400"
            style={{ fontSize: '9px' }}
          >
            {label.length > 14 ? label.substring(0, 14) + '…' : label}
          </text>
        );
      })}
    </svg>
  );
};

/** Level selector row (respects each axis' levelCount). */
const LevelSelector: React.FC<{
  levelCount: number;
  value: number;
  activeClass: string;
  onSelect: (level: number) => void;
  readOnly?: boolean;
}> = ({ levelCount, value, activeClass, onSelect, readOnly }) => (
  <div className="flex gap-1">
    {Array.from({ length: levelCount }, (_, idx) => idx + 1).map((level) => (
      <button
        key={level}
        onClick={() => !readOnly && onSelect(level)}
        disabled={readOnly}
        className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
          value === level
            ? activeClass
            : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30'
        } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {level}
      </button>
    ))}
  </div>
);

/** Axis card with per-area current/target editors. */
const DRDAxisCard: React.FC<{
  axisId: DRDAxisId;
  score: DRDAxisScore;
  isPolish: boolean;
  onAreaChange: (areaId: string, current: number, target: number) => void;
  readOnly?: boolean;
  expanded?: boolean;
  onToggleExpand: () => void;
}> = ({ axisId, score, isPolish, onAreaChange, readOnly, expanded, onToggleExpand }) => {
  const axis = getAxisById(axisId);
  if (!axis) return null;
  const gap = Math.max(0, score.target - score.current);

  return (
    <div
      className={`bg-white dark:bg-navy-950/50 rounded-xl border-2 transition-all ${
        expanded
          ? 'border-blue-500 shadow-lg'
          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
      }`}
    >
      {/* Header */}
      <button onClick={onToggleExpand} className="w-full p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{axis.id}</span>
          </div>
          <div className="text-left">
            <h3 className="font-bold text-navy-900 dark:text-white text-sm">
              {isPolish ? axis.namePL || axis.name : axis.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {axis.areas.length} {isPolish ? 'obszarów' : 'areas'} · {isPolish ? 'skala' : 'scale'}{' '}
              1–{axis.levelCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {score.current.toFixed(1)}
              </span>
              <span className="text-slate-600 dark:text-slate-500">/</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {score.target.toFixed(1)}
              </span>
            </div>
            {gap > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Gap: {gap.toFixed(1)}
              </span>
            )}
          </div>
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {/* Expanded content — areas */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700 pt-3">
          <div className="space-y-3">
            {axis.areas.map((area) => {
              const areaScore = score.areas[area.id] || { current: 0, target: 0 };
              return (
                <div key={area.id} className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-navy-900 dark:text-white text-sm">
                        {isPolish ? area.namePL || area.name : area.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {area.id} · {area.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                        {isPolish ? 'Obecny' : 'Current'}
                      </label>
                      <LevelSelector
                        levelCount={axis.levelCount}
                        value={areaScore.current}
                        activeClass="bg-blue-500 text-white"
                        onSelect={(level) =>
                          onAreaChange(area.id, level, areaScore.target || level)
                        }
                        readOnly={readOnly}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                        {isPolish ? 'Cel' : 'Target'}
                      </label>
                      <LevelSelector
                        levelCount={axis.levelCount}
                        value={areaScore.target}
                        activeClass="bg-teal-300 text-teal-900 border-2 border-teal-500"
                        onSelect={(level) =>
                          onAreaChange(area.id, areaScore.current || 1, level)
                        }
                        readOnly={readOnly}
                      />
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

/** Legal / provenance notice. */
const DRDLegalNotice: React.FC<{ isPolish: boolean }> = ({ isPolish }) => (
  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    <div className="text-sm text-amber-800 dark:text-amber-200">
      {isPolish ? (
        <>
          <strong>DRD (Digital Readiness Diagnosis)</strong> — 7 osi transformacji cyfrowej wg
          metodyki „Digital Pathfinder”. Osie mają różne skale (5/6/7); radar prezentuje wynik
          znormalizowany (0–100%).
        </>
      ) : (
        <>
          <strong>DRD (Digital Readiness Diagnosis)</strong> — 7 axes of digital transformation per
          the "Digital Pathfinder" methodology. Axes use different scales (5/6/7); the radar shows
          the normalized score (0–100%).
        </>
      )}
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const DRDAssessmentMap: React.FC<DRDAssessmentMapProps> = ({
  data: initialData,
  onChange,
  readOnly = false,
  showLegalNotice = true,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [data, setData] = useState<DRDAssessmentData>(() => initialData || createEmptyDRDAssessment());
  const [expandedAxes, setExpandedAxes] = useState<Set<DRDAxisId>>(new Set([1 as DRDAxisId]));

  const handleAreaChange = useCallback(
    (axisId: DRDAxisId, areaId: string, current: number, target: number) => {
      setData((prev) => {
        const prevAxis = prev.axes[axisId];
        const nextAreas: DRDAxisScore['areas'] = {
          ...prevAxis.areas,
          [areaId]: { current, target },
        };
        const nextAxis = recomputeAxis(axisId, nextAreas);
        const nextAxes = { ...prev.axes, [axisId]: nextAxis };
        const { overallNormalized, targetNormalized } = recomputeOverall(nextAxes);
        const next: DRDAssessmentData = {
          ...prev,
          axes: nextAxes,
          overallNormalized,
          targetNormalized,
        };
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const toggleAxisExpand = useCallback((axisId: DRDAxisId) => {
    setExpandedAxes((prev) => {
      const next = new Set(prev);
      if (next.has(axisId)) next.delete(axisId);
      else next.add(axisId);
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    const totalAreas = DRD_STRUCTURE.reduce((sum, a) => sum + a.areas.length, 0);
    const filledAreas = Object.values(data.axes).reduce(
      (sum, axis) => sum + Object.values(axis.areas).filter((ar) => ar.current > 0).length,
      0
    );
    const totalGap = Object.values(data.axes).reduce((sum, a) => sum + a.gap, 0);
    return {
      overall: data.overallNormalized,
      target: data.targetNormalized,
      filledAreas,
      totalAreas,
      totalGap: round1(totalGap),
      progress: totalAreas ? Math.round((filledAreas / totalAreas) * 100) : 0,
    };
  }, [data]);

  const radarData = useMemo(() => {
    const labels: string[] = [];
    const current: number[] = [];
    const target: number[] = [];
    for (const axis of DRD_STRUCTURE) {
      const s = data.axes[axis.id as DRDAxisId];
      labels.push(isPolish ? axis.namePL || axis.name : axis.name);
      current.push(s?.normalizedCurrent ?? 0);
      target.push(s?.normalizedTarget ?? 0);
    }
    return { labels, current, target };
  }, [data.axes, isPolish]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <Target className="text-blue-500" />
              DRD Assessment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Diagnoza Gotowości Cyfrowej — 7 osi'
                : 'Digital Readiness Diagnosis — 7 axes'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.overall}%
              </div>
              <div className="text-xs text-blue-600/70">{isPolish ? 'Ogólnie' : 'Overall'}</div>
            </div>
            <div className="bg-teal-100 dark:bg-teal-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                {stats.progress}%
              </div>
              <div className="text-xs text-teal-600/70">{isPolish ? 'Pokrycie' : 'Progress'}</div>
            </div>
            <div className="bg-amber-100 dark:bg-amber-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.totalGap.toFixed(1)}
              </div>
              <div className="text-xs text-amber-600/70">{isPolish ? 'Suma luk' : 'Total Gap'}</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showLegalNotice && <DRDLegalNotice isPolish={isPolish} />}

        {/* Radar */}
        <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4 mt-4">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} />
            {isPolish ? 'Radar dojrzałości — 7 osi (znormalizowany)' : '7-Axis Maturity Radar (normalized)'}
          </h3>
          <div className="flex items-center justify-center">
            <DRDHeptagonRadar
              labels={radarData.labels}
              current={radarData.current}
              target={radarData.target}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              {isPolish ? 'Obecny' : 'Current'}
            </span>
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-teal-500 rounded-full border-2 border-dashed border-teal-600"></div>
              {isPolish ? 'Cel' : 'Target'}
            </span>
          </div>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
            {isPolish
              ? 'Osie mają różne skale (5/6/7) — radar pokazuje % dojrzałości.'
              : 'Axes use different scales (5/6/7) — the radar shows maturity %.'}
          </p>
        </div>

        {/* Axes */}
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target size={18} />
            {isPolish ? 'Ocena osi' : 'Axis Assessment'}
          </h3>

          {DRD_STRUCTURE.map((axis) => {
            const axisId = axis.id as DRDAxisId;
            return (
              <DRDAxisCard
                key={axis.id}
                axisId={axisId}
                score={data.axes[axisId]}
                isPolish={isPolish}
                onAreaChange={(areaId, current, target) =>
                  handleAreaChange(axisId, areaId, current, target)
                }
                readOnly={readOnly}
                expanded={expandedAxes.has(axisId)}
                onToggleExpand={() => toggleAxisExpand(axisId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DRDAssessmentMap;
