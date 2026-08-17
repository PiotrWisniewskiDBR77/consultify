import { expect, test } from '@playwright/test';

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
    }
  });
});
