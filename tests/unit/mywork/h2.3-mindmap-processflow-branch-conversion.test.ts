/**
 * H2.3 regression — "MindMap → Process Flow (branch)" actually converts.
 *
 * Bug (pre-`35e55d879d`): the mind-map context-menu action
 * `ctx_subtree_convert_process_flow` (and its floating-toolbar twin) dispatched
 * a bare `switch_to_process_flow` event, which only called `setActiveTool(
 * 'process_flow')` and toasted success — no node/edge data from the branch was
 * ever carried over. The canvas silently ended up empty after "converting".
 *
 * Fix (`35e55d879d`, on `origin/demo`): both call sites now route through
 * `convertBranch('process_flow', nodeId)` — exactly like every sibling target
 * (Initiative/Decision/Task Set) — which dispatches `idea-workspace-quick-
 * action` with `{ action: 'convert_process_flow', nodeIds: [<branch ids>] }`.
 * `IdeaMapWorkspace.handleQuickAction` was extended to treat
 * `convert_process_flow` with explicit `nodeIds` as a real transform (reusing
 * the same `transformSelection` pipeline as `xform_to_flow`), instead of
 * silently falling through.
 *
 * Test strategy: `IdeaRecommendationMap.tsx` (~6.6k lines) and
 * `IdeaMapWorkspace.tsx` (~3.8k lines) are monolithic canvas components with
 * no render harness anywhere in the repo (30+ child-component/hook imports,
 * ReactFlow internals, live API/store wiring) — mounting either one is out of
 * proportion for a single-action regression guard. So this test has two parts:
 *
 *  1. An EXECUTABLE test against `transformSelection`/`toProcessFlow` (the
 *     real, already-unit-tested conversion logic — see `crossToolTransform
 *     .test.ts`) proving that, given the exact shape `convertBranch` hands it
 *     (a branch's node ids resolved to live nodes/edges), the branch's data
 *     genuinely becomes Process Flow nodes/edges — not a blank canvas.
 *  2. A SOURCE-INVARIANT guard directly encoding the historical defect: both
 *     `IdeaRecommendationMap.tsx` call sites must route through
 *     `convertBranch('process_flow', ...)`, and neither may re-introduce the
 *     bare `switch_to_process_flow` dispatch for this action.  This is the
 *     part that actually broke — `toProcessFlow` was already correct; it was
 *     simply never invoked. A revert of the wiring is exactly what this
 *     guard catches, without needing to mount either monolith.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { transformSelection } from '../../../src/components/MyWork/transforms/crossToolTransform';

const IDEA_RECOMMENDATION_MAP_PATH = join(
  __dirname,
  '../../../src/components/MyWork/IdeaRecommendationMap.tsx'
);
const IDEA_MAP_WORKSPACE_PATH = join(
  __dirname,
  '../../../src/components/MyWork/IdeaMapWorkspace.tsx'
);

describe('H2.3 — transformSelection actually converts a mind-map branch to Process Flow', () => {
  it('given the branch nodeIds convertBranch collects (parent + descendants), produces real Process Flow nodes/edges carrying the source data', () => {
    // Mirrors convertBranch: branchNodeIds = [targetNodeId, ...collectDescendants(targetNodeId)]
    const branchNodes = [
      {
        id: 'branch-root',
        type: 'idea',
        position: { x: 0, y: 0 },
        data: { label: 'Assess vendor risk', branchKey: 'risks', tags: ['vendor'] },
      },
      {
        id: 'branch-child-1',
        type: 'idea',
        position: { x: 100, y: 0 },
        data: { label: 'Collect vendor SOC2', branchKey: 'risks' },
      },
      {
        id: 'branch-child-2',
        type: 'idea',
        position: { x: 200, y: 0 },
        data: { label: 'Escalate to legal', branchKey: 'risks' },
      },
      // A sibling node OUTSIDE the branch — must not leak into the conversion.
      { id: 'unrelated', type: 'idea', position: { x: 999, y: 999 }, data: { label: 'Unrelated idea' } },
    ] as any[];

    const branchEdges = [
      { id: 'e1', source: 'branch-root', target: 'branch-child-1' },
      { id: 'e2', source: 'branch-root', target: 'branch-child-2' },
      // Edge touching the unrelated node — must be filtered out too.
      { id: 'e3', source: 'branch-root', target: 'unrelated' },
    ] as any[];

    const branchNodeIds = ['branch-root', 'branch-child-1', 'branch-child-2'];

    // Same filtering IdeaMapWorkspace.handleQuickAction performs before calling
    // transformSelection: only edges where BOTH endpoints are in the explicit
    // nodeIds set are carried over.
    const selectedSet = new Set(branchNodeIds);
    const relevantEdges = branchEdges.filter(
      (e) => selectedSet.has(e.source) && selectedSet.has(e.target)
    );

    const result = transformSelection(
      {
        sourceTool: 'mindmap',
        nodes: branchNodes,
        edges: relevantEdges,
        selectedIds: branchNodeIds,
      },
      'process_flow'
    );

    expect(result).toBeTruthy();
    expect(result!.type).toBe('process_flow');
    const { nodes, edges } = result!.data as { nodes: any[]; edges: any[] };

    // Real conversion, not an empty canvas: Start node + one flow node per
    // branch member (3) + End node, chained by one edge per hop.
    expect(nodes.length).toBe(2 + branchNodeIds.length);
    expect(edges.length).toBe(1 + branchNodeIds.length);

    const labels = nodes.map((n) => n.data?.label);
    expect(labels).toContain('Assess vendor risk');
    expect(labels).toContain('Collect vendor SOC2');
    expect(labels).toContain('Escalate to legal');
    // The unrelated sibling must not have leaked into the conversion.
    expect(labels).not.toContain('Unrelated idea');

    // Traceability back to the source mind-map node — proves data actually
    // carried over, the exact thing the pre-fix bare tool-switch never did.
    const rootStep = nodes.find((n) => n.data?.label === 'Assess vendor risk');
    expect(rootStep?.data?.sourceTrace).toMatchObject({
      sourceNodeId: 'branch-root',
      sourceTool: 'mindmap',
      sourceBranchKey: 'risks',
    });
    expect(rootStep?.data?.tags).toEqual(['vendor']);
  });
});

describe('H2.3 — wiring guard: subtree "→ Process Flow" routes through convertBranch, not a bare tool-switch', () => {
  const mapSrc = readFileSync(IDEA_RECOMMENDATION_MAP_PATH, 'utf8');
  const workspaceSrc = readFileSync(IDEA_MAP_WORKSPACE_PATH, 'utf8');

  it('IdeaRecommendationMap.tsx no longer dispatches the historical switch_to_process_flow bare tool-switch', () => {
    // Pre-fix, this file dispatched `switch_to_process_flow` from two call
    // sites (context menu + floating toolbar). Post-fix it has zero — the
    // string legitimately belongs only in IdeaMapWorkspace.tsx, where it is
    // kept as an unrelated, separate "just switch tool, no data" action.
    expect(mapSrc).not.toContain('switch_to_process_flow');
  });

  it('context-menu handleContextAction routes ctx_subtree_convert_process_flow through convertBranch(\'process_flow\', ...)', () => {
    const marker = "if (action === 'ctx_subtree_convert_process_flow')";
    const idx = mapSrc.indexOf(marker);
    expect(idx, 'ctx_subtree_convert_process_flow handler must exist in handleContextAction').toBeGreaterThan(-1);

    const block = mapSrc.slice(idx, idx + 400);
    expect(block).toContain("convertBranch('process_flow'");
  });

  it('floating-toolbar SUBTREE_MAP includes ctx_subtree_convert_process_flow → process_flow (same path as every sibling target)', () => {
    const marker = 'const SUBTREE_MAP: Record<string, string> = {';
    const idx = mapSrc.indexOf(marker);
    expect(idx, 'floating-toolbar SUBTREE_MAP must exist').toBeGreaterThan(-1);

    const closeIdx = mapSrc.indexOf('};', idx);
    const block = mapSrc.slice(idx, closeIdx);
    expect(block).toContain('ctx_subtree_convert_process_flow');
    expect(block).toMatch(/ctx_subtree_convert_process_flow:\s*'process_flow'/);

    // Sibling targets that always worked (never had the bug) — sanity check
    // that we're looking at the right map, not a coincidental match.
    expect(block).toContain('ctx_subtree_convert_initiative');
  });

  it('IdeaMapWorkspace.handleQuickAction treats convert_process_flow with explicit nodeIds as a real transform, not a no-op', () => {
    // The routing guard added by the fix: convert_process_flow only reaches
    // the transformSelection pipeline when explicit nodeIds are present
    // (i.e. it came from convertBranch, not some other stray dispatch).
    expect(workspaceSrc).toMatch(
      /XFORM_MAP\[action\]\s*\|\|\s*\(action === 'convert_process_flow' && explicitNodeIds\)/
    );
    // selectedIds must prefer the explicit branch nodeIds over any live
    // canvas selection — the branch conversion carries its own explicit list.
    expect(workspaceSrc).toMatch(/const selectedIds = explicitNodeIds \|\| sel\.ids \|\| \[\];/);
    // The pipeline must actually run transformSelection for this to mean
    // anything (guards against someone gutting the body while keeping the
    // condition cosmetically intact).
    const guardIdx = workspaceSrc.indexOf("action === 'convert_process_flow' && explicitNodeIds");
    expect(guardIdx).toBeGreaterThan(-1);
    const bodyAfterGuard = workspaceSrc.slice(guardIdx, guardIdx + 2000);
    expect(bodyAfterGuard).toContain('transformSelection(transformInput, targetTool)');
  });
});
