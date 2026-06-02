/**
 * Wave 0 retro coverage — Runtime Truth.
 *
 * Confirms the canonical AI OS runtime shell and routes are visible and not
 * captured by chat routing state.
 */
import { expect, test } from '@playwright/test';

import {
  collectRuntimeGateIssues,
  expectAppMounted,
  expectNoRuntimeGateIssues,
  gotoRuntimeGateRoute,
  seedE2EAuth,
} from './runtime-gate-helpers';

const WAVE0_ROUTES = [
  { path: '/ai', title: /AI OS control plane|Consultify AI OS/i },
  { path: '/ai/actions', title: /Action Center|Proposals and Executions/i },
  { path: '/ai/research-sessions', title: /Research Sessions|Session Dock|Evidence Graph/i },
  { path: '/ai/artifacts', title: /Wave 5 Artifact Runtime|Create Artifact|Artifacts/i },
  { path: '/ai/context', title: /Wave 6 Context and Learning|Memory Stewardship Queue/i },
  { path: '/ai/connectors', title: /Wave 7 Connector Admin|Connector Registry|Connectors/i },
  { path: '/ai/agents', title: /Wave 8 Agent Catalog|Launch Agent/i },
  { path: '/ai/outcomes', title: /Wave 9 Outcome & AI Ops|AI Ops Dashboard/i },
];

test.describe('Wave 0 — Runtime truth retro Playwright gate [@wave:0]', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await seedE2EAuth(page);
  });

  test('AI OS hub exposes runtime truth and wave status', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);

    await gotoRuntimeGateRoute(page, '/ai');
    await expectAppMounted(page);

    await expect(page).toHaveURL(/\/ai\/?$/);
    await expect(page.locator('#root')).toContainText(/AI OS control plane/i);
    await expect(page.locator('#root')).toContainText(/Wave 0/i);
    await expect(page.locator('#root')).toContainText(/Runtime truth/i);
    await expect(page.locator('#root')).toContainText(/Manual gate checklist/i);
    await expect(page).not.toHaveURL(/\/chat(?:\/|$)/);

    expectNoRuntimeGateIssues(issues);
  });

  for (const routeCase of WAVE0_ROUTES) {
    test(`${routeCase.path} reaches the expected AI OS surface`, async ({ page }) => {
      const issues = collectRuntimeGateIssues(page);

      await gotoRuntimeGateRoute(page, routeCase.path);
      await expectAppMounted(page);

      await expect(page).not.toHaveURL(/\/chat(?:\/|$)/);
      await expect(page.locator('#root')).toContainText(routeCase.title, { timeout: 30000 });

      expectNoRuntimeGateIssues(issues);
    });
  }

  test('unknown AI OS child route falls back to AI OS hub, not chat', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);

    await gotoRuntimeGateRoute(page, '/ai/unknown-retro-route');
    await expectAppMounted(page);

    await expect(page).toHaveURL(/\/ai\/?$/);
    await expect(page).not.toHaveURL(/\/chat(?:\/|$)/);
    await expect(page.locator('#root')).toContainText(/AI OS control plane/i);

    expectNoRuntimeGateIssues(issues);
  });
});
