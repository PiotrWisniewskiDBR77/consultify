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
 * NAPRAWIONE RED (W2b) — ten plik dowodzi FIXA (poprzednio dokumentował buga):
 *
 * 1. SCHEMA DRIFT — kolumna `execution_started_at` NIE ISTNIAŁA na Postgres
 *    (migracja 061 była w dialekcie SQLite i nigdy nie odpaliła). start-execution
 *    zwracał 500 (42703). FIX: migracja addytywna idempotentna
 *    server/migrations/20260719_initiative_execution_columns.sql
 *    (ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ).
 *
 * 2. STATUS CASE SPLIT-BRAIN — startExecution ustawiał status='executing'
 *    (lowercase), a getExecutionSummary filtruje IN ('EXECUTING','BLOCKED','DONE')
 *    (UPPERCASE — kanon + realne dane). Lowercase byłby NIEWIDOCZNY w summary.
 *    FIX: startExecution zapisuje 'EXECUTING' (UPPERCASE); gate startu
 *    case-insensitive ('approved'/'APPROVED').
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
const INIT_UPPER_APPROVED = 'odbior--h16--init-upper-approved';
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

async function insertInitiative(id: string, status: string, projectId: string | null): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, project_id = EXCLUDED.project_id,
         execution_started_at = NULL`,
      [id, SEED.ORG_ID, projectId, `odbior--h16 ${id}`, status, SEED.USER_ID]
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
      INIT_UPPER_APPROVED,
    ]);
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  } finally {
    await c.end();
  }
});

describe('H1.6 — POST /api/initiatives/:id/start-execution (dowód FIXA real-runtime)', () => {
  it('bez tokenu → 401 (auth realnie egzekwowany na tej trasie)', async () => {
    const res = await request(app)
      .post(`/api/initiatives/${INIT_APPROVED}/start-execution`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('DRAFT (draft) → 400 „Cannot start execution from status" — gate blokuje spoza approved', async () => {
    const before = await getRow(INIT_DRAFT);
    expect(before?.status).toBe('draft');

    const res = await request(app)
      .post(`/api/initiatives/${INIT_DRAFT}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot start execution from status/);

    // Stan bez zmian — gate rzeczywiście nie przepuścił.
    const after = await getRow(INIT_DRAFT);
    expect(after?.status).toBe('draft');
  });

  it('FIX #1+#2: approved → start-execution → 200, status EXECUTING (uppercase), execution_started_at zapisany', async () => {
    const before = await getRow(INIT_APPROVED);
    expect(before?.status).toBe('approved');
    expect(before?.execution_started_at).toBeNull();

    const res = await request(app)
      .post(`/api/initiatives/${INIT_APPROVED}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // Migracja addytywna zaaplikowana → brak SQL 500; case kanoniczny.
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('EXECUTING');

    const after = await getRow(INIT_APPROVED);
    expect(after?.status).toBe('EXECUTING'); // UPPERCASE — zgodne z kanonem i summary
    expect(after?.execution_started_at).not.toBeNull(); // kolumna realnie zapisana
  });

  it('FIX #2: uruchomiona inicjatywa JEST widoczna w GET execution summary (liczniki +1)', async () => {
    // Baseline PRZED startem drugiej inicjatywy.
    const baseline = await request(app)
      .get(`/api/execution/${PROJECT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(baseline.status).toBe(200);
    expect(baseline.body.projectId).toBe(PROJECT_ID);
    const beforeExecuting = baseline.body.executingCount;
    const beforeTotal = baseline.body.totalInitiatives;

    // Druga inicjatywa: seed uppercase 'APPROVED' → dowód, że gate case-insensitive
    // przepuszcza też kanoniczny uppercase.
    await insertInitiative(INIT_UPPER_APPROVED, 'APPROVED', PROJECT_ID);

    const start = await request(app)
      .post(`/api/initiatives/${INIT_UPPER_APPROVED}/start-execution`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(start.status).toBe(200);
    expect(start.body.newStatus).toBe('EXECUTING');

    // Summary PO starcie — liczniki rosną o 1 (fix case: EXECUTING widoczne).
    const after = await request(app)
      .get(`/api/execution/${PROJECT_ID}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body.executingCount).toBe(beforeExecuting + 1);
    expect(after.body.totalInitiatives).toBe(beforeTotal + 1);
  });
});
