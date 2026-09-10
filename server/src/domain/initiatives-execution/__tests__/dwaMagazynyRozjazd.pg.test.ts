/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';
import { initiativeExists, readInitiativeHeader } from '../initiativeUnifiedReader.js';

const NO_RETRY = { retry: 0 } as const;

describe('CODEX1 — charakterystyka rozjazdu dwoch magazynow inicjatyw', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  const title = `CODEX1 charakterystyka ${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  // FIX-8 [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]:
  // pulapki §0.2e (a)/(b)/(d) ustawiane JAWNIE W PLIKU TESTU, nie zalezne od
  // env wywolania — wzorem (c), ktore juz mial ten plik (`expect(process.env.DB_TYPE)`
  // + `assertRealPostgresTestEnvironment()` ponizej). Wszystkie trzy strazniki
  // czytaja `process.env` NA ZYWO przy kazdym zadaniu (nie sa cache'owane w
  // module-scope stalej jak `featureFlags` w `FeatureFlags.ts`), wiec ustawienie
  // ich tutaj, w `beforeAll` PRZED `ApiGateway.getInstance().initializeRoutes(app)`,
  // jest wystarczajace i nie wymaga zadnej gimnastyki z kolejnoscia importow:
  //   (a) `v8FeatureGate.middleware.ts:15` — `ENABLE_V8_GLOBAL`
  //   (b) `resultsInternalBetaVisibility.middleware.ts:29` — `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`
  //   (d) `auth.middleware.ts:1396` — `ENABLE_TEST_AUTH_BYPASS`
  // Oryginalne wartosci zapamietane i przywrocone w `afterAll`, zeby ten plik
  // nie zostawial srodowiska zmienionego dla innych plikow w tym samym
  // procesie robotnika testowego.
  const originalEnv = {
    ENABLE_V8_GLOBAL: process.env.ENABLE_V8_GLOBAL,
    RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE: process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE,
    ENABLE_TEST_AUTH_BYPASS: process.env.ENABLE_TEST_AUTH_BYPASS,
  };

  beforeAll(async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE = 'enforce';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'CODEX1 org',
    ]);
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,$3,$4)`, [
      projectId,
      organizationId,
      'CODEX1 project',
      userId,
    ]);
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    // FIX-8 — przywrocenie env sprzed testu (patrz komentarz przy beforeAll).
    if (originalEnv.ENABLE_V8_GLOBAL === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = originalEnv.ENABLE_V8_GLOBAL;
    if (originalEnv.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE === undefined)
      delete process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE;
    else
      process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE =
        originalEnv.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE;
    if (originalEnv.ENABLE_TEST_AUTH_BYPASS === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = originalEnv.ENABLE_TEST_AUTH_BYPASS;

    if (!sql) return;
    // FIX-7 — sprzatanie wiersza kolizyjnego dopisanego do tabeli zastanej.
    await sql.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
    await sql.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_audit_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM project_members WHERE project_id=$1`, [projectId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('uses the explicitly selected PostgreSQL engine', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
  });

  it('CHARAKTERYSTYKA PRZED E2 — zapis UI tworzy agregat kanoniczny', async () => {
    const sourceId = `manual-hub-${randomUUID()}`;
    const submitted = await request(app)
      .post('/api/initiatives/runtime-v1/source-proposals')
      .set('Authorization', authorization)
      .send({
        proposalId,
        expectedVersion: 0,
        clientRequestId: `submit-${randomUUID()}`,
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        provenance: {
          system: 'consultify.initiatives-hub',
          recordType: 'manual-initiative-proposal',
          capturedAt: new Date().toISOString(),
          evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`],
        },
        title,
        problem: 'Dowod rozjazdu magazynow',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        initiativeOwnerId: userId,
        visibility: 'PROJECT',
      });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);

    const response = await request(app)
      .post('/api/initiatives/runtime-v1/registrations')
      .set('Authorization', authorization)
      .send({
        initiativeId,
        expectedVersion: 0,
        clientRequestId: `register-${randomUUID()}`,
        proposalId,
        proposalVersion: 1,
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        title,
        problem: 'Dowod rozjazdu magazynow',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        visibility: 'PROJECT',
        initiativeOwnerId: userId,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const count = await sql.query(
      `SELECT count(*)::int AS count FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, initiativeId]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('CHARAKTERYSTYKA PRZED E2 — lista runtime-v1 widzi rekord', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/initiatives')
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.initiatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ initiative: expect.objectContaining({ initiativeId, title }) }),
      ])
    );
  });

  it('CHARAKTERYSTYKA PRZED E2 — lista zastana nie widzi rekordu', async () => {
    const response = await request(app).get('/api/initiatives').set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    if (process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true') {
      expect(JSON.stringify(response.body)).toContain(initiativeId);
    } else {
      expect(JSON.stringify(response.body)).not.toContain(initiativeId);
    }
  });

  it('CHARAKTERYSTYKA PRZED E2 — tabela zastana nie zawiera rekordu', async () => {
    const count = await sql.query(`SELECT count(*)::int AS count FROM initiatives WHERE id=$1`, [
      initiativeId,
    ]);
    expect(count.rows[0].count).toBe(0);
  });

  it('CHARAKTERYSTYKA PRZED E2 — karta zastana zwraca 404', async () => {
    const response = await request(app)
      .get(`/api/initiatives/${initiativeId}`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(
      process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true' ? 200 : 404
    );
    if (process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true') {
      expect(JSON.stringify(response.body)).toContain(title);
    }
  });

  it('CHARAKTERYSTYKA PRZED E2 — KPI zastane zwracaja 404', async () => {
    const response = await request(app)
      .get(`/api/initiatives/${initiativeId}/kpis`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(
      process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true' ? 200 : 404
    );
  });

  it('CHARAKTERYSTYKA PRZED E2 — kamienie korzystaja z istniejacego fallbacku', async () => {
    const response = await request(app)
      .get(`/api/initiatives/${initiativeId}/milestones`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
  });

  it('E2 — projekcja nie przekracza granicy organizacji', async () => {
    expect(await initiativeExists(randomUUID(), initiativeId)).toBe(false);
  });

  it('FIX-1/FIX-7 — przy kolizji zrodlem rozstrzygajacym dla STATUSU jest tabela klasyczna', async () => {
    // Krok 1: zanim istnieje kolizja, zapamietaj naturalny stan kanoniczny
    // (rejestracja z §"CHARAKTERYSTYKA PRZED E2" powyzej pisze WYLACZNIE do
    // `ie_aggregate_state` — tabela zastana `initiatives` nie ma jeszcze tego
    // id, potwierdzone testem "tabela zastana nie zawiera rekordu" wyzej).
    const canonicalOnly = await readInitiativeHeader(organizationId, initiativeId);
    expect(canonicalOnly).toMatchObject({ id: initiativeId, title, source: 'CANONICAL' });
    const canonicalOnlyState = canonicalOnly?.lifecycleState;

    // Krok 2: zbuduj REALNA kolizje — dopisz do tabeli KLASYCZNEJ wiersz o
    // TYM SAMYM id, z INNYM statusem niz to, co dala projekcja kanoniczna.
    // `CLOSED` jest bezpiecznym wyborem: swiezo zarejestrowana inicjatywa
    // (krok wczesny cyklu zycia) nie moze naturalnie wyladowac w `CLOSED`.
    expect(canonicalOnlyState).not.toBe('CLOSED');
    await sql.query(
      `INSERT INTO initiatives(id, organization_id, name, title, status, project_id, owner_business_id)
       VALUES ($1, $2, $3, $3, 'CLOSED', $4, $5)`,
      [initiativeId, organizationId, title, projectId, userId]
    );
    const collisionCount = await sql.query(
      `SELECT count(*)::int AS count FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeId, organizationId]
    );
    expect(collisionCount.rows[0].count).toBe(1);
    const canonicalCount = await sql.query(
      `SELECT count(*)::int AS count FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, initiativeId]
    );
    expect(canonicalCount.rows[0].count).toBe(1);

    // Krok 3: przy realnej kolizji (rekord w OBU magazynach) wygrywa
    // KLASYCZNA tabela dla statusu — parytet z klientowym E1a
    // (`src/components/Initiatives/initiativeRegisterProjection.ts:482-511`,
    // `mergeLegacyInitiativesIntoRegister`). Reszta pol (tytul) zostaje z
    // bogatszego wiersza kanonicznego.
    const collided = await readInitiativeHeader(organizationId, initiativeId);
    expect(collided).toMatchObject({
      id: initiativeId,
      title,
      source: 'CANONICAL',
      lifecycleState: 'CLOSED',
    });
    expect(collided?.lifecycleState).not.toBe(canonicalOnlyState);
  });
});
