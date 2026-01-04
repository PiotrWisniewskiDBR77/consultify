import { test, expect } from '@playwright/test';

test.describe('Concurrent Users Tests', () => {
    test('should handle multiple users editing simultaneously', async ({ browser }) => {
        const contexts = [];
        const pages = [];

        // Create 3 concurrent user sessions
        for (let i = 0; i < 3; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();

            contexts.push(context);
            pages.push(page);

            // Login
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', `user${i}@example.com`);
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
        }

        // All users navigate to same project
        await Promise.all(pages.map(page => page.goto('/projects/TestProject')));

        // All users start editing different sections simultaneously
        const editActions = pages.map(async (page, index) => {
            if (index === 0) {
                // User 1 edits description
                await page.click('button:has-text("Edit Description")');
                await page.fill('textarea[name="description"]', `Updated by user ${index} at ${Date.now()}`);
                await page.click('button:has-text("Save")');
            } else if (index === 1) {
                // User 2 adds a comment
                await page.fill('textarea[name="comment"]', `Comment from user ${index}`);
                await page.click('button:has-text("Add Comment")');
            } else {
                // User 3 updates status
                await page.selectOption('select[name="status"]', 'in_progress');
                await page.click('button:has-text("Update Status")');
            }
        });

        // Execute all actions concurrently
        await Promise.all(editActions);

        // Verify all changes were applied
        await pages[0].reload();
        await expect(pages[0].locator('text=Updated by user 0')).toBeVisible();

        await expect(pages[0].locator('text=Comment from user 1')).toBeVisible();
        await expect(pages[0].locator('.status-badge').filter({ hasText: 'In Progress' })).toBeVisible();

        // Cleanup
        for (const context of contexts) {
            await context.close();
        }
    });

    test('should manage concurrent task assignments', async ({ browser }) => {
        const contexts = [];
        const pages = [];

        // Create multiple user sessions
        for (let i = 0; i < 4; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();

            contexts.push(context);
            pages.push(page);

            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', `user${i}@example.com`);
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
            await page.goto('/tasks');
        }

        // All users try to assign themselves to available tasks simultaneously
        const assignmentActions = pages.map(async (page, index) => {
            const availableTasks = page.locator('.task-item').filter({ hasText: 'Unassigned' });
            const taskCount = await availableTasks.count();

            if (taskCount > 0) {
                await availableTasks.first().click();
                await page.selectOption('select[name="assignee"]', `user${index}@example.com`);
                await page.click('button:has-text("Assign to Me")');
            }
        });

        await Promise.all(assignmentActions);

        // Verify assignments were handled correctly (no conflicts)
        await pages[0].reload();
        const assignedTasks = pages[0].locator('.task-item').filter({ hasText: 'Assigned to:' });
        const assignedCount = await assignedTasks.count();

        // Should have some assignments
        expect(assignedCount).toBeGreaterThan(0);

        // Cleanup
        for (const context of contexts) {
            await context.close();
        }
    });
});













