/**
 * Acceptance — H2 twarde bugi (REAL runtime, PARITY pg18 :5443).
 *
 * Wzorzec 1:1 z tests/acceptance/docs-teresa.e2e.test.ts oraz smoke-500:
 * REALNY router + REALNE verifyToken (minted JWT) + REALNA lokalna Postgres.
 * Zero mocków logiki biznesowej. Izolacja: prefiks `odbior--h23--`, sprzątanie
 * w afterAll.
 *
 * Pokrycie:
 *   H2.3  — M06 routing ("Mind Map otwiera Process Flow"). Dowodzi, że
 *           `preferred_tool` idei robi round-trip przez realny router
 *           (POST idea → PUT map{preferredTool} → GET map). To fundament, na
 *           którym opiera się poprawiona rezolucja narzędzia po stronie FE
 *           (IdeaMapWorkspace.hydrate → savedPref). Bug FE (stały `?tool=` w
 *           URL nadpisywał savedPref) — patrz test jednostkowy
 *           src/components/MyWork/__tests__/ideaWorkspaceToolResolution.test.ts.
 *   H2.17 — M24 PATCH roli członka po id. Dowodzi, że PATCH
 *           /organizations/:orgId/members/:memberId/role rezolwuje {memberId}
 *           = membership.id DO user_id i aktualizuje właściwy wiersz
 *           organization_members (WHERE user_id).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--h23--';

let token: string;
let myWorkApp: Express;
let orgApp: Express;

const createdIdeaIds: string[] = [];
// H2.17 fixtures
const SECOND_USER_ID = `${PREFIX}user-second`;
const SECOND_MEMBER_ID = `${PREFIX}mem-second`;

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru (OWNER)

  token = mintToken(); // SEED user = OWNER → przechodzi requireRole('ADMIN','OWNER',...)

  // ── my-work router (H2.3) — verifyToken dokładany zewnętrznie (router go NIE
  //    aplikuje sam, wzór ze smoke-500). ────────────────────────────────────
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: myWorkRouter } = await import('../../server/src/routes/my-work.routes.js');
  myWorkApp = express();
  myWorkApp.use(express.json({ limit: '5mb' }));
  myWorkApp.use('/api/my-work', verifyToken as any, myWorkRouter);

  // ── organizations router (H2.17) — aplikuje verifyToken WEWNĘTRZNIE
  //    (organizations.routes.ts: `router.use(verifyToken)`), więc montujemy
  //    bez zewnętrznego middleware. ──────────────────────────────────────────
  const { default: orgRouter } = await import(
    '../../server/src/routes/organization/organizations.routes.js'
  );
  orgApp = express();
  orgApp.use(express.json({ limit: '5mb' }));
  orgApp.use('/api/organizations', orgRouter);

  // Drugi członek org (cel PATCH-a roli). Wstawiamy MEMBER, żeby PATCH→ADMIN
  // był realną zmianą i nie ruszał ochrony ostatniego OWNER-a ani self-lockout.
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'MEMBER', 'active', 'Odbior', 'Second', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [SECOND_USER_ID, SEED.ORG_ID, `${PREFIX}second@acceptance.local`]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [SECOND_MEMBER_ID, SEED.ORG_ID, SECOND_USER_ID]
    );
  } finally {
    await client.end();
  }
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdIdeaIds.length) {
      await client
        .query('DELETE FROM my_idea_maps WHERE idea_id = ANY($1)', [createdIdeaIds])
        .catch(() => {});
      await client.query('DELETE FROM my_ideas WHERE id = ANY($1)', [createdIdeaIds]).catch(() => {});
    }
    await client
      .query('DELETE FROM organization_members WHERE id = $1', [SECOND_MEMBER_ID])
      .catch(() => {});
    await client.query('DELETE FROM users WHERE id = $1', [SECOND_USER_ID]).catch(() => {});
  } finally {
    await client.end();
  }
});

// ============================================================================
// H2.3 — preferred_tool round-trip (fundament rezolucji narzędzia M06)
// ============================================================================
describe('Acceptance H2.3 — M06 idea preferred_tool round-trips through the real router', () => {
  async function createIdea(title: string): Promise<string> {
    const res = await request(myWorkApp)
      .post('/api/my-work/my-ideas')
      .set('Authorization', `Bearer ${token}`)
      .send({ title });
    expect(res.status).toBe(201);
    const id = String(res.body?.id || '');
    expect(id).toBeTruthy();
    createdIdeaIds.push(id);
    return id;
  }

  async function saveMapTool(
    ideaId: string,
    tool: 'mindmap' | 'process_flow' | 'table' | 'whiteboard'
  ) {
    const res = await request(myWorkApp)
      .put(`/api/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nodes: [], edges: [], preferredTool: tool });
    expect(res.status).toBeLessThan(400);
    return res;
  }

  async function readMapTool(ideaId: string): Promise<string | null> {
    const res = await request(myWorkApp)
      .get(`/api/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body?.map?.preferredTool ?? null;
  }

  it('a mindmap idea persists and reads back preferredTool=mindmap (never process_flow)', async () => {
    const id = await createIdea(`${PREFIX}Mind Map idea ${Date.now()}`);
    await saveMapTool(id, 'mindmap');
    expect(await readMapTool(id)).toBe('mindmap');

    // Direct SQL proof — the canonical column, not just the API projection.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [id]
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].preferred_tool).toBe('mindmap');
    } finally {
      await client.end();
    }
  });

  it('a process_flow idea persists and reads back preferredTool=process_flow (the inverse)', async () => {
    const id = await createIdea(`${PREFIX}Process Flow idea ${Date.now()}`);
    await saveMapTool(id, 'process_flow');
    expect(await readMapTool(id)).toBe('process_flow');
  });
});

// ============================================================================
// H2.17 — M24 PATCH member role resolves {memberId}=membership.id → user_id
// ============================================================================
describe('Acceptance H2.17 — M24 member role PATCH resolves membership id to user_id', () => {
  it('PATCH by membership id updates the correct organization_members row (WHERE user_id)', async () => {
    // Sanity: fixture starts as MEMBER.
    const client = pgClient();
    await client.connect();
    try {
      const before = await client.query(
        `SELECT role FROM organization_members WHERE id = $1`,
        [SECOND_MEMBER_ID]
      );
      expect(before.rows[0]?.role).toBe('MEMBER');
    } finally {
      await client.end();
    }

    // PATCH using the MEMBERSHIP id (not the user_id) — historically this yielded
    // a spurious 404 because the handler matched only user_id. The fix resolves
    // {memberId} against both id and user_id, then updates by the resolved user_id.
    const res = await request(orgApp)
      .patch(
        `/api/organizations/${encodeURIComponent(SEED.ORG_ID)}/members/${encodeURIComponent(
          SECOND_MEMBER_ID
        )}/role`
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBeLessThan(400);

    // Proof: the row keyed by user_id got the new role.
    const client2 = pgClient();
    await client2.connect();
    try {
      const after = await client2.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [SEED.ORG_ID, SECOND_USER_ID]
      );
      expect(after.rows[0]?.role).toBe('ADMIN');
    } finally {
      await client2.end();
    }
  });
});
