/**
 * Demo Flow E2E Tests
 * 
 * End-to-end tests for the complete demo experience.
 * Tests the user journey from landing page to demo exploration.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Demo Flow - Landing Page to Demo', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to ensure fresh state
        await page.goto(BASE_URL);
        await page.evaluate(() => localStorage.clear());
    });

    test('should display demo button on landing page', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Check for demo CTA
        await expect(page.getByRole('button', { name: /demo/i })).toBeVisible();
    });

    test('should open demo modal when clicking demo button', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Click demo button
        await page.getByRole('button', { name: /demo/i }).first().click();
        
        // Modal should appear
        await expect(page.getByText(/Experience Consultinity/i)).toBeVisible();
        await expect(page.getByText(/demo@legolex.com/i)).toBeVisible();
    });

    test('should show Enter Demo and Contact Sales options', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByRole('button', { name: /demo/i }).first().click();
        
        await expect(page.getByRole('button', { name: /Enter Demo/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /Contact Sales/i })).toBeVisible();
    });

    test('should successfully enter demo mode', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Open demo modal
        await page.getByRole('button', { name: /demo/i }).first().click();
        
        // Wait for modal
        await expect(page.getByText(/Experience Consultinity/i)).toBeVisible();
        
        // Click Enter Demo
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        
        // Should redirect to dashboard (allow time for API call)
        await expect(page).toHaveURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
        
        // Demo banner should be visible
        await expect(page.getByText(/Demo Mode/i)).toBeVisible();
    });
});

test.describe('Demo Banner Functionality', () => {
    test.beforeEach(async ({ page }) => {
        // Enter demo mode directly
        await page.goto(BASE_URL);
        await page.evaluate(() => localStorage.clear());
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
    });

    test('should display demo banner with timer', async ({ page }) => {
        await expect(page.getByText(/Demo Mode/i)).toBeVisible();
        // Timer format: HH:MM:SS
        await expect(page.locator('text=/\\d{2}:\\d{2}:\\d{2}/')).toBeVisible();
    });

    test('should display demo email in banner', async ({ page }) => {
        await expect(page.getByText(/demo@legolex.com/i)).toBeVisible();
    });

    test('should have Get Full Access button', async ({ page }) => {
        await expect(page.getByRole('button', { name: /Get Full Access|Upgrade/i })).toBeVisible();
    });

    test('should be able to minimize banner', async ({ page }) => {
        // Find and click minimize button
        await page.getByRole('button', { name: /minimize/i }).click();
        
        // Banner should be minimized (smaller version)
        const fullBanner = page.locator('.fixed.top-0').first();
        await expect(fullBanner).toBeVisible();
    });
});

test.describe('Demo Welcome Tour', () => {
    test.beforeEach(async ({ page }) => {
        // Clear tour completion flag
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.clear();
        });
    });

    test('should show welcome tour on first demo entry', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        
        // Wait for dashboard
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
        
        // Tour should appear
        await expect(page.getByText(/Welcome to Consultinity/i)).toBeVisible({ timeout: 5000 });
    });

    test('should display role selection options', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
        
        // Wait for tour
        await page.waitForSelector('text=Welcome to Consultinity', { timeout: 5000 });
        
        // Check role options
        await expect(page.getByText(/CEO \/ Executive/i)).toBeVisible();
        await expect(page.getByText(/CTO \/ Tech Lead/i)).toBeVisible();
        await expect(page.getByText(/Consultant/i)).toBeVisible();
        await expect(page.getByText(/Investor/i)).toBeVisible();
    });

    test('should be able to skip tour', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
        
        // Wait for tour
        await page.waitForSelector('text=Welcome to Consultinity', { timeout: 5000 });
        
        // Skip tour
        await page.getByText(/Skip tour/i).click();
        
        // Tour should close
        await expect(page.getByText(/Welcome to Consultinity/i)).not.toBeVisible();
    });

    test('should not show tour on subsequent visits', async ({ page }) => {
        // First visit - complete tour
        await page.goto(BASE_URL);
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
        
        await page.waitForSelector('text=Welcome to Consultinity', { timeout: 5000 });
        await page.getByText(/Skip tour/i).click();
        
        // Reload page
        await page.reload();
        
        // Tour should not appear
        await page.waitForTimeout(2000);
        await expect(page.getByText(/Welcome to Consultinity/i)).not.toBeVisible();
    });
});

test.describe('Demo Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Enter demo mode and skip tour
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.setItem('demo_tour_completed', 'true');
        });
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
    });

    test('should be able to navigate to Assessment', async ({ page }) => {
        // Find and click Assessment in sidebar
        await page.getByRole('link', { name: /Assessment/i }).first().click();
        
        // Should navigate to assessment view
        await expect(page).toHaveURL(/.*assessment.*/i);
    });

    test('should be able to navigate to My Work', async ({ page }) => {
        await page.getByRole('link', { name: /My Work/i }).first().click();
        await expect(page).toHaveURL(/.*work.*/i);
    });

    test('demo data should be loaded', async ({ page }) => {
        // Check for demo organization name
        await expect(page.getByText(/Legolex|Demo/i)).toBeVisible();
    });
});

test.describe('Demo Conversion CTAs', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.setItem('demo_tour_completed', 'true');
        });
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
    });

    test('Get Full Access opens HubSpot calendar', async ({ page }) => {
        // Click Get Full Access
        const [popup] = await Promise.all([
            page.waitForEvent('popup'),
            page.getByRole('button', { name: /Get Full Access|Upgrade/i }).first().click()
        ]);
        
        // Should open HubSpot
        expect(popup.url()).toContain('meetings.hubspot.com');
    });
});

test.describe('Demo Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display mobile-friendly demo banner', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.setItem('demo_tour_completed', 'true');
        });
        
        await page.getByRole('button', { name: /demo/i }).first().click();
        await page.getByRole('button', { name: /Enter Demo/i }).click();
        await page.waitForURL(/.*dashboard.*|.*app.*/i, { timeout: 10000 });
        
        // Banner should be visible on mobile
        await expect(page.getByText(/Demo Mode/i)).toBeVisible();
        
        // Upgrade button should show short text on mobile
        await expect(page.getByRole('button', { name: /Upgrade/i })).toBeVisible();
    });
});

test.describe('Language Support in Demo', () => {
    const languages = ['en', 'de', 'pl', 'es', 'ja', 'ar'];

    for (const lang of languages) {
        test(`should work correctly in ${lang}`, async ({ page }) => {
            await page.goto(`${BASE_URL}?lng=${lang}`);
            
            // Demo button should be visible in any language
            const demoButtons = page.getByRole('button').filter({ hasText: /demo|デモ|تجربة/i });
            await expect(demoButtons.first()).toBeVisible();
        });
    }
});






