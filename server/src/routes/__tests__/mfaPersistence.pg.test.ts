/**
 * MFA enrolment — real PostgreSQL regression.
 *
 * DEFECT THIS PINS: `mfa.routes.ts` reads and writes `user_mfa` in 13 places,
 * but no migration ever created that table. The only MFA DDL in the corpus,
 * 015_enterprise_customers_module.sql, creates a differently shaped
 * `user_mfa_methods` and is excluded from every run by the `< 500` filter in
 * `isSqliteOnlyMigration()`. So the table existed in no environment — and
 * because `DbPromise.run()` resolves `{ success: false }` instead of throwing,
 * four of the six write routes returned 200 anyway. A user was told two-factor
 * authentication was enabled while nothing had been stored.
 *
 * Migration 20260806_mfa_user_mfa_table.sql creates the table; the routes now
 * inspect the write result. These tests fail if either half is reverted:
 * without the table the writes report failure, and without the result checks
 * the refused-write cases go back to answering 200.
 *
 * Every user id is a fresh UUID, so this file cannot collide with any other.
 */
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

let currentUserId = '';

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user?: unknown }).user = { id: currentUserId };
    next();
  },
}));

/**
 * Mirrors `generateTOTP` in mfa.routes.ts. Duplicated deliberately: the route's
 * helper is not exported, and a test that generated codes by calling the same
 * function it is verifying would prove nothing about the stored secret.
 */
function totp(secret: string, window = 0): string {
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(time));
  hmac.update(buf);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      (hash[offset + 1] << 16) |
      (hash[offset + 2] << 8) |
      hash[offset + 3]) %
    1000000;
  return code.toString().padStart(6, '0');
}

describe.skipIf(!REAL_DB)('MFA enrolment — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  const orgId = `org-mfa-${randomUUID()}`;
  const createdUsers: string[] = [];

  const newUser = async (): Promise<string> => {
    const id = `user-mfa-${randomUUID()}`;
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password) VALUES ($1, $2, $3, $4)`,
      [id, orgId, `${id}@example.test`, bcrypt.hashSync('correct-password', 4)]
    );
    createdUsers.push(id);
    return id;
  };

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [
      orgId,
    ]);

    const routes = await import('../mfa.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/mfa', (routes.default ?? routes) as express.Router);
  }, 60000);

  // Children before parents; only ids this file created.
  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM audit_logs WHERE user_id = ANY($1)`, [createdUsers]);
    await pool.query(`DELETE FROM user_mfa WHERE user_id = ANY($1)`, [createdUsers]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUsers]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    const residue = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE id = ANY($1)`, [
      createdUsers,
    ]);
    if (residue.rows[0]?.n !== 0) throw new Error('mfa fixture cleanup left residue');
    await pool.end();
  });

  it('setup durably stores the pending secret, disabled', async () => {
    currentUserId = await newUser();

    const res = await request(app).post('/api/mfa/setup').send({});
    expect(res.status).toBe(200);
    expect(res.body.secret).toBeTruthy();

    const row = await pool.query(`SELECT secret, enabled FROM user_mfa WHERE user_id = $1`, [
      currentUserId,
    ]);
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].secret).toBe(res.body.secret);
    expect(row.rows[0].enabled).toBe(false);
  });

  it('verify-setup enables the factor and the state survives a fresh read', async () => {
    currentUserId = await newUser();

    const setup = await request(app).post('/api/mfa/setup').send({});
    const code = totp(setup.body.secret);

    const verify = await request(app).post('/api/mfa/verify-setup').send({ token: code });
    expect(verify.status).toBe(200);
    expect(verify.body.backupCodes).toHaveLength(10);

    // Straight from Postgres, not from the response body.
    const row = await pool.query(
      `SELECT enabled, backup_codes_count FROM user_mfa WHERE user_id = $1`,
      [currentUserId]
    );
    expect(row.rows[0].enabled).toBe(true);
    expect(row.rows[0].backup_codes_count).toBe(10);

    const status = await request(app).get('/api/mfa/status');
    expect(status.body.enabled).toBe(true);
    expect(status.body.backupCodesRemaining).toBe(10);

    // A separate pool proves the durable state is not an artefact of the
    // connection used by the fixture or of the in-process route response.
    const { Pool } = await import('pg');
    const coldPool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
    try {
      const coldRead = await coldPool.query(
        `SELECT enabled, backup_codes_count FROM user_mfa WHERE user_id = $1`,
        [currentUserId]
      );
      expect(coldRead.rows[0]).toMatchObject({ enabled: true, backup_codes_count: 10 });
    } finally {
      await coldPool.end();
    }
  });

  it('never exposes or consumes another authenticated user MFA factor', async () => {
    const ownerUserId = await newUser();
    currentUserId = ownerUserId;
    const setup = await request(app).post('/api/mfa/setup').send({});
    const enabled = await request(app)
      .post('/api/mfa/verify-setup')
      .send({ token: totp(setup.body.secret) });
    const ownerBackupCode = enabled.body.backupCodes[0];

    const otherUserId = await newUser();
    currentUserId = otherUserId;
    const foreignStatus = await request(app).get('/api/mfa/status');
    expect(foreignStatus.status).toBe(200);
    expect(foreignStatus.body.enabled).toBe(false);

    const foreignAttempt = await request(app)
      .post('/api/mfa/verify')
      .send({ token: ownerBackupCode, isBackupCode: true });
    expect(foreignAttempt.status).toBe(400);

    const ownerRow = await pool.query(
      `SELECT backup_codes_count FROM user_mfa WHERE user_id = $1`,
      [ownerUserId]
    );
    expect(ownerRow.rows[0].backup_codes_count).toBe(10);
  });

  it('disable clears the secret and the factor stays off on re-read', async () => {
    currentUserId = await newUser();

    const setup = await request(app).post('/api/mfa/setup').send({});
    await request(app)
      .post('/api/mfa/verify-setup')
      .send({ token: totp(setup.body.secret) });

    // The route requires a password confirmation and a current TOTP before it
    // will turn the factor off — both are part of its contract, not of this fix.
    const off = await request(app)
      .post('/api/mfa/disable')
      .send({ password: 'correct-password', token: totp(setup.body.secret) });
    expect(off.status).toBe(200);

    const row = await pool.query(`SELECT enabled, secret FROM user_mfa WHERE user_id = $1`, [
      currentUserId,
    ]);
    expect(row.rows[0].enabled).toBe(false);
    expect(row.rows[0].secret).toBeNull();
  });

  it('disable requires a real password re-authentication and preserves MFA on denial', async () => {
    currentUserId = await newUser();
    const setup = await request(app).post('/api/mfa/setup').send({});
    await request(app)
      .post('/api/mfa/verify-setup')
      .send({ token: totp(setup.body.secret) });

    const denied = await request(app)
      .post('/api/mfa/disable')
      .send({ password: 'wrong-password', token: totp(setup.body.secret) });
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('REAUTH_FAILED');

    const row = await pool.query(`SELECT enabled, secret FROM user_mfa WHERE user_id = $1`, [
      currentUserId,
    ]);
    expect(row.rows[0].enabled).toBe(true);
    expect(row.rows[0].secret).toBe(setup.body.secret);
  });

  it('consumes one backup code atomically exactly once under concurrent requests', async () => {
    currentUserId = await newUser();
    const setup = await request(app).post('/api/mfa/setup').send({});
    const enabled = await request(app)
      .post('/api/mfa/verify-setup')
      .send({ token: totp(setup.body.secret) });
    const recoveryCode = enabled.body.backupCodes[0];

    const responses = await Promise.all([
      request(app).post('/api/mfa/verify').send({ token: recoveryCode, isBackupCode: true }),
      request(app).post('/api/mfa/verify').send({ token: recoveryCode, isBackupCode: true }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    const row = await pool.query(
      `SELECT backup_codes, backup_codes_count FROM user_mfa WHERE user_id = $1`,
      [currentUserId]
    );
    expect(row.rows[0].backup_codes_count).toBe(9);
    expect(JSON.parse(row.rows[0].backup_codes)).toHaveLength(9);

    const audits = await pool.query(
      `SELECT details FROM audit_logs
        WHERE user_id = $1 AND action_type = 'security.mfa.recovery_code'
        ORDER BY created_at`,
      [currentUserId]
    );
    expect(audits.rows).toHaveLength(2);
    expect(audits.rows.map((auditRow) => JSON.parse(auditRow.details).success).sort()).toEqual([
      false,
      true,
    ]);
  });

  it('regeneration invalidates every old backup code and the new set remains single-use', async () => {
    currentUserId = await newUser();
    const setup = await request(app).post('/api/mfa/setup').send({});
    const enabled = await request(app)
      .post('/api/mfa/verify-setup')
      .send({ token: totp(setup.body.secret) });
    const oldCode = enabled.body.backupCodes[0];

    const regenerated = await request(app)
      .post('/api/mfa/regenerate-backup-codes')
      .send({ token: totp(setup.body.secret) });
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.backupCodes).toHaveLength(10);

    const oldAttempt = await request(app)
      .post('/api/mfa/verify')
      .send({ token: oldCode, isBackupCode: true });
    expect(oldAttempt.status).toBe(401);

    const newCode = regenerated.body.backupCodes[0];
    const first = await request(app)
      .post('/api/mfa/verify')
      .send({ token: newCode, isBackupCode: true });
    const replay = await request(app)
      .post('/api/mfa/verify')
      .send({ token: newCode, isBackupCode: true });
    expect(first.status).toBe(200);
    expect(replay.status).toBe(401);

    const row = await pool.query(`SELECT backup_codes_count FROM user_mfa WHERE user_id = $1`, [
      currentUserId,
    ]);
    expect(row.rows[0].backup_codes_count).toBe(9);
  });

  it('audits enroll, challenge, recovery-code regeneration, and disable outcomes without secrets', async () => {
    currentUserId = await newUser();
    const setup = await request(app).post('/api/mfa/setup').send({});
    await request(app).post('/api/mfa/verify-setup').send({ token: '000000' });
    await request(app)
      .post('/api/mfa/verify-setup')
      .send({ token: totp(setup.body.secret) });
    await request(app).post('/api/mfa/verify').send({ token: '000000' });
    await request(app).post('/api/mfa/verify').send({ token: totp(setup.body.secret) });
    await request(app)
      .post('/api/mfa/regenerate-backup-codes')
      .send({ token: totp(setup.body.secret) });
    await request(app)
      .post('/api/mfa/disable')
      .send({ password: 'wrong-password', token: totp(setup.body.secret) });
    await request(app)
      .post('/api/mfa/disable')
      .send({ password: 'correct-password', token: totp(setup.body.secret) });

    const audit = await pool.query(
      `SELECT action_type, details FROM audit_logs
        WHERE user_id = $1 AND action_type LIKE 'security.mfa.%'
        ORDER BY created_at`,
      [currentUserId]
    );
    const actions = audit.rows.map((auditRow) => auditRow.action_type);
    expect(actions).toEqual(
      expect.arrayContaining([
        'security.mfa.enroll_started',
        'security.mfa.enroll_failed',
        'security.mfa.enroll_completed',
        'security.mfa.challenge',
        'security.mfa.recovery_codes_regenerated',
        'security.mfa.disable',
      ])
    );
    expect(audit.rows.some((auditRow) => JSON.parse(auditRow.details).success === false)).toBe(true);
    const serialized = JSON.stringify(audit.rows);
    expect(serialized).not.toContain(setup.body.secret);
    expect(serialized).not.toContain('correct-password');
  });

  it('a refused write makes ENABLEMENT fail instead of reporting "MFA enabled"', async () => {
    currentUserId = await newUser();

    // Enrol normally, so the pending secret really is stored.
    const setup = await request(app).post('/api/mfa/setup').send({});
    const code = totp(setup.body.secret);

    // Only the enabling write is refused.
    const dbPromise = await import('../../utils/DbPromise.js');
    const spy = vi
      .spyOn(dbPromise, 'run')
      .mockResolvedValue({ success: false, error: 'simulated_write_failure' } as never);

    const verify = await request(app).post('/api/mfa/verify-setup').send({ token: code });

    expect(verify.status).toBe(500);
    expect(verify.body.code).toBe('MFA_ENABLE_NOT_PERSISTED');
    // Backup codes must NOT be handed out for an enrolment that did not persist.
    expect(verify.body.backupCodes).toBeUndefined();

    spy.mockRestore();

    const row = await pool.query(`SELECT enabled FROM user_mfa WHERE user_id = $1`, [
      currentUserId,
    ]);
    expect(row.rows[0].enabled).toBe(false);

    const status = await request(app).get('/api/mfa/status');
    expect(status.body.enabled).toBe(false);
  });

  it('a refused write makes enrolment FAIL instead of reporting success', async () => {
    currentUserId = await newUser();

    const dbPromise = await import('../../utils/DbPromise.js');
    const spy = vi
      .spyOn(dbPromise, 'run')
      .mockResolvedValue({ success: false, error: 'simulated_write_failure' } as never);

    const res = await request(app).post('/api/mfa/setup').send({});

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('MFA_SETUP_NOT_PERSISTED');
    expect(res.body.secret).toBeUndefined();

    spy.mockRestore();

    const row = await pool.query(`SELECT COUNT(*)::int AS n FROM user_mfa WHERE user_id = $1`, [
      currentUserId,
    ]);
    expect(row.rows[0].n).toBe(0);
  });
});
