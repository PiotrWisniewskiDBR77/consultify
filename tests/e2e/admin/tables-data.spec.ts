/**
 * Admin Panel Tables and Data E2E Tests
 * Tests that all tables render correctly and have data or empty states
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Panel Tables and Data', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
    });

    // Team Module - Users table
    test.describe('Team Module - Users Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/team');
            await page.waitForLoadState('networkidle');
            
            // Switch to users tab
            const usersTab = page.locator('button:has-text("Users"), [role="tab"]:has-text("Users"), [data-value="users"]').first();
            await usersTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render users table', async ({ page }) => {
            // Look for table element
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });

        test('should have table headers', async ({ page }) => {
            // Look for table headers
            const headers = page.locator('thead, [role="columnheader"], th, [class*="header"]');
            const headerCount = await headers.count();
            expect(headerCount).toBeGreaterThan(0);
        });

        test('should have table rows or empty state', async ({ page }) => {
            // Check for either table rows or empty state message
            const rows = page.locator('tbody tr, [role="row"]:not(thead [role="row"])');
            const emptyState = page.locator('text=/no users|empty|no data/i');
            
            const rowCount = await rows.count();
            const hasEmptyState = await emptyState.isVisible().catch(() => false);
            
            expect(rowCount > 0 || hasEmptyState).toBeTruthy();
        });
    });

    // Team Module - Groups table
    test.describe('Team Module - Groups Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/team');
            await page.waitForLoadState('networkidle');
            
            const groupsTab = page.locator('button:has-text("Groups"), [role="tab"]:has-text("Groups"), [data-value="groups"]').first();
            await groupsTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render groups table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Team Module - Invitations table
    test.describe('Team Module - Invitations Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/team');
            await page.waitForLoadState('networkidle');
            
            const invitationsTab = page.locator('button:has-text("Invitations"), [role="tab"]:has-text("Invitations"), [data-value="invitations"]').first();
            await invitationsTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render invitations table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Workspace Module - Projects table
    test.describe('Workspace Module - Projects Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/workspace');
            await page.waitForLoadState('networkidle');
            
            const projectsTab = page.locator('button:has-text("Projects"), [role="tab"]:has-text("Projects"), [data-value="projects"]').first();
            await projectsTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render projects table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // AI Module - Models & Providers table
    test.describe('AI Module - Models & Providers Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/ai');
            await page.waitForLoadState('networkidle');
            
            const modelsTab = page.locator('button:has-text("Models"), [role="tab"]:has-text("Models"), [data-value="models"]').first();
            await modelsTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render models table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Billing Module - Payment Methods table
    test.describe('Billing Module - Payment Methods Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/billing');
            await page.waitForLoadState('networkidle');
            
            const paymentTab = page.locator('button:has-text("Payment"), [role="tab"]:has-text("Payment"), [data-value="payment"]').first();
            await paymentTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render payment methods table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Billing Module - Invoices table
    test.describe('Billing Module - Invoices Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/billing');
            await page.waitForLoadState('networkidle');
            
            const invoicesTab = page.locator('button:has-text("Invoices"), [role="tab"]:has-text("Invoices"), [data-value="invoices"]').first();
            await invoicesTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render invoices table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Security Module - API Keys table
    test.describe('Security Module - API Keys Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/security');
            await page.waitForLoadState('networkidle');
            
            const accessTab = page.locator('button:has-text("API Keys"), [role="tab"]:has-text("API Keys"), [data-value="access"]').first();
            await accessTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render API keys table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Security Module - Audit Log table
    test.describe('Security Module - Audit Log Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/security');
            await page.waitForLoadState('networkidle');
            
            const auditTab = page.locator('button:has-text("Audit"), [role="tab"]:has-text("Audit"), [data-value="audit"]').first();
            await auditTab.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
        });

        test('should render audit log table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Feedback Module - Feedback table
    test.describe('Feedback Module - Feedback Table', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/feedback');
            await page.waitForLoadState('networkidle');
        });

        test('should render feedback table', async ({ page }) => {
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            await expect(table).toBeVisible({ timeout: 5000 });
        });
    });

    // Test that all tables have proper structure
    test('should verify table structure for all tables', async ({ page }) => {
        const tablesToTest = [
            { module: 'team', tab: 'users', name: 'Users' },
            { module: 'team', tab: 'groups', name: 'Groups' },
            { module: 'team', tab: 'invitations', name: 'Invitations' },
            { module: 'workspace', tab: 'projects', name: 'Projects' },
            { module: 'billing', tab: 'payment', name: 'Payment Methods' },
            { module: 'billing', tab: 'invoices', name: 'Invoices' },
            { module: 'security', tab: 'access', name: 'API Keys' },
            { module: 'security', tab: 'audit', name: 'Audit Log' },
        ];

        for (const { module, tab, name } of tablesToTest) {
            await page.goto(`http://localhost:3000/admin/${module}`);
            await page.waitForLoadState('networkidle');
            
            // Switch to tab
            const tabButton = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}"), [data-value="${tab}"]`).first();
            if (await tabButton.isVisible()) {
                await tabButton.click({ timeout: 5000 });
                await page.waitForTimeout(1000);
            }
            
            // Check for table
            const table = page.locator('table, [role="table"], [class*="table"]').first();
            const tableVisible = await table.isVisible().catch(() => false);
            
            // Check for empty state if table not visible
            if (!tableVisible) {
                const emptyState = page.locator('text=/no.*data|empty|no.*found/i');
                const hasEmptyState = await emptyState.isVisible().catch(() => false);
                expect(hasEmptyState || tableVisible).toBeTruthy();
            } else {
                expect(tableVisible).toBeTruthy();
            }
        }
    });
});

