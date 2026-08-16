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
    service = (await import('../MFAService.js')).default;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]);
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
});
