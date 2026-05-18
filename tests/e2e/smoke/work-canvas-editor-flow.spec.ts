import { expect, type Page, test } from '@playwright/test';

import {
  expectAppMounted,
  gotoRuntimeGateRoute,
  isStrictCanvasGate,
  seedE2EAuthWithBootstrap,
} from './runtime-gate-helpers';
import { collectPageSignals, expectNoRawInternals } from './work-canvas-helpers';

async function selectTextInMarkdown(page: Page, selectedText: string) {
  const mdView = page.locator('[data-testid="canvas-md-view"]');
  await expect(mdView).toBeVisible({ timeout: 30000 });
  await expect(mdView).toHaveValue(new RegExp(selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await mdView.evaluate((node, text) => {
    const textarea = node as HTMLTextAreaElement;
    const start = textarea.value.indexOf(text);
    if (start < 0) throw new Error(`Selected text not found: ${text}`);
    textarea.focus();
    textarea.setSelectionRange(start, start + text.length);
    textarea.dispatchEvent(new Event('select', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Shift' }));
    textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, selectedText);
}

test.describe('Work Canvas editor flow Playwright gate', () => {
  test.setTimeout(120000);

  test('opens DocumentCanvas and runs selection edit preview loop', async ({ page }, testInfo) => {
    const strictCanvasGate = isStrictCanvasGate();
    const signals = collectPageSignals(page);
    await seedE2EAuthWithBootstrap(page);
    const workPanelButton = page
      .locator('button[aria-label="Open work panel"], [data-testid="chat-work-panel-button"]')
      .first();
    let ready = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await gotoRuntimeGateRoute(page, '/chat');
      try {
        await workPanelButton.waitFor({ state: 'visible', timeout: 10000 });
        await expectAppMounted(page);
        ready = true;
        break;
      } catch {
        await page.waitForTimeout(1200);
        continue;
      }
    }
    if (!ready && strictCanvasGate) {
      throw new Error(
        'Strict Canvas gate: chat work-panel trigger did not mount in runtime after retries.'
      );
    }
    if (ready) {
      await expect(workPanelButton).toBeVisible({ timeout: 30000 });
      await workPanelButton.click();
    } else {
      // Fallback for non-strict runtimes where chat shell mounts slower than Canvas route.
      await gotoRuntimeGateRoute(page, '/ai/work-canvas?kind=document');
    }
    await expect(page.locator('[data-testid="canvas-document-view"]')).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();
    const preferredSelection =
      'Shape a business output with Teresa on the left and the document on the right.';
    const currentMarkdown = await page.locator('[data-testid="canvas-md-view"]').inputValue();
    const selectedText = currentMarkdown.includes(preferredSelection)
      ? preferredSelection
      : currentMarkdown
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.length >= 24) || currentMarkdown.slice(0, 64);
    await selectTextInMarkdown(page, selectedText);

    await page.getByRole('button', { name: 'Rewrite' }).click();
    await page
      .getByLabel('Selection AI instruction')
      .fill('Rewrite this selection as an action checklist with owner.');
    await page.getByRole('button', { name: 'Podgląd AI edit' }).click();

    await expect(page.locator('[data-testid="canvas-operation-preview"]')).toContainText(
      'Replace selected Canvas text',
      { timeout: 30000 }
    );
    await expect(page.locator('[data-testid="canvas-operation-diff-preview"]')).toContainText(
      'Shape a business output'
    );

    await page.getByRole('button', { name: 'Revise edit' }).click();
    await expect(page.locator('[data-testid="canvas-operation-preview"]')).toHaveCount(0);
    await expect(page.getByLabel('Selection AI instruction')).toHaveValue(
      'Rewrite this selection as an action checklist with owner.'
    );

    await page.getByRole('button', { name: 'Podgląd AI edit' }).click();
    await expect(page.locator('[data-testid="canvas-operation-preview"]')).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Apply edit suggestion' }).click();
    await expect(page.locator('[data-testid="canvas-action-feedback"]')).toContainText(
      'Selection edit applied',
      { timeout: 30000 }
    );
    await expect(page.locator('[data-testid="canvas-md-view"]')).toHaveValue(/assign an owner/);

    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-editor-flow', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });
});
