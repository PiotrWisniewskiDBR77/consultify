import { expect, test, type Page } from '@playwright/test';

import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

async function bootstrap(page: Page): Promise<string> {
  const runId = `ppt-shell-v2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId },
  });
  expect(response.ok(), 'test-support bootstrap must create an isolated E2E session').toBe(true);
  return String(((await response.json()) as { token?: string }).token || '');
}

async function seedAuth(page: Page, token: string): Promise<void> {
  await page.addInitScript((sessionToken: string) => {
    localStorage.setItem('token', sessionToken);
    localStorage.setItem('refreshToken', 'e2e-refresh');
    const user = {
      id: 'e2e-ppt-shell-user',
      email: 'e2e-ppt-shell@local.test',
      role: 'ADMIN',
      organizationId: 'e2e-org-id',
      organizationName: 'E2E Organization',
      firstName: 'E2E',
      lastName: 'PPT Shell',
      isAuthenticated: true,
      accessLevel: 'full',
    };
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem(
      'consultinity-storage',
      JSON.stringify({
        state: {
          sessionMode: 'FULL',
          currentUser: user,
          currentOrganization: { id: 'e2e-org-id', name: 'E2E Organization' },
        },
        version: 0,
      })
    );
  }, token);
}

async function createDeck(page: Page, token: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/presentations/decks`, {
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: {
      title: `Artifact Studio PPT ${Date.now()}`,
      theme: 'modern',
      source: 'artifact-studio-shell-v2-e2e',
      slides: [
        {
          type: 'content',
          content: { title: 'Decision summary', bullets: ['Mounted shell evidence'] },
        },
      ],
    },
  });
  expect(response.ok(), 'presentation fixture must be persisted through the real local API').toBe(
    true
  );
  return String(((await response.json()) as any)?.data?.id || '');
}

test.describe('Presentation Artifact Studio shell V2 [@module:presentations]', () => {
  test.setTimeout(120_000);

  test('mounts one Menu2 line, one contextual Menu3 and no local right rail', async ({ page }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const deckId = await createDeck(page, token);

    await page.goto(
      `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);

    const root = page.getByTestId('deck-builder-mels-root');
    await expect(root).toBeVisible({ timeout: 30_000 });
    const shell = root.getByTestId('deck-builder-mels-view');
    await expect(shell).toHaveAttribute('data-artifact-studio', 'true');

    await expect(shell.getByTestId('artifact-menu3')).toHaveCount(1);
    await expect(shell.getByTestId('mels-left-rail')).toHaveCount(1);
    await expect(shell.getByTestId('mels-right-rail')).toHaveCount(0);
    await expect(shell.getByTestId('mels-left-inspector-rail')).toHaveCount(0);
    await expect(shell.getByTestId('artifact-studio-bottom-bar')).toBeVisible();
    await expect(shell.getByRole('button', { name: 'Ask Teresa', exact: true })).toBeVisible();
    await expect(shell.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();

    const topBars = shell.getByRole('toolbar', { name: 'Prezentacje top bar' });
    await expect(topBars).toHaveCount(1);
    const topBarHeight = await topBars.evaluate((element) =>
      Math.round(element.getBoundingClientRect().height)
    );
    expect(topBarHeight, 'Menu2 must stay on a single compact row').toBeLessThanOrEqual(58);

    await expect(shell.getByRole('button', { name: 'Teresa', exact: true })).toHaveCount(0);
    await expect(shell.getByRole('button', { name: 'Theme', exact: true })).toHaveCount(0);
    await expect(shell.getByRole('button', { name: 'Comments', exact: true })).toHaveCount(0);
    await expect(shell.getByRole('button', { name: 'Present', exact: true })).toBeVisible();
    await expect(shell.getByRole('tab', { name: 'Slajdy' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('lane kill-switch immediately restores the legacy presentation shell', async ({ page }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const deckId = await createDeck(page, token);

    await page.goto(
      `/presentations/builder/${deckId}?ff_artifactStudio=1&ff_presentationStudioV2=0`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);

    const root = page.getByTestId('deck-builder-mels-root');
    await expect(root).toBeVisible({ timeout: 30_000 });
    const shell = root.getByTestId('deck-builder-mels-view');
    await expect(shell).not.toHaveAttribute('data-artifact-studio');
    await expect(shell.getByTestId('artifact-menu3')).toHaveCount(0);
    await expect(root.getByRole('button', { name: 'Teresa', exact: true })).toBeVisible();
  });
});
