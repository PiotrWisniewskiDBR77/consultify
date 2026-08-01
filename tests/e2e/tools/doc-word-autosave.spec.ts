/**
 * Document Studio — manual edit autosave + reload persistence, and Comments tab.
 *
 * Covers the recently-fixed P0 data-loss bug (E3 AUTOSAVE, see
 * DocumentTipTapEditor.tsx): a manual edit used to only update in-memory
 * React state, so a reload silently discarded it. The editor now debounces
 * (500ms) and PUTs the reconstructed schema to
 * `PUT /api/document-studio/:artifactId/content` (saveDocumentStudioManualContent).
 *
 * Route: /document-studio (canonical; /wordy now redirects here — see
 * AppRoutes.tsx "wordy_merged_into_document_studio").
 * Flow: intake (docstudio-intake-input) -> outline (Mode 1, useLlm=false by
 * default so no live/mock LLM call is required) -> "Generate document" ->
 * document phase renders DocumentTipTapEditor (data-testid=
 * "document-tiptap-editor").
 */
import { expect, Page, test } from '@playwright/test';

import { dismissTourModal, seedE2EAuthWithBootstrap } from '../smoke/runtime-gate-helpers';
import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

/**
 * The "Welcome to Consultify" first-run dialog ("Skip for now" / "Get
 * started") is a DIFFERENT overlay than the one dismissTourModal() targets
 * (which matches "Welcome to Consultinity"/"Skip tour") -- observed directly
 * in this harness's E2E Admin account. suppressOnboarding() (work-canvas-
 * helpers.ts) must run BEFORE page.goto (it registers a route + addInitScript);
 * dismissOverlayIfPresent()/dismissTourModal() are the post-navigation fallback.
 */
async function dismissAllOnboarding(page: Page) {
  await dismissTourModal(page);
  await dismissOverlayIfPresent(page);
}

test.describe('Document Studio — autosave + comments [@module:document-studio]', () => {
  test.setTimeout(120000);

  test('manual edit in the TipTap editor survives a hard reload', async ({ page }) => {
    await seedE2EAuthWithBootstrap(page);
    await suppressOnboarding(page);

    await page.goto('/document-studio', { waitUntil: 'domcontentloaded' });
    await dismissAllOnboarding(page);
    await expect(page.locator('[data-testid="document-studio-view"]')).toBeVisible({
      timeout: 30000,
    });

    // Current entry UX presents three equal modes. "Czysto" creates the
    // document immediately and is the shortest deterministic route to the
    // real editor (no LLM or obsolete intake-form assumptions).
    const cleanStart = page.getByText(/^Czysto$/i).first();
    await expect(cleanStart).toBeVisible({ timeout: 30000 });
    await cleanStart.click();

    // Document phase: the TipTap editor mounts.
    const editor = page.locator('[data-testid="document-tiptap-editor"] .ProseMirror');
    await expect(editor).toBeVisible({ timeout: 30000 });

    // Capture the artifact id from the URL (runStreamingGeneration navigates to
    // /document-studio/:artifactId on completion).
    await expect(page).toHaveURL(/\/document-studio\/[^/?#]+/, { timeout: 30000 });

    // Manual edit: click into the editor body and type a distinctive sentence.
    const editSentinel = `MANUAL EDIT SENTINEL ${Date.now()}`;
    await editor.click();
    await page.keyboard.press('Control+End').catch(() => {});
    await page.keyboard.type(` ${editSentinel}`);

    // Autosave debounce is 500ms (SAVE_DEBOUNCE_MS in DocumentTipTapEditor.tsx);
    // give it real margin for the PUT round-trip before reloading.
    await page.waitForTimeout(2500);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissAllOnboarding(page);
    await expect(page.locator('[data-testid="document-studio-view"]')).toBeVisible({
      timeout: 30000,
    });

    const editorAfterReload = page.locator('[data-testid="document-tiptap-editor"] .ProseMirror');
    await expect(editorAfterReload).toBeVisible({ timeout: 30000 });
    // KEY ASSERT: the manually-typed sentinel text must still be present after a
    // full reload -- this is the autosave fix under test.
    await expect(editorAfterReload).toContainText(editSentinel, { timeout: 15000 });
  });

  test('Comments tab is reachable and accepts a new comment', async ({ page }) => {
    await seedE2EAuthWithBootstrap(page);
    await suppressOnboarding(page);

    await page.goto('/document-studio', { waitUntil: 'domcontentloaded' });
    await dismissAllOnboarding(page);
    await expect(page.locator('[data-testid="document-studio-view"]')).toBeVisible({
      timeout: 30000,
    });

    await page
      .locator('[data-testid="docstudio-intake-input"]')
      .fill(
        'Prepare a short internal status note for the QA harness comments check. ' +
          'Include scope, key findings, and next steps.'
      );
    await page.locator('[data-testid="docstudio-generate-btn"]').click();

    const outlineGenerate = page.getByRole('button', { name: /Generate document/i });
    await expect(outlineGenerate).toBeVisible({ timeout: 30000 });
    await outlineGenerate.click();

    await expect(page.locator('[data-testid="document-tiptap-editor"] .ProseMirror')).toBeVisible({
      timeout: 30000,
    });

    // Right-rail "Comments" tool tab.
    const commentsTab = page.getByRole('button', { name: /^Comments$/i }).first();
    await expect(commentsTab).toBeVisible({ timeout: 15000 });
    await commentsTab.click();

    const commentsPanel = page.locator('[data-testid="document-comments-panel"]');
    await expect(commentsPanel).toBeVisible({ timeout: 15000 });

    const composer = page.locator('[data-testid="document-comments-composer"]');
    await expect(composer).toBeVisible({ timeout: 10000 });
    const commentText = `E2E comment ${Date.now()}`;
    await composer.fill(commentText);

    const addCommentBtn = page.getByRole('button', { name: /Add comment/i });
    await expect(addCommentBtn).toBeVisible();
    await addCommentBtn.click();

    // Bonus assert: the newly added comment renders in the panel.
    await expect(commentsPanel).toContainText(commentText, { timeout: 15000 });
  });
});
