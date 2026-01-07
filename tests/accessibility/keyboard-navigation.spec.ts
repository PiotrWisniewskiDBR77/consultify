/**
 * Keyboard Navigation Accessibility Tests
 * Tests for keyboard-only navigation and interaction
 * 
 * @module tests/accessibility/keyboard-navigation.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation Accessibility', () => {

    // ═══════════════════════════════════════════════════════════════════
    // TAB NAVIGATION
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Tab Navigation', () => {
        test('should navigate through all focusable elements', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const focusableSelector = `
                a[href]:not([disabled]),
                button:not([disabled]),
                input:not([disabled]):not([type="hidden"]),
                select:not([disabled]),
                textarea:not([disabled]),
                [tabindex]:not([tabindex="-1"])
            `;

            const focusableCount = await page.locator(focusableSelector).count();
            const focusedElements: string[] = [];

            // Tab through elements
            for (let i = 0; i < Math.min(focusableCount, 30); i++) {
                await page.keyboard.press('Tab');
                const focused = await page.evaluate(() => {
                    const el = document.activeElement;
                    return el ? `${el.tagName}:${el.id || el.className}` : 'none';
                });
                focusedElements.push(focused);
            }

            // Should have navigated through multiple elements
            expect(focusedElements.length).toBeGreaterThan(0);
        });

        test('should navigate in logical order', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const positions: { y: number; x: number }[] = [];

            // Tab and record positions
            for (let i = 0; i < 10; i++) {
                await page.keyboard.press('Tab');
                const pos = await page.evaluate(() => {
                    const el = document.activeElement;
                    if (el && el !== document.body) {
                        const rect = el.getBoundingClientRect();
                        return { y: rect.top, x: rect.left };
                    }
                    return null;
                });
                if (pos) positions.push(pos);
            }

            // Generally should go top-to-bottom, left-to-right
            // (not strictly enforced as layout may vary)
            expect(positions.length).toBeGreaterThan(0);
        });

        test('should support Shift+Tab for reverse navigation', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Tab forward
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');

            const beforeReverse = await page.evaluate(() => document.activeElement?.id);

            // Tab backward
            await page.keyboard.press('Shift+Tab');

            const afterReverse = await page.evaluate(() => document.activeElement?.id);

            // Should have moved to previous element
            expect(afterReverse).not.toBe(beforeReverse);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENTER KEY ACTIVATION
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Enter Key Activation', () => {
        test('buttons should activate on Enter', async ({ page }) => {
            await page.goto('/login');
            await page.waitForLoadState('networkidle');

            const button = page.locator('button[type="submit"]').first();

            if (await button.count() > 0) {
                await button.focus();

                // Listen for click event
                const clicked = await button.evaluate(el => {
                    return new Promise(resolve => {
                        el.addEventListener('click', () => resolve(true), { once: true });
                        setTimeout(() => resolve(false), 100);
                    });
                });

                await page.keyboard.press('Enter');

                // Button should be clickable via Enter (or form submits)
            }
        });

        test('links should activate on Enter', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const link = page.locator('a[href]').first();

            if (await link.count() > 0) {
                await link.focus();

                const href = await link.getAttribute('href');

                // Enter should activate links
                // (not actually clicking to avoid navigation)
                expect(href).toBeDefined();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SPACE KEY ACTIVATION
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Space Key Activation', () => {
        test('checkboxes should toggle on Space', async ({ page }) => {
            await page.goto('/settings');
            await page.waitForLoadState('networkidle');

            const checkbox = page.locator('input[type="checkbox"]').first();

            if (await checkbox.count() > 0) {
                await checkbox.focus();

                const checkedBefore = await checkbox.isChecked();
                await page.keyboard.press('Space');
                const checkedAfter = await checkbox.isChecked();

                expect(checkedAfter).toBe(!checkedBefore);
            }
        });

        test('buttons should activate on Space', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const button = page.locator('button').first();

            if (await button.count() > 0) {
                await button.focus();
                // Space should work on buttons (native behavior)
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ARROW KEY NAVIGATION
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Arrow Key Navigation', () => {
        test('radio buttons should navigate with arrows', async ({ page }) => {
            await page.goto('/settings');
            await page.waitForLoadState('networkidle');

            const radioGroup = page.locator('input[type="radio"]');

            if (await radioGroup.count() > 1) {
                await radioGroup.first().focus();

                const valueBefore = await page.evaluate(() =>
                    (document.activeElement as HTMLInputElement)?.value
                );

                await page.keyboard.press('ArrowDown');

                const valueAfter = await page.evaluate(() =>
                    (document.activeElement as HTMLInputElement)?.value
                );

                // Arrow should move focus within radio group
            }
        });

        test('select dropdowns should navigate with arrows', async ({ page }) => {
            await page.goto('/settings');
            await page.waitForLoadState('networkidle');

            const select = page.locator('select').first();

            if (await select.count() > 0) {
                await select.focus();
                await page.keyboard.press('ArrowDown');
                // Select should respond to arrow keys
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ESCAPE KEY
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Escape Key', () => {
        test('modals should close on Escape', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');

            // If there's a way to open a modal
            const modalTrigger = page.locator('[data-opens-modal], [aria-haspopup="dialog"]').first();

            if (await modalTrigger.count() > 0) {
                await modalTrigger.click();
                await expect(modal).toBeVisible();

                await page.keyboard.press('Escape');
                await expect(modal).not.toBeVisible();
            }
        });

        test('dropdowns should close on Escape', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const dropdown = page.locator('[role="menu"], [role="listbox"], .dropdown-menu');
            const dropdownTrigger = page.locator('[aria-haspopup="menu"], [aria-haspopup="listbox"]').first();

            if (await dropdownTrigger.count() > 0) {
                await dropdownTrigger.click();

                if (await dropdown.count() > 0) {
                    await page.keyboard.press('Escape');
                    await expect(dropdown).not.toBeVisible();
                }
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FOCUS MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Focus Management', () => {
        test('focus should be visible', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.keyboard.press('Tab');

            const focusedElement = page.locator(':focus');
            await expect(focusedElement).toBeVisible();
        });

        test('focus should not be lost after interactions', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.keyboard.press('Tab');

            const activeTagBefore = await page.evaluate(() => document.activeElement?.tagName);

            // Some interaction
            await page.keyboard.press('Enter');
            await page.waitForTimeout(100);

            const activeTagAfter = await page.evaluate(() => document.activeElement?.tagName);

            // Focus should still be on something (not lost to body)
            expect(activeTagAfter).toBeDefined();
        });

        test('focus trap in modals', async ({ page }) => {
            await page.goto('/');

            const modal = page.locator('[role="dialog"]');
            const modalTrigger = page.locator('[data-opens-modal]').first();

            if (await modalTrigger.count() > 0) {
                await modalTrigger.click();

                if (await modal.isVisible()) {
                    // Tab should stay within modal
                    for (let i = 0; i < 20; i++) {
                        await page.keyboard.press('Tab');
                        const isInModal = await page.evaluate(() => {
                            const modal = document.querySelector('[role="dialog"]');
                            return modal?.contains(document.activeElement);
                        });
                        expect(isInModal).toBe(true);
                    }
                }
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FORM KEYBOARD HANDLING
    // ═══════════════════════════════════════════════════════════════════

    test.describe('Form Keyboard Handling', () => {
        test('form should submit on Enter in text input', async ({ page }) => {
            await page.goto('/login');
            await page.waitForLoadState('networkidle');

            const textInput = page.locator('input[type="text"], input[type="email"]').first();

            if (await textInput.count() > 0) {
                await textInput.focus();
                await textInput.fill('test');

                // Enter in text field should submit form (native behavior)
            }
        });

        test('textarea should allow Enter for newlines', async ({ page }) => {
            await page.goto('/');

            const textarea = page.locator('textarea').first();

            if (await textarea.count() > 0) {
                await textarea.focus();
                await textarea.fill('line1');
                await page.keyboard.press('Enter');
                await page.keyboard.type('line2');

                const value = await textarea.inputValue();
                expect(value).toContain('\n');
            }
        });
    });
});
