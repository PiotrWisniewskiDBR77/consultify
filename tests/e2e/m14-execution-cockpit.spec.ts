/**
 * M14 ExecutionHub cockpit — manual E2E (Playwright).
 *
 * Drives the LIVE v8 cockpit (org a3e05d4a on staging) against the already-running
 * frontend (:3000 → backend :3001). Mints a real token via the login API, seeds it
 * per-page (seedPageAuth), then verifies:
 *   1. cockpit loads with the 4 tabs + real initiatives,
 *   2. the Execution Intelligence panel binds to GET /:projectId/intelligence and
 *      renders predictions when the `intelligence` flag is on (?ff_execIntel=1),
 *   3. the panel is absent by default (flag OFF = live-safe).
 *
 * Run (servers already up): npx playwright test tests/e2e/m14-execution-cockpit.spec.ts
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

import { seedPageAuth } from './cases/_m07-helpers';

const BACKEND = process.env.M14_BACKEND || 'http://localhost:3001';
const CREDS = {
  email: process.env.M14_EMAIL || 'piotr.wisniewski@dbr77.com',
  password: process.env.M14_PASSWORD || '123456',
};

async function mintToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BACKEND}/api/auth/login`, { data: CREDS });
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.token, 'no token in login response').toBeTruthy();
  return body.token as string;
}

test.describe('M14 ExecutionHub cockpit', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await mintToken(request);
  });

  test.beforeEach(async ({ page }) => {
    await seedPageAuth(page, token);
  });

  test('cockpit loads with the 4 tabs and real initiatives', async ({ page }) => {
    await page.goto('/implementation?tab=list&view=table', { waitUntil: 'domcontentloaded' });
    // Not v8-gated for this org.
    await expect(page.getByText(/requires server-side V8/i)).toHaveCount(0);
    // Real initiative data rendered (proves the cockpit booted, not v8-gated).
    await expect(page.getByText('DevOps Transformation').first()).toBeVisible({ timeout: 30000 });
    // The 4 cockpit tabs are present (tolerant text match — labels carry icons/badges).
    for (const label of ['Summary', 'Rollout', 'Reporting', 'Management']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 30000 });
    }
  });

  test('Intelligence panel binds to endpoint and renders predictions (flag on)', async ({
    page,
  }) => {
    await page.goto('/implementation?tab=list&view=table&ff_execIntel=1', {
      waitUntil: 'domcontentloaded',
    });
    const panel = page.getByTestId('intel-panel');
    await expect(panel).toBeVisible({ timeout: 30000 });
    // header + at-risk badge
    await expect(panel.getByText(/Predykcja ryzyka/i)).toBeVisible();
    await expect(page.getByTestId('intel-atrisk')).toBeVisible();
    // at least one prediction row sourced from the live endpoint
    await expect(page.getByTestId('intel-list').locator('li').first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId('intel-list').locator('li')).not.toHaveCount(0);
  });

  test('Intelligence panel is absent by default (flag off = live-safe)', async ({ page }) => {
    await page.goto('/implementation?tab=list&view=table', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('DevOps Transformation').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('intel-panel')).toHaveCount(0);
  });

  test('Timeline (Gantt) renders with the baseline flag on — no crash', async ({ page }) => {
    await page.goto('/implementation?tab=list&view=timeline&ff_ganttBaseline=1', {
      waitUntil: 'domcontentloaded',
    });
    // Switch to the timeline view mode and confirm the Gantt grid renders (week headers).
    const tl = page.getByRole('button', { name: /timeline/i });
    if (await tl.count()) await tl.first().click();
    await page.waitForTimeout(2000);
    // No render crash: error boundary absent and initiative content still present.
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    await expect(page.getByText(/DevOps Transformation|SLIP \d+d|^W\d+/).first()).toBeVisible({
      timeout: 30000,
    });
  });
});
