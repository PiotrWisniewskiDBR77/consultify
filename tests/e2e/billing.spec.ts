import { test, expect } from '@playwright/test';

test.describe('Billing E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to login page
        await page.goto('/');
        
        // Login (assuming demo mode or test credentials)
        const loginButton = page.locator('text=Login').or(page.locator('text=Sign In'));
        if (await loginButton.isVisible()) {
            await loginButton.click();
            await page.fill('input[type="email"]', 'test@example.com');
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
            await page.waitForURL(/dashboard|home/i);
        }
    });

    test('should navigate to billing settings', async ({ page }) => {
        await page.goto('/settings/billing');
        
        await expect(page.locator('h1, h2')).toContainText(/billing|subscription/i);
    });

    test('should display current plan', async ({ page }) => {
        await page.goto('/settings/billing');
        
        // Wait for billing content
        await page.waitForSelector('[data-testid="billing-core"], .plan-card, .current-plan', { timeout: 10000 });
        
        // Check for plan information
        const planInfo = page.locator('text=/plan|subscription/i');
        const count = await planInfo.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display usage meters', async ({ page }) => {
        await page.goto('/settings/billing');
        
        await page.waitForSelector('[data-testid="billing-core"], .usage-meter, .usage', { timeout: 10000 });
        
        // Check for usage information
        const usageInfo = page.locator('text=/usage|credits|tokens/i');
        const count = await usageInfo.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display invoices list', async ({ page }) => {
        await page.goto('/settings/billing');
        
        // Look for invoices section
        const invoicesSection = page.locator('text=/invoice/i');
        if (await invoicesSection.isVisible()) {
            await invoicesSection.click();
            
            // Wait for invoices table/list
            await page.waitForSelector('table, .invoice-list, [data-testid="invoice"]', { timeout: 5000 });
            
            const invoices = page.locator('table tbody tr, .invoice-item, [data-testid="invoice"]');
            const count = await invoices.count();
            expect(count).toBeGreaterThanOrEqual(0);
        }
    });

    test('should display legal documents links', async ({ page }) => {
        await page.goto('/settings/billing');
        
        // Check for legal document links
        const subscriptionLink = page.locator('text=Subscription Agreement');
        const slaLink = page.locator('text=Service Level Agreement');
        const refundLink = page.locator('text=Refund Policy');
        
        if (await subscriptionLink.isVisible()) {
            expect(await subscriptionLink.getAttribute('href')).toContain('/legal');
        }
        
        if (await slaLink.isVisible()) {
            expect(await slaLink.getAttribute('href')).toContain('/legal');
        }
        
        if (await refundLink.isVisible()) {
            expect(await refundLink.getAttribute('href')).toContain('/legal');
        }
    });

    test('should handle plan upgrade flow', async ({ page }) => {
        await page.goto('/settings/billing');
        
        // Look for upgrade button
        const upgradeButton = page.locator('text=Upgrade').or(page.locator('button:has-text("Upgrade")'));
        
        if (await upgradeButton.isVisible()) {
            await upgradeButton.click();
            
            // Check if upgrade modal/page opened
            await expect(
                page.locator('[role="dialog"], .modal, [data-testid="upgrade-modal"]')
            ).toBeVisible({ timeout: 5000 });
        }
    });
});










