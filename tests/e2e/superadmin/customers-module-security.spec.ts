/**
 * E2E tests for Customers Module - Security
 */

import { test, expect } from '@playwright/test';

test.describe('Customers Module - Security', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to SuperAdmin and login
        await page.goto('/superadmin');
        // Add login logic here
    });

    test('should display IP Whitelist view', async ({ page }) => {
        await page.click('text=Customers');
        await page.click('text=Security');
        await page.click('text=IP Whitelist');
        
        await expect(page.locator('h2:has-text("IP Whitelist")')).toBeVisible();
    });

    test('should add IP to whitelist', async ({ page }) => {
        await page.goto('/superadmin/customers?tab=security');
        await page.click('text=IP Whitelist');
        await page.click('text=Add IP');
        
        await page.fill('input[placeholder*="IP"]', '192.168.1.1');
        await page.fill('input[placeholder*="Description"]', 'Test IP');
        await page.click('button:has-text("Add IP")');
        
        await expect(page.locator('text=192.168.1.1')).toBeVisible();
    });

    test('should display device management', async ({ page }) => {
        await page.goto('/superadmin/customers?tab=security');
        await page.click('text=Devices');
        
        await expect(page.locator('h2:has-text("Device Management")')).toBeVisible();
    });

    test('should display security events', async ({ page }) => {
        await page.goto('/superadmin/customers?tab=security');
        await page.click('text=Security Events');
        
        await expect(page.locator('h2:has-text("Security Events")')).toBeVisible();
    });
});




