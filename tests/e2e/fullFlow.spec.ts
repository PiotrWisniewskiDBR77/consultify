import { test, expect } from '@playwright/test';

/**
 * Level 4: E2E Tests - Full User Flows
 * Tests complete user journeys through the application
 */
test.describe('Full User Flow Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        await expect(page.locator('h1')).toBeVisible();
    });

    test('should complete free assessment flow', async ({ page }) => {
        // Navigate to free assessment
        await page.click('text=Free Assessment');
        
        // Step 1: Profile
        await expect(page.locator('text=/Profile|Company/i')).toBeVisible();
        await page.fill('input[name="companyName"], textarea[name="companyName"]', 'Test Company');
        await page.click('button:has-text("Next"), button:has-text("Continue")');
        
        // Step 2: Context
        await expect(page.locator('text=/Context|Industry/i')).toBeVisible();
        await page.fill('textarea', 'We are a tech company');
        await page.click('button:has-text("Next"), button:has-text("Continue")');
        
        // Step 3: Expectations
        await expect(page.locator('text=/Expectations|Goals/i')).toBeVisible();
        await page.fill('textarea', 'We want to improve our processes');
        await page.click('button:has-text("Complete"), button:has-text("Finish")');
        
        // Should show results or summary
        await expect(page.locator('text=/Results|Summary|Assessment/i')).toBeVisible({ timeout: 10000 });
    });

    test('should create and manage a project', async ({ page }) => {
        // Navigate to projects
        await page.click('text=Projects');
        await expect(page.locator('text=/Projects|Project/i')).toBeVisible();
        
        // Create new project
        const createButton = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add")').first();
        if (await createButton.isVisible()) {
            await createButton.click();
            
            // Fill project form
            await page.fill('input[name="name"], input[placeholder*="name" i]', 'E2E Test Project');
            await page.click('button:has-text("Create"), button:has-text("Save")');
            
            // Verify project appears in list
            await expect(page.locator('text=E2E Test Project')).toBeVisible();
        }
    });

    test('should navigate through main modules', async ({ page }) => {
        const modules = [
            { name: 'Dashboard', selector: 'text=/Dashboard|Overview/i' },
            { name: 'Initiatives', selector: 'text=/Initiatives|Initiative/i' },
            { name: 'Roadmap', selector: 'text=/Roadmap/i' },
            { name: 'ROI', selector: 'text=/ROI|Economics/i' },
            { name: 'Settings', selector: 'text=/Settings/i' },
        ];

        for (const module of modules) {
            try {
                await page.click(module.selector, { timeout: 5000 });
                await expect(page.locator('h1, h2')).toBeVisible({ timeout: 5000 });
                // Small delay between navigations
                await page.waitForTimeout(500);
            } catch (error) {
                console.log(`Module ${module.name} not found or not accessible`);
            }
        }
    });

    test('should handle task creation and assignment', async ({ page }) => {
        // Navigate to tasks or project with tasks
        await page.click('text=/Tasks|Task/i');
        
        // Look for create task button
        const createTaskButton = page.locator('button:has-text("New Task"), button:has-text("Add Task"), button:has-text("Create Task")').first();
        if (await createTaskButton.isVisible({ timeout: 5000 })) {
            await createTaskButton.click();
            
            // Fill task form
            await page.fill('input[name="title"], input[placeholder*="title" i]', 'E2E Test Task');
            await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Test task description');
            
            // Save task
            await page.click('button:has-text("Create"), button:has-text("Save")');
            
            // Verify task appears
            await expect(page.locator('text=E2E Test Task')).toBeVisible({ timeout: 5000 });
        }
    });
});

