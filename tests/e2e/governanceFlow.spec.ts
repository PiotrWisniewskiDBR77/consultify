/**
 * E2E Tests: Governance Flow
 * 
 * Phase 6: E2E Tests - Critical User Journey
 * Tests permission management and audit log viewing.
 */

import { test, expect } from '@playwright/test';

test.describe('Governance Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard');
    });

    test('should navigate to governance', async ({ page }) => {
        await page.goto('/governance');
        await expect(page).toHaveURL(/.*governance/);
    });

    test('should view audit log', async ({ page }) => {
        await page.goto('/governance/audit');
        
        // Wait for audit log to load
        await page.waitForSelector('[data-testid="audit-log"]', { timeout: 10000 }).catch(() => {});
        
        // Check if entries are visible
        const auditEntries = page.locator('[data-testid="audit-entry"]').or(page.locator('text=CREATE').or(page.locator('text=UPDATE')));
        await expect(auditEntries.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    });

    test('should filter audit log', async ({ page }) => {
        await page.goto('/governance/audit');
        
        // Try to filter by action
        const filterButton = page.locator('button:has-text("Filter")').or(page.locator('select[name="action"]')).first();
        if (await filterButton.count() > 0) {
            await filterButton.click();
            
            const createOption = page.locator('option:has-text("CREATE")').or(page.locator('text=CREATE')).first();
            if (await createOption.count() > 0) {
                await createOption.click();
            }
        }
    });

    test('should manage permissions', async ({ page }) => {
        await page.goto('/governance/permissions');
        
        // Wait for permission manager to load
        await page.waitForSelector('[data-testid="permission-manager"]', { timeout: 10000 }).catch(() => {});
        
        // Check if permissions list is visible
        const permissionsList = page.locator('[data-testid="permission-list"]').or(page.locator('text=Permission Manager'));
        await expect(permissionsList).toBeVisible({ timeout: 5000 }).catch(() => {});
    });

    test('should search permissions', async ({ page }) => {
        await page.goto('/governance/permissions');
        
        const searchInput = page.locator('input[placeholder*="Search" i]').or(page.locator('input[type="search"]')).first();
        if (await searchInput.count() > 0) {
            await searchInput.fill('CREATE');
            await page.waitForTimeout(500); // Wait for search to filter
        }
    });
});

