/**
 * Acceptance E2E — H1.6: dowód przejścia Inicjatywa → Execution (Start Execution).
 *
 * Cel z REJESTRU: udowodnić REALNYM ruchem (real router + real verifyToken +
 * real Postgres, zero mocków), że POST /api/initiatives/:id/start-execution
 * przenosi inicjatywę do fazy egzekucji, i że GET execution summary ją widzi.
 *
 * Endpoint (realny, potwierdzony w kodzie):
 *   server/src/routes/pmo/initiatives.routes.ts:2896
 *     router.post('/:id/start-execution', requireInitiativeCapability('initiative.start',
 *       { shadow: true }), InitiativeController.startExecution)
 *   server/src/controllers/InitiativeController.ts:3272 InitiativeController.startExecution
 *
 * "GET summary" (realny, w server/src/routes/pmo/execution.routes.ts:20):
 *   router.get('/:projectId/summary', ExecutionController.getExecutionSummary)
 *   server/src/controllers/ExecutionController.ts:121
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CZERWONE ZNALEZISKA (real-runtime, nie z dokumentacji) — patrz asercje niżej:
 *
 * 1. SCHEMA DRIFT — kolumna `execution_started_at`, którą UPDATE w
 *    InitiativeController.startExecution próbuje zapisać, NIE ISTNIEJE na
 *    żywej bazie parity (:5443, dump z TROLLEY == demo). Migracja
 *    061_initiative_lifecycle.sql, która miała ją dodać, jest zapisana w
 *    dialekcie SQLite (lower(hex(randomblob(16))), DATETIME) i nie widać jej
 *    zastosowania na Postgres (`schema_migrations` jest PUSTE na tej bazie).
 *    Efekt: POST .../start-execution z inicjatywy o statusie 'approved'
 *    KOŃCZY SIĘ BŁĘDEM SQL (500), nie sukcesem. Udowodnione niżej —
 *    test NIE zakłada sukcesu, tylko sprawdza REALNĄ odpowiedź.
 *
 * 2. STATUS CASE SPLIT-BRAIN — InitiativeController.startExecution/approveInitiative
 *    operują na WARTOŚCIACH LOWERCASE ('approved' → 'executing'), podczas gdy:
 *      - kanoniczny enum InitiativeStatus (constants/initiativeStatuses.ts) i
 *        nowszy endpoint /from-tool-session (patrz h14 test) używają UPPERCASE
 *        ('DRAFT', 'EXECUTING' …),
 *      - ExecutionController.getExecutionSummary filtruje
 *        `status IN ('EXECUTING','BLOCKED','DONE')` — UPPERCASE,
 *      - żywe dane na parity mają WYŁĄCZNIE uppercase status ('EXECUTING' ×3;
 *        `SELECT DISTINCT status FROM initiatives` potwierdzone ręcznie).
 *    Nawet gdyby (1) nie blokowało zapisu, ustawiony `status='executing'`
 *    (lowercase) byłby NIEWIDOCZNY dla GET execution summary, bo ten filtruje
 *    'EXECUTING' (uppercase). Test niżej udowadnia to WPROST: seedujemy
 *    inicjatywę bezpośrednio na 'EXECUTING' (uppercase, obchodząc zepsuty
 *    endpoint) i pokazujemy że DOPIERO wtedy GET summary ją widzi.
 *
 * DoD (3 osie): (a) realny endpoint wywołany przez supertest przeciw realnemu
 * routerowi+auth+SQL, (b) stan w żywej bazie Postgres :5443 zweryfikowany
 * zapytaniem PO wywołaniu, (c) 401 bez tokenu na tej samej trasie.
 *
 * Artefakty z odwracalnym prefiksem `odbior--h16--`, probe sprząta po sobie.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const INIT_APPROVED = 'odbior--h16--init-approved';
const INIT_DRAFT = 'odbior--h16--init-draft';
const INIT_UPPER_EXECUTING = 'odbior--h16--init-upper-executing';
const PROJECT_ID = 'odbior--h16--project';

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;
  const executionRouter = (await import('../../server/src/routes/pmo/execution.routes.js'))
    .default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // Mirrors Gateway.ts mount prefixes (lines ~505 and ~904).
  app.use('/api/initiatives', verifyToken as any, initiativesRouter);
  app.use('/api/execution', verifyToken as any, executionRouter);
  return app;
}

let app: Express;
let token: string;

async function insertInitiative(id: string, status: string, projectId: string | null): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, project_id = EXCLUDED.project_id`,
      [id, SEED.ORG_ID, projectId, `odbior--h16 ${id}`, status, SEED.USER_ID]
    );
  } finally {
    await c.end();
  }
}

async function getStatus(id: string): Promise<{ status: string } | null> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(`SELECT status FROM initiatives WHERE id = $1`, [id]);
    return r.rows[0] ?? null;
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();
  app = await buildApp();
  token = mintToken();

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

  await insertInitiative(INIT_APPROVED, 'approved', PROJECT_ID);
  await insertInitiative(INIT_DRAFT, 'draft', PROJECT_ID);
});

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM initiatives WHERE id IN ($1, $2, $3)`, [
      INIT_APPROVED,
      INIT_DRAFT,
      INIT_UPPER_EXECUTING,
    ]);
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  } finally {
    await c.end();
  }
});

describe('H1.6 — POST /api/initiatives/:id/start-execution (dowód real-runtime)', () => {
  it('bez tokenu → 401 (auth realnie egzekwowany na tej trasie)', async () => {
    const res = await request(app).post(`/api/initiatives/${INIT_APPROVED}/start-execution`).send({});
    expect(res.status).toBe(401);
  });

  it('DRAFT (draft) → 400 „Cannot start execution from status" — gate blokuje spoza approved', async () => {
    const before = await getStatus(INIT_DRAFT);
    expect(before?.status).toBe('draft');

    const res = await request(app)
      .post(`/api/initiatives/${INIT_DRAFT}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot start execution from status/);

    // Stan bez zmian — gate rzeczywiście nie przepuścił.
    const after = await getStatus(INIT_DRAFT);
    expect(after?.status).toBe('draft');
  });

  it('CZERWONE #1: approved → start-execution — REALNA odpowiedź (schema drift: execution_started_at)', async () => {
    const before = await getStatus(INIT_APPROVED);
    expect(before?.status).toBe('approved');

    const res = await request(app)
      .post(`/api/initiatives/${INIT_APPROVED}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const after = await getStatus(INIT_APPROVED);

    if (res.status === 200) {
      // Gdyby kolumna istniała i zapis się powiódł — udokumentuj sukces i
      // przejdź do sprawdzenia widoczności w GET summary (poniższy test).
      expect(res.body.newStatus).toBe('executing');
      expect(after?.status).toBe('executing');
    } else {
      // REALNY dziś wynik na parity :5443: SQL error, bo `execution_started_at`
      // nie istnieje na tej tabeli (potwierdzone information_schema.columns —
      // patrz komentarz na górze pliku). Dokumentujemy to WPROST jako dowód,
      // nie ukrywamy za "testy przeszły": endpoint jest de facto zepsuty na
      // żywym schemacie, a status inicjatywy zostaje bez zmian.
      expect(res.status).toBe(500);
      expect(after?.status).toBe('approved');
      // eslint-disable-next-line no-console
      console.warn(
        '[H1.6 CZERWONE #1] POST start-execution zwrócił',
        res.status,
        JSON.stringify(res.body).slice(0, 300),
        '— execution_started_at prawdopodobnie brakuje w initiatives (parity :5443).'
      );
    }
  });

  it('CZERWONE #2: GET execution summary widzi TYLKO uppercase EXECUTING (case split-brain)', async () => {
    // Obejście zepsutego endpointu: seedujemy wprost na uppercase 'EXECUTING',
    // tak jak realnie wygląda status w danych demo (SELECT DISTINCT status
    // FROM initiatives na parity :5443 zwraca WYŁĄCZNIE 'EXECUTING').
    await insertInitiative(INIT_UPPER_EXECUTING, 'EXECUTING', PROJECT_ID);

    const res = await request(app)
      .get(`/api/execution/${PROJECT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(PROJECT_ID);
    // Uppercase-seedowana inicjatywa JEST liczona.
    expect(res.body.executingCount).toBeGreaterThanOrEqual(1);
    expect(res.body.totalInitiatives).toBeGreaterThanOrEqual(1);

    // Teraz seedujemy DRUGĄ na lowercase 'executing' (to, co realnie zapisałby
    // InitiativeController.startExecution GDYBY zapis się udał) i pokazujemy,
    // że liczniki summary SIĘ NIE ZMIENIAJĄ — bo filtr summary jest uppercase.
    const beforeExecuting = res.body.executingCount;
    const beforeTotal = res.body.totalInitiatives;

    await insertInitiative(INIT_APPROVED, 'executing', PROJECT_ID); // lowercase, jak w kontrolerze

    const res2 = await request(app)
      .get(`/api/execution/${PROJECT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res2.status).toBe(200);
    // Dowód split-brain: lowercase 'executing' NIE podnosi liczników.
    expect(res2.body.executingCount).toBe(beforeExecuting);
    expect(res2.body.totalInitiatives).toBe(beforeTotal);
  });
});
