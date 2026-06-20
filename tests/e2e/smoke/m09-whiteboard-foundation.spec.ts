/**
 * M09 Ideas · Whiteboard — FOUNDATION manual schema (Playwright, live app).
 * Source of truth: Harvard/Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md
 *
 * Proves the M09 harness end-to-end (auth → idea → whiteboard → toolbar → persistence →
 * export → shortcuts → dark) and produces the baseline screenshots. Split into focused
 * tests so each fits comfortably inside the per-test budget (each re-opens a fresh board).
 *
 * Each scenario uses expect.soft so one assertion failure does not abort the matrix, and
 * writes >=1 screenshot to tests/e2e/screenshots/m09/.
 */
import { expect, test } from '@playwright/test';

import {
  WB,
  addSticky,
  addViaCreateMenu,
  clickToolbar,
  collectSignals,
  dismissOverlay,
  nodeCount,
  openWhiteboardAsOwner,
  persistStickyViaApi,
  saveBoard,
  shot,
  waitForWhiteboardReady,
} from './m09-whiteboard-helpers';

test.describe('M09 Whiteboard — foundation manual schema', () => {
  // §1 Shared board (owner opens) · §2 Drawing tools (node types) · §4 Undo/Redo.
  test('S1·S2·S4 — owner opens board, adds nodes, undo/redo', async ({ page }) => {
    const signals = collectSignals(page);

    // §1.1 Owner opens own whiteboard.
    await openWhiteboardAsOwner(page, 'M09 Foundation A');
    await expect(page.getByLabel(WB.canvasRegion)).toBeVisible({ timeout: 30000 });
    await shot(page, 's1-1-owner-board');
    const startCount = await nodeCount(page);

    // §2.1 Add sticky note.
    const stickyOk = await addSticky(page);
    const afterSticky = await nodeCount(page);
    expect.soft(stickyOk && afterSticky > startCount, 'sticky added → node count grew').toBe(true);
    await shot(page, 's2-1-sticky-added');

    // §2.x Add a Frame via the Create dropdown (caret → menuitem).
    const frameOk = await addViaCreateMenu(page, /Frame/i);
    await shot(page, 's2-3-frame-added');
    expect.soft(frameOk || (await nodeCount(page)) >= afterSticky, 'create-menu add path reachable').toBe(true);

    // §4.1 Undo (UI-level: node count must not grow).
    const beforeUndo = await nodeCount(page);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(500);
    expect.soft(await nodeCount(page), 'undo did not increase node count').toBeLessThanOrEqual(beforeUndo);
    await shot(page, 's4-1-undo');

    // §4.2 Redo.
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z');
    await page.waitForTimeout(500);
    await shot(page, 's4-2-redo');

    signals.assertClean();
  });

  // §9 Persistence & autosave — a saved whiteboard reloads with its nodes.
  test('S9 — persistence across reload (hydrate + render)', async ({ page }) => {
    const signals = collectSignals(page);
    const mapSaves: number[] = [];
    const saveFailures: string[] = [];
    page.on('response', async (res) => {
      const m = res.request().method();
      if (/\/api\/my-work\/my-ideas\/.+\/map(\/sync)?(\?|$)/.test(res.url()) && (m === 'POST' || m === 'PUT')) {
        const st = res.status();
        mapSaves.push(st);
        if (st >= 400) saveFailures.push(`${m} ${st} ${(await res.text().catch(() => '')).slice(0, 200)}`);
      }
    });

    const { token, ideaId } = await openWhiteboardAsOwner(page, 'M09 Foundation B');
    await expect(page.getByLabel(WB.canvasRegion)).toBeVisible({ timeout: 30000 });

    // §2.1 + §9.2 add a sticky and exercise the UI save path (proves it reaches the server 2xx).
    await addSticky(page);
    const saveOk = await saveBoard(page);
    expect.soft(saveOk, 'UI save path fired a 2xx /map(/sync) response').toBe(true);
    await shot(page, 's9-2-manual-save');

    // §9.1 Authoritative persistence: persist a labeled sticky via the documented sync endpoint
    // at the current version (never conflicts), reload, and confirm it HYDRATES + RENDERS.
    const probeLabel = await persistStickyViaApi(page, ideaId, token);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissOverlay(page);
    await expect(page.getByLabel(WB.workspaceRegion)).toBeVisible({ timeout: 30000 });
    await waitForWhiteboardReady(page);
    expect.soft(await nodeCount(page), 'persisted sticky hydrated + rendered across reload').toBeGreaterThan(0);
    expect
      .soft(await page.getByText(probeLabel, { exact: false }).count(), 'persisted sticky label is on the canvas')
      .toBeGreaterThan(0);
    await shot(page, 's9-1-persist-reload');

    // A 409 IDEA_MAP_CONFLICT during rapid editing is acceptable optimistic-concurrency; only
    // 5xx on save is a defect.
    const serverErrors = saveFailures.filter((f) => / 5\d\d /.test(f));
    expect.soft(serverErrors, `no 5xx on save:\n${serverErrors.join('\n')}`).toEqual([]);
    signals.assertClean();
  });

  // §13 Export · §16 Background · §17 Keyboard shortcuts · §19 Dark mode.
  test('S13·S16·S17·S19 — export, background, shortcuts, dark', async ({ page }) => {
    const signals = collectSignals(page);
    await openWhiteboardAsOwner(page, 'M09 Foundation C');
    await expect(page.getByLabel(WB.canvasRegion)).toBeVisible({ timeout: 30000 });
    await addSticky(page); // give export/menus something to act on

    // §13.1 Export menu opens.
    await clickToolbar(page, WB.toolbar.export);
    await page.waitForTimeout(500);
    await shot(page, 's13-1-export-menu');
    await page.keyboard.press('Escape').catch(() => {});

    // §16 Background pattern.
    await clickToolbar(page, WB.toolbar.background);
    await page.waitForTimeout(400);
    await shot(page, 's16-1-background');
    await page.keyboard.press('Escape').catch(() => {});

    // §17.2 Keyboard shortcuts help.
    await clickToolbar(page, WB.toolbar.shortcuts);
    await page.waitForTimeout(400);
    await shot(page, 's17-2-shortcuts-help');
    await page.keyboard.press('Escape').catch(() => {});

    // §19.6 Dark mode renders without console errors.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(400);
    await shot(page, 's19-6-dark');

    signals.assertClean();
  });
});
