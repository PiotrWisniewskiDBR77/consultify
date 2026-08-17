import type { APIRequestContext, Browser, BrowserContext } from '@playwright/test';
import pg from 'pg';

export type ExecutionPersona = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  role: 'ADMIN';
};
export type ExecutionSeed = {
  projectId: string;
  initiativeId: string;
  caseId: string;
  artifactLinkId: string;
};

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const APP = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const CLEANUP_OPT_IN = 'EXE_UI_ALLOW_IMMUTABLE_FIXTURE_CLEANUP';
const DB_PREFIX_ENV = 'EXE_UI_TEST_DB_PREFIX';
const RECEIPT_TRIGGER = 'trg_rvn_execution_signal_receipts_immutable';
const supportHeaders = { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' };
export const authHeaders = (p: ExecutionPersona) => ({
  Authorization: `Bearer ${p.token}`,
  'content-type': 'application/json',
});

async function checked(response: Awaited<ReturnType<APIRequestContext['post']>>, label: string) {
  if (!response.ok()) throw new Error(`${label}: ${response.status()} ${await response.text()}`);
  return response.json();
}

export async function bootstrap(
  request: APIRequestContext,
  runId: string
): Promise<ExecutionPersona> {
  const response = await request.post(`${API}/api/test-support/bootstrap`, {
    headers: supportHeaders,
    data: { runId, role: 'ADMIN' },
  });
  return { ...(await checked(response, 'bootstrap')), role: 'ADMIN' };
}

export async function addAdmin(
  request: APIRequestContext,
  tenant: ExecutionPersona
): Promise<ExecutionPersona> {
  const response = await request.post(`${API}/api/test-support/member`, {
    headers: supportHeaders,
    data: { runId: tenant.runId, role: 'ADMIN' },
  });
  return { ...(await checked(response, 'add admin')), role: 'ADMIN' };
}

export async function seedExecution(persona: ExecutionPersona): Promise<ExecutionSeed> {
  const suffix = persona.runId.replace(/[^a-zA-Z0-9-]/g, '').slice(-32);
  const seed = {
    projectId: `exe-ui-project-${suffix}`,
    initiativeId: `exe-ui-initiative-${suffix}`,
    caseId: `exe-ui-case-${suffix}`,
    artifactLinkId: `exe-ui-artifact-${suffix}`,
  };
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
      seed.projectId,
      persona.organizationId,
    ]);
    await db.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status) VALUES($1,$2,$3,$1,'EXECUTING')`,
      [seed.initiativeId, persona.organizationId, seed.projectId]
    );
    await db.query(
      `INSERT INTO case_core(case_id,organization_id,project_id,contracted_closure_type,created_by_actor_id,case_name) VALUES($1,$2,$3,'DELIVERY_COMPLETED',$4,$1)`,
      [seed.caseId, persona.organizationId, seed.projectId, persona.userId]
    );
    await db.query(
      `INSERT INTO case_workspace_artifact_links(link_id,organization_id,project_id,case_id,artifact_type,artifact_id,artifact_revision,relation,linked_by_actor_id,linked_at) VALUES($1,$2,$3,$4,'document',$5,'sha256:exe-ui-revision','DELIVERABLE',$6,now()::text)`,
      [
        seed.artifactLinkId,
        persona.organizationId,
        seed.projectId,
        seed.caseId,
        `document-${suffix}`,
        persona.userId,
      ]
    );
    return seed;
  } finally {
    await db.end();
  }
}

export async function signedContext(
  browser: Browser,
  persona: ExecutionPersona
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: APP,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(
    ({ p, origin }) => {
      if (location.origin !== origin) return;
      const user = {
        id: p.userId,
        email: 'execution@local.test',
        role: p.role,
        organizationId: p.organizationId,
        organizationName: 'Execution technical tenant',
        isAuthenticated: true,
        accessLevel: 'full',
        isDemo: false,
      };
      localStorage.setItem('token', p.token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(`consultify_onboarding_done:${p.userId}`, 'true');
      localStorage.setItem(
        'consultify-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            isDemoMode: false,
            isDemoSession: false,
            currentUser: user,
            currentOrganization: { id: p.organizationId, name: user.organizationName },
          },
          version: 0,
        })
      );
    },
    { p: persona, origin: new URL(APP).origin }
  );
  return context;
}

export async function cleanup(
  request: APIRequestContext,
  persona: ExecutionPersona
): Promise<void> {
  if (process.env[CLEANUP_OPT_IN] !== '1') {
    throw new Error(`${CLEANUP_OPT_IN}=1 is required for EXE UI fixture cleanup`);
  }
  const databasePrefix = process.env[DB_PREFIX_ENV]?.trim();
  if (!databasePrefix) throw new Error(`${DB_PREFIX_ENV} is required for EXE UI fixture cleanup`);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    const database = await db.query<{ current_database: string }>('SELECT current_database()');
    if (!database.rows[0]?.current_database.startsWith(databasePrefix)) {
      throw new Error(
        `refusing EXE UI cleanup on database ${database.rows[0]?.current_database ?? '<unknown>'}`
      );
    }
    await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      'exe-ui-technical-fixture-cleanup',
    ]);
    await db.query(`ALTER TABLE rvn_execution_signal_receipts DISABLE TRIGGER ${RECEIPT_TRIGGER}`);
    await db.query('DELETE FROM rvn_execution_signal_receipts WHERE organization_id=$1', [
      persona.organizationId,
    ]);
    for (const table of [
      'execution_results_signal_outbox',
      'execution_delivery_evidence',
      'execution_case_links',
      'case_workspace_artifact_links',
      'case_core',
      'initiatives',
      'projects',
    ])
      await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [persona.organizationId]);
    await db.query(`ALTER TABLE rvn_execution_signal_receipts ENABLE TRIGGER ${RECEIPT_TRIGGER}`);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    const trigger = await db.query<{ tgenabled: string }>(
      `SELECT t.tgenabled
         FROM pg_trigger t
         JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.oid='rvn_execution_signal_receipts'::regclass AND t.tgname=$1`,
      [RECEIPT_TRIGGER]
    );
    if (trigger.rows[0]?.tgenabled !== 'O') {
      await db.end();
      throw new Error(`${RECEIPT_TRIGGER} is not enabled after EXE UI cleanup`);
    }
    await db.end();
  }
  const response = await request.post(`${API}/api/test-support/cleanup`, {
    headers: supportHeaders,
    data: { runId: persona.runId },
  });
  if (!response.ok()) throw new Error(`cleanup: ${response.status()} ${await response.text()}`);
}
