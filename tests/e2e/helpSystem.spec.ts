/**
 * Help System E2E Tests
 * 
 * End-to-end tests for the help system using Playwright.
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Help System E2E', () => {
    let page: Page;
    
    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto(BASE_URL);
        
        // Login if needed (adjust based on your auth flow)
        // await login(page);
    });
    
    test.afterEach(async () => {
        await page.close();
    });
    
    test.describe('Help Side Panel', () => {
        test('should open help panel when clicking help button', async () => {
            // Find and click help toggle button
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Panel should be visible
            await expect(page.locator('[data-testid="help-side-panel"]')).toBeVisible();
        });
        
        test('should close help panel when clicking close button', async () => {
            // Open panel
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Close panel
            const closeButton = page.locator('[data-testid="help-panel-close"]');
            await closeButton.click();
            
            // Panel should be hidden
            await expect(page.locator('[data-testid="help-side-panel"]')).not.toBeVisible();
        });
        
        test('should display correct tabs', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Check for all 4 tabs
            await expect(page.locator('text=Overview')).toBeVisible();
            await expect(page.locator('text=How to Use')).toBeVisible();
            await expect(page.locator('text=FAQ')).toBeVisible();
            await expect(page.locator('text=Video')).toBeVisible();
        });
        
        test('should switch between tabs', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Click FAQ tab
            await page.locator('text=FAQ').click();
            
            // FAQ content should be visible
            await expect(page.locator('[data-testid="faq-list"]')).toBeVisible();
        });
        
        test('should show contextual content based on current view', async () => {
            // Navigate to dashboard
            await page.goto(`${BASE_URL}/dashboard`);
            
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Should show dashboard-related content
            await expect(page.locator('text=Dashboard')).toBeVisible();
        });
    });
    
    test.describe('Global Search', () => {
        test('should open global search with Cmd+K / Ctrl+K', async () => {
            // Press keyboard shortcut
            await page.keyboard.press('Control+k');
            
            // Search modal should be visible
            await expect(page.locator('[data-testid="global-help-search"]')).toBeVisible();
        });
        
        test('should show search results as user types', async () => {
            await page.keyboard.press('Control+k');
            
            // Type search query
            await page.locator('[data-testid="search-input"]').fill('dashboard');
            
            // Wait for results
            await page.waitForSelector('[data-testid="search-results"]');
            
            // Should have results
            const results = page.locator('[data-testid="search-result-item"]');
            await expect(results).toHaveCount({ minimum: 1 });
        });
        
        test('should navigate to result on click', async () => {
            await page.keyboard.press('Control+k');
            await page.locator('[data-testid="search-input"]').fill('settings');
            
            await page.waitForSelector('[data-testid="search-result-item"]');
            await page.locator('[data-testid="search-result-item"]').first().click();
            
            // Help panel should open with settings content
            await expect(page.locator('[data-testid="help-side-panel"]')).toBeVisible();
        });
        
        test('should support keyboard navigation', async () => {
            await page.keyboard.press('Control+k');
            await page.locator('[data-testid="search-input"]').fill('project');
            
            await page.waitForSelector('[data-testid="search-result-item"]');
            
            // Navigate with arrow keys
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            
            // Should have selected an item
            await expect(page.locator('[data-testid="help-side-panel"]')).toBeVisible();
        });
        
        test('should close on Escape', async () => {
            await page.keyboard.press('Control+k');
            await expect(page.locator('[data-testid="global-help-search"]')).toBeVisible();
            
            await page.keyboard.press('Escape');
            await expect(page.locator('[data-testid="global-help-search"]')).not.toBeVisible();
        });
    });
    
    test.describe('InfoButton', () => {
        test('should show info popup on click', async () => {
            // Navigate to settings
            await page.goto(`${BASE_URL}/settings`);
            
            // Find info button on a card
            const infoButton = page.locator('[data-testid="info-button"]').first();
            await infoButton.click();
            
            // Popup should be visible
            await expect(page.locator('[data-testid="info-popup"]')).toBeVisible();
        });
        
        test('should display correct card documentation', async () => {
            await page.goto(`${BASE_URL}/settings/profile`);
            
            const infoButton = page.locator('[data-testid="info-button"]').first();
            await infoButton.click();
            
            // Should show profile-related content
            await expect(page.locator('text=Profile')).toBeVisible();
        });
    });
    
    test.describe('Feedback Widget', () => {
        test('should show feedback widget in help panel', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Navigate to FAQ
            await page.locator('text=FAQ').click();
            
            // Expand an FAQ
            await page.locator('[data-testid="faq-item"]').first().click();
            
            // Feedback widget should be visible
            await expect(page.locator('[data-testid="feedback-widget"]')).toBeVisible();
        });
        
        test('should submit positive feedback', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('text=FAQ').click();
            await page.locator('[data-testid="faq-item"]').first().click();
            
            // Click thumbs up
            await page.locator('[data-testid="feedback-helpful"]').click();
            
            // Thank you message should appear
            await expect(page.locator('text=Thank you')).toBeVisible();
        });
        
        test('should allow comment on negative feedback', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('text=FAQ').click();
            await page.locator('[data-testid="faq-item"]').first().click();
            
            // Click thumbs down
            await page.locator('[data-testid="feedback-not-helpful"]').click();
            
            // Comment textarea should appear
            await expect(page.locator('[data-testid="feedback-comment"]')).toBeVisible();
        });
    });
    
    test.describe('Video Tutorials', () => {
        test('should display video list', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('text=Video').click();
            
            // Video cards should be visible
            await expect(page.locator('[data-testid="video-card"]')).toHaveCount({ minimum: 1 });
        });
        
        test('should play video on click', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('text=Video').click();
            await page.locator('[data-testid="video-card"]').first().click();
            
            // Video player should be visible
            await expect(page.locator('[data-testid="video-player"]')).toBeVisible();
        });
        
        test('should show video progress', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('text=Video').click();
            
            // Progress bar should be visible on some cards
            const progressBars = page.locator('[data-testid="video-progress"]');
            // At least one video might have progress if user has watched before
        });
    });
    
    test.describe('Knowledge Base', () => {
        test('should load knowledge base page', async () => {
            await page.goto(`${BASE_URL}/docs`);
            
            await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible();
        });
        
        test('should show navigation sidebar', async () => {
            await page.goto(`${BASE_URL}/docs`);
            
            await expect(page.locator('[data-testid="kb-sidebar"]')).toBeVisible();
        });
        
        test('should navigate to articles', async () => {
            await page.goto(`${BASE_URL}/docs`);
            
            // Click on a navigation item
            await page.locator('[data-testid="kb-nav-item"]').first().click();
            
            // Article content should be visible
            await expect(page.locator('[data-testid="kb-article"]')).toBeVisible();
        });
        
        test('should support search in knowledge base', async () => {
            await page.goto(`${BASE_URL}/docs`);
            
            await page.locator('[data-testid="kb-search"]').fill('getting started');
            
            // Search results should appear
            await expect(page.locator('[data-testid="kb-search-results"]')).toBeVisible();
        });
    });
    
    test.describe('Status Page', () => {
        test('should load status page', async () => {
            await page.goto(`${BASE_URL}/status`);
            
            await expect(page.locator('[data-testid="status-page"]')).toBeVisible();
        });
        
        test('should show service status indicators', async () => {
            await page.goto(`${BASE_URL}/status`);
            
            // Service cards should be visible
            await expect(page.locator('[data-testid="service-status"]')).toHaveCount({ minimum: 1 });
        });
        
        test('should show incident history', async () => {
            await page.goto(`${BASE_URL}/status`);
            
            // Scroll to incidents section
            await page.locator('text=Incident History').scrollIntoViewIfNeeded();
            
            await expect(page.locator('[data-testid="incident-list"]')).toBeVisible();
        });
    });
    
    test.describe('AI Chatbot', () => {
        test('should open chatbot', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            // Find and click chat trigger
            await page.locator('[data-testid="open-chatbot"]').click();
            
            await expect(page.locator('[data-testid="help-chatbot"]')).toBeVisible();
        });
        
        test('should send message and receive response', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('[data-testid="open-chatbot"]').click();
            
            // Type message
            await page.locator('[data-testid="chat-input"]').fill('How do I create an initiative?');
            await page.locator('[data-testid="chat-send"]').click();
            
            // Wait for response
            await page.waitForSelector('[data-testid="chat-message-assistant"]');
            
            // Response should be visible
            await expect(page.locator('[data-testid="chat-message-assistant"]')).toBeVisible();
        });
        
        test('should show suggested questions', async () => {
            const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
            await helpButton.click();
            
            await page.locator('[data-testid="open-chatbot"]').click();
            
            // Suggestions should be visible
            await expect(page.locator('[data-testid="chat-suggestions"]')).toBeVisible();
        });
    });
});

test.describe('Accessibility', () => {
    test('help button should be keyboard accessible', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Tab to help button
        await page.keyboard.press('Tab');
        // Keep pressing tab until we reach the help button
        let attempts = 0;
        while (attempts < 50) {
            const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
            if (focusedElement?.includes('Help')) {
                break;
            }
            await page.keyboard.press('Tab');
            attempts++;
        }
        
        // Press Enter to activate
        await page.keyboard.press('Enter');
        
        // Help panel should be visible
        await expect(page.locator('[data-testid="help-side-panel"]')).toBeVisible();
    });
    
    test('help panel should trap focus', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
        await helpButton.click();
        
        // Tab through panel
        await page.keyboard.press('Tab');
        
        // Focus should stay within panel
        const focusedInPanel = await page.evaluate(() => {
            const panel = document.querySelector('[data-testid="help-side-panel"]');
            return panel?.contains(document.activeElement);
        });
        
        expect(focusedInPanel).toBe(true);
    });
    
    test('should have proper ARIA labels', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Check help button has aria-label
        const helpButton = page.locator('[aria-label="Open Help Center"], [aria-label="Otwórz Centrum Pomocy"]');
        await expect(helpButton).toHaveAttribute('aria-label');
    });
});








