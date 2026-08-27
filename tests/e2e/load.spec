import { test, expect } from '@playwright/test';

test.describe('Load Testing', () => {
    test('should handle multiple simultaneous users', async ({ browser }) => {
        const userCount = 5;
        const pages = [];

        // Create multiple user sessions
        for (let i = 0; i < userCount; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();
            pages.push(page);

            // Login as different users
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', `user${i}@example.com`);
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
        }

        // All users perform actions simultaneously
        const actions = pages.map(async (page, index) => {
            await page.goto('/tasks');
            await page.click('button:has-text("New Task")');
            await page.fill('input[name="title"]', `Load Test Task ${index}`);
            await page.fill('textarea[name="description"]', `Task created during load test by user ${index}`);
            await page.click('button:has-text("Create Task")');

            return page.locator(`text=Load Test Task ${index}`).waitFor();
        });

        // Wait for all actions to complete
        await Promise.all(actions);

        // Verify all tasks were created
        for (let i = 0; i < userCount; i++) {
            await expect(pages[0].locator(`text=Load Test Task ${i}`)).toBeVisible();
        }

        // Cleanup
        for (const page of pages) {
            await page.context().close();
        }
    });

    test('should handle large data sets', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        const startTime = Date.now();

        await page.goto('/projects');
        await page.waitForSelector('.project-item');

        const loadTime = Date.now() - startTime;

        // Should load within reasonable time even with large datasets
        expect(loadTime).toBeLessThan(5000);

        // Test pagination or virtualization
        const projectCount = await page.locator('.project-item').count();
        if (projectCount > 20) {
            // Should have pagination
            await expect(page.locator('.pagination')).toBeVisible();
        }
    });

    test('should handle rapid API calls', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        // Rapid navigation between pages
        const pages = ['/projects', '/tasks', '/analytics', '/settings'];
        const startTime = Date.now();

        for (let i = 0; i < 10; i++) {
            for (const pagePath of pages) {
                await page.goto(pagePath);
                await page.waitForLoadState('networkidle');
            }
        }

        const totalTime = Date.now() - startTime;
        const avgPageLoad = totalTime / (10 * pages.length);

        // Average page load should be reasonable
        expect(avgPageLoad).toBeLessThan(2000);
    });
});














