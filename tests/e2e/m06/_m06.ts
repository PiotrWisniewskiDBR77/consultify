/**
 * M06 Ideas · Mind Map — shared E2E harness (TESTY_M06 Manual gate).
 *
 * Secret-free, CI-reproducible: authenticates via /api/auth/register-demo
 * (no QA creds needed), creates an idea, opens the mind-map workspace and
 * provides a screenshot helper that writes one PNG per scenario into
 * tests/e2e/screenshots/m06/<id>.png (the artifact the Manual gate requires).
 *
 * Live target (default): localhost:3000 (frontend) + localhost:3001 (backend,
 * staging DB). Run with E2E_USE_WEB_SERVER unset so global-setup/storageState
 * are skipped and each spec authenticates itself.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

export const SHOT_DIR = path.resolve(process.cwd(), 'tests/e2e/screenshots/m06');
export const CANVAS_LABEL = 'Idea map workspace';

fs.mkdirSync(SHOT_DIR, { recursive: true });

export type DemoSession = {
  token: string;
  user: Record<string, unknown>;
};

/** Register a fresh demo user (unique per call) and return its auth token.
 *  Retries on transient 5xx (staging DB hiccups are known). */
export async function registerDemo(page: Page): Promise<DemoSession> {
  let lastErr = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nonce = `${Date.now()}-${attempt}-${Math.floor(Math.random() * 1e6)}`;
    const email = `e2e-m06-${nonce}@local.test`;
    try {
      const resp = await page.request.post('/api/auth/register-demo', {
        timeout: 45000,
        data: { email, password: `E2eM06-${nonce}-Pass1`, firstName: 'M06QA' },
      });
      if (resp.ok()) {
        const json = (await resp.json()) as {
          token?: string;
          accessToken?: string;
          user?: Record<string, unknown>;
        };
        const token = String(json.token || json.accessToken || '');
        expect(token.length, 'empty auth token from register-demo').toBeGreaterThan(0);
        return { token, user: json.user || { email } };
      }
      lastErr = `HTTP ${resp.status()}`;
    } catch (e) {
      // Transient proxy/connection reset under staging latency — retry.
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await page.waitForTimeout(1000 * (attempt + 1));
  }
  expect(false, `register-demo failed after retries: ${lastErr}`).toBeTruthy();
  throw new Error('unreachable');
}

/** Seed localStorage so the SPA treats the session as authenticated + tour-complete. */
export async function injectSession(page: Page, session: DemoSession): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('refreshToken', 'm06-e2e-refresh');
      window.localStorage.setItem('user', JSON.stringify(user));
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

/** Dismiss the onboarding tour / welcome overlay if it appears. */
export async function dismissTour(page: Page): Promise<void> {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń|Pomín/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);
  for (let i = 0; i < 8; i += 1) {
    if (await skipTour.isVisible().catch(() => false)) {
      await skipTour.click({ timeout: 1000, force: true }).catch(() => {});
    }
    if (await welcomeTitle.isVisible().catch(() => false)) {
      await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(200);
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

/** Full bootstrap: register → inject → land on dashboard (tour skipped). */
export async function bootstrap(page: Page): Promise<{ token: string; session: DemoSession }> {
  const session = await registerDemo(page);
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
  const session = await registerDemo(page);
  await injectSession(page, session);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await dismissTour(page);
  const ideaId = await createIdea(page, session.token, `M06 session ${Date.now()}`);
  await openMindmap(page, ideaId);
  return { page, token: session.token, ideaId };
}

/** Select the root (first) node on the canvas, robustly. */
export async function selectRoot(page: Page) {
  const node = page.locator('.react-flow__node').first();
  await node.waitFor({ state: 'visible', timeout: 30000 });
  await node.click();
  return node;
}

/** Exit any inline-edit mode (textarea) so keyboard grammar shortcuts apply. */
export async function exitEdit(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
}
