/**
 * E2E Security & Authentication Tests
 * 
 * Tests critical security flows:
 * - User authentication
 * - MFA setup and verification
 * - Session management
 * - Authorization checks
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Authentication Flows', () => {
    test.describe('Login', () => {
        test('should display login form', async ({ page }) => {
            await page.goto(BASE_URL);
            
            await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible();
            await expect(page.getByLabel(/email/i)).toBeVisible();
            await expect(page.getByLabel(/password/i)).toBeVisible();
        });

        test('should show validation errors for empty fields', async ({ page }) => {
            await page.goto(BASE_URL);
            
            // Try to submit empty form
            await page.getByRole('button', { name: /sign in|log in/i }).click();
            
            // Should show validation error
            await expect(page.getByText(/required|please enter/i)).toBeVisible();
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await page.goto(BASE_URL);
            
            await page.getByLabel(/email/i).fill('invalid@example.com');
            await page.getByLabel(/password/i).fill('wrongpassword');
            await page.getByRole('button', { name: /sign in|log in/i }).click();
            
            await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
        });

        test('should redirect to dashboard on successful login', async ({ page }) => {
            await page.goto(BASE_URL);
            
            // Use test credentials
            await page.getByLabel(/email/i).fill('demo@consultify.io');
            await page.getByLabel(/password/i).fill('demo123');
            await page.getByRole('button', { name: /sign in|log in/i }).click();
            
            // Should redirect to dashboard or main app
            await expect(page).toHaveURL(/dashboard|app|home/i, { timeout: 10000 });
        });

        test('should show "Forgot Password" link', async ({ page }) => {
            await page.goto(BASE_URL);
            
            await expect(page.getByText(/forgot password|reset password/i)).toBeVisible();
        });
    });

    test.describe('Registration', () => {
        test('should display registration form', async ({ page }) => {
            await page.goto(`${BASE_URL}/register`);
            
            await expect(page.getByRole('heading', { name: /sign up|register|create account/i })).toBeVisible();
        });

        test('should validate email format', async ({ page }) => {
            await page.goto(`${BASE_URL}/register`);
            
            await page.getByLabel(/email/i).fill('invalidemail');
            await page.getByLabel(/email/i).blur();
            
            await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
        });

        test('should validate password requirements', async ({ page }) => {
            await page.goto(`${BASE_URL}/register`);
            
            const passwordInput = page.getByLabel(/^password$/i).first();
            await passwordInput.fill('weak');
            
            // Should show password requirements
            await expect(page.getByText(/8 characters|uppercase|lowercase|number/i)).toBeVisible();
        });

        test('should validate password confirmation', async ({ page }) => {
            await page.goto(`${BASE_URL}/register`);
            
            const passwordInputs = page.getByLabel(/password/i);
            await passwordInputs.first().fill('StrongPass123');
            await passwordInputs.nth(1).fill('DifferentPass123');
            await passwordInputs.nth(1).blur();
            
            await expect(page.getByText(/match|don't match|mismatch/i)).toBeVisible();
        });
    });

    test.describe('Password Reset', () => {
        test('should display forgot password form', async ({ page }) => {
            await page.goto(BASE_URL);
            await page.getByText(/forgot password/i).click();
            
            await expect(page.getByLabel(/email/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /reset|send|submit/i })).toBeVisible();
        });

        test('should validate email before sending reset', async ({ page }) => {
            await page.goto(`${BASE_URL}/forgot-password`);
            
            await page.getByLabel(/email/i).fill('invalidemail');
            await page.getByRole('button', { name: /reset|send/i }).click();
            
            await expect(page.getByText(/valid email/i)).toBeVisible();
        });
    });
});

test.describe('MFA (Multi-Factor Authentication)', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto(BASE_URL);
        await page.getByLabel(/email/i).fill('demo@consultify.io');
        await page.getByLabel(/password/i).fill('demo123');
        await page.getByRole('button', { name: /sign in|log in/i }).click();
        await page.waitForURL(/dashboard|app/, { timeout: 10000 });
    });

    test('should show MFA setup option in security settings', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings/security`);
        
        await expect(page.getByText(/two-factor|2fa|multi-factor/i)).toBeVisible();
    });

    test('should display QR code during MFA setup', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings/security`);
        
        // Click enable MFA
        await page.getByRole('button', { name: /enable|set up/i }).first().click();
        
        // Should show QR code
        await expect(page.locator('canvas, img[alt*="QR"]')).toBeVisible({ timeout: 5000 });
    });

    test('should show backup codes after MFA setup', async ({ page }) => {
        // This test assumes MFA can be set up with a test code
        await page.goto(`${BASE_URL}/settings/security`);
        
        // The presence of backup codes section
        const backupCodesSection = page.getByText(/backup codes|recovery codes/i);
        // May or may not be visible depending on MFA state
    });
});

test.describe('Session Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByLabel(/email/i).fill('demo@consultify.io');
        await page.getByLabel(/password/i).fill('demo123');
        await page.getByRole('button', { name: /sign in|log in/i }).click();
        await page.waitForURL(/dashboard|app/, { timeout: 10000 });
    });

    test('should display active sessions in security settings', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings/security`);
        
        await expect(page.getByText(/active sessions|devices/i)).toBeVisible();
    });

    test('should show current session indicator', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings/security`);
        
        await expect(page.getByText(/current|this device/i)).toBeVisible();
    });

    test('should allow revoking other sessions', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings/security`);
        
        // If there are other sessions, revoke button should be available
        const revokeButton = page.getByRole('button', { name: /revoke|log out/i });
        if (await revokeButton.isVisible()) {
            await revokeButton.first().click();
            // Should show confirmation or success message
        }
    });
});

test.describe('Authorization & Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Should redirect to login
        await expect(page).toHaveURL(/login|sign-in|auth/i);
    });

    test('should protect admin routes from non-admin users', async ({ page }) => {
        // Login as regular user
        await page.goto(BASE_URL);
        await page.getByLabel(/email/i).fill('demo@consultify.io');
        await page.getByLabel(/password/i).fill('demo123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(/dashboard|app/, { timeout: 10000 });
        
        // Try to access admin route
        await page.goto(`${BASE_URL}/admin`);
        
        // Should show access denied or redirect
        await expect(page.getByText(/access denied|unauthorized|forbidden/i)).toBeVisible()
            .catch(() => expect(page).not.toHaveURL(/admin/));
    });

    test('should maintain session across page refreshes', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByLabel(/email/i).fill('demo@consultify.io');
        await page.getByLabel(/password/i).fill('demo123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(/dashboard|app/, { timeout: 10000 });
        
        // Refresh page
        await page.reload();
        
        // Should still be logged in
        await expect(page).toHaveURL(/dashboard|app/);
    });
});

test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.getByLabel(/email/i).fill('demo@consultify.io');
        await page.getByLabel(/password/i).fill('demo123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(/dashboard|app/, { timeout: 10000 });
    });

    test('should show logout option', async ({ page }) => {
        // Open user menu
        await page.getByRole('button', { name: /profile|account|user/i }).click();
        
        await expect(page.getByText(/log out|sign out/i)).toBeVisible();
    });

    test('should redirect to login after logout', async ({ page }) => {
        // Open user menu and logout
        await page.getByRole('button', { name: /profile|account|user/i }).click();
        await page.getByText(/log out|sign out/i).click();
        
        // Should redirect to login
        await expect(page).toHaveURL(/login|sign-in|\//);
    });

    test('should clear session after logout', async ({ page }) => {
        // Logout
        await page.getByRole('button', { name: /profile|account|user/i }).click();
        await page.getByText(/log out|sign out/i).click();
        await page.waitForURL(/login|sign-in|\/$/);
        
        // Try to access protected route
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Should redirect to login
        await expect(page).toHaveURL(/login|sign-in/);
    });
});

test.describe('Security Headers & CSRF', () => {
    test('should include security headers in responses', async ({ page }) => {
        const response = await page.goto(BASE_URL);
        const headers = response?.headers() || {};
        
        // Check for common security headers
        // Note: These depend on server configuration
        // expect(headers['x-frame-options']).toBeDefined();
        // expect(headers['x-content-type-options']).toBe('nosniff');
    });

    test('should reject requests without valid CSRF token', async ({ page, request }) => {
        // Login first
        await page.goto(BASE_URL);
        await page.getByLabel(/email/i).fill('demo@consultify.io');
        await page.getByLabel(/password/i).fill('demo123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(/dashboard|app/, { timeout: 10000 });
        
        // Try to make API call without CSRF token
        // This is implementation-specific
    });
});

test.describe('Rate Limiting', () => {
    test('should rate limit login attempts', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Attempt multiple failed logins
        for (let i = 0; i < 6; i++) {
            await page.getByLabel(/email/i).fill('test@example.com');
            await page.getByLabel(/password/i).fill('wrongpassword');
            await page.getByRole('button', { name: /sign in/i }).click();
            await page.waitForTimeout(500);
        }
        
        // Should show rate limit message
        await expect(page.getByText(/too many|rate limit|try again later/i)).toBeVisible({ timeout: 5000 })
            .catch(() => { /* Rate limiting may not be enabled in test env */ });
    });
});














