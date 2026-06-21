/**
 * TESTY_M06 §16 — Kolaboracja real-time (WS /ws/collab/:ideaId).
 * §16.1–16.4, 16.6–16.7 are [MANUAL] (require two browser sessions).
 * §16.5 Cross-org security: already covered by integration test
 * tests/integration/gateways/ideaCollabWs.orgscope.test.ts (6/6 PASS, L-01 CLOSED).
 * This E2E file documents the collab surface and provides screenshots for audit.
 */
import { type Page, test } from '@playwright/test';

import { bootstrap, createIdea, openMindmap, shot } from './_m06';

async function freshMap(page: Page, tag: string) {
  const { token } = await bootstrap(page);
  const ideaId = await createIdea(page, token, `M06 §${tag} ${Date.now()}`);
  await openMindmap(page, ideaId);
  return ideaId;
}

test.describe('M06 §16 — Kolaboracja real-time WS', () => {
  test('16.1 CollaborationOverlay — presence strip widoczny [MANUAL]', async ({ page }) => {
    await freshMap(page, '16.1');
    await shot(page, '16.1-collab-overlay');
    test.skip(
      true,
      '[MANUAL] CollaborationOverlay presence strip requires two concurrent browser sessions with the same ideaId. ' +
        'Verify: User A + User B (same org) → both WS-upgraded → avatars visible in presence strip. ' +
        'CollaborationOverlay.tsx mounts when collab WS is connected.'
    );
  });

  test('16.2 Live cursory [MANUAL]', async ({ page }) => {
    await freshMap(page, '16.2');
    await shot(page, '16.2-live-cursors');
    test.skip(
      true,
      '[MANUAL] Live cursor sharing requires two concurrent sessions. ' +
        'Verify: move mouse in session A → cursor appears in session B (cursor_move event broadcast by ideaCollabWs.gateway.ts).'
    );
  });

  test('16.3 Graph patch sync [MANUAL]', async ({ page }) => {
    await freshMap(page, '16.3');
    await shot(page, '16.3-graph-patch');
    test.skip(
      true,
      '[MANUAL] graph_patch broadcast requires two concurrent sessions. ' +
        'Verify: User A adds node → collabSendRef.current({type:graph_patch}) → ' +
        'User B sees new node without reload (event idea-collab-graph-patch handled at IRM:2810).'
    );
  });

  test('16.4 Node lock — concurrent edit [MANUAL]', async ({ page }) => {
    await freshMap(page, '16.4');
    await shot(page, '16.4-node-lock');
    test.skip(
      true,
      '[MANUAL] Node lock requires two concurrent sessions editing the same node. ' +
        'Verify: User A opens drawer for node X → remoteLockedNodeIds broadcasts → ' +
        'User B sees "locked by another collaborator" message when trying to edit X.'
    );
  });

  test('16.5 Cross-org reject (BEZPIECZEŃSTWO) — L-01 ZAMKNIĘTA', async ({ page }) => {
    await freshMap(page, '16.5');
    await shot(page, '16.5-cross-org-reject');
    // Cross-org WS rejection is covered by the integration test suite:
    // tests/integration/gateways/ideaCollabWs.orgscope.test.ts (6/6 PASS):
    //   - 401 bad JWT → socket.destroy
    //   - 403 cross-org IDOR → socket.destroy BEFORE room.set (ideaCollabWs.gateway.ts:240-242)
    //   - same-org → join succeeds
    // L-01 CLOSED 2026-06-17. No additional E2E action needed here.
    test.skip(
      true,
      'Cross-org WS reject verified by integration suite ideaCollabWs.orgscope.test.ts (6/6 PASS, L-01 CLOSED). ' +
        'E2E two-browser cross-org test not needed — would duplicate existing coverage.'
    );
  });

  test('16.6 Reconnect i heartbeat [MANUAL]', async ({ page }) => {
    await freshMap(page, '16.6');
    await shot(page, '16.6-reconnect');
    test.skip(
      true,
      '[MANUAL] WS reconnect requires DevTools → Network → block WS for 3s then unblock. ' +
        'Verify: client reconnects automatically; presence avatars restored after reconnect.'
    );
  });

  test('16.7 Conflict 409 in collab context [MANUAL]', async ({ page }) => {
    await freshMap(page, '16.7');
    await shot(page, '16.7-collab-409');
    test.skip(
      true,
      '[MANUAL] Concurrent-write 409 in collab requires two sessions writing simultaneously. ' +
        'Verify: race → one session gets 409 → rehydration → merge correct. ' +
        'Note: each tool has its own useIdeaMapSync instance (own version counter) — only mindmap has shared runtime.'
    );
  });
});
