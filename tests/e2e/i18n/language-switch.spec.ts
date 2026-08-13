/**
 * Language Switch E2E Tests
 *
 * Tests for language switching functionality across the application.
 * Verifies that UI elements update correctly when language is changed.
 *
 * @module tests/e2e/i18n/language-switch.spec.ts
 */

import { test, expect } from '@playwright/test';

// Browser locale -> expected app language code
// S23-LOCALE (2026-08-12): app locale code is "ja" (BCP47-correct), so
// browser "ja" now maps to app "ja" directly — no remapping.
const LOCALE_CASES = [
  { locale: 'en-US', code: 'en', name: 'English', direction: 'ltr' },
  { locale: 'pl-PL', code: 'pl', name: 'Polski', direction: 'ltr' },
  { locale: 'de-DE', code: 'de', name: 'Deutsch', direction: 'ltr' },
  { locale: 'es-ES', code: 'es', name: 'Español', direction: 'ltr' },
  { locale: 'ar-SA', code: 'ar', name: 'العربية', direction: 'rtl' },
  { locale: 'ja-JP', code: 'ja', name: '日本語', direction: 'ltr' },
] as const;

test.describe('Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  LOCALE_CASES.forEach(({ locale, code, name, direction }) => {
    test.describe(`${name} (${code}) from browser locale ${locale}`, () => {
      test.use({ locale });

      test('should use browser language on initial load', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const lang = await page.getAttribute('html', 'lang');
        expect(lang).toBe(code);

        const dir = await page.getAttribute('html', 'dir');
        expect(dir).toBe(direction);
      });
    });
  });

  test.describe('Language Selection in Settings', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to settings (requires authentication in real app)
      // For now, just test that the page loads
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    // Skip these tests if auth is required
    test.skip('should display all available languages in settings', async ({ page }) => {
      // Navigate to settings
      await page.click('[data-testid="settings-link"]');
      await page.waitForSelector('[data-testid="language-settings"]');

      // Check that all languages are displayed
      for (const lang of LANGUAGES) {
        const langOption = page.locator(`text=${lang.name}`);
        await expect(langOption).toBeVisible();
      }
    });

    test.skip('should change language when clicking language option', async ({ page }) => {
      // Navigate to settings
      await page.click('[data-testid="settings-link"]');
      await page.waitForSelector('[data-testid="language-settings"]');

      // Click Polish language option
      await page.click('text=Polski');

      // Wait for language change
      await page.waitForTimeout(500);

      // Verify language changed
      const lang = await page.getAttribute('html', 'lang');
      expect(lang).toBe('pl');

      // Verify localStorage updated
      const storedLang = await getCurrentLanguage(page);
      expect(storedLang).toBe('pl');
    });
  });

  test.describe('UI Element Translation', () => {
    LOCALE_CASES.forEach(({ locale, code, name }) => {
      test.describe(`${name} (${code}) UI smoke`, () => {
        test.use({ locale });

        test('should load with some translated content', async ({ page }) => {
          await page.goto('/');
          await page.waitForLoadState('networkidle');

          // Check that the page loaded
          const htmlLang = await page.getAttribute('html', 'lang');
          expect(htmlLang).toBe(code);

          // The page should have some translated content
          // This is a basic smoke test - specific content tests are in ui-elements.spec.ts
          const bodyText = await page.textContent('body');
          expect(bodyText).toBeTruthy();
          expect(bodyText!.length).toBeGreaterThan(0);
        });
      });
    });
  });

  test.describe('Language Code Validation', () => {
    test('should handle empty language preference', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('i18nextLng', '');
      });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should default to English or browser language
      const lang = await page.getAttribute('html', 'lang');
      expect(lang).toBeTruthy();
    });
  });
});

test.describe('Language-Specific Features', () => {
  test.skip(true, 'Covered by browser-locale driven tests above.');
});
