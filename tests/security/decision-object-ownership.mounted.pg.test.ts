/** @vitest-environment node */
/**
 * S12-B / STOP-2 (paczka E2, 10.09) — BEZPIECZENSTWO: czlonek organizacji
 * edytuje CUDZA decyzje.
 *
 * Pomiar przed naprawa (2026-09-11, kopia `consultify_kopia_s12b`):
 * `PUT /api/decisions/<cudza>/enhancements` = HTTP 200 i nadpisane
 * `decision_enhancements.context_details` w bazie. Przyczyna: decyzje sa
 * chronione RECZNYM `if` w kontrolerze (`isDossierEditor`), a ta JEDNA trasa
 * z calej rodziny (stakeholders / alternatives / risks / comments) tego `if`
 * nie ma — bramka `requireDecisionCapability('decision.update')` stoi w
 * trybie `shadow`, wiec nie blokuje niczego.
 *
 * PULAPKA (CLAUDE.md): atrapa bazy `server/src/database/Database.ts:686`
 * zwraca `changes: 1` dla KAZDEGO UPDATE niezaleznie od WHERE. Dlatego ten
 * plik dziala WYLACZNIE na realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false
 * DB_TYPE=postgres DATABASE_URL=postgres://...`); bez tego `describe.skipIf`
 * pomija go zamiast klamac na zielono. Kazdy przypadek odmowy czyta stan
 * WIERSZA w bazie, nie tylko kod HTTP.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import decisionsRouter from '../../server/src/routes/pmo/decisions.routes.js';

const databaseUrl = process.env.DATABASE_URL || '';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!realDb).sequential('STOP-2 — zakres obiektowy decyzji', () => {
  const przyrostek = randomUUID().slice(0, 8);
  const org = `s12b-org-${przyrostek}`;
  const projekt = `s12b-proj-${przyrostek}`;
  const czlonekA = `s12b-member-a-${przyrostek}`;
  const czlonekB = `s12b-member-b-${przyrostek}`;
  const administrator = `s12b-admin-${przyrostek}`;
  const decyzjaA = `s12b-dec-a-${przyrostek}`;
  const decyzjaB = `s12b-dec-b-${przyrostek}`;

  let pool: Pool;
  let app: Express;

  const token = (id: string, role: string) =>
    jwt.sign(
      {
        id,
        email: `${id}@test.invalid`,
        organizationId: org,
        organization_id: org,
        role,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  const kontekst = async (decisionId: string): Promise<string | null> => {
    const { rows } = await pool.query(
      'SELECT context_details FROM decision_enhancements WHERE decision_id = $1',
      [decisionId]
    );
    return rows.length === 0 ? null : (rows[0].context_details ?? null);
  };

  const cialo = (tekst: string) => ({
    reminders: [],
    escalationRules: [],
    linkedItems: [],
    contextDetails: tekst,
    consequenceScenarios: null,
    escalation: null,
  });

  beforeAll(async () => {
    if (!realDb) throw new Error('wymagany realny PostgreSQL');
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: databaseUrl });

    await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [org, 'S12B decisions']);
    await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)', [
      projekt,
      org,
      'S12B decisions project',
    ]);

    for (const [id, rola] of [
      [czlonekA, 'MEMBER'],
      [czlonekB, 'MEMBER'],
      [administrator, 'ADMIN'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'unused',$4,'active')`,
        [id, org, `${id}@test.invalid`, rola]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), org, id, rola]
      );
    }

    for (const [id, wlasciciel, tytul] of [
      [decyzjaA, czlonekA, 'decyzja czlonka A'],
      [decyzjaB, czlonekB, 'decyzja czlonka B'],
    ] as const) {
      await pool.query(
        `INSERT INTO decisions(id,organization_id,project_id,title,status,created_by,decision_maker_id)
         VALUES($1,$2,$3,$4,'pending',$5,$5)`,
        [id, org, projekt, tytul, wlasciciel]
      );
    }

    app = express();
    app.use(express.json());
    app.use('/api/decisions', decisionsRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM decision_enhancements WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM decision_history WHERE decision_id = ANY($1)', [
      [decyzjaA, decyzjaB],
    ]);
    await pool.query('DELETE FROM decisions WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM users WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM project_role_templates WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM projects WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [org]);
    await pool.end();
  }, 60_000);

  it('MEMBER zapisuje rozszerzenia WLASNEJ decyzji -> 200 i wiersz w bazie', async () => {
    const odp = await request(app)
      .put(`/api/decisions/${decyzjaA}/enhancements`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send(cialo('wlasna decyzja — kontekst autora'));

    // eslint-disable-next-line no-console
    console.log('[POMIAR] wlasna decyzja:', odp.status, JSON.stringify(odp.body).slice(0, 200));
    expect(odp.status).toBe(200);
    await expect(kontekst(decyzjaA)).resolves.toBe('wlasna decyzja — kontekst autora');
  }, 30_000);

  it('MEMBER zapisuje rozszerzenia CUDZEJ decyzji -> 403, baza nietknieta', async () => {
    const przed = await kontekst(decyzjaB);

    const odp = await request(app)
      .put(`/api/decisions/${decyzjaB}/enhancements`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send(cialo('WLAM w cudza decyzje'));

    const po = await kontekst(decyzjaB);
    // eslint-disable-next-line no-console
    console.log('[POMIAR] cudza decyzja:', odp.status, JSON.stringify(odp.body).slice(0, 200), {
      przed,
      po,
    });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    // Klucz: stan BAZY, nie sam kod.
    expect(po).toBe(przed);
  }, 30_000);

  it('ADMIN zapisuje rozszerzenia CUDZEJ decyzji -> 200 (nie zablokowalismy administracji)', async () => {
    const odp = await request(app)
      .put(`/api/decisions/${decyzjaB}/enhancements`)
      .set('Authorization', `Bearer ${token(administrator, 'ADMIN')}`)
      .send(cialo('admin uzupelnia kontekst'));

    // eslint-disable-next-line no-console
    console.log('[POMIAR] admin:', odp.status, JSON.stringify(odp.body).slice(0, 200));
    expect(odp.status).toBe(200);
    await expect(kontekst(decyzjaB)).resolves.toBe('admin uzupelnia kontekst');
  }, 30_000);

  it('WLASCICIEL decyzji (decision_maker_id) zapisuje rozszerzenia swojej decyzji -> 200', async () => {
    const odp = await request(app)
      .put(`/api/decisions/${decyzjaB}/enhancements`)
      .set('Authorization', `Bearer ${token(czlonekB, 'MEMBER')}`)
      .send(cialo('wlasciciel decyzji B'));

    // eslint-disable-next-line no-console
    console.log('[POMIAR] wlasciciel B:', odp.status, JSON.stringify(odp.body).slice(0, 200));
    expect(odp.status).toBe(200);
    await expect(kontekst(decyzjaB)).resolves.toBe('wlasciciel decyzji B');
  }, 30_000);

  it('RODZENSTWO (kontrola): MEMBER edytuje CUDZA decyzje przez PUT /:id -> 403', async () => {
    const { rows: przed } = await pool.query('SELECT title FROM decisions WHERE id = $1', [
      decyzjaB,
    ]);

    const odp = await request(app)
      .put(`/api/decisions/${decyzjaB}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ title: 'WLAM w tytul' });

    const { rows: po } = await pool.query('SELECT title FROM decisions WHERE id = $1', [decyzjaB]);
    // eslint-disable-next-line no-console
    console.log('[POMIAR] PUT /:id cudza:', odp.status, JSON.stringify(odp.body).slice(0, 200));
    expect(odp.status).toBe(403);
    expect(po[0]?.title).toBe(przed[0]?.title);
  }, 30_000);

  it('RODZENSTWO (kontrola): MEMBER zamyka CUDZA decyzje przez PATCH /:id/decide -> 403', async () => {
    const { rows: przed } = await pool.query('SELECT status FROM decisions WHERE id = $1', [
      decyzjaB,
    ]);

    const odp = await request(app)
      .patch(`/api/decisions/${decyzjaB}/decide`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ decision: 'approved', rationale: 'proba zamkniecia cudzej decyzji' });

    const { rows: po } = await pool.query('SELECT status FROM decisions WHERE id = $1', [decyzjaB]);
    // eslint-disable-next-line no-console
    console.log('[POMIAR] decide cudza:', odp.status, JSON.stringify(odp.body).slice(0, 200));
    expect(odp.status).toBe(403);
    expect(po[0]?.status).toBe(przed[0]?.status);
  }, 30_000);
});
