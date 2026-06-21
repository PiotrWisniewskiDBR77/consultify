/**
 * M09 Ideas · Whiteboard — USABILITY WALKTHROUGH (Playwright, live app, read-write owner).
 * Source of truth: Harvard/Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md
 *
 * Goal (per Piotr 2026-06-20): drive the whiteboard like a real user and surface the
 * "I can't actually use this" gaps — missing context menu, unreachable feature, unclear
 * affordance. Each check is soft + screenshotted; the test prints a FINDINGS report so
 * gaps are actionable. Runs in ONE session (one auth) to stay fast on the slow staging DB.
 */
import { expect, test } from '@playwright/test';

import {
  WB,
  addSticky,
  clickToolbar,
  nodeCount,
  openWhiteboardAsOwner,
  shot,
} from './m09-whiteboard-helpers';

test.describe('M09 Whiteboard — usability walkthrough', () => {
  test('drive the board as a user; report unusable affordances', async ({ page }) => {
    const findings: string[] = [];
    const note = (ok: boolean, label: string) => {
      if (!ok) findings.push(label);
      expect.soft(ok, label).toBe(true);
    };

    await openWhiteboardAsOwner(page, 'M09 Walkthrough');
    await expect(page.getByLabel(WB.canvasRegion)).toBeVisible({ timeout: 30000 });

    // ── §2 Node types: add a sticky and confirm it actually lands on the canvas ──
    const start = await nodeCount(page);
    const stickyOk = await addSticky(page);
    note(stickyOk && (await nodeCount(page)) > start, '§2.1 add Sticky note from toolbar');
    await shot(page, 'wt-01-sticky');

    // ── §2 Create menu offers all the user-facing node types ──
    await page.getByRole('button', { name: 'Create options', exact: true }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const menuTexts = (await page.locator('[role="menuitem"]').allTextContents()).map((t) => t.trim());
    for (const kind of ['Text block', 'Frame', 'Shape', 'Image', 'Link card']) {
      note(menuTexts.some((t) => t.includes(kind)), `§2 Create menu offers "${kind}"`);
    }
    await shot(page, 'wt-02-create-menu');
    await page.keyboard.press('Escape').catch(() => {});

    // ── §5.1 Single selection → the selection bar must appear (so the user can act on a node) ──
    const firstNode = page.locator('.react-flow__node').first();
    await firstNode.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const selBar = page.getByLabel(/selection/i).or(page.locator('[aria-label*="election"]'));
    note(await selBar.first().isVisible({ timeout: 2000 }).catch(() => false), '§5.1 selecting a node shows the SelectionBar');
    await shot(page, 'wt-03-selection');

    // ── §6.4 Resize: selecting a node should expose NodeResizer handles (L-05 claim) ──
    const resizeHandles = page.locator('.react-flow__resize-control, .react-flow__resize-control-handle');
    note((await resizeHandles.count()) > 0, '§6.4 NodeResizer handles appear on a selected node (L-05)');
    await shot(page, 'wt-04-resize-handles');

    // ── §6.1 Inline edit: double-click a sticky should open an editable field ──
    await firstNode.dblclick({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const editor = page.locator('.react-flow__node textarea, .react-flow__node [contenteditable="true"], .react-flow__node input');
    note((await editor.count()) > 0, '§6.1 double-click a sticky opens inline text editing');
    await shot(page, 'wt-05-inline-edit');
    await page.keyboard.press('Escape').catch(() => {});

    // ── Context menu: users expect right-click to expose node actions ──
    await firstNode.click({ button: 'right', force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const ctxMenu = page.locator('[role="menu"]:visible, [data-context-menu]:visible');
    note((await ctxMenu.count()) > 0, 'right-click on a node opens a context menu');
    await shot(page, 'wt-06-context-menu');
    await page.keyboard.press('Escape').catch(() => {});

    // ── §13 Export: the menu must offer PNG/SVG/Markdown/JSON ──
    await clickToolbar(page, WB.toolbar.export);
    await page.waitForTimeout(500);
    const exportText = (await page.locator('body').innerText()).toLowerCase();
    for (const fmt of ['png', 'svg', 'markdown', 'json']) {
      note(exportText.includes(fmt), `§13 Export menu offers ${fmt.toUpperCase()}`);
    }
    await shot(page, 'wt-07-export');
    await page.keyboard.press('Escape').catch(() => {});

    // ── §17 Slash menu: typing "/" on the canvas should open the command menu ──
    await page.locator('.react-flow__pane').first().click({ force: true }).catch(() => {});
    await page.keyboard.press('/').catch(() => {});
    await page.waitForTimeout(500);
    const slash = page.locator('[role="menu"]:visible, [data-slash-menu]:visible').or(page.getByText(/slash|command/i));
    note(await slash.first().isVisible({ timeout: 1500 }).catch(() => false), '§17 "/" opens the slash command menu');
    await shot(page, 'wt-08-slash');
    await page.keyboard.press('Escape').catch(() => {});

    // ── §14 Facilitation: Voting + Role controls must be reachable ──
    note(
      await page.getByRole('button', { name: WB.toolbar.voting, exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false),
      '§14 Voting control is present in the toolbar'
    );
    note(
      await page.getByRole('button', { name: WB.toolbar.role, exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false),
      '§14 Role control is present in the toolbar'
    );
    await shot(page, 'wt-09-facilitation');

    // ── Report ──
    if (findings.length) {
      console.log('\n===== M09 WALKTHROUGH FINDINGS (unusable / missing) =====');
      findings.forEach((f) => console.log('  ✗ ' + f));
      console.log('========================================================\n');
    } else {
      console.log('\n===== M09 WALKTHROUGH: all affordances present =====\n');
    }
  });
});
