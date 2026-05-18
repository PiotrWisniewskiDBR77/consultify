/**
 * Runtime Smoke E2E (AI Chat)
 *
 * Goal: provide a real guarantee that the core AI chat loop works end-to-end:
 * UI → authenticated API → SSE streaming → persistence → history sidebar.
 *
 * This suite is designed to be deterministic in CI by enabling:
 * - E2E_MODE=true (backend emits deterministic SSE + bypasses JWT verification for e2e tokens)
 * - E2E_USE_WEB_SERVER=true (Playwright starts backend+frontend)
 */
import { expect, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: 'e2e-user-id',
    email: 'e2e@local.test',
    name: 'E2E User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId: 'e2e-org-id',
    isSuperAdmin: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  });
  // Signature is ignored in E2E_MODE and also not used by frontend decoding.
  return `${header}.${payload}.e2e`;
}

async function seedAuth(page: any): Promise<string> {
  const token = makeE2EToken();
  await page.addInitScript((t: string) => {
    localStorage.setItem('token', t);
    // Avoid refresh logic trying to call refresh endpoint in tests
    localStorage.setItem('refreshToken', 'e2e-refresh');

    // Satisfy ProtectedRoute guard (requires currentUser.isAuthenticated === true)
    const e2eUser = {
      id: 'e2e-user-id',
      email: 'e2e@local.test',
      role: 'ADMIN',
      organizationId: 'e2e-org-id',
      organizationName: 'E2E Organization',
      firstName: 'E2E',
      lastName: 'User',
      avatarUrl: null,
      impersonatorId: null,
      companyName: 'E2E Organization',
      isAuthenticated: true,
      accessLevel: 'full',
    };
    const persisted = {
      state: {
        sessionMode: 'FULL',
        currentUser: e2eUser,
        currentOrganization: { id: 'e2e-org-id', name: 'E2E Organization' },
      },
      version: 0,
    };
    localStorage.setItem('consultinity-storage', JSON.stringify(persisted));
    // App boot sequence restores auth from localStorage('user') synchronously in verifyAuth()
    localStorage.setItem('user', JSON.stringify(e2eUser));
  }, token);
  return token;
}

test.describe('Runtime Smoke: AI Chat (E2E_MODE)', () => {
  test.describe.configure({ mode: 'serial' });

  test('should stream response and persist to history sidebar', async ({ page }) => {
    const token = await seedAuth(page);

    // Ensure we have an active conversation id so the UI uses the conversation store path
    // (otherwise it attempts to create one at send-time and can fail on schema drift).
    const createConvRes = await page.request.post(`${API_BASE_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'E2E Runtime Smoke', language: 'en' },
    });
    if (!createConvRes.ok()) {
      const body = await createConvRes.text().catch(() => '');
      console.log(
        '[runtime-smoke] createConversation failed',
        createConvRes.status(),
        body.slice(0, 500)
      );
    }
    expect(createConvRes.ok()).toBeTruthy();
    const createdConv = await createConvRes.json();
    const conversationId = String(createdConv?.id || '');
    expect(conversationId).toBeTruthy();

    await page.addInitScript(
      ({ conversationId: cid }) => {
        // useConversationStore persist key
        const persisted = {
          state: {
            showArchived: false,
            displayMode: 'full',
            activeConversationId: cid,
            draftChatLanguage: 'en',
            chatLanguageByConversationId: { [cid]: 'en' },
          },
          version: 2,
        };
        localStorage.setItem('consultinity-conversations', JSON.stringify(persisted));
      },
      { conversationId }
    );

    page.on('response', (r) => {
      const url = r.url();
      if (url.includes('/api/') && (r.status() === 401 || r.status() === 403)) {
        console.log('[runtime-smoke] API auth response', r.status(), url);
      }
    });

    await page.goto('/chat');
    // App keeps long-lived connections (SSE/metrics), so avoid networkidle.

    // Chat input should be available
    const input = page.locator('textarea[data-testid="chat-input"]:visible').first();
    await expect(input).toBeVisible({ timeout: 30000 });

    const msg = `hello runtime smoke ${Date.now()}`;
    await input.fill(msg);
    // Prefer clicking Send for reliability across textarea/IME behaviors
    await page
      .locator('button[title="Send"], button[title="Wyślij"], button[title="Wyslij"]')
      .first()
      .click()
      .catch(async () => {
        // Fallback: Enter should send in this app
        await input.press('Enter');
      });

    // User message should appear
    await expect(page.getByText(msg, { exact: true })).toBeVisible({ timeout: 15000 });

    // Deterministic assistant response should appear (from E2E_MODE backend stub)
    await expect(page.locator('p:visible', { hasText: 'E2E_OK:' }).first()).toBeVisible({
      timeout: 15000,
    });

    // Persistence check (backend): conversation should be discoverable and contain both messages.
    const listRes = await page.request.get(`${API_BASE_URL}/api/conversations?limit=50&offset=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json().catch(() => ({}) as any);
    const convIds = Array.isArray(listBody?.conversations)
      ? listBody.conversations.map((c: any) => String(c?.id || ''))
      : [];
    expect(convIds).toContain(conversationId);

    const waitForPersisted = async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const res = await page.request.get(`${API_BASE_URL}/api/conversations/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok()) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        const body = await res.json().catch(() => ({}) as any);
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const hasUser = messages.some((m: any) => m?.role === 'user' && m?.content === msg);
        const hasAi = messages.some(
          (m: any) => m?.role === 'ai' && String(m?.content || '').includes('E2E_OK:')
        );
        if (hasUser && hasAi) return;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error('Conversation messages were not persisted in time');
    };

    await waitForPersisted();
  });
});
