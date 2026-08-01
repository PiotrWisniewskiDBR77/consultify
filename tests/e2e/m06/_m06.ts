/**
 * M06 Ideas · Mind Map — shared E2E harness (TESTY_M06 Manual gate).
 *
 * Authenticates via POST /api/test-support/bootstrap ONLY (a real fresh org, a
 * real member, a NON-demo write-access token), creates an idea, opens the
 * mind-map workspace and provides a screenshot helper that writes one PNG per
 * scenario into tests/e2e/screenshots/m06/<id>.png (the artifact the Manual gate
 * requires).
 *
 * There is deliberately NO `/api/auth/register-demo` fallback. That endpoint is
 * the public demo signup: unprivileged by design (TEAM_MEMBER in the shared demo
 * org) and read-only — POST /map/sync answers 403 DEMO_READ_ONLY — which broke
 * every persistence scenario (§2.1 sync=200, §15.6 reload-persists) while the
 * canvas still looked fine client-side. Requires on the target backend:
 *   ENABLE_TEST_SUPPORT=true   TEST_SUPPORT_KEY=<>=12 chars>   NODE_ENV != production
 * and the same TEST_SUPPORT_KEY on the runner.
 *
 * Live target (default): localhost:3000 (frontend) + localhost:3001 (backend,
 * staging DB). Run with E2E_USE_WEB_SERVER unset so global-setup/storageState
 * are skipped and each spec authenticates itself.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { getPrivilegedSessionForPage } from '../_helpers/privilegedSession';

export const SHOT_DIR = path.resolve(process.cwd(), 'tests/e2e/screenshots/m06');
export const CANVAS_LABEL = 'Idea map workspace';

fs.mkdirSync(SHOT_DIR, { recursive: true });

export type DemoSession = {
  token: string;
  user: Record<string, unknown>;
};

/**
 * Mint a full WRITE-ACCESS (non-demo) session via test-support bootstrap.
 *
 * MANDATORY — throws (naming ENABLE_TEST_SUPPORT / TEST_SUPPORT_KEY) when
 * test-support is unavailable. See the file header for why there is no
 * register-demo fallback.
 *
 * The bootstrap request is issued RELATIVE (apiBaseUrl: '') so it goes through
 * the same origin/proxy the rest of this harness uses.
 */
export async function authenticate(page: Page): Promise<DemoSession> {
  const session = await getPrivilegedSessionForPage(page, {
    role: 'ADMIN',
    label: 'm06',
    apiBaseUrl: '',
    timeoutMs: 45000,
  });
  return {
    token: session.token,
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
      organizationId: session.organizationId,
    },
  };
}


/** Seed localStorage so the SPA treats the session as authenticated + tour-complete. */
export async function injectSession(page: Page, session: DemoSession): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('refreshToken', 'm06-e2e-refresh');
      window.localStorage.setItem('user', JSON.stringify(user));
      // Suppress the "Meet Teresa" first-run onboarding modal — its only dismiss
      // controls navigate away from the map (handleSkip → DEFAULT_ENTRY_ROUTE),
      // so it must be pre-completed, not clicked through. Key per useFirstRunOnboarding.ts.
      const uid = (user as { id?: string })?.id;
      if (uid) window.localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
      window.localStorage.setItem(
        'consultinity_demo_session',
        JSON.stringify({
          sessionId: 'm06-e2e',
          startTime: new Date().toISOString(),
          hasCompletedTour: true,
          hasSeenWelcome: true,
          hasInteractedWithAI: true,
          aiInteractionsUsed: 1,
          featuresExplored: ['mindmap'],
        })
      );
    },
    { token: session.token, user: session.user }
  );
}

/** Dismiss the onboarding tour / welcome overlay if it appears.
 *  Covers two distinct overlays: the legacy "Welcome to Consultinity" tour AND
 *  the "Meet Teresa" 3-step welcome modal whose dismiss control reads
 *  "Skip for now" (NOT "Skip tour") — the latter blocks the whole canvas. */
export async function dismissTour(page: Page): Promise<void> {
  const skipTour = page
    .getByRole('button', { name: /Skip tour|Skip for now|Pomiń|Pomín|Pomiń teraz/i })
    .first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(
    /Welcome to Consultinity|Witamy w Consultinity|Welcome to Consultify|Meet Teresa|Poznaj Teresę/i
  );
  for (let i = 0; i < 10; i += 1) {
    if (await skipTour.isVisible().catch(() => false)) {
      await skipTour.click({ timeout: 1000, force: true }).catch(() => {});
    } else if (await welcomeTitle.isVisible().catch(() => false)) {
      await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(250);
  }
}

/** Create a mind-map idea (Recommendation map tool) and return its id. */
export async function createIdea(
  page: Page,
  token: string,
  title = `M06 QA ${Date.now()}`,
  body = 'M06 manual-gate seed'
): Promise<string> {
  let lastErr = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const resp = await page.request.post('/api/my-work/my-ideas', {
        timeout: 30000,
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        data: { title, body, tags: ['qa', 'mindmap'] },
      });
      if (resp.ok()) {
        const created = (await resp.json()) as { id?: string };
        const id = String(created.id || '');
        expect(id.length, 'empty idea id').toBeGreaterThan(0);
        return id;
      }
      lastErr = `HTTP ${resp.status()}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await page.waitForTimeout(900 * (attempt + 1));
  }
  expect(false, `create idea failed after retries: ${lastErr}`).toBeTruthy();
  throw new Error('unreachable');
}

/**
 * Module-level cached session. Bootstrap creates a user + org + triggers an org-context
 * snapshot rebuild — doing it once per TEST (128×) saturates the staging pool and hangs the
 * backend. With workers=1 this module is shared across all M06 specs in the run, so we
 * authenticate ONCE and every test reuses the token (each still creates its own isolated idea).
 */
let _cachedSession: DemoSession | null = null;

export async function getSharedSession(page: Page): Promise<DemoSession> {
  if (_cachedSession && _cachedSession.token) return _cachedSession;
  _cachedSession = await authenticate(page);
  return _cachedSession;
}

/** Drop the cached session (call on a 401 so the next bootstrap re-authenticates). */
export function resetSharedSession(): void {
  _cachedSession = null;
}

/** Full bootstrap: reuse shared session → inject → land on dashboard (tour skipped). */
export async function bootstrap(page: Page): Promise<{ token: string; session: DemoSession }> {
  const session = await getSharedSession(page);
  await injectSession(page, session);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await dismissTour(page);
  return { token: session.token, session };
}

/** Open the mind-map workspace for an idea and wait for the canvas. */
export async function openMindmap(page: Page, ideaId: string): Promise<void> {
  await page.goto(`/my-work/ideas/${ideaId}/workspace/mindmap`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await dismissTour(page);
  await expect(page.getByLabel(CANVAS_LABEL)).toBeVisible({ timeout: 45000 });
}

/** Capture the scenario screenshot (one PNG per scenario id). */
export async function shot(page: Page, id: string): Promise<string> {
  const file = path.join(SHOT_DIR, `${id}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** Convenience: number of rendered react-flow nodes. */
export async function nodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node').count();
}

/**
 * Shared-session setup for describe.serial blocks: ONE register/create/mount
 * per spec file (instead of per test) — far faster + less staging load.
 * Returns a dedicated page already on the mind-map canvas.
 */
export async function openSession(
  browser: import('@playwright/test').Browser
): Promise<{ page: Page; token: string; ideaId: string }> {
  const page = await browser.newPage();
  const session = await getSharedSession(page);
  await injectSession(page, session);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await dismissTour(page);
  const ideaId = await createIdea(page, session.token, `M06 session ${Date.now()}`);
  await openMindmap(page, ideaId);
  return { page, token: session.token, ideaId };
}

/** Fit all nodes into the viewport (CanvasZoomControls "Fit view" button).
 *  After adding several children the root drifts off-screen, so react-flow refuses to
 *  click it ("outside of viewport") even with force:true. Fit first → nodes in view. */
export async function fitView(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Fit view|Dopasuj widok/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(550); // fit animation
  }
}

/** Select the root (first) node on the canvas, robustly.
 *  fitView() brings it on-screen; force:true bypasses react-flow's transform/animation
 *  actionability wait — we only need it selected for keyboard grammar. */
export async function selectRoot(page: Page) {
  const node = page.locator('.react-flow__node').first();
  await node.waitFor({ state: 'visible', timeout: 30000 });
  await fitView(page);
  // Headless viewport can be smaller than the fitted graph bounds; if the node still
  // resolves off-viewport, swallow it — downstream selection-state guards honest-skip.
  await node.click({ force: true }).catch(() => {});
  return node;
}

/** Select the nth canvas node robustly (fit + force-click past react-flow actionability).
 *  Returns true if the node existed and was clicked, false if not present (caller honest-skips). */
export async function selectNodeByIndex(page: Page, idx: number): Promise<boolean> {
  const node = page.locator('.react-flow__node').nth(idx);
  if (!(await node.isVisible().catch(() => false))) return false;
  await fitView(page);
  await node.click({ force: true }).catch(() => {});
  await page.waitForTimeout(250);
  return true;
}

/** Exit any inline-edit mode (textarea) so keyboard grammar shortcuts apply. */
export async function exitEdit(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
}
