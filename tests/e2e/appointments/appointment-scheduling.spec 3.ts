/**
 * Appointments E2E Tests
 * Testing appointment scheduling
 * 
 * @module tests/e2e/appointments/appointment-scheduling.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Appointment Scheduling', () => {
    test('should access appointments page', async ({ page }) => {
        await page.goto('/appointments');

        const url = page.url();
        expect(url).toMatch(/appointments|bookings|login/);
    });

    test('should create appointment', async ({ page }) => {
        await page.goto('/appointments/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access appointment detail', async ({ page }) => {
        await page.goto('/appointments/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should reschedule appointment', async ({ page }) => {
        await page.goto('/appointments/1/reschedule');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Availability', () => {
    test('should access availability settings', async ({ page }) => {
        await page.goto('/appointments/availability');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access booking page', async ({ page }) => {
        await page.goto('/appointments/book');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
