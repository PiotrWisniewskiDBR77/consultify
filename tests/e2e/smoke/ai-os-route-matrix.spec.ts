/**
 * Runtime Gate — AI OS route matrix.
 *
 * Guards the P1 class fixed in the runtime gate: AI OS routes must render their
 * native panels and must not be captured by stale chat route state.
 */
import { expect, test } from '@playwright/test';

import {
  collectRuntimeGateIssues,
  expectAppMounted,
  expectNoRuntimeGateIssues,
  gotoRuntimeGateRoute,
} from './runtime-gate-helpers';

type RouteCase = {
  name: string;
  path: string;
  finalUrl: RegExp;
  visibleText: RegExp;
};

const AI_OS_ROUTES: RouteCase[] = [
  {
    name: 'AI OS hub',
    path: '/ai',
    finalUrl: /\/ai\/?$/,
    visibleText: /AI OS control plane|Consultify AI OS/i,
  },
  {
    name: 'AI Actions alias',
    path: '/ai/actions',
    finalUrl: /\/ai\/action-center\/?$/,
    visibleText: /Action Center|Proposals and Executions/i,
  },
  {
    name: 'Artifacts',
    path: '/ai/artifacts',
    finalUrl: /\/ai\/artifacts\/?$/,
    visibleText: /Wave 5 Artifact Runtime|Create Artifact|Artifacts/i,
  },
  {
    name: 'Agents',
    path: '/ai/agents',
    finalUrl: /\/ai\/agents\/?$/,
    visibleText: /Wave 8 Agent Catalog|Launch Agent/i,
  },
  {
    name: 'Outcomes',
    path: '/ai/outcomes',
    finalUrl: /\/ai\/outcomes\/?$/,
    visibleText: /Wave 9 Outcome & AI Ops|AI Ops Dashboard|Final Acceptance/i,
  },
  {
    name: 'Research Sessions',
    path: '/ai/research-sessions',
    finalUrl: /\/ai\/research-sessions\/?$/,
    visibleText: /Research Sessions|Session Dock|Evidence Graph/i,
  },
  {
    name: 'Context',
    path: '/ai/context',
    finalUrl: /\/ai\/context\/?$/,
    visibleText: /Wave 6 Context and Learning|Memory Stewardship Queue|Context Controls/i,
  },
];

test.describe('Runtime Gate — AI OS route matrix [@module:ai-os]', () => {
  test.setTimeout(120000);

  for (const routeCase of AI_OS_ROUTES) {
    test(`${routeCase.name} renders without chat redirect`, async ({ page }) => {
      const issues = collectRuntimeGateIssues(page);

      await gotoRuntimeGateRoute(page, routeCase.path);
      await expectAppMounted(page);

      await expect(page).not.toHaveURL(/\/chat(?:\/|$)/);
      await expect(page).toHaveURL(routeCase.finalUrl, { timeout: 15000 });
      await expect(page.locator('#root')).toContainText(routeCase.visibleText, { timeout: 30000 });

      expectNoRuntimeGateIssues(issues);
    });
  }
});
