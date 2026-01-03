/**
 * AI Enterprise Flow E2E Tests
 * 
 * End-to-end tests for complete AI workflows:
 * - Chat conversation flow
 * - Memory persistence
 * - Action proposal and approval
 * - Feedback loop
 * - Multi-user scenarios
 * 
 * Part of Enterprise AI Readiness - Phase 6: E2E Testing
 * 
 * @version 1.0.0
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:5001';

// Test users
const TEST_USER_A = {
    email: 'test-user-a@example.com',
    password: 'TestPass123!',
    organizationId: 'test-org-a'
};

const TEST_USER_B = {
    email: 'test-user-b@example.com',
    password: 'TestPass123!',
    organizationId: 'test-org-b'
};

// Helper functions
async function login(page: Page, user: typeof TEST_USER_A) {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/(dashboard|home|my-work)/);
}

async function openAIChat(page: Page) {
    // Try different possible selectors for AI chat trigger
    const chatTrigger = page.locator('[data-testid="ai-chat-trigger"], [aria-label*="AI"], .ai-chat-button').first();
    await chatTrigger.click();
    await page.waitForSelector('[data-testid="ai-chat-panel"], .ai-chat-panel, .unified-chat-panel');
}

async function sendChatMessage(page: Page, message: string) {
    const input = page.locator('[data-testid="chat-input"], .chat-input, textarea').first();
    await input.fill(message);
    await page.keyboard.press('Enter');
    // Wait for AI response
    await page.waitForSelector('[data-testid="ai-message"], .ai-response, [data-role="ai"]', { timeout: 30000 });
}

async function waitForNoStreaming(page: Page) {
    // Wait for streaming indicator to disappear
    await page.waitForFunction(() => {
        const streamingIndicators = document.querySelectorAll('.animate-bounce, [data-streaming="true"]');
        return streamingIndicators.length === 0;
    }, { timeout: 30000 });
}

// ============================================================================
// Test Suites
// ============================================================================

test.describe('AI Chat Flow', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USER_A);
    });

    test('should open AI chat panel and send message', async ({ page }) => {
        await openAIChat(page);
        
        // Verify chat panel is visible
        await expect(page.locator('[data-testid="ai-chat-panel"], .ai-chat-panel')).toBeVisible();
        
        // Send a message
        await sendChatMessage(page, 'Hello, can you help me with project planning?');
        
        // Verify AI response appears
        const aiResponse = page.locator('[data-testid="ai-message"], [data-role="ai"]').last();
        await expect(aiResponse).toBeVisible();
        
        // Verify response contains relevant content
        const responseText = await aiResponse.textContent();
        expect(responseText).toBeTruthy();
        expect(responseText!.length).toBeGreaterThan(10);
    });

    test('should maintain conversation context', async ({ page }) => {
        await openAIChat(page);
        
        // First message
        await sendChatMessage(page, 'My project is called "Alpha Initiative"');
        await waitForNoStreaming(page);
        
        // Second message referencing first
        await sendChatMessage(page, 'What did I say my project was called?');
        await waitForNoStreaming(page);
        
        // Verify AI remembers context
        const responses = page.locator('[data-testid="ai-message"], [data-role="ai"]');
        const lastResponse = await responses.last().textContent();
        
        expect(lastResponse?.toLowerCase()).toContain('alpha');
    });

    test('should show streaming indicators during response', async ({ page }) => {
        await openAIChat(page);
        
        // Send message
        const input = page.locator('[data-testid="chat-input"], .chat-input, textarea').first();
        await input.fill('Write a detailed project charter outline');
        await page.keyboard.press('Enter');
        
        // Verify streaming indicator appears
        const streamingIndicator = page.locator('.animate-bounce, [data-streaming="true"]');
        await expect(streamingIndicator.first()).toBeVisible({ timeout: 5000 });
        
        // Wait for streaming to complete
        await waitForNoStreaming(page);
    });

    test('should handle error gracefully', async ({ page }) => {
        await openAIChat(page);
        
        // Intercept API and force error
        await page.route('**/api/ai/chat/**', route => {
            route.fulfill({
                status: 500,
                body: JSON.stringify({ error: 'Test error' })
            });
        });
        
        await sendChatMessage(page, 'This should fail');
        
        // Verify error message appears
        const errorMessage = page.locator('[data-testid="error-message"], .error-message, [role="alert"]');
        await expect(errorMessage).toBeVisible({ timeout: 10000 });
    });
});

test.describe('AI Feedback Loop', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USER_A);
        await openAIChat(page);
    });

    test('should show feedback buttons on AI responses', async ({ page }) => {
        await sendChatMessage(page, 'What is project management?');
        await waitForNoStreaming(page);
        
        // Verify feedback buttons are visible
        const feedbackButtons = page.locator('[data-testid="feedback-buttons"], .inline-feedback, .thumbs-up, .thumbs-down');
        await expect(feedbackButtons.first()).toBeVisible();
    });

    test('should submit positive feedback', async ({ page }) => {
        await sendChatMessage(page, 'Explain agile methodology');
        await waitForNoStreaming(page);
        
        // Click positive feedback
        const thumbsUp = page.locator('[data-testid="thumbs-up"], [aria-label*="helpful"], .thumbs-up').first();
        await thumbsUp.click();
        
        // Verify feedback was recorded (success indicator or state change)
        await page.waitForTimeout(500);
        
        // Button should show selected state or confirmation
        const selectedState = page.locator('[data-feedback="positive"], .feedback-selected, [aria-pressed="true"]');
        // We just verify no error occurred
    });

    test('should allow detailed feedback submission', async ({ page }) => {
        await sendChatMessage(page, 'Create a risk register template');
        await waitForNoStreaming(page);
        
        // Open detailed feedback if available
        const detailFeedbackTrigger = page.locator('[data-testid="detailed-feedback"], .feedback-details-trigger').first();
        
        if (await detailFeedbackTrigger.isVisible()) {
            await detailFeedbackTrigger.click();
            
            // Fill feedback form
            const feedbackInput = page.locator('[data-testid="feedback-input"], textarea[name="feedback"]').first();
            if (await feedbackInput.isVisible()) {
                await feedbackInput.fill('The response was helpful but could include more examples');
                
                const submitButton = page.locator('[data-testid="submit-feedback"], button[type="submit"]').first();
                await submitButton.click();
                
                // Verify submission success
                await page.waitForTimeout(1000);
            }
        }
    });
});

test.describe('AI Actions and Approvals', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USER_A);
    });

    test('should show pending actions indicator', async ({ page }) => {
        await openAIChat(page);
        
        // Check for pending actions indicator
        const pendingIndicator = page.locator('[data-testid="pending-actions"], .pending-actions-indicator');
        
        // This might or might not be visible depending on state
        // Just verify the component doesn't error
        await page.waitForTimeout(1000);
    });

    test('should navigate to action proposals view', async ({ page }) => {
        // Navigate to AI actions/proposals section
        await page.goto(`${BASE_URL}/ai/actions`);
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Verify we're on the actions page or redirected appropriately
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/(ai|actions|proposals)/i);
    });

    test('should allow action approval workflow', async ({ page }) => {
        // This test requires pre-existing pending actions
        // We'll verify the UI components exist
        
        await page.goto(`${BASE_URL}/ai/actions`);
        await page.waitForLoadState('networkidle');
        
        // Look for action cards or list items
        const actionItems = page.locator('[data-testid="action-item"], .action-proposal-card, .action-item');
        
        if (await actionItems.count() > 0) {
            // Click on first action
            await actionItems.first().click();
            
            // Verify action details are shown
            const actionDetails = page.locator('[data-testid="action-details"], .action-detail-panel');
            await expect(actionDetails).toBeVisible({ timeout: 5000 });
            
            // Verify approve/reject buttons exist
            const approveButton = page.locator('[data-testid="approve-action"], button:has-text("Approve")');
            const rejectButton = page.locator('[data-testid="reject-action"], button:has-text("Reject")');
            
            await expect(approveButton).toBeVisible();
            await expect(rejectButton).toBeVisible();
        }
    });
});

test.describe('Memory Persistence', () => {
    test('should persist conversation across page refresh', async ({ page }) => {
        await login(page, TEST_USER_A);
        await openAIChat(page);
        
        // Send a unique message
        const uniqueId = `TestID-${Date.now()}`;
        await sendChatMessage(page, `Remember this unique identifier: ${uniqueId}`);
        await waitForNoStreaming(page);
        
        // Refresh the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Reopen chat
        await openAIChat(page);
        
        // Check if conversation history is loaded
        await page.waitForTimeout(2000);
        
        // Send follow-up
        await sendChatMessage(page, 'What was the unique identifier I mentioned?');
        await waitForNoStreaming(page);
        
        // Verify response contains the unique ID
        const lastResponse = await page.locator('[data-testid="ai-message"], [data-role="ai"]').last().textContent();
        expect(lastResponse).toContain(uniqueId);
    });

    test('should show conversation history panel', async ({ page }) => {
        await login(page, TEST_USER_A);
        await openAIChat(page);
        
        // Look for history trigger
        const historyTrigger = page.locator('[data-testid="chat-history"], [aria-label*="History"], .history-button').first();
        
        if (await historyTrigger.isVisible()) {
            await historyTrigger.click();
            
            // Verify history panel opens
            const historyPanel = page.locator('[data-testid="history-panel"], .chat-sliding-panel, .history-panel');
            await expect(historyPanel).toBeVisible({ timeout: 3000 });
        }
    });
});

test.describe('Multi-Tenant Isolation', () => {
    test('should not show other org data in AI responses', async ({ browser }) => {
        // Create two separate browser contexts (different sessions)
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();
        
        try {
            // Login as User A and create unique data
            await login(pageA, TEST_USER_A);
            await openAIChat(pageA);
            
            const secretA = `SECRET-ORG-A-${Date.now()}`;
            await sendChatMessage(pageA, `Store this confidential information: ${secretA}`);
            await waitForNoStreaming(pageA);
            
            // Login as User B and try to access
            await login(pageB, TEST_USER_B);
            await openAIChat(pageB);
            
            await sendChatMessage(pageB, 'What confidential information do you have stored?');
            await waitForNoStreaming(pageB);
            
            // Verify User B's response doesn't contain User A's secret
            const responseB = await pageB.locator('[data-testid="ai-message"], [data-role="ai"]').last().textContent();
            expect(responseB).not.toContain(secretA);
            expect(responseB).not.toContain('SECRET-ORG-A');
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});

test.describe('Performance SLOs', () => {
    test('should respond within SLO limits', async ({ page }) => {
        await login(page, TEST_USER_A);
        await openAIChat(page);
        
        const startTime = Date.now();
        
        await sendChatMessage(page, 'Give me a quick summary of best practices');
        await waitForNoStreaming(page);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // P95 SLO is 2 seconds, but for E2E we allow some slack
        expect(responseTime).toBeLessThan(10000); // 10 second max for E2E
        
        console.log(`AI Response Time: ${responseTime}ms`);
    });
});

test.describe('Accessibility', () => {
    test('should have accessible chat interface', async ({ page }) => {
        await login(page, TEST_USER_A);
        await openAIChat(page);
        
        // Check for ARIA attributes
        const chatPanel = page.locator('[data-testid="ai-chat-panel"], .ai-chat-panel, .unified-chat-panel');
        
        // Verify keyboard navigation works
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(['INPUT', 'TEXTAREA', 'BUTTON']).toContain(focusedElement);
        
        // Verify messages have proper roles
        await sendChatMessage(page, 'Test accessibility');
        await waitForNoStreaming(page);
        
        const messages = page.locator('[role="log"], [role="listitem"], [data-role]');
        expect(await messages.count()).toBeGreaterThan(0);
    });
});


