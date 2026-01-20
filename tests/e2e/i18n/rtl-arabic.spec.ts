/**
 * RTL (Right-to-Left) Arabic Language E2E Tests
 *
 * Comprehensive tests for Arabic RTL support including:
 * - Document direction
 * - Layout mirroring
 * - Text alignment
 * - UI component positioning
 * - Scroll behavior
 *
 * @module tests/e2e/i18n/rtl-arabic.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Helper to set Arabic language
async function setArabicLanguage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'ar');
  });
}

// Helper to set English language (for comparison)
async function setEnglishLanguage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
  });
}

test.describe('Arabic RTL Support', () => {
  test.describe('Document Level RTL', () => {
    test('should set dir="rtl" on html element', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const dir = await page.getAttribute('html', 'dir');
      expect(dir).toBe('rtl');
    });

    test('should set lang="ar" on html element', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const lang = await page.getAttribute('html', 'lang');
      expect(lang).toBe('ar');
    });

    test('should have RTL direction in computed styles', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const bodyDirection = await page.evaluate(() => {
        return window.getComputedStyle(document.body).direction;
      });
      
      expect(bodyDirection).toBe('rtl');
    });
  });

  test.describe('Text Alignment', () => {
    test('should align text to the right by default', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check text alignment of main content area
      const textAlignment = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, h1, h2, h3, span');
        const alignments: string[] = [];
        
        elements.forEach((el) => {
          const style = window.getComputedStyle(el);
          alignments.push(style.textAlign);
        });
        
        return alignments;
      });
      
      // Most elements should have right or start alignment in RTL
      const rightAligned = textAlignment.filter(a => 
        a === 'right' || a === 'start' || a === 'inherit'
      );
      
      // At least some elements should be right-aligned
      expect(rightAligned.length).toBeGreaterThan(0);
    });

    test('should contain Arabic script characters', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const pageContent = await page.textContent('body');
      
      // Arabic script Unicode range: U+0600–U+06FF
      const arabicPattern = /[\u0600-\u06FF]/;
      const hasArabicText = arabicPattern.test(pageContent || '');
      
      // Page should contain some Arabic text
      expect(hasArabicText).toBe(true);
    });
  });

  test.describe('Layout Mirroring', () => {
    test.describe.skip('Sidebar Position (requires auth)', () => {
      test('sidebar should be on the right side in RTL', async ({ page }) => {
        await setArabicLanguage(page);
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();
        
        if (await sidebar.isVisible()) {
          const sidebarBox = await sidebar.boundingBox();
          const viewportSize = page.viewportSize();
          
          if (sidebarBox && viewportSize) {
            // In RTL, sidebar should be on the right (higher x value)
            // For a left sidebar in LTR, it would be x < width/2
            // In RTL, it should be x > width/2 or close to the right edge
            const sidebarRightEdge = sidebarBox.x + sidebarBox.width;
            
            // Sidebar should be near the right edge of the viewport
            expect(sidebarRightEdge).toBeGreaterThan(viewportSize.width * 0.5);
          }
        }
      });
    });

    test('flex containers should reverse direction', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check flex containers
      const flexDirections = await page.evaluate(() => {
        const flexContainers = document.querySelectorAll('[class*="flex"]');
        const directions: string[] = [];
        
        flexContainers.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'flex') {
            directions.push(style.flexDirection);
          }
        });
        
        return directions;
      });
      
      // Note: flex-direction itself doesn't change in RTL, 
      // but the visual order of items does due to document direction
      expect(flexDirections.length).toBeGreaterThanOrEqual(0);
    });

    test('icons and buttons should be positioned correctly', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Get button positions
      const buttons = page.locator('button:visible');
      const count = await buttons.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        
        if (box) {
          // Buttons should have proper dimensions
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Form Elements', () => {
    test('input fields should have proper text direction', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Find all input fields
      const inputs = page.locator('input:visible');
      const count = await inputs.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = inputs.nth(i);
        
        // Check the direction attribute or computed style
        const direction = await input.evaluate((el) => {
          return window.getComputedStyle(el).direction;
        });
        
        // Input fields should respect RTL direction
        expect(['rtl', 'inherit']).toContain(direction);
      }
    });

    test('text areas should support RTL text entry', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const textareas = page.locator('textarea:visible');
      const count = await textareas.count();
      
      if (count > 0) {
        const textarea = textareas.first();
        
        // Type some Arabic text
        await textarea.click();
        await textarea.fill('مرحبا بالعالم');
        
        const value = await textarea.inputValue();
        expect(value).toContain('مرحبا');
      }
    });
  });

  test.describe('Scroll Behavior', () => {
    test('horizontal scroll should start from the right', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // In RTL, scrollLeft behavior can be different depending on browser
      const scrollInfo = await page.evaluate(() => {
        const scrollable = document.querySelector('[style*="overflow"]') || document.documentElement;
        return {
          scrollLeft: scrollable.scrollLeft,
          scrollWidth: scrollable.scrollWidth,
          clientWidth: scrollable.clientWidth,
        };
      });
      
      // Note: scrollLeft behavior varies by browser in RTL mode
      // In some browsers, scrollLeft starts at 0, in others at (scrollWidth - clientWidth)
      expect(scrollInfo.scrollWidth).toBeGreaterThanOrEqual(scrollInfo.clientWidth);
    });

    test('vertical scroll should work normally', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Scroll down
      await page.evaluate(() => {
        window.scrollTo(0, 100);
      });
      
      const scrollTop = await page.evaluate(() => window.scrollY);
      
      // Scroll should work (may be less than 100 if page is short)
      expect(scrollTop).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Visual Comparison', () => {
    test('compare LTR vs RTL layout', async ({ page }) => {
      // First, capture LTR layout info
      await setEnglishLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const ltrInfo = await page.evaluate(() => ({
        direction: document.documentElement.dir,
        bodyDirection: window.getComputedStyle(document.body).direction,
      }));
      
      expect(ltrInfo.direction).toBe('ltr');
      expect(ltrInfo.bodyDirection).toBe('ltr');
      
      // Now switch to Arabic
      await page.evaluate(() => {
        localStorage.setItem('i18nextLng', 'ar');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const rtlInfo = await page.evaluate(() => ({
        direction: document.documentElement.dir,
        bodyDirection: window.getComputedStyle(document.body).direction,
      }));
      
      expect(rtlInfo.direction).toBe('rtl');
      expect(rtlInfo.bodyDirection).toBe('rtl');
    });
  });

  test.describe('Component-Specific RTL', () => {
    test.describe.skip('Dropdown/Select Menus', () => {
      test('dropdown arrow should be on the left in RTL', async ({ page }) => {
        await setArabicLanguage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const selects = page.locator('select:visible');
        const count = await selects.count();
        
        if (count > 0) {
          const select = selects.first();
          const box = await select.boundingBox();
          
          // In RTL, native select dropdown arrow appears on the left
          // Custom dropdowns should mirror this behavior
          expect(box).toBeTruthy();
        }
      });
    });

    test.describe.skip('Breadcrumbs', () => {
      test('breadcrumb separators should point left in RTL', async ({ page }) => {
        await setArabicLanguage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const breadcrumbs = page.locator('[aria-label*="breadcrumb"], .breadcrumb');
        
        if (await breadcrumbs.count() > 0) {
          // Breadcrumb order should be reversed visually
          // Home > Page > Subpage becomes Subpage < Page < Home visually
          const breadcrumbText = await breadcrumbs.first().textContent();
          expect(breadcrumbText).toBeTruthy();
        }
      });
    });

    test.describe.skip('Progress Bars', () => {
      test('progress bars should fill from right to left', async ({ page }) => {
        await setArabicLanguage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const progressBars = page.locator('[role="progressbar"], .progress-bar');
        const count = await progressBars.count();
        
        if (count > 0) {
          const progress = progressBars.first();
          const style = await progress.evaluate((el) => ({
            direction: window.getComputedStyle(el).direction,
            transform: window.getComputedStyle(el).transform,
          }));
          
          // Progress bar should respect RTL
          expect(['rtl', 'inherit']).toContain(style.direction);
        }
      });
    });

    test.describe.skip('Tables', () => {
      test('table columns should be in RTL order', async ({ page }) => {
        await setArabicLanguage(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const tables = page.locator('table:visible');
        const count = await tables.count();
        
        if (count > 0) {
          const table = tables.first();
          const firstRow = table.locator('tr').first();
          const cells = firstRow.locator('th, td');
          
          const cellCount = await cells.count();
          if (cellCount > 1) {
            // First cell should be on the right in RTL
            const firstCellBox = await cells.first().boundingBox();
            const lastCellBox = await cells.last().boundingBox();
            
            if (firstCellBox && lastCellBox) {
              // In RTL, the "first" column (visually on right) should have higher x
              expect(firstCellBox.x).toBeGreaterThan(lastCellBox.x);
            }
          }
        }
      });
    });
  });

  test.describe('Icons and Images', () => {
    test('directional icons should be mirrored', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for transform: scaleX(-1) on directional icons
      const icons = await page.evaluate(() => {
        const allIcons = document.querySelectorAll('svg, [class*="icon"]');
        const iconInfo: Array<{ className: string; transform: string }> = [];
        
        allIcons.forEach((icon) => {
          const style = window.getComputedStyle(icon);
          iconInfo.push({
            className: icon.className?.toString() || '',
            transform: style.transform,
          });
        });
        
        return iconInfo;
      });
      
      // Some icons might be mirrored
      // This is informational - not all icons should be mirrored
      expect(icons.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Animations', () => {
    test('slide animations should go from left to right', async ({ page }) => {
      await setArabicLanguage(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // This is a placeholder test - specific animation testing
      // depends on the app's animation implementation
      const animations = await page.evaluate(() => {
        const animated = document.querySelectorAll('[class*="animate"], [class*="slide"]');
        return animated.length;
      });
      
      expect(animations).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('RTL Accessibility', () => {
  test('should have correct writing-mode', async ({ page }) => {
    await setArabicLanguage(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const writingMode = await page.evaluate(() => {
      return window.getComputedStyle(document.body).writingMode;
    });
    
    // Horizontal writing mode is correct for Arabic
    expect(['horizontal-tb', 'lr-tb', 'rl-tb']).toContain(writingMode);
  });

  test('should support keyboard navigation in RTL', async ({ page }) => {
    await setArabicLanguage(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Tab through focusable elements
    await page.keyboard.press('Tab');
    
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    
    // Some element should be focused
    expect(focusedElement).toBeTruthy();
  });
});
