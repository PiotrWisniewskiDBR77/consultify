/**
 * V8 Workspace AI Facilitation Service
 *
 * AI-driven session facilitation capabilities:
 * - AI suggestions lifecycle (generate → accept / dismiss / expire)
 * - Session insights recording and retrieval
 * - Collaborative decisions with voting and closure
 * - Session AI summary aggregation
 *
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  AISuggestion,
  SessionInsight,
  CollaborativeDecision,
  DecisionOption,
  SuggestionState,
  InsightSeverity,
  DecisionStatus,
  GenerateSuggestionParams,
  RecordInsightParams,
  CreateDecisionParams,
  SessionAISummary,
} from '../../types/workspaceAIFacilitation.js';
import {
  GenerateSuggestionParamsSchema,
  RecordInsightParamsSchema,
  CreateDecisionParamsSchema,
} from '../../types/workspaceAIFacilitation.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:WorkspaceAIFacilitation]';

const DEFAULT_STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface SuggestionRow {
  suggestion_id: string;
  session_id: string;
  organization_id: string;
  suggestion_type: string;
  state: string;
  content: string;
  confidence: number;
  source_snapshot_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface InsightRow {
  insight_id: string;
  session_id: string;
  organization_id: string;
  insight_type: string;
  title: string;
  body: string;
  severity: string;
  created_at: string;
}

interface DecisionRow {
  decision_id: string;
  session_id: string;
  organization_id: string;
  question: string;
  options: string;
  status: string;
  outcome: string | null;
  created_at: string;
  closed_at: string | null;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToSuggestion(row: SuggestionRow): AISuggestion {
  return {
    suggestionId: row.suggestion_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    suggestionType: row.suggestion_type as AISuggestion['suggestionType'],
    state: row.state as SuggestionState,
    content: row.content,
    confidence: row.confidence,
    sourceSnapshotId: row.source_snapshot_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

function rowToInsight(row: InsightRow): SessionInsight {
  return {
    insightId: row.insight_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    insightType: row.insight_type,
    title: row.title,
    body: row.body,
    severity: row.severity as InsightSeverity,
    createdAt: row.created_at,
  };
}

function rowToDecision(row: DecisionRow): CollaborativeDecision {
  return {
    decisionId: row.decision_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    question: row.question,
    options: safeJsonParse<DecisionOption[]>(row.options, []),
    status: row.status as DecisionStatus,
    outcome: row.outcome,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

// ==========================================
// PUBLIC API — AI SUGGESTIONS
// ==========================================

/**
 * Generate an AI suggestion for a facilitation session.
 */
export async function generateSuggestion(
  params: GenerateSuggestionParams,
): Promise<AISuggestion> {
  const validated = GenerateSuggestionParamsSchema.parse(params);

  const suggestionId = uuidv4();
  const now = new Date().toISOString();

  const suggestion: AISuggestion = {
    suggestionId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    suggestionType: validated.suggestionType,
    state: 'pending',
    content: validated.content,
    confidence: validated.confidence,
    sourceSnapshotId: validated.sourceSnapshotId,
    createdAt: now,
    resolvedAt: null,
    resolvedBy: null,
  };

  await dbRun(
    `INSERT INTO v8_ai_suggestions (
      suggestion_id, session_id, organization_id, suggestion_type,
      state, content, confidence, source_snapshot_id,
      created_at, resolved_at, resolved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      suggestion.suggestionId,
      suggestion.sessionId,
      suggestion.organizationId,
      suggestion.suggestionType,
      suggestion.state,
      suggestion.content,
      suggestion.confidence,
      suggestion.sourceSnapshotId,
      suggestion.createdAt,
      suggestion.resolvedAt,
      suggestion.resolvedBy,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Generated suggestion ${suggestionId} (${validated.suggestionType}) ` +
    `for session ${validated.sessionId}`,
  );

  return suggestion;
}

/**
 * Get suggestions for a session, optionally filtered by state.
 */
export async function getSuggestions(
  sessionId: string,
  organizationId: string,
  state?: SuggestionState,
): Promise<AISuggestion[]> {
  if (state) {
    const rows = await dbAll<SuggestionRow>(
      `SELECT * FROM v8_ai_suggestions
       WHERE session_id = ? AND organization_id = ? AND state = ?
       ORDER BY created_at DESC`,
      [sessionId, organizationId, state],
      { fallback: true },
    );
    return (rows || []).map(rowToSuggestion);
  }

  const rows = await dbAll<SuggestionRow>(
    `SELECT * FROM v8_ai_suggestions
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return (rows || []).map(rowToSuggestion);
}

/**
 * Accept a pending suggestion.
 */
export async function acceptSuggestion(
  suggestionId: string,
  organizationId: string,
  acceptedBy: string,
): Promise<AISuggestion> {
  const row = await dbGet<SuggestionRow>(
    `SELECT * FROM v8_ai_suggestions
     WHERE suggestion_id = ? AND organization_id = ?`,
    [suggestionId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Suggestion ${suggestionId} not found in organization ${organizationId}`);
  }

  if (row.state !== 'pending') {
    throw new Error(
      `Cannot accept suggestion ${suggestionId}: current state is '${row.state}', expected 'pending'`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_ai_suggestions
     SET state = 'accepted', resolved_at = ?, resolved_by = ?
     WHERE suggestion_id = ? AND organization_id = ?`,
    [now, acceptedBy, suggestionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Suggestion ${suggestionId} accepted by ${acceptedBy}`);

  return {
    ...rowToSuggestion(row),
    state: 'accepted',
    resolvedAt: now,
    resolvedBy: acceptedBy,
  };
}

/**
 * Dismiss a pending suggestion.
 */
export async function dismissSuggestion(
  suggestionId: string,
  organizationId: string,
  dismissedBy: string,
): Promise<AISuggestion> {
  const row = await dbGet<SuggestionRow>(
    `SELECT * FROM v8_ai_suggestions
     WHERE suggestion_id = ? AND organization_id = ?`,
    [suggestionId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Suggestion ${suggestionId} not found in organization ${organizationId}`);
  }

  if (row.state !== 'pending') {
    throw new Error(
      `Cannot dismiss suggestion ${suggestionId}: current state is '${row.state}', expected 'pending'`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_ai_suggestions
     SET state = 'dismissed', resolved_at = ?, resolved_by = ?
     WHERE suggestion_id = ? AND organization_id = ?`,
    [now, dismissedBy, suggestionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Suggestion ${suggestionId} dismissed by ${dismissedBy}`);

  return {
    ...rowToSuggestion(row),
    state: 'dismissed',
    resolvedAt: now,
    resolvedBy: dismissedBy,
  };
}

/**
 * Expire stale pending suggestions older than the threshold.
 */
export async function expireStaleSuggestions(
  sessionId: string,
  organizationId: string,
  maxAgeMs: number = DEFAULT_STALE_THRESHOLD_MS,
): Promise<AISuggestion[]> {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const now = new Date().toISOString();

  const staleRows = await dbAll<SuggestionRow>(
    `SELECT * FROM v8_ai_suggestions
     WHERE session_id = ? AND organization_id = ? AND state = 'pending'
       AND created_at < ?
     ORDER BY created_at ASC`,
    [sessionId, organizationId, cutoff],
    { fallback: true },
  );

  const rows = staleRows || [];
  if (rows.length === 0) return [];

  await dbRun(
    `UPDATE v8_ai_suggestions
     SET state = 'expired', resolved_at = ?
     WHERE session_id = ? AND organization_id = ? AND state = 'pending'
       AND created_at < ?`,
    [now, sessionId, organizationId, cutoff],
  );

  logger.info(
    `${LOG_PREFIX} Expired ${rows.length} stale suggestions in session ${sessionId}`,
  );

  return rows.map((r) => ({
    ...rowToSuggestion(r),
    state: 'expired' as const,
    resolvedAt: now,
  }));
}

// ==========================================
// PUBLIC API — SESSION INSIGHTS
// ==========================================

/**
 * Record a session insight.
 */
export async function recordInsight(
  params: RecordInsightParams,
): Promise<SessionInsight> {
  const validated = RecordInsightParamsSchema.parse(params);

  const insightId = uuidv4();
  const now = new Date().toISOString();

  const insight: SessionInsight = {
    insightId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    insightType: validated.insightType,
    title: validated.title,
    body: validated.body,
    severity: validated.severity,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_session_insights (
      insight_id, session_id, organization_id, insight_type,
      title, body, severity, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      insight.insightId,
      insight.sessionId,
      insight.organizationId,
      insight.insightType,
      insight.title,
      insight.body,
      insight.severity,
      insight.createdAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded insight ${insightId} (${validated.severity}) ` +
    `for session ${validated.sessionId}`,
  );

  return insight;
}

/**
 * Get insights for a session, optionally filtered by severity.
 */
export async function getInsights(
  sessionId: string,
  organizationId: string,
  severity?: InsightSeverity,
): Promise<SessionInsight[]> {
  if (severity) {
    const rows = await dbAll<InsightRow>(
      `SELECT * FROM v8_session_insights
       WHERE session_id = ? AND organization_id = ? AND severity = ?
       ORDER BY created_at DESC`,
      [sessionId, organizationId, severity],
      { fallback: true },
    );
    return (rows || []).map(rowToInsight);
  }

  const rows = await dbAll<InsightRow>(
    `SELECT * FROM v8_session_insights
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return (rows || []).map(rowToInsight);
}

// ==========================================
// PUBLIC API — COLLABORATIVE DECISIONS
// ==========================================

/**
 * Create a collaborative decision with voting options.
 */
export async function createCollaborativeDecision(
  params: CreateDecisionParams,
): Promise<CollaborativeDecision> {
  const validated = CreateDecisionParamsSchema.parse(params);

  const decisionId = uuidv4();
  const now = new Date().toISOString();

  const options: DecisionOption[] = validated.options.map((o) => ({
    optionId: o.optionId,
    label: o.label,
    votes: [],
  }));

  const decision: CollaborativeDecision = {
    decisionId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    question: validated.question,
    options,
    status: 'open',
    outcome: null,
    createdAt: now,
    closedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_collaborative_decisions (
      decision_id, session_id, organization_id, question,
      options, status, outcome, created_at, closed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      decision.decisionId,
      decision.sessionId,
      decision.organizationId,
      decision.question,
      JSON.stringify(decision.options),
      decision.status,
      decision.outcome,
      decision.createdAt,
      decision.closedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created decision ${decisionId} with ${options.length} options ` +
    `for session ${validated.sessionId}`,
  );

  return decision;
}

/**
 * Cast a vote on an open decision. Each voter can vote once per option.
 */
export async function voteOnDecision(
  decisionId: string,
  optionId: string,
  voterId: string,
  organizationId: string,
): Promise<CollaborativeDecision> {
  const row = await dbGet<DecisionRow>(
    `SELECT * FROM v8_collaborative_decisions
     WHERE decision_id = ? AND organization_id = ?`,
    [decisionId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Decision ${decisionId} not found in organization ${organizationId}`);
  }

  if (row.status !== 'open') {
    throw new Error(`Decision ${decisionId} is closed — voting is not allowed`);
  }

  const options = safeJsonParse<DecisionOption[]>(row.options, []);
  const targetOption = options.find((o) => o.optionId === optionId);

  if (!targetOption) {
    throw new Error(`Option ${optionId} not found in decision ${decisionId}`);
  }

  if (targetOption.votes.includes(voterId)) {
    throw new Error(`Voter ${voterId} has already voted for option ${optionId}`);
  }

  targetOption.votes.push(voterId);

  await dbRun(
    `UPDATE v8_collaborative_decisions
     SET options = ?
     WHERE decision_id = ? AND organization_id = ?`,
    [JSON.stringify(options), decisionId, organizationId],
  );

  logger.info(
    `${LOG_PREFIX} Vote recorded: ${voterId} → option ${optionId} on decision ${decisionId}`,
  );

  return {
    ...rowToDecision(row),
    options,
  };
}

/**
 * Close a decision with an outcome.
 */
export async function closeDecision(
  decisionId: string,
  organizationId: string,
  outcome: string,
): Promise<CollaborativeDecision> {
  const row = await dbGet<DecisionRow>(
    `SELECT * FROM v8_collaborative_decisions
     WHERE decision_id = ? AND organization_id = ?`,
    [decisionId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Decision ${decisionId} not found in organization ${organizationId}`);
  }

  if (row.status !== 'open') {
    throw new Error(`Decision ${decisionId} is already closed`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_collaborative_decisions
     SET status = 'closed', outcome = ?, closed_at = ?
     WHERE decision_id = ? AND organization_id = ?`,
    [outcome, now, decisionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Decision ${decisionId} closed with outcome: ${outcome}`);

  return {
    ...rowToDecision(row),
    status: 'closed',
    outcome,
    closedAt: now,
  };
}

/**
 * Get decisions for a session, optionally filtered by status.
 */
export async function getDecisions(
  sessionId: string,
  organizationId: string,
  status?: DecisionStatus,
): Promise<CollaborativeDecision[]> {
  if (status) {
    const rows = await dbAll<DecisionRow>(
      `SELECT * FROM v8_collaborative_decisions
       WHERE session_id = ? AND organization_id = ? AND status = ?
       ORDER BY created_at DESC`,
      [sessionId, organizationId, status],
      { fallback: true },
    );
    return (rows || []).map(rowToDecision);
  }

  const rows = await dbAll<DecisionRow>(
    `SELECT * FROM v8_collaborative_decisions
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return (rows || []).map(rowToDecision);
}

// ==========================================
// PUBLIC API — SESSION AI SUMMARY
// ==========================================

/**
 * Aggregate AI summary for a session: suggestion counts by state,
 * insight counts by severity, and open decisions count.
 */
export async function getSessionAISummary(
  sessionId: string,
  organizationId: string,
): Promise<SessionAISummary> {
  const suggestions = await dbAll<SuggestionRow>(
    `SELECT * FROM v8_ai_suggestions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );

  const insights = await dbAll<InsightRow>(
    `SELECT * FROM v8_session_insights
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );

  const decisions = await dbAll<DecisionRow>(
    `SELECT * FROM v8_collaborative_decisions
     WHERE session_id = ? AND organization_id = ? AND status = 'open'`,
    [sessionId, organizationId],
    { fallback: true },
  );

  const suggestionCounts: Record<string, number> = {
    pending: 0,
    accepted: 0,
    dismissed: 0,
    expired: 0,
  };
  for (const s of suggestions || []) {
    const state = s.state as string;
    if (state in suggestionCounts) {
      suggestionCounts[state]++;
    }
  }

  const insightCounts: Record<string, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  };
  for (const i of insights || []) {
    const sev = i.severity as string;
    if (sev in insightCounts) {
      insightCounts[sev]++;
    }
  }

  logger.info(
    `${LOG_PREFIX} Session AI summary for ${sessionId}: ` +
    `suggestions=${(suggestions || []).length}, insights=${(insights || []).length}, ` +
    `openDecisions=${(decisions || []).length}`,
  );

  return {
    sessionId,
    organizationId,
    suggestions: suggestionCounts as Record<SuggestionState, number>,
    insights: insightCounts as Record<InsightSeverity, number>,
    openDecisions: (decisions || []).length,
  };
}
