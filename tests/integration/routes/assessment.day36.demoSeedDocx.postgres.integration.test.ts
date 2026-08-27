/** @vitest-environment node */
import fs from 'node:fs/promises';
import path from 'node:path';

import express, { type Express } from 'express';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureDrdDocx } from '../../../scripts/demo-seed/measureDrdDocx.js';
import { run } from '../../../scripts/seed-demo-drd-metalpol.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const EVIDENCE_DIR = path.resolve(
  'docs/program/waves/WAVE_03_ACCEPTANCE/evidence/demo-data-day36-20260828'
);
const BEFORE_FILE = path.join(EVIDENCE_DIR, 'raport-drd-PRZED-pusta-sesja.docx');
const AFTER_FILE = path.join(EVIDENCE_DIR, 'raport-drd-PO-metalpol.docx');

function binary(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body?: Buffer) => void
) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', callback);
}

describe.skipIf(!REAL_DB)('Day 36 Metalpol seed DOCX — real router, JWT and PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let metalpolToken = '';
  let emptyToken = '';
  const emptyOrg = 'demo-metalpol-before-org';
  const emptyUser = 'demo-metalpol-before-user';
  const emptySession = 'demo-metalpol-before-session';

  const getDocx = (sessionId: string, token: string) =>
    request(app)
      .get(`/api/method/sessions/${sessionId}/assessment-report.docx`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binary);

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: DATABASE_URL });
    await run('purge');
    await pool.query(
      `INSERT INTO organizations (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
      [emptyOrg, 'Day 36 empty baseline']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role) VALUES ($1,$2,$3,'user') ON CONFLICT (id) DO NOTHING`,
      [emptyUser, emptyOrg, 'day36-empty@demo-seed.invalid']
    );
    await pool.query(
      `INSERT INTO method_sessions
       (id,organization_id,module,method_pack_id,method_pack_version,state,mode,owner_user_id)
       VALUES ($1,$2,'assessment','drd','2.0.0-methodpack.1','active','guided_manual',$3)
       ON CONFLICT (id) DO NOTHING`,
      [emptySession, emptyOrg, emptyUser]
    );
    const { default: config } = await import('../../../server/src/config/Config.js');
    const options = {
      expiresIn: '15m' as const,
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    };
    emptyToken = jwt.sign(
      { id: emptyUser, organizationId: emptyOrg, role: 'user' },
      config.JWT_SECRET,
      options
    );
    metalpolToken = jwt.sign(
      {
        id: 'demo-metalpol-user-akowalczyk',
        organizationId: 'demo-metalpol-org',
        role: 'user',
      },
      config.JWT_SECRET,
      options
    );
    const { default: routes } = await import('../../../server/src/routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', routes);
    await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  }, 60_000);

  afterAll(async () => {
    await run('purge');
    await pool.query(`DELETE FROM method_sessions WHERE id=$1`, [emptySession]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [emptyUser]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [emptyOrg]);
    await pool.end();
  });

  it('keeps 102 narrative placeholders while measured data fills the report', async () => {
    const before = await getDocx(emptySession, emptyToken);
    expect(before.status).toBe(200);
    await fs.writeFile(BEFORE_FILE, before.body);

    await run('apply');
    const after = await getDocx('demo-metalpol-session', metalpolToken);
    expect(after.status).toBe(200);
    expect(after.headers['content-type']).toContain(DOCX_TYPE);
    expect(after.headers['content-disposition']).toContain('Raport_DRD_Metalpol');
    expect(Number(after.headers['content-length'])).toBe(after.body.length);
    await fs.writeFile(AFTER_FILE, after.body);

    const zip = await JSZip.loadAsync(after.body);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const normalizedXml = documentXml.replaceAll('\u00a0', ' ');
    expect(normalizedXml).toContain('Metalpol Sp. z o.o.');
    expect(normalizedXml).toContain('3 — Kontrola procesu');
    expect(normalizedXml).toContain('5 — MES');
    expect(normalizedXml).not.toContain('Oś nie została oceniona.');

    const beforeMetrics = await measureDrdDocx(BEFORE_FILE);
    const afterMetrics = await measureDrdDocx(AFTER_FILE);
    expect(beforeMetrics.placeholderCount).toBe(102);
    expect(afterMetrics.placeholderCount).toBe(102);
    expect(afterMetrics.placeholderRatio).toBeLessThan(beforeMetrics.placeholderRatio);
    expect(afterMetrics.totalWords).toBeGreaterThan(beforeMetrics.totalWords);
  }, 60_000);
});
