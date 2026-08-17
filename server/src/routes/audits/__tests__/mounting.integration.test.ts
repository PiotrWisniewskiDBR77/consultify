/**
 * Dowód montażu tras Audits w realnym Gateway.
 *
 * DLACZEGO TEN TEST ISTNIEJE:
 * Ten projekt ma udokumentowaną historię tras, które istnieją w pliku, ale nie
 * są zamontowane — `server/src/routes/audit.routes.ts` jest właśnie takim
 * przypadkiem (montowany przez `mountStub`, który na demo i produkcji go
 * pomija, więc endpoint zwraca 404 mimo kompletnego kodu). Test sprawdzający
 * wyłącznie serwis przeszedłby, a użytkownik dostałby 404.
 *
 * Test buduje aplikację przez ten sam `initializeRoutes`, którego używa
 * produkcyjny bootstrap, i pyta o odpowiedzi HTTP. 401 jest tu wynikiem
 * POZYTYWNYM: znaczy, że żądanie dotarło do routera i zostało odrzucone przez
 * uwierzytelnienie. 404 znaczyłoby, że trasy nie ma.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Pin one secret so tokens signed here and the real `verifyToken` agree by
// construction rather than by coincidence (same approach as the acceptance
// harness). Set before Gateway/auth modules are imported.
const PINNED_JWT_SECRET = 'consultify-acceptance-harness-pinned-test-secret-fixed-32chars-min';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = PINNED_JWT_SECRET;

let app: express.Express;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
}, 120_000);

const MOUNTED_PATHS = [
  '/api/audits/sources',
  '/api/audits/packs',
  '/api/audits/programs',
  '/api/audits/criteria',
  '/api/audits/evidence',
  '/api/audits/findings',
  '/api/audits/actions',
  '/api/audits/outputs',
  '/api/audits/reports',
  '/api/audits/proposals',
  '/api/audits/ai/proposals',
  '/api/audits/trail/events',
];

describe('Audits — montaż tras w Gateway', () => {
  it.each(MOUNTED_PATHS)('%s jest zamontowana i chroniona (nie 404)', async (path) => {
    const res = await request(app).get(path);
    expect(
      res.status,
      `${path} zwróciło ${res.status}. 404 oznacza, że router nie jest zamontowany.`
    ).not.toBe(404);
    expect([401, 403]).toContain(res.status);
  });

  /**
   * Uwierzytelnienie jest założone na CAŁEJ przestrzeni `/api/audits`
   * (`router.use(verifyToken)` w agregatorze), więc nieznana podtrasa też
   * kończy się na 401, a nie na 404. To celowe i lepsze: anonim nie może
   * odpytać serwera o mapę istniejących endpointów audytu.
   *
   * Test pilnuje, żeby ta przestrzeń nigdy nie zaczęła odpowiadać anonimowo —
   * 200 albo 500 tutaj oznaczałoby dziurę w bramce.
   */
  it('nieznana podtrasa Audits nie odpowiada anonimowi niczym poza odmową', async () => {
    const res = await request(app).get('/api/audits/nie-ma-takiej-trasy');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('stary hub orkiestratora pozostaje działający pod /api/audit', async () => {
    const res = await request(app).get('/api/audit/programs');
    expect(res.status).not.toBe(404);
    expect([401, 403]).toContain(res.status);
  });
});

/**
 * Tenant-authoritative membership, proven THROUGH THE REAL GATEWAY.
 *
 * The unit test for `requireActiveAuditsMembership` proves the function. This
 * proves the wiring: that all four Audits mounts actually run that guard, with
 * a real HS256 token the production `verifyToken` accepts, against real
 * `organization_members` rows. A guard that is correct but mounted on three of
 * four routers would pass the unit test and still leak.
 *
 * Requires a disposable database, declared by the caller, because it inserts
 * and deletes organization/user/membership fixtures. Database failure is
 * injected only into the exact membership lookup; schema is never mutated.
 */
const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
const MOUNTED_OPT_IN = process.env.AUD_MOUNTED_ALLOW_FIXTURE_CLEANUP === '1';
const MOUNTED_DB_PREFIX = process.env.AUD_MOUNTED_DISPOSABLE_DB_PREFIX ?? '';
const MOUNTED_ENABLED = REAL_PG && MOUNTED_OPT_IN && MOUNTED_DB_PREFIX.length > 0;

const mountedSuite = MOUNTED_ENABLED ? describe : describe.skip;

if (REAL_PG && !MOUNTED_ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    '[mounting.integration.test.ts — membership matrix SKIPPED, clean skip] requires ' +
      'AUD_MOUNTED_ALLOW_FIXTURE_CLEANUP=1 and AUD_MOUNTED_DISPOSABLE_DB_PREFIX=<disposable prefix>.'
  );
}

const MOUNTED_CLEANUP_LOCK_KEY = 8_113_2029;

/** One representative path per Audits mount, so a regression on any single mount is visible. */
const MOUNT_PROBES = [
  { mount: 'auditProgramsRouter  (/api/audit)', path: '/api/audit/programs' },
  { mount: 'auditsMethodRouter   (/api/audits)', path: '/api/audits/packs' },
  { mount: 'auditEventsRoutes    (/api/audit)', path: '/api/audit/events' },
  { mount: 'auditRoutes (legacy, /api/audit)', path: '/api/audit' },
] as const;

mountedSuite(
  'Audits — ACTIVE membership enforced on all four mounts (real Gateway, real HS256)',
  () => {
    let auditsDb: typeof import('../../../services/audits/auditsDb.js');
    let acquirePgClient: typeof import('../../../database/PostgresDatabase.js').acquirePgClient;
    let DbPromise: typeof import('../../../utils/DbPromise.js');

    const RUN = randomUUID().replace(/-/g, '').slice(0, 12);
    const ORG = `aud-mount-org-${RUN}`;
    const FOREIGN_ORG = `aud-mount-foreign-org-${RUN}`;
    const USER_ACTIVE = `aud-mount-user-active-${RUN}`;
    const USER_NO_MEMBERSHIP = `aud-mount-user-none-${RUN}`;
    const USER_SUPERADMIN = `aud-mount-user-sa-${RUN}`;
    const OWN_PROGRAM_ID = `aprog_mount_own_${RUN}`;
    const FOREIGN_PROGRAM_ID = `aprog_mount_foreign_${RUN}`;
    const WRITE_PACK_KEY = `mount-denied-${RUN}`;

    function sign(payload: Record<string, unknown>): string {
      return jwt.sign(payload, process.env.JWT_SECRET as string, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
    }

    const tokenActive = () =>
      sign({
        id: USER_ACTIVE,
        email: `${USER_ACTIVE}@local`,
        organizationId: ORG,
        organization_id: ORG,
        role: 'OWNER',
      });
    const tokenNoMembership = () =>
      sign({
        id: USER_NO_MEMBERSHIP,
        email: `${USER_NO_MEMBERSHIP}@local`,
        organizationId: ORG,
        organization_id: ORG,
        role: 'MEMBER',
      });
    const tokenForeign = () =>
      sign({
        id: USER_ACTIVE,
        email: `${USER_ACTIVE}@local`,
        organizationId: FOREIGN_ORG,
        organization_id: FOREIGN_ORG,
        role: 'OWNER',
      });
    const tokenSuperAdminNoMembership = () =>
      sign({
        id: USER_SUPERADMIN,
        email: `${USER_SUPERADMIN}@local`,
        organizationId: ORG,
        organization_id: ORG,
        role: 'SUPERADMIN',
        isSuperAdmin: true,
      });

    async function assertDisposableDatabase(): Promise<void> {
      const row = await auditsDb.auditGet<{ db: string }>(`SELECT current_database() AS db`);
      const db = String(row?.db ?? '');
      if (!db.startsWith(MOUNTED_DB_PREFIX)) {
        throw new Error(
          `AUD_MOUNTED_DISPOSABLE_DB_MISMATCH: current_database()='${db}' does not start with '${MOUNTED_DB_PREFIX}' — refusing to touch fixtures.`
        );
      }
    }

    async function cleanupOwnFixtures(): Promise<void> {
      await assertDisposableDatabase();
      const client = await acquirePgClient();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [MOUNTED_CLEANUP_LOCK_KEY]);
        // Children before parents; every statement bounded to this run's ids.
        await client.query(`DELETE FROM audit_packs WHERE pack_key = $1 AND organization_id = $2`, [
          WRITE_PACK_KEY,
          ORG,
        ]);
        await client.query(`DELETE FROM audit_programs WHERE id = ANY($1)`, [
          [OWN_PROGRAM_ID, FOREIGN_PROGRAM_ID],
        ]);
        await client.query(`DELETE FROM organization_members WHERE user_id = ANY($1)`, [
          [USER_ACTIVE, USER_NO_MEMBERSHIP, USER_SUPERADMIN],
        ]);
        await client.query(`DELETE FROM users WHERE id = ANY($1)`, [
          [USER_ACTIVE, USER_NO_MEMBERSHIP, USER_SUPERADMIN],
        ]);
        await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, FOREIGN_ORG]]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err; // never swallowed
      } finally {
        client.release();
      }
    }

    async function setMembership(status: string): Promise<void> {
      await auditsDb.auditRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', $4)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = EXCLUDED.status`,
        [`aud-mount-mem-${RUN}`, ORG, USER_ACTIVE, status]
      );
    }

    /** Business plus append-only audit rows that must not change on denial. */
    async function auditWriteSnapshot(): Promise<Record<string, number>> {
      const row = await auditsDb.auditGet<Record<string, string>>(
        `SELECT
         (SELECT count(*) FROM audit_programs WHERE organization_id = $1)::text AS programs,
         (SELECT count(*) FROM audit_packs WHERE organization_id = $1)::text AS packs,
         (SELECT count(*) FROM audits WHERE organization_id = $1)::text AS legacy_audits,
         (SELECT count(*) FROM audit_events WHERE org_id = $1)::text AS events,
         (SELECT count(*) FROM audit_logs WHERE organization_id = $1)::text AS logs`,
        [ORG]
      );
      return Object.fromEntries(
        Object.entries(row ?? {}).map(([key, value]) => [key, Number(value)])
      );
    }

    async function withMembershipLookupFailure<T>(run: () => Promise<T>): Promise<T> {
      const originalGet = DbPromise.get;
      let exactHits = 0;
      const spy = vi.spyOn(DbPromise, 'get').mockImplementation(async (...args) => {
        const [sql, params] = args;
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        const isExactMembershipLookup =
          normalizedSql ===
            'SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?' &&
          Array.isArray(params) &&
          params[0] === USER_ACTIVE &&
          params[1] === ORG;
        if (isExactMembershipLookup) {
          exactHits += 1;
          throw new Error('AUD_MOUNTED_TARGETED_MEMBERSHIP_LOOKUP_FAILURE');
        }
        return originalGet(...args);
      });
      try {
        return await run();
      } finally {
        spy.mockRestore();
        expect(exactHits).toBe(1);
      }
    }

    beforeAll(async () => {
      auditsDb = await import('../../../services/audits/auditsDb.js');
      DbPromise = await import('../../../utils/DbPromise.js');
      ({ acquirePgClient } = await import('../../../database/PostgresDatabase.js'));
      await assertDisposableDatabase();
      await cleanupOwnFixtures();

      for (const org of [ORG, FOREIGN_ORG]) {
        await auditsDb.auditRun(
          `INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [org]
        );
      }
      for (const user of [USER_ACTIVE, USER_NO_MEMBERSHIP, USER_SUPERADMIN]) {
        await auditsDb.auditRun(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [
          user,
        ]);
      }
      await setMembership('ACTIVE');
    }, 120_000);

    afterAll(async () => {
      await cleanupOwnFixtures();
      const row = await auditsDb.auditGet<{ n: string }>(
        `SELECT count(*)::text AS n FROM organization_members WHERE user_id = ANY($1)`,
        [[USER_ACTIVE, USER_NO_MEMBERSHIP, USER_SUPERADMIN]]
      );
      expect(Number(row?.n)).toBe(0); // residue0
    });

    it.each(MOUNT_PROBES)(
      '$mount — an ACTIVE member passes the membership guard',
      async ({ path }) => {
        await setMembership('ACTIVE');
        const res = await request(app).get(path).set('Authorization', `Bearer ${tokenActive()}`);
        // The guard's own denial is 403 ORG_MEMBERSHIP_REVOKED. Anything else
        // (200, or a route-level 4xx such as the legacy router's admin check)
        // means the request got PAST membership, which is what this asserts.
        expect(res.body?.code).not.toBe('ORG_MEMBERSHIP_REVOKED');
        expect(res.status).not.toBe(401);
      }
    );

    it.each(MOUNT_PROBES)(
      '$mount — the SAME token is refused on the very next request after revoke (no cache)',
      async ({ path }) => {
        await setMembership('ACTIVE');
        const token = tokenActive(); // one token, reused across both requests
        const before = await request(app).get(path).set('Authorization', `Bearer ${token}`);
        expect(before.body?.code).not.toBe('ORG_MEMBERSHIP_REVOKED');

        await setMembership('REVOKED');
        const after = await request(app).get(path).set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(403);
        expect(after.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      }
    );

    it.each(MOUNT_PROBES)('$mount — a user with NO membership row is refused', async ({ path }) => {
      const res = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${tokenNoMembership()}`);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    });

    /**
     * FOREIGN-TENANT ESCALATION.
     *
     * A naive expectation here is "a token claiming another org gets 403". That
     * is NOT what this stack does, and the actual behaviour is stronger:
     * `verifyToken` does not trust the org claim at all. When the caller is not
     * ACTIVE in the claimed organization it re-resolves `req.organizationId` from
     * the caller's genuine ACTIVE membership (auth.middleware.ts, the
     * `resolvedActive` fallback). So editing the org claim cannot reach another
     * tenant — it silently pins you back to your own.
     *
     * The security property worth asserting is therefore not the status code but
     * the DATA: a caller claiming FOREIGN_ORG must never receive FOREIGN_ORG
     * rows. This test seeds a program owned by the foreign tenant and proves it
     * stays invisible.
     */
    it("a token claiming a FOREIGN tenant cannot read that tenant's data (claim is server-resolved, not trusted)", async () => {
      await setMembership('ACTIVE'); // ACTIVE in ORG only — never in FOREIGN_ORG
      const ownProgramName = `OWN-PROGRAM-${RUN}`;
      const foreignProgramName = `FOREIGN-ONLY-PROGRAM-${RUN}`;
      await auditsDb.auditRun(
        `INSERT INTO audit_programs (id, organization_id, name, created_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
        [OWN_PROGRAM_ID, ORG, ownProgramName, USER_ACTIVE]
      );
      await auditsDb.auditRun(
        `INSERT INTO audit_programs (id, organization_id, name, created_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
        [FOREIGN_PROGRAM_ID, FOREIGN_ORG, foreignProgramName, USER_ACTIVE]
      );

      try {
        const res = await request(app)
          .get('/api/audit/programs')
          .set('Authorization', `Bearer ${tokenForeign()}`);

        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).toContain(ownProgramName);
        expect(JSON.stringify(res.body)).toContain(OWN_PROGRAM_ID);
        expect(JSON.stringify(res.body)).not.toContain(foreignProgramName);
        expect(JSON.stringify(res.body)).not.toContain(FOREIGN_PROGRAM_ID);
      } finally {
        await auditsDb.auditRun(`DELETE FROM audit_programs WHERE id = ANY($1)`, [
          [OWN_PROGRAM_ID, FOREIGN_PROGRAM_ID],
        ]);
      }
    });

    it('a caller with no ACTIVE membership anywhere cannot escalate by claiming any org', async () => {
      // USER_NO_MEMBERSHIP has no membership row at all, so the re-resolution
      // fallback finds nothing to pin them to and the guard denies.
      for (const org of [ORG, FOREIGN_ORG]) {
        const token = sign({
          id: USER_NO_MEMBERSHIP,
          email: `${USER_NO_MEMBERSHIP}@local`,
          organizationId: org,
          organization_id: org,
          role: 'OWNER',
        });
        const res = await request(app)
          .get('/api/audits/packs')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      }
    });

    it.each(MOUNT_PROBES)(
      '$mount — a SUPERADMIN with no membership in the target tenant is refused (no platform exemption)',
      async ({ path }) => {
        const res = await request(app)
          .get(path)
          .set('Authorization', `Bearer ${tokenSuperAdminNoMembership()}`);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      }
    );

    it.each(MOUNT_PROBES)(
      '$mount — an unreadable membership table fails CLOSED, it does not fail open',
      async ({ path }) => {
        await setMembership('ACTIVE');
        await withMembershipLookupFailure(async () => {
          const res = await request(app).get(path).set('Authorization', `Bearer ${tokenActive()}`);
          expect(res.status).toBe(403);
          expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        });
        // The guard recovers once the table is readable again.
        const recovered = await request(app)
          .get(path)
          .set('Authorization', `Bearer ${tokenActive()}`);
        expect(recovered.body?.code).not.toBe('ORG_MEMBERSHIP_REVOKED');
      }
    );

    it('the canonical pack writer works for ACTIVE OWNER and every membership denial writes zero business/audit rows', async () => {
      await setMembership('ACTIVE');
      const active = await request(app)
        .post('/api/audits/packs')
        .set('Authorization', `Bearer ${tokenActive()}`)
        .send({ packKey: WRITE_PACK_KEY, title: `Mounted writer ${RUN}` });
      expect(active.status).toBe(201);
      expect(active.body?.data).toMatchObject({ packKey: WRITE_PACK_KEY, organizationId: ORG });
      await auditsDb.auditRun(
        `DELETE FROM audit_packs WHERE pack_key = $1 AND organization_id = $2`,
        [WRITE_PACK_KEY, ORG]
      );

      const denyWrite = () =>
        request(app)
          .post('/api/audits/packs')
          .send({ packKey: WRITE_PACK_KEY, title: `Must not persist ${RUN}` });

      const before = await auditWriteSnapshot();
      const missing = await denyWrite().set('Authorization', `Bearer ${tokenNoMembership()}`);
      expect(missing.status).toBe(403);
      expect(missing.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

      const superadmin = await denyWrite().set(
        'Authorization',
        `Bearer ${tokenSuperAdminNoMembership()}`
      );
      expect(superadmin.status).toBe(403);
      expect(superadmin.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

      await setMembership('REVOKED');
      const revoked = await denyWrite().set('Authorization', `Bearer ${tokenActive()}`);
      expect(revoked.status).toBe(403);
      expect(revoked.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

      await setMembership('ACTIVE');
      await withMembershipLookupFailure(async () => {
        const failed = await denyWrite().set('Authorization', `Bearer ${tokenActive()}`);
        expect(failed.status).toBe(403);
        expect(failed.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      expect(await auditWriteSnapshot()).toEqual(before);
    });
  }
);
