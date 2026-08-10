/**
 * @vitest-environment jsdom
 *
 * Performance measurement — IdeaWhiteboardTool mount time vs node count.
 *
 * Context (docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md):
 * a prior audit claimed "Whiteboard ... missing `onlyRenderVisibleElements`
 * on the canvas" as a code-level risk but measured nothing. Code inspection
 * (src/components/MyWork/IdeaWhiteboardTool.tsx line ~613, the `<ReactFlow
 * ...>` element) confirms `onlyRenderVisibleElements` is never passed —
 * `grep -n onlyRenderVisibleElements IdeaWhiteboardTool.tsx` = 0 matches.
 *
 * This benchmark mounts the REAL IdeaWhiteboardTool with a real (unmocked)
 * `reactflow`, using the same Api.getMyIdeaMap mocking pattern proven in
 * tests/components/MyWork/IdeaWhiteboardTool.drawUndo.test.tsx, varying node
 * count. Nodes are `stickyNote` type with explicit width/height so ReactFlow
 * treats them as "measured" even though jsdom's ResizeObserver never fires
 * (tests/setup.ts:811 stubs it as a no-op — real dimension measurement is
 * therefore NOT exercised here; see the written report for what that means
 * for the "does culling reduce DOM" question, which this file does not
 * answer for Whiteboard because Whiteboard has no culling to begin with).
 *
 * IdeaTableTool's equivalent benchmark (ideaTableTool.mount.bench.test.tsx)
 * OOM'd a jsdom worker at N=5000 even with an 8GB heap, so this file uses
 * smaller ceilings (100/500/1000/2500) and reports honestly if a size fails.
 */
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('reactflow/dist/style.css', () => ({}));
vi.mock('../../src/components/MyWork/whiteboard/whiteboard-canvas.css', () => ({}));

let currentNodes: any[] = [];

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaMap: vi.fn(async () => ({
      map: {
        version: 1,
        nodes: currentNodes,
        edges: [],
        preferredTool: 'whiteboard',
        extensions: { whiteboard: { mode: 'select', drawingPaths: [] } },
      },
    })),
    syncMyIdeaMap: vi.fn().mockResolvedValue({ ok: true }),
    getIdeaMap: vi.fn().mockResolvedValue({ map: { nodes: [], edges: [] } }),
    facilitationCreateSession: vi.fn().mockResolvedValue({ id: 'sess-1' }),
    facilitationResolveByTool: vi.fn().mockResolvedValue({ session: null }),
    facilitationGetSession: vi.fn().mockResolvedValue(null),
    facilitationGetRoles: vi.fn().mockResolvedValue({ roles: [] }),
    facilitationAssignRole: vi.fn().mockResolvedValue({ id: 'role-1' }),
    facilitationUpdateTimer: vi.fn().mockResolvedValue({ ok: true }),
    facilitationUpdatePhase: vi.fn().mockResolvedValue({ ok: true }),
    facilitationGetVotes: vi.fn().mockResolvedValue({ votes: [] }),
    facilitationGetVoteSummary: vi.fn().mockResolvedValue({ summary: [] }),
    toolSessionJoinPresence: vi.fn().mockResolvedValue({ presence: [] }),
    toolSessionListPresence: vi.fn().mockResolvedValue({ presence: [] }),
    toolSessionHeartbeat: vi.fn().mockResolvedValue({ ok: true }),
    toolSessionDisconnect: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      currentUser: { id: 'current-user', firstName: 'Test', lastName: 'User', email: 't@x.io' },
    }),
}));

vi.mock('../../src/components/MyWork/whiteboard/useIdeaMapSync', () => ({
  useIdeaMapSync: () => ({
    saving: false,
    syncState: 'idle',
    lastSavedAt: null,
    queueSync: vi.fn(),
    flushNow: vi.fn().mockResolvedValue(undefined),
    primeServerVersion: vi.fn(),
  }),
}));

vi.mock('../../src/components/MyWork/whiteboard/useWhiteboardCollab', () => ({
  useWhiteboardCollab: () => ({ broadcast: vi.fn(), connected: false }),
}));

import { IdeaWhiteboardTool } from '@/components/MyWork/IdeaWhiteboardTool';

function buildNodes(n: number) {
  const nodes: any[] = [];
  const cols = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `n${i}`,
      type: 'stickyNote',
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 160 },
      width: 180,
      height: 120,
      data: { label: `Sticky ${i}`, color: '#FEF3C7' },
    });
  }
  return nodes;
}

const SIZES = [100, 500, 1000, 2500];
const REPS = 3;

describe('perf: IdeaWhiteboardTool mount time vs node count (no onlyRenderVisibleElements)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const results: Array<{ n: number; meanMs: number; minMs: number; maxMs: number; domNodes: number }> = [];

  for (const n of SIZES) {
    it(`N=${n}: mounts IdeaWhiteboardTool with ${n} real nodes, ${REPS} repetitions`, async () => {
      currentNodes = buildNodes(n);
      const timings: number[] = [];
      let domNodes = 0;
      for (let r = 0; r < REPS; r++) {
        const t0 = performance.now();
        const { container, unmount } = render(
          <IdeaWhiteboardTool open ideaId={`idea-wb-${n}-${r}`} onSaved={vi.fn()} title="Board" seedText="" stage="" />
        );
        await waitFor(
          () => {
            const count = container.querySelectorAll('.react-flow__node').length;
            expect(count).toBe(n);
          },
          { timeout: 60000 }
        );
        const t1 = performance.now();
        timings.push(t1 - t0);
        if (r === REPS - 1) {
          domNodes = container.querySelectorAll('.react-flow__node').length;
        }
        unmount();
      }
      const meanMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);
      results.push({ n, meanMs, minMs, maxMs, domNodes });

      // eslint-disable-next-line no-console
      console.log(
        `[whiteboard-mount-bench] N=${n} reps=${REPS} mean=${meanMs.toFixed(2)}ms min=${minMs.toFixed(2)}ms ` +
          `max=${maxMs.toFixed(2)}ms domNodes=${domNodes} all=[${timings.map((t) => t.toFixed(2)).join(', ')}]`
      );
      expect(domNodes).toBe(n);
    }, 90000);
  }

  it('prints the final N vs ms table', () => {
    // eslint-disable-next-line no-console
    console.log('\n[whiteboard-mount-bench] SUMMARY TABLE');
    // eslint-disable-next-line no-console
    console.log('N\tmean_ms\tmin_ms\tmax_ms\tdomNodes');
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(`${r.n}\t${r.meanMs.toFixed(2)}\t${r.minMs.toFixed(2)}\t${r.maxMs.toFixed(2)}\t${r.domNodes}`);
    }
    expect(results.length).toBeGreaterThan(0);
  });
});
