import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

type RouteContract = { module: string; path: string; visibleText: RegExp };

const contracts: RouteContract[] = [
  { module: 'Artifact Studio', path: '/document-studio', visibleText: /Document|Dokument|Materials|Materiały/i },
  { module: 'Initiatives', path: '/initiatives', visibleText: /Initiatives|Inicjatywy/i },
  { module: 'Execution', path: '/execution', visibleText: /Execution|Egzekucja|Realizacja/i },
  { module: 'Case Workspace', path: '/zlecenia', visibleText: /Case|Zlecen/i },
  { module: 'Results KPI', path: '/results/kpi', visibleText: /KPI|Results|Wyniki/i },
  { module: 'Results ROI', path: '/results/roi', visibleText: /ROI|Results|Wyniki/i },
  { module: 'Results OKR', path: '/results/okr', visibleText: /OKR|Results|Wyniki/i },
  { module: 'Ideas', path: '/my-work?tab=ideas', visibleText: /Ideas|Pomysł/i },
  { module: 'Finance', path: '/finance', visibleText: /Finance|Finanse/i },
];

const forbiddenFlagKey = /(flag|feature|beta|preview|demo_acceptance|artifact_studio|case_workspace|results_vnext|finance.*v1)/i;
const ignoredFailure = /favicon|analytics|telemetry|sentry|clarity|intercom/i;

function evidencePath(testInfo: TestInfo, suffix: string) {
  const root = process.env.E2E_EVIDENCE_DIR || path.join('/tmp', 'consultify-demo-acceptance');
  return path.join(root, 'runtime', testInfo.project.name, `${testInfo.title.replace(/[^a-z0-9]+/gi, '-')}.${suffix}`);
}

async function capture(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: Array<{ url: string; error: string }> = [];
  const badResponses: Array<{ url: string; status: number }> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    if (!ignoredFailure.test(request.url())) failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/api/') && !ignoredFailure.test(response.url())) {
      badResponses.push({ url: response.url(), status: response.status() });
    }
  });
  return { consoleErrors, failedRequests, badResponses };
}

test.describe('real demo OWNER reachability (no auth or flag bypass)', () => {
  test('six acceptance modules are visible in normal navigation', async ({ page }, testInfo) => {
    const runtime = await capture(page);
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    for (const label of [
      /Materials|Materiały/i,
      /Initiatives|Inicjatywy/i,
      /Execution|Egzekucja|Realizacja/i,
      /Results|Wyniki/i,
      /My Work|Moja praca/i,
      /Finance|Finanse/i,
    ]) {
      await expect(page.getByRole('button', { name: label }).first(), `normal navigation entry ${label}`).toBeVisible();
    }
    const output = evidencePath(testInfo, 'json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ url: page.url(), ...runtime }, null, 2));
    expect(runtime.consoleErrors, 'console errors').toEqual([]);
    expect(runtime.failedRequests, 'failed network requests').toEqual([]);
    expect(runtime.badResponses, 'HTTP >=400 API responses').toEqual([]);
  });

  for (const contract of contracts) {
    test(`${contract.module}: normal route renders`, async ({ page }, testInfo) => {
      const runtime = await capture(page);
      await page.goto(contract.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#root')).toContainText(contract.visibleText, { timeout: 45_000 });
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
      await expect(page).not.toHaveURL(/[?&](flag|feature|beta|preview|demoAcceptance)=/i);
      await expect(page.getByText(/Something went wrong|Coś poszło nie tak/i)).toHaveCount(0);

      const suspiciousStorageKeys = await page.evaluate((pattern) => {
        const re = new RegExp(pattern, 'i');
        return Object.keys(localStorage).filter((key) => re.test(key));
      }, forbiddenFlagKey.source);
      expect(suspiciousStorageKeys, 'feature activation must not depend on browser-local flags').toEqual([]);

      await page.waitForTimeout(1500);
      const output = evidencePath(testInfo, 'json');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ contract, url: page.url(), suspiciousStorageKeys, ...runtime }, null, 2));
      expect(runtime.consoleErrors, 'console errors').toEqual([]);
      expect(runtime.failedRequests, 'failed network requests').toEqual([]);
      expect(runtime.badResponses, 'HTTP >=400 API responses').toEqual([]);
    });
  }
});
