/**
 * A-KOL-1 — Harvard oś KOLABORACJA, dowód E2E batch 1 (note / mind map / table /
 * whiteboard). REAL-runtime against parity Postgres (:5443). No mocks: real
 * getDatabase(), real HTTP/Socket.IO servers with the real gateways attached,
 * real `ws` / `socket.io-client` clients, real Express routers behind real
 * verifyToken. #77 already proved the notebook presence WRITE path
 * (realtime_presence rows land on join/heartbeat/disconnect) — this file
 * proves the READ side (roster visibility to a peer) for all four tools, plus
 * comments and co-edit/write-conflict where those mechanisms exist.
 *
 * HONEST FINDING (per-tool collab mechanism is NOT uniform — verified by
 * reading the actual gateway/route code, not assumed):
 *
 *   NOTE (Notebook)   presence: notebookCollabWs `/ws/notebook/:noteId` (raw ws,
 *                     in-memory room + best-effort realtime_presence write).
 *                     comments: NONE — no comment table/route exists for
 *                     notebook_pages (confirmed by router introspection below).
 *                     co-edit: NONE — PUT /notebook/pages/:id is OWNER-ONLY
 *                     (a second org member gets 403, not a merge/conflict) and
 *                     carries no baseVersion/OCC check, so even the owner's own
 *                     concurrent writes silently last-write-win with zero
 *                     conflict detection. notebookCollabWs explicitly "carries
 *                     no shared document state (presence + relay pings only)".
 *
 *   MIND MAP          presence: ideaCollabWs `/ws/collab/:ideaId` (raw ws,
 *                     in-memory `type:'presence'` broadcast).
 *                     comments: dedicated SQL table `idea_node_comments` via
 *                     REST `/my-work/my-ideas/:id/map/nodes/:nodeId/comments`.
 *                     co-edit: PUT `/my-work/my-ideas/:id/map` — real OCC
 *                     (`baseVersion` vs `my_idea_maps.version`) → 409 on stale
 *                     write, proven below with two real users racing the same
 *                     canonical row (ENABLE_SHARED_IDEA_MAPS defaults true).
 *
 *   WHITEBOARD        Same ideaCollabWs gateway + same PUT /map OCC mechanism
 *                     as Mind Map (shared backend code, different ideaId).
 *                     comments: a DIFFERENT mechanism — `node.data.comments[]`
 *                     embedded in the graph blob itself (no dedicated SQL
 *                     table), already proven end-to-end by
 *                     tests/acceptance/wbc-node-comments.e2e.test.ts — not
 *                     re-proven at length here (anti-duplication mandate), one
 *                     light confirmatory assertion only.
 *
 *   TABLE (Ideas)      presence: a THIRD mechanism — Socket.IO `/table-platform`
 *                     namespace (tp_tables-scoped rooms), the same code path
 *                     `useTableRealtime` drives from IdeaTableTool.
 *                     comments: `tp_record_comments` via REST
 *                     `/api/table-platform/records/:recordId/comments`.
 *                     co-edit: `cell:update` → `cell:updated` relay — NO lock,
 *                     NO version guard; both writes broadcast, proving Table
 *                     has the weakest conflict story of the four (pure
 *                     last-write-wins at the client, same as Notebook, unlike
 *                     Mind Map/Whiteboard's server-side OCC 409).
 *
 * Requires: DATABASE_URL=postgres://…@localhost:5443/consultinity (parity),
 * NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true
 * JWT_SECRET=development_secret_key_change_in_production_abc123xyz.
 */
import http from 'http';
import { createRequire } from 'module';
import type net from 'net';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { requireLocalDbUrl } from './harness.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz';

const PREFIX = 'odbior--kol1--';
const ORG_ID = `${PREFIX}org`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;

function pgc(): pg.Client {
  return new pg.Client({ connectionString: requireLocalDbUrl() });
}

function signToken(userId: string, overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    { id: userId, organizationId: ORG_ID, name: userId, ...overrides },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

/** Buffers every WS message from socket construction (avoids the 'open' race —
 * see presentationCollabWs.presence.test.ts for the documented rationale). */
function openBufferedWs(url: string): {
  ws: WebSocket;
  waitFor: (predicate: (m: any) => boolean, timeoutMs?: number) => Promise<any>;
  opened: Promise<void>;
} {
  const ws = new WebSocket(url);
  const buffer: any[] = [];
  const waiters: { predicate: (m: any) => boolean; resolve: (m: any) => void }[] = [];
  ws.on('message', (raw: WebSocket.RawData) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const idx = waiters.findIndex((w) => w.predicate(msg));
    if (idx >= 0) {
      const [w] = waiters.splice(idx, 1);
      w.resolve(msg);
    } else {
      buffer.push(msg);
    }
  });
  const opened = new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  return {
    ws,
    opened,
    waitFor(predicate, timeoutMs = 8000) {
      const existing = buffer.findIndex((m) => predicate(m));
      if (existing >= 0) return Promise.resolve(buffer.splice(existing, 1)[0]);
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout waiting for WS message')), timeoutMs);
        waiters.push({
          predicate,
          resolve: (m) => {
            clearTimeout(t);
            res(m);
          },
        });
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Shared fixture: one org, two ACTIVE members.
// ---------------------------------------------------------------------------

async function seedOrgAndUsers(client: pg.Client) {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, 'Kol1 Org', 'enterprise', 'active', 1, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID]
  );
  for (const uid of [USER_A, USER_B]) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'MEMBER', 'active', 'Kol1', $1, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [uid, ORG_ID, `${uid}@acceptance.local`]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [`${uid}-mem`, ORG_ID, uid]
    );
  }
}

async function cleanupAll(client: pg.Client) {
  await client.query(`DELETE FROM tp_record_comments WHERE table_id IN (SELECT id FROM tp_tables WHERE name LIKE $1)`, [`${PREFIX}%`]).catch(() => {});
  await client.query(`DELETE FROM tp_records WHERE table_id IN (SELECT id FROM tp_tables WHERE name LIKE $1)`, [`${PREFIX}%`]).catch(() => {});
  await client.query(`DELETE FROM tp_tables WHERE name LIKE $1`, [`${PREFIX}%`]).catch(() => {});
  await client.query(`DELETE FROM tp_bases WHERE name LIKE $1`, [`${PREFIX}%`]).catch(() => {});
  await client.query(`DELETE FROM idea_node_comments WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
  await client.query(`DELETE FROM my_idea_maps WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
  await client.query(`DELETE FROM my_ideas WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
  await client.query(`DELETE FROM realtime_presence WHERE channel_id LIKE $1`, [`%${PREFIX}%`]).catch(() => {});
  await client.query(`DELETE FROM notebook_pages WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
  await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
  await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
  await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]).catch(() => {});
}

beforeAll(async () => {
  const client = pgc();
  await client.connect();
  try {
    await cleanupAll(client);
    await seedOrgAndUsers(client);
  } finally {
    await client.end();
  }
}, 60_000);

afterAll(async () => {
  const client = pgc();
  await client.connect();
  try {
    await cleanupAll(client);
  } finally {
    await client.end();
  }
});

// =============================================================================
// 1) NOTE (Notebook) — presence read (ws) + comments-gap + owner-only/no-OCC
// =============================================================================

describe('A-KOL-1 — Notebook (note): presence read, comments gap, write-conflict', () => {
  let server: http.Server;
  let port: number;
  let notebookApp: Express;
  const NOTE_ID = `${PREFIX}note-1`;

  beforeAll(async () => {
    const client = pgc();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO notebook_pages (id, owner_user_id, organization_id, title, content_json, created_at, updated_at)
         VALUES ($1, $2, $3, 'Kol1 note', '{"type":"doc","content":[]}', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [NOTE_ID, USER_A, ORG_ID]
      );
    } finally {
      await client.end();
    }

    const { attachNotebookCollabWs } = await import(
      '../../server/src/gateways/notebookCollabWs.gateway.js'
    );
    server = http.createServer((_req, res) => res.end());
    attachNotebookCollabWs(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { default: notebookRouter } = await import(
      '../../server/src/routes/my-work/notebook.routes.js'
    );
    notebookApp = express();
    notebookApp.use(express.json({ limit: '5mb' }));
    notebookApp.use('/api/my-work', verifyToken as any, notebookRouter);
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      server.close(() => {
        clearTimeout(t);
        resolve();
      });
      server.closeAllConnections?.();
    });
  });

  it('presence READ: a second real WS client sees the first in the live roster (and vice versa)', async () => {
    const tokenA = signToken(USER_A);
    const tokenB = signToken(USER_B);

    const a = openBufferedWs(`ws://127.0.0.1:${port}/ws/notebook/${NOTE_ID}?token=${encodeURIComponent(tokenA)}`);
    await a.opened;
    // A gets its own initial (empty) roster.
    await a.waitFor((m) => m.type === 'presence:list');

    const b = openBufferedWs(`ws://127.0.0.1:${port}/ws/notebook/${NOTE_ID}?token=${encodeURIComponent(tokenB)}`);
    await b.opened;

    // READ proof: B's roster (sent on connect) already contains A.
    const bRoster = await b.waitFor((m) => m.type === 'presence:list');
    expect(bRoster.users.some((u: any) => u.userId === USER_A)).toBe(true);

    // READ proof: A is notified B joined (peer visibility, not just self-view).
    const joined = await a.waitFor((m) => m.type === 'presence:joined' && m.user?.userId === USER_B);
    expect(joined.user.userId).toBe(USER_B);

    a.ws.terminate();
    b.ws.terminate();
  });

  it('comments GAP: notebook_pages has no comment route (runtime router introspection, not assumed)', async () => {
    const { default: notebookRouter } = await import(
      '../../server/src/routes/my-work/notebook.routes.js'
    );
    const paths: string[] = [];
    for (const layer of (notebookRouter as any).stack) {
      const p = layer?.route?.path;
      if (typeof p === 'string') paths.push(p);
      else if (Array.isArray(p)) paths.push(...p);
    }
    const commentRoutes = paths.filter((p) => /comment/i.test(p));
    console.log('[A-KOL-1][note] notebook router paths matching /comment/:', commentRoutes);
    expect(commentRoutes.length).toBe(0);
  });

  it('write-conflict: PUT is OWNER-ONLY (403 for a second org member) and has NO baseVersion/OCC guard for the owner', async () => {
    const tokenOwner = signToken(USER_A);
    const tokenOther = signToken(USER_B);

    // A second ACTIVE org member cannot write the page at all — not a merge,
    // a hard 403. Multi-writer "co-editing" does not exist at the content layer.
    const forbidden = await request(notebookApp)
      .put(`/api/my-work/notebook/pages/${NOTE_ID}`)
      .set('Authorization', `Bearer ${tokenOther}`)
      .send({ contentText: 'user-b tries to write' });
    expect(forbidden.status).toBe(403);

    // The owner's own two rapid, unordered writes: BOTH succeed (no version
    // check exists on this route at all) — last write silently wins.
    const r1 = await request(notebookApp)
      .put(`/api/my-work/notebook/pages/${NOTE_ID}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ contentText: 'first write' });
    expect(r1.status).toBe(200);

    const r2 = await request(notebookApp)
      .put(`/api/my-work/notebook/pages/${NOTE_ID}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ contentText: 'second write (should win)' });
    expect(r2.status).toBe(200);

    const client = pgc();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT content_text FROM notebook_pages WHERE id = $1`,
        [NOTE_ID]
      );
      expect(rows[0].content_text).toBe('second write (should win)');
    } finally {
      await client.end();
    }
  });
});

// =============================================================================
// Shared helpers for Mind Map + Whiteboard (both ride ideaCollabWs + PUT /map)
// =============================================================================

async function createIdea(myWorkApp: Express, token: string, title: string): Promise<string> {
  const res = await request(myWorkApp)
    .post('/api/my-work/my-ideas')
    .set('Authorization', `Bearer ${token}`)
    .send({ title });
  expect(res.status).toBe(201);
  const id = String(res.body?.id || '');
  expect(id).toBeTruthy();
  return id;
}

async function putMap(
  myWorkApp: Express,
  token: string,
  ideaId: string,
  nodes: unknown[],
  opts: { baseVersion?: number; preferredTool?: string } = {}
) {
  const body: Record<string, unknown> = {
    nodes,
    edges: [],
    preferredTool: opts.preferredTool ?? 'mind_map',
  };
  if (typeof opts.baseVersion === 'number') body.baseVersion = opts.baseVersion;
  return request(myWorkApp)
    .put(`/api/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

describe('A-KOL-1 — Mind Map: presence read, comments (SQL table), OCC write-conflict', () => {
  let server: http.Server;
  let port: number;
  let myWorkApp: Express;
  let ideaId: string;
  const tokenA = signToken(USER_A);
  const tokenB = signToken(USER_B);

  beforeAll(async () => {
    const { attachIdeaCollabWs } = await import('../../server/src/gateways/ideaCollabWs.gateway.js');
    server = http.createServer((_req, res) => res.end());
    attachIdeaCollabWs(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { default: myWorkRouter } = await import('../../server/src/routes/my-work.routes.js');
    myWorkApp = express();
    myWorkApp.use(express.json({ limit: '5mb' }));
    myWorkApp.use('/api/my-work', verifyToken as any, myWorkRouter);

    ideaId = await createIdea(myWorkApp, tokenA, `${PREFIX}Mind map idea ${Date.now()}`);
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      server.close(() => {
        clearTimeout(t);
        resolve();
      });
      server.closeAllConnections?.();
    });
  });

  it('presence READ: two real WS clients on /ws/collab/:ideaId see each other', async () => {
    const a = openBufferedWs(`ws://127.0.0.1:${port}/ws/collab/${ideaId}?token=${encodeURIComponent(tokenA)}`);
    await a.opened;
    await a.waitFor((m) => m.type === 'session_state');

    const b = openBufferedWs(`ws://127.0.0.1:${port}/ws/collab/${ideaId}?token=${encodeURIComponent(tokenB)}`);
    await b.opened;

    // The room broadcasts a fresh `presence` roster whenever membership
    // changes; the SAME roster is relayed to every socket, so waiting on
    // either client is a read-proof of the other's join.
    const roster = await a.waitFor(
      (m) => m.type === 'presence' && Array.isArray(m.users) && m.users.length >= 2
    );
    const ids = roster.users.map((u: any) => u.id);
    expect(ids).toContain(USER_A);
    expect(ids).toContain(USER_B);

    a.ws.terminate();
    b.ws.terminate();
  });

  it('comments: user A posts an idea_node_comments row, user B (same org) reads it', async () => {
    const nodeId = `${PREFIX}mm-node-1`;
    const postRes = await request(myWorkApp)
      .post(`/api/my-work/my-ideas/${ideaId}/map/nodes/${nodeId}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'Mind map remark from A @user-b' });
    expect(postRes.status).toBeLessThan(300);

    const getRes = await request(myWorkApp)
      .get(`/api/my-work/my-ideas/${ideaId}/map/nodes/${nodeId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getRes.status).toBe(200);
    const comments = getRes.body?.comments ?? [];
    expect(comments.length).toBeGreaterThan(0);
    expect(comments.some((c: any) => c.text?.includes('Mind map remark from A'))).toBe(true);

    // Direct SQL proof — the dedicated table, not just the API projection.
    const client = pgc();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT text, user_id FROM idea_node_comments WHERE idea_id = $1 AND node_id = $2`,
        [ideaId, nodeId]
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].user_id).toBe(USER_A);
    } finally {
      await client.end();
    }
  });

  it('write-conflict: two users race PUT /map on the SAME canonical row — stale baseVersion gets a real 409', async () => {
    const nodeA = { id: `${PREFIX}mm-a`, type: 'default', position: { x: 0, y: 0 }, data: { label: 'A wrote this' } };
    const nodeB = { id: `${PREFIX}mm-b`, type: 'default', position: { x: 10, y: 10 }, data: { label: 'B wrote this' } };

    // Seed version 1 (first write to a brand-new canonical row needs no baseVersion).
    const seedRes = await putMap(myWorkApp, tokenA, ideaId, [nodeA]);
    expect(seedRes.status).toBeLessThan(400);
    const v1 = Number(seedRes.body?.map?.version ?? seedRes.body?.version ?? 1);

    // User A advances the canonical row from v1 → v2.
    const aWrite = await putMap(myWorkApp, tokenA, ideaId, [nodeA, { ...nodeA, id: `${PREFIX}mm-a2` }], {
      baseVersion: v1,
    });
    expect(aWrite.status).toBeLessThan(400);

    // User B, unaware of A's write, races in with the SAME stale baseVersion — must be rejected.
    const bWrite = await putMap(myWorkApp, tokenB, ideaId, [nodeB], { baseVersion: v1 });
    expect(bWrite.status).toBe(409);
    expect(bWrite.body).toHaveProperty('currentVersion');
    expect(bWrite.body.code).toBe('IDEA_MAP_CONFLICT');
    console.log('[A-KOL-1][mindmap] 409 conflict payload keys:', Object.keys(bWrite.body));
  });
});

describe('A-KOL-1 — Whiteboard: presence read, OCC write-conflict, comments (blob) smoke', () => {
  let server: http.Server;
  let port: number;
  let myWorkApp: Express;
  let ideaId: string;
  const tokenA = signToken(USER_A);
  const tokenB = signToken(USER_B);

  beforeAll(async () => {
    const { attachIdeaCollabWs } = await import('../../server/src/gateways/ideaCollabWs.gateway.js');
    server = http.createServer((_req, res) => res.end());
    attachIdeaCollabWs(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { default: myWorkRouter } = await import('../../server/src/routes/my-work.routes.js');
    myWorkApp = express();
    myWorkApp.use(express.json({ limit: '5mb' }));
    myWorkApp.use('/api/my-work', verifyToken as any, myWorkRouter);

    ideaId = await createIdea(myWorkApp, tokenA, `${PREFIX}Whiteboard idea ${Date.now()}`);
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      server.close(() => {
        clearTimeout(t);
        resolve();
      });
      server.closeAllConnections?.();
    });
  });

  it('presence READ: two real WS clients on the whiteboard idea room see each other (same gateway as Mind Map, different ideaId)', async () => {
    const a = openBufferedWs(`ws://127.0.0.1:${port}/ws/collab/${ideaId}?token=${encodeURIComponent(tokenA)}`);
    await a.opened;
    await a.waitFor((m) => m.type === 'session_state');

    const b = openBufferedWs(`ws://127.0.0.1:${port}/ws/collab/${ideaId}?token=${encodeURIComponent(tokenB)}`);
    await b.opened;

    const roster = await a.waitFor(
      (m) => m.type === 'presence' && Array.isArray(m.users) && m.users.length >= 2
    );
    const ids = roster.users.map((u: any) => u.id);
    expect(ids).toContain(USER_A);
    expect(ids).toContain(USER_B);

    a.ws.terminate();
    b.ws.terminate();
  });

  it('write-conflict: OCC 409 on stale baseVersion (identical mechanism to Mind Map — same route)', async () => {
    const stickyA = {
      id: `${PREFIX}wb-a`,
      type: 'stickyNote',
      position: { x: 0, y: 0 },
      data: { label: 'A sticky', semanticType: 'note', comments: [] },
    };
    const seedRes = await putMap(myWorkApp, tokenA, ideaId, [stickyA], { preferredTool: 'whiteboard' });
    expect(seedRes.status).toBeLessThan(400);
    const v1 = Number(seedRes.body?.map?.version ?? seedRes.body?.version ?? 1);

    const aWrite = await putMap(myWorkApp, tokenA, ideaId, [stickyA, { ...stickyA, id: `${PREFIX}wb-a2` }], {
      baseVersion: v1,
      preferredTool: 'whiteboard',
    });
    expect(aWrite.status).toBeLessThan(400);

    const bWrite = await putMap(myWorkApp, tokenB, ideaId, [{ ...stickyA, id: `${PREFIX}wb-b` }], {
      baseVersion: v1,
      preferredTool: 'whiteboard',
    });
    expect(bWrite.status).toBe(409);
  });

  it('comments (blob) smoke: node.data.comments[] persists through PUT/GET /map (full contract already proven by wbc-node-comments.e2e.test.ts — not re-derived here)', async () => {
    const nodeId = `${PREFIX}wb-comment-node`;
    const comment = { id: `wb-c-${Date.now()}`, author: 'A', text: 'blob comment smoke', createdAt: new Date().toISOString() };
    const seeded = await request(myWorkApp)
      .get(`/api/my-work/my-ideas/${ideaId}/map`)
      .set('Authorization', `Bearer ${tokenA}`);
    const version = Number(seeded.body?.map?.version ?? 1);

    const put = await putMap(
      myWorkApp,
      tokenA,
      ideaId,
      [{ id: nodeId, type: 'stickyNote', position: { x: 5, y: 5 }, data: { label: 'n', semanticType: 'note', comments: [comment] } }],
      { baseVersion: version, preferredTool: 'whiteboard' }
    );
    expect(put.status).toBeLessThan(400);

    const get = await request(myWorkApp)
      .get(`/api/my-work/my-ideas/${ideaId}/map`)
      .set('Authorization', `Bearer ${tokenB}`);
    const node = (get.body?.map?.nodes ?? []).find((n: any) => n.id === nodeId);
    expect(node?.data?.comments?.[0]?.text).toBe('blob comment smoke');
  });
});

// =============================================================================
// 4) TABLE (Ideas Table / Table Platform) — Socket.IO presence + tp_record
//    comments + unlocked cell:update relay.
// =============================================================================

describe('A-KOL-1 — Table (Ideas / Table Platform): Socket.IO presence, comments, unlocked cell relay', () => {
  let httpServer: http.Server;
  let ioPort: number;
  let tablePlatformApp: Express;
  let baseId: string;
  let tableId: string;
  let recordId: string;

  beforeAll(async () => {
    const client = pgc();
    await client.connect();
    try {
      const baseRes = await client.query(
        `INSERT INTO tp_bases (workspace_id, organization_id, name, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [ORG_ID, ORG_ID, `${PREFIX}base`, USER_A]
      );
      baseId = baseRes.rows[0].id;
      const tableRes = await client.query(
        `INSERT INTO tp_tables (base_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`,
        [baseId, `${PREFIX}table`, USER_A]
      );
      tableId = tableRes.rows[0].id;
      const recordRes = await client.query(
        `INSERT INTO tp_records (table_id, data, created_by) VALUES ($1, $2, $3) RETURNING id`,
        [tableId, JSON.stringify({ name: 'Kol1 row' }), USER_A]
      );
      recordId = recordRes.rows[0].id;
    } finally {
      await client.end();
    }

    // socket.io is a `server/` workspace dependency (server/node_modules), not
    // hoisted to the repo root — a plain `import('socket.io')` from this test
    // file (under tests/acceptance/) fails module resolution. createRequire
    // anchored inside server/src/ walks node's ancestor-node_modules lookup
    // from THAT path, finding server/node_modules/socket.io correctly.
    const serverRequire = createRequire(
      new URL('../../server/src/index.ts', import.meta.url)
    );
    const { Server: SocketIOServer } = serverRequire('socket.io');
    const { tablePlatformRealtime } = await import(
      '../../server/src/services/tablePlatform/RealtimeService.js'
    );
    httpServer = http.createServer((_req, res) => res.end());
    const io = new SocketIOServer(httpServer, { cors: { origin: '*' }, path: '/socket.io' });
    tablePlatformRealtime.init(io);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    ioPort = (httpServer.address() as net.AddressInfo).port;

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { default: tablePlatformRouter } = await import(
      '../../server/src/routes/table-platform.routes.js'
    );
    tablePlatformApp = express();
    tablePlatformApp.use(express.json({ limit: '5mb' }));
    // table-platform.routes.ts calls verifyToken internally (router.use), so
    // this mount only needs the prefix — mirrors Gateway.ts's real mount.
    tablePlatformApp.use('/api/table-platform', tablePlatformRouter);
    void verifyToken; // referenced for documentation parity with other blocks
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      httpServer.close(() => {
        clearTimeout(t);
        resolve();
      });
    });
  });

  it('presence READ: two real socket.io clients joining the same table room see each other via presence:update', async () => {
    const { io: ioClient } = await import('socket.io-client');
    const tokenA = signToken(USER_A);
    const tokenB = signToken(USER_B);

    const sockA = ioClient(`http://127.0.0.1:${ioPort}/table-platform`, {
      path: '/socket.io',
      auth: { token: tokenA, userName: 'A' },
      transports: ['websocket'],
    });
    const sockB = ioClient(`http://127.0.0.1:${ioPort}/table-platform`, {
      path: '/socket.io',
      auth: { token: tokenB, userName: 'B' },
      transports: ['websocket'],
    });

    try {
      await new Promise<void>((resolve, reject) => {
        sockA.on('connect', () => resolve());
        sockA.on('connect_error', reject);
      });
      await new Promise<void>((resolve, reject) => {
        sockB.on('connect', () => resolve());
        sockB.on('connect_error', reject);
      });

      const presenceEvents: any[] = [];
      sockA.on('presence:update', (payload: any) => presenceEvents.push(payload));

      sockA.emit('join:table', tableId);
      await new Promise((r) => setTimeout(r, 200));
      sockB.emit('join:table', tableId);

      // Wait for a presence:update (triggered by B's join broadcast) whose
      // roster contains BOTH users — this is the read-side proof.
      const deadline = Date.now() + 5000;
      let both = false;
      while (Date.now() < deadline && !both) {
        both = presenceEvents.some(
          (roster) =>
            Array.isArray(roster) &&
            roster.some((u: any) => u.userId === USER_A) &&
            roster.some((u: any) => u.userId === USER_B)
        );
        if (!both) await new Promise((r) => setTimeout(r, 100));
      }
      console.log('[A-KOL-1][table] presence:update frames on A:', JSON.stringify(presenceEvents));
      expect(both).toBe(true);
    } finally {
      sockA.close();
      sockB.close();
    }
  });

  it('comments: user A posts a tp_record_comments row via REST, user B (same org) reads it', async () => {
    const tokenA = signToken(USER_A);
    const tokenB = signToken(USER_B);

    const postRes = await request(tablePlatformApp)
      .post(`/api/table-platform/records/${recordId}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tableId, content: 'Table remark from A', authorName: 'A' });
    expect(postRes.status).toBe(201);

    const getRes = await request(tablePlatformApp)
      .get(`/api/table-platform/records/${recordId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getRes.status).toBe(200);
    const comments = Array.isArray(getRes.body) ? getRes.body : (getRes.body?.comments ?? getRes.body?.rows ?? []);
    expect(comments.some((c: any) => c.content === 'Table remark from A')).toBe(true);

    const client = pgc();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT content, author_id FROM tp_record_comments WHERE record_id = $1`,
        [recordId]
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].author_id).toBe(USER_A);
    } finally {
      await client.end();
    }
  });

  it('write-conflict: cell:update has NO lock/version guard — both users\' writes broadcast unconditionally (honest gap vs Mind Map/Whiteboard OCC)', async () => {
    const { io: ioClient } = await import('socket.io-client');
    const tokenA = signToken(USER_A);
    const tokenB = signToken(USER_B);

    const sockA = ioClient(`http://127.0.0.1:${ioPort}/table-platform`, {
      path: '/socket.io',
      auth: { token: tokenA },
      transports: ['websocket'],
    });
    const sockB = ioClient(`http://127.0.0.1:${ioPort}/table-platform`, {
      path: '/socket.io',
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          sockA.on('connect', () => resolve());
          sockA.on('connect_error', reject);
        }),
        new Promise<void>((resolve, reject) => {
          sockB.on('connect', () => resolve());
          sockB.on('connect_error', reject);
        }),
      ]);

      const bUpdates: any[] = [];
      const aUpdates: any[] = [];
      sockB.on('cell:updated', (d: any) => bUpdates.push(d));
      sockA.on('cell:updated', (d: any) => aUpdates.push(d));

      sockA.emit('join:table', tableId);
      sockB.emit('join:table', tableId);
      await new Promise((r) => setTimeout(r, 200));

      // Both race the SAME cell with different values — no lock exists.
      sockA.emit('cell:update', { tableId, recordId, fieldId: 'name', value: 'from-A', userId: USER_A, timestamp: Date.now() });
      sockB.emit('cell:update', { tableId, recordId, fieldId: 'name', value: 'from-B', userId: USER_B, timestamp: Date.now() });

      await new Promise((r) => setTimeout(r, 400));

      console.log('[A-KOL-1][table] B saw:', JSON.stringify(bUpdates), 'A saw:', JSON.stringify(aUpdates));
      // B must have received A's relay, and A must have received B's relay —
      // BOTH land, unconditionally, proving there is no server-side arbitration.
      expect(bUpdates.some((u) => u.value === 'from-A')).toBe(true);
      expect(aUpdates.some((u) => u.value === 'from-B')).toBe(true);
    } finally {
      sockA.close();
      sockB.close();
    }
  });
});
