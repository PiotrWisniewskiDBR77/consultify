import { test, expect } from '@playwright/test';

test.describe('Large Dataset Tests', () => {
    test('should handle 1000+ tasks efficiently', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        const startTime = Date.now();

        await page.goto('/tasks');
        await page.waitForSelector('.task-item');

        const loadTime = Date.now() - startTime;

        // Should load within reasonable time
        expect(loadTime).toBeLessThan(5000);

        // Check if virtualization is used
        const allTasks = await page.locator('.task-item').count();
        const visibleTasks = await page.locator('.task-item:visible').count();

        if (allTasks > visibleTasks) {
            // Virtualization is working
            expect(visibleTasks).toBeLessThan(allTasks);
        }

        // Test filtering with large dataset
        await page.fill('input[name="search"]', 'test');
        await page.click('button:has-text("Search")');

        const filteredCount = await page.locator('.task-item').count();
        expect(filteredCount).toBeLessThanOrEqual(allTasks);

        // Test pagination
        if (allTasks > 50) {
            await expect(page.locator('.pagination')).toBeVisible();

            // Navigate to next page
            await page.click('button:has-text("Next")');
            await expect(page.locator('.task-item')).toBeVisible();
        }
    });

    test('should handle projects with complex hierarchies', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/projects');

        // Test expanding/collapsing project hierarchies
        const expandableProjects = page.locator('.project-item').filter({ hasText: '▶' });
        if (await expandableProjects.count() > 0) {
            const startTime = Date.now();

            await expandableProjects.first().click();
            await page.waitForSelector('.sub-project-item');

            const expandTime = Date.now() - startTime;
            expect(expandTime).toBeLessThan(1000);

            // Should show sub-projects
            await expect(page.locator('.sub-project-item')).toBeVisible();
        }
    });

    test('should process large reports efficiently', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/reports');

        const startTime = Date.now();

        // Generate comprehensive report
        await page.click('button:has-text("Generate Full Report")');
        await page.waitForSelector('.report-content', { timeout: 30000 });

        const reportTime = Date.now() - startTime;

        // Should generate within reasonable time
        expect(reportTime).toBeLessThan(20000);

        // Should have substantial content
        const reportContent = await page.locator('.report-content').textContent();
        expect(reportContent?.length).toBeGreaterThan(1000);
    });

    test('should handle bulk operations on large datasets', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/tasks');

        // Select multiple tasks for bulk operation
        const taskCheckboxes = page.locator('.task-checkbox');
        const checkboxCount = await taskCheckboxes.count();

        if (checkboxCount > 3) {
            // Select first 3 tasks
            for (let i = 0; i < 3; i++) {
                await taskCheckboxes.nth(i).check();
            }

            const startTime = Date.now();

            // Perform bulk status update
            await page.selectOption('select[name="bulkStatus"]', 'completed');
            await page.click('button:has-text("Apply to Selected")');

            const bulkOperationTime = Date.now() - startTime;

            // Should complete quickly
            expect(bulkOperationTime).toBeLessThan(3000);

            // Verify changes
            for (let i = 0; i < 3; i++) {
                await expect(page.locator('.task-item').nth(i).locator('.status-badge').filter({ hasText: 'Completed' })).toBeVisible();
            }
        }
    });
});














