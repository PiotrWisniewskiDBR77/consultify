/**
 * TESTY_M06 §6 — Drag & drop [MANUAL]. Per-test isolation.
 * All drag interactions require real mouse-button events — Playwright dispatchEvent
 * does not simulate ReactFlow's onNodeDragStop / onPaneMouseMove reliably in headless.
 * All sub-tests documented as honest skips with rationale; screenshots taken for visual review.
 */
import { type Page, test } from '@playwright/test';

import { bootstrap, createIdea, exitEdit, openMindmap, selectRoot, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
}

test.describe('M06 §6 — Drag & drop [MANUAL]', () => {
  test('6.1 Drag węzła (swobodne przesuwanie) [MANUAL]', async ({ page }) => {
    await freshMap(page, '6.1');
    // Build one child so we have something to drag.
    await selectRoot(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(800);
    await exitEdit(page);
    await shot(page, '6.1-drag-node');
    test.skip(
      true,
      '[MANUAL] ReactFlow onNodeDragStop requires real pointer-down/move/up sequence; ' +
        'headless Playwright drag does not trigger IRM manualDragActive + POST /map/sync position update. ' +
        'Verify manually: grab node → move → release → POST /map/sync with new position.'
    );
  });

  test('6.2 Drag-reparent [MANUAL]', async ({ page }) => {
    await freshMap(page, '6.2');
    await shot(page, '6.2-drag-reparent');
    test.skip(
      true,
      '[MANUAL] Drag-reparent (IRM dropTarget highlight + onParentChange) requires real drag over a drop zone. ' +
        'Verify manually: drag node over another node → highlight → release → hierarchy change + POST /map/sync.'
    );
  });

  test('6.3 Drag kanwy (pan) [MANUAL]', async ({ page }) => {
    await freshMap(page, '6.3');
    await shot(page, '6.3-pan-canvas');
    test.skip(
      true,
      '[MANUAL] Canvas pan via middle-button-drag, right-button-drag, or Space+drag requires real pointer events ' +
        'unavailable in headless Playwright. Verify manually with mouse and trackpad.'
    );
  });
});
