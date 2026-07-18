import { v4 as uuidv4 } from 'uuid';

import { all as "dbAll", get as "dbGet", run as "dbRun" } from '../../../utils/DbPromise.js';
import { logAgentAuditEvent } from './agentAuditMetricsService.js';

function isMustHaveQuestion(q: unknown): boolean {
  const t = String(q || '').trim();
  return /^MUST\s*:|^MUST_HAVE\s*:|must-have/i.test(t);
}

function summarizeAuditKpis(args: {
  selectedAgentIds: string[];
  reviews: Array<{ agentId: string; overreach?: string | null; review: Record<string, unknown> }>;
  verdict: Record<string, unknown> | null;
}): Record<string, unknown> {
  const selected = Array.isArray(args.selectedAgentIds) ? args.selectedAgentIds : [];
  const reviews = Array.isArray(args.reviews) ? args.reviews : [];
  const verdict: any = args.verdict || {};

  const validReviews = reviews.filter((r) => String(r?.overreach || '') !== 'hard');

  let findingsTotal = 0;
  let conflictsTotal = 0;
  let mustHaveTotal = 0;

  for (const r of validReviews) {
    const rev: any = r.review || {};
    const findings = Array.isArray(rev?.findings) ? rev.findings : [];
    const conflicts = Array.isArray(rev?.conflicts) ? rev.conflicts : [];
    findingsTotal += findings.length;
    conflictsTotal += conflicts.length;

    for (const f of findings) {
      const qs = Array.isArray(f?.missingDataQuestions) ? f.missingDataQuestions : [];
      mustHaveTotal += qs.filter(isMustHaveQuestion).length;
    }
  }

  const agentsTotal = selected.length;
  const agentsValid = validReviews.length;
  const agentsRejected = reviews.filter((r) => String(r?.overreach || '') === 'hard').length;
  const conflictRate = agentsValid > 0 ? conflictsTotal / agentsValid : 0;

  const criticalHighCount = Array.isArray(verdict?.criticalRisks)
    ? verdict.criticalRisks.length
    : 0;
  const gatesTriggered = Array.isArray(verdict?.gatesTriggered) ? verdict.gatesTriggered : [];
  const sourcesCounts = verdict?.sourcesSummary?.counts || null;

  return {
    agentsTotal,
    agentsValid,
    agentsRejected,
    findingsTotal,
    conflictsTotal,
    conflictRate: Math.round(conflictRate * 1000) / 1000,
    mustHaveTotal,
    criticalHighCount,
    gatesTriggered,
    sourcesCounts,
  };
}

export async function createAgentAuditRun(args: {
  id: string;
  organizationId: string;
  userId: string;
  conversationId?: string | null;
  dtSessionId?: string | null;
  userIntent: string;
  loopIteration: number;
  decisionContext: Record<string, unknown> | null;
  selectedAgentIds: string[];
  verdict: Record<string, unknown> | null;
  reviews: Array<{ agentId: string; overreach?: string | null; review: Record<string, unknown> }>;
}) {
  await dbRun(
    `INSERT INTO ai_agent_audit_runs
      (id, organization_id, user_id, conversation_id, dt_session_id, user_intent, loop_iteration,
       decision_context_json, selected_agent_ids_json, verdict_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      args.id,
      args.organizationId,
      args.userId,
      args.conversationId || null,
      args.dtSessionId || null,
      args.userIntent,
      args.loopIteration,
      args.decisionContext ? JSON.stringify(args.decisionContext) : null,
      JSON.stringify(args.selectedAgentIds || []),
      args.verdict ? JSON.stringify(args.verdict) : null,
    ]
  );

  for (const r of args.reviews || []) {
    await dbRun(
      `INSERT INTO ai_agent_audit_reviews (run_id, agent_id, overreach, review_json, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [args.id, r.agentId, r.overreach || null, JSON.stringify(r.review || {})]
    );
  }

  // Metrics (best-effort): completed + loop trigger
  try {
    const verdict: any = args.verdict || {};
    const kpis = summarizeAuditKpis({
      selectedAgentIds: args.selectedAgentIds || [],
      reviews: args.reviews || [],
      verdict: args.verdict || null,
    });
    await logAgentAuditEvent({
      organizationId: args.organizationId,
      userId: args.userId,
      runId: args.id,
      conversationId: args.conversationId || null,
      eventType: 'run_completed',
      payload: {
        qualityStatus: verdict?.qualityStatus || null,
        gatesTriggered: verdict?.gatesTriggered || [],
        loopIteration: args.loopIteration,
        agentsSummary: verdict?.agentsSummary || [],
        sourcesCounts: verdict?.sourcesSummary?.counts || null,
        kpis,
      },
    });

    if (verdict?.directedLoop?.deepThinkingPrompt) {
      await logAgentAuditEvent({
        organizationId: args.organizationId,
        userId: args.userId,
        runId: args.id,
        conversationId: args.conversationId || null,
        eventType: 'loop_triggered',
        payload: {
          loopIteration: args.loopIteration,
          gatesTriggered: verdict?.gatesTriggered || [],
        },
      });
    }
  } catch {
    // ignore
  }

  // Observability (best-effort): log run summary to activity_logs
  try {
    const verdict: any = args.verdict || {};
    const gates = Array.isArray(verdict?.gatesTriggered) ? verdict.gatesTriggered : [];
    const kpis = summarizeAuditKpis({
      selectedAgentIds: args.selectedAgentIds || [],
      reviews: args.reviews || [],
      verdict: args.verdict || null,
    });
    const sourcesCount = { dt_section: 0, kb_snippet: 0, web_source: 0 };
    for (const r of args.reviews || []) {
      const review: any = r.review || {};
      const findings = Array.isArray(review?.findings) ? review.findings : [];
      for (const f of findings) {
        const su = Array.isArray(f?.sourcesUsed) ? f.sourcesUsed : [];
        for (const s of su) {
          if (s?.type === 'dt_section') sourcesCount.dt_section += 1;
          if (s?.type === 'kb_snippet') sourcesCount.kb_snippet += 1;
          if (s?.type === 'web_source') sourcesCount.web_source += 1;
        }
      }
    }

    await dbRun(
      `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
       VALUES (?, ?, ?, 'agent_audit_completed', 'agent_audit', ?, ?, CURRENT_TIMESTAMP)`,
      [
        uuidv4(),
        args.organizationId,
        args.userId,
        args.id,
        JSON.stringify({
          qualityStatus: verdict?.qualityStatus || null,
          gatesTriggered: gates,
          loopIteration: args.loopIteration,
          selectedAgentsCount: (args.selectedAgentIds || []).length,
          agentsSummary: verdict?.agentsSummary || null,
          kbDocs: verdict?.sourcesSummary?.kb || null,
          webSources: verdict?.sourcesSummary?.web || null,
          sourcesCount,
          kpis,
        }),
      ],
      { fallback: true } as any
    );
  } catch {
    // ignore
  }
}

export async function getAgentAuditRun(args: { runId: string; organizationId: string }): Promise<{
  id: string;
  organizationId: string;
  userId: string;
  conversationId: string | null;
  dtSessionId: string | null;
  userIntent: string;
  loopIteration: number;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
  acceptedNote?: string | null;
  decisionContext: any | null;
  selectedAgentIds: string[];
  verdict: any | null;
  createdAt: string;
  updatedAt: string;
  reviews: Array<{
    id: number;
    agentId: string;
    overreach: string | null;
    review: any;
    createdAt: string;
  }>;
} | null> {
  const row = (await dbGet(
    `SELECT
        id,
        organization_id as "organizationId",
        user_id as "userId",
        conversation_id as "conversationId",
        dt_session_id as "dtSessionId",
        user_intent as "userIntent",
        loop_iteration as "loopIteration",
        accepted_at as "acceptedAt",
        accepted_by_user_id as "acceptedByUserId",
        accepted_note as "acceptedNote",
        decision_context_json as "decisionContextJson",
        selected_agent_ids_json as "selectedAgentIdsJson",
        verdict_json as "verdictJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM ai_agent_audit_runs
      WHERE id = ? AND organization_id = ?
      LIMIT 1`,
    [args.runId, args.organizationId]
  ).catch(() => null)) as any;

  if (!row?.id) return null;

  const reviews = (await dbAll(
    `SELECT
        id,
        agent_id as "agentId",
        overreach,
        review_json as "reviewJson",
        created_at as "createdAt"
      FROM ai_agent_audit_reviews
      WHERE run_id = ?
      ORDER BY id ASC`,
    [row.id]
  ).catch(() => [])) as any[];

  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    userId: String(row.userId),
    conversationId: row.conversationId ? String(row.conversationId) : null,
    dtSessionId: row.dtSessionId ? String(row.dtSessionId) : null,
    userIntent: String(row.userIntent || ''),
    loopIteration: Number(row.loopIteration || 1),
    acceptedAt: row.acceptedAt ? String(row.acceptedAt) : null,
    acceptedByUserId: row.acceptedByUserId ? String(row.acceptedByUserId) : null,
    acceptedNote: row.acceptedNote ? String(row.acceptedNote) : null,
    decisionContext: row.decisionContextJson ? JSON.parse(String(row.decisionContextJson)) : null,
    selectedAgentIds: row.selectedAgentIdsJson ? JSON.parse(String(row.selectedAgentIdsJson)) : [],
    verdict: row.verdictJson ? JSON.parse(String(row.verdictJson)) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    reviews: (reviews || []).map((r) => ({
      id: Number(r.id),
      agentId: String(r.agentId || ''),
      overreach: r.overreach ? String(r.overreach) : null,
      review: r.reviewJson ? JSON.parse(String(r.reviewJson)) : {},
      createdAt: String(r.createdAt),
    })),
  };
}

export async function acceptAgentAuditRun(args: {
  runId: string;
  organizationId: string;
  userId: string;
  note?: string | null;
}) {
  await dbRun(
    `UPDATE ai_agent_audit_runs
     SET accepted_at = CURRENT_TIMESTAMP,
         accepted_by_user_id = ?,
         accepted_note = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [args.userId, args.note || null, args.runId, args.organizationId]
  );

  // Also log to activity_logs (best-effort)
  try {
    await dbRun(
      `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
       VALUES (?, ?, ?, 'agent_audit_accepted', 'agent_audit', ?, ?, CURRENT_TIMESTAMP)`,
      [
        uuidv4(),
        args.organizationId,
        args.userId,
        args.runId,
        JSON.stringify({ note: args.note || null }),
      ],
      { fallback: true } as any
    );
  } catch {
    // ignore
  }

  // Metrics (best-effort)
  try {
    const row = (await dbGet(
      `SELECT conversation_id as "conversationId"
       FROM ai_agent_audit_runs
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [args.runId, args.organizationId]
    ).catch(() => null)) as any;
    await logAgentAuditEvent({
      organizationId: args.organizationId,
      userId: args.userId,
      runId: args.runId,
      conversationId: row?.conversationId ? String(row.conversationId) : null,
      eventType: 'run_accepted',
      payload: { note: args.note || null },
    });
  } catch {
    // ignore
  }
}
