/**
 * CMMI Report Template
 *
 * Capability Maturity Model Integration report visualization:
 * - Overall Maturity Level (1-5)
 * - 3 Categories (Doing, Managing, Enabling)
 * - 20 Practice Areas matrix
 * - Gap analysis and improvement roadmap
 * - Legal notice (ISACA trademark)
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building,
  CheckCircle,
  Rocket,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import React from 'react';

import {
  CMMI_CATEGORIES,
  CMMI_MATURITY_LEVELS,
  CMMI_PRACTICE_AREAS,
  CMMICategoryConfig,
} from '../../../../services/cmmiStructure';
import { CMMIAssessmentData, CMMICategoryId } from '../../../../types';

interface CMMIReportTemplateProps {
  data: CMMIAssessmentData;
  organizationName?: string;
  assessmentDate?: string;
  showLegalNotice?: boolean;
}

const getCategoryIcon = (categoryId: CMMICategoryId) => {
  const icons: Record<CMMICategoryId, React.FC<{ className?: string; size?: number }>> = {
    DOING: Rocket,
    MANAGING: Briefcase,
    ENABLING: Building,
  };
  return icons[categoryId] || Target;
};

const getLevelColor = (level: number): string => {
  if (level <= 1) return 'red';
  if (level <= 2) return 'orange';
  if (level <= 3) return 'yellow';
  if (level <= 4) return 'blue';
  return 'green';
};

const getLevelBgColor = (level: number): string => {
  const colors: Record<number, string> = {
    1: 'bg-danger-100 dark:bg-danger-900/30',
    2: 'bg-amber-100 dark:bg-amber-900/30',
    3: 'bg-yellow-100 dark:bg-yellow-900/30',
    4: 'bg-blue-100 dark:bg-blue-900/30',
    5: 'bg-green-100 dark:bg-green-900/30',
  };
  return colors[level] || 'bg-slate-100';
};

export const CMMIReportTemplate: React.FC<CMMIReportTemplateProps> = ({
  data,
  organizationName = 'Organization',
  assessmentDate,
  showLegalNotice = true,
}) => {
  const currentLevel = CMMI_MATURITY_LEVELS.find((l) => l.level === data.maturityLevel);

  // Calculate category scores
  const categoryScores = (Object.keys(CMMI_CATEGORIES) as CMMICategoryId[]).map((catId) => ({
    id: catId,
    config: CMMI_CATEGORIES[catId],
    score: data.categories[catId]?.averageLevel || 0,
  }));

  // Get practice areas with gaps
  const practiceAreasWithGaps = CMMI_PRACTICE_AREAS.map((pa) => {
    const score = data.practiceAreas[pa.id];
    const targetLevel = score?.target || data.maturityLevel || 3;
    return {
      ...pa,
      current: score?.level || 0,
      target: targetLevel,
      gap: Math.max(0, targetLevel - (score?.level || 0)),
      evidence: score?.evidence,
      gaps: score?.gaps,
    };
  }).sort((a, b) => b.gap - a.gap);

  // Top priorities
  const topPriorities = practiceAreasWithGaps.filter((pa) => pa.gap >= 1).slice(0, 8);

  return (
    <div className="bg-white dark:bg-navy-950 min-h-full p-8 print:p-0">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-navy-700 pb-8 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
              CMMI Assessment Report
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              Capability Maturity Model Integration
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-navy-900 dark:text-white">
              {organizationName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {assessmentDate || new Date().toLocaleDateString('pl-PL')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
              Model: {data.metadata?.model || 'DEV'}
            </p>
          </div>
        </div>
      </div>

      {/* Legal Notice */}
      {showLegalNotice && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>CMMI®</strong> jest znakiem towarowym <strong>ISACA</strong> (dawniej CMMI
            Institute). Oficjalna certyfikacja CMMI wymaga akredytowanego{' '}
            <strong>Lead Appraiser</strong>. Implementacja w Consultify służy wyłącznie celom
            edukacyjnym i wewnętrznej samooceny.
          </div>
        </div>
      )}

      {/* Maturity Level Summary */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield size={20} />
          Poziom Dojrzałości Organizacji
        </h2>
        <div className="grid grid-cols-5 gap-2 mb-6">
          {CMMI_MATURITY_LEVELS.map((level) => (
            <div
              key={level.level}
              className={`p-4 rounded-xl text-center transition-all ${
                level.level === data.maturityLevel
                  ? `ring-2 ring-${level.color}-500 ${getLevelBgColor(level.level)}`
                  : level.level < data.maturityLevel
                    ? 'bg-slate-100 dark:bg-navy-900/30'
                    : 'bg-slate-50 dark:bg-navy-900/20 opacity-50'
              }`}
            >
              <div
                className={`text-3xl font-bold ${
                  level.level <= data.maturityLevel
                    ? `text-${level.color}-600`
                    : 'text-slate-700 dark:text-slate-300 dark:text-slate-400'
                }`}
              >
                {level.level}
              </div>
              <div
                className={`text-sm font-medium ${
                  level.level === data.maturityLevel
                    ? 'text-navy-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {level.name}
              </div>
              {level.level === data.maturityLevel && (
                <div className="mt-2">
                  <CheckCircle className={`w-5 h-5 mx-auto text-${level.color}-500`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {currentLevel && (
          <div
            className={`bg-${currentLevel.color}-50 dark:bg-${currentLevel.color}-900/20 rounded-xl p-6`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-16 h-16 rounded-xl bg-${currentLevel.color}-100 dark:bg-${currentLevel.color}-900/30 flex items-center justify-center shrink-0`}
              >
                <span className={`text-3xl font-bold text-${currentLevel.color}-600`}>
                  {currentLevel.level}
                </span>
              </div>
              <div>
                <h3
                  className={`text-xl font-bold text-${currentLevel.color}-900 dark:text-${currentLevel.color}-300 mb-2`}
                >
                  {currentLevel.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {currentLevel.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentLevel.characteristics.map((char, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-1 text-xs rounded bg-${currentLevel.color}-100 dark:bg-${currentLevel.color}-900/30 text-${currentLevel.color}-700 dark:text-${currentLevel.color}-300`}
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Category Overview */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Ocena Kategorii
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {categoryScores.map((cat) => {
            const IconComponent = getCategoryIcon(cat.id);
            const categoryPAs = CMMI_PRACTICE_AREAS.filter((pa) => pa.category === cat.id);

            return (
              <div
                key={cat.id}
                className={`bg-${cat.config.color}-50 dark:bg-${cat.config.color}-900/20 rounded-xl p-4`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg bg-${cat.config.color}-100 dark:bg-${cat.config.color}-900/30 flex items-center justify-center`}
                  >
                    <IconComponent
                      className={`w-5 h-5 text-${cat.config.color}-600 dark:text-${cat.config.color}-400`}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-900 dark:text-white">{cat.config.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {cat.config.namePL}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <span className={`text-2xl font-bold text-${cat.config.color}-600`}>
                      {cat.score.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {categoryPAs.map((pa) => {
                    const score = data.practiceAreas[pa.id]?.level || 0;
                    return (
                      <div key={pa.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400 w-10 font-mono">
                          {pa.code}
                        </span>
                        <div className="flex-1 h-2 bg-white dark:bg-navy-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${cat.config.color}-500 rounded-full`}
                            style={{ width: `${(score / 5) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold text-${getLevelColor(score)}-600 w-4`}>
                          {score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Practice Areas Matrix */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">
          Macierz Obszarów Praktyk
        </h2>
        <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
          <table
            /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full text-sm"
          >
            <thead>
              <tr className="bg-slate-100 dark:bg-navy-800/40 dark:bg-navy-800">
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Kod
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Obszar Praktyk
                </th>
                <th className="text-center px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Kategoria
                </th>
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  L1
                </th>
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  L2
                </th>
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  L3
                </th>
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  L4
                </th>
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  L5
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {CMMI_PRACTICE_AREAS.map((pa) => {
                const score = data.practiceAreas[pa.id]?.level || 0;
                const catConfig = CMMI_CATEGORIES[pa.category];

                return (
                  <tr key={pa.id} className="hover:bg-slate-100 dark:hover:bg-navy-800/50">
                    <td className="px-3 py-2 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                      {pa.code}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-navy-900 dark:text-white text-xs">
                        {pa.namePL}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 text-xs rounded bg-${catConfig.color}-100 dark:bg-${catConfig.color}-900/30 text-${catConfig.color}-700`}
                      >
                        {pa.category}
                      </span>
                    </td>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <td key={level} className="px-2 py-2 text-center">
                        <div
                          className={`w-6 h-6 mx-auto rounded ${
                            score >= level
                              ? getLevelBgColor(level)
                              : 'bg-slate-100 dark:bg-navy-800'
                          } flex items-center justify-center`}
                        >
                          {score >= level && (
                            <CheckCircle className={`w-4 h-4 text-${getLevelColor(level)}-600`} />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gap Analysis */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Plan Doskonalenia - Top Priorytety
        </h2>
        <div className="space-y-3">
          {topPriorities.map((pa, idx) => {
            const catConfig = CMMI_CATEGORIES[pa.category];
            const currentLevelInfo = CMMI_MATURITY_LEVELS.find((l) => l.level === pa.current);
            const targetLevelInfo = CMMI_MATURITY_LEVELS.find((l) => l.level === pa.target);

            return (
              <div
                key={pa.id}
                className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
              >
                <div
                  className={`w-8 h-8 rounded-full bg-${catConfig.color}-100 dark:bg-${catConfig.color}-900/30 flex items-center justify-center shrink-0`}
                >
                  <span className={`text-sm font-bold text-${catConfig.color}-600`}>{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                      {pa.code}
                    </span>
                    <h4 className="font-medium text-navy-900 dark:text-white">{pa.namePL}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs rounded bg-${catConfig.color}-100 text-${catConfig.color}-700`}
                    >
                      {catConfig.namePL}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {pa.descriptionPL}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded ${getLevelBgColor(pa.current)} text-${getLevelColor(pa.current)}-700 font-medium`}
                    >
                      L{pa.current}: {currentLevelInfo?.name || 'N/A'}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-slate-500 dark:text-slate-400 dark:text-slate-500"
                    />
                    <span
                      className={`px-2 py-1 rounded ${getLevelBgColor(pa.target)} text-${getLevelColor(pa.target)}-700 font-medium`}
                    >
                      L{pa.target}: {targetLevelInfo?.name || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    Luka
                  </div>
                  <div className="text-lg font-bold text-danger-600">
                    +{pa.gap} poziom{pa.gap > 1 ? 'y' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Next Steps */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">
          Rekomendowane Następne Kroki
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2">
              Krótkoterminowe (0-6 mies.)
            </h4>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              {topPriorities.slice(0, 3).map((pa) => (
                <li key={pa.id} className="flex items-start gap-2">
                  <CheckCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Doskonalenie {pa.namePL} ({pa.code}) do poziomu {Math.min(pa.current + 1, 5)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
            <h4 className="font-bold text-primary-900 dark:text-primary-300 mb-2">
              Długoterminowe (6-18 mies.)
            </h4>
            <ul className="space-y-2 text-sm text-primary-800 dark:text-primary-200">
              <li className="flex items-start gap-2">
                <CheckCircle size={14} className="mt-0.5 shrink-0" />
                <span>Osiągnięcie poziomu {Math.min(data.maturityLevel + 1, 5)} CMMI</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={14} className="mt-0.5 shrink-0" />
                <span>Wdrożenie pomiarów ilościowych procesów</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={14} className="mt-0.5 shrink-0" />
                <span>Rozważenie formalnej certyfikacji CMMI</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-navy-700 pt-4 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
        <p>Raport wygenerowany przez Consultify • {new Date().toLocaleDateString('pl-PL')}</p>
        <p className="mt-1">CMMI Assessment (Educational) • {organizationName}</p>
        <p className="mt-1 text-[10px]">CMMI® is a registered trademark of ISACA</p>
      </footer>
    </div>
  );
};

export default CMMIReportTemplate;
