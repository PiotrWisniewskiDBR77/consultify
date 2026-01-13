import { expect, test } from '@playwright/test';

/**
 * E2E Test: Partner Program Flow
 *
 * Verifies the partner program integration on the landing page
 * and the partner recruitment page experience.
 */

test.describe('Partner Program Flow', () => {
    test('should display 6-card grid on landing page with Become Partner card', async ({ page }) => {
        // Navigate to landing page
        await page.goto('/');

        // Wait for the page to load
        await page.waitForSelector('h1', { timeout: 10000 });

        // Verify hero section exists
        const heroHeading = await page.textContent('h1');
        expect(heroHeading).toContain('Decyzje strategiczne');

        // Verify 6-card grid exists
        const cardGrid = await page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
        await expect(cardGrid).toBeVisible();

        // Verify "Become Partner" card exists and is clickable
        const becomePartnerCard = await page.getByText('Become Partner');
        await expect(becomePartnerCard).toBeVisible();

        // Verify other cards are present
        await expect(page.getByText('Explore Demo')).toBeVisible();
        await expect(page.getByText('Start Free Trial')).toBeVisible();
        await expect(page.getByText('How It Works')).toBeVisible();
        await expect(page.getByText('Talk to Expert')).toBeVisible();
        await expect(page.getByText('Just decisions')).toBeVisible();
    });

    test('should navigate to partner page when clicking Become Partner card', async ({ page }) => {
        // Navigate to landing page
        await page.goto('/');

        // Wait for page load
        await page.waitForSelector('h1', { timeout: 10000 });

        // Click on "Become Partner" card
        const becomePartnerCard = await page.getByText('Become Partner').locator('..');
        await becomePartnerCard.click();

        // Wait for navigation
        await page.waitForURL('**/become-partner', { timeout: 5000 });

        // Verify we're on the partner page
        expect(page.url()).toContain('/become-partner');

        // Verify partner page content
        await expect(page.getByText('Zostań Partnerem')).toBeVisible();
        await expect(page.getByText('Przyszłości Doradztwa')).toBeVisible();
    });

    test('should display partner page sections correctly', async ({ page }) => {
        // Navigate directly to partner page
        await page.goto('/become-partner');

        // Wait for page load
        await page.waitForSelector('h1', { timeout: 10000 });

        // Verify hero section
        await expect(page.getByText('Zostań Partnerem')).toBeVisible();

        // Verify benefits section
        await expect(page.getByText('Korzyści dla Partnerów')).toBeVisible();
        await expect(page.getByText('Zwiększ Przychody')).toBeVisible();
        await expect(page.getByText('Buduj Relacje')).toBeVisible();
        await expect(page.getByText('Certyfikacja')).toBeVisible();
        await expect(page.getByText('Wsparcie Technologiczne')).toBeVisible();

        // Verify partner types section
        await expect(page.getByText('Modele Współpracy')).toBeVisible();
        await expect(page.getByText('Konsultant Niezależny')).toBeVisible();
        await expect(page.getByText('Firma Konsultingowa')).toBeVisible();
        await expect(page.getByText('Partner Strategiczny')).toBeVisible();

        // Verify process section
        await expect(page.getByText('Jak Dołączyć?')).toBeVisible();

        // Verify testimonials section
        await expect(page.getByText('Zaufali Nam')).toBeVisible();
        await expect(page.getByText('Nordic Digital Solutions')).toBeVisible();
        await expect(page.getByText('TransformACE Consulting')).toBeVisible();

        // Verify final CTA
        await expect(page.getByText('Gotowy na Nowy Rozdział?')).toBeVisible();
    });

    test('should display partner illustrations', async ({ page }) => {
        // Navigate to partner page
        await page.goto('/become-partner');

        // Wait for page load
        await page.waitForSelector('h1', { timeout: 10000 });

        // Check that images are loaded (benefits section)
        const benefitImages = await page.locator('img[alt*="Zwiększ"]');
        await expect(benefitImages.first()).toBeVisible();

        // Check testimonial images
        const testimonialImages = await page.locator('img[alt*="Nordic"]');
        await expect(testimonialImages.first()).toBeVisible();
    });

    test('should have responsive grid layout', async ({ page }) => {
        // Test desktop view
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');
        await page.waitForSelector('h1', { timeout: 10000 });

        // Verify grid is visible
        const grid = await page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
        await expect(grid).toBeVisible();

        // Test mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500); // Wait for reflow

        // Grid should still be visible, just in different layout
        await expect(grid).toBeVisible();
    });
});
