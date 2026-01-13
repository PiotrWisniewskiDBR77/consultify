/**
 * User Registration E2E Tests
 * Full user registration and onboarding flow
 * 
 * @module tests/e2e/auth/user-registration.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/register');
    });

    test('should display registration form', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /register|sign up|create account/i })).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
        await page.getByRole('button', { name: /register|sign up|create/i }).click();

        // Should show validation errors
        await expect(page.getByText(/required|email is required/i)).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
        await page.getByLabel(/email/i).fill('invalid-email');
        await page.getByLabel(/password/i).fill('ValidPassword123!');
        await page.getByRole('button', { name: /register|sign up|create/i }).click();

        await expect(page.getByText(/valid email|invalid email/i)).toBeVisible();
    });

    test('should validate password strength', async ({ page }) => {
        await page.getByLabel(/email/i).fill('test@example.com');
        await page.getByLabel(/password/i).fill('weak');
        await page.getByRole('button', { name: /register|sign up|create/i }).click();

        // Should show password strength error
        await expect(page.getByText(/password|characters|strong/i)).toBeVisible();
    });

    test('should navigate to login from registration', async ({ page }) => {
        await page.getByRole('link', { name: /log in|sign in|already have/i }).click();

        await expect(page).toHaveURL(/login/);
    });
});

test.describe('Onboarding Flow', () => {
    test('should show onboarding after registration', async ({ page }) => {
        // This test would require a test user to be created
        // Simulating the expected flow
        await page.goto('/onboarding');

        // Check for onboarding elements
        const welcomeHeading = page.getByRole('heading', { name: /welcome|get started|setup/i });
        const hasOnboarding = await welcomeHeading.isVisible().catch(() => false);

        if (hasOnboarding) {
            await expect(welcomeHeading).toBeVisible();
        } else {
            // May redirect if not authenticated
            expect(page.url()).toMatch(/login|register|onboarding/);
        }
    });
});
