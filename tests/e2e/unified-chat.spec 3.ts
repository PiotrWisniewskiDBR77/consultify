/**
 * E2E Tests for Unified AI Chat System
 *
 * Tests the flow between full-screen and split-screen chat modes,
 * message preservation, and workspace context awareness.
 */

import { expect, test } from '@playwright/test';

test.describe('Unified AI Chat System', () => {
    test.beforeEach(async ({ page }) => {
        // Login and navigate to the app
        await page.goto('/');

        // Wait for app to load
        await page.waitForSelector('[data-tour="sidebar-nav"]', { timeout: 10000 });
    });

    test.describe('Full-Screen to Split-Screen Flow', () => {
        test('should navigate from AI Chat to My Work and preserve conversation', async ({ page }) => {
            // Click on AI Chat in sidebar
            await page.click('[data-chat-toggle="true"]');

            // Wait for chat view to load
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Type a message
            const input = page.locator('textarea').first();
            await input.fill('Hello, this is a test message');
            await input.press('Enter');

            // Wait for message to appear
            await page.waitForSelector('text=Hello, this is a test message', { timeout: 5000 });

            // Now navigate to My Work
            await page.click('text=My Work');

            // Wait for My Work view to load
            await page.waitForSelector('text=Tasks', { timeout: 5000 });

            // Chat should still show the message in split mode
            const chatPanel = page.locator('.chat-panel, [class*="UnifiedChatPanel"]').first();
            await expect(chatPanel.locator('text=Hello, this is a test message')).toBeVisible();
        });

        test('should expand chat back to full-screen from split mode', async ({ page }) => {
            // Start in AI Chat
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Navigate to a split-screen view
            await page.click('text=My Work');
            await page.waitForSelector('text=Tasks', { timeout: 5000 });

            // Click expand button on chat panel
            const expandButton = page.locator('[title*="Expand"], [title*="rozwiń"]').first();
            await expandButton.click();

            // Should be back in full AI Chat view
            await expect(page.locator('text=AI Assistant')).toBeVisible();
            await expect(page.locator('text=My Work')).not.toBeVisible();
        });
    });

    test.describe('Conversation History', () => {
        test('should show conversation history panel', async ({ page }) => {
            // Navigate to AI Chat
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Click history button
            const historyButton = page.locator('[title*="History"], [title*="historia"]').first();
            await historyButton.click();

            // History panel should open
            await expect(page.locator('text=AI Chat')).toBeVisible();
            await expect(page.locator('text=Nowa rozmowa, text=New Chat').first()).toBeVisible();
        });

        test('should create new conversation from history panel', async ({ page }) => {
            // Navigate to AI Chat
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Send a message to create conversation
            const input = page.locator('textarea').first();
            await input.fill('First message');
            await input.press('Enter');

            // Open history panel
            const historyButton = page.locator('[title*="History"], [title*="historia"]').first();
            await historyButton.click();

            // Click new chat button
            await page.click('text=Nowa rozmowa, text=New Chat');

            // Messages should be cleared (new conversation)
            await expect(page.locator('text=First message')).not.toBeVisible();
        });
    });

    test.describe('Workspace Context Awareness', () => {
        test('should show workspace context in split mode', async ({ page }) => {
            // Navigate to My Work first
            await page.click('text=My Work');
            await page.waitForSelector('text=Tasks', { timeout: 5000 });

            // Chat panel should show context-aware indicator
            const contextIndicator = page.locator('text=Context-aware');
            await expect(contextIndicator).toBeVisible();
        });

        test('should show contextual placeholder in split mode', async ({ page }) => {
            // Navigate to Assessment
            await page.click('text=Assessment');
            await page.waitForTimeout(1000);

            // Chat input should show assessment-related placeholder
            const input = page.locator('textarea').first();
            const placeholder = await input.getAttribute('placeholder');
            expect(placeholder).toContain('assessment');
        });
    });

    test.describe('Focus Mode', () => {
        test('should show focus mode selector in full mode', async ({ page }) => {
            // Navigate to AI Chat
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Focus mode selector should be visible
            await expect(page.locator('text=All')).toBeVisible();
            await expect(page.locator('text=PMO Docs')).toBeVisible();
        });

        test('should show compact focus mode in split mode', async ({ page }) => {
            // Navigate to My Work
            await page.click('text=My Work');
            await page.waitForSelector('text=Tasks', { timeout: 5000 });

            // Focus mode should be in compact (icon-only) mode
            const focusModeIcons = page.locator('.focus-mode-selector button');
            const count = await focusModeIcons.count();
            expect(count).toBeGreaterThanOrEqual(1);
        });

        test('should change focus mode on click', async ({ page }) => {
            // Navigate to AI Chat
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Click on PMO Docs focus mode
            await page.click('text=PMO Docs');

            // PMO Docs should be selected (has active styling)
            const pmoButton = page.locator('button:has-text("PMO Docs")');
            await expect(pmoButton).toHaveClass(/bg-blue/);
        });
    });

    test.describe('Message Actions', () => {
        test('should copy message on click', async ({ page }) => {
            // Navigate to AI Chat and send a message
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            const input = page.locator('textarea').first();
            await input.fill('Test message to copy');
            await input.press('Enter');

            // Wait for message
            await page.waitForSelector('text=Test message to copy', { timeout: 5000 });

            // Hover over message to show actions
            const message = page.locator('text=Test message to copy');
            await message.hover();

            // Click copy button
            const copyButton = page.locator('[title*="Copy"]').first();
            await copyButton.click();

            // Check icon should appear briefly
            await expect(page.locator('svg.text-green-500')).toBeVisible({ timeout: 3000 });
        });
    });

    test.describe('Voice Input', () => {
        test('should show voice input buttons', async ({ page }) => {
            // Navigate to AI Chat
            await page.click('[data-chat-toggle="true"]');
            await page.waitForSelector('text=AI Assistant', { timeout: 5000 });

            // Voice buttons should be visible (mic icon)
            const micButton = page
                .locator('button')
                .filter({ has: page.locator('svg.lucide-mic, svg.lucide-audio-waveform') });
            await expect(micButton.first()).toBeVisible();
        });
    });

    test.describe('Mobile/Responsive', () => {
        test('should show mobile chat FAB on small screens', async ({ page }) => {
            // Set viewport to mobile size
            await page.setViewportSize({ width: 375, height: 812 });

            // Navigate to My Work
            await page.click('text=My Work');
            await page.waitForSelector('text=Tasks', { timeout: 5000 });

            // FAB should be visible
            const fab = page.locator('button.fixed.rounded-full');
            await expect(fab).toBeVisible();
        });

        test('should open mobile chat drawer on FAB click', async ({ page }) => {
            // Set viewport to mobile size
            await page.setViewportSize({ width: 375, height: 812 });

            // Navigate to My Work
            await page.click('text=My Work');
            await page.waitForSelector('text=Tasks', { timeout: 5000 });

            // Click FAB
            const fab = page.locator('button.fixed.rounded-full');
            await fab.click();

            // Chat drawer should open
            await expect(page.locator('text=AI Consultant')).toBeVisible();
        });
    });
});
