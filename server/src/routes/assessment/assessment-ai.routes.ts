/**
 * Assessment AI Routes
 * API endpoints for AI-powered assessment features
 * Connects frontend useAssessmentAI hook to backend aiAssessmentPartnerService
 *
 * @see docs/modules/AI_ASSESSMENT_SYSTEM.md
 */

import { Request, Response, Router } from 'express';

import { aiAssessmentPartner } from '../../services/aiAssessmentPartnerService.js';
import { aiAssessmentFormHelper } from '../../services/aiAssessmentFormHelper.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
  };
}

// Helper to get assessment data from database (simplified)
async function getAssessmentData(projectId: string, organizationId: string): Promise<any> {
  // This would typically fetch from database
  // For now, return a basic structure that can be enhanced
  return {
    projectId,
    organizationId,
    axes: {},
  };
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
    logger.error('[AssessmentAI] Error suggesting justification:', err);
    res.status(500).json({ error: 'Failed to generate suggestion', message: err.message });
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
    logger.error('[AssessmentAI] Error suggesting evidence:', err);
    res.status(500).json({ error: 'Failed to generate evidence suggestions', message: err.message });
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

    const result = await aiAssessmentPartner.suggestTargetScore(axisId, currentScore, ambitionLevel);

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error suggesting target:', err);
    res.status(500).json({ error: 'Failed to generate target suggestion', message: err.message });
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
    logger.error('[AssessmentAI] Error correcting text:', err);
    res.status(500).json({ error: 'Failed to correct text', message: err.message });
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
    logger.error('[AssessmentAI] Error autocompleting:', err);
    res.status(500).json({ error: 'Failed to autocomplete', message: err.message });
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
    logger.error('[AssessmentAI] Error validating field:', err);
    res.status(500).json({ error: 'Failed to validate field', message: err.message });
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
    logger.error('[AssessmentAI] Error validating consistency:', err);
    res.status(500).json({ error: 'Failed to validate consistency', message: err.message });
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
    logger.error('[AssessmentAI] Error getting guidance:', err);
    res.status(500).json({ error: 'Failed to get guidance', message: err.message });
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
    logger.error('[AssessmentAI] Error generating gap analysis:', err);
    res.status(500).json({ error: 'Failed to generate gap analysis', message: err.message });
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
    logger.error('[AssessmentAI] Error generating insights:', err);
    res.status(500).json({ error: 'Failed to generate insights', message: err.message });
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
    logger.error('[AssessmentAI] Error getting clarifying question:', err);
    res.status(500).json({ error: 'Failed to get clarifying question', message: err.message });
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
    logger.error('[AssessmentAI] Error generating executive summary:', err);
    res.status(500).json({ error: 'Failed to generate executive summary', message: err.message });
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
    logger.error('[AssessmentAI] Error generating stakeholder view:', err);
    res.status(500).json({ error: 'Failed to generate stakeholder view', message: err.message });
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

    const result = await aiAssessmentPartner.generateBenchmarkCommentary(assessment, benchmarks || {}, {
      language,
      industry,
    });

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating benchmark commentary:', err);
    res.status(500).json({ error: 'Failed to generate benchmark commentary', message: err.message });
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
    logger.error('[AssessmentAI] Error generating initiatives:', err);
    res.status(500).json({ error: 'Failed to generate initiatives', message: err.message });
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
    logger.error('[AssessmentAI] Error prioritizing initiatives:', err);
    res.status(500).json({ error: 'Failed to prioritize initiatives', message: err.message });
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
    logger.error('[AssessmentAI] Error estimating ROI:', err);
    res.status(500).json({ error: 'Failed to estimate ROI', message: err.message });
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
    logger.error('[AssessmentAI] Error getting quick actions:', err);
    res.status(500).json({ error: 'Failed to get quick actions', message: err.message });
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
    logger.error('[AssessmentAI] Error getting contextual help:', err);
    res.status(500).json({ error: 'Failed to get contextual help', message: err.message });
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
    logger.error('[AssessmentAI] Error filling missing fields:', err);
    res.status(500).json({ error: 'Failed to fill missing fields', message: err.message });
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
    logger.error('[AssessmentAI] Error reviewing justifications:', err);
    res.status(500).json({ error: 'Failed to review justifications', message: err.message });
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
    const { aiAssessmentReportGenerator } = await import(
      '../../services/aiAssessmentReportGenerator.js'
    );

    const result = await aiAssessmentReportGenerator.generateFullReport(assessment, options);

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating full report:', err);
    res.status(500).json({ error: 'Failed to generate full report', message: err.message });
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

    const { aiAssessmentReportGenerator } = await import(
      '../../services/aiAssessmentReportGenerator.js'
    );

    const result = await aiAssessmentReportGenerator.generateStakeholderReport(
      assessment,
      stakeholderRole,
      options
    );

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating stakeholder report:', err);
    res.status(500).json({ error: 'Failed to generate stakeholder report', message: err.message });
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

    const { aiAssessmentReportGenerator } = await import(
      '../../services/aiAssessmentReportGenerator.js'
    );

    const result = await aiAssessmentReportGenerator.generateBenchmarkReport(
      assessment,
      benchmarks || {},
      options
    );

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating benchmark report:', err);
    res.status(500).json({ error: 'Failed to generate benchmark report', message: err.message });
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

    const { aiAssessmentReportGenerator } = await import(
      '../../services/aiAssessmentReportGenerator.js'
    );

    const result = await aiAssessmentReportGenerator.generateInitiativePlan(
      assessment,
      constraints || {},
      options
    );

    res.json(result);
  } catch (err: any) {
    logger.error('[AssessmentAI] Error generating initiative plan:', err);
    res.status(500).json({ error: 'Failed to generate initiative plan', message: err.message });
  }
});

/**
 * GET /api/assessment/:projectId/ai/reports/types
 * Get available report types
 */
router.get('/:projectId/ai/reports/types', async (_req: AuthRequest, res: Response) => {
  try {
    const { REPORT_TYPES, STAKEHOLDER_ROLES } = await import(
      '../../services/aiAssessmentReportGenerator.js'
    );

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
    logger.error('[AssessmentAI] Error getting report types:', err);
    res.status(500).json({ error: 'Failed to get report types', message: err.message });
  }
});

export default router;
