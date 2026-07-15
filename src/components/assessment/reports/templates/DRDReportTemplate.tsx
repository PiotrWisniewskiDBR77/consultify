/**
 * DRD Report Template
 *
 * Digital Readiness Diagnosis report visualization, built on the shared
 * assessment visualization layer (AssessmentReportVisualizations) via the
 * drdVizAdapter.
 *
 * Sections:
 *  (a) Header + executive summary (normalized overall maturity %)
 *  (b) Maturity dashboard (radar + dimension bars + score cards)
 *  (c) Gap heatmap
 *  (d) Top gaps (sorted by gap)
 *  (e) Placeholders: Initiatives + Economic effects (ROI) — "in preparation"
 *
 * Aesthetic: clean, airy, slate/blue/teal; semantic danger/amber/green for
 * gaps. NO crimson (`primary-*`) classes.
 */

import { AlertTriangle, ArrowRight, BarChart3, Clock, Target, TrendingUp } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildDRDVisualizationData } from '../../../../services/drdVizAdapter';
import type { AssessmentVisualizationData } from '../AssessmentReportVisualizations';
import {
  AssessmentRadarChart,
  DimensionBars,
  GapHeatmap,
  ScoreCardsGrid,
} from '../AssessmentReportVisualizations';
import { MaturityPathwaySection } from '../MaturityPathwaySection';

/**
 * Map DRD visualization axis ids (DRD_STRUCTURE axes 1..7, exposed by
 * drdVizAdapter as string ids "1".."7") to the canonical DRD dimension ids
 * ("D1".."D8", Canon §3.2) that `getMaturityPathway('drd', …)` expects. The
 * axes align with the canon dimensions by subject; DRD_STRUCTURE has no
 * dedicated "Technology & Infrastructure" (D5) axis, so that id is absent here.
 */
const DRD_AXIS_TO_CANON_DIMENSION: Record<string, string> = {
  '1': 'D1', // Digital Processes
  '2': 'D2', // Digital Products
  '3': 'D3', // Digital Business Models
  '4': 'D4', // Data Management → Data & Analytics
  '5': 'D6', // Culture of Transformation → People & Culture
  '6': 'D7', // Cybersecurity
  '7': 'D8', // AI Maturity
};

interface DRDReportTemplateProps {
  /** Per-area actual/target levels keyed by area id (e.g. "1A"). */
  areaScores?: Record<string, { actual: number; target: number }>;
  /** Pre-built visualization payload (e.g. from axis-level report data). Takes precedence over areaScores. */
  visualizationData?: AssessmentVisualizationData;
  companyName?: string;
  readOnly?: boolean;
}

export const DRDReportTemplate: React.FC<DRDReportTemplateProps> = ({
  areaScores,
  visualizationData,
  companyName = 'Organizacja',
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const vizData = useMemo(
    () => visualizationData ?? buildDRDVisualizationData(areaScores ?? {}),
    [visualizationData, areaScores]
  );

  // Normalize each axis to a 0..100% scale (axes have different maxLevel) then
  // average. This makes the headline maturity comparable across mixed scales.
  const normalizedMaturityPercent = useMemo(() => {
    const dims = vizData.dimensions.filter((d) => d.maxLevel > 0);
    if (dims.length === 0) return 0;
    const sum = dims.reduce((acc, d) => acc + (d.current / d.maxLevel) * 100, 0);
    return Math.round(sum / dims.length);
  }, [vizData.dimensions]);

  const normalizedTargetPercent = useMemo(() => {
    const dims = vizData.dimensions.filter((d) => d.maxLevel > 0);
    if (dims.length === 0) return 0;
    const sum = dims.reduce((acc, d) => acc + (d.target / d.maxLevel) * 100, 0);
    return Math.round(sum / dims.length);
  }, [vizData.dimensions]);

  // Top gaps sorted by raw gap (target - current), descending.
  const topGaps = useMemo(() => {
    return [...vizData.dimensions]
      .map((d) => ({ ...d, gap: Math.round((d.target - d.current) * 10) / 10 }))
      .filter((d) => d.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5);
  }, [vizData.dimensions]);

  // Maturity-pathway rows: below-target axes mapped to canon dimension ids so
  // getMaturityPathway() returns the DRD Canon N→N+1 recipe (not a fallback).
  const pathwayDimensions = useMemo(
    () =>
      vizData.dimensions
        .filter((d) => d.current < d.target && DRD_AXIS_TO_CANON_DIMENSION[d.id])
        .map((d) => ({
          dimensionId: DRD_AXIS_TO_CANON_DIMENSION[d.id],
          currentLevel: d.current,
          targetLevel: d.target,
        })),
    [vizData.dimensions]
  );

  const maturityVerdict = useMemo(() => {
    if (normalizedMaturityPercent >= 75) return t('assessment.drdReport.verdictHigh', 'high');
    if (normalizedMaturityPercent >= 50)
      return t('assessment.drdReport.verdictModerate', 'moderate');
    if (normalizedMaturityPercent >= 25) return t('assessment.drdReport.verdictBasic', 'basic');
    return t('assessment.drdReport.verdictInitial', 'initial');
  }, [normalizedMaturityPercent, t]);

  return (
    <div className="bg-white dark:bg-navy-950 min-h-full p-8 print:p-0">
      {/* ====================================================== */}
      {/* (a) HEADER + EXECUTIVE SUMMARY                          */}
      {/* ====================================================== */}
      <div className="border-b border-slate-200 dark:border-navy-700 pb-8 mb-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {t('assessment.drdReport.title', 'Digital Readiness Diagnosis Report')}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              {t('assessment.drdReport.subtitle', 'DRD — 7 axes of digital transformation')}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{companyName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB')}
            </p>
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* FLAGSHIP MATURITY RADAR — the 3-second profile          */}
      {/* Placed at the very top, before any textual detail, so a */}
      {/* consultant sees the client's maturity shape immediately.*/}
      {/* Fail-soft: AssessmentRadarChart returns null on thin     */}
      {/* data, in which case this whole block collapses.          */}
      {/* ====================================================== */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
          {t('assessment.drdReport.maturityProfileHeading', 'Digital maturity profile')}
        </h2>
        <AssessmentRadarChart data={vizData} height={460} />
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Target size={20} className="text-blue-600 dark:text-blue-400" />
          {t('assessment.drdReport.executiveSummaryHeading', 'Executive Summary')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-5 text-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {normalizedMaturityPercent}%
            </div>
            <div className="text-sm text-blue-700/80 dark:text-blue-300/80 mt-1">
              {t('assessment.drdReport.overallMaturityCard', 'Overall maturity (normalized)')}
            </div>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-500/30 rounded-xl p-5 text-center">
            <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
              {normalizedTargetPercent}%
            </div>
            <div className="text-sm text-teal-700/80 dark:text-teal-300/80 mt-1">
              {t('assessment.drdReport.targetStateCard', 'Target state (normalized)')}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5 text-center">
            <div className="text-4xl font-bold text-slate-700 dark:text-slate-200">
              {vizData.completionPercent}%
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('assessment.drdReport.completionCard', 'Assessment completion')}
            </div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-4">
          {t(
            'assessment.drdReport.narrative',
            '{{company}}\'s overall digital maturity stands at {{current}}% (level: {{verdict}}), against a {{target}}% target. The diagnosis covered {{completion}}% of areas across 7 axes. The largest gaps — and quickest wins — are listed in the "Top gaps" section below.',
            {
              company: companyName,
              current: normalizedMaturityPercent,
              verdict: maturityVerdict,
              target: normalizedTargetPercent,
              completion: vizData.completionPercent,
            }
          )}
        </p>
      </section>

      {/* ====================================================== */}
      {/* (b) MATURITY DASHBOARD                                  */}
      {/* ====================================================== */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
          {t('assessment.drdReport.maturityMapHeading', 'Maturity map — 7 axes')}
        </h2>
        <div className="space-y-6">
          <ScoreCardsGrid data={vizData} />
          <GapHeatmap data={vizData} />
          <DimensionBars data={vizData} />
        </div>
      </section>

      {/* ====================================================== */}
      {/* (c) is folded into the dashboard above (GapHeatmap).    */}
      {/* (d) TOP GAPS                                            */}
      {/* ====================================================== */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-amber-600 dark:text-amber-400" />
          {t('assessment.drdReport.topGapsHeading', 'Top gaps')}
        </h2>
        {topGaps.length > 0 ? (
          <div className="space-y-3">
            {topGaps.map((dim, idx) => {
              const gapTone =
                dim.gap >= 3
                  ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-500/30'
                  : dim.gap >= 1.5
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30';
              const badgeTone =
                dim.gap >= 3
                  ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                  : dim.gap >= 1.5
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
              return (
                <div
                  key={dim.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${gapTone}`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/70 dark:bg-navy-900/60 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {isPolish && dim.namePL ? dim.namePL : dim.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>
                        {t('assessment.drdReport.currentLabel', 'Current')}: {dim.current}
                      </span>
                      <ArrowRight size={12} />
                      <span>
                        {t('assessment.drdReport.targetLabel', 'Target')}: {dim.target}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600">/ {dim.maxLevel}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg font-bold text-sm ${badgeTone}`}>
                    +{dim.gap}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-5 text-sm text-emerald-700 dark:text-emerald-300">
            {t(
              'assessment.drdReport.noGapsMessage',
              'No significant gaps — every axis meets or exceeds its target.'
            )}
          </div>
        )}
      </section>

      {/* ====================================================== */}
      {/* (d2) MATURITY PATHWAY (N → N+1)                         */}
      {/* ====================================================== */}
      <MaturityPathwaySection
        framework="drd"
        dimensions={pathwayDimensions}
        language={isPolish ? 'pl' : 'en'}
      />

      {/* ====================================================== */}
      {/* (e) PLACEHOLDERS: INITIATIVES + ECONOMIC EFFECTS (ROI) */}
      {/* ====================================================== */}
      <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 dark:bg-navy-800 border border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Target size={18} className="text-teal-600 dark:text-teal-400" />
            {t('assessment.drdReport.initiativesHeading', 'Initiatives')}
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Clock size={14} />
            <span>{t('assessment.drdReport.inPreparation', 'in preparation')}</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
            {t(
              'assessment.drdReport.initiativesPlaceholder',
              'Recommended transformation initiatives will be generated from the identified gaps.'
            )}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-navy-800 border border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
            {t('assessment.drdReport.roiHeading', 'Economic effects (ROI)')}
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Clock size={14} />
            <span>{t('assessment.drdReport.inPreparation', 'in preparation')}</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
            {t(
              'assessment.drdReport.roiPlaceholder',
              'Estimated return on investment and financial effects will be modelled for the recommended initiatives.'
            )}
          </p>
        </div>
      </section>

      {readOnly && (
        <div className="mb-8 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('assessment.drdReport.readOnlyMode', 'Read-only mode.')}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-navy-700 pt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          {t('assessment.drdReport.footerGenerated', 'Report generated by Consultify')} •{' '}
          {new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB')}
        </p>
        <p className="mt-1">DRD • {companyName}</p>
      </footer>
    </div>
  );
};

export default DRDReportTemplate;
