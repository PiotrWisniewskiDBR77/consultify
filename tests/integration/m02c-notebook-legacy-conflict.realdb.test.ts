/**
 * M02-018 — the LEGACY notebook page writer must refuse a stale edit, against a
 * REAL Postgres, through the REAL legacy router
 * (`server/src/routes/my-work/notebook.routes.ts`) and the REAL `verifyToken`.
 *
 * Adopted by M02-P13 from candidate branch `codex/m02c-knowledge-automation-20260804`
 * (tip `dbde8fc443`) after verifying the guard is a genuine atomic conditional UPDATE
 * (version+tenant+owner in the WHERE clause, checked via rows-affected), not an
 * app-level check-then-write. P13 adds the same-tenant-foreign-owner negative control
 * at the bottom of this file (not present in the original candidate).
 *
 * WHY THE LEGACY PATH MATTERS
 * It is not dormant. The client falls back to it whenever V8 is off:
 * `Api.shouldLockLegacyMyWorkNotebookMode()` treats 404 / `V8_DISABLED` as
 * "use legacy for the rest of this session", which is exactly the state a
 * fresh or unflagged organization runs in. Before M02-018 this handler never
 * read `expectedUpdatedAt`, so two writers who had read the same version both
 * got HTTP 200 and the second silently overwrote the first — reproduced
 * against real Postgres, no conflict, no warning, no trace.
 *
 * The V8 sibling (the REAL v8 write path is `server/src/routes/v8/my-work.routes.ts`,
 * not `v8/notebook.routes.ts` — see M02-P13_PACKET.md) is covered by
 * `tests/acceptance/notebook-tenant-isolation.e2e.test.ts`; this file is the same
 * contract one layer down, for the path that is live whenever V8 is off.
 *
 * HOW TO RUN LOCALLY: see the header of
 * `tests/integration/m02c-ideas-collaboration-presence.realdb.test.ts`.
 *
 * SKIP POLICY: if a database is configured but unreachable, this suite FAILS
 * rather than skipping green.
 *
 * HOW THE CONCURRENCY TEST WAS PROVEN TO BITE (control run, 2026-08-04):
 * the version predicate was temporarily removed from the conditional UPDATE in
 * `server/src/routes/my-work/notebook.routes.ts`, leaving only the
 * application-side comparison. The CONCURRENT case then failed on attempt 1
 * with `[200, 200]` — two writers, one lost edit. With the predicate restored
 * it is `[200, 409]` every attempt. Repeat that removal if you ever need to
 * re-confirm that this test measures atomicity and not just ordering.
 */

import { randomBytes } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'false';
}
// Pin one secret so `jwt.sign` here and the real `verifyToken` agree by
// construction rather than by coincidence (see tests/acceptance/harness.ts).
const PINNED_JWT_SECRET = 'consultify-acceptance-harness-pinned-test-secret-fixed-32chars-min';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = PINNED_JWT_SECRET;

const PREFIX = 'm02c-nb-cas-';
const PROBE_TIMEOUT_MS = 2_000;

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: PROBE_TIMEOUT_MS, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
const ORG_ID = `${PREFIX}org-${tag}`;
const USER_ID = `${PREFIX}user-${tag}`;
const COLLEAGUE_ID = `${PREFIX}colleague-${tag}`;
const PAGE_ID = `${PREFIX}page-${tag}`;

let client: Client;
let app: Express;
let token: string;
let colleagueToken: string;
let reachable = false;

describe('M02-018 — legacy notebook page writer honours expectedUpdatedAt (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — M02-018 legacy conflict tests did NOT run. ' +
          'This run is not evidence.'
      );
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable; refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'M02-018 fixture org', now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'not-used','ADMIN','active','M02C','Fixture',$4) ON CONFLICT (id) DO NOTHING`,
      [USER_ID, ORG_ID, `${USER_ID}@acceptance.local`, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $4,$1,$2,'OWNER','ACTIVE',$3
        WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
      [ORG_ID, USER_ID, now, `${PREFIX}member-${tag}`]
    );
    // A second, real member of the SAME organization — used to prove the
    // owner-only check holds even when tenant scoping alone would let the
    // request through. A tenant-only check (org match) is not sufficient:
    // this proves the guard also checks owner_user_id.
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'not-used','MEMBER','active','M02C','Colleague',$4) ON CONFLICT (id) DO NOTHING`,
      [COLLEAGUE_ID, ORG_ID, `${COLLEAGUE_ID}@acceptance.local`, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $4,$1,$2,'MEMBER','ACTIVE',$3
        WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
      [ORG_ID, COLLEAGUE_ID, now, `${PREFIX}colleague-member-${tag}`]
    );
    await client.query(
      `INSERT INTO notebook_pages
         (id, owner_user_id, organization_id, visibility, title, content_json, content_text,
          tags_json, created_at, updated_at)
       VALUES ($1,$2,$3,'private','M02-018 original','{}','original body','[]',NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, updated_at=NOW()`,
      [PAGE_ID, USER_ID, ORG_ID]
    );

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const router = (await import('../../server/src/routes/my-work/notebook.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/my-work', verifyToken as any, router);

    token = jwt.sign(
      {
        id: USER_ID,
        email: `${USER_ID}@acceptance.local`,
        organizationId: ORG_ID,
        organization_id: ORG_ID,
        role: 'OWNER',
      },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    colleagueToken = jwt.sign(
      {
        id: COLLEAGUE_ID,
        email: `${COLLEAGUE_ID}@acceptance.local`,
        organizationId: ORG_ID,
        organization_id: ORG_ID,
        role: 'MEMBER',
      },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  }, 60_000);

  afterAll(async () => {
    if (!reachable || !client) return;
    await client.query('DELETE FROM notebook_pages WHERE id = $1', [PAGE_ID]);
    await client.query('DELETE FROM organization_members WHERE user_id IN ($1, $2)', [
      USER_ID,
      COLLEAGUE_ID,
    ]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [USER_ID, COLLEAGUE_ID]);
    await client.query('DELETE FROM organizations WHERE id = $1', [ORG_ID]);
    await client.end();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 60_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  async function readPage(): Promise<{ title: string; updatedAt: string }> {
    const res = await request(app)
      .get(`/api/my-work/notebook/pages/${PAGE_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body?.data ?? res.body;
    return { title: body.title, updatedAt: body.updatedAt ?? body.updated_at };
  }

  itDB(
    'SEQUENTIAL stale retry: a writer that saves twice from one version is rejected the second time',
    async () => {
      // NOTE: this is the STALE-TOKEN case, not a race. Both requests are
      // strictly ordered; it proves the guard rejects an out-of-date version.
      // The genuine concurrency proof is the barrier test below — do not read
      // this one as evidence about a race.
      const base = await readPage();

      const first = await request(app)
        .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'M02-018 writer ONE', expectedUpdatedAt: base.updatedAt });
      expect(first.status).toBe(200);

      const second = await request(app)
        .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'M02-018 writer TWO', expectedUpdatedAt: base.updatedAt });
      expect(second.status).toBe(409);
      expect(second.body?.code).toBe('NOTEBOOK_PAGE_CONFLICT');
      // The rejection must hand back the fresh state so the UI can merge.
      expect(second.body?.data).toBeTruthy();

      const after = await readPage();
      expect(after.title).toBe('M02-018 writer ONE');
    }
  );

  itDB(
    'CONCURRENT writers on the same version: exactly one 200, exactly one 409, winner persists',
    async () => {
      // A real race, not two ordered calls. Both requests are built first and
      // released together, so they overlap inside the server: an application
      // -side comparison would let both through, an atomic conditional UPDATE
      // lets exactly one row match.
      //
      // Repeated, because a race that only fails occasionally is exactly the
      // kind that survives a single green run.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const base = await readPage();
        const titleA = `M02-018 concurrent A#${attempt}`;
        const titleB = `M02-018 concurrent B#${attempt}`;

        const send = (title: string) =>
          request(app)
            .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title, expectedUpdatedAt: base.updatedAt });

        // Barrier: neither request is dispatched until both are queued.
        const [resA, resB] = await Promise.all([send(titleA), send(titleB)]);

        const statuses = [resA.status, resB.status].sort();
        expect(statuses, `attempt ${attempt}: expected exactly one 200 and one 409`).toEqual([
          200, 409,
        ]);

        const winnerTitle = resA.status === 200 ? titleA : titleB;
        const loser = resA.status === 409 ? resA : resB;
        expect(loser.body?.code).toBe('NOTEBOOK_PAGE_CONFLICT');
        expect(loser.body?.data).toBeTruthy();

        // Fresh reopen shows the winner; the loser overwrote nothing.
        const after = await readPage();
        expect(after.title, `attempt ${attempt}: loser must not have written`).toBe(winnerTitle);
      }
    },
    120_000
  );

  itDB('an unparseable expectedUpdatedAt is rejected 400 and never writes', async () => {
    const before = await readPage();

    const res = await request(app)
      .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'M02-018 garbage token', expectedUpdatedAt: 'not-a-timestamp' });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('INVALID_EXPECTED_UPDATED_AT');

    const after = await readPage();
    expect(after.title).toBe(before.title);
  });

  itDB('a write with the current version still succeeds (the guard is not a blanket block)', async () => {
    const current = await readPage();
    const res = await request(app)
      .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'M02-018 fresh write', expectedUpdatedAt: current.updatedAt });
    expect(res.status).toBe(200);

    const after = await readPage();
    expect(after.title).toBe('M02-018 fresh write');
  });

  itDB('autosave without expectedUpdatedAt keeps working (unchanged happy path)', async () => {
    const res = await request(app)
      .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'M02-018 autosave' });
    expect(res.status).toBe(200);

    const after = await readPage();
    expect(after.title).toBe('M02-018 autosave');
  });

  itDB('a foreign tenant cannot write, and the conditional write does not leak across tenants', async () => {
    const before = await readPage();
    const foreignToken = jwt.sign(
      {
        id: `${PREFIX}foreign-${tag}`,
        email: `${PREFIX}foreign-${tag}@acceptance.local`,
        organizationId: `${PREFIX}foreign-org-${tag}`,
        organization_id: `${PREFIX}foreign-org-${tag}`,
        role: 'OWNER',
      },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await request(app)
      .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ title: 'M02-018 foreign tenant', expectedUpdatedAt: before.updatedAt });
    expect([403, 404]).toContain(res.status);

    const after = await readPage();
    expect(after.title).toBe(before.title);
  });

  itDB(
    'a foreign OWNER in the SAME tenant cannot write another member\'s page (owner-only, not just tenant-scoped)',
    async () => {
      // Tenant scoping alone (organization_id match) would let a colleague in
      // the same org through; the handler must also enforce owner_user_id.
      // A real member of the SAME organization_members table as USER_ID,
      // targeting USER_ID's page.
      const before = await readPage();

      const res = await request(app)
        .put(`/api/my-work/notebook/pages/${PAGE_ID}`)
        .set('Authorization', `Bearer ${colleagueToken}`)
        .send({ title: 'M02-018 same-tenant colleague', expectedUpdatedAt: before.updatedAt });
      expect(res.status).toBe(403);
      expect(res.body?.error).toMatch(/owner/i);

      const after = await readPage();
      expect(after.title).toBe(before.title);
    }
  );

  itDB(
    'full cycle: create -> edit -> autosave -> server read-back -> fresh reopen all agree',
    async () => {
      const createRes = await request(app)
        .post('/api/my-work/notebook/pages')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'M02-018 cycle create', contentText: 'first draft' });
      expect(createRes.status).toBe(201);
      const created = createRes.body?.data ?? createRes.body;
      const newPageId = created.id;
      expect(newPageId).toEqual(expect.any(String));

      try {
        // Edit: full update with the version the create response returned.
        const editRes = await request(app)
          .put(`/api/my-work/notebook/pages/${newPageId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'M02-018 cycle edited',
            contentText: 'edited body',
            expectedUpdatedAt: created.updatedAt,
          });
        expect(editRes.status).toBe(200);
        const edited = editRes.body?.data ?? editRes.body;

        // Autosave: partial update carrying the edit's version forward.
        const autosaveRes = await request(app)
          .put(`/api/my-work/notebook/pages/${newPageId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ contentText: 'autosaved body', expectedUpdatedAt: edited.updatedAt });
        expect(autosaveRes.status).toBe(200);
        const autosaved = autosaveRes.body?.data ?? autosaveRes.body;

        // Server read-back immediately after autosave.
        const readBackRes = await request(app)
          .get(`/api/my-work/notebook/pages/${newPageId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(readBackRes.status).toBe(200);
        const readBack = readBackRes.body?.data ?? readBackRes.body;
        expect(readBack.title).toBe('M02-018 cycle edited');
        expect(readBack.contentText).toBe('autosaved body');
        expect(readBack.updatedAt).toBe(autosaved.updatedAt);

        // Fresh reopen: a brand-new GET, simulating closing and reopening the
        // page, must show exactly what the autosave persisted — no stale
        // cache, no partial write.
        const reopenRes = await request(app)
          .get(`/api/my-work/notebook/pages/${newPageId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(reopenRes.status).toBe(200);
        const reopened = reopenRes.body?.data ?? reopenRes.body;
        expect(reopened.title).toBe('M02-018 cycle edited');
        expect(reopened.contentText).toBe('autosaved body');
      } finally {
        await client.query('DELETE FROM notebook_pages WHERE id = $1', [newPageId]);
      }
    }
  );
});
