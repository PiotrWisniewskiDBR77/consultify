import { test, expect } from '@playwright/test';

test.describe('Multi-User Collaboration Flow', () => {
    test('should handle real-time collaboration', async ({ page, context }) => {
        // Login as first user
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/projects');
        await page.click('text=Test Project');

        // Start editing
        await page.click('button:has-text("Edit Description")');
        await page.fill('textarea[name="description"]', 'Updated by first user');

        // Second user joins
        const page2 = await context.newPage();
        await page2.goto('/');
        await page2.click('text=Log In');
        await page2.fill('input[type="email"]', 'user@example.com');
        await page2.fill('input[type="password"]', 'userpass');
        await page2.click('button[type="submit"]');

        await page2.goto('/projects');
        await page2.click('text=Test Project');

        // Should see collaboration indicator
        await expect(page.locator('text=1 other user editing')).toBeVisible();
        await expect(page2.locator('text=1 other user editing')).toBeVisible();
    });

    test('should manage user permissions', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/admin/users');
        await page.click('text=user@example.com');

        // Change permissions
        await page.check('input[name="canEditProjects"]');
        await page.uncheck('input[name="canDeleteItems"]');
        await page.click('button:has-text("Save Permissions")');

        await expect(page.locator('text=Permissions updated')).toBeVisible();
    });

    test('should handle concurrent edits', async ({ page, context }) => {
        // Two users editing the same item
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        const page2 = await context.newPage();
        await page2.goto('/');
        await page2.click('text=Log In');
        await page2.fill('input[type="email"]', 'user@example.com');
        await page2.fill('input[type="password"]', 'userpass');
        await page2.click('button[type="submit"]');

        // Both edit same task
        await page.goto('/tasks');
        await page2.goto('/tasks');

        const firstTask = page.locator('.task-item').first();
        const firstTask2 = page2.locator('.task-item').first();

        if (await firstTask.count() > 0) {
            await firstTask.click();
            await firstTask2.click();

            await page.fill('textarea[name="description"]', 'Edited by admin');
            await page2.fill('textarea[name="description"]', 'Edited by user');

            await page.click('button:has-text("Save")');
            await page2.click('button:has-text("Save")');

            // Should handle conflicts
            await expect(page.locator('.conflict-warning')).toBeVisible();
        }
    });
});














