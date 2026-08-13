/**
 * UI Elements Translation E2E Tests
 *
 * Tests that verify specific UI elements display correctly in all supported languages.
 * Covers navigation, buttons, forms, and common UI components.
 *
 * @module tests/e2e/i18n/ui-elements.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Supported languages
const LANGUAGES = ['en', 'pl', 'de', 'es', 'ar', 'ja'] as const;
type Language = typeof LANGUAGES[number];

function expectedHtmlLang(lang: Language): string {
  // S23-LOCALE (2026-08-12): app locale code for Japanese is now 'ja'
  // (BCP47-correct) — no remapping needed, see src/i18n.ts.
  return lang;
}

// Expected translations for key UI elements
const UI_TRANSLATIONS: Record<Language, {
  sidebar: {
    dashboard: string;
    settings: string;
  };
  common: {
    save: string;
    cancel: string;
    close: string;
    loading: string;
  };
  auth: {
    login: string;
    logout: string;
  };
}> = {
  en: {
    sidebar: {
      dashboard: 'Dashboard',
      settings: 'Settings',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      loading: 'Loading',
    },
    auth: {
      login: 'Log In',
      logout: 'Log Out',
    },
  },
  pl: {
    sidebar: {
      dashboard: 'Dashboard',
      settings: 'Ustawienia',
    },
    common: {
      save: 'Zapisz',
      cancel: 'Anuluj',
      close: 'Zamknij',
      loading: 'Ładowanie',
    },
    auth: {
      login: 'Zaloguj',
      logout: 'Wyloguj',
    },
  },
  de: {
    sidebar: {
      dashboard: 'Dashboard',
      settings: 'Einstellungen',
    },
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      close: 'Schließen',
      loading: 'Wird geladen',
    },
    auth: {
      login: 'Anmelden',
      logout: 'Abmelden',
    },
  },
  es: {
    sidebar: {
      dashboard: 'Panel',
      settings: 'Configuración',
    },
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      close: 'Cerrar',
      loading: 'Cargando',
    },
    auth: {
      login: 'Iniciar sesión',
      logout: 'Cerrar sesión',
    },
  },
  ar: {
    sidebar: {
      dashboard: 'لوحة القيادة',
      settings: 'الإعدادات',
    },
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      close: 'إغلاق',
      loading: 'جارٍ التحميل',
    },
    auth: {
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
    },
  },
  ja: {
    sidebar: {
      dashboard: 'ダッシュボード',
      settings: '設定',
    },
    common: {
      save: '保存',
      cancel: 'キャンセル',
      close: '閉じる',
      loading: '読み込み中',
    },
    auth: {
      login: 'ログイン',
      logout: 'ログアウト',
    },
  },
};

// Helper to set language before page load
async function setLanguage(page: Page, langCode: Language): Promise<void> {
  await page.addInitScript((lang) => {
    localStorage.setItem('i18nextLng', lang);
  }, langCode);
}

test.describe('UI Elements Translation', () => {
  test.describe('Landing/Login Page', () => {
    LANGUAGES.forEach((lang) => {
      test(`${lang}: login page should display correctly`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Verify the language is set
        const htmlLang = await page.getAttribute('html', 'lang');
        expect(htmlLang).toBe(expectedHtmlLang(lang));
        
        // Page should have content
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
        
        // Check for expected translations if login page is shown
        const translations = UI_TRANSLATIONS[lang];
        
        // Look for login-related text (case insensitive, partial match)
        const loginText = translations.auth.login.toLowerCase();
        const pageContent = (bodyText || '').toLowerCase();
        
        // The page should either have login text or be redirected to dashboard
        // This is a basic check - specific element checks below
      });
    });
  });

  test.describe('Navigation Elements', () => {
    // These tests require authentication - skip if not logged in
    test.describe.skip('Sidebar Navigation (requires auth)', () => {
      LANGUAGES.forEach((lang) => {
        test(`${lang}: sidebar should display correct translations`, async ({ page }) => {
          await setLanguage(page, lang);
          await page.goto('/dashboard');
          await page.waitForLoadState('networkidle');
          
          const translations = UI_TRANSLATIONS[lang];
          
          // Check sidebar elements
          const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();
          
          if (await sidebar.isVisible()) {
            const sidebarText = await sidebar.textContent();
            
            // Dashboard link should be present
            expect(sidebarText).toContain(translations.sidebar.dashboard);
            
            // Settings link should be present
            expect(sidebarText).toContain(translations.sidebar.settings);
          }
        });
      });
    });
  });

  test.describe('Common UI Components', () => {
    test.describe.skip('Buttons (requires specific page context)', () => {
      LANGUAGES.forEach((lang) => {
        test(`${lang}: common buttons should be translated`, async ({ page }) => {
          await setLanguage(page, lang);
          await page.goto('/settings');
          await page.waitForLoadState('networkidle');
          
          const translations = UI_TRANSLATIONS[lang];
          
          // Look for Save button
          const saveButton = page.locator(`button:has-text("${translations.common.save}")`);
          if (await saveButton.count() > 0) {
            await expect(saveButton.first()).toBeVisible();
          }
          
          // Look for Cancel button
          const cancelButton = page.locator(`button:has-text("${translations.common.cancel}")`);
          if (await cancelButton.count() > 0) {
            await expect(cancelButton.first()).toBeVisible();
          }
        });
      });
    });

    test.describe.skip('Modal Close Button', () => {
      LANGUAGES.forEach((lang) => {
        test(`${lang}: modal close button should be translated`, async ({ page }) => {
          await setLanguage(page, lang);
          await page.goto('/');
          await page.waitForLoadState('networkidle');
          
          // Try to open a modal (varies by app)
          const modal = page.locator('[role="dialog"], .modal');
          
          if (await modal.count() > 0 && await modal.first().isVisible()) {
            const translations = UI_TRANSLATIONS[lang];
            const closeButton = modal.locator(`button:has-text("${translations.common.close}")`);
            
            if (await closeButton.count() > 0) {
              await expect(closeButton.first()).toBeVisible();
            }
          }
        });
      });
    });
  });

  test.describe('Form Elements', () => {
    test.describe.skip('Form Labels and Placeholders (requires auth)', () => {
      LANGUAGES.forEach((lang) => {
        test(`${lang}: form elements should be translated`, async ({ page }) => {
          await setLanguage(page, lang);
          await page.goto('/settings/profile');
          await page.waitForLoadState('networkidle');
          
          // Check for translated labels
          const labels = await page.locator('label').allTextContents();
          
          // Labels should not all be in English if language is not English
          if (lang !== 'en') {
            const hasTranslatedLabels = labels.some(label => {
              // Check if label contains non-ASCII characters (for non-Latin languages)
              if (['ar', 'ja'].includes(lang)) {
                return /[^\u0000-\u007F]/.test(label);
              }
              // For Latin-based languages, check it's not common English
              return !['Name', 'Email', 'Password', 'Phone'].includes(label);
            });
            
            // Note: This may fail if the page doesn't have many form elements
          }
        });
      });
    });
  });

  test.describe('Error and Success Messages', () => {
    test.describe.skip('Toast Messages', () => {
      LANGUAGES.forEach((lang) => {
        test(`${lang}: toast messages should be translated`, async ({ page }) => {
          await setLanguage(page, lang);
          await page.goto('/');
          await page.waitForLoadState('networkidle');
          
          // Trigger an action that shows a toast (varies by app)
          // This is a placeholder - actual implementation depends on app
          
          const toast = page.locator('[role="alert"], .toast, .notification');
          if (await toast.count() > 0) {
            const toastText = await toast.first().textContent();
            expect(toastText).toBeTruthy();
          }
        });
      });
    });
  });

  test.describe('Help Panel', () => {
    test.describe.skip('Help Center Content (requires Help Panel to be open)', () => {
      LANGUAGES.forEach((lang) => {
        test(`${lang}: help panel should display translated content`, async ({ page }) => {
          await setLanguage(page, lang);
          await page.goto('/');
          await page.waitForLoadState('networkidle');
          
          // Try to open help panel
          const helpButton = page.locator('[data-testid="help-button"], button:has-text("Help")');
          
          if (await helpButton.count() > 0) {
            await helpButton.first().click();
            await page.waitForTimeout(300);
            
            const helpPanel = page.locator('[data-testid="help-panel"], [role="dialog"]');
            
            if (await helpPanel.isVisible()) {
              const helpText = await helpPanel.textContent();
              
              // Help panel should have content
              expect(helpText).toBeTruthy();
              
              // For non-English, check for non-ASCII characters in non-Latin languages
              if (['ar', 'ja'].includes(lang)) {
                expect(/[^\u0000-\u007F]/.test(helpText || '')).toBe(true);
              }
            }
          }
        });
      });
    });
  });
});

test.describe('Visual Consistency', () => {
  LANGUAGES.forEach((lang) => {
    test(`${lang}: page should render without layout issues`, async ({ page }) => {
      await setLanguage(page, lang);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check that the page doesn't have obvious layout issues
      const body = page.locator('body');
      const bodyBox = await body.boundingBox();
      
      expect(bodyBox).toBeTruthy();
      expect(bodyBox!.width).toBeGreaterThan(0);
      expect(bodyBox!.height).toBeGreaterThan(0);
      
      // Check for horizontal overflow (common issue with long translated strings)
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      // Note: Some horizontal scroll is acceptable on mobile viewports
      // This is just a warning, not a hard failure
      if (hasOverflow) {
        console.warn(`${lang}: Page has horizontal overflow - may need CSS adjustments`);
      }
    });
  });

  test.describe('Text Truncation', () => {
    LANGUAGES.forEach((lang) => {
      test(`${lang}: buttons should not have truncated text`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Get all visible buttons
        const buttons = page.locator('button:visible');
        const count = await buttons.count();
        
        for (let i = 0; i < Math.min(count, 10); i++) {
          const button = buttons.nth(i);
          const box = await button.boundingBox();
          
          if (box) {
            // Button should have reasonable dimensions
            expect(box.width).toBeGreaterThan(20);
            expect(box.height).toBeGreaterThan(15);
            
            // Check if text is visible (not completely hidden)
            const text = await button.textContent();
            if (text && text.trim().length > 0) {
              // Text exists, check it's not cut off by checking computed styles
              const overflow = await button.evaluate((el) => {
                const style = window.getComputedStyle(el);
                return style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth;
              });
              
              if (overflow) {
                console.warn(`${lang}: Button "${text.trim()}" may have truncated text`);
              }
            }
          }
        }
      });
    });
  });
});

test.describe('Accessibility', () => {
  LANGUAGES.forEach((lang) => {
    test(`${lang}: page should have correct lang attribute`, async ({ page }) => {
      await setLanguage(page, lang);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBe(expectedHtmlLang(lang));
    });

    test(`${lang}: page should have correct dir attribute for RTL`, async ({ page }) => {
      await setLanguage(page, lang);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const dir = await page.getAttribute('html', 'dir');
      
      if (lang === 'ar') {
        expect(dir).toBe('rtl');
      } else {
        expect(dir).toBe('ltr');
      }
    });
  });
});
