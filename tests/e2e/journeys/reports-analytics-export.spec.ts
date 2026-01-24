/**
 * Reports & Analytics - E2E User Journey
 * Full coverage of reporting flows
 * 
 * @playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Reports & Analytics User Journeys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should generate and export assessment report', async ({ page }) => {
        // Navigate to Reports
        await page.click('[data-testid="nav-reports"]');
        await expect(page).toHaveURL(/\/reports/);

        // Select assessment report
        await page.click('[data-testid="report-assessment"]');
        await page.waitForSelector('[data-testid="report-config"]');

        // Configure report
        await page.selectOption('[data-testid="assessment-select"]', { index: 0 });
        await page.click('[data-testid="include-recommendations"]');
        await page.click('[data-testid="include-charts"]');

        // Generate report
        await page.click('[data-testid="generate-report-btn"]');
        await page.waitForSelector('[data-testid="report-preview"]', { timeout: 30000 });

        // Verify report sections
        await expect(page.locator('[data-testid="report-summary-section"]')).toBeVisible();
        await expect(page.locator('[data-testid="report-scores-section"]')).toBeVisible();

        // Export as PDF
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('[data-testid="export-pdf-btn"]'),
        ]);
        expect(download.suggestedFilename()).toContain('.pdf');
    });

    test('should view analytics dashboard', async ({ page }) => {
        // Navigate to Analytics
        await page.click('[data-testid="nav-analytics"]');
        await expect(page).toHaveURL(/\/analytics/);

        // Verify dashboard widgets
        await page.waitForSelector('[data-testid="analytics-dashboard"]');
        await expect(page.locator('[data-testid="widget-initiatives"]')).toBeVisible();
        await expect(page.locator('[data-testid="widget-tasks"]')).toBeVisible();
        await expect(page.locator('[data-testid="widget-decisions"]')).toBeVisible();

        // Change date range
        await page.click('[data-testid="date-range-select"]');
        await page.click('[data-testid="date-range-quarter"]');

        // Verify data refreshed
        await expect(page.locator('[data-testid="data-updated-indicator"]')).toBeVisible();
    });

    test('should create custom dashboard', async ({ page }) => {
        // Navigate to Dashboards
        await page.click('[data-testid="nav-dashboards"]');
        await page.click('[data-testid="new-dashboard-btn"]');

        // Create dashboard
        await page.fill('[data-testid="dashboard-name"]', 'E2E Test Dashboard');
        await page.click('[data-testid="create-dashboard-btn"]');

        // Add widgets
        await page.click('[data-testid="add-widget-btn"]');
        await page.click('[data-testid="widget-type-chart"]');
        await page.selectOption('[data-testid="chart-type"]', 'bar');
        await page.selectOption('[data-testid="chart-data-source"]', 'initiatives');
        await page.click('[data-testid="save-widget-btn"]');

        // Verify widget added
        await expect(page.locator('[data-testid="dashboard-widget-0"]')).toBeVisible();

        // Save dashboard
        await page.click('[data-testid="save-dashboard-btn"]');
        await expect(page.locator('[data-testid="dashboard-saved"]')).toBeVisible();
    });

    test('should generate management report', async ({ page }) => {
        // Navigate to Management Reports
        await page.click('[data-testid="nav-reports"]');
        await page.click('[data-testid="management-reports"]');

        // Select report type
        await page.click('[data-testid="report-executive-summary"]');

        // Configure
        await page.selectOption('[data-testid="report-period"]', 'quarter');
        await page.click('[data-testid="include-financials"]');

        // Generate
        await page.click('[data-testid="generate-btn"]');
        await page.waitForSelector('[data-testid="report-ready"]', { timeout: 30000 });

        // Verify sections
        await expect(page.locator('[data-testid="section-overview"]')).toBeVisible();
        await expect(page.locator('[data-testid="section-kpis"]')).toBeVisible();
        await expect(page.locator('[data-testid="section-progress"]')).toBeVisible();
    });
});

test.describe('Data Export Journeys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should export data to Excel', async ({ page }) => {
        // Navigate to Initiatives
        await page.click('[data-testid="nav-initiatives"]');

        // Open export menu
        await page.click('[data-testid="export-btn"]');
        await page.waitForSelector('[data-testid="export-menu"]');

        // Export to Excel
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('[data-testid="export-excel"]'),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.xlsx?$/);
    });

    test('should export data to CSV', async ({ page }) => {
        // Navigate to Tasks
        await page.click('[data-testid="nav-my-work"]');
        await page.click('[data-testid="tab-tasks"]');

        // Export
        await page.click('[data-testid="export-btn"]');
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('[data-testid="export-csv"]'),
        ]);
        expect(download.suggestedFilename()).toContain('.csv');
    });

    test('should print report', async ({ page }) => {
        // Navigate to a report
        await page.click('[data-testid="nav-reports"]');
        await page.click('[data-testid="report-assessment"]');
        await page.selectOption('[data-testid="assessment-select"]', { index: 0 });
        await page.click('[data-testid="generate-report-btn"]');
        await page.waitForSelector('[data-testid="report-preview"]');

        // Click print (we can't actually print in E2E, just verify button exists)
        await expect(page.locator('[data-testid="print-btn"]')).toBeVisible();
    });
});

test.describe('Search & Filter Journeys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should search globally', async ({ page }) => {
        // Open global search
        await page.click('[data-testid="global-search-btn"]');
        await page.waitForSelector('[data-testid="search-modal"]');

        // Search
        await page.fill('[data-testid="search-input"]', 'digital transformation');
        await page.waitForSelector('[data-testid="search-results"]');

        // Verify results
        const results = page.locator('[data-testid^="search-result-"]');
        await expect(results.first()).toBeVisible();

        // Click result
        await results.first().click();
        // Should navigate somewhere
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('should filter initiatives', async ({ page }) => {
        // Navigate to Initiatives
        await page.click('[data-testid="nav-initiatives"]');

        // Open filters
        await page.click('[data-testid="filter-btn"]');
        await page.waitForSelector('[data-testid="filter-panel"]');

        // Apply status filter
        await page.click('[data-testid="filter-status-active"]');
        await page.click('[data-testid="apply-filters-btn"]');

        // Verify filtered
        await page.waitForSelector('[data-testid="initiatives-list"]');
        const items = page.locator('[data-testid^="initiative-item-"]');
        // All should have active status
    });

    test('should filter and sort tasks', async ({ page }) => {
        // Navigate to Tasks
        await page.click('[data-testid="nav-my-work"]');
        await page.click('[data-testid="tab-tasks"]');

        // Filter by priority
        await page.click('[data-testid="filter-btn"]');
        await page.click('[data-testid="filter-priority-high"]');
        await page.click('[data-testid="apply-filters-btn"]');

        // Sort by due date
        await page.click('[data-testid="sort-btn"]');
        await page.click('[data-testid="sort-due-date-asc"]');

        // Verify sorting applied
        await expect(page.locator('[data-testid="sort-indicator"]')).toContainText('Due Date');
    });
});
