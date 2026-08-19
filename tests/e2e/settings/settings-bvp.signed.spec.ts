import { randomUUID } from 'node:crypto';

import { expect, request as playwrightRequest, test } from '@playwright/test';
import { Pool } from 'pg';

import { getPrivilegedSession, testSupportKey } from '../_helpers/privilegedSession';
import { injectSession } from '../m06/_m06';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

type PreferenceRow = { key: string; value: string };

test.describe('SET-BVP mounted signed persistence', () => {
  test.setTimeout(240_000);

  test('persists personal settings through a cold signed context and denies foreign/revoked writes', async ({
    browser,
    page,
  }) => {
    const databaseUrl = String(process.env.DATABASE_URL || '');
    const databasePrefix = String(process.env.SET_BVP_DISPOSABLE_DB_PREFIX || '');
    expect(databaseUrl, 'DATABASE_URL is required').toBeTruthy();
    expect(databasePrefix).toBe('set_bvp_');

    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const client = await pool.connect();
    const fixtureApi = await playwrightRequest.newContext({ baseURL: API });
    const runId = `set-bvp-${randomUUID().slice(0, 8)}`;
    const foreignRunId = `${runId}-foreign`;
    const session = await getPrivilegedSession(fixtureApi, {
      role: 'ADMIN',
      runId,
      apiBaseUrl: API,
    });
    let foreignUserId = '';
    let foreignOrganizationId = '';
    let revokedUserId = '';
    let suiteLockHeld = false;
    let coldContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

    const supportHeaders = {
      'x-test-support-key': testSupportKey(),
      'content-type': 'application/json',
    };
    const authHeaders = {
      Authorization: `Bearer ${session.token}`,
      'content-type': 'application/json',
    };
    const inject = (target: typeof page) =>
      injectSession(target, {
        token: session.token,
        user: {
          id: session.userId,
          email: session.email,
          role: session.role,
          organizationId: session.organizationId,
        },
      });
    const preferences = async () =>
      (
        await client.query<PreferenceRow>(
          `SELECT key,value FROM user_preferences WHERE user_id=$1 ORDER BY key`,
          [session.userId]
        )
      ).rows;

    try {
      const databaseName = (
        await client.query<{ current_database: string }>(`SELECT current_database()`)
      ).rows[0]!.current_database;
      expect(databaseName).toBe(decodeURIComponent(new URL(databaseUrl).pathname.slice(1)));
      expect(databaseName.startsWith(databasePrefix)).toBe(true);
      await client.query(`SELECT pg_advisory_lock(hashtext('SET-BVP-001'))`);
      suiteLockHeld = true;

      await inject(page);
      await page.goto('/settings/profile');
      await dismissOverlayIfPresent(page);
      const firstName = `Settings${runId.slice(-8)}`;
      const jobTitle = `SET BVP ${runId}`;
      await page.getByLabel('First Name').fill(firstName);
      await page.getByPlaceholder(/Product Manager, Developer/i).fill(jobTitle);
      const profileWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/users/${session.userId}`)
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      expect((await profileWrite).status()).toBe(200);
      await expect(page.getByText('Saved!', { exact: true })).toBeVisible();

      await page.goto('/settings/theme');
      await dismissOverlayIfPresent(page);
      await expect(page.getByRole('heading', { name: 'Theme & Appearance' })).toBeVisible();
      await page.getByRole('button', { name: /Dark/i }).click();
      const appearanceWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes('/api/settings/preferences/appearance')
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      expect((await appearanceWrite).status()).toBe(200);
      await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();

      await page.goto('/settings/notifications-overview');
      await dismissOverlayIfPresent(page);
      await expect(page.getByRole('heading', { name: 'Notification Preferences' })).toBeVisible();
      await page.getByRole('button', { name: 'Minimal' }).click();
      const notificationWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes('/api/settings/preferences/notifications')
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      expect((await notificationWrite).status()).toBe(200);
      await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();

      await page.goto('/settings/ai-behavior');
      await dismissOverlayIfPresent(page);
      await expect(page.getByRole('heading', { name: 'AI Behavior & Instructions' })).toBeVisible();
      await page.getByRole('button', { name: 'Detailed', exact: true }).click();
      const toneSelect = page.getByText('Tone', { exact: true }).locator('..').locator('select');
      await toneSelect.selectOption('friendly');
      const aiWrites: number[] = [];
      page.on('response', (response) => {
        if (
          response.request().method() === 'PUT' &&
          response.url().includes('/api/ai-settings/user')
        ) {
          aiWrites.push(response.status());
        }
      });
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect.poll(() => aiWrites.length).toBe(2);
      expect(aiWrites).toEqual([200, 200]);
      await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();

      await page.goto('/settings/language');
      await dismissOverlayIfPresent(page);
      const languageWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/users/${session.userId}`)
      );
      await page.getByRole('button', { name: /Polski/i }).click();
      expect((await languageWrite).status()).toBe(200);

      const primarySnapshot = await client.query<{
        first_name: string;
        job_title: string;
        language: string;
        ai_rows: number;
      }>(
        `SELECT u.first_name,u.job_title,u.language,
          (SELECT count(*)::int FROM user_ai_settings a WHERE a.user_id=u.id) ai_rows
         FROM users u WHERE u.id=$1`,
        [session.userId]
      );
      expect(primarySnapshot.rows[0]).toEqual({
        first_name: firstName,
        job_title: jobTitle,
        language: 'pl',
        ai_rows: 1,
      });
      const preferenceRows = await preferences();
      expect(preferenceRows.map((row) => row.key)).toEqual(
        expect.arrayContaining(['settings:appearance', 'settings:notifications'])
      );
      const notificationPreference = preferenceRows.find(
        (row) => row.key === 'settings:notifications'
      );
      expect(JSON.parse(String(notificationPreference?.value || '{}'))).toEqual({
        taskAssignment: { email: false, inApp: true },
        taskUpdates: { email: false, inApp: false },
        milestones: { email: false, inApp: true },
        mentions: { email: true, inApp: true },
      });

      coldContext = await browser.newContext();
      const coldPage = await coldContext.newPage();
      await inject(coldPage);
      await coldPage.goto('/settings/profile');
      await dismissOverlayIfPresent(coldPage);
      await expect(coldPage.getByLabel(/First Name|Imię/i)).toHaveValue(firstName);
      await expect(coldPage.getByPlaceholder(/Product Manager|Menedżer produktu/i)).toHaveValue(
        jobTitle
      );
      await coldPage.goto('/settings/theme');
      await expect(coldPage.getByRole('button', { name: /Dark|Ciemny/i })).toBeVisible();
      await coldPage.goto('/settings/notifications-overview');
      await expect(
        coldPage.getByRole('heading', { name: /Notification Preferences|Preferencje powiadomień/i })
      ).toBeVisible();
      await coldPage.goto('/settings/ai-behavior');
      await expect(
        coldPage.getByRole('heading', { name: /AI Behavior & Instructions|Zachowanie AI/i })
      ).toBeVisible();

      const me = await fixtureApi.get('/api/auth/me', { headers: authHeaders });
      expect(me.status()).toBe(200);
      expect(await me.json()).toMatchObject({
        user: {
          firstName,
          jobTitle,
          language: 'pl',
        },
      });
      const appearance = await fixtureApi.get('/api/settings/preferences/appearance', {
        headers: authHeaders,
      });
      expect(appearance.status()).toBe(200);
      expect(await appearance.json()).toMatchObject({ preferences: { theme: 'dark' } });
      const notifications = await fixtureApi.get('/api/settings/preferences/notifications', {
        headers: authHeaders,
      });
      expect(notifications.status()).toBe(200);
      expect(await notifications.json()).toEqual({
        preferences: {
          taskAssignment: { email: false, inApp: true },
          taskUpdates: { email: false, inApp: false },
          milestones: { email: false, inApp: true },
          mentions: { email: true, inApp: true },
        },
      });
      const ai = await fixtureApi.get('/api/ai-settings/user', { headers: authHeaders });
      expect(ai.status()).toBe(200);
      expect(await ai.json()).toMatchObject({
        response_style: 'detailed',
        writing_tone: 'friendly',
      });

      const foreign = await fixtureApi.post('/api/test-support/bootstrap', {
        headers: supportHeaders,
        data: { runId: foreignRunId, role: 'ADMIN' },
      });
      expect([200, 201]).toContain(foreign.status());
      const foreignPersona = (await foreign.json()) as {
        organizationId: string;
        userId: string;
        token: string;
      };
      foreignUserId = foreignPersona.userId;
      foreignOrganizationId = foreignPersona.organizationId;
      const foreignWrite = await fixtureApi.put(`/api/users/${session.userId}`, {
        headers: {
          Authorization: `Bearer ${foreignPersona.token}`,
          'content-type': 'application/json',
        },
        data: { firstName: 'ForeignDenied' },
      });
      expect(foreignWrite.status()).toBe(403);

      const revoked = await fixtureApi.post('/api/test-support/member', {
        headers: supportHeaders,
        data: { runId, role: 'USER' },
      });
      expect(revoked.status()).toBe(201);
      const revokedPersona = (await revoked.json()) as { userId: string; token: string };
      revokedUserId = revokedPersona.userId;
      await client.query(
        `UPDATE organization_members SET status='REVOKED'
          WHERE organization_id=$1 AND user_id=$2`,
        [session.organizationId, revokedUserId]
      );
      const revokedAuth = {
        Authorization: `Bearer ${revokedPersona.token}`,
        'content-type': 'application/json',
      };
      const revokedSnapshot = async () =>
        (
          await client.query<{
            user_bytes: string;
            preference_bytes: string;
            preference_count: number;
            ai_bytes: string;
            ai_count: number;
          }>(
            `SELECT
              (SELECT row_to_json(u)::text FROM users u WHERE u.id=$1) user_bytes,
              COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.key)::text
                FROM user_preferences p WHERE p.user_id=$1),'[]') preference_bytes,
              (SELECT count(*)::int FROM user_preferences p WHERE p.user_id=$1) preference_count,
              COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.user_id)::text
                FROM user_ai_settings a WHERE a.user_id=$1),'[]') ai_bytes,
              (SELECT count(*)::int FROM user_ai_settings a WHERE a.user_id=$1) ai_count`,
            [revokedUserId]
          )
        ).rows[0]!;
      const revokedBefore = await revokedSnapshot();
      const revokedWrites = await Promise.all([
        fixtureApi.put(`/api/users/${revokedUserId}`, {
          headers: revokedAuth,
          data: { firstName: 'RevokedDenied', language: 'en' },
        }),
        fixtureApi.put('/api/settings/preferences/appearance', {
          headers: revokedAuth,
          data: { theme: 'light' },
        }),
        fixtureApi.put('/api/settings/preferences/notifications', {
          headers: revokedAuth,
          data: { preferences: { email: true } },
        }),
        fixtureApi.put('/api/ai-settings/user', {
          headers: revokedAuth,
          data: { writing_tone: 'casual' },
        }),
      ]);
      const revokedWriteNames = ['profile', 'appearance', 'notifications', 'ai'];
      for (const [index, response] of revokedWrites.entries()) {
        expect(response.status(), revokedWriteNames[index]).toBe(403);
        expect(await response.json()).toEqual({
          success: false,
          code: 'ORG_MEMBERSHIP_REVOKED',
        });
      }
      expect(await revokedSnapshot()).toEqual(revokedBefore);
      expect(await preferences()).toEqual(preferenceRows);
      expect(
        (
          await client.query<{ first_name: string }>(`SELECT first_name FROM users WHERE id=$1`, [
            session.userId,
          ])
        ).rows[0]!.first_name
      ).toBe(firstName);
    } finally {
      await coldContext?.close().catch(() => undefined);
      for (const cleanupRunId of [foreignRunId, runId]) {
        const cleanup = await fixtureApi.post('/api/test-support/cleanup', {
          headers: supportHeaders,
          data: { runId: cleanupRunId },
        });
        expect(cleanup.status(), await cleanup.text()).toBe(200);
      }
      if (suiteLockHeld) {
        expect(
          (
            await client.query<{ unlocked: boolean }>(
              `SELECT pg_advisory_unlock(hashtext('SET-BVP-001')) unlocked`
            )
          ).rows[0]!.unlocked
        ).toBe(true);
      }
      const residue = await client.query<{ n: number }>(
        `SELECT
          (SELECT count(*) FROM users WHERE id=ANY($1)) +
          (SELECT count(*) FROM organizations WHERE id=ANY($2)) +
          (SELECT count(*) FROM user_preferences WHERE user_id=ANY($1)) +
          (SELECT count(*) FROM user_ai_settings WHERE user_id=ANY($1)) AS n`,
        [
          [session.userId, foreignUserId, revokedUserId].filter(Boolean),
          [session.organizationId, foreignOrganizationId].filter(Boolean),
        ]
      );
      expect(Number(residue.rows[0]!.n)).toBe(0);
      expect(
        Number(
          (
            await client.query<{ n: number }>(
              `SELECT count(*) n FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
                WHERE a.datname=current_database() AND l.locktype='advisory'`
            )
          ).rows[0]!.n
        )
      ).toBe(0);
      await fixtureApi.dispose();
      client.release();
      await pool.end();
    }
  });
});
