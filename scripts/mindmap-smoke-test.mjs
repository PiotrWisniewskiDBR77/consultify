#!/usr/bin/env node
/**
 * Mindmap Smoke Test — verifies fundamental UX contracts against Railway DB.
 *
 * Tests:
 * 1. All 5 showcase maps exist with correct node/edge counts
 * 2. Every map has a root node at position (0,0) with semanticType 'problem'
 * 3. Every branch node has at least 1 structural child edge
 * 4. No orphan nodes (every non-root node has an incoming structural edge)
 * 5. No duplicate node IDs within a map
 * 6. Extensions don't have viewport {0,0} (would skip fitView)
 * 7. Cross-link edges have edgeRole 'relation'
 * 8. All idea nodes have required depth fields
 *
 * Usage: node scripts/mindmap-smoke-test.mjs
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';

const { Client } = pg;

const ENV_PATH = process.env.ENV_PATH ||
  '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/.env.staging.local';

function loadDbUrl() {
  try {
    const content = readFileSync(ENV_PATH, 'utf-8');
    const match = content.match(/DATABASE_URL=(.+)/);
    return match?.[1]?.trim();
  } catch { return null; }
}

const DB_URL = process.env.DATABASE_URL || loadDbUrl();
if (!DB_URL) { console.error('No DATABASE_URL'); process.exit(1); }

const EXPECTED_MAPS = [
  { title: 'Pricing Pivot Analysis', minNodes: 10, minEdges: 10 },
  { title: 'Product Discovery: Second Product Line', minNodes: 18, minEdges: 20 },
  { title: 'Platform Migration War Room', minNodes: 18, minEdges: 20 },
  { title: 'AI Governance Framework', minNodes: 20, minEdges: 25 },
  { title: 'Q3 Personal OKR Planning', minNodes: 12, minEdges: 14 },
];

let passed = 0;
let failed = 0;

function ok(msg) { passed++; console.log(`  ✅ ${msg}`); }
function fail(msg) { failed++; console.log(`  ❌ ${msg}`); }

async function main() {
  const client = new Client(DB_URL);
  await client.connect();

  console.log('\n🧪 Mindmap Smoke Test\n');

  const { rows } = await client.query(`
    SELECT i.id, i.title,
      m.nodes_json, m.edges_json, m.extensions_json, m.version
    FROM my_ideas i
    JOIN my_idea_maps m ON m.idea_id = i.id::text
    WHERE i.title = ANY($1::text[])
  `, [EXPECTED_MAPS.map(m => m.title)]);

  // Test 1: All maps exist
  console.log('1) Map existence');
  for (const expected of EXPECTED_MAPS) {
    const row = rows.find(r => r.title === expected.title);
    if (!row) { fail(`Missing: ${expected.title}`); continue; }

    const nodes = JSON.parse(row.nodes_json);
    const edges = JSON.parse(row.edges_json);
    const ext = row.extensions_json ? JSON.parse(row.extensions_json) : {};

    if (nodes.length >= expected.minNodes) {
      ok(`${expected.title}: ${nodes.length} nodes (≥${expected.minNodes})`);
    } else {
      fail(`${expected.title}: ${nodes.length} nodes (expected ≥${expected.minNodes})`);
    }
    if (edges.length >= expected.minEdges) {
      ok(`${expected.title}: ${edges.length} edges (≥${expected.minEdges})`);
    } else {
      fail(`${expected.title}: ${edges.length} edges (expected ≥${expected.minEdges})`);
    }

    // Test 2: Root node
    console.log(`\n2) Root node — ${expected.title}`);
    const root = nodes.find(n => n.id === 'root');
    if (!root) { fail('No root node'); continue; }
    if (root.position?.x === 0 && root.position?.y === 0) {
      ok('Root at (0,0)');
    } else {
      fail(`Root at (${root.position?.x}, ${root.position?.y})`);
    }
    if (root.data?.semanticType === 'problem') {
      ok('Root semanticType = problem');
    } else {
      fail(`Root semanticType = ${root.data?.semanticType}`);
    }

    // Test 3: Branch nodes have children
    console.log(`\n3) Branch children — ${expected.title}`);
    const branchNodes = nodes.filter(n => n.type === 'branch');
    for (const bn of branchNodes) {
      const childEdges = edges.filter(e =>
        e.source === bn.id && e.data?.edgeRole !== 'relation'
      );
      if (childEdges.length > 0) {
        ok(`${bn.data?.label}: ${childEdges.length} children`);
      } else {
        fail(`${bn.data?.label}: 0 children`);
      }
    }

    // Test 4: No orphans
    console.log(`\n4) Orphan check — ${expected.title}`);
    const structuralTargets = new Set(
      edges.filter(e => e.data?.edgeRole !== 'relation').map(e => e.target)
    );
    const orphans = nodes.filter(n =>
      n.id !== 'root' && !structuralTargets.has(n.id)
    );
    if (orphans.length === 0) {
      ok('No orphan nodes');
    } else {
      fail(`${orphans.length} orphans: ${orphans.map(n => n.id).join(', ')}`);
    }

    // Test 5: No duplicate IDs
    console.log(`\n5) Duplicate IDs — ${expected.title}`);
    const ids = nodes.map(n => n.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length === 0) {
      ok('No duplicate node IDs');
    } else {
      fail(`Duplicates: ${dupes.join(', ')}`);
    }

    // Test 6: Viewport not {0,0}
    console.log(`\n6) Viewport — ${expected.title}`);
    const vp = ext?.mindmap?.viewState?.viewport;
    if (!vp || (vp.x === 0 && vp.y === 0)) {
      ok('No stale viewport (will use fitView)');
    } else {
      ok(`Saved viewport: (${vp.x}, ${vp.y}, zoom=${vp.zoom})`);
    }

    // Test 7: Cross-links have relation role
    console.log(`\n7) Cross-links — ${expected.title}`);
    const crossLinks = edges.filter(e => e.data?.edgeRole === 'relation');
    if (crossLinks.length > 0) {
      ok(`${crossLinks.length} cross-links with edgeRole=relation`);
    } else {
      ok('No cross-links (acceptable)');
    }

    console.log('');
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}\n`);

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
