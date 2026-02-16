/**
 * Decision Audit Service (Enterprise)
 *
 * Full audit trail for Deep Thinking sessions.
 * Enables:
 * - Complete replay of decision-making process
 * - Compliance exports (PDF/JSON)
 * - Stage-by-stage analysis
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type AuditStage =
  | 'confirm_start'
  | 'confirm_understanding'
  | 'confirm_questions'
  | 'research_start'
  | 'research_queries'
  | 'research_sources'
  | 'research_complete'
  | 'reasoning_start'
  | 'reasoning_analysis'
  | 'reasoning_complete'
  | 'synthesis_start'
  | 'synthesis_options'
  | 'synthesis_recommendation'
  | 'synthesis_complete'
  | 'output_start'
  | 'output_quality_check'
  | 'output_revision'
  | 'output_complete'
  | 'user_feedback'
  | 'force_depth_trigger'
  | 'abort';

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  stage: AuditStage;
  payload?: Record<string, unknown> | null;
  inputSnapshot?: string | null;
  outputSnapshot?: string | null;
  dodCheckResult?: Record<string, unknown> | null;
  confidenceAtStage?: number | null;
  durationMs?: number | null;
  timestamp: string;
}

export interface AuditTrail {
  sessionId: string;
  organizationId: string;
  userId: string;
  startTime: string;
  endTime?: string | null;
  totalDurationMs: number;
  stages: AuditLogEntry[];
  summary: {
    stageCount: number;
    hasRevisions: boolean;
    wasAborted: boolean;
    forceDepthTriggered: boolean;
    finalDodResult?: Record<string, unknown> | null;
  };
}

// ==========================================
// SERVICE
// ==========================================

/**
 * Log a stage in the audit trail
 */
export async function logStage(args: {
  organizationId: string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  stage: AuditStage;
  payload?: Record<string, unknown> | null;
  inputSnapshot?: string | null;
  outputSnapshot?: string | null;
  dodCheckResult?: Record<string, unknown> | null;
  confidenceAtStage?: number | null;
  durationMs?: number | null;
}): Promise<string> {
  const id = `audit-${uuidv4()}`;

  try {
    await dbRun(
      `INSERT INTO ai_decision_audit_log (
        id, organization_id, user_id, session_id, conversation_id,
        stage, payload_json, input_snapshot, output_snapshot,
        dod_check_result, confidence_at_stage, duration_ms, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        args.organizationId,
        args.userId,
        args.sessionId,
        args.conversationId || null,
        args.stage,
        args.payload ? JSON.stringify(args.payload) : null,
        args.inputSnapshot || null,
        args.outputSnapshot || null,
        args.dodCheckResult ? JSON.stringify(args.dodCheckResult) : null,
        args.confidenceAtStage ?? null,
        args.durationMs ?? null,
      ]
    );

    logger.debug(`[DecisionAudit] Logged stage ${args.stage} for session ${args.sessionId}`);
    return id;
  } catch (err: any) {
    logger.error('[DecisionAudit] Failed to log stage:', err?.message || err);
    throw err;
  }
}

/**
 * Get full audit trail for a session
 */
export async function getAuditTrail(sessionId: string): Promise<AuditTrail | null> {
  const rows = (await dbAll(
    `SELECT * FROM ai_decision_audit_log
     WHERE session_id = ?
     ORDER BY timestamp ASC`,
    [sessionId]
  )) as any[];

  if (rows.length === 0) return null;

  const stages = rows.map(parseAuditRow);
  const first = stages[0];
  const last = stages[stages.length - 1];

  const startTime = new Date(first.timestamp).getTime();
  const endTime = new Date(last.timestamp).getTime();

  const hasRevisions = stages.some((s) => s.stage === 'output_revision');
  const wasAborted = stages.some((s) => s.stage === 'abort');
  const forceDepthTriggered = stages.some((s) => s.stage === 'force_depth_trigger');

  const outputComplete = stages.find((s) => s.stage === 'output_quality_check');

  return {
    sessionId,
    organizationId: first.organizationId,
    userId: first.userId,
    startTime: first.timestamp,
    endTime: last.stage.includes('complete') || last.stage === 'abort' ? last.timestamp : null,
    totalDurationMs: endTime - startTime,
    stages,
    summary: {
      stageCount: stages.length,
      hasRevisions,
      wasAborted,
      forceDepthTriggered,
      finalDodResult: outputComplete?.dodCheckResult || null,
    },
  };
}

/**
 * Get audit trails for an organization
 */
export async function getAuditTrails(args: {
  organizationId: string;
  limit?: number;
  offset?: number;
}): Promise<Array<{ sessionId: string; startTime: string; stageCount: number }>> {
  const { organizationId, limit = 50, offset = 0 } = args;

  const rows = (await dbAll(
    `SELECT session_id, MIN(timestamp) as start_time, COUNT(*) as stage_count
     FROM ai_decision_audit_log
     WHERE organization_id = ?
     GROUP BY session_id
     ORDER BY start_time DESC
     LIMIT ? OFFSET ?`,
    [organizationId, limit, offset]
  )) as any[];

  return rows.map((r) => ({
    sessionId: r.session_id,
    startTime: r.start_time,
    stageCount: r.stage_count,
  }));
}

/**
 * Export audit trail for compliance
 */
export async function exportForCompliance(
  sessionId: string,
  format: 'json' | 'pdf' = 'json'
): Promise<{
  format: string;
  data: string | Record<string, unknown>;
}> {
  const trail = await getAuditTrail(sessionId);
  if (!trail) throw new Error(`Audit trail not found for session ${sessionId}`);

  if (format === 'json') {
    return {
      format: 'json',
      data: trail as unknown as Record<string, unknown>,
    };
  }

  // For PDF, return structured data that frontend can render
  return {
    format: 'pdf',
    data: {
      title: `Decision Audit Report - ${sessionId}`,
      generatedAt: new Date().toISOString(),
      ...trail,
      stagesFormatted: trail.stages.map((s, i) => ({
        step: i + 1,
        stage: s.stage,
        timestamp: s.timestamp,
        duration: s.durationMs ? `${s.durationMs}ms` : 'N/A',
        hasOutput: Boolean(s.outputSnapshot),
      })),
    },
  };
}

/**
 * Delete old audit logs (GDPR compliance)
 */
export async function purgeOldAuditLogs(args: {
  organizationId: string;
  olderThanDays: number;
}): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - args.olderThanDays);
  const cutoffStr = cutoff.toISOString();

  const result = await dbRun(
    `DELETE FROM ai_decision_audit_log
     WHERE organization_id = ? AND timestamp < ?`,
    [args.organizationId, cutoffStr]
  );

  const deleted = (result as any)?.changes || 0;
  logger.info(`[DecisionAudit] Purged ${deleted} audit logs older than ${args.olderThanDays} days`);
  return deleted;
}

// ==========================================
// HELPERS
// ==========================================

function parseAuditRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    sessionId: row.session_id,
    conversationId: row.conversation_id || null,
    stage: row.stage,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    inputSnapshot: row.input_snapshot || null,
    outputSnapshot: row.output_snapshot || null,
    dodCheckResult: row.dod_check_result ? JSON.parse(row.dod_check_result) : null,
    confidenceAtStage: row.confidence_at_stage ?? null,
    durationMs: row.duration_ms ?? null,
    timestamp: row.timestamp,
  };
}
