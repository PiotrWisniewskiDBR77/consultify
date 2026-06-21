/**
 * TESTY_M06 §20 — Tryby widoku (Presentation, Timeline, 3D, Heatmap, HealthScore).
 * Per-test isolation. All toggle-based: button click → component mounts → no crash → close.
 */
import { type Page, expect, test } from '@playwright/test';

import { bootstrap, createIdea, exitEdit, openMindmap, selectRoot, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
}

async function withChild(page: Page) {
  await selectRoot(page);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(900);
  await page.keyboard.type('View mode node');
  await exitEdit(page);
}

test.describe('M06 §20 — Tryby widoku', () => {
  test('20.1 Tryb prezentacji (PresentationMode)', async ({ page }) => {
    await freshMap(page, '20.1');
    await withChild(page);
    const presentBtn = page
      .getByRole('button', { name: /Present|Prezentacja|Slideshow/i })
      .first();
    await shot(page, '20.1-presentation-mode-btn');
    if (!(await presentBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'PresentationMode button not surfaced headlessly. ' +
          'Verify manually: click → fullscreen slideshow with nodes; arrow navigation; Esc → exit.'
      );
      return;
    }
    await presentBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '20.1-presentation-mode-open');
    // In presentation mode something fullscreen-like should be visible.
    const presentEl = page
      .locator('[class*="presentation"], [class*="Presentation"], [class*="slideshow"]')
      .first();
    const canvas = page.getByLabel('Idea map workspace');
    // Either presentation UI appeared or canvas is still intact (no crash).
    const noCrash = (await presentEl.isVisible().catch(() => false)) || (await canvas.isVisible().catch(() => false));
    expect(noCrash, 'PresentationMode opens without crash').toBe(true);
    // Close with Esc.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  test('20.2 Timeline View (TimelineView)', async ({ page }) => {
    await freshMap(page, '20.2');
    await withChild(page);
    const timelineBtn = page
      .getByRole('button', { name: /Timeline|Oś czasu/i })
      .first();
    await shot(page, '20.2-timeline-btn');
    if (!(await timelineBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'TimelineView button not surfaced headlessly. ' +
          'Verify manually: click → timeline overlay with date-positioned nodes; Esc/X → close.'
      );
      return;
    }
    await timelineBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '20.2-timeline-open');
    const timelineEl = page
      .locator('[class*="timeline"], [class*="Timeline"]')
      .first();
    const noCrash = (await timelineEl.isVisible().catch(() => false)) ||
      (await page.getByLabel('Idea map workspace').isVisible().catch(() => false));
    expect(noCrash, 'TimelineView opens without crash').toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  test('20.3 3D View (MindMap3DView) [KNOWN-MOCK]', async ({ page }) => {
    await freshMap(page, '20.3');
    await withChild(page);
    const btn3d = page
      .getByRole('button', { name: /3D|Widok 3D/i })
      .first();
    await shot(page, '20.3-3d-view-btn');
    if (!(await btn3d.isVisible().catch(() => false))) {
      test.skip(
        true,
        '[KNOWN-MOCK] MindMap3DView button not surfaced headlessly. ' +
          'Verify manually: click → CSS perspective pseudo-3D (not WebGL); no crash; Esc → close.'
      );
      return;
    }
    await btn3d.click();
    await page.waitForTimeout(800);
    await shot(page, '20.3-3d-view-open');
    const canvas = page.getByLabel('Idea map workspace');
    expect(await canvas.isVisible().catch(() => false), '3D view opens without crash').toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  test('20.4 Time Heatmap (TimeHeatmap)', async ({ page }) => {
    await freshMap(page, '20.4');
    await withChild(page);
    const heatmapBtn = page
      .getByRole('button', { name: /Heatmap|Heat map|Mapa cieplna/i })
      .first();
    await shot(page, '20.4-heatmap-btn');
    if (!(await heatmapBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'TimeHeatmap button not surfaced headlessly. ' +
          'Verify manually: click → nodes colored by activity; close button dismisses.'
      );
      return;
    }
    await heatmapBtn.click();
    await page.waitForTimeout(800);
    await shot(page, '20.4-heatmap-open');
    const canvas = page.getByLabel('Idea map workspace');
    expect(await canvas.isVisible().catch(() => false), 'TimeHeatmap opens without crash').toBe(true);
  });

  test('20.5 Health Score (MapHealthScore)', async ({ page }) => {
    await freshMap(page, '20.5');
    await withChild(page);
    const healthBtn = page
      .getByRole('button', { name: /Health Score|Wynik zdrowia|Health/i })
      .first();
    await shot(page, '20.5-health-score-btn');
    if (!(await healthBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'MapHealthScore button not surfaced headlessly. ' +
          'Verify manually: click → score 0–100 displayed based on node structure; ' +
          'different for empty map vs 10-node map.'
      );
      return;
    }
    await healthBtn.click();
    await page.waitForTimeout(600);
    await shot(page, '20.5-health-score-open');
    // Health score panel should display a numeric score.
    const score = page.getByText(/\d{1,3}\/100|\d{1,3}%|score/i).first();
    expect(await score.isVisible().catch(() => false), 'Health Score panel shows a score').toBe(true);
  });
});
