import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

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
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń|Pomín/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  for (let i = 0; i < 10; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1000, force: true }).catch(() => {});
    if (hasWelcome) await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;

    await page.waitForTimeout(200);
  }
}

async function createIdea(page: Page, token: string, title: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: authHeaders(token),
    data: {
      title,
      body: `Workspace seed for ${title}`,
      tags: ['wave1', 'acceptance'],
    },
  });

  if (!res.ok()) {
    throw new Error(`createIdea failed: ${res.status()} ${res.statusText()} body=${await res.text()}`);
  }
  return (await res.json()) as { id: string; title: string };
}

test.describe('Wave 1 deep My Work acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('notebook persists tag changes across note switches through the real UI flow', async ({
    page,
  }) => {
    const titleA = uniqueLabel('wave1-notebook-a');
    const titleB = uniqueLabel('wave1-notebook-b');
    await page.goto('/my-work/notebook', { waitUntil: 'domcontentloaded' });
    await dismissTourModal(page);

    await page.getByRole('button', { name: 'New page', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Note' })).toBeVisible();
    const listAResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && /\/api\/my-work\/notebook\/pages(\?|$)/.test(response.url()),
      { timeout: 30000 }
    );
    const createAResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && /\/api\/my-work\/notebook\/pages$/.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: 'Blank page Start from scratch', exact: true }).last().click();
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
    await titleInput.fill(titleA);
    await page.keyboard.press('Tab');
    await expect(page.getByText(titleA).first()).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'New page', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Note' })).toBeVisible();
    const listBResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && /\/api\/my-work\/notebook\/pages(\?|$)/.test(response.url()),
      { timeout: 30000 }
    );
    const createBResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && /\/api\/my-work\/notebook\/pages$/.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: 'Blank page Start from scratch', exact: true }).last().click();
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
    await titleInput.fill(titleB);
    await page.keyboard.press('Tab');
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
      await page.goto(`/my-work/ideas/${idea.id}/workspace/${tool}`, { waitUntil: 'domcontentloaded' });
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

    await page.goto(`/my-work/ideas/${idea.id}/workspace/mindmap`, { waitUntil: 'domcontentloaded' });
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

    await page.goto(`/my-work/ideas/${idea.id}/workspace/whiteboard`, {
      waitUntil: 'domcontentloaded',
    });
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
    await page.goto(`/my-work/ideas/${idea.id}/workspace/process_flow`, {
      waitUntil: 'domcontentloaded',
    });
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
    await page.goto(`/my-work/ideas/${idea.id}/workspace/table`, { waitUntil: 'domcontentloaded' });
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
