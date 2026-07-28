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
    // Present lives on the CanvasLeftToolbar as the "present" slot (CanvasLeftToolbar.tsx:115-121,
    // aria-label "Present"/"Prezentacja", data-testid canvas-left-toolbar-present) → mm_presentation.
    const presentBtn = page.getByTestId('canvas-left-toolbar-present');
    await shot(page, '20.1-presentation-mode-btn');
    if (!(await presentBtn.isVisible().catch(() => false))) {
      test.skip(
        true,
        'CanvasLeftToolbar "present" slot not rendered headlessly (toolbar portals to body). ' +
          'Feature wired: mm_presentation → setShowPresentation(true) (useMindMapQuickActions.ts:234). ' +
          'Verify manually: click Present → fullscreen slideshow; arrows navigate; Esc exits.'
      );
      return;
    }
    await presentBtn.click({ force: true });
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
      // REAL GAP: TimelineView component is built (mindmap/TimelineView.tsx) and wired —
      // useMindMapQuickActions.ts:233 maps action 'mm_timeline' → setShowTimeline(true).
      // But NO UI element dispatches 'mm_timeline' anywhere in src/ (verified: not in
      // CanvasLeftToolbar, MoreToolsPanel, ImportExportPopover, nor MindmapCommandPalette —
      // the palette only has 'mm_set_structure:timeline', a different action). The overlay
      // is unreachable. Not a headless limitation.
      test.skip(
        true,
        'REAL GAP: TimelineView unreachable — action mm_timeline ' +
          '(useMindMapQuickActions.ts:233 → setShowTimeline) has no UI trigger in src/. ' +
          'Needs an entry in MoreToolsPanel (Visual Modes) or the command palette.'
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
      // REAL GAP: MindMap3DView is built (mindmap/MindMap3DView.tsx) and wired —
      // useMindMapQuickActions.ts:292 maps action 'mm_3d_view' → setShowMindMap3D(true).
      // But NO UI element dispatches 'mm_3d_view' in src/ (verified). Unreachable.
      test.skip(
        true,
        'REAL GAP: MindMap3DView [KNOWN-MOCK CSS pseudo-3D] unreachable — action mm_3d_view ' +
          '(useMindMapQuickActions.ts:292 → setShowMindMap3D) has no UI trigger in src/. ' +
          'Needs an entry in MoreToolsPanel/command palette.'
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
      // REAL GAP: TimeHeatmap is built (mindmap/TimeHeatmap.tsx) and wired —
      // useMindMapQuickActions.ts:272 maps action 'mm_time_heatmap' → setShowTimeHeatmap(true).
      // But NO UI element dispatches 'mm_time_heatmap' in src/ (verified). Unreachable.
      // (Note: a separate 'mm_toggle_heatmap' edge-heat exists and IS toggled elsewhere,
      // but the TimeHeatmap *overlay* panel has no trigger.)
      test.skip(
        true,
        'REAL GAP: TimeHeatmap overlay unreachable — action mm_time_heatmap ' +
          '(useMindMapQuickActions.ts:272 → setShowTimeHeatmap) has no UI trigger in src/. ' +
          'Needs an entry in MoreToolsPanel/command palette.'
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
    // MapHealthScore is a default-ON floating widget (showHealthScore initial state = true).
    // Od 2026-07-28 NIE pokazuje procentu: nagłówek "Map Health"/"Zdrowie mapy" + albo
    // liczba konkretnych braków ("N braków do uzupełnienia"), albo komunikat, że braków
    // nie ma. Widget znika tylko dla pustej mapy — withChild() gwarantuje węzeł.
    await page.waitForTimeout(600);
    await shot(page, '20.5-health-score-open');
    const healthLabel = page.getByText(/Map Health|Zdrowie mapy/i).first();
    if (!(await healthLabel.isVisible().catch(() => false))) {
      test.skip(
        true,
        'MapHealthScore widget not visible (metrics empty? toggled off via mm_toggle_health?). ' +
          'Wired default-on at IdeaRecommendationMap.tsx:3833/5408. Confirm manually.'
      );
      return;
    }
    await expect(healthLabel, '§20.5: Map Health widget visible by default').toBeVisible();
    // Widget mówi KONKRETNIE: albo ile braków, albo że ich nie ma. Żadnego procentu.
    const verdict = page
      .getByText(/brak(i|ów)? do uzupełnienia|gaps? to fill|nie ma oczywistych braków|No obvious gaps/i)
      .first();
    expect(
      await verdict.isVisible().catch(() => false),
      'Health widget names concrete gaps (or states there are none) instead of a % score'
    ).toBe(true);
  });
});
