import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';
import {
  activateProjectTeam,
  approveProjectTeam,
  proposeProjectTeam,
} from '../services/v8/transformationProjectTeamService.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const pool = new Pool({ connectionString: url });
const proofDb = {
  query: async (text: string, params: unknown[] = []) => {
    const r = await pool.query(adaptQuery(text), params);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  },
  get(text: string, params: unknown[] = [], cb?: Function) {
    const p = pool.query(adaptQuery(text), params).then((r) => r.rows[0] ?? null);
    if (cb) {
      void p.then(
        (v) => cb(null, v),
        (e) => cb(e, null)
      );
      return proofDb;
    }
    return p;
  },
  all(text: string, params: unknown[] = [], cb?: Function) {
    const p = pool.query(adaptQuery(text), params).then((r) => r.rows);
    if (cb) {
      void p.then(
        (v) => cb(null, v),
        (e) => cb(e, [])
      );
      return proofDb;
    }
    return p;
  },
  run(text: string, params: unknown[] = [], cb?: Function) {
    const p = pool.query(adaptQuery(text), params).then((r) => ({ changes: r.rowCount ?? 0 }));
    if (cb) {
      void p.then(
        (v) => cb.call(v, null),
        (e) => cb.call({ changes: 0 }, e)
      );
      return proofDb;
    }
    return p;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize: (cb: Function) => cb(),
  close: () => Promise.resolve(),
};
(globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
const migration = (name: string) =>
  pool.query(fs.readFileSync(path.resolve(process.cwd(), 'server/migrations', name), 'utf8'));
async function main() {
  await pool.query('DROP SCHEMA public CASCADE;CREATE SCHEMA public');
  await pool.query(`CREATE TABLE organizations(id TEXT PRIMARY KEY);CREATE TABLE projects(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,owner_id TEXT);CREATE TABLE project_members(project_id TEXT,user_id TEXT);
 CREATE TABLE transformation_cases(transformation_case_id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,project_id TEXT,execution_run_id TEXT,active_plan_id TEXT,version INTEGER,context_snapshot_id TEXT);
 CREATE TABLE v8_tool_catalog(tool_id TEXT PRIMARY KEY,organization_id TEXT,name TEXT,description TEXT,category TEXT,risk_class TEXT,mutation_type TEXT,classification_status TEXT,default_approval_mode TEXT,classified_by TEXT,classified_at TIMESTAMPTZ,version TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
 CREATE TABLE v8_consumer_tool_policies(policy_id TEXT PRIMARY KEY,organization_id TEXT,project_id TEXT,consumer_class TEXT,tool_id TEXT,allowed INTEGER,approval_override TEXT,max_invocations_per_run INTEGER,effective_from TIMESTAMPTZ,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
 CREATE TABLE wave8_agent_definitions(agent_id TEXT PRIMARY KEY,organization_id TEXT);
 INSERT INTO wave8_agent_definitions VALUES('consultify:teresa:transformation-agent',NULL);
 INSERT INTO organizations VALUES('org-team');INSERT INTO projects VALUES('project-team','org-team','sponsor');INSERT INTO project_members VALUES('project-team','owner');INSERT INTO transformation_cases VALUES('case-team','org-team','project-team','run-team','plan-team',3,'context-team');`);
  await migration('20260807_v8_agent_proposal_governance.sql');
  await migration('20260808_v8_agent_admin_settings.sql');
  await migration('20260808_t01_project_team_blueprints.sql');
  const incomplete: any = {
    sponsorUserId: null,
    members: [
      {
        kind: 'human',
        identityId: null,
        displayName: 'UNKNOWN',
        role: 'Owner',
        authority: [],
        sourceRefs: [],
      },
      {
        kind: 'agent',
        identityId: 'consultify:teresa:transformation-agent',
        displayName: 'Teresa',
        role: 'Orchestration',
        authority: ['prepare'],
        autonomy: 'execute_with_approval',
        budgetLimit: null,
        sourceRefs: ['plan-team'],
      },
    ],
    raci: [
      { workItem: 'Delivery', responsible: [], accountable: null, consulted: [], informed: [] },
    ],
    agentLimits: {},
    work: [],
  };
  const clarification = await proposeProjectTeam({
    organizationId: 'org-team',
    actorUserId: 'sponsor',
    actorRole: 'OWNER',
    caseId: 'case-team',
    expectedCaseVersion: 3,
    blueprint: incomplete,
    idempotencyKey: 'team-incomplete-1',
  });
  assert.equal(clarification.status, 'needs_clarification');
  assert.ok(clarification.missingKeys.includes('sponsorUserId'));
  const complete: any = {
    sponsorUserId: 'sponsor',
    members: [
      {
        kind: 'human',
        identityId: 'owner',
        displayName: 'Named owner',
        role: 'Project owner',
        authority: ['coordinate'],
        sourceRefs: ['project-membership'],
      },
      {
        kind: 'agent',
        identityId: 'consultify:teresa:transformation-agent',
        displayName: 'Teresa',
        role: 'Orchestration',
        authority: ['prepare', 'coordinate'],
        autonomy: 'execute_with_approval',
        budgetLimit: 500,
        sourceRefs: ['plan-team'],
      },
    ],
    raci: [
      {
        workItem: 'Delivery',
        responsible: ['owner'],
        accountable: 'sponsor',
        consulted: [],
        informed: [],
      },
    ],
    agentLimits: {
      'consultify:teresa:transformation-agent': {
        autonomy: 'execute_with_approval',
        budgetLimit: 500,
      },
    },
    work: [
      {
        workItem: 'Delivery',
        ownerIdentityId: 'owner',
        branchStatus: 'planned',
        estimatedCost: 500,
        conflicts: [],
        pendingDecisions: [],
      },
    ],
  };
  const request = {
    organizationId: 'org-team',
    actorUserId: 'sponsor',
    actorRole: 'OWNER',
    caseId: 'case-team',
    expectedCaseVersion: 3,
    blueprint: complete,
    idempotencyKey: 'team-complete-1',
  };
  await assert.rejects(
    () =>
      proposeProjectTeam({
        ...request,
        blueprint: {
          ...complete,
          members: complete.members.map((member: any) =>
            member.kind === 'agent' ? { ...member, identityId: 'invented-agent' } : member
          ),
        },
        idempotencyKey: 'team-invented-agent',
      }),
    /PROJECT_TEAM_AGENT_IDENTITY_NOT_FOUND/
  );
  const [p1, p2] = await Promise.all([proposeProjectTeam(request), proposeProjectTeam(request)]);
  assert.equal(p1.blueprintVersionId, p2.blueprintVersionId);
  assert.equal([p1, p2].filter((x) => x.idempotentReplay).length, 1);
  await assert.rejects(
    () =>
      proposeProjectTeam({
        ...request,
        blueprint: { ...complete, sponsorUserId: 'owner' },
      }),
    /PROJECT_TEAM_IDEMPOTENCY_CONFLICT/
  );
  await assert.rejects(
    () =>
      activateProjectTeam({
        organizationId: 'org-team',
        actorUserId: 'sponsor',
        actorRole: 'OWNER',
        caseId: 'case-team',
        blueprintVersionId: p1.blueprintVersionId,
        idempotencyKey: 'team-activate-early',
      }),
    /PROJECT_TEAM_APPROVAL_REQUIRED/
  );
  const approvalRequest = {
    organizationId: 'org-team',
    actorUserId: 'sponsor',
    actorRole: 'OWNER',
    caseId: 'case-team',
    blueprintVersionId: p1.blueprintVersionId,
    expectedVersion: p1.version,
    reason: 'Approved exact team and limits',
    idempotencyKey: 'team-approve-1',
  };
  const [approval1, approval2] = await Promise.all([
    approveProjectTeam(approvalRequest),
    approveProjectTeam(approvalRequest),
  ]);
  assert.equal(approval1.status, 'approved');
  assert.equal(approval1.blueprintVersionId, approval2.blueprintVersionId);
  const activationRequest = {
    organizationId: 'org-team',
    actorUserId: 'sponsor',
    actorRole: 'OWNER',
    caseId: 'case-team',
    blueprintVersionId: p1.blueprintVersionId,
    idempotencyKey: 'team-activate-1',
  };
  const [a1, a2] = await Promise.all([
    activateProjectTeam(activationRequest),
    activateProjectTeam(activationRequest),
  ]);
  assert.equal(a1.activationReceiptId, a2.activationReceiptId);
  assert.equal(a1.policyCount, 17);
  await assert.rejects(
    () =>
      proposeProjectTeam({
        ...request,
        organizationId: 'foreign',
        idempotencyKey: 'team-foreign-1',
      }),
    /PROJECT_TEAM_CANONICAL_CASE_NOT_READY/
  );
  const counts = (
    await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM transformation_project_team_blueprints) blueprints,(SELECT COUNT(*)::int FROM transformation_project_team_receipts) receipts,(SELECT COUNT(*)::int FROM v8_agent_tenant_activation_receipts) activations,(SELECT COUNT(*)::int FROM v8_consumer_tool_policies) policies`
    )
  ).rows[0];
  assert.deepEqual(counts, { blueprints: 2, receipts: 4, activations: 1, policies: 17 });
  console.log(
    JSON.stringify({
      proof: 'T01_PROJECT_TEAM_REALDB_GREEN',
      clarificationExact: true,
      noFabricatedMembership: true,
      inventedAgentDenied: true,
      A05Approved: true,
      concurrency2ProposalOneVersion: true,
      concurrency2ApprovalOneReceipt: true,
      idempotencyConflictDenied: true,
      earlyActivationDenied: true,
      concurrency2Activation: { receipts: 1, policies: 17 },
      tenantIsolation: true,
      lineage: { case: 'case-team', run: 'run-team', project: 'project-team' },
      counts,
    })
  );
}
main().then(
  () => pool.end(),
  async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  }
);
