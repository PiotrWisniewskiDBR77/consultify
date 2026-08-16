import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({
        assessmentFiveSurfacesV1: true,
        auditsFiveSurfacesV1: true,
      })
    );
  });
});

test('Assessment five-surface hub mounts from its production route', async ({ page }) => {
  await page.goto('/assessment/overview?tab=library');
  await expect(page).toHaveURL(/\/assessment\/overview\?tab=library/);
  await expect(page.getByRole('tab', { name: 'Library' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Sessions|Processes/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Outputs' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reports' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Initiatives' })).toBeVisible();
});

test('Audits method hub mounts from its flag-gated production route', async ({ page }) => {
  await page.goto('/audit-programs/method?tab=library');
  await expect(page).toHaveURL(/\/audit-programs\/method\?tab=library/);
  await expect(page.getByRole('tab', { name: 'Library' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Sessions|Sesje/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Outputs' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reports' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Initiatives' })).toBeVisible();
});
