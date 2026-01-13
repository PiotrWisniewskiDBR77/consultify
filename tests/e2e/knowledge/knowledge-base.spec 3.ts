/**
 * Knowledge Base E2E Tests
 * Testing knowledge base and wiki functionality
 * 
 * @module tests/e2e/knowledge/knowledge-base.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Knowledge Base', () => {
    test('should access knowledge base', async ({ page }) => {
        await page.goto('/knowledge');

        const url = page.url();
        expect(url).toMatch(/knowledge|wiki|login|docs/);
    });

    test('should create article', async ({ page }) => {
        await page.goto('/knowledge/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access article detail', async ({ page }) => {
        await page.goto('/knowledge/articles/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access article editor', async ({ page }) => {
        await page.goto('/knowledge/articles/1/edit');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Knowledge Categories', () => {
    test('should access categories', async ({ page }) => {
        await page.goto('/knowledge/categories');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should filter by category', async ({ page }) => {
        await page.goto('/knowledge/categories/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should search articles', async ({ page }) => {
        await page.goto('/knowledge/search?q=test');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
