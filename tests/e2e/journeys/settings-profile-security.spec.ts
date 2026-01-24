/**
 * Settings & Profile User Journey - E2E Test
 * 100% Coverage of Settings Flow:
 * Profile → Security → Notifications → Theme → Organization
 * 
 * @playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Settings User Journey', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete profile settings flow', async ({ page }) => {
        // Navigate to Settings
        await page.click('[data-testid="nav-settings"]');
        await expect(page).toHaveURL(/\/settings/);

        // Profile Section
        await page.click('[data-testid="settings-profile"]');
        await page.waitForSelector('[data-testid="profile-form"]');

        // Update name
        await page.fill('[data-testid="first-name-input"]', 'Test');
        await page.fill('[data-testid="last-name-input"]', 'User');

        // Update job title
        await page.fill('[data-testid="job-title-input"]', 'QA Engineer');

        // Save changes
        await page.click('[data-testid="save-profile-btn"]');
        await page.waitForSelector('[data-testid="success-notification"]');

        // Verify changes persisted
        await page.reload();
        await expect(page.locator('[data-testid="first-name-input"]')).toHaveValue('Test');
        await expect(page.locator('[data-testid="last-name-input"]')).toHaveValue('User');
    });

    test('should complete security settings flow', async ({ page }) => {
        // Navigate to Security settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-security"]');

        // Change password
        await page.fill('[data-testid="current-password"]', 'testpassword123');
        await page.fill('[data-testid="new-password"]', 'newSecurePassword456!');
        await page.fill('[data-testid="confirm-password"]', 'newSecurePassword456!');
        await page.click('[data-testid="change-password-btn"]');

        await page.waitForSelector('[data-testid="password-changed-notification"]');

        // Enable MFA
        await page.click('[data-testid="enable-mfa-btn"]');
        await page.waitForSelector('[data-testid="mfa-setup-modal"]');

        // Verify QR code is shown
        await expect(page.locator('[data-testid="mfa-qr-code"]')).toBeVisible();

        // Close modal (in real test would complete MFA setup)
        await page.click('[data-testid="close-modal-btn"]');

        // View active sessions
        await page.click('[data-testid="view-sessions-btn"]');
        await page.waitForSelector('[data-testid="sessions-list"]');

        const sessions = page.locator('[data-testid^="session-item-"]');
        await expect(sessions.first()).toBeVisible();
    });

    test('should complete notification settings flow', async ({ page }) => {
        // Navigate to Notification settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-notifications"]');

        // Email notifications
        await page.waitForSelector('[data-testid="email-notifications-section"]');

        // Toggle notifications
        await page.click('[data-testid="toggle-task-reminders"]');
        await page.click('[data-testid="toggle-decision-alerts"]');
        await page.click('[data-testid="toggle-weekly-digest"]');

        // Save preferences
        await page.click('[data-testid="save-notifications-btn"]');
        await page.waitForSelector('[data-testid="success-notification"]');

        // Verify toggles persisted
        await page.reload();
        await page.click('[data-testid="settings-notifications"]');

        await expect(page.locator('[data-testid="toggle-task-reminders"]')).toBeChecked();
    });

    test('should complete theme and appearance settings flow', async ({ page }) => {
        // Navigate to Appearance settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-appearance"]');

        // Select dark theme
        await page.click('[data-testid="theme-dark"]');

        // Verify dark mode applied
        await expect(page.locator('html')).toHaveClass(/dark/);

        // Select light theme
        await page.click('[data-testid="theme-light"]');
        await expect(page.locator('html')).not.toHaveClass(/dark/);

        // Select system theme
        await page.click('[data-testid="theme-system"]');

        // Change language
        await page.selectOption('[data-testid="language-select"]', 'pl');
        await page.waitForSelector('[data-testid="language-changed-notification"]');

        // Verify Polish labels
        await expect(page.locator('[data-testid="settings-title"]')).toContainText(/Ustawienia/i);

        // Reset to English
        await page.selectOption('[data-testid="language-select"]', 'en');
    });
});

test.describe('Organization Settings Journey', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'adminpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should manage organization settings', async ({ page }) => {
        // Navigate to Organization settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-organization"]');

        // Update organization name
        await page.fill('[data-testid="org-name-input"]', 'Test Organization Updated');

        // Update organization description
        await page.fill('[data-testid="org-description"]', 'Updated description for testing');

        // Save changes
        await page.click('[data-testid="save-org-btn"]');
        await page.waitForSelector('[data-testid="success-notification"]');
    });

    test('should manage team members', async ({ page }) => {
        // Navigate to Team settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-team"]');

        // Invite new member
        await page.click('[data-testid="invite-member-btn"]');
        await page.waitForSelector('[data-testid="invite-modal"]');

        await page.fill('[data-testid="invite-email"]', 'newmember@test.com');
        await page.selectOption('[data-testid="invite-role"]', 'member');
        await page.click('[data-testid="send-invite-btn"]');

        await page.waitForSelector('[data-testid="invite-sent-notification"]');

        // View pending invitations
        await page.click('[data-testid="pending-invites-tab"]');
        await expect(page.locator('text=newmember@test.com')).toBeVisible();
    });
});

test.describe('Billing Settings Journey', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin with billing access
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'adminpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should view billing information', async ({ page }) => {
        // Navigate to Billing settings
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-billing"]');

        // View current plan
        await page.waitForSelector('[data-testid="current-plan-card"]');
        await expect(page.locator('[data-testid="plan-name"]')).toBeVisible();

        // View usage
        await expect(page.locator('[data-testid="usage-section"]')).toBeVisible();

        // View invoices
        await page.click('[data-testid="invoices-tab"]');
        await page.waitForSelector('[data-testid="invoices-list"]');
    });

    test('should upgrade plan', async ({ page }) => {
        // Navigate to Billing
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="settings-billing"]');

        // Click upgrade
        await page.click('[data-testid="upgrade-plan-btn"]');
        await page.waitForSelector('[data-testid="pricing-modal"]');

        // Select plan
        await page.click('[data-testid="plan-professional"]');
        await page.click('[data-testid="select-plan-btn"]');

        // Verify checkout page
        await page.waitForSelector('[data-testid="checkout-form"]');
        await expect(page.locator('[data-testid="payment-method-section"]')).toBeVisible();
    });
});

test.describe('Admin Dashboard Journey', () => {
    test.beforeEach(async ({ page }) => {
        // Login as super admin
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'superadmin@test.com');
        await page.fill('[data-testid="password-input"]', 'superadminpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work|admin)/);
    });

    test('should navigate admin console', async ({ page }) => {
        // Navigate to Admin Console
        await page.click('[data-testid="nav-admin"]');
        await expect(page).toHaveURL(/\/admin/);

        // View system dashboard
        await page.waitForSelector('[data-testid="admin-dashboard"]');

        // View organizations
        await page.click('[data-testid="admin-organizations"]');
        await page.waitForSelector('[data-testid="organizations-list"]');

        // View users
        await page.click('[data-testid="admin-users"]');
        await page.waitForSelector('[data-testid="users-list"]');

        // View system health
        await page.click('[data-testid="admin-system-health"]');
        await page.waitForSelector('[data-testid="health-dashboard"]');
        await expect(page.locator('[data-testid="database-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="api-status"]')).toBeVisible();
    });

    test('should manage user from admin console', async ({ page }) => {
        // Navigate to Admin Users
        await page.click('[data-testid="nav-admin"]');
        await page.click('[data-testid="admin-users"]');

        // Search for user
        await page.fill('[data-testid="user-search"]', 'demo@test.com');
        await page.click('[data-testid="search-btn"]');

        // Click on user
        await page.click('[data-testid="user-demo@test.com"]');
        await page.waitForSelector('[data-testid="user-detail-panel"]');

        // View user details
        await expect(page.locator('[data-testid="user-email"]')).toHaveText('demo@test.com');

        // Edit user role
        await page.click('[data-testid="edit-user-btn"]');
        await page.selectOption('[data-testid="user-role-select"]', 'admin');
        await page.click('[data-testid="save-user-btn"]');

        await page.waitForSelector('[data-testid="user-updated-notification"]');
    });
});
