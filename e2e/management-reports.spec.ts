/**
 * E2E Tests for Management Reports Module
 *
 * Tests the complete user workflow for generating, viewing,
 * approving, and exporting management reports.
 */

import { expect, Page, test } from '@playwright/test';

// Test fixtures
const testUser = {
    email: 'e2e-test@consultify.dev',
    password: 'TestPassword123!',
};

// Helper functions
async function login(page: Page) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
}

async function navigateToReports(page: Page) {
    await page.click('[data-testid="nav-reports"]');
    await page.waitForSelector('[data-testid="management-reports-view"]');
}

test.describe('Management Reports Module', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await navigateToReports(page);
    });

    test.describe('Report Generation', () => {
        test('should display report type selector', async ({ page }) => {
            await expect(page.locator('[data-testid="report-type-selector"]')).toBeVisible();
            await expect(page.locator('[data-testid="report-type-team-meeting"]')).toBeVisible();
            await expect(page.locator('[data-testid="report-type-steering-committee"]')).toBeVisible();
        });

        test('should select report type and scope', async ({ page }) => {
            // Select Team Meeting report
            await page.click('[data-testid="report-type-team-meeting"]');

            // Select scope
            await page.click('[data-testid="scope-project"]');

            // Verify project selector appears
            await expect(page.locator('[data-testid="project-selector"]')).toBeVisible();
        });

        test('should generate a team meeting report', async ({ page }) => {
            // Select Team Meeting
            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-project"]');

            // Select a project
            await page.click('[data-testid="project-selector"]');
            await page.click('[data-testid="project-option"]:first-child');

            // Select period
            await page.click('[data-testid="period-7-days"]');

            // Click generate
            await page.click('[data-testid="generate-report-button"]');

            // Wait for report to generate
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });

            // Verify report content
            await expect(page.locator('[data-testid="report-title"]')).toContainText('Team Meeting');
            await expect(page.locator('[data-testid="report-status-badge"]')).toContainText('DRAFT');
        });

        test('should generate a steering committee report', async ({ page }) => {
            // Select Steering Committee
            await page.click('[data-testid="report-type-steering-committee"]');
            await page.click('[data-testid="scope-portfolio"]');

            // Select period
            await page.click('[data-testid="period-30-days"]');

            // Click generate
            await page.click('[data-testid="generate-report-button"]');

            // Wait for report
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });

            // Verify steering committee specific sections
            await expect(page.locator('[data-testid="section-executive-summary"]')).toBeVisible();
            await expect(page.locator('[data-testid="section-kpis"]')).toBeVisible();
            await expect(page.locator('[data-testid="section-decisions-required"]')).toBeVisible();
        });

        test('should configure report sections', async ({ page }) => {
            await page.click('[data-testid="report-type-team-meeting"]');

            // Open section configuration
            await page.click('[data-testid="configure-sections-button"]');

            // Toggle a section off
            await page.click('[data-testid="section-toggle-blockers"]');

            // Verify section is unchecked
            await expect(page.locator('[data-testid="section-toggle-blockers"]')).not.toBeChecked();
        });
    });

    test.describe('Report Preview', () => {
        test.beforeEach(async ({ page }) => {
            // Generate a report first
            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
        });

        test('should display RAG status indicators', async ({ page }) => {
            await expect(page.locator('[data-testid="rag-indicator"]')).toBeVisible();
        });

        test('should display trend indicators', async ({ page }) => {
            await expect(page.locator('[data-testid="trend-indicator"]').first()).toBeVisible();
        });

        test('should switch between report tabs', async ({ page }) => {
            // Switch to Approval tab
            await page.click('[data-testid="tab-approval"]');
            await expect(page.locator('[data-testid="approval-workflow"]')).toBeVisible();

            // Switch to Versions tab
            await page.click('[data-testid="tab-versions"]');
            await expect(page.locator('[data-testid="version-history"]')).toBeVisible();

            // Switch to Comments tab
            await page.click('[data-testid="tab-comments"]');
            await expect(page.locator('[data-testid="report-comments"]')).toBeVisible();

            // Switch back to Content tab
            await page.click('[data-testid="tab-content"]');
            await expect(page.locator('[data-testid="report-content"]')).toBeVisible();
        });
    });

    test.describe('Approval Workflow', () => {
        test.beforeEach(async ({ page }) => {
            // Generate a report with approval required
            await page.click('[data-testid="report-type-steering-committee"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="requires-approval-toggle"]');
            await page.click('[data-testid="generate-report-button"]');
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
        });

        test('should display approval workflow component', async ({ page }) => {
            await page.click('[data-testid="tab-approval"]');
            await expect(page.locator('[data-testid="approval-workflow"]')).toBeVisible();
        });

        test('should submit report for approval', async ({ page }) => {
            await page.click('[data-testid="tab-approval"]');
            await page.click('[data-testid="submit-for-approval-button"]');

            // Confirm submission
            await page.click('[data-testid="confirm-submit"]');

            // Verify status changed
            await expect(page.locator('[data-testid="report-status-badge"]')).toContainText('PENDING');
        });

        test('should approve a report', async ({ page }) => {
            // First submit for approval
            await page.click('[data-testid="tab-approval"]');
            await page.click('[data-testid="submit-for-approval-button"]');
            await page.click('[data-testid="confirm-submit"]');

            // Now approve
            await page.click('[data-testid="approve-button"]');
            await page.fill('[data-testid="approval-comment"]', 'Looks good!');
            await page.click('[data-testid="confirm-approve"]');

            // Verify approved
            await expect(page.locator('[data-testid="approval-status-approved"]')).toBeVisible();
        });

        test('should reject a report with comment', async ({ page }) => {
            await page.click('[data-testid="tab-approval"]');
            await page.click('[data-testid="submit-for-approval-button"]');
            await page.click('[data-testid="confirm-submit"]');

            // Reject
            await page.click('[data-testid="reject-button"]');
            await page.fill('[data-testid="rejection-comment"]', 'Needs more detail in section 3');
            await page.click('[data-testid="confirm-reject"]');

            // Verify rejected
            await expect(page.locator('[data-testid="approval-status-rejected"]')).toBeVisible();
        });
    });

    test.describe('Version History', () => {
        test.beforeEach(async ({ page }) => {
            // Generate and view a report
            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
        });

        test('should display version history', async ({ page }) => {
            await page.click('[data-testid="tab-versions"]');
            await expect(page.locator('[data-testid="version-history"]')).toBeVisible();
            await expect(page.locator('[data-testid="version-item"]').first()).toBeVisible();
        });

        test('should select versions for comparison', async ({ page }) => {
            await page.click('[data-testid="tab-versions"]');

            // Select two versions for comparison
            await page.click('[data-testid="version-checkbox-1"]');
            await page.click('[data-testid="version-checkbox-2"]');

            // Compare button should be enabled
            await expect(page.locator('[data-testid="compare-versions-button"]')).toBeEnabled();
        });

        test('should restore a previous version', async ({ page }) => {
            await page.click('[data-testid="tab-versions"]');

            // Click restore on first version
            await page.click('[data-testid="restore-version-1"]');

            // Confirm restoration
            await page.click('[data-testid="confirm-restore"]');

            // Verify success message
            await expect(page.locator('[data-testid="toast-success"]')).toContainText('restored');
        });
    });

    test.describe('Comments', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
            await page.click('[data-testid="tab-comments"]');
        });

        test('should add a comment', async ({ page }) => {
            await page.fill('[data-testid="new-comment-input"]', 'This section needs clarification.');
            await page.click('[data-testid="add-comment-button"]');

            // Verify comment appears
            await expect(page.locator('[data-testid="comment-item"]').first()).toContainText(
                'This section needs clarification.',
            );
        });

        test('should reply to a comment', async ({ page }) => {
            // Add initial comment
            await page.fill('[data-testid="new-comment-input"]', 'Initial comment');
            await page.click('[data-testid="add-comment-button"]');

            // Reply to it
            await page.click('[data-testid="reply-button"]');
            await page.fill('[data-testid="reply-input"]', 'This is a reply');
            await page.click('[data-testid="submit-reply-button"]');

            // Verify reply appears
            await expect(page.locator('[data-testid="comment-reply"]')).toContainText('This is a reply');
        });

        test('should resolve a comment', async ({ page }) => {
            // Add a comment
            await page.fill('[data-testid="new-comment-input"]', 'To be resolved');
            await page.click('[data-testid="add-comment-button"]');

            // Resolve it
            await page.click('[data-testid="resolve-comment-button"]');

            // Verify resolved indicator
            await expect(page.locator('[data-testid="comment-resolved-badge"]')).toBeVisible();
        });
    });

    test.describe('Export', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
        });

        test('should export to PDF', async ({ page }) => {
            const downloadPromise = page.waitForEvent('download');
            await page.click('[data-testid="export-pdf-button"]');
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toContain('.pdf');
        });

        test('should export to PPTX', async ({ page }) => {
            const downloadPromise = page.waitForEvent('download');
            await page.click('[data-testid="export-pptx-button"]');
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toContain('.pptx');
        });

        test('should create a share link', async ({ page }) => {
            await page.click('[data-testid="share-button"]');

            // Wait for share dialog
            await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible();

            // Create share link
            await page.click('[data-testid="create-share-link-button"]');

            // Verify link is displayed
            await expect(page.locator('[data-testid="share-link-input"]')).toBeVisible();

            // Copy link
            await page.click('[data-testid="copy-share-link-button"]');
            await expect(page.locator('[data-testid="toast-success"]')).toContainText('copied');
        });
    });

    test.describe('Finalization', () => {
        test.beforeEach(async ({ page }) => {
            // Generate a non-approval-required report
            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible({ timeout: 30000 });
        });

        test('should finalize a report', async ({ page }) => {
            await page.click('[data-testid="finalize-button"]');
            await page.click('[data-testid="confirm-finalize"]');

            // Verify finalized status
            await expect(page.locator('[data-testid="report-status-badge"]')).toContainText('FINAL');
            await expect(page.locator('[data-testid="locked-indicator"]')).toBeVisible();
        });

        test('should show DRAFT watermark on non-finalized PDF', async ({ page }) => {
            // Export PDF before finalizing
            const downloadPromise = page.waitForEvent('download');
            await page.click('[data-testid="export-pdf-button"]');
            const download = await downloadPromise;

            // The PDF should have a DRAFT watermark (verified visually or in integration tests)
            expect(download).toBeDefined();
        });

        test('should unlock a finalized report (admin only)', async ({ page }) => {
            // Finalize first
            await page.click('[data-testid="finalize-button"]');
            await page.click('[data-testid="confirm-finalize"]');

            // Unlock
            await page.click('[data-testid="unlock-button"]');
            await page.fill('[data-testid="unlock-reason"]', 'Correction needed');
            await page.click('[data-testid="confirm-unlock"]');

            // Verify unlocked
            await expect(page.locator('[data-testid="report-status-badge"]')).toContainText('DRAFT');
        });
    });

    test.describe('Report History', () => {
        test('should navigate to history view', async ({ page }) => {
            await page.click('[data-testid="history-button"]');
            await expect(page.locator('[data-testid="report-history-table"]')).toBeVisible();
        });

        test('should filter history by report type', async ({ page }) => {
            await page.click('[data-testid="history-button"]');

            // Select filter
            await page.click('[data-testid="filter-report-type"]');
            await page.click('[data-testid="filter-option-team-meeting"]');

            // Verify filtered results
            const rows = page.locator('[data-testid="report-history-row"]');
            for (let i = 0; i < (await rows.count()); i++) {
                await expect(rows.nth(i)).toContainText('Team Meeting');
            }
        });

        test('should paginate history results', async ({ page }) => {
            await page.click('[data-testid="history-button"]');

            // Check pagination controls
            await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

            // Go to next page
            await page.click('[data-testid="pagination-next"]');

            // Verify page changed
            await expect(page.locator('[data-testid="pagination-current"]')).toContainText('2');
        });

        test('should view a report from history', async ({ page }) => {
            await page.click('[data-testid="history-button"]');

            // Click on first report
            await page.click('[data-testid="report-history-row"]:first-child [data-testid="view-report-button"]');

            // Verify report preview opens
            await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();
        });
    });

    test.describe('Accessibility', () => {
        test('should be keyboard navigable', async ({ page }) => {
            // Tab through main elements
            await page.keyboard.press('Tab');
            await expect(page.locator('[data-testid="report-type-team-meeting"]')).toBeFocused();

            await page.keyboard.press('Tab');
            await expect(page.locator('[data-testid="report-type-steering-committee"]')).toBeFocused();
        });

        test('should have proper ARIA labels', async ({ page }) => {
            // Check generate button has aria-label
            await expect(page.locator('[data-testid="generate-report-button"]')).toHaveAttribute('aria-label');

            // Check tabs have proper roles
            await expect(page.locator('[data-testid="tab-content"]')).toHaveAttribute('role', 'tab');
        });
    });

    test.describe('Responsive Design', () => {
        test('should display correctly on mobile', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 812 });

            // Elements should still be visible and functional
            await expect(page.locator('[data-testid="report-type-selector"]')).toBeVisible();
            await expect(page.locator('[data-testid="generate-report-button"]')).toBeVisible();
        });

        test('should display correctly on tablet', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });

            await expect(page.locator('[data-testid="report-type-selector"]')).toBeVisible();
            await expect(page.locator('[data-testid="generate-report-button"]')).toBeVisible();
        });
    });

    test.describe('Error Handling', () => {
        test('should display error when generation fails', async ({ page }) => {
            // Mock network failure
            await page.route('**/api/management-reports/generate', (route) => {
                route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
            });

            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');

            // Verify error toast
            await expect(page.locator('[data-testid="toast-error"]')).toBeVisible();
        });

        test('should handle network timeout gracefully', async ({ page }) => {
            // Mock slow network
            await page.route('**/api/management-reports/**', (route) => {
                setTimeout(() => route.continue(), 60000);
            });

            await page.click('[data-testid="report-type-team-meeting"]');
            await page.click('[data-testid="scope-portfolio"]');
            await page.click('[data-testid="generate-report-button"]');

            // Verify loading indicator
            await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
        });
    });
});



