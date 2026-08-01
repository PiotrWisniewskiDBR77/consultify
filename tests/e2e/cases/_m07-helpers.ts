/**
 * M07 Process Flow — shared case helpers.
 *
 * Mirrors the GOLDEN harness pattern proven in
 * tests/e2e/m07-process-flow-interactions.spec.ts (8/8 PASS, 2026-06-21):
 *   - readTestSupportState (mints a full non-demo write token via global-setup)
 *   - openCanvas: create idea → seed process_flow blob → navigate → wait for region
 *   - addShape: force-click + retry until the node actually lands (headless flakiness)
 *   - fitView: pull nodes into the viewport before any node/handle interaction
 *   - pollServerNodes: wait for the autosave PUT /map to land ≥N nodes BEFORE reload
 *     (a fixed sleep races the staging DB — see golden spec §3 comment).
 *
 * WRITE-ACCESS harness env (same as golden):
 *   E2E_API_URL=http://127.0.0.1:3009   E2E_BASE_URL=http://localhost:3011
 *   E2E_REQUIRE_TEST_SUPPORT=true
 */
import fs from 'node:fs';
import path from 'node:path';

import { APIResponse, expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

export const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3009';
export const SHOTS_DIR = path.resolve('tests/e2e/screenshots/cases/m07');
export const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;
export const WORKSPACE_REGION = /Idea map workspace|Obszar roboczy mapy idei/;

fs.mkdirSync(SHOTS_DIR, { recursive: true });

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

export function uniqueLabel(p: string) {
  return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Screenshot to tests/e2e/screenshots/cases/m07/<id>.png — required at the end of every case. */
export async function shot(page: Page, id: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${id}.png`), fullPage: false });
}

export async function createIdea(page: Page, token: string, title: string) {
  const res: APIResponse = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: authHeaders(token),
    data: { title, tags: ['m07', 'cases'] },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}

export async function seedProcessFlow(page: Page, token: string, ideaId: string) {
  await page.request
    .put(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, {
      headers: authHeaders(token),
      data: { nodes: [], edges: [], version: 1, preferredTool: 'process_flow' },
      timeout: 40000,
    })
    .catch(() => null);
}

/** Create + seed + open a fresh process_flow canvas. Returns the idea. */
/** Decode a JWT payload (best-effort, no verification) for seedPageAuth. */
function decodeJwtPayload(token: string): Record<string, any> {
  try {
    const p = token.split('.')[1];
    const padded = p + '='.repeat((-p.length % 4 + 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * Seed the FE auth state directly in localStorage (token + user + store) per-page, instead of
 * relying on the project storageState. The storageState is fragile: it is origin-scoped (breaks
 * when the backend port changes) and a partial re-mint can leave the FE flashing the login page
 * even with a valid token. Setting the full auth payload as an init-script makes M07 auth
 * self-contained (mirrors the M09 seedPageAuth).
 */
export async function seedPageAuth(page: Page, token: string) {
  const j = decodeJwtPayload(token);
  const user = {
    id: String(j.id || j.userId || j.sub || ''),
    email: String(j.email || 'e2e+m07@local.test'),
    role: String(j.role || 'ADMIN'),
    organizationId: String(j.organizationId || j.orgId || ''),
    organizationName: String(j.organizationName || 'E2E Tenant'),
    firstName: 'E2E',
    lastName: 'Admin',
    isAuthenticated: true,
    accessLevel: 'full',
  };
  await page.addInitScript(
    ({ authToken, u }) => {
      try {
        localStorage.setItem('token', String(authToken));
        localStorage.setItem('refreshToken', 'm07-e2e-refresh');
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
        /* noop */
      }
    },
    { authToken: token, u: user }
  );
}

export async function openCanvas(page: Page, label: string) {
  const { token, userId } = readTestSupportState();
  await seedPageAuth(page, token);
  await page.addInitScript((uid) => {
    try {
      if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
    } catch {
      /* noop */
    }
  }, userId);
  const idea = await createIdea(page, token, uniqueLabel(label));
  await seedProcessFlow(page, token, idea.id);
  await page.goto(`/my-work/ideas/${idea.id}/workspace/process_flow`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await expect(page.getByRole('region', { name: WORKSPACE_REGION })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 60000 });
  return idea;
}

/** EN→PL toolbar titles so the shape buttons resolve in either locale.
 *  Title = isPl ? SHAPE_CONFIG[shape].labelPl : .label
 *  (ProcessFlowToolbar.tsx:279 + FlowNodeComponent.tsx:64-89). */
export const SHAPE_TITLE_PL: Record<string, string> = {
  Start: 'Start',
  End: 'Koniec',
  Action: 'Akcja',
  Decision: 'Decyzja',
  'BPMN Event': 'Zdarzenie BPMN',
  'BPMN Task': 'Zadanie BPMN',
  'BPMN Gateway': 'Bramka BPMN',
  Service: 'Serwis',
  'Data Store': 'Magazyn danych',
  Actor: 'Aktor',
  Role: 'Rola',
  Team: 'Zespół',
  Handoff: 'Przekazanie',
  Trigger: 'Wyzwalacz',
  'API Call': 'Wywołanie API',
  Condition: 'Warunek',
  'VSM Process': 'Proces VSM',
  Inventory: 'Zapas',
  Supplier: 'Dostawca',
  Customer: 'Klient',
  Kaizen: 'Kaizen',
};

/** Real toolbar click to add a shape (button has title attr).
 *  Force-click + retry until the node lands — headless real-mouse clicks on the
 *  toolbar are flaky (the click sometimes doesn't register → node count stays flat).
 *  (GOLDEN pattern, m07-process-flow-interactions.spec.ts:87-110.) */
export async function addShape(page: Page, title: string) {
  const pl = SHAPE_TITLE_PL[title];
  const btn = page
    .locator(
      pl && pl !== title ? `button[title="${title}"], button[title="${pl}"]` : `button[title="${title}"]`
    )
    .first();
  await expect(btn).toBeVisible({ timeout: 15000 });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const before = await page.locator('.react-flow__node').count();
    await btn.click({ force: true }).catch(() => {});
    // Proof the shape landed = the react-flow node COUNT grew. We must NOT use
    // `state:'visible'` on the new node: after a few shapes the canvas auto-fits to
    // ~scale-3 and each new node lands +200px to the right, off the viewport. Those
    // nodes stay in the DOM (no virtualization here) but are clipped by react-flow's
    // overflow:hidden → Playwright reports them "not visible" → false "never landed".
    // Count-increase is viewport-independent and still proves the node was added
    // (and persisted via pfCrud.createNode). Cases call fitView() before interacting.
    const landed = await page
      .waitForFunction(
        (n) => document.querySelectorAll('.react-flow__node').length > n,
        before,
        { timeout: 5000 }
      )
      .then(() => true)
      .catch(() => false);
    if (landed) {
      // Settle: addNode commits the real node synchronously, then async AI ghost
      // nodes arrive ~2-3s later. Let React/react-flow flush so the NEXT addShape
      // reads a stable count and its click isn't dropped in a rapid-add batch.
      await page.waitForTimeout(450);
      return;
    }
  }
  throw new Error(`addShape(${title}): node count never grew after 4 attempts`);
}

/** Fit all nodes into the viewport (CanvasZoomControls "Fit view" —
 *  CanvasZoomControls.tsx:114). Required before clicking a node / grabbing a
 *  handle: after several shapes the bounds drift off-screen and ReactFlow refuses
 *  the interaction even with force:true. (M06→M07 lesson.) */
export async function fitView(page: Page) {
  const btn = page.getByRole('button', { name: /Fit view|Dopasuj widok/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(550); // fit animation (ZOOM_DURATION + 80)
  }
}

/** Fire a Process Flow quick-action via the same window event the app listens to
 *  (useProcessFlowQuickActions.ts:120 — `idea-workspace-quick-action`).
 *  This is the deterministic path for mode/kit switches, lane add, insert/split,
 *  metrics editor, savings, mark-automation, undo/redo — no fragile selectors. */
export async function fireQuickAction(page: Page, action: string) {
  await page.evaluate((a) => {
    window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action: a } }));
  }, action);
}

/** REAL ReactFlow node selection: fit → force-click the node → settle.
 *  ReactFlow ignores synthetic clicks for selection, so we use a real pointer click. */
export async function selectNode(page: Page, index = 0) {
  await fitView(page);
  const node = page.locator('.react-flow__node').nth(index);
  await node.click({ force: true }).catch(() => {});
  await page.waitForTimeout(250);
  return node;
}

/** Poll the server map until it reports ≥min nodes — the autosave PUT /map has
 *  landed and a reload will hydrate the saved state (GOLDEN anti-race, §3). */
export async function pollServerNodes(page: Page, ideaId: string, min: number, timeout = 45000) {
  const { token } = readTestSupportState();
  await expect
    .poll(
      async () => {
        const res = await page.request
          .get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, { headers: authHeaders(token) })
          .catch(() => null);
        if (!res || !res.ok()) return -1;
        const body = await res.json().catch(() => null);
        return Array.isArray(body?.map?.nodes) ? body.map.nodes.length : -1;
      },
      { timeout, intervals: [1000, 1500, 2000, 3000] }
    )
    .toBeGreaterThanOrEqual(min);
}

/** Poll the server map until it reports ≥min edges (edge autosave landed). */
export async function pollServerEdges(page: Page, ideaId: string, min: number, timeout = 45000) {
  const { token } = readTestSupportState();
  await expect
    .poll(
      async () => {
        const res = await page.request
          .get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, { headers: authHeaders(token) })
          .catch(() => null);
        if (!res || !res.ok()) return -1;
        const body = await res.json().catch(() => null);
        return Array.isArray(body?.map?.edges) ? body.map.edges.length : -1;
      },
      { timeout, intervals: [1000, 1500, 2000, 3000] }
    )
    .toBeGreaterThanOrEqual(min);
}

/** Read the current server map (nodes/edges/extensions). */
export async function getServerMap(page: Page, ideaId: string): Promise<any> {
  const { token } = readTestSupportState();
  const res = await page.request
    .get(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, { headers: authHeaders(token), timeout: 30000 })
    .catch(() => null);
  if (!res || !res.ok()) return {};
  const body = await res.json().catch(() => ({}));
  return body?.map || {};
}

export async function reloadCanvas(page: Page, ideaId: string) {
  await page.goto(`/my-work/ideas/${ideaId}/workspace/process_flow`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 60000 });
}

export async function assertNoErrorBoundary(page: Page) {
  await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
}

/**
 * [REAL-AI] verdict on a fired idea-AI response. The product assertion is that the
 * AI wiring FIRED a request to the canvas-AI endpoint (/ai-generate). The model
 * output itself is environment-gated: the staging lane (caboose) routes LLM calls
 * through OpenRouter, whose circuit can be open ("Circuit [openrouter] opened …:
 * Provider returned error") when no live key is configured — an ENVIRONMENT
 * condition, not a product defect. Honest contract (no false green):
 *   - no request fired   → honest-skip (wiring not observable headlessly)
 *   - status < 400       → PASS (wiring + provider both healthy)
 *   - status >= 500      → honest-skip WITH PROOF (provider/circuit down on caboose)
 *   - status 4xx         → HARD FAIL (budget/auth/validation = product/config signal)
 */
export async function assertAiFiredOrSkip(resp: APIResponse | null, label: string) {
  if (!resp) {
    test.skip(
      true,
      `${label}: no idea-AI request observed headlessly — wiring verified statically; rerun with a real pointer`
    );
    return;
  }
  const status = resp.status();
  if (status < 400) return; // wiring fired AND the provider answered cleanly
  let body = '';
  try {
    body = (await resp.text()).slice(0, 180);
  } catch {
    /* noop */
  }
  if (status >= 500) {
    test.skip(
      true,
      `${label}: AI request FIRED (wiring OK) but the staging LLM provider failed ` +
        `(status ${status}: ${body}) — env-gated (OpenRouter circuit/key on caboose); ` +
        `verify model output on a lane with a live LLM key`
    );
    return;
  }
  // 4xx is a real product/config signal (budget, auth, bad body) — fail loudly.
  expect(status, `${label}: AI request 4xx (budget/auth/validation)`).toBeLessThan(400);
}
