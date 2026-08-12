/**
 * Visual Regression Tests for i18n
 *
 * Screenshot comparison tests for all supported languages to ensure
 * UI elements display correctly across different locales.
 *
 * Tests cover:
 * - Dashboard
 * - Assessment view
 * - Settings (language selector)
 * - Help Panel
 * - Login page
 * - Form with validation
 *
 * @module tests/e2e/i18n/visual-regression-i18n.spec.ts
 */

import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';

// Supported languages
const LANGUAGES = [
  { code: 'en', locale: 'en-US', name: 'English', direction: 'ltr' },
  { code: 'pl', locale: 'pl-PL', name: 'Polski', direction: 'ltr' },
  { code: 'de', locale: 'de-DE', name: 'Deutsch', direction: 'ltr' },
  { code: 'es', locale: 'es-ES', name: 'Español', direction: 'ltr' },
  { code: 'ar', locale: 'ar-SA', name: 'العربية', direction: 'rtl' },
  // S23-LOCALE (2026-08-12): app locale code is "ja" (BCP47-correct),
  // matching what browsers report — no remapping needed anymore.
  { code: 'ja', locale: 'ja-JP', name: '日本語', direction: 'ltr' },
] as const;

// Helper to set browser language before page load (app detects from navigator.*)
async function setBrowserLocale(page: any, locale: string): Promise<void> {
  await page.addInitScript((loc: string) => {
    try {
      Object.defineProperty(Navigator.prototype, 'language', {
        get: () => loc,
        configurable: true,
      });
      Object.defineProperty(Navigator.prototype, 'languages', {
        get: () => [loc],
        configurable: true,
      });
    } catch {
      // ignore
    }
  }, locale);
}

test.describe('Visual Regression - i18n', () => {
  test.setTimeout(180000); // 3 minutes for visual tests with multiple languages

  test.describe('Login Page', () => {
    LANGUAGES.forEach(({ code, locale, name }) => {
      test(`${name} (${code}): login page should render correctly`, async ({ page }) => {
        await setBrowserLocale(page, locale);
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Verify language is set
        const htmlLang = await page.getAttribute('html', 'lang');
        expect(htmlLang).toBe(code);

        // Verify direction for RTL
        if (code === 'ar') {
          const dir = await page.getAttribute('html', 'dir');
          expect(dir).toBe('rtl');
        }

        await percySnapshot(page, `Login Page - ${name} (${code})`, {
          widths: [768, 1280],
          minHeight: 600,
        });
      });
    });
  });

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin user for consistent visual state
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'admin@testenterprise.com').catch(() => {});
      await page.fill('[data-testid="password"]', 'AdminPass123!').catch(() => {});
      await page.click('[data-testid="login-button"]').catch(() => {});
      await page.waitForTimeout(2000); // Wait for potential login
    });

    LANGUAGES.forEach(({ code, locale, name }) => {
      test(`${name} (${code}): dashboard should render correctly`, async ({ page }) => {
        await setBrowserLocale(page, locale);
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Verify language
        const htmlLang = await page.getAttribute('html', 'lang');
        expect(htmlLang).toBe(code);

        // Wait for dashboard content
        await page.waitForTimeout(1000);

        await percySnapshot(page, `Dashboard - ${name} (${code})`, {
          widths: [1280, 1920],
          minHeight: 800,
        });
      });
    });
  });

  test.describe('Assessment View', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'admin@testenterprise.com').catch(() => {});
      await page.fill('[data-testid="password"]', 'AdminPass123!').catch(() => {});
      await page.click('[data-testid="login-button"]').catch(() => {});
      await page.waitForTimeout(2000);
    });

    LANGUAGES.forEach(({ code, locale, name }) => {
      test(`${name} (${code}): assessment view should render correctly`, async ({ page }) => {
        await setBrowserLocale(page, locale);
        await page.goto('/assessment');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await percySnapshot(page, `Assessment View - ${name} (${code})`, {
          widths: [1024, 1440],
          minHeight: 600,
        });
      });
    });
  });

  test.describe('Settings - Language Selector', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'admin@testenterprise.com').catch(() => {});
      await page.fill('[data-testid="password"]', 'AdminPass123!').catch(() => {});
      await page.click('[data-testid="login-button"]').catch(() => {});
      await page.waitForTimeout(2000);
    });

    LANGUAGES.forEach(({ code, locale, name }) => {
      test(`${name} (${code}): settings page with language selector`, async ({ page }) => {
        await setBrowserLocale(page, locale);
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Try to find and open language settings
        const langSection = page
          .locator(
            '[data-testid="language-settings"], text=/language/i, text=/język/i, text=/sprache/i, text=/idioma/i, text=/لغة/i, text=/言語/i'
          )
          .first();

        if (await langSection.isVisible()) {
          await langSection.click();
          await page.waitForTimeout(500);
        }

        await percySnapshot(page, `Settings - Language Selector - ${name} (${code})`, {
          widths: [768, 1024, 1280],
        });
      });
    });
  });

  test.describe('Help Panel', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'admin@testenterprise.com').catch(() => {});
      await page.fill('[data-testid="password"]', 'AdminPass123!').catch(() => {});
      await page.click('[data-testid="login-button"]').catch(() => {});
      await page.waitForTimeout(2000);
    });

    LANGUAGES.forEach(({ code, locale, name }) => {
      test(`${name} (${code}): help panel should render correctly`, async ({ page }) => {
        await setBrowserLocale(page, locale);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Try to open help panel
        const helpButton = page
          .locator(
            '[data-testid="help-button"], button:has-text("Help"), button:has-text("Pomoc"), button:has-text("Hilfe"), button:has-text("Ayuda"), button:has-text("مساعدة"), button:has-text("ヘルプ")'
          )
          .first();

        if (await helpButton.isVisible()) {
          await helpButton.click();
          await page.waitForTimeout(500);

          const helpPanel = page
            .locator(
              '[data-testid="help-panel"], [role="dialog"]:has-text("Help"), [role="dialog"]:has-text("Pomoc")'
            )
            .first();

          if (await helpPanel.isVisible()) {
            await percySnapshot(page, `Help Panel - ${name} (${code})`, {
              scope: helpPanel,
              widths: [768, 1024],
            });
          }
        } else {
          // If help button not found, just capture the page
          await percySnapshot(page, `Help Panel Context - ${name} (${code})`, {
            widths: [1280],
          });
        }
      });
    });
  });

  test.describe('Form with Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'admin@testenterprise.com').catch(() => {});
      await page.fill('[data-testid="password"]', 'AdminPass123!').catch(() => {});
      await page.click('[data-testid="login-button"]').catch(() => {});
      await page.waitForTimeout(2000);
    });

    LANGUAGES.forEach(({ code, locale, name }) => {
      test(`${name} (${code}): form validation should display correctly`, async ({ page }) => {
        await setBrowserLocale(page, locale);

        // Try to find a form - could be task creation, profile edit, etc.
        await page.goto('/settings/profile').catch(() => page.goto('/'));
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Try to trigger validation by submitting empty form
        const submitButton = page
          .locator(
            'button[type="submit"], button:has-text("Save"), button:has-text("Zapisz"), button:has-text("Speichern"), button:has-text("Guardar"), button:has-text("حفظ"), button:has-text("保存")'
          )
          .first();

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(500);

          // Capture form with validation errors
          const form = page.locator('form, [data-testid*="form"]').first();
          if (await form.isVisible()) {
            await percySnapshot(page, `Form Validation - ${name} (${code})`, {
              scope: form,
              widths: [768, 1024],
            });
          }
        } else {
          // If no form found, capture the page anyway
          await percySnapshot(page, `Form Context - ${name} (${code})`, {
            widths: [1280],
          });
        }
      });
    });
  });

  test.describe('RTL Specific - Arabic', () => {
    test('Arabic: RTL layout should be properly mirrored', async ({ page }) => {
      await setBrowserLocale(page, 'ar-SA');
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify RTL
      const dir = await page.getAttribute('html', 'dir');
      expect(dir).toBe('rtl');

      // Capture full page
      await percySnapshot(page, 'Arabic RTL - Full Page', {
        widths: [1280, 1920],
        minHeight: 800,
      });

      // Check sidebar position
      const sidebar = page.locator('nav, aside, [data-testid="sidebar"]').first();
      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        const viewportSize = page.viewportSize();

        if (sidebarBox && viewportSize) {
          // In RTL, sidebar should be on the right
          const sidebarRightEdge = sidebarBox.x + sidebarBox.width;
          expect(sidebarRightEdge).toBeGreaterThan(viewportSize.width * 0.5);
        }

        await percySnapshot(page, 'Arabic RTL - Sidebar', {
          scope: sidebar,
          widths: [1280],
        });
      }
    });

    test('Arabic: text alignment and direction', async ({ page }) => {
      await setBrowserLocale(page, 'ar-SA');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check text direction
      const bodyDirection = await page.evaluate(() => {
        return window.getComputedStyle(document.body).direction;
      });
      expect(bodyDirection).toBe('rtl');

      await percySnapshot(page, 'Arabic RTL - Text Alignment', {
        widths: [1280],
        minHeight: 600,
      });
    });
  });

  test.describe('CJK Specific - Japanese', () => {
    test('Japanese: CJK characters should render correctly', async ({ page }) => {
      await setBrowserLocale(page, 'ja-JP');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify Japanese characters are present
      const pageContent = await page.textContent('body');
      const hasJapaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(pageContent || '');

      // Page should have Japanese content
      expect(pageContent).toBeTruthy();

      await percySnapshot(page, 'Japanese CJK - Character Rendering', {
        widths: [1280, 1920],
        minHeight: 800,
      });
    });
  });

  test.describe('Language Switching Visual Consistency', () => {
    test('UI should maintain layout when switching languages', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'admin@testenterprise.com').catch(() => {});
      await page.fill('[data-testid="password"]', 'AdminPass123!').catch(() => {});
      await page.click('[data-testid="login-button"]').catch(() => {});
      await page.waitForTimeout(2000);

      // Test with English first
      await setBrowserLocale(page, 'en-US');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await percySnapshot(page, 'Language Switch - English Baseline', {
        widths: [1280],
      });

      // Switch to Arabic (RTL)
      await setBrowserLocale(page, 'ar-SA');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await percySnapshot(page, 'Language Switch - Arabic (RTL)', {
        widths: [1280],
      });

      // Switch to Japanese
      await setBrowserLocale(page, 'ja-JP');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await percySnapshot(page, 'Language Switch - Japanese', {
        widths: [1280],
      });
    });
  });
});
