import { test, expect } from '@playwright/test';

/**
 * E2E Tests: User Onboarding Flow
 * Complete user registration and onboarding journey
 * CRITICAL FOR ENTERPRISE USER ACQUISITION
 */

test.describe('User Onboarding Flow', () => {
    test.setTimeout(60000); // 60 seconds for complete flow

    test('complete user registration and onboarding', async ({ page, context }) => {
        // ==========================================
        // PHASE 1: User Registration
        // ==========================================

        await test.step('Navigate to registration page', async () => {
            await page.goto('/register');
            await expect(page).toHaveTitle(/Consultinity/);
        });

        await test.step('Fill registration form', async () => {
            // Organization setup
            await page.fill('[data-testid="org-name"]', 'Test Enterprise Corp');
            await page.selectOption('[data-testid="org-size"]', '50-200');
            await page.selectOption('[data-testid="industry"]', 'technology');

            // User details
            await page.fill('[data-testid="first-name"]', 'John');
            await page.fill('[data-testid="last-name"]', 'Admin');
            await page.fill('[data-testid="email"]', `john.admin.${Date.now()}@testenterprise.com`);
            await page.fill('[data-testid="password"]', 'SecurePass123!');
            await page.fill('[data-testid="confirm-password"]', 'SecurePass123!');

            // Terms and privacy
            await page.check('[data-testid="terms-agreement"]');
            await page.check('[data-testid="privacy-agreement"]');
        });

        await test.step('Submit registration', async () => {
            await page.click('[data-testid="register-button"]');

            // Wait for success message or redirect
            await expect(page.locator('[data-testid="registration-success"]')).toBeVisible();
        });

        // ==========================================
        // PHASE 2: Email Verification
        // ==========================================

        await test.step('Handle email verification', async () => {
            // In real scenario, would check email
            // For testing, simulate verification link click
            const verificationToken = 'mock-verification-token';
            await page.goto(`/verify-email?token=${verificationToken}`);

            await expect(page.locator('[data-testid="email-verified"]')).toBeVisible();
        });

        // ==========================================
        // PHASE 3: Organization Setup
        // ==========================================

        await test.step('Complete organization setup', async () => {
            // Organization details
            await page.fill('[data-testid="org-description"]', 'Leading technology solutions provider');
            await page.fill('[data-testid="org-website"]', 'https://testenterprise.com');
            await page.selectOption('[data-testid="org-timezone"]', 'America/New_York');

            // Billing setup (if applicable)
            await page.selectOption('[data-testid="billing-plan"]', 'enterprise');

            await page.click('[data-testid="setup-org-button"]');
            await expect(page.locator('[data-testid="org-setup-complete"]')).toBeVisible();
        });

        // ==========================================
        // PHASE 4: User Profile Setup
        // ==========================================

        await test.step('Setup user profile', async () => {
            await page.fill('[data-testid="job-title"]', 'Chief Technology Officer');
            await page.fill('[data-testid="department"]', 'Technology');
            await page.selectOption('[data-testid="experience-level"]', 'executive');

            // Profile completion
            await page.fill('[data-testid="bio"]', 'Experienced CTO with 15+ years in enterprise software');
            await page.fill('[data-testid="linkedin"]', 'https://linkedin.com/in/johnadmin');

            await page.click('[data-testid="complete-profile-button"]');
        });

        // ==========================================
        // PHASE 5: Workspace Initialization
        // ==========================================

        await test.step('Initialize workspace', async () => {
            // First assessment prompt
            await page.click('[data-testid="start-first-assessment"]');

            // Assessment framework selection
            await page.click('[data-testid="framework-pmbok"]');
            await page.click('[data-testid="framework-scrum"]');

            // Initial project setup
            await page.fill('[data-testid="first-project-name"]', 'Digital Transformation Initiative');
            await page.selectOption('[data-testid="project-priority"]', 'high');

            await page.click('[data-testid="initialize-workspace"]');
        });

        // ==========================================
        // PHASE 6: Onboarding Completion
        // ==========================================

        await test.step('Complete onboarding', async () => {
            await expect(page.locator('[data-testid="onboarding-complete"]')).toBeVisible();
            await expect(page.locator('[data-testid="welcome-dashboard"]')).toBeVisible();

            // Verify user is logged in
            await expect(page.locator('[data-testid="user-menu"]')).toContainText('John Admin');
        });

        // ==========================================
        // VERIFICATION: Post-Onboarding State
        // ==========================================

        await test.step('Verify post-onboarding state', async () => {
            // Check dashboard elements
            await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();
            await expect(page.locator('[data-testid="task-inbox"]')).toBeVisible();
            await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();

            // Check navigation
            await expect(page.locator('[data-testid="nav-projects"]')).toBeVisible();
            await expect(page.locator('[data-testid="nav-assessments"]')).toBeVisible();
            await expect(page.locator('[data-testid="nav-reports"]')).toBeVisible();

            // Check user settings are accessible
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="settings-link"]');
            await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();
        });
    });

    test('onboarding flow with invitation', async ({ page, context }) => {
        // ==========================================
        // PHASE 1: Accept Organization Invitation
        // ==========================================

        await test.step('Navigate to invitation link', async () => {
            const inviteToken = 'mock-invite-token';
            await page.goto(`/accept-invite?token=${inviteToken}`);
        });

        await test.step('Accept invitation and register', async () => {
            // Pre-filled organization info
            await expect(page.locator('[data-testid="org-name"]')).toHaveValue('Inviting Corp');

            // Fill user details
            await page.fill('[data-testid="first-name"]', 'Jane');
            await page.fill('[data-testid="last-name"]', 'Member');
            await page.fill('[data-testid="email"]', `jane.member.${Date.now()}@inviting.com`);
            await page.fill('[data-testid="password"]', 'SecurePass123!');

            await page.check('[data-testid="terms-agreement"]');
            await page.click('[data-testid="accept-invite-button"]');
        });

        // ==========================================
        // PHASE 2: Invitation-Based Onboarding
        // ==========================================

        await test.step('Complete invitation onboarding', async () => {
            // Email verification (simulated)
            await page.click('[data-testid="verify-email-button"]');

            // Role assignment
            await expect(page.locator('[data-testid="assigned-role"]')).toContainText('Team Member');

            // Quick profile setup
            await page.fill('[data-testid="job-title"]', 'Product Manager');
            await page.click('[data-testid="quick-setup-complete"]');
        });

        // ==========================================
        // VERIFICATION: Team Member Access
        // ==========================================

        await test.step('Verify team member access', async () => {
            await expect(page.locator('[data-testid="dashboard-limited"]')).toBeVisible();

            // Check available features for team member
            await expect(page.locator('[data-testid="nav-projects"]')).toBeVisible();
            await expect(page.locator('[data-testid="nav-my-work"]')).toBeVisible();

            // Admin features should be hidden
            await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();
        });
    });

    test('onboarding with payment setup', async ({ page }) => {
        // ==========================================
        // PHASE 1: Trial Registration
        // ==========================================

        await test.step('Start trial registration', async () => {
            await page.goto('/register?trial=true');
            await page.fill('[data-testid="org-name"]', 'Trial Company Inc');
            await page.fill('[data-testid="email"]', `trial.${Date.now()}@trialcompany.com`);
            await page.fill('[data-testid="password"]', 'TrialPass123!');
            await page.check('[data-testid="terms-agreement"]');
            await page.click('[data-testid="start-trial-button"]');
        });

        // ==========================================
        // PHASE 2: Trial Setup
        // ==========================================

        await test.step('Complete trial setup', async () => {
            // Trial banner should be visible
            await expect(page.locator('[data-testid="trial-banner"]')).toBeVisible();
            await expect(page.locator('[data-testid="trial-days-left"]')).toContainText('14');

            // Complete onboarding
            await page.fill('[data-testid="job-title"]', 'CEO');
            await page.click('[data-testid="complete-trial-setup"]');
        });

        // ==========================================
        // PHASE 3: Payment Setup Prompt
        // ==========================================

        await test.step('Handle payment setup prompts', async () => {
            // Trial expiration warning
            await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible();

            // Navigate to billing
            await page.click('[data-testid="upgrade-button"]');
            await expect(page.locator('[data-testid="billing-plans"]')).toBeVisible();

            // Select plan and add payment method (simulated)
            await page.click('[data-testid="plan-enterprise"]');
            await page.click('[data-testid="setup-payment"]');

            // Payment form (simulated success)
            await page.fill('[data-testid="card-number"]', '4242424242424242');
            await page.fill('[data-testid="expiry"]', '12/25');
            await page.fill('[data-testid="cvc"]', '123');
            await page.click('[data-testid="complete-payment"]');

            await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
        });

        // ==========================================
        // VERIFICATION: Paid Account State
        // ==========================================

        await test.step('Verify paid account features', async () => {
            // Trial banner should be gone
            await expect(page.locator('[data-testid="trial-banner"]')).not.toBeVisible();

            // All features should be available
            await expect(page.locator('[data-testid="premium-feature"]')).toBeVisible();
            await expect(page.locator('[data-testid="advanced-analytics"]')).toBeVisible();

            // Check billing status
            await page.click('[data-testid="billing-link"]');
            await expect(page.locator('[data-testid="active-subscription"]')).toBeVisible();
        });
    });

    test('onboarding error handling', async ({ page }) => {
        // ==========================================
        // ERROR: Invalid Email
        // ==========================================

        await test.step('Test invalid email validation', async () => {
            await page.goto('/register');
            await page.fill('[data-testid="email"]', 'invalid-email');
            await page.click('[data-testid="register-button"]');

            await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
        });

        // ==========================================
        // ERROR: Weak Password
        // ==========================================

        await test.step('Test password strength validation', async () => {
            await page.fill('[data-testid="password"]', '123');
            await page.click('[data-testid="register-button"]');

            await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="password-error"]')).toContainText('strong');
        });

        // ==========================================
        // ERROR: Duplicate Email
        // ==========================================

        await test.step('Test duplicate email handling', async () => {
            await page.fill('[data-testid="email"]', 'existing@test.com');
            await page.fill('[data-testid="password"]', 'SecurePass123!');
            await page.check('[data-testid="terms-agreement"]');
            await page.click('[data-testid="register-button"]');

            await expect(page.locator('[data-testid="duplicate-email-error"]')).toBeVisible();
        });

        // ==========================================
        // ERROR: Organization Name Required
        // ==========================================

        await test.step('Test required field validation', async () => {
            await page.fill('[data-testid="org-name"]', '');
            await page.click('[data-testid="register-button"]');

            await expect(page.locator('[data-testid="org-name-error"]')).toBeVisible();
        });
    });

    test('onboarding accessibility', async ({ page }) => {
        await test.step('Test keyboard navigation', async () => {
            await page.goto('/register');

            // Tab through form fields
            await page.keyboard.press('Tab'); // Focus org name
            await expect(page.locator('[data-testid="org-name"]')).toBeFocused();

            await page.keyboard.press('Tab'); // Focus org size
            await expect(page.locator('[data-testid="org-size"]')).toBeFocused();
        });

        await test.step('Test screen reader support', async () => {
            // Check ARIA labels
            await expect(page.locator('[data-testid="org-name"]')).toHaveAttribute('aria-label', 'Organization Name');
            await expect(page.locator('[data-testid="email"]')).toHaveAttribute('aria-label', 'Email Address');

            // Check error announcements
            await page.fill('[data-testid="email"]', 'invalid');
            await page.click('[data-testid="register-button"]');

            await expect(page.locator('[data-testid="email-error"]')).toHaveAttribute('role', 'alert');
        });
    });
});






