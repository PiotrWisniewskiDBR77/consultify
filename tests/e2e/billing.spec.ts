/**
 * E2E Tests for Billing Module
 * Tests complete billing flows including checkout, plan changes, and payments
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// Stripe test card numbers
const TEST_CARDS = {
    success: '4242424242424242',
    declined: '4000000000000002',
    insufficientFunds: '4000000000009995',
    expiredCard: '4000000000009987'
};

test.describe('Billing Module E2E', () => {
    let page: Page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        
        // Login
        await page.goto(`${BASE_URL}/login`);
        await page.fill('[data-testid="email-input"]', TEST_USER_EMAIL);
        await page.fill('[data-testid="password-input"]', TEST_USER_PASSWORD);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/dashboard**');
    });

    test.afterEach(async () => {
        await page.close();
    });

    test.describe('Billing Dashboard', () => {
        test('should display current billing information', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            
            // Wait for billing page to load
            await page.waitForSelector('[data-testid="billing-dashboard"]', { timeout: 10000 });
            
            // Check for essential elements
            await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();
            await expect(page.locator('[data-testid="usage-metrics"]')).toBeVisible();
        });

        test('should show usage dashboard with metrics', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            
            // Click on Usage Dashboard tab
            await page.click('text=Usage Dashboard');
            
            // Verify usage meters are displayed
            await expect(page.locator('[data-testid="token-usage"]')).toBeVisible();
            await expect(page.locator('[data-testid="storage-usage"]')).toBeVisible();
            await expect(page.locator('[data-testid="seats-usage"]')).toBeVisible();
            
            // Verify charts are rendered
            await expect(page.locator('.recharts-responsive-container')).toBeVisible();
        });

        test('should display invoices list', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            
            // Click on Invoices tab
            await page.click('text=Invoices');
            
            // Wait for invoices to load
            await page.waitForSelector('[data-testid="invoices-list"]', { timeout: 10000 });
            
            // Verify table structure
            await expect(page.locator('table')).toBeVisible();
            await expect(page.locator('th:has-text("Invoice")')).toBeVisible();
            await expect(page.locator('th:has-text("Amount")')).toBeVisible();
            await expect(page.locator('th:has-text("Status")')).toBeVisible();
        });

        test('should allow downloading invoice PDF', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Invoices');
            
            // Wait for invoices to load
            await page.waitForSelector('[data-testid="invoices-list"]', { timeout: 10000 });
            
            // Find download button (if invoice exists)
            const downloadButton = page.locator('[data-testid="download-invoice"]').first();
            if (await downloadButton.isVisible()) {
                const [download] = await Promise.all([
                    page.waitForEvent('download'),
                    downloadButton.click()
                ]);
                
                expect(download.suggestedFilename()).toContain('.pdf');
            }
        });
    });

    test.describe('Payment Methods', () => {
        test('should display payment methods', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Payment Methods');
            
            await page.waitForSelector('[data-testid="payment-methods-list"]', { timeout: 10000 });
            
            // Should show either cards or "no payment methods" message
            const hasCards = await page.locator('[data-testid="payment-card"]').count() > 0;
            const hasEmptyMessage = await page.locator('text=No payment methods').isVisible();
            
            expect(hasCards || hasEmptyMessage).toBe(true);
        });

        test('should open add payment method modal', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Payment Methods');
            
            await page.waitForSelector('[data-testid="payment-methods-list"]', { timeout: 10000 });
            
            // Click add payment method
            await page.click('[data-testid="add-payment-method"]');
            
            // Modal should appear
            await expect(page.locator('[data-testid="payment-method-modal"]')).toBeVisible();
        });

        test('should set default payment method', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Payment Methods');
            
            await page.waitForSelector('[data-testid="payment-methods-list"]', { timeout: 10000 });
            
            const cards = page.locator('[data-testid="payment-card"]');
            if (await cards.count() > 1) {
                // Find non-default card and click set default
                const nonDefaultCard = page.locator('[data-testid="payment-card"]:not(:has([data-testid="default-badge"]))').first();
                await nonDefaultCard.locator('[data-testid="set-default-btn"]').click();
                
                // Verify success toast
                await expect(page.locator('.toast-success')).toBeVisible();
            }
        });
    });

    test.describe('Spending Alerts', () => {
        test('should display spending alerts', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Spending Alerts');
            
            await page.waitForSelector('[data-testid="spending-alerts"]', { timeout: 10000 });
            
            // Should show alerts or create button
            await expect(page.locator('[data-testid="create-alert-btn"]')).toBeVisible();
        });

        test('should create new spending alert', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Spending Alerts');
            
            await page.waitForSelector('[data-testid="spending-alerts"]', { timeout: 10000 });
            
            // Click create alert
            await page.click('[data-testid="create-alert-btn"]');
            
            // Fill in alert details
            await page.selectOption('[data-testid="alert-type"]', 'ai_tokens');
            await page.fill('[data-testid="alert-threshold"]', '80');
            await page.selectOption('[data-testid="threshold-type"]', 'percentage');
            await page.selectOption('[data-testid="alert-action"]', 'notify');
            
            // Submit
            await page.click('[data-testid="save-alert-btn"]');
            
            // Verify success
            await expect(page.locator('.toast-success')).toBeVisible();
        });

        test('should toggle spending alert active state', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Spending Alerts');
            
            await page.waitForSelector('[data-testid="spending-alerts"]', { timeout: 10000 });
            
            const alertToggle = page.locator('[data-testid="alert-toggle"]').first();
            if (await alertToggle.isVisible()) {
                await alertToggle.click();
                await expect(page.locator('.toast-success')).toBeVisible();
        }
    });
});

    test.describe('Plan Management', () => {
        test('should display current plan details', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Plan & Subscription');
            
            await page.waitForSelector('[data-testid="current-plan-card"]', { timeout: 10000 });
            
            // Should show plan name and price
            await expect(page.locator('[data-testid="plan-name"]')).toBeVisible();
            await expect(page.locator('[data-testid="plan-price"]')).toBeVisible();
        });

        test('should open plan comparison modal', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Plan & Subscription');
            
            await page.waitForSelector('[data-testid="current-plan-card"]', { timeout: 10000 });
            
            // Click change plan
            await page.click('[data-testid="change-plan-btn"]');
            
            // Modal should appear with plans
            await expect(page.locator('[data-testid="plan-comparison-modal"]')).toBeVisible();
            await expect(page.locator('[data-testid="plan-option"]')).toHaveCount.greaterThan(0);
        });

        test('should show proration preview on plan change', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Plan & Subscription');
            
            await page.waitForSelector('[data-testid="current-plan-card"]', { timeout: 10000 });
            
            // Click change plan
            await page.click('[data-testid="change-plan-btn"]');
            await page.waitForSelector('[data-testid="plan-comparison-modal"]');
            
            // Select a different plan
            await page.click('[data-testid="plan-option"]:not(.selected)');
            
            // Proration info should appear
            await expect(page.locator('[data-testid="proration-preview"]')).toBeVisible();
        });
    });

    test.describe('Billing Settings', () => {
        test('should display billing settings form', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Billing Settings');
            
            await page.waitForSelector('[data-testid="billing-settings-form"]', { timeout: 10000 });
            
            // Check for tax information fields
            await expect(page.locator('[data-testid="company-name-input"]')).toBeVisible();
            await expect(page.locator('[data-testid="tax-id-input"]')).toBeVisible();
        });

        test('should save billing settings', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Billing Settings');
            
            await page.waitForSelector('[data-testid="billing-settings-form"]', { timeout: 10000 });
            
            // Update company name
            await page.fill('[data-testid="company-name-input"]', 'Test Company Inc.');
            
            // Save
            await page.click('[data-testid="save-billing-settings"]');
            
            // Verify success
            await expect(page.locator('.toast-success')).toBeVisible();
        });

        test('should update notification preferences', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Billing Settings');
            
            await page.waitForSelector('[data-testid="notification-preferences"]', { timeout: 10000 });
            
            // Toggle a notification
            const toggle = page.locator('[data-testid="notification-toggle"]').first();
            await toggle.click();
            
            // Save
            await page.click('[data-testid="save-notifications"]');
            
            // Verify success
            await expect(page.locator('.toast-success')).toBeVisible();
        });
    });

    test.describe('Complete Checkout Flow', () => {
        test.skip('should complete checkout with test card', async () => {
            // Skip in CI - requires real Stripe Elements
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Plan & Subscription');
            
            // Open plan comparison
            await page.click('[data-testid="change-plan-btn"]');
            await page.waitForSelector('[data-testid="plan-comparison-modal"]');
            
            // Select an upgrade plan
            await page.click('[data-testid="plan-option"][data-plan="pro"]');
            await page.click('[data-testid="upgrade-plan-btn"]');
            
            // Should redirect to Stripe Checkout or show embedded form
            await page.waitForURL('**/checkout.stripe.com/**', { timeout: 30000 });
            
            // In real test, would fill Stripe form here
        });
    });

    test.describe('Subscription Cancellation Flow', () => {
        test.skip('should show cancellation confirmation', async () => {
            await page.goto(`${BASE_URL}/admin?module=billing`);
            await page.click('text=Plan & Subscription');
            
            // Click cancel subscription
            await page.click('[data-testid="cancel-subscription-btn"]');
            
            // Confirmation modal should appear
            await expect(page.locator('[data-testid="cancel-confirmation-modal"]')).toBeVisible();
            
            // Should show access end date
            await expect(page.locator('[data-testid="access-until-date"]')).toBeVisible();
        });
    });
});

test.describe('Billing Access Control', () => {
    test('should restrict billing access for non-admin users', async ({ browser }) => {
        const page = await browser.newPage();
        
        // Login as regular user
        await page.goto(`${BASE_URL}/login`);
        await page.fill('[data-testid="email-input"]', 'user@example.com');
        await page.fill('[data-testid="password-input"]', 'userpassword123');
        await page.click('[data-testid="login-button"]');
        
        // Try to access billing
        await page.goto(`${BASE_URL}/admin?module=billing`);
        
        // Should be redirected or show access denied
        const currentUrl = page.url();
        const hasAccessDenied = await page.locator('text=Access Denied').isVisible();
        
        expect(currentUrl.includes('billing') && !hasAccessDenied).toBe(false);
        
        await page.close();
    });
});
