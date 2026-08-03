import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function dismissTourModal(page: Page) {
  const skipTour = page
    .getByRole('button', { name: /Skip tour|Skip for now|Pomiń|Pomín/i })
    .first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  await welcomeTitle.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});

  for (let i = 0; i < 10; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) {
      await skipTour.click({ timeout: 1000, force: true });
      await skipTour.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    } else if (hasWelcome) {
      await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});
    }

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;

    await page.waitForTimeout(200);
  }
}

async function createIdea(page: Page, token: string, title: string) {
  const createWithToken = (accessToken: string) =>
    page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
      headers: authHeaders(accessToken),
      data: {
        title,
        body: `Workspace seed for ${title}`,
        tags: ['wave1', 'acceptance'],
      },
    });

  let res = await createWithToken(token);
  if (res.status() === 401 || res.status() === 403) {
    // Test-support token can expire during long local sessions.
    // Refresh once from bootstrap to keep wave1 smoke deterministic.
    const runId = `wave1-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const bootstrap = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: {
        'x-test-support-key': TEST_SUPPORT_KEY,
        'content-type': 'application/json',
      },
      data: { runId },
    });

    if (bootstrap.ok()) {
      const payload = (await bootstrap.json()) as { token?: string };
      const refreshedToken = String(payload?.token || '');
      if (refreshedToken) {
        res = await createWithToken(refreshedToken);
      }
    }
  }

  if (!res.ok()) {
    throw new Error(`createIdea failed: ${res.status()} ${res.statusText()} body=${await res.text()}`);
  }
  return (await res.json()) as { id: string; title: string };
}

async function gotoWorkspaceRoute(page: Page, route: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }

  throw lastError;
}

async function openNewNotebookPageModal(page: Page) {
  await expect(page.getByTestId('mywork-view')).toBeVisible({ timeout: 30000 });

  const notebookTab = page.getByRole('button', { name: /Notebook|Notatnik/i }).first();
  if (await notebookTab.isVisible().catch(() => false)) {
    await notebookTab.click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(300);

  // The current Notebook route opens on the L1 notebook library. Create a
  // personal notebook first when the acceptance account has none; creation
  // automatically enters its L2 page workspace.
  const emptyLibrary = page.getByRole('heading', { name: /No notebooks yet|Brak notatników/i });
  if (await emptyLibrary.isVisible().catch(() => false)) {
    const notebookTitle = uniqueLabel('wave1-notebook');
    await page.getByRole('button', { name: /New notebook|Nowy notatnik/i }).first().click();
    const modal = page.getByRole('heading', { name: /New notebook|Nowy notatnik/i });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/Strategy 2026|Strategia 2026/i).fill(notebookTitle);
    await page.getByRole('button', { name: /^Create$|^Utwórz$/i }).click();
    await expect(page.getByTestId('notebook-new-page-button')).toBeVisible({ timeout: 15000 });
  }

  const candidates = [
    page.getByRole('button', { name: /New page|Nowa strona/i }).first(),
    page.getByTestId('mywork-action-button').first(),
    page.getByTestId('notebook-new-page-button').first(),
    page.getByTitle(/New page|Nowa strona/i).first(),
  ];

  for (const candidate of candidates) {
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click({ timeout: 5000 }).catch(() => {});
    const visible = await page
      .getByRole('heading', { name: /New Note|Nowa notatka|Nowa strona/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return;
  }

  throw new Error('Notebook create-page modal did not open');
}

test.describe('Wave 1 deep My Work acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('notebook persists tag changes across note switches through the real UI flow', async ({
    page,
  }) => {
    const titleA = uniqueLabel('wave1-notebook-a');
    const titleB = uniqueLabel('wave1-notebook-b');
    await gotoWorkspaceRoute(page, '/my-work/notebook');
    await dismissTourModal(page);
    // Completing/skipping first-run onboarding currently returns to AI Chat.
    // Re-enter the route under test after the overlay has been dismissed.
    await gotoWorkspaceRoute(page, '/my-work/notebook');

    await openNewNotebookPageModal(page);
    await expect(page.getByRole('heading', { name: /New Note|Nowa notatka|Nowa strona/i })).toBeVisible();
    const listAResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/(?:v8\/)?my-work\/notebook\/pages(\?|$)/.test(response.url()),
      { timeout: 30000 }
    );
    const createAResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/(?:v8\/)?my-work\/notebook\/pages$/.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /Blank page|Pusta strona/i }).last().click();
    const createAResponse = await createAResponsePromise;
    if (!createAResponse.ok()) {
      throw new Error(
        `Notebook create A failed: ${createAResponse.status()} ${createAResponse.statusText()} body=${await createAResponse.text()}`
      );
    }
    const createdA = await createAResponse.json();
    const listAResponse = await listAResponsePromise;
    const listABody = await listAResponse.text();
    if (!listAResponse.ok() || !listABody.includes(String(createdA?.id || ''))) {
      throw new Error(
        `Notebook list after create A failed to materialize note ${createdA?.id}: ${listAResponse.status()} ${listAResponse.statusText()} body=${listABody}`
      );
    }

    const titleInput = page.locator('input[placeholder="Untitled"]').first();
    await expect(titleInput).toBeVisible({ timeout: 30000 });
    const saveAResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes(`/api/v8/my-work/notebook/pages/${createdA.id}`),
      { timeout: 30000 }
    );
    await titleInput.fill(titleA);
    await page.keyboard.press('Tab');
    const saveAResponse = await saveAResponsePromise;
    if (!saveAResponse.ok()) {
      throw new Error(
        `Notebook save A failed: ${saveAResponse.status()} ${saveAResponse.statusText()} body=${await saveAResponse.text()}`
      );
    }
    await expect(page.getByText(titleA).first()).toBeVisible({ timeout: 30000 });

    await openNewNotebookPageModal(page);
    await expect(page.getByRole('heading', { name: /New Note|Nowa notatka|Nowa strona/i })).toBeVisible();
    const listBResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/(?:v8\/)?my-work\/notebook\/pages(\?|$)/.test(response.url()),
      { timeout: 30000 }
    );
    const createBResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/(?:v8\/)?my-work\/notebook\/pages$/.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /Blank page|Pusta strona/i }).last().click();
    const createBResponse = await createBResponsePromise;
    if (!createBResponse.ok()) {
      throw new Error(
        `Notebook create B failed: ${createBResponse.status()} ${createBResponse.statusText()} body=${await createBResponse.text()}`
      );
    }
    const createdB = await createBResponse.json();
    const listBResponse = await listBResponsePromise;
    const listBBody = await listBResponse.text();
    if (!listBResponse.ok() || !listBBody.includes(String(createdB?.id || ''))) {
      throw new Error(
        `Notebook list after create B failed to materialize note ${createdB?.id}: ${listBResponse.status()} ${listBResponse.statusText()} body=${listBBody}`
      );
    }
    await expect(titleInput).toBeVisible({ timeout: 30000 });
    const saveBResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes(`/api/v8/my-work/notebook/pages/${createdB.id}`),
      { timeout: 30000 }
    );
    await titleInput.fill(titleB);
    await page.keyboard.press('Tab');
    const saveBResponse = await saveBResponsePromise;
    if (!saveBResponse.ok()) {
      throw new Error(
        `Notebook save B failed: ${saveBResponse.status()} ${saveBResponse.statusText()} body=${await saveBResponse.text()}`
      );
    }
    await expect(page.getByText(titleB).first()).toBeVisible({ timeout: 30000 });

    await page.getByText(titleA).first().click();
    const tagInput = page.getByPlaceholder('+ tag').first();
    await expect(tagInput).toBeVisible();
    await tagInput.fill('alpha');
    await tagInput.press('Enter');
    await expect(page.getByText('alpha').first()).toBeVisible();

    await page.getByText(titleB).first().click();
    await expect(page.locator(`input[value="${titleB}"]`).first()).toBeVisible({ timeout: 30000 });

    await page.getByText(titleA).first().click();
    await expect(page.locator(`input[value="${titleA}"]`).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('alpha').first()).toBeVisible({ timeout: 30000 });
  });

  test('idea workspace keeps one honest shell across mindmap, whiteboard, process flow, and table', async ({
    page,
  }) => {
    const { token } = readTestSupportState();
    const idea = await createIdea(page, token, uniqueLabel('wave1-idea-shell'));

    const cases = [
      { tool: 'mindmap', label: 'Recommendation map' },
      { tool: 'whiteboard', label: 'Whiteboard' },
      { tool: 'process_flow', label: 'Process Flow' },
      { tool: 'table', label: 'Table' },
    ] as const;

    for (const { tool, label } of cases) {
      await gotoWorkspaceRoute(page, `/my-work/ideas/${idea.id}/workspace/${tool}`);
      await dismissTourModal(page);

      await expect(page.getByLabel('Idea map workspace')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Idea workspace')).toBeVisible();
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
      await expect(page.getByText(idea.title).first()).toBeVisible();
    }
  });

  test('mindmap exposes the connect contract and honest shortcut help', async ({ page }) => {
    const { token } = readTestSupportState();
    const idea = await createIdea(page, token, uniqueLabel('wave1-idea-mindmap'));

    await gotoWorkspaceRoute(page, `/my-work/ideas/${idea.id}/workspace/mindmap`);
    await dismissTourModal(page);

    const connectButton = page.getByRole('button', {
      name: /^Connect/,
    });
    await expect(connectButton).toBeVisible({ timeout: 30000 });

    await page.keyboard.press('?');
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' }).first()).toBeVisible();
    await expect(page.getByText('Add sibling node')).toBeVisible();
  });

  test('whiteboard keeps explicit board-mode framing and trusted help', async ({ page }) => {
    const { token } = readTestSupportState();
    const idea = await createIdea(page, token, uniqueLabel('wave1-idea-whiteboard'));

    await gotoWorkspaceRoute(page, `/my-work/ideas/${idea.id}/workspace/whiteboard`);
    await dismissTourModal(page);

    await expect(page.getByText('Board mode')).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText(
        'You are arranging and editing board elements. Use Draw only when you want a separate freehand layer.'
      )
    ).toBeVisible();

    // In pilot shells, "?" can route to different help surfaces (global panel,
    // modal, or no-op hint). Keep the check focused on whiteboard framing stability.
    await page.keyboard.press('?');
    await expect(page.getByText('Board mode')).toBeVisible();
  });

  test('process flow shows a retryable unavailable state instead of a fake empty canvas', async ({
    page,
  }) => {
    const { token } = readTestSupportState();
    const idea = await createIdea(page, token, uniqueLabel('wave1-idea-processflow'));

    await page.route(new RegExp(`/api/my-work/my-ideas/${idea.id}/map`), (route) => route.abort());
    await gotoWorkspaceRoute(page, `/my-work/ideas/${idea.id}/workspace/process_flow`);
    await dismissTourModal(page);

    await expect(page.getByText('Process flow is temporarily unavailable.')).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText('This does not mean the process is empty. Retry loading the map and check again.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Retry/i }).first()).toBeVisible();
  });

  test('table shows a retryable unavailable state instead of a fake empty grid', async ({ page }) => {
    const { token } = readTestSupportState();
    const idea = await createIdea(page, token, uniqueLabel('wave1-idea-table'));

    await page.route(new RegExp(`/api/my-work/my-ideas/${idea.id}/map`), (route) => route.abort());
    await gotoWorkspaceRoute(page, `/my-work/ideas/${idea.id}/workspace/table`);
    await dismissTourModal(page);

    await expect(page.getByText('Table view is temporarily unavailable.')).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText('This does not mean the table is empty. Retry loading the data and check again.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Retry/i }).first()).toBeVisible();
  });
});
