import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, request as apiRequest, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import {
  createIdentityContext,
  createMember,
  type MywIdentity,
  writeTechnicalResult,
} from './_g4/mywTechnicalFixture';

const apiBase = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const appBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const supportKey = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const dbContainer = process.env.MYW_TECHNICAL_DB_CONTAINER || '';
const evidenceRoot = path.resolve('docs/program/evidence/closure/ui-g4/MYW-AGT-UI-CANON-001');

const surfaces = [
  { key: 'inbox', route: '/my-work?tab=inbox' },
  { key: 'tasks', route: '/my-work?tab=tasks' },
  { key: 'decisions', route: '/my-work?tab=decisions' },
  { key: 'agent', route: '/my-work?tab=agent' },
] as const;

const cells = [
  { language: 'pl', theme: 'light', viewport: { width: 1440, height: 960 } },
  { language: 'en', theme: 'dark', viewport: { width: 1440, height: 960 } },
  { language: 'pl', theme: 'dark', viewport: { width: 390, height: 844 } },
  { language: 'en', theme: 'light', viewport: { width: 390, height: 844 } },
] as const;

async function waitForBackend() {
  const ctx = await apiRequest.newContext({ baseURL: apiBase });
  try {
    await expect
      .poll(async () => (await ctx.get('/api/health/ping')).status(), { timeout: 60_000 })
      .toBe(200);
  } finally {
    await ctx.dispose();
  }
}

test.describe.serial('MYW-AGT-UI-CANON owner-free technical closure', () => {
  test.setTimeout(15 * 60_000);

  test('signed ACTIVE Member/Manager matrix, deep reload, axe and focus', async ({ browser }) => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const results: unknown[] = [];
    try {
      const invalid = await support.post('/api/test-support/member', {
        data: { runId: bootstrap.runId, role: 'ARBITRARY_OWNER' },
      });
      expect(invalid.status()).toBe(400);

      const identities: MywIdentity[] = [
        await createMember(support, bootstrap.runId, 'USER'),
        await createMember(support, bootstrap.runId, 'MANAGER'),
      ];

      for (const identity of identities) {
        const identityApi = await apiRequest.newContext({
          baseURL: apiBase,
          extraHTTPHeaders: { Authorization: `Bearer ${identity.token}` },
        });
        const onboarding = await identityApi.put('/api/preferences', {
          data: { onboarding_completed: true, onboarding_role: 'consultant' },
        });
        expect(onboarding.ok()).toBe(true);
        await identityApi.dispose();
        for (const surface of surfaces) {
          for (const cell of cells) {
            const context = await createIdentityContext(browser, appBase, identity, cell.viewport);
            const page = await context.newPage();
            await page.addInitScript(
              ({ language, theme }) => {
                localStorage.setItem('i18nextLng', language);
                localStorage.setItem('theme', theme);
                document.documentElement.classList.toggle('dark', theme === 'dark');
              },
              { language: cell.language, theme: cell.theme }
            );
            const responses: number[] = [];
            page.on('response', (response) => {
              if (/\/api\/(my-work|decisions|ai\/agent-plan|v8\/my-work)/.test(response.url())) {
                responses.push(response.status());
              }
            });
            await page.goto(surface.route, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();
            await expect
              .poll(
                async () =>
                  page.locator('[aria-busy="true"], [role="progressbar"], .animate-spin').count(),
                { timeout: 30_000 }
              )
              .toBe(0);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();

            let focus = false;
            for (let tabIndex = 0; tabIndex < 12 && !focus; tabIndex += 1) {
              await page.keyboard.press('Tab');
              await page.waitForTimeout(250);
              focus = await page.evaluate(() => {
                const active = document.activeElement as HTMLElement | null;
                if (!active || active === document.body) return false;
                const rect = active.getBoundingClientRect();
                const style = getComputedStyle(active);
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.bottom > 0 &&
                  rect.right > 0 &&
                  rect.top < innerHeight &&
                  rect.left < innerWidth &&
                  (style.outlineWidth !== '0px' || style.boxShadow !== 'none')
                );
              });
            }
            expect(focus).toBe(true);
            const axe = await new AxeBuilder({ page }).analyze();
            const blocking = axe.violations.filter((v) =>
              ['critical', 'serious'].includes(String(v.impact))
            );
            expect(blocking).toEqual([]);
            const screenshot = path.join(
              evidenceRoot,
              'screens-technical',
              `${identity.role}-${surface.key}-${cell.language}-${cell.theme}-${cell.viewport.width}.png`
            );
            await page.screenshot({ path: screenshot, fullPage: true });
            results.push({
              role: identity.role,
              surface: surface.key,
              ...cell,
              responses,
              focus,
              criticalSerious: blocking.length,
              deepReload: true,
              screenshot,
            });
            await context.close();
          }
        }
      }

      writeTechnicalResult(path.join(evidenceRoot, 'MYW_TECHNICAL_RESULT.json'), {
        productSha: execSync('git rev-parse HEAD').toString().trim(),
        e2eMode: process.env.E2E_MODE || 'false',
        signedRoles: identities.map((identity) => identity.role),
        cells: results,
      });
      expect(results).toHaveLength(32);
    } finally {
      await support.dispose();
    }
  });

  test('real database outage renders Decisions error and deterministic retry', async ({ page }) => {
    test.skip(!dbContainer, 'MYW_TECHNICAL_DB_CONTAINER is required for the real outage gate');
    const bootstrap = readTestSupportState();
    const identityApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${bootstrap.token}` },
    });
    const onboarding = await identityApi.put('/api/preferences', {
      data: { onboarding_completed: true, onboarding_role: 'consultant' },
    });
    expect(onboarding.ok()).toBe(true);
    await identityApi.dispose();
    await page.addInitScript((userId) => {
      localStorage.setItem(`consultify_onboarding_done:${userId}`, 'true');
    }, bootstrap.userId);
    await page.goto('/my-work?tab=inbox');
    await expect(page.locator('body')).toBeVisible();

    execFileSync('docker', ['pause', dbContainer]);
    try {
      await page.goto('/my-work/decisions', { waitUntil: 'domcontentloaded' });
      const alert = page.getByRole('alert');
      await expect(alert).toContainText(/Failed to load decisions|Nie udało się/i, {
        timeout: 45_000,
      });
      await expect(page.getByText(/No decisions awaiting|All caught up/i)).toHaveCount(0);
    } finally {
      execFileSync('docker', ['unpause', dbContainer]);
      await waitForBackend();
    }

    const retry = page.getByRole('button', { name: /Try again|Spróbuj ponownie/i });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(retry).toHaveCount(0, { timeout: 30_000 });
  });

  test('personal task success, idempotent replay and tenant isolation use mounted auth', async () => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const member = await createMember(support, bootstrap.runId, 'USER');
    const memberApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${member.token}` },
    });
    const foreignRunId = `${bootstrap.runId}-foreign`;
    try {
      const payload = {
        title: 'MYW mounted success task',
        status: 'todo',
        priority: 'high',
        idempotencyKey: `${bootstrap.runId}-task-once`,
      };
      const created = await memberApi.post('/api/my-work/personal-tasks', { data: payload });
      expect(created.status()).toBe(201);
      const createdBody = await created.json();
      const replay = await memberApi.post('/api/my-work/personal-tasks', { data: payload });
      expect(replay.status()).toBe(200);
      expect((await replay.json()).id).toBe(createdBody.id);

      const foreignBootstrap = await support.post('/api/test-support/bootstrap', {
        data: { runId: foreignRunId, role: 'ADMIN' },
      });
      expect(foreignBootstrap.ok()).toBe(true);
      const foreign = (await foreignBootstrap.json()) as MywIdentity;
      const foreignApi = await apiRequest.newContext({
        baseURL: apiBase,
        extraHTTPHeaders: { Authorization: `Bearer ${foreign.token}` },
      });
      const foreignRead = await foreignApi.get(`/api/my-work/personal-tasks/${createdBody.id}`);
      expect([403, 404]).toContain(foreignRead.status());
      await foreignApi.dispose();

      const unsigned = await apiRequest.newContext({ baseURL: apiBase });
      expect((await unsigned.get('/api/my-work/personal-tasks')).status()).toBe(401);
      await unsigned.dispose();
    } finally {
      await support.post('/api/test-support/cleanup', { data: { runId: foreignRunId } });
      await memberApi.dispose();
      await support.dispose();
    }
  });
});
