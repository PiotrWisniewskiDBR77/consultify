import { expect, type Page, test } from '@playwright/test';

import { loginAsOwner } from './work-canvas-helpers';

async function dismissTourModal(page: Page) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
    const closeButton = page.getByRole('button', { name: /Close|Zamknij/i }).first();
    const sampleRole = page.getByRole('button', { name: /Consultant|Konsultant|CEO|CTO/i }).first();

    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasClose = await closeButton.isVisible().catch(() => false);
    const hasSampleRole = await sampleRole.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    if (hasClose) await closeButton.click({ timeout: 1500, force: true }).catch(() => {});
    if (hasSampleRole) await sampleRole.click({ timeout: 1500, force: true }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    const tourStillVisible = await page
      .getByText(/Open the sample workspace walkthrough|Choose the perspective|Skip tour/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!tourStillVisible) return;

    await page.waitForTimeout(250);
  }
}

function collectMyWorkSignals(page: Page) {
  const apiFailures: string[] = [];
  const consoleErrors: string[] = [];

  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      apiFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  return {
    assertClean() {
      const criticalConsoleErrors = consoleErrors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('Failed to load resource:') &&
          !error.includes('[useDemo] Status fetch failed')
      );
      expect(apiFailures).toEqual([]);
      expect(criticalConsoleErrors).toEqual([]);
    },
  };
}

async function expectMyWorkRoute(
  page: Page,
  path: string,
  expectedText: RegExp,
  options?: { refresh?: boolean }
) {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissTourModal(page);
  await expect(page.getByTestId('mywork-view')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('body')).toContainText(expectedText, { timeout: 30000 });
  await expect(page.locator('body')).not.toContainText(/Cannot GET|Coś poszło nie tak|Something went wrong/i);
  await expect(page.getByText(/^Loading…$|^Ładowanie…$/i)).toHaveCount(0);

  if (options?.refresh) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissTourModal(page);
    await expect(page.getByTestId('mywork-view')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('body')).toContainText(expectedText, { timeout: 30000 });
    await expect(page.getByText(/^Loading…$|^Ładowanie…$/i)).toHaveCount(0);
  }
}

test.describe('My Work runtime gate smoke', () => {
  test.setTimeout(120000);

  test('owner renders radar and work tabs without the historical start spinner', async ({ page }) => {
    await loginAsOwner(page);
    const signals = collectMyWorkSignals(page);

    await expectMyWorkRoute(page, '/my-work/start', /Radar|My Work|Moja Praca/i, {
      refresh: true,
    });
    await expectMyWorkRoute(page, '/my-work', /Radar|My Work|Moja Praca/i);
    await expectMyWorkRoute(page, '/my-work/notebook', /Notebook|Notatnik/i);
    await expectMyWorkRoute(page, '/my-work/tasks', /Tasks|Zadania/i);
    await expectMyWorkRoute(page, '/my-work/calendar', /Calendar|Kalendarz/i);
    await expectMyWorkRoute(page, '/my-work/inbox', /Inbox/i);

    signals.assertClean();
  });
});
