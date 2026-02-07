/**
 * AIAssessmentFormHelper Service
 *
 * Provides AI-powered assistance for assessment form completion:
 * - Field validation with AI feedback
 * - AI suggestions for form fields
 * - Quick actions for current form context
 * - Contextual help for fields/axes
 * - Fill missing fields with AI suggestions
 * - Review all justifications for quality
 *
 * Delegates to aiAssessmentPartnerService for LLM calls (Gemini).
 */

import { aiAssessmentPartner, DRD_AXES } from './aiAssessmentPartnerService.js';

import logger from '../utils/Logger.js';

// Field types for assessment forms
export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  SCALE: 'scale',
  BOOLEAN: 'boolean',
  DATE: 'date',
  TEXTAREA: 'textarea',
};

// Validation rules
export const VALIDATION_RULES = {
  REQUIRED: 'required',
  MIN: 'min',
  MAX: 'max',
  PATTERN: 'pattern',
  EMAIL: 'email',
  URL: 'url',
};

/**
 * AIAssessmentFormHelper class
 * Helps with AI-assisted assessment form generation and validation
 */
export class AIAssessmentFormHelper {
  fieldTypes: typeof FIELD_TYPES;
  validationRules: typeof VALIDATION_RULES;

  constructor() {
    this.fieldTypes = FIELD_TYPES;
    this.validationRules = VALIDATION_RULES;
  }

  /**
   * Generate form fields based on assessment type
   */
  async generateFormFields(assessmentType: string, options: any = {}) {
    logger.info(`[AIAssessmentFormHelper] generateFormFields for: ${assessmentType}`);

    const axes = DRD_AXES as any;
    const fields: any[] = [];

    // Generate fields based on the DRD structure (primary framework)
    for (const [axisId, axis] of Object.entries(axes) as [string, any][]) {
      fields.push({
        id: `${axisId}_score`,
        label: axis.name,
        description: axis.description,
        type: FIELD_TYPES.SCALE,
        min: 1,
        max: 7,
        validation: [VALIDATION_RULES.REQUIRED, VALIDATION_RULES.MIN, VALIDATION_RULES.MAX],
        axisId,
      });
      fields.push({
        id: `${axisId}_justification`,
        label: `${axis.name} — Justification`,
        description: `Evidence and reasoning for the ${axis.name} score`,
        type: FIELD_TYPES.TEXTAREA,
        validation: [VALIDATION_RULES.REQUIRED],
        axisId,
      });
      fields.push({
        id: `${axisId}_target`,
        label: `${axis.name} — Target`,
        description: `Target maturity level for ${axis.name}`,
        type: FIELD_TYPES.SCALE,
        min: 1,
        max: 7,
        validation: [],
        axisId,
      });
    }

    return fields;
  }

  /**
   * Validate form data — checks structure and uses AI for justification quality
   */
  async validateFormData(formData: any, schema: any) {
    logger.info('[AIAssessmentFormHelper] validateFormData');

    const errors: any[] = [];

    // Structural validation
    if (formData?.axes) {
      for (const [axisId, data] of Object.entries(formData.axes) as [string, any][]) {
        if (data?.actual != null) {
          if (data.actual < 1 || data.actual > 7) {
            errors.push({
              field: `${axisId}_score`,
              message: `Score for ${axisId} must be between 1 and 7`,
              severity: 'error',
            });
          }
          if (data.target != null && data.target < data.actual) {
            errors.push({
              field: `${axisId}_target`,
              message: `Target for ${axisId} should be >= current score`,
              severity: 'warning',
            });
          }
        }
      }
    }

    // Use AI partner for cross-axis consistency
    try {
      const consistency = await aiAssessmentPartner.validateScoreConsistency(
        formData?.axes || formData
      );
      if (consistency.hasInconsistencies) {
        for (const issue of consistency.inconsistencies) {
          errors.push({
            field: issue.axes?.join(', ') || 'cross-axis',
            message: issue.message,
            suggestion: issue.suggestion,
            severity: 'warning',
            type: issue.type,
          });
        }
      }
    } catch (err: any) {
      logger.warn('[AIAssessmentFormHelper] AI consistency check failed:', err.message);
    }

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
    };
  }

  /**
   * Get AI suggestions for form completion (per field)
   */
  async getAISuggestions(fieldId: string, context: any = {}) {
    logger.info(`[AIAssessmentFormHelper] getAISuggestions for: ${fieldId}`);

    const { axisId, score, language } = context;

    // For justification fields — use partner to suggest
    if (fieldId.includes('justification') && axisId) {
      try {
        const result = await aiAssessmentPartner.suggestJustification(axisId, score || 1, {
          language: language || 'en',
          industry: context.industry,
          companySize: context.companySize,
          existingJustification: context.existingText,
        });
        return [
          {
            type: 'justification',
            text: result.suggestion,
            mode: result.mode,
          },
        ];
      } catch (err: any) {
        logger.warn('[AIAssessmentFormHelper] Justification suggestion failed:', err.message);
        return [];
      }
    }

    // For evidence fields — suggest evidence types
    if (fieldId.includes('evidence') && axisId) {
      try {
        const result = await aiAssessmentPartner.suggestEvidence(axisId, score || 1, {
          language: language || 'en',
          industry: context.industry,
        });
        return (result.evidence || []).map((e: string) => ({
          type: 'evidence',
          text: e,
          mode: result.mode,
        }));
      } catch (err: any) {
        logger.warn('[AIAssessmentFormHelper] Evidence suggestion failed:', err.message);
        return [];
      }
    }

    // For target fields — suggest target score
    if (fieldId.includes('target') && axisId) {
      try {
        const result = await aiAssessmentPartner.suggestTargetScore(
          axisId,
          score || 1,
          context.ambitionLevel || 'balanced'
        );
        return [
          {
            type: 'target',
            suggestedTarget: result.suggestedTarget,
            reasoning: result.reasoning,
            timeEstimate: result.timeEstimate,
          },
        ];
      } catch (err: any) {
        logger.warn('[AIAssessmentFormHelper] Target suggestion failed:', err.message);
        return [];
      }
    }

    return [];
  }

  /**
   * Validate a single field value (used by assessment-ai routes)
   */
  async validateFieldValue(fieldId: string, value: any, schema: any) {
    logger.info(`[AIAssessmentFormHelper] validateFieldValue: ${fieldId}`);

    const errors: any[] = [];
    const { axisId, score } = schema || {};

    // Score field validation
    if (fieldId === 'score' || fieldId === FIELD_TYPES.SCALE) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 1 || numValue > 7) {
        errors.push({ field: fieldId, message: 'Score must be between 1 and 7' });
      }
    }

    // Justification field validation — check minimum length and quality
    if (fieldId === 'justification' || fieldId === FIELD_TYPES.TEXTAREA) {
      if (typeof value === 'string') {
        if (value.trim().length < 20) {
          errors.push({
            field: fieldId,
            message: 'Justification should be at least 20 characters for meaningful assessment',
            severity: 'warning',
          });
        }
        if (value.trim().length > 0 && value.trim().length < 50) {
          // Suggest improvement via AI
          try {
            const suggestion = await aiAssessmentPartner.suggestJustification(
              axisId || 'processes',
              score || 1,
              { existingJustification: value, language: 'en' }
            );
            if (suggestion.suggestion) {
              errors.push({
                field: fieldId,
                message: 'Consider expanding your justification with more detail.',
                severity: 'info',
                suggestion: suggestion.suggestion,
              });
            }
          } catch {
            // Ignore AI failure for validation
          }
        }
      }
    }

    return { valid: errors.filter((e) => e.severity === 'error').length === 0, errors };
  }

  /**
   * Get quick actions for current assessment context
   */
  async getQuickActions(context: any = {}) {
    logger.info('[AIAssessmentFormHelper] getQuickActions');

    const actions: any[] = [];
    const { assessmentType, completionPercent, status, axes } = context;

    // Action: Complete empty fields
    const hasEmptyFields = !axes || Object.keys(axes).length < 7;
    if (hasEmptyFields) {
      actions.push({
        id: 'fill-missing',
        label: 'AI: Fill Missing Fields',
        description: 'Let AI suggest scores and justifications for incomplete axes',
        icon: 'sparkles',
        action: 'fill-missing',
        priority: 'high',
      });
    }

    // Action: Validate consistency
    if (axes && Object.keys(axes).length >= 3) {
      actions.push({
        id: 'validate-consistency',
        label: 'AI: Check Consistency',
        description: 'Validate score consistency across all axes',
        icon: 'check-circle',
        action: 'validate',
        priority: 'medium',
      });
    }

    // Action: Generate executive summary
    if (completionPercent && completionPercent >= 80) {
      actions.push({
        id: 'executive-summary',
        label: 'AI: Generate Executive Summary',
        description: 'Create an AI-powered executive summary of your assessment',
        icon: 'file-text',
        action: 'executive-summary',
        priority: 'medium',
      });
    }

    // Action: Review justifications
    if (completionPercent && completionPercent >= 50) {
      actions.push({
        id: 'review-justifications',
        label: 'AI: Review Justifications',
        description: 'AI review of all justification texts for quality and completeness',
        icon: 'message-square',
        action: 'review-justifications',
        priority: 'low',
      });
    }

    // Action: Gap analysis
    if (axes && Object.values(axes).some((a: any) => a?.target && a?.actual && a.target > a.actual)) {
      actions.push({
        id: 'gap-analysis',
        label: 'AI: Gap Analysis',
        description: 'Analyze gaps between current and target maturity levels',
        icon: 'trending-up',
        action: 'gap-analysis',
        priority: 'medium',
      });
    }

    return actions;
  }

  /**
   * Get contextual help for a specific field/axis
   */
  async getContextualHelp(fieldIdOrContext: string | any, context: any = {}) {
    logger.info('[AIAssessmentFormHelper] getContextualHelp');

    // If called with context object (from routes)
    const ctx = typeof fieldIdOrContext === 'object' ? fieldIdOrContext : context;
    const fieldId = typeof fieldIdOrContext === 'string' ? fieldIdOrContext : ctx.fieldId;
    const axisId = ctx.axisId || fieldId;
    const score = ctx.score || ctx.currentScore;

    const tips: string[] = [];
    const examples: string[] = [];

    const axis = (DRD_AXES as any)[axisId];
    if (axis) {
      tips.push(`${axis.name}: ${axis.description}`);

      if (score && axis.levels[score]) {
        tips.push(`Level ${score}: ${axis.levels[score]}`);

        // Add next level description as a tip
        if (axis.levels[score + 1]) {
          tips.push(`Next level (${score + 1}): ${axis.levels[score + 1]}`);
        }
      }

      // Provide level-specific examples
      if (score) {
        examples.push(
          `At level ${score}, organizations typically demonstrate: ${axis.levels[score]}`
        );
        if (score < 7) {
          examples.push(
            `To advance, focus on capabilities described in level ${score + 1}: ${axis.levels[score + 1] || 'advanced capabilities'}`
          );
        }
      }
    }

    // Try to get AI guidance for richer context
    if (axisId && score) {
      try {
        const guidance = await aiAssessmentPartner.getAssessmentGuidance(
          axisId,
          score,
          (score || 0) + 1
        );
        if (guidance.guidance) {
          tips.push(guidance.guidance);
        }
      } catch {
        // Fallback to static tips only
      }
    }

    return { tips, examples };
  }

  /**
   * Fill missing fields with AI suggestions
   */
  async fillMissingFields(formData: any, schema: any, context: any = {}) {
    logger.info('[AIAssessmentFormHelper] fillMissingFields');

    const strategy = typeof schema === 'string' ? schema : context.strategy || 'suggest-only';
    const suggestions: any[] = [];
    const updatedData = JSON.parse(JSON.stringify(formData || {}));

    const axes = DRD_AXES as any;

    for (const [axisId, axis] of Object.entries(axes) as [string, any][]) {
      const currentData = updatedData?.axes?.[axisId] || updatedData?.[axisId];

      // Skip if already filled
      if (currentData?.actual) continue;

      // Get AI guidance for this axis
      try {
        const clarification = await aiAssessmentPartner.askClarifyingQuestion(axisId, 1);
        const targetSuggestion = await aiAssessmentPartner.suggestTargetScore(
          axisId,
          1,
          'balanced'
        );

        suggestions.push({
          axisId,
          axisName: axis.name,
          suggestedScore: null, // AI doesn't auto-set scores — the consultant must decide
          clarifyingQuestion: clarification.question,
          suggestedTarget: targetSuggestion.suggestedTarget,
          targetReasoning: targetSuggestion.reasoning,
          timeEstimate: targetSuggestion.timeEstimate,
          status: 'needs_input',
        });
      } catch (err: any) {
        logger.warn(
          `[AIAssessmentFormHelper] Failed to get suggestion for ${axisId}:`,
          err.message
        );
        suggestions.push({
          axisId,
          axisName: axis.name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return {
      updated: strategy === 'suggest-only' ? formData : updatedData,
      suggestions,
      strategy,
      message:
        suggestions.length > 0
          ? `Found ${suggestions.length} axis(es) needing input. Review the suggestions below.`
          : 'All axes have been assessed. No missing fields.',
    };
  }

  /**
   * Review all justifications for quality and completeness
   */
  async reviewAllJustifications(formData: any, schema: any, context: any = {}) {
    logger.info('[AIAssessmentFormHelper] reviewAllJustifications');

    const language = (typeof schema === 'object' ? schema?.language : context?.language) || 'en';
    const feedback: any[] = [];
    let totalScore = 0;
    let reviewedCount = 0;

    const answers = formData?.answers?.drd?.areas || formData?.drd?.areas || {};

    for (const [areaId, areaData] of Object.entries(answers) as [string, any][]) {
      const achievedLevel = areaData?.achievedLevel;
      if (achievedLevel == null || achievedLevel === 0) continue;

      const levelNotes = areaData?.levelNotes || {};
      const hasNotes = Object.values(levelNotes).some(
        (n: any) => typeof n === 'string' && n.trim().length > 0
      );

      reviewedCount++;

      if (!hasNotes) {
        feedback.push({
          areaId,
          achievedLevel,
          quality: 'missing',
          score: 0,
          message: `Area ${areaId}: No justification notes provided for achieved level ${achievedLevel}.`,
          suggestion: 'Add notes explaining why this level was selected and what evidence supports it.',
        });
        continue;
      }

      // Check quality of existing notes
      const allNotes = Object.values(levelNotes)
        .filter((n: any) => typeof n === 'string' && n.trim().length > 0)
        .join(' ');

      let quality = 'good';
      let score = 80;
      let message = `Area ${areaId}: Justification looks adequate.`;
      let suggestion: string | null = null;

      if (allNotes.length < 30) {
        quality = 'weak';
        score = 30;
        message = `Area ${areaId}: Justification is too brief (${allNotes.length} chars). More detail recommended.`;
        suggestion = 'Expand with specific evidence, metrics, or examples.';
      } else if (allNotes.length < 80) {
        quality = 'adequate';
        score = 60;
        message = `Area ${areaId}: Justification has some detail but could be more specific.`;
        suggestion = 'Consider adding concrete metrics or documented evidence.';
      } else {
        quality = 'good';
        score = 90;
      }

      totalScore += score;

      feedback.push({
        areaId,
        achievedLevel,
        quality,
        score,
        message,
        suggestion,
        notesLength: allNotes.length,
      });
    }

    const avgScore = reviewedCount > 0 ? Math.round(totalScore / reviewedCount) : null;

    return {
      feedback,
      score: avgScore,
      summary: {
        totalAreas: reviewedCount,
        good: feedback.filter((f) => f.quality === 'good').length,
        adequate: feedback.filter((f) => f.quality === 'adequate').length,
        weak: feedback.filter((f) => f.quality === 'weak').length,
        missing: feedback.filter((f) => f.quality === 'missing').length,
      },
      overallAssessment:
        avgScore != null
          ? avgScore >= 80
            ? 'Justifications are strong overall. Minor improvements possible.'
            : avgScore >= 50
              ? 'Justifications need improvement in several areas.'
              : 'Most justifications need significant enhancement.'
          : 'No justifications to review.',
    };
  }
}

// Singleton instance
export const aiAssessmentFormHelper = new AIAssessmentFormHelper();

// Default export for compatibility
export default {
  AIAssessmentFormHelper,
  aiAssessmentFormHelper,
  FIELD_TYPES,
  VALIDATION_RULES,
};
