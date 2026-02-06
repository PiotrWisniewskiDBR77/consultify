/**
 * Decision Memory Service (Enterprise)
 *
 * Tracks decisions made via Deep Thinking mode and their outcomes.
 * Enables organizational learning: "What happened last time we chose this?"
 *
 * Features:
 * - Record decisions with full context
 * - Track outcomes (positive/negative/neutral)
 * - Find similar historical decisions via embedding
 * - Inject historical context into new Deep Thinking sessions
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type OutcomeStatus = 'pending' | 'positive' | 'negative' | 'neutral' | 'mixed';

export interface DecisionRecord {
  id: string;
  organizationId: string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  decisionSummary: string;
  problemFraming?: string | null;
  optionsConsidered: string[];
  chosenOption?: string | null;
  recommendationText?: string | null;
  confidenceScore?: number | null;
  outcomeStatus: OutcomeStatus;
  outcomeNotes?: string | null;
  outcomeMetrics?: Record<string, unknown> | null;
  followUpDate?: string | null;
  industryContext?: string | null;
  tags: string[];
  createdAt: string;
  resolvedAt?: string | null;
}

export interface RecordDecisionInput {
  organizationId: string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  decisionSummary: string;
  problemFraming?: string | null;
  optionsConsidered?: string[];
  chosenOption?: string | null;
  recommendationText?: string | null;
  confidenceScore?: number | null;
  industryContext?: string | null;
  tags?: string[];
}

export interface RecordOutcomeInput {
  decisionId: string;
  outcomeStatus: OutcomeStatus;
  outcomeNotes?: string | null;
  outcomeMetrics?: Record<string, unknown> | null;
}

export interface SimilarDecision {
  decision: DecisionRecord;
  similarity: number;
}

// ==========================================
// SERVICE
// ==========================================

/**
 * Record a new decision made via Deep Thinking
 */
export async function recordDecision(input: RecordDecisionInput): Promise<string> {
  const id = `dec-${uuidv4()}`;
  const now = new Date().toISOString();

  try {
    await dbRun(
      `INSERT INTO ai_decision_outcomes (
        id, organization_id, user_id, session_id, conversation_id,
        decision_summary, problem_framing, options_considered, chosen_option,
        recommendation_text, confidence_score, industry_context, tags,
        outcome_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        input.organizationId,
        input.userId,
        input.sessionId,
        input.conversationId || null,
        input.decisionSummary,
        input.problemFraming || null,
        JSON.stringify(input.optionsConsidered || []),
        input.chosenOption || null,
        input.recommendationText || null,
        input.confidenceScore ?? null,
        input.industryContext || null,
        JSON.stringify(input.tags || []),
        now,
        now,
      ]
    );

    logger.info(`[DecisionMemory] Recorded decision ${id} for org ${input.organizationId}`);
    return id;
  } catch (err: any) {
    logger.error('[DecisionMemory] Failed to record decision:', err?.message || err);
    throw err;
  }
}

/**
 * Record the outcome of a previously made decision
 */
export async function recordOutcome(input: RecordOutcomeInput): Promise<void> {
  const now = new Date().toISOString();

  try {
    await dbRun(
      `UPDATE ai_decision_outcomes SET
        outcome_status = ?,
        outcome_notes = ?,
        outcome_metrics = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        input.outcomeStatus,
        input.outcomeNotes || null,
        input.outcomeMetrics ? JSON.stringify(input.outcomeMetrics) : null,
        now,
        now,
        input.decisionId,
      ]
    );

    logger.info(
      `[DecisionMemory] Recorded outcome for decision ${input.decisionId}: ${input.outcomeStatus}`
    );
  } catch (err: any) {
    logger.error('[DecisionMemory] Failed to record outcome:', err?.message || err);
    throw err;
  }
}

/**
 * Get a specific decision by ID
 */
export async function getDecision(decisionId: string): Promise<DecisionRecord | null> {
  const row = (await dbGet(`SELECT * FROM ai_decision_outcomes WHERE id = ?`, [decisionId])) as any;

  if (!row) return null;
  return parseDecisionRow(row);
}

/**
 * Get decisions for an organization with optional filters
 */
export async function getDecisions(args: {
  organizationId: string;
  status?: OutcomeStatus;
  limit?: number;
  offset?: number;
}): Promise<DecisionRecord[]> {
  const { organizationId, status, limit = 50, offset = 0 } = args;

  let query = `SELECT * FROM ai_decision_outcomes WHERE organization_id = ?`;
  const params: any[] = [organizationId];

  if (status) {
    query += ` AND outcome_status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = (await dbAll(query, params)) as any[];
  return rows.map(parseDecisionRow);
}

/**
 * Get pending decisions that need follow-up
 */
export async function getPendingFollowUps(organizationId: string): Promise<DecisionRecord[]> {
  const today = new Date().toISOString().split('T')[0];

  const rows = (await dbAll(
    `SELECT * FROM ai_decision_outcomes
     WHERE organization_id = ?
       AND outcome_status = 'pending'
       AND follow_up_date IS NOT NULL
       AND follow_up_date <= ?
     ORDER BY follow_up_date ASC`,
    [organizationId, today]
  )) as any[];

  return rows.map(parseDecisionRow);
}

/**
 * Find similar historical decisions using text matching
 * (In production, this would use vector embeddings for semantic similarity)
 */
export async function findSimilarDecisions(args: {
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<SimilarDecision[]> {
  const { organizationId, query, limit = 5 } = args;
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 3);

  // Get recent decisions with resolved outcomes (learning value)
  const rows = (await dbAll(
    `SELECT * FROM ai_decision_outcomes
     WHERE organization_id = ?
       AND outcome_status != 'pending'
     ORDER BY created_at DESC
     LIMIT 100`,
    [organizationId]
  )) as any[];

  // Score by keyword overlap (simple heuristic; embeddings would be better)
  const scored: SimilarDecision[] = rows.map((row: any) => {
    const decision = parseDecisionRow(row);
    const text = [
      decision.decisionSummary,
      decision.problemFraming,
      decision.recommendationText,
      ...(decision.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (text.includes(word)) matches++;
    }

    const similarity = queryWords.length > 0 ? matches / queryWords.length : 0;
    return { decision, similarity };
  });

  return scored
    .filter((s) => s.similarity > 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Build historical context addon for Deep Thinking orchestrator
 */
export async function buildHistoricalContextAddon(args: {
  organizationId: string;
  currentProblem: string;
  language?: string;
}): Promise<string> {
  const { organizationId, currentProblem, language } = args;
  const similar = await findSimilarDecisions({
    organizationId,
    query: currentProblem,
    limit: 3,
  });

  if (similar.length === 0) return '';

  const isPolish = (language || 'en').startsWith('pl');
  const header = isPolish
    ? '## Kontekst Historyczny (Poprzednie Decyzje)'
    : '## Historical Context (Previous Decisions)';

  const items = similar.map((s, i) => {
    const d = s.decision;
    const outcomeLabel = isPolish
      ? {
          positive: 'pozytywny',
          negative: 'negatywny',
          neutral: 'neutralny',
          mixed: 'mieszany',
          pending: 'oczekujący',
        }[d.outcomeStatus]
      : d.outcomeStatus;

    return `${i + 1}. **${d.decisionSummary.slice(0, 100)}${d.decisionSummary.length > 100 ? '…' : ''}**
   - ${isPolish ? 'Wybrana opcja' : 'Chosen option'}: ${d.chosenOption || 'N/A'}
   - ${isPolish ? 'Wynik' : 'Outcome'}: ${outcomeLabel}${d.outcomeNotes ? ` — ${d.outcomeNotes.slice(0, 80)}` : ''}`;
  });

  return `\n${header}\n${isPolish ? 'Organizacja podejmowała podobne decyzje w przeszłości:' : 'The organization has made similar decisions before:'}\n\n${items.join('\n\n')}\n`;
}

/**
 * Set follow-up date for a decision
 */
export async function setFollowUpDate(decisionId: string, followUpDate: string): Promise<void> {
  await dbRun(`UPDATE ai_decision_outcomes SET follow_up_date = ?, updated_at = ? WHERE id = ?`, [
    followUpDate,
    new Date().toISOString(),
    decisionId,
  ]);
}

// ==========================================
// HELPERS
// ==========================================

function parseDecisionRow(row: any): DecisionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    sessionId: row.session_id,
    conversationId: row.conversation_id || null,
    decisionSummary: row.decision_summary,
    problemFraming: row.problem_framing || null,
    optionsConsidered: row.options_considered ? JSON.parse(row.options_considered) : [],
    chosenOption: row.chosen_option || null,
    recommendationText: row.recommendation_text || null,
    confidenceScore: row.confidence_score ?? null,
    outcomeStatus: row.outcome_status || 'pending',
    outcomeNotes: row.outcome_notes || null,
    outcomeMetrics: row.outcome_metrics ? JSON.parse(row.outcome_metrics) : null,
    followUpDate: row.follow_up_date || null,
    industryContext: row.industry_context || null,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
  };
}
