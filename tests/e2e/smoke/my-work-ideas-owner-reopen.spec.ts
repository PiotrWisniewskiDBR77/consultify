import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  authHeaders,
  setupDocumentStudioSession,
} from '../documents/_document-studio-helpers';

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const IDEAS_API = `${API_BASE_URL}/api/my-work/my-ideas`;

test.describe('MW-09 Ideas owner lifecycle', () => {
  test('create → update/read-back → hard-reload list/open → cross-tenant 404', async ({ page }) => {
    const token = await setupDocumentStudioSession(page);
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const originalTitle = `MW09 owner idea ${marker}`;
    const updatedTitle = `MW09 durable idea ${marker}`;
    let ideaId = '';

    try {
      const created = await page.request.post(IDEAS_API, {
        headers: authHeaders(token),
        data: {
          title: originalTitle,
          body: 'Initial owner-scoped content',
          tags: ['mw09', 'owner'],
        },
      });
      expect(created.status()).toBe(201);
      ideaId = String((await created.json()).id || '');
      expect(ideaId).toBeTruthy();

      const updated = await page.request.put(`${IDEAS_API}/${encodeURIComponent(ideaId)}`, {
        headers: authHeaders(token),
        data: {
          title: updatedTitle,
          body: 'Durable body after update',
          tags: ['mw09', 'durable'],
          stage: 'explore',
        },
      });
      expect(updated.ok()).toBeTruthy();

      const readBack = await page.request.get(`${IDEAS_API}/${encodeURIComponent(ideaId)}`, {
        headers: authHeaders(token),
      });
      expect(readBack.status()).toBe(200);
      const persisted = await readBack.json();
      expect(persisted).toEqual(
        expect.objectContaining({
          id: ideaId,
          title: updatedTitle,
          body: 'Durable body after update',
          stage: 'explore',
        })
      );
      expect(persisted.tags).toEqual(expect.arrayContaining(['mw09', 'durable']));

      await page.goto('/my-work/ideas');
      const ideaTitle = page.getByText(updatedTitle, { exact: false }).first();
      await expect(ideaTitle).toBeVisible({ timeout: 30_000 });
      await page.reload();
      await expect(ideaTitle).toBeVisible({ timeout: 30_000 });
      await ideaTitle.click();
      await expect(page.getByText('Durable body after update', { exact: false }).first()).toBeVisible({
        timeout: 15_000,
      });

      const otherSession = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: `mw09-isolation-${marker}`, role: 'ADMIN' },
      });
      expect(otherSession.status()).toBe(200);
      const otherToken = String((await otherSession.json()).token || '');
      const deniedRead = await page.request.get(`${IDEAS_API}/${encodeURIComponent(ideaId)}`, {
        headers: authHeaders(otherToken),
      });
      expect(deniedRead.status()).toBe(404);
      const deniedWrite = await page.request.put(`${IDEAS_API}/${encodeURIComponent(ideaId)}`, {
        headers: authHeaders(otherToken),
        data: { title: 'must not overwrite owner idea' },
      });
      expect(deniedWrite.status()).toBe(404);

      const ownerStillWins = await page.request.get(`${IDEAS_API}/${encodeURIComponent(ideaId)}`, {
        headers: authHeaders(token),
      });
      expect(ownerStillWins.status()).toBe(200);
      expect((await ownerStillWins.json()).title).toBe(updatedTitle);
    } finally {
      if (ideaId) {
        await page.request.delete(`${IDEAS_API}/${encodeURIComponent(ideaId)}`, {
          headers: authHeaders(token),
        });
      }
    }
  });
});
