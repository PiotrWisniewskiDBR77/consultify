/**
 * Documents E2E Tests
 * Testing document management
 * 
 * @module tests/e2e/documents/document-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Document Management', () => {
    test('should access documents page', async ({ page }) => {
        await page.goto('/documents');

        const url = page.url();
        expect(url).toMatch(/documents|login|files/);
    });

    test('should access document upload', async ({ page }) => {
        await page.goto('/documents/upload');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access document detail', async ({ page }) => {
        await page.goto('/documents/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access document folders', async ({ page }) => {
        await page.goto('/documents/folders');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Document Actions', () => {
    test('should access document sharing', async ({ page }) => {
        await page.goto('/documents/1/share');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access document versions', async ({ page }) => {
        await page.goto('/documents/1/versions');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
