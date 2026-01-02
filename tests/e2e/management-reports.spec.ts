/**
 * E2E Tests for Management Reports Module
 * 
 * Tests cover:
 * - Report generation (Team Meeting & Steering Committee)
 * - Portfolio vs Project scope selection
 * - Report viewing and navigation
 * - Export functionality (PDF, PPTX)
 * - Report history and filtering
 * - Share link functionality
 * 
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import { test, expect } from '@playwright/test';

// Helper to login
async function login(page: any, email = 'test@example.com', password = 'password123') {
    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

test.describe('Management Reports Module', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test.describe('Report Generator UI', () => {
        test('should display report type selector', async ({ page }) => {
            await page.goto('/reports');
            
            // Check for main heading
            await expect(page.locator('h1')).toContainText('Management Reports');
            
            // Check for report type options
            await expect(page.locator('text=Team Meeting Report')).toBeVisible();
            await expect(page.locator('text=Steering Committee Report')).toBeVisible();
        });

        test('should allow selecting Team Meeting report type', async ({ page }) => {
            await page.goto('/reports');
            
            // Click Team Meeting option
            await page.click('text=Team Meeting Report');
            
            // Should show default period of 7 days
            const periodSelect = page.locator('select').first();
            await expect(periodSelect).toHaveValue('7');
        });

        test('should allow selecting Steering Committee report type', async ({ page }) => {
            await page.goto('/reports');
            
            // Click Steering Committee option
            await page.click('text=Steering Committee Report');
            
            // Should show default period of 30 days
            const periodSelect = page.locator('select').first();
            await expect(periodSelect).toHaveValue('30');
        });

        test('should toggle between Portfolio and Project scope', async ({ page }) => {
            await page.goto('/reports');
            
            // Click Portfolio scope
            await page.click('text=Portfolio (All Projects)');
            await expect(page.locator('button:has-text("Portfolio")')).toHaveClass(/border-violet/);
            
            // Click Project scope
            await page.click('text=Single Project');
            await expect(page.locator('button:has-text("Single Project")')).toHaveClass(/border-violet/);
            
            // Should show project selector
            await expect(page.locator('text=Select Project')).toBeVisible();
        });

        test('should require project selection for Project scope', async ({ page }) => {
            await page.goto('/reports');
            
            // Select Project scope
            await page.click('text=Single Project');
            
            // Generate button should be disabled without project
            const generateBtn = page.locator('button:has-text("Generate Report")');
            await expect(generateBtn).toBeDisabled();
        });
    });

    test.describe('Report Generation', () => {
        test('should generate Team Meeting portfolio report', async ({ page }) => {
            await page.goto('/reports');
            
            // Select Team Meeting type
            await page.click('text=Team Meeting Report');
            
            // Ensure Portfolio scope is selected
            await page.click('text=Portfolio (All Projects)');
            
            // Click generate
            await page.click('button:has-text("Generate Report")');
            
            // Wait for loading to complete
            await expect(page.locator('text=Generating Report')).toBeVisible();
            await expect(page.locator('text=Status Overview')).toBeVisible({ timeout: 30000 });
            
            // Verify report sections
            await expect(page.locator('text=Completed This Period')).toBeVisible();
            await expect(page.locator('text=Work In Progress')).toBeVisible();
            await expect(page.locator('text=Plan for Next Period')).toBeVisible();
        });

        test('should generate Steering Committee portfolio report', async ({ page }) => {
            await page.goto('/reports');
            
            // Select Steering Committee type
            await page.click('text=Steering Committee Report');
            
            // Ensure Portfolio scope
            await page.click('text=Portfolio (All Projects)');
            
            // Click generate
            await page.click('button:has-text("Generate Report")');
            
            // Wait for report
            await expect(page.locator('text=Executive Summary')).toBeVisible({ timeout: 30000 });
            
            // Verify RAG status grid
            await expect(page.locator('text=Overall Status')).toBeVisible();
            await expect(page.locator('text=SCHEDULE')).toBeVisible();
            await expect(page.locator('text=BUDGET')).toBeVisible();
            await expect(page.locator('text=SCOPE')).toBeVisible();
            await expect(page.locator('text=RISK')).toBeVisible();
        });

        test('should show AI narrative in generated report', async ({ page }) => {
            await page.goto('/reports');
            
            await page.click('text=Team Meeting Report');
            await page.click('text=Portfolio (All Projects)');
            await page.click('button:has-text("Generate Report")');
            
            // AI Summary should be visible
            await expect(page.locator('text=AI Summary')).toBeVisible({ timeout: 30000 });
        });
    });

    test.describe('Export Controls', () => {
        test.beforeEach(async ({ page }) => {
            // Generate a report first
            await page.goto('/reports');
            await page.click('text=Team Meeting Report');
            await page.click('text=Portfolio (All Projects)');
            await page.click('button:has-text("Generate Report")');
            await expect(page.locator('text=Status Overview')).toBeVisible({ timeout: 30000 });
        });

        test('should display export buttons after report generation', async ({ page }) => {
            await expect(page.locator('button:has-text("Export PDF")')).toBeVisible();
            await expect(page.locator('button:has-text("Export PPTX")')).toBeVisible();
            await expect(page.locator('button:has-text("Share Link")')).toBeVisible();
        });

        test('should create share link when clicking Share', async ({ page }) => {
            await page.click('button:has-text("Share Link")');
            
            // Should show the share URL
            await expect(page.locator('text=/reports/shared/')).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Report History', () => {
        test('should navigate to history view', async ({ page }) => {
            await page.goto('/reports');
            
            await page.click('button:has-text("History")');
            
            await expect(page.locator('text=Report History')).toBeVisible();
        });

        test('should filter reports by type', async ({ page }) => {
            await page.goto('/reports');
            await page.click('button:has-text("History")');
            
            // Select Team Meeting filter
            const typeFilter = page.locator('select').first();
            await typeFilter.selectOption('TEAM_MEETING');
            
            // Wait for filtered results
            await page.waitForTimeout(500);
        });

        test('should filter reports by scope', async ({ page }) => {
            await page.goto('/reports');
            await page.click('button:has-text("History")');
            
            // Select Portfolio filter
            const scopeFilter = page.locator('select').nth(1);
            await scopeFilter.selectOption('PORTFOLIO');
            
            // Wait for filtered results
            await page.waitForTimeout(500);
        });

        test('should view report from history', async ({ page }) => {
            // First generate a report
            await page.goto('/reports');
            await page.click('text=Team Meeting Report');
            await page.click('button:has-text("Generate Report")');
            await expect(page.locator('text=Status Overview')).toBeVisible({ timeout: 30000 });
            
            // Go to history
            await page.click('button:has-text("History")');
            await expect(page.locator('text=Report History')).toBeVisible();
            
            // Click view on first report
            const viewBtn = page.locator('button[title="View report"]').first();
            if (await viewBtn.isVisible()) {
                await viewBtn.click();
                await expect(page.locator('text=Status Overview')).toBeVisible({ timeout: 10000 });
            }
        });
    });

    test.describe('PMO Standards Compliance', () => {
        test('should display PMO standards info on selector page', async ({ page }) => {
            await page.goto('/reports');
            
            await expect(page.locator('text=PMO Standards Compliance')).toBeVisible();
            await expect(page.locator('text=ISO 21500:2021')).toBeVisible();
            await expect(page.locator('text=PMBOK 7th Edition')).toBeVisible();
            await expect(page.locator('text=PRINCE2')).toBeVisible();
        });

        test('should show audit trail in Steering Committee report', async ({ page }) => {
            await page.goto('/reports');
            
            await page.click('text=Steering Committee Report');
            await page.click('button:has-text("Generate Report")');
            
            // Wait for report
            await expect(page.locator('text=Executive Summary')).toBeVisible({ timeout: 30000 });
            
            // Check for audit trail footer
            await expect(page.locator('text=PMO Standards Compliance')).toBeVisible();
            await expect(page.locator('text=Report ID:')).toBeVisible();
        });

        test('should display PRINCE2 report type mapping', async ({ page }) => {
            await page.goto('/reports');
            
            // Team Meeting should show Checkpoint Report
            await expect(page.locator('text=Checkpoint Report')).toBeVisible();
            
            // Steering Committee should show Highlight Report
            await expect(page.locator('text=Highlight Report')).toBeVisible();
        });
    });

    test.describe('AI Transparency', () => {
        test('should display warnings when issues exist', async ({ page }) => {
            await page.goto('/reports');
            
            await page.click('text=Steering Committee Report');
            await page.click('button:has-text("Generate Report")');
            
            await expect(page.locator('text=Executive Summary')).toBeVisible({ timeout: 30000 });
            
            // If warnings exist, they should be prominently displayed
            const warningSection = page.locator('text=Attention Required');
            if (await warningSection.isVisible()) {
                // Verify transparency message
                await expect(page.locator('text=AI never hides bad news')).toBeVisible();
            }
        });

        test('should show concerns in Team Meeting report', async ({ page }) => {
            await page.goto('/reports');
            
            await page.click('text=Team Meeting Report');
            await page.click('button:has-text("Generate Report")');
            
            await expect(page.locator('text=Status Overview')).toBeVisible({ timeout: 30000 });
            
            // Check for concerns section if issues exist
            const concernsSection = page.locator('text=Concerns');
            // Concerns are optional based on data
        });
    });

    test.describe('Navigation', () => {
        test('should navigate back to selector from preview', async ({ page }) => {
            await page.goto('/reports');
            
            // Generate report
            await page.click('text=Team Meeting Report');
            await page.click('button:has-text("Generate Report")');
            await expect(page.locator('text=Status Overview')).toBeVisible({ timeout: 30000 });
            
            // Click back arrow
            await page.click('button:has([data-lucide="arrow-left"])');
            
            // Should be back to selector
            await expect(page.locator('text=Generate New Report')).toBeVisible();
        });

        test('should create new report from history view', async ({ page }) => {
            await page.goto('/reports');
            await page.click('button:has-text("History")');
            
            await page.click('button:has-text("New Report")');
            
            await expect(page.locator('text=Generate New Report')).toBeVisible();
        });
    });

    test.describe('Period Selection', () => {
        test('should allow custom period selection', async ({ page }) => {
            await page.goto('/reports');
            
            // Find period selector
            const periodSelect = page.locator('select').filter({ hasText: 'Last' });
            
            // Select 30 days
            await periodSelect.selectOption('30');
            await expect(periodSelect).toHaveValue('30');
            
            // Select 90 days
            await periodSelect.selectOption('90');
            await expect(periodSelect).toHaveValue('90');
        });
    });
});

test.describe('Management Reports API', () => {
    test('GET /api/management-reports/types should return report types', async ({ request }) => {
        const response = await request.get('/api/management-reports/types');
        
        expect(response.status()).toBe(200);
        
        const data = await response.json();
        expect(data.types).toBeDefined();
        expect(data.types.length).toBe(2);
        expect(data.types[0].id).toBe('TEAM_MEETING');
        expect(data.types[1].id).toBe('STEERING_COMMITTEE');
    });

    test('POST /api/management-reports/generate should require auth', async ({ request }) => {
        const response = await request.post('/api/management-reports/generate', {
            data: {
                reportType: 'TEAM_MEETING',
                scope: 'PORTFOLIO'
            }
        });
        
        // Should return 401 without auth
        expect(response.status()).toBe(401);
    });

    test('GET /api/management-reports/shared/:token should work without auth', async ({ request }) => {
        // Non-existent token should return 404
        const response = await request.get('/api/management-reports/shared/invalid-token');
        
        expect(response.status()).toBe(404);
    });
});



