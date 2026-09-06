/** @vitest-environment node */
/**
 * DEC-416 — WNIOSEK z oceny powstaje z RODOWODEM do raportu oceny.
 *
 * Test celuje w warunek, który sam w sobie jest zabezpieczeniem: zapisany
 * wniosek musi nieść `sourceRefs` typu `assessment_report` wskazujący DOKŁADNIE
 * raport z adresu. Bez tego lista „Wnioski” nie odróżni wniosku z tej oceny od
 * cudzego, a warstwa Wniosków straci deduplikację (klucz = rodowód).
 *
 * MUTACJA (sprawdzona ręcznie, patrz meldunek): podstawienie w trasie innego
 * `reportId` do mostu (`source.reportId`) sprawia, że asercja rodowodu pada —
 * test świeci RED. Zwykły „czy 201” tego by nie złapał.
 *
 * Realna baza (RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres) — atrapa bazy
 * zwraca `changes:1` na każdy UPDATE i skłamałaby o zapisie.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

describe('DEC-416 — POST /api/assessment-reports/:reportId/conclusion', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const assessmentId = `dec416-assessment-${randomUUID()}`;
  const reportId = `dec416-report-${randomUUID()}`;
  let app: express.Express;
  let auth: { Authorization: string };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    await pool.query(`INSERT INTO organizations (id,name,status) VALUES ($1,$2,'active')`, [
      organizationId,
      'DEC-416 Organization',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused-local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO assessments (id,organization_id,name,status,assessment_type)
       VALUES ($1,$2,'DEC-416 Ocena','APPROVED','DRD')`,
      [assessmentId, organizationId]
    );
    await pool.query(
      `INSERT INTO assessment_reports (id,assessment_id,organization_id,name,status,axis_data,created_by)
       VALUES ($1,$2,$3,'DEC-416 Raport oceny','DRAFT',$4,$5)`,
      [
        reportId,
        assessmentId,
        organizationId,
        JSON.stringify({ 'drd-1': { actual: 3, target: 5 }, 'drd-2': { actual: 2, target: 4 } }),
        userId,
      ]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    auth = { Authorization: `Bearer ${token}` };
  }, 60000);

  afterAll(async () => {
    // Dane demo to twarz produktu — próbka sprząta po sobie.
    await pool.query(`DELETE FROM conclusions WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM conclusion_source_packs WHERE organization_id = $1`, [
      organizationId,
    ]);
    await pool.query(`DELETE FROM assessment_reports WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM assessments WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [
      organizationId,
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    await pool.end();
  }, 30000);

  it('zapisuje wniosek z rodowodem do TEGO raportu oceny i zwraca jego id', async () => {
    const przed = await pool.query(
      `SELECT COUNT(*)::int AS n FROM conclusions WHERE organization_id = $1`,
      [organizationId]
    );
    expect(przed.rows[0].n).toBe(0);

    const res = await request(app)
      .post(`/api/assessment-reports/${reportId}/conclusion`)
      .set(auth)
      .send({});
    expect(res.status).toBe(201);
    expect(typeof res.body.conclusionId).toBe('string');
    expect(res.body.conclusionId.length).toBeGreaterThan(0);

    const wiersz = await pool.query(
      `SELECT id, source_module, source_artifact_refs_json, statement
       FROM conclusions WHERE id = $1 AND organization_id = $2`,
      [res.body.conclusionId, organizationId]
    );
    expect(wiersz.rows).toHaveLength(1);
    expect(wiersz.rows[0].source_module).toBe('assessment_drd');
    expect(String(wiersz.rows[0].statement || '').length).toBeGreaterThan(0);

    // ★ RODOWÓD — warunek, w który celuje mutacja.
    const refs = JSON.parse(String(wiersz.rows[0].source_artifact_refs_json || '[]'));
    const refRaportu = refs.find((r: any) => r?.type === 'assessment_report');
    expect(refRaportu).toBeTruthy();
    expect(refRaportu.id).toBe(reportId);

    // Odpowiedź trasy niesie ten sam rodowód, co baza — UI nie zgaduje.
    const refsOdpowiedzi = res.body.sourceRefs || [];
    expect(refsOdpowiedzi.some((r: any) => r?.type === 'assessment_report' && r?.id === reportId)).toBe(
      true
    );
  }, 120000);

  it('nie mnoży wniosków — powtórzenie aktualizuje ten sam wiersz (klucz = rodowód)', async () => {
    const res = await request(app)
      .post(`/api/assessment-reports/${reportId}/conclusion`)
      .set(auth)
      .send({});
    expect(res.status).toBe(201);

    const po = await pool.query(
      `SELECT COUNT(*)::int AS n FROM conclusions WHERE organization_id = $1`,
      [organizationId]
    );
    expect(po.rows[0].n).toBe(1);
  }, 120000);

  it('404 dla raportu spoza organizacji (brak cross-org wycieku)', async () => {
    const res = await request(app)
      .post(`/api/assessment-reports/${randomUUID()}/conclusion`)
      .set(auth)
      .send({});
    expect(res.status).toBe(404);
  }, 30000);
});
