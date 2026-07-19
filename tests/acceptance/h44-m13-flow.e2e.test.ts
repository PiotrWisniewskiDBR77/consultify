/**
 * Acceptance E2E — H4.4: dowód E2E przepływu M13 generatora inicjatyw.
 *
 * create → DRAFT → dokument (InitiativeDocument sections) → timeline/harmonogram.
 *
 * Wzorzec 1:1 z `tests/acceptance/h14-tools-initiatives.e2e.test.ts`: REALNY
 * router `pmo/initiatives.routes.ts` + REALNE `verifyToken` (minted JWT) +
 * REALNA Postgres (parity :5443). Zero mocków logiki biznesowej.
 *
 * Ścieżka deterministyczna (bez LLM) — zamiast AI wizard
 * (`/wizard/sessions/.../candidates/generate`, generatywny i niedeterministyczny)
 * dowód idzie przez kanoniczny lejek tworzenia `POST /api/initiatives`
 * (ten sam endpoint, który wizard finalnie woła po triage+drafts-created).
 * `generate-section` / `review-section` też są LLM-backed — pomijamy je i
 * dowodzimy "dokumentu" przez realny, deterministyczny zapis+odczyt sekcji
 * (PUT /:id → GET /:id), plus sprawdzenie że endpoint katalogu sekcji
 * (`GET /section-types`) jest realnie zamontowany.
 *
 * Kroki dowodzone (każdy asercją na REALNYCH wierszach z Postgres, nie tylko
 * na kodach HTTP):
 *   1. POST /api/initiatives (projectId real project, sourceType=manual)
 *        → 200, initiative istnieje w DB, status='DRAFT' (Zod default +
 *          initiatives_status_check constraint).
 *   2. GET /api/initiatives/section-types
 *        → 200, endpoint sekcji realnie zamontowany (katalog "block library"
 *          dla widoku dokumentu inicjatywy — InitiativeDocumentView).
 *   3. PUT /api/initiatives/:id (problemStatement/scopeIn/successCriteria/
 *      deliverables) → 200, zmiany persystowane w `initiatives` (JSON kolumny).
 *      GET /api/initiatives/:id ("otwórz dokument") → 200, sekcje wracają z
 *      dokładnie zapisaną treścią (real round-trip, nie echo z requestu).
 *   4. GET /:id/milestones (pusto) → POST ×2 (harmonogram: nazwa+data+gate)
 *      → GET /:id/milestones (2 wiersze, order_index rosnąco) — kolumny/wiersze
 *      planu = harmonogram. Weryfikacja RÓWNOLEGLE bezpośrednim SQL-em na
 *      `initiative_milestones`.
 *
 * Izolacja: prefiks `odbior--h44--`, własny projekt, sprzątanie w afterAll
 * (initiatives ON DELETE CASCADE porządkuje initiative_milestones/_history).
 * JEDYNY plik tej pracy.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--h44--';
const PROJECT_ID = `${PREFIX}project-0001`;
const TITLE = `${PREFIX}Wdrożenie CRM w dziale sprzedaży`;

let app: Express;
let token: string;
let initiativeId: string;

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;

  const expressApp = express();
  expressApp.use(express.json({ limit: '5mb' }));
  expressApp.use('/api/initiatives', verifyToken as any, initiativesRouter);
  return expressApp;
}

beforeAll(async () => {
  await seed(); // idempotent — fundament (org/user/membership odbioru)

  const c = pgClient();
  await c.connect();
  try {
    // REQUIRE_INITIATIVE_PROJECT jest domyślnie ON (zwornik Delta C, D-J) —
    // interaktywna ścieżka twardo wymaga projectId. Własny projekt odbioru,
    // analogicznie do h14/docs-teresa.
    await c.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1, $2, $3, 'active', $4, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'Odbior H4.4 Project', SEED.USER_ID]
    );
  } finally {
    await c.end();
  }

  app = await buildApp();
  token = mintToken();
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    // initiatives → initiative_milestones/initiative_history mają ON DELETE
    // CASCADE (potwierdzone w schemacie parity), więc jeden DELETE wystarczy.
    await c.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeId]).catch(() => {});
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]).catch(() => {});
  } finally {
    await c.end();
  }
});

describe('H4.4 — M13 initiative generator flow: create → DRAFT → document → timeline', () => {
  it('1) POST /api/initiatives creates a DRAFT initiative anchored to the real project', async () => {
    const res = await request(app)
      .post('/api/initiatives')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId: PROJECT_ID,
        title: TITLE,
        axis: 'operational',
        category: 'sales',
        sourceType: 'manual',
      });

    expect(res.status).toBe(200); // raw-insert + funnel branches both res.json() w/o explicit status
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe(TITLE);
    expect(res.body.message).toBe('Initiative created');
    initiativeId = res.body.id;

    // Real row, real status default — not just an HTTP 200.
    const c = pgClient();
    await c.connect();
    try {
      const r = await c.query(
        `SELECT status, project_id, organization_id, title FROM initiatives WHERE id = $1`,
        [initiativeId]
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].status).toBe('DRAFT');
      expect(r.rows[0].project_id).toBe(PROJECT_ID);
      expect(r.rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(r.rows[0].title).toBe(TITLE);
    } finally {
      await c.end();
    }
  });

  it('2) GET /api/initiatives/section-types is a real, wired endpoint (document section catalog)', async () => {
    const res = await request(app)
      .get('/api/initiatives/section-types')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('3) PUT /:id persists document sections, GET /:id opens the document with real round-tripped content', async () => {
    const problemStatement = `${PREFIX} Dział sprzedaży pracuje na rozproszonych arkuszach, brak jednego źródła prawdy o lejku.`;
    const scopeIn = [`${PREFIX} Wdrożenie CRM`, `${PREFIX} Migracja danych klientów`];
    const successCriteria = [`${PREFIX} 100% zespołu sprzedaży w CRM po 60 dniach`];
    const deliverables = [`${PREFIX} Instancja CRM produkcyjna`];

    const putRes = await request(app)
      .put(`/api/initiatives/${initiativeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ problemStatement, scopeIn, successCriteria, deliverables });

    expect(putRes.status).toBe(200);
    expect(putRes.body.message).toBe('Initiative updated');
    expect(putRes.body.changesCount).toBeGreaterThan(0);

    // "Otwórz dokument inicjatywy" — GET /:id is the read path InitiativeDocumentView
    // uses to render the record as sections (getInitiativeDetailRead).
    const getRes = await request(app)
      .get(`/api/initiatives/${initiativeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(initiativeId);
    expect(getRes.body.problemStatement).toBe(problemStatement);
    expect(getRes.body.scopeIn).toEqual(scopeIn);
    expect(getRes.body.successCriteria).toEqual(successCriteria);
    expect(getRes.body.deliverables).toEqual(deliverables);
    // Document open must not silently mutate status — still DRAFT.
    expect(String(getRes.body.status).toUpperCase()).toBe('DRAFT');
    expect(getRes.body.displayStatus).toBeTruthy();
  });

  it('4) timeline/harmonogram: milestones start empty, then persist real rows in order', async () => {
    const emptyRes = await request(app)
      .get(`/api/initiatives/${initiativeId}/milestones`)
      .set('Authorization', `Bearer ${token}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.milestones).toEqual([]);

    const m1 = await request(app)
      .post(`/api/initiatives/${initiativeId}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${PREFIX} Kick-off i mapowanie procesów`,
        description: 'Faza 1',
        targetDate: '2026-08-15',
        isGate: false,
      });
    expect(m1.status).toBe(201);
    expect(m1.body.milestone.id).toBeTruthy();
    expect(m1.body.milestone.orderIndex).toBe(1);
    expect(m1.body.milestone.status).toBe('PENDING');

    const m2 = await request(app)
      .post(`/api/initiatives/${initiativeId}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${PREFIX} Go-live CRM (gate)`,
        description: 'Faza 2 — bramka decyzyjna',
        targetDate: '2026-10-01',
        isGate: true,
      });
    expect(m2.status).toBe(201);
    expect(m2.body.milestone.orderIndex).toBe(2);
    expect(m2.body.milestone.isGate).toBe(true);

    const listRes = await request(app)
      .get(`/api/initiatives/${initiativeId}/milestones`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.milestones).toHaveLength(2);
    const [row1, row2] = listRes.body.milestones;
    expect(row1.orderIndex).toBe(1);
    expect(row1.name).toContain('Kick-off');
    // Date-only column round-tripped through the pg driver as a JS Date at local
    // midnight, then JSON-serialized as UTC — asserting via a ::text cast below
    // (timezone-proof) instead of string-matching the API's Date-shifted ISO value.
    expect(row1.targetDate).toBeTruthy();
    expect(row2.orderIndex).toBe(2);
    expect(row2.isGate).toBe(true);

    // Real rows in the plan/harmonogram table, verified independently of the API layer.
    const c = pgClient();
    await c.connect();
    try {
      const r = await c.query(
        `SELECT name, order_index, is_gate, status, target_date::text AS target_date_text
           FROM initiative_milestones WHERE initiative_id = $1 ORDER BY order_index ASC`,
        [initiativeId]
      );
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0].order_index).toBe(1);
      expect(r.rows[0].status).toBe('PENDING');
      expect(r.rows[0].target_date_text).toBe('2026-08-15');
      expect(r.rows[1].is_gate).toBe(1);
      expect(r.rows[1].target_date_text).toBe('2026-10-01');
    } finally {
      await c.end();
    }
  });
});
