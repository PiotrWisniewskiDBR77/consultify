/**
 * 1.1-T1 (DEC-412) — ZATWIERDZENIE SESJI TWORZY INSIGHT.
 *
 * Uwaga właściciela 06.09: „nie tworzy insightów tak naprawdę. Nie ma tutaj
 * generatora insightów." Pomiar: 53 sesje APPROVED, ZERO wierszy
 * `tool_outputs` — bo `ensureToolOutputSnapshot` miał jeden wołacz
 * (`promoteToOutput`, osobna ręczna promocja), a `approveTool` nie tworzył
 * niczego.
 *
 * Ten plik broni DOKŁADNIE tego zabezpieczenia, nie mechanizmu obok:
 *   1. POST /tools/:id/approve na sesji w REVIEW  ->  1 wiersz `tool_outputs`
 *   2. powtórne wywołanie                          ->  nadal 1 (idempotencja)
 *   3. POST /tools/:id/insight na sesji JUŻ APPROVED -> 1 wiersz (uzupełnienie)
 * Mutacja: usuń wywołanie `ensureToolOutputSnapshot` z `approveTool` —
 * przypadek 1 i 2 muszą paść na `count === 0`.
 *
 * Uruchomienie (baza lokalna stanowiska, nigdy staging/demo/produkcja):
 *   RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgres://…/… \
 *   npx vitest run tests/integration/tools-approve-creates-insight.realdb.test.ts
 * Bez `MOCK_DB=false` warstwa bazy podstawia atrapę i test przechodzi pusto.
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

// vitest.config.ts przybija DB_TYPE=sqlite dla całego projektu — każdy
// *.realdb.test.ts w tym repo nadpisuje to na górze pliku, przed dotknięciem
// bazy.
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `apins-${Date.now()}-`;
const ORG = `${P}org`;
const ACTOR = `${P}actor`;

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

/**
 * Sesja dynamic-swot z realnym, silnikowo poprawnym payloadem (ten sam
 * kształt co tests/integration/tools-outputs-immutable.realdb.test.ts):
 * dwie zaakceptowane pozycje, jedno napięcie, jeden ruch przechodzący bramkę
 * W2 (tradeoff + rejectedAlternative) — inaczej `EmptyToolOutputError`
 * odmówiłby zamrożenia i test mierzyłby coś innego niż zamierzone.
 * `completion_percent`=100 i `confidence_avg`=4.5 (skala 0-5) przechodzą
 * `requireDoD`.
 */
const ANSWERS = {
  items: [
    {
      id: 'i1',
      text: 'Silny zespół wdrożeniowy',
      quadrant: 'strengths',
      impact: 'high',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
    {
      id: 'i2',
      text: 'Rosnący popyt w DACH',
      quadrant: 'opportunities',
      impact: 'high',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
  ],
  tensions: [
    {
      id: 't1',
      title: 'Napięcie i1/i2',
      type: 'attack',
      linkedItemIds: ['i1', 'i2'],
      linkedCorrelationIds: [],
      insight: 'insight',
    },
  ],
  recommendedMoves: [
    {
      id: 'm1',
      title: 'Uruchomić pilota w DACH',
      category: 'quick-win',
      rationale: 'Popyt rośnie, zespół wdrożeniowy jest niewykorzystany.',
      linkedTensionIds: ['t1'],
      linkedItemIds: ['i1'],
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      firstStep: 'Wybrać klienta pilotażowego',
      ownerRole: 'Dyrektor sprzedaży',
      tradeoff: {
        chosen: 'Pilot w DACH',
        deferred: 'Rozwój produktu',
        cost: 'Dług produktowy +1Q',
      },
      rejectedAlternative: {
        option: 'Wejście przez partnera',
        reason: 'Utrata kontroli nad wdrożeniem',
      },
    },
  ],
};

async function seedSession(id: string, status: 'REVIEW' | 'APPROVED'): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, dod_status, version, created_by, updated_by,
          created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,$4,100,4.5,$5,'passed',1,$6,$6,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [id, ORG, `insight session ${id}`, status, JSON.stringify(ANSWERS), ACTOR]
    );
  } finally {
    await c.end();
  }
}

async function countOutputs(sessionId: string): Promise<number> {
  const c = await db();
  try {
    const r = await c.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM tool_outputs
        WHERE tool_session_id = $1 AND organization_id = $2 AND status <> 'superseded'`,
      [sessionId, ORG]
    );
    return Number(r.rows[0]!.n);
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  // FAIL, nigdy skip: rzuca natychmiast, jeśli to nie jest realny,
  // świadomie włączony Postgres (RUN_DB_TESTS=1, MOCK_DB=false, żywy SELECT).
  await assertRealPostgresTestEnvironment();

  const c = await db();
  try {
    await c.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'free','active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG, `${P}org`]
    );
    await c.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1,$2,$3,'admin','active') ON CONFLICT (id) DO NOTHING`,
      [ACTOR, ORG, `${P}actor@example.test`]
    );
  } finally {
    await c.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: ACTOR,
      organizationId: ORG,
      role: 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.post('/api/tools/:toolId/approve', ToolController.approveTool);
  app.post('/api/tools/:toolId/insight', ToolController.createToolInsight);
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      // eslint-disable-next-line no-console
      console.error('[test app error handler]', err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  );
}, 30_000);

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_decisions WHERE tool_session_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM decisions WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM audit_log WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM users WHERE id = $1`, [ACTOR]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('approveTool tworzy insight (tool_outputs) — realny Postgres', () => {
  it('B1: zatwierdzenie sesji w REVIEW tworzy DOKŁADNIE jeden wiersz tool_outputs', async () => {
    const id = `${P}s1`;
    await seedSession(id, 'REVIEW');
    expect(await countOutputs(id)).toBe(0);

    const res = await request(app).post(`/api/tools/${id}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.insight?.created).toBe(true);
    expect(typeof res.body.insight?.id).toBe('string');

    expect(await countOutputs(id)).toBe(1);
  }, 30_000);

  it('B2: powtórne zatwierdzenie nie tworzy drugiego snapshotu (idempotencja bazodanowa)', async () => {
    const id = `${P}s2`;
    await seedSession(id, 'REVIEW');

    const first = await request(app).post(`/api/tools/${id}/approve`).send({});
    expect(first.status).toBe(200);
    expect(await countOutputs(id)).toBe(1);

    // Sesja jest już APPROVED, więc approve odpowiada 409 „not in review" —
    // ale nawet gdyby ktoś cofnął status i zatwierdził ponownie, wiersz ma
    // zostać jeden. Sprawdzamy oba: kod 409 i licznik.
    const second = await request(app).post(`/api/tools/${id}/approve`).send({});
    expect(second.status).toBe(409);

    await seedSession(id, 'REVIEW');
    const third = await request(app).post(`/api/tools/${id}/approve`).send({});
    expect(third.status).toBe(200);
    expect(await countOutputs(id)).toBe(1);
  }, 30_000);

  it('B3: sesja zatwierdzona PRZED tą zmianą dostaje insight przez POST /insight', async () => {
    const id = `${P}s3`;
    await seedSession(id, 'APPROVED');
    expect(await countOutputs(id)).toBe(0);

    const res = await request(app).post(`/api/tools/${id}/insight`).send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.output?.id).toBe('string');
    expect(await countOutputs(id)).toBe(1);

    // Drugie wywołanie zwraca ten sam snapshot, nie tworzy nowego.
    const again = await request(app).post(`/api/tools/${id}/insight`).send({});
    expect(again.status).toBe(200);
    expect(again.body.output.id).toBe(res.body.output.id);
    expect(await countOutputs(id)).toBe(1);
  }, 30_000);
});
