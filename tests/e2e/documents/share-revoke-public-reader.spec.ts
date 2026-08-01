import { expect, test } from '@playwright/test';

import { dismissTourModal, seedE2EAuthWithBootstrap } from '../smoke/runtime-gate-helpers';
import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

test.describe('MAT-04 — document share, rotate, public read and revoke', () => {
  test.setTimeout(120000);

  test('owner controls a durable public link and revoked tokens fail closed', async ({ page }) => {
    await seedE2EAuthWithBootstrap(page);
    await suppressOnboarding(page);
    await page.goto('/document-studio', { waitUntil: 'domcontentloaded' });
    await dismissTourModal(page);
    await dismissOverlayIfPresent(page);

    await page
      .getByText(/^Czysto$/i)
      .first()
      .click();
    await expect(page).toHaveURL(/\/document-studio\/[^/?#]+/, { timeout: 30000 });
    await expect(page.locator('[data-testid="document-tiptap-editor"] .ProseMirror')).toBeVisible();

    await page.getByRole('button', { name: /^Share$/i }).click();
    await expect(page.getByText(/Create scoped links/i)).toBeVisible();
    await page.getByLabel(/Label/i).fill('MAT-04 acceptance');
    await page.getByRole('button', { name: /Create link/i }).click();

    const publicLink = page.getByTestId('document-share-public-link');
    await expect(publicLink).toBeVisible();
    const firstHref = await publicLink.getAttribute('href');
    expect(firstHref).toMatch(/^\/shared\/doc\//);
    const firstToken = decodeURIComponent(firstHref!.split('/').pop()!);

    const firstPublic = await page.request.post('/api/document-studio/share-links/document', {
      data: { token: firstToken },
    });
    expect(firstPublic.status(), await firstPublic.text()).toBe(200);
    expect(((await firstPublic.json()) as any).document.title).toBeTruthy();

    await page.getByRole('button', { name: /^Rotate$/i }).click();
    await expect(publicLink).toBeVisible();
    const rotatedHref = await publicLink.getAttribute('href');
    const rotatedToken = decodeURIComponent(rotatedHref!.split('/').pop()!);
    expect(rotatedToken).not.toBe(firstToken);

    const stale = await page.request.post('/api/document-studio/share-links/document', {
      data: { token: firstToken },
    });
    expect(stale.status()).toBe(404);
    const fresh = await page.request.post('/api/document-studio/share-links/document', {
      data: { token: rotatedToken },
    });
    expect(fresh.status(), await fresh.text()).toBe(200);

    await page.getByRole('button', { name: /^Revoke$/i }).click();
    await expect(page.getByText(/^revoked$/i)).toBeVisible();
    const revoked = await page.request.post('/api/document-studio/share-links/document', {
      data: { token: rotatedToken },
    });
    expect(revoked.status()).toBe(404);
  });
});
