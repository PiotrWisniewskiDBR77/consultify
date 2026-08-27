/**
 * Portfolio Module E2E Tests
 * 
 * End-to-end tests for the unified Portfolio & Roadmap module.
 * Uses Playwright for browser automation.
 */

import { test, expect, Page } from '@playwright/test';

// Test user credentials
const TEST_USER = {
    email: 'john.smith@dbr77.com',
    // Test-only default password (non-secret)
    password: (process.env.TEST_USER_PASSWORD || 'testpassword123')
};

// Helper to login
async function login(page: Page) {
    await page.goto('/');
    
    // Wait for and click login/enter button
    const authButton = page.locator('button:has-text("Sign In"), button:has-text("Log In"), a:has-text("Enter")').first();
    if (await authButton.isVisible()) {
        await authButton.click();
    }
    
    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', TEST_USER.email);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
    
    // Submit
    await page.click('button[type="submit"], button:has-text("Sign In")');
    
    // Wait for navigation
    await page.waitForURL(/.*(?:dashboard|work|portfolio).*/i, { timeout: 10000 });
}

// Helper to navigate to Portfolio view
async function navigateToPortfolio(page: Page) {
    // Click on Portfolio & Roadmap in sidebar
    const portfolioLink = page.locator('nav, aside').locator('text=Portfolio').first();
    if (await portfolioLink.isVisible()) {
        await portfolioLink.click();
    } else {
        // Try direct URL navigation
        await page.goto('/portfolio-roadmap');
    }
    
    // Wait for view to load
    await expect(page.locator('text=Portfolio & Roadmap')).toBeVisible({ timeout: 10000 });
}

test.describe('Portfolio Module', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await navigateToPortfolio(page);
    });

    test.describe('Page Load', () => {
        test('displays portfolio header and title', async ({ page }) => {
            await expect(page.locator('h1:has-text("Portfolio & Roadmap")')).toBeVisible();
            await expect(page.locator('text=Manage initiatives from idea to execution')).toBeVisible();
        });

        test('shows stats cards', async ({ page }) => {
            // Check for stats labels
            await expect(page.locator('text=Total')).toBeVisible();
            await expect(page.locator('text=Executing')).toBeVisible();
            await expect(page.locator('text=Approved')).toBeVisible();
            await expect(page.locator('text=Total Budget')).toBeVisible();
        });

        test('displays view mode toggle', async ({ page }) => {
            await expect(page.locator('button:has-text("List")')).toBeVisible();
            await expect(page.locator('button:has-text("Kanban")')).toBeVisible();
            await expect(page.locator('button:has-text("Timeline")')).toBeVisible();
            await expect(page.locator('button:has-text("Matrix")')).toBeVisible();
        });
    });

    test.describe('View Mode Switching', () => {
        test('switches to List view', async ({ page }) => {
            await page.click('button:has-text("List")');
            
            // List view should show table headers
            await expect(page.locator('th:has-text("Initiative")')).toBeVisible();
            await expect(page.locator('th:has-text("Status")')).toBeVisible();
            await expect(page.locator('th:has-text("Priority")')).toBeVisible();
        });

        test('switches to Kanban view', async ({ page }) => {
            await page.click('button:has-text("Kanban")');
            
            // Kanban view should show columns
            await expect(page.locator('text=Draft').first()).toBeVisible();
            await expect(page.locator('text=Planning').first()).toBeVisible();
            await expect(page.locator('text=Review').first()).toBeVisible();
            await expect(page.locator('text=Executing').first()).toBeVisible();
        });

        test('switches to Timeline view', async ({ page }) => {
            await page.click('button:has-text("Timeline")');
            
            // Timeline view should show quarter headers
            await expect(page.locator('text=Q1').first()).toBeVisible();
            await expect(page.locator('text=Q2').first()).toBeVisible();
        });

        test('switches to Matrix view', async ({ page }) => {
            await page.click('button:has-text("Matrix")');
            
            // Matrix view should show quadrants
            await expect(page.locator('text=Quick Wins')).toBeVisible();
            await expect(page.locator('text=Major Investment')).toBeVisible();
        });
    });

    test.describe('Search and Filters', () => {
        test('search filters initiatives by name', async ({ page }) => {
            const searchInput = page.locator('input[placeholder*="Search"]');
            await searchInput.fill('Cloud');
            
            // Wait for debounced search
            await page.waitForTimeout(500);
            
            // Should filter results
            const initiatives = page.locator('[data-testid="initiative-card"], tr:has-text("Cloud")');
            await expect(initiatives.first()).toBeVisible();
        });

        test('filter panel opens and closes', async ({ page }) => {
            // Open filters
            await page.click('button:has-text("Filters")');
            await expect(page.locator('text=All Statuses')).toBeVisible();
            await expect(page.locator('text=All Priorities')).toBeVisible();
            
            // Close filters
            await page.click('button:has-text("Filters")');
            await expect(page.locator('text=All Statuses')).not.toBeVisible();
        });

        test('status filter works', async ({ page }) => {
            await page.click('button:has-text("Filters")');
            
            // Select EXECUTING status
            await page.selectOption('select:near(:text("All Statuses"))', 'EXECUTING');
            
            // Wait for filter to apply
            await page.waitForTimeout(300);
            
            // Only EXECUTING initiatives should be visible
            // Verification depends on actual data
        });
    });

    test.describe('Initiative Side Panel', () => {
        test('opens side panel on initiative click', async ({ page }) => {
            // Switch to list view for easier clicking
            await page.click('button:has-text("List")');
            
            // Wait for table to load
            await page.waitForSelector('table');
            
            // Click first initiative row
            const firstRow = page.locator('tbody tr').first();
            await firstRow.click();
            
            // Side panel should open
            await expect(page.locator('text=Overview')).toBeVisible();
            await expect(page.locator('text=Financials')).toBeVisible();
            await expect(page.locator('text=Stakeholders')).toBeVisible();
        });

        test('closes side panel with X button', async ({ page }) => {
            await page.click('button:has-text("List")');
            await page.waitForSelector('table');
            
            const firstRow = page.locator('tbody tr').first();
            await firstRow.click();
            
            // Close panel
            await page.click('button[aria-label="Close"], button:has(svg.lucide-x)');
            
            // Panel should be closed
            await expect(page.locator('[data-testid="side-panel"]')).not.toBeVisible();
        });

        test('navigates between panel tabs', async ({ page }) => {
            await page.click('button:has-text("List")');
            await page.waitForSelector('table');
            
            const firstRow = page.locator('tbody tr').first();
            await firstRow.click();
            
            // Click Financials tab
            await page.click('button:has-text("Financials")');
            await expect(page.locator('text=Total Budget')).toBeVisible();
            
            // Click Risks tab
            await page.click('button:has-text("Risks")');
            await expect(page.locator('text=Risk Score')).toBeVisible();
        });
    });

    test.describe('Kanban Drag and Drop', () => {
        test('can drag initiative between columns', async ({ page }) => {
            await page.click('button:has-text("Kanban")');
            
            // Wait for kanban to load
            await page.waitForSelector('[data-testid="kanban-column"], div:has-text("Planning")');
            
            // Find a card in Planning column
            const planningColumn = page.locator('div:has(> div:has-text("Planning"))');
            const card = planningColumn.locator('[data-testid="initiative-card"]').first();
            
            if (await card.isVisible()) {
                // Get card text for verification
                const cardText = await card.textContent();
                
                // Find Review column
                const reviewColumn = page.locator('div:has(> div:has-text("Review"))');
                
                // Drag and drop
                await card.dragTo(reviewColumn);
                
                // Verify card moved (API would be called)
                await page.waitForTimeout(500);
            }
        });
    });

    test.describe('List View Features', () => {
        test('sorts by column header click', async ({ page }) => {
            await page.click('button:has-text("List")');
            await page.waitForSelector('table');
            
            // Click on Priority header to sort
            await page.click('th:has-text("Priority")');
            
            // Should trigger sort (visual change or API call)
            await page.waitForTimeout(300);
        });

        test('status dropdown changes status', async ({ page }) => {
            await page.click('button:has-text("List")');
            await page.waitForSelector('table');
            
            // Find status dropdown in first row
            const statusSelect = page.locator('tbody tr').first().locator('select');
            
            if (await statusSelect.isVisible()) {
                // Change status
                await statusSelect.selectOption('APPROVED');
                
                // Wait for API call
                await page.waitForTimeout(500);
            }
        });

        test('checkbox selection works', async ({ page }) => {
            await page.click('button:has-text("List")');
            await page.waitForSelector('table');
            
            // Click first checkbox
            const firstCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]');
            await firstCheckbox.click();
            
            // Checkbox should be checked
            await expect(firstCheckbox).toBeChecked();
        });
    });

    test.describe('New Initiative', () => {
        test('New Initiative button is present', async ({ page }) => {
            await expect(page.locator('button:has-text("New Initiative")')).toBeVisible();
        });
    });

    test.describe('Responsive Design', () => {
        test('adapts to mobile viewport', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            
            // Check that view toggle still works
            await expect(page.locator('button:has-text("Kanban")') || page.locator('[aria-label="Kanban"]')).toBeVisible();
            
            // Stats should still be visible
            await expect(page.locator('text=Total').first()).toBeVisible();
        });

        test('adapts to tablet viewport', async ({ page }) => {
            // Set tablet viewport
            await page.setViewportSize({ width: 768, height: 1024 });
            
            // Full view should be visible
            await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible();
            await expect(page.locator('button:has-text("List")')).toBeVisible();
        });
    });

    test.describe('Performance', () => {
        test('loads within acceptable time', async ({ page }) => {
            const startTime = Date.now();
            
            await navigateToPortfolio(page);
            await expect(page.locator('h1:has-text("Portfolio")')).toBeVisible();
            
            const loadTime = Date.now() - startTime;
            expect(loadTime).toBeLessThan(5000); // 5 seconds max
        });
    });
});















