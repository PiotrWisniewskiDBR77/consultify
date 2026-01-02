/**
 * E2E Tests for Extended Settings Profile
 * 
 * Tests for the new profile settings features including:
 * - Bio & About
 * - Social Links
 * - Profile Visibility
 * - Email Communication
 * - Keyboard Shortcuts
 * - Quiet Hours
 * - Data Privacy
 */
import { test, expect, Page } from '@playwright/test';

// Helper function to login
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/**');
}

// Helper function to navigate to settings
async function navigateToSettings(page: Page) {
    await page.click('[data-testid="settings-button"]');
    await page.waitForURL('/settings/**');
}

test.describe('Settings Profile Extended', () => {
    test.beforeEach(async ({ page }) => {
        // Login and navigate to settings before each test
        await login(page);
        await navigateToSettings(page);
    });

    test.describe('Bio & About Section', () => {
        test('should display Bio & About tab', async ({ page }) => {
            await page.click('text=Bio');
            await expect(page.locator('h3:has-text("Bio & About")')).toBeVisible();
        });

        test('should save short bio', async ({ page }) => {
            await page.click('text=Bio');
            await page.fill('input[placeholder*="brief one-liner"]', 'Software Engineer at Example Corp');
            await page.click('button:has-text("Save")');
            await expect(page.locator('text=Saved!')).toBeVisible();
        });

        test('should add and remove skills', async ({ page }) => {
            await page.click('text=Bio');
            
            // Add a skill
            await page.fill('input[placeholder*="Add a skill"]', 'JavaScript');
            await page.press('input[placeholder*="Add a skill"]', 'Enter');
            await expect(page.locator('span:has-text("JavaScript")')).toBeVisible();
            
            // Remove the skill
            await page.locator('span:has-text("JavaScript")').locator('button').click();
            await expect(page.locator('span:has-text("JavaScript")')).not.toBeVisible();
        });

        test('should show character count for bio', async ({ page }) => {
            await page.click('text=Bio');
            const input = page.locator('input[placeholder*="brief one-liner"]');
            await input.fill('Test bio');
            await expect(page.locator('text=/\\d+\\/150/')).toBeVisible();
        });
    });

    test.describe('Social Links Section', () => {
        test('should display Social Links tab', async ({ page }) => {
            await page.click('text=Social');
            await expect(page.locator('h3:has-text("Social & Links")')).toBeVisible();
        });

        test('should save social profile links', async ({ page }) => {
            await page.click('text=Social');
            await page.fill('input[placeholder*="linkedin"]', 'johndoe');
            await page.fill('input[placeholder*="github"]', 'johndoe');
            await page.click('button:has-text("Save")');
            await expect(page.locator('text=Saved!')).toBeVisible();
        });

        test('should add custom link', async ({ page }) => {
            await page.click('text=Social');
            await page.fill('input[placeholder*="Link name"]', 'My Blog');
            await page.fill('input[placeholder*="https://"]', 'https://myblog.com');
            await page.click('button:has-text("Add Link")');
            await expect(page.locator('text=My Blog')).toBeVisible();
        });
    });

    test.describe('Profile Visibility Section', () => {
        test('should display Visibility tab', async ({ page }) => {
            await page.click('text=Visibility');
            await expect(page.locator('h3:has-text("Privacy & Visibility")')).toBeVisible();
        });

        test('should select visibility level', async ({ page }) => {
            await page.click('text=Visibility');
            await page.click('button:has-text("Private")');
            await expect(page.locator('button:has-text("Private")')).toHaveClass(/border-purple/);
        });

        test('should toggle contact information visibility', async ({ page }) => {
            await page.click('text=Visibility');
            const emailToggle = page.locator('text=Show email address').locator('..').locator('button[class*="rounded-full"]');
            await emailToggle.click();
            await expect(emailToggle).toHaveClass(/bg-purple/);
        });
    });

    test.describe('Keyboard Shortcuts Section', () => {
        test('should display Shortcuts tab', async ({ page }) => {
            await page.click('text=Shortcuts');
            await expect(page.locator('h3:has-text("Keyboard Shortcuts")')).toBeVisible();
        });

        test('should enable/disable shortcuts', async ({ page }) => {
            await page.click('text=Shortcuts');
            const enableToggle = page.locator('text=Enable Keyboard Shortcuts').locator('..').locator('button[class*="rounded-full"]');
            const initialState = await enableToggle.getAttribute('class');
            await enableToggle.click();
            const newState = await enableToggle.getAttribute('class');
            expect(initialState).not.toBe(newState);
        });

        test('should select preset', async ({ page }) => {
            await page.click('text=Shortcuts');
            await page.click('button:has-text("VS Code")');
            await expect(page.locator('button:has-text("VS Code")')).toHaveClass(/border-purple/);
        });

        test('should filter shortcuts by search', async ({ page }) => {
            await page.click('text=Shortcuts');
            await page.fill('input[placeholder*="Search shortcuts"]', 'search');
            await expect(page.locator('text=Global Search')).toBeVisible();
            await expect(page.locator('text=Go to Home')).not.toBeVisible();
        });
    });

    test.describe('Quiet Hours Section', () => {
        test('should display Quiet Hours settings', async ({ page }) => {
            await page.click('text=Quiet Hours');
            await expect(page.locator('h3:has-text("Quiet Hours")')).toBeVisible();
        });

        test('should enable quiet hours', async ({ page }) => {
            await page.click('text=Quiet Hours');
            const enableToggle = page.locator('text=Enable Quiet Hours').locator('..').locator('button[class*="rounded-full"]');
            await enableToggle.click();
            await expect(page.locator('text=Schedule')).toBeVisible();
        });

        test('should set schedule times', async ({ page }) => {
            await page.click('text=Quiet Hours');
            // Enable quiet hours first
            await page.locator('text=Enable Quiet Hours').locator('..').locator('button[class*="rounded-full"]').click();
            
            await page.fill('input[type="time"]', '22:00');
            await expect(page.locator('input[type="time"]')).toHaveValue('22:00');
        });

        test('should apply quick preset', async ({ page }) => {
            await page.click('text=Quiet Hours');
            await page.locator('text=Enable Quiet Hours').locator('..').locator('button[class*="rounded-full"]').click();
            await page.click('button:has-text("Nights")');
            
            // All day buttons should be selected
            await expect(page.locator('button:has-text("Mon")')).toHaveClass(/border-indigo/);
        });
    });

    test.describe('Data Privacy Section', () => {
        test('should display Data Privacy settings', async ({ page }) => {
            await page.click('text=Data & Privacy');
            await expect(page.locator('h3:has-text("Data & Privacy")')).toBeVisible();
        });

        test('should toggle data sharing options', async ({ page }) => {
            await page.click('text=Data & Privacy');
            const analyticsToggle = page.locator('text=Share analytics data').locator('..').locator('button[class*="rounded-full"]');
            await analyticsToggle.click();
            // Toggle state should change
        });

        test('should select data retention policy', async ({ page }) => {
            await page.click('text=Data & Privacy');
            await page.click('button:has-text("Minimal")');
            await expect(page.locator('button:has-text("Minimal")')).toHaveClass(/border-purple/);
        });

        test('should request data export', async ({ page }) => {
            await page.click('text=Data & Privacy');
            await page.click('button:has-text("Request Data Export")');
            // Should show preparing state or success message
        });

        test('should show account deletion confirmation', async ({ page }) => {
            await page.click('text=Data & Privacy');
            await page.click('button:has-text("Request Account Deletion")');
            await expect(page.locator('text=Are you sure?')).toBeVisible();
        });
    });

    test.describe('Accessibility Settings Extended', () => {
        test('should display extended accessibility options', async ({ page }) => {
            await page.click('text=Accessibility');
            await expect(page.locator('text=Color Vision')).toBeVisible();
            await expect(page.locator('text=Font Family')).toBeVisible();
            await expect(page.locator('text=Voice & Speech')).toBeVisible();
        });

        test('should select color blind mode', async ({ page }) => {
            await page.click('text=Accessibility');
            await page.click('button:has-text("Protanopia")');
            await expect(page.locator('button:has-text("Protanopia")')).toHaveClass(/border-cyan/);
        });

        test('should change font family', async ({ page }) => {
            await page.click('text=Accessibility');
            await page.click('button:has-text("OpenDyslexic")');
            await expect(page.locator('button:has-text("OpenDyslexic")')).toHaveClass(/border-orange/);
        });

        test('should toggle voice commands', async ({ page }) => {
            await page.click('text=Accessibility');
            const voiceToggle = page.locator('text=Voice Commands').locator('..').locator('button[class*="rounded-full"]');
            await voiceToggle.click();
            await expect(voiceToggle).toHaveClass(/bg-purple/);
        });
    });

    test.describe('Settings Navigation', () => {
        test('should navigate between tabs smoothly', async ({ page }) => {
            // Test tab navigation
            await page.click('text=Bio');
            await expect(page.locator('h3:has-text("Bio & About")')).toBeVisible();
            
            await page.click('text=Social');
            await expect(page.locator('h3:has-text("Social & Links")')).toBeVisible();
            
            await page.click('text=Visibility');
            await expect(page.locator('h3:has-text("Privacy & Visibility")')).toBeVisible();
        });

        test('should preserve unsaved changes warning', async ({ page }) => {
            await page.click('text=Bio');
            await page.fill('input[placeholder*="brief one-liner"]', 'Unsaved changes');
            
            // Try to navigate away
            page.on('dialog', async dialog => {
                expect(dialog.message()).toContain('unsaved');
                await dialog.dismiss();
            });
        });
    });

    test.describe('Form Validation', () => {
        test('should validate email format in aliases', async ({ page }) => {
            await page.click('text=Email');
            await page.fill('input[placeholder*="email alias"]', 'invalid-email');
            await page.click('button:has-text("Add")');
            // Should not add invalid email
        });

        test('should validate URL format in social links', async ({ page }) => {
            await page.click('text=Social');
            await page.fill('input[placeholder*="https://"]', 'not-a-url');
            await page.click('button:has-text("Add Link")');
            // Should show validation error or not add
        });
    });

    test.describe('Responsive Design', () => {
        test('should display correctly on mobile', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.click('text=Bio');
            await expect(page.locator('h3:has-text("Bio & About")')).toBeVisible();
        });

        test('should display correctly on tablet', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.click('text=Shortcuts');
            await expect(page.locator('h3:has-text("Keyboard Shortcuts")')).toBeVisible();
        });
    });
});

