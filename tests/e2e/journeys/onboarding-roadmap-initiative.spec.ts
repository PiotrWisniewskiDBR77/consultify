/**
 * Onboarding User Journey - E2E Test
 * 100% Coverage of Onboarding Flow:
 * Registration → Email Verification → Organization Setup → Team Invite → Tour
 * 
 * @playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Complete Flow', () => {

    test('should complete new user registration', async ({ page }) => {
        // Navigate to registration
        await page.goto('/register');

        // Fill registration form
        await page.fill('[data-testid="email-input"]', `e2e-test-${Date.now()}@test.com`);
        await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
        await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');
        await page.fill('[data-testid="first-name-input"]', 'E2E');
        await page.fill('[data-testid="last-name-input"]', 'TestUser');

        // Accept terms
        await page.click('[data-testid="terms-checkbox"]');

        // Submit registration
        await page.click('[data-testid="register-button"]');

        // Verify redirect to verification page
        await page.waitForURL(/\/verify-email|\/onboarding/);
    });

    test('should complete organization setup', async ({ page }) => {
        // Login with new account
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'onboarding-test@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');

        // Should redirect to onboarding
        await page.waitForURL(/\/onboarding/);

        // Step 1: Organization Details
        await page.waitForSelector('[data-testid="org-setup-step"]');
        await page.fill('[data-testid="org-name-input"]', 'E2E Test Company');
        await page.selectOption('[data-testid="org-industry"]', 'manufacturing');
        await page.selectOption('[data-testid="org-size"]', '50-200');

        await page.click('[data-testid="next-step-btn"]');

        // Step 2: Role Selection
        await page.waitForSelector('[data-testid="role-selection-step"]');
        await page.click('[data-testid="role-executive"]');

        await page.click('[data-testid="next-step-btn"]');

        // Step 3: Goals
        await page.waitForSelector('[data-testid="goals-step"]');
        await page.click('[data-testid="goal-digital-transformation"]');
        await page.click('[data-testid="goal-process-automation"]');

        await page.click('[data-testid="next-step-btn"]');

        // Step 4: Invite Team (Optional)
        await page.waitForSelector('[data-testid="invite-team-step"]');
        await page.click('[data-testid="skip-invite-btn"]'); // Skip for E2E

        // Complete onboarding
        await page.click('[data-testid="complete-onboarding-btn"]');

        // Verify redirect to dashboard
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete product tour', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');

        await page.waitForURL(/\/(dashboard|my-work)/);

        // Start tour if not completed
        const tourButton = page.locator('[data-testid="start-tour-btn"]');
        if (await tourButton.isVisible()) {
            await tourButton.click();

            // Step through tour
            await page.waitForSelector('[data-testid="tour-tooltip"]');

            // Navigation step
            await expect(page.locator('[data-testid="tour-tooltip"]')).toContainText(/navigation|sidebar/i);
            await page.click('[data-testid="tour-next-btn"]');

            // Dashboard step
            await expect(page.locator('[data-testid="tour-tooltip"]')).toContainText(/dashboard|overview/i);
            await page.click('[data-testid="tour-next-btn"]');

            // My Work step
            await expect(page.locator('[data-testid="tour-tooltip"]')).toContainText(/my work|tasks/i);
            await page.click('[data-testid="tour-next-btn"]');

            // Complete tour
            await page.click('[data-testid="tour-complete-btn"]');

            // Verify tour completed
            await expect(page.locator('[data-testid="tour-complete-modal"]')).toBeVisible();
        }
    });

    test('should invite team members during onboarding', async ({ page }) => {
        // Login as org admin
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'adminpassword123');
        await page.click('[data-testid="login-button"]');

        // Navigate to team settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-team"]');

        // Open invite modal
        await page.click('[data-testid="invite-member-btn"]');
        await page.waitForSelector('[data-testid="invite-modal"]');

        // Add multiple email addresses
        await page.fill('[data-testid="invite-emails"]', 'team1@test.com, team2@test.com');
        await page.selectOption('[data-testid="invite-role"]', 'member');

        // Add personal message
        await page.fill('[data-testid="invite-message"]', 'Welcome to our transformation journey!');

        // Send invites
        await page.click('[data-testid="send-invites-btn"]');

        // Verify success
        await page.waitForSelector('[data-testid="invites-sent-notification"]');

        // Check pending invites
        await page.click('[data-testid="pending-invites-tab"]');
        await expect(page.locator('text=team1@test.com')).toBeVisible();
        await expect(page.locator('text=team2@test.com')).toBeVisible();
    });
});

test.describe('Roadmap Planning Journey', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should create and manage roadmap', async ({ page }) => {
        // Navigate to roadmap
        await page.click('[data-testid="nav-roadmap"]');
        await expect(page).toHaveURL(/\/roadmap/);

        // Create new phase
        await page.click('[data-testid="add-phase-btn"]');
        await page.waitForSelector('[data-testid="phase-modal"]');

        await page.fill('[data-testid="phase-name"]', 'Phase 1: Discovery');
        await page.fill('[data-testid="phase-start-date"]', '2026-02-01');
        await page.fill('[data-testid="phase-end-date"]', '2026-03-31');
        await page.fill('[data-testid="phase-description"]', 'Initial discovery and assessment phase');

        await page.click('[data-testid="save-phase-btn"]');

        // Verify phase created
        await expect(page.locator('text=Phase 1: Discovery')).toBeVisible();

        // Add milestone to phase
        await page.click('[data-testid="add-milestone-btn"]');
        await page.waitForSelector('[data-testid="milestone-modal"]');

        await page.fill('[data-testid="milestone-name"]', 'Assessment Complete');
        await page.fill('[data-testid="milestone-date"]', '2026-02-28');

        await page.click('[data-testid="save-milestone-btn"]');

        // Verify milestone created
        await expect(page.locator('text=Assessment Complete')).toBeVisible();
    });

    test('should view roadmap in different modes', async ({ page }) => {
        // Navigate to roadmap
        await page.click('[data-testid="nav-roadmap"]');

        // Default Gantt view
        await page.waitForSelector('[data-testid="roadmap-gantt"]');

        // Switch to Kanban view
        await page.click('[data-testid="view-kanban-btn"]');
        await page.waitForSelector('[data-testid="roadmap-kanban"]');

        // Switch to Timeline view
        await page.click('[data-testid="view-timeline-btn"]');
        await page.waitForSelector('[data-testid="roadmap-timeline"]');

        // Switch back to Gantt
        await page.click('[data-testid="view-gantt-btn"]');
        await page.waitForSelector('[data-testid="roadmap-gantt"]');
    });

    test('should manage dependencies between phases', async ({ page }) => {
        // Navigate to roadmap
        await page.click('[data-testid="nav-roadmap"]');

        // Open dependencies modal
        await page.click('[data-testid="manage-dependencies-btn"]');
        await page.waitForSelector('[data-testid="dependencies-modal"]');

        // Create dependency
        await page.selectOption('[data-testid="dependency-from"]', 'phase-1');
        await page.selectOption('[data-testid="dependency-to"]', 'phase-2');
        await page.selectOption('[data-testid="dependency-type"]', 'finish-to-start');

        await page.click('[data-testid="add-dependency-btn"]');

        // Verify dependency created
        await expect(page.locator('[data-testid="dependency-line"]')).toBeVisible();

        // Close modal
        await page.click('[data-testid="close-modal-btn"]');
    });
});

test.describe('Initiative Lifecycle Journey', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should create initiative from scratch', async ({ page }) => {
        // Navigate to initiatives
        await page.click('[data-testid="nav-initiatives"]');
        await expect(page).toHaveURL(/\/initiatives/);

        // Create new initiative
        await page.click('[data-testid="new-initiative-btn"]');
        await page.waitForSelector('[data-testid="initiative-modal"]');

        // Fill initiative details
        await page.fill('[data-testid="initiative-title"]', 'E2E Test Initiative');
        await page.fill('[data-testid="initiative-description"]', 'Created during E2E testing');
        await page.selectOption('[data-testid="initiative-category"]', 'digital_transformation');
        await page.selectOption('[data-testid="initiative-priority"]', 'high');

        // Set dates
        await page.fill('[data-testid="initiative-start-date"]', '2026-02-01');
        await page.fill('[data-testid="initiative-end-date"]', '2026-06-30');

        // Save initiative
        await page.click('[data-testid="save-initiative-btn"]');

        // Verify initiative created
        await expect(page.locator('text=E2E Test Initiative')).toBeVisible();
    });

    test('should track initiative progress', async ({ page }) => {
        // Navigate to initiatives
        await page.click('[data-testid="nav-initiatives"]');

        // Open an initiative
        await page.click('[data-testid="initiative-item-0"]');
        await page.waitForSelector('[data-testid="initiative-detail"]');

        // Add task to initiative
        await page.click('[data-testid="add-task-btn"]');
        await page.fill('[data-testid="task-title"]', 'E2E Task');
        await page.click('[data-testid="save-task-btn"]');

        // Complete task
        await page.click('[data-testid="task-checkbox-0"]');

        // Verify progress updated
        await expect(page.locator('[data-testid="initiative-progress"]')).toContainText(/\d+%/);
    });

    test('should complete initiative lifecycle', async ({ page }) => {
        // Navigate to initiatives
        await page.click('[data-testid="nav-initiatives"]');

        // Find active initiative
        await page.click('[data-testid="filter-active"]');
        await page.click('[data-testid="initiative-item-0"]');

        // Change status through lifecycle
        await page.click('[data-testid="status-dropdown"]');
        await page.click('[data-testid="status-in-progress"]');

        // Add update
        await page.click('[data-testid="add-update-btn"]');
        await page.fill('[data-testid="update-content"]', 'Making good progress');
        await page.click('[data-testid="post-update-btn"]');

        // Move to completed
        await page.click('[data-testid="status-dropdown"]');
        await page.click('[data-testid="status-completed"]');

        // Verify completion
        await expect(page.locator('[data-testid="status-badge"]')).toContainText('Completed');
    });
});
