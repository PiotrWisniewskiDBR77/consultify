import fs from 'node:fs';
import path from 'node:path';

import { request, type APIRequestContext, type FullConfig } from '@playwright/test';

import {
  STORAGE_STATE_PATH,
  TEST_SUPPORT_STATE_PATH,
  type TestSupportState,
} from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const FRONTEND_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRunId(): string {
  const explicit = String(process.env.E2E_RUN_ID || '').trim();
  if (explicit) return explicit;
  const gh = String(process.env.GITHUB_RUN_ID || '').trim();
  const attempt = String(process.env.GITHUB_RUN_ATTEMPT || '').trim();
  const nonce = Date.now().toString(36);
  if (gh) return `gh-${gh}${attempt ? `-${attempt}` : ''}-${nonce}`;
  return `local-${nonce}`;
}

async function waitForApiReadiness(apiBaseUrl: string, timeoutMs: number) {
  const req = await request.newContext({ baseURL: apiBaseUrl });
  const startedAt = Date.now();
  let lastError: string | null = null;
  try {
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const res = await req.get('/api/health/ping');
        if (res.ok()) return;
        lastError = `${res.status()} ${res.statusText()}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await sleep(1000);
    }
  } finally {
    await req.dispose();
  }
  throw new Error(`api readiness timeout after ${timeoutMs}ms: ${lastError || '<no response>'}`);
}

async function tryRegisterFallback(
  req: APIRequestContext,
  runId: string
): Promise<TestSupportState | null> {
  const slug = runId.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const email = `e2e+${slug}-fallback@local.test`;
  const password = `E2E-${Date.now()}-Pass1`;
  // Use the regular /register endpoint so the created user is NOT a demo user.
  // /register-demo sets isDemo=true which triggers DEMO_READ_ONLY mode and breaks tests.
  const res = await req.post('/api/auth/register', {
    data: {
      email,
      password,
      firstName: 'E2E',
      lastName: 'Test',
      companyName: `E2E-${slug}`,
    },
  });
  if (!res.ok()) return null;
  const payload = (await res.json()) as any;
  const token = String(payload?.token || payload?.accessToken || '').trim();
  const userId = String(payload?.user?.id || '').trim();
  const organizationId = String(payload?.user?.organizationId || '').trim();
  if (!token || !userId || !organizationId) return null;
  return { runId, token, userId, organizationId };
}

export default async function globalSetup(_config: FullConfig) {
  const runId = computeRunId();
  const key = String(process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me').trim();
  await waitForApiReadiness(API_BASE_URL, 180000);

  const req = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { 'x-test-support-key': key },
  });

  let data: TestSupportState | null = null;
  let lastError: string | null = null;
  const deadlineMs = Date.now() + 10 * 60 * 1000; // 10 minutes (cold starts can be long)
  while (Date.now() < deadlineMs) {
    try {
      const res = await req.post('/api/test-support/bootstrap', { data: { runId } });
      if (res.ok()) {
        data = (await res.json()) as TestSupportState;
        break;
      }

      const status = res.status();
      const statusText = res.statusText();
      const bodyText = await res.text().catch(() => '<unreadable>');
      lastError = `${status} ${statusText} ${bodyText}`;

      let bodyJson: any = null;
      try {
        bodyJson = JSON.parse(bodyText);
      } catch {
        // ignore
      }

      const isServerStarting =
        status === 503 &&
        (bodyJson?.code === 'SERVER_STARTING' ||
          String(bodyJson?.error || '').includes('Server starting'));

      const isTestSupportRouteMissing = status === 404;

      if (isTestSupportRouteMissing) {
        // Some environments intentionally don't expose /api/test-support.
        // Fall back to tryRegisterFallback() — the REGULAR /api/auth/register signup, NOT
        // /api/auth/register-demo (that one is the public unprivileged read-only demo entry).
        break;
      }

      if (!isServerStarting) {
        throw new Error(`test-support bootstrap failed: ${lastError}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lastError = msg;
      // During startup Playwright can hit a short window where backend socket is not open yet.
      const isConnectionRace =
        /ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|connect/i.test(msg) &&
        Date.now() + 1000 < deadlineMs;
      if (!isConnectionRace) throw error;
    }
    await sleep(1000);
  }

  if (!data) {
    const fallbackState = await tryRegisterFallback(req, runId).catch(() => null);
    if (fallbackState) {
      data = fallbackState;
    } else {
      throw new Error(
        `test-support bootstrap failed after retries (runId=${runId}): ${lastError || '<no response>'}`
      );
    }
  }
  if (!data?.token || !data?.organizationId) {
    throw new Error('test-support bootstrap returned invalid payload');
  }

  fs.mkdirSync(path.dirname(TEST_SUPPORT_STATE_PATH), { recursive: true });
  fs.writeFileSync(TEST_SUPPORT_STATE_PATH, JSON.stringify(data, null, 2), 'utf8');

  const demoSession = JSON.stringify({
    sessionId: 'e2e',
    startTime: new Date().toISOString(),
    hasCompletedTour: true,
    hasSeenWelcome: true,
    hasInteractedWithAI: false,
    aiInteractionsUsed: 0,
    featuresExplored: [],
    upgradePromptsShown: 0,
    exitIntentTriggered: false,
    milestones: [],
  });

  const seededUser = {
    id: data.userId,
    email: `e2e+${runId}@local.test`,
    role: 'ADMIN',
    organizationId: data.organizationId,
    organizationName: 'E2E Organization',
    firstName: 'E2E',
    lastName: 'User',
    avatarUrl: null,
    impersonatorId: null,
    companyName: 'E2E Organization',
    isAuthenticated: true,
    accessLevel: 'full',
    isDemo: false,
  };

  const persistedAppState = JSON.stringify({
    state: {
      sessionMode: 'FULL',
      isDemoMode: false,
      isDemoSession: false,
      currentUser: seededUser,
      currentOrganization: {
        id: data.organizationId,
        name: 'E2E Organization',
      },
    },
    version: 0,
  });

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: FRONTEND_BASE_URL.replace(/\/$/, ''),
        localStorage: [
          { name: 'token', value: data.token },
          { name: 'refreshToken', value: 'e2e-refresh' },
          { name: 'user', value: JSON.stringify(seededUser) },
          { name: 'consultify-storage', value: persistedAppState },
          { name: 'consultify_demo_session', value: demoSession },
        ],
      },
    ],
  };

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2), 'utf8');

  await req.dispose();
}
