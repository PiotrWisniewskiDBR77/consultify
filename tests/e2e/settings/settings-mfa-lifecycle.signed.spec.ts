import crypto from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import pg from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const PASSWORD = 'Mfa-Lifecycle-Password1!';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

function totp(secret: string, window = 0): string {
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  const bytes = Buffer.alloc(8);
  bytes.writeBigInt64BE(BigInt(time));
  hmac.update(bytes);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1]! & 0xf;
  const code =
    (((hash[offset]! & 0x7f) << 24) |
      (hash[offset + 1]! << 16) |
      (hash[offset + 2]! << 8) |
      hash[offset + 3]!) %
    1_000_000;
  return String(code).padStart(6, '0');
}

test.describe('SET-MVP-MFA mounted signed lifecycle', () => {
  test.setTimeout(180_000);

  test('enrols, recovers, regenerates, revokes and disables without secret leakage', async ({
    page,
    request,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    const allowedPrefix = process.env.SET_MFA_DISPOSABLE_DB_PREFIX;
    expect(databaseUrl, 'DATABASE_URL is required').toBeTruthy();
    expect(allowedPrefix, 'SET_MFA_DISPOSABLE_DB_PREFIX is required').toBeTruthy();
    const state = readTestSupportState();
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    const client = await pool.connect();
    let locked = false;
    const auth = getAuthHeader();
    const foreignRunId = `set-mfa-foreign-${crypto.randomUUID()}`;
    const superRunId = `set-mfa-super-${crypto.randomUUID()}`;
    let foreignToken = '';
    let foreignOrganizationId = '';
    let foreignUserId = '';
    let superToken = '';
    let superOrganizationId = '';
    let superUserId = '';
    let originalPassword = '';

    const snapshot = async () => {
      const result = await client.query<{ mfa: number; audits: number }>(
        `SELECT
          (SELECT count(*)::int FROM user_mfa WHERE user_id=$1) mfa,
          (SELECT count(*)::int FROM audit_logs
            WHERE user_id=$1 AND action_type LIKE 'security.mfa.%') audits`,
        [state.userId]
      );
      return result.rows[0]!;
    };

    try {
      const dbName = (await client.query<{ current_database: string }>('SELECT current_database()'))
        .rows[0]!.current_database;
      const callerDatabase = decodeURIComponent(new URL(String(databaseUrl)).pathname.slice(1));
      expect(allowedPrefix).toBe('set_mfa_');
      expect(dbName).toBe(callerDatabase);
      expect(dbName).toMatch(/^set_mfa_/);
      await client.query(`SELECT pg_advisory_lock(hashtext('SET-MVP-MFA-001'))`);
      locked = true;
      expect(await snapshot()).toEqual({ mfa: 0, audits: 0 });
      originalPassword = String(
        (
          await client.query<{ password: string }>(`SELECT password FROM users WHERE id=$1`, [
            state.userId,
          ])
        ).rows[0]!.password
      );
      await client.query(`UPDATE users SET password=$2 WHERE id=$1`, [
        state.userId,
        bcrypt.hashSync(PASSWORD, 8),
      ]);

      expect((await request.get(`${API}/api/mfa/status`)).status()).toBe(401);
      const setup = await request.post(`${API}/api/mfa/setup`, {
        headers: auth,
        data: {},
      });
      expect(setup.status()).toBe(200);
      const setupBody = (await setup.json()) as {
        secret: string;
        otpauthUrl: string;
      };
      expect(setupBody.secret).toMatch(/^[A-Za-z0-9]{20,32}$/);
      expect(setupBody.otpauthUrl).toContain('otpauth://totp/Consultify:');

      const enabled = await request.post(`${API}/api/mfa/verify-setup`, {
        headers: auth,
        data: { token: totp(setupBody.secret) },
      });
      expect(enabled.status()).toBe(200);
      const originalCodes = ((await enabled.json()) as { backupCodes: string[] }).backupCodes;
      expect(originalCodes).toHaveLength(10);

      const recovery = await request.post(`${API}/api/mfa/verify`, {
        headers: auth,
        data: { token: originalCodes[0], isBackupCode: true },
      });
      expect(recovery.status()).toBe(200);
      expect(
        (
          await request.post(`${API}/api/mfa/verify`, {
            headers: auth,
            data: { token: originalCodes[0], isBackupCode: true },
          })
        ).status()
      ).toBe(401);

      const regenerated = await request.post(`${API}/api/mfa/regenerate-backup-codes`, {
        headers: auth,
        data: { token: totp(setupBody.secret) },
      });
      expect(regenerated.status()).toBe(200);
      const regeneratedCodes = ((await regenerated.json()) as { backupCodes: string[] })
        .backupCodes;
      expect(regeneratedCodes).toHaveLength(10);
      expect(regeneratedCodes).not.toEqual(originalCodes);

      const foreignBootstrap = await request.post(`${API}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: foreignRunId, role: 'USER' },
      });
      expect(foreignBootstrap.status()).toBe(200);
      const foreign = (await foreignBootstrap.json()) as {
        token: string; organizationId: string; userId: string;
      };
      foreignToken = String(foreign.token || '');
      foreignOrganizationId = String(foreign.organizationId || '');
      foreignUserId = String(foreign.userId || '');
      const foreignStatus = await request.get(`${API}/api/mfa/status`, {
        headers: { Authorization: `Bearer ${foreignToken}` },
      });
      expect(foreignStatus.status()).toBe(200);
      expect(await foreignStatus.json()).toMatchObject({ enabled: false });
      expect(await snapshot()).toMatchObject({ mfa: 1 });
      await client.query(
        `UPDATE organization_members SET status='REVOKED'
          WHERE organization_id=$1 AND user_id=$2`,
        [foreignOrganizationId, foreignUserId]
      );
      const beforeForeignRevoked = await snapshot();
      expect(
        (await request.get(`${API}/api/mfa/status`, {
          headers: { Authorization: `Bearer ${foreignToken}` },
        })).status()
      ).toBe(403);
      expect(await snapshot()).toEqual(beforeForeignRevoked);
      await client.query(
        `UPDATE organization_members SET status='ACTIVE'
          WHERE organization_id=$1 AND user_id=$2`,
        [foreignOrganizationId, foreignUserId]
      );

      const superBootstrap = await request.post(`${API}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: superRunId, role: 'SUPERADMIN' },
      });
      expect(superBootstrap.status()).toBe(200);
      const superAdmin = (await superBootstrap.json()) as {
        token: string; organizationId: string; userId: string;
      };
      superToken = String(superAdmin.token || '');
      superOrganizationId = String(superAdmin.organizationId || '');
      superUserId = String(superAdmin.userId || '');
      await client.query(
        `DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2`,
        [superOrganizationId, superUserId]
      );
      const ownerBeforeSuper = await snapshot();
      const superSetup = await request.post(`${API}/api/mfa/setup`, {
        headers: { Authorization: `Bearer ${superToken}` },
        data: { userId: state.userId, organizationId: state.organizationId },
      });
      expect(superSetup.status()).toBe(200);
      expect(
        Number((await client.query(`SELECT count(*)::int count FROM user_mfa WHERE user_id=$1`, [superUserId])).rows[0].count)
      ).toBe(1);
      expect(await snapshot()).toEqual(ownerBeforeSuper);

      await page.goto('/settings/security');
      await dismissOverlayIfPresent(page);
      await page.getByRole('button', { name: /Authentication & Access/i }).click();
      await expect(
        page.getByRole('heading', { name: /Authentication & Access/i }).first()
      ).toBeVisible();
      await page.getByRole('button', { name: /Two-Factor Authentication/i }).click();
      await expect(
        page.getByText(/Two-Factor Authentication Active|Uwierzytelnianie/i).first()
      ).toBeVisible();
      const axe = await new AxeBuilder({ page })
        .include('[data-testid="mfa-setup"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        axe.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
      ).toEqual([]);

      await client.query(
        `UPDATE organization_members SET status='REVOKED'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      const beforeRevoked = await snapshot();
      for (const denied of [
        await request.get(`${API}/api/mfa/status`, { headers: auth }),
        await request.post(`${API}/api/mfa/regenerate-backup-codes`, {
          headers: auth,
          data: { token: totp(setupBody.secret) },
        }),
        await request.post(`${API}/api/mfa/disable`, {
          headers: auth,
          data: { token: totp(setupBody.secret), password: PASSWORD },
        }),
      ]) {
        expect(denied.status()).toBe(403);
        expect(await denied.json()).toMatchObject({
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
      }
      expect(await snapshot()).toEqual(beforeRevoked);

      await client.query(
        `UPDATE organization_members SET status='ACTIVE'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      const disabled = await request.post(`${API}/api/mfa/disable`, {
        headers: auth,
        data: { token: totp(setupBody.secret), password: PASSWORD },
      });
      expect(disabled.status()).toBe(200);

      const persisted = await client.query<{
        enabled: boolean;
        secret: string | null;
      }>(`SELECT enabled,secret FROM user_mfa WHERE user_id=$1`, [state.userId]);
      expect(persisted.rows[0]).toMatchObject({ enabled: false, secret: null });
      const audits = await client.query<{ details: string }>(
        `SELECT details FROM audit_logs
          WHERE user_id=$1 AND action_type LIKE 'security.mfa.%'`,
        [state.userId]
      );
      const serialized = JSON.stringify(audits.rows);
      expect(serialized).not.toContain(setupBody.secret);
      expect(serialized).not.toContain(PASSWORD);
      for (const code of [...originalCodes, ...regeneratedCodes]) {
        expect(serialized).not.toContain(code);
      }
    } finally {
      let databaseCleanupError: unknown;
      try {
        await client.query('BEGIN');
        try {
          await client.query(
            `DELETE FROM audit_logs WHERE user_id=$1 AND action_type LIKE 'security.mfa.%'`,
            [state.userId]
          );
          await client.query(`DELETE FROM user_mfa WHERE user_id=$1`, [state.userId]);
          if (superUserId) {
            await client.query(
              `DELETE FROM audit_logs WHERE user_id=$1 AND action_type LIKE 'security.mfa.%'`,
              [superUserId]
            );
            await client.query(`DELETE FROM user_mfa WHERE user_id=$1`, [superUserId]);
          }
          if (originalPassword) {
            await client.query(`UPDATE users SET password=$2 WHERE id=$1`, [
              state.userId,
              originalPassword,
            ]);
          }
          await client.query(
            `UPDATE organization_members SET status='ACTIVE'
              WHERE organization_id=$1 AND user_id=$2`,
            [state.organizationId, state.userId]
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
        expect(await snapshot()).toEqual({ mfa: 0, audits: 0 });
      } catch (error) {
        databaseCleanupError = error;
      }
      try {
        for (const [token, runId] of [[foreignToken, foreignRunId], [superToken, superRunId]]) {
          if (!token) continue;
          const cleanup = await request.post(`${API}/api/test-support/cleanup`, {
            headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
            data: { runId },
          });
          expect(cleanup.status()).toBe(200);
        }
      } finally {
        try {
          if (locked) {
            const unlocked = await client.query<{ unlocked: boolean }>(
              `SELECT pg_advisory_unlock(hashtext('SET-MVP-MFA-001')) unlocked`
            );
            expect(unlocked.rows[0]!.unlocked).toBe(true);
            locked = false;
          }
          const ownLocks = await client.query<{ count: number }>(
            `SELECT count(*)::int count FROM pg_locks
              WHERE pid=pg_backend_pid() AND locktype='advisory'`
          );
          expect(ownLocks.rows[0]!.count).toBe(0);
        } finally {
          client.release();
          await pool.end();
        }
      }
      if (databaseCleanupError) throw databaseCleanupError;
    }
  });
});
