import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const authState = process.env.ODBIOR_AUTH_STATE;
const testOrigin = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const rewrittenStorageState =
  authState && fs.existsSync(authState)
    ? (() => {
        const state = JSON.parse(fs.readFileSync(authState, 'utf8'));
        state.origins = (state.origins ?? []).map((origin: { origin: string }) => ({
          ...origin,
          origin: origin.origin.replace('http://localhost:3000', testOrigin),
        }));
        return state;
      })()
    : undefined;

test.describe('P1 — jeden prawy panel na listach', () => {
  test.skip(!authState || !fs.existsSync(authState), 'Wymaga istniejącego ODBIOR_AUTH_STATE');
  test.use({
    storageState: rewrittenStorageState,
    viewport: { width: 1280, height: 800 },
    locale: 'pl-PL',
    colorScheme: 'light',
  });

  test('pełny przepływ właścicielski', async ({ page }) => {
    const errors: string[] = [];
    const httpErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('response', (response) => {
      if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto('/my-work');
    const table = page.getByTestId('standard-table').first();
    await expect(table).toBeVisible();
    await expect(page.locator('[data-right-panel]')).toHaveCount(0);
    await expect(page.locator('#app-main-content ~ div[style*="width"]')).toHaveCount(0);
    const szerokoscA = (await table.boundingBox())?.width;

    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab', { name: 'Rekord' })).toHaveAttribute('aria-selected', 'true');
    const szerokoscB = (await table.boundingBox())?.width;
    expect(szerokoscB).toBe(szerokoscA);

    await page.getByRole('tab', { name: 'Teresa' }).click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);
    await expect(page.locator('textarea').last()).toBeVisible();

    await page.getByRole('button', { name: 'Zamknij panel' }).click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pokaż panel' })).toBeVisible();
    await rows.nth(1).click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Pokaż panel' }).click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Rekord' })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Zamknij panel' }).click();
    await page.reload();
    await expect(page.locator('[data-right-panel]')).toHaveCount(0);

    await page.goto('/assessment');
    await expect(page.getByTestId('standard-table').first()).toBeVisible();
    await page.getByTestId('standard-table').first().locator('tbody tr').first().click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);

    await page.goto('/interview');
    const interviewRow = page.getByTestId('standard-table').first().locator('tbody tr').first();
    await interviewRow.click();
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-right-panel]')).toHaveCount(0);
    await expect(interviewRow).toBeFocused();

    await page.goto('/my-work/ideas');
    const workspaceLink = page.locator('a[href*="/workspace/"]').first();
    const workspaceHref = await workspaceLink.getAttribute('href');
    expect(workspaceHref).toBeTruthy();
    await page.goto(workspaceHref!);
    await expect(page.locator('[data-right-panel]')).toHaveCount(1);

    await page.goto('/chat');
    await expect(page.locator('[data-right-panel]')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(httpErrors).toEqual([]);
  });
});
