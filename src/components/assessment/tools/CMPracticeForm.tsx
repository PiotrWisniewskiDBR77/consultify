/**
 * CMPracticeForm - CMMI Practice Area Assessment Form
 *
 * Capability Maturity Model Integration assessment form with live scoring.
 * Categories:
 * 1. Doing - Deliver value through development and delivery practices
 * 2. Managing - Manage work, resources, and risks effectively
 * 3. Enabling - Enable capability, infrastructure, and organizational support
 *
 * 20 Practice Areas with 5-level maturity scale (1-5).
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Rocket,
  Target,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calculateAverageScore,
  calculateCategoryScore,
  calculateOverallMaturityLevel,
  CMMI_CATEGORIES,
  CMMI_MATURITY_LEVELS,
  CMMI_PRACTICE_AREAS,
  CMMICategory,
  CMMIPracticeArea,
} from '../../../services/cmmiStructure';

// Types
interface PracticeAreaScore {
  level: number;
  target?: number;
  evidence?: string;
}

interface CategoryScore {
  averageLevel: number;
  practiceAreaScores: Record<string, PracticeAreaScore>;
}

interface CMMIFormData {
  maturityLevel: number;
  categories: Record<CMMICategory, CategoryScore>;
  overallScore: number;
}

interface CMMIFormProps {
  data: CMMIFormData;
  onChange: (data: CMMIFormData) => void;
  onComplete?: () => void;
  readOnly?: boolean;
  showProgress?: boolean;
}

// Category icons
const CATEGORY_ICONS: Record<CMMICategory, React.ReactNode> = {
  DOING: <Rocket size={20} />,
  MANAGING: <Briefcase size={20} />,
  ENABLING: <Building size={20} />,
};

// Category colors
const CATEGORY_COLORS: Record<CMMICategory, string> = {
  DOING: 'blue',
  MANAGING: 'purple',
  ENABLING: 'green',
};

// Level colors
const LEVEL_COLORS: Record<number, string> = {
  1: 'red',
  2: 'orange',
  3: 'yellow',
  4: 'blue',
  5: 'green',
};

// Create empty form data
export function createEmptyCMMIFormData(): CMMIFormData {
  const categories: Record<CMMICategory, CategoryScore> = {} as Record<CMMICategory, CategoryScore>;

  (Object.keys(CMMI_CATEGORIES) as CMMICategory[]).forEach((categoryId) => {
    const practiceAreaScores: Record<string, PracticeAreaScore> = {};
    CMMI_CATEGORIES[categoryId].practiceAreaIds.forEach((paId) => {
      practiceAreaScores[paId] = { level: 0 };
    });
    categories[categoryId] = { averageLevel: 0, practiceAreaScores };
  });

  return {
    maturityLevel: 1,
    categories,
    overallScore: 0,
  };
}

export const CMPracticeForm: React.FC<CMMIFormProps> = ({
  data,
  onChange,
  onComplete,
  readOnly = false,
  showProgress = true,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [activeCategoryId, setActiveCategoryId] = useState<CMMICategory>('DOING');
  const [expandedPracticeAreas, setExpandedPracticeAreas] = useState<Set<string>>(new Set());

  // Get category IDs in order
  const categoryIds = useMemo(() => Object.keys(CMMI_CATEGORIES) as CMMICategory[], []);

  // Get current category config
  const currentCategory = CMMI_CATEGORIES[activeCategoryId];
  const currentCategoryData = data.categories[activeCategoryId] || {
    averageLevel: 0,
    practiceAreaScores: {},
  };

  // Get practice areas for current category
  const currentPracticeAreas = useMemo(() => {
    return CMMI_PRACTICE_AREAS.filter((pa) => pa.category === activeCategoryId);
  }, [activeCategoryId]);

  // Calculate progress
  const progress = useMemo(() => {
    let filledPracticeAreas = 0;
    const totalPracticeAreas = CMMI_PRACTICE_AREAS.length;
    let totalScore = 0;
    let count = 0;

    Object.values(data.categories).forEach((category) => {
      Object.values(category.practiceAreaScores).forEach((pa) => {
        if (pa.level > 0) {
          filledPracticeAreas++;
          totalScore += pa.level;
          count++;
        }
      });
    });

    return {
      completedPracticeAreas: filledPracticeAreas,
      totalPracticeAreas,
      avgScore: count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0,
      percent: Math.round((filledPracticeAreas / totalPracticeAreas) * 100),
    };
  }, [data]);

  // Handle practice area score change
  const handlePracticeAreaScoreChange = useCallback(
    (practiceAreaId: string, type: 'level' | 'target', value: number) => {
      if (readOnly) return;

      const newPracticeAreaScores = { ...currentCategoryData.practiceAreaScores };
      const currentPAScore = newPracticeAreaScores[practiceAreaId] || { level: 0 };

      newPracticeAreaScores[practiceAreaId] = {
        ...currentPAScore,
        [type]: value,
      };

      // Calculate category average
      const scores = Object.values(newPracticeAreaScores);
      const avgLevel =
        scores.length > 0
          ? Math.round(
              (scores.filter((s) => s.level > 0).reduce((sum, s) => sum + s.level, 0) /
                scores.filter((s) => s.level > 0).length || 0) * 10
            ) / 10
          : 0;

      const newCategories = {
        ...data.categories,
        [activeCategoryId]: {
          averageLevel: avgLevel,
          practiceAreaScores: newPracticeAreaScores,
        },
      };

      // Calculate overall maturity level and score
      const allPAScores: Record<string, number> = {};
      Object.values(newCategories).forEach((category) => {
        Object.entries(category.practiceAreaScores).forEach(([paId, score]) => {
          if (score.level > 0) {
            allPAScores[paId] = score.level;
          }
        });
      });

      const maturityLevel = calculateOverallMaturityLevel(allPAScores);
      const overallScore = calculateAverageScore(allPAScores);

      onChange({
        maturityLevel,
        categories: newCategories,
        overallScore,
      });
    },
    [activeCategoryId, currentCategoryData, data, onChange, readOnly]
  );

  // Toggle practice area expansion
  const togglePracticeArea = useCallback((practiceAreaId: string) => {
    setExpandedPracticeAreas((prev) => {
      const next = new Set(prev);
      if (next.has(practiceAreaId)) {
        next.delete(practiceAreaId);
      } else {
        next.add(practiceAreaId);
      }
      return next;
    });
  }, []);

  // Navigate between categories
  const goToCategory = useCallback(
    (direction: 'prev' | 'next') => {
      const currentIndex = categoryIds.indexOf(activeCategoryId);
      if (direction === 'prev' && currentIndex > 0) {
        setActiveCategoryId(categoryIds[currentIndex - 1]);
      } else if (direction === 'next' && currentIndex < categoryIds.length - 1) {
        setActiveCategoryId(categoryIds[currentIndex + 1]);
      }
    },
    [activeCategoryId, categoryIds]
  );

  // Render level selector
  const renderLevelSelector = (
    practiceArea: CMMIPracticeArea,
    type: 'level' | 'target',
    value: number
  ) => {
    return (
      <div className="flex items-center gap-1">
        {CMMI_MATURITY_LEVELS.map((level) => {
          const isSelected = value === level.level;
          const isBelow = level.level < value;
          const levelColor = LEVEL_COLORS[level.level];

          return (
            <button
              key={level.level}
              onClick={() => handlePracticeAreaScoreChange(practiceArea.id, type, level.level)}
              disabled={readOnly}
              className={`
                w-12 h-10 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center
                ${
                  isSelected
                    ? `bg-${levelColor}-500 text-white shadow-lg shadow-${levelColor}-500/30`
                    : isBelow
                      ? `bg-${levelColor}-500/30 text-${levelColor}-300`
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-600'
                }
                ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              `}
              title={`${level.level}: ${level.name}`}
            >
              <span className="text-xs font-bold">{level.level}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Render practice area card
  const renderPracticeAreaCard = (practiceArea: CMMIPracticeArea) => {
    const paScore = currentCategoryData.practiceAreaScores[practiceArea.id] || { level: 0 };
    const isExpanded = expandedPracticeAreas.has(practiceArea.id);
    const color = CATEGORY_COLORS[activeCategoryId];
    const levelColor = paScore.level > 0 ? LEVEL_COLORS[paScore.level] : 'slate';
    const gap = (paScore.target || 0) - paScore.level;

    return (
      <div
        key={practiceArea.id}
        className={`bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden transition-all ${
          isExpanded ? 'ring-1 ring-' + color + '-500/30' : ''
        }`}
      >
        {/* Practice Area Header */}
        <button
          onClick={() => togglePracticeArea(practiceArea.id)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-navy-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-10 rounded-lg bg-${levelColor}-500/20 flex flex-col items-center justify-center`}
            >
              <span className={`text-${levelColor}-400 font-bold text-sm`}>
                {paScore.level > 0 ? paScore.level : '-'}
              </span>
              <span className="text-[10px] text-slate-500">{practiceArea.code}</span>
            </div>
            <div className="text-left">
              <h4 className="text-slate-900 dark:text-white font-medium">
                {isPolish ? practiceArea.namePL : practiceArea.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isPolish ? practiceArea.descriptionPL : practiceArea.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Gap indicator */}
            {paScore.level > 0 && paScore.target && paScore.target > 0 && (
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
              {renderLevelSelector(practiceArea, 'level', paScore.level)}
              {paScore.level > 0 && (
                <div className="mt-2 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded bg-${LEVEL_COLORS[paScore.level]}-500/20 text-${LEVEL_COLORS[paScore.level]}-400`}
                    >
                      Level {paScore.level}
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {CMMI_MATURITY_LEVELS[paScore.level - 1]?.name}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {CMMI_MATURITY_LEVELS[paScore.level - 1]?.description}
                  </p>
                </div>
              )}
            </div>

            {/* Target Level */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Target Level (Cel)
              </label>
              {renderLevelSelector(practiceArea, 'target', paScore.target || 0)}
              {paScore.target && paScore.target > 0 && (
                <div className="mt-2 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded bg-${LEVEL_COLORS[paScore.target]}-500/20 text-${LEVEL_COLORS[paScore.target]}-400`}
                    >
                      Level {paScore.target}
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {CMMI_MATURITY_LEVELS[paScore.target - 1]?.name}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {CMMI_MATURITY_LEVELS[paScore.target - 1]?.description}
                  </p>
                </div>
              )}
            </div>

            {/* Maturity Level Reference */}
            <div className="bg-slate-100 dark:bg-navy-900 rounded-lg p-3">
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                CMMI Maturity Levels
              </h5>
              <div className="grid grid-cols-5 gap-2 text-xs">
                {CMMI_MATURITY_LEVELS.map((level) => (
                  <div key={level.level} className="text-center">
                    <div
                      className={`w-8 h-8 rounded mx-auto mb-1 flex items-center justify-center ${
                        level.level <= paScore.level
                          ? `bg-${LEVEL_COLORS[level.level]}-500 text-white`
                          : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {level.level}
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                      {level.name}
                    </span>
                  </div>
                ))}
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
                {progress.completedPracticeAreas} / {progress.totalPracticeAreas} practice areas
                assessed
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Maturity Level:</span>
                <span
                  className={`px-2 py-0.5 rounded text-sm font-medium bg-${LEVEL_COLORS[data.maturityLevel]}-500/20 text-${LEVEL_COLORS[data.maturityLevel]}-400`}
                >
                  {data.maturityLevel} - {CMMI_MATURITY_LEVELS[data.maturityLevel - 1]?.name}
                </span>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Avg Score:{' '}
                <span className="text-slate-900 dark:text-white font-medium">
                  {data.overallScore || '-'}
                </span>
              </span>
            </div>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Category Navigation */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {categoryIds.map((categoryId) => {
            const category = CMMI_CATEGORIES[categoryId];
            const categoryData = data.categories[categoryId];
            const isActive = activeCategoryId === categoryId;
            const isCompleted = categoryData && categoryData.averageLevel > 0;
            const color = CATEGORY_COLORS[categoryId];

            return (
              <button
                key={categoryId}
                onClick={() => setActiveCategoryId(categoryId)}
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
                  {CATEGORY_ICONS[categoryId]}
                </span>
                <span>{isPolish ? category.namePL : category.name}</span>
                {isCompleted && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full bg-${color}-500/20 text-${color}-400`}
                  >
                    {categoryData.averageLevel}
                  </span>
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({category.practiceAreaIds.length})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Category Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-12 h-12 rounded-xl bg-${CATEGORY_COLORS[activeCategoryId]}-500/20 flex items-center justify-center`}
            >
              <span className={`text-${CATEGORY_COLORS[activeCategoryId]}-400`}>
                {CATEGORY_ICONS[activeCategoryId]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isPolish ? currentCategory.namePL : currentCategory.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? currentCategory.descriptionPL : currentCategory.description}
              </p>
            </div>
          </div>

          {/* Category Score Summary */}
          <div className="flex items-center gap-6 mt-4 p-4 bg-slate-100 dark:bg-navy-800 rounded-lg">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Category Average
              </span>
              <div className={`text-2xl font-bold text-${CATEGORY_COLORS[activeCategoryId]}-400`}>
                {currentCategoryData.averageLevel || '-'}
              </div>
            </div>
            <div className="flex-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Practice Areas
              </span>
              <div className="text-lg font-medium text-slate-900 dark:text-white">
                {currentPracticeAreas.length} areas
              </div>
            </div>
            {/* Warning if low maturity */}
            {currentCategoryData.averageLevel > 0 && currentCategoryData.averageLevel < 3 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle size={16} className="text-amber-400" />
                <span className="text-sm text-amber-400">Below Level 3 (Defined)</span>
              </div>
            )}
          </div>
        </div>

        {/* Practice Areas */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Practice Areas ({currentPracticeAreas.length})
          </h3>
          {currentPracticeAreas.map(renderPracticeAreaCard)}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToCategory('prev')}
            disabled={categoryIds.indexOf(activeCategoryId) === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-slate-100 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            <ChevronLeft size={16} />
            Previous Category
          </button>

          {categoryIds.indexOf(activeCategoryId) === categoryIds.length - 1 ? (
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
              onClick={() => goToCategory('next')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-c-text text-c-bg hover:bg-c-text-secondary
                transition-colors"
            >
              Next Category
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CMPracticeForm;
