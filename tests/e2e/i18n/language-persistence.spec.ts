/**
 * Language Persistence E2E Tests
 *
 * Verifies that manual UI language switching:
 * - updates document <html lang|dir>
 * - persists via localStorage (i18nextLng)
 * - survives a full page reload
 * - handles alias values (e.g. legacy stored "jp" -> app "ja"; see
 *   S23-LOCALE, 2026-08-12: the app's Japanese code was migrated from the
 *   invalid BCP47 subtag "jp" to the correct "ja" — src/i18n.ts)
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

  test('should persist Japanese (ja) across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const jaTranslationResponse = page
      .waitForResponse((r: any) => r.url().includes('/locales/ja/translation.json') && r.status() === 200, {
        timeout: 15000,
      })
      .catch(() => null);

    await openTopBarLanguageMenu(page);
    await selectLanguageFromMenu(page, '日本語');

    await jaTranslationResponse;

    // Wait until the user's choice is persisted (detector key).
    await page.waitForFunction(() => localStorage.getItem('i18nextLng') === 'ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja', { timeout: 30000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr', { timeout: 30000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('should normalize legacy stored "jp" -> app "ja" on boot', async ({ page }) => {
    // Add after the clear() init script, so "jp" survives.
    // "jp" is the pre-migration code this app used to persist for Japanese
    // (not a valid BCP47 subtag) — see LANGUAGE_ALIASES in src/i18n.ts.
    await page.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'jp');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});

