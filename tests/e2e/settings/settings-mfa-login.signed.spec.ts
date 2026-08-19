import crypto from 'node:crypto';

import { expect, request as playwrightRequest, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import pg from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const PASSWORD = 'Mfa-Login-Browser-Password1!';

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

async function clearBrowserSession(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    for (const key of ['token', 'refreshToken', 'user', 'consultify-storage']) {
      localStorage.removeItem(key);
    }
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByTestId('email-input')).toBeVisible();
}

async function enterPassword(
  page: import('@playwright/test').Page,
  email: string,
  password = PASSWORD
) {
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' && candidate.url().endsWith('/api/auth/login')
  );
  await page.getByTestId('login-button').click();
  return response;
}

test.describe('SET-MVP-MFA signed browser login and revocation matrix', () => {
  test.setTimeout(240_000);

  test('challenges, retries, trusts, revokes and cold-retries without a partial session', async ({
    browser,
    page,
  }) => {
    const databaseUrl = String(process.env.DATABASE_URL || '');
    expect(databaseUrl).toBeTruthy();
    const state = readTestSupportState();
    const email = `e2e+${state.runId}@local.test`;
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    const client = await pool.connect();
    const api = await playwrightRequest.newContext({ baseURL: API });
    const originalPassword = String(
      (
        await client.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [
          state.userId,
        ])
      ).rows[0]!.password
    );
    let secret = '';

    try {
      await client.query('UPDATE users SET password=$2 WHERE id=$1', [
        state.userId,
        bcrypt.hashSync(PASSWORD, 8),
      ]);
      const setup = await api.post('/api/mfa/setup', { headers: getAuthHeader(), data: {} });
      expect(setup.status()).toBe(200);
      secret = String(((await setup.json()) as { secret: string }).secret);
      const enable = await api.post('/api/mfa/verify-setup', {
        headers: getAuthHeader(),
        data: { token: totp(secret) },
      });
      expect(enable.status()).toBe(200);

      // Password alone reaches an MFA challenge and must not mint/store a token.
      await clearBrowserSession(page);
      const passwordResponse = await enterPassword(page, email);
      expect(passwordResponse.status()).toBe(200);
      expect(await passwordResponse.json()).toMatchObject({ mfaRequired: true });
      await expect(page.getByTestId('login-mfa-challenge')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

      // Invalid MFA remains retryable and does not create a partial session.
      await page.getByLabel('Authentication code').fill('000000');
      const invalidResponse = page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && candidate.url().endsWith('/api/auth/login')
      );
      await page.getByRole('button', { name: 'Verify' }).click();
      expect((await invalidResponse).status()).toBe(401);
      await expect(page.getByRole('alert')).toContainText(/invalid or expired/i);
      await expect(page.getByTestId('login-mfa-challenge')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

      // Current TOTP completes login; trust-device is bound to this browser fingerprint.
      await page.getByLabel(/Trust this device/i).check();
      await page.getByLabel('Authentication code').fill(totp(secret));
      const validResponse = page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && candidate.url().endsWith('/api/auth/login')
      );
      await page.getByRole('button', { name: 'Verify' }).click();
      expect((await validResponse).status()).toBe(200);
      await expect
        .poll(() => page.evaluate(() => Boolean(localStorage.getItem('token'))))
        .toBe(true);

      // Same browser can use the trusted-device decision; no MFA challenge is rendered.
      await clearBrowserSession(page);
      const trustedResponse = await enterPassword(page, email);
      expect(trustedResponse.status()).toBe(200);
      expect((await trustedResponse.json()) as object).toHaveProperty('token');
      await expect(page.getByTestId('login-mfa-challenge')).toHaveCount(0);

      // A different browser is challenged. Revocation between password and MFA
      // is authoritative on the second login call and cannot mint a session.
      const revokedContext = await browser.newContext();
      const revokedPage = await revokedContext.newPage();
      try {
        await clearBrowserSession(revokedPage);
        expect((await enterPassword(revokedPage, email)).status()).toBe(200);
        await expect(revokedPage.getByTestId('login-mfa-challenge')).toBeVisible();
        await client.query(
          `UPDATE organization_members SET status='REVOKED'
            WHERE organization_id=$1 AND user_id=$2`,
          [state.organizationId, state.userId]
        );
        await revokedPage.getByLabel('Authentication code').fill(totp(secret));
        const revokedResponse = revokedPage.waitForResponse(
          (candidate) =>
            candidate.request().method() === 'POST' && candidate.url().endsWith('/api/auth/login')
        );
        await revokedPage.getByRole('button', { name: 'Verify' }).click();
        const denied = await revokedResponse;
        expect(denied.status()).toBe(403);
        expect(await denied.json()).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        await expect(revokedPage.getByRole('alert')).toContainText(/access.*revoked/i);
        expect(await revokedPage.evaluate(() => localStorage.getItem('token'))).toBeNull();

        // Restoring membership makes a deliberate user retry possible; no stale
        // challenge state or previous denial is treated as success.
        await client.query(
          `UPDATE organization_members SET status='ACTIVE'
            WHERE organization_id=$1 AND user_id=$2`,
          [state.organizationId, state.userId]
        );
        expect((await enterPassword(revokedPage, email)).status()).toBe(200);
        await expect(revokedPage.getByTestId('login-mfa-challenge')).toBeVisible();
        await revokedPage.getByLabel('Authentication code').fill(totp(secret));
        const retryResponse = revokedPage.waitForResponse(
          (candidate) =>
            candidate.request().method() === 'POST' && candidate.url().endsWith('/api/auth/login')
        );
        await revokedPage.getByRole('button', { name: 'Verify' }).click();
        expect((await retryResponse).status()).toBe(200);
        await expect
          .poll(() => revokedPage.evaluate(() => Boolean(localStorage.getItem('token'))))
          .toBe(true);
      } finally {
        await revokedContext.close();
      }
    } finally {
      await client.query(
        `UPDATE organization_members SET status='ACTIVE'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      await client.query('DELETE FROM user_mfa WHERE user_id=$1', [state.userId]);
      await client.query('DELETE FROM trusted_devices WHERE user_id=$1', [state.userId]);
      await client.query(
        `DELETE FROM audit_logs WHERE user_id=$1 AND action_type LIKE 'security.mfa.%'`,
        [state.userId]
      );
      await client.query('UPDATE users SET password=$2 WHERE id=$1', [
        state.userId,
        originalPassword,
      ]);
      await api.dispose();
      client.release();
      await pool.end();
    }
  });
});
