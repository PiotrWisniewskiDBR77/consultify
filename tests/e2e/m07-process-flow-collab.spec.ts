/**
 * M07 F3 — Process Flow realtime edit-sync (WS /ws/collab/:ideaId) — E2E.
 *
 * STATUS: SKELETON, NOT RUN LIVE by the F3 executor. The multi-client
 * assertions require TWO concurrent authenticated browser sessions against a
 * LIVE staging server with the collab WebSocket gateway attached
 * (E2E_BASE_URL / E2E_API_URL + global-setup bootstrap). The F3 agent could not
 * stand up that live two-server topology, so the genuine cross-client checks are
 * `test.skip('[MANUAL] ...')` with precise verification steps — matching the
 * established m06-16-collab.spec.ts convention (two-session collab is [MANUAL]
 * there too). Do NOT convert these to passing without actually running two live
 * clients. This is the R6 acceptance-gate work item.
 *
 * The relay layer (server forwards update_lanes / graph_snapshot 1:1, no echo to
 * sender) is ALREADY proven headlessly by
 * tests/integration/gateways/ideaCollabWs.orgscope.test.ts (2 new relay tests,
 * PASS). The hook producer/consumer contract is proven by
 * tests/unit/mywork/processFlowCollab.test.ts (16 tests, PASS). What remains for
 * live E2E is the end-to-end browser path: local mutation → WS → remote apply.
 *
 * Scenario ids map to Harvard/wdrozenie-100/_M07_F3_EDIT_SYNC_SPEC.md §Testy.3.
 */
import fs from 'node:fs';
import path from 'node:path';

import { APIResponse, expect, Page, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const SHOTS_DIR = path.resolve('docs/qa/screens/m07-f3-collab');
const WORKSPACE_REGION = 'Idea map workspace';

fs.mkdirSync(SHOTS_DIR, { recursive: true });

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
async function shot(page: Page, id: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${id}.png`), fullPage: false }).catch(() => {});
}

async function bootstrapToken(page: Page): Promise<string> {
  const runId = `m07f3-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await page.request
    .post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId },
    })
    .catch(() => null);
  if (res && res.ok()) {
    const payload = (await res.json()) as { token?: string };
    if (payload?.token) return String(payload.token);
  }
  return '';
}

async function createIdea(page: Page, token: string, title: string) {
  const res: APIResponse = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: authHeaders(token),
    data: { title, body: `M07 F3 collab seed for ${title}`, tags: ['m07', 'f3', 'collab'] },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string };
}

async function seedProcessFlowMap(page: Page, token: string, ideaId: string) {
  await page.request
    .put(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, {
      headers: authHeaders(token),
      data: { nodes: [], edges: [], version: 1, preferredTool: 'process_flow' },
      timeout: 40000,
    })
    .catch(() => null);
}

async function gotoProcessFlow(page: Page, ideaId: string) {
  await page
    .goto(`/my-work/ideas/${ideaId}/workspace/process_flow`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    })
    .catch(() => {});
}

test.describe('M07 F3 — Process Flow realtime edit-sync', () => {
  test('F3.0 shell smoke — Process Flow workspace renders + CollaborationOverlay mounts', async ({
    page,
  }) => {
    const token = await bootstrapToken(page);
    test.skip(!token, 'Requires a live staging server (E2E_API_URL + test-support bootstrap).');
    const { id } = await createIdea(page, token, `F3.0 ${Date.now()}`);
    await seedProcessFlowMap(page, token, id);
    await gotoProcessFlow(page, id);
    // Real, single-client assertion: the workspace shell renders. The collab WS
    // connects on mount (CollaborationOverlay); presence only shows with peers.
    await expect(page.getByRole('region', { name: WORKSPACE_REGION })).toBeVisible({
      timeout: 30000,
    });
    await shot(page, 'F3.0-shell');
  });

  test('F3.1 add node A → appears for B [MANUAL — two live clients]', async () => {
    test.skip(
      true,
      '[MANUAL] Requires two concurrent authenticated sessions (same org, same ideaId) ' +
        'against a live collab-WS server. Verify: client A adds a step (Enter / toolbar) → ' +
        'A emits {type:graph_patch, operations:[{op:add_node}]} → client B renders the node ' +
        'within ~1s WITHOUT reload (idea-collab-graph-patch → setNodes dedup). ' +
        'Headless proof of relay + hook contract: ideaCollabWs.orgscope.test.ts + processFlowCollab.test.ts.'
    );
  });

  test('F3.2 lane rename A → propagates to B [MANUAL — two live clients]', async () => {
    test.skip(
      true,
      '[MANUAL] Two concurrent sessions. Verify: client A renames a lane → A emits ' +
        '{op:update_lanes, data:{lanes:[...]}} → client B lane header updates without reload. ' +
        'Relay proven by ideaCollabWs.orgscope.test.ts "relays update_lanes ... 1:1".'
    );
  });

  test('F3.3 undo A → graph_snapshot restores B [MANUAL — two live clients]', async () => {
    test.skip(
      true,
      '[MANUAL] Two concurrent sessions. Verify: client A performs a mass change (auto-layout ' +
        'or AI-accept) then Ctrl+Z → A emits {op:graph_snapshot} → client B full state converges, ' +
        'AND B can Ctrl+Z the peer snapshot as one step (onRemoteSnapshot pushes B undo). ' +
        'Snapshot semantics proven by processFlowCollab.test.ts "graph_snapshot ... one undo step".'
    );
  });

  test('F3.4 soft lock — node held by A shows advisory ring for B [MANUAL — two live clients]', async () => {
    test.skip(
      true,
      '[MANUAL] Two concurrent sessions. Verify: client A selects/edits node X → session_state ' +
        'lockedNodes broadcasts → client B renders node X non-draggable with a subtle var(--c-info) ' +
        'ring + locker avatar (CollaborationOverlay lock badge). Set derivation proven by ' +
        'processFlowCollab.test.ts "onSessionState computes lockedByOthers".'
    );
  });

  test('F3.5 autosave suppression — remote patch does NOT re-persist on B [MANUAL — two live clients]', async () => {
    test.skip(
      true,
      '[MANUAL] Two concurrent sessions + network panel. Verify: client A adds a node → B applies ' +
        'the patch but issues NO PUT /map (lastChangeOriginRef=remote skips queueSync). Only A ' +
        'persists. B persists only after its OWN subsequent edit. Origin-flip proven by ' +
        'processFlowCollab.test.ts "flips lastChangeOriginRef to remote".'
    );
  });
});
