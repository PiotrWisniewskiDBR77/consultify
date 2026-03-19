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

export interface InsightTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength: 'strong' | 'moderate' | 'weak';
  crossSessionPattern?: boolean;
}

export interface InsightIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  crossSessionPattern?: boolean;
}

export interface InsightOpportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  crossSessionPattern?: boolean;
}

export interface InsightSignal {
  title: string;
  description: string;
  type: 'tension' | 'gap' | 'contradiction' | 'emerging_pattern';
}

export interface InsightEvidenceMapEntry {
  answer_id: string;
  question_text: string;
  answer_snippet: string;
  linked_themes: string[];
  linked_issues: string[];
}

export interface Insight {
  id: string;
  organizationId: string;
  title: string;
  promptType: InsightPromptType;
  sourceSessionIds: string[];
  filters?: Record<string, any>;
  content?: string;
  executiveSummary?: string;
  themes?: InsightTheme[];
  issues?: InsightIssue[];
  opportunities?: InsightOpportunity[];
  signals?: InsightSignal[];
  evidenceMap?: InsightEvidenceMapEntry[];
  missingData?: string[];
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

    await db.run(
      `UPDATE interview_insights 
       SET status = 'generating',
           content = NULL,
           executive_summary = NULL,
           themes_json = NULL,
           issues_json = NULL,
           opportunities_json = NULL,
           signals_json = NULL,
           evidence_map_json = NULL,
           missing_data_json = NULL,
           error_message = NULL,
           updated_at = ?
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
   * V6 three-layer truth model prompt.
   * Replaces all per-promptType templates with a single structured JSON output contract.
   */
  private buildV6Prompt(promptType: InsightPromptType, formattedData: string, customPrompt?: string, sessionCount = 1): string {
    const focusHint = PROMPT_TEMPLATES[promptType]?.split('\n')[0] || '';
    const isMultiSession = sessionCount > 1;

    const crossSessionBlock = isMultiSession ? `
      "cross_session_pattern": true or false (boolean indicating if this spans multiple sessions)` : '';

    const crossSessionInstructions = isMultiSession ? `

CROSS-SESSION ANALYSIS (${sessionCount} respondents):
- Identify RECURRING themes that appear across multiple respondents
- Flag CONTRADICTIONS where respondents disagree
- Note CONSENSUS areas where all respondents align
- Distinguish single-respondent observations from cross-session patterns
- In each theme/issue/opportunity, note which sessions support it (by respondent name or session name)
- Add a "cross_session_pattern" boolean to each theme/issue/opportunity indicating if it spans multiple sessions
` : '';

    let prompt = `You are analyzing interview data. Your analysis focus: ${focusHint}

Each answer in the data below is tagged with an [answer_id: ...]. Use these IDs in evidence_refs and evidence_map.

Interview Data:
${formattedData}

Return ONLY a valid JSON object (no markdown fences, no commentary outside the JSON) with this exact structure:

{
  "executive_summary": "2-4 sentence overview of the most important findings",
  "themes": [
    {
      "title": "Theme title",
      "description": "What this theme means, grounded in the data",
      "evidence_refs": ["answer_id_1", "answer_id_2"],
      "strength": "strong|moderate|weak"${crossSessionBlock}
    }
  ],
  "issues": [
    {
      "title": "Issue title",
      "description": "What the problem is and why it matters",
      "severity": "high|medium|low",
      "evidence_refs": ["answer_id_1"]${crossSessionBlock}
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title",
      "description": "What the opportunity is and its potential value",
      "impact": "high|medium|low",
      "evidence_refs": ["answer_id_1"]${crossSessionBlock}
    }
  ],
  "signals": [
    {
      "title": "Signal title",
      "description": "Description of the tension, gap, contradiction, or emerging pattern",
      "type": "tension|gap|contradiction|emerging_pattern"
    }
  ],
  "evidence_map": [
    {
      "answer_id": "the_answer_id",
      "question_text": "The original question",
      "answer_snippet": "Key excerpt from the answer (max 120 chars)",
      "linked_themes": ["Theme title 1"],
      "linked_issues": ["Issue title 1"]
    }
  ],
  "missing_data": ["Description of what data is missing or what follow-up questions would help"]
}
${crossSessionInstructions}
Rules:
- Ground every theme, issue, and opportunity in specific answer_ids from the data.
- "signals" capture tensions, gaps, contradictions, or emerging patterns that don't fit neatly into themes/issues.
- Include at least one entry in evidence_map for each answer that contributed to a theme or issue.
- Do NOT provide recommendations, action plans, next steps, roadmaps, timelines, owners, or mitigation plans.
- If evidence is weak or incomplete, note it in missing_data.
- Aim for 3-7 themes, 2-5 issues, 2-5 opportunities, 1-4 signals (scale with data volume).
`;

    const extra = (customPrompt || '').trim();
    if (extra) {
      prompt += `\nAdditional analysis instructions:\n${extra}\n`;
    }

    return prompt;
  }

  /**
   * Parse the AI JSON response, tolerating markdown fences and minor formatting issues.
   */
  private parseV6Response(raw: string): {
    executive_summary: string;
    themes: InsightTheme[];
    issues: InsightIssue[];
    opportunities: InsightOpportunity[];
    signals: InsightSignal[];
    evidence_map: InsightEvidenceMapEntry[];
    missing_data: string[];
  } {
    let cleaned = raw.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);

    const mapCrossSession = <T extends Record<string, any>>(items: T[]): T[] =>
      items.map((item) => {
        if ('cross_session_pattern' in item) {
          const { cross_session_pattern, ...rest } = item;
          return { ...rest, crossSessionPattern: Boolean(cross_session_pattern) } as unknown as T;
        }
        return item;
      });

    return {
      executive_summary: String(parsed.executive_summary || ''),
      themes: Array.isArray(parsed.themes) ? mapCrossSession(parsed.themes) : [],
      issues: Array.isArray(parsed.issues) ? mapCrossSession(parsed.issues) : [],
      opportunities: Array.isArray(parsed.opportunities) ? mapCrossSession(parsed.opportunities) : [],
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      evidence_map: Array.isArray(parsed.evidence_map) ? parsed.evidence_map : [],
      missing_data: Array.isArray(parsed.missing_data) ? parsed.missing_data : [],
    };
  }

  /**
   * Build a markdown rendering of the structured V6 data for the legacy `content` column.
   */
  private renderV6ContentAsMarkdown(data: ReturnType<typeof InterviewInsightService.prototype.parseV6Response>): string {
    const lines: string[] = [];

    lines.push('## Executive Summary', '', data.executive_summary, '');

    if (data.themes.length > 0) {
      lines.push('## Themes', '');
      for (const t of data.themes) {
        lines.push(`### ${t.title} _(${t.strength})_`, '', t.description, '');
      }
    }

    if (data.issues.length > 0) {
      lines.push('## Issues', '');
      for (const i of data.issues) {
        lines.push(`### ${i.title} _(severity: ${i.severity})_`, '', i.description, '');
      }
    }

    if (data.opportunities.length > 0) {
      lines.push('## Opportunities', '');
      for (const o of data.opportunities) {
        lines.push(`### ${o.title} _(impact: ${o.impact})_`, '', o.description, '');
      }
    }

    if (data.signals.length > 0) {
      lines.push('## Signals', '');
      for (const s of data.signals) {
        lines.push(`- **${s.title}** (${s.type}): ${s.description}`);
      }
      lines.push('');
    }

    if (data.missing_data.length > 0) {
      lines.push('## Missing Data', '');
      for (const m of data.missing_data) {
        lines.push(`- ${m}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate insight content using AI (V6 three-layer truth model)
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
      const sessionData = await this.fetchSessionData(sessionIds);

      if (sessionData.length === 0) {
        throw new Error('No session data available for analysis');
      }

      const formattedData = this.formatSessionDataForPrompt(sessionData);
      const prompt = this.buildV6Prompt(promptType, formattedData, customPrompt, sessionData.length);

      const systemPrompt =
        'You are a senior management consultant performing structured interview analysis. ' +
        'Return ONLY valid JSON matching the requested schema. ' +
        'Ground all findings in the provided interview data. ' +
        'Do NOT provide recommendations, action plans, next steps, roadmaps, timelines, owners, or mitigation plans.';

      const response = await llmService.generateResponse({
        prompt,
        temperature: 0.3,
        maxTokens: 4000,
        model: 'standard',
        systemPrompt,
      });

      const rawContent = String((response as any)?.content || (response as any)?.text || '');
      const tokensUsed = Number(
        (response as any)?.usage?.totalTokens ||
          (response as any)?.usage?.total_tokens ||
          (response as any)?.usage?.total ||
          0
      );
      const generationTime = Date.now() - startTime;

      // Parse structured V6 response
      const v6Data = this.parseV6Response(rawContent);

      // Render markdown for the legacy `content` column (backward compat)
      const markdownContent = this.renderV6ContentAsMarkdown(v6Data);

      await db.run(
        `UPDATE interview_insights 
         SET status = 'completed',
             content = ?,
             executive_summary = ?,
             themes_json = ?,
             issues_json = ?,
             opportunities_json = ?,
             signals_json = ?,
             evidence_map_json = ?,
             missing_data_json = ?,
             tokens_used = ?,
             generation_time_ms = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          markdownContent,
          v6Data.executive_summary,
          JSON.stringify(v6Data.themes),
          JSON.stringify(v6Data.issues),
          JSON.stringify(v6Data.opportunities),
          JSON.stringify(v6Data.signals),
          JSON.stringify(v6Data.evidence_map),
          JSON.stringify(v6Data.missing_data),
          tokensUsed,
          generationTime,
          new Date().toISOString(),
          insightId,
        ]
      );

      logger.info(
        `[InterviewInsightService] Generated V6 insight ${insightId} in ${generationTime}ms ` +
        `(${v6Data.themes.length} themes, ${v6Data.issues.length} issues, ${v6Data.opportunities.length} opportunities)`
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`[InterviewInsightService] Failed to generate insight ${insightId}:`, err);

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
          q.id,
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
              `[answer_id: ${a.id}] Q: ${a.question_text}\nA: ${a.answer_text || 'No answer'}${
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

    const safeJsonArray = <T>(raw: unknown): T[] | undefined => {
      if (!raw || typeof raw !== 'string') return undefined;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    };

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
      executiveSummary: row.executive_summary || undefined,
      themes: safeJsonArray<InsightTheme>(row.themes_json),
      issues: safeJsonArray<InsightIssue>(row.issues_json),
      opportunities: safeJsonArray<InsightOpportunity>(row.opportunities_json),
      signals: safeJsonArray<InsightSignal>(row.signals_json),
      evidenceMap: safeJsonArray<InsightEvidenceMapEntry>(row.evidence_map_json),
      missingData: safeJsonArray<string>(row.missing_data_json),
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
