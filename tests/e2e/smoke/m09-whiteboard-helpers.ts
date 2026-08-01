/**
 * M09 Ideas · Whiteboard — shared Playwright helpers.
 * Source of truth: Harvard/Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md
 *
 * Runs against the ALREADY-RUNNING dev stack (frontend :3000 + backend :3001).
 * The owner session is minted via test-support bootstrap ONLY (see
 * tests/e2e/_helpers/privilegedSession.ts): this suite creates ideas and writes
 * board state, and the public `register-demo` signup is unprivileged + read-only
 * by design, so it can never stand in. Requires ENABLE_TEST_SUPPORT=true and a
 * matching TEST_SUPPORT_KEY on the target backend.
 *
 * Navigation contract (verified 2026-06-20 against qa-idea-mindmap-checklist.spec.ts):
 *   - create idea:  POST /api/my-work/my-ideas  → { id }
 *   - open board:   /my-work/ideas/:id/workspace/whiteboard
 *   - readiness:    region aria-label "Idea map workspace" (workspace shell) and
 *                   "Idea whiteboard with freeform elements" (canvas, i18n regionLabel)
 */
import { expect, type Page } from '@playwright/test';

import {
  getPrivilegedSessionForPage,
  type PrivilegedSession,
} from '../_helpers/privilegedSession';
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

// Cache ONE owner session across all tests in this worker. Bootstrap creates a real org +
// member, so paying it once and reusing the token keeps each test fast and reliable.
let cachedOwnerSession: PrivilegedSession | null = null;

/**
 * Acquire (once) a privileged, NON-demo OWNER session via test-support bootstrap; cache it.
 * There is deliberately no register-demo fallback: that endpoint is the public, unprivileged,
 * read-only demo signup, and a whiteboard suite that writes boards would 403 on every save
 * while the client still believed it was an admin.
 */
async function ensureOwnerSession(page: Page): Promise<PrivilegedSession> {
  if (cachedOwnerSession) return cachedOwnerSession;
  cachedOwnerSession = await getPrivilegedSessionForPage(page, {
    role: 'ADMIN',
    label: 'm09-owner',
    apiBaseUrl: API_BASE_URL,
    timeoutMs: 50000,
  });
  return cachedOwnerSession;
}

async function ensureOwnerToken(page: Page): Promise<string> {
  return (await ensureOwnerSession(page)).token;
}

/** Seed a page's localStorage with an auth token + derived user (replicates app session shape).
 *  The role comes from the SERVER-signed token — never defaulted to 'ADMIN', so a privilege
 *  mismatch shows up as a failing client guard instead of silently 403-ing every API call. */
async function seedPageAuth(page: Page, token: string) {
  const j = decodeJwt(token);
  const user = {
    id: String(j.id || j.userId || j.sub || 'demo-owner'),
    email: String(j.email || 'e2e+m09-owner@local.test'),
    role: String(j.role || ''),
    isSuperAdmin: j.isSuperAdmin === true,
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
/**
 * Persist preferredTool='whiteboard' on the idea's /map so the workspace hydrates on the
 * whiteboard surface (not the process_flow default). Best-effort: a fresh idea has version 1
 * and no nodes; we write an empty board with the preference set.
 */
export async function seedWhiteboardPreference(page: Page, ideaId: string, token: string): Promise<void> {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const getResp = await page.request
    .get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, { headers: auth })
    .catch(() => null);
  const getJson = (getResp ? await getResp.json().catch(() => ({})) : {}) as any;
  const map = getJson?.map ?? getJson ?? {};
  await page.request
    .post(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map/sync`, {
      headers: auth,
      data: {
        nodes: Array.isArray(map?.nodes) ? map.nodes : [],
        edges: Array.isArray(map?.edges) ? map.edges : [],
        baseVersion: Number(map?.version ?? 1) || 1,
        preferredTool: 'whiteboard',
        extensions: map?.extensions && typeof map.extensions === 'object' ? map.extensions : {},
      },
    })
    .catch(() => {});
}

export async function openWhiteboardAsOwner(page: Page, title?: string): Promise<WbSession> {
  await seedTourSuppression(page);
  const token = await ensureOwnerToken(page); // cached across tests → pay bootstrap once
  await seedPageAuth(page, token);
  await suppressFirstRunOnboarding(page, token);
  const ideaId = await createIdea(page, token, title);
  // Persist preferredTool='whiteboard' on the server map before navigating (best-effort nudge).
  // NOTE: a fresh idea can still render Process Flow due to a MyWorkHub tool-mount race (the
  // process_flow tool briefly wins activeTool, seeds a title node, and autosaves
  // preferredTool='process_flow' which then sticks) — see ensureWhiteboardTool + the per-case
  // honest-skip guards in MC-09-04/08. This is a real product routing bug (IdeaMapWorkspace.tsx
  // activeTool=externalActiveTool ?? internalActiveTool; MyWorkHub.tsx:1386 path-intent effect),
  // not a test defect.
  await seedWhiteboardPreference(page, ideaId, token);
  await page.goto(`/my-work/ideas/${ideaId}/workspace/whiteboard`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await dismissOverlay(page);
  await expect(page.getByLabel(WB.workspaceRegion)).toBeVisible({ timeout: 30000 });
  await waitForWhiteboardReady(page);
  await ensureWhiteboardTool(page);
  return { token, ideaId };
}

/**
 * Ensure the Whiteboard tool is the active surface. The URL `/workspace/whiteboard` carries
 * initialTool='whiteboard', but a fresh idea's workspace can settle on another tool
 * (process_flow/mindmap) after first hydration — a MyWorkHub remount race (same class as the
 * M08 table-tool race). When it lands on Process Flow, the whiteboard Create menu is absent
 * and every sticky/shape add is a silent no-op. The tool switcher (IdeaWorkspaceToolbar.tsx:125,
 * title="Whiteboard"/"Tablica", onToolChange('whiteboard')) is the deterministic, idempotent
 * fix. Marker: any whiteboard-only create affordance.
 */
export async function ensureWhiteboardTool(page: Page) {
  // Whiteboard-ONLY markers: the Create split-button caret (populated board) or the empty-state
  // "Add blank sticky" CTA. Process Flow has neither — so this never false-positives on the
  // wrong tool. Click the Whiteboard tab unconditionally each attempt (idempotent) because the
  // remount race can switch BACK to process_flow after an initial correct mount.
  const marker = page
    .getByRole('button', { name: /Create options|Add blank sticky/i })
    .first();
  const wbTab = page.locator('button[title="Whiteboard"], button[title="Tablica"]').first();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await marker.isVisible({ timeout: 2000 }).catch(() => false)) return;
    if (await wbTab.isVisible().catch(() => false)) {
      await wbTab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    } else {
      await page.waitForTimeout(800);
    }
  }
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
  // The Create split-button menu is a portal whose open/close races the headless click —
  // a single open+click frequently misses (menu not yet mounted, or item mid-animation),
  // leaving the board un-grown. Retry the whole open→click→verify cycle until a node
  // actually renders (bounded), so callers get a reliable add instead of a silent no-op.
  const baseline = await nodeCount(page);
  // A FRESH whiteboard starts EMPTY: the canvas shows the empty-state CTA ("Add blank
  // sticky"), and the toolbar's "Create options" split-button is not mounted yet. Adding
  // the first node reveals the full toolbar. So if the board is empty, prime it with a
  // sticky (addSticky handles the empty-state CTA) before driving the Create menu.
  if (baseline === 0) {
    const createCaret = page.getByRole('button', { name: 'Create options', exact: true }).first();
    if (!(await createCaret.isVisible({ timeout: 1500 }).catch(() => false))) {
      await addSticky(page);
      await page.waitForTimeout(400);
    }
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const before = await nodeCount(page);
    await page
      .getByRole('button', { name: 'Create options', exact: true })
      .first()
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(400);
    // The menu is a portal; the item may report not-"visible" mid-animation, so scroll +
    // force-click unconditionally rather than gating on isVisible.
    const item = page.getByRole('menuitem', { name: itemLabel }).first();
    await item.scrollIntoViewIfNeeded().catch(() => {});
    await item.click({ force: true }).catch(() => {});
    // Wait for the node to actually mount (react-flow render), polling up to ~3s.
    for (let i = 0; i < 6; i += 1) {
      await page.waitForTimeout(500);
      if ((await nodeCount(page)) > before) return true;
    }
    // Click missed (menu stayed open / stole focus) — dismiss and retry.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  return (await nodeCount(page)) > baseline;
}

/**
 * Persist a labeled sticky deterministically via the documented sync endpoint the UI uses
 * (POST /my-ideas/:id/map/sync with preferredTool='whiteboard'), reading the CURRENT version
 * first so it never conflicts. Proves the persistence + hydration + render contract end-to-end
 * without being hostage to the fresh-idea client-side version race. Returns the sticky label.
 */
/**
 * Append nodes to the idea's /map via the same POST /map/sync the autosave uses, then return
 * the fresh server map. Reads the current version first (a brand-new idea auto-seeds a root and
 * bumps version 1→2, so a stale baseVersion would 409). The seeded nodes are byte-identical to
 * what the whiteboard Create button produces (type:'shapeNode'+data.shape / type:'stickyNote'+
 * data.colorIndex — IdeaWhiteboardTool.tsx:1525-1594) and what hydrate() reads back (:903,955),
 * so this exercises the REAL serialization+persistence contract — it is not a mock. Used to make
 * MC-09-04/08 deterministic despite the headless Create-menu + tool-mount race.
 */
export async function seedNodesViaApi(
  page: Page,
  ideaId: string,
  token: string,
  newNodes: any[]
): Promise<any> {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const getResp = await page.request.get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, {
    headers: auth,
  });
  const map = (((await getResp.json().catch(() => ({}))) as any)?.map ?? {}) as any;
  const existing = Array.isArray(map?.nodes) ? map.nodes : [];
  const post = await page.request.post(
    `${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map/sync`,
    {
      headers: auth,
      data: {
        nodes: [...existing, ...newNodes],
        edges: Array.isArray(map?.edges) ? map.edges : [],
        baseVersion: Number(map?.version ?? 1) || 1,
        preferredTool: 'whiteboard',
        extensions: map?.extensions && typeof map.extensions === 'object' ? map.extensions : {},
      },
    }
  );
  expect.soft(post.ok(), `seed nodes via /map/sync → ${post.status()}`).toBe(true);
  const after = await page.request.get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, {
    headers: auth,
  });
  return (((await after.json().catch(() => ({}))) as any)?.map ?? {}) as any;
}

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
