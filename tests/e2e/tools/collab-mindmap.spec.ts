/**
 * Multiplayer collaboration — Mind Map ("Recommendation map"), two real browser
 * contexts.
 *
 * Reuses the proven M06 harness (tests/e2e/m06/_m06.ts: authenticate →
 * injectSession → createIdea → openMindmap) for the OWNER session, and mirrors
 * the org-scoping + membership-gate fix already proven live for Whiteboard in
 * tests/e2e/tools/collab-whiteboard.spec.ts (read that file's header first —
 * this one is the same recipe, adapted to Mind Map's node-add gesture).
 *
 * AUTH: the OWNER session is minted via test-support bootstrap ONLY (see
 * tests/e2e/_helpers/privilegedSession.ts). The public `register-demo` signup
 * is unprivileged by design (TEAM_MEMBER in the read-only demo org) and is not
 * a fallback — this spec writes the board, so it needs a real write session.
 * Requires ENABLE_TEST_SUPPORT=true + a matching TEST_SUPPORT_KEY.
 *
 * ORG-SCOPING FIX (same root cause as collab-whiteboard.spec.ts /
 * collab-ideas-table.spec.ts): a naive "second user" with its own bootstrap
 * call mints its OWN fresh org (server/src/routes/testSupport.routes.ts
 * :595-599), so the member would land in a DIFFERENT org than the owner and
 * never see the same board. Fix: mint the member's token via the E2E_MODE
 * unsigned-JWT auth bypass (server/src/middleware/auth.middleware.ts
 * ~L1030-1114) with the SAME organizationId decoded from the owner's real token.
 *
 * MEMBERSHIP-GATE (same as collab-whiteboard.spec.ts): the shared idea-map
 * backbone (mindmap/whiteboard/process_flow are just different
 * `preferredTool` values on the SAME `/my-ideas/:id/map` resource) gates
 * cross-user reads/writes behind `assertIdeaMembership()`
 * (server/src/realtime/ideaMapAccess.ts:37-60) whenever feature flag
 * `ENABLE_SHARED_IDEA_MAPS` is true (default true — server/src/config/
 * FeatureFlags.ts:38,167). The E2E auth-bypass middleware never inserts an
 * `organization_members` row for the synthetic member, so this spec MUST run
 * with `ENABLE_SHARED_IDEA_MAPS=false` on the harness command (see task
 * report for the exact run line) — that reverts both the WS gate and the
 * `/map` read gate to a plain org-scope check (`WHERE ideaId = ? AND
 * organization_id = ?`, no membership row needed), a real server-side
 * fallback path, not a workaround invented for this test.
 *
 * Node-add gesture: Mind Map adds a child node via "select root node → press
 * Tab" (src/components/MyWork/IdeaRecommendationMap.tsx:3416-3424
 * `addChildNode()`), same gesture already proven in
 * tests/e2e/tools/idea-mindmap.spec.ts (single-user persistence variant).
 *
 * Two assertions, in order of strength (both `expect.soft`, matching the
 * collab-whiteboard.spec.ts / m06-16-collab.spec.ts §16.3 convention for
 * timing-sensitive multiplayer checks — the shared owner-token harness has a
 * documented pre-existing flakiness independent of this spec):
 *   1. PRIMARY (realtime): member's node count increases within ~1.5s of the
 *      owner adding a child, with NO reload — proves the WS graph_patch push
 *      works end-to-end.
 *   2. FALLBACK (persistence): after a reload, the member sees the node the
 *      owner added.
 */
import { expect, test } from '@playwright/test';

import { authenticate, createIdea, dismissTour, injectSession, nodeCount } from '../m06/_m06';
import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

const CANVAS_LABEL = 'Idea map workspace';

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
    id: `e2e-mm-member-${Date.now().toString(36)}`,
    email: 'e2e-mm-member@local.test',
    name: 'E2E MM Member',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  });
  return `${header}.${payload}.e2e`;
}

async function fitView(page: import('@playwright/test').Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Fit view|Dopasuj widok/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(550);
  }
}

/** Ensure the Mind Map tool is active (defensive tool-mount race, see idea-mindmap.spec.ts). */
async function ensureMindmapTool(page: import('@playwright/test').Page) {
  const tab = page
    .locator('button[title="Recommendation map"], button[title="Mapa rekomendacji"]')
    .first();
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

test.describe('Collab — Mind Map, two users same org [@module:collab]', () => {
  test.setTimeout(120000);

  test('owner adds a child node; member sees it (realtime push, with reload fallback proof)', async ({
    page,
    browser,
  }) => {
    const session = await authenticate(page);
    await injectSession(page, session);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissTour(page);

    const ideaId = await createIdea(page, session.token, `E2E Collab Mindmap ${Date.now()}`);
    await page.goto(`/my-work/ideas/${ideaId}/workspace/mindmap`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await dismissTour(page);
    await expect(page.getByLabel(CANVAS_LABEL)).toBeVisible({ timeout: 45000 });
    await ensureMindmapTool(page);

    // Let the auto-seed root-node write (version 1→2) settle before mutating
    // (same race documented in idea-mindmap.spec.ts / m09-whiteboard-helpers.ts).
    await page.waitForTimeout(2500);

    const ownerClaims = decodeJwt(session.token);
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
      await memberPage.goto(`/my-work/ideas/${ideaId}/workspace/mindmap`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await dismissOverlayIfPresent(memberPage);
      await memberPage.getByLabel(CANVAS_LABEL).waitFor({ timeout: 30000 }).catch(() => {});
      await memberPage.waitForTimeout(1500); // let the collab WS connect

      const memberNodesBefore = await nodeCount(memberPage);
      const ownerNodesBefore = await nodeCount(page);
      test.skip(ownerNodesBefore === 0, 'No root node was auto-seeded — cannot select a node to branch from');

      // Defensive: a stray demo-read-only access gate (documented pre-existing
      // flakiness in the shared collab harnesses, see collab-whiteboard.spec.ts
      // header) would silently block the click.
      const demoGateClose = page.getByRole('button', { name: /^Close$/i }).first();
      if (await demoGateClose.isVisible({ timeout: 500 }).catch(() => false)) {
        await demoGateClose.click({ force: true }).catch(() => {});
      }

      await fitView(page);
      const rootNode = page.locator('.react-flow__node').first();
      await rootNode.click({ force: true }).catch(() => {});
      await page.waitForTimeout(250);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(700);

      const ownerNodesAfter = await nodeCount(page);
      expect(
        ownerNodesAfter > ownerNodesBefore,
        `owner could add a child node (nodes ${ownerNodesBefore} -> ${ownerNodesAfter})`
      ).toBe(true);

      // PRIMARY: realtime push, no reload. Soft — report but don't hard-fail on
      // slow CI (matches collab-whiteboard.spec.ts / m06-16-collab §16.3 convention).
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
      await memberPage.getByLabel(CANVAS_LABEL).waitFor({ timeout: 30000 }).catch(() => {});
      await memberPage.waitForTimeout(1500);
      const memberNodesAfterReload = await nodeCount(memberPage);
      expect
        .soft(
          memberNodesAfterReload,
          'member sees the owner-added child node after reload (durable shared state)'
        )
        .toBeGreaterThan(memberNodesBefore);
    } finally {
      await memberContext.close();
    }
  });
});
