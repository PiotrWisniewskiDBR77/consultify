/**
 * Multiplayer collaboration — Process Flow, two real browser contexts.
 *
 * Real, running two-client counterpart to tests/e2e/m07-process-flow-collab.spec.ts
 * (which is entirely `test.skip('[MANUAL] ...')` — see its header: "STATUS:
 * SKELETON, NOT RUN LIVE"). This spec mirrors the proven org-scoping +
 * membership-gate fix from tests/e2e/tools/collab-whiteboard.spec.ts (read
 * that file's header first — same recipe, adapted to Process Flow's node-add
 * gesture).
 *
 * ORG-SCOPING FIX (same root cause as collab-whiteboard.spec.ts /
 * collab-mindmap.spec.ts / collab-ideas-table.spec.ts): a naive "second user"
 * bootstrapped on its own mints its OWN fresh org, landing on a DIFFERENT
 * board. Fix: mint the member's token via the E2E_MODE unsigned-JWT auth bypass
 * (server/src/middleware/auth.middleware.ts ~L1030-1114) with the SAME
 * organizationId decoded from the owner's real test-support token.
 *
 * AUTH: the owner session comes from test-support bootstrap only (see
 * tests/e2e/_helpers/privilegedSession.ts). Requires ENABLE_TEST_SUPPORT=true +
 * a matching TEST_SUPPORT_KEY on the target backend.
 *
 * MEMBERSHIP-GATE (same as collab-whiteboard.spec.ts / collab-mindmap.spec.ts):
 * mindmap/whiteboard/process_flow are just different `preferredTool` values
 * on the SAME `/my-ideas/:id/map` resource, gated behind
 * `assertIdeaMembership()` (server/src/realtime/ideaMapAccess.ts:37-60)
 * whenever `ENABLE_SHARED_IDEA_MAPS` is true (default true). The E2E-bypass
 * middleware never inserts an `organization_members` row for the synthetic
 * member, so this spec MUST run with `ENABLE_SHARED_IDEA_MAPS=false` on the
 * harness command (see task report for the exact run line) — a real
 * server-side fallback path (plain org-scope check), not a test workaround.
 *
 * Node-add gesture: same toolbar click already proven in
 * tests/e2e/tools/idea-process-flow.spec.ts (single-user persistence
 * variant) — empty-state "Add start" CTA, or the `button[title="Action"]`
 * shape-toolbar button once a start node exists.
 *
 * Two assertions, in order of strength (both `expect.soft`, matching the
 * collab-whiteboard.spec.ts convention — that suite still carries a documented
 * pre-existing flakiness independent of this spec):
 *   1. PRIMARY (realtime): member's node count increases within ~1.5s of the
 *      owner adding a step, with NO reload — proves the WS graph_patch push
 *      (relay layer proven headlessly by
 *      tests/integration/gateways/ideaCollabWs.orgscope.test.ts) works
 *      end-to-end in the browser.
 *   2. FALLBACK (persistence): after a reload, the member sees the step the
 *      owner added.
 */
import { expect, type Page, test } from '@playwright/test';

import { getPrivilegedSessionForPage } from '../_helpers/privilegedSession';
import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const WORKSPACE_REGION = /Idea map workspace|Obszar roboczy mapy idei/;

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/** Same-org E2E-bypass token for a second, distinct user (see header comment). */
function makeSameOrgMemberToken(organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: `e2e-pf-member-${Date.now().toString(36)}`,
    email: 'e2e-pf-member@local.test',
    name: 'E2E PF Member',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  });
  return `${header}.${payload}.e2e`;
}

/** Acquire an OWNER token via test-support bootstrap (mirrors m09-whiteboard-helpers.ts).
 *  No register-demo fallback: the owner here CREATES an idea and writes the flow graph, and
 *  the public demo signup is unprivileged + read-only (403 DEMO_READ_ONLY) by design. */
async function ensureOwnerToken(page: Page): Promise<string> {
  const session = await getPrivilegedSessionForPage(page, {
    role: 'ADMIN',
    label: 'pf-collab-owner',
    apiBaseUrl: API_BASE_URL,
    timeoutMs: 50000,
  });
  return session.token;
}

/** Seed localStorage from the SIGNED token — the role is never defaulted to 'ADMIN', so a
 *  privilege mismatch surfaces instead of hiding behind a passing client guard. */
async function seedPageAuth(page: Page, token: string) {
  const j = decodeJwt(token);
  const user = {
    id: String(j.id || j.userId || j.sub || 'demo-owner'),
    email: String(j.email || 'e2e+pf-owner@local.test'),
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
        localStorage.setItem('refreshToken', 'pf-collab-refresh');
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

async function createIdea(page: Page, token: string, title: string): Promise<string> {
  const resp = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { title, summary: 'Playwright Process Flow collab seed', tags: ['e2e', 'process-flow', 'collab'] },
  });
  expect(resp.ok(), `create idea → ${resp.status()}`).toBe(true);
  const json = await resp.json();
  const id = String(json?.id || json?.data?.id || '');
  expect(id, 'idea id present').toBeTruthy();
  return id;
}

async function fitView(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Fit view|Dopasuj widok/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(550);
  }
}

async function nodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node').count();
}

/** Add a step: empty-state "Add start" CTA, else the "Action" shape-toolbar button
 *  (same fallback chain as tests/e2e/tools/idea-process-flow.spec.ts). */
async function addStep(page: Page): Promise<boolean> {
  const before = await nodeCount(page);
  const addStart = page.getByRole('button', { name: /Add start|Dodaj start/i }).first();
  if (await addStart.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addStart.click({ force: true }).catch(() => {});
  } else {
    const actionBtn = page.locator('button[title="Action"], button[title="Akcja"]').first();
    if (await actionBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await actionBtn.click({ force: true }).catch(() => {});
    }
  }
  await page.waitForTimeout(700);
  return (await nodeCount(page)) > before;
}

test.describe('Collab — Process Flow, two users same org [@module:collab]', () => {
  test.setTimeout(120000);

  test('owner adds a step; member sees it (realtime push, with reload fallback proof)', async ({
    page,
    browser,
  }) => {
    await suppressOnboarding(page);
    const ownerToken = await ensureOwnerToken(page);
    await seedPageAuth(page, ownerToken);
    const ideaId = await createIdea(page, ownerToken, `E2E Collab Process Flow ${Date.now()}`);

    await page.goto(`/my-work/ideas/${ideaId}/workspace/process_flow`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOverlayIfPresent(page);
    await expect(page.getByRole('region', { name: WORKSPACE_REGION })).toBeVisible({ timeout: 45000 });

    // Defensive tool-mount race (same as idea-process-flow.spec.ts).
    const pfToolBtn = page.locator('button[title="Process Flow"], button[title="Przepływ"]').first();
    if (await pfToolBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pfToolBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 45000 });
    await page.waitForTimeout(2000); // let any auto-seed write settle before mutating

    const ownerClaims = decodeJwt(ownerToken);
    const organizationId = String(ownerClaims.organizationId || ownerClaims.organization_id || '');
    test.skip(
      !organizationId,
      'Could not decode organizationId from the owner token to mint a same-org member token.'
    );

    const memberToken = makeSameOrgMemberToken(organizationId);
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    try {
      await memberPage.addInitScript((t: string) => {
        localStorage.setItem('token', t);
        localStorage.setItem('refreshToken', 'e2e-refresh');
      }, memberToken);
      await suppressOnboarding(memberPage);
      await memberPage.goto(`/my-work/ideas/${ideaId}/workspace/process_flow`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await dismissOverlayIfPresent(memberPage);
      await memberPage
        .getByRole('region', { name: WORKSPACE_REGION })
        .waitFor({ timeout: 30000 })
        .catch(() => {});
      await memberPage.waitForTimeout(1500); // let the collab WS connect

      const memberNodesBefore = await nodeCount(memberPage);
      const ownerNodesBefore = await nodeCount(page);

      // Defensive: a stray demo-read-only access gate (documented pre-existing
      // flakiness in the shared collab harnesses, see collab-whiteboard.spec.ts
      // header) would silently block the click.
      const demoGateClose = page.getByRole('button', { name: /^Close$/i }).first();
      if (await demoGateClose.isVisible({ timeout: 500 }).catch(() => false)) {
        await demoGateClose.click({ force: true }).catch(() => {});
      }

      await fitView(page);
      const added = await addStep(page);
      const ownerNodesAfter = await nodeCount(page);
      expect(
        added && ownerNodesAfter > ownerNodesBefore,
        `owner could add a step (nodes ${ownerNodesBefore} -> ${ownerNodesAfter})`
      ).toBe(true);

      // PRIMARY: realtime push, no reload. Soft — matches the established
      // collab-whiteboard.spec.ts convention for timing-sensitive multiplayer checks.
      await memberPage.waitForTimeout(1500);
      const memberNodesAfterPush = await nodeCount(memberPage);
      expect
        .soft(
          memberNodesAfterPush,
          'member canvas grew a node via WS graph_patch push (no reload)'
        )
        .toBeGreaterThan(memberNodesBefore);

      // FALLBACK: persistence proof independent of WS timing.
      await memberPage.reload({ waitUntil: 'domcontentloaded' });
      await dismissOverlayIfPresent(memberPage);
      await memberPage
        .getByRole('region', { name: WORKSPACE_REGION })
        .waitFor({ timeout: 30000 })
        .catch(() => {});
      await memberPage.waitForTimeout(1500);
      const memberNodesAfterReload = await nodeCount(memberPage);
      expect
        .soft(
          memberNodesAfterReload,
          'member sees the owner-added step after reload (durable shared state)'
        )
        .toBeGreaterThan(memberNodesBefore);
    } finally {
      await memberContext.close();
    }
  });
});
