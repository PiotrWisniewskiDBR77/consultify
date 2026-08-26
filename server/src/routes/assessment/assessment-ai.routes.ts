/**
 * Assessment AI Routes
 * API endpoints for AI-powered assessment features
 * Connects frontend useAssessmentAI hook to backend aiAssessmentPartnerService
 *
 * @see docs/modules/AI_ASSESSMENT_SYSTEM.md
 */

import { Request, Response, Router } from 'express';

import { aiAssessmentFormHelper } from '../../services/aiAssessmentFormHelper.js';
import { aiAssessmentPartner } from '../../services/aiAssessmentPartnerService.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

interface AuthRequest extends Request {
  // Some environments in this repo treat params as `string | string[]`.
  // We normalize at runtime where needed; for routing this avoids noisy type errors.
  params: any;
  user?: {
    id: string;
    organizationId: string;
    role: string;
  };
}

class AssessmentLookupError extends Error {
  constructor(readonly kind: 'not_found' | 'source_unavailable') {
    super(kind);
  }
}

function sendAssessmentLookupError(res: Response, err: unknown): boolean {
  if (!(err instanceof AssessmentLookupError)) return false;
  if (err.kind === 'not_found') {
    res.status(404).json({
      error: 'Nie znaleziono oceny o podanym identyfikatorze.',
      code: 'ASSESSMENT_NOT_FOUND',
    });
  } else {
    res.status(503).json({
      error: 'Źródło danych oceny jest chwilowo niedostępne.',
      code: 'ASSESSMENT_SOURCE_UNAVAILABLE',
    });
  }
  return true;
}

/**
 * Helper to get assessment data from database.
 * Fetches assessment row + parsed answers/scores for AI processing.
 */
async function getAssessmentData(projectId: string, organizationId: string): Promise<any> {
  try {
    const row = await queryHelpers.queryOne<any>(
      `SELECT id, organization_id, assessment_type, name, status,
              completion_percent, confidence_avg,
              answers_json, context_snapshot, score_summary
       FROM assessments
       WHERE id = ? AND organization_id = ?`,
      [projectId, organizationId]
    );

    if (!row) {
      logger.warn(`[AssessmentAI] Assessment not found: ${projectId}`);
      throw new AssessmentLookupError('not_found');
    }

    const parseJson = (str: string | null | undefined, fallback: any = {}) => {
      if (!str) return fallback;
      try {
        return JSON.parse(str);
      } catch {
        return fallback;
      }
    };

    const answers = parseJson(row.answers_json, {});
    const contextSnapshot = parseJson(row.context_snapshot, {});
    const scoreSummary = parseJson(row.score_summary, {});

    // Build axes map from answers for AI partner service consumption
    // DRD answers: { drd: { areas: { "1A": { achievedLevel, targetLevel, ... } } } }
    // We also need to map to the axis-level format expected by partner service
    const axes: Record<string, { actual: number; target: number }> = {};

    if (answers?.drd?.areas) {
      // Map DRD area answers to axis-level averages
      const axisMapping: Record<string, string[]> = {
        processes: ['1A', '1B', '1C', '1D', '1E'],
        digitalProducts: ['2A', '2B', '2C', '2D', '2E'],
        businessModels: ['3A', '3B', '3C', '3D'],
        dataManagement: ['4A', '4B', '4C', '4D', '4E'],
        culture: ['5A', '5B', '5C', '5D', '5E'],
        cybersecurity: ['6A', '6B', '6C', '6D', '6E'],
        aiMaturity: ['7A', '7B', '7C', '7D', '7E'],
      };

      for (const [axisKey, areaIds] of Object.entries(axisMapping)) {
        const areaScores = areaIds
          .map((id) => answers.drd.areas[id])
          .filter((a: any) => a?.achievedLevel != null);

        if (areaScores.length > 0) {
          const avgActual =
            areaScores.reduce((sum: number, a: any) => sum + (a.achievedLevel || 0), 0) /
            areaScores.length;
          const avgTarget =
            areaScores.reduce(
              (sum: number, a: any) => sum + (a.targetLevel || a.achievedLevel || 0),
              0
            ) / areaScores.length;
          axes[axisKey] = {
            actual: Math.round(avgActual * 10) / 10,
            target: Math.round(avgTarget * 10) / 10,
          };
        }
      }
    }

    // For SIRI/ADMA — if score summary contains axis data, use it directly
    if (scoreSummary?.axes) {
      for (const [key, val] of Object.entries(scoreSummary.axes) as [string, any][]) {
        if (val?.actual != null) {
          axes[key] = { actual: val.actual, target: val.target || val.actual };
        }
      }
    }

    return {
      projectId,
      organizationId,
      id: row.id,
      name: row.name,
      assessmentType: row.assessment_type || 'DRD',
      status: row.status,
      completionPercent: row.completion_percent,
      confidenceAvg: row.confidence_avg,
      answers,
      contextSnapshot,
      scoreSummary,
      axes,
      industry: contextSnapshot?.industry || contextSnapshot?.organizationProfile?.industry,
      companySize: contextSnapshot?.companySize || contextSnapshot?.organizationProfile?.size,
    };
  } catch (err: any) {
    if (err instanceof AssessmentLookupError) throw err;
    logger.error(`[AssessmentAI] Error fetching assessment data: ${err.message}`);
    throw new AssessmentLookupError('source_unavailable');
  }
}

// =============================================================================
// FORM ASSISTANCE ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/suggest-justification
 * Generate AI suggestion for justification text
 */
router.post('/:projectId/ai/suggest-justification', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { axisId, score, existingJustification, language = 'pl' } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    logger.info(`[AssessmentAI] Suggesting justification for ${axisId}, score ${score}`);

    const result = await aiAssessmentPartner.suggestJustification(axisId, score, {
      existingJustification,
      language,
      organizationId,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error suggesting justification', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować sugestii',
      code: 'ASSESSMENT_AI_GENERATE_SUGGESTION_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/suggest-evidence
 * Suggest evidence/proof for a given score
 */
router.post('/:projectId/ai/suggest-evidence', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { axisId, score, language = 'pl' } = req.body;

    logger.info(`[AssessmentAI] Suggesting evidence for ${axisId}, score ${score}`);

    const result = await aiAssessmentPartner.suggestEvidence(axisId, score, { language });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error suggesting evidence', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować sugestii dowodów',
      code: 'ASSESSMENT_AI_GENERATE_EVIDENCE_SUGGESTIONS_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/suggest-target
 * Suggest target score based on current score and ambition level
 */
router.post('/:projectId/ai/suggest-target', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { axisId, currentScore, ambitionLevel = 'balanced' } = req.body;

    logger.info(`[AssessmentAI] Suggesting target for ${axisId}, current ${currentScore}`);

    const result = await aiAssessmentPartner.suggestTargetScore(
      axisId,
      currentScore,
      ambitionLevel
    );

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error suggesting target', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować sugestii celu',
      code: 'ASSESSMENT_AI_GENERATE_TARGET_SUGGESTION_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/correct-text
 * Correct and improve justification text
 */
router.post('/:projectId/ai/correct-text', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { text, targetLanguage = 'pl' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    logger.info(`[AssessmentAI] Correcting text, length: ${text.length}`);

    const result = await aiAssessmentPartner.correctJustificationLanguage(text, targetLanguage);

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error correcting text', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się poprawić tekstu', code: 'ASSESSMENT_AI_CORRECT_TEXT_FAILED' });
  }
});

/**
 * POST /api/assessment/:projectId/ai/autocomplete
 * Autocomplete partial justification text
 */
router.post('/:projectId/ai/autocomplete', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { partialText, axisId, score, language = 'pl' } = req.body;

    if (!partialText) {
      return res.status(400).json({ error: 'Partial text is required' });
    }

    logger.info(`[AssessmentAI] Autocompleting text for ${axisId}`);

    const result = await aiAssessmentPartner.autocompleteJustification(partialText, axisId, score, {
      language,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error autocompleting', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się uzupełnić automatycznie',
      code: 'ASSESSMENT_AI_AUTOCOMPLETE_FAILED',
    });
  }
});

// =============================================================================
// VALIDATION ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/validate-field
 * Validate a single field value with AI feedback
 */
router.post('/:projectId/ai/validate-field', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { fieldType, value, axisId, score } = req.body;

    logger.info(`[AssessmentAI] Validating field ${fieldType}`);

    // Use form helper for field validation
    const result = await aiAssessmentFormHelper.validateFieldValue(fieldType, value, {
      axisId,
      score,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error validating field', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zweryfikować pola',
      code: 'ASSESSMENT_AI_VALIDATE_FIELD_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/validate
 * Validate score consistency across all axes
 */
router.post('/:projectId/ai/validate', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data - in production this would come from database
    const assessment = req.body.assessment || (await getAssessmentData(projectId, organizationId));

    logger.info(`[AssessmentAI] Validating consistency for project ${projectId}`);

    const result = await aiAssessmentPartner.validateScoreConsistency(assessment);

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error validating consistency', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zweryfikować spójności',
      code: 'ASSESSMENT_AI_VALIDATE_CONSISTENCY_FAILED',
    });
  }
});

// =============================================================================
// ANALYSIS ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/guidance
 * Get contextual guidance for an axis
 */
router.post('/:projectId/ai/guidance', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { axisId, currentScore, targetScore } = req.body;

    logger.info(`[AssessmentAI] Getting guidance for ${axisId}`);

    const result = await aiAssessmentPartner.getAssessmentGuidance(
      axisId,
      currentScore,
      targetScore || currentScore + 1
    );

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error getting guidance', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się pobrać wskazówek', code: 'ASSESSMENT_AI_GET_GUIDANCE_FAILED' });
  }
});

/**
 * POST /api/assessment/:projectId/ai/gap/:axisId
 * Generate gap analysis for a specific axis
 */
router.post('/:projectId/ai/gap/:axisId', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, axisId } = req.params;
    const { currentScore, targetScore, justification } = req.body;

    logger.info(`[AssessmentAI] Generating gap analysis for ${axisId}`);

    const result = await aiAssessmentPartner.generateGapAnalysis(
      axisId,
      currentScore,
      targetScore,
      justification
    );

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating gap analysis', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować analizy luk',
      code: 'ASSESSMENT_AI_GENERATE_GAP_ANALYSIS_FAILED',
    });
  }
});

/**
 * GET /api/assessment/:projectId/ai/insights
 * Get proactive insights based on assessment data
 */
router.get('/:projectId/ai/insights', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Generating insights for project ${projectId}`);

    const result = await aiAssessmentPartner.generateProactiveInsights(assessment);

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating insights', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować wniosków',
      code: 'ASSESSMENT_AI_GENERATE_INSIGHTS_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/clarify
 * Get a clarifying question for a score
 */
router.post('/:projectId/ai/clarify', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { axisId, score } = req.body;

    logger.info(`[AssessmentAI] Getting clarifying question for ${axisId}`);

    const result = await aiAssessmentPartner.askClarifyingQuestion(axisId, score);

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error getting clarifying question', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać pytania doprecyzowującego',
      code: 'ASSESSMENT_AI_GET_CLARIFYING_QUESTION_FAILED',
    });
  }
});

// =============================================================================
// REPORT GENERATION ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/executive-summary
 * Generate executive summary from assessment
 */
router.post('/:projectId/ai/executive-summary', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { language = 'pl', organizationName, industry } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = req.body.assessment || (await getAssessmentData(projectId, organizationId));

    logger.info(`[AssessmentAI] Generating executive summary for project ${projectId}`);

    const result = await aiAssessmentPartner.generateExecutiveSummary(assessment, {
      language,
      organizationName,
      industry,
    });

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating executive summary', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować podsumowania zarządczego',
      code: 'ASSESSMENT_AI_GENERATE_EXECUTIVE_SUMMARY_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/stakeholder-view
 * Generate stakeholder-specific view
 */
router.post('/:projectId/ai/stakeholder-view', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { stakeholderRole, language = 'pl', organizationName } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    if (!stakeholderRole) {
      return res.status(400).json({ error: 'Stakeholder role is required' });
    }

    // Get assessment data
    const assessment = req.body.assessment || (await getAssessmentData(projectId, organizationId));

    logger.info(`[AssessmentAI] Generating ${stakeholderRole} view for project ${projectId}`);

    const result = await aiAssessmentPartner.generateStakeholderView(assessment, stakeholderRole, {
      language,
      organizationName,
    });

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating stakeholder view', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować widoku dla interesariuszy',
      code: 'ASSESSMENT_AI_GENERATE_STAKEHOLDER_VIEW_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/benchmark-commentary
 * Generate benchmark comparison commentary
 */
router.post('/:projectId/ai/benchmark-commentary', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { benchmarks, language = 'pl', industry } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = req.body.assessment || (await getAssessmentData(projectId, organizationId));

    logger.info(`[AssessmentAI] Generating benchmark commentary for project ${projectId}`);

    const result = await aiAssessmentPartner.generateBenchmarkCommentary(
      assessment,
      benchmarks || {},
      {
        language,
        industry,
      }
    );

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating benchmark commentary', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować komentarza benchmarkowego',
      code: 'ASSESSMENT_AI_GENERATE_BENCHMARK_COMMENTARY_FAILED',
    });
  }
});

// =============================================================================
// INITIATIVE SUPPORT ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/generate-initiatives
 * Generate transformation initiatives from gap analysis
 */
router.post('/:projectId/ai/generate-initiatives', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { gapAnalysis, budget, timeline, resources, language = 'pl' } = req.body;

    logger.info(`[AssessmentAI] Generating initiatives for project ${projectId}`);

    // If no gap analysis provided, generate basic one from assessment
    const gaps = gapAnalysis || [];

    const result = await aiAssessmentPartner.generateInitiativesFromGaps(gaps, {
      budget,
      timeline,
      resources,
      language,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating initiatives', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować inicjatyw',
      code: 'ASSESSMENT_AI_GENERATE_INITIATIVES_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/prioritize-initiatives
 * Prioritize a list of initiatives
 */
router.post('/:projectId/ai/prioritize-initiatives', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { initiatives, criteria } = req.body;

    if (!initiatives || !Array.isArray(initiatives)) {
      return res.status(400).json({ error: 'Initiatives array is required' });
    }

    logger.info(`[AssessmentAI] Prioritizing ${initiatives.length} initiatives`);

    const result = await aiAssessmentPartner.prioritizeInitiatives(initiatives, criteria || {});

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error prioritizing initiatives', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się ustalić priorytetów inicjatyw',
      code: 'ASSESSMENT_AI_PRIORITIZE_INITIATIVES_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/estimate-roi
 * Estimate ROI for an initiative
 */
router.post('/:projectId/ai/estimate-roi', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { initiative, companySize, industry, revenue } = req.body;

    if (!initiative) {
      return res.status(400).json({ error: 'Initiative data is required' });
    }

    logger.info(`[AssessmentAI] Estimating ROI for initiative: ${initiative.name}`);

    const result = await aiAssessmentPartner.estimateInitiativeROI(initiative, {
      companySize,
      industry,
      revenue,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error estimating ROI', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res
      .status(500)
      .json({ error: 'Nie udało się oszacować ROI', code: 'ASSESSMENT_AI_ESTIMATE_ROI_FAILED' });
  }
});

// =============================================================================
// FORM HELPER ENDPOINTS
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/quick-actions
 * Get quick actions for current form state
 */
router.post('/:projectId/ai/quick-actions', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const formState = req.body;

    logger.info(`[AssessmentAI] Getting quick actions for project ${projectId}`);

    const result = await aiAssessmentFormHelper.getQuickActions(formState);

    res.json({ actions: result });
  } catch (err: any) {
    logger.error('[AssessmentAI] Error getting quick actions', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać szybkich akcji',
      code: 'ASSESSMENT_AI_GET_QUICK_ACTIONS_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/contextual-help
 * Get contextual help for current form state
 */
router.post('/:projectId/ai/contextual-help', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const formState = req.body;

    logger.info(`[AssessmentAI] Getting contextual help for project ${projectId}`);

    const result = await aiAssessmentFormHelper.getContextualHelp(formState);

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error getting contextual help', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać pomocy kontekstowej',
      code: 'ASSESSMENT_AI_GET_CONTEXTUAL_HELP_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/fill-missing
 * Fill missing fields with AI suggestions
 */
router.post('/:projectId/ai/fill-missing', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { strategy = 'suggest-only' } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Filling missing fields with strategy: ${strategy}`);

    const result = await aiAssessmentFormHelper.fillMissingFields(assessment, strategy);

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error filling missing fields', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się uzupełnić brakujących pól',
      code: 'ASSESSMENT_AI_FILL_MISSING_FIELDS_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/review-justifications
 * Review all justifications for quality
 */
router.post('/:projectId/ai/review-justifications', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { language = 'pl' } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Reviewing justifications for project ${projectId}`);

    const result = await aiAssessmentFormHelper.reviewAllJustifications(assessment, { language });

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error reviewing justifications', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zweryfikować uzasadnień',
      code: 'ASSESSMENT_AI_REVIEW_JUSTIFICATIONS_FAILED',
    });
  }
});

// =============================================================================
// REPORT GENERATOR ENDPOINTS (Advanced)
// =============================================================================

/**
 * POST /api/assessment/:projectId/ai/reports/full
 * Generate full comprehensive report
 */
router.post('/:projectId/ai/reports/full', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const options = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Generating full report for project ${projectId}`);

    // Import report generator dynamically
    const { aiAssessmentReportGenerator } =
      await import('../../services/aiAssessmentReportGenerator.js');

    const result = await aiAssessmentReportGenerator.generateFullReport(assessment, options);

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating full report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować pełnego raportu',
      code: 'ASSESSMENT_AI_GENERATE_FULL_REPORT_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/reports/stakeholder
 * Generate stakeholder-specific report
 */
router.post('/:projectId/ai/reports/stakeholder', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { stakeholderRole, ...options } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    if (!stakeholderRole) {
      return res.status(400).json({ error: 'Stakeholder role is required' });
    }

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Generating ${stakeholderRole} report for project ${projectId}`);

    const { aiAssessmentReportGenerator } =
      await import('../../services/aiAssessmentReportGenerator.js');

    const result = await aiAssessmentReportGenerator.generateStakeholderReport(
      assessment,
      stakeholderRole,
      options
    );

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating stakeholder report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować raportu dla interesariuszy',
      code: 'ASSESSMENT_AI_GENERATE_STAKEHOLDER_REPORT_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/reports/benchmark
 * Generate benchmark comparison report
 */
router.post('/:projectId/ai/reports/benchmark', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { benchmarks, ...options } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Generating benchmark report for project ${projectId}`);

    const { aiAssessmentReportGenerator } =
      await import('../../services/aiAssessmentReportGenerator.js');

    const result = await aiAssessmentReportGenerator.generateBenchmarkReport(
      assessment,
      benchmarks || {},
      options
    );

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating benchmark report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować raportu benchmarkowego',
      code: 'ASSESSMENT_AI_GENERATE_BENCHMARK_REPORT_FAILED',
    });
  }
});

/**
 * POST /api/assessment/:projectId/ai/reports/initiative-plan
 * Generate initiative plan with timeline
 */
router.post('/:projectId/ai/reports/initiative-plan', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { constraints, ...options } = req.body;
    const organizationId = req.user?.organizationId || 'org-default';

    // Get assessment data
    const assessment = await getAssessmentData(projectId, organizationId);

    logger.info(`[AssessmentAI] Generating initiative plan for project ${projectId}`);

    const { aiAssessmentReportGenerator } =
      await import('../../services/aiAssessmentReportGenerator.js');

    const result = await aiAssessmentReportGenerator.generateInitiativePlan(
      assessment,
      constraints || {},
      options
    );

    res.json(result);
  } catch (err: any) {
    if (sendAssessmentLookupError(res, err)) return;
    logger.error('[AssessmentAI] Error generating initiative plan', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować planu inicjatywy',
      code: 'ASSESSMENT_AI_GENERATE_INITIATIVE_PLAN_FAILED',
    });
  }
});

/**
 * GET /api/assessment/:projectId/ai/reports/types
 * Get available report types
 */
router.get('/:projectId/ai/reports/types', async (_req: AuthRequest, res: Response) => {
  try {
    const { REPORT_TYPES, STAKEHOLDER_ROLES } =
      await import('../../services/aiAssessmentReportGenerator.js');

    res.json({
      reportTypes: REPORT_TYPES || {
        EXECUTIVE_SUMMARY: 'executive_summary',
        FULL_ASSESSMENT: 'full_assessment',
        STAKEHOLDER_VIEW: 'stakeholder_view',
        BENCHMARK_COMPARISON: 'benchmark_comparison',
        GAP_ANALYSIS: 'gap_analysis',
        TRANSFORMATION_ROADMAP: 'transformation_roadmap',
        INITIATIVE_PLAN: 'initiative_plan',
      },
      stakeholderRoles: STAKEHOLDER_ROLES || {
        CTO: 'CTO',
        CFO: 'CFO',
        COO: 'COO',
        CEO: 'CEO',
        BOARD: 'BOARD',
        PROJECT_MANAGER: 'PROJECT_MANAGER',
        CONSULTANT: 'CONSULTANT',
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentAI] Error getting report types', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać typów raportów',
      code: 'ASSESSMENT_AI_GET_REPORT_TYPES_FAILED',
    });
  }
});

export default router;
