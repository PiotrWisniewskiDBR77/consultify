/**
 * SIRI Report Template
 *
 * Smart Industry Readiness Index report visualization:
 * - 3 Building Blocks overview
 * - 8 Dimensions detail
 * - Prioritisation Matrix heatmap
 * - Gap analysis and recommendations
 * - Legal notice
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Cpu,
  Settings,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';

import {
  buildSiriConclusionPayload,
  pushReportConclusion,
  type ReportConclusionSource,
} from '../../../../services/report/conclusionPush';
import { buildSIRIConclusionModel } from '../../../../services/report/siriConclusion';
import {
  compute16DScores,
  SIRI_16D_MAPPING_VERSION,
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  SIRI_PRIORITISATION_AREAS,
} from '../../../../services/siriStructure';
import { SIRIAssessmentData } from '../../../../types';
import { ConclusionExecutiveSummary, ConclusionGapCards } from '../ConclusionSummary';
import { MaturityPathwaySection } from '../MaturityPathwaySection';

// ============================================
// COLOR CLASSES HELPER (Tailwind requires full class names)
// ============================================

type ColorKey = 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'yellow';

interface ColorClasses {
  bg50: string;
  bg100: string;
  bg500: string;
  bg900_20: string;
  bg900_30: string;
  text400: string;
  text600: string;
  text600_70: string;
}

const COLOR_CLASSES: Record<ColorKey, ColorClasses> = {
  blue: {
    bg50: 'bg-blue-50 dark:bg-blue-900/20',
    bg100: 'bg-blue-100 dark:bg-blue-900/30',
    bg500: 'bg-blue-500',
    bg900_20: 'bg-blue-900/20',
    bg900_30: 'bg-blue-900/30',
    text400: 'text-blue-400',
    text600: 'text-blue-600 dark:text-blue-400',
    text600_70: 'text-blue-600/70',
  },
  green: {
    bg50: 'bg-green-50 dark:bg-green-900/20',
    bg100: 'bg-green-100 dark:bg-green-900/30',
    bg500: 'bg-green-500',
    bg900_20: 'bg-green-900/20',
    bg900_30: 'bg-green-900/30',
    text400: 'text-green-400',
    text600: 'text-green-600 dark:text-green-400',
    text600_70: 'text-green-600/70',
  },
  purple: {
    bg50: 'bg-primary-50 dark:bg-primary-900/20',
    bg100: 'bg-primary-100 dark:bg-primary-900/30',
    bg500: 'bg-navy-900',
    bg900_20: 'bg-primary-900/20',
    bg900_30: 'bg-primary-900/30',
    text400: 'text-primary-400',
    text600: 'text-primary-600 dark:text-primary-400',
    text600_70: 'text-primary-600/70',
  },
  red: {
    bg50: 'bg-danger-50 dark:bg-danger-900/20',
    bg100: 'bg-danger-100 dark:bg-danger-900/30',
    bg500: 'bg-danger-500',
    bg900_20: 'bg-danger-900/20',
    bg900_30: 'bg-danger-900/30',
    text400: 'text-danger-400',
    text600: 'text-danger-600 dark:text-danger-400',
    text600_70: 'text-danger-600/70',
  },
  orange: {
    bg50: 'bg-amber-50 dark:bg-amber-900/20',
    bg100: 'bg-amber-100 dark:bg-amber-900/30',
    bg500: 'bg-amber-500',
    bg900_20: 'bg-amber-900/20',
    bg900_30: 'bg-amber-900/30',
    text400: 'text-amber-400',
    text600: 'text-amber-600 dark:text-amber-400',
    text600_70: 'text-amber-600/70',
  },
  yellow: {
    bg50: 'bg-yellow-50 dark:bg-yellow-900/20',
    bg100: 'bg-yellow-100 dark:bg-yellow-900/30',
    bg500: 'bg-yellow-500',
    bg900_20: 'bg-yellow-900/20',
    bg900_30: 'bg-yellow-900/30',
    text400: 'text-yellow-400',
    text600: 'text-yellow-600 dark:text-yellow-400',
    text600_70: 'text-yellow-600/70',
  },
};

const getColorClasses = (color: string): ColorClasses => {
  return COLOR_CLASSES[color as ColorKey] || COLOR_CLASSES.blue;
};

const getLevelColorClasses = (level: number): ColorClasses => {
  if (level <= 1) return COLOR_CLASSES.red;
  if (level <= 2) return COLOR_CLASSES.orange;
  if (level <= 3) return COLOR_CLASSES.yellow;
  if (level <= 4) return COLOR_CLASSES.blue;
  return COLOR_CLASSES.green;
};

interface SIRIReportTemplateProps {
  data: SIRIAssessmentData;
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

export const SIRIReportTemplate: React.FC<SIRIReportTemplateProps> = ({
  data,
  organizationName = 'Organization',
  assessmentDate,
  showLegalNotice = true,
  conclusionSource,
}) => {
  // Calculate building block scores
  const blockScores = ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'].map((block) => ({
    id: block,
    config: SIRI_BUILDING_BLOCKS[block as keyof typeof SIRI_BUILDING_BLOCKS],
    score: data.buildingBlocks[block as keyof typeof data.buildingBlocks]?.score || 0,
    colorClasses: getColorClasses(
      SIRI_BUILDING_BLOCKS[block as keyof typeof SIRI_BUILDING_BLOCKS].color
    ),
  }));

  // Get dimensions with gaps
  const dimensionsWithGaps = SIRI_DIMENSIONS.map((dim) => ({
    ...dim,
    current: data.dimensions[dim.id]?.current || 0,
    target: data.dimensions[dim.id]?.target || 0,
    gap: data.dimensions[dim.id]?.gap || 0,
  })).sort((a, b) => b.gap - a.gap);

  // Top priority areas
  const topPriorities = Object.entries(data.prioritisationMatrix || {})
    .sort(([, a], [, b]) => (b || 0) - (a || 0))
    .slice(0, 5);

  const prioritisationAreas = SIRI_PRIORITISATION_AREAS.map((a) => ({
    ...a,
    score: Number((data.prioritisationMatrix || {})[a.id] || 0),
  })).sort((a, b) => (b.score || 0) - (a.score || 0));

  // Conclusion layer (WNIOSKOWA) — deterministic, engine-grounded (OXFORD O2.2).
  const conclusion = buildSIRIConclusionModel(data, 'pl');

  // CONCLUSION_LAYER bridge: persist the W1 verdict as a Conclusion candidate
  // when the caller identifies the source assessment. Fail-safe by contract.
  React.useEffect(() => {
    if (!conclusionSource?.assessmentId) return;
    void pushReportConclusion(buildSiriConclusionPayload(conclusion, conclusionSource));
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
    title: `${c.dimensionName} (${c.buildingBlockName})`,
    badge: `${c.current} → ${c.target} · luka ${c.gap}`,
    whatIs: c.whatIs,
    whatItMeans: c.whatItMeans,
    whatToDo: c.whatToDo,
    effect: c.effect,
  }));

  return (
    <div className="bg-white dark:bg-navy-950 min-h-full p-8 print:p-0">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-navy-700 pb-8 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
              SIRI Assessment Report
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              Smart Industry Readiness Index
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
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>SIRI (Smart Industry Readiness Index)</strong> jest narzędziem opracowanym przez{' '}
            <strong>Singapore Economic Development Board (EDB)</strong> we współpracy z{' '}
            <strong>TÜV SÜD</strong>. Wykorzystanie w celach edukacyjnych. Oficjalna certyfikacja
            wymaga akredytowanego audytora.
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
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data.overallScore?.toFixed(1) || '0.0'}
            </div>
            <div className="text-sm text-blue-600/70">Overall Score / 5</div>
          </div>
          {blockScores.map((block) => (
            <div key={block.id} className={`${block.colorClasses.bg50} rounded-xl p-4 text-center`}>
              <div className={`text-2xl font-bold ${block.colorClasses.text600}`}>
                {block.score.toFixed(1)}
              </div>
              <div className={block.colorClasses.text600_70}>{block.config.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Building Blocks Detail */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Building Blocks Assessment
        </h2>
        <div className="space-y-4">
          {(['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'] as const).map((blockId) => {
            const config = SIRI_BUILDING_BLOCKS[blockId];
            const colorClasses = getColorClasses(config.color);
            const dims = SIRI_DIMENSIONS.filter((d) => d.buildingBlock === blockId);
            const IconComponent =
              blockId === 'PROCESS' ? Settings : blockId === 'TECHNOLOGY' ? Cpu : Users;

            return (
              <div key={blockId} className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg ${colorClasses.bg100} flex items-center justify-center`}
                  >
                    <IconComponent className={`w-5 h-5 ${colorClasses.text600}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy-900 dark:text-white">{config.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{config.namePL}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {dims.map((dim) => {
                    const score = data.dimensions[dim.id];
                    const level = SIRI_MATURITY_LEVELS[Math.floor(score?.current || 0)];
                    const levelColors = getLevelColorClasses(score?.current || 0);
                    return (
                      <div key={dim.id} className="bg-white dark:bg-navy-950 rounded-lg p-3">
                        <div className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                          {dim.name}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-lg font-bold ${levelColors.text600}`}>
                            {score?.current || 0}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {level?.title}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colorClasses.bg500} rounded-full`}
                            style={{ width: `${((score?.current || 0) / 5) * 100}%` }}
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

      {/* Assessment Matrix (16 Prioritisation Areas) */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Assessment Matrix (16 Prioritisation Areas)
        </h2>
        <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4 overflow-x-auto">
          <table
            /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full text-sm"
          >
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4">Area</th>
                <th className="py-2 pr-4">Building Block</th>
                <th className="py-2 pr-4">Dimension</th>
                <th className="py-2 pr-0">Priority</th>
              </tr>
            </thead>
            <tbody>
              {prioritisationAreas.map((a) => (
                <tr key={a.id} className="border-t border-slate-200/60 dark:border-navy-800">
                  <td className="py-2 pr-4">
                    <div className="font-semibold text-navy-900 dark:text-white">
                      {a.namePL || a.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{a.name}</div>
                  </td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {a.buildingBlock}
                  </td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {String(a.dimension || '').replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 pr-0">
                    <span className="font-semibold text-navy-900 dark:text-white">
                      {(a.score || 0).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 16D Assessment Matrix (Canon) */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          16D Assessment Matrix (SIRI Canon)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Full 16-dimension view per SIRI Assessment Matrix methodology (v
          {SIRI_16D_MAPPING_VERSION}). Aggregation 16D→8D is explicit and versioned.
        </p>
        <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4">16D Area</th>
                <th className="py-2 pr-4">Building Block</th>
                <th className="py-2 pr-4">Parent Dimension</th>
                <th className="py-2 pr-2 text-center">Current</th>
                <th className="py-2 pr-2 text-center">Target</th>
                <th className="py-2 pr-0 text-center">Gap</th>
              </tr>
            </thead>
            <tbody>
              {compute16DScores(data).map((s) => (
                <tr key={s.areaId} className="border-t border-slate-200/60 dark:border-navy-800">
                  <td className="py-2 pr-4">
                    <div className="font-semibold text-navy-900 dark:text-white">{s.areaPL}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{s.areaName}</div>
                  </td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {s.buildingBlock}
                  </td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {s.parentDimension.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 pr-2 text-center font-bold text-navy-900 dark:text-white">
                    {s.current.toFixed(1)}
                  </td>
                  <td className="py-2 pr-2 text-center text-slate-500 dark:text-slate-400">
                    {s.target.toFixed(1)}
                  </td>
                  <td className="py-2 pr-0 text-center">
                    {s.gap > 0 ? (
                      <span className="px-2 py-0.5 bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded font-bold text-xs">
                        -{s.gap.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs">OK</span>
                    )}
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
          Gap Analysis - Top Priorities
        </h2>
        <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-navy-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Dimension
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Current
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Target
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Gap
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Building Block
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {dimensionsWithGaps
                .filter((d) => d.gap > 0)
                .slice(0, 8)
                .map((dim) => {
                  const levelColors = getLevelColorClasses(dim.current);
                  return (
                    <tr key={dim.id}>
                      <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                        {dim.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`${levelColors.text600} font-bold`}>{dim.current}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                        {dim.target}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded font-bold text-sm">
                          -{dim.gap}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {dim.buildingBlock}
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
        <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">Rekomendacje</h2>
        <div className="space-y-3">
          {dimensionsWithGaps
            .filter((d) => d.gap >= 2)
            .slice(0, 5)
            .map((dim, idx) => (
              <div
                key={dim.id}
                className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary-600">{idx + 1}</span>
                </div>
                <div>
                  <h4 className="font-medium text-navy-900 dark:text-white">Poprawa {dim.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Aktualne poziom: {dim.current}/5 (Level:{' '}
                    {SIRI_MATURITY_LEVELS[dim.current]?.title}). Rekomendowany cel: poziom{' '}
                    {dim.target} ({SIRI_MATURITY_LEVELS[dim.target]?.title}).
                  </p>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Maturity Pathway (N → N+1) — co zrobić, by przejść wyżej */}
      <MaturityPathwaySection
        framework="siri"
        language="pl"
        dimensions={dimensionsWithGaps.map((d) => ({
          dimensionId: d.id,
          currentLevel: d.current,
          targetLevel: d.target,
        }))}
      />

      {/* Key Strengths */}
      {(() => {
        const strengths = dimensionsWithGaps.filter((d) => d.current >= 3);
        return strengths.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              Key Strengths
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {strengths.map((dim) => (
                <div
                  key={dim.id}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-navy-900 dark:text-white">{dim.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      {dim.buildingBlock}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {dim.current}/5
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null;
      })()}

      {/* Data Gaps */}
      {(() => {
        const gaps = dimensionsWithGaps.filter((d) => d.current === 0);
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
                    <span className="text-navy-900 dark:text-white">{dim.name}</span>
                    <span className="text-amber-600 dark:text-amber-400 text-xs">
                      (Not assessed)
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                These areas require additional data collection before a complete assessment can be
                concluded.
              </p>
            </div>
          </section>
        ) : null;
      })()}

      {/* Roadmap Outline */}
      {(() => {
        const shortTerm = dimensionsWithGaps.filter((d) => d.gap === 1);
        const mediumTerm = dimensionsWithGaps.filter((d) => d.gap === 2);
        const longTerm = dimensionsWithGaps.filter((d) => d.gap >= 3);
        if (shortTerm.length + mediumTerm.length + longTerm.length === 0) return null;
        return (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
              <ArrowRight size={20} />
              Transformation Roadmap Outline
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {shortTerm.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 text-sm">
                    Short-term (0-6m)
                  </h4>
                  {shortTerm.map((d) => (
                    <p key={d.id} className="text-xs text-navy-900 dark:text-white">
                      {d.name}: {d.current} → {d.target}
                    </p>
                  ))}
                </div>
              )}
              {mediumTerm.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 text-sm">
                    Medium-term (6-18m)
                  </h4>
                  {mediumTerm.map((d) => (
                    <p key={d.id} className="text-xs text-navy-900 dark:text-white">
                      {d.name}: {d.current} → {d.target}
                    </p>
                  ))}
                </div>
              )}
              {longTerm.length > 0 && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                  <h4 className="font-semibold text-primary-700 dark:text-primary-400 mb-2 text-sm">
                    Long-term (18-36m)
                  </h4>
                  {longTerm.map((d) => (
                    <p key={d.id} className="text-xs text-navy-900 dark:text-white">
                      {d.name}: {d.current} → {d.target}
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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-6">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {data.overallScore?.toFixed(1) || '0.0'}/5
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {SIRI_MATURITY_LEVELS[Math.round(data.overallScore || 0)]?.title || 'N/A'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Maturity Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-navy-900 dark:text-white">
                {dimensionsWithGaps.filter((d) => d.current > 0).length}/{SIRI_DIMENSIONS.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Dimensions Assessed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {dimensionsWithGaps.filter((d) => d.gap > 0).length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Gaps Identified</div>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Next steps:</strong> Review findings with stakeholders, prioritize initiatives,
            create detailed implementation plans, schedule follow-up assessment.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-navy-700 pt-4 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
        <p>Raport wygenerowany przez Consultify • {new Date().toLocaleDateString('pl-PL')}</p>
        <p className="mt-1">SIRI Assessment • {organizationName}</p>
      </footer>
    </div>
  );
};

export default SIRIReportTemplate;
