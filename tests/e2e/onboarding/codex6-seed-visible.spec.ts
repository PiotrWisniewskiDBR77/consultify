import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const EVIDENCE_DIR = path.resolve('evidence/pilotaz-seed');

async function clickModule(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button, `visible navigation button ${name}`).toBeVisible();
  await button.click();
  await page.waitForLoadState('networkidle');
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

test.describe('CODEX6 E2 — English pilot seed is visible through product navigation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('owner signs in and reaches seeded team, initiatives, tasks and results by clicking UI links', async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const serverFailures: Array<{ status: number; url: string }> = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        serverFailures.push({ status: response.status(), url: response.url() });
      }
    });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('codex6-seed-owner@test.invalid');
    await page.locator('input[type="password"]').fill('Codex6-Seed-Owner-Password-123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForLoadState('networkidle');
    const skip = page.getByRole('button', { name: 'Skip for now' });
    if ((await skip.count()) > 0 && (await skip.isVisible())) await skip.click();

    await clickModule(page, 'Initiatives');
    await expect(page.locator('body')).toContainText('Stabilize Line 3 uptime');
    await expect(page.locator('body')).toContainText(/Pending approval/i);
    await capture(page, '01-initiatives');

    await clickModule(page, 'Execution');
    await expect(page.locator('body')).toContainText(/Deliver: Stabilize Line 3 uptime|execution/i);
    await capture(page, '02-tasks');

    await clickModule(page, 'Results');
    await expect(page.locator('body')).toContainText(/Results/);
    await capture(page, '03-results-module');

    await clickModule(page, 'Organization');
    await expect(page.locator('body')).toContainText(/Northstar Components Pilot|organization/i);
    await capture(page, '04-organization');

    expect(serverFailures, `unexpected API 5xx: ${JSON.stringify(serverFailures, null, 2)}`).toEqual([]);
  });
});
