import { test, expect } from '@playwright/test';

test.describe('User Onboarding Flow', () => {
    test.describe('Initial Registration', () => {
        test('should complete full user registration flow', async ({ page }) => {
            await page.goto('/');

            // Click sign up on welcome page
            await page.click('text=Sign Up');

            // Fill registration form
            await page.fill('input[name="firstName"]', 'John');
            await page.fill('input[name="lastName"]', 'Onboarding');
            await page.fill('input[name="email"]', 'john.onboarding@example.com');
            await page.fill('input[name="password"]', 'SecurePass123!');
            await page.fill('input[name="confirmPassword"]', 'SecurePass123!');

            // Accept terms
            await page.check('input[name="acceptTerms"]');

            // Submit registration
            await page.click('button[type="submit"]');

            // Should show success message
            await expect(page.locator('text=Registration successful!')).toBeVisible();
            await expect(page.locator('text=Please check your email to verify your account')).toBeVisible();
        });

        test('should validate registration form fields', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign Up');

            // Try to submit empty form
            await page.click('button[type="submit"]');

            // Should show validation errors
            await expect(page.locator('text=First name is required')).toBeVisible();
            await expect(page.locator('text=Last name is required')).toBeVisible();
            await expect(page.locator('text=Email is required')).toBeVisible();
            await expect(page.locator('text=Password is required')).toBeVisible();
            await expect(page.locator('text=Please accept the terms')).toBeVisible();

            // Test invalid email
            await page.fill('input[name="email"]', 'invalid-email');
            await page.click('button[type="submit"]');
            await expect(page.locator('text=Please enter a valid email')).toBeVisible();

            // Test weak password
            await page.fill('input[name="password"]', 'weak');
            await page.click('button[type="submit"]');
            await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();

            // Test password mismatch
            await page.fill('input[name="password"]', 'ValidPass123!');
            await page.fill('input[name="confirmPassword"]', 'DifferentPass123!');
            await page.click('button[type="submit"]');
            await expect(page.locator('text=Passwords do not match')).toBeVisible();
        });

        test('should prevent duplicate email registration', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign Up');

            // Try to register with existing email
            await page.fill('input[name="firstName"]', 'Existing');
            await page.fill('input[name="lastName"]', 'User');
            await page.fill('input[name="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost')); // Existing admin email
            await page.fill('input[name="password"]', 'ValidPass123!');
            await page.fill('input[name="confirmPassword"]', 'ValidPass123!');
            await page.check('input[name="acceptTerms"]');

            await page.click('button[type="submit"]');

            await expect(page.locator('text=Email already registered')).toBeVisible();
        });
    });

    test.describe('Email Verification', () => {
        test('should handle email verification flow', async ({ page }) => {
            // Simulate clicking verification link from email
            // In real scenario, this would come from email
            await page.goto('/verify-email?token=mock-verification-token');

            // Should show verification success
            await expect(page.locator('text=Email verified successfully!')).toBeVisible();
            await expect(page.locator('text=You can now log in to your account')).toBeVisible();

            // Should redirect to login
            await expect(page.locator('text=Log In')).toBeVisible();
        });

        test('should handle invalid verification tokens', async ({ page }) => {
            await page.goto('/verify-email?token=invalid-token');

            await expect(page.locator('text=Invalid verification token')).toBeVisible();
            await expect(page.locator('text=Please try registering again')).toBeVisible();
        });

        test('should allow resending verification email', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.click('text=Forgot password?');

            await page.fill('input[name="email"]', 'john.onboarding@example.com');
            await page.click('button:has-text("Send Reset Link")');

            await expect(page.locator('text=Password reset link sent')).toBeVisible();
        });
    });

    test.describe('First Login and Welcome Tour', () => {
        test('should show onboarding tour for new users', async ({ page }) => {
            // Login as new user (assuming email is verified)
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            // Should show welcome modal
            await expect(page.locator('text=Welcome to Consultinity!')).toBeVisible();
            await expect(page.locator('text=Let\'s get you started')).toBeVisible();

            // Start tour
            await page.click('button:has-text("Start Tour")');

            // Should show first step
            await expect(page.locator('text=Dashboard Overview')).toBeVisible();
            await expect(page.locator('.tour-highlight')).toBeVisible();

            // Navigate through tour steps
            await page.click('button:has-text("Next")');
            await expect(page.locator('text=Projects')).toBeVisible();

            await page.click('button:has-text("Next")');
            await expect(page.locator('text=Initiatives')).toBeVisible();

            await page.click('button:has-text("Next")');
            await expect(page.locator('text=AI Assistant')).toBeVisible();

            // Complete tour
            await page.click('button:has-text("Finish Tour")');

            // Should hide tour
            await expect(page.locator('.tour-overlay')).not.toBeVisible();
        });

        test('should allow skipping onboarding tour', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            // Skip tour
            await page.click('button:has-text("Skip Tour")');

            // Should go directly to dashboard
            await expect(page.locator('text=Dashboard')).toBeVisible();
            await expect(page.locator('.tour-overlay')).not.toBeVisible();
        });
    });

    test.describe('Organization Setup', () => {
        test('should guide through organization creation', async ({ page }) => {
            // Login as new user
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            // Skip tour for this test
            await page.click('button:has-text("Skip Tour")');

            // Should prompt for organization setup
            await expect(page.locator('text=Set up your organization')).toBeVisible();

            // Fill organization details
            await page.fill('input[name="orgName"]', 'Onboarding Test Company');
            await page.fill('input[name="orgDomain"]', 'onboarding-test.com');
            await page.selectOption('select[name="industry"]', 'technology');
            await page.fill('input[name="employeeCount"]', '50');
            await page.fill('textarea[name="description"]', 'A technology company focused on digital transformation');

            await page.click('button:has-text("Create Organization")');

            // Should show success and redirect to dashboard
            await expect(page.locator('text=Organization created successfully!')).toBeVisible();
            await expect(page.locator('text=Onboarding Test Company')).toBeVisible();
        });

        test('should validate organization data', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            // Try to submit empty organization form
            await page.click('button:has-text("Create Organization")');

            await expect(page.locator('text=Organization name is required')).toBeVisible();
            await expect(page.locator('text=Domain is required')).toBeVisible();

            // Test invalid domain
            await page.fill('input[name="orgName"]', 'Test Company');
            await page.fill('input[name="orgDomain"]', 'invalid domain');
            await page.click('button:has-text("Create Organization")');

            await expect(page.locator('text=Please enter a valid domain')).toBeVisible();
        });
    });

    test.describe('Initial Project Setup', () => {
        test('should guide through first project creation', async ({ page }) => {
            // Login and complete org setup first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            // Quick org setup
            await page.fill('input[name="orgName"]', 'Onboarding Test Company');
            await page.fill('input[name="orgDomain"]', 'onboarding-test.com');
            await page.click('button:has-text("Create Organization")');

            // Should prompt for first project
            await expect(page.locator('text=Create your first project')).toBeVisible();

            // Fill project details
            await page.fill('input[name="projectName"]', 'My First Project');
            await page.fill('textarea[name="projectDescription"]', 'This is my first project to get started with Consultinity');
            await page.selectOption('select[name="priority"]', 'medium');
            await page.fill('input[name="startDate"]', '2024-01-15');
            await page.fill('input[name="endDate"]', '2024-06-15');
            await page.fill('input[name="budget"]', '50000');

            await page.click('button:has-text("Create Project")');

            // Should show success and project details
            await expect(page.locator('text=Project created successfully!')).toBeVisible();
            await expect(page.locator('text=My First Project')).toBeVisible();
        });

        test('should offer project templates', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            // Complete org setup
            await page.fill('input[name="orgName"]', 'Onboarding Test Company');
            await page.fill('input[name="orgDomain"]', 'onboarding-test.com');
            await page.click('button:has-text("Create Organization")');

            // Should show template options
            await expect(page.locator('text=Choose a template')).toBeVisible();
            await expect(page.locator('text=Digital Transformation')).toBeVisible();
            await expect(page.locator('text=Process Optimization')).toBeVisible();
            await expect(page.locator('text=Custom Project')).toBeVisible();

            // Select template
            await page.click('text=Digital Transformation');
            await page.click('button:has-text("Use Template")');

            // Should pre-fill project with template data
            await expect(page.locator('input[name="projectName"]')).toHaveValue('Digital Transformation Initiative');
            await expect(page.locator('text=Pre-configured phases')).toBeVisible();
        });
    });

    test.describe('Team Invitation', () => {
        test('should guide through team member invitation', async ({ page }) => {
            // Login and complete basic setup
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            // Complete org and project setup
            await page.fill('input[name="orgName"]', 'Onboarding Test Company');
            await page.fill('input[name="orgDomain"]', 'onboarding-test.com');
            await page.click('button:has-text("Create Organization")');

            await page.fill('input[name="projectName"]', 'My First Project');
            await page.click('button:has-text("Create Project")');

            // Should prompt for team setup
            await expect(page.locator('text=Invite your team')).toBeVisible();

            // Invite team members
            await page.click('button:has-text("Invite Members")');

            // Add first member
            await page.fill('input[name="email1"]', 'team.member1@example.com');
            await page.selectOption('select[name="role1"]', 'project_manager');

            // Add second member
            await page.click('button:has-text("Add Another")');
            await page.fill('input[name="email2"]', 'team.member2@example.com');
            await page.selectOption('select[name="role2"]', 'team_member');

            await page.click('button:has-text("Send Invitations")');

            // Should show success
            await expect(page.locator('text=Invitations sent successfully!')).toBeVisible();
            await expect(page.locator('text=2 team members invited')).toBeVisible();
        });

        test('should validate invitation emails', async ({ page }) => {
            // Login and get to team invitation step
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            await page.fill('input[name="orgName"]', 'Onboarding Test Company');
            await page.fill('input[name="orgDomain"]', 'onboarding-test.com');
            await page.click('button:has-text("Create Organization")');

            await page.fill('input[name="projectName"]', 'My First Project');
            await page.click('button:has-text("Create Project")');

            await page.click('button:has-text("Invite Members")');

            // Try invalid email
            await page.fill('input[name="email1"]', 'invalid-email');
            await page.selectOption('select[name="role1"]', 'project_manager');
            await page.click('button:has-text("Send Invitations")');

            await expect(page.locator('text=Please enter valid email addresses')).toBeVisible();
        });
    });

    test.describe('Onboarding Completion', () => {
        test('should show onboarding completion summary', async ({ page }) => {
            // Complete full onboarding flow
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            await page.fill('input[name="orgName"]', 'Onboarding Test Company');
            await page.fill('input[name="orgDomain"]', 'onboarding-test.com');
            await page.click('button:has-text("Create Organization")');

            await page.fill('input[name="projectName"]', 'My First Project');
            await page.click('button:has-text("Create Project")');

            await page.click('button:has-text("Invite Members")');
            await page.fill('input[name="email1"]', 'team.member1@example.com');
            await page.selectOption('select[name="role1"]', 'project_manager');
            await page.click('button:has-text("Send Invitations")');

            // Should show completion summary
            await expect(page.locator('text=Onboarding Complete!')).toBeVisible();
            await expect(page.locator('text=You\'re all set to start using Consultinity')).toBeVisible();

            // Should show summary of what was created
            await expect(page.locator('text=Organization: Onboarding Test Company')).toBeVisible();
            await expect(page.locator('text=Project: My First Project')).toBeVisible();
            await expect(page.locator('text=Team members invited: 1')).toBeVisible();

            // Should offer next steps
            await expect(page.locator('text=Explore your dashboard')).toBeVisible();
            await expect(page.locator('text=Create your first initiative')).toBeVisible();
            await expect(page.locator('text=Set up AI assistant')).toBeVisible();

            // Complete onboarding
            await page.click('button:has-text("Get Started")');

            // Should go to main dashboard
            await expect(page.locator('text=Dashboard')).toBeVisible();
            await expect(page.locator('.onboarding-complete')).not.toBeVisible();
        });

        test('should allow returning to onboarding later', async ({ page }) => {
            // Login after completing onboarding
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            // Should go directly to dashboard (onboarding complete)
            await expect(page.locator('text=Dashboard')).toBeVisible();

            // Check profile/settings for onboarding restart option
            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            await page.click('text=Onboarding');
            await expect(page.locator('text=Restart Onboarding Tour')).toBeVisible();

            // Could restart if needed
            await page.click('button:has-text("Restart Tour")');
            await expect(page.locator('text=Welcome back!')).toBeVisible();
        });
    });

    test.describe('Onboarding Analytics', () => {
        test('should track onboarding completion metrics', async ({ page }) => {
            // Login as admin to check analytics
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/admin/analytics');

            // Should show onboarding metrics
            await expect(page.locator('text=Onboarding Analytics')).toBeVisible();
            await expect(page.locator('text=Completion Rate')).toBeVisible();
            await expect(page.locator('text=Average Time to Complete')).toBeVisible();
            await expect(page.locator('text=Drop-off Points')).toBeVisible();

            // Check specific onboarding user
            await page.fill('input[name="userSearch"]', 'john.onboarding@example.com');
            await page.click('button:has-text("Search")');

            await expect(page.locator('text=Onboarding completed')).toBeVisible();
            await expect(page.locator('text=Organization created')).toBeVisible();
            await expect(page.locator('text=First project created')).toBeVisible();
        });
    });

    test.describe('Error Recovery', () => {
        test('should handle network errors during onboarding', async ({ page }) => {
            // Simulate network issues
            await page.route('**/api/**', route => route.abort());

            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Skip Tour")');

            await page.fill('input[name="orgName"]', 'Network Error Test');
            await page.fill('input[name="orgDomain"]', 'network-error-test.com');
            await page.click('button:has-text("Create Organization")');

            // Should show network error
            await expect(page.locator('text=Network error occurred')).toBeVisible();
            await expect(page.locator('button:has-text("Retry")')).toBeVisible();

            // Restore network and retry
            await page.unroute('**/api/**');
            await page.click('button:has-text("Retry")');

            await expect(page.locator('text=Organization created successfully!')).toBeVisible();
        });

        test('should allow resuming incomplete onboarding', async ({ page }) => {
            // Simulate partial completion (e.g., org created but project not)
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'john.onboarding@example.com');
            await page.fill('input[type="password"]', 'SecurePass123!');
            await page.click('button[type="submit"]');

            // Should detect incomplete onboarding and resume
            await expect(page.locator('text=Continue where you left off')).toBeVisible();
            await expect(page.locator('text=Create your first project')).toBeVisible();

            // Resume from project creation
            await page.click('button:has-text("Continue")');
            await expect(page.locator('text=Create your first project')).toBeVisible();
        });
    });

    test.describe('Accessibility', () => {
        test('should be keyboard navigable', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign Up');

            // Navigate through form with keyboard
            await page.keyboard.press('Tab'); // First name
            await page.keyboard.type('Accessible');
            await page.keyboard.press('Tab'); // Last name
            await page.keyboard.type('User');
            await page.keyboard.press('Tab'); // Email
            await page.keyboard.type('accessible@example.com');
            await page.keyboard.press('Tab'); // Password
            await page.keyboard.type('AccessiblePass123!');
            await page.keyboard.press('Tab'); // Confirm password
            await page.keyboard.type('AccessiblePass123!');
            await page.keyboard.press('Tab'); // Terms checkbox
            await page.keyboard.press('Space'); // Check terms
            await page.keyboard.press('Tab'); // Submit button
            await page.keyboard.press('Enter'); // Submit

            await expect(page.locator('text=Registration successful!')).toBeVisible();
        });

        test('should support screen readers', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign Up');

            // Check for proper ARIA labels
            await expect(page.locator('[aria-label="First name"]')).toBeVisible();
            await expect(page.locator('[aria-label="Last name"]')).toBeVisible();
            await expect(page.locator('[aria-label="Email address"]')).toBeVisible();
            await expect(page.locator('[aria-label="Password"]')).toBeVisible();
            await expect(page.locator('[aria-label="Confirm password"]')).toBeVisible();

            // Check for error announcements
            await page.click('button[type="submit"]');
            await expect(page.locator('[aria-live="assertive"]')).toContainText('First name is required');
        });
    });

    test.describe('Mobile Responsiveness', () => {
        test('should work on mobile devices', async ({ page, browser }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            await page.goto('/');
            await page.click('text=Sign Up');

            // Form should be usable on mobile
            await page.fill('input[name="firstName"]', 'Mobile');
            await page.fill('input[name="lastName"]', 'User');
            await page.fill('input[name="email"]', 'mobile@example.com');
            await page.fill('input[name="password"]', 'MobilePass123!');
            await page.fill('input[name="confirmPassword"]', 'MobilePass123!');
            await page.check('input[name="acceptTerms"]');

            await page.click('button[type="submit"]');

            await expect(page.locator('text=Registration successful!')).toBeVisible();
        });
    });
});














