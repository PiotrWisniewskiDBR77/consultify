/**
 * CanvasSnapGuides — Fala 3 (Z14) shared alignment-guide overlay for the IDEE
 * ReactFlow canvases (Whiteboard · Process Flow · Recommendation Map).
 *
 * Read-only sibling to `useCanvasSnapping`. It subscribes narrowly to the
 * ReactFlow store (node internals + viewport transform) and draws thin dashed
 * guide lines whenever the *dragging* node's edges/centres line up with a
 * neighbour's (within `threshold` flow-units). It never mutates the graph,
 * never repositions anything, and renders `null` when nothing is dragging — so
 * it cannot regress drag-reparent behaviour or force a canvas remount.
 *
 * Generalises the earlier mindmap-only SmartGuidesOverlay: adds a `dashed`
 * style and the c-focus token by default, and is mounted on all three canvases.
 * Because useCanvasSnapping has already *snapped* the dragged node onto the
 * neighbour, the alignment this overlay detects is exact — so the guide appears
 * precisely while the node is magnetically held.
 *
 * Coordinate model matches computeSnap: box = [x, x+width] × [y, y+height].
 * Guides are positioned in screen space (flow × zoom + pan) as a fixed overlay
 * above the canvas transform.
 */
import React, { useMemo } from 'react';
import { useStore } from 'reactflow';

interface CanvasSnapGuidesProps {
  /** Alignment tolerance in flow units (~5 feels right at 100% zoom). */
  threshold?: number;
  /** Guide line color — a resolved token; defaults to the blue focus token. */
  color?: string;
  /** Dashed (default) vs solid line. */
  dashed?: boolean;
}

const DEFAULT_W = 160;
const DEFAULT_H = 48;

interface Guide {
  orientation: 'v' | 'h';
  /** Screen coordinate of the line (x for vertical, y for horizontal). */
  pos: number;
  /** Screen-space span [from, to] along the perpendicular axis. */
  from: number;
  to: number;
}

export const CanvasSnapGuides: React.FC<CanvasSnapGuidesProps> = ({
  threshold = 5,
  color = 'var(--c-focus-solid, var(--c-focus))',
  dashed = true,
}) => {
  const nodeInternals = useStore((s) => s.nodeInternals);
  const transform = useStore((s) => s.transform); // [x, y, zoom]

  const guides = useMemo<Guide[]>(() => {
    if (!nodeInternals) return [];
    const [tx, ty, zoom] = transform;

    const boxes: {
      dragging: boolean;
      left: number;
      right: number;
      top: number;
      bottom: number;
      cx: number;
      cy: number;
    }[] = [];

    nodeInternals.forEach((n: any) => {
      if (!n?.position || n.hidden) return;
      const w = n.width && n.width > 0 ? n.width : DEFAULT_W;
      const h = n.height && n.height > 0 ? n.height : DEFAULT_H;
      boxes.push({
        dragging: Boolean(n.dragging),
        left: n.position.x,
        right: n.position.x + w,
        top: n.position.y,
        bottom: n.position.y + h,
        cx: n.position.x + w / 2,
        cy: n.position.y + h / 2,
      });
    });

    const active = boxes.filter((b) => b.dragging);
    if (active.length === 0) return []; // nothing dragging → no guides
    const others = boxes.filter((b) => !b.dragging);
    if (others.length === 0) return [];

    const toScreenX = (x: number) => x * zoom + tx;
    const toScreenY = (y: number) => y * zoom + ty;

    const out: Guide[] = [];
    const seenV = new Set<number>();
    const seenH = new Set<number>();

    const vKeys = ['left', 'cx', 'right'] as const;
    const hKeys = ['top', 'cy', 'bottom'] as const;

    for (const a of active) {
      for (const key of vKeys) {
        const av = a[key];
        for (const o of others) {
          for (const ok of vKeys) {
            const ov = o[ok];
            if (Math.abs(av - ov) <= threshold) {
              const sx = Math.round(toScreenX(ov));
              if (seenV.has(sx)) continue;
              seenV.add(sx);
              const yTop = Math.min(toScreenY(a.top), toScreenY(o.top));
              const yBot = Math.max(toScreenY(a.bottom), toScreenY(o.bottom));
              out.push({ orientation: 'v', pos: sx, from: yTop, to: yBot });
            }
          }
        }
      }
      for (const key of hKeys) {
        const av = a[key];
        for (const o of others) {
          for (const ok of hKeys) {
            const ov = o[ok];
            if (Math.abs(av - ov) <= threshold) {
              const sy = Math.round(toScreenY(ov));
              if (seenH.has(sy)) continue;
              seenH.add(sy);
              const xL = Math.min(toScreenX(a.left), toScreenX(o.left));
              const xR = Math.max(toScreenX(a.right), toScreenX(o.right));
              out.push({ orientation: 'h', pos: sy, from: xL, to: xR });
            }
          }
        }
      }
    }
    return out;
  }, [nodeInternals, transform, threshold]);

  if (guides.length === 0) return null;

  const border = dashed ? `1px dashed ${color}` : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 z-dropdown overflow-hidden" aria-hidden>
      {guides.map((g, i) =>
        g.orientation === 'v' ? (
          <div
            key={`v-${i}-${g.pos}`}
            style={{
              position: 'absolute',
              left: g.pos,
              top: g.from,
              height: Math.max(0, g.to - g.from),
              width: dashed ? 0 : 1,
              borderLeft: border,
              backgroundColor: dashed ? undefined : color,
              opacity: 0.9,
            }}
          />
        ) : (
          <div
            key={`h-${i}-${g.pos}`}
            style={{
              position: 'absolute',
              top: g.pos,
              left: g.from,
              width: Math.max(0, g.to - g.from),
              height: dashed ? 0 : 1,
              borderTop: border,
              backgroundColor: dashed ? undefined : color,
              opacity: 0.9,
            }}
          />
        )
      )}
    </div>
  );
};

export default CanvasSnapGuides;
