/**
 * M06 Fala 3.3 — synthetic large-map performance profile.
 *
 * jsdom has no layout engine, so ReactFlow's built-in `onlyRenderVisibleElements`
 * (which reads real getBoundingClientRect sizes) cannot be exercised meaningfully
 * here — every node would measure 0×0. Per the Fala 3.3 spec we therefore measure
 * the *load-bearing* quantity instead: how many nodes the viewport culling keeps
 * mounted for 500- and 1000-node maps (the DOM-element count ReactFlow would emit
 * with culling ON) versus OFF (all nodes mounted).
 *
 * This is a deterministic proxy for render cost: DOM element count is the single
 * biggest driver of layout/paint time for large ReactFlow graphs.
 */
import { describe, expect, it } from 'vitest';

import {
  type FlowViewport,
  type NodeBox,
  isNodeRenderable,
} from '@/components/MyWork/mindmap/virtualization';

// A realistic grid layout: nodes on a 220×90 pitch, ~sqrt aspect ratio.
function buildGridMap(count: number): NodeBox[] {
  const cols = Math.ceil(Math.sqrt(count));
  const boxes: NodeBox[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    boxes.push({ id: `n${i}`, x: col * 220, y: row * 90, width: 160, height: 48 });
  }
  return boxes;
}

// A ~laptop viewport (1440×900) sitting on the top-left of the map, with the
// generous prefetch margin ReactFlow uses so panning doesn't pop nodes in late.
function laptopViewport(): FlowViewport {
  return { minX: 0, minY: 0, maxX: 1440, maxY: 900 };
}
const PREFETCH_MARGIN = 200;

function profile(count: number) {
  const boxes = buildGridMap(count);
  const vp = laptopViewport();
  const rendered = boxes.filter((b) =>
    isNodeRenderable(b, vp, { margin: PREFETCH_MARGIN })
  ).length;
  return { total: boxes.length, renderedWithCulling: rendered, renderedWithoutCulling: count };
}

describe('large-map render profile (DOM-element proxy)', () => {
  it('500 nodes: culling mounts far fewer DOM nodes than OFF', () => {
    const p = profile(500);
    // eslint-disable-next-line no-console
    console.log(
      `[profile] 500 nodes — DOM nodes OFF=${p.renderedWithoutCulling} ON=${p.renderedWithCulling}`
    );
    expect(p.renderedWithoutCulling).toBe(500);
    // Only the viewport-window worth of nodes survives — a large reduction.
    expect(p.renderedWithCulling).toBeLessThan(p.total * 0.35);
    expect(p.renderedWithCulling).toBeGreaterThan(0);
  });

  it('1000 nodes: culling reduction is even steeper (bounded viewport window)', () => {
    const p = profile(1000);
    // eslint-disable-next-line no-console
    console.log(
      `[profile] 1000 nodes — DOM nodes OFF=${p.renderedWithoutCulling} ON=${p.renderedWithCulling}`
    );
    expect(p.renderedWithoutCulling).toBe(1000);
    expect(p.renderedWithCulling).toBeLessThan(p.total * 0.2);
    // The visible window is a fixed area, so 1000-node and 500-node maps mount a
    // similar *absolute* number of DOM nodes — cost stops scaling with map size.
    const p500 = profile(500);
    expect(Math.abs(p.renderedWithCulling - p500.renderedWithCulling)).toBeLessThan(30);
  });

  it('selected off-screen nodes are always kept mounted (multi-select survives)', () => {
    const boxes = buildGridMap(1000);
    const vp = laptopViewport();
    // Select 5 nodes near the far corner (definitely off-screen).
    const keep = new Set(['n995', 'n996', 'n997', 'n998', 'n999']);
    const rendered = boxes.filter((b) =>
      isNodeRenderable(b, vp, { margin: PREFETCH_MARGIN, keepMountedIds: keep })
    );
    for (const id of keep) {
      expect(rendered.some((b) => b.id === id)).toBe(true);
    }
  });
});
