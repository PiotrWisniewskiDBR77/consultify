/**
 * Wave 2 retro coverage — Anna, Teresa and Voice Boundaries.
 */
import { expect, test } from '@playwright/test';

import {
  collectRuntimeGateIssues,
  expectAppMounted,
  expectNoRuntimeGateIssues,
  seedE2EAuthWithBootstrap,
} from './runtime-gate-helpers';

// This suite seeds its own auth and includes a public-flow check.
// It must not depend on shared smoke storage state file availability.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Wave 2 — Anna, Teresa and voice retro Playwright gate [@wave:2]', () => {
  test.setTimeout(120000);

  test('public Anna remains product-only and separate from tenant Teresa', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectAppMounted(page);

    const annaButton = page
      .getByRole('button', { name: /Ask Anna first|Zapytaj Anne najpierw|Zapytaj Annę najpierw/i })
      .first();
    await expect(annaButton).toBeVisible({ timeout: 30000 });
    await annaButton.click();

    await expect(
      page.getByText(/Guided product entry assistant|Asystentka wejścia produktowego/i)
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText(/do not have access to client or project data|Nie mam dostepu do danych klienta/i)
    ).toBeVisible();
    await expect(page.locator('#root')).not.toContainText(/workspace id|tenant id|raw acl/i);

    expectNoRuntimeGateIssues(issues);
  });

  test('Teresa remains the authenticated workspace assistant with honest voice UI', async ({
    page,
  }) => {
    const issues = collectRuntimeGateIssues(page);
    await seedE2EAuthWithBootstrap(page);

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    await expectAppMounted(page);

    await expect(page.getByText(/^Teresa$/)).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator('textarea[placeholder*="Teresa"], textarea[data-testid="chat-input"]').first()
    ).toBeVisible();
    await expect(page.getByText(/^Anna$/)).toHaveCount(0);

    const root = page.locator('#root');
    await expect(root).toContainText(/Teresa|Dictation|Voice|Microphone|Dyktafon|Dyktowanie|Głos/i);
    await expect(root).not.toContainText(/raw acl|permission dump|tenant secret/i);

    expectNoRuntimeGateIssues(issues);
  });
});
