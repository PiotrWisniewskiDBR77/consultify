/**
 * Interview Insight Service
 *
 * Generates AI-powered insights from completed interview sessions.
 * Supports multiple analysis types: summary, trends, problems, recommendations.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
import { llmService } from './ai/llmService.js';

// ==========================================
// TYPES
// ==========================================

export type InsightPromptType = 
  | 'summary' 
  | 'trends' 
  | 'problems' 
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map';
export type InsightStatus = 'generating' | 'completed' | 'failed';

export interface CreateInsightInput {
  organizationId: string;
  title: string;
  sessionIds: string[];
  promptType: InsightPromptType;
  filters?: {
    templateId?: string;
    dateFrom?: string;
    dateTo?: string;
    respondentId?: string;
  };
  createdBy: string;
}

export interface Insight {
  id: string;
  organizationId: string;
  title: string;
  promptType: InsightPromptType;
  sourceSessionIds: string[];
  filters?: Record<string, any>;
  content?: string;
  status: InsightStatus;
  errorMessage?: string;
  sourceSessionCount: number;
  tokensUsed: number;
  generationTimeMs?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// PROMPT TEMPLATES
// ==========================================

const PROMPT_TEMPLATES: Record<InsightPromptType, string> = {
  summary: `Analyze the following interview responses and provide a comprehensive summary.

Structure your response as follows:
1. **Executive Summary** - A brief overview of the key findings
2. **Main Themes** - The dominant themes that emerged from the interviews
3. **Key Quotes** - Notable quotes from respondents (anonymized)
4. **Observations** - Additional observations worth noting

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  trends: `Analyze the following interview responses and identify key trends and patterns.

Structure your response as follows:
1. **Emerging Trends** - New patterns or behaviors observed
2. **Consistent Patterns** - Themes that appear across multiple interviews
3. **Divergent Views** - Areas where opinions differ significantly
4. **Trend Implications** - What these trends mean for the organization

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  problems: `Analyze the following interview responses and identify problems, pain points, and challenges.

Structure your response as follows:
1. **Critical Issues** - High-priority problems requiring immediate attention
2. **Recurring Challenges** - Problems mentioned multiple times
3. **Root Causes** - Underlying factors contributing to the issues
4. **Impact Assessment** - How these problems affect operations/outcomes

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  recommendations: `Analyze the following interview responses and provide actionable recommendations.

Structure your response as follows:
1. **Quick Wins** - Actions that can be implemented immediately with minimal effort
2. **Strategic Initiatives** - Longer-term improvements requiring planning
3. **Priority Matrix** - Recommendations ranked by impact and effort
4. **Implementation Roadmap** - Suggested sequence for implementation

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  comparison: `Analyze and compare the following interview responses from different respondents.

Structure your response as follows:
1. **Alignment Areas** - Topics where respondents agree
2. **Divergent Perspectives** - Areas where opinions differ significantly
3. **Perspective by Role/Department** - How views vary by respondent background
4. **Consensus Opportunities** - Where alignment could be built
5. **Key Differences Table** - Summary comparison matrix

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Use tables where appropriate.`,

  gaps: `Analyze the following interview responses to identify information gaps and missing data.

Structure your response as follows:
1. **Critical Information Gaps** - Essential information that is missing
2. **Unanswered Questions** - Questions that were not adequately addressed
3. **Areas Requiring Follow-up** - Topics needing deeper exploration
4. **Low Confidence Answers** - Responses that seem uncertain or incomplete
5. **Recommended Next Steps** - Suggested follow-up interviews or research

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown.`,

  risk_assessment: `Analyze the following interview responses to identify and assess risks.

Structure your response as follows:
1. **Critical Risks** - High-impact, high-probability risks requiring immediate attention
2. **Operational Risks** - Day-to-day operational concerns
3. **Strategic Risks** - Long-term threats to business objectives
4. **People & Change Risks** - Human factors and change management concerns
5. **Risk Matrix** - Summary table with likelihood, impact, and mitigation suggestions

| Risk | Category | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Include the risk matrix table.`,

  opportunity_scan: `Analyze the following interview responses to identify opportunities and quick wins.

Structure your response as follows:
1. **Quick Wins** - Low-effort, high-impact opportunities (implement within 30 days)
2. **Growth Opportunities** - Areas for expansion or improvement
3. **Efficiency Gains** - Process improvements and cost savings
4. **Innovation Potential** - New ideas and transformative possibilities
5. **Opportunity Prioritization** - Ranked list by value and feasibility

| Opportunity | Category | Effort | Impact | Timeline |
|-------------|----------|--------|--------|----------|

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Be specific and actionable.`,

  maturity: `Analyze the following interview responses to assess organizational maturity.

Structure your response as follows:
1. **Overall Maturity Score** - Rating from 1-5 with justification
2. **Maturity by Dimension**:
   - Strategy & Vision (1-5)
   - Processes & Operations (1-5)
   - Technology & Digital (1-5)
   - People & Culture (1-5)
   - Data & Analytics (1-5)
3. **Strengths** - Areas of high maturity
4. **Development Areas** - Areas requiring improvement
5. **Maturity Roadmap** - Path to next maturity level

**Maturity Scale:**
- 1: Initial/Ad-hoc
- 2: Developing/Reactive
- 3: Defined/Proactive
- 4: Managed/Optimized
- 5: Leading/Innovative

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Include radar chart data if possible.`,

  stakeholder_map: `Analyze the following interview responses to map key stakeholders.

Structure your response as follows:
1. **Key Stakeholders Identified** - List of important players mentioned
2. **Influence & Interest Matrix**:
   - High Influence / High Interest (Key Players)
   - High Influence / Low Interest (Keep Satisfied)
   - Low Influence / High Interest (Keep Informed)
   - Low Influence / Low Interest (Monitor)
3. **Stakeholder Positions** - Support, neutral, or resistance to change
4. **Relationships & Dynamics** - How stakeholders interact
5. **Engagement Strategy** - Recommended approach for each stakeholder group

| Stakeholder | Role | Influence | Interest | Position | Strategy |
|-------------|------|-----------|----------|----------|----------|

Interview Data:
{DATA}

Provide the analysis in a clear, professional consulting format using markdown. Include the stakeholder table.`,
};

// ==========================================
// SERVICE CLASS
// ==========================================

class InterviewInsightService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new insight and start generation
   */
  async create(input: CreateInsightInput): Promise<Insight> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = `ii_${uuidv4()}`;

    // Create insight record
    await db.run(
      `INSERT INTO interview_insights
       (id, organization_id, title, prompt_type, source_session_ids, filters, 
        status, source_session_count, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.title,
        input.promptType,
        JSON.stringify(input.sessionIds),
        input.filters ? JSON.stringify(input.filters) : null,
        'generating',
        input.sessionIds.length,
        input.createdBy,
        now,
        now,
      ]
    );

    // Start async generation
    void this.generateInsight(id, input.sessionIds, input.promptType);

    return this.getById(id) as Promise<Insight>;
  }

  /**
   * Get insight by ID
   */
  async getById(id: string): Promise<Insight | null> {
    const db = await this.getDb();
    const row = await db.get<any>(`SELECT * FROM interview_insights WHERE id = ?`, [id]);
    return row ? this.mapRowToInsight(row) : null;
  }

  /**
   * List insights for an organization
   */
  async list(
    organizationId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Insight[]> {
    const db = await this.getDb();
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db.all<any>(
      `SELECT * FROM interview_insights 
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [organizationId, limit, offset]
    );

    return (rows || []).map((row) => this.mapRowToInsight(row));
  }

  /**
   * Regenerate an insight
   */
  async regenerate(id: string): Promise<Insight | null> {
    const db = await this.getDb();
    const insight = await this.getById(id);
    if (!insight) return null;

    const now = new Date().toISOString();

    // Reset status
    await db.run(
      `UPDATE interview_insights 
       SET status = 'generating', content = NULL, error_message = NULL, updated_at = ?
       WHERE id = ?`,
      [now, id]
    );

    // Restart generation
    void this.generateInsight(id, insight.sourceSessionIds, insight.promptType);

    return this.getById(id);
  }

  /**
   * Delete an insight
   */
  async delete(id: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.run(`DELETE FROM interview_insights WHERE id = ?`, [id]);
    return (result as any)?.changes > 0;
  }

  // ==========================================
  // AI GENERATION
  // ==========================================

  /**
   * Generate insight content using AI
   */
  private async generateInsight(
    insightId: string,
    sessionIds: string[],
    promptType: InsightPromptType
  ): Promise<void> {
    const db = await this.getDb();
    const startTime = Date.now();

    try {
      // Fetch session data
      const sessionData = await this.fetchSessionData(sessionIds);

      if (sessionData.length === 0) {
        throw new Error('No session data available for analysis');
      }

      // Format data for prompt
      const formattedData = this.formatSessionDataForPrompt(sessionData);

      // Get prompt template
      const promptTemplate = PROMPT_TEMPLATES[promptType];
      const prompt = promptTemplate.replace('{DATA}', formattedData);

      // Call LLM
      const response = await llmService.callText({
        prompt,
        temperature: 0.3,
        maxTokens: 4000,
      } as any);

      const content = (response as any)?.text || (response as any)?.content || '';
      const tokensUsed = (response as any)?.usage?.totalTokens || 0;
      const generationTime = Date.now() - startTime;

      // Update with success
      await db.run(
        `UPDATE interview_insights 
         SET status = 'completed', content = ?, tokens_used = ?, generation_time_ms = ?, updated_at = ?
         WHERE id = ?`,
        [content, tokensUsed, generationTime, new Date().toISOString(), insightId]
      );

      logger.info(
        `[InterviewInsightService] Generated insight ${insightId} in ${generationTime}ms`
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`[InterviewInsightService] Failed to generate insight ${insightId}:`, err);

      // Update with failure
      await db.run(
        `UPDATE interview_insights 
         SET status = 'failed', error_message = ?, updated_at = ?
         WHERE id = ?`,
        [err.message, new Date().toISOString(), insightId]
      );
    }
  }

  /**
   * Fetch interview session data with answers
   */
  private async fetchSessionData(sessionIds: string[]): Promise<any[]> {
    const db = await this.getDb();
    const placeholders = sessionIds.map(() => '?').join(',');

    const sessions = await db.all<any>(
      `SELECT 
        s.id, s.name, s.status, s.completed_at,
        t.name as template_name, t.category as template_category,
        u.name as respondent_name
       FROM interview_sessions s
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id IN (${placeholders})`,
      sessionIds
    );

    // Fetch answers for each session
    const sessionDataPromises = (sessions || []).map(async (session: any) => {
      const answers = await db.all<any>(
        `SELECT 
          a.answer_text, a.answer_value,
          q.question_text, q.category
         FROM interview_answers a
         JOIN interview_library_questions q ON q.id = a.question_id
         WHERE a.session_id = ?
         ORDER BY q.sort_order`,
        [session.id]
      );

      return {
        ...session,
        answers: answers || [],
      };
    });

    return Promise.all(sessionDataPromises);
  }

  /**
   * Format session data for the AI prompt
   */
  private formatSessionDataForPrompt(sessionData: any[]): string {
    return sessionData
      .map((session, index) => {
        const answerText = session.answers
          .map(
            (a: any) =>
              `Q: ${a.question_text}\nA: ${a.answer_text || a.answer_value || 'No answer'}`
          )
          .join('\n\n');

        return `
--- Interview ${index + 1} ---
Template: ${session.template_name || 'Unknown'}
Category: ${session.template_category || 'General'}
Respondent: ${session.respondent_name || 'Anonymous'}
Date: ${session.completed_at || 'Unknown'}

${answerText}
`;
      })
      .join('\n\n');
  }

  // ==========================================
  // MAPPING
  // ==========================================

  private mapRowToInsight(row: any): Insight {
    return {
      id: row.id,
      organizationId: row.organization_id,
      title: row.title,
      promptType: row.prompt_type as InsightPromptType,
      sourceSessionIds: JSON.parse(row.source_session_ids || '[]'),
      filters: row.filters ? JSON.parse(row.filters) : undefined,
      content: row.content || undefined,
      status: row.status as InsightStatus,
      errorMessage: row.error_message || undefined,
      sourceSessionCount: row.source_session_count || 0,
      tokensUsed: row.tokens_used || 0,
      generationTimeMs: row.generation_time_ms || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Export singleton
const interviewInsightService = new InterviewInsightService();
export default interviewInsightService;

// Named exports
export const create = (input: CreateInsightInput) => interviewInsightService.create(input);
export const getById = (id: string) => interviewInsightService.getById(id);
export const list = (organizationId: string, options?: { limit?: number; offset?: number }) =>
  interviewInsightService.list(organizationId, options);
export const regenerate = (id: string) => interviewInsightService.regenerate(id);
export const deleteInsight = (id: string) => interviewInsightService.delete(id);
