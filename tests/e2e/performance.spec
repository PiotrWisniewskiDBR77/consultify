import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
    test('should load dashboard within acceptable time', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        // Wait for dashboard to load
        await page.waitForSelector('text=System Overview');

        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle large task lists efficiently', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        const startTime = Date.now();

        await page.goto('/tasks');
        // Wait for task list to render
        await page.waitForSelector('.task-item');

        const renderTime = Date.now() - startTime;
        expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds

        // Check virtualization if many items
        const taskCount = await page.locator('.task-item').count();
        if (taskCount > 50) {
            // Should use virtualization
            const visibleTasks = await page.locator('.task-item:visible').count();
            expect(visibleTasks).toBeLessThan(taskCount);
        }
    });

    test('should maintain performance during extended use', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        const memoryUsages: number[] = [];

        // Simulate extended usage
        for (let i = 0; i < 10; i++) {
            await page.goto('/projects');
            await page.goto('/tasks');
            await page.goto('/analytics');

            // Check memory usage (if available)
            try {
                const metrics = await page.evaluate(() => ({
                    jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit,
                    totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
                    usedJSHeapSize: (performance as any).memory?.usedJSHeapSize
                }));

                if (metrics.usedJSHeapSize) {
                    memoryUsages.push(metrics.usedJSHeapSize);
                }
            } catch (e) {
                // Memory API not available
            }

            await page.waitForTimeout(1000);
        }

        // Memory should not grow excessively
        if (memoryUsages.length > 1) {
            const initialMemory = memoryUsages[0];
            const finalMemory = memoryUsages[memoryUsages.length - 1];
            const growth = (finalMemory - initialMemory) / initialMemory;

            expect(growth).toBeLessThan(0.5); // Less than 50% growth
        }
    });
});














