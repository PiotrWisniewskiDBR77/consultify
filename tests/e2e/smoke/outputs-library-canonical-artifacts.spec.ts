/**
 * Wave 2 — browser proof: Outputs Library aggregate path issues canonical
 * GET /api/artifacts and renders registry-shaped rows (Mine tab).
 *
 * Uses route interception so we assert UI wiring without depending on DB seed data.
 */

import { expect, Page, test } from '@playwright/test';

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  for (let i = 0; i < 12; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    if (hasWelcome) await consultantCard.click({ timeout: 1500, force: true }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(200);
  }
}

test.describe('Outputs Library — canonical artifacts [@module:outputs-library]', () => {
  test.setTimeout(90000);

  test('Mine tab shows rows from GET /api/artifacts?view=mine', async ({ page }) => {
    await page.route('**/api/artifacts**', async (route) => {
      const req = route.request();
      if (req.method() !== 'GET') {
        await route.continue();
        return;
      }
      const u = new URL(req.url());
      const path = u.pathname.replace(/\/$/, '');
      if (path !== '/api/artifacts') {
        await route.continue();
        return;
      }

      const view = u.searchParams.get('view');
      const outputType = u.searchParams.get('outputType');

      if (outputType === 'report') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      if (outputType === 'presentation') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
        return;
      }

      if (view === 'mine') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                originRuntime: 'report',
                originRecordId: 'e2e-canonical-mine',
                artifactId: 'e2e-artifact-mine',
                resolvedTitle: 'E2E Canonical Mine Output',
                originStatus: 'ready',
                ownerUserId: 'e2e-owner',
                lastTransitionAt: '2026-03-24T10:00:00.000Z',
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/presentations?tab=mine');
    await dismissTourModal(page);
    await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
    await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);

    await expect(page.getByText('E2E Canonical Mine Output')).toBeVisible({ timeout: 20000 });
  });
});
