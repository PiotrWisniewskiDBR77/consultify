/**
 * M02 Canvas — UI acceptance capture (→UI bramka).
 * Captures the canvas screen inventory (light + dark) as PNG artifacts for the auditor.
 * Output: docs/qa/screens/m02-canvas-2026-06-20/
 *
 * Auth: test-support bootstrap (a real, non-demo session — the public `register-demo`
 * signup is unprivileged/read-only and is no longer used). Covers the editor/menu/state
 * surfaces. Capability-gated
 * screens (deck render, share strip, public viewer, generation plan) require owner DBR77
 * and are captured separately via the live owner session.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  CANVAS_RICH_EDITOR,
  createWorkCanvasDraft,
  loginAsOwner,
  openWorkCanvasDraft,
  suppressOnboarding,
} from './work-canvas-helpers';

const DIR = 'docs/qa/screens/m02-canvas-2026-06-20';
const PANEL = '[data-testid="chat-work-panel"]';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

// Best-effort step: capture as much of the inventory as possible; never abort the run
// because one optional screen/interaction didn't materialize.
async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[ui-capture] step skipped: ${label} — ${(err as Error)?.message ?? err}`);
  }
}

test.describe('M02 Canvas — UI capture', () => {
  test.describe.configure({ timeout: 150000 });

  test('captures canvas screen inventory (light + dark)', async ({ page }) => {
    await suppressOnboarding(page);
    const token = await loginAsOwner(page);
    const draft = await createWorkCanvasDraft(page.request, token, {
      kind: 'document',
      title: 'M02 UI capture — przykładowy dokument',
      content:
        '# M02 UI capture — przykładowy dokument\n\n' +
        'Akapit startowy pokazujący renderowanie treści w edytorze Canvas (TipTap).\n\n' +
        '## Sekcja druga\n\n- punkt pierwszy\n- punkt drugi\n\n' +
        '| Kolumna A | Kolumna B |\n|---|---|\n| 1 | 2 |\n',
    });

    // 01 — Panel + header + editor (doc view), light
    await openWorkCanvasDraft(page, draft);
    await expect(page.locator(CANVAS_RICH_EDITOR).first()).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, '01-panel-header-editor-light');

    // 02 — full split (chat left + canvas right), light
    await page.screenshot({ path: `${DIR}/02-split-fullpage-light.png`, fullPage: true });

    // 08 — Selection AI / block actions (capture first, before menus mutate the editor)
    await step('08-selection', async () => {
      await page
        .locator(`${CANVAS_RICH_EDITOR} p`, { hasText: 'Akapit startowy' })
        .first()
        .click({ clickCount: 3 });
      await page.waitForTimeout(600);
      await shot(page, '08-selection-ai-block-actions');
    });

    // 03 — "…" diagnostics menu open
    await step('03-menu', async () => {
      await page.getByRole('button', { name: 'Canvas menu' }).click();
      await expect(page.locator('[data-testid="canvas-diagnostics-menu"]').first()).toBeVisible();
      await page.waitForTimeout(300);
      await shot(page, '03-diagnostics-menu-open');
    });

    // 04 — Markdown view
    await step('04-md', async () => {
      await page.getByRole('button', { name: 'Markdown view' }).click();
      await expect(page.locator('[data-testid="canvas-md-view"]').first()).toBeVisible();
      await page.waitForTimeout(300);
      await shot(page, '04-markdown-view');
      await page.getByRole('button', { name: 'Canvas menu' }).click();
      await page.getByRole('button', { name: 'Dock view' }).click();
    });

    // 05 — "+ New Canvas" templates menu
    await step('05-new', async () => {
      await page
        .locator('[data-testid="canvas-new-menu-root"]')
        .first()
        .getByRole('button', { name: /New Canvas/i })
        .first()
        .click();
      await page.waitForTimeout(300);
      await shot(page, '05-new-canvas-templates');
      await page.keyboard.press('Escape');
    });

    // 06 — Version history popover
    // #87c (rewizja 07-13): the standalone main-bar "Historia" icon was
    // decluttered into the "⋯" Canvas menu (Manual editing section) — the
    // trigger now lives inside canvas-diagnostics-menu, the popover itself
    // still renders from the unchanged canvas-history-root anchor.
    await step('06-history', async () => {
      await page.getByRole('button', { name: 'Canvas menu' }).click();
      await expect(page.locator('[data-testid="canvas-diagnostics-menu"]').first()).toBeVisible();
      await page.locator('[data-testid="canvas-history-menu-item"]').first().click();
      await expect(page.locator('[data-testid="canvas-history-root"]').first()).toBeVisible();
      await page.waitForTimeout(800);
      await shot(page, '06-version-history');
      await page.keyboard.press('Escape');
    });

    // 07 — Capability gating (output + promote strips, gated for demo user)
    await step('07-gating', async () => {
      const outputs = page.locator('[data-testid="canvas-output-actions"]').first();
      await outputs.scrollIntoViewIfNeeded();
      await shot(page, '07-capability-gating-strips');
    });

    // 09 — Dark mode: panel + editor
    await step('09-dark-editor', async () => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await openWorkCanvasDraft(page, draft);
      await expect(page.locator(CANVAS_RICH_EDITOR).first()).toBeVisible();
      await page.waitForTimeout(500);
      await shot(page, '09-panel-editor-dark');
    });

    // 10 — Dark mode: "…" menu open
    await step('10-dark-menu', async () => {
      await page.getByRole('button', { name: 'Canvas menu' }).click();
      await expect(page.locator('[data-testid="canvas-diagnostics-menu"]').first()).toBeVisible();
      await page.waitForTimeout(300);
      await shot(page, '10-diagnostics-menu-dark');
      await page.keyboard.press('Escape');
    });

    // 11 — Dark full split
    await step('11-dark-split', async () => {
      await page.screenshot({ path: `${DIR}/11-split-fullpage-dark.png`, fullPage: true });
    });
  });
});
