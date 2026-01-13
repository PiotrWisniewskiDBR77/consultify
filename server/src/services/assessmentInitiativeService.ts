/**
 * Assessment Initiative Service
 * FLOW-ASSESSMENT-001: Generate initiatives from assessment results
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface AssessmentGap {
  dimensionId: string;
  dimensionName: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

interface GeneratedInitiative {
  id: string;
  title: string;
  summary: string;
  problemStatement: string;
  dimensionId: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedImpact: 'low' | 'medium' | 'high';
  priority: number;
  suggestedDeliverables: string[];
}

// ==========================================
// SERVICE
// ==========================================

class AssessmentInitiativeService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Generate initiatives from assessment results
   */
  async generateInitiatives(
    assessmentId: string,
    projectId: string,
    orgId: string,
    userId: string
  ): Promise<{ initiatives: GeneratedInitiative[]; gaps: AssessmentGap[] }> {
    const db = await this.getDb();

    // Get assessment with scores
    const assessment = await db.get<{
      id: string;
      framework: string;
      overall_score: number;
      organization_id: string;
    }>('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [assessmentId, orgId]);

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get dimension scores
    const dimensionScores = await db.all<{
      dimension_id: string;
      dimension_name: string;
      score: number;
      max_score: number;
    }>(
      `SELECT dimension_id, dimension_name, score, max_score 
             FROM assessment_dimension_scores 
             WHERE assessment_id = ?`,
      [assessmentId]
    );

    // Identify gaps (dimensions with low scores)
    const gaps: AssessmentGap[] = (dimensionScores || [])
      .map((d): AssessmentGap => ({
        dimensionId: d.dimension_id,
        dimensionName: d.dimension_name,
        currentScore: d.score,
        targetScore: d.max_score,
        gap: d.max_score - d.score,
        priority: (d.score <= 2 ? 'high' : d.score <= 3 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      }))
      .sort((a, b) => b.gap - a.gap);

    // Generate initiatives for top gaps
    const initiatives: GeneratedInitiative[] = [];
    let priorityOrder = 1;

    for (const gap of gaps.filter((g) => g.gap > 0)) {
      const initiative = this.createInitiativeFromGap(gap, assessment.framework, priorityOrder);
      initiatives.push(initiative);
      priorityOrder++;

      // Limit to 10 initiatives per assessment
      if (initiatives.length >= 10) break;
    }

    // Save draft initiatives to database
    const now = new Date().toISOString();
    for (const init of initiatives) {
      await db.run(
        `INSERT INTO initiatives (
                    id, organization_id, project_id, title, summary, problem_statement,
                    status, source_type, source_id, priority_order,
                    deliverables, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'draft', 'assessment', ?, ?, ?, ?, ?, ?)`,
        [
          init.id,
          orgId,
          projectId,
          init.title,
          init.summary,
          init.problemStatement,
          assessmentId,
          init.priority,
          JSON.stringify(init.suggestedDeliverables),
          userId,
          now,
          now,
        ]
      );
    }

    // Update assessment
    await db.run(`UPDATE assessments SET initiatives_generated = ? WHERE id = ?`, [
      initiatives.length,
      assessmentId,
    ]);

    logger.info(
      `[AssessmentInitiativeService] Generated ${initiatives.length} initiatives from assessment ${assessmentId}`
    );

    return { initiatives, gaps };
  }

  /**
   * Create initiative from gap analysis
   */
  private createInitiativeFromGap(
    gap: AssessmentGap,
    framework: string,
    priorityOrder: number
  ): GeneratedInitiative {
    const id = `initiative-${uuidv4()}`;

    // Generate title based on dimension
    const titleTemplates: Record<string, string> = {
      strategy: 'Digital Strategy Enhancement',
      organization: 'Organization Digital Transformation',
      processes: 'Process Digitization Initiative',
      technology: 'Technology Modernization',
      people: 'Digital Skills Development',
      data: 'Data & Analytics Capability Building',
      operations: 'Operations Digitization',
      'supply-chain': 'Supply Chain Digital Integration',
      'product-lifecycle': 'Product Lifecycle Digitization',
      'value-stream': 'Value Stream Optimization',
    };

    const title = titleTemplates[gap.dimensionId] || `${gap.dimensionName} Improvement`;

    // Generate summary
    const summary =
      `Improve ${gap.dimensionName.toLowerCase()} maturity from level ${gap.currentScore.toFixed(1)} to ${gap.targetScore.toFixed(1)}. ` +
      `This initiative addresses a ${gap.gap.toFixed(1)} point gap identified in the ${framework} assessment.`;

    // Generate problem statement
    const problemStatement =
      `The ${gap.dimensionName.toLowerCase()} dimension scored ${gap.currentScore.toFixed(1)} out of ${gap.targetScore.toFixed(1)}, ` +
      `indicating significant improvement opportunities. This gap impacts the organization's overall digital maturity and competitive position.`;

    // Generate suggested deliverables
    const deliverableTemplates: Record<string, string[]> = {
      strategy: ['Digital Strategy Document', 'Roadmap with Milestones', 'KPI Dashboard'],
      organization: ['Change Management Plan', 'Training Program', 'Culture Assessment'],
      processes: [
        'Process Maps (Current & Future)',
        'Automation Requirements',
        'Implementation Plan',
      ],
      technology: ['Technology Assessment', 'Architecture Blueprint', 'Migration Plan'],
      people: ['Skills Gap Analysis', 'Training Curriculum', 'Certification Program'],
      data: ['Data Strategy', 'Analytics Platform Requirements', 'Data Governance Framework'],
    };

    const suggestedDeliverables = deliverableTemplates[gap.dimensionId] || [
      'Gap Analysis Report',
      'Action Plan',
      'Implementation Timeline',
    ];

    return {
      id,
      title,
      summary,
      problemStatement,
      dimensionId: gap.dimensionId,
      estimatedEffort: gap.gap > 3 ? 'high' : gap.gap > 2 ? 'medium' : 'low',
      estimatedImpact:
        gap.priority === 'high' ? 'high' : gap.priority === 'medium' ? 'medium' : 'low',
      priority: priorityOrder,
      suggestedDeliverables,
    };
  }

  /**
   * Calculate dimension scores from responses
   */
  async calculateDimensionScores(assessmentId: string): Promise<void> {
    const db = await this.getDb();

    // Get framework dimensions
    const assessment = await db.get<{ framework: string }>(
      'SELECT framework FROM assessments WHERE id = ?',
      [assessmentId]
    );

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const framework = await db.get<{ dimensions: string }>(
      'SELECT dimensions FROM assessment_frameworks WHERE name = ?',
      [assessment.framework]
    );

    if (!framework) {
      throw new Error('Framework not found');
    }

    const dimensions = JSON.parse(framework.dimensions);

    // Calculate scores per dimension
    for (const dim of dimensions) {
      const scores = await db.all<{ score: number }>(
        `SELECT score FROM assessment_responses 
                 WHERE assessment_id = ? AND dimension_id = ? AND score IS NOT NULL`,
        [assessmentId, dim.id]
      );

      if (scores && scores.length > 0) {
        const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

        await db.run(
          `INSERT OR REPLACE INTO assessment_dimension_scores 
                     (id, assessment_id, dimension_id, dimension_name, score, max_score, question_count, answered_count)
                     VALUES (?, ?, ?, ?, ?, 5, ?, ?)`,
          [
            `score-${assessmentId}-${dim.id}`,
            assessmentId,
            dim.id,
            dim.name,
            avgScore,
            scores.length,
            scores.length,
          ]
        );
      }
    }

    // Calculate overall score
    const allScores = await db.all<{ score: number; weight: number }>(
      `SELECT score, weight FROM assessment_dimension_scores WHERE assessment_id = ?`,
      [assessmentId]
    );

    if (allScores && allScores.length > 0) {
      const totalWeight = allScores.reduce((sum, s) => sum + (s.weight || 1), 0);
      const weightedSum = allScores.reduce((sum, s) => sum + s.score * (s.weight || 1), 0);
      const overallScore = weightedSum / totalWeight;
      const maturityLevel = Math.round(overallScore);

      await db.run(`UPDATE assessments SET overall_score = ?, maturity_level = ? WHERE id = ?`, [
        overallScore,
        maturityLevel,
        assessmentId,
      ]);
    }

    logger.info(`[AssessmentInitiativeService] Calculated scores for assessment ${assessmentId}`);
  }

  /**
   * Complete assessment and generate report
   */
  async completeAssessment(
    assessmentId: string,
    orgId: string
  ): Promise<{ assessmentId: string; reportId: string }> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Calculate final scores
    await this.calculateDimensionScores(assessmentId);

    // Update assessment status
    await db.run(
      `UPDATE assessments SET status = 'COMPLETED', completed_at = ? WHERE id = ? AND organization_id = ?`,
      [now, assessmentId, orgId]
    );

    // Create report record
    const reportId = `report-${uuidv4()}`;
    await db.run(
      `INSERT INTO assessment_reports (id, assessment_id, organization_id, generated_by, created_at)
             VALUES (?, ?, ?, 'ai', ?)`,
      [reportId, assessmentId, orgId, now]
    );

    // Update report generation timestamp
    await db.run(`UPDATE assessments SET report_generated_at = ? WHERE id = ?`, [
      now,
      assessmentId,
    ]);

    logger.info(
      `[AssessmentInitiativeService] Completed assessment ${assessmentId}, report: ${reportId}`
    );

    return { assessmentId, reportId };
  }
}

// Export singleton
const assessmentInitiativeService = new AssessmentInitiativeService();
export default assessmentInitiativeService;

// Named exports
export const generateInitiatives = (
  assessmentId: string,
  projectId: string,
  orgId: string,
  userId: string
) => assessmentInitiativeService.generateInitiatives(assessmentId, projectId, orgId, userId);
export const calculateDimensionScores = (assessmentId: string) =>
  assessmentInitiativeService.calculateDimensionScores(assessmentId);
export const completeAssessment = (assessmentId: string, orgId: string) =>
  assessmentInitiativeService.completeAssessment(assessmentId, orgId);
