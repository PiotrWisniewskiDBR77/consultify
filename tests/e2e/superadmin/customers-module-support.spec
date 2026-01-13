/**
 * E2E tests for Customers Module - Support
 */

import { test, expect } from '@playwright/test';

test.describe('Customers Module - Support', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/superadmin');
        // Add login logic
    });

    test('should display support tickets', async ({ page }) => {
        await page.goto('/superadmin/customers?tab=support');
        
        await expect(page.locator('h2:has-text("Support Tickets")')).toBeVisible();
    });

    test('should create a support ticket', async ({ page }) => {
        await page.goto('/superadmin/customers?tab=support');
        await page.click('text=Create Ticket');
        
        await page.fill('input[placeholder*="subject"]', 'Test Ticket');
        await page.fill('textarea[placeholder*="Describe"]', 'Test Description');
        await page.click('button:has-text("Create Ticket")');
        
        await expect(page.locator('text=Test Ticket')).toBeVisible();
    });

    test('should display customer success notes', async ({ page }) => {
        await page.goto('/superadmin/customers?tab=support');
        await page.click('text=CS Notes');
        
        await expect(page.locator('h2:has-text("Customer Success Notes")')).toBeVisible();
    });
});













