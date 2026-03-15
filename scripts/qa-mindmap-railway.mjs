#!/usr/bin/env node

/**
 * Railway QA smoke test for mindmap module (MM-17)
 *
 * Runs 5 behavioral tests against the real Railway-hosted API:
 *   1. Map CRUD cycle
 *   2. Persistence durability (depth fields + extensions)
 *   3. Conflict detection (baseVersion / 409)
 *   4. Node depth fields persistence (all fields)
 *   5. Edge role preservation (structural vs relation)
 *
 * Usage:
 *   AUTH_TOKEN=<jwt> node scripts/qa-mindmap-railway.mjs
 *   AUTH_TOKEN=<jwt> API_URL=https://your-railway-app.up.railway.app/api node scripts/qa-mindmap-railway.mjs
 */

import 'dotenv/config';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RAW_API_URL =
  process.env.API_URL ||
  process.env.VITE_API_URL ||
  'http://localhost:3001';

const API_URL = (() => {
  const base = RAW_API_URL.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
})();

const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.TOKEN || '';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function api(method, path, body, timeoutMs = 15000) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { status: 408, data: { error: 'Request timeout' } };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Idea lifecycle helpers
// ---------------------------------------------------------------------------

async function createIdea(suffix) {
  const { status, data } = await api('POST', '/my-work/my-ideas', {
    title: `QA smoke ${suffix} ${Date.now()}`,
    body: 'Automated QA — safe to delete',
    stage: 'seed',
  });
  if (status === 401) throw new Error('Auth required — set AUTH_TOKEN env var');
  if (status >= 400) throw new Error(`Create idea failed: HTTP ${status} — ${JSON.stringify(data)}`);
  const id = data?.id || data?.idea?.id;
  if (!id) throw new Error(`Create idea returned no id: ${JSON.stringify(data)}`);
  return id;
}

async function deleteIdea(id) {
  if (!id) return;
  try {
    await api('DELETE', `/my-work/my-ideas/${id}`);
  } catch {
    // best-effort cleanup
  }
}

async function saveMap(ideaId, { nodes, edges, baseVersion, extensions, preferredTool } = {}) {
  const body = { nodes, edges };
  if (baseVersion != null) body.baseVersion = baseVersion;
  if (extensions != null) body.extensions = extensions;
  if (preferredTool != null) body.preferredTool = preferredTool;
  return api('POST', `/my-work/my-ideas/${ideaId}/map/sync`, body);
}

async function getMap(ideaId) {
  return api('GET', `/my-work/my-ideas/${ideaId}/map`);
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${label}: mismatch\n  expected: ${b}\n  actual:   ${a}`);
  }
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

async function test1_mapCrudCycle() {
  let ideaId;
  try {
    ideaId = await createIdea('T1-crud');

    const nodes = [
      { id: 'root', type: 'center', position: { x: 0, y: 0 }, data: { label: 'Root node' } },
      { id: 'n1', type: 'idea', position: { x: 200, y: 0 }, data: { label: 'Child A' } },
      { id: 'n2', type: 'idea', position: { x: -200, y: 0 }, data: { label: 'Child B' } },
    ];
    const edges = [
      { id: 'e1', source: 'root', target: 'n1', data: { edgeRole: 'structural' } },
      { id: 'e2', source: 'root', target: 'n2', data: { edgeRole: 'structural' } },
    ];

    const saveRes = await saveMap(ideaId, { nodes, edges });
    assert(saveRes.status === 200, `Save failed: HTTP ${saveRes.status} — ${JSON.stringify(saveRes.data)}`);

    const getRes = await getMap(ideaId);
    assert(getRes.status === 200, `GET map failed: HTTP ${getRes.status}`);

    const map = getRes.data?.map;
    assert(map, 'No map in response');

    assertEqual(map.nodes?.length, 3, 'Node count');
    assertEqual(map.edges?.length, 2, 'Edge count');

    const labels = new Set(map.nodes.map((n) => n.data?.label));
    assert(labels.has('Root node'), 'Missing label "Root node"');
    assert(labels.has('Child A'), 'Missing label "Child A"');
    assert(labels.has('Child B'), 'Missing label "Child B"');

    return true;
  } finally {
    await deleteIdea(ideaId);
  }
}

async function test2_persistenceDurability() {
  let ideaId;
  try {
    ideaId = await createIdea('T2-durability');

    const nodes = [
      {
        id: 'root',
        type: 'center',
        position: { x: 0, y: 0 },
        data: {
          label: 'Durability root',
          notes: 'These are detailed notes for the root node.',
          tags: ['qa', 'durability'],
          semanticType: 'problem',
          status: 'active',
        },
      },
      {
        id: 'n1',
        type: 'idea',
        position: { x: 200, y: 100 },
        data: {
          label: 'Depth child',
          notes: 'Child notes',
          tags: ['child-tag'],
          semanticType: 'option',
          status: 'candidate',
        },
      },
    ];
    const edges = [
      { id: 'e1', source: 'root', target: 'n1', data: { edgeRole: 'structural' } },
    ];
    const extensions = {
      mindmap: {
        viewState: {
          collapsedNodeIds: ['n1'],
          viewport: { x: 10, y: 20, zoom: 0.85 },
        },
      },
    };

    const saveRes = await saveMap(ideaId, { nodes, edges, extensions, preferredTool: 'mindmap' });
    assert(saveRes.status === 200, `Save failed: HTTP ${saveRes.status}`);

    const getRes = await getMap(ideaId);
    assert(getRes.status === 200, `GET map failed: HTTP ${getRes.status}`);

    const map = getRes.data?.map;
    assert(map, 'No map in response');

    const root = map.nodes?.find((n) => n.id === 'root');
    assert(root, 'Root node not found');
    assertEqual(root.data?.notes, 'These are detailed notes for the root node.', 'Root notes');
    assertDeepEqual(root.data?.tags, ['qa', 'durability'], 'Root tags');
    assertEqual(root.data?.semanticType, 'problem', 'Root semanticType');
    assertEqual(root.data?.status, 'active', 'Root status');

    const child = map.nodes?.find((n) => n.id === 'n1');
    assert(child, 'Child node not found');
    assertEqual(child.data?.notes, 'Child notes', 'Child notes');

    const ext = map.extensions;
    assert(ext, 'Extensions missing');
    const viewState = ext?.mindmap?.viewState;
    assert(viewState, 'viewState missing in extensions');
    assertDeepEqual(viewState.collapsedNodeIds, ['n1'], 'collapsedNodeIds');
    assertEqual(viewState.viewport?.zoom, 0.85, 'viewport zoom');

    return true;
  } finally {
    await deleteIdea(ideaId);
  }
}

async function test3_conflictDetection() {
  let ideaId;
  try {
    ideaId = await createIdea('T3-conflict');

    const nodesV1 = [
      { id: 'root', type: 'center', position: { x: 0, y: 0 }, data: { label: 'Conflict test' } },
    ];
    const edgesV1 = [];

    // Save version 1
    const save1 = await saveMap(ideaId, { nodes: nodesV1, edges: edgesV1 });
    assert(save1.status === 200, `Initial save failed: HTTP ${save1.status}`);
    const version1 = save1.data?.version;
    assert(typeof version1 === 'number', `No version returned: ${JSON.stringify(save1.data)}`);

    // Read back to confirm version
    const getRes = await getMap(ideaId);
    assert(getRes.status === 200, `GET map failed: HTTP ${getRes.status}`);
    const currentVersion = getRes.data?.map?.version;
    assertEqual(currentVersion, version1, 'Version after save');

    // Attempt save with WRONG baseVersion (should 409)
    const wrongVersion = 0;
    const save2 = await saveMap(ideaId, {
      nodes: nodesV1,
      edges: edgesV1,
      baseVersion: wrongVersion,
    });
    assertEqual(save2.status, 409, 'Expected 409 for wrong baseVersion');
    assertEqual(save2.data?.code, 'IDEA_MAP_CONFLICT', 'Expected conflict code');

    // Save with CORRECT baseVersion (should 200)
    const save3 = await saveMap(ideaId, {
      nodes: nodesV1,
      edges: edgesV1,
      baseVersion: currentVersion,
    });
    assertEqual(save3.status, 200, 'Expected 200 for correct baseVersion');
    assert(save3.data?.version > currentVersion, 'Version should increment');

    return true;
  } finally {
    await deleteIdea(ideaId);
  }
}

async function test4_nodeDepthFieldsPersistence() {
  let ideaId;
  try {
    ideaId = await createIdea('T4-depth-fields');

    const allDepthNode = {
      id: 'depth-all',
      type: 'idea',
      position: { x: 100, y: 100 },
      data: {
        label: 'All depth fields',
        notes: 'Detailed notes for depth test',
        context: 'Business context for this node',
        goal: 'Achieve 100% field persistence',
        rationale: 'We need to verify every field survives round-trip',
        riskNote: 'Data loss risk if serialization is broken',
        tags: ['depth', 'qa', 'persistence'],
        semanticType: 'decision',
        status: 'active',
        evidenceLinks: [
          { id: 'ev-1', type: 'url', title: 'Evidence doc', url: 'https://example.com/evidence' },
        ],
        artifactLinks: [
          { artifactRef: { type: 'report', id: 'RPT-QA-001' }, label: 'QA report' },
        ],
      },
    };
    const rootNode = {
      id: 'root',
      type: 'center',
      position: { x: 0, y: 0 },
      data: { label: 'Depth root' },
    };
    const nodes = [rootNode, allDepthNode];
    const edges = [
      { id: 'e1', source: 'root', target: 'depth-all', data: { edgeRole: 'structural' } },
    ];

    const saveRes = await saveMap(ideaId, { nodes, edges });
    assert(saveRes.status === 200, `Save failed: HTTP ${saveRes.status}`);

    const getRes = await getMap(ideaId);
    assert(getRes.status === 200, `GET map failed: HTTP ${getRes.status}`);

    const map = getRes.data?.map;
    const found = map?.nodes?.find((n) => n.id === 'depth-all');
    assert(found, 'depth-all node not found after reload');

    const d = found.data;
    assertEqual(d?.label, 'All depth fields', 'label');
    assertEqual(d?.notes, 'Detailed notes for depth test', 'notes');
    assertEqual(d?.context, 'Business context for this node', 'context');
    assertEqual(d?.goal, 'Achieve 100% field persistence', 'goal');
    assertEqual(d?.rationale, 'We need to verify every field survives round-trip', 'rationale');
    assertEqual(d?.riskNote, 'Data loss risk if serialization is broken', 'riskNote');
    assertDeepEqual(d?.tags, ['depth', 'qa', 'persistence'], 'tags');
    assertEqual(d?.semanticType, 'decision', 'semanticType');
    assertEqual(d?.status, 'active', 'status');

    assert(Array.isArray(d?.evidenceLinks), 'evidenceLinks should be array');
    assertEqual(d.evidenceLinks.length, 1, 'evidenceLinks count');
    assertEqual(d.evidenceLinks[0]?.title, 'Evidence doc', 'evidenceLinks[0].title');

    assert(Array.isArray(d?.artifactLinks), 'artifactLinks should be array');
    assertEqual(d.artifactLinks.length, 1, 'artifactLinks count');
    assertEqual(d.artifactLinks[0]?.artifactRef?.type, 'report', 'artifactLinks[0].type');
    assertEqual(d.artifactLinks[0]?.artifactRef?.id, 'RPT-QA-001', 'artifactLinks[0].id');

    return true;
  } finally {
    await deleteIdea(ideaId);
  }
}

async function test5_edgeRolePreservation() {
  let ideaId;
  try {
    ideaId = await createIdea('T5-edge-roles');

    const nodes = [
      { id: 'root', type: 'center', position: { x: 0, y: 0 }, data: { label: 'Edge role root' } },
      { id: 'branch', type: 'branch', position: { x: 200, y: 0 }, data: { label: 'Branch', branchKey: 'test' } },
      { id: 'idea1', type: 'idea', position: { x: 400, y: -100 }, data: { label: 'Idea 1', branchKey: 'test' } },
      { id: 'idea2', type: 'idea', position: { x: 400, y: 100 }, data: { label: 'Idea 2', branchKey: 'test' } },
    ];
    const edges = [
      {
        id: 'e-struct-1',
        source: 'root',
        target: 'branch',
        type: 'gradient',
        animated: true,
        data: { edgeRole: 'structural' },
      },
      {
        id: 'e-struct-2',
        source: 'branch',
        target: 'idea1',
        type: 'gradient',
        animated: true,
        data: { edgeRole: 'structural' },
      },
      {
        id: 'e-struct-3',
        source: 'branch',
        target: 'idea2',
        type: 'gradient',
        animated: true,
        data: { edgeRole: 'structural' },
      },
      {
        id: 'e-rel-1',
        source: 'idea1',
        target: 'idea2',
        type: 'smoothstep',
        animated: false,
        data: { edgeRole: 'relation', relation: 'supports', label: 'supports' },
      },
    ];

    const saveRes = await saveMap(ideaId, { nodes, edges });
    assert(saveRes.status === 200, `Save failed: HTTP ${saveRes.status}`);

    const getRes = await getMap(ideaId);
    assert(getRes.status === 200, `GET map failed: HTTP ${getRes.status}`);

    const map = getRes.data?.map;
    assert(map, 'No map in response');
    assertEqual(map.edges?.length, 4, 'Edge count');

    const structuralEdges = map.edges.filter((e) => e.data?.edgeRole === 'structural');
    const relationEdges = map.edges.filter((e) => e.data?.edgeRole === 'relation');

    assertEqual(structuralEdges.length, 3, 'Structural edge count');
    assertEqual(relationEdges.length, 1, 'Relation edge count');

    const rel = relationEdges[0];
    assertEqual(rel.data?.relation, 'supports', 'Relation type');
    assertEqual(rel.data?.label, 'supports', 'Relation label');

    return true;
  } finally {
    await deleteIdea(ideaId);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS = [
  { name: 'Map CRUD cycle', fn: test1_mapCrudCycle },
  { name: 'Persistence durability (depth fields + extensions)', fn: test2_persistenceDurability },
  { name: 'Conflict detection (baseVersion / 409)', fn: test3_conflictDetection },
  { name: 'Node depth fields persistence (all fields)', fn: test4_nodeDepthFieldsPersistence },
  { name: 'Edge role preservation (structural vs relation)', fn: test5_edgeRolePreservation },
];

async function main() {
  console.log(bold('\n  Railway QA Smoke Test — Mindmap Module\n'));
  console.log(dim(`  API: ${API_URL}`));
  console.log(dim(`  Auth: ${AUTH_TOKEN ? 'Bearer token set' : 'NO TOKEN — tests will fail'}\n`));

  if (!AUTH_TOKEN) {
    console.error(red('  ✗ AUTH_TOKEN is required. Set it via environment variable.\n'));
    console.log(dim('  Example: AUTH_TOKEN=eyJ... node scripts/qa-mindmap-railway.mjs\n'));
    process.exit(1);
  }

  const results = [];

  for (const test of TESTS) {
    const t0 = Date.now();
    try {
      await test.fn();
      const ms = Date.now() - t0;
      results.push({ name: test.name, pass: true, ms });
      console.log(`  ${green('[PASS]')} ${test.name} ${dim(`(${ms}ms)`)}`);
    } catch (err) {
      const ms = Date.now() - t0;
      results.push({ name: test.name, pass: false, ms, error: err?.message || String(err) });
      console.log(`  ${red('[FAIL]')} ${test.name} ${dim(`(${ms}ms)`)}`);
      console.log(`         ${red(err?.message || String(err))}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;

  console.log('');
  if (passed === total) {
    console.log(green(bold(`  ✓ ${passed}/${total} tests passed\n`)));
  } else {
    console.log(red(bold(`  ✗ ${passed}/${total} tests passed\n`)));
    const failures = results.filter((r) => !r.pass);
    for (const f of failures) {
      console.log(red(`    • ${f.name}: ${f.error}`));
    }
    console.log('');
  }

  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error(red(`\n  Fatal error: ${err?.message || String(err)}\n`));
  if (err?.stack) console.error(dim(err.stack));
  process.exit(2);
});
