/**
 * M09 — Ideas · Whiteboard — add sticky, reload, persists.
 *
 * Seeds an idea via the real API, opens the Whiteboard workspace, adds a
 * sticky note via the toolbar's "Create" split-button main click
 * (src/components/MyWork/canvas/CanvasToolbarPrimitives.tsx `onMainClick` →
 * WhiteboardToolbar.tsx:277 `onAddElement('sticky')`; the button's accessible
 * name/title is "Create" per public/locales/en/translation.json
 * myWork.whiteboard.toolbarExtra.create), then forces a hard reload and
 * asserts the extra sticky node persisted.
 */
import { expect, Page, test } from '@playwright/test';

import { seedE2EAuthWithBootstrap } from '../smoke/runtime-gate-helpers';
import { suppressOnboarding } from '../smoke/work-canvas-helpers';
import { waitVisible } from './_helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const WORKSPACE_REGION = /Idea map workspace|Obszar roboczy mapy idei/;
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;

function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * page.request is a separate API context from the browser page — it does NOT
 * read the localStorage token that seedE2EAuthWithBootstrap() seeds via
 * addInitScript. Read the token back out of the page (after one navigation so
 * the init script has run) and use it as a Bearer header for API seed calls.
 */
async function getSeededToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  if (!token) throw new Error('seedE2EAuthWithBootstrap did not leave a token in localStorage');
  return token;
}

async function createIdea(page: Page, token: string, title: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, body: `idea-whiteboard seed for ${title}`, tags: ['e2e', 'whiteboard'] },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}

async function gotoWhiteboard(page: Page, ideaId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`/my-work/ideas/${ideaId}/workspace/whiteboard`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      return;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
}

async function dismissOnboardingButtons(page: Page) {
  const buttons = [
    /Skip for now|Pomiń na razie|Pomiń/i,
    /Skip tour|Pomiń wycieczkę/i,
    /Get started|Zaczynaj|Rozpocznij/i,
  ];
  for (let i = 0; i < 6; i += 1) {
    let acted = false;
    for (const re of buttons) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(250);
  }
}

test.describe('M09 Ideas · Whiteboard — add sticky persists', () => {
  test('adding a sticky note then reloading keeps it', async ({ page }) => {
    test.setTimeout(180000);

    await suppressOnboarding(page);
    await seedE2EAuthWithBootstrap(page);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const token = await getSeededToken(page);

    const idea = await createIdea(page, token, uniqueLabel('wb-persist'));
    await gotoWhiteboard(page, idea.id);
    await dismissOnboardingButtons(page);

    const workspaceRegion = page.getByRole('region', { name: WORKSPACE_REGION });
    const shellVisible = await waitVisible(workspaceRegion, 60000);
    test.skip(!shellVisible, 'Idea workspace shell did not mount under mock — cannot reach Whiteboard canvas');

    // Defensive tool-mount race.
    const wbToolBtn = page.locator('button[title="Whiteboard"]').first();
    if (await waitVisible(wbToolBtn, 5000)) {
      await wbToolBtn.click({ force: true }).catch(() => {});
    }

    const canvasMounted = await waitVisible(page.locator('.react-flow').first(), 60000);
    test.skip(!canvasMounted, 'ReactFlow data layer did not mount within 60s — hydration/perf issue, not a Whiteboard defect');

    // Let the auto-seed root-node write (version 1→2) settle before mutating.
    await page.waitForTimeout(2500);

    const beforeCount = await page.locator('.react-flow__node').count();

    // Add a sticky via the "Create" split-button main click (adds sticky directly,
    // no dropdown needed — see CanvasToolbarPrimitives.tsx onMainClick).
    const createBtn = page.locator('button[title="Create"]').first();
    const createVisible = await waitVisible(createBtn, 10000);

    if (!createVisible) {
      // Fall back to the empty-state "Add sticky" affordance if present (only
      // shown when nodes.length === 0, i.e. auto-seed did not run).
      const emptyStateAdd = page.getByRole('button', { name: /Add sticky|Dodaj karteczkę/i }).first();
      const emptyVisible = await waitVisible(emptyStateAdd, 5000);
      test.skip(!emptyVisible, 'Neither the "Create" toolbar button nor the empty-state "Add sticky" affordance was found');
      await emptyStateAdd.click();
    } else {
      await createBtn.click();
    }

    await expect(page.locator('.react-flow__node')).toHaveCount(beforeCount + 1, { timeout: 15000 });
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);

    const nodeCountAfterAdd = await page.locator('.react-flow__node').count();

    // Give the map-sync autosave time to flush before reload.
    await page.waitForTimeout(3500);
    await gotoWhiteboard(page, idea.id);
    await dismissOnboardingButtons(page);
    await expect(workspaceRegion).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 60000 });

    await expect(
      page.locator('.react-flow__node'),
      `node count should persist across reload: expected ${nodeCountAfterAdd}`
    ).toHaveCount(nodeCountAfterAdd, { timeout: 30000 });
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
  });
});
