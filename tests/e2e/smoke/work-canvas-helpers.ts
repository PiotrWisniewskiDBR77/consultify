import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || 'piotr.wisniewski@dbr77.com';
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || '123456';

export async function loginAsOwner(page: Page): Promise<string> {
  const loginResponse = await page.request.post(`${API_BASE_URL}/api/auth/login`, {
    data: {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    },
  });
  expect(loginResponse.ok()).toBe(true);

  const login = await loginResponse.json();
  const token = login.token || login.accessToken;
  expect(token).toBeTruthy();

  await page.addInitScript((authToken) => {
    window.localStorage.setItem('token', String(authToken));
    window.localStorage.setItem(
      'consultinity_demo_session',
      JSON.stringify({
        sessionId: 'work-canvas-playwright-smoke',
        startTime: new Date().toISOString(),
        hasCompletedTour: true,
        hasSeenWelcome: true,
        hasInteractedWithAI: true,
        aiInteractionsUsed: 1,
        featuresExplored: ['work-canvas'],
        upgradePromptsShown: 0,
        exitIntentTriggered: false,
        milestones: [],
      })
    );
  }, token);

  return token;
}

export async function createWorkCanvasDraft(
  request: APIRequestContext,
  token: string,
  input?: Partial<{
    conversationId: string;
    kind: string;
    title: string;
    content: string;
    projectId: string | null;
  }>
) {
  const title = input?.title || 'Zrób z tej rozmowy krótką notatkę po prawej stronie.';
  const conversationId =
    input?.conversationId ||
    (
      await createConversationWithMessage(request, token, {
        title: `Work Canvas source: ${title}`,
        content: 'Source conversation for a Work Canvas draft.',
      })
    ).id;
  const response = await request.post(`${API_BASE_URL}/api/work-canvas/drafts`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      conversationId,
      kind: input?.kind || 'markdown',
      title,
      content:
        input?.content ||
        `# ${title}\n\n## Working Note\n\n${title}\n\n## Next Questions\n\n- What decision should this support?\n- Which sources should be attached?`,
      sources: [],
      provenance: { source: 'playwright-smoke' },
      projectId: input?.projectId ?? null,
    },
  });

  expect(response.ok()).toBe(true);
  const json = await response.json();
  expect(json?.data?.id).toBeTruthy();
  return json.data as { id: string; conversationId: string; title: string };
}

export async function createConversationWithMessage(
  request: APIRequestContext,
  token: string,
  input?: Partial<{
    title: string;
    content: string;
  }>
) {
  const title = input?.title || 'Work Canvas linked conversation';
  const content =
    input?.content || 'This message proves the left Work Canvas pane uses the existing chat.';
  const conversationResponse = await request.post(`${API_BASE_URL}/api/conversations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { title, language: 'en' },
  });

  expect(conversationResponse.ok()).toBe(true);
  const conversation = await conversationResponse.json();
  expect(conversation?.id).toBeTruthy();

  const messageResponse = await request.post(
    `${API_BASE_URL}/api/conversations/${conversation.id}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        role: 'user',
        content,
        messageType: 'text',
      },
    }
  );

  expect(messageResponse.ok()).toBe(true);
  return { id: String(conversation.id), title, content };
}

export function collectPageSignals(page: Page) {
  const consoleErrors: string[] = [];
  const failedWorkCanvasResponses: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/work-canvas') && response.status() >= 500) {
      failedWorkCanvasResponses.push(`${response.status()} ${url}`);
    }
  });

  return {
    consoleErrors,
    failedWorkCanvasResponses,
    assertClean(options?: { allowFailedWorkCanvasPath?: RegExp }) {
      const criticalJsErrors = consoleErrors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('net::ERR') &&
          !error.includes('Failed to load resource:') &&
          !error.includes('Failed to fetch tasks TypeError: Failed to fetch') &&
          !error.includes('[useDemo] Status fetch failed: TypeError: Failed to fetch')
      );
      const blockingWorkCanvasResponses = failedWorkCanvasResponses.filter(
        (response) => !options?.allowFailedWorkCanvasPath?.test(response)
      );
      expect(criticalJsErrors).toEqual([]);
      expect(blockingWorkCanvasResponses).toEqual([]);
    },
  };
}

export async function expectNoRawInternals(page: Page) {
  await expect(page.getByText(/\[object Object\]|Invalid Date|TypeError|ReferenceError/)).toHaveCount(
    0
  );
}
