import { test, expect } from '@playwright/test';

/**
 * Level 4: E2E Tests - Full User Flows
 * Tests complete user journeys through the application
 */
test.describe('Full User Flow Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Login as User (Justyna)
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'justyna.laskowska@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        // Wait for dashboard (UserTaskList)
        await expect(page.locator('text=My Action Plan').first()).toBeVisible();
    });

    test('should complete intro assessment flow', async ({ page }) => {
        // Navigate via Sidebar: Intro -> Company Profile
        await page.hover('div.fixed.z-50');

        // Expand Intro if needed
        const introLink = page.locator('text=Intro');
        if (await introLink.isVisible()) {
            // Intro might be a parent menu or link. 
            // Ideally we check if "Company Profile" is visible.
            if (!(await page.isVisible('text=Company Profile'))) {
                await introLink.click();
            }
            await page.click('text=Company Profile');
            await expect(page.locator('text=Company Profile').first()).toBeVisible();
        } else {
            // If Intro text not visible, sidebar confusion?
            console.log('Intro link not found');
        }
    });

    test('should navigate through accessible modules', async ({ page }) => {
        const modules = [
            // Dashboard is default
            { name: 'Settings', selector: 'text=Settings', isFloating: true },
            { name: 'Intro', selector: 'text=Intro', subItem: 'text=Goals & Expectations' }
        ];

        for (const module of modules) {
            await page.hover('div.fixed.z-50');
            await page.waitForTimeout(500);

            if (module.isFloating) {
                await page.hover(module.selector);
                await page.waitForSelector('text=My Profile', { state: 'visible' });
                await expect(page.locator('text=My Profile')).toBeVisible();
            } else {
                if (await page.isVisible(module.selector)) {
                    await page.click(module.selector);
                    if (module.subItem) {
                        await page.waitForSelector(module.subItem);
                        await page.click(module.subItem);
                        await expect(page.locator(module.subItem).first()).toBeVisible();
                    } else {
                        await expect(page.locator('h1, h2')).toBeVisible();
                    }
                }
            }
            // Return to dashboard
            await page.hover('div.fixed.z-50');
            await page.click('text=Dashboard');
            await page.waitForTimeout(500);
        }
    });

    test('should handle task creation and assignment', async ({ page }) => {
        // We are on My Action Plan (Dashboard)
        await expect(page.locator('text=Action Plan')).toBeVisible();

        // Look for create task button
        const createTaskButton = page.locator('button:has-text("Add Task")').first();
        if (await createTaskButton.isVisible()) {
            await createTaskButton.click();

            // Fill task form (Modal)
            await page.fill('input[placeholder*="Title"]', 'E2E Test Task'); // Loose selector
            await page.fill('textarea[placeholder*="Description"]', 'Test task description');

            // Save task
            await page.click('button:has-text("Create"), button:has-text("Save")');

            // Verify task appears
            await expect(page.locator('text=E2E Test Task')).toBeVisible();
        }
    });
});
