import fs from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { proposeInterviews, reviewInterviewsProposal } from '../transformationCaseService.js';

const runRealDb = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const describeRealDb = runRealDb ? describe : describe.skip;

describeRealDb('T01-I03 transformation Interview adapter — PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ids = {
    organization: 'org-t01-i03',
    project: 'project-t01-i03',
    actor: 'user-t01-actor',
    stakeholder: 'user-t01-stakeholder',
    case: 'tc-t01-i03',
    plan: 'tp-t01-i03',
    proposal: '',
    idea: 'idea-t01-i03',
  };

  beforeAll(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(`
      CREATE TABLE organization_members (organization_id TEXT NOT NULL, user_id TEXT NOT NULL);
      CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
      CREATE TABLE users (
        id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, first_name TEXT, last_name TEXT
      );
      CREATE TABLE my_ideas (
        id TEXT PRIMARY KEY, user_id TEXT, organization_id TEXT NOT NULL, title TEXT NOT NULL,
        body TEXT, tags TEXT, source_type TEXT, source_conversation_id TEXT,
        source_message_id TEXT, stage TEXT, action_contract_json TEXT,
        source_pack_json TEXT, evidence_refs_json TEXT
      );
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY, project_id TEXT, organization_id TEXT, title TEXT,
        description TEXT, status TEXT, priority TEXT, assignee_id TEXT, reporter_id TEXT,
        due_date TIMESTAMP, task_type TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
      );
      CREATE TABLE interview_library_templates (
        id TEXT PRIMARY KEY, organization_id TEXT, name TEXT NOT NULL, description TEXT,
        category TEXT NOT NULL, status TEXT DEFAULT 'approved', visibility TEXT DEFAULT 'org',
        is_default INTEGER DEFAULT 0, version INTEGER DEFAULT 1, created_by TEXT,
        created_at TIMESTAMP, updated_at TIMESTAMP
      );
      CREATE TABLE interview_library_template_questions (
        id TEXT PRIMARY KEY, template_id TEXT NOT NULL, category TEXT NOT NULL,
        question_text TEXT NOT NULL, sort_order INTEGER, answer_type TEXT,
        is_required INTEGER, created_at TIMESTAMP
      );
      CREATE TABLE interview_sessions (
        id TEXT PRIMARY KEY, status TEXT, answered_questions INTEGER, total_questions INTEGER
      );
      CREATE TABLE interview_assignments (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
        assignee_user_id TEXT NOT NULL, template_id TEXT NOT NULL,
        template_version INTEGER DEFAULT 1, process_ref TEXT, status TEXT DEFAULT 'assigned',
        session_id TEXT, task_id TEXT, due_at TIMESTAMP, started_at TIMESTAMP,
        submitted_at TIMESTAMP, sent_back_at TIMESTAMP, sent_back_reason TEXT,
        created_by TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
      );
    `);
    const migrationPath = path.resolve(
      process.cwd(),
      'server/migrations/20260807_agent_t01_transformation_case.sql'
    );
    await pool.query(fs.readFileSync(migrationPath, 'utf8'));
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [ids.organization, ids.actor, ids.stakeholder]
    );
    await pool.query(`INSERT INTO projects (id, organization_id) VALUES ($1, $2)`, [
      ids.project,
      ids.organization,
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name)
       VALUES ($1, $3, 'actor@example.test', 'Agent', 'Reviewer'),
              ($2, $3, 'stakeholder@example.test', 'Stake', 'Holder')`,
      [ids.actor, ids.stakeholder, ids.organization]
    );
    await pool.query(
      `INSERT INTO transformation_cases (
        transformation_case_id, organization_id, project_id, initiated_by_user_id,
        mandate, status, lifecycle_stage, active_plan_id, lineage_id, idempotency_key, version
      ) VALUES ($1, $2, $3, $4, 'Prepare transformation plan', 'active',
        'initial_ideas', NULL, 'lineage-t01-i03', 'idem-t01-i03', 1)`,
      [ids.case, ids.organization, ids.project, ids.actor]
    );
    await pool.query(
      `INSERT INTO transformation_plans (
        plan_id, transformation_case_id, organization_id, version, status,
        summary, created_by_user_id
       ) VALUES ($1, $2, $3, 1, 'approved', 'Approved transformation plan', $4)`,
      [ids.plan, ids.case, ids.organization, ids.actor]
    );
    await pool.query(
      `UPDATE transformation_cases SET active_plan_id = $1 WHERE transformation_case_id = $2`,
      [ids.plan, ids.case]
    );
    await pool.query(
      `INSERT INTO my_ideas (id, user_id, organization_id, title, body, source_type)
       VALUES ($1, $2, $3, 'Reduce lead time', 'Hypothesis', 'transformation_agent')`,
      [ids.idea, ids.actor, ids.organization]
    );
    await pool.query(
      `INSERT INTO transformation_case_artifact_links (
        link_id, transformation_case_id, organization_id, lifecycle_stage,
        artifact_type, artifact_id, lineage_role, created_by_user_id
       ) VALUES ('link-idea-t01-i03', $4, $3, 'initial_ideas', 'my_idea', $1, 'output', $2)`,
      [ids.idea, ids.actor, ids.organization, ids.case]
    );
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  it('keeps proposal non-mutating, applies canonical assignments once, and blocks stale replay', async () => {
    const proposal = await proposeInterviews({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 1,
      stakeholders: [
        {
          assigneeUserId: ids.stakeholder,
          role: 'Operations Director',
          focus: ['lead time', 'handoffs'],
        },
      ],
    });
    ids.proposal = proposal.proposalId;
    const beforeApproval = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM interview_assignments) AS assignments,
        (SELECT COUNT(*)::int FROM tasks) AS tasks,
        (SELECT COUNT(*)::int FROM interview_library_templates) AS templates
    `);
    expect(beforeApproval.rows[0]).toEqual({ assignments: 0, tasks: 0, templates: 0 });

    const applied = await reviewInterviewsProposal({
      proposalId: proposal.proposalId,
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 2,
      decision: 'approve',
      reason: 'Approved stakeholder and evidence questions',
      dueAt: '2026-08-14T12:00:00.000Z',
    });
    expect(applied.status).toBe('applied');
    expect(applied.artifactIds).toHaveLength(1);

    const readback = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM interview_library_templates WHERE organization_id = $1) AS templates,
        (SELECT COUNT(*)::int FROM interview_library_template_questions) AS questions,
        (SELECT COUNT(*)::int FROM interview_assignments WHERE organization_id = $1) AS assignments,
        (SELECT COUNT(*)::int FROM tasks WHERE organization_id = $1 AND task_type = 'interview') AS tasks,
        (SELECT COUNT(*)::int FROM transformation_case_artifact_links
          WHERE transformation_case_id = $2 AND artifact_type = 'interview_assignment') AS links,
        (SELECT status FROM transformation_stage_proposals WHERE proposal_id = $3) AS proposal_status,
        (SELECT COUNT(*)::int FROM transformation_case_audit_events
          WHERE transformation_case_id = $2 AND event_type = 'transformation_interviews.approved_and_applied') AS applied_audits`,
      [ids.organization, ids.case, ids.proposal]
    );
    expect(readback.rows[0]).toEqual({
      templates: 1,
      questions: 2,
      assignments: 1,
      tasks: 1,
      links: 1,
      proposal_status: 'applied',
      applied_audits: 1,
    });

    await expect(
      reviewInterviewsProposal({
        proposalId: proposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.actor,
        expectedVersion: 2,
        decision: 'approve',
        reason: 'Stale replay must fail',
      })
    ).rejects.toMatchObject({ code: 'TRANSFORMATION_CASE_VERSION_CONFLICT' });

    const noDuplicates = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM interview_assignments) AS assignments,
              (SELECT COUNT(*)::int FROM tasks) AS tasks,
              (SELECT COUNT(*)::int FROM transformation_case_artifact_links
                WHERE artifact_type = 'interview_assignment') AS links`
    );
    expect(noDuplicates.rows[0]).toEqual({ assignments: 1, tasks: 1, links: 1 });
  }, 30_000);
});
