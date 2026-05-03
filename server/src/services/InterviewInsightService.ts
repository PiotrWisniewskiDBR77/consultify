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
import organizationContextService from './organizationContext/OrganizationContextService.js';

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
export type InsightStatus =
  | 'generating'
  | 'completed'
  | 'failed'
  | 'draft'
  | 'in_review'
  | 'published';

export type InsightAnalysisMode =
  | 'general_consulting_synthesis'
  | 'focused_topic_synthesis'
  | 'contradiction_scan'
  | 'initiative_opportunity_scan'
  | 'material_quality_scan'
  | 'hypothesis_validation'
  | 'between_the_lines';

export type InsightContextMode =
  | 'selected_interview_material_only'
  | 'selected_material_plus_approved_org_knowledge';

export interface InsightAnalysisScope {
  source_session_ids: string[];
  source_scope_status: 'approved_only';
  respondent_filters: string[];
  role_filters: string[];
  department_filters: string[];
  template_filters: string[];
  date_range?: { from?: string; to?: string };
  topic_focus: string[];
  analysis_mode: InsightAnalysisMode;
  context_mode: InsightContextMode;
  consultant_note?: string | null;
  leading_question?: string | null;
}

export interface InsightMaterialQuality {
  overall_material_score: number;
  answer_quality_posture: 'strong' | 'usable' | 'thin' | 'poor';
  coverage_posture:
    | 'single_perspective'
    | 'partial_coverage'
    | 'good_coverage'
    | 'strong_cross_function_coverage';
  approved_session_count: number;
  respondent_count: number;
  role_coverage: string[];
  department_coverage: string[];
  thin_answer_count: number;
  missing_voices: string[];
  evidence_gap_count: number;
  contradiction_count: number;
  limitations: string[];
  recommended_followups: string[];
}

export interface ApprovedOrgKnowledgePack {
  requested: boolean;
  available: boolean;
  included: boolean;
  degraded: boolean;
  degradedReasons: string[];
  policy: 'accepted_or_approved_context_claims_only';
  sourceCount: number;
  builtAt: string;
  entries: Array<{
    claimPath: string;
    value: unknown;
    confidence: number;
    reviewStatus: string;
    sourceType: string;
    sourceLabel: string | null;
    createdAt: string;
  }>;
}

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
    respondentIds?: string[];
    roles?: string[];
    departments?: string[];
    topicFocus?: string[];
  };
  analysisScope?: Partial<InsightAnalysisScope>;
  analysisMode?: InsightAnalysisMode;
  contextMode?: InsightContextMode;
  topicFocus?: string[];
  consultantNote?: string;
  leadingQuestion?: string;
  createdBy: string;
}

export interface InsightTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength: 'strong' | 'moderate' | 'weak';
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

export interface InsightIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

export interface InsightOpportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
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
  analysisScope?: InsightAnalysisScope;
  materialQuality?: InsightMaterialQuality | null;
  contextMode?: InsightContextMode;
  analysisMode?: InsightAnalysisMode;
  topicFocus?: string[];
  generationContext?: Record<string, any>;
  status: InsightStatus;
  reviewStatus?: 'draft' | 'in_review' | 'published';
  publishedAt?: string;
  reviewedBy?: string;
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

const DEFAULT_ANALYSIS_MODE: InsightAnalysisMode = 'general_consulting_synthesis';
const DEFAULT_CONTEXT_MODE: InsightContextMode = 'selected_interview_material_only';

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function safeJsonObject<T extends Record<string, any>>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || raw.trim().length === 0) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeJsonArray<T>(raw: unknown): T[] | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAnalysisMode(value?: string | null): InsightAnalysisMode {
  switch (String(value || '').trim()) {
    case 'focused_topic_synthesis':
    case 'contradiction_scan':
    case 'initiative_opportunity_scan':
    case 'material_quality_scan':
    case 'hypothesis_validation':
    case 'between_the_lines':
    case 'general_consulting_synthesis':
      return value as InsightAnalysisMode;
    default:
      return DEFAULT_ANALYSIS_MODE;
  }
}

function normalizeContextMode(value?: string | null): InsightContextMode {
  return value === 'selected_material_plus_approved_org_knowledge'
    ? 'selected_material_plus_approved_org_knowledge'
    : DEFAULT_CONTEXT_MODE;
}

function buildDefaultAnalysisScope(input: {
  sessionIds: string[];
  filters?: CreateInsightInput['filters'] | Record<string, any>;
  analysisScope?: Partial<InsightAnalysisScope>;
  analysisMode?: string | null;
  contextMode?: string | null;
  topicFocus?: string[];
  consultantNote?: string | null;
  leadingQuestion?: string | null;
}): InsightAnalysisScope {
  const filters = input.filters || {};
  const partial = input.analysisScope || {};
  const dateRange =
    partial.date_range ||
    ((filters as any).dateFrom || (filters as any).dateTo
      ? { from: (filters as any).dateFrom || undefined, to: (filters as any).dateTo || undefined }
      : undefined);
  const topicFocus =
    safeStringArray(partial.topic_focus).length > 0
      ? safeStringArray(partial.topic_focus)
      : safeStringArray(input.topicFocus || (filters as any).topicFocus);

  return {
    source_session_ids:
      safeStringArray(partial.source_session_ids).length > 0
        ? safeStringArray(partial.source_session_ids)
        : input.sessionIds,
    source_scope_status: 'approved_only',
    respondent_filters: safeStringArray(
      partial.respondent_filters || (filters as any).respondentIds || (filters as any).respondentId
    ),
    role_filters: safeStringArray(partial.role_filters || (filters as any).roles),
    department_filters: safeStringArray(partial.department_filters || (filters as any).departments),
    template_filters: safeStringArray(
      partial.template_filters || (filters as any).templateIds || (filters as any).templateId
    ),
    ...(dateRange ? { date_range: dateRange } : {}),
    topic_focus: topicFocus,
    analysis_mode: normalizeAnalysisMode(partial.analysis_mode || input.analysisMode),
    context_mode: normalizeContextMode(partial.context_mode || input.contextMode),
    consultant_note: partial.consultant_note ?? input.consultantNote ?? null,
    leading_question: partial.leading_question ?? input.leadingQuestion ?? null,
  };
}

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

  private buildGenerationContext(params: {
    createdAt: string;
    analysisScope: InsightAnalysisScope;
    approvedOrgKnowledgePack: ApprovedOrgKnowledgePack;
  }): Record<string, any> {
    return {
      contract: 'interview_insight_scope_builder_v1',
      contextMode: params.analysisScope.context_mode,
      analysisMode: params.analysisScope.analysis_mode,
      topicFocus: params.analysisScope.topic_focus,
      createdAt: params.createdAt,
      approvedOrgKnowledgePack: {
        requested: params.approvedOrgKnowledgePack.requested,
        available: params.approvedOrgKnowledgePack.available,
        included: params.approvedOrgKnowledgePack.included,
        degraded: params.approvedOrgKnowledgePack.degraded,
        degradedReasons: params.approvedOrgKnowledgePack.degradedReasons,
        policy: params.approvedOrgKnowledgePack.policy,
        sourceCount: params.approvedOrgKnowledgePack.sourceCount,
        builtAt: params.approvedOrgKnowledgePack.builtAt,
        sources: params.approvedOrgKnowledgePack.entries.map((entry) => ({
          claimPath: entry.claimPath,
          sourceType: entry.sourceType,
          sourceLabel: entry.sourceLabel,
          confidence: entry.confidence,
          reviewStatus: entry.reviewStatus,
          createdAt: entry.createdAt,
        })),
      },
    };
  }

  private async buildApprovedOrgKnowledgePack(
    organizationId: string,
    contextMode: InsightContextMode
  ): Promise<ApprovedOrgKnowledgePack> {
    const builtAt = new Date().toISOString();
    const base = {
      requested: contextMode === 'selected_material_plus_approved_org_knowledge',
      available: false,
      included: false,
      degraded: false,
      degradedReasons: [] as string[],
      policy: 'accepted_or_approved_context_claims_only' as const,
      sourceCount: 0,
      builtAt,
      entries: [] as ApprovedOrgKnowledgePack['entries'],
    };

    if (!base.requested) {
      return base;
    }

    try {
      const claims = await organizationContextService.listClaims(organizationId, 60);
      const approvedStatuses = new Set(['accepted', 'approved', 'verified', 'confirmed']);
      const entries = (claims || [])
        .filter((claim) => approvedStatuses.has(String(claim.reviewStatus || '').toLowerCase()))
        .filter((claim) => claim.value !== null && claim.value !== undefined && claim.value !== '')
        .slice(0, 25)
        .map((claim) => ({
          claimPath: claim.claimPath,
          value: claim.value,
          confidence: Number(claim.confidence || 0),
          reviewStatus: claim.reviewStatus,
          sourceType: claim.sourceType,
          sourceLabel: claim.sourceLabel,
          createdAt: claim.createdAt,
        }));

      if (entries.length === 0) {
        return {
          ...base,
          degraded: true,
          degradedReasons: ['no_approved_organization_knowledge_available'],
        };
      }

      return {
        ...base,
        available: true,
        included: true,
        sourceCount: entries.length,
        entries,
      };
    } catch (error) {
      logger.warn('[InterviewInsightService] Approved org knowledge pack unavailable:', error);
      return {
        ...base,
        degraded: true,
        degradedReasons: ['approved_organization_knowledge_lookup_failed'],
      };
    }
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
    const normalizedSessionIds = safeStringArray(input.sessionIds);

    if (normalizedSessionIds.length === 0) {
      throw Object.assign(new Error('sessionId or sessionIds is required'), {
        code: 'INTERVIEW_INSIGHT_SESSION_REQUIRED',
        status: 400,
      });
    }

    const eligibleSessionIds = await this.loadEligibleSessionIds(
      input.organizationId,
      normalizedSessionIds
    );
    const rejectedSessionIds = normalizedSessionIds.filter(
      (sessionId) => !eligibleSessionIds.has(sessionId)
    );
    if (rejectedSessionIds.length > 0) {
      throw Object.assign(
        new Error(
          'Interview Insight can only be generated from approved/completed interview sessions'
        ),
        {
          code: 'INTERVIEW_INSIGHT_SOURCE_NOT_APPROVED',
          status: 409,
          rejectedSessionIds,
        }
      );
    }

    const storedFilters: Record<string, any> | undefined = (() => {
      const base: Record<string, any> = input.filters ? { ...(input.filters as any) } : {};
      const customPrompt = (input.customPrompt || '').trim();
      if (customPrompt) base.customPrompt = customPrompt;
      return Object.keys(base).length > 0 ? base : undefined;
    })();
    const analysisScope = buildDefaultAnalysisScope({
      sessionIds: normalizedSessionIds,
      filters: input.filters,
      analysisScope: input.analysisScope,
      analysisMode: input.analysisMode,
      contextMode: input.contextMode,
      topicFocus: input.topicFocus,
      consultantNote: input.consultantNote,
      leadingQuestion: input.leadingQuestion,
    });
    const approvedOrgKnowledgePack = await this.buildApprovedOrgKnowledgePack(
      input.organizationId,
      analysisScope.context_mode
    );
    const generationContext = this.buildGenerationContext({
      createdAt: now,
      analysisScope,
      approvedOrgKnowledgePack,
    });

    // Create insight record
    await db.run(
      `INSERT INTO interview_insights
       (id, session_id, organization_id, category, title, prompt_type, source_session_ids, filters, 
        status, source_session_count, analysis_scope_json, context_mode, analysis_mode, topic_focus_json,
        generation_context_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        normalizedSessionIds?.[0] || null,
        input.organizationId,
        'general',
        input.title,
        input.promptType,
        JSON.stringify(normalizedSessionIds),
        storedFilters ? JSON.stringify(storedFilters) : null,
        'generating',
        normalizedSessionIds.length,
        JSON.stringify(analysisScope),
        analysisScope.context_mode,
        analysisScope.analysis_mode,
        JSON.stringify(analysisScope.topic_focus),
        JSON.stringify(generationContext),
        input.createdBy,
        now,
        now,
      ]
    );

    // Start async generation
    void this.generateInsight(
      id,
      normalizedSessionIds,
      input.organizationId,
      input.promptType,
      input.customPrompt,
      analysisScope,
      approvedOrgKnowledgePack
    );

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
    void this.generateInsight(
      id,
      insight.sourceSessionIds,
      insight.organizationId,
      insight.promptType,
      customPrompt,
      insight.analysisScope
    );

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
  private buildV6Prompt(
    promptType: InsightPromptType,
    formattedData: string,
    customPrompt?: string,
    sessionCount = 1,
    analysisScope?: InsightAnalysisScope,
    approvedOrgKnowledgePack?: ApprovedOrgKnowledgePack
  ): string {
    const focusHint = PROMPT_TEMPLATES[promptType]?.split('\n')[0] || '';
    const isMultiSession = sessionCount > 1;
    const scope = analysisScope || buildDefaultAnalysisScope({ sessionIds: [], filters: {} });
    const scopeBlock = JSON.stringify(
      {
        analysis_mode: scope.analysis_mode,
        context_mode: scope.context_mode,
        topic_focus: scope.topic_focus,
        leading_question: scope.leading_question,
        consultant_note: scope.consultant_note,
        source_scope_status: scope.source_scope_status,
      },
      null,
      2
    );

    const crossSessionBlock = isMultiSession
      ? `
      "cross_session_pattern": true or false (boolean indicating if this spans multiple sessions),
      "perspective_labels": ["Role / department / respondent lens that supports or challenges this"],
      "divergence_note": "Optional note when roles or respondents see the topic differently"`
      : '';

    const crossSessionInstructions = isMultiSession
      ? `

CROSS-SESSION ANALYSIS (${sessionCount} respondents):
- Identify RECURRING themes that appear across multiple respondents
- Flag CONTRADICTIONS where respondents disagree
- Note CONSENSUS areas where all respondents align
- Distinguish single-respondent observations from cross-session patterns
- In each theme/issue/opportunity, note which sessions support it (by respondent name or session name)
- Add a "cross_session_pattern" boolean to each theme/issue/opportunity indicating if it spans multiple sessions
- Populate "perspective_labels" with the roles, departments, or respondent lenses most relevant to the topic
- Use "divergence_note" when the same topic looks different across roles, departments, or respondents
`
      : '';
    const orgKnowledgeContext = (() => {
      if (!approvedOrgKnowledgePack?.requested) {
        return 'Approved Organization Knowledge: not requested for this insight.';
      }
      if (!approvedOrgKnowledgePack.included || approvedOrgKnowledgePack.entries.length === 0) {
        return `Approved Organization Knowledge: requested but unavailable or degraded.\nReasons: ${
          approvedOrgKnowledgePack.degradedReasons.join(', ') || 'unknown'
        }`;
      }
      return `Approved Organization Knowledge Pack (approved/attributed context only; do not override interview material limitations):\n${JSON.stringify(
        approvedOrgKnowledgePack.entries,
        null,
        2
      )}`;
    })();

    let prompt = `You are analyzing interview data. Your analysis focus: ${focusHint}

Insight Scope:
${scopeBlock}

${orgKnowledgeContext}

Context mode rules:
- If context_mode is "selected_interview_material_only", use only the interview material below.
- If context_mode is "selected_material_plus_approved_org_knowledge", you may use approved organizational knowledge only when it is explicitly available in the provided context; otherwise say that broader organizational knowledge was not available.
- Never hide uncertainty. If the material is thin, contradictory, or single-perspective, say so in limits and material_quality.
- A leading_question is optional. If absent, identify the highest-value consulting observations yourself.
- Topic focus may be empty. If empty, create a general consulting synthesis.

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
  "missing_data": ["Description of what data is missing or what follow-up questions would help"],
  "material_quality": {
    "overall_material_score": 0-100,
    "answer_quality_posture": "strong|usable|thin|poor",
    "coverage_posture": "single_perspective|partial_coverage|good_coverage|strong_cross_function_coverage",
    "missing_voices": ["Which roles/departments/perspectives are missing"],
    "limitations": ["Limits on what can safely be concluded"],
    "recommended_followups": ["Follow-up questions or interviews that would improve confidence"]
  }
}
${crossSessionInstructions}
Rules:
- Ground every theme, issue, and opportunity in specific answer_ids from the data.
- "signals" capture tensions, gaps, contradictions, or emerging patterns that don't fit neatly into themes/issues.
- Include at least one entry in evidence_map for each answer that contributed to a theme or issue.
- Preserve perspective nuance: if executives, managers, frontline users, or departments see a topic differently, encode that in perspective_labels and divergence_note instead of flattening it into one claim.
- Do NOT provide recommendations, action plans, next steps, roadmaps, timelines, owners, or mitigation plans.
- If evidence is weak or incomplete, note it in missing_data.
- Material Quality is not a blocking gate. It is an honest assessment of how far the generated insight can be trusted.
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
    material_quality?: Partial<InsightMaterialQuality>;
  } {
    let cleaned = raw.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);

    const mapCrossSession = <T extends Record<string, any>>(items: T[]): T[] =>
      items.map((item) => {
        const { cross_session_pattern, perspective_labels, divergence_note, ...rest } = item;
        return {
          ...rest,
          ...('cross_session_pattern' in item
            ? { crossSessionPattern: Boolean(cross_session_pattern) }
            : {}),
          ...('perspective_labels' in item
            ? {
                perspective_labels: Array.isArray(perspective_labels)
                  ? perspective_labels.map((entry) => String(entry || '').trim()).filter(Boolean)
                  : [],
              }
            : {}),
          ...('divergence_note' in item
            ? {
                divergence_note: String(divergence_note || '').trim() || undefined,
              }
            : {}),
        } as unknown as T;
      });

    return {
      executive_summary: String(parsed.executive_summary || ''),
      themes: Array.isArray(parsed.themes) ? mapCrossSession(parsed.themes) : [],
      issues: Array.isArray(parsed.issues) ? mapCrossSession(parsed.issues) : [],
      opportunities: Array.isArray(parsed.opportunities)
        ? mapCrossSession(parsed.opportunities)
        : [],
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      evidence_map: Array.isArray(parsed.evidence_map) ? parsed.evidence_map : [],
      missing_data: Array.isArray(parsed.missing_data) ? parsed.missing_data : [],
      material_quality:
        parsed.material_quality && typeof parsed.material_quality === 'object'
          ? parsed.material_quality
          : undefined,
    };
  }

  /**
   * Build a markdown rendering of the structured V6 data for the legacy `content` column.
   */
  private renderV6ContentAsMarkdown(
    data: ReturnType<typeof InterviewInsightService.prototype.parseV6Response>
  ): string {
    const lines: string[] = [];

    lines.push('## Executive Summary', '', data.executive_summary, '');

    if (data.themes.length > 0) {
      lines.push('## Themes', '');
      for (const t of data.themes) {
        lines.push(`### ${t.title} _(${t.strength})_`, '', t.description, '');
        if (Array.isArray(t.perspective_labels) && t.perspective_labels.length > 0) {
          lines.push(`Perspective lenses: ${t.perspective_labels.join(', ')}`, '');
        }
        if (t.divergence_note) {
          lines.push(`Divergence: ${t.divergence_note}`, '');
        }
      }
    }

    if (data.issues.length > 0) {
      lines.push('## Issues', '');
      for (const i of data.issues) {
        lines.push(`### ${i.title} _(severity: ${i.severity})_`, '', i.description, '');
        if (Array.isArray(i.perspective_labels) && i.perspective_labels.length > 0) {
          lines.push(`Perspective lenses: ${i.perspective_labels.join(', ')}`, '');
        }
        if (i.divergence_note) {
          lines.push(`Divergence: ${i.divergence_note}`, '');
        }
      }
    }

    if (data.opportunities.length > 0) {
      lines.push('## Opportunities', '');
      for (const o of data.opportunities) {
        lines.push(`### ${o.title} _(impact: ${o.impact})_`, '', o.description, '');
        if (Array.isArray(o.perspective_labels) && o.perspective_labels.length > 0) {
          lines.push(`Perspective lenses: ${o.perspective_labels.join(', ')}`, '');
        }
        if (o.divergence_note) {
          lines.push(`Divergence: ${o.divergence_note}`, '');
        }
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

  private buildMaterialQuality(
    sessionData: any[],
    v6Data: ReturnType<typeof InterviewInsightService.prototype.parseV6Response>
  ): InsightMaterialQuality {
    const answeredTotal = sessionData.reduce(
      (sum, session) => sum + Number(session.answered_questions || session.answers?.length || 0),
      0
    );
    const questionTotal = sessionData.reduce(
      (sum, session) => sum + Number(session.total_questions || session.answers?.length || 0),
      0
    );
    const roles = safeStringArray(sessionData.map((session) => session.job_title));
    const departments = safeStringArray(sessionData.map((session) => session.department));
    const thinAnswers = sessionData
      .flatMap((session) => session.answers || [])
      .filter((answer) => {
        const text = String(answer.answer_text || '').trim();
        return text.length < 80 || (answer.confidence_score && Number(answer.confidence_score) < 3);
      }).length;
    const contradictionCount = (v6Data.signals || []).filter((signal) =>
      /contradiction|tension/i.test(`${signal.type} ${signal.title} ${signal.description}`)
    ).length;
    const evidenceGapCount =
      (v6Data.missing_data || []).length +
      [...(v6Data.themes || []), ...(v6Data.issues || []), ...(v6Data.opportunities || [])].filter(
        (item: any) => !Array.isArray(item.evidence_refs) || item.evidence_refs.length === 0
      ).length;
    const coverageRatio = questionTotal > 0 ? answeredTotal / questionTotal : 0;
    const aiQuality = v6Data.material_quality || {};
    const aiScore = Number((aiQuality as any).overall_material_score);
    const calculatedScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          coverageRatio * 55 +
            Math.min(sessionData.length, 4) * 8 +
            Math.min(roles.length + departments.length, 6) * 3 -
            thinAnswers * 2 -
            evidenceGapCount * 3
        )
      )
    );
    const score = Number.isFinite(aiScore) ? Math.max(0, Math.min(100, aiScore)) : calculatedScore;

    const answerQuality =
      (aiQuality as any).answer_quality_posture ||
      (score >= 80 ? 'strong' : score >= 60 ? 'usable' : score >= 40 ? 'thin' : 'poor');
    const coveragePosture =
      (aiQuality as any).coverage_posture ||
      (sessionData.length <= 1
        ? 'single_perspective'
        : roles.length >= 3 || departments.length >= 3
          ? 'strong_cross_function_coverage'
          : sessionData.length >= 3
            ? 'good_coverage'
            : 'partial_coverage');

    return {
      overall_material_score: score,
      answer_quality_posture: answerQuality,
      coverage_posture: coveragePosture,
      approved_session_count: sessionData.length,
      respondent_count: new Set(sessionData.map((session) => session.owner_id || session.id)).size,
      role_coverage: roles,
      department_coverage: departments,
      thin_answer_count: thinAnswers,
      missing_voices: safeStringArray((aiQuality as any).missing_voices),
      evidence_gap_count: evidenceGapCount,
      contradiction_count: contradictionCount,
      limitations: safeStringArray((aiQuality as any).limitations || v6Data.missing_data),
      recommended_followups: safeStringArray((aiQuality as any).recommended_followups),
    };
  }

  /**
   * Generate insight content using AI (V6 three-layer truth model)
   */
  private async generateInsight(
    insightId: string,
    sessionIds: string[],
    organizationId: string,
    promptType: InsightPromptType,
    customPrompt?: string,
    analysisScope?: InsightAnalysisScope,
    approvedOrgKnowledgePack?: ApprovedOrgKnowledgePack
  ): Promise<void> {
    const db = await this.getDb();
    const startTime = Date.now();

    try {
      const sessionData = await this.fetchSessionData(sessionIds, organizationId);

      if (sessionData.length === 0) {
        throw new Error('No session data available for analysis');
      }

      const scope = analysisScope || buildDefaultAnalysisScope({ sessionIds, filters: {} });
      const orgKnowledgePack =
        approvedOrgKnowledgePack ||
        (await this.buildApprovedOrgKnowledgePack(organizationId, scope.context_mode));
      const formattedData = this.formatSessionDataForPrompt(sessionData);
      const prompt = this.buildV6Prompt(
        promptType,
        formattedData,
        customPrompt,
        sessionData.length,
        scope,
        orgKnowledgePack
      );

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
      const materialQuality = this.buildMaterialQuality(sessionData, v6Data);

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
             material_quality_json = ?,
             generation_context_json = ?,
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
          JSON.stringify(materialQuality),
          JSON.stringify(
            this.buildGenerationContext({
              createdAt: new Date(startTime).toISOString(),
              analysisScope: scope,
              approvedOrgKnowledgePack: orgKnowledgePack,
            })
          ),
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
  private async loadEligibleSessionIds(
    organizationId: string,
    sessionIds: string[]
  ): Promise<Set<string>> {
    const db = await this.getDb();
    const placeholders = sessionIds.map(() => '?').join(',');
    if (!placeholders) return new Set();

    const sessions = await db.all<any>(
      `SELECT s.id
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id IN (${placeholders})
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )
         AND s.status = 'completed'
         AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))`,
      [organizationId, ...sessionIds, organizationId, organizationId]
    );

    return new Set((sessions || []).map((session) => String(session.id)));
  }

  private async fetchSessionData(sessionIds: string[], organizationId: string): Promise<any[]> {
    const db = await this.getDb();
    const placeholders = sessionIds.map(() => '?').join(',');

    const sessions = await db.all<any>(
      `SELECT 
        s.id, s.name, s.status, s.completed_at, s.owner_id,
        s.answered_questions, s.total_questions,
        t.name as template_name, t.category as template_category,
        u.job_title, upe.department,
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as respondent_name
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users u ON u.id = s.owner_id
       LEFT JOIN user_profile_extended upe ON upe.user_id = u.id
       WHERE s.id IN (${placeholders})
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )
         AND s.status = 'completed'
         AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))`,
      [organizationId, ...sessionIds, organizationId, organizationId]
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
           AND q.status = 'answered'
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
Role: ${session.job_title || 'Unknown'}
Department: ${session.department || 'Unknown'}
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

    const topicFocus = safeJsonArray<string>(row.topic_focus_json) || [];
    const analysisScope = buildDefaultAnalysisScope({
      sessionIds: sourceSessionIds,
      filters: row.filters ? safeJsonObject<Record<string, any>>(row.filters, {}) : undefined,
      analysisScope: safeJsonObject<Partial<InsightAnalysisScope>>(row.analysis_scope_json, {}),
      analysisMode: row.analysis_mode || row.prompt_type,
      contextMode: row.context_mode,
      topicFocus,
      consultantNote: undefined,
      leadingQuestion: undefined,
    });

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
      analysisScope,
      materialQuality:
        Object.keys(safeJsonObject<Partial<InsightMaterialQuality>>(row.material_quality_json, {}))
          .length > 0
          ? (safeJsonObject<InsightMaterialQuality>(
              row.material_quality_json,
              {} as InsightMaterialQuality
            ) as InsightMaterialQuality)
          : null,
      contextMode: analysisScope.context_mode,
      analysisMode: analysisScope.analysis_mode,
      topicFocus: analysisScope.topic_focus,
      generationContext: safeJsonObject<Record<string, any>>(row.generation_context_json, {}),
      status: row.status as InsightStatus,
      reviewStatus:
        row.status === 'in_review' || row.status === 'published'
          ? (row.status as 'in_review' | 'published')
          : 'draft',
      publishedAt: row.published_at || undefined,
      reviewedBy: row.reviewed_by || undefined,
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
