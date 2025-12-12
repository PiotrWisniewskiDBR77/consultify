import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
    test.beforeEach(async ({ page }) => {
        // Login via UI
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'piotr.wisniewski@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        await expect(page.locator('h1:has-text("Admin Panel")')).toBeVisible();
    });

    test('should create a new project', async ({ page }) => {
        // Navigate to projects (Admin Panel -> Projects)
        // Admin Panel might be auto-expanded
        await page.hover('div.fixed.z-50');
        await page.waitForTimeout(500);
        // Ensure expansion
        try { await page.waitForSelector('text="CONSULTIFY"', { timeout: 2000 }); } catch { /* ignore */ }

        if (!(await page.isVisible('nav >> text="Projects"'))) {
            await page.click('nav >> text="Admin Panel"');
            await page.waitForTimeout(300);
        }
        await page.waitForSelector('nav >> text="Projects"');
        await page.click('nav >> text="Projects"');

        // Open "New Project" modal/form
        await page.click('text=New Project');

        // Fill modal/form
        const testProjectName = `E2E Test Project ${Date.now()}`;
        await page.fill('input[placeholder="Enter project name..."]', testProjectName);

        // Select status or other required fields if any (assuming defaults work or simple inputs)
        // await page.selectOption('select[name="status"]', 'Planning'); 

        // Submit
        await page.click('button:has-text("Create"), button:has-text("Save")');

        // Verify it appears in the list
        await expect(page.locator(`text = ${testProjectName} `)).toBeVisible();
    });
});
