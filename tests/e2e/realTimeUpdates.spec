import { test, expect } from '@playwright/test';

test.describe('Real-time Updates Tests', () => {
    test('should receive real-time task updates', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Login both users
        await page1.goto('/');
        await page1.click('text=Log In');
        await page1.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page1.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page1.click('button[type="submit"]');

        await page2.goto('/');
        await page2.click('text=Log In');
        await page2.fill('input[type="email"]', 'user@example.com');
        await page2.fill('input[type="password"]', 'userpass');
        await page2.click('button[type="submit"]');

        // Both navigate to same task
        await page1.goto('/tasks');
        await page2.goto('/tasks');

        const task1 = page1.locator('.task-item').first();
        const task2 = page2.locator('.task-item').first();

        if (await task1.count() > 0) {
            // User 1 updates task
            await task1.click();
            await page1.selectOption('select[name="status"]', 'in_progress');
            await page1.click('button:has-text("Update Status")');

            // User 2 should see update within a few seconds
            await expect(page2.locator('.status-badge').filter({ hasText: 'In Progress' })).toBeVisible({ timeout: 10000 });

            // Check for real-time notification
            await expect(page2.locator('.realtime-notification')).toBeVisible();
        }

        await context1.close();
        await context2.close();
    });

    test('should show live collaboration indicators', async ({ browser }) => {
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Login both users
        await page1.goto('/');
        await page1.click('text=Log In');
        await page1.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page1.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page1.click('button[type="submit"]');

        await page2.goto('/');
        await page2.click('text=Log In');
        await page2.fill('input[type="email"]', 'user@example.com');
        await page2.fill('input[type="password"]', 'userpass');
        await page2.click('button[type="submit"]');

        // Both edit same project
        await page1.goto('/projects/TestProject');
        await page2.goto('/projects/TestProject');

        // User 1 starts editing
        await page1.click('button:has-text("Edit Description")');

        // User 2 should see collaboration indicator
        await expect(page2.locator('text=1 user currently editing')).toBeVisible();

        // User 1 saves
        await page1.fill('textarea[name="description"]', 'Updated description');
        await page1.click('button:has-text("Save")');

        // User 2 should see update
        await expect(page2.locator('text=Updated description')).toBeVisible();

        await context1.close();
        await context2.close();
    });

    test('should handle real-time notifications', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        // Enable notifications
        await page.click('[data-testid="notification-toggle"]');

        // Trigger notification event (create task assigned to user)
        await page.goto('/tasks');
        await page.click('button:has-text("New Task")');
        await page.fill('input[name="title"]', 'Real-time Test Task');
        await page.fill('textarea[name="description"]', 'Task for real-time notification test');
        await page.selectOption('select[name="assignee"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.click('button:has-text("Create Task")');

        // Should receive real-time notification
        await expect(page.locator('.notification-toast')).toBeVisible();
        await expect(page.locator('text=You have been assigned a new task')).toBeVisible();

        // Notification should appear in notification center
        await page.click('[data-testid="notification-center"]');
        await expect(page.locator('text=Real-time Test Task')).toBeVisible();
    });

    test('should maintain real-time connection stability', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        // Wait for real-time connection to establish
        await page.waitForSelector('.connection-status.connected', { timeout: 10000 });

        // Simulate network interruption
        await page.context().setOffline(true);

        // Should show offline indicator
        await expect(page.locator('.connection-status.disconnected')).toBeVisible();

        // Restore connection
        await page.context().setOffline(false);

        // Should reconnect and show connected status
        await expect(page.locator('.connection-status.connected')).toBeVisible({ timeout: 10000 });

        // Should sync any pending changes
        await expect(page.locator('text=Changes synced')).toBeVisible();
    });

    test('should handle real-time dashboard updates', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Record initial metrics
        const initialTaskCount = await page.locator('.metric-tasks .value').textContent();
        const initialProjectCount = await page.locator('.metric-projects .value').textContent();

        // Create new task in another tab
        const newPage = await page.context().newPage();
        await newPage.goto('/');
        await newPage.click('text=Log In');
        await newPage.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await newPage.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await newPage.click('button[type="submit"]');

        await newPage.goto('/tasks');
        await newPage.click('button:has-text("New Task")');
        await newPage.fill('input[name="title"]', 'Real-time Dashboard Test');
        await newPage.click('button:has-text("Create Task")');

        // Dashboard should update automatically
        await expect(page.locator('.metric-tasks .value')).not.toHaveText(initialTaskCount || '0');

        await newPage.close();
    });
});














