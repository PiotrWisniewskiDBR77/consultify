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
import organizationContextService from './organizationContext/OrganizationContextService.js';

const INSIGHT_CATEGORIES = [
  'risk',
  'opportunity',
  'constraint',
  'priority',
  'trend',
  'gap',
] as const;
type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

/**
 * I4 — interview_insights schema coherence (no-delete fix).
 *
 * The `interview_insights` table is written by three generations with disjoint
 * column sets: the base (305) migration only guarantees the Gen-2 columns; the
 * Gen-1 inference columns are added by `20260222_interview_conversational_inference.sql`,
 * which may not have run in an environment where DB_MANAGED_SCHEMA is off. The
 * blind INSERT below would then throw `column ... does not exist` and mark the
 * inference run failed. This lazy-ensure ALTERs in every column the inference
 * INSERT writes, idempotently (`ADD COLUMN IF NOT EXISTS`), so the write is
 * always safe regardless of migration state. Runs once per process.
 */
let inferenceColumnsEnsured = false;
async function ensureInferenceInsightColumns(): Promise<void> {
  if (inferenceColumnsEnsured) return;
  const alters = [
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS structured_content JSONB`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS evidence_links JSONB DEFAULT '[]'::JSONB`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS unknowns JSONB DEFAULT '[]'::JSONB`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS counterpoints JSONB DEFAULT '[]'::JSONB`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS assumptions JSONB DEFAULT '[]'::JSONB`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS confidence_score INTEGER`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS inference_run_id TEXT`,
    `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS insight_category TEXT`,
  ];
  for (const sql of alters) {
    try {
      await dbRun(sql, []);
    } catch (err) {
      const message = String((err as Error)?.message || err || '');
      // SQLite doesn't support ADD COLUMN IF NOT EXISTS; tolerate the dupe/
      // syntax errors so the ensure is portable across both engines.
      if (
        !message.includes('duplicate column') &&
        !message.includes('already exists') &&
        !message.toLowerCase().includes('syntax')
      ) {
        logger.warn('[interviewInference] ensure column failed', { sql, message });
      }
    }
  }
  inferenceColumnsEnsured = true;
}

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

export async function executeInference(organizationId: string, runId: string): Promise<void> {
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
      `SELECT q.id, q.session_id, q.category, q.question_text, q.answer_text, q.confidence_score, q.status
       FROM interview_questions q
       WHERE q.session_id IN (${placeholders})
         AND q.organization_id = ?
         AND q.status IN ('answered', 'needs_follow_up')
       ORDER BY q.category, q.sort_order`,
      [...sessionIds, organizationId]
    );

    const primaryEvidence = (answeredQuestions || []).filter(
      (q: any) => (q.confidence_score || 0) >= 3
    );
    const gaps = (answeredQuestions || []).filter((q: any) => q.status === 'needs_follow_up');

    const orgContext = await organizationContextService
      .buildResolvedContext(organizationId)
      .catch(() => null);

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
${JSON.stringify(
  primaryEvidence.map((q: any) => ({
    id: q.id,
    sessionId: q.session_id,
    category: q.category,
    question: q.question_text,
    answer: q.answer_text,
    confidence: q.confidence_score,
  })),
  null,
  2
)}

Gaps (needs follow-up):
${JSON.stringify(
  gaps.map((q: any) => ({
    id: q.id,
    sessionId: q.session_id,
    category: q.category,
    question: q.question_text,
    answer: q.answer_text,
  })),
  null,
  2
)}

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

    // I4 — guarantee the Gen-1 columns exist before the blind INSERT so the
    // write never throws on a DB provisioned only for the Gen-2 base schema.
    await ensureInferenceInsightColumns();

    // FIX (NOT-NULL sweep): interview_insights.created_by is NOT NULL with no DB
    // default (Postgres) — this loop never wrote it, which 500s with 23502. The
    // run row (fetched above) carries the original requester's id.
    const insightCreatedBy = (run as any).created_by || 'system';
    for (const insight of insights) {
      const insightId = uuidv4();
      await dbRun(
        `INSERT INTO interview_insights
         (id, organization_id, title, category, content, status,
          structured_content, evidence_links, unknowns, counterpoints, assumptions,
          confidence_score, inference_run_id, insight_category, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          insightCreatedBy,
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

    logger.info(
      `[Inference] Run ${runId} completed: ${insights.length} insights in ${generationTimeMs}ms`
    );
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
    sessionIds:
      typeof row.session_ids === 'string' ? JSON.parse(row.session_ids) : row.session_ids || [],
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
