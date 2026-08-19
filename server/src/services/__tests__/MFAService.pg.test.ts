import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('../MFAService.js');

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_DB) process.env.DB_TYPE = 'postgres';

function totp(secret: string): string {
  const time = Math.floor(Date.now() / 1000 / 30);
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

describe.skipIf(!REAL_DB)('MFAService login enforcement — real PostgreSQL', () => {
  let pool: import('pg').Pool;
  let service: typeof import('../MFAService.js').default;
  const orgId = `org-mfa-service-${randomUUID()}`;
  const userId = `user-mfa-service-${randomUUID()}`;
  const secret = crypto
    .randomBytes(20)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 32);

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(
      `INSERT INTO organizations (id, mfa_required, mfa_grace_period_days) VALUES ($1, 1, 7)`,
      [orgId]
    );
    await pool.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await pool.query(
      `INSERT INTO user_mfa (user_id, secret, enabled, method) VALUES ($1, $2, true, 'totp')`,
      [userId, secret]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`,
      [randomUUID(), orgId, userId]
    );
    service = (await import('../MFAService.js')).default;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM organization_members WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM user_mfa WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  it('reads factor and tenant enforcement from DB and accepts only a valid TOTP', async () => {
    expect(await service.getMFAStatus(userId)).toMatchObject({
      enabled: true,
      enforced: true,
      methods: ['totp'],
    });
    expect((await service.verifyTOTP(userId, '000000', '127.0.0.1', 'test')).success).toBe(false);
    expect((await service.verifyTOTP(userId, totp(secret), '127.0.0.1', 'test')).success).toBe(
      true
    );
    const audit = await pool.query(
      `SELECT details FROM audit_logs WHERE user_id = $1 AND action_type = 'security.mfa.challenge' ORDER BY created_at`,
      [userId]
    );
    expect(audit.rows.map((row) => JSON.parse(row.details).success)).toEqual([false, true]);
  });

  it('persists trusted devices for 30 days and fails closed after expiry', async () => {
    const fingerprint = `browser-${randomUUID()}`;
    expect(await service.isDeviceTrusted(orgId, userId, fingerprint)).toBe(false);
    await expect(service.trustDevice(orgId, userId, fingerprint, 'Signed Chromium')).resolves.toEqual({
      success: true,
    });
    expect(await service.isDeviceTrusted(orgId, userId, fingerprint)).toBe(true);

    const stored = await pool.query<{
      device_name: string;
      expires_at: Date;
      last_used_at: Date;
    }>(
      `SELECT device_name, expires_at, last_used_at
         FROM trusted_devices
        WHERE user_id=$1 AND credential_hash=encode(digest($2, 'sha256'), 'hex')`,
      [userId, fingerprint]
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]!.device_name).toBe('Signed Chromium');
    expect(stored.rows[0]!.expires_at.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
    expect(stored.rows[0]!.last_used_at).toBeTruthy();

    await pool.query(
      `UPDATE trusted_devices SET expires_at=NOW() - INTERVAL '1 second'
        WHERE user_id=$1 AND credential_hash=encode(digest($2, 'sha256'), 'hex')`,
      [userId, fingerprint]
    );
    expect(await service.isDeviceTrusted(orgId, userId, fingerprint)).toBe(false);
  });

  it('atomically budgets and consumes a tenant-bound login challenge', async () => {
    const challenge = await service.createLoginChallenge(orgId, userId, '127.0.0.1', 'browser-a');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(
        await service.verifyLoginChallenge(
          challenge,
          '000000',
          undefined,
          false,
          '127.0.0.1',
          'browser-a'
        )
      ).toMatchObject({ success: false, code: 'MFA_INVALID_CODE' });
    }
    const final = await service.verifyLoginChallenge(
      challenge,
      totp(secret),
      undefined,
      false,
      '127.0.0.1',
      'browser-a'
    );
    expect(final).toMatchObject({ success: true, userId, organizationId: orgId });
    expect(
      await service.verifyLoginChallenge(
        challenge,
        totp(secret),
        undefined,
        false,
        '127.0.0.1',
        'browser-a'
      )
    ).toMatchObject({ success: false, code: 'MFA_CHALLENGE_INVALID' });

    const concurrent = await service.createLoginChallenge(
      orgId,
      userId,
      '127.0.0.1',
      'browser-concurrent'
    );
    const outcomes = await Promise.all(
      Array.from({ length: 3 }, () =>
        service.verifyLoginChallenge(
          concurrent,
          totp(secret),
          undefined,
          false,
          '127.0.0.1',
          'browser-concurrent'
        )
      )
    );
    expect(outcomes.filter((outcome) => outcome.success)).toHaveLength(1);
  });

  it('revokes trust and outstanding challenges on factor rotation', async () => {
    const credential = `rotate-${randomUUID()}`;
    await service.trustDevice(orgId, userId, credential, 'Rotating browser');
    await service.createLoginChallenge(orgId, userId, '127.0.0.1', 'browser-b');
    await pool.query(
      `UPDATE user_mfa SET factor_generation=factor_generation+1 WHERE user_id=$1`,
      [userId]
    );
    expect(await service.isDeviceTrusted(orgId, userId, credential)).toBe(false);
    expect(
      Number((await pool.query(`SELECT COUNT(*) count FROM mfa_login_challenges WHERE user_id=$1`, [userId])).rows[0].count)
    ).toBe(0);
  });
});
