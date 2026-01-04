/**
 * Economics Module E2E Tests
 * 
 * End-to-end tests for the complete Economics module workflow
 * 
 * Prerequisites:
 * - Test database with migrations applied
 * - Test user with economics permissions
 * - Server running on test port
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TEST_USER = {
    email: process.env.E2E_TEST_EMAIL || 'test@example.com',
    password: process.env.E2E_TEST_PASSWORD || 'testpassword123',
};

// Helper function to login
async function login(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
}

// Helper function to navigate to Economics module
async function navigateToEconomics(page: Page) {
    await page.click('a[href="/economics"]');
    await page.waitForURL('**/economics');
}

test.describe('Economics Module E2E', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await navigateToEconomics(page);
    });

    test.describe('Analysis Catalog', () => {
        test('should display the analysis catalog', async ({ page }) => {
            await expect(page.locator('h1, h2').filter({ hasText: /ekonomia|economics/i })).toBeVisible();
            await expect(page.locator('text=Wszystkie analizy')).toBeVisible();
        });

        test('should show statistics cards', async ({ page }) => {
            await expect(page.locator('text=Ukończone')).toBeVisible();
            await expect(page.locator('text=W trakcie')).toBeVisible();
            await expect(page.locator('text=Średni wynik')).toBeVisible();
        });

        test('should switch between grid and table view', async ({ page }) => {
            // Click table view button
            await page.click('button[aria-label="Table view"], button:has-text("Lista")');
            await expect(page.locator('table')).toBeVisible();

            // Click grid view button
            await page.click('button[aria-label="Grid view"], button:has-text("Siatka")');
            await expect(page.locator('.grid')).toBeVisible();
        });

        test('should filter analyses by status', async ({ page }) => {
            await page.selectOption('select', 'completed');
            await page.waitForResponse('**/api/economics/analyses*');
            
            // Verify URL or request contains status filter
            expect(page.url()).toContain('status=completed');
        });

        test('should search analyses', async ({ page }) => {
            await page.fill('input[placeholder*="Szukaj"]', 'test');
            await page.waitForTimeout(500); // Debounce
            await page.waitForResponse('**/api/economics/analyses*');
        });
    });

    test.describe('Create Analysis', () => {
        test('should open create modal', async ({ page }) => {
            await page.click('button:has-text("Nowa analiza")');
            await expect(page.locator('text=Nowa analiza')).toBeVisible();
        });

        test('should create a new analysis', async ({ page }) => {
            await page.click('button:has-text("Nowa analiza")');
            
            await page.fill('input[name="name"], input[placeholder*="Nazwa"]', 'E2E Test Analysis');
            await page.fill('textarea[name="description"], textarea[placeholder*="Opis"]', 'Created by E2E test');
            
            await page.click('button:has-text("Utwórz")');
            
            await expect(page.locator('text=E2E Test Analysis')).toBeVisible();
        });

        test('should validate required fields', async ({ page }) => {
            await page.click('button:has-text("Nowa analiza")');
            await page.click('button:has-text("Utwórz")');
            
            // Should show validation error
            await expect(page.locator('text=wymagane, text=required')).toBeVisible();
        });
    });

    test.describe('Analysis Detail', () => {
        test.beforeEach(async ({ page }) => {
            // Click on first analysis card
            await page.click('.analysis-card, [data-testid="analysis-card"]:first-child');
            await page.waitForTimeout(500);
        });

        test('should display analysis details', async ({ page }) => {
            await expect(page.locator('text=Ocena')).toBeVisible();
            await expect(page.locator('text=Postęp')).toBeVisible();
        });

        test('should show axis list', async ({ page }) => {
            await expect(page.locator('text=Procesy cyfrowe')).toBeVisible();
            await expect(page.locator('text=Produkty cyfrowe')).toBeVisible();
        });

        test('should switch between tabs', async ({ page }) => {
            // Click on Tool tab
            await page.click('button:has-text("Narzędzie")');
            await expect(page.locator('text=Osie oceny')).toBeVisible();

            // Click on Results tab
            await page.click('button:has-text("Wyniki")');
            await expect(page.locator('text=Wynik ogólny')).toBeVisible();
        });
    });

    test.describe('Scoring', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('.analysis-card:first-child');
            await page.click('button:has-text("Narzędzie")');
        });

        test('should expand area on click', async ({ page }) => {
            await page.click('.area-header:first-child');
            await expect(page.locator('text=Poziom aktualny')).toBeVisible();
            await expect(page.locator('text=Poziom docelowy')).toBeVisible();
        });

        test('should select current level', async ({ page }) => {
            await page.click('.area-header:first-child');
            await page.click('button:has-text("3")');
            
            // Save button should appear
            await expect(page.locator('button:has-text("Zapisz")')).toBeVisible();
        });

        test('should save score changes', async ({ page }) => {
            await page.click('.area-header:first-child');
            await page.click('button:has-text("3")');
            
            await page.click('button:has-text("Zapisz")');
            await page.waitForResponse('**/api/economics/analyses/*/scores');
            
            // Should show success message
            await expect(page.locator('.toast-success, text=Zapisano')).toBeVisible();
        });
    });

    test.describe('Keyboard Shortcuts', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('.analysis-card:first-child');
            await page.click('button:has-text("Narzędzie")');
        });

        test('should show keyboard help on ? press', async ({ page }) => {
            await page.keyboard.press('?');
            await expect(page.locator('text=Skróty klawiszowe')).toBeVisible();
        });

        test('should navigate axes with arrow keys', async ({ page }) => {
            const initialAxis = await page.locator('.axis-item.selected').textContent();
            await page.keyboard.press('ArrowDown');
            const newAxis = await page.locator('.axis-item.selected').textContent();
            expect(newAxis).not.toBe(initialAxis);
        });

        test('should save with Ctrl+S', async ({ page }) => {
            // Make a change first
            await page.click('.area-header:first-child');
            await page.click('button:has-text("4")');
            
            // Save with keyboard
            await page.keyboard.press('Control+s');
            await page.waitForResponse('**/api/economics/analyses/*/scores');
        });
    });

    test.describe('Versioning', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('.analysis-card:first-child');
        });

        test('should create a version', async ({ page }) => {
            await page.click('button:has-text("Zapisz wersję")');
            
            await page.fill('input[name="versionName"]', 'Test Version');
            await page.click('button:has-text("Utwórz")');
            
            await page.waitForResponse('**/api/economics/analyses/*/versions');
            await expect(page.locator('.toast-success')).toBeVisible();
        });

        test('should show version history', async ({ page }) => {
            await page.click('button:has-text("Historia wersji")');
            await expect(page.locator('text=Historia wersji')).toBeVisible();
        });

        test('should compare versions', async ({ page }) => {
            await page.click('button:has-text("Historia wersji")');
            await page.click('button[aria-label="Compare"]');
            await expect(page.locator('text=Porównanie wersji')).toBeVisible();
        });
    });

    test.describe('Evidence', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('.analysis-card:first-child');
            await page.click('button:has-text("Narzędzie")');
            await page.click('.area-header:first-child');
        });

        test('should open evidence panel', async ({ page }) => {
            await page.click('button:has-text("Dodaj dowód")');
            await expect(page.locator('text=Zarządzaj dowodami')).toBeVisible();
        });

        test('should add link evidence', async ({ page }) => {
            await page.click('button:has-text("Dodaj dowód")');
            
            await page.selectOption('select[name="evidenceType"]', 'link');
            await page.fill('input[name="title"]', 'Test Evidence');
            await page.fill('textarea[name="content"]', 'https://example.com');
            
            await page.click('button:has-text("Dodaj")');
            await page.waitForResponse('**/api/economics/scores/*/evidence');
            
            await expect(page.locator('text=Test Evidence')).toBeVisible();
        });
    });

    test.describe('Export', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('.analysis-card:first-child');
        });

        test('should open PDF export modal', async ({ page }) => {
            await page.click('button:has-text("Eksportuj PDF")');
            await expect(page.locator('text=Eksportuj do PDF')).toBeVisible();
        });

        test('should select export template', async ({ page }) => {
            await page.click('button:has-text("Eksportuj PDF")');
            await page.selectOption('select[name="template"]', 'full');
            await expect(page.locator('option[value="full"]')).toBeChecked();
        });

        test('should export to PDF', async ({ page }) => {
            await page.click('button:has-text("Eksportuj PDF")');
            
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('button:has-text("Generuj PDF")'),
            ]);
            
            expect(download.suggestedFilename()).toContain('.pdf');
        });

        test('should export to Excel', async ({ page }) => {
            await page.click('button:has-text("Eksportuj Excel")');
            
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.waitForResponse('**/api/economics/analyses/*/export'),
            ]);
            
            expect(download.suggestedFilename()).toContain('.xlsx');
        });
    });

    test.describe('Comparison', () => {
        test('should enable compare mode', async ({ page }) => {
            // Select multiple analyses
            await page.click('input[type="checkbox"]:first-child');
            await page.click('input[type="checkbox"]:nth-child(2)');
            
            await expect(page.locator('button:has-text("Porównaj")')).toBeVisible();
        });

        test('should open comparison view', async ({ page }) => {
            await page.click('input[type="checkbox"]:first-child');
            await page.click('input[type="checkbox"]:nth-child(2)');
            
            await page.click('button:has-text("Porównaj")');
            await expect(page.locator('text=Porównanie analiz')).toBeVisible();
        });

        test('should show radar chart comparison', async ({ page }) => {
            await page.click('input[type="checkbox"]:first-child');
            await page.click('input[type="checkbox"]:nth-child(2)');
            await page.click('button:has-text("Porównaj")');
            
            await page.click('button:has-text("Radar")');
            await expect(page.locator('svg.radar-chart')).toBeVisible();
        });
    });

    test.describe('Bulk Operations', () => {
        test('should show bulk toolbar when items selected', async ({ page }) => {
            await page.click('input[type="checkbox"]:first-child');
            await expect(page.locator('text=wybrana')).toBeVisible();
        });

        test('should bulk delete analyses', async ({ page }) => {
            await page.click('input[type="checkbox"]:first-child');
            
            page.on('dialog', dialog => dialog.accept());
            await page.click('button:has-text("Usuń")');
            
            await page.waitForResponse('**/api/economics/analyses/*');
        });

        test('should bulk change status', async ({ page }) => {
            await page.click('input[type="checkbox"]:first-child');
            
            await page.hover('button:has-text("Zmień status")');
            await page.click('button:has-text("Ukończone")');
            
            await page.waitForResponse('**/api/economics/analyses/*');
        });

        test('should clear selection', async ({ page }) => {
            await page.click('input[type="checkbox"]:first-child');
            await page.click('button[aria-label="Clear selection"]');
            
            await expect(page.locator('text=wybrana')).not.toBeVisible();
        });
    });

    test.describe('Error Handling', () => {
        test('should show error on failed API request', async ({ page }) => {
            // Intercept and fail request
            await page.route('**/api/economics/analyses', route => 
                route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
            );
            
            await page.reload();
            await expect(page.locator('.toast-error, text=Błąd')).toBeVisible();
        });

        test('should handle network timeout gracefully', async ({ page }) => {
            await page.route('**/api/economics/analyses', async route => {
                await new Promise(resolve => setTimeout(resolve, 30000));
                route.abort();
            });
            
            await page.reload();
            await expect(page.locator('.loading, text=Ładowanie')).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Responsive Design', () => {
        test('should work on mobile viewport', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            
            await expect(page.locator('.analysis-card')).toBeVisible();
            // Sidebar should be collapsed
            await expect(page.locator('.sidebar')).not.toBeVisible();
        });

        test('should work on tablet viewport', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            
            await expect(page.locator('.analysis-card')).toBeVisible();
        });
    });

    test.describe('Print Preview', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('.analysis-card:first-child');
            await page.click('button:has-text("Wyniki")');
        });

        test('should apply print styles', async ({ page }) => {
            await page.emulateMedia({ media: 'print' });
            
            // Check that no-print elements are hidden
            await expect(page.locator('.no-print')).toBeHidden();
            await expect(page.locator('.sidebar')).toBeHidden();
        });
    });
});











