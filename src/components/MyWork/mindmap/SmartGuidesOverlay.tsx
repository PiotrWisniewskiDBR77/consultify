/**
 * SmartGuidesOverlay — M06 Fala 3.1 alignment guides while dragging.
 *
 * A read-only overlay: it subscribes to ReactFlow's live node store and the
 * viewport transform and draws thin guide lines whenever the *dragging* node's
 * edges or centers line up (within `threshold` flow-units) with a neighbour's.
 * It never mutates the graph model, never repositions anything, and renders
 * nothing when no node is being dragged — so it cannot regress the drag-reparent
 * behaviour (lesson 26a2a896ef) or force a canvas remount.
 *
 * Coordinate model matches alignDistribute: box = [x, x+width] × [y, y+height].
 * Guides are drawn in screen space (flow coord × zoom + pan) as a fixed overlay
 * layer above the canvas transform, so no per-frame ReactFlow transform is
 * needed on the lines themselves.
 */
import React, { useMemo } from 'react';
import { useStore } from 'reactflow';

interface SmartGuidesOverlayProps {
  /** Alignment tolerance in flow units. ~5px feels right at 100% zoom. */
  threshold?: number;
  /** Guide line color — pass a resolved token value from the parent. */
  color?: string;
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

export const SmartGuidesOverlay: React.FC<SmartGuidesOverlayProps> = ({
  threshold = 5,
  color = 'var(--c-focus)',
}) => {
  // Subscribe narrowly: node internals (positions/dims + dragging flag) and the
  // viewport transform. useStore re-renders only when the selected slice changes.
  const nodeInternals = useStore((s) => s.nodeInternals);
  const transform = useStore((s) => s.transform); // [x, y, zoom]

  const guides = useMemo<Guide[]>(() => {
    if (!nodeInternals) return [];
    const [tx, ty, zoom] = transform;

    const boxes: {
      id: string;
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
        id: n.id,
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

    // Vertical guides: align x of left / center / right.
    const vKeys: (keyof typeof active[number])[] = ['left', 'cx', 'right'];
    const hKeys: (keyof typeof active[number])[] = ['top', 'cy', 'bottom'];

    for (const a of active) {
      for (const key of vKeys) {
        const av = a[key] as number;
        for (const o of others) {
          for (const ok of vKeys) {
            const ov = o[key === 'cx' ? 'cx' : ok] as number;
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
        const av = a[key] as number;
        for (const o of others) {
          for (const ok of hKeys) {
            const ov = o[key === 'cy' ? 'cy' : ok] as number;
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

  return (
    <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden" aria-hidden>
      {guides.map((g, i) =>
        g.orientation === 'v' ? (
          <div
            key={`v-${i}-${g.pos}`}
            style={{
              position: 'absolute',
              left: g.pos,
              top: g.from,
              height: Math.max(0, g.to - g.from),
              width: 1,
              backgroundColor: color,
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
              height: 1,
              backgroundColor: color,
              opacity: 0.9,
            }}
          />
        )
      )}
    </div>
  );
};

export default SmartGuidesOverlay;
