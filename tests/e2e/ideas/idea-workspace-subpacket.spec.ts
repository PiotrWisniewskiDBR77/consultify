import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import {
  API_BASE_URL,
  authHeaders,
  setupDocumentStudioSession,
} from '../documents/_document-studio-helpers';

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const IDEAS_API = `${API_BASE_URL}/api/my-work/my-ideas`;
const tools = [
  ['mindmap', 'mindmap'],
  ['process_flow', 'process-flow'],
  ['table', 'table'],
  ['whiteboard', 'whiteboard'],
] as const;

async function cleanupDurableWsFixtures(marker: string): Promise<void> {
  if (process.env.IDEA_WORKSPACE_ALLOW_FIXTURE_CLEANUP !== '1') {
    throw new Error('IDEA_WORKSPACE_ALLOW_FIXTURE_CLEANUP=1 is required');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const db = await pool.query<{ name: string }>('SELECT current_database() AS name');
    expect(db.rows[0]?.name).toMatch(/^idea_workspace_/);
    await pool.query(`SELECT pg_advisory_lock(hashtext('idea-workspace-e2e-cleanup'))`);
    await pool.query('BEGIN');
    try {
      await pool.query('ALTER TABLE idea_workspace_lock_events DISABLE TRIGGER trg_idea_workspace_lock_events_append_only');
      await pool.query(`DELETE FROM idea_workspace_lock_events WHERE node_id LIKE $1`, [`%-${marker}`]);
      await pool.query('ALTER TABLE idea_workspace_lock_events ENABLE TRIGGER trg_idea_workspace_lock_events_append_only');
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    const trigger = await pool.query<{ tgenabled: string }>(
      `SELECT tgenabled FROM pg_trigger WHERE tgname='trg_idea_workspace_lock_events_append_only'`
    );
    expect(trigger.rows[0]?.tgenabled).toBe('O');
  } finally {
    await pool.query(`SELECT pg_advisory_unlock(hashtext('idea-workspace-e2e-cleanup'))`).catch(() => undefined);
    await pool.end();
  }
}

test.describe('IDEA-WORKSPACE-SUBPACKET mounted four-tool journey', () => {
  test('signed owner persists/reopens all tools; stale and foreign writes fail closed', async ({ page }) => {
    const token = await setupDocumentStudioSession(page);
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let ideaId = '';
    try {
      const created = await page.request.post(IDEAS_API, {
        headers: authHeaders(token),
        data: { title: `Idea workspace ${marker}`, stage: 'spark' },
      });
      expect(created.status()).toBe(201);
      ideaId = String((await created.json()).id || '');

      for (const [preferredTool, slug] of tools) {
        const before = await page.request.get(`${IDEAS_API}/${ideaId}/map`, { headers: authHeaders(token) });
        expect(before.status()).toBe(200);
        const beforeBody = await before.json();
        const version = beforeBody.isDefault === true
          ? 0
          : Number(beforeBody.map?.version);
        expect(Number.isInteger(version) && version >= 0).toBe(true);
        const nodeId = `${preferredTool}-${marker}`;
        const saved = await page.request.put(`${IDEAS_API}/${ideaId}/map`, {
          headers: authHeaders(token),
          data: {
            nodes: [{ id: nodeId, data: { label: `${preferredTool} durable` }, position: { x: 10, y: 10 } }],
            edges: [],
            extensions: { [preferredTool]: { proof: marker } },
            preferredTool,
            baseVersion: version,
          },
        });
        expect(saved.status()).toBe(200);
        expect(Number((await saved.json()).version)).toBe(version + 1);

        const cold = await page.request.get(`${IDEAS_API}/${ideaId}/map`, { headers: authHeaders(token) });
        expect(cold.status()).toBe(200);
        const coldBody = await cold.json();
        expect(coldBody.map.nodes.some((node: any) => node.id === nodeId)).toBe(true);
        expect(coldBody.map.extensions?.[preferredTool]?.proof).toBe(marker);

        if (preferredTool === 'mindmap') {
          const wsBase = API_BASE_URL.replace(/^http/, 'ws');
          const wsResult = await page.evaluate(async ({ url, bearer, lockedNode }) => {
            return await new Promise<{ token: number; version: number }>((resolve, reject) => {
              const socket = new WebSocket(`${url}/ws/collab/${encodeURIComponent(lockedNode.ideaId)}?token=${encodeURIComponent(bearer)}`);
              const timer = window.setTimeout(() => { socket.close(); reject(new Error('idea ws timeout')); }, 15_000);
              let token = 0;
              let persistedVersion = 0;
              socket.onopen = () => socket.send(JSON.stringify({
                type: 'lock_node', nodeId: lockedNode.nodeId, ttlSeconds: 30,
                correlationId: `e2e-lock-${lockedNode.marker}`,
              }));
              socket.onmessage = (event) => {
                const message = JSON.parse(String(event.data));
                if (message.type === 'lock_acquired') {
                  token = Number(message.fencingToken);
                  socket.send(JSON.stringify({
                    type: 'graph_patch', correlationId: `e2e-patch-${lockedNode.marker}`,
                    operations: [{ op: 'update_node', data: { id: lockedNode.nodeId, wsProof: lockedNode.marker } }],
                  }));
                } else if (message.type === 'graph_version') {
                  persistedVersion = Number(message.version);
                  socket.send(JSON.stringify({ type: 'unlock_node', nodeId: lockedNode.nodeId }));
                } else if (message.type === 'session_state' && persistedVersion > 0 &&
                           !message.state?.lockedNodes?.[lockedNode.nodeId]) {
                  window.clearTimeout(timer); socket.close(); resolve({ token, version: persistedVersion });
                } else if (message.type === 'error') {
                  window.clearTimeout(timer); socket.close(); reject(new Error(String(message.code)));
                }
              };
              socket.onerror = () => { window.clearTimeout(timer); reject(new Error('idea ws connection failed')); };
            });
          }, { url: wsBase, bearer: token, lockedNode: { ideaId, nodeId, marker } });
          expect(wsResult.token).toBeGreaterThan(0);
          expect(wsResult.version).toBeGreaterThan(version);
          const wsCold = await page.request.get(`${IDEAS_API}/${ideaId}/map`, { headers: authHeaders(token) });
          const wsColdBody = await wsCold.json();
          expect(wsColdBody.map.nodes.find((node: any) => node.id === nodeId)?.wsProof).toBe(marker);
        }

        await page.goto(`/my-work/ideas/${encodeURIComponent(ideaId)}/workspace/${slug}`);
        await expect(page.locator('[data-local-command-palette="idea-map"]')).toBeVisible({ timeout: 30_000 });
        await page.reload();
        await expect(page.locator('[data-local-command-palette="idea-map"]')).toBeVisible({ timeout: 30_000 });
      }

      const stale = await page.request.put(`${IDEAS_API}/${ideaId}/map`, {
        headers: authHeaders(token),
        data: { nodes: [], edges: [], preferredTool: 'whiteboard', baseVersion: 1 },
      });
      expect(stale.status()).toBe(409);
      expect((await stale.json()).code).toBe('IDEA_MAP_CONFLICT');

      const snapshot = await page.request.post(`${IDEAS_API}/${ideaId}/map/snapshots`, {
        headers: authHeaders(token),
        data: { label: `cold-${marker}`, nodes: [], edges: [], extensions: { proof: marker } },
      });
      expect(snapshot.status()).toBeLessThan(300);

      const classified = await page.request.put(`${IDEAS_API}/${ideaId}`, {
        headers: authHeaders(token), data: { confidentiality: 'restricted' },
      });
      expect(classified.status()).toBe(200);
      expect((await classified.json()).confidentiality).toBe('restricted');

      const foreignSession = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: `idea-ws-foreign-${marker}`, role: 'ADMIN' },
      });
      expect(foreignSession.status()).toBe(200);
      const foreignToken = String((await foreignSession.json()).token || '');
      const denied = await page.request.get(`${IDEAS_API}/${ideaId}/map`, {
        headers: authHeaders(foreignToken),
      });
      expect(denied.status()).toBe(404);
    } finally {
      if (ideaId) {
        await page.request.delete(`${IDEAS_API}/${ideaId}`, { headers: authHeaders(token) });
      }
      await cleanupDurableWsFixtures(marker);
    }
  });
});
