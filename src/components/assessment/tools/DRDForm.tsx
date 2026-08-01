/**
 * DRDForm - Digital Readiness Diagnosis Form
 *
 * 7-axis digital maturity assessment form with live scoring.
 * Axes:
 * 1. Processes
 * 2. Digital Products
 * 3. Business Models
 * 4. Data Management
 * 5. Culture
 * 6. Cybersecurity
 * 7. AI Maturity
 *
 * Each axis has multiple areas. The maturity scale length is PER-AXIS
 * (drdStructure.ts: DRDAxis.levelCount is 5, 6, or 7 depending on the axis —
 * e.g. Processes/Data Management have 7 levels). Never hardcode 1-5; read the
 * level count from the area/axis (ASM-001A fix — a hardcoded 1-5 selector
 * made achievedLevel:6/7 on a 7-level axis render as an absurd "6/5").
 */

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Lightbulb,
  Lock,
  Settings,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DRD_STRUCTURE, DRDArea, DRDAxis, DRDLevel } from '../../../services/drdStructure';

// Types
interface AxisScore {
  actual: number;
  target: number;
  areaScores?: Record<string, [number, number]>; // [actual, target]
}

interface DRDFormData {
  processes?: AxisScore;
  digitalProducts?: AxisScore;
  businessModels?: AxisScore;
  dataManagement?: AxisScore;
  culture?: AxisScore;
  cybersecurity?: AxisScore;
  aiMaturity?: AxisScore;
}

interface DRDFormProps {
  data: DRDFormData;
  onChange: (data: DRDFormData) => void;
  onComplete?: () => void;
  readOnly?: boolean;
  showProgress?: boolean;
}

// Axis metadata with icons
const AXIS_META: Record<number, { key: keyof DRDFormData; icon: React.ReactNode; color: string }> =
  {
    1: { key: 'processes', icon: <Settings size={20} />, color: 'blue' },
    2: { key: 'digitalProducts', icon: <Lightbulb size={20} />, color: 'purple' },
    3: { key: 'businessModels', icon: <TrendingUp size={20} />, color: 'green' },
    4: { key: 'dataManagement', icon: <Database size={20} />, color: 'amber' },
    5: { key: 'culture', icon: <Users size={20} />, color: 'pink' },
    6: { key: 'cybersecurity', icon: <Shield size={20} />, color: 'red' },
    7: { key: 'aiMaturity', icon: <Activity size={20} />, color: 'cyan' },
  };

export const DRDForm: React.FC<DRDFormProps> = ({
  data,
  onChange,
  onComplete,
  readOnly = false,
  showProgress = true,
}) => {
  const { t } = useTranslation();

  const [activeAxisId, setActiveAxisId] = useState<number>(1);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());

  // Get current axis data
  const currentAxis = useMemo(() => {
    return DRD_STRUCTURE.find((a) => a.id === activeAxisId);
  }, [activeAxisId]);

  const currentAxisKey = AXIS_META[activeAxisId]?.key || 'processes';
  const currentAxisData = data[currentAxisKey] || { actual: 0, target: 0, areaScores: {} };

  // Calculate progress
  const progress = useMemo(() => {
    let filledAxes = 0;
    let totalScore = 0;
    let count = 0;

    Object.entries(data).forEach(([key, axisData]) => {
      if (axisData && (axisData.actual > 0 || axisData.target > 0)) {
        filledAxes++;
        totalScore += axisData.actual || 0;
        count++;
      }
    });

    return {
      completedAxes: filledAxes,
      totalAxes: 7,
      avgScore: count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0,
      percent: Math.round((filledAxes / 7) * 100),
    };
  }, [data]);

  // Handle area score change
  const handleAreaScoreChange = useCallback(
    (areaId: string, type: 'actual' | 'target', value: number) => {
      if (readOnly) return;

      const newAreaScores = { ...currentAxisData.areaScores };
      const currentScores = newAreaScores[areaId] || [0, 0];

      if (type === 'actual') {
        newAreaScores[areaId] = [value, currentScores[1]];
      } else {
        newAreaScores[areaId] = [currentScores[0], value];
      }

      // Calculate axis average
      const scores = Object.values(newAreaScores);
      const avgActual =
        scores.length > 0
          ? Math.round((scores.reduce((sum, s) => sum + s[0], 0) / scores.length) * 10) / 10
          : 0;
      const avgTarget =
        scores.length > 0
          ? Math.round((scores.reduce((sum, s) => sum + s[1], 0) / scores.length) * 10) / 10
          : 0;

      onChange({
        ...data,
        [currentAxisKey]: {
          actual: avgActual,
          target: avgTarget,
          areaScores: newAreaScores,
        },
      });
    },
    [currentAxisKey, currentAxisData, data, onChange, readOnly]
  );

  // Handle axis navigation
  const handlePrevAxis = () => {
    if (activeAxisId > 1) {
      setActiveAxisId(activeAxisId - 1);
      setActiveAreaId(null);
    }
  };

  const handleNextAxis = () => {
    if (activeAxisId < 7) {
      setActiveAxisId(activeAxisId + 1);
      setActiveAreaId(null);
    } else if (onComplete) {
      onComplete();
    }
  };

  // Toggle level details
  const toggleLevel = (levelKey: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(levelKey)) {
        next.delete(levelKey);
      } else {
        next.add(levelKey);
      }
      return next;
    });
  };

  // Render level selector
  // levelCount is PER-AXIS (drdStructure.ts DRDAxis.levelCount / area.levels.length,
  // 5/6/7 depending on axis) — never hardcode 1-5, that clamps 6/7-level axes.
  const renderLevelSelector = (
    areaId: string,
    type: 'actual' | 'target',
    currentValue: number,
    levelCount: number
  ) => {
    const levels = Array.from({ length: levelCount }, (_, i) => i + 1);
    return (
      <div className="flex flex-wrap gap-1">
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => handleAreaScoreChange(areaId, type, level)}
            disabled={readOnly}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
              currentValue === level
                ? type === 'actual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-green-600 text-white'
                : currentValue > level
                  ? type === 'actual'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-500'
            } ${readOnly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'}`}
          >
            {level}
          </button>
        ))}
      </div>
    );
  };

  // Render area card
  const renderAreaCard = (area: DRDArea) => {
    const scores = currentAxisData.areaScores?.[area.id] || [0, 0];
    const gap = scores[1] - scores[0];
    const isExpanded = activeAreaId === area.id;
    // Ground truth = the area's own level list; falls back to the axis's
    // declared levelCount, then to 5 for any structure missing both (defensive,
    // keeps older/incomplete data from crashing rather than assuming 5 is right).
    const levelCount = area.levels.length || currentAxis?.levelCount || 5;

    return (
      <div
        key={area.id}
        className={`bg-white dark:bg-navy-900 rounded-xl border transition-all ${
          isExpanded
            ? 'border-slate-400 dark:border-navy-500 shadow-lg'
            : 'border-slate-200 dark:border-navy-700'
        }`}
      >
        {/* Area Header */}
        <button
          className="w-full px-4 py-3 flex items-center justify-between text-left"
          onClick={() => setActiveAreaId(isExpanded ? null : area.id)}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-bold">
              {area.id}
            </span>
            <span className="font-medium text-navy-900 dark:text-white">{area.name}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Current scores */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600 dark:text-blue-400">
                {t('assessment.form.current', 'Current')}: {scores[0] || '-'}
              </span>
              <span className="text-slate-500 dark:text-slate-400">/</span>
              <span className="text-green-600 dark:text-green-400">
                {t('assessment.form.target', 'Target')}: {scores[1] || '-'}
              </span>
              {gap > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-xs">
                  Gap: {gap}
                </span>
              )}
            </div>
            <ChevronRight
              size={20}
              className={`text-slate-500 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </button>

        {/* Area Details */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700 pt-4 space-y-4">
            {/* Score Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('assessment.form.currentLevel', 'Current Level')}
                </label>
                {renderLevelSelector(area.id, 'actual', scores[0], levelCount)}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('assessment.form.targetLevel', 'Target Level')}
                </label>
                {renderLevelSelector(area.id, 'target', scores[1], levelCount)}
              </div>
            </div>

            {/* Level Descriptions */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('assessment.form.levelDescriptions', 'Level descriptions:')}
              </p>
              {area.levels.map((level) => {
                const levelKey = `${area.id}-${level.level}`;
                const isLevelExpanded = expandedLevels.has(levelKey);
                const isCurrentLevel = scores[0] === level.level;
                const isTargetLevel = scores[1] === level.level;

                return (
                  <div
                    key={level.level}
                    className={`p-3 rounded-lg border transition-all ${
                      isCurrentLevel
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30'
                        : isTargetLevel
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/30'
                          : 'bg-slate-50 dark:bg-navy-950/50 border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <button
                      className="w-full flex items-center justify-between"
                      onClick={() => toggleLevel(levelKey)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                            isCurrentLevel
                              ? 'bg-blue-600 text-white'
                              : isTargetLevel
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {level.level}
                        </span>
                        <span className="font-medium text-navy-900 dark:text-white text-sm">
                          {level.title}
                        </span>
                        {isCurrentLevel && (
                          <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs">
                            {t('assessment.form.current', 'Current')}
                          </span>
                        )}
                        {isTargetLevel && (
                          <span className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">
                            {t('assessment.form.target', 'Target')}
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-slate-500 dark:text-slate-400 transition-transform ${isLevelExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {isLevelExpanded && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 pl-8">
                        {level.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      {showProgress && (
        <div className="px-6 py-4 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('assessment.form.assessmentProgress', 'Assessment Progress')}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {progress.completedAxes}/{progress.totalAxes} {t('assessment.form.axes', 'axes')} (
              {progress.percent}%)
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy-900 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {progress.avgScore > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {/* Cross-axis average: axes have DIFFERENT level counts (5/6/7), so
                  there is no single denominator to append here (a hardcoded /5
                  would be wrong for the same reason the per-axis "6/5" bug was —
                  ASM-001A). Show the raw average only. */}
              {t('assessment.form.avgScore', 'Average score')}: {progress.avgScore}
            </p>
          )}
        </div>
      )}

      {/* Axis Tabs */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-navy-700 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {DRD_STRUCTURE.map((axis) => {
            const meta = AXIS_META[axis.id];
            const axisData = data[meta?.key || 'processes'];
            const isComplete = axisData && axisData.actual > 0 && axisData.target > 0;
            const isActive = activeAxisId === axis.id;

            return (
              <button
                key={axis.id}
                onClick={() => setActiveAxisId(axis.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-navy-900 text-white'
                    : isComplete
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                      : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                }`}
              >
                {meta?.icon}
                <span className="hidden sm:inline">{axis.name}</span>
                <span className="sm:hidden">{axis.id}</span>
                {isComplete && !isActive && <Check size={14} className="text-green-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Axis Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentAxis && (
          <div className="space-y-6">
            {/* Axis Header */}
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl bg-${AXIS_META[activeAxisId]?.color || 'purple'}-100 dark:bg-${AXIS_META[activeAxisId]?.color || 'purple'}-900/30 flex items-center justify-center`}
              >
                {AXIS_META[activeAxisId]?.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                  {t('assessment.form.axis', 'Axis')} {currentAxis.id}: {currentAxis.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {currentAxis.areas.length} {t('assessment.form.areasToAssess', 'areas to assess')}
                </p>
              </div>
            </div>

            {/* Axis Summary Scores */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                  {t('assessment.form.currentLevel', 'Current Level')}
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {currentAxisData.actual || '-'}/{currentAxis.levelCount || 5}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-500/30">
                <p className="text-sm text-green-600 dark:text-green-400 mb-1">
                  {t('assessment.form.targetLevel', 'Target Level')}
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {currentAxisData.target || '-'}/{currentAxis.levelCount || 5}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">
                  {t('assessment.form.gapToClose', 'Gap to Close')}
                </p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {currentAxisData.target && currentAxisData.actual
                    ? currentAxisData.target - currentAxisData.actual
                    : '-'}
                </p>
              </div>
            </div>

            {/* Areas */}
            <div className="space-y-3">{currentAxis.areas.map((area) => renderAreaCard(area))}</div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="px-6 py-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
        <button
          onClick={handlePrevAxis}
          disabled={activeAxisId === 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeAxisId === 1
              ? 'text-slate-500 dark:text-slate-400 cursor-not-allowed'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          <ChevronLeft size={20} />
          {t('assessment.form.previousAxis', 'Previous Axis')}
        </button>

        <button
          onClick={handleNextAxis}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors"
        >
          {activeAxisId === 7
            ? t('assessment.form.completeAssessment', 'Complete Assessment')
            : t('assessment.form.nextAxis', 'Next Axis')}
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default DRDForm;
