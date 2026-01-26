/**
 * AssessmentInitiativeService
 * Service for generating initiatives from assessments
 *
 * Pipeline:
 * 1. Extract assessment answers and scores
 * 2. Build context (org data + chat history + assessment data)
 * 3. Generate initiatives using AI (with methodology mapping)
 * 4. Persist initiatives with links to assessment
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

// Types
type AssessmentType = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface AssessmentRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  assessment_type: AssessmentType;
  name: string;
  status: string;
  completion_percent: number;
  confidence_avg: number;
  answers_json?: string | null;
  context_snapshot?: string | null;
  score_summary?: string | null;
}

interface GeneratedInitiative {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  risk: 'low' | 'medium' | 'high';
  estimatedEffort?: string;
  expectedOutcome?: string;
  relatedAxis?: string;
  relatedDimension?: string;
}

interface GenerateParams {
  assessment: AssessmentRow;
  methodologyId: string;
  count: number;
  includeChatContext: boolean;
  userId: string;
}

interface PersistParams {
  assessment: AssessmentRow;
  batchId: string;
  initiatives: GeneratedInitiative[];
  userId: string;
}

// Methodology configurations
const METHODOLOGIES: Record<
  string,
  {
    name: string;
    categoryMapping: string[];
    priorityBias: 'high' | 'medium' | 'balanced';
    riskTolerance: 'low' | 'medium' | 'high';
  }
> = {
  'impact-feasibility': {
    name: 'Impact-Feasibility Matrix',
    categoryMapping: ['quick_win', 'strategic', 'operational', 'innovation'],
    priorityBias: 'balanced',
    riskTolerance: 'medium',
  },
  moscow: {
    name: 'MoSCoW Prioritization',
    categoryMapping: ['must_have', 'should_have', 'could_have', 'wont_have'],
    priorityBias: 'high',
    riskTolerance: 'low',
  },
  rice: {
    name: 'RICE Scoring',
    categoryMapping: ['high_reach', 'high_impact', 'high_confidence', 'low_effort'],
    priorityBias: 'balanced',
    riskTolerance: 'medium',
  },
  'value-effort': {
    name: 'Value vs Effort',
    categoryMapping: ['high_value_low_effort', 'high_value_high_effort', 'low_value_low_effort'],
    priorityBias: 'high',
    riskTolerance: 'low',
  },
  'strategic-fit': {
    name: 'Strategic Fit',
    categoryMapping: ['core_strategy', 'growth', 'efficiency', 'innovation'],
    priorityBias: 'medium',
    riskTolerance: 'high',
  },
};

// Assessment type to initiative category mapping
const ASSESSMENT_CATEGORY_MAPPING: Record<AssessmentType, string[]> = {
  DRD: [
    'digital_transformation',
    'process_automation',
    'data_management',
    'ai_readiness',
    'cybersecurity',
    'culture_change',
  ],
  SIRI: [
    'industry_40',
    'smart_manufacturing',
    'iot_integration',
    'analytics',
    'workforce_development',
    'governance',
  ],
  ADMA: ['advanced_manufacturing', 'digital_maturity', 'operational_excellence', 'innovation'],
  CMMI: ['process_improvement', 'capability_development', 'quality_management', 'risk_management'],
  LEAN: ['lean_transformation', 'waste_reduction', 'continuous_improvement', 'value_stream'],
};

// Timeout helper
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Operation timed out'));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

class AssessmentInitiativeService {
  /**
   * Backward-compatible alias used by legacy assessment routes.
   * Marks assessment as completed (minimal implementation).
   */
  static async completeAssessment(assessmentId: string, organizationId: string) {
    const assessment = await queryHelpers.queryOne<AssessmentRow>(
      `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    );
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Minimal state update (if column exists). Ignore errors to keep compatibility.
    try {
      await queryHelpers.queryRun(
        `UPDATE assessments SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId]
      );
    } catch {
      // noop
    }

    return { assessmentId, reportGenerated: false };
  }

  /**
   * Backward-compatible alias used by legacy assessment routes.
   * Generates and persists draft initiatives.
   */
  static async generateInitiatives(
    assessmentId: string,
    projectId: string,
    organizationId: string,
    userId: string
  ) {
    const assessment = await queryHelpers.queryOne<AssessmentRow>(
      `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    );
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const normalized: AssessmentRow = {
      ...assessment,
      project_id: assessment.project_id || projectId || null,
    };

    const batchId = uuidv4();
    const initiatives = await this.generateFromAssessment({
      assessment: normalized,
      methodologyId: 'impact-feasibility',
      count: 5,
      includeChatContext: false,
      userId,
    });

    const created = await this.persistInitiatives({
      assessment: normalized,
      batchId,
      initiatives,
      userId,
    });

    return { batchId, initiatives: created };
  }

  /**
   * Generate initiatives from assessment
   */
  static async generateFromAssessment(params: GenerateParams): Promise<GeneratedInitiative[]> {
    const { assessment, methodologyId, count, includeChatContext, userId } = params;

    const methodology = METHODOLOGIES[methodologyId] || METHODOLOGIES['impact-feasibility'];
    const categories = ASSESSMENT_CATEGORY_MAPPING[assessment.assessment_type] || ['general'];

    // Parse assessment data
    const safeParseJson = <T>(value: string | null | undefined, fallback: T): T => {
      if (!value || typeof value !== 'string') return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };
    const answers = safeParseJson<Record<string, any>>(assessment.answers_json, {});
    const scoreSummary = safeParseJson<Record<string, any>>(assessment.score_summary, {});
    const contextSnapshot = safeParseJson<Record<string, any>>(assessment.context_snapshot, {});

    // Build prompt for AI
    const prompt = this.buildPrompt({
      assessment,
      answers,
      scoreSummary,
      methodology,
      categories,
      count,
      includeChatContext,
      contextSnapshot,
    });

    try {
      // Try to generate with AI
      const aiInitiatives = await withTimeout(
        this.callAI(prompt, count),
        30000 // 30 second timeout
      );

      if (aiInitiatives && aiInitiatives.length > 0) {
        return this.normalizeInitiatives(aiInitiatives, assessment.assessment_type, methodology);
      }
    } catch (error) {
      console.error('[AssessmentInitiativeService] AI generation failed:', error);
      // Fall through to fallback
    }

    // Fallback: Generate basic initiatives from gaps
    return this.generateFallbackInitiatives(assessment, answers, scoreSummary, methodology, count);
  }

  /**
   * Build AI prompt
   */
  private static buildPrompt(params: {
    assessment: AssessmentRow;
    answers: Record<string, any>;
    scoreSummary: Record<string, any>;
    methodology: (typeof METHODOLOGIES)[string];
    categories: string[];
    count: number;
    includeChatContext: boolean;
    contextSnapshot: Record<string, any>;
  }): string {
    const {
      assessment,
      answers,
      scoreSummary,
      methodology,
      categories,
      count,
      includeChatContext,
      contextSnapshot,
    } = params;

    let prompt = `You are an expert consultant generating transformation initiatives based on a ${assessment.assessment_type} assessment.

Assessment: ${assessment.name}
Type: ${assessment.assessment_type}
Methodology: ${methodology.name}

Assessment Scores:
${JSON.stringify(scoreSummary, null, 2)}

Key Assessment Areas:
${JSON.stringify(answers, null, 2)}

Generate exactly ${count} strategic initiatives that address the gaps identified in this assessment.
Each initiative should:
1. Address a specific gap or improvement area
2. Be actionable and measurable
3. Align with ${methodology.name} prioritization
4. Consider the organization's current maturity level

Categories to consider: ${categories.join(', ')}

`;

    if (includeChatContext && contextSnapshot.chat) {
      prompt += `\nRecent conversation context:\n${JSON.stringify(contextSnapshot.chat.slice(-10), null, 2)}\n`;
    }

    if (contextSnapshot.org) {
      prompt += `\nOrganization context:\n${JSON.stringify(contextSnapshot.org, null, 2)}\n`;
    }

    prompt += `
Return a JSON array with exactly ${count} initiatives in this format:
[
  {
    "title": "Initiative title (max 100 chars)",
    "description": "Detailed description of the initiative",
    "category": "one of: ${categories.join(', ')}",
    "priority": "low|medium|high|critical",
    "risk": "low|medium|high",
    "estimatedEffort": "S|M|L|XL",
    "expectedOutcome": "Expected business outcome",
    "relatedAxis": "Related assessment axis/dimension"
  }
]`;

    return prompt;
  }

  /**
   * Call AI service
   */
  private static async callAI(prompt: string, count: number): Promise<GeneratedInitiative[]> {
    // Try to import and use existing AI service
    try {
      const { generateChatResponse } = await import('./aiService.js');

      const response = await generateChatResponse({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are an expert consultant. Return only valid JSON arrays.',
        model: 'gpt-4o-mini',
        maxTokens: 2000,
      });

      if (response?.content) {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            return parsed.slice(0, count);
          }
        }
      }
    } catch (err) {
      console.error('[AssessmentInitiativeService] AI service call failed:', err);
    }

    return [];
  }

  /**
   * Normalize initiatives
   */
  private static normalizeInitiatives(
    initiatives: any[],
    assessmentType: AssessmentType,
    methodology: (typeof METHODOLOGIES)[string]
  ): GeneratedInitiative[] {
    const categories = ASSESSMENT_CATEGORY_MAPPING[assessmentType] || ['general'];

    return initiatives.map((init) => ({
      title: String(init.title || 'Untitled Initiative').slice(0, 200),
      description: String(init.description || ''),
      category: categories.includes(init.category) ? init.category : categories[0],
      priority: (() => {
        const raw = String(init.priority || '').toLowerCase();
        return ['low', 'medium', 'high', 'critical'].includes(raw)
          ? (raw as GeneratedInitiative['priority'])
          : 'medium';
      })(),
      risk: (() => {
        const raw = String(init.risk || '').toLowerCase();
        return ['low', 'medium', 'high'].includes(raw) ? (raw as GeneratedInitiative['risk']) : 'medium';
      })(),
      estimatedEffort: init.estimatedEffort || 'M',
      expectedOutcome: init.expectedOutcome || '',
      relatedAxis: init.relatedAxis || '',
      relatedDimension: init.relatedDimension || '',
    }));
  }

  /**
   * Generate fallback initiatives from assessment gaps
   */
  private static generateFallbackInitiatives(
    assessment: AssessmentRow,
    answers: Record<string, any>,
    scoreSummary: Record<string, any>,
    methodology: (typeof METHODOLOGIES)[string],
    count: number
  ): GeneratedInitiative[] {
    const categories = ASSESSMENT_CATEGORY_MAPPING[assessment.assessment_type] || ['general'];
    const initiatives: GeneratedInitiative[] = [];

    // DRD-specific fallback
    if (assessment.assessment_type === 'DRD') {
      const axes = [
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity',
      ];

      for (const axis of axes) {
        if (initiatives.length >= count) break;

        const axisData = answers[axis] || scoreSummary[axis];
        if (axisData) {
          const actual = axisData.actual || axisData.current || 0;
          const target = axisData.target || 5;
          const gap = target - actual;

          if (gap > 1) {
            initiatives.push({
              title: `Improve ${axis.replace(/([A-Z])/g, ' $1').trim()} maturity`,
              description: `Current level: ${actual}, Target: ${target}. Gap of ${gap} levels requires focused improvement initiatives.`,
              category: categories[initiatives.length % categories.length],
              priority: gap >= 3 ? 'high' : gap >= 2 ? 'medium' : 'low',
              risk: gap >= 3 ? 'high' : 'medium',
              estimatedEffort: gap >= 3 ? 'XL' : gap >= 2 ? 'L' : 'M',
              expectedOutcome: `Increase ${axis} maturity from level ${actual} to level ${target}`,
              relatedAxis: axis,
            });
          }
        }
      }
    }

    // SIRI-specific fallback
    if (assessment.assessment_type === 'SIRI') {
      const dimensions = [
        'operations',
        'supply_chain',
        'product_lifecycle',
        'automation',
        'connectivity',
        'intelligence',
        'talent_readiness',
        'structure_management',
      ];

      for (const dim of dimensions) {
        if (initiatives.length >= count) break;

        const dimData = answers[dim] || scoreSummary[dim];
        if (dimData) {
          const current = dimData.current || 0;
          const target = dimData.target || 5;
          const gap = target - current;

          if (gap > 1) {
            initiatives.push({
              title: `Advance ${dim.replace(/_/g, ' ')} capabilities`,
              description: `Current maturity: ${current}, Target: ${target}. Strategic initiative to close the ${gap}-level gap.`,
              category: categories[initiatives.length % categories.length],
              priority: gap >= 3 ? 'high' : gap >= 2 ? 'medium' : 'low',
              risk: gap >= 3 ? 'high' : 'medium',
              estimatedEffort: gap >= 3 ? 'XL' : gap >= 2 ? 'L' : 'M',
              expectedOutcome: `Achieve Industry 4.0 readiness level ${target} in ${dim}`,
              relatedDimension: dim,
            });
          }
        }
      }
    }

    // Generic fallback if no specific gaps found
    while (initiatives.length < count) {
      initiatives.push({
        title: `${assessment.assessment_type} Improvement Initiative ${initiatives.length + 1}`,
        description: `Strategic initiative based on ${assessment.name} assessment findings.`,
        category: categories[initiatives.length % categories.length],
        priority: methodology.priorityBias === 'high' ? 'high' : 'medium',
        risk: methodology.riskTolerance,
        estimatedEffort: 'M',
        expectedOutcome: 'Improve organizational maturity',
      });
    }

    return initiatives.slice(0, count);
  }

  /**
   * Persist initiatives to database
   */
  static async persistInitiatives(
    params: PersistParams
  ): Promise<{ id: string; title: string; status: string }[]> {
    const { assessment, batchId, initiatives, userId } = params;
    const now = new Date().toISOString();
    const created: { id: string; title: string; status: string }[] = [];

    for (const initiative of initiatives) {
      const id = uuidv4();

      // Insert into initiatives table
      await queryHelpers.queryRun(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, title, description,
          status, priority, risk_level, category, source_type, source_id,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          assessment.organization_id,
          assessment.project_id || null,
          initiative.title,
          initiative.title,
          initiative.description,
          'DRAFT', // Always start as DRAFT
          initiative.priority,
          initiative.risk,
          initiative.category,
          'assessment', // source_type
          assessment.id, // source_id
          userId,
          now,
          now,
        ]
      );

      // Create link
      await queryHelpers.queryRun(
        `INSERT INTO assessment_initiative_links (id, assessment_id, batch_id, initiative_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), assessment.id, batchId, id, now]
      );

      created.push({
        id,
        title: initiative.title,
        status: 'DRAFT',
      });
    }

    return created;
  }
}

export default AssessmentInitiativeService;
