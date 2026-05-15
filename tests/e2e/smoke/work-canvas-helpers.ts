import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || '';
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || '';
export const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL || '';
export const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD || '';

type LoginUserShape = Partial<{
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  companyName: string;
}>;

type WorkCanvasDraftRef = {
  id: string;
  conversationId: string;
  title?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertCredentials(email: string, password: string, label: string) {
  expect(email.trim().length, `${label}: missing email env`).toBeGreaterThan(0);
  expect(password.trim().length, `${label}: missing password env`).toBeGreaterThan(0);
}

export async function loginAsUser(page: Page, email: string, password: string): Promise<string> {
  assertCredentials(email, password, 'E2E user credentials');
  const loginResponse = await page.request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBe(true);

  const login = await loginResponse.json();
  const token = login.token || login.accessToken;
  expect(token).toBeTruthy();
  const user = (login.user || {}) as LoginUserShape;
  const derivedUser = {
    id: String(user.id || `smoke-${Date.now()}`),
    email: String(user.email || email),
    role: String(user.role || 'USER'),
    organizationId: String(user.organizationId || 'unknown-org'),
    organizationName: String(user.organizationName || user.companyName || 'Unknown Organization'),
    firstName: String(user.firstName || ''),
    lastName: String(user.lastName || ''),
    companyName: String(user.companyName || user.organizationName || 'Unknown Organization'),
    isAuthenticated: true,
    accessLevel: 'full',
  };

  await page.addInitScript(({ authToken, authUser }) => {
    window.localStorage.setItem('token', String(authToken));
    window.localStorage.setItem('refreshToken', 'playwright-smoke-refresh');
    window.localStorage.setItem('user', JSON.stringify(authUser));
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
    window.localStorage.setItem(
      'consultinity-storage',
      JSON.stringify({
        state: {
          sessionMode: 'FULL',
          currentUser: authUser,
          currentOrganization: {
            id: authUser.organizationId,
            name: authUser.organizationName || authUser.companyName || 'Organization',
          },
        },
        version: 0,
      })
    );
  }, { authToken: token, authUser: derivedUser });

  return token;
}

export async function loginAsOwner(page: Page): Promise<string> {
  assertCredentials(OWNER_EMAIL, OWNER_PASSWORD, 'E2E owner credentials');
  return loginAsUser(page, OWNER_EMAIL, OWNER_PASSWORD);
}

export async function loginAsMember(page: Page): Promise<string> {
  assertCredentials(MEMBER_EMAIL, MEMBER_PASSWORD, 'E2E member credentials');
  return loginAsUser(page, MEMBER_EMAIL, MEMBER_PASSWORD);
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

export async function ensureWorkCanvasVisible(page: Page, expectedTitle?: string) {
  const titleInput = page.getByLabel('Canvas document title');
  const saveButton = page.getByRole('button', { name: 'Save Canvas document' });
  const openPanelButton = page
    .locator('button[aria-label="Open work panel"], [data-testid="chat-work-panel-button"]')
    .first();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inputVisible = await titleInput.isVisible({ timeout: 2500 }).catch(() => false);
    const saveVisible = await saveButton.isVisible({ timeout: 2500 }).catch(() => false);

    if (inputVisible && saveVisible) {
      if (expectedTitle && expectedTitle.trim()) {
        await expect(titleInput).toHaveValue(new RegExp(escapeRegex(expectedTitle.trim())), {
          timeout: 10000,
        });
      }
      return;
    }

    const canOpenPanel = await openPanelButton.isVisible({ timeout: 1000 }).catch(() => false);
    if (canOpenPanel) {
      await openPanelButton.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(1200);
  }

  await expect(titleInput).toBeVisible({ timeout: 10000 });
  await expect(saveButton).toBeVisible({ timeout: 10000 });
  if (expectedTitle && expectedTitle.trim()) {
    await expect(titleInput).toHaveValue(new RegExp(escapeRegex(expectedTitle.trim())), {
      timeout: 10000,
    });
  }
}

export async function openWorkCanvasDraft(page: Page, draft: WorkCanvasDraftRef) {
  await page.goto(`/ai/work-canvas?draftId=${draft.id}&conversationId=${draft.conversationId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await ensureWorkCanvasVisible(page, draft.title);
}
