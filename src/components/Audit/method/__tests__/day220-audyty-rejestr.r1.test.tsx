/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../../../server/src/Gateway.js';

const ENGLISH_LITERALS = [
  'Transformation Audit Pack — internal operations',
  'Internal transformation decisions retain an accountable owner, dated evidence and independent review.',
  'Internal steering review sampled 12 decisions; 3 lacked a dated independent review record.',
  'Wave 3 Audits Owner Review',
  'Wave 3 Audits Foreign Boundary',
  'Transformation governance audit — draft owner report',
  'internal owner review',
];

describe('Day220 R1 — polski fixture odbiorowy Audytów', () => {
  const app = express();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let authorization = '';

  beforeAll(async () => {
    await client.connect();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    authorization = `Bearer ${jwt.sign(
      {
        id: 'w3-aud-owner-user-v1',
        userId: 'w3-aud-owner-user-v1',
        organizationId: 'w3-aud-owner-org-v1',
        organization_id: 'w3-aud-owner-org-v1',
        role: 'ADMIN',
        email: 'w3.aud.owner@local.test',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '10m' }
    )}`;
  }, 60_000);

  afterAll(async () => {
    await client.end();
    const pgModule = await import('../../../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('używa realnego Postgresa wskazanego przez komplet env', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.DATABASE_URL).toContain('consultify_w3_audits_owner_day220');
  });

  it('nie zawiera wskazanych angielskich literalów ani w seederze, ani w zapisanych wierszach fixture', async () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/dev/seed-wave3-audits-owner-review.mjs'), 'utf8');
    for (const literal of ENGLISH_LITERALS) expect(source).not.toContain(literal);

    const result = await client.query(`
        SELECT json_build_object(
          'organizations', (SELECT json_agg(name ORDER BY id) FROM organizations WHERE id IN ('w3-aud-owner-org-v1','w3-aud-foreign-org-v1')),
          'pack', (SELECT title FROM audit_packs WHERE id='w3-aud-pack-v1'),
          'criterion', (SELECT requirement_text FROM audit_pack_criteria WHERE id='w3-aud-pack-criterion-v1'),
          'evidence', (SELECT description FROM audit_evidence WHERE id='w3-aud-evidence-v1'),
          'report', (SELECT json_build_object('title',title,'audience',audience,'confidentiality',confidentiality) FROM audit_reports WHERE id='w3-aud-report-v1')
        ) AS fixture
    `);
    const fixture = JSON.stringify(result.rows[0]?.fixture ?? {});
    expect(fixture).toContain('Pakiet audytu transformacji');
    expect(fixture).toContain('wewnętrzny przegląd właścicielski');
    for (const literal of ENGLISH_LITERALS) expect(fixture).not.toContain(literal);
  });

  it('osiąga polskie dane przez realny ApiGateway, podpisany JWT i trasy HTTP', async () => {
    const headers = { Authorization: authorization, 'x-org-context': 'w3-aud-owner-org-v1' };
    const programs = await request(app).get('/api/audits/programs').set(headers);
    const reports = await request(app).get('/api/audits/reports').set(headers);

    expect(programs.status, JSON.stringify(programs.body)).toBe(200);
    expect(reports.status, JSON.stringify(reports.body)).toBe(200);
    const payload = JSON.stringify({ programs: programs.body, reports: reports.body });
    expect(payload).toContain('Audyt zarządzania transformacją — szkic raportu właścicielskiego');
    expect(payload).toContain('wewnętrzny przegląd właścicielski');
    expect(JSON.stringify(programs.body)).toContain('"criteriaTotal":1');
    expect(JSON.stringify(programs.body)).toContain('"criteriaConcluded":1');
    for (const literal of ENGLISH_LITERALS) expect(payload).not.toContain(literal);
  });
});
