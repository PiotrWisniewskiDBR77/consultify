/**
 * Content Module E2E Tests
 * End-to-end tests for the Content Module (Email Templates and Shared Functionality)
 */

import { expect, Page, test } from '@playwright/test';

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

async function navigateToContentModule(page: Page) {
    await page.click('[data-testid="superadmin-menu"]');
    await page.click('[data-testid="content-module-link"]');
    await page.waitForSelector('[data-testid="content-module"]');
}

async function navigateToEmailTemplates(page: Page) {
    await page.click('[data-testid="superadmin-menu"]');
    await page.click('[data-testid="email-templates-link"]');
    await page.waitForSelector('[data-testid="email-templates-view"]');
}

test.describe('Content Module', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test.describe('Email Templates', () => {
        test('should display email templates list', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Should show templates list
            await expect(page.locator('[data-testid="email-templates-list"]')).toBeVisible();

            // Should show column headers
            await expect(page.getByText('Name')).toBeVisible();
            await expect(page.getByText('Status')).toBeVisible();
        });

        test('should create new email template', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Click create button
            await page.click('[data-testid="create-template-btn"]');

            // Fill form
            await page.fill('[data-testid="template-key"]', `test-template-${Date.now()}`);
            await page.fill('[data-testid="template-name"]', 'Test Template');
            await page.fill('[data-testid="template-subject"]', 'Test Subject {{name}}');
            await page.fill('[data-testid="template-html"]', '<p>Hello {{name}}, welcome!</p>');

            // Save
            await page.click('[data-testid="save-template-btn"]');

            // Should show success message
            await expect(page.getByText(/created|success/i)).toBeVisible();

            // Should appear in list
            await expect(page.getByText('Test Template')).toBeVisible();
        });

        test('should edit existing email template', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Click edit on first template
            await page.click('[data-testid="template-row"]:first-child [data-testid="edit-btn"]');

            // Wait for editor
            await expect(page.locator('[data-testid="template-editor"]')).toBeVisible();

            // Modify name
            const nameInput = page.locator('[data-testid="template-name"]');
            await nameInput.clear();
            await nameInput.fill('Updated Template Name');

            // Save
            await page.click('[data-testid="save-template-btn"]');

            // Should show success message
            await expect(page.getByText(/updated|saved|success/i)).toBeVisible();
        });

        test('should preview email template', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Click preview on first template
            await page.click('[data-testid="template-row"]:first-child [data-testid="preview-btn"]');

            // Wait for preview modal
            await expect(page.locator('[data-testid="preview-modal"]')).toBeVisible();

            // Should show preview content
            await expect(page.locator('[data-testid="preview-content"]')).toBeVisible();

            // Close preview
            await page.click('[data-testid="close-preview"]');
        });

        test('should publish draft template', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Filter to show only drafts
            await page.selectOption('[data-testid="status-filter"]', 'DRAFT');

            // Wait for filtered results
            await page.waitForTimeout(500);

            // Click publish on first draft
            const publishBtn = page.locator('[data-testid="publish-btn"]:first-child');
            if (await publishBtn.isVisible()) {
                await publishBtn.click();

                // Confirm publish
                await page.click('[data-testid="confirm-publish"]');

                // Should show success message
                await expect(page.getByText(/published|success/i)).toBeVisible();
            }
        });

        test('should search templates', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Type in search
            await page.fill('[data-testid="search-input"]', 'welcome');
            await page.press('[data-testid="search-input"]', 'Enter');

            // Wait for results
            await page.waitForTimeout(500);

            // Should filter results
            const rows = page.locator('[data-testid="template-row"]');
            const count = await rows.count();

            // All visible rows should match search
            for (let i = 0; i < count; i++) {
                const rowText = await rows.nth(i).textContent();
                expect(rowText?.toLowerCase()).toContain('welcome');
            }
        });

        test('should filter by status', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Select PUBLISHED filter
            await page.selectOption('[data-testid="status-filter"]', 'PUBLISHED');
            await page.waitForTimeout(500);

            // All visible badges should be PUBLISHED
            const badges = page.locator('[data-testid="status-badge"]');
            const count = await badges.count();

            for (let i = 0; i < count; i++) {
                await expect(badges.nth(i)).toHaveText('PUBLISHED');
            }
        });

        test('should send test email', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Click test send on first template
            await page.click('[data-testid="template-row"]:first-child [data-testid="test-send-btn"]');

            // Fill test email form
            await page.fill('[data-testid="test-email-input"]', 'test@example.com');
            await page.fill('[data-testid="test-data-input"]', '{"name": "Test User"}');

            // Send
            await page.click('[data-testid="send-test-btn"]');

            // Should show success message
            await expect(page.getByText(/sent|success/i)).toBeVisible();
        });
    });

    test.describe('Categories', () => {
        test('should display categories list', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="categories-tab"]');

            await expect(page.locator('[data-testid="categories-list"]')).toBeVisible();
        });

        test('should create new category', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="categories-tab"]');

            // Click create
            await page.click('[data-testid="create-category-btn"]');

            // Fill form
            await page.fill('[data-testid="category-name"]', `Test Category ${Date.now()}`);
            await page.fill('[data-testid="category-description"]', 'Test description');
            await page.selectOption('[data-testid="category-type"]', 'PLAYBOOK');

            // Save
            await page.click('[data-testid="save-category-btn"]');

            // Should show success
            await expect(page.getByText(/created|success/i)).toBeVisible();
        });

        test('should edit category', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="categories-tab"]');

            // Click edit on first category
            await page.click('[data-testid="category-row"]:first-child [data-testid="edit-btn"]');

            // Modify
            const nameInput = page.locator('[data-testid="category-name"]');
            await nameInput.clear();
            await nameInput.fill('Updated Category');

            // Save
            await page.click('[data-testid="save-category-btn"]');

            await expect(page.getByText(/updated|saved/i)).toBeVisible();
        });

        test('should delete category', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="categories-tab"]');

            // Get initial count
            const initialCount = await page.locator('[data-testid="category-row"]').count();

            // Click delete on first category
            await page.click('[data-testid="category-row"]:first-child [data-testid="delete-btn"]');

            // Confirm
            await page.click('[data-testid="confirm-delete"]');

            // Wait for deletion
            await page.waitForTimeout(500);

            // Count should decrease
            const newCount = await page.locator('[data-testid="category-row"]').count();
            expect(newCount).toBe(initialCount - 1);
        });
    });

    test.describe('Tags', () => {
        test('should display tags', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="tags-tab"]');

            await expect(page.locator('[data-testid="tags-list"]')).toBeVisible();
        });

        test('should create new tag', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="tags-tab"]');

            // Click create
            await page.click('[data-testid="create-tag-btn"]');

            // Fill form
            await page.fill('[data-testid="tag-name"]', `TestTag${Date.now()}`);

            // Select color
            await page.click('[data-testid="color-picker"]');
            await page.click('[data-testid="color-option-red"]');

            // Save
            await page.click('[data-testid="save-tag-btn"]');

            await expect(page.getByText(/created|success/i)).toBeVisible();
        });

        test('should filter tags by search', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="tags-tab"]');

            // Search
            await page.fill('[data-testid="tag-search"]', 'test');

            // Results should be filtered
            await page.waitForTimeout(300);
            const tags = page.locator('[data-testid="tag-item"]');
            const count = await tags.count();

            for (let i = 0; i < count; i++) {
                const tagText = await tags.nth(i).textContent();
                expect(tagText?.toLowerCase()).toContain('test');
            }
        });
    });

    test.describe('Favorites', () => {
        test('should add content to favorites', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Click favorite button on first template
            await page.click('[data-testid="template-row"]:first-child [data-testid="favorite-btn"]');

            // Should show success or toggle state
            await expect(
                page.locator('[data-testid="template-row"]:first-child [data-testid="favorite-btn"].favorited'),
            ).toBeVisible();
        });

        test('should view favorites list', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="favorites-tab"]');

            await expect(page.locator('[data-testid="favorites-list"]')).toBeVisible();
        });

        test('should remove from favorites', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="favorites-tab"]');

            // Click remove on first favorite
            await page.click('[data-testid="favorite-item"]:first-child [data-testid="remove-favorite-btn"]');

            // Should show removed message
            await expect(page.getByText(/removed|success/i)).toBeVisible();
        });
    });

    test.describe('Global Search', () => {
        test('should search across all content', async ({ page }) => {
            await navigateToContentModule(page);

            // Use global search
            await page.fill('[data-testid="global-search"]', 'test');
            await page.press('[data-testid="global-search"]', 'Enter');

            // Should show results from both playbooks and emails
            await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
        });

        test('should filter search by content type', async ({ page }) => {
            await navigateToContentModule(page);

            // Search
            await page.fill('[data-testid="global-search"]', 'template');

            // Filter to EMAIL only
            await page.click('[data-testid="filter-email-only"]');
            await page.press('[data-testid="global-search"]', 'Enter');

            // Results should only be EMAIL_TEMPLATE type
            const results = page.locator('[data-testid="search-result-item"]');
            const count = await results.count();

            for (let i = 0; i < count; i++) {
                await expect(results.nth(i).locator('[data-testid="content-type"]')).toHaveText('EMAIL_TEMPLATE');
            }
        });
    });

    test.describe('Analytics Dashboard', () => {
        test('should display analytics dashboard', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="analytics-tab"]');

            // Should show key metrics
            await expect(page.locator('[data-testid="total-playbooks"]')).toBeVisible();
            await expect(page.locator('[data-testid="total-emails"]')).toBeVisible();
            await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
        });

        test('should filter analytics by date range', async ({ page }) => {
            await navigateToContentModule(page);
            await page.click('[data-testid="analytics-tab"]');

            // Select date range
            await page.selectOption('[data-testid="date-range-select"]', '7d');

            // Should update metrics
            await page.waitForTimeout(500);
            await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
        });
    });

    test.describe('Bulk Actions', () => {
        test('should select multiple items', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Select first two templates
            await page.click('[data-testid="template-row"]:nth-child(1) [data-testid="checkbox"]');
            await page.click('[data-testid="template-row"]:nth-child(2) [data-testid="checkbox"]');

            // Bulk action bar should appear
            await expect(page.locator('[data-testid="bulk-action-bar"]')).toBeVisible();
            await expect(page.getByText('2 selected')).toBeVisible();
        });

        test('should bulk publish templates', async ({ page }) => {
            await navigateToEmailTemplates(page);

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

        test('should bulk delete templates', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Select first two
            await page.click('[data-testid="template-row"]:nth-child(1) [data-testid="checkbox"]');
            await page.click('[data-testid="template-row"]:nth-child(2) [data-testid="checkbox"]');

            // Click bulk delete
            await page.click('[data-testid="bulk-delete-btn"]');

            // Confirm
            await page.click('[data-testid="confirm-bulk-action"]');

            // Should show success
            await expect(page.getByText(/deleted|success/i)).toBeVisible();
        });

        test('should bulk add tags', async ({ page }) => {
            await navigateToEmailTemplates(page);

            // Select items
            await page.click('[data-testid="template-row"]:nth-child(1) [data-testid="checkbox"]');
            await page.click('[data-testid="template-row"]:nth-child(2) [data-testid="checkbox"]');

            // Open bulk tag action
            await page.click('[data-testid="bulk-add-tags-btn"]');

            // Select tags
            await page.click('[data-testid="tag-option"]:first-child');

            // Apply
            await page.click('[data-testid="apply-tags-btn"]');

            // Should show success
            await expect(page.getByText(/added|success/i)).toBeVisible();
        });
    });
});

test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('should show error on failed API call', async ({ page }) => {
        // Mock API failure
        await page.route('**/api/content/emails/templates', (route) =>
            route.fulfill({
                status: 500,
                body: JSON.stringify({ error: 'Internal server error' }),
            }),
        );

        await navigateToEmailTemplates(page);

        // Should show error message
        await expect(page.getByText(/error|failed/i)).toBeVisible();
    });

    test('should show validation errors on invalid form', async ({ page }) => {
        await navigateToEmailTemplates(page);

        // Click create
        await page.click('[data-testid="create-template-btn"]');

        // Try to save without filling required fields
        await page.click('[data-testid="save-template-btn"]');

        // Should show validation errors
        await expect(page.getByText(/required|invalid/i)).toBeVisible();
    });
});

test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await loginAsAdmin(page);
        await navigateToEmailTemplates(page);

        // Should show mobile-friendly layout
        await expect(page.locator('[data-testid="email-templates-view"]')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await loginAsAdmin(page);
        await navigateToEmailTemplates(page);

        // Should show tablet-friendly layout
        await expect(page.locator('[data-testid="email-templates-view"]')).toBeVisible();
    });
});




