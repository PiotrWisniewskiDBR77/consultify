#!/usr/bin/env tsx
/**
 * smoke-v5-ideas-workspace-e2e — V51-23
 *
 * HTTP-based smoke tests for V5 Ideas Workspace core flows.
 * Hits real API endpoints to verify runtime behavior.
 *
 * Usage: API_URL=http://localhost:3001/api AUTH_TOKEN=... npx tsx server/scripts/smoke-v5-ideas-workspace-e2e.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.TOKEN || '';

type TestResult = { name: string; pass: boolean; details?: string; ms?: number };

async function api(method: string, path: string, body?: any, timeoutMs = 10000): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') return { status: 408, data: { error: 'Request timeout' } };
    throw err;
  }
}

async function runTest(name: string, fn: () => Promise<boolean | string>): Promise<TestResult> {
  const t0 = Date.now();
  try {
    const result = await fn();
    const pass = result === true;
    return {
      name,
      pass,
      details: typeof result === 'string' ? result : undefined,
      ms: Date.now() - t0,
    };
  } catch (err: any) {
    return { name, pass: false, details: err?.message || String(err), ms: Date.now() - t0 };
  }
}

async function main() {
  if (!AUTH_TOKEN) {
    console.warn('[warn] No AUTH_TOKEN set — tests requiring auth will fail with 401.\n');
  }

  const results: TestResult[] = [];
  let createdIdeaId: string | null = null;

  // T1: Create idea
  results.push(
    await runTest('Create idea via POST /my-work/my-ideas', async () => {
      const { status, data } = await api('POST', '/my-work/my-ideas', {
        title: `Smoke test idea ${Date.now()}`,
        body: 'E2E smoke test — can be deleted',
        stage: 'seed',
      });
      if (status === 401) return 'Auth required — set AUTH_TOKEN';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      createdIdeaId = data?.id || data?.idea?.id;
      return !!createdIdeaId;
    })
  );

  // T2: Get idea map
  results.push(
    await runTest('Get idea map via GET /my-work/my-ideas/:id/map', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}`;
      return data !== null;
    })
  );

  // T3: Save idea map
  results.push(
    await runTest('Save idea map via PUT /my-work/my-ideas/:id/map', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('PUT', `/my-work/my-ideas/${createdIdeaId}/map`, {
        nodes: [
          { id: 'node-1', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Test node' } },
        ],
        edges: [],
      });
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return true;
    })
  );

  // T4: Attach artifact to object
  results.push(
    await runTest('Attach artifact via POST /my-ideas/:id/objects/:objectId/artifacts', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api(
        'POST',
        `/my-work/my-ideas/${createdIdeaId}/objects/node-1/artifacts`,
        {
          artifactRef: { type: 'initiative', id: 'test-init-001' },
          label: 'Test initiative',
          linkRole: 'related',
        }
      );
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return data?.ok === true;
    })
  );

  // T5: Get object artifacts
  results.push(
    await runTest('Get object artifacts via GET /my-ideas/:id/objects/:objectId/artifacts', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api(
        'GET',
        `/my-work/my-ideas/${createdIdeaId}/objects/node-1/artifacts`
      );
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}`;
      return Array.isArray(data?.artifactLinks) && data.artifactLinks.length > 0;
    })
  );

  // T5b: Verify node.data.artifactLinks after attach + reload
  results.push(
    await runTest('Attach persists in node.data.artifactLinks after reload', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      if (status >= 400) return `HTTP ${status}`;
      const nodes = data?.map?.nodes || [];
      const node = nodes.find((n: any) => n.id === 'node-1');
      if (!node) return 'node-1 not found in map';
      const linksInData = node.data?.artifactLinks;
      const linksTopLevel = node.artifactLinks;
      if (!Array.isArray(linksInData) || linksInData.length === 0) {
        return `node.data.artifactLinks missing (top-level: ${JSON.stringify(linksTopLevel)})`;
      }
      const found = linksInData.some(
        (l: any) => l.artifactRef?.type === 'initiative' && l.artifactRef?.id === 'test-init-001'
      );
      if (!found) return `Expected initiative/test-init-001 in data.artifactLinks: ${JSON.stringify(linksInData)}`;
      return true;
    })
  );

  // T6: Detach artifact
  results.push(
    await runTest('Detach artifact via DELETE /my-ideas/:id/objects/:objectId/artifacts/:type/:id', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api(
        'DELETE',
        `/my-work/my-ideas/${createdIdeaId}/objects/node-1/artifacts/initiative/test-init-001`
      );
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return data?.ok === true;
    })
  );

  // T6b: Verify artifact gone from node.data.artifactLinks after detach + reload
  results.push(
    await runTest('Detach removes artifact from node.data.artifactLinks after reload', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      if (status >= 400) return `HTTP ${status}`;
      const nodes = data?.map?.nodes || [];
      const node = nodes.find((n: any) => n.id === 'node-1');
      if (!node) return 'node-1 not found in map';
      const linksInData = node.data?.artifactLinks;
      const linksTopLevel = node.artifactLinks;
      if (Array.isArray(linksInData) && linksInData.length > 0) {
        return `node.data.artifactLinks should be empty after detach: ${JSON.stringify(linksInData)}`;
      }
      if (Array.isArray(linksTopLevel) && linksTopLevel.length > 0) {
        return `node.artifactLinks should be empty after detach: ${JSON.stringify(linksTopLevel)}`;
      }
      return true;
    })
  );

  // T6c: Attach → save from frontend format → reload → verify round-trip
  results.push(
    await runTest('Artifact links survive frontend save/reload round-trip', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      // Attach
      const attachRes = await api(
        'POST',
        `/my-work/my-ideas/${createdIdeaId}/objects/node-1/artifacts`,
        {
          artifactRef: { type: 'tool_session', id: 'ts-round-trip-001' },
          label: 'Round-trip test artifact',
          linkRole: 'evidence',
        }
      );
      if (attachRes.status >= 400) return `Attach failed: HTTP ${attachRes.status}`;

      // Reload to get current state
      const getRes1 = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      if (getRes1.status >= 400) return `Get1 failed: HTTP ${getRes1.status}`;
      const nodesAfterAttach = getRes1.data?.map?.nodes || [];

      // Save the nodes back (simulating frontend save)
      const saveRes = await api('PUT', `/my-work/my-ideas/${createdIdeaId}/map`, {
        nodes: nodesAfterAttach,
        edges: getRes1.data?.map?.edges || [],
      });
      if (saveRes.status >= 400) return `Save failed: HTTP ${saveRes.status}`;

      // Reload again and verify
      const getRes2 = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      if (getRes2.status >= 400) return `Get2 failed: HTTP ${getRes2.status}`;
      const nodesAfterRoundTrip = getRes2.data?.map?.nodes || [];
      const node = nodesAfterRoundTrip.find((n: any) => n.id === 'node-1');
      if (!node) return 'node-1 not found after round-trip';
      const links = node.data?.artifactLinks || node.artifactLinks || [];
      if (!Array.isArray(links) || links.length === 0) {
        return `Artifact links lost after save/reload round-trip`;
      }
      const found = links.some(
        (l: any) => l.artifactRef?.type === 'tool_session' && l.artifactRef?.id === 'ts-round-trip-001'
      );
      if (!found) return `Expected tool_session/ts-round-trip-001 after round-trip: ${JSON.stringify(links)}`;

      // Clean up: detach
      await api('DELETE', `/my-work/my-ideas/${createdIdeaId}/objects/node-1/artifacts/tool_session/ts-round-trip-001`);
      return true;
    })
  );

  // T7: Convert idea to initiative
  results.push(
    await runTest('Convert idea to initiative via POST /my-ideas/:id/convert', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('POST', `/my-work/my-ideas/${createdIdeaId}/convert`, {
        target: 'initiative',
        options: { language: 'en' },
      });
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return data?.promotedTo === 'initiative';
    })
  );

  // T8: AI generate endpoint exists
  results.push(
    await runTest('AI generate endpoint responds via POST /my-ideas/:id/ai-generate', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status } = await api('POST', `/my-work/my-ideas/${createdIdeaId}/ai-generate`, {
        generatorType: 'suggestions',
        tool: 'mindmap',
        context: {
          seedText: 'test',
          title: 'test',
          existingNodes: [],
          existingEdges: [],
          language: 'en',
        },
      }, 5000);
      if (status === 401) return 'Auth required';
      // 200, 408 (timeout), or 500 (LLM not configured) — all mean the endpoint exists
      return status < 404 || status === 408 || status === 500;
    })
  );

  // T9: Chat handoff endpoint
  results.push(
    await runTest('Chat handoff via POST /my-work/my-ideas/from-chat', async () => {
      const { status, data } = await api('POST', '/my-work/my-ideas/from-chat', {
        title: 'Chat handoff test',
        seedText: 'Testing chat to workspace handoff',
        preferredSystem: 'mindmap',
      });
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return !!data?.ideaId || !!data?.id || !!data?.idea?.id;
    })
  );

  // T10: List ideas endpoint
  results.push(
    await runTest('List ideas via GET /my-work/my-ideas', async () => {
      const { status, data } = await api('GET', '/my-work/my-ideas');
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}`;
      return Array.isArray(data) || Array.isArray(data?.ideas);
    })
  );

  // T11: Stage transition
  results.push(
    await runTest('Stage transition via PUT /my-ideas/:id', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('PUT', `/my-work/my-ideas/${createdIdeaId}`, {
        stage: 'framing',
      });
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return true;
    })
  );

  // T12: Save map with depth fields and verify persistence
  results.push(
    await runTest('Node depth persistence via save/reload', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const depthNode = {
        id: 'depth-node-1',
        type: 'idea',
        position: { x: 100, y: 100 },
        data: {
          label: 'Depth test',
          notes: 'Test notes',
          rationale: 'Test rationale',
          goal: 'Test goal',
          riskNote: 'Test risk',
        },
      };
      const saveRes = await api('PUT', `/my-work/my-ideas/${createdIdeaId}/map`, {
        nodes: [depthNode],
        edges: [],
      });
      if (saveRes.status >= 400) return `Save failed: HTTP ${saveRes.status}`;

      const getRes = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      if (getRes.status >= 400) return `Get failed: HTTP ${getRes.status}`;
      const nodes = getRes.data?.map?.nodes || [];
      const found = nodes.find((n: any) => n.id === 'depth-node-1');
      if (!found) return 'Node not found after reload';
      if (found.data?.notes !== 'Test notes') return `Notes lost: ${found.data?.notes}`;
      if (found.data?.rationale !== 'Test rationale') return `Rationale lost: ${found.data?.rationale}`;
      return true;
    })
  );

  // T13: Selection-level conversion with nodeIds
  results.push(
    await runTest('Selection-level conversion with nodeIds', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api('POST', `/my-work/my-ideas/${createdIdeaId}/convert`, {
        target: 'task_set',
        options: { nodeIds: ['depth-node-1'], language: 'en' },
      });
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}: ${JSON.stringify(data)}`;
      return data?.sourceNodeIds?.length > 0 || data?.promotedTo === 'task_set';
    })
  );

  // T14: Backlinks endpoint
  results.push(
    await runTest('Backlinks via GET /link-graph/backlinks', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const { status, data } = await api(
        'GET',
        `/my-work/link-graph/backlinks?type=idea&id=${createdIdeaId}`
      );
      if (status === 401) return 'Auth required';
      if (status >= 400) return `HTTP ${status}`;
      return Array.isArray(data);
    })
  );

  // T15: Template gallery endpoint (if exists)
  results.push(
    await runTest('Template application via save with template nodes', async () => {
      if (!createdIdeaId) return 'Skipped — no idea created';
      const templateNodes = [
        { id: 'root', type: 'center', position: { x: 0, y: 0 }, data: { label: 'Root' } },
        { id: 'branch-1', type: 'branch', position: { x: 200, y: 0 }, data: { label: 'Branch 1', branchKey: 'strategy' } },
        { id: 'idea-1', type: 'idea', position: { x: 400, y: 0 }, data: { label: 'Idea 1', branchKey: 'strategy' } },
      ];
      const templateEdges = [
        { id: 'e-root-b1', source: 'root', target: 'branch-1' },
        { id: 'e-b1-i1', source: 'branch-1', target: 'idea-1' },
      ];
      const { status } = await api('PUT', `/my-work/my-ideas/${createdIdeaId}/map`, {
        nodes: templateNodes,
        edges: templateEdges,
      });
      if (status >= 400) return `HTTP ${status}`;
      const getRes = await api('GET', `/my-work/my-ideas/${createdIdeaId}/map`);
      const nodes = getRes.data?.map?.nodes || [];
      return nodes.length >= 3;
    })
  );

  // Report
  const passed = results.filter((r) => r.pass);
  const failed = results.filter((r) => !r.pass);

  console.log(`\n[smoke:v5-ideas-e2e] ${passed.length}/${results.length} passed\n`);

  for (const r of results) {
    const icon = r.pass ? '✓' : '✗';
    const timing = r.ms != null ? ` (${r.ms}ms)` : '';
    const detail = r.details ? ` — ${r.details}` : '';
    console.log(`  ${icon} ${r.name}${timing}${detail}`);
  }

  if (failed.length > 0) {
    console.error(`\n[smoke:v5-ideas-e2e] ${failed.length} FAILED\n`);
    process.exit(1);
  }

  console.log('\n[smoke:v5-ideas-e2e] ALL PASSED\n');
}

main().catch((err) => {
  console.error('[smoke:v5-ideas-e2e] Fatal error:', err);
  process.exit(2);
});
