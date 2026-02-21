/**
 * Interview Inference Service (T016)
 *
 * Structured inference engine that analyzes completed interview sessions
 * and generates categorized insights with evidence, assumptions, unknowns,
 * and counterpoints.
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { llmService } from './ai/llmService.js';

const INSIGHT_CATEGORIES = ['risk', 'opportunity', 'constraint', 'priority', 'trend', 'gap'] as const;
type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

const EvidenceItemSchema = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  excerpt: z.string(),
});

const InferenceInsightSchema = z.object({
  category: z.enum(INSIGHT_CATEGORIES),
  statement: z.string(),
  whyItMatters: z.string(),
  recommendation: z.string().optional(),
  confidenceScore: z.number().int().min(1).max(5),
  evidence: z.array(EvidenceItemSchema),
  assumptions: z.array(z.string()),
  unknowns: z.array(z.string()),
  counterpoints: z.array(z.string()),
});

const InferenceOutputSchema = z.object({
  insights: z.array(InferenceInsightSchema),
});

export async function startInferenceRun(
  organizationId: string,
  projectId: string | null,
  sessionIds: string[],
  createdBy: string
): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO interview_inference_runs
     (id, organization_id, project_id, session_ids, status, created_by, created_at)
     VALUES (?, ?, ?, ?, 'running', ?, ?)`,
    [id, organizationId, projectId || null, JSON.stringify(sessionIds), createdBy, now]
  );

  return id;
}

export async function executeInference(
  organizationId: string,
  runId: string
): Promise<void> {
  const startTime = Date.now();

  const run = await dbGet(
    `SELECT * FROM interview_inference_runs WHERE id = ? AND organization_id = ?`,
    [runId, organizationId]
  );
  if (!run) {
    logger.error(`[Inference] Run ${runId} not found`);
    return;
  }

  try {
    const sessionIds: string[] =
      typeof (run as any).session_ids === 'string'
        ? JSON.parse((run as any).session_ids)
        : (run as any).session_ids || [];

    if (sessionIds.length === 0) {
      throw new Error('No session IDs provided for inference');
    }

    const placeholders = sessionIds.map(() => '?').join(', ');
    const answeredQuestions = await dbAll(
      `SELECT q.id, q.session_id, q.category, q.question_text, q.answer_text, q.confidence, q.needs_follow_up
       FROM interview_questions q
       WHERE q.session_id IN (${placeholders})
         AND q.organization_id = ?
         AND q.status = 'answered'
       ORDER BY q.category, q.sort_order`,
      [...sessionIds, organizationId]
    );

    const primaryEvidence = (answeredQuestions || []).filter(
      (q: any) => (q.confidence || 0) >= 3
    );
    const gaps = (answeredQuestions || []).filter(
      (q: any) => q.needs_follow_up === 1 || q.needs_follow_up === true
    );

    const orgContext = await dbGet(
      `SELECT * FROM organization_context WHERE organization_id = ?`,
      [organizationId]
    );

    const systemPrompt = `You are a senior management consultant performing structured analysis of interview data.
Your task is to generate categorized insights from interview responses.

Rules:
- Each insight must be grounded in evidence from the interviews.
- Categories: risk, opportunity, constraint, priority, trend, gap.
- Confidence score 1-5 based on evidence quality and consistency.
- Include assumptions you're making, unknowns that remain, and potential counterpoints.
- Be specific and actionable. Avoid generic statements.
- Return ONLY the structured JSON matching the schema.`;

    const userPrompt = `Organization context:
${orgContext ? JSON.stringify(orgContext, null, 2) : 'No organization context available.'}

Primary evidence (high-confidence answers):
${JSON.stringify(primaryEvidence.map((q: any) => ({
  id: q.id,
  sessionId: q.session_id,
  category: q.category,
  question: q.question_text,
  answer: q.answer_text,
  confidence: q.confidence,
})), null, 2)}

Gaps (needs follow-up):
${JSON.stringify(gaps.map((q: any) => ({
  id: q.id,
  sessionId: q.session_id,
  category: q.category,
  question: q.question_text,
  answer: q.answer_text,
})), null, 2)}

Analyze the above interview data and generate structured insights.`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: InferenceOutputSchema,
      maxTokens: 3000,
      temperature: 0.3,
      cache: false,
    });

    const output = (result as any).object || { insights: [] };
    const insights = output.insights || [];
    const now = new Date().toISOString();
    const tokensUsed = (result as any).usage?.totalTokens || 0;

    for (const insight of insights) {
      const insightId = uuidv4();
      await dbRun(
        `INSERT INTO interview_insights
         (id, organization_id, title, category, content, status,
          structured_content, evidence_links, unknowns, counterpoints, assumptions,
          confidence_score, inference_run_id, insight_category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insightId,
          organizationId,
          insight.statement.substring(0, 200),
          insight.category,
          insight.whyItMatters,
          JSON.stringify(insight),
          JSON.stringify(insight.evidence),
          JSON.stringify(insight.unknowns),
          JSON.stringify(insight.counterpoints),
          JSON.stringify(insight.assumptions),
          insight.confidenceScore,
          runId,
          insight.category,
          now,
          now,
        ]
      );
    }

    const generationTimeMs = Date.now() - startTime;
    await dbRun(
      `UPDATE interview_inference_runs
       SET status = 'completed', insights_count = ?, tokens_used = ?,
           generation_time_ms = ?, completed_at = ?
       WHERE id = ?`,
      [insights.length, tokensUsed, generationTimeMs, now, runId]
    );

    logger.info(`[Inference] Run ${runId} completed: ${insights.length} insights in ${generationTimeMs}ms`);
  } catch (err: any) {
    const errorMessage = err?.message || 'Unknown error';
    logger.error(`[Inference] Run ${runId} failed: ${errorMessage}`);

    await dbRun(
      `UPDATE interview_inference_runs
       SET status = 'failed', error_message = ?, completed_at = ?
       WHERE id = ?`,
      [errorMessage, new Date().toISOString(), runId]
    );
  }
}

export async function getInferenceRun(
  organizationId: string,
  runId: string
): Promise<Record<string, unknown> | null> {
  const row = await dbGet(
    `SELECT * FROM interview_inference_runs WHERE id = ? AND organization_id = ?`,
    [runId, organizationId]
  );
  if (!row) return null;

  return formatRun(row);
}

export async function getInferenceRuns(
  organizationId: string,
  projectId?: string
): Promise<Record<string, unknown>[]> {
  const params: unknown[] = [organizationId];
  let sql = `SELECT * FROM interview_inference_runs WHERE organization_id = ?`;

  if (projectId) {
    sql += ` AND project_id = ?`;
    params.push(projectId);
  }

  sql += ` ORDER BY created_at DESC LIMIT 50`;
  const rows = await dbAll(sql, params);
  return (rows || []).map(formatRun);
}

function formatRun(row: any): Record<string, unknown> {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    sessionIds: typeof row.session_ids === 'string' ? JSON.parse(row.session_ids) : (row.session_ids || []),
    status: row.status,
    insightsCount: row.insights_count,
    tokensUsed: row.tokens_used,
    generationTimeMs: row.generation_time_ms,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
