/**
 * M14 ExecutionHub cockpit — manual E2E (Playwright).
 *
 * Drives the v8 cockpit against the already-running frontend (:3000 → backend
 * :3001). Uses the ISOLATED E2E test-support tenant token (seedPageAuth), then
 * verifies:
 *   1. cockpit loads with the 4 tabs + initiatives,
 *   2. the Execution Intelligence panel binds to GET /:projectId/intelligence and
 *      renders predictions when the `intelligence` flag is on (?ff_execIntel=1),
 *   3. the panel is absent by default (flag OFF = live-safe).
 *
 * SAFETY (2026-07-13): This spec used to mint a token by logging in as the REAL
 * account (piotr.wisniewski@dbr77.com / 123456) and drove the LIVE DBR77 org
 * (a3e05d4a-...) directly. It now reads the isolated test-support tenant token
 * from the global-setup state file (tests/e2e/_helpers/testSupportState.ts), so
 * it never authenticates as — or touches — a real organization. Running without
 * the gated harness now fails fast (missing state file). NOTE: the content
 * assertions below (e.g. the "DevOps Transformation" initiative, ROI/rollout
 * data) require that fixture data to be seeded into the isolated tenant; seeding
 * those cockpit fixtures is tracked as follow-up work, not part of this safety fix.
 *
 * Run (servers already up): npx playwright test tests/e2e/m14-execution-cockpit.spec.ts
 */
import { test, expect } from '@playwright/test';

import { readTestSupportState } from './_helpers/testSupportState';
import { seedPageAuth } from './cases/_m07-helpers';

test.describe('M14 ExecutionHub cockpit', () => {
  let token: string;

  test.beforeAll(() => {
    // Isolated E2E tenant (test-support bootstrap) — never a real login.
    token = readTestSupportState().token;
    expect(token, 'test-support state must provide a token').toBeTruthy();
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

  test('What-if sandbox simulates interventions live (flag on)', async ({ page }) => {
    await page.goto('/implementation?tab=list&view=table&ff_whatIf=1', {
      waitUntil: 'domcontentloaded',
    });
    const panel = page.getByTestId('whatif-panel');
    await expect(panel).toBeVisible({ timeout: 30000 });
    // Baseline delta is neutral before any intervention.
    await expect(page.getByTestId('whatif-health-delta')).toContainText('±0');
    // Pick an intervention → projection recomputes (health delta becomes non-zero).
    await page.getByTestId('whatif-interventions').getByText('Zdejmij zakres').click();
    await expect(page.getByTestId('whatif-health-delta')).not.toContainText('±0', {
      timeout: 10000,
    });
    await expect(page.getByTestId('whatif-health-delta')).toContainText('+');
  });

  test('Rollout stages panel renders the 5-wave progression (flag on)', async ({ page }) => {
    await page.goto('/implementation?tab=rollout&ff_rolloutStages=1', {
      waitUntil: 'domcontentloaded',
    });
    // Switch to the Master Rollout Plan sub-view where the stages panel lives.
    const planTab = page.getByRole('button', { name: /master rollout plan/i });
    await expect(planTab).toBeVisible({ timeout: 30000 });
    await planTab.click();
    const panel = page.getByTestId('rollout-stages-panel');
    await expect(panel).toBeVisible({ timeout: 30000 });
    // All 5 canonical waves present in the progression.
    await expect(panel).toContainText('Pilot');
    await expect(panel).toContainText('Limited');
    await expect(panel).toContainText('Full');
    await expect(panel).toContainText('Hypercare');
    await expect(panel).toContainText('Closure');
    // The wave grid rendered all 5 columns.
    await expect(page.getByTestId('rollout-waves').locator('> div')).toHaveCount(5);
  });

  test('Rollout governance panels render (baseline + cutover, flag on)', async ({ page }) => {
    await page.goto('/implementation?tab=rollout&ff_rolloutStages=1', {
      waitUntil: 'domcontentloaded',
    });
    const planTab = page.getByRole('button', { name: /master rollout plan/i });
    await expect(planTab).toBeVisible({ timeout: 30000 });
    await planTab.click();
    await expect(page.getByTestId('baseline-panel')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('cutover-panel')).toBeVisible();
    await expect(page.getByTestId('baseline-panel')).toContainText(/Baseline/i);
  });

  test('Benefits register panel renders in Management (flag on)', async ({ page }) => {
    await page.goto('/implementation?tab=people_change&ff_benefits=1', {
      waitUntil: 'domcontentloaded',
    });
    await page.getByText('Management', { exact: true }).first().click();
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('benefits-panel')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('benefits-panel')).toContainText(/Rejestr korzyści|M14/i);
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
