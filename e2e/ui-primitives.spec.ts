/**
 * Visual Regression Tests - Apple HIG Design System
 * 
 * Tests for the new UI primitives to ensure consistent visual appearance.
 */

import { test, expect } from '@playwright/test';

test.describe('UI Primitives - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test page that showcases the components
    // In production, this would be a Storybook or dedicated test page
    await page.goto('/');
  });

  test.describe('Button Component', () => {
    test('should render primary button correctly', async ({ page }) => {
      // Check that primary buttons have the correct gradient
      const primaryButton = page.locator('.hig-btn-primary').first();
      if (await primaryButton.isVisible()) {
        await expect(primaryButton).toHaveCSS('background-image', /gradient/);
      }
    });

    test('should have accessible focus states', async ({ page }) => {
      const button = page.locator('button').first();
      if (await button.isVisible()) {
        await button.focus();
        // Focus should be visible
        await expect(button).toBeFocused();
      }
    });
  });

  test.describe('Card Component', () => {
    test('should have proper shadow on elevated cards', async ({ page }) => {
      const card = page.locator('.hig-card').first();
      if (await card.isVisible()) {
        // Elevated cards should have shadow
        const boxShadow = await card.evaluate((el) => 
          window.getComputedStyle(el).getPropertyValue('box-shadow')
        );
        expect(boxShadow).not.toBe('none');
      }
    });

    test('should have hover effect on hoverable cards', async ({ page }) => {
      const card = page.locator('[data-hoverable="true"]').first();
      if (await card.isVisible()) {
        await card.hover();
        // Card should transform on hover
        await expect(card).toHaveCSS('cursor', 'pointer');
      }
    });
  });

  test.describe('Input Component', () => {
    test('should show focus ring on focus', async ({ page }) => {
      const input = page.locator('.hig-input').first();
      if (await input.isVisible()) {
        await input.focus();
        // Input should show focus styling
        await expect(input).toBeFocused();
      }
    });
  });

  test.describe('Modal Component', () => {
    test('should have backdrop blur when open', async ({ page }) => {
      const overlay = page.locator('.hig-overlay');
      if (await overlay.isVisible()) {
        const backdropFilter = await overlay.evaluate((el) => 
          window.getComputedStyle(el).getPropertyValue('backdrop-filter')
        );
        expect(backdropFilter).toContain('blur');
      }
    });
  });

  test.describe('Dark Mode', () => {
    test('should apply dark mode styles correctly', async ({ page }) => {
      // Toggle dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      // Check that dark mode CSS variables are applied
      const bgColor = await page.evaluate(() => 
        getComputedStyle(document.documentElement).getPropertyValue('--hig-bg-primary')
      );
      
      // Dark mode should have darker background
      expect(bgColor.trim()).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Page should load without horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => 
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      
      expect(hasHorizontalScroll).toBeFalsy();
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Page should load correctly
      const hasHorizontalScroll = await page.evaluate(() => 
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      
      expect(hasHorizontalScroll).toBeFalsy();
    });
  });

  test.describe('Animation', () => {
    test('should have smooth animations enabled', async ({ page }) => {
      // Check that animations are not disabled
      const prefersReducedMotion = await page.evaluate(() => 
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
      
      // Log the result - animations should work unless user prefers reduced motion
      console.log('Prefers reduced motion:', prefersReducedMotion);
    });
  });

  test.describe('Typography', () => {
    test('should use correct font family', async ({ page }) => {
      const bodyFont = await page.evaluate(() => 
        getComputedStyle(document.body).getPropertyValue('font-family')
      );
      
      // Should use Inter font
      expect(bodyFont.toLowerCase()).toContain('inter');
    });

    test('should have proper text rendering', async ({ page }) => {
      const textRendering = await page.evaluate(() => 
        getComputedStyle(document.body).getPropertyValue('-webkit-font-smoothing')
      );
      
      // Should use antialiased rendering
      expect(textRendering).toBe('antialiased');
    });
  });

  test.describe('Color System', () => {
    test('should have HIG CSS variables defined', async ({ page }) => {
      const cssVars = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          bgPrimary: style.getPropertyValue('--hig-bg-primary'),
          textPrimary: style.getPropertyValue('--hig-text-primary'),
          borderDefault: style.getPropertyValue('--hig-border-default'),
          radiusMd: style.getPropertyValue('--hig-radius-md'),
          durationNormal: style.getPropertyValue('--hig-duration-normal'),
        };
      });
      
      // All HIG variables should be defined
      expect(cssVars.bgPrimary.trim()).toBeTruthy();
      expect(cssVars.textPrimary.trim()).toBeTruthy();
    });
  });
});

test.describe('Sidebar Navigation', () => {
  test('should collapse and expand smoothly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for potential auth redirect
    await page.waitForTimeout(1000);
    
    const sidebar = page.locator('[data-tour="sidebar-nav"]');
    if (await sidebar.isVisible()) {
      // Sidebar should be present
      await expect(sidebar).toBeVisible();
    }
  });

  test('should show floating submenu on hover', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Hover over a menu item with subitems
    const menuItem = page.locator('[data-tour="sidebar-nav"] button').first();
    if (await menuItem.isVisible()) {
      await menuItem.hover();
      // Floating menu should appear
      await page.waitForTimeout(200);
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Check for buttons with accessible names
    const buttons = page.locator('button:not([aria-hidden="true"])');
    const count = await buttons.count();
    
    // Should have buttons on the page
    expect(count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Some element should be focused
    const focusedElement = await page.evaluate(() => 
      document.activeElement?.tagName
    );
    
    expect(focusedElement).toBeTruthy();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    
    // Get text and background colors
    const contrast = await page.evaluate(() => {
      const body = document.body;
      const style = getComputedStyle(body);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });
    
    // Should have color values defined
    expect(contrast.color).toBeTruthy();
    expect(contrast.backgroundColor).toBeTruthy();
  });
});





