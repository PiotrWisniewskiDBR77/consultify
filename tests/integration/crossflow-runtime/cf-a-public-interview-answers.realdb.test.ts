/**
 * Package A — public, token-bound respondent writes, proven on mounted HTTP.
 *
 * WHAT THIS SUITE IS ALLOWED TO CLAIM
 * -----------------------------------
 * It mounts the REAL `interview-enterprise.routes.ts` router, which applies its
 * own `verifyToken` to everything below the public block, and drives it with a
 * REAL invite token for the public half and a REAL SIGNED JWT for the manager
 * half. `E2E_MODE` is deleted by the fixture, and test A0 proves an unsigned
 * `{alg:'none'}` token is rejected — so nothing here rides the auth bypass.
 *
 * RUN:
 *   DATABASE_URL="postgresql://cfq:cfq@127.0.0.1:56902/consultinity" NODE_ENV=test \
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   npx vitest run tests/integration/crossflow-runtime/cf-a-public-interview-answers.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 *
 * `--retry=0` is mandatory: `vitest.config.ts:311` is `retry: CI ? 3 : 1`.
 */
// runtimeFixture MUST be first — it pins JWT_SECRET and deletes E2E_MODE before
// any server module can load Config.ts.
import {
  ALL_TENANTS,
  TENANT_A,
  TENANT_B,
  bearer,
  cfId,
  coldRead,
  dropTenants,
  forgedE2EToken,
  newClient,
  raceExactly,
  requireDatabase,
  seedTenants,
} from './runtimeFixture.js';

import type { Express } from 'express';
import express from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Tokens must match `/^[a-f0-9]{64}$/i` — the resolver rejects anything else. */
const hex64 = (seed: string) =>
  Buffer.from(seed.padEnd(32, 'x')).toString('hex').slice(0, 64).padEnd(64, '0');

const SESSION_A = cfId('isession', 'alpha');
const SESSION_B = cfId('isession', 'beta');
const Q_A = cfId('iq', 'alpha-1');
const Q_A2 = cfId('iq', 'alpha-2');
const Q_B = cfId('iq', 'beta-1');

const DIST_ACTIVE = cfId('idist', 'active');
const DIST_EXPIRED = cfId('idist', 'expired');
const DIST_REVOKED = cfId('idist', 'revoked');
const DIST_TENANT_B = cfId('idist', 'tenant-b');

const TOKEN_ACTIVE = hex64('cf-a-active');
const TOKEN_EXPIRED = hex64('cf-a-expired');
const TOKEN_REVOKED = hex64('cf-a-revoked');
const TOKEN_TENANT_B = hex64('cf-a-tenant-b');
const TOKEN_UNKNOWN = hex64('cf-a-unknown');

let client: pg.Client;
let app: Express;

const TEARDOWN = ['interview_distributions', 'interview_questions', 'interview_sessions'];

/**
 * The receipt ledger is append-only AT THE DATABASE LEVEL, so `DELETE` is
 * refused by its trigger — which is the whole point of test A6. That makes the
 * table un-cleanable by ordinary teardown, and a leaked receipt from a previous
 * run turns the very first write of the next run into a "replay", silently
 * invalidating every idempotency assertion downstream. (Found exactly that way:
 * run 3 passed, run 4 reported `replayed: true` on a fresh write.)
 *
 * `TRUNCATE` bypasses row-level triggers by design and is the correct tool for
 * resetting a DISPOSABLE database. It does not weaken the production guard —
 * no application code path can reach it — and this lane's Postgres is a
 * throwaway container owning nothing else that writes this table.
 */
async function resetReceiptLedger(c: pg.Client): Promise<void> {
  await c.query('TRUNCATE TABLE interview_public_answer_receipts');
}

async function seedQuestion(id: string, sessionId: string, orgId: string): Promise<void> {
  await client.query(
    `INSERT INTO interview_questions (id, session_id, organization_id, category, question_text, status)
     VALUES ($1, $2, $3, 'discovery', 'Crossflow probe question', 'not_started')
     ON CONFLICT (id) DO UPDATE SET answer_text = NULL, status = 'not_started', updated_at = NOW()`,
    [id, sessionId, orgId]
  );
}

/** Current CAS token for a question, read the way a respondent's client would. */
async function casToken(questionId: string): Promise<string> {
  const row = await coldRead((c) =>
    c.query<{ updated_at: Date }>(`SELECT updated_at FROM interview_questions WHERE id = $1`, [
      questionId,
    ])
  );
  return new Date(row.rows[0].updated_at).toISOString();
}

beforeAll(async () => {
  await requireDatabase();
  client = newClient();
  await client.connect();
  await resetReceiptLedger(client);
  await seedTenants(client);

  for (const [sessionId, tenant] of [
    [SESSION_A, TENANT_A],
    [SESSION_B, TENANT_B],
  ] as const) {
    await client.query(
      `INSERT INTO interview_sessions (id, organization_id, owner_id, name, status)
       VALUES ($1, $2, $3, 'Crossflow session', 'active')
       ON CONFLICT (id) DO UPDATE SET status = 'active'`,
      [sessionId, tenant.id, tenant.owner.id]
    );
  }

  await seedQuestion(Q_A, SESSION_A, TENANT_A.id);
  await seedQuestion(Q_A2, SESSION_A, TENANT_A.id);
  await seedQuestion(Q_B, SESSION_B, TENANT_B.id);

  const dist = async (
    id: string,
    orgId: string,
    sessionId: string,
    token: string,
    expiresSql: string,
    revoked: boolean
  ) =>
    client.query(
      `INSERT INTO interview_distributions
         (id, organization_id, session_id, channel, public_token, status, expires_at, revoked_at)
       VALUES ($1, $2, $3, 'link', $4, 'sent', ${expiresSql}, ${revoked ? 'NOW()' : 'NULL'})
       ON CONFLICT (id) DO UPDATE SET status = 'sent', public_token = EXCLUDED.public_token`,
      [id, orgId, sessionId, token]
    );

  await dist(DIST_ACTIVE, TENANT_A.id, SESSION_A, TOKEN_ACTIVE, "NOW() + interval '7 days'", false);
  await dist(DIST_EXPIRED, TENANT_A.id, SESSION_A, TOKEN_EXPIRED, "NOW() - interval '1 day'", false);
  await dist(DIST_REVOKED, TENANT_A.id, SESSION_A, TOKEN_REVOKED, "NOW() + interval '7 days'", true);
  await dist(DIST_TENANT_B, TENANT_B.id, SESSION_B, TOKEN_TENANT_B, "NOW() + interval '7 days'", false);

  const router = (await import('../../../server/src/routes/interview-enterprise.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/interview-v4', router);
}, 120_000);

afterAll(async () => {
  if (!client) return;
  const orgs = ALL_TENANTS.map((t) => t.id);
  // Receipts FIRST: `interview_public_answer_receipts.distribution_id` is
  // ON DELETE RESTRICT, so an invite that was used cannot be removed while its
  // receipts exist — deliberately, see the migration.
  await resetReceiptLedger(client);
  for (const table of TEARDOWN) {
    await client
      .query(`DELETE FROM "${table}" WHERE organization_id = ANY($1::text[])`, [orgs])
      .catch(() => undefined);
  }
  await dropTenants(client);

  // Zero residue, asserted rather than assumed.
  const residue = await client.query<{ n: string }>(
    `SELECT (SELECT count(*) FROM interview_distributions WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM interview_questions      WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM interview_sessions       WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM organizations            WHERE id = ANY($1::text[])) AS n`,
    [orgs]
  );
  if (Number(residue.rows[0].n) !== 0) {
    throw new Error(`CF-A left ${residue.rows[0].n} residual rows behind`);
  }
  await client.end();
}, 60_000);

const answerUrl = (token: string, questionId: string) =>
  `/api/interview-v4/public/distributions/${token}/answers/${questionId}`;

describe('CF-A public token-bound respondent writes (real Postgres, mounted HTTP)', () => {
  describe('A0. the auth bypass is shut', () => {
    it('an unsigned {alg:none} e2e token does NOT authenticate the manager half of this router', async () => {
      expect(process.env.E2E_MODE).not.toBe('true');
      const res = await request(app)
        .get('/api/interview-v4/sessions')
        .set('Authorization', `Bearer ${forgedE2EToken(TENANT_A.owner)}`);
      expect(res.status).toBe(401);
    });

    it('a real signed JWT does authenticate it', async () => {
      const res = await request(app)
        .get('/api/interview-v4/sessions')
        .set('Authorization', bearer(TENANT_A.owner));
      expect(res.status).not.toBe(401);
    });
  });

  describe('A1. token lifecycle: valid / expired / revoked / malformed / unknown', () => {
    it('a malformed token is rejected without touching the database', async () => {
      const res = await request(app)
        .post(answerUrl('not-a-token', Q_A))
        .send({ expectedUpdatedAt: new Date().toISOString(), idempotencyKey: 'key-malformed-01' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('INVITE_NOT_FOUND');
    });

    it('an unknown but well-formed token is rejected', async () => {
      const res = await request(app)
        .post(answerUrl(TOKEN_UNKNOWN, Q_A))
        .send({ expectedUpdatedAt: new Date().toISOString(), idempotencyKey: 'key-unknown-0001' });
      expect(res.status).toBe(404);
    });

    it('an expired token is refused with 410 and writes nothing', async () => {
      const before = await casToken(Q_A);
      const res = await request(app)
        .post(answerUrl(TOKEN_EXPIRED, Q_A))
        .send({ answerText: 'expired', expectedUpdatedAt: before, idempotencyKey: 'key-expired-0001' });
      const after = await casToken(Q_A);
      expect({ status: res.status, error: res.body.error, unchanged: before === after }).toEqual({
        status: 410,
        error: 'INVITE_EXPIRED',
        unchanged: true,
      });
    });

    it('a revoked token is refused with 410 and writes nothing', async () => {
      const before = await casToken(Q_A);
      const res = await request(app)
        .post(answerUrl(TOKEN_REVOKED, Q_A))
        .send({ answerText: 'revoked', expectedUpdatedAt: before, idempotencyKey: 'key-revoked-0001' });
      const after = await casToken(Q_A);
      expect({ status: res.status, error: res.body.error, unchanged: before === after }).toEqual({
        status: 410,
        error: 'INVITE_REVOKED',
        unchanged: true,
      });
    });
  });

  describe('A2. mandatory CAS: 428 missing precondition, 409 stale', () => {
    it('a write without expectedUpdatedAt is refused 428 and stores nothing', async () => {
      const res = await request(app)
        .post(answerUrl(TOKEN_ACTIVE, Q_A))
        .send({ answerText: 'no precondition', idempotencyKey: 'key-no-precond01' });
      const receipts = await coldRead((c) =>
        c.query(`SELECT id FROM interview_public_answer_receipts WHERE idempotency_key = 'key-no-precond01'`)
      );
      expect({ status: res.status, error: res.body.error, receipts: receipts.rowCount }).toEqual({
        status: 428,
        error: 'PRECONDITION_REQUIRED',
        receipts: 0,
      });
    });

    it('a write with a stale expectedUpdatedAt is refused 409', async () => {
      const stale = new Date(Date.UTC(2020, 0, 1)).toISOString();
      const res = await request(app)
        .post(answerUrl(TOKEN_ACTIVE, Q_A))
        .send({ answerText: 'stale', expectedUpdatedAt: stale, idempotencyKey: 'key-stale-000001' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('STALE_VERSION');
    });

    it('a valid write succeeds, persists the answer and returns a fresh CAS token', async () => {
      const before = await casToken(Q_A);
      const res = await request(app)
        .post(answerUrl(TOKEN_ACTIVE, Q_A))
        .send({ answerText: 'respondent answer', expectedUpdatedAt: before, idempotencyKey: 'key-valid-000001' });

      const stored = await coldRead((c) =>
        c.query<{ answer_text: string; status: string; answered_via_distribution_id: string }>(
          `SELECT answer_text, status, answered_via_distribution_id
             FROM interview_questions WHERE id = $1`,
          [Q_A]
        )
      );
      expect({
        status: res.status,
        replayed: res.body.replayed,
        answer: stored.rows[0].answer_text,
        questionStatus: stored.rows[0].status,
        provenance: stored.rows[0].answered_via_distribution_id,
        casMoved: res.body.updatedAt !== before,
      }).toEqual({
        status: 200,
        replayed: false,
        answer: 'respondent answer',
        questionStatus: 'answered',
        provenance: DIST_ACTIVE,
        casMoved: true,
      });
    });
  });

  describe('A3. idempotency and the 8-way race', () => {
    it('the same key with the same payload replays instead of writing twice', async () => {
      const cas = await casToken(Q_A2);
      const body = {
        answerText: 'idempotent',
        expectedUpdatedAt: cas,
        idempotencyKey: 'key-replay-00001',
      };
      const first = await request(app).post(answerUrl(TOKEN_ACTIVE, Q_A2)).send(body);
      const second = await request(app).post(answerUrl(TOKEN_ACTIVE, Q_A2)).send(body);

      const receipts = await coldRead((c) =>
        c.query(`SELECT id FROM interview_public_answer_receipts WHERE idempotency_key = 'key-replay-00001'`)
      );
      expect({
        firstStatus: first.status,
        firstReplayed: first.body.replayed,
        secondStatus: second.status,
        secondReplayed: second.body.replayed,
        sameCas: first.body.updatedAt === second.body.updatedAt,
        receiptRows: receipts.rowCount,
      }).toEqual({
        firstStatus: 200,
        firstReplayed: false,
        secondStatus: 200,
        secondReplayed: true,
        sameCas: true,
        receiptRows: 1,
      });
    });

    it('the same key with a DIFFERENT payload is a reported collision, not a silent replay', async () => {
      const res = await request(app)
        .post(answerUrl(TOKEN_ACTIVE, Q_A2))
        .send({
          answerText: 'a different answer under the same key',
          expectedUpdatedAt: await casToken(Q_A2),
          idempotencyKey: 'key-replay-00001',
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    });

    it('8 concurrent writes of one key yield exactly one winner and exactly one receipt', async () => {
      const ATTEMPTS = 8;
      await seedQuestion(Q_A2, SESSION_A, TENANT_A.id);
      const cas = await casToken(Q_A2);

      const race = await raceExactly(ATTEMPTS, () =>
        request(app)
          .post(answerUrl(TOKEN_ACTIVE, Q_A2))
          .send({ answerText: 'race', expectedUpdatedAt: cas, idempotencyKey: 'key-race-000001' })
      );

      const receipts = await coldRead((c) =>
        c.query(`SELECT id FROM interview_public_answer_receipts WHERE idempotency_key = 'key-race-000001'`)
      );
      const ok = race.fulfilled.filter((r: any) => r.status === 200);
      const written = ok.filter((r: any) => r.body.replayed === false).length;
      const replayed = ok.filter((r: any) => r.body.replayed === true).length;
      const conflicts = race.fulfilled.filter((r: any) => r.status === 409).length;

      // Exact denominator: every attempt is accounted for.
      expect({
        attempts: race.attempts,
        transportRejected: race.rejected.length,
        accepted: ok.length,
        written,
        replayed,
        conflicts,
        receiptRows: receipts.rowCount,
      }).toEqual({
        attempts: ATTEMPTS,
        transportRejected: 0,
        accepted: ok.length,
        written: 1,
        replayed: ok.length - 1,
        conflicts: ATTEMPTS - ok.length,
        receiptRows: 1,
      });
    }, 60_000);
  });

  describe('A4. tenancy and scope: a token reaches only its own session', () => {
    it("tenant B's token cannot answer tenant A's question, and looks exactly like a missing one", async () => {
      const foreign = await request(app)
        .post(answerUrl(TOKEN_TENANT_B, Q_A))
        .send({
          answerText: 'cross tenant',
          expectedUpdatedAt: await casToken(Q_A),
          idempotencyKey: 'key-xtenant-0001',
        });
      const missing = await request(app)
        .post(answerUrl(TOKEN_TENANT_B, cfId('iq', 'does-not-exist')))
        .send({
          answerText: 'missing',
          expectedUpdatedAt: new Date().toISOString(),
          idempotencyKey: 'key-missing-0001',
        });

      expect(foreign.status).toBe(missing.status);
      expect(foreign.status).toBe(404);
      // No existence leak: the response must not name the other tenant.
      expect(JSON.stringify(foreign.body)).not.toContain(TENANT_A.id);
      expect(JSON.stringify(foreign.body)).not.toContain(SESSION_A);
    });

    it("tenant A's answer was not modified by the cross-tenant attempt", async () => {
      const stored = await coldRead((c) =>
        c.query<{ answer_text: string }>(`SELECT answer_text FROM interview_questions WHERE id = $1`, [
          Q_A,
        ])
      );
      expect(stored.rows[0].answer_text).toBe('respondent answer');
    });

    it('the public read exposes no tenant id and no respondent identity', async () => {
      const res = await request(app).get(`/api/interview-v4/public/distributions/${TOKEN_ACTIVE}`);
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(TENANT_A.id);
      expect(res.body).not.toHaveProperty('recipientEmail');
      expect(res.body).not.toHaveProperty('publicToken');
    });
  });

  describe('A5. completion and cold reopen', () => {
    it('completing the invite is idempotent: N concurrent calls, exactly one transition', async () => {
      const race = await raceExactly(6, () =>
        request(app).post(`/api/interview-v4/public/distributions/${TOKEN_ACTIVE}/complete`)
      );
      const transitions = race.fulfilled.filter((r: any) => r.body?.alreadyComplete === false).length;
      const row = await coldRead((c) =>
        c.query<{ status: string; completed_at: Date }>(
          `SELECT status, completed_at FROM interview_distributions WHERE id = $1`,
          [DIST_ACTIVE]
        )
      );
      expect({
        attempts: race.attempts,
        transitions,
        status: row.rows[0].status,
        hasCompletedAt: row.rows[0].completed_at !== null,
      }).toEqual({ attempts: 6, transitions: 1, status: 'completed', hasCompletedAt: true });
    }, 60_000);

    it('a completed invite refuses further writes and the stored answer survives a cold reopen', async () => {
      const after = await request(app)
        .post(answerUrl(TOKEN_ACTIVE, Q_A))
        .send({
          answerText: 'after completion',
          expectedUpdatedAt: await casToken(Q_A),
          idempotencyKey: 'key-after-compl1',
        });

      // Cold client: a brand-new connection, nothing shared with the writer.
      const reopened = await coldRead((c) =>
        c.query<{ answer_text: string; answered_via_distribution_id: string }>(
          `SELECT answer_text, answered_via_distribution_id FROM interview_questions WHERE id = $1`,
          [Q_A]
        )
      );
      const receipts = await coldRead((c) =>
        c.query(`SELECT id FROM interview_public_answer_receipts WHERE idempotency_key = 'key-after-compl1'`)
      );

      expect({
        writeAccepted: after.status === 200,
        storedAnswer: reopened.rows[0].answer_text,
        provenance: reopened.rows[0].answered_via_distribution_id,
        newReceipts: receipts.rowCount,
      }).toEqual({
        writeAccepted: false,
        storedAnswer: 'respondent answer',
        provenance: DIST_ACTIVE,
        newReceipts: 0,
      });
    });
  });

  describe('A6. the receipt ledger is append-only in the database, not by convention', () => {
    it('a direct UPDATE and a direct DELETE are both refused by the trigger', async () => {
      // The guard is FOR EACH ROW, so it only fires when a row is actually
      // touched. Assert against a table that HAS rows, otherwise a no-op
      // statement would pass this test while proving nothing.
      const seeded = await coldRead((c) =>
        c.query(`SELECT id FROM interview_public_answer_receipts`)
      );
      expect(seeded.rowCount).toBeGreaterThan(0);

      const update = await client
        .query(`UPDATE interview_public_answer_receipts SET idempotency_key = 'tampered'`)
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);
      const remove = await client
        .query(`DELETE FROM interview_public_answer_receipts`)
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);

      expect(String(update)).toContain('append-only');
      expect(String(remove)).toContain('append-only');
    });
  });
});
