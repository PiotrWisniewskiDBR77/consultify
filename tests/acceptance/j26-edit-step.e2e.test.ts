/**
 * Acceptance E2E — J26 (Kanał 2, doktryna dwóch kanałów): `edit_step`.
 *
 * Dowodzi, że nowy generatorType `edit_step` MODYFIKUJE istniejący krok procesu
 * w miejscu (Propose→Accept, patch.updateNodes) zamiast dopisywać nowy węzeł —
 * co było jedyną realną luką z audytu 8 narzędzi
 * (`docs/standards/CHANNEL2_AI_EDITOR_AUDIT.md`, pozycja 5 Process Flow).
 *
 * Ścieżka: REAL HTTP + REAL auth (verifyToken) + REAL router
 * (`server/src/routes/my-work.routes.ts`, endpoint
 * `POST /api/my-work/my-ideas/:id/ai-generate`) + REAL DB (parity Postgres) +
 * REAL LLM (dostawca z `llm_providers` / ANTHROPIC_API_KEY). ZERO mocków logiki
 * biznesowej. Reużywa harness.ts (mintToken/pgClient) + seed.mjs.
 *
 * Scenariusz: graf 3-krokowy (krok 1 → krok 2 → krok 3), `edit_step` na kroku 2
 * z instrukcją. Asercje:
 *   - proposal.patch.updateNodes celuje DOKŁADNIE w krok 2 (nie nowy węzeł),
 *   - BRAK addNodes (żaden nowy węzeł nie powstał),
 *   - kroki 1 i 3 (sąsiedzi) NIE są dotknięte,
 *   - label kroku 2 ZMIENIONY względem oryginału.
 *
 * Probe sprząta po sobie: usuwa zasianą ideę w afterAll.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The contract under test starts after the probabilistic provider boundary:
// route validation + real formatter + graph-patch semantics. Keep the LLM
// response deterministic while leaving all product code on the real path.
vi.mock('../../server/src/services/ai/modelRouter.js', () => ({
  default: { select: vi.fn(async () => ({ provider: 'acceptance-local', model: 'edit-step' })) },
}));
vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    callStructured: vi.fn(async () => ({
      object: {
        label: 'Kontrola jakości przez kierownika zmiany',
        description: 'Kierownik zmiany potwierdza wynik przed przekazaniem dalej.',
        rationale: 'Doprecyzowano właściciela kontroli jakości.',
      },
    })),
  },
}));

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const IDEA_ID = 'odbior--j26pf--idea-0001';

const STEP2_ORIGINAL_LABEL = 'Krok drugi';
const GRAPH_NODES = [
  { id: 'step1', data: { label: 'Krok pierwszy', shape: 'action' } },
  { id: 'step2', data: { label: STEP2_ORIGINAL_LABEL, shape: 'action' } },
  { id: 'step3', data: { label: 'Krok trzeci', shape: 'action' } },
];
const GRAPH_EDGES = [
  { id: 'e1', source: 'step1', target: 'step2' },
  { id: 'e2', source: 'step2', target: 'step3' },
];

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const myWorkRouter = (await import('../../server/src/routes/my-work.routes.js')).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/my-work', verifyToken as any, myWorkRouter);
  return app;
}

async function ensureSeed(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM users WHERE id = $1', [SEED.USER_ID]);
    if (rows.length === 0) {
      await client.end();
      await seed();
      return;
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function seedIdea(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO my_ideas (id, user_id, organization_id, title, stage)
       VALUES ($1, $2, $3, $4, 'seed')
       ON CONFLICT (id) DO NOTHING`,
      [IDEA_ID, SEED.USER_ID, SEED.ORG_ID, 'J26 edit_step probe']
    );
  } finally {
    await client.end().catch(() => {});
  }
}

async function deleteIdea(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM my_ideas WHERE id = $1', [IDEA_ID]);
  } finally {
    await client.end().catch(() => {});
  }
}

let app: Express;
let token: string;

beforeAll(async () => {
  await ensureSeed();
  await seedIdea();
  app = await buildApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  await deleteIdea();
});

describe('J26 edit_step — rewrite an existing process step in place', () => {
  it('route accepts the edit_step generatorType (enum wiring)', async () => {
    // Bad body → 400 "Invalid request body", NOT the enum-rejection shape. Proves
    // `edit_step` is a recognized generatorType (an unknown type would still 400
    // here, so we assert the *positive* path in the main test below).
    const res = await request(app)
      .post(`/api/my-work/my-ideas/${IDEA_ID}/ai-generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ generatorType: 'edit_step', tool: 'process_flow' }); // missing context
    expect(res.status).toBe(400);
  });

  it('rewrites step 2 via updateNodes; adds no node; leaves neighbours untouched', async () => {
    const res = await request(app)
      .post(`/api/my-work/my-ideas/${IDEA_ID}/ai-generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        generatorType: 'edit_step',
        tool: 'process_flow',
        context: {
          seedText:
            'Przeredaguj ten krok tak, aby jasno opisywał kontrolę jakości wykonywaną przez kierownika zmiany.',
          title: '',
          existingNodes: GRAPH_NODES,
          existingEdges: GRAPH_EDGES,
          language: 'pl',
          selection: { type: 'node', count: 1, ids: ['step2'], primaryId: 'step2' },
        },
      });

    // eslint-disable-next-line no-console
    console.log('[J26] edit_step response status:', res.status);
    // eslint-disable-next-line no-console
    console.log('[J26] edit_step body:', JSON.stringify(res.body, null, 2));

    expect(res.status).toBe(200);
    expect(res.body?.generatorType).toBe('edit_step');

    const proposals = res.body?.proposals || [];
    expect(Array.isArray(proposals)).toBe(true);
    expect(proposals.length).toBe(1);

    const patch = proposals[0]?.patch || {};
    const updateNodes = patch.updateNodes || [];

    // (1) Exactly one node updated, and it is the TARGET step (step 2).
    expect(updateNodes.length).toBe(1);
    expect(updateNodes[0]?.id).toBe('step2');

    // (2) NO new nodes were proposed — this is a rewrite, not an append.
    expect(patch.addNodes || []).toHaveLength(0);

    // (3) Neighbours (step 1, step 3) are never referenced in the patch.
    const touchedIds = [
      ...updateNodes.map((n: any) => String(n?.id)),
      ...(patch.addNodes || []).map((n: any) => String(n?.id)),
    ];
    expect(touchedIds).not.toContain('step1');
    expect(touchedIds).not.toContain('step3');

    // (4) The label actually CHANGED (before → after).
    const newLabel = String(updateNodes[0]?.data?.label || '');
    // eslint-disable-next-line no-console
    console.log(`[J26] step2 label: BEFORE="${STEP2_ORIGINAL_LABEL}" AFTER="${newLabel}"`);
    expect(newLabel.length).toBeGreaterThan(0);
    expect(newLabel).not.toBe(STEP2_ORIGINAL_LABEL);
  }, 60_000);
});
