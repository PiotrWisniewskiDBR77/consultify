/**
 * Language Persistence E2E Tests
 *
 * Verifies that manual UI language switching:
 * - updates document <html lang|dir>
 * - persists via localStorage (i18nextLng)
 * - survives a full page reload
 * - handles alias values (e.g. stored "ja" -> app "jp")
 */

import { expect, test } from '@playwright/test';

async function openTopBarLanguageMenu(page: any): Promise<void> {
  const header = page.locator('header').first();
  const langButton = header
    .locator('button')
    // The language button renders a 2-letter display code (EN/PL/DE/AR/JP/ES).
    .filter({ hasText: /\b(EN|PL|DE|AR|JP|ES)\b/ })
    .first();

  await expect(langButton).toBeVisible();
  await langButton.click();
}

async function selectLanguageFromMenu(page: any, label: string): Promise<void> {
  const header = page.locator('header').first();
  const optionButton = header.locator('button').filter({ hasText: label }).first();
  await expect(optionButton).toBeVisible();
  await optionButton.click();
}

test.describe('i18n: manual switching + persistence', () => {
  test.use({ locale: 'en-US' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // IMPORTANT:
      // `addInitScript` runs on every navigation, including `page.reload()`.
      // We want a clean slate at test start, but we must NOT wipe localStorage on reload,
      // otherwise we would delete the persisted `i18nextLng` value we're trying to verify.
      if (sessionStorage.getItem('__e2e_localStorage_cleared') !== '1') {
        localStorage.clear();
        sessionStorage.setItem('__e2e_localStorage_cleared', '1');
      }
    });
  });

  test('should persist Arabic (RTL) across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const arTranslationResponse = page
      .waitForResponse((r: any) => r.url().includes('/locales/ar/translation.json') && r.status() === 200, {
        timeout: 15000,
      })
      .catch(() => null);

    await openTopBarLanguageMenu(page);
    await selectLanguageFromMenu(page, 'العربية');

    // Ensure locale file is actually reachable/loaded (helps debug changeLanguage failures).
    await arTranslationResponse;

    // Wait until the user's choice is persisted (detector key).
    await page.waitForFunction(() => localStorage.getItem('i18nextLng') === 'ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar', { timeout: 30000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 30000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('should persist Japanese (jp) across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const jpTranslationResponse = page
      .waitForResponse((r: any) => r.url().includes('/locales/jp/translation.json') && r.status() === 200, {
        timeout: 15000,
      })
      .catch(() => null);

    await openTopBarLanguageMenu(page);
    await selectLanguageFromMenu(page, '日本語');

    await jpTranslationResponse;

    // Wait until the user's choice is persisted (detector key).
    await page.waitForFunction(() => localStorage.getItem('i18nextLng') === 'jp');
    await expect(page.locator('html')).toHaveAttribute('lang', 'jp', { timeout: 30000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr', { timeout: 30000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'jp');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('should normalize stored "ja" -> app "jp" on boot', async ({ page }) => {
    // Add after the clear() init script, so "ja" survives.
    await page.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'ja');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'jp');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});

