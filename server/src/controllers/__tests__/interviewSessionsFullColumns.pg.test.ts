/**
 * @vitest-environment node
 *
 * IS-2 (U-05 / DEC-535, Wpis 121 poz. 2): the ACTIVE sessions list
 * (`loadInterviewSessionsForOrganization`) must return the SAME per-row columns
 * the managed/archived tabs already return — template, respondent, assignee,
 * due, submitted — instead of leaving the front-end TEMPLATE / ASSIGNEE / DUE /
 * SUBMITTED columns as "—"/"Unassigned" for every active row.
 *
 * The change is VISIBLE, so it is gated fail-closed by
 * `INTERVIEW_SESSIONS_FULL_COLUMNS`. This real-Postgres proof asserts:
 *   ON  → enriched fields present; anonymous respondent masked (D18-A);
 *   OFF → byte-for-byte the legacy `buildSessionResponse` shape (no extra keys).
 */
import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadInterviewSessionsForOrganization } from '../InterviewController.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

// The exact key set `buildSessionResponse` emits — the legacy contract the OFF
// path must reproduce byte-for-byte (no enriched keys leaking through).
const LEGACY_SESSION_KEYS = [
  'id',
  'organizationId',
  'projectId',
  'name',
  'ownerId',
  'status',
  'templateId',
  'templateVersion',
  'assignmentId',
  'progress',
  'totalQuestions',
  'answeredQuestions',
  'summaryFacts',
  'summaryGaps',
  'summaryConstraints',
  'summaryPainPoints',
  'runtimeModeDefault',
  'startedAt',
  'completedAt',
  'lastActivityAt',
].sort();

describe.skipIf(!REAL_DB)('Interview active sessions full columns (IS-2) — real PostgreSQL', () => {
  let pool: Pool;
  const tag = randomUUID();
  const orgId = `is2-org-${tag}`;
  const projectId = `is2-project-${tag}`;
  const respondentId = `is2-respondent-${tag}`;
  const assigneeId = `is2-assignee-${tag}`;
  const templateId = `is2-template-${tag}`;
  const identifiedSessionId = `is2-session-identified-${tag}`;
  const anonymousSessionId = `is2-session-anonymous-${tag}`;
  const identifiedAssignmentId = `is2-assignment-identified-${tag}`;
  const anonymousAssignmentId = `is2-assignment-anonymous-${tag}`;

  const setFlag = (on: boolean) => {
    if (on) process.env.INTERVIEW_SESSIONS_FULL_COLUMNS = 'true';
    else delete process.env.INTERVIEW_SESSIONS_FULL_COLUMNS;
  };

  const findById = (rows: Array<{ id: string }>, id: string) => rows.find((r) => r.id === id);

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'IS-2 realpg')`, [orgId]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, first_name, last_name)
       VALUES ($1, $2, $3, 'MEMBER', 'Jane', 'Respondent')`,
      [respondentId, orgId, `${respondentId}@example.invalid`]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, first_name, last_name)
       VALUES ($1, $2, $3, 'MEMBER', 'Sam', 'Manager')`,
      [assigneeId, orgId, `${assigneeId}@example.invalid`]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, owner_id) VALUES ($1, $2, 'IS-2 project', $3)`,
      [projectId, orgId, respondentId]
    );
    await pool.query(
      `INSERT INTO interview_library_templates (id, name, category) VALUES ($1, 'Discovery Q3', 'strategy')`,
      [templateId]
    );

    // Identified session: owner is a named respondent, has its own assignment.
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, priority, created_by, session_id, due_at, submitted_at)
       VALUES ($1, $2, $3, $4, 1, 'submitted', 'high', $5, $6, '2026-09-20T00:00:00.000Z', '2026-09-18T09:00:00.000Z')`,
      [identifiedAssignmentId, orgId, assigneeId, templateId, respondentId, identifiedSessionId]
    );
    await pool.query(
      `INSERT INTO interview_sessions
         (id, organization_id, project_id, name, owner_id, status, template_id, assignment_id, is_anonymous, total_questions, answered_questions, started_at)
       VALUES ($1, $2, $3, 'IS-2 identified', $4, 'active', $5, $6, FALSE, 5, 3, '2026-09-17T00:00:00.000Z')`,
      [identifiedSessionId, orgId, projectId, respondentId, templateId, identifiedAssignmentId]
    );

    // Anonymous session: D18-A wall must mask the respondent, not the assignee.
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, priority, created_by, session_id, due_at)
       VALUES ($1, $2, $3, $4, 1, 'in_progress', 'normal', $5, $6, '2026-09-21T00:00:00.000Z')`,
      [anonymousAssignmentId, orgId, assigneeId, templateId, respondentId, anonymousSessionId]
    );
    await pool.query(
      `INSERT INTO interview_sessions
         (id, organization_id, project_id, name, owner_id, status, template_id, assignment_id, is_anonymous, total_questions, answered_questions, started_at)
       VALUES ($1, $2, $3, 'IS-2 anonymous', $4, 'active', $5, $6, TRUE, 4, 0, '2026-09-16T00:00:00.000Z')`,
      [anonymousSessionId, orgId, projectId, respondentId, templateId, anonymousAssignmentId]
    );
  }, 60_000);

  afterAll(async () => {
    setFlag(false);
    if (!pool) return;
    await pool.query(`DELETE FROM interview_sessions WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM interview_assignments WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM interview_library_templates WHERE id = $1`, [templateId]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
    await pool.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    const remaining = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_sessions WHERE organization_id=$1) sessions,
         (SELECT count(*)::int FROM interview_assignments WHERE organization_id=$1) assignments`,
      [orgId]
    );
    expect(remaining.rows[0]).toEqual({ sessions: 0, assignments: 0 });
    await pool.end();
  });

  it('OFF (default) reproduces the legacy session shape byte-for-byte — no enriched keys', async () => {
    setFlag(false);
    const rows = await loadInterviewSessionsForOrganization(orgId);
    const identified = findById(rows, identifiedSessionId);
    expect(identified).toBeTruthy();
    // The whole point of fail-closed: same keys buildSessionResponse always emitted.
    expect(Object.keys(identified!).sort()).toEqual(LEGACY_SESSION_KEYS);
    for (const enrichedKey of [
      'templateName',
      'templateCategory',
      'respondentName',
      'respondentId',
      'assigneeName',
      'assigneeEmail',
      'dueAt',
      'submittedAt',
      'assignmentStatus',
    ]) {
      expect(enrichedKey in identified!).toBe(false);
    }
  });

  it('ON enriches the identified session with template / respondent / assignee / due / submitted', async () => {
    setFlag(true);
    const rows = await loadInterviewSessionsForOrganization(orgId);
    const identified = findById(rows, identifiedSessionId) as Record<string, unknown>;
    expect(identified).toBeTruthy();
    expect(identified).toMatchObject({
      templateName: 'Discovery Q3',
      templateCategory: 'strategy',
      respondentId,
      respondentName: 'Jane Respondent',
      assigneeId,
      assigneeName: 'Sam Manager',
      assigneeEmail: `${assigneeId}@example.invalid`,
      assignmentStatus: 'submitted',
      assignmentPriority: 'high',
      assignmentCreatedBy: respondentId,
    });
    expect(identified.dueAt).toBeTruthy();
    expect(identified.submittedAt).toBeTruthy();
    // Base contract is preserved alongside the enrichment (no regression).
    expect(identified.status).toBe('in_progress');
    expect(identified.totalQuestions).toBe(5);
    expect(identified.answeredQuestions).toBe(3);
  });

  it('ON masks the respondent but not the assignee for an anonymous session (D18-A)', async () => {
    setFlag(true);
    const rows = await loadInterviewSessionsForOrganization(orgId);
    const anonymous = findById(rows, anonymousSessionId) as Record<string, unknown>;
    expect(anonymous).toBeTruthy();
    expect(anonymous.respondentName).toBe('Anonymous respondent');
    expect(anonymous.respondentId).toBeUndefined();
    // The assignee (manager) is not the protected party — still shown.
    expect(anonymous.assigneeName).toBe('Sam Manager');
    expect(anonymous.templateName).toBe('Discovery Q3');
  });

  it('ON keeps the status filter working on the enriched query', async () => {
    setFlag(true);
    const active = await loadInterviewSessionsForOrganization(orgId, 'active');
    expect(findById(active, identifiedSessionId)).toBeTruthy();
    const completed = await loadInterviewSessionsForOrganization(orgId, 'completed');
    expect(findById(completed, identifiedSessionId)).toBeUndefined();
  });
});
