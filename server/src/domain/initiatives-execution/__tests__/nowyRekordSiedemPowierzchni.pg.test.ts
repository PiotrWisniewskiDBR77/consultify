/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('CODEX1 E5 — nowy rekord z UI widoczny na siedmiu powierzchniach', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  const title = `CODEX1 E5 ${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,'CODEX1 E5 org','active')`, [organizationId]);
    await sql.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active')`, [userId, organizationId, `${userId}@test.invalid`]);
    await sql.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [randomUUID(), organizationId, userId]);
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'CODEX1 E5 project',$3)`, [projectId, organizationId, userId]);
    authorization = `Bearer ${jwt.sign({ id: userId, userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role: 'OWNER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_audit_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('tworzy rekord droga API uzywana przez zapis UI i potwierdza SQL kanon=1 zastany=0', async () => {
    const sourceId = `manual-hub-${randomUUID()}`;
    const submit = await request(app).post('/api/initiatives/runtime-v1/source-proposals').set('Authorization', authorization).send({
      proposalId, expectedVersion: 0, clientRequestId: `submit-${randomUUID()}`, sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1,
      provenance: { system: 'consultify.initiatives-hub', recordType: 'manual-initiative-proposal', capturedAt: new Date().toISOString(), evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`] },
      title, problem: 'Dowod E5', proposedOutcome: null, priority: 'MEDIUM', projectId, initiativeOwnerId: userId, visibility: 'PROJECT',
    });
    expect(submit.status, JSON.stringify(submit.body)).toBe(201);
    const register = await request(app).post('/api/initiatives/runtime-v1/registrations').set('Authorization', authorization).send({
      initiativeId, expectedVersion: 0, clientRequestId: `register-${randomUUID()}`, proposalId, proposalVersion: 1,
      sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1, title, problem: 'Dowod E5', proposedOutcome: null,
      priority: 'MEDIUM', projectId, visibility: 'PROJECT', initiativeOwnerId: userId,
    });
    expect(register.status, JSON.stringify(register.body)).toBe(201);
    const counts = await sql.query(`SELECT (SELECT count(*)::int FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id=$1) kanon, (SELECT count(*)::int FROM initiatives WHERE id=$1) zastany`, [initiativeId]);
    expect(counts.rows[0]).toEqual({ kanon: 1, zastany: 0 });
  });

  it('mierzy tresc siedmiu tras powierzchni bez zaliczania pustej koperty', async () => {
    const calls = [
      ['lista', '/api/initiatives'],
      ['karta', `/api/initiatives/${initiativeId}`],
      ['KPI', `/api/initiatives/${initiativeId}/kpis`],
      ['kokpit Realizacji', `/api/v8/execution-control/capacity/timeline?initiativeId=${initiativeId}`],
      ['Moja Praca', '/api/my-work/executive-analytics'],
      ['Wyniki', `/api/v8/results/dashboard?initiativeId=${initiativeId}`],
      ['raporty', `/api/report-builder/backlinks/initiative/${initiativeId}`],
    ] as const;
    const matrix: Array<{ surface: string; route: string; status: number; containsId: boolean; containsTitle: boolean; visible: boolean; error?: string }> = [];
    for (const [surface, route] of calls) {
      try {
        const response = await request(app).get(route).set('Authorization', authorization).timeout({ response: 5_000, deadline: 7_000 });
        const body = JSON.stringify(response.body);
        const containsId = body.includes(initiativeId);
        const containsTitle = body.includes(title);
        const visible = surface === 'KPI'
          ? response.status === 200 && !body.includes('INITIATIVE_NOT_FOUND')
          : response.status === 200 && containsTitle;
        matrix.push({ surface, route, status: response.status, containsId, containsTitle, visible });
      } catch (error) {
        matrix.push({ surface, route, status: 0, containsId: false, containsTitle: false, visible: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(`CODEX1_E5_MATRIX=${JSON.stringify(matrix)}`);
    if (process.env.CODEX1_E5_MATRIX_OUTPUT) {
      fs.writeFileSync(process.env.CODEX1_E5_MATRIX_OUTPUT, JSON.stringify(matrix, null, 2) + '\n');
    }
    const visible = matrix.filter((row) => row.visible).map((row) => row.surface);
    expect(visible).toEqual(process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true' ? ['lista', 'karta', 'KPI'] : []);
  });
});
