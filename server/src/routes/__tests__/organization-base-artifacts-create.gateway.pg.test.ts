import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const expectedDatabase = process.env.B17_TEST_DATABASE || '';
const origin = 'http://127.0.0.1:4221';
const pool = new Pool({ connectionString: databaseUrl, max: 4 });

const parentOrgId = randomUUID();
const parentUserId = randomUUID();
const createdOrgIds: string[] = [];
let server: Server;

const canonicalOrigins = [
  ['document_template', 'doc-template-system-en-client_final_report'],
  ['presentation_template', 'dbr77-deck-board'],
  ['sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'],
] as const;

async function canonicalCards(organizationId: string) {
  const result = await pool.query<{
    output_type: string;
    template_family_ref: string;
    origin_runtime: string;
    origin_record_id: string;
  }>(
    `SELECT a.output_type, a.template_family_ref, l.origin_runtime, l.origin_record_id
       FROM v8_output_artifacts a
       JOIN v8_artifact_origin_links l
         ON l.artifact_id = a.artifact_id
        AND l.organization_id = a.organization_id
      WHERE a.organization_id = $1
        AND (l.origin_runtime, l.origin_record_id) IN (
          ('document_template','doc-template-system-en-client_final_report'),
          ('presentation_template','dbr77-deck-board'),
          ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
        )
      ORDER BY l.origin_runtime`,
    [organizationId]
  );
  return result.rows;
}

beforeAll(async () => {
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1');
  expect(identity.port).toBe('6469');

  const functionResult = await pool.query<{ exists: string | null }>(
    `SELECT to_regprocedure('seed_organization_base_artifacts(text)')::text AS exists`
  );
  expect(functionResult.rows[0]?.exists).toBe('seed_organization_base_artifacts(text)');

  await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`, [
    parentOrgId,
    'Organizacja nadrzędna B17',
  ]);
  await pool.query(
    `INSERT INTO users(id,organization_id,email,password,role,status)
     VALUES($1,$2,$3,'local-fixture-not-login','ADMIN','active')`,
    [parentUserId, parentOrgId, `${parentUserId}@test.invalid`]
  );
  await pool.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status)
     VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
    [randomUUID(), parentOrgId, parentUserId]
  );

  const config = (await import('../../config/Config.js')).default;
  const routes = (await import('../organization/organizations.routes.js')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/organizations', routes);
  server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(4221, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });

  process.env.B17_AUTH_TOKEN = jwt.sign(
    {
      id: parentUserId,
      organizationId: parentOrgId,
      role: 'ADMIN',
      email: `${parentUserId}@test.invalid`,
    },
    config.JWT_SECRET,
    { expiresIn: '15m' }
  );
}, 60_000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
  delete process.env.B17_AUTH_TOKEN;
  await pool.end();
  const db = await import('../../database/PostgresDatabase.js');
  await db.default.close();
});

describe('B17 karty bazowe przy tworzeniu organizacji (realna trasa Gateway + PostgreSQL)', () => {
  it('POST /api/organizations tworzy dokładnie kanoniczne karty DOC/DECK/SHEET', async () => {
    const response = await request(origin)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${process.env.B17_AUTH_TOKEN}`)
      .send({ name: `B17 ${randomUUID()}` });

    expect(response.status, response.text).toBe(201);
    const organizationId = String(response.body.id);
    createdOrgIds.push(organizationId);

    const cards = await canonicalCards(organizationId);
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => [card.origin_runtime, card.origin_record_id])).toEqual(
      canonicalOrigins
    );
    expect(cards.map((card) => card.template_family_ref).sort()).toEqual([
      'DECK-BASE',
      'DOC-BASE',
      'SHEET-BASE',
    ]);

    const replay = await pool.query<{ seeded_count: number }>(
      `SELECT seed_organization_base_artifacts($1) AS seeded_count`,
      [organizationId]
    );
    expect(Number(replay.rows[0]?.seeded_count)).toBe(3);
    await expect(canonicalCards(organizationId)).resolves.toHaveLength(3);
  });
});
