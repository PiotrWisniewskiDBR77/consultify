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
  /**
   * Optional extra instructions appended to the AI prompt.
   * Stored inside `filters` for traceability.
   */
  customPrompt?: string;
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
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
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

    const storedFilters: Record<string, any> | undefined = (() => {
      const base: Record<string, any> = input.filters ? { ...(input.filters as any) } : {};
      const customPrompt = (input.customPrompt || '').trim();
      if (customPrompt) base.customPrompt = customPrompt;
      return Object.keys(base).length > 0 ? base : undefined;
    })();

    // Create insight record
    await db.run(
      `INSERT INTO interview_insights
       (id, session_id, organization_id, category, title, prompt_type, source_session_ids, filters, 
        status, source_session_count, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.sessionIds?.[0] || null,
        input.organizationId,
        'general',
        input.title,
        input.promptType,
        JSON.stringify(input.sessionIds),
        storedFilters ? JSON.stringify(storedFilters) : null,
        'generating',
        input.sessionIds.length,
        input.createdBy,
        now,
        now,
      ]
    );

    // Start async generation
    void this.generateInsight(id, input.sessionIds, input.promptType, input.customPrompt);

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
    const customPrompt =
      typeof (insight.filters as any)?.customPrompt === 'string'
        ? String((insight.filters as any).customPrompt)
        : undefined;
    void this.generateInsight(id, insight.sourceSessionIds, insight.promptType, customPrompt);

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
    promptType: InsightPromptType,
    customPrompt?: string
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
      let prompt = promptTemplate.replace('{DATA}', formattedData);
      const extra = (customPrompt || '').trim();
      if (extra) {
        prompt += `\n\nAdditional instructions:\n${extra}\n`;
      }

      // Call LLM (through the unified router) with a stable model selection.
      // NOTE: `llmService.callText()` requires a `modelConfig` and messages; using `generateResponse()`
      // keeps this service compatible with the app-wide LLM fallback chain.
      const actionablePromptTypes: Set<InsightPromptType> = new Set([
        'recommendations',
        'opportunity_scan',
        'risk_assessment',
        'maturity',
        'stakeholder_map',
      ]);
      const systemPrompt = actionablePromptTypes.has(promptType)
        ? 'You are a senior management consultant. Write in clear, structured markdown. Be specific and actionable.'
        : 'You are a senior management consultant. Write in clear, structured markdown. Use only facts grounded in the provided interview data. Do NOT provide recommendations, action plans, next steps, roadmaps, timelines, or mitigation plans.';
      const response = await llmService.generateResponse({
        prompt,
        temperature: 0.3,
        maxTokens: 4000,
        // "standard" resolves via LLMConfigService fallback chain.
        model: 'standard',
        systemPrompt,
      });

      const content = String((response as any)?.content || (response as any)?.text || '');
      const tokensUsed = Number(
        (response as any)?.usage?.totalTokens ||
          (response as any)?.usage?.total_tokens ||
          (response as any)?.usage?.total ||
          0
      );
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
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as respondent_name
       FROM interview_sessions s
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users u ON u.id = s.owner_id
       WHERE s.id IN (${placeholders})`,
      sessionIds
    );

    // Fetch answers for each session
    const sessionDataPromises = (sessions || []).map(async (session: any) => {
      const answers = await db.all<any>(
        `SELECT 
          q.question_text,
          q.category,
          q.answer_text,
          q.status,
          q.confidence_score
         FROM interview_questions q
         WHERE q.session_id = ?
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
              `Q: ${a.question_text}\nA: ${a.answer_text || 'No answer'}${
                a.status ? ` (status: ${a.status})` : ''
              }${a.confidence_score ? ` (confidence: ${a.confidence_score}/5)` : ''}`
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
    // Support mixed/legacy schemas:
    // - Legacy table (from migration 295) uses `description` + `insight_type`
    // - AI/V2 schema uses `content` + `prompt_type`
    const promptType = (row.prompt_type || row.insight_type || 'summary') as InsightPromptType;
    const content = row.content || row.description || undefined;
    const sourceSessionIdsRaw = row.source_session_ids;
    const sourceSessionIds = (() => {
      try {
        if (typeof sourceSessionIdsRaw === 'string' && sourceSessionIdsRaw.trim().length > 0) {
          const parsed = JSON.parse(sourceSessionIdsRaw);
          if (Array.isArray(parsed)) return parsed.map(String);
        }
      } catch {
        /* ignore */
      }
      // Legacy fallback: a single session_id if present
      if (row.session_id) return [String(row.session_id)];
      return [];
    })();

    return {
      id: row.id,
      organizationId: row.organization_id,
      title: row.title,
      promptType,
      sourceSessionIds,
      filters: row.filters
        ? (() => {
            try {
              return JSON.parse(row.filters);
            } catch {
              return undefined;
            }
          })()
        : undefined,
      content,
      status: row.status as InsightStatus,
      errorMessage: row.error_message || undefined,
      sourceSessionCount:
        typeof row.source_session_count === 'number'
          ? row.source_session_count
          : sourceSessionIds.length,
      tokensUsed: row.tokens_used || 0,
      generationTimeMs: row.generation_time_ms || undefined,
      exportedToTools: row.exported_to_tools === 1,
      exportedToAssessment: row.exported_to_assessment === 1,
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
