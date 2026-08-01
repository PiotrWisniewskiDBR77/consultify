/**
 * Acceptance E2E — H1.6: dowód przejścia Inicjatywa → Execution (Start Execution).
 *
 * Cel z REJESTRU: udowodnić REALNYM ruchem (real router + real verifyToken +
 * real Postgres, zero mocków), że POST /api/initiatives/:id/start-execution
 * przenosi inicjatywę do fazy egzekucji, i że GET execution summary ją widzi.
 *
 * Endpoint (realny, potwierdzony w kodzie):
 *   server/src/routes/pmo/initiatives.routes.ts
 *     router.post('/:id/start-execution', requireInitiativeCapability('initiative.start',
 *       { shadow: true }), InitiativeController.startExecution)
 *   server/src/controllers/InitiativeController.ts InitiativeController.startExecution
 *
 * "GET summary" (realny, w server/src/routes/pmo/execution.routes.ts):
 *   router.get('/:projectId/summary', ExecutionController.getExecutionSummary)
 *   server/src/controllers/ExecutionController.ts getExecutionSummary
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ★★★ ZAKTUALIZOWANE 2026-08-01 (H16 fix) — ten plik dokumentował STARY,
 * NIEBEZPIECZNY kontrakt jako poprawny; teraz dowodzi NOWEGO kanonicznego
 * kontraktu. `startExecution` jest już tylko cienkim adapterem nad
 * `executeInitiativeTransition` (SOLE transition engine, patrz
 * InitiativeController.ts ~line 425) — dokładnie ten sam silnik co
 * `PATCH /:id/status`. Zmiany zachowania udokumentowane wprost w kodzie
 * (InitiativeController.ts, doc comment nad `startExecution`, ~line 3488):
 *
 *   PRZED: initiative o statusie (case-insensitive) 'approved' ->
 *     status='EXECUTING', BEZ roli, BEZ decyzji, BEZ wiersza audytu. Skakało
 *     bezpośrednio APPROVED->EXECUTING, pomijając SCHEDULED (nielegalne wg
 *     VALID_TRANSITIONS[APPROVED] = [SCHEDULED, CANCELLED]).
 *   PO:    tylko initiative o statusie SCHEDULED; aktor musi mieć rolę
 *     PMO/ADMIN (gate START); ORAZ musi istnieć aktualna (nie superseded)
 *     zatwierdzona decyzja GOVERNANCE_DECISION_MAKING (nowość — tego gate'u
 *     na tym przejściu wcześniej NIE BYŁO WCALE). Wywołanie na inicjatywie
 *     APPROVED (jeszcze nie SCHEDULED) teraz poprawnie zwraca
 *     400 INVALID_TRANSITION zamiast cicho „się udawać".
 *
 * Ta zmiana zachowania jest CELEM tego pakietu (H16) — poniższy test
 * `INIT_APPROVED` teraz explicite dowodzi REGRESJI STAREGO ZACHOWANIA
 * (400, nie 200) zamiast dokumentować dawny bypass jako sukces. Pełna,
 * 20-przypadkowa macierz dowodowa (role/decyzje/współbieżność/audyt/
 * izolacja najemców/parytet adapterów) jest w osobnym pliku:
 *   tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts
 *
 * DoD tego pliku (3 osie, bez zmian): (a) realny endpoint wywołany przez
 * supertest przeciw realnemu routerowi+auth+SQL, (b) stan w żywej bazie
 * Postgres zweryfikowany zapytaniem PO wywołaniu, (c) 401 bez tokenu na tej
 * samej trasie.
 *
 * Artefakty z odwracalnym prefiksem `odbior--h16--`, probe sprząta po sobie.
 */
// INI-005 JWT hermeticity: MUST be imported first — sets process.env.JWT_SECRET
// to a fixed value before any dynamic import can load server/src/config/Config.ts.
// See tests/acceptance/ini005TestSecret.ts for the full root-cause writeup.
import { assertJwtSecretHermetic } from './ini005TestSecret.js';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const INIT_APPROVED = 'odbior--h16--init-approved';
const INIT_DRAFT = 'odbior--h16--init-draft';
const INIT_SCHEDULED_GO = 'odbior--h16--init-scheduled-go';
const DECISION_SCHEDULED_GO = 'odbior--h16--decision-scheduled-go';
const PROJECT_ID = 'odbior--h16--project';

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;
  const executionRouter = (await import('../../server/src/routes/pmo/execution.routes.js'))
    .default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // Mirrors Gateway.ts mount prefixes.
  app.use('/api/initiatives', verifyToken as any, initiativesRouter);
  app.use('/api/execution', verifyToken as any, executionRouter);
  return app;
}

let app: Express;
let token: string;

async function insertInitiative(
  id: string,
  status: string,
  projectId: string | null,
  opts: { plannedStart?: string | null; plannedEnd?: string | null } = {}
): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO initiatives
         (id, organization_id, project_id, name, title, status, owner_execution_id,
          planned_start_date, planned_end_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, project_id = EXCLUDED.project_id,
         owner_execution_id = EXCLUDED.owner_execution_id,
         planned_start_date = EXCLUDED.planned_start_date, planned_end_date = EXCLUDED.planned_end_date,
         execution_started_at = NULL`,
      [
        id,
        SEED.ORG_ID,
        projectId,
        `odbior--h16 ${id}`,
        status,
        SEED.USER_ID,
        opts.plannedStart ?? null,
        opts.plannedEnd ?? null,
      ]
    );
  } finally {
    await c.end();
  }
}

/** GO/NO-GO decision for the GOVERNANCE_DECISION_MAKING gate — required by the H16 fix. */
async function insertGoDecision(id: string, initiativeId: string): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO decisions
         (id, organization_id, initiative_id, title, type, decision_maker_id, deadline,
          status, pmo_domain, created_by, created_at)
       VALUES ($1, $2, $3, $4, 'GO_NO_GO', $5, $6, 'approved', 'GOVERNANCE_DECISION_MAKING', $5, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = 'approved', deadline = EXCLUDED.deadline`,
      [id, SEED.ORG_ID, initiativeId, `odbior--h16 decision ${id}`, SEED.USER_ID, '2026-08-15T00:00:00.000Z']
    );
  } finally {
    await c.end();
  }
}

async function getRow(
  id: string
): Promise<{ status: string; execution_started_at: string | null } | null> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(
      `SELECT status, execution_started_at FROM initiatives WHERE id = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await assertJwtSecretHermetic();
  await seed();
  app = await buildApp();
  token = mintToken(); // SEED user resolves to effective ADMIN — bypasses RBAC by design;
  // real role/decision/concurrency/tenant coverage lives in the ini005 suite.

  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'odbior--h16 project']
    );
  } finally {
    await c.end();
  }

  await insertInitiative(INIT_APPROVED, 'APPROVED', PROJECT_ID);
  await insertInitiative(INIT_DRAFT, 'DRAFT', PROJECT_ID);
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM decisions WHERE id = $1 OR initiative_id = $2`, [
      DECISION_SCHEDULED_GO,
      INIT_SCHEDULED_GO,
    ]);
    await c.query(`DELETE FROM initiative_status_history WHERE initiative_id IN ($1, $2, $3)`, [
      INIT_APPROVED,
      INIT_DRAFT,
      INIT_SCHEDULED_GO,
    ]);
    await c.query(`DELETE FROM initiative_history WHERE initiative_id IN ($1, $2, $3)`, [
      INIT_APPROVED,
      INIT_DRAFT,
      INIT_SCHEDULED_GO,
    ]);
    await c.query(`DELETE FROM initiatives WHERE id IN ($1, $2, $3)`, [
      INIT_APPROVED,
      INIT_DRAFT,
      INIT_SCHEDULED_GO,
    ]);
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  } finally {
    await c.end();
  }
});

describe('H1.6 — POST /api/initiatives/:id/start-execution (kanoniczny kontrakt PO fixie H16)', () => {
  it('bez tokenu → 401 (auth realnie egzekwowany na tej trasie)', async () => {
    const res = await request(app)
      .post(`/api/initiatives/${INIT_APPROVED}/start-execution`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('DRAFT → 400 (INVALID_TRANSITION) — gate blokuje spoza SCHEDULED', async () => {
    const before = await getRow(INIT_DRAFT);
    expect(before?.status).toBe('DRAFT');

    const res = await request(app)
      .post(`/api/initiatives/${INIT_DRAFT}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('INVALID_TRANSITION');

    // Stan bez zmian — gate rzeczywiście nie przepuścił.
    const after = await getRow(INIT_DRAFT);
    expect(after?.status).toBe('DRAFT');
  });

  it('REGRESJA H16: APPROVED (jeszcze NIE SCHEDULED) → 400 INVALID_TRANSITION, NIE 200 (stary bypass zamknięty)', async () => {
    const before = await getRow(INIT_APPROVED);
    expect(before?.status).toBe('APPROVED');

    const res = await request(app)
      .post(`/api/initiatives/${INIT_APPROVED}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // PRZED fixem H16 to zwracało 200 + status EXECUTING (silent bypass —
    // skakało APPROVED->EXECUTING, pomijając SCHEDULED). PO fixie: 400.
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('INVALID_TRANSITION');

    const after = await getRow(INIT_APPROVED);
    expect(after?.status).toBe('APPROVED'); // niezmieniony
    expect(after?.execution_started_at).toBeNull();
  });

  it('PRAWDZIWA ścieżka happy-path: SCHEDULED + zatwierdzona decyzja GO/NO-GO → 200, status EXECUTING (uppercase), execution_started_at zapisany', async () => {
    await insertInitiative(INIT_SCHEDULED_GO, 'SCHEDULED', PROJECT_ID, {
      plannedStart: '2026-09-01',
      plannedEnd: '2026-12-01',
    });
    await insertGoDecision(DECISION_SCHEDULED_GO, INIT_SCHEDULED_GO);

    const before = await getRow(INIT_SCHEDULED_GO);
    expect(before?.status).toBe('SCHEDULED');
    expect(before?.execution_started_at).toBeNull();

    const res = await request(app)
      .post(`/api/initiatives/${INIT_SCHEDULED_GO}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('EXECUTING');

    const after = await getRow(INIT_SCHEDULED_GO);
    expect(after?.status).toBe('EXECUTING'); // UPPERCASE — zgodne z kanonem i summary
    expect(after?.execution_started_at).not.toBeNull(); // kolumna realnie zapisana
  });

  it('uruchomiona inicjatywa JEST widoczna w GET execution summary (liczniki +1)', async () => {
    // Baseline PRZED startem (druga, niezależna inicjatywa — poprzedni test już
    // wystartował INIT_SCHEDULED_GO, więc liczymy baseline PO tamtym, PRZED tym).
    const baseline = await request(app)
      .get(`/api/execution/${PROJECT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(baseline.status).toBe(200);
    expect(baseline.body.projectId).toBe(PROJECT_ID);
    const beforeExecuting = baseline.body.executingCount;
    const beforeTotal = baseline.body.totalInitiatives;

    const initId = 'odbior--h16--init-scheduled-go-2';
    const decisionId = 'odbior--h16--decision-scheduled-go-2';
    await insertInitiative(initId, 'SCHEDULED', PROJECT_ID, {
      plannedStart: '2026-09-01',
      plannedEnd: '2026-12-01',
    });
    await insertGoDecision(decisionId, initId);

    const start = await request(app)
      .post(`/api/initiatives/${initId}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(start.status).toBe(200);
    expect(start.body.newStatus).toBe('EXECUTING');

    // Summary PO starcie — liczniki rosną o 1.
    const after = await request(app)
      .get(`/api/execution/${PROJECT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body.executingCount).toBe(beforeExecuting + 1);
    expect(after.body.totalInitiatives).toBe(beforeTotal + 1);

    // Cleanup dla tej lokalnej pary (nie jest w afterAll — powstała w trakcie testu).
    const c = pgClient();
    await c.connect();
    try {
      await c.query(`DELETE FROM decisions WHERE id = $1`, [decisionId]);
      await c.query(`DELETE FROM initiative_status_history WHERE initiative_id = $1`, [initId]);
      await c.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [initId]);
      await c.query(`DELETE FROM initiatives WHERE id = $1`, [initId]);
    } finally {
      await c.end();
    }
  });
});
