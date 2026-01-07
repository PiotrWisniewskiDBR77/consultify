/**
 * Admin Panel Modules Tabs E2E Tests
 * Tests navigation between tabs within each Admin module (32 tabs total)
 * FIXED: Using text-based selectors since tabs don't have role/data-value attributes
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Panel Modules Tabs', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/admin');
        await page.waitForLoadState('networkidle');
    });

    // Helper function to click tab by text
    const clickTabByText = async (page: any, tabText: string) => {
        // Find button containing the tab text (case-insensitive)
        const tabButton = page.locator(`button:has-text("${tabText}")`).first();
        await tabButton.click({ timeout: 10000 });
        await page.waitForTimeout(1000);

        // Verify tab is active by checking if it has the active border class
        const hasActiveBorder = await tabButton.evaluate((el: HTMLElement) => {
            return el.classList.contains('border-purple-600') ||
                el.classList.contains('border-blue-600') ||
                el.classList.contains('border-indigo-600');
        });

        expect(hasActiveBorder).toBeTruthy();
    };

    // Overview Module - 3 tabs
    test.describe('Overview Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/overview');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Dashboard tab', async ({ page }) => {
            await clickTabByText(page, 'Dashboard');
        });

        test('should switch to Metrics tab', async ({ page }) => {
            await clickTabByText(page, 'Metrics');
        });

        test('should switch to Analytics tab', async ({ page }) => {
            await clickTabByText(page, 'Analytics');
        });
    });

    // Organization Module - 2 tabs
    test.describe('Organization Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/organization');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Profile tab', async ({ page }) => {
            await clickTabByText(page, 'Profile');
        });

        test('should switch to Ownership tab', async ({ page }) => {
            await clickTabByText(page, 'Ownership');
        });
    });

    // Team Module - 5 tabs
    test.describe('Team Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/team');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Users tab', async ({ page }) => {
            await clickTabByText(page, 'Users');
        });

        test('should switch to Groups tab', async ({ page }) => {
            await clickTabByText(page, 'Groups');
        });

        test('should switch to Invitations tab', async ({ page }) => {
            await clickTabByText(page, 'Invitations');
        });

        test('should switch to Roles tab', async ({ page }) => {
            await clickTabByText(page, 'Roles');
        });

        test('should switch to Consultants tab', async ({ page }) => {
            await clickTabByText(page, 'Consultants');
        });
    });

    // Workspace Module - 4 tabs
    test.describe('Workspace Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/workspace');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Projects tab', async ({ page }) => {
            await clickTabByText(page, 'Projects');
        });

        test('should switch to Knowledge tab', async ({ page }) => {
            await clickTabByText(page, 'Knowledge');
        });

        test('should switch to Playbooks tab', async ({ page }) => {
            await clickTabByText(page, 'Playbooks');
        });

        test('should switch to Bulk Operations tab', async ({ page }) => {
            await clickTabByText(page, 'Bulk');
        });
    });

    // AI Module - 6 tabs
    test.describe('AI Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/ai');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Models tab', async ({ page }) => {
            await clickTabByText(page, 'Models');
        });

        test('should switch to Health tab', async ({ page }) => {
            await clickTabByText(page, 'Health');
        });

        test('should switch to Policy tab', async ({ page }) => {
            await clickTabByText(page, 'Policy');
        });

        test('should switch to Access tab', async ({ page }) => {
            await clickTabByText(page, 'Access');
        });

        test('should switch to Features tab', async ({ page }) => {
            await clickTabByText(page, 'Features');
        });

        test('should switch to Audit tab', async ({ page }) => {
            await clickTabByText(page, 'Audit');
        });
    });

    // Billing Module - 7 tabs
    test.describe('Billing Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/billing');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Usage tab', async ({ page }) => {
            await clickTabByText(page, 'Usage');
        });

        test('should switch to Plan tab', async ({ page }) => {
            await clickTabByText(page, 'Plan');
        });

        test('should switch to Payment tab', async ({ page }) => {
            await clickTabByText(page, 'Payment');
        });

        test('should switch to Invoices tab', async ({ page }) => {
            await clickTabByText(page, 'Invoices');
        });

        test('should switch to Alerts tab', async ({ page }) => {
            await clickTabByText(page, 'Alerts');
        });

        test('should switch to Settings tab', async ({ page }) => {
            await clickTabByText(page, 'Settings');
        });

        test('should switch to Cost Allocation tab', async ({ page }) => {
            await clickTabByText(page, 'Cost');
        });
    });

    // Security Module - 5 tabs
    test.describe('Security Module Tabs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:3000/admin/security');
            await page.waitForLoadState('networkidle');
        });

        test('should switch to Security Settings tab', async ({ page }) => {
            await clickTabByText(page, 'Security');
        });

        test('should switch to Authentication tab', async ({ page }) => {
            await clickTabByText(page, 'Authentication');
        });

        test('should switch to API Keys tab', async ({ page }) => {
            await clickTabByText(page, 'API Keys');
        });

        test('should switch to Audit Log tab', async ({ page }) => {
            await clickTabByText(page, 'Audit');
        });

        test('should switch to Data Management tab', async ({ page }) => {
            await clickTabByText(page, 'Data');
        });
    });

    // Test sequential tab navigation within a module
    test('should navigate through all tabs in Team module sequentially', async ({ page }) => {
        await page.goto('http://localhost:3000/admin/team');
        await page.waitForLoadState('networkidle');

        const tabs = ['Users', 'Groups', 'Invitations', 'Roles', 'Consultants'];

        for (const tab of tabs) {
            await clickTabByText(page, tab);
        }
    });
});
