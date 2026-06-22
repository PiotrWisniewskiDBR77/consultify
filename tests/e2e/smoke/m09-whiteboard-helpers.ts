/**
 * M09 Ideas · Whiteboard — shared Playwright helpers.
 * Source of truth: Harvard/Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md
 *
 * Runs against the ALREADY-RUNNING dev stack (frontend :3000 + backend :3001).
 * Auth reuses the Work-Canvas bootstrap path (test-support/bootstrap → demo-login →
 * register-demo) so no real credentials are required for the local smoke run.
 *
 * Navigation contract (verified 2026-06-20 against qa-idea-mindmap-checklist.spec.ts):
 *   - create idea:  POST /api/my-work/my-ideas  → { id }
 *   - open board:   /my-work/ideas/:id/workspace/whiteboard
 *   - readiness:    region aria-label "Idea map workspace" (workspace shell) and
 *                   "Idea whiteboard with freeform elements" (canvas, i18n regionLabel)
 */
import { expect, type Page } from '@playwright/test';

import { API_BASE_URL, loginAsMember } from './work-canvas-helpers';

export const SHOT_DIR = 'tests/e2e/screenshots/m09';

// Resolved EN i18n strings (public/locales/en/translation.json → myWork.whiteboard.*)
export const WB = {
  workspaceRegion: 'Idea map workspace',
  canvasRegion: 'Idea whiteboard with freeform elements',
  toolbar: {
    create: 'Create',
    undo: 'Undo',
    redo: 'Redo',
    export: 'Export',
    save: 'Save',
    shortcuts: 'Keyboard shortcuts',
    voting: 'Voting',
    background: 'Background pattern',
    role: 'Role',
  },
  empty: { addSticky: 'Add blank sticky' },
} as const;

/** Capture console errors + 5xx responses for an assertClean() smoke gate. */
export function collectSignals(page: Page) {
  const consoleErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 500 && res.url().includes('/api/')) {
      serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });
  return {
    consoleErrors,
    serverErrors,
    assertClean() {
      const critical = consoleErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('net::ERR') &&
          !e.includes('Failed to load resource:') &&
          !/Failed to fetch (tasks|notifications)/.test(e) &&
          !e.includes('[useDemo]') &&
          !e.includes('/api/feedback/pulse') &&
          // Benign: cross-origin stylesheet cssRules access is blocked by the browser
          // (SecurityError) when a 3rd-party CSS is loaded; not an app fault.
          !e.includes('cssRules') &&
          !e.includes('inlining remote css') &&
          !e.includes('Cannot access rules')
      );
      const criticalServer = serverErrors.filter((e) => !e.includes('/api/feedback/pulse'));
      expect.soft(critical, 'no critical console errors').toEqual([]);
      expect.soft(criticalServer, 'no 5xx api errors').toEqual([]);
    },
  };
}

/** Decode the JWT payload (no verification — test helper only). */
function decodeJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function userIdFromToken(token: string): string {
  const j = decodeJwt(token);
  return String(j.id || j.userId || j.sub || '');
}

// Cache ONE owner token across all tests in this worker. The staging DB makes register-demo
// slow/contended (~18s idle, > the per-attempt helper timeout under load), so paying it once
// and reusing the token keeps each test fast and reliable.
let cachedOwnerToken: string | null = null;

/** Acquire (once) a demo OWNER token via register-demo with patient retries; cache it. */
async function ensureOwnerToken(page: Page): Promise<string> {
  if (cachedOwnerToken) return cachedOwnerToken;
  let lastErr = '';
  // Unique email per RUN — a fixed `m09-owner-${attempt}` collides with users registered by
  // any earlier run (register-demo → 400 EMAIL_IN_USE), so every re-run failed. Stamp it.
  const runNonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const resp = await page.request.post(`${API_BASE_URL}/api/auth/register-demo`, {
        timeout: 50000,
        data: {
          email: `e2e+m09-owner-${runNonce}-${attempt}@local.test`,
          password: 'Playwright#123',
          firstName: 'Owner',
        },
      });
      if (resp.ok()) {
        const json = await resp.json();
        const token = String(json?.token || json?.accessToken || '').trim();
        if (token) {
          cachedOwnerToken = token;
          return token;
        }
        lastErr = 'register-demo ok but no token';
      } else {
        lastErr = `register-demo ${resp.status()}`;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await page.waitForTimeout(1500 * (attempt + 1));
  }
  throw new Error(`ensureOwnerToken failed after retries: ${lastErr}`);
}

/** Seed a page's localStorage with an auth token + derived user (replicates app session shape). */
async function seedPageAuth(page: Page, token: string) {
  const j = decodeJwt(token);
  const user = {
    id: String(j.id || j.userId || j.sub || 'demo-owner'),
    email: String(j.email || 'e2e+m09-owner@local.test'),
    role: String(j.role || 'ADMIN'),
    organizationId: String(j.organizationId || j.orgId || 'demo-org'),
    organizationName: 'E2E Organization',
    firstName: 'Owner',
    lastName: '',
    companyName: 'E2E Organization',
    isAuthenticated: true,
    accessLevel: 'full',
  };
  await page.addInitScript(
    ({ authToken, u }) => {
      try {
        localStorage.setItem('token', String(authToken));
        localStorage.setItem('refreshToken', 'm09-smoke-refresh');
        localStorage.setItem('user', JSON.stringify(u));
        localStorage.setItem(
          'consultinity-storage',
          JSON.stringify({
            state: {
              sessionMode: 'FULL',
              currentUser: u,
              currentOrganization: { id: u.organizationId, name: u.organizationName },
            },
            version: 0,
          })
        );
      } catch {
        /* ignore */
      }
    },
    { authToken: token, u: user }
  );
}

/**
 * Suppress the FirstRunOnboarding "Meet Teresa / What brings you here?" 3-step wizard.
 * Its gate (useFirstRunOnboarding.ts) checks an INSTANT localStorage guard first:
 *   consultify_onboarding_done:{userId} === 'true'  → never opens, never calls server.
 * Setting this for the authed user id is the only reliable suppression (the /api/preferences
 * intercept governs a different chat onboarding, not this one).
 */
async function suppressFirstRunOnboarding(page: Page, token: string) {
  const uid = userIdFromToken(token);
  await page.addInitScript((userId: string) => {
    try {
      if (userId) localStorage.setItem(`consultify_onboarding_done:${userId}`, 'true');
    } catch {
      /* ignore */
    }
  }, uid);
}

async function seedTourSuppression(page: Page) {
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
  await page.addInitScript(() => {
    try {
      const ls = window.localStorage;
      ls.setItem('demo_tour_completed', 'true');
      ls.setItem('demo_tour_skipped', 'true');
      ls.setItem('tour_completed', 'true');
      ls.setItem('hasSeenWelcome', 'true');
      ls.setItem(
        'consultify_completed_tours',
        JSON.stringify(['first-value', 'first_value_tour', 'work-canvas', 'chat', 'my-work'])
      );
    } catch {
      /* ignore */
    }
  });
}

export async function dismissOverlay(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const skip = page
      .getByRole('button', { name: /Skip for now|Skip tour|Pomiń|Get started|Consultant|Konsultant/i })
      .first();
    if (await skip.isVisible({ timeout: 800 }).catch(() => false)) {
      await skip.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
}

/** Create an idea via API; returns the idea id. */
export async function createIdea(page: Page, token: string, title = 'M09 Whiteboard E2E'): Promise<string> {
  const resp = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { title, summary: 'Playwright M09 whiteboard manual schema', kind: 'whiteboard' },
  });
  expect(resp.ok(), `create idea → ${resp.status()}`).toBe(true);
  const json = await resp.json();
  const id = String(json?.id || json?.data?.id || '');
  expect(id, 'idea id present').toBeTruthy();
  return id;
}

export type WbSession = { token: string; ideaId: string };

/** Full owner setup: auth → idea → open whiteboard → canvas ready. */
export async function openWhiteboardAsOwner(page: Page, title?: string): Promise<WbSession> {
  await seedTourSuppression(page);
  const token = await ensureOwnerToken(page); // cached across tests → pay register-demo once
  await seedPageAuth(page, token);
  await suppressFirstRunOnboarding(page, token);
  const ideaId = await createIdea(page, token, title);
  await page.goto(`/my-work/ideas/${ideaId}/workspace/whiteboard`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await dismissOverlay(page);
  await expect(page.getByLabel(WB.workspaceRegion)).toBeVisible({ timeout: 30000 });
  await waitForWhiteboardReady(page);
  return { token, ideaId };
}

/** Member (non-owner, same org via bootstrap) opening an existing idea's whiteboard. */
export async function openWhiteboardAsMember(page: Page, ideaId: string): Promise<string> {
  await seedTourSuppression(page);
  const token = await loginAsMember(page);
  await suppressFirstRunOnboarding(page, token);
  await page.goto(`/my-work/ideas/${ideaId}/workspace/whiteboard`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await dismissOverlay(page);
  return token;
}

/**
 * Wait until the whiteboard surface is loaded AND interactive. The workspace region
 * becomes visible early while the idea/map data is still hydrating ("Loading" spinner);
 * interacting in that window drops nodes. Readiness = no "Loading" text + ReactFlow pane
 * mounted (or the empty-state CTA present) + network settled.
 */
export async function waitForWhiteboardReady(page: Page) {
  // networkidle is best-effort: the app polls (notifications/presence) so it rarely fully
  // idles — keep the budget small so we don't burn the whole test timeout here.
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  // The whiteboard hydration is slow on staging (map fetch + facilitation session + presence,
  // each at ~2s latency) — the "Loading" overlay can sit for tens of seconds. Wait for a REAL
  // interactivity signal (the toolbar Create button OR the empty-state CTA), not just the pane.
  await page
    .waitForFunction(
      () => {
        const txts = Array.from(document.querySelectorAll('div, span, p'));
        const loading = txts.some(
          (e) => e.children.length === 0 && /^Loading…?$/i.test((e.textContent || '').trim())
        );
        // The ReactFlow pane only mounts once the whiteboard's own loading prop is false
        // (otherwise the canvas area is an animate-pulse skeleton). Require the pane OR the
        // empty-state CTA — both mean the canvas is interactive, not skeleton.
        const hasPane = !!document.querySelector('.react-flow__pane');
        const hasEmptyCta = Array.from(document.querySelectorAll('button')).some((b) =>
          /add blank sticky/i.test(b.textContent || '')
        );
        // No large skeleton block lingering in the canvas region.
        const bigSkeleton = Array.from(document.querySelectorAll('.animate-pulse')).some(
          (e) => (e as HTMLElement).offsetHeight > 80
        );
        return !loading && !bigSkeleton && (hasPane || hasEmptyCta);
      },
      { timeout: 60000 }
    )
    .catch(() => {});
  await page.waitForTimeout(600);

  // CRITICAL: a brand-new idea auto-seeds a mindmap "root" node into the SHARED my_idea_maps
  // doc shortly after load (version bumps 1→2). If we edit + save before that settles, the
  // whiteboard save races it, 409s, and conflict-recovery re-hydrates over the unsaved node.
  // Wait until /map writes go quiet (no POST/PUT for 2.5s), capped at 12s.
  let lastWrite = Date.now();
  const onResp = (res: { url: () => string; request: () => { method: () => string } }) => {
    try {
      if (
        /\/api\/my-work\/my-ideas\/.+\/map(\/sync)?/.test(res.url()) &&
        ['POST', 'PUT'].includes(res.request().method())
      ) {
        lastWrite = Date.now();
      }
    } catch {
      /* ignore */
    }
  };
  page.on('response', onResp as never);
  const start = Date.now();
  while (Date.now() - lastWrite < 2000 && Date.now() - start < 8000) {
    await page.waitForTimeout(400);
  }
  page.off('response', onResp as never);
  await page.waitForTimeout(400);
}

/** Count ReactFlow nodes currently rendered on the canvas. */
export async function nodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node').count();
}

/**
 * Fit all nodes into the viewport so react-flow will let us click them.
 *
 * After several adds the nodes drift off-screen and react-flow refuses to click them
 * ("Element is outside of the viewport") even with force:true (same headless failure mode
 * proven on M06). UNLIKE the Mind Map, the whiteboard's CanvasZoomControls Maximize2 button
 * is wired to FULLSCREEN, not Fit-view (IdeaWhiteboardTool.tsx:441 passes onFullscreenToggle),
 * so there is NO "Fit view" toolbar button to click here. The whiteboard instead binds fit to
 * the keyboard: Cmd/Ctrl+0 (and Shift+1) — IdeaWhiteboardTool.tsx:196-205. We click the pane
 * first to ensure the canvas has focus, then press the shortcut.
 */
export async function fitView(page: Page): Promise<void> {
  // Focus the canvas (the keydown listener is window-level, but clicking the pane also
  // dismisses any open menu/editor that would swallow the shortcut). force+catch: the pane
  // itself can be off-actionability mid-animation.
  await page.locator('.react-flow__pane').first().click({ force: true }).catch(() => {});
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+0`).catch(() => {});
  await page.waitForTimeout(450); // fit animation (duration 300 + settle)
}

/**
 * Select the nth canvas node robustly: fitView (Cmd/Ctrl+0) brings the graph on-screen,
 * then force-click past react-flow's transform/animation actionability wait. Headless can
 * still resolve a node outside a small viewport — swallow that (downstream selection-state
 * guards honest-skip). Returns false only if the node does not exist at all.
 */
export async function selectNodeByIndex(page: Page, idx = 0): Promise<boolean> {
  const node = page.locator('.react-flow__node').nth(idx);
  if ((await page.locator('.react-flow__node').count()) <= idx) return false;
  await fitView(page);
  await node.click({ force: true }).catch(() => {});
  await page.waitForTimeout(250);
  return true;
}

/**
 * Save the board and wait for a 2xx /map(/sync) response. The shared my_idea_maps doc
 * bumps version per write, so a save racing the mindmap auto-seed can 409; after a 409 the
 * client re-hydrates to the current version, so a retry succeeds. Returns true on a 2xx.
 */
export async function saveBoard(page: Page): Promise<boolean> {
  const isMac = process.platform === 'darwin';
  for (let i = 0; i < 2; i += 1) {
    const wait = page
      .waitForResponse(
        (r) =>
          /\/api\/my-work\/my-ideas\/.+\/map(\/sync)?/.test(r.url()) &&
          ['POST', 'PUT'].includes(r.request().method()),
        { timeout: 8000 }
      )
      .catch(() => null);
    await page.getByRole('button', { name: 'Save', exact: true }).first().click({ force: true }).catch(() => {});
    await page.keyboard.press(isMac ? 'Meta+s' : 'Control+s').catch(() => {});
    const resp = await wait;
    if (resp && resp.status() >= 200 && resp.status() < 300) return true;
    await page.waitForTimeout(1300); // let the client re-hydrate version after a 409
  }
  return false;
}

/** Click a toolbar button by its resolved aria-label / accessible name. */
export async function clickToolbar(page: Page, name: string) {
  await page.getByRole('button', { name, exact: false }).first().click({ force: true });
}

/**
 * Add one sticky node, robust to layout: Create main button (onMainClick →
 * addElement('sticky')) → "Sticky" rail tool → empty-state "Add blank sticky" CTA.
 * Returns true if the rendered node count grew.
 */
export async function addSticky(page: Page): Promise<boolean> {
  const before = await nodeCount(page);
  const grew = async () => (await nodeCount(page)) > before;

  await page.getByRole('button', { name: 'Create', exact: true }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  if (await grew()) return true;

  await page.getByRole('button', { name: 'Sticky', exact: true }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  if (await grew()) return true;

  await page.getByRole('button', { name: /Add blank sticky/i }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  return grew();
}

/** Open the Create dropdown (caret "Create options") and click an item by label. */
export async function addViaCreateMenu(page: Page, itemLabel: RegExp): Promise<boolean> {
  const before = await nodeCount(page);
  // Open the split-button menu via the "Create options" caret.
  await page.getByRole('button', { name: 'Create options', exact: true }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  // The menu is a portal; the item may report not-"visible" mid-animation, so scroll + force-click
  // unconditionally rather than gating on isVisible (which skipped the click headless → 0 shapes added).
  const item = page.getByRole('menuitem', { name: itemLabel }).first();
  await item.scrollIntoViewIfNeeded().catch(() => {});
  await item.click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  return (await nodeCount(page)) > before;
}

/**
 * Persist a labeled sticky deterministically via the documented sync endpoint the UI uses
 * (POST /my-ideas/:id/map/sync with preferredTool='whiteboard'), reading the CURRENT version
 * first so it never conflicts. Proves the persistence + hydration + render contract end-to-end
 * without being hostage to the fresh-idea client-side version race. Returns the sticky label.
 */
export async function persistStickyViaApi(page: Page, ideaId: string, token: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const getResp = await page.request.get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, {
    headers: auth,
  });
  const getJson = (await getResp.json().catch(() => ({}))) as any;
  const map = getJson?.map ?? getJson ?? {};
  const existingNodes: any[] = Array.isArray(map?.nodes) ? map.nodes : [];
  const version = Number(map?.version ?? 1) || 1;
  const label = `PERSIST-PROBE-${ideaId.slice(0, 8)}`;
  const sticky = {
    id: `wb-probe-${ideaId.slice(0, 6)}`,
    type: 'stickyNote',
    position: { x: 240, y: 160 },
    data: { label },
  };
  const postResp = await page.request.post(
    `${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map/sync`,
    {
      headers: auth,
      data: {
        nodes: [...existingNodes, sticky],
        edges: Array.isArray(map?.edges) ? map.edges : [],
        baseVersion: version,
        preferredTool: 'whiteboard',
        extensions: map?.extensions && typeof map.extensions === 'object' ? map.extensions : {},
      },
    }
  );
  expect.soft(postResp.ok(), `persist sticky via /map/sync → ${postResp.status()}`).toBe(true);
  return label;
}

/** Screenshot helper → tests/e2e/screenshots/m09/<id>.png */
export async function shot(page: Page, id: string) {
  await page.screenshot({ path: `${SHOT_DIR}/${id}.png`, fullPage: false });
}
