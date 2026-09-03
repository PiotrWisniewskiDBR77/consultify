/**
 * CMMI Practice Areas Map Component
 *
 * Capability Maturity Model Integration assessment visualization:
 * - 5 Maturity Levels indicator
 * - 20 Practice Areas grouped by 3 Categories (Doing, Managing, Enabling)
 * - Scale 1-5
 */

import {
  AlertTriangle,
  Briefcase,
  Building,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
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
  CMMIAssessmentData,
  CMMICategory,
  CMMIPracticeArea,
  createEmptyCMMIAssessment,
  getAllCategories,
  getCMMIGaps,
  getPracticeAreasForCategory,
} from '../../../services/cmmiStructure';

// ============================================
// TYPES
// ============================================

interface CMPracticeMapProps {
  data?: CMMIAssessmentData;
  onChange?: (data: CMMIAssessmentData) => void;
  readOnly?: boolean;
  showLegalNotice?: boolean;
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Maturity Level Bar
 */
const CMMIMaturityLevelBar: React.FC<{
  currentLevel: number;
  averageScore: number;
}> = ({ currentLevel, averageScore }) => {
  return (
    <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-navy-900 dark:text-white">Maturity Level</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Average Score:</span>
          <span className="font-bold text-navy-900 dark:text-white">{averageScore.toFixed(1)}</span>
        </div>
      </div>

      {/* Level Indicator */}
      <div className="flex gap-1 mb-3">
        {CMMI_MATURITY_LEVELS.map((level) => {
          const isAchieved = currentLevel >= level.level;
          const isCurrent = currentLevel === level.level;

          return (
            <div key={level.level} className={`flex-1 relative group`}>
              <div
                className={`h-12 rounded-lg flex items-center justify-center transition-all ${
                  isAchieved
                    ? `bg-${level.color}-500 text-white`
                    : 'bg-slate-200 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                } ${isCurrent ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
              >
                <div className="text-center">
                  <div className="font-bold text-lg">{level.level}</div>
                  <div className="text-xs opacity-80">{level.name}</div>
                </div>
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow-lg border border-slate-200 dark:border-transparent text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="font-bold mb-1">{level.title}</div>
                <div className="max-w-[200px] whitespace-normal">{level.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Level Info */}
      {currentLevel > 0 && (
        <div
          className={`p-3 rounded-lg bg-${CMMI_MATURITY_LEVELS[currentLevel - 1].color}-50 dark:bg-${CMMI_MATURITY_LEVELS[currentLevel - 1].color}-900/20`}
        >
          <div className="flex items-start gap-2">
            <CheckCircle2
              className={`w-5 h-5 text-${CMMI_MATURITY_LEVELS[currentLevel - 1].color}-500 shrink-0`}
            />
            <div>
              <div
                className={`font-bold text-${CMMI_MATURITY_LEVELS[currentLevel - 1].color}-700 dark:text-${CMMI_MATURITY_LEVELS[currentLevel - 1].color}-400`}
              >
                {CMMI_MATURITY_LEVELS[currentLevel - 1].title}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {CMMI_MATURITY_LEVELS[currentLevel - 1].description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Category Accordion with Practice Areas
 */
const CMMICategoryAccordion: React.FC<{
  category: CMMICategory;
  practiceAreas: CMMIPracticeArea[];
  scores: Record<string, number>;
  onScoreChange: (practiceAreaId: string, level: number) => void;
  readOnly?: boolean;
  expanded?: boolean;
  onToggleExpand: () => void;
}> = ({ category, practiceAreas, scores, onScoreChange, readOnly, expanded, onToggleExpand }) => {
  const config = CMMI_CATEGORIES[category];

  const categoryScore = useMemo(() => {
    return calculateCategoryScore(scores, category);
  }, [scores, category]);

  const IconMap: Record<string, React.FC<{ className?: string; size?: number }>> = {
    Rocket: Rocket,
    Briefcase: Briefcase,
    Building: Building,
  };
  const IconComponent = IconMap[config.icon] || Rocket;

  return (
    <div
      className={`bg-white dark:bg-navy-950/50 rounded-xl border-2 transition-all ${
        expanded ? `border-${config.color}-500 shadow-lg` : 'border-slate-200 dark:border-navy-700'
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
            <h3 className="font-bold text-navy-900 dark:text-white">{config.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {config.namePL} • {practiceAreas.length} Practice Areas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30`}
          >
            <span className={`font-bold text-${config.color}-600 dark:text-${config.color}-400`}>
              Avg: {categoryScore.toFixed(1)}
            </span>
          </div>
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700 pt-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{config.descriptionPL}</p>

          {/* Practice Areas Table */}
          <div className="space-y-2">
            {practiceAreas.map((pa) => {
              const score = scores[pa.id] || 0;
              return (
                <div
                  key={pa.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
                >
                  <div className="w-12 text-center">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      {pa.code}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-900 dark:text-white text-sm truncate">
                      {pa.namePL}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {pa.name}
                    </div>
                  </div>

                  {/* Level Buttons */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const levelConfig = CMMI_MATURITY_LEVELS[level - 1];
                      const isSelected = score === level;

                      return (
                        <button
                          key={level}
                          onClick={() => !readOnly && onScoreChange(pa.id, level)}
                          disabled={readOnly}
                          className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                            isSelected
                              ? `bg-${levelConfig.color}-500 text-white`
                              : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
                          } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                          title={levelConfig.name}
                        >
                          {level}
                        </button>
                      );
                    })}
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
const CMMILegalNotice: React.FC = () => (
  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    <div className="text-sm text-amber-800 dark:text-amber-200">
      <strong>CMMI (Capability Maturity Model Integration)</strong> jest znakiem towarowym{' '}
      <strong>ISACA</strong> (dawniej CMMI Institute). Oficjalna certyfikacja CMMI wymaga{' '}
      <strong>akredytowanego Lead Appraiser</strong>. Implementacja w Consultify służy{' '}
      <strong>celom edukacyjnym</strong>.
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const CMPracticeMap: React.FC<CMPracticeMapProps> = ({
  data: initialData,
  onChange,
  readOnly = false,
  showLegalNotice = true,
}) => {
  const { t } = useTranslation();

  // Initialize data
  const [data, setData] = useState<CMMIAssessmentData>(
    () => initialData || createEmptyCMMIAssessment()
  );

  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<CMMICategory>>(
    new Set(['DOING'])
  );

  // Handlers
  const handleScoreChange = useCallback(
    (practiceAreaId: string, level: number) => {
      setData((prev) => {
        const newData = {
          ...prev,
          practiceAreas: {
            ...prev.practiceAreas,
            [practiceAreaId]: {
              ...prev.practiceAreas[practiceAreaId],
              level,
            },
          },
        };

        // Recalculate scores
        const paScores: Record<string, number> = {};
        Object.entries(newData.practiceAreas).forEach(([id, pa]) => {
          paScores[id] = pa.level;
        });

        // Recalculate categories
        getAllCategories().forEach((cat) => {
          newData.categories[cat] = {
            averageLevel: calculateCategoryScore(paScores, cat),
            practiceAreaScores: paScores,
          };
        });

        // Recalculate overall maturity level
        newData.maturityLevel = calculateOverallMaturityLevel(paScores);
        newData.overallScore = calculateAverageScore(paScores);

        onChange?.(newData);
        return newData;
      });
    },
    [onChange]
  );

  const toggleCategoryExpand = useCallback((category: CMMICategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const paScores: Record<string, number> = {};
    Object.entries(data.practiceAreas).forEach(([id, pa]) => {
      paScores[id] = pa.level;
    });

    const filledPAs = Object.values(data.practiceAreas).filter((pa) => pa.level > 0).length;
    const gaps = getCMMIGaps(data.practiceAreas, 3); // Target level 3

    return {
      maturityLevel: data.maturityLevel,
      averageScore: data.overallScore,
      filledPAs,
      totalPAs: CMMI_PRACTICE_AREAS.length,
      progress: Math.round((filledPAs / CMMI_PRACTICE_AREAS.length) * 100),
      gapsToLevel3: gaps.length,
    };
  }, [data]);

  // Prepare scores for category components
  const paScores = useMemo(() => {
    const scores: Record<string, number> = {};
    Object.entries(data.practiceAreas).forEach(([id, pa]) => {
      scores[id] = pa.level;
    });
    return scores;
  }, [data.practiceAreas]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <Layers className="text-amber-500" />
              CMMI Assessment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Capability Maturity Model Integration v2.0
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                Level {stats.maturityLevel}
              </div>
              <div className="text-xs text-amber-600/70">Maturity</div>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.progress}%
              </div>
              <div className="text-xs text-blue-600/70">
                {stats.filledPAs}/{stats.totalPAs} PAs
              </div>
            </div>
            <div className="bg-primary-100 dark:bg-primary-900/30 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {stats.averageScore.toFixed(1)}
              </div>
              <div className="text-xs text-primary-600/70">Avg Score</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Legal Notice */}
        {showLegalNotice && <CMMILegalNotice />}

        {/* Maturity Level Bar */}
        <CMMIMaturityLevelBar
          currentLevel={stats.maturityLevel}
          averageScore={stats.averageScore}
        />

        {/* Categories */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target size={18} />
            Practice Areas by Category
          </h3>

          {getAllCategories().map((category) => (
            <CMMICategoryAccordion
              key={category}
              category={category}
              practiceAreas={getPracticeAreasForCategory(category)}
              scores={paScores}
              onScoreChange={handleScoreChange}
              readOnly={readOnly}
              expanded={expandedCategories.has(category)}
              onToggleExpand={() => toggleCategoryExpand(category)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CMPracticeMap;
