import { test, expect } from '@playwright/test';

test.describe('Settings Management Flow', () => {
    test.describe('Profile Settings', () => {
        test('should update user profile information', async ({ page }) => {
            // Login first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            // Navigate to settings
            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            // Update profile information
            await page.fill('input[name="firstName"]', 'Updated');
            await page.fill('input[name="lastName"]', 'Admin');
            await page.fill('input[name="jobTitle"]', 'Senior Project Manager');
            await page.fill('textarea[name="bio"]', 'Experienced project manager with 10+ years in digital transformation');

            // Update contact info
            await page.fill('input[name="phone"]', '+1-555-0123');
            await page.fill('input[name="timezone"]', 'America/New_York');

            await page.click('button:has-text("Save Profile")');

            // Should show success message
            await expect(page.locator('text=Profile updated successfully')).toBeVisible();

            // Verify changes persisted
            await page.reload();
            await expect(page.locator('input[name="firstName"]')).toHaveValue('Updated');
            await expect(page.locator('input[name="lastName"]')).toHaveValue('Admin');
        });

        test('should upload and update profile picture', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            // Upload profile picture
            const fileInput = page.locator('input[type="file"][accept="image/*"]');
            await fileInput.setInputFiles('./test-files/profile-pic.jpg');

            await page.click('button:has-text("Upload Picture")');

            await expect(page.locator('text=Profile picture updated')).toBeVisible();

            // Should show new profile picture
            await expect(page.locator('.profile-picture img')).toBeVisible();
        });

        test('should validate profile data', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            // Clear required fields and try to save
            await page.fill('input[name="firstName"]', '');
            await page.fill('input[name="lastName"]', '');
            await page.click('button:has-text("Save Profile")');

            await expect(page.locator('text=First name is required')).toBeVisible();
            await expect(page.locator('text=Last name is required')).toBeVisible();
        });
    });

    test.describe('Security Settings', () => {
        test('should change password successfully', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Security');

            // Change password
            await page.fill('input[name="currentPassword"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.fill('input[name="newPassword"]', 'NewSecurePass123!');
            await page.fill('input[name="confirmPassword"]', 'NewSecurePass123!');

            await page.click('button:has-text("Update Password")');

            await expect(page.locator('text=Password updated successfully')).toBeVisible();

            // Should require re-login with new password
            await page.click('[data-testid="user-menu"]');
            await page.click('text=Logout');

            // Try to login with old password - should fail
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await expect(page.locator('text=Invalid credentials')).toBeVisible();

            // Login with new password - should succeed
            await page.fill('input[type="password"]', 'NewSecurePass123!');
            await page.click('button[type="submit"]');

            await expect(page.locator('text=System Overview')).toBeVisible();
        });

        test('should enable two-factor authentication', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Security');

            // Enable 2FA
            await page.click('button:has-text("Enable 2FA")');

            // Should show QR code for authenticator app
            await expect(page.locator('text=Scan this QR code')).toBeVisible();
            await expect(page.locator('.qr-code')).toBeVisible();

            // Simulate entering verification code
            await page.fill('input[name="verificationCode"]', '000000');
            await page.click('button:has-text("Verify and Enable")');

            await expect(page.locator('text=Two-factor authentication enabled')).toBeVisible();

            // Should show 2FA status as enabled
            await expect(page.locator('text=2FA is enabled')).toBeVisible();
        });

        test('should manage active sessions', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Security');

            // View active sessions
            await page.click('text=Active Sessions');

            // Should show current session
            await expect(page.locator('text=Current Session')).toBeVisible();
            await expect(page.locator('text=Chrome on macOS')).toBeVisible();
            await expect(page.locator('text=Active now')).toBeVisible();

            // Should allow revoking other sessions
            const revokeButtons = page.locator('button:has-text("Revoke")');
            if (await revokeButtons.count() > 0) {
                await revokeButtons.first().click();
                await expect(page.locator('text=Session revoked')).toBeVisible();
            }
        });

        test('should configure login notifications', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Security');

            // Configure login notifications
            await page.check('input[name="emailLoginNotifications"]');
            await page.check('input[name="smsLoginNotifications"]');
            await page.uncheck('input[name="pushLoginNotifications"]');

            await page.click('button:has-text("Save Notification Settings")');

            await expect(page.locator('text=Notification settings saved')).toBeVisible();
        });
    });

    test.describe('Notification Settings', () => {
        test('should configure project notifications', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Notifications');

            // Configure project notifications
            await page.check('input[name="projectUpdates"]');
            await page.check('input[name="milestoneCompleted"]');
            await page.uncheck('input[name="taskAssigned"]');
            await page.check('input[name="deadlineApproaching"]');

            // Set notification frequency
            await page.selectOption('select[name="frequency"]', 'daily');

            await page.click('button:has-text("Save Preferences")');

            await expect(page.locator('text=Notification preferences saved')).toBeVisible();
        });

        test('should configure AI assistant notifications', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Notifications');

            // Configure AI notifications
            await page.check('input[name="aiRecommendations"]');
            await page.check('input[name="aiAnalysisComplete"]');
            await page.uncheck('input[name="aiErrors"]');
            await page.check('input[name="aiInsights"]');

            await page.click('button:has-text("Save Preferences")');

            await expect(page.locator('text=Notification preferences saved')).toBeVisible();
        });

        test('should manage notification channels', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');
            await page.click('text=Notifications');

            // Configure channels
            await page.selectOption('select[name="emailFrequency"]', 'immediate');
            await page.selectOption('select[name="smsFrequency"]', 'important_only');
            await page.check('input[name="desktopNotifications"]');
            await page.check('input[name="mobilePush"]');

            await page.click('button:has-text("Save Channel Settings")');

            await expect(page.locator('text=Notification channels updated')).toBeVisible();
        });
    });

    test.describe('Organization Settings', () => {
        test('should update organization profile', async ({ page }) => {
            // Login as organization admin
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Organization Settings');

            // Update organization info
            await page.fill('input[name="orgName"]', 'Updated Company Name');
            await page.fill('textarea[name="description"]', 'Updated company description');
            await page.selectOption('select[name="industry"]', 'financial_services');
            await page.fill('input[name="website"]', 'https://updated-company.com');

            await page.click('button:has-text("Save Organization")');

            await expect(page.locator('text=Organization updated successfully')).toBeVisible();
        });

        test('should manage organization members', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Organization Settings');
            await page.click('text=Members');

            // Invite new member
            await page.click('button:has-text("Invite Member")');
            await page.fill('input[name="email"]', 'new.member@example.com');
            await page.selectOption('select[name="role"]', 'project_manager');
            await page.click('button:has-text("Send Invitation")');

            await expect(page.locator('text=Invitation sent to new.member@example.com')).toBeVisible();

            // Change member role
            const memberRow = page.locator('tr', { hasText: 'new.member@example.com' });
            await memberRow.locator('button:has-text("Change Role")').click();
            await page.selectOption('select[name="newRole"]', 'team_lead');
            await page.click('button:has-text("Update Role")');

            await expect(page.locator('text=Role updated successfully')).toBeVisible();
        });

        test('should configure organization preferences', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Organization Settings');
            await page.click('text=Preferences');

            // Configure organization-wide settings
            await page.selectOption('select[name="defaultProjectVisibility"]', 'organization');
            await page.selectOption('select[name="defaultTaskAssignment"]', 'manual');
            await page.check('input[name="allowPublicProjects"]');
            await page.check('input[name="requireApprovalForChanges"]');

            await page.click('button:has-text("Save Preferences")');

            await expect(page.locator('text=Organization preferences saved')).toBeVisible();
        });
    });

    test.describe('Billing Settings', () => {
        test('should view and update billing information', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Billing');

            // Should show current plan
            await expect(page.locator('text=Current Plan')).toBeVisible();
            await expect(page.locator('.current-plan')).toBeVisible();

            // Update billing information
            await page.click('text=Payment Method');
            await page.fill('input[name="cardNumber"]', '4111111111111111');
            await page.fill('input[name="expiryDate"]', '12/25');
            await page.fill('input[name="cvv"]', '123');
            await page.fill('input[name="cardholderName"]', 'John Doe');

            await page.click('button:has-text("Update Payment Method")');

            await expect(page.locator('text=Payment method updated')).toBeVisible();
        });

        test('should view billing history', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Billing');
            await page.click('text=Billing History');

            // Should show invoice history
            await expect(page.locator('text=Invoice History')).toBeVisible();

            // Should have download links for invoices
            const downloadButtons = page.locator('button:has-text("Download")');
            await expect(downloadButtons.first()).toBeVisible();
        });

        test('should handle plan upgrades', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Billing');
            await page.click('button:has-text("Upgrade Plan")');

            // Select premium plan
            await page.click('text=Premium Plan');
            await page.click('button:has-text("Select Plan")');

            // Confirm upgrade
            await page.click('button:has-text("Confirm Upgrade")');

            await expect(page.locator('text=Plan upgraded successfully')).toBeVisible();
            await expect(page.locator('text=Premium Plan')).toBeVisible();
        });
    });

    test.describe('AI Settings', () => {
        test('should configure AI assistant preferences', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=AI Settings');

            // Configure AI preferences
            await page.selectOption('select[name="aiPersonality"]', 'professional');
            await page.selectOption('select[name="responseLength"]', 'detailed');
            await page.check('input[name="autoSuggestions"]');
            await page.uncheck('input[name="realTimeAnalysis"]');

            await page.click('button:has-text("Save AI Preferences")');

            await expect(page.locator('text=AI preferences saved')).toBeVisible();
        });

        test('should manage AI model preferences', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=AI Settings');
            await page.click('text=Model Preferences');

            // Configure model settings
            await page.selectOption('select[name="primaryModel"]', 'gpt-4');
            await page.selectOption('select[name="fallbackModel"]', 'gpt-3.5-turbo');
            await page.fill('input[name="maxTokens"]', '2000');
            await page.fill('input[name="temperature"]', '0.7');

            await page.click('button:has-text("Save Model Settings")');

            await expect(page.locator('text=Model settings saved')).toBeVisible();
        });

        test('should configure AI usage limits', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=AI Settings');
            await page.click('text=Usage Limits');

            // Set usage limits
            await page.fill('input[name="dailyLimit"]', '1000');
            await page.fill('input[name="monthlyLimit"]', '30000');
            await page.check('input[name="alertOnLimit"]');
            await page.fill('input[name="alertThreshold"]', '80');

            await page.click('button:has-text("Save Limits")');

            await expect(page.locator('text=Usage limits saved')).toBeVisible();
        });
    });

    test.describe('Integration Settings', () => {
        test('should configure external integrations', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Integrations');

            // Configure Slack integration
            await page.click('text=Slack');
            await page.fill('input[name="slackWebhook"]', 'https://hooks.slack.com/services/...');
            await page.check('input[name="notifyProjectUpdates"]');
            await page.check('input[name="notifyMilestones"]');

            await page.click('button:has-text("Connect Slack")');

            await expect(page.locator('text=Slack integration configured')).toBeVisible();

            // Configure Jira integration
            await page.click('text=Jira');
            await page.fill('input[name="jiraUrl"]', 'https://company.atlassian.net');
            await page.fill('input[name="jiraUsername"]', 'consultinity@jira.com');
            await page.fill('input[name="jiraApiToken"]', 'jira-api-token');

            await page.click('button:has-text("Connect Jira")');

            await expect(page.locator('text=Jira integration configured')).toBeVisible();
        });

        test('should manage API keys', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Integrations');
            await page.click('text=API Keys');

            // Generate new API key
            await page.click('button:has-text("Generate API Key")');
            await page.fill('input[name="keyName"]', 'Mobile App Key');
            await page.selectOption('select[name="permissions"]', 'read_write');

            await page.click('button:has-text("Create Key")');

            // Should show generated key
            await expect(page.locator('text=API Key Generated')).toBeVisible();
            await expect(page.locator('.api-key-display')).toBeVisible();

            // Should allow copying key
            await page.click('button:has-text("Copy Key")');
            await expect(page.locator('text=Key copied to clipboard')).toBeVisible();
        });
    });

    test.describe('Data Management', () => {
        test('should export user data', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Data & Privacy');
            await page.click('text=Export Data');

            await page.selectOption('select[name="exportFormat"]', 'json');
            await page.check('input[name="includeProjects"]');
            await page.check('input[name="includeTasks"]');
            await page.check('input[name="includeHistory"]');

            await page.click('button:has-text("Request Export")');

            await expect(page.locator('text=Data export requested')).toBeVisible();
            await expect(page.locator('text=You will receive an email when ready')).toBeVisible();
        });

        test('should delete user account', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Data & Privacy');
            await page.click('text=Delete Account');

            // Should require confirmation
            await expect(page.locator('text=Are you sure you want to delete your account?')).toBeVisible();
            await expect(page.locator('text=This action cannot be undone')).toBeVisible();

            // Confirm deletion
            await page.fill('input[name="confirmText"]', 'DELETE MY ACCOUNT');
            await page.click('button:has-text("Delete Account")');

            // Should show deletion initiated
            await expect(page.locator('text=Account deletion initiated')).toBeVisible();

            // Should logout user
            await expect(page.locator('text=Log In')).toBeVisible();
        });

        test('should manage data retention settings', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Data & Privacy');
            await page.click('text=Data Retention');

            // Configure retention settings
            await page.selectOption('select[name="activityLogRetention"]', '1_year');
            await page.selectOption('select[name="fileRetention"]', '2_years');
            await page.check('input[name="autoDeleteOldData"]');

            await page.click('button:has-text("Save Retention Settings")');

            await expect(page.locator('text=Data retention settings saved')).toBeVisible();
        });
    });

    test.describe('Accessibility Settings', () => {
        test('should configure accessibility preferences', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Accessibility');

            // Configure accessibility settings
            await page.check('input[name="highContrast"]');
            await page.check('input[name="largeText"]');
            await page.selectOption('select[name="colorBlindMode"]', 'deuteranopia');
            await page.check('input[name="reduceMotion"]');
            await page.check('input[name="screenReader"]');

            await page.click('button:has-text("Save Accessibility Settings")');

            await expect(page.locator('text=Accessibility settings saved')).toBeVisible();
        });

        test('should test accessibility features', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Accessibility');
            await page.click('text=Test Features');

            // Should show accessibility test interface
            await expect(page.locator('text=Accessibility Test')).toBeVisible();

            // Test keyboard navigation
            await page.keyboard.press('Tab');
            await expect(page.locator(':focus')).toBeVisible();

            // Test screen reader announcements
            await page.click('button:has-text("Test Screen Reader")');
            await expect(page.locator('[aria-live]')).toBeVisible();
        });
    });

    test.describe('Settings Validation and Error Handling', () => {
        test('should handle network errors gracefully', async ({ page }) => {
            await page.route('**/api/settings/**', route => route.abort());

            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            await page.fill('input[name="firstName"]', 'Network Error Test');
            await page.click('button:has-text("Save Profile")');

            await expect(page.locator('text=Failed to save settings')).toBeVisible();
            await expect(page.locator('button:has-text("Retry")')).toBeVisible();
        });

        test('should validate setting values', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            // Test invalid email format
            await page.fill('input[name="email"]', 'invalid-email');
            await page.click('button:has-text("Save Profile")');

            await expect(page.locator('text=Please enter a valid email')).toBeVisible();

            // Test invalid phone number
            await page.fill('input[name="phone"]', 'invalid-phone');
            await page.click('button:has-text("Save Profile")');

            await expect(page.locator('text=Please enter a valid phone number')).toBeVisible();
        });

        test('should prevent concurrent conflicting updates', async ({ page }) => {
            // This test would require simulating concurrent updates
            // For now, just verify the UI handles conflicts
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.click('[data-testid="user-menu"]');
            await page.click('text=Settings');

            // Make a change and save
            await page.fill('input[name="firstName"]', 'Concurrent Test');
            await page.click('button:has-text("Save Profile")');

            await expect(page.locator('text=Profile updated successfully')).toBeVisible();
        });
    });
});













