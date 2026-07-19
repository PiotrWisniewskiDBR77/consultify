/**
 * Acceptance — Whiteboard node comments (REAL runtime, PARITY pg18 :5443).
 *
 * Wzorzec 1:1 z tests/acceptance/h2-bugs.e2e.test.ts: REALNY my-work router +
 * REALNE verifyToken (minted JWT) + REALNA lokalna Postgres. Zero mocków logiki.
 * Izolacja: prefiks `odbior--wbc--`, sprzątanie w afterAll.
 *
 * Dowodzi kontraktu persystencji komentarzy węzła whiteboard (identycznego z
 * Process Flow): komentarze żyją w `node.data.comments[]` i jadą na istniejącym
 * blobie grafu (PUT /my-ideas/:id/map → GET). Brak nowej powierzchni API.
 *
 *   WBC.1 — dodaj komentarz do węzła whiteboard przez REALNĄ ścieżkę zapisu
 *           grafu (PUT /map) → persist → reload (GET /map) → komentarz jest
 *           (API projekcja + bezpośredni dowód SQL w nodes_json).
 *   WBC.2 — drugi user tej samej org (ACTIVE member) widzi komentarz przez
 *           org-scoped GET /map.
 *   WBC.3 — usunięcie komentarza (kolejny PUT bez wpisu) też robi round-trip.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--wbc--';

let token: string;
let secondToken: string;
let myWorkApp: Express;

const createdIdeaIds: string[] = [];
const SECOND_USER_ID = `${PREFIX}user-second`;
const SECOND_MEMBER_ID = `${PREFIX}mem-second`;

interface WbComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  mentions?: string[];
}

function buildComment(author: string, text: string): WbComment {
  return {
    id: `wb-comment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    author,
    text,
    createdAt: new Date().toISOString(),
    mentions: (text.match(/@(\w+)/g) || []).map((m) => m.slice(1)),
  };
}

function stickyNode(id: string, label: string, comments: WbComment[]) {
  return {
    id,
    type: 'stickyNote',
    position: { x: 120, y: 80 },
    data: { label, semanticType: 'note', comments },
  };
}

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

async function putMap(
  ideaId: string,
  nodes: unknown[],
  opts: { authToken?: string; baseVersion?: number } = {}
) {
  const body: Record<string, unknown> = { nodes, edges: [], preferredTool: 'whiteboard' };
  // OCC: updating an EXISTING canonical row requires the current version as
  // baseVersion (mirrors the FE useIdeaMapSync autosave). Omitted for the
  // first write to a brand-new idea (no row yet → version defaults to 1).
  if (typeof opts.baseVersion === 'number') body.baseVersion = opts.baseVersion;
  return request(myWorkApp)
    .put(`/api/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`)
    .set('Authorization', `Bearer ${opts.authToken ?? token}`)
    .send(body);
}

async function getMap(ideaId: string, authToken = token) {
  return request(myWorkApp)
    .get(`/api/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`)
    .set('Authorization', `Bearer ${authToken}`);
}

/** Pull the comments array off a node in a GET /map response body. */
function commentsOfNode(body: any, nodeId: string): WbComment[] {
  const nodes: any[] = Array.isArray(body?.map?.nodes) ? body.map.nodes : [];
  const node = nodes.find((n) => String(n?.id) === nodeId);
  const comments = node?.data?.comments;
  return Array.isArray(comments) ? comments : [];
}

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru (OWNER)
  token = mintToken();
  secondToken = mintToken({ id: SECOND_USER_ID });

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: myWorkRouter } = await import('../../server/src/routes/my-work.routes.js');
  myWorkApp = express();
  myWorkApp.use(express.json({ limit: '5mb' }));
  myWorkApp.use('/api/my-work', verifyToken as any, myWorkRouter);

  // Second ACTIVE member of the SAME org — proves org-scoped read visibility.
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'MEMBER', 'active', 'Odbior', 'WbcSecond', CURRENT_TIMESTAMP)
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

describe('Acceptance WBC — Whiteboard node comments persist via the real graph save path', () => {
  it('WBC.1 — a comment on node.data.comments persists through PUT /map and reloads via GET /map', async () => {
    const id = await createIdea(`${PREFIX}Whiteboard idea ${Date.now()}`);
    const nodeId = `${PREFIX}sticky-1`;
    const comment = buildComment('Odbior Harness', 'First whiteboard remark @WbcSecond');

    const putRes = await putMap(id, [stickyNode(nodeId, 'Idea sticky', [comment])]);
    expect(putRes.status).toBeLessThan(400);

    const getRes = await getMap(id);
    expect(getRes.status).toBe(200);
    const comments = commentsOfNode(getRes.body, nodeId);
    expect(comments.length).toBe(1);
    expect(comments[0].id).toBe(comment.id);
    expect(comments[0].text).toBe('First whiteboard remark @WbcSecond');
    expect(comments[0].author).toBe('Odbior Harness');
    expect(comments[0].mentions).toContain('WbcSecond');

    // Direct SQL proof — the canonical nodes_json blob, not just the API projection.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT nodes_json FROM my_idea_maps WHERE idea_id = $1`,
        [id]
      );
      expect(rows.length).toBeGreaterThan(0);
      const raw = String(rows[0].nodes_json ?? '');
      expect(raw).toContain('First whiteboard remark');
      expect(raw).toContain(comment.id);
    } finally {
      await client.end();
    }
  });

  it('WBC.2 — a second ACTIVE org member sees the comment via org-scoped GET /map', async () => {
    const id = await createIdea(`${PREFIX}Shared whiteboard ${Date.now()}`);
    const nodeId = `${PREFIX}sticky-shared`;
    const comment = buildComment('Odbior Harness', 'Visible to teammates');

    expect((await putMap(id, [stickyNode(nodeId, 'Shared sticky', [comment])])).status).toBeLessThan(
      400
    );

    // Second user (same org, different user id) reads the canonical board.
    const getRes = await getMap(id, secondToken);
    expect(getRes.status).toBe(200);
    const comments = commentsOfNode(getRes.body, nodeId);
    expect(comments.length).toBe(1);
    expect(comments[0].text).toBe('Visible to teammates');
  });

  it('WBC.3 — deleting a comment (PUT without it) round-trips to an empty thread', async () => {
    const id = await createIdea(`${PREFIX}Delete whiteboard ${Date.now()}`);
    const nodeId = `${PREFIX}sticky-del`;
    const c1 = buildComment('Odbior Harness', 'keep me');
    const c2 = buildComment('Odbior Harness', 'delete me');

    expect((await putMap(id, [stickyNode(nodeId, 'Del sticky', [c1, c2])])).status).toBeLessThan(400);
    const seeded = await getMap(id);
    expect(commentsOfNode(seeded.body, nodeId).length).toBe(2);
    const version = Number(seeded.body?.map?.version ?? 1);

    // Remove c2 (mirrors the FE removeComment → setNodes → autosave path), passing
    // the current version as baseVersion for the existing-row OCC check.
    expect(
      (await putMap(id, [stickyNode(nodeId, 'Del sticky', [c1])], { baseVersion: version })).status
    ).toBeLessThan(400);
    const after = commentsOfNode((await getMap(id)).body, nodeId);
    expect(after.length).toBe(1);
    expect(after[0].id).toBe(c1.id);
  });
});
