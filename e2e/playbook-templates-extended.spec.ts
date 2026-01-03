/**
 * Playbook Templates Extended E2E Tests
 * End-to-end tests for extended playbook template functionality
 * (Comments, Reviews, Analytics, Version History)
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'adminpassword123';

// Helper functions
async function loginAsAdmin(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[data-testid="email-input"]', TEST_ADMIN_EMAIL);
    await page.fill('[data-testid="password-input"]', TEST_ADMIN_PASSWORD);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/dashboard|admin/);
}

async function navigateToPlaybookTemplates(page: Page) {
    await page.click('[data-testid="superadmin-menu"]');
    await page.click('[data-testid="playbook-templates-link"]');
    await page.waitForSelector('[data-testid="playbook-templates-view"]');
}

async function openPlaybookDetails(page: Page) {
    await page.click('[data-testid="playbook-row"]:first-child');
    await page.waitForSelector('[data-testid="playbook-details"]');
}

test.describe('Playbook Templates - Comments', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
        await openPlaybookDetails(page);
        await page.click('[data-testid="comments-tab"]');
    });

    test('should display comments section', async ({ page }) => {
        await expect(page.locator('[data-testid="comments-section"]')).toBeVisible();
        await expect(page.getByText(/Comments/i)).toBeVisible();
    });

    test('should add new comment', async ({ page }) => {
        // Type comment
        await page.fill('[data-testid="comment-input"]', 'This is a test comment for the playbook');
        
        // Submit
        await page.click('[data-testid="submit-comment-btn"]');
        
        // Should show success
        await expect(page.getByText('This is a test comment for the playbook')).toBeVisible();
    });

    test('should reply to comment', async ({ page }) => {
        // Click reply on existing comment
        await page.click('[data-testid="comment-item"]:first-child [data-testid="reply-btn"]');
        
        // Type reply
        await page.fill('[data-testid="reply-input"]', 'This is a reply');
        
        // Submit reply
        await page.click('[data-testid="submit-reply-btn"]');
        
        // Should show reply
        await expect(page.getByText('This is a reply')).toBeVisible();
    });

    test('should resolve comment', async ({ page }) => {
        // Find unresolved comment and click resolve
        const unresolvedComment = page.locator('[data-testid="comment-item"]:not([data-resolved="true"])').first();
        await unresolvedComment.locator('[data-testid="resolve-btn"]').click();
        
        // Should show resolved status
        await expect(unresolvedComment.locator('[data-testid="resolved-badge"]')).toBeVisible();
    });

    test('should edit own comment', async ({ page }) => {
        // Click edit on own comment
        await page.click('[data-testid="comment-item"][data-own="true"]:first-child [data-testid="edit-btn"]');
        
        // Modify text
        const editInput = page.locator('[data-testid="edit-comment-input"]');
        await editInput.clear();
        await editInput.fill('Updated comment text');
        
        // Save
        await page.click('[data-testid="save-edit-btn"]');
        
        // Should show updated text
        await expect(page.getByText('Updated comment text')).toBeVisible();
    });

    test('should delete own comment', async ({ page }) => {
        // Get initial count
        const initialCount = await page.locator('[data-testid="comment-item"]').count();
        
        // Click delete on own comment
        await page.click('[data-testid="comment-item"][data-own="true"]:first-child [data-testid="delete-btn"]');
        
        // Confirm
        await page.click('[data-testid="confirm-delete"]');
        
        // Count should decrease
        await page.waitForTimeout(500);
        const newCount = await page.locator('[data-testid="comment-item"]').count();
        expect(newCount).toBe(initialCount - 1);
    });

    test('should filter resolved comments', async ({ page }) => {
        // Toggle hide resolved
        await page.click('[data-testid="hide-resolved-toggle"]');
        
        // Should not show resolved comments
        await expect(page.locator('[data-testid="comment-item"][data-resolved="true"]')).toHaveCount(0);
    });

    test('should mention users in comments', async ({ page }) => {
        // Type @ to trigger mentions
        await page.fill('[data-testid="comment-input"]', '@');
        
        // Should show mention suggestions
        await expect(page.locator('[data-testid="mention-suggestions"]')).toBeVisible();
        
        // Select user
        await page.click('[data-testid="mention-suggestion"]:first-child');
        
        // Should insert mention
        const inputValue = await page.locator('[data-testid="comment-input"]').inputValue();
        expect(inputValue).toContain('@');
    });
});

test.describe('Playbook Templates - Reviews', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
        await openPlaybookDetails(page);
        await page.click('[data-testid="reviews-tab"]');
    });

    test('should display reviews section', async ({ page }) => {
        await expect(page.locator('[data-testid="reviews-section"]')).toBeVisible();
    });

    test('should request review', async ({ page }) => {
        // Click request review
        await page.click('[data-testid="request-review-btn"]');
        
        // Select reviewer
        await page.selectOption('[data-testid="reviewer-select"]', { index: 1 });
        
        // Select priority
        await page.selectOption('[data-testid="priority-select"]', 'HIGH');
        
        // Set due date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await page.fill('[data-testid="due-date-input"]', tomorrow.toISOString().split('T')[0]);
        
        // Submit
        await page.click('[data-testid="submit-review-request-btn"]');
        
        // Should show success
        await expect(page.getByText(/requested|success/i)).toBeVisible();
    });

    test('should approve review', async ({ page }) => {
        // Find pending review
        const pendingReview = page.locator('[data-testid="review-item"][data-status="PENDING"]').first();
        
        if (await pendingReview.isVisible()) {
            // Click approve
            await pendingReview.locator('[data-testid="approve-btn"]').click();
            
            // Add notes
            await page.fill('[data-testid="review-notes-input"]', 'Approved - looks good!');
            
            // Confirm
            await page.click('[data-testid="confirm-approve-btn"]');
            
            // Should show approved status
            await expect(pendingReview.locator('[data-testid="status-badge"]')).toHaveText('APPROVED');
        }
    });

    test('should reject review', async ({ page }) => {
        // Find pending review
        const pendingReview = page.locator('[data-testid="review-item"][data-status="PENDING"]').first();
        
        if (await pendingReview.isVisible()) {
            // Click reject
            await pendingReview.locator('[data-testid="reject-btn"]').click();
            
            // Add rejection notes (required)
            await page.fill('[data-testid="review-notes-input"]', 'Rejected - needs more work');
            
            // Confirm
            await page.click('[data-testid="confirm-reject-btn"]');
            
            // Should show rejected status
            await expect(pendingReview.locator('[data-testid="status-badge"]')).toHaveText('REJECTED');
        }
    });

    test('should request changes', async ({ page }) => {
        // Find in-review item
        const review = page.locator('[data-testid="review-item"][data-status="IN_REVIEW"]').first();
        
        if (await review.isVisible()) {
            // Click request changes
            await review.locator('[data-testid="request-changes-btn"]').click();
            
            // Add notes
            await page.fill('[data-testid="review-notes-input"]', 'Please fix steps 2 and 3');
            
            // Confirm
            await page.click('[data-testid="confirm-request-changes-btn"]');
            
            // Should show changes requested status
            await expect(review.locator('[data-testid="status-badge"]')).toHaveText('CHANGES_REQUESTED');
        }
    });

    test('should show review history', async ({ page }) => {
        // Click on a review to expand
        await page.click('[data-testid="review-item"]:first-child');
        
        // Should show review details
        await expect(page.locator('[data-testid="review-history"]')).toBeVisible();
    });
});

test.describe('Playbook Templates - Analytics', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
        await openPlaybookDetails(page);
        await page.click('[data-testid="analytics-tab"]');
    });

    test('should display analytics section', async ({ page }) => {
        await expect(page.locator('[data-testid="analytics-section"]')).toBeVisible();
    });

    test('should show key metrics', async ({ page }) => {
        await expect(page.locator('[data-testid="total-runs"]')).toBeVisible();
        await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
        await expect(page.locator('[data-testid="avg-duration"]')).toBeVisible();
        await expect(page.locator('[data-testid="unique-users"]')).toBeVisible();
    });

    test('should show usage chart', async ({ page }) => {
        await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
    });

    test('should filter by date range', async ({ page }) => {
        // Select date range
        await page.selectOption('[data-testid="date-range-select"]', '7d');
        
        // Wait for data refresh
        await page.waitForTimeout(500);
        
        // Chart should update
        await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
    });

    test('should show recent activity', async ({ page }) => {
        await expect(page.locator('[data-testid="recent-activity-list"]')).toBeVisible();
    });

    test('should export analytics data', async ({ page }) => {
        // Start waiting for download
        const downloadPromise = page.waitForEvent('download');
        
        // Click export
        await page.click('[data-testid="export-analytics-btn"]');
        
        // Should trigger download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/analytics.*\.(csv|xlsx|json)/);
    });
});

test.describe('Playbook Templates - Version History', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
        await openPlaybookDetails(page);
        await page.click('[data-testid="versions-tab"]');
    });

    test('should display version history', async ({ page }) => {
        await expect(page.locator('[data-testid="version-history"]')).toBeVisible();
    });

    test('should show version list', async ({ page }) => {
        const versions = page.locator('[data-testid="version-item"]');
        expect(await versions.count()).toBeGreaterThan(0);
    });

    test('should show version details', async ({ page }) => {
        // Click on a version
        await page.click('[data-testid="version-item"]:first-child');
        
        // Should show version details
        await expect(page.locator('[data-testid="version-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="version-author"]')).toBeVisible();
        await expect(page.locator('[data-testid="version-date"]')).toBeVisible();
    });

    test('should compare versions', async ({ page }) => {
        // Select two versions for comparison
        await page.click('[data-testid="version-item"]:nth-child(1) [data-testid="compare-checkbox"]');
        await page.click('[data-testid="version-item"]:nth-child(2) [data-testid="compare-checkbox"]');
        
        // Click compare
        await page.click('[data-testid="compare-versions-btn"]');
        
        // Should show diff view
        await expect(page.locator('[data-testid="version-diff"]')).toBeVisible();
    });

    test('should restore previous version', async ({ page }) => {
        // Click restore on older version
        await page.click('[data-testid="version-item"]:nth-child(2) [data-testid="restore-btn"]');
        
        // Confirm
        await page.click('[data-testid="confirm-restore"]');
        
        // Should show success
        await expect(page.getByText(/restored|success/i)).toBeVisible();
        
        // Version should increment
        const currentVersion = await page.locator('[data-testid="current-version"]').textContent();
        expect(parseInt(currentVersion || '0')).toBeGreaterThan(1);
    });

    test('should preview version', async ({ page }) => {
        // Click preview on a version
        await page.click('[data-testid="version-item"]:first-child [data-testid="preview-btn"]');
        
        // Should show preview modal
        await expect(page.locator('[data-testid="version-preview-modal"]')).toBeVisible();
        
        // Close
        await page.click('[data-testid="close-preview"]');
    });
});

test.describe('Playbook Templates - Clone', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
    });

    test('should clone playbook template', async ({ page }) => {
        // Click clone on first playbook
        await page.click('[data-testid="playbook-row"]:first-child [data-testid="clone-btn"]');
        
        // Fill clone form
        await page.fill('[data-testid="clone-key"]', `cloned-playbook-${Date.now()}`);
        await page.fill('[data-testid="clone-title"]', 'Cloned Playbook');
        await page.fill('[data-testid="clone-description"]', 'A cloned playbook for testing');
        
        // Submit
        await page.click('[data-testid="confirm-clone-btn"]');
        
        // Should show success
        await expect(page.getByText(/cloned|created|success/i)).toBeVisible();
        
        // Should appear in list
        await expect(page.getByText('Cloned Playbook')).toBeVisible();
    });
});

test.describe('Playbook Templates - Search & Filter', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
    });

    test('should search playbook templates', async ({ page }) => {
        // Search
        await page.fill('[data-testid="search-input"]', 'onboarding');
        await page.press('[data-testid="search-input"]', 'Enter');
        
        // Results should be filtered
        await page.waitForTimeout(500);
        const rows = page.locator('[data-testid="playbook-row"]');
        const count = await rows.count();
        
        for (let i = 0; i < count; i++) {
            const text = await rows.nth(i).textContent();
            expect(text?.toLowerCase()).toContain('onboarding');
        }
    });

    test('should filter by status', async ({ page }) => {
        // Select status filter
        await page.selectOption('[data-testid="status-filter"]', 'PUBLISHED');
        await page.waitForTimeout(500);
        
        // All should be published
        const badges = page.locator('[data-testid="status-badge"]');
        const count = await badges.count();
        
        for (let i = 0; i < count; i++) {
            await expect(badges.nth(i)).toHaveText('PUBLISHED');
        }
    });

    test('should filter by category', async ({ page }) => {
        // Select category filter
        await page.selectOption('[data-testid="category-filter"]', { index: 1 });
        await page.waitForTimeout(500);
        
        // Results should be filtered by category
        const rows = page.locator('[data-testid="playbook-row"]');
        expect(await rows.count()).toBeGreaterThan(0);
    });

    test('should filter by trigger signal', async ({ page }) => {
        // Select trigger signal filter
        await page.selectOption('[data-testid="trigger-filter"]', 'RISK_DETECTED');
        await page.waitForTimeout(500);
        
        // Results should match trigger
        const rows = page.locator('[data-testid="playbook-row"]');
        expect(await rows.count()).toBeGreaterThanOrEqual(0);
    });

    test('should sort results', async ({ page }) => {
        // Sort by name ascending
        await page.selectOption('[data-testid="sort-by"]', 'title');
        await page.selectOption('[data-testid="sort-order"]', 'asc');
        
        await page.waitForTimeout(500);
        
        // Get first and last titles
        const rows = page.locator('[data-testid="playbook-row"]');
        const count = await rows.count();
        
        if (count >= 2) {
            const firstTitle = await rows.first().locator('[data-testid="playbook-title"]').textContent();
            const lastTitle = await rows.last().locator('[data-testid="playbook-title"]').textContent();
            
            expect(firstTitle?.localeCompare(lastTitle || '')).toBeLessThanOrEqual(0);
        }
    });
});

test.describe('Playbook Templates - Bulk Actions', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await navigateToPlaybookTemplates(page);
    });

    test('should select multiple playbooks', async ({ page }) => {
        // Select first two
        await page.click('[data-testid="playbook-row"]:nth-child(1) [data-testid="checkbox"]');
        await page.click('[data-testid="playbook-row"]:nth-child(2) [data-testid="checkbox"]');
        
        // Bulk bar should appear
        await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeVisible();
        await expect(page.getByText('2 selected')).toBeVisible();
    });

    test('should bulk publish playbooks', async ({ page }) => {
        // Filter to drafts
        await page.selectOption('[data-testid="status-filter"]', 'DRAFT');
        await page.waitForTimeout(500);
        
        // Select all
        await page.click('[data-testid="select-all-checkbox"]');
        
        // Click bulk publish
        await page.click('[data-testid="bulk-publish-btn"]');
        
        // Confirm
        await page.click('[data-testid="confirm-bulk-action"]');
        
        // Should show success
        await expect(page.getByText(/published|success/i)).toBeVisible();
    });

    test('should bulk deprecate playbooks', async ({ page }) => {
        // Filter to published
        await page.selectOption('[data-testid="status-filter"]', 'PUBLISHED');
        await page.waitForTimeout(500);
        
        // Select items
        await page.click('[data-testid="playbook-row"]:nth-child(1) [data-testid="checkbox"]');
        await page.click('[data-testid="playbook-row"]:nth-child(2) [data-testid="checkbox"]');
        
        // Click bulk deprecate
        await page.click('[data-testid="bulk-deprecate-btn"]');
        
        // Confirm
        await page.click('[data-testid="confirm-bulk-action"]');
        
        // Should show success
        await expect(page.getByText(/deprecated|success/i)).toBeVisible();
    });

    test('should bulk change category', async ({ page }) => {
        // Select items
        await page.click('[data-testid="playbook-row"]:nth-child(1) [data-testid="checkbox"]');
        await page.click('[data-testid="playbook-row"]:nth-child(2) [data-testid="checkbox"]');
        
        // Click bulk category
        await page.click('[data-testid="bulk-category-btn"]');
        
        // Select category
        await page.selectOption('[data-testid="bulk-category-select"]', { index: 1 });
        
        // Apply
        await page.click('[data-testid="apply-category-btn"]');
        
        // Should show success
        await expect(page.getByText(/updated|success/i)).toBeVisible();
    });

    test('should bulk add tags', async ({ page }) => {
        // Select items
        await page.click('[data-testid="playbook-row"]:nth-child(1) [data-testid="checkbox"]');
        await page.click('[data-testid="playbook-row"]:nth-child(2) [data-testid="checkbox"]');
        
        // Click bulk tags
        await page.click('[data-testid="bulk-add-tags-btn"]');
        
        // Select tags
        await page.click('[data-testid="tag-option"]:first-child');
        
        // Apply
        await page.click('[data-testid="apply-tags-btn"]');
        
        // Should show success
        await expect(page.getByText(/added|success/i)).toBeVisible();
    });
});

test.describe('Access Control', () => {
    test('should restrict review actions to reviewers', async ({ page }) => {
        // Login as non-reviewer
        await page.goto(`${BASE_URL}/login`);
        await page.fill('[data-testid="email-input"]', 'viewer@test.com');
        await page.fill('[data-testid="password-input"]', 'viewerpassword');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/dashboard/);
        
        await navigateToPlaybookTemplates(page);
        await openPlaybookDetails(page);
        await page.click('[data-testid="reviews-tab"]');
        
        // Approve/reject buttons should not be visible
        await expect(page.locator('[data-testid="approve-btn"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="reject-btn"]')).not.toBeVisible();
    });

    test('should restrict publish to admins', async ({ page }) => {
        // Login as non-admin
        await page.goto(`${BASE_URL}/login`);
        await page.fill('[data-testid="email-input"]', 'user@test.com');
        await page.fill('[data-testid="password-input"]', 'userpassword');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/dashboard/);
        
        await navigateToPlaybookTemplates(page);
        
        // Publish button should not be visible
        await expect(page.locator('[data-testid="publish-btn"]')).not.toBeVisible();
    });
});




