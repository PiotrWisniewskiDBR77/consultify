import { expect, type APIRequestContext, type Page } from '@playwright/test';

import {
  getPrivilegedSessionForPage,
  privilegedAuthUser,
  TEST_SUPPORT_SETUP_HINT,
} from '../_helpers/privilegedSession';

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

function isStrictCanvasGate(): boolean {
  return process.env.E2E_STRICT_CANVAS === 'true' || Boolean(process.env.CI);
}

function isTransientConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|connect/i.test(msg);
}

async function retryRequest<T>(attempts: number, fn: () => Promise<T>) {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientConnectionError(error) || i === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function seedSessionStorage(page: Page, token: string, authUser: Record<string, unknown>) {
  await page.addInitScript(({ authToken, user }) => {
    window.localStorage.setItem('token', String(authToken));
    window.localStorage.setItem('refreshToken', 'playwright-smoke-refresh');
    window.localStorage.setItem('user', JSON.stringify(user));
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
          currentUser: user,
          currentOrganization: {
            id: user.organizationId,
            name: user.organizationName || user.companyName || 'Organization',
          },
        },
        version: 0,
      })
    );
  }, { authToken: token, user: authUser });
}

/**
 * Acquire a real session for the Work Canvas suites.
 *
 * Tier 1 — test-support bootstrap (the ONLY privileged path; fresh non-demo org).
 * Tier 2 — the gateway-only `/api/auth/demo-login` (a real seeded account; only
 *          answers when ENABLE_TEST_GATEWAY/E2E_MODE/NODE_ENV=test).
 *
 * There is deliberately NO `register-demo` tier. That endpoint is the public demo
 * signup: unprivileged by design (TEAM_MEMBER in the shared demo org) and read-only
 * (`403 DEMO_READ_ONLY` on every write). Using it here — and then writing
 * `role: 'ADMIN'` into localStorage anyway — made the client believe it had a
 * privileged session while the server refused it. A loud failure is better.
 */
async function loginViaBootstrap(page: Page, role: 'ADMIN' | 'USER', label: string): Promise<string> {
  const issues: string[] = [];
  const runId = `work-canvas-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    const session = await getPrivilegedSessionForPage(page, {
      role,
      label: `work-canvas-${label}`,
      runId,
      apiBaseUrl: API_BASE_URL,
    });
    const authUser = privilegedAuthUser(session, {
      lastName: label === 'owner' ? 'Owner' : 'Member',
    });
    await seedSessionStorage(page, session.token, authUser);
    return session.token;
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const demoLoginResponse = await page.request.post(`${API_BASE_URL}/api/auth/demo-login`, { data: {} });
    if (demoLoginResponse.ok()) {
      const login = await demoLoginResponse.json();
      const token = String(login?.token || login?.accessToken || '').trim();
      if (!token) throw new Error('demo-login payload is missing token');
      const user = (login?.user || {}) as LoginUserShape;
      // Seed the role the SERVER returned. Never `|| role` — a fabricated role makes the
      // client-side guards pass over a session the server will refuse.
      const serverRole = String(user.role || '').trim();
      if (!serverRole) throw new Error('demo-login payload is missing user.role');
      const authUser = {
        id: String(user.id || `demo-${label}`),
        email: String(user.email || `e2e+${runId}@local.test`),
        role: serverRole,
        organizationId: String(user.organizationId || 'e2e-org-id'),
        organizationName: String(user.organizationName || user.companyName || 'E2E Organization'),
        firstName: String(user.firstName || 'E2E'),
        lastName: String(user.lastName || (label === 'owner' ? 'Owner' : 'Member')),
        companyName: String(user.companyName || user.organizationName || 'E2E Organization'),
        isAuthenticated: true,
        accessLevel: 'full',
      };
      await seedSessionStorage(page, token, authUser);
      return token;
    }
    issues.push(
      `auth/demo-login ${demoLoginResponse.status()}: ${await demoLoginResponse.text().catch(() => '<no-body>')}`
    );
  } catch (error) {
    issues.push(`auth/demo-login failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // NOTE: the former third tier (`/api/auth/register-demo`, retried 6×) is gone on purpose.
  // See the doc comment above: it is the public, unprivileged, read-only demo signup.

  throw new Error(
    [
      isStrictCanvasGate()
        ? `Strict Canvas gate: unable to acquire ${label} auth token without credentials.`
        : `Unable to acquire ${label} auth token for Work Canvas tests.`,
      'Provide E2E owner/member credentials, or enable test support on the target backend.',
      TEST_SUPPORT_SETUP_HINT,
      ...issues.map((item) => `- ${item}`),
    ].join('\n')
  );
}

export async function loginAsUser(page: Page, email: string, password: string): Promise<string> {
  assertCredentials(email, password, 'E2E user credentials');
  const loginResponse = await retryRequest(5, () =>
    page.request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { email, password },
    })
  );
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

  await seedSessionStorage(page, token, derivedUser);

  return token;
}

export async function loginAsOwner(page: Page): Promise<string> {
  if (OWNER_EMAIL.trim() && OWNER_PASSWORD.trim()) {
    return loginAsUser(page, OWNER_EMAIL, OWNER_PASSWORD);
  }
  return loginViaBootstrap(page, 'ADMIN', 'owner');
}

export async function loginAsMember(page: Page): Promise<string> {
  if (MEMBER_EMAIL.trim() && MEMBER_PASSWORD.trim()) {
    return loginAsUser(page, MEMBER_EMAIL, MEMBER_PASSWORD);
  }
  return loginViaBootstrap(page, 'USER', 'member');
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
          !error.includes('Failed to fetch notifications TypeError: Failed to fetch') &&
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

// Chat-shell Canvas selectors (architecture changed 2026-06-20: the standalone
// `/ai/work-canvas` WorkCanvasShell was removed; the canvas now mounts as
// WorkCanvasDocumentPanel inside the chat split layout).
export const CANVAS_TITLE_INPUT = '[data-testid="canvas-active-title"]';
export const CANVAS_RICH_EDITOR = '[data-testid="canvas-rich-editor"] .ProseMirror';

/**
 * Suppress the FirstRunOnboarding modal + demo tours that overlay and intercept
 * clicks for fresh register-demo users. MUST be called BEFORE any page.goto so the
 * route intercept + init script are registered ahead of the first navigation.
 */
export async function suppressOnboarding(page: Page) {
  // Primary defense: force GET /api/preferences → onboarding_completed:true so the
  // FirstRunOnboarding gate never opens.
  await page.route('**/api/preferences', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    try {
      const resp = await route.fetch();
      const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      await route.fulfill({ response: resp, json: { ...json, onboarding_completed: true } });
    } catch {
      await route.fulfill({ json: { onboarding_completed: true } });
    }
  });
  // Secondary defense: seed tour-completion localStorage keys.
  await page.addInitScript(() => {
    try {
      const ls = window.localStorage;
      ls.setItem('demo_tour_completed', 'true');
      ls.setItem('demo_tour_skipped', 'true');
      ls.setItem('tour_completed', 'true');
      ls.setItem('hasSeenWelcome', 'true');
      ls.setItem(
        'consultify_completed_tours',
        JSON.stringify(['first-value', 'first_value_tour', 'work-canvas', 'chat'])
      );
    } catch {
      /* ignore */
    }
  });
}

/** Final fallback: if the first-run modal still appears, click "Skip for now". */
export async function dismissOverlayIfPresent(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const skip = page
      .getByRole('button', { name: /Skip for now|Skip tour|Pomiń|Get started/i })
      .first();
    if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skip.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    } else {
      break;
    }
  }
}

/**
 * Waits for the chat-shell Work Canvas panel to be mounted and hydrated. The old
 * standalone shell exposed a 'Save Canvas document' button as the readiness signal;
 * the chat-shell panel renders the rich editor by default, so readiness is now the
 * active-title input + the ProseMirror rich editor surface.
 */
export async function ensureWorkCanvasVisible(page: Page, expectedTitle?: string) {
  const titleInput = page.locator(CANVAS_TITLE_INPUT).first();
  const richEditor = page.locator(CANVAS_RICH_EDITOR).first();

  // NOTE: do NOT click the "Open work panel" button here. The workCanvas=1 deep-link
  // opens the panel itself; clicking the button toggles it back closed. Just wait.
  await dismissOverlayIfPresent(page);

  await expect(titleInput).toBeVisible({ timeout: 30000 });
  await expect(richEditor).toBeVisible({ timeout: 30000 });
  if (expectedTitle && expectedTitle.trim()) {
    await expect(titleInput).toHaveValue(new RegExp(escapeRegex(expectedTitle.trim())), {
      timeout: 10000,
    });
  }
}

export async function openWorkCanvasDraft(page: Page, draft: WorkCanvasDraftRef) {
  // Open the chat-shell Work Canvas deterministically: the UnifiedChatPanel deep-link
  // effect requires workCanvas=1 (or workPanel=1); ?kind=/?draftId= alone won't open it.
  await page.goto(
    `/chat?workCanvas=1&draftId=${draft.id}&conversationId=${draft.conversationId}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await ensureWorkCanvasVisible(page, draft.title);
}
