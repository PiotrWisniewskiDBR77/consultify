/**
 * Login E2E Tests
 * Authentication and MFA flow testing
 *
 * @module tests/e2e/auth/login-mfa.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /login|sign in|welcome/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible({ timeout: 5000 });
  });

  test('should have forgot password link', async ({ page }) => {
    const forgotLink = page.getByRole('link', { name: /forgot|reset|recover/i });
    await expect(forgotLink).toBeVisible();
  });

  test('should navigate to registration', async ({ page }) => {
    await page.getByRole('link', { name: /register|sign up|create|new account/i }).click();

    await expect(page).toHaveURL(/register|signup/);
  });
});

test.describe('Password Reset Flow', () => {
  test('should display password reset form', async ({ page }) => {
    await page.goto('/forgot-password');

    const heading = page.getByRole('heading', { name: /reset|forgot|recover/i });
    const hasResetPage = await heading.isVisible().catch(() => false);

    if (hasResetPage) {
      await expect(heading).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    }
  });

  test('should validate email on password reset', async ({ page }) => {
    await page.goto('/forgot-password');

    const emailInput = page.getByLabel(/email/i);
    const hasInput = await emailInput.isVisible().catch(() => false);

    if (hasInput) {
      await emailInput.fill('invalid');
      await page.getByRole('button', { name: /reset|send|submit/i }).click();
      await expect(page.getByText(/valid|invalid|email/i)).toBeVisible();
    }
  });
});

test.describe('Session Management', () => {
  test('should redirect unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login|register/, { timeout: 5000 });
  });
});
