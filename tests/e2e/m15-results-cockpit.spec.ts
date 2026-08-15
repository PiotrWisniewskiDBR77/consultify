/**
 * M15 ResultsHub cockpit — manual E2E (Playwright).
 *
 * Drives the Results cockpit against the running frontend (:3000 → backend
 * :3001). Verifies M15/W1 (G1): the M14→M15 handoff inbox renders and a handoff
 * benefit can be promoted into a tracked KPI.
 *
 * SAFETY (2026-07-13): This spec used to mint a token by logging in as the REAL
 * account (piotr.wisniewski@dbr77.com / 123456) and drove the LIVE DBR77 org
 * (a3e05d4a-...) directly — the beforeAll benefit seed wrote into that real org.
 * It now reads the isolated test-support tenant token from the global-setup
 * state file (tests/e2e/_helpers/testSupportState.ts), so the seed + promote
 * flow run entirely inside a throwaway org and never touch real data. Running
 * without the gated harness now fails fast (missing state file).
 *
 * Run (servers up): npx playwright test tests/e2e/m15-results-cockpit.spec.ts
 */
import { test, expect } from '@playwright/test';

import { readTestSupportState } from './_helpers/testSupportState';
import { seedPageAuth } from './cases/_m07-helpers';

const BACKEND = process.env.M15_BACKEND || 'http://localhost:3001';

test.describe('M15 ResultsHub cockpit — M14 handoff (G1)', () => {
  // ResultsHub loads heavy data (KPIs/initiatives/ROI) on a shared staging DB.
  test.describe.configure({ timeout: 90_000 });
  let token: string;

  test.beforeAll(async ({ request }) => {
    // Isolated E2E tenant (test-support bootstrap) — never a real login.
    token = readTestSupportState().token;
    expect(token, 'test-support state must provide a token').toBeTruthy();
    // Seed a fresh handoff benefit (into the isolated org) so the inbox has something to promote.
    const res = await request.post(`${BACKEND}/api/benefits-register/benefits`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'E2E benefit ' + Date.now(),
        kpiName: 'E2E KPI ' + Date.now(),
        baselineValue: 100,
        targetValue: 60,
        cadence: 'monthly',
        status: 'tracking',
        source: 'M14_CLOSURE_HANDOFF',
      },
    });
    expect(res.status(), 'seed benefit').toBe(201);
  });

  test.beforeEach(async ({ page }) => {
    await seedPageAuth(page, token);
  });

  test('ResultsHub loads with tabs (not beta-gated for this org)', async ({ page }) => {
    await page.goto('/benefits', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/not enabled|requires.*beta|module.*unavailable/i)).toHaveCount(0);
    for (const label of ['KPI', 'ROI']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 45000 });
    }
  });

  test('M14 handoff inbox renders on Initiatives tab (flag on)', async ({ page }) => {
    await page.goto('/benefits?ff_m14Handoff=1', { waitUntil: 'domcontentloaded' });
    const inbox = page.getByTestId('m14-handoff-inbox');
    await expect(inbox).toBeVisible({ timeout: 45000 });
    await expect(inbox).toContainText(/Skrzynka z wdrożenia/i);
    // at least one handoff benefit present
    await expect(page.getByTestId('m14-handoff-list').locator('li').first()).toBeVisible({
      timeout: 60000,
    });
  });

  test('promoting a handoff benefit marks it tracked', async ({ page }) => {
    await page.goto('/benefits?ff_m14Handoff=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('m14-handoff-inbox')).toBeVisible({ timeout: 45000 });
    // wait for the async benefits list to populate before counting
    await expect(page.getByTestId('m14-handoff-list').locator('li').first()).toBeVisible({
      timeout: 60000,
    });
    const promoteBtns = page.getByTestId('m14-handoff-promote');
    const tracked = page.getByTestId('m14-handoff-tracked');
    // the beforeAll seeds a fresh (unpromoted) benefit, so there is ≥1 promote button
    await expect.poll(async () => promoteBtns.count(), { timeout: 15000 }).toBeGreaterThan(0);
    const trackedBefore = await tracked.count();
    await promoteBtns.first().click();
    // after promote, the count of "tracked" badges grows by (at least) one
    await expect
      .poll(async () => tracked.count(), { timeout: 15000 })
      .toBeGreaterThan(trackedBefore);
  });

  test('inbox absent by default (flag off = live-safe)', async ({ page }) => {
    await page.goto('/benefits', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('KPI', { exact: true }).first()).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId('m14-handoff-inbox')).toHaveCount(0);
  });
});
