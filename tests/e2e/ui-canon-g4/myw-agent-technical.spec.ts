import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, request as apiRequest, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import {
  assertVisibleAndUncovered,
  createIdentityContext,
  createMember,
  type MywIdentity,
  type MywSeed,
  mywSeedTitles,
  seedMywSurfaces,
  writeTechnicalResult,
} from './_g4/mywTechnicalFixture';

const apiBase = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const appBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const supportKey = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const dbContainer = process.env.MYW_TECHNICAL_DB_CONTAINER || '';
/**
 * Current-SHA observations are written to their OWN directory, never on top of
 * `closure/ui-g4/.../screens-technical`. That historical set belongs to
 * candidateSha c2cced7e93 and every one of its 32 files has a sha256 recorded in
 * SCREENS_TECHNICAL_SHA256.txt — overwriting the bytes would silently invalidate
 * that manifest and destroy the record of what the original run actually saw.
 * The two sets stand side by side as two observations.
 */
const currentScreensRoot = path.resolve(
  'docs/program/evidence/closure/b/MYW-AGT-UI-CANON-001/screens-current-4f0fd2cd9b'
);

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
              currentScreensRoot,
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

      // Also a NEW path: the historical MYW_TECHNICAL_RESULT.json is the sealed
      // result for candidateSha c2cced7e93 and is referenced by the authority's
      // technicalPacket.resultPath. It is not ours to rewrite.
      writeTechnicalResult(path.join(currentScreensRoot, 'MYW_TECHNICAL_RESULT_CURRENT.json'), {
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
      // Teardown only — no assertion is relaxed here. `purgeByOrganizationId`
      // walks every table in the schema, and this database has 1634 public
      // tables, so a real cleanup measured 87s against the project-wide
      // actionTimeout of 15s (playwright.config.ts:89). Without an explicit
      // timeout the test fails in `finally` AFTER all of its auth, idempotency
      // and tenant assertions have already passed, and leaves the fixture behind.
      await support.post('/api/test-support/cleanup', {
        data: { runId: foreignRunId },
        timeout: 180_000,
      });
      await memberApi.dispose();
      await support.dispose();
    }
  });

  /**
   * The four preceding cells only ever proved that a surface MOUNTS. A surface
   * that renders an empty list settles exactly like one that renders rows, so
   * "no spinner + body visible" is not a success journey. This test seeds real
   * rows through the mounted product writers and then requires the UI to show
   * those exact strings, uncovered, to the signed member who owns them.
   */
  test('seeded Inbox, Decisions and Agent present real rows to a signed member', async ({
    browser,
  }) => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    // MANAGER, not USER: `POST /api/decisions` is gated by
    // requireDecisionCapability('decision.request')
    // (server/src/routes/pmo/decisions.routes.ts:97) and a plain MEMBER is
    // correctly refused with 403. Seeding as USER would therefore have to
    // either bypass that check or drop the Decisions journey — both worse than
    // using the persona that genuinely holds the capability.
    const identity = await createMember(support, bootstrap.runId, 'MANAGER');
    const identityApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${identity.token}` },
    });
    let seed: MywSeed | null = null;
    try {
      const onboarding = await identityApi.put('/api/preferences', {
        data: { onboarding_completed: true, onboarding_role: 'consultant' },
      });
      expect(onboarding.ok()).toBe(true);

      const titles = mywSeedTitles(bootstrap.runId, identity.role);
      seed = await seedMywSurfaces(identityApi, titles);

      // Database truth FIRST: if PostgreSQL is empty the UI assertion below
      // could only ever pass by accident, so fail here rather than there.
      expect(seed.inboxItemCount).toBeGreaterThanOrEqual(2);
      expect(seed.inboxTitles).toContain(titles.taskTitle);
      expect(seed.inboxTitles).toContain(titles.decisionTitle);
      expect(seed.decisionId).not.toEqual('');
      expect(seed.planId).not.toEqual('');

      const context = await createIdentityContext(browser, appBase, identity);
      const page = await context.newPage();
      try {
        // Deep links are PATH-based for inbox/tasks/decisions
        // (MyWorkHub.parseMyWorkPathIntent). Only `?tab=vault` and `?tab=agent`
        // are honoured as query parameters (MyWorkHub.tsx:576-577); every other
        // `?tab=` value silently falls through to MY_WORK_FALLBACK_TAB ('inbox'),
        // so a `?tab=decisions` route would assert against the Inbox surface.
        const journeys = [
          { route: '/my-work/inbox', label: 'Inbox task row', text: titles.taskTitle },
          { route: '/my-work/inbox', label: 'Inbox decision row', text: titles.decisionTitle },
          {
            route: '/my-work/decisions',
            label: 'Decisions row',
            text: titles.decisionTitle,
          },
          { route: '/my-work?tab=agent', label: 'Agent plan row', text: titles.planTitle },
        ];

        for (const journey of journeys) {
          await page.goto(journey.route, { waitUntil: 'domcontentloaded' });
          await expect
            .poll(
              async () =>
                page.locator('[aria-busy="true"], [role="progressbar"], .animate-spin').count(),
              { timeout: 30_000 }
            )
            .toBe(0);
          // Exact string, not a substring of some placeholder: the row must be
          // the seeded record and must not be hidden behind an overlay.
          await assertVisibleAndUncovered(
            page.getByText(journey.text, { exact: false }),
            journey.label
          );
        }

        // An empty-state message must NOT coexist with the seeded rows — that
        // combination is how a stale cached shell fakes a populated surface.
        await expect(page.getByText(/No decisions awaiting|All caught up/i)).toHaveCount(0);
      } finally {
        await context.close();
      }
    } finally {
      await identityApi.dispose();
      await support.dispose();
    }
  });

  /**
   * Revocation must bite on the FIRST request, not after a TTL. The membership
   * guard caches its verdict for MEMBERSHIP_CACHE_TTL_MS
   * (server/src/middleware/auth.middleware.ts:1556) and nothing in production
   * invalidates that entry when a membership flips, so this test deliberately
   * keeps the cache COLD: the identity performs no guarded request before the
   * revoke. That makes the assertion below a genuine first-request denial
   * rather than an expired-cache artefact.
   *
   * The warm-cache case is NOT asserted here because the product does not yet
   * satisfy it; it is recorded as NOT_VERIFIED in the packet instead of being
   * papered over by clearing the cache from the harness.
   */
  test('revoked membership is denied on the first guarded request with a cold cache', async () => {
    const bootstrap = readTestSupportState();
    const support = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { 'x-test-support-key': supportKey },
    });
    const identity = await createMember(support, bootstrap.runId, 'USER');
    const identityApi = await apiRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Authorization: `Bearer ${identity.token}` },
    });
    try {
      const revoked = await support.post('/api/test-support/revoke-membership', {
        data: { userId: identity.userId, organizationId: identity.organizationId },
      });
      expect(revoked.ok()).toBe(true);
      expect((await revoked.json()).status).toBe('REVOKED');

      // FIRST guarded request this identity ever makes.
      const first = await identityApi.get('/api/my-work/stats');
      expect(first.status()).toBe(403);
      expect((await first.json()).code).toBe('ORG_MEMBERSHIP_REVOKED');
    } finally {
      await identityApi.dispose();
      await support.dispose();
    }
  });
});
