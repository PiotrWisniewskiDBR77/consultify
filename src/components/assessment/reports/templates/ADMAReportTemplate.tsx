/**
 * ADMA 2.0 Report Template
 *
 * Advanced Digital Maturity Assessment report visualization:
 * - 5 Pillars overview (Pentagon radar chart)
 * - 12 Dimensions detail
 * - Gap analysis and recommendations
 * - Legal notice (European Commission / Digital Innovation Hubs)
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Cpu,
  Database,
  Settings,
  Target,
  TrendingUp,
  Truck,
} from 'lucide-react';
import React from 'react';

import {
  ADMA_DIMENSIONS,
  ADMA_MATURITY_LEVELS,
  ADMA_PILLARS,
  ADMAPillarConfig,
} from '../../../../services/admaStructure';
import { computeADMATransformationScores } from '../../../../services/admaTransformations';
import { buildADMAConclusionModel } from '../../../../services/report/admaConclusion';
import {
  buildAdmaConclusionPayload,
  pushReportConclusion,
  type ReportConclusionSource,
} from '../../../../services/report/conclusionPush';
import { ADMAAssessmentData, ADMAPillarId } from '../../../../types';
import { ConclusionExecutiveSummary, ConclusionGapCards, FoFRoadBar } from '../ConclusionSummary';
import { MaturityPathwaySection } from '../MaturityPathwaySection';

interface ADMAReportTemplateProps {
  data: ADMAAssessmentData;
  organizationName?: string;
  assessmentDate?: string;
  showLegalNotice?: boolean;
  /**
   * CONCLUSION_LAYER bridge: when provided, the W1 conclusion model built for
   * this report is persisted as a Conclusion candidate (fail-safe push via
   * POST /api/conclusions — a failure never affects rendering).
   */
  conclusionSource?: ReportConclusionSource;
}

const getPillarIcon = (pillarId: ADMAPillarId) => {
  const icons: Record<ADMAPillarId, React.FC<{ className?: string; size?: number }>> = {
    strategy: Target,
    smart_products: Cpu,
    smart_operations: Settings,
    smart_supply: Truck,
    data_driven: Database,
  };
  return icons[pillarId] || Target;
};

const getLevelColor = (level: number): string => {
  if (level <= 1) return 'red';
  if (level <= 2) return 'orange';
  if (level <= 3) return 'yellow';
  if (level <= 4) return 'blue';
  return 'green';
};

const getLevelName = (level: number): string => {
  const maturityLevel = ADMA_MATURITY_LEVELS.find((l) => l.level === Math.floor(level));
  return maturityLevel?.title || 'N/A';
};

export const ADMAReportTemplate: React.FC<ADMAReportTemplateProps> = ({
  data,
  organizationName = 'Organization',
  assessmentDate,
  showLegalNotice = true,
  conclusionSource,
}) => {
  // Calculate pillar scores
  const pillarScores = (Object.keys(ADMA_PILLARS) as ADMAPillarId[]).map((pillarId) => ({
    id: pillarId,
    config: ADMA_PILLARS[pillarId],
    score: data.pillars[pillarId]?.current || 0,
    target: data.pillars[pillarId]?.target || 0,
    gap: data.pillars[pillarId]?.gap || 0,
  }));

  // Get dimensions with gaps sorted by gap size
  const dimensionsWithGaps = ADMA_DIMENSIONS.map((dim) => ({
    ...dim,
    current: data.dimensions[dim.id]?.current || 0,
    target: data.dimensions[dim.id]?.target || 0,
    gap: data.dimensions[dim.id]?.gap || 0,
  })).sort((a, b) => b.gap - a.gap);

  // Top priorities
  const topPriorities = dimensionsWithGaps.filter((d) => d.gap >= 1).slice(0, 5);

  const transformationScores = computeADMATransformationScores({
    dimensions: Object.fromEntries(
      (ADMA_DIMENSIONS || []).map((d) => [
        d.id,
        {
          current: data.dimensions?.[d.id]?.current ?? null,
          target: data.dimensions?.[d.id]?.target ?? null,
        },
      ])
    ),
    fofBenchmark: 4.0,
  });

  // Conclusion layer (WNIOSKOWA) — deterministic, engine-grounded (OXFORD O2.2).
  const conclusion = buildADMAConclusionModel(data, 'pl', 4.0);

  // CONCLUSION_LAYER bridge: persist the W1 verdict as a Conclusion candidate
  // when the caller identifies the source assessment. Fail-safe by contract.
  React.useEffect(() => {
    if (!conclusionSource?.assessmentId) return;
    void pushReportConclusion(buildAdmaConclusionPayload(conclusion, conclusionSource));
    // Re-push only when the source identity changes — the model is deterministic per data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conclusionSource?.assessmentId]);
  const execVM = {
    headline: conclusion.executiveSummary.headline,
    k1_state: conclusion.executiveSummary.k1_state,
    k2_meaning: conclusion.executiveSummary.k2_meaning,
    k3_threeGaps: conclusion.executiveSummary.k3_threeGaps,
    k4_whatFirst: conclusion.executiveSummary.k4_whatFirst,
    k5_effect: conclusion.executiveSummary.k5_effect,
    confidence: conclusion.executiveSummary.confidence,
  };
  const gapCardVMs = conclusion.gapCards.map((c) => ({
    title: `${c.dimensionName} (${c.pillarName})`,
    badge: `${c.current} → ${c.target} · luka ${c.gap}`,
    whatIs: c.whatIs,
    whatItMeans: c.whatItMeans,
    whatToDo: c.whatToDo,
    effect: c.effect,
  }));
  const fofItemVMs = conclusion.fofRoad.all.map((t) => ({
    name: t.name,
    current: t.current,
    gapToFoF: t.gapToFoF,
    atOrAboveFoF: t.atOrAboveFoF,
  }));

  return (
    <div className="bg-white dark:bg-navy-950 min-h-full p-8 print:p-0">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-navy-700 pb-8 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
              ADMA 2.0 Assessment Report
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              Advanced Digital Maturity Assessment
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-navy-900 dark:text-white">
              {organizationName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {assessmentDate || new Date().toLocaleDateString('pl-PL')}
            </p>
          </div>
        </div>
      </div>

      {/* Legal Notice */}
      {showLegalNotice && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>ADMA (Advanced Digital Maturity Assessment)</strong> jest narzędziem opracowanym
            przez <strong>European Commission</strong> w ramach programu{' '}
            <strong>Digital Innovation Hubs</strong>. Wykorzystanie w celach edukacyjnych. Oficjalna
            ocena wymaga współpracy z autoryzowanym DIH.
          </div>
        </div>
      )}

      {/* Executive Summary — WNIOSKOWA (answer-first verdict, K1→K2→K3→K4) */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <Target size={20} />
          Podsumowanie Wykonawcze
        </h2>
        <ConclusionExecutiveSummary vm={execVM} language="pl" />
      </section>

      {/* Road to Factory of the Future (FoF≥4) — explicit bar */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Droga do Factory of the Future (FoF ≥ 4)
        </h2>
        <FoFRoadBar
          benchmark={conclusion.fofRoad.benchmark}
          items={fofItemVMs}
          summary={conclusion.fofRoad.summary}
          language="pl"
        />
      </section>

      {/* Key Gaps — co jest → co znaczy → co robić → efekt */}
      {gapCardVMs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Kluczowe Luki — Priorytety
          </h2>
          <ConclusionGapCards cards={gapCardVMs} language="pl" />
        </section>
      )}

      {/* Score Snapshot (supporting evidence for the verdict above) */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Wyniki (dowód)
        </h2>
        <div className="grid grid-cols-6 gap-4">
          {/* Overall Score */}
          <div className="bg-gradient-to-br from-crimson-50 to-primary-50 dark:from-crimson-900/20 dark:to-primary-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.overallMaturity?.toFixed(1) || '0.0'}
            </div>
            <div className="text-sm text-indigo-600/70">Overall / 5</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {getLevelName(data.overallMaturity || 0)}
            </div>
          </div>

          {/* Pillar Scores */}
          {pillarScores.map((pillar) => {
            const IconComponent = getPillarIcon(pillar.id);
            return (
              <div
                key={pillar.id}
                className={`bg-${pillar.config.color}-50 dark:bg-${pillar.config.color}-900/20 rounded-xl p-4 text-center`}
              >
                <div
                  className={`w-8 h-8 mx-auto mb-2 rounded-lg bg-${pillar.config.color}-100 dark:bg-${pillar.config.color}-900/30 flex items-center justify-center`}
                >
                  <IconComponent
                    className={`w-4 h-4 text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`}
                    size={16}
                  />
                </div>
                <div
                  className={`text-2xl font-bold text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`}
                >
                  {pillar.score.toFixed(1)}
                </div>
                <div className={`text-xs text-${pillar.config.color}-600/70 truncate`}>
                  {pillar.config.namePL}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Five Pillars Detail */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Ocena Pięciu Filarów
        </h2>
        <div className="space-y-4">
          {pillarScores.map((pillar) => {
            const pillarDimensions = ADMA_DIMENSIONS.filter((d) => d.pillar === pillar.id);
            const IconComponent = getPillarIcon(pillar.id);

            return (
              <div key={pillar.id} className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg bg-${pillar.config.color}-100 dark:bg-${pillar.config.color}-900/30 flex items-center justify-center`}
                  >
                    <IconComponent
                      className={`w-5 h-5 text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-navy-900 dark:text-white">
                      {pillar.config.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pillar.config.namePL}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-2xl font-bold text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`}
                    >
                      {pillar.score.toFixed(1)}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      /5
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full bg-${pillar.config.color}-500 rounded-full transition-all`}
                    style={{ width: `${(pillar.score / 5) * 100}%` }}
                  />
                </div>

                {/* Dimensions for this pillar */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {pillarDimensions.map((dim) => {
                    const dimScore = data.dimensions[dim.id];
                    return (
                      <div key={dim.id} className="bg-white dark:bg-navy-950 rounded-lg p-3">
                        <div className="text-sm font-medium text-navy-900 dark:text-white mb-1 truncate">
                          {dim.namePL}
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-lg font-bold text-${getLevelColor(dimScore?.current || 0)}-600`}
                          >
                            {dimScore?.current || 0}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {getLevelName(dimScore?.current || 0)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${pillar.config.color}-500 rounded-full`}
                            style={{ width: `${((dimScore?.current || 0) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7 Transformation Areas (T1–T7) + FoF benchmark */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Transformations (T1–T7) + FoF benchmark
        </h2>
        <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4 overflow-x-auto">
          <table
            /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full text-sm"
          >
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4">Area</th>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">FoF</th>
                <th className="py-2 pr-0">Gap to FoF</th>
              </tr>
            </thead>
            <tbody>
              {transformationScores.map((t) => (
                <tr key={t.id} className="border-t border-slate-200/60 dark:border-navy-800">
                  <td className="py-2 pr-4">
                    <div className="font-semibold text-navy-900 dark:text-white">
                      {t.id} {t.name}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="font-semibold text-navy-900 dark:text-white">
                      {t.current === null ? '—' : t.current.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {t.target === null ? '—' : t.target.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {t.fofBenchmark.toFixed(1)}
                  </td>
                  <td className="py-2 pr-0">
                    <span
                      className={
                        t.gapToFoF === null
                          ? 'text-slate-600'
                          : t.gapToFoF <= 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-amber-600 dark:text-amber-400 font-semibold'
                      }
                    >
                      {t.gapToFoF === null ? '—' : t.gapToFoF.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gap Analysis */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Analiza Luk - Top Priorytety
        </h2>
        <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-navy-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Wymiar
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Filar
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Aktualny
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Cel
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Luka
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {dimensionsWithGaps
                .filter((d) => d.gap > 0)
                .slice(0, 10)
                .map((dim) => {
                  const pillarConfig = ADMA_PILLARS[dim.pillar];
                  return (
                    <tr key={dim.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-navy-900 dark:text-white">
                          {dim.namePL}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{dim.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded bg-${pillarConfig.color}-100 dark:bg-${pillarConfig.color}-900/30 text-${pillarConfig.color}-700 dark:text-${pillarConfig.color}-300`}
                        >
                          {pillarConfig.namePL}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-${getLevelColor(dim.current)}-600`}>
                          {dim.current}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                        {dim.target}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded font-bold text-sm">
                          -{dim.gap}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recommendations */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">
          Rekomendacje Transformacyjne
        </h2>
        <div className="space-y-3">
          {topPriorities.map((dim, idx) => {
            const pillarConfig = ADMA_PILLARS[dim.pillar];
            const currentLevel = ADMA_MATURITY_LEVELS.find(
              (l) => l.level === Math.floor(dim.current)
            );
            const targetLevel = ADMA_MATURITY_LEVELS.find((l) => l.level === Math.ceil(dim.target));

            return (
              <div
                key={dim.id}
                className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
              >
                <div
                  className={`w-8 h-8 rounded-full bg-${pillarConfig.color}-100 dark:bg-${pillarConfig.color}-900/30 flex items-center justify-center shrink-0`}
                >
                  <span className={`text-sm font-bold text-${pillarConfig.color}-600`}>
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-navy-900 dark:text-white flex items-center gap-2">
                    {dim.namePL}
                    <span
                      className={`px-2 py-0.5 text-xs rounded bg-${pillarConfig.color}-100 text-${pillarConfig.color}-700`}
                    >
                      {pillarConfig.namePL}
                    </span>
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <span className={`font-medium text-${getLevelColor(dim.current)}-600`}>
                        {currentLevel?.title || 'N/A'}
                      </span>
                      <ArrowRight
                        size={14}
                        className="text-slate-500 dark:text-slate-400 dark:text-slate-500"
                      />
                      <span className="font-medium text-green-600">
                        {targetLevel?.title || 'N/A'}
                      </span>
                    </span>
                  </p>
                  {targetLevel?.characteristics && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {targetLevel.characteristics.slice(0, 3).map((char, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded"
                        >
                          <CheckCircle size={10} />
                          {char}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    Luka
                  </div>
                  <div className="text-lg font-bold text-danger-600">-{dim.gap}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Maturity Pathway (N → N+1) — co zrobić, by przejść wyżej */}
      <MaturityPathwaySection
        framework="adma"
        language="pl"
        dimensions={dimensionsWithGaps.map((d) => ({
          dimensionId: d.id,
          currentLevel: d.current,
          targetLevel: d.target,
        }))}
      />

      {/* Maturity Level Legend */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">
          Poziomy Dojrzałości ADMA
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {ADMA_MATURITY_LEVELS.map((level) => (
            <div
              key={level.level}
              className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-3 text-center"
            >
              <div className={`text-2xl font-bold text-${getLevelColor(level.level)}-600 mb-1`}>
                {level.level}
              </div>
              <div className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                {level.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {level.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key Strengths */}
      {(() => {
        const strongPillars = pillarScores.filter((p) => p.score >= 3.0);
        return strongPillars.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              Key Strengths
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {strongPillars.map((pillar) => {
                const IconComponent = getPillarIcon(pillar.id);
                return (
                  <div
                    key={pillar.id}
                    className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-4 flex items-center gap-3"
                  >
                    <IconComponent
                      size={24}
                      className="text-emerald-600 dark:text-emerald-400 shrink-0"
                    />
                    <div>
                      <span className="font-medium text-navy-900 dark:text-white">
                        {pillar.config.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">
                        {pillar.config.namePL}
                      </span>
                    </div>
                    <span className="ml-auto text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {pillar.score.toFixed(1)}/5
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null;
      })()}

      {/* Data Gaps */}
      {(() => {
        const gaps = dimensionsWithGaps.filter(
          (d) => d.current === 0 || (d.current <= 1 && d.target === 0)
        );
        return gaps.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-600" />
              Data Gaps & Follow-up Items
            </h2>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
              <div className="space-y-2">
                {gaps.map((dim) => (
                  <div key={dim.id} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-navy-900 dark:text-white">{dim.namePL}</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {dim.current === 0 ? '(Not assessed)' : '(No target)'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                These areas require additional data collection or clarification.
              </p>
            </div>
          </section>
        ) : null;
      })()}

      {/* Roadmap */}
      {(() => {
        const quickWins = dimensionsWithGaps.filter((d) => d.gap === 1);
        const strategic = dimensionsWithGaps.filter((d) => d.gap === 2);
        const longTermItems = dimensionsWithGaps.filter((d) => d.gap >= 3);
        if (quickWins.length + strategic.length + longTermItems.length === 0) return null;
        return (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <ArrowRight size={20} />
              Transformation Roadmap
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {quickWins.length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2 text-sm">
                    Quick Wins (gap 1)
                  </h4>
                  {quickWins.map((d) => (
                    <p key={d.id} className="text-xs text-navy-900 dark:text-white">
                      {d.namePL}: {d.current} → {d.target}
                    </p>
                  ))}
                </div>
              )}
              {strategic.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 text-sm">
                    Strategic (gap 2)
                  </h4>
                  {strategic.map((d) => (
                    <p key={d.id} className="text-xs text-navy-900 dark:text-white">
                      {d.namePL}: {d.current} → {d.target}
                    </p>
                  ))}
                </div>
              )}
              {longTermItems.length > 0 && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-primary-700 dark:text-primary-400 mb-2 text-sm">
                    Long-term (gap 3+)
                  </h4>
                  {longTermItems.map((d) => (
                    <p key={d.id} className="text-xs text-navy-900 dark:text-white">
                      {d.namePL}: {d.current} → {d.target}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* Assessment Conclusions */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle size={20} className="text-blue-600" />
          Assessment Conclusions
        </h2>
        <div className="bg-gradient-to-br from-crimson-50 to-primary-50 dark:from-crimson-900/20 dark:to-primary-900/20 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-6">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {data.overallMaturity?.toFixed(1) || '0.0'}/5
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Overall Maturity</div>
              <div className="text-xs font-medium text-indigo-600">
                {getLevelName(data.overallMaturity || 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {dimensionsWithGaps.filter((d) => d.current > 0).length}/{ADMA_DIMENSIONS.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Dimensions Assessed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {dimensionsWithGaps.filter((d) => d.gap > 0).length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Gaps Identified</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {dimensionsWithGaps[0]?.namePL || 'N/A'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Top Priority</div>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Next steps:</strong> Review findings with key stakeholders, prioritize
            initiatives based on gap analysis, create improvement roadmap, schedule follow-up
            assessment.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-navy-700 pt-4 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
        <p>Raport wygenerowany przez Consultify • {new Date().toLocaleDateString('pl-PL')}</p>
        <p className="mt-1">ADMA 2.0 Assessment • {organizationName}</p>
      </footer>
    </div>
  );
};

export default ADMAReportTemplate;
