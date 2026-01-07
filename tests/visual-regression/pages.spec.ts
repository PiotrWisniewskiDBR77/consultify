/**
 * Visual Regression Tests
 * Playwright screenshot comparison tests for UI consistency
 * 
 * @module tests/visual-regression/pages.spec.ts
 */

import { test, expect } from '@playwright/test';

// Pages to capture for visual regression
const pagesToCapture = [
    { name: 'home', path: '/', waitFor: 'networkidle' },
    { name: 'login', path: '/login', waitFor: 'networkidle' },
    { name: 'register', path: '/register', waitFor: 'networkidle' },
    { name: 'dashboard', path: '/dashboard', waitFor: 'networkidle', requiresAuth: true },
    { name: 'settings', path: '/settings', waitFor: 'networkidle', requiresAuth: true },
];

// Viewport sizes to test
const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
];

test.describe('Visual Regression Tests', () => {

    // ═══════════════════════════════════════════════════════════════════
    // PAGE SCREENSHOTS
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Page Screenshots', () => {
        for (const page of pagesToCapture) {
            if (!page.requiresAuth) {
                test(`${page.name} page should match snapshot`, async ({ page: browserPage }) => {
                    await browserPage.goto(page.path);
                    await browserPage.waitForLoadState(page.waitFor as 'networkidle' | 'load');

                    // Wait for animations to complete
                    await browserPage.waitForTimeout(500);

                    // Hide dynamic content that changes between runs
                    await browserPage.evaluate(() => {
                        // Hide timestamps, avatars, or other dynamic elements
                        document.querySelectorAll('[data-dynamic]').forEach(el => {
                            (el as HTMLElement).style.visibility = 'hidden';
                        });
                    });

                    await expect(browserPage).toHaveScreenshot(`${page.name}.png`, {
                        fullPage: true,
                        animations: 'disabled',
                        maxDiffPixelRatio: 0.05, // Allow 5% difference
                    });
                });
            }
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // RESPONSIVE DESIGN
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Responsive Design', () => {
        for (const viewport of viewports) {
            test(`home page on ${viewport.name}`, async ({ page }) => {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.goto('/');
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(300);

                await expect(page).toHaveScreenshot(`home-${viewport.name}.png`, {
                    fullPage: false, // Just viewport
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.05,
                });
            });
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // COMPONENT SCREENSHOTS
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Component Screenshots', () => {
        test('navigation bar', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const navbar = page.locator('nav, header, [role="navigation"]').first();

            if (await navbar.count() > 0) {
                await expect(navbar).toHaveScreenshot('navbar.png', {
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.05,
                });
            }
        });

        test('footer', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const footer = page.locator('footer, [role="contentinfo"]').first();

            if (await footer.count() > 0) {
                await expect(footer).toHaveScreenshot('footer.png', {
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.05,
                });
            }
        });

        test('login form', async ({ page }) => {
            await page.goto('/login');
            await page.waitForLoadState('networkidle');

            const form = page.locator('form').first();

            if (await form.count() > 0) {
                await expect(form).toHaveScreenshot('login-form.png', {
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.05,
                });
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STATE VARIATIONS
    // ═══════════════════════════════════════════════════════════════════

    test.describe('State Variations', () => {
        test('button hover state', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const button = page.locator('button').first();

            if (await button.count() > 0) {
                await button.hover();
                await page.waitForTimeout(200);

                await expect(button).toHaveScreenshot('button-hover.png', {
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.1,
                });
            }
        });

        test('button focus state', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const button = page.locator('button').first();

            if (await button.count() > 0) {
                await button.focus();
                await page.waitForTimeout(100);

                await expect(button).toHaveScreenshot('button-focus.png', {
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.1,
                });
            }
        });

        test('input focus state', async ({ page }) => {
            await page.goto('/login');
            await page.waitForLoadState('networkidle');

            const input = page.locator('input').first();

            if (await input.count() > 0) {
                await input.focus();
                await page.waitForTimeout(100);

                await expect(input).toHaveScreenshot('input-focus.png', {
                    animations: 'disabled',
                    maxDiffPixelRatio: 0.1,
                });
            }
        });

        test('input with error state', async ({ page }) => {
            await page.goto('/login');
            await page.waitForLoadState('networkidle');

            // Submit empty form to trigger validation
            const submitBtn = page.locator('button[type="submit"]');

            if (await submitBtn.count() > 0) {
                await submitBtn.click();
                await page.waitForTimeout(300);

                const errorInput = page.locator('[aria-invalid="true"], .error, .is-invalid').first();

                if (await errorInput.count() > 0) {
                    await expect(errorInput).toHaveScreenshot('input-error.png', {
                        animations: 'disabled',
                        maxDiffPixelRatio: 0.1,
                    });
                }
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DARK MODE
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Dark Mode', () => {
        test('home page in dark mode', async ({ page }) => {
            // Set dark mode preference
            await page.emulateMedia({ colorScheme: 'dark' });
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);

            await expect(page).toHaveScreenshot('home-dark.png', {
                fullPage: true,
                animations: 'disabled',
                maxDiffPixelRatio: 0.05,
            });
        });

        test('login page in dark mode', async ({ page }) => {
            await page.emulateMedia({ colorScheme: 'dark' });
            await page.goto('/login');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);

            await expect(page).toHaveScreenshot('login-dark.png', {
                fullPage: true,
                animations: 'disabled',
                maxDiffPixelRatio: 0.05,
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HIGH CONTRAST
    // ═══════════════════════════════════════════════════════════════════

    test.describe('High Contrast Mode', () => {
        test('home page in forced colors', async ({ page }) => {
            await page.emulateMedia({ forcedColors: 'active' });
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await expect(page).toHaveScreenshot('home-high-contrast.png', {
                fullPage: true,
                animations: 'disabled',
                maxDiffPixelRatio: 0.1,
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PRINT STYLES
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Print Styles', () => {
        test('home page print view', async ({ page }) => {
            await page.emulateMedia({ media: 'print' });
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await expect(page).toHaveScreenshot('home-print.png', {
                fullPage: true,
                animations: 'disabled',
                maxDiffPixelRatio: 0.1,
            });
        });
    });
});
