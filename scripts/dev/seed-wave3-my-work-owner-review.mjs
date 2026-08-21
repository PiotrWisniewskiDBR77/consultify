#!/usr/bin/env node
/**
 * Wave 3 / module 07 (My Work + Agent) — deterministic local owner fixture.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/dev/seed-wave3-my-work-owner-review.mjs seed
 *   DATABASE_URL=postgresql://... node scripts/dev/seed-wave3-my-work-owner-review.mjs readback
 *   MYW_OWNER_FIXTURE_ALLOW_RESET=1 DATABASE_URL=postgresql://... \
 *     node scripts/dev/seed-wave3-my-work-owner-review.mjs reset
 *
 * `seed` requires the local backend (default http://127.0.0.1:3941) because
 * the Agent proposal is deliberately created through the mounted signed-auth
 * API. `readback` is SQL-only. `reset` is fail-closed and deletes only the
 * exact IDs owned by this fixture; it never deletes the cw-local identity,
 * organization or project.
 */

import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const API_BASE = (process.env.MYW_OWNER_FIXTURE_API_BASE || 'http://127.0.0.1:3941').replace(/\/$/, '');
const COMMAND = process.argv[2] || 'readback';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);

const FIXTURE = Object.freeze({
  organizationId: 'cw-local-org',
  ownerId: 'cw-local-user',
  ownerEmail: 'cw.local@local.test',
  ownerPassword: 'CaseWorkspaceLocal!2026',
  projectId: 'cw-local-project',
  requesterId: 'w3-myw-owner-requester',
  requesterEmail: 'w3.myw.requester@local.test',
  requesterPassword: 'Wave3MyWorkRequester!2026',
  requesterMemberId: 'w3-myw-owner-requester-member',
  memberId: 'w3-myw-boundary-member',
  memberEmail: 'w3.myw.member@local.test',
  memberPassword: 'Wave3MyWorkMember!2026',
  memberMembershipId: 'w3-myw-boundary-member-membership',
  taskId: 'w3-myw-owner-task',
  taskTitle: 'W3-MYW-OWNER · Domknij plan wdrożenia pilota',
  decisionId: 'w3-myw-owner-decision',
  decisionTitle: 'W3-MYW-OWNER · Zatwierdź zakres pilota',
  planId: 'w3-myw-owner-agent-plan',
  planTitle: 'W3-MYW-OWNER · Przygotowanie pakietu pilota',
  proposalKey: 'w3-myw-owner-agent-proposal-v1',
  proposalTitle: 'W3-MYW-OWNER · Zadanie utworzone po niezależnej akceptacji',
});

function fail(message) {
  throw new Error(`[W3-MYW fixture] BLOCKED: ${message}`);
}

function assertEnvironment() {
  if (!DATABASE_URL) fail('DATABASE_URL is required');
  let database;
  let api;
  try {
    database = new URL(DATABASE_URL);
    api = new URL(API_BASE);
  } catch {
    fail('DATABASE_URL and MYW_OWNER_FIXTURE_API_BASE must be valid URLs');
  }
  if (!LOCAL_HOSTS.has(database.hostname)) fail(`database host ${database.hostname} is not local`);
  if (!LOCAL_HOSTS.has(api.hostname)) fail(`API host ${api.hostname} is not local`);
  if (!['seed', 'readback', 'reset'].includes(COMMAND)) {
    fail(`unknown command ${COMMAND}; expected seed, readback or reset`);
  }
}

async function requireCanonicalBaseline(client) {
  const result = await client.query(
    `SELECT
       EXISTS(SELECT 1 FROM organizations WHERE id=$1) AS org,
       EXISTS(SELECT 1 FROM users WHERE id=$2 AND organization_id=$1) AS owner,
       EXISTS(SELECT 1 FROM organization_members
              WHERE organization_id=$1 AND user_id=$2 AND UPPER(status)='ACTIVE') AS membership,
       EXISTS(SELECT 1 FROM projects WHERE id=$3 AND organization_id=$1) AS project`,
    [FIXTURE.organizationId, FIXTURE.ownerId, FIXTURE.projectId]
  );
  const row = result.rows[0];
  if (!row?.org || !row?.owner || !row?.membership || !row?.project) {
    fail('cw-local baseline is incomplete; run scripts/dev/case-workspace-seed-local.mjs first');
  }
}

async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail(`login ${email} returned HTTP ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if (!body?.token) fail(`login ${email} returned no signed token`);
  return body.token;
}

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) fail(`${options.method || 'GET'} ${path} returned HTTP ${response.status}: ${text}`);
  return { status: response.status, body };
}

async function seed(client) {
  await requireCanonicalBaseline(client);
  const requesterHash = await bcrypt.hash(FIXTURE.requesterPassword, 10);
  const memberHash = await bcrypt.hash(FIXTURE.memberPassword, 10);
  await client.query('BEGIN');
  try {
    for (const [id, email, password, role, firstName] of [
      [FIXTURE.requesterId, FIXTURE.requesterEmail, requesterHash, 'ADMIN', 'Agent'],
      [FIXTURE.memberId, FIXTURE.memberEmail, memberHash, 'USER', 'Member'],
    ]) {
      await client.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
         VALUES($1,$2,$3,$4,$5,'Wave3 Fixture',$6,'active')
         ON CONFLICT(id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
           email=EXCLUDED.email,password=EXCLUDED.password,role=EXCLUDED.role,status='active'`,
        [id, FIXTURE.organizationId, email, password, firstName, role]
      );
    }
    for (const [id, userId, role] of [
      [FIXTURE.requesterMemberId, FIXTURE.requesterId, 'OWNER'],
      [FIXTURE.memberMembershipId, FIXTURE.memberId, 'USER'],
    ]) {
      await client.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')
         ON CONFLICT(organization_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE'`,
        [id, FIXTURE.organizationId, userId, role]
      );
    }
    await client.query(
      `INSERT INTO tasks(id,project_id,organization_id,title,description,status,priority,
                         assignee_id,reporter_id,owner_id,task_type,idempotency_key,tags)
       VALUES($1,$2,$3,$4,$5,'todo','high',$6,$6,$6,'personal',$7,$8)
       ON CONFLICT(id) DO NOTHING`,
      [FIXTURE.taskId, FIXTURE.projectId, FIXTURE.organizationId, FIXTURE.taskTitle,
       'Realistyczne zadanie właściciela: sprawdź kontekst, przejdź TODO → IN_PROGRESS i potwierdź odczyt po odświeżeniu.',
       FIXTURE.ownerId, 'w3-myw-owner-task-v1', JSON.stringify(['WAVE_3', 'OWNER_REVIEW'])]
    );
    await client.query(
      `INSERT INTO decisions(id,organization_id,project_id,title,description,type,status,priority,
                             decision_maker_id,decision_owner_id,created_by,source_type,source_id,idempotency_key)
       VALUES($1,$2,$3,$4,$5,'APPROVAL','pending','HIGH',$6,$6,$7,'my_work_owner_fixture',$8,$9)
       ON CONFLICT(id) DO NOTHING`,
      [FIXTURE.decisionId, FIXTURE.organizationId, FIXTURE.projectId, FIXTURE.decisionTitle,
       'Zakres: jeden zakład produkcyjny, 12 tygodni, mierzalny efekt OEE. Oceń czy kontekst i konsekwencje są wystarczające do decyzji.',
       FIXTURE.ownerId, FIXTURE.requesterId, FIXTURE.taskId, 'w3-myw-owner-decision-v1']
    );
    await client.query(
      `INSERT INTO ai_agent_plans(id,organization_id,user_id,title,description,status,total_steps,
                                  completed_steps,current_step_index,plan_json,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,'planning',3,1,1,$6,clock_timestamp(),date_trunc('milliseconds',clock_timestamp()))
       ON CONFLICT(id) DO NOTHING`,
      [FIXTURE.planId, FIXTURE.organizationId, FIXTURE.requesterId, FIXTURE.planTitle,
       'Agent przygotował propozycję, ale nie może sam utworzyć kanonicznego zadania.',
       JSON.stringify([
         { title: 'Zbierz dane pilota', status: 'completed' },
         { title: 'Przygotuj propozycję zadania', status: 'awaiting_approval' },
         { title: 'Przekaż do My Work', status: 'pending' },
       ])]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const requesterToken = await login(FIXTURE.requesterEmail, FIXTURE.requesterPassword);
  const ownerToken = await login(FIXTURE.ownerEmail, FIXTURE.ownerPassword);
  const source = (await api(`/api/my-work/agent-materialization/source/${FIXTURE.planId}`, requesterToken)).body;
  await api('/api/my-work/agent-materialization/proposals', requesterToken, {
    method: 'POST',
    body: JSON.stringify({
      sourcePlanId: FIXTURE.planId,
      sourceVersion: source.sourceVersion,
      sourceHash: source.sourceHash,
      targetKind: 'task',
      content: {
        title: FIXTURE.proposalTitle,
        description: 'Kanoniczne zadanie może powstać dopiero po decyzji niezależnego człowieka.',
      },
      idempotencyKey: FIXTURE.proposalKey,
      expiresAt: '2030-01-01T12:00:00.000Z',
    }),
  });
  await api('/api/v8/my-work/inbox/canonical/materialize', ownerToken, { method: 'POST' });
  return readback(client);
}

async function readback(client) {
  await requireCanonicalBaseline(client);
  const result = await client.query(
    `SELECT
      (SELECT json_build_object('id',id,'status',status,'versionToken',CAST(updated_at AS TEXT))
         FROM tasks WHERE id=$1 AND organization_id=$4) AS task,
      (SELECT json_build_object('id',id,'status',status) FROM decisions WHERE id=$2 AND organization_id=$4) AS decision,
      (SELECT json_build_object('id',id,'userId',user_id,'updatedAt',updated_at)
         FROM ai_agent_plans WHERE id=$3 AND organization_id=$4) AS plan,
      (SELECT COALESCE(json_agg(json_build_object('proposalId',p.proposal_id,'state',p.state,
          'stateVersion',p.state_version,'receiptStatus',r.status,'targetId',r.target_id)
          ORDER BY p.created_at), '[]'::json)
         FROM myw_agent_materialization_proposals p
         LEFT JOIN myw_agent_materialization_receipts r ON r.proposal_id=p.proposal_id
         WHERE p.organization_id=$4 AND p.idempotency_key=$5) AS proposals,
      (SELECT count(*)::int FROM canonical_inbox_items
         WHERE organization_id=$4 AND user_id=$6 AND source_entity_id IN ($1,$2)) AS inbox_items`,
    [FIXTURE.taskId, FIXTURE.decisionId, FIXTURE.planId, FIXTURE.organizationId,
     FIXTURE.proposalKey, FIXTURE.ownerId]
  );
  const { ownerPassword: _ownerPassword, requesterPassword: _requesterPassword,
    memberPassword: _memberPassword, ...publicFixture } = FIXTURE;
  const payload = { command: COMMAND, fixture: publicFixture, readback: result.rows[0] };
  console.log(JSON.stringify(payload, null, 2));
  return payload;
}

async function reset(client) {
  if (process.env.MYW_OWNER_FIXTURE_ALLOW_RESET !== '1') {
    fail('reset requires MYW_OWNER_FIXTURE_ALLOW_RESET=1');
  }
  await requireCanonicalBaseline(client);
  await client.query('BEGIN');
  try {
    const receipts = await client.query(
      `SELECT r.target_kind,r.target_id FROM myw_agent_materialization_receipts r
       JOIN myw_agent_materialization_proposals p ON p.proposal_id=r.proposal_id
       WHERE p.organization_id=$1 AND p.idempotency_key=$2`,
      [FIXTURE.organizationId, FIXTURE.proposalKey]
    );
    for (const { target_kind: kind, target_id: id } of receipts.rows) {
      if (!id) continue;
      if (kind === 'task') await client.query('DELETE FROM tasks WHERE id=$1 AND organization_id=$2', [id, FIXTURE.organizationId]);
      if (kind === 'decision') await client.query('DELETE FROM decisions WHERE id=$1 AND organization_id=$2', [id, FIXTURE.organizationId]);
      if (kind === 'notebook') await client.query('DELETE FROM notebook_pages WHERE id=$1 AND organization_id=$2', [id, FIXTURE.organizationId]);
    }
    await client.query(
      `DELETE FROM canonical_inbox_items WHERE organization_id=$1
       AND (source_entity_id IN ($2,$3) OR title LIKE 'W3-MYW-OWNER ·%')`,
      [FIXTURE.organizationId, FIXTURE.taskId, FIXTURE.decisionId]
    );
    await client.query(
      `DELETE FROM myw_agent_canonical_outbox WHERE organization_id=$1 AND command_key IN
       (SELECT 'myw-agent:' || proposal_id::text FROM myw_agent_materialization_proposals
        WHERE organization_id=$1 AND idempotency_key=$2)`,
      [FIXTURE.organizationId, FIXTURE.proposalKey]
    );
    await client.query('ALTER TABLE myw_agent_materialization_receipts DISABLE TRIGGER trg_myw_agent_receipt_append_only');
    await client.query('ALTER TABLE myw_agent_materialization_approvals DISABLE TRIGGER trg_myw_agent_approval_append_only');
    await client.query('ALTER TABLE myw_agent_materialization_proposals DISABLE TRIGGER trg_myw_agent_proposal_guard');
    await client.query(
      `DELETE FROM myw_agent_materialization_receipts WHERE proposal_id IN
       (SELECT proposal_id FROM myw_agent_materialization_proposals WHERE organization_id=$1 AND idempotency_key=$2)`,
      [FIXTURE.organizationId, FIXTURE.proposalKey]
    );
    await client.query(
      `DELETE FROM myw_agent_materialization_approvals WHERE proposal_id IN
       (SELECT proposal_id FROM myw_agent_materialization_proposals WHERE organization_id=$1 AND idempotency_key=$2)`,
      [FIXTURE.organizationId, FIXTURE.proposalKey]
    );
    await client.query(
      'DELETE FROM myw_agent_materialization_proposals WHERE organization_id=$1 AND idempotency_key=$2',
      [FIXTURE.organizationId, FIXTURE.proposalKey]
    );
    await client.query('ALTER TABLE myw_agent_materialization_receipts ENABLE TRIGGER trg_myw_agent_receipt_append_only');
    await client.query('ALTER TABLE myw_agent_materialization_approvals ENABLE TRIGGER trg_myw_agent_approval_append_only');
    await client.query('ALTER TABLE myw_agent_materialization_proposals ENABLE TRIGGER trg_myw_agent_proposal_guard');
    await client.query('DELETE FROM decisions WHERE id=$1 AND organization_id=$2', [FIXTURE.decisionId, FIXTURE.organizationId]);
    await client.query('DELETE FROM tasks WHERE id=$1 AND organization_id=$2', [FIXTURE.taskId, FIXTURE.organizationId]);
    await client.query('DELETE FROM ai_agent_plans WHERE id=$1 AND organization_id=$2', [FIXTURE.planId, FIXTURE.organizationId]);
    await client.query('DELETE FROM organization_members WHERE organization_id=$1 AND user_id IN ($2,$3)', [FIXTURE.organizationId, FIXTURE.requesterId, FIXTURE.memberId]);
    await client.query('DELETE FROM users WHERE organization_id=$1 AND id IN ($2,$3)', [FIXTURE.organizationId, FIXTURE.requesterId, FIXTURE.memberId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  console.log(JSON.stringify({ command: 'reset', deleted: true, organizationPreserved: FIXTURE.organizationId }, null, 2));
}

async function main() {
  assertEnvironment();
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    if (COMMAND === 'seed') await seed(client);
    else if (COMMAND === 'reset') await reset(client);
    else await readback(client);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
