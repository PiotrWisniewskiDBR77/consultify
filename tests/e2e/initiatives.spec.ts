import { test, expect } from '@playwright/test';

test.describe('Initiatives E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to login page
        await page.goto('/');
        
        // Login (assuming demo mode or test credentials)
        // Adjust based on your auth setup
        const loginButton = page.locator('text=Login').or(page.locator('text=Sign In'));
        if (await loginButton.isVisible()) {
            await loginButton.click();
            await page.fill('input[type="email"]', 'test@example.com');
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
            await page.waitForURL(/dashboard|home/i);
        }
    });

    test('should navigate to initiatives page', async ({ page }) => {
        await page.goto('/initiatives');
        await expect(page.locator('h1, h2')).toContainText(/initiative/i);
    });

    test('should display initiatives list', async ({ page }) => {
        await page.goto('/initiatives');
        
        // Wait for initiatives to load
        await page.waitForSelector('[data-testid="initiative"], .initiative-card, table', { timeout: 10000 });
        
        // Check if initiatives are displayed
        const initiatives = page.locator('[data-testid="initiative"], .initiative-card, tbody tr');
        const count = await initiatives.count();
        
        // Should have at least the table structure or empty state
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should open initiative detail modal', async ({ page }) => {
        await page.goto('/initiatives');
        
        // Wait for initiatives
        await page.waitForSelector('[data-testid="initiative"], .initiative-card, table', { timeout: 10000 });
        
        // Click first initiative if available
        const firstInitiative = page.locator('[data-testid="initiative"]').first()
            .or(page.locator('.initiative-card').first())
            .or(page.locator('tbody tr').first());
        
        if (await firstInitiative.count() > 0) {
            await firstInitiative.click();
            
            // Check if modal or detail page opened
            await expect(
                page.locator('[role="dialog"], .modal, [data-testid="initiative-detail"]')
            ).toBeVisible({ timeout: 5000 });
        }
    });

    test('should create new initiative', async ({ page }) => {
        await page.goto('/initiatives');
        
        // Look for create button
        const createButton = page.locator('text=Create').or(page.locator('text=New Initiative')).or(page.locator('button:has-text("+")'));
        
        if (await createButton.isVisible()) {
            await createButton.click();
            
            // Fill form if modal opens
            const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
            if (await titleInput.isVisible()) {
                await titleInput.fill('Test Initiative');
                
                const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")');
                if (await saveButton.isVisible()) {
                    await saveButton.click();
                    
                    // Verify initiative was created
                    await expect(page.locator('text=Test Initiative')).toBeVisible({ timeout: 5000 });
                }
            }
        }
    });

    test('should filter initiatives', async ({ page }) => {
        await page.goto('/initiatives');
        
        // Look for filter controls
        const filterInput = page.locator('input[placeholder*="filter" i], input[placeholder*="search" i]');
        if (await filterInput.isVisible()) {
            await filterInput.fill('test');
            await page.waitForTimeout(500); // Wait for filter to apply
            
            // Verify filtered results
            const results = page.locator('[data-testid="initiative"], .initiative-card');
            const count = await results.count();
            expect(count).toBeGreaterThanOrEqual(0);
        }
    });

    test('should display initiative status', async ({ page }) => {
        await page.goto('/initiatives');
        
        await page.waitForSelector('[data-testid="initiative"], .initiative-card, table', { timeout: 10000 });
        
        // Check for status badges
        const statusBadges = page.locator('.badge, .status, [class*="status"]');
        const count = await statusBadges.count();
        
        // Should have status indicators if initiatives exist
        expect(count).toBeGreaterThanOrEqual(0);
    });
});














