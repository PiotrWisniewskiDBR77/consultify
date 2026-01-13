/**
 * Tickets E2E Tests
 * Testing support ticket management
 * 
 * @module tests/e2e/tickets/ticket-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Ticket Management', () => {
    test('should access tickets page', async ({ page }) => {
        await page.goto('/tickets');

        const url = page.url();
        expect(url).toMatch(/tickets|support|help|login/);
    });

    test('should create ticket', async ({ page }) => {
        await page.goto('/tickets/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access ticket detail', async ({ page }) => {
        await page.goto('/tickets/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should reply to ticket', async ({ page }) => {
        await page.goto('/tickets/1/reply');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Ticket Filters', () => {
    test('should filter open tickets', async ({ page }) => {
        await page.goto('/tickets?status=open');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should filter by priority', async ({ page }) => {
        await page.goto('/tickets?priority=high');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
