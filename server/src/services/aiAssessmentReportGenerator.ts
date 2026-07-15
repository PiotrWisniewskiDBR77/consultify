/**
 * aiAssessmentReportGenerator
 *
 * Generates comprehensive assessment reports using AI.
 * Delegates to aiAssessmentPartnerService for LLM calls (Gemini).
 *
 * Report Types:
 * - full: Comprehensive assessment report with all axes
 * - stakeholder: Stakeholder-specific view (CTO, CFO, COO, CEO, BOARD)
 * - benchmark: Benchmark comparison report
 * - initiativePlan: Initiative plan with timeline and budget
 */

import logger from '../utils/Logger.js';
import { aiAssessmentPartner, DRD_AXES } from './aiAssessmentPartnerService.js';
import {
  deriveConfidence,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidence/evidenceContract.js';

// ==========================================
// CONSTANTS
// ==========================================

export const REPORT_TYPES = {
  full: 'full',
  stakeholder: 'stakeholder',
  benchmark: 'benchmark',
  initiativePlan: 'initiative_plan',
} as const;

export const STAKEHOLDER_ROLES = {
  CTO: 'CTO',
  CFO: 'CFO',
  COO: 'COO',
  CEO: 'CEO',
  BOARD: 'BOARD',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  CONSULTANT: 'CONSULTANT',
} as const;

// ==========================================
// HELPER: extract axis scores from assessment
// ==========================================

function extractScores(assessment: any): Array<{
  axis: string;
  name: string;
  actual: number;
  target: number;
  gap: number;
}> {
  const scores: Array<{
    axis: string;
    name: string;
    actual: number;
    target: number;
    gap: number;
  }> = [];

  // If assessment already has an axes map (from getAssessmentData)
  if (assessment?.axes) {
    for (const [key, val] of Object.entries(assessment.axes) as [string, any][]) {
      if (val?.actual != null) {
        const target = val.target || val.actual;
        scores.push({
          axis: key,
          name: (DRD_AXES as any)[key]?.name || key,
          actual: val.actual,
          target,
          gap: target - val.actual,
        });
      }
    }
  }

  // If assessment has direct axis properties (legacy format)
  if (scores.length === 0) {
    for (const [key, val] of Object.entries(assessment) as [string, any][]) {
      if (val?.actual != null && (DRD_AXES as any)[key]) {
        const target = val.target || val.actual;
        scores.push({
          axis: key,
          name: (DRD_AXES as any)[key].name,
          actual: val.actual,
          target,
          gap: target - val.actual,
        });
      }
    }
  }

  return scores;
}

// ==========================================
// HP-16: EvidenceContract — DETERMINISTYCZNIE, zero LLM, zero I/O
// ==========================================

/**
 * Buduje `EvidenceContract` sekcji raportu oceny (DRD/SIRI/ADMA) z REALNYCH sygnałów:
 *  - `sources` = same wynikowe osie/wymiary oceny (`extractScores`) faktycznie użyte do
 *    zbudowania promptu tej sekcji — nie zgadywanie, tylko liczby, które i tak trafiły do
 *    modelu.
 *  - `mode` ('AI_GENERATED' | 'FALLBACK') pochodzi wprost z `aiAssessmentPartnerService`
 *    (KAŻDA metoda partnera zwraca ten deterministyczny znacznik) — 'FALLBACK' = model
 *    niedostępny/błąd → sekcja to szablon, nie analiza AI. To realny sygnał, nie LLM-owa
 *    samoocena.
 */
export function buildScoreBasedEvidenceContract(
  assessment: Record<string, any>,
  scores: Array<{ axis: string; name: string; actual: number; target?: number; gap?: number }>,
  opts: {
    mode?: string;
    extraRisks?: string[];
    extraToVerify?: string[];
    extraUnresolvedGaps?: number;
  } = {}
): EvidenceContract {
  const assessmentRef = String(assessment?.projectId || assessment?.id || 'assessment');
  const sources: EvidenceContractSource[] = [
    {
      type: 'assessment',
      ref: assessmentRef,
      title: assessment?.name ? String(assessment.name) : undefined,
    },
    ...scores.map((s) => ({ type: 'assessment_axis', ref: s.axis, title: s.name })),
  ];

  const risks: string[] = [...(opts.extraRisks || [])];
  if (opts.mode === 'FALLBACK') {
    risks.push(
      'Sekcja wygenerowana deterministycznym fallbackiem (AI niedostępne) — brak narracji modelu.'
    );
  }

  const toVerify: string[] = [...(opts.extraToVerify || [])];

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    unresolvedGaps: (opts.mode === 'FALLBACK' ? 1 : 0) + (opts.extraUnresolvedGaps || 0),
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

// ==========================================
// REPORT GENERATOR
// ==========================================

export const aiAssessmentReportGenerator = {
  /**
   * Generate a full comprehensive assessment report.
   * Combines executive summary, gap analysis per axis, and proactive insights.
   */
  async generateFullReport(assessment: any, options: any = {}) {
    try {
      logger.info('[AIReportGenerator] Generating full report');
      const scores = extractScores(assessment);

      if (scores.length === 0) {
        return {
          status: 'no_data',
          report: null,
          message: 'No assessment data available. Complete the assessment first.',
        };
      }

      // Run parallel AI calls for the different sections
      const [executiveSummary, insights, gapAnalyses] = await Promise.all([
        aiAssessmentPartner.generateExecutiveSummary(assessment, {
          language: options.language || 'en',
          organizationName: options.organizationName || assessment.name,
          industry: options.industry || assessment.industry,
        }),
        aiAssessmentPartner.generateProactiveInsights(assessment),
        // Generate gap analysis for the top 3 axes by gap size
        Promise.all(
          [...scores]
            .sort((a, b) => b.gap - a.gap)
            .slice(0, 3)
            .filter((s) => s.gap > 0)
            .map((s) =>
              aiAssessmentPartner.generateGapAnalysis(
                s.axis,
                Math.round(s.actual),
                Math.round(s.target)
              )
            )
        ),
      ]);

      const avgActual = scores.reduce((sum, s) => sum + s.actual, 0) / scores.length;
      const avgTarget = scores.reduce((sum, s) => sum + s.target, 0) / scores.length;

      // HP-16: realny EvidenceContract — sources=osie użyte w promptach, mode=realny
      // znacznik AI_GENERATED/FALLBACK z aiAssessmentPartnerService, toVerify=osie bez
      // szczegółowej analizy luki (tylko top-3 wg wielkości luki dostają gapAnalysis).
      const gapAnalysesNoAiRecs = (gapAnalyses as any[]).filter(
        (g) => Array.isArray(g?.aiRecommendations) && g.aiRecommendations.length === 0
      ).length;
      const uncoveredAxes = scores.length - (gapAnalyses as any[]).length;
      const evidence = buildScoreBasedEvidenceContract(assessment, scores, {
        mode: (executiveSummary as any)?.mode,
        extraRisks:
          gapAnalysesNoAiRecs > 0
            ? [
                `${gapAnalysesNoAiRecs} analiz(y) luki bez rekomendacji AI (model niedostępny lub błąd generacji).`,
              ]
            : [],
        extraToVerify:
          uncoveredAxes > 0
            ? [
                `${uncoveredAxes}/${scores.length} osi bez szczegółowej analizy luki (pokazano tylko top 3 wg wielkości luki).`,
              ]
            : [],
        extraUnresolvedGaps: gapAnalysesNoAiRecs,
      });

      return {
        status: 'success',
        report: {
          type: 'full',
          generatedAt: new Date().toISOString(),
          assessmentId: assessment.projectId || assessment.id,
          assessmentName: assessment.name,
          executiveSummary: executiveSummary.summary || executiveSummary,
          metrics: {
            averageMaturity: Number(avgActual.toFixed(1)),
            averageTarget: Number(avgTarget.toFixed(1)),
            overallGap: Number((avgTarget - avgActual).toFixed(1)),
            axesAssessed: scores.length,
          },
          scores: scores.map((s) => ({
            axis: s.axis,
            name: s.name,
            actual: s.actual,
            target: s.target,
            gap: s.gap,
          })),
          insights: insights.insights || [],
          gapAnalyses,
          topStrengths: executiveSummary.topStrengths || [],
          priorityGaps: executiveSummary.priorityGaps || [],
          evidence,
        },
      };
    } catch (err: any) {
      logger.error('[AIReportGenerator] Error generating full report:', err);
      return {
        status: 'error',
        report: null,
        error: err.message,
      };
    }
  },

  /**
   * Generate a stakeholder-specific report.
   * Tailored to CTO, CFO, COO, CEO, or BOARD perspective.
   */
  async generateStakeholderReport(assessment: any, role: string, options: any = {}) {
    try {
      logger.info(`[AIReportGenerator] Generating ${role} stakeholder report`);
      const scores = extractScores(assessment);

      if (scores.length === 0) {
        return {
          status: 'no_data',
          report: null,
          message: 'No assessment data available.',
        };
      }

      const stakeholderView = await aiAssessmentPartner.generateStakeholderView(assessment, role, {
        language: options.language || 'en',
        organizationName: options.organizationName || assessment.name,
      });

      const avgActual = scores.reduce((sum, s) => sum + s.actual, 0) / scores.length;

      const evidence = buildScoreBasedEvidenceContract(assessment, scores, {
        mode: stakeholderView.mode,
      });

      return {
        status: 'success',
        report: {
          type: 'stakeholder',
          stakeholderRole: role,
          generatedAt: new Date().toISOString(),
          assessmentId: assessment.projectId || assessment.id,
          view: stakeholderView.view || stakeholderView,
          focusAreas: stakeholderView.focusAreas,
          metrics: {
            averageMaturity: Number(avgActual.toFixed(1)),
            axesAssessed: scores.length,
          },
          mode: stakeholderView.mode || 'AI_GENERATED',
          evidence,
        },
      };
    } catch (err: any) {
      logger.error('[AIReportGenerator] Error generating stakeholder report:', err);
      return { status: 'error', report: null, error: err.message };
    }
  },

  /**
   * Generate a benchmark comparison report.
   */
  async generateBenchmarkReport(assessment: any, benchmarks: any = {}, options: any = {}) {
    try {
      logger.info('[AIReportGenerator] Generating benchmark report');
      const scores = extractScores(assessment);

      if (scores.length === 0) {
        return {
          status: 'no_data',
          report: null,
          message: 'No assessment data available.',
        };
      }

      const commentary = await aiAssessmentPartner.generateBenchmarkCommentary(
        assessment,
        benchmarks,
        {
          language: options.language || 'en',
          industry: options.industry || assessment.industry,
        }
      );

      // HP-16: realny sygnał — ile ocenionych osi NIE ma danych benchmarkowych (real gap
      // w danych wejściowych, nie zgadywanie).
      const axesWithoutBenchmark = scores.filter((s) => !benchmarks?.[s.axis]).length;
      const evidence = buildScoreBasedEvidenceContract(assessment, scores, {
        mode: commentary.mode,
        extraRisks:
          axesWithoutBenchmark > 0
            ? [`${axesWithoutBenchmark}/${scores.length} osi bez danych benchmarkowych — porównanie częściowe.`]
            : [],
        extraUnresolvedGaps: axesWithoutBenchmark,
      });

      return {
        status: 'success',
        report: {
          type: 'benchmark',
          generatedAt: new Date().toISOString(),
          assessmentId: assessment.projectId || assessment.id,
          commentary: commentary.commentary,
          summary: commentary.summary,
          detailedComparison: commentary.detailedComparison,
          mode: commentary.mode || 'AI_GENERATED',
          evidence,
        },
      };
    } catch (err: any) {
      logger.error('[AIReportGenerator] Error generating benchmark report:', err);
      return { status: 'error', report: null, error: err.message };
    }
  },

  /**
   * Generate an initiative plan with timeline and budget estimates.
   * Combines gap analysis with initiative generation and prioritization.
   */
  async generateInitiativePlan(assessment: any, constraints: any = {}, options: any = {}) {
    try {
      logger.info('[AIReportGenerator] Generating initiative plan');
      const scores = extractScores(assessment);

      if (scores.length === 0) {
        return {
          status: 'no_data',
          plan: null,
          message: 'No assessment data available.',
        };
      }

      // Build gap analysis input for initiative generation
      const gapAnalysis = scores
        .filter((s) => s.gap > 0)
        .sort((a, b) => b.gap - a.gap)
        .map((s) => ({
          axis: s.axis,
          axisName: s.name,
          currentScore: Math.round(s.actual),
          targetScore: Math.round(s.target),
          gap: s.gap,
        }));

      // Generate initiatives from gaps
      const initiativeResult = await aiAssessmentPartner.generateInitiativesFromGaps(gapAnalysis, {
        budget: constraints.budget,
        timeline: constraints.timeline || '12 months',
        resources: constraints.resources,
        language: options.language || 'en',
      });

      const initiatives = initiativeResult.initiatives || [];

      // Prioritize the generated initiatives
      let prioritized = null;
      if (initiatives.length > 0) {
        prioritized = await aiAssessmentPartner.prioritizeInitiatives(
          initiatives,
          constraints.criteria || {}
        );
      }

      // HP-16: sources = TYLKO osie z gap>0 faktycznie wysłane do generateInitiativesFromGaps
      // (nie wszystkie ocenione osie — plan opiera się wyłącznie na lukach).
      const evidence = buildScoreBasedEvidenceContract(
        assessment,
        gapAnalysis.map((g) => ({ axis: g.axis, name: g.axisName, actual: g.currentScore, target: g.targetScore, gap: g.gap })),
        {
          mode: initiativeResult.mode,
          extraToVerify:
            initiatives.length === 0
              ? ['Brak wygenerowanych inicjatyw z luk — plan pusty, zweryfikuj dane wejściowe.']
              : [],
          extraUnresolvedGaps: initiatives.length === 0 ? 1 : 0,
        }
      );

      return {
        status: 'success',
        plan: {
          type: 'initiative_plan',
          generatedAt: new Date().toISOString(),
          assessmentId: assessment.projectId || assessment.id,
          gaps: gapAnalysis,
          initiatives,
          prioritizedList: prioritized?.prioritizedList || [],
          constraints,
          mode: initiativeResult.mode || 'AI_GENERATED',
          evidence,
        },
      };
    } catch (err: any) {
      logger.error('[AIReportGenerator] Error generating initiative plan:', err);
      return { status: 'error', plan: null, error: err.message };
    }
  },
} as const;

export default aiAssessmentReportGenerator;
