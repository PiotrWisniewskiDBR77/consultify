import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  authHeaders,
  setupDocumentStudioSession,
} from '../documents/_document-studio-helpers';

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const CONVERSATIONS_API = `${API_BASE_URL}/api/conversations`;

test.describe('CHAT-01 durable tenant-scoped session', () => {
  test('message read-back/reopen survives and foreign tenant cannot read or append', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const content = `CHAT01 durable owner message ${marker}`;
    let conversationId = '';

    try {
      const created = await page.request.post(CONVERSATIONS_API, {
        headers: authHeaders(token),
        data: { title: `CHAT01 ${marker}`, language: 'en' },
      });
      expect(created.status()).toBe(201);
      conversationId = String((await created.json()).id || '');
      expect(conversationId).toBeTruthy();

      const message = await page.request.post(
        `${CONVERSATIONS_API}/${encodeURIComponent(conversationId)}/messages`,
        {
          headers: authHeaders(token),
          data: {
            role: 'user',
            content,
            messageType: 'text',
            clientMessageId: `chat01-${marker}`,
          },
        }
      );
      expect(message.status()).toBe(201);

      const ownerRead = await page.request.get(
        `${CONVERSATIONS_API}/${encodeURIComponent(conversationId)}`,
        { headers: authHeaders(token) }
      );
      expect(ownerRead.status()).toBe(200);
      expect((await ownerRead.json()).messages).toEqual(
        expect.arrayContaining([expect.objectContaining({ content })])
      );

      await page.goto(`/chat/${encodeURIComponent(conversationId)}`);
      await expect(page.getByText(content, { exact: true })).toBeVisible({ timeout: 30_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}$`));
      await expect(page.getByText(content, { exact: true })).toBeVisible({ timeout: 30_000 });

      const otherSession = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: `chat01-isolation-${marker}`, role: 'ADMIN' },
      });
      expect(otherSession.status()).toBe(200);
      const otherToken = String((await otherSession.json()).token || '');

      const deniedRead = await page.request.get(
        `${CONVERSATIONS_API}/${encodeURIComponent(conversationId)}`,
        { headers: authHeaders(otherToken) }
      );
      expect(deniedRead.status()).toBe(404);
      const deniedAppend = await page.request.post(
        `${CONVERSATIONS_API}/${encodeURIComponent(conversationId)}/messages`,
        {
          headers: authHeaders(otherToken),
          data: { role: 'user', content: 'foreign write', messageType: 'text' },
        }
      );
      expect(deniedAppend.status()).toBe(404);

      const finalOwnerRead = await page.request.get(
        `${CONVERSATIONS_API}/${encodeURIComponent(conversationId)}`,
        { headers: authHeaders(token) }
      );
      expect(finalOwnerRead.status()).toBe(200);
      const messages = (await finalOwnerRead.json()).messages as Array<{ content: string }>;
      expect(messages.map((item) => item.content)).toEqual([content]);
    } finally {
      if (conversationId) {
        await page.request.delete(`${CONVERSATIONS_API}/${encodeURIComponent(conversationId)}?hard=true`, {
          headers: authHeaders(token),
        });
      }
    }
  });
});
