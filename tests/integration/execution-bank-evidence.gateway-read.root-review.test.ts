/** @vitest-environment jsdom */
// Root independent signed-JWT / actual ApiGateway adaptation of the existing golden-flow scaffold.
import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import React from 'react';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../../server/src/config/Config.js';
import { ApiGateway } from '../../server/src/Gateway.js';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool + enable the
// E2E auth bypass, but ONLY when a database is actually configured — mirrors
// execution-spine.golden-flow.realdb.test.ts's env guard.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'false';
}

// Routers/middleware are imported AFTER the env guard above (informational —
// none of these modules touch the DB pool at import time).
import initiativesRoutes from '../../server/src/routes/pmo/initiatives.routes.js';
import verifyToken from '../../server/src/middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../server/src/middleware/mutationGuard.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../server/src/middleware/v8Auth.middleware.js';
import { v8OrgGate } from '../../server/src/middleware/v8FeatureGate.middleware.js';
import { v8MetricsMiddleware } from '../../server/src/middleware/v8Metrics.middleware.js';
import executionControlRoutes from '../../server/src/routes/v8/execution-control.routes.js';
import { ExecutionBankViews } from '../../src/components/Execution/ExecutionBankViews.js';
import {
  buildExecutionBankRows,
  buildExecutionCalendarWindow,
} from '../../src/components/Execution/executionBankModel.js';

// ---------------------------------------------------------------------------
// Connection probe (same contract as execution-spine.golden-flow.realdb.test.ts)
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

const REQUIRED_TABLES = [
  'organizations',
  'users',
  'projects',
  'initiatives',
  'initiative_history',
  'execution_audit_log',
  'manager_action_audit_log',
  'tasks',
  'decisions',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as execution-spine.golden-flow.realdb.test.ts)
// ---------------------------------------------------------------------------

function makeE2EToken(userId: string, organizationId: string): string {
  return jwt.sign({ id: userId, organizationId, role: 'ADMIN', userRole: 'ADMIN', email: `${userId}@local.test` }, config.JWT_SECRET, { expiresIn: '15m' });
}

// ---------------------------------------------------------------------------
// App under test — REAL routers, REAL middleware chains, REAL controllers.
// ---------------------------------------------------------------------------

let gatewayApp: ReturnType<typeof express> | null = null;
function buildApp() {
  if (gatewayApp) return gatewayApp;
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
  gatewayApp = app;
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  projectAId: string;
  initiativeAId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_excp_a_${tag}`;
  const orgBId = `org_excp_b_${tag}`;
  const userAId = `user_excp_a_${tag}`;
  const userBId = `user_excp_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE Change/Progress RealDB Org A', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE Change/Progress RealDB Org B', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXECP', 'UserA')
     ON CONFLICT (id) DO NOTHING`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXECP', 'UserB')
     ON CONFLICT (id) DO NOTHING`,
    [userBId, orgBId, `${userBId}@local.test`]
  );

  await client.query(`INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'ADMIN','ACTIVE')`, [`member_a_${tag}`, orgAId, userAId, `member_b_${tag}`, orgBId, userBId]);
  const projectAId = `proj_excp_a_${tag}`;
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id)
     VALUES ($1, $2, 'EXE Change/Progress RealDB Project (org A)', 'active', $3)`,
    [projectAId, orgAId, userAId]
  );

  // Seeded directly by SQL (frozen: no transition/start/unblock endpoint call)
  // in the current canonical status Execution operates on, same convention as
  // execution-spine.golden-flow.realdb.test.ts.
  const initiativeAId = `init_excp_a_${tag}`;
  await client.query(
    `INSERT INTO initiatives (id, organization_id, project_id, name, status, progress)
     VALUES ($1, $2, $3, 'EXE Change/Progress RealDB Initiative (org A, IN_EXECUTION)', 'IN_EXECUTION', 0)`,
    [initiativeAId, orgAId, projectAId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM decisions WHERE initiative_id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM execution_audit_log WHERE initiative_id = $1`, [
        initiativeAId,
      ]);
      await client.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [
        initiativeAId,
      ]);
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]);
      // Best-effort: the E2E auth bypass also seeds `organization_members`
      // rows for whichever identities actually authenticate.
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      throw new Error('ROOT_GATEWAY_FIXTURE_CLEANUP_FAILED');
    }
    const remaining = await client.query('SELECT COUNT(*)::int AS count FROM organizations WHERE id = ANY($1)', [[orgAId, orgBId]]);
    expect(remaining.rows[0].count).toBe(0);
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userBId, projectAId, initiativeAId, cleanup };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E1b signed JWT Gateway reader and retired writer boundary', () => {
  let h: Harness;
  beforeAll(async () => { const value = await setupHarness(); if (!value) throw new Error('REAL_DB_REQUIRED'); h=value; });
  afterAll(async () => { if(h) await h.cleanup(); });
  it('reads exact progress receipt through signed JWT Gateway and renders the same Initiative identity', async () => {
    const token = makeE2EToken(h.userAId,h.orgAId);
    const update = await request(buildApp()).patch(`/api/initiatives/${h.initiativeAId}/quick-update`).set('Authorization',`Bearer ${token}`).send({progress:42,idempotencyKey:`root_progress_${h.initiativeAId}`});
    expect(update.status,JSON.stringify(update.body)).toBe(200);
    const observed = await h.client.query("SELECT changed_at FROM initiative_history WHERE initiative_id=$1 AND action='progress_updated' ORDER BY changed_at DESC LIMIT 1",[h.initiativeAId]);
    const clockLeadMs = Math.max(0, observed.rows[0].changed_at.getTime() - Date.now());
    expect(clockLeadMs).toBeLessThan(1000);
    if(clockLeadMs > 0) await new Promise(resolve => setTimeout(resolve, clockLeadMs + 1));
    const asOf=new Date().toISOString();
    const response=await request(buildApp()).get('/api/initiatives').query({includeExecutionEvidence:'1',asOf}).set('Authorization',`Bearer ${token}`);
    expect(response.status,JSON.stringify(response.body)).toBe(200);
    const item=response.body.find((row:any)=>row.id===h.initiativeAId);
    const receipt=await h.client.query("SELECT id,changed_at FROM initiative_history WHERE initiative_id=$1 AND action='progress_updated' ORDER BY changed_at DESC LIMIT 1",[h.initiativeAId]);
    expect(item.progressEvidence, JSON.stringify({progress:item.progress,evidence:item.progressEvidence,receipt:receipt.rows})).toMatchObject({value:42,asOf,completeness:'KNOWN',source:{recordId:receipt.rows[0].id},observedAt:receipt.rows[0].changed_at.toISOString()});
    const [row]=buildExecutionBankRows([{...item,lifecycleStatus:item.status}],[],{asOf});
    render(React.createElement(ExecutionBankViews,{rows:[row],view:'table',selected:null,calendarWindow:buildExecutionCalendarWindow(asOf,3),onSelect:()=>{},onOpen:()=>{},onHorizonChange:()=>{},onDrilldownMonth:()=>{}}));
    expect(screen.getByTestId(`execution-bank-table-item-initiative:${h.initiativeAId}`)).toHaveAttribute('data-initiative-id',h.initiativeAId);
    expect(screen.getByTestId('execution-bank-progress-null')).toHaveTextContent('42%');cleanup();
  });
  it('rejects absent and invalid signatures before returning evidence', async () => {
    const path='/api/initiatives?includeExecutionEvidence=1';
    expect((await request(buildApp()).get(path)).status).toBe(401);
    const invalid=jwt.sign({id:h.userAId,organizationId:h.orgAId,role:'ADMIN'},'wrong-root-test-secret',{expiresIn:'15m'});
    expect((await request(buildApp()).get(path).set('Authorization',`Bearer ${invalid}`)).status).toBe(401);
  });
  it('preserves retired replan refusal and stored forecast for owner and foreign tenant', async () => {
    const read=()=>h.client.query('SELECT forecast_start_date,forecast_end_date FROM initiatives WHERE id=$1',[h.initiativeAId]);
    const before=(await read()).rows;
    for(const [user,org] of [[h.userAId,h.orgAId],[h.userBId,h.orgBId]]) {
      const response=await request(buildApp()).post('/api/v8/execution-control/interventions/replan').set('Authorization',`Bearer ${makeE2EToken(user,org)}`).send({entityType:'INITIATIVE',entityId:h.initiativeAId,forecastEndDate:'2026-12-31',reason:'retired writer must refuse'});
      expect(response.status,JSON.stringify(response.body)).toBe(409);
      expect(response.body).toMatchObject({code:'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',canonicalWriter:'/api/initiatives/runtime-v1'});
    }
    expect((await read()).rows).toEqual(before);
  });
});
