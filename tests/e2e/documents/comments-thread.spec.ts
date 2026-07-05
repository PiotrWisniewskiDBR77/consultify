/**
 * Document Studio (M18) — comments/review-threads panel (B5, Epic E6) E2E.
 *
 * Opens an existing artifact (seeded via backend API), opens the Comments
 * right-rail panel (DocumentCommentsPanel), and drives the full thread
 * lifecycle through real DOM interactions:
 *   1. Add a document-level comment (composer).
 *   2. Reply to it.
 *   3. Resolve it (with a reason).
 *   4. Filter Open / Resolved / All and verify the resolved thread moves
 *      between filters correctly.
 *   5. Reopen it and confirm it returns to Open.
 *
 * All assertions are on structure/testids the panel and CommentThreadItem
 * emit (document-comments-panel, document-comments-composer,
 * comments-filter-*, comment-thread-*, comment-reply-*, comment-resolve-*,
 * comment-reopen-*) — nothing here depends on premium content generation.
 *
 * RUN (mock-DB, safe — does not touch prod):
 *   E2E_USE_WEB_SERVER=true E2E_REQUIRE_TEST_SUPPORT=true E2E_MOCK_DB=true \
 *     npx playwright test tests/e2e/documents/comments-thread.spec.ts --project=chromium
 */
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  openArtifact,
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

const SHOTS = path.resolve('tests/e2e/documents/screens');
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

test.describe('Document Studio — comments thread lifecycle', () => {
  test.describe.configure({ timeout: 120000 });

  test('add → reply → resolve → filter → reopen a document-level comment thread', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      description:
        'Board report on Q3 transformation progress: milestones achieved, budget status, and risks.',
      documentType: 'board_report',
    });

    await openArtifact(page, artifactId);

    await test.step('open the Comments panel from the right rail', async () => {
      const commentsTool = page.getByTestId('mels-right-rail-tool-comments');
      await expect(commentsTool).toBeVisible({ timeout: 15000 });
      await commentsTool.click();
      await expect(page.getByTestId('document-comments-panel')).toBeVisible({ timeout: 15000 });
      await shot(page, 'comments-01-panel-opened');
    });

    const commentBody = `E2E review comment ${Date.now()}`;

    await test.step('add a document-level comment via the composer', async () => {
      const composer = page.getByTestId('document-comments-composer');
      await composer.fill(commentBody);
      await page.getByRole('button', { name: /^Add comment$/i }).click();

      const thread = page.locator('[data-testid^="comment-thread-"]').filter({ hasText: commentBody });
      await expect(thread).toBeVisible({ timeout: 15000 });
      await expect(thread.getByText(/^Open$/)).toBeVisible();
      await shot(page, 'comments-02-added');
    });

    const thread = page.locator('[data-testid^="comment-thread-"]').filter({ hasText: commentBody });

    await test.step('reply to the thread', async () => {
      await thread.getByTestId(/^comment-reply-open-/).click();
      const replyInput = thread.locator('[data-testid^="comment-reply-input-"]');
      const replyBody = `E2E reply ${Date.now()}`;
      await replyInput.fill(replyBody);
      await thread.getByTestId(/^comment-reply-send-/).click();

      await expect(thread.getByText(replyBody)).toBeVisible({ timeout: 15000 });
      await shot(page, 'comments-03-replied');
    });

    await test.step('resolve the thread with a reason', async () => {
      await thread.getByTestId(/^comment-resolve-open-/).click();
      const reasonInput = thread.locator('[data-testid^="comment-resolve-reason-"]');
      await reasonInput.fill('Addressed in v2 — no further action needed.');
      await thread.getByTestId(/^comment-resolve-confirm-/).click();

      await expect(thread.getByText(/^Resolved$/)).toBeVisible({ timeout: 15000 });
      await expect(thread.getByText(/resolved by/i)).toBeVisible();
      await shot(page, 'comments-04-resolved');
    });

    await test.step('Open / Resolved / All filters reflect the resolved thread', async () => {
      // "Open" filter must no longer show this thread.
      await page.getByTestId('comments-filter-open').click();
      await expect(
        page.locator('[data-testid^="comment-thread-"]').filter({ hasText: commentBody })
      ).toHaveCount(0);

      // "Resolved" filter must show it.
      await page.getByTestId('comments-filter-resolved').click();
      await expect(
        page.locator('[data-testid^="comment-thread-"]').filter({ hasText: commentBody })
      ).toBeVisible({ timeout: 10000 });

      // "All" filter must show it too.
      await page.getByTestId('comments-filter-all').click();
      await expect(
        page.locator('[data-testid^="comment-thread-"]').filter({ hasText: commentBody })
      ).toBeVisible({ timeout: 10000 });

      await shot(page, 'comments-05-filters');
    });

    await test.step('reopen the thread — returns to Open', async () => {
      const reopenedThread = page
        .locator('[data-testid^="comment-thread-"]')
        .filter({ hasText: commentBody });
      await reopenedThread.getByTestId(/^comment-reopen-/).click();
      await expect(reopenedThread.getByText(/^Open$/)).toBeVisible({ timeout: 15000 });

      // Confirm it shows back up under the "Open" filter.
      await page.getByTestId('comments-filter-open').click();
      await expect(
        page.locator('[data-testid^="comment-thread-"]').filter({ hasText: commentBody })
      ).toBeVisible({ timeout: 10000 });

      await shot(page, 'comments-06-reopened');
    });
  });
});
