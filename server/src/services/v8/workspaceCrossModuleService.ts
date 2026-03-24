/**
 * V8 Workspace Cross-Module Integration Service
 *
 * Links workspace collaboration sessions to platform modules (initiatives,
 * execution runs, reports, etc.), records cross-module activity, and exposes
 * session/workspace analytics aggregated from the activity feed, AI
 * facilitation tables, and module links.
 *
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CrossModuleActivity,
  LinkModuleParams,
  ModuleImpactSummary,
  ModuleLinkType,
  RecordCrossModuleActivityParams,
  SessionAnalytics,
  SessionModuleLink,
  WorkspaceAnalytics,
} from '../../types/workspaceCrossModule.js';
import {
  LinkModuleParamsSchema,
  RecordCrossModuleActivityParamsSchema,
} from '../../types/workspaceCrossModule.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

import { getSessionsByWorkspace } from './workspaceCollaborationService.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:WorkspaceCrossModule]';

interface SessionRow {
  session_id: string;
  workspace_id: string;
  organization_id: string;
  created_at: string;
  completed_at: string | null;
}

interface ModuleLinkRow {
  link_id: string;
  session_id: string;
  organization_id: string;
  module_type: string;
  module_resource_id: string;
  linked_by: string;
  linked_at: string;
  unlinked_at: string | null;
}

interface CrossModuleActivityRow {
  activity_id: string;
  session_id: string;
  organization_id: string;
  module_type: string;
  module_resource_id: string;
  activity_type: string;
  actor_id: string;
  summary: string;
  created_at: string;
}

interface CountRow {
  cnt: number;
}

function rowToModuleLink(row: ModuleLinkRow): SessionModuleLink {
  return {
    linkId: row.link_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    moduleType: row.module_type as ModuleLinkType,
    moduleResourceId: row.module_resource_id,
    linkedBy: row.linked_by,
    linkedAt: row.linked_at,
    unlinkedAt: row.unlinked_at ?? null,
  };
}

function rowToCrossModuleActivity(row: CrossModuleActivityRow): CrossModuleActivity {
  return {
    activityId: row.activity_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    moduleType: row.module_type as ModuleLinkType,
    moduleResourceId: row.module_resource_id,
    activityType: row.activity_type,
    actorId: row.actor_id,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

/**
 * Heuristic 0–100 score from session signals. Higher activity, suggestions,
 * decisions, links, and distinct participants increase the score; long elapsed
 * duration (when known) slightly dampens raw counts to favor sustained engagement.
 */
export function computeEngagementScore(params: {
  totalActivities: number;
  totalSuggestions: number;
  totalDecisions: number;
  totalModuleLinks: number;
  totalParticipants: number;
  durationMs: number | null;
}): number {
  const {
    totalActivities,
    totalSuggestions,
    totalDecisions,
    totalModuleLinks,
    totalParticipants,
    durationMs,
  } = params;

  let density =
    Math.log1p(totalActivities) * 12 +
    Math.log1p(totalSuggestions) * 10 +
    Math.log1p(totalDecisions) * 14 +
    Math.log1p(totalModuleLinks) * 8 +
    Math.log1p(totalParticipants) * 16;

  if (durationMs !== null && durationMs > 0) {
    const minutes = durationMs / (1000 * 60);
    density = density / Math.max(0.25, Math.log1p(minutes));
  }

  return Math.min(100, Math.round(density));
}

async function assertSessionInOrg(sessionId: string, organizationId: string): Promise<SessionRow> {
  const row = await dbGet<SessionRow>(
    `SELECT session_id, workspace_id, organization_id, created_at, completed_at
     FROM v8_workspace_sessions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );
  if (!row) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }
  return row;
}

// ==========================================
// PUBLIC API — MODULE LINKS
// ==========================================

/**
 * Link a workspace session to a platform module resource (idempotent for an
 * identical active link).
 */
export async function linkModule(params: LinkModuleParams): Promise<SessionModuleLink> {
  const validated = LinkModuleParamsSchema.parse(params);
  await assertSessionInOrg(validated.sessionId, validated.organizationId);

  const existing = await dbGet<ModuleLinkRow>(
    `SELECT * FROM v8_session_module_links
     WHERE session_id = ? AND organization_id = ?
       AND module_type = ? AND module_resource_id = ?
       AND unlinked_at IS NULL`,
    [
      validated.sessionId,
      validated.organizationId,
      validated.moduleType,
      validated.moduleResourceId,
    ],
    { fallback: true },
  );

  if (existing) {
    logger.info(
      `${LOG_PREFIX} Active link already exists ${existing.link_id} for session ${validated.sessionId}`,
    );
    return rowToModuleLink(existing);
  }

  const linkId = uuidv4();
  const now = new Date().toISOString();

  const link: SessionModuleLink = {
    linkId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    moduleType: validated.moduleType,
    moduleResourceId: validated.moduleResourceId,
    linkedBy: validated.linkedBy,
    linkedAt: now,
    unlinkedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_session_module_links (
      link_id, session_id, organization_id, module_type, module_resource_id,
      linked_by, linked_at, unlinked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      link.linkId,
      link.sessionId,
      link.organizationId,
      link.moduleType,
      link.moduleResourceId,
      link.linkedBy,
      link.linkedAt,
      link.unlinkedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Linked module ${validated.moduleType}:${validated.moduleResourceId} ` +
    `to session ${validated.sessionId}`,
  );

  return link;
}

/**
 * Soft-unlink a module attachment by setting unlinkedAt.
 */
export async function unlinkModule(linkId: string, organizationId: string): Promise<SessionModuleLink> {
  const row = await dbGet<ModuleLinkRow>(
    `SELECT * FROM v8_session_module_links
     WHERE link_id = ? AND organization_id = ?`,
    [linkId, organizationId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Module link ${linkId} not found in organization ${organizationId}`);
  }

  if (row.unlinked_at) {
    return rowToModuleLink(row);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_session_module_links
     SET unlinked_at = ?
     WHERE link_id = ? AND organization_id = ?`,
    [now, linkId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Unlinked module link ${linkId}`);

  return rowToModuleLink({ ...row, unlinked_at: now });
}

/**
 * Active module links for a session, optionally filtered by module type.
 */
export async function getModuleLinks(
  sessionId: string,
  organizationId: string,
  moduleType?: ModuleLinkType,
): Promise<SessionModuleLink[]> {
  await assertSessionInOrg(sessionId, organizationId);

  if (moduleType) {
    const rows = await dbAll<ModuleLinkRow>(
      `SELECT * FROM v8_session_module_links
       WHERE session_id = ? AND organization_id = ?
         AND unlinked_at IS NULL AND module_type = ?
       ORDER BY linked_at DESC`,
      [sessionId, organizationId, moduleType],
      { fallback: true },
    );
    return (rows || []).map(rowToModuleLink);
  }

  const rows = await dbAll<ModuleLinkRow>(
    `SELECT * FROM v8_session_module_links
     WHERE session_id = ? AND organization_id = ? AND unlinked_at IS NULL
     ORDER BY linked_at DESC`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return (rows || []).map(rowToModuleLink);
}

// ==========================================
// PUBLIC API — CROSS-MODULE ACTIVITY
// ==========================================

/**
 * Append a cross-module activity row for analytics and audit trails.
 */
export async function recordCrossModuleActivity(
  params: RecordCrossModuleActivityParams,
): Promise<CrossModuleActivity> {
  const validated = RecordCrossModuleActivityParamsSchema.parse(params);
  await assertSessionInOrg(validated.sessionId, validated.organizationId);

  const activityId = uuidv4();
  const now = new Date().toISOString();

  const activity: CrossModuleActivity = {
    activityId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    moduleType: validated.moduleType,
    moduleResourceId: validated.moduleResourceId,
    activityType: validated.activityType,
    actorId: validated.actorId,
    summary: validated.summary,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_cross_module_activity (
      activity_id, session_id, organization_id, module_type, module_resource_id,
      activity_type, actor_id, summary, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.activityId,
      activity.sessionId,
      activity.organizationId,
      activity.moduleType,
      activity.moduleResourceId,
      activity.activityType,
      activity.actorId,
      activity.summary,
      activity.createdAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded cross-module activity ${activityId} (${validated.activityType}) ` +
    `session ${validated.sessionId}`,
  );

  return activity;
}

/**
 * Cross-module activity for a session, newest first.
 */
export async function getCrossModuleActivity(
  sessionId: string,
  organizationId: string,
  moduleType?: ModuleLinkType,
  limit: number = 100,
): Promise<CrossModuleActivity[]> {
  await assertSessionInOrg(sessionId, organizationId);

  if (moduleType) {
    const rows = await dbAll<CrossModuleActivityRow>(
      `SELECT * FROM v8_cross_module_activity
       WHERE session_id = ? AND organization_id = ? AND module_type = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [sessionId, organizationId, moduleType, limit],
      { fallback: true },
    );
    return (rows || []).map(rowToCrossModuleActivity);
  }

  const rows = await dbAll<CrossModuleActivityRow>(
    `SELECT * FROM v8_cross_module_activity
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [sessionId, organizationId, limit],
    { fallback: true },
  );
  return (rows || []).map(rowToCrossModuleActivity);
}

// ==========================================
// PUBLIC API — ANALYTICS
// ==========================================

async function countFeedActivities(sessionId: string, organizationId: string): Promise<number> {
  const row = await dbGet<CountRow>(
    `SELECT COUNT(*) AS cnt FROM v8_activity_feed
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return row?.cnt ?? 0;
}

async function countDistinctFeedActors(sessionId: string, organizationId: string): Promise<number> {
  const row = await dbGet<CountRow>(
    `SELECT COUNT(DISTINCT actor_id) AS cnt FROM v8_activity_feed
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return row?.cnt ?? 0;
}

async function countSuggestions(sessionId: string, organizationId: string): Promise<number> {
  const row = await dbGet<CountRow>(
    `SELECT COUNT(*) AS cnt FROM v8_ai_suggestions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return row?.cnt ?? 0;
}

async function countDecisions(sessionId: string, organizationId: string): Promise<number> {
  const row = await dbGet<CountRow>(
    `SELECT COUNT(*) AS cnt FROM v8_collaborative_decisions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return row?.cnt ?? 0;
}

async function countActiveModuleLinks(sessionId: string, organizationId: string): Promise<number> {
  const row = await dbGet<CountRow>(
    `SELECT COUNT(*) AS cnt FROM v8_session_module_links
     WHERE session_id = ? AND organization_id = ? AND unlinked_at IS NULL`,
    [sessionId, organizationId],
    { fallback: true },
  );
  return row?.cnt ?? 0;
}

function sessionDurationMs(session: SessionRow): number | null {
  if (!session.completed_at) return null;
  const start = Date.parse(session.created_at);
  const end = Date.parse(session.completed_at);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return end - start;
}

/**
 * Aggregate session analytics from the activity feed, AI suggestions/decisions,
 * and active module links.
 */
export async function getSessionAnalytics(
  sessionId: string,
  organizationId: string,
): Promise<SessionAnalytics> {
  const session = await assertSessionInOrg(sessionId, organizationId);

  const [
    totalActivities,
    totalParticipants,
    totalSuggestions,
    totalDecisions,
    totalModuleLinks,
  ] = await Promise.all([
    countFeedActivities(sessionId, organizationId),
    countDistinctFeedActors(sessionId, organizationId),
    countSuggestions(sessionId, organizationId),
    countDecisions(sessionId, organizationId),
    countActiveModuleLinks(sessionId, organizationId),
  ]);

  const durationMs = sessionDurationMs(session);

  const engagementScore = computeEngagementScore({
    totalActivities,
    totalSuggestions,
    totalDecisions,
    totalModuleLinks,
    totalParticipants,
    durationMs,
  });

  return {
    sessionId,
    totalParticipants,
    totalActivities,
    totalSuggestions,
    totalDecisions,
    totalModuleLinks,
    durationMs,
    engagementScore,
  };
}

function emptyWorkspaceAnalytics(
  workspaceId: string,
  organizationId: string,
): WorkspaceAnalytics {
  return {
    workspaceId,
    organizationId,
    sessionCount: 0,
    totalParticipants: 0,
    totalActivities: 0,
    totalSuggestions: 0,
    totalDecisions: 0,
    totalModuleLinks: 0,
    avgEngagementScore: 0,
    cumulativeDurationMs: null,
  };
}

/**
 * Roll up per-session analytics for all sessions in a workspace.
 */
export async function getWorkspaceAnalytics(
  workspaceId: string,
  organizationId: string,
): Promise<WorkspaceAnalytics> {
  const sessions = await getSessionsByWorkspace(workspaceId, organizationId, true);
  if (sessions.length === 0) {
    return emptyWorkspaceAnalytics(workspaceId, organizationId);
  }

  const perSession = await Promise.all(
    sessions.map((s) => getSessionAnalytics(s.sessionId, organizationId)),
  );

  let cumulativeDurationMs = 0;
  let anyDuration = false;
  for (const a of perSession) {
    if (a.durationMs !== null) {
      cumulativeDurationMs += a.durationMs;
      anyDuration = true;
    }
  }

  return {
    workspaceId,
    organizationId,
    sessionCount: perSession.length,
    totalParticipants: perSession.reduce((acc, a) => acc + a.totalParticipants, 0),
    totalActivities: perSession.reduce((acc, a) => acc + a.totalActivities, 0),
    totalSuggestions: perSession.reduce((acc, a) => acc + a.totalSuggestions, 0),
    totalDecisions: perSession.reduce((acc, a) => acc + a.totalDecisions, 0),
    totalModuleLinks: perSession.reduce((acc, a) => acc + a.totalModuleLinks, 0),
    avgEngagementScore:
      perSession.length > 0
        ? Math.round(
          perSession.reduce((acc, a) => acc + a.engagementScore, 0) / perSession.length,
        )
        : 0,
    cumulativeDurationMs: anyDuration ? cumulativeDurationMs : null,
  };
}

/**
 * Sessions that currently have an active link to the given module resource.
 */
export async function findSessionsByModule(
  moduleType: ModuleLinkType,
  moduleResourceId: string,
  organizationId: string,
): Promise<string[]> {
  const rows = await dbAll<{ session_id: string }>(
    `SELECT DISTINCT session_id FROM v8_session_module_links
     WHERE organization_id = ? AND module_type = ? AND module_resource_id = ?
       AND unlinked_at IS NULL
     ORDER BY session_id`,
    [organizationId, moduleType, moduleResourceId],
    { fallback: true },
  );
  return (rows || []).map((r) => r.session_id);
}

/**
 * Impact summary: linked sessions, cross-module activity rows, and collaborative
 * decisions occurring in any session still linked to this module resource.
 */
export async function getModuleImpact(
  moduleType: ModuleLinkType,
  moduleResourceId: string,
  organizationId: string,
): Promise<ModuleImpactSummary> {
  const linkedSessionCountRow = await dbGet<CountRow>(
    `SELECT COUNT(DISTINCT session_id) AS cnt FROM v8_session_module_links
     WHERE organization_id = ? AND module_type = ? AND module_resource_id = ?
       AND unlinked_at IS NULL`,
    [organizationId, moduleType, moduleResourceId],
    { fallback: true },
  );

  const crossModuleActivityCountRow = await dbGet<CountRow>(
    `SELECT COUNT(*) AS cnt FROM v8_cross_module_activity
     WHERE organization_id = ? AND module_type = ? AND module_resource_id = ?`,
    [organizationId, moduleType, moduleResourceId],
    { fallback: true },
  );

  const referencedDecisionsCountRow = await dbGet<CountRow>(
    `SELECT COUNT(*) AS cnt FROM v8_collaborative_decisions d
     WHERE d.organization_id = ?
       AND EXISTS (
         SELECT 1 FROM v8_session_module_links l
         WHERE l.session_id = d.session_id
           AND l.organization_id = d.organization_id
           AND l.module_type = ?
           AND l.module_resource_id = ?
           AND l.unlinked_at IS NULL
       )`,
    [organizationId, moduleType, moduleResourceId],
    { fallback: true },
  );

  return {
    moduleType,
    moduleResourceId,
    organizationId,
    linkedSessionCount: linkedSessionCountRow?.cnt ?? 0,
    crossModuleActivityCount: crossModuleActivityCountRow?.cnt ?? 0,
    referencedDecisionsCount: referencedDecisionsCountRow?.cnt ?? 0,
  };
}

/**
 * Recent cross-module activity for an organization across all sessions.
 */
export async function getRecentCrossModuleActivity(
  organizationId: string,
  days: number = 7,
  limit: number = 50,
): Promise<CrossModuleActivity[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await dbAll<CrossModuleActivityRow>(
    `SELECT * FROM v8_cross_module_activity
     WHERE organization_id = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, since, limit],
    { fallback: true },
  );

  return (rows || []).map(rowToCrossModuleActivity);
}
