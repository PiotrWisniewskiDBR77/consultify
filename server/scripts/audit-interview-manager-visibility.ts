#!/usr/bin/env tsx

import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

const SESSION_REQUIRED_STATUSES = ['in_progress', 'submitted', 'sent_back', 'approved', 'completed'];

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseOrgIds(): string[] {
  const argValue = getArg('--org') || process.env.ORG_ID || process.env.TARGET_ORG_ID || 'vts';
  return String(argValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function queryRows<T extends Record<string, unknown>>(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return (result.rows || []) as T[];
}

async function loadAuditReport(pool: pg.Pool, orgIds: string[]) {
  const organizations = await queryRows<{ id: string; name: string; status: string | null }>(
    pool,
    `SELECT id, name, status
     FROM organizations
     WHERE id = ANY($1)
     ORDER BY id ASC`,
    [orgIds]
  );

  const v8Flags = await queryRows<{
    organization_id: string;
    module: string;
    enabled: number;
    updated_at: string | null;
  }>(
    pool,
    `SELECT organization_id, module, enabled, updated_at
     FROM v8.v8_feature_flags
     WHERE organization_id = ANY($1)
     ORDER BY organization_id ASC, module ASC`,
    [orgIds]
  ).catch(() => []);

  const roles = await queryRows<{ organization_id: string; role: string | null; count: string }>(
    pool,
    `SELECT organization_id, role, COUNT(*)::text AS count
     FROM users
     WHERE organization_id = ANY($1)
     GROUP BY organization_id, role
     ORDER BY organization_id ASC, COUNT(*) DESC, role ASC`,
    [orgIds]
  );

  const assignmentsByStatus = await queryRows<{
    organization_id: string;
    status: string;
    total: string;
    without_session: string;
    without_creator: string;
    creators: string;
    assignees: string;
  }>(
    pool,
    `SELECT organization_id,
            status,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE session_id IS NULL)::text AS without_session,
            COUNT(*) FILTER (WHERE created_by IS NULL)::text AS without_creator,
            COUNT(DISTINCT created_by)::text AS creators,
            COUNT(DISTINCT assignee_user_id)::text AS assignees
     FROM interview_assignments
     WHERE organization_id = ANY($1)
     GROUP BY organization_id, status
     ORDER BY organization_id ASC, status ASC`,
    [orgIds]
  );

  const creatorScope = await queryRows<{
    organization_id: string;
    created_by: string | null;
    creator_email: string;
    creator_role: string;
    total: string;
    workflow_rows: string;
    workflow_without_session: string;
  }>(
    pool,
    `SELECT a.organization_id,
            a.created_by,
            COALESCE(u.email, '[missing-user]') AS creator_email,
            COALESCE(u.role, '[missing-role]') AS creator_role,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (
              WHERE a.status = ANY($2)
            )::text AS workflow_rows,
            COUNT(*) FILTER (
              WHERE a.session_id IS NULL AND a.status = ANY($2)
            )::text AS workflow_without_session
     FROM interview_assignments a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.organization_id = ANY($1)
     GROUP BY a.organization_id, a.created_by, creator_email, creator_role
     ORDER BY a.organization_id ASC, COUNT(*) DESC, creator_email ASC`,
    [orgIds, SESSION_REQUIRED_STATUSES]
  );

  const sessionCoverage = await queryRows<{
    organization_id: string;
    assignments_total: string;
    with_session_id: string;
    resolvable_session: string;
    broken_session_ref: string;
    active_without_session: string;
  }>(
    pool,
    `SELECT a.organization_id,
            COUNT(*)::text AS assignments_total,
            COUNT(*) FILTER (WHERE a.session_id IS NOT NULL)::text AS with_session_id,
            COUNT(*) FILTER (WHERE a.session_id IS NOT NULL AND s.id IS NOT NULL)::text AS resolvable_session,
            COUNT(*) FILTER (WHERE a.session_id IS NOT NULL AND s.id IS NULL)::text AS broken_session_ref,
            COUNT(*) FILTER (
              WHERE a.session_id IS NULL AND a.status = ANY($2)
            )::text AS active_without_session
     FROM interview_assignments a
     LEFT JOIN interview_sessions s ON s.id = a.session_id
     WHERE a.organization_id = ANY($1)
     GROUP BY a.organization_id
     ORDER BY a.organization_id ASC`,
    [orgIds, SESSION_REQUIRED_STATUSES]
  );

  const scopeMismatch = await queryRows<{
    organization_id: string;
    project_mismatch: string;
    org_mismatch: string;
  }>(
    pool,
    `SELECT a.organization_id,
            COUNT(*) FILTER (
              WHERE a.session_id IS NOT NULL
                AND COALESCE(a.project_id, '') <> COALESCE(s.project_id, '')
            )::text AS project_mismatch,
            COUNT(*) FILTER (
              WHERE a.session_id IS NOT NULL
                AND COALESCE(s.organization_id, '') <> a.organization_id
            )::text AS org_mismatch
     FROM interview_assignments a
     LEFT JOIN interview_sessions s ON s.id = a.session_id
     WHERE a.organization_id = ANY($1)
     GROUP BY a.organization_id
     ORDER BY a.organization_id ASC`,
    [orgIds]
  );

  const candidateRows = await queryRows<{
    organization_id: string;
    assignment_id: string;
    status: string;
    current_session_id: string | null;
    assignee_user_id: string;
    created_by: string | null;
    project_id: string | null;
    template_id: string;
    started_at: string | null;
    submitted_at: string | null;
    created_at: string;
    candidate_session_id: string | null;
    candidate_assignment_id: string | null;
    candidate_org_id: string | null;
    candidate_project_id: string | null;
    candidate_owner_id: string | null;
    candidate_template_id: string | null;
  }>(
    pool,
    `WITH targets AS (
       SELECT a.organization_id,
              a.id AS assignment_id,
              a.status,
              a.session_id AS current_session_id,
              a.assignee_user_id,
              a.created_by,
              a.project_id,
              a.template_id,
              a.started_at,
              a.submitted_at,
              a.created_at
       FROM interview_assignments a
       LEFT JOIN interview_sessions current_session ON current_session.id = a.session_id
       WHERE a.organization_id = ANY($1)
         AND a.status = ANY($2)
         AND (a.session_id IS NULL OR current_session.id IS NULL)
     )
     SELECT t.*,
            s.id AS candidate_session_id,
            s.assignment_id AS candidate_assignment_id,
            s.organization_id AS candidate_org_id,
            s.project_id AS candidate_project_id,
            s.owner_id AS candidate_owner_id,
            s.template_id AS candidate_template_id
     FROM targets t
     LEFT JOIN interview_sessions s ON s.assignment_id = t.assignment_id
     ORDER BY t.organization_id ASC, t.assignment_id ASC, s.id ASC`,
    [orgIds, SESSION_REQUIRED_STATUSES]
  );

  const creatorAnomalies = await queryRows<{
    organization_id: string;
    assignment_id: string;
    created_by: string | null;
    creator_email: string | null;
    creator_org_id: string | null;
    issue: string;
  }>(
    pool,
    `SELECT a.organization_id,
            a.id AS assignment_id,
            a.created_by,
            u.email AS creator_email,
            u.organization_id AS creator_org_id,
            CASE
              WHEN a.created_by IS NULL THEN 'missing_created_by'
              WHEN u.id IS NULL THEN 'creator_missing_user'
              WHEN COALESCE(u.organization_id, '') <> a.organization_id THEN 'creator_org_mismatch'
              ELSE 'ok'
            END AS issue
     FROM interview_assignments a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.organization_id = ANY($1)
       AND (
         a.created_by IS NULL
         OR u.id IS NULL
         OR COALESCE(u.organization_id, '') <> a.organization_id
       )
     ORDER BY a.organization_id ASC, a.id ASC`,
    [orgIds]
  );

  const candidateBuckets = new Map<
    string,
    {
      organizationId: string;
      assignmentId: string;
      status: string;
      currentSessionId: string | null;
      assigneeUserId: string;
      createdBy: string | null;
      projectId: string | null;
      templateId: string;
      startedAt: string | null;
      submittedAt: string | null;
      createdAt: string;
      candidates: Array<{
        sessionId: string;
        assignmentId: string | null;
        organizationId: string | null;
        projectId: string | null;
        ownerId: string | null;
        templateId: string | null;
      }>;
    }
  >();

  for (const row of candidateRows) {
    if (!candidateBuckets.has(row.assignment_id)) {
      candidateBuckets.set(row.assignment_id, {
        organizationId: row.organization_id,
        assignmentId: row.assignment_id,
        status: row.status,
        currentSessionId: row.current_session_id,
        assigneeUserId: row.assignee_user_id,
        createdBy: row.created_by,
        projectId: row.project_id,
        templateId: row.template_id,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
        candidates: [],
      });
    }
    if (row.candidate_session_id) {
      candidateBuckets.get(row.assignment_id)!.candidates.push({
        sessionId: row.candidate_session_id,
        assignmentId: row.candidate_assignment_id,
        organizationId: row.candidate_org_id,
        projectId: row.candidate_project_id,
        ownerId: row.candidate_owner_id,
        templateId: row.candidate_template_id,
      });
    }
  }

  const safeSessionBackfills: Array<Record<string, unknown>> = [];
  const manualReview: Array<Record<string, unknown>> = [];
  for (const bucket of candidateBuckets.values()) {
    if (bucket.candidates.length === 1) {
      const candidate = bucket.candidates[0];
      const exactMatch =
        candidate.organizationId === bucket.organizationId &&
        candidate.projectId === bucket.projectId &&
        candidate.ownerId === bucket.assigneeUserId &&
        candidate.templateId === bucket.templateId;
      if (exactMatch) {
        safeSessionBackfills.push({
          organizationId: bucket.organizationId,
          assignmentId: bucket.assignmentId,
          currentSessionId: bucket.currentSessionId,
          candidateSessionId: candidate.sessionId,
          status: bucket.status,
          reason: 'reverse_assignment_id_exact_match',
        });
        continue;
      }
    }

    manualReview.push({
      organizationId: bucket.organizationId,
      assignmentId: bucket.assignmentId,
      currentSessionId: bucket.currentSessionId,
      status: bucket.status,
      candidateCount: bucket.candidates.length,
      candidates: bucket.candidates,
      reason:
        bucket.candidates.length === 0
          ? 'missing_session_without_reverse_link'
          : 'reverse_link_not_exact_single_match',
    });
  }

  return {
    orgIds,
    organizations,
    v8Flags,
    roles,
    assignmentsByStatus,
    creatorScope,
    sessionCoverage,
    scopeMismatch,
    creatorAnomalies,
    backfill: {
      safeSessionBackfills,
      manualReview,
    },
  };
}

async function applySafeSessionBackfills(
  pool: pg.Pool,
  items: Array<{ assignmentId: string; candidateSessionId: string }>
) {
  if (items.length === 0) return { updated: 0 };
  requireConfirmation(
    'CONFIRM_INTERVIEW_MANAGER_BACKFILL',
    'yes',
    'audit-interview-manager-visibility'
  );

  await pool.query('BEGIN');
  try {
    let updated = 0;
    const now = new Date().toISOString();
    for (const item of items) {
      const result = await pool.query(
        `UPDATE interview_assignments
         SET session_id = $1,
             updated_at = $2
         WHERE id = $3`,
        [item.candidateSessionId, now, item.assignmentId]
      );
      updated += result.rowCount || 0;
    }
    await pool.query('COMMIT');
    return { updated };
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'audit-interview-manager-visibility',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('audit-interview-manager-visibility', target);

  const orgIds = parseOrgIds();
  const execute = hasFlag('--apply-safe-session-backfill');
  const pool = new pg.Pool({ connectionString: target.connectionString });

  try {
    const report = await loadAuditReport(pool, orgIds);
    let applyResult: { updated: number } | null = null;
    if (execute) {
      applyResult = await applySafeSessionBackfills(
        pool,
        report.backfill.safeSessionBackfills.map((item) => ({
          assignmentId: String(item.assignmentId),
          candidateSessionId: String(item.candidateSessionId),
        }))
      );
    }

    console.log(
      JSON.stringify(
        {
          target: {
            host: target.host,
            database: target.database,
            source: target.source,
          },
          execute,
          applyResult,
          report,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
