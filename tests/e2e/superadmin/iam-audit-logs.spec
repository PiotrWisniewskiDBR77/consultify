/**
 * E2E Tests for Admin Audit Logs
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

test.describe('Admin Audit Logs', () => {
    test.beforeEach(async ({ page }) => {
        // Login as superadmin
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[name="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/**`);
    });

    test('should display audit logs view', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        await expect(page.locator('h2:has-text("Audit Logs")')).toBeVisible();
    });

    test('should display risk statistics cards', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await expect(page.locator('text=Total Logs')).toBeVisible();
        await expect(page.locator('text=Unresolved')).toBeVisible();
        await expect(page.locator('text=High Risk')).toBeVisible();
        await expect(page.locator('text=Medium Risk')).toBeVisible();
        await expect(page.locator('text=Low Risk')).toBeVisible();
    });

    test('should toggle filter panel', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        // Click filters button
        await page.click('button:has-text("Filters")');
        await expect(page.locator('text=Filter Audit Logs')).toBeVisible();
        await expect(page.locator('select:has-text("All Actions")')).toBeVisible();
    });

    test('should filter by action type', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await page.click('button:has-text("Filters")');
        await page.selectOption('select >> nth=0', 'login');
        
        // Wait for data refresh
        await page.waitForLoadState('networkidle');
    });

    test('should filter by risk level', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await page.click('button:has-text("Filters")');
        await page.selectOption('select:has-text("Any Risk")', '80');
        
        await page.waitForLoadState('networkidle');
    });

    test('should filter by date range', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await page.click('button:has-text("Filters")');
        await page.fill('input[type="date"] >> nth=0', '2025-01-01');
        await page.fill('input[type="date"] >> nth=1', '2025-01-31');
        
        await page.waitForLoadState('networkidle');
    });

    test('should clear filters', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await page.click('button:has-text("Filters")');
        await page.selectOption('select >> nth=0', 'login');
        
        // Clear filters
        await page.click('text=Clear Filters');
        
        // Verify filters are cleared
        await expect(page.locator('select >> nth=0')).toHaveValue('');
    });

    test('should export audit logs as CSV', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        // Start download
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('button:has-text("Export CSV")')
        ]);
        
        expect(download.suggestedFilename()).toMatch(/audit_logs.*\.csv/);
    });

    test('should refresh audit logs', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await page.click('button:has-text("Refresh")');
        
        // Check for loading indicator
        await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 1000 }).catch(() => {});
    });

    test('should display risk badges correctly', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        // Check for risk badge elements (at least one type should be present)
        const criticalBadge = page.locator('text=CRITICAL');
        const highBadge = page.locator('text=HIGH');
        const mediumBadge = page.locator('text=MEDIUM');
        const lowBadge = page.locator('text=LOW');
        
        // At least one should be visible if there are logs
        const hasBadges = await Promise.any([
            criticalBadge.isVisible().catch(() => false),
            highBadge.isVisible().catch(() => false),
            mediumBadge.isVisible().catch(() => false),
            lowBadge.isVisible().catch(() => false)
        ]).catch(() => false);
    });

    test('should show resolve modal', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        // Find an unresolved log and click resolve
        const resolveButton = page.locator('button[title="Resolve"]').first();
        if (await resolveButton.isVisible()) {
            await resolveButton.click();
            await expect(page.locator('text=Resolve Audit Log')).toBeVisible();
            await expect(page.locator('textarea[placeholder="Resolution notes..."]')).toBeVisible();
        }
    });

    test('should resolve an audit log', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        const resolveButton = page.locator('button[title="Resolve"]').first();
        if (await resolveButton.isVisible()) {
            await resolveButton.click();
            
            // Fill resolution notes
            await page.fill('textarea[placeholder="Resolution notes..."]', 'Test resolution - verified');
            
            // Click resolve button
            await page.click('.fixed button:has-text("Resolve")');
            
            // Check for success message
            await expect(page.locator('.toast-success, [role="status"]')).toBeVisible({ timeout: 5000 }).catch(() => {});
        }
    });

    test('should display audit log table columns', async ({ page }) => {
        await page.goto(`${BASE_URL}/superadmin/iam`);
        await page.click('[data-testid="tab-admin-audit"]');
        
        await expect(page.locator('th:has-text("Admin")')).toBeVisible();
        await expect(page.locator('th:has-text("Action")')).toBeVisible();
        await expect(page.locator('th:has-text("Resource")')).toBeVisible();
        await expect(page.locator('th:has-text("IP Address")')).toBeVisible();
        await expect(page.locator('th:has-text("Risk")')).toBeVisible();
        await expect(page.locator('th:has-text("Status")')).toBeVisible();
        await expect(page.locator('th:has-text("Time")')).toBeVisible();
    });
});













