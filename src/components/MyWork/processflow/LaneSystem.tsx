import { ArrowDownUp, ChevronDown, ChevronRight, Palette, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
// ★ NIE importuj `useViewport` z '@reactflow/core' — to ODDZIELNA instancja
// magazynu zustand niż ta, którą tworzy `<ReactFlowProvider>` z barrela
// 'reactflow'. Efekt: „Seems like you have not used zustand provider as an
// ancestor" i całe Process Flow nie startuje. (Regresja 2026-07-28, złapana
// wzrokiem; barrel nie przenosi `useViewport` do typów, stąd pokusa.)
// `useStore` z 'reactflow' jest typowany poprawnie i czyta TĘ SAMĄ instancję —
// tak robi już `canvas/CanvasSnapGuides.tsx` i `mindmap/SmartGuidesOverlay.tsx`.
import { useStore } from 'reactflow';

import { LANE_HEIGHT } from './FlowNodeComponent';
import { laneBandLayout } from './laneState';
import type { Lane } from './useProcessFlowNodes';

export { LANE_HEIGHT };
export type { Lane };

// ── Lane palette & presets ───────────────────────────────────────────────────
// NOTE: These are NOT semantic-state colors and intentionally stay as raw hex.
// They are a decorative pastel swimlane palette: (1) the user picks a swatch per
// lane, (2) the chosen value is persisted per-lane and concatenated with a hex
// alpha suffix (e.g. `${lane.color}15`), which a CSS var / token cannot support,
// and (3) there is no semantic token for a multi-swatch decorative palette.
// `LANE_COLORS` is itself the exported source-of-truth palette (consumed by
// IdeaProcessFlowTool), so these are not "inline magic hex".

export const LANE_COLORS = [
  '#e0e7ff',
  '#dbeafe',
  '#d1fae5',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#ccfbf1',
  '#fecaca',
  '#e2e8f0',
  '#c7d2fe',
];

export const FLOW_THEME_PRESETS: Record<string, string[]> = {
  ops: ['#dbeafe', '#e0e7ff', '#d1fae5', '#fef3c7', '#fee2e2'],
  workshop: ['#fce7f3', '#ede9fe', '#ccfbf1', '#dbeafe', '#fde68a'],
  strategy: ['#e2e8f0', '#c7d2fe', '#bfdbfe', '#ddd6fe', '#fecdd3'],
};

export const DEFAULT_LANES: Lane[] = [
  { id: 'lane-1', label: 'Main Process', color: LANE_COLORS[0] },
];

// ── Single lane background ───────────────────────────────────────────────────

interface LaneBackgroundProps {
  lane: Lane;
  idx: number;
  /**
   * Band top in CONTAINER px — already projected through the ReactFlow
   * viewport (`flowTop * zoom + viewport.y`), so the band tracks the nodes.
   */
  top: number;
  /** Rendered band height in CONTAINER px (`flowHeight * zoom`). */
  height: number;
  /** Band height in FLOW px (pre-zoom) — the unit `onResize` persists. */
  flowHeight: number;
  /** Current canvas zoom, so pointer deltas convert back to flow px. */
  zoom: number;
  locked: boolean;
  onRename: (id: string, next: string) => void;
  onDelete?: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  /** F5a A3: toggle collapse for this lane. */
  onToggleCollapse?: (id: string) => void;
  /** F5a A3: commit a new band height (px) after a resize drag. */
  onResize?: (id: string, height: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
  laneCount: number;
  isPl?: boolean;
}

const LaneBackground: React.FC<LaneBackgroundProps> = ({
  lane,
  top,
  height,
  flowHeight,
  zoom,
  locked,
  onRename,
  onDelete,
  onColorChange,
  onMoveUp,
  onMoveDown,
  onToggleCollapse,
  onResize,
  isFirst,
  isLast,
  laneCount,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lane.label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== lane.label) onRename(lane.id, value.trim());
  };

  const collapsed = Boolean(lane.collapsed);

  // F5a A3: resize the band by dragging the bottom edge. Pointer maths only —
  // the committed height persists via onResize → lanes[].height.
  // B2 2026-07-27: the pointer delta is SCREEN px, the persisted height is FLOW
  // px — divide by zoom, otherwise resizing at 50%/150% zoom moves the edge at
  // the wrong speed (and desyncs the band from the nodes it contains).
  const startResize = (ev: React.PointerEvent) => {
    if (locked || collapsed || !onResize) return;
    ev.preventDefault();
    ev.stopPropagation();
    const startY = ev.clientY;
    const startH = flowHeight;
    const safeZoom = zoom > 0 ? zoom : 1;
    const onMove = (moveEv: PointerEvent) => {
      const nextH = startH + (moveEv.clientY - startY) / safeZoom;
      onResize(lane.id, nextH);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // B2 2026-07-27: the header keeps a CONSTANT screen size (it lives outside the
  // scaled band content) so lane names stay readable when the user zooms out —
  // but a band thinner than the header row would just render a smear of
  // overlapping labels, so below that we show the colour strip only.
  const showHeader = height >= 14;

  return (
    <div
      className="absolute left-0 right-0 border-b border-c-border-subtle"
      style={{ top, height, background: `${lane.color}15` }}
    >
      {showHeader && (
        <div className="absolute left-2 top-1 z-10 flex items-center gap-1">
          {onToggleCollapse && (
            <button
              onClick={() => onToggleCollapse(lane.id)}
              className="p-0.5 rounded hover:bg-c-surface-raised"
              title={
                collapsed
                  ? t('processFlow.laneSystem.expandLane', 'Expand lane')
                  : t('processFlow.laneSystem.collapseLane', 'Collapse lane')
              }
              aria-label={
                collapsed
                  ? t('processFlow.laneSystem.expandLane', 'Expand lane')
                  : t('processFlow.laneSystem.collapseLane', 'Collapse lane')
              }
            >
              {collapsed ? (
                <ChevronRight size={11} className="text-slate-600 dark:text-slate-400" />
              ) : (
                <ChevronDown size={11} className="text-slate-600 dark:text-slate-400" />
              )}
            </button>
          )}
          {editing ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="text-[10px] font-semibold text-c-text-secondary bg-c-surface rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-c-focus border border-c-focus"
            />
          ) : (
            <div
              className="text-[10px] font-semibold text-c-text-muted select-none cursor-pointer hover:text-c-text-secondary"
              onDoubleClick={() => {
                if (!locked) {
                  setValue(lane.label);
                  setEditing(true);
                }
              }}
            >
              {lane.label}
            </div>
          )}

          {!locked && (
            <div
              className="flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity"
              style={{ opacity: undefined }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0';
              }}
            >
              {!isFirst && (
                <button
                  onClick={() => onMoveUp?.(lane.id)}
                  className="p-0.5 rounded hover:bg-c-surface"
                  title="Move up"
                >
                  <ArrowDownUp size={9} className="text-c-text-secondary rotate-180" />
                </button>
              )}
              {!isLast && (
                <button
                  onClick={() => onMoveDown?.(lane.id)}
                  className="p-0.5 rounded hover:bg-c-surface"
                  title="Move down"
                >
                  <ArrowDownUp size={9} className="text-c-text-secondary" />
                </button>
              )}
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-0.5 rounded hover:bg-c-surface"
                title="Change color"
              >
                <Palette size={9} className="text-c-text-secondary" />
              </button>
              {laneCount > 1 && (
                <button
                  onClick={() => onDelete?.(lane.id)}
                  className="p-0.5 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20"
                  title="Delete lane"
                >
                  <X size={9} className="text-danger-400" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showColorPicker && !locked && (
        <div className="absolute left-2 top-5 z-20 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg p-1.5 shadow-lg flex flex-wrap gap-1 w-[120px]">
          {LANE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onColorChange?.(lane.id, c);
                setShowColorPicker(false);
              }}
              title={t('processFlow.laneSystem.setColor', 'Set lane color')}
              aria-label={t('processFlow.laneSystem.setColor', 'Set lane color')}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${c === lane.color ? 'border-c-text scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      {/* F5a A3: bottom-edge resize handle (hidden when locked/collapsed). */}
      {!locked && !collapsed && onResize && showHeader && (
        <div
          onPointerDown={startResize}
          className="absolute left-0 right-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity bg-[var(--c-info)]/40"
          title={t('processFlow.laneSystem.resizeLane', 'Resize lane')}
        />
      )}
    </div>
  );
};

// ── LaneSystem – renders all lane backgrounds ────────────────────────────────

export interface LaneSystemProps {
  lanes: Lane[];
  isPl: boolean;
  locked: boolean;
  onRename: (laneId: string, newLabel: string) => void;
  onDelete: (laneId: string) => void;
  onColorChange: (laneId: string, color: string) => void;
  onMoveUp: (laneId: string) => void;
  onMoveDown: (laneId: string) => void;
  /** F5a A3: toggle a lane collapsed. */
  onToggleCollapse?: (laneId: string) => void;
  /** F5a A3: commit a resized lane height (px). */
  onResize?: (laneId: string, height: number) => void;
  dragOverLaneId: string | null;
  /**
   * B2 2026-07-27: current ReactFlow viewport. Lane bands are laid out in FLOW
   * coordinates (same space as `node.position.y`, see `laneBandLayout` /
   * `laneIndexAtY`) but painted in a plain container that sits OUTSIDE the
   * ReactFlow transform — so they must be projected by hand. Defaults to the
   * identity viewport, which reproduces the pre-fix geometry (used by unit
   * tests that render LaneSystem without a ReactFlowProvider).
   */
  viewport?: { x: number; y: number; zoom: number };
}

export const LaneSystem: React.FC<LaneSystemProps> = ({
  lanes,
  isPl,
  locked,
  onRename,
  onDelete,
  onColorChange,
  onMoveUp,
  onMoveDown,
  onToggleCollapse,
  onResize,
  dragOverLaneId,
  viewport,
}) => {
  const layout = laneBandLayout(lanes, LANE_HEIGHT);
  const zoom = viewport && viewport.zoom > 0 ? viewport.zoom : 1;
  const offsetY = viewport ? viewport.y : 0;
  /** Flow-space band → container-space band (vertical only: bands are strips). */
  const project = (band: { top: number; height: number }) => ({
    top: band.top * zoom + offsetY,
    height: band.height * zoom,
  });
  return (
    <>
      {lanes.map((lane, idx) => {
        const band = layout[lane.id] ?? { top: idx * LANE_HEIGHT, height: LANE_HEIGHT };
        const screen = project(band);
        return (
          <LaneBackground
            key={lane.id}
            lane={lane}
            idx={idx}
            top={screen.top}
            height={screen.height}
            flowHeight={band.height}
            zoom={zoom}
            locked={locked}
            isPl={isPl}
            onRename={onRename}
            onDelete={onDelete}
            onColorChange={onColorChange}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onToggleCollapse={onToggleCollapse}
            onResize={onResize}
            isFirst={idx === 0}
            isLast={idx === lanes.length - 1}
            laneCount={lanes.length}
          />
        );
      })}
      {dragOverLaneId &&
        (() => {
          const band = layout[dragOverLaneId];
          if (!band) return null;
          const screen = project(band);
          return (
            <div
              className="absolute left-0 right-0 pointer-events-none border-2 border-c-focus rounded-lg"
              style={{ top: screen.top, height: screen.height }}
            />
          );
        })()}
    </>
  );
};

/**
 * B2 2026-07-27: viewport-aware wrapper. MUST be rendered inside
 * `<ReactFlowProvider>`; it re-renders on pan/zoom and hands the live viewport
 * to the (context-free, unit-testable) `LaneSystem`.
 */
export const LaneSystemViewportLayer: React.FC<LaneSystemProps> = (props) => {
  // `transform` to [x, y, zoom] — to samo źródło co `useViewport`, ale czytane
  // przez `useStore` z barrela, czyli z właściwej instancji magazynu.
  const transform = useStore((s) => s.transform);
  const viewport = React.useMemo(
    () => ({ x: transform[0], y: transform[1], zoom: transform[2] }),
    [transform]
  );
  return <LaneSystem {...props} viewport={viewport} />;
};

export default LaneSystem;
