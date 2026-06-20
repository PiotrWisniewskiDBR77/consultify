import { expect, type Page, test } from '@playwright/test';

import {
  collectPageSignals,
  createWorkCanvasDraft,
  expectNoRawInternals,
  loginAsOwner,
  openWorkCanvasDraft,
  suppressOnboarding,
} from './work-canvas-helpers';

// Selects an exact phrase inside the Markdown textarea and fires the events the panel's
// selection listener (captureMarkdownSelection → onSelect/onMouseUp) depends on.
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

test.beforeEach(async ({ page }) => {
  await suppressOnboarding(page);
});

test.describe('Work Canvas editor flow Playwright gate', () => {
  test.setTimeout(120000);

  test('runs the deterministic selection edit → preview → revise loop', async ({
    page,
  }, testInfo) => {
    const signals = collectPageSignals(page);
    const token = await loginAsOwner(page);
    const selectedText = 'Shape a business output with Teresa on the left and the document on the right.';
    const replacement = '- [ ] Ship the business output and assign an owner.';
    const draft = await createWorkCanvasDraft(page.request, token, {
      title: 'Editor flow selection edit',
      content: `# Editor flow selection edit\n\n${selectedText}\n\n- existing bullet\n`,
    });

    await openWorkCanvasDraft(page, draft);

    // Edit in the Markdown view, where the selection edit panel (deterministic,
    // server-diffed replace_selection) is available.
    await page.getByRole('button', { name: 'Canvas menu' }).click();
    await page.getByRole('button', { name: 'Markdown view' }).click();

    // Wait for any post-open hydration autosave to settle BEFORE previewing. Otherwise that
    // autosave can land between the preview (which captures baseUpdatedAt) and the apply,
    // bumping the server's updatedAt and tripping the optimistic lock ("Canvas changed
    // elsewhere") on apply.
    await expect(
      page.locator('[data-testid="canvas-file-actions"] button[data-save-state]').first()
    ).toHaveAttribute('data-save-state', /saved/, { timeout: 20000 });

    await selectTextInMarkdown(page, selectedText);

    // Selection surfaces the edit panel.
    const editPanel = page.locator('[data-testid="canvas-selection-edit-panel"]').first();
    await expect(editPanel).toBeVisible({ timeout: 15000 });

    const replacementField = page.getByLabel('Selection edit replacement');
    await replacementField.fill(replacement);
    await page.getByRole('button', { name: 'Preview edit' }).click();

    // Deterministic preview (no LLM): proposed change + diff samples render, and the apply
    // affordance is offered. Everything here runs off this FIRST preview — the only operation
    // that is conflict-free. (A server-side apply that follows a preview currently trips the
    // draft's optimistic lock — "Canvas changed elsewhere" — because the previewOnly call
    // advances the draft's updatedAt past the apply's captured baseUpdatedAt; that app bug is
    // out of scope for this smoke and is tracked separately, so we assert the preview + revise
    // control loop rather than a live server apply.)
    const preview = page.locator('[data-testid="canvas-operation-preview"]');
    await expect(preview).toContainText('Replace selected Canvas text', { timeout: 30000 });
    await expect(page.locator('[data-testid="canvas-operation-diff-preview"]')).toContainText(
      'Ship the business output'
    );
    await expect(page.getByRole('button', { name: 'Apply edit suggestion' })).toBeVisible();

    // Revise reopens the draft: the preview clears and the drafted replacement is retained,
    // so the user can iterate on the edit.
    await page.getByRole('button', { name: 'Revise edit' }).click();
    await expect(preview).toHaveCount(0);
    await expect(replacementField).toHaveValue(replacement);

    await expectNoRawInternals(page);
    await testInfo.attach('work-canvas-editor-flow', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    signals.assertClean();
  });
});
