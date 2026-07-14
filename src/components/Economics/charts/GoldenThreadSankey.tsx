import React, { useMemo, useState } from 'react';

/**
 * GoldenThreadSankey — "złota nić" inicjatywa → KPI → linia finansowa → wartość.
 *
 * Kanon: docs/ui-standards/03-modules/FINANCE_VISUAL_CANON.md §3 (Sankey, zadanie 2.2).
 * Czysty SVG, własny prosty layout (BEZ d3-sankey). Kolory wg §1 (znaczeniowe):
 *   column 0 = inicjatywa (blue/progress), 1 = KPI (violet/accent),
 *   2 = linia finansowa (slate/baseline), 3+ = wartość (emerald/positive).
 *
 * Kluczowa cecha: SIEROTY (orphans) — węzły bez wchodzących/wychodzących linków —
 * podświetlone amber/rose obramowaniem (zerwana nić). Patrz §1 reguła czerwieni:
 * rose tylko gdy węzeł jest CAŁKOWICIE odpięty (realna luka), inaczej amber (uwaga).
 */

export interface GoldenThreadNode {
  id: string;
  label: string;
  /** Warstwa 0..N: 0=inicjatywa, 1=KPI, 2=linia finansowa, 3=wartość. */
  column: number;
}

export interface GoldenThreadLink {
  source: string;
  target: string;
  value: number;
}

export interface GoldenThreadSankeyProps {
  nodes: GoldenThreadNode[];
  links: GoldenThreadLink[];
  height?: number;
  onSelect?: (id: string) => void;
}

/** Kolory kolumn wg FINANCE_VISUAL_CANON §1. */
const COLUMN_COLORS: { fill: string; stroke: string }[] = [
  { fill: '#3b82f6', stroke: '#2563eb' }, // 0 inicjatywa — blue (--fin-progress)
  { fill: '#8b5cf6', stroke: '#7c3aed' }, // 1 KPI — violet (--fin-accent)
  { fill: '#94a3b8', stroke: '#64748b' }, // 2 linia finansowa — slate (--fin-baseline)
  { fill: '#10b981', stroke: '#059669' }, // 3 wartość — emerald (--fin-positive)
];

const ORPHAN_AMBER = '#f59e0b'; // --fin-warning (częściowo odpięty)
const ORPHAN_ROSE = '#f43f5e'; // --fin-negative (całkowicie odpięty)

function colorForColumn(column: number) {
  return COLUMN_COLORS[Math.min(Math.max(column, 0), COLUMN_COLORS.length - 1)];
}

interface LaidOutNode extends GoldenThreadNode {
  x: number;
  y: number;
  width: number;
  nodeHeight: number;
  inValue: number;
  outValue: number;
  isOrphan: boolean;
  orphanKind: 'in' | 'out' | 'isolated' | null;
  // running cursor for stacking ribbons on each side
  outCursor: number;
  inCursor: number;
}

interface LaidOutLink extends GoldenThreadLink {
  path: string;
  thickness: number;
  color: string;
}

const NODE_WIDTH = 16;
const H_PADDING = 24;
const V_PADDING = 16;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 8;

function buildLayout(
  nodes: GoldenThreadNode[],
  links: GoldenThreadLink[],
  width: number,
  height: number
): { laidNodes: LaidOutNode[]; laidLinks: LaidOutLink[]; orphanCount: number } {
  // 1. Aggregate flow per node.
  const inByNode = new Map<string, number>();
  const outByNode = new Map<string, number>();
  for (const l of links) {
    const v = Number.isFinite(l.value) ? Math.max(l.value, 0) : 0;
    outByNode.set(l.source, (outByNode.get(l.source) ?? 0) + v);
    inByNode.set(l.target, (inByNode.get(l.target) ?? 0) + v);
  }

  // 2. Group nodes by column.
  const columns = new Map<number, GoldenThreadNode[]>();
  for (const n of nodes) {
    const arr = columns.get(n.column) ?? [];
    arr.push(n);
    columns.set(n.column, arr);
  }
  const columnKeys = [...columns.keys()].sort((a, b) => a - b);
  const colCount = columnKeys.length;

  // Global flow scale: pick the column with the largest summed flow so the
  // tallest column fills the available vertical space.
  const innerHeight = Math.max(height - V_PADDING * 2, 1);

  let maxColumnFlow = 0;
  for (const key of columnKeys) {
    const colNodes = columns.get(key)!;
    const sum = colNodes.reduce((acc, n) => {
      const flow = Math.max(inByNode.get(n.id) ?? 0, outByNode.get(n.id) ?? 0);
      return acc + Math.max(flow, 0);
    }, 0);
    maxColumnFlow = Math.max(maxColumnFlow, sum);
  }

  const laidByCol = new Map<number, LaidOutNode[]>();
  const laidById = new Map<string, LaidOutNode>();

  columnKeys.forEach((key, colIndex) => {
    const colNodes = columns.get(key)!;
    const gapTotal = NODE_GAP * Math.max(colNodes.length - 1, 0);
    const availableForBars = Math.max(innerHeight - gapTotal, colNodes.length * MIN_NODE_HEIGHT);
    const scale = maxColumnFlow > 0 ? availableForBars / maxColumnFlow : 0;

    // Node heights for this column.
    const heights = colNodes.map((n) => {
      const flow = Math.max(inByNode.get(n.id) ?? 0, outByNode.get(n.id) ?? 0);
      return Math.max(flow * scale, MIN_NODE_HEIGHT);
    });
    const usedHeight = heights.reduce((a, b) => a + b, 0) + gapTotal;
    let cursorY = V_PADDING + Math.max((innerHeight - usedHeight) / 2, 0);

    const x =
      colCount > 1
        ? H_PADDING + (colIndex * (width - H_PADDING * 2 - NODE_WIDTH)) / (colCount - 1)
        : H_PADDING;

    const laid: LaidOutNode[] = colNodes.map((n, i) => {
      const inValue = inByNode.get(n.id) ?? 0;
      const outValue = outByNode.get(n.id) ?? 0;
      const hasIn = inValue > 0;
      const hasOut = outValue > 0;
      const isFirst = colIndex === 0;
      const isLast = colIndex === colCount - 1;
      // Expectation: non-first columns should have inflow; non-last should have outflow.
      let orphanKind: LaidOutNode['orphanKind'] = null;
      if (!hasIn && !hasOut) {
        orphanKind = 'isolated';
      } else if (!isFirst && !hasIn) {
        orphanKind = 'in';
      } else if (!isLast && !hasOut) {
        orphanKind = 'out';
      }
      const node: LaidOutNode = {
        ...n,
        x,
        y: cursorY,
        width: NODE_WIDTH,
        nodeHeight: heights[i],
        inValue,
        outValue,
        isOrphan: orphanKind !== null,
        orphanKind,
        outCursor: cursorY,
        inCursor: cursorY,
      };
      cursorY += heights[i] + NODE_GAP;
      laidById.set(n.id, node);
      return node;
    });
    laidByCol.set(key, laid);
  });

  const laidNodes = [...laidById.values()];

  // 3. Build ribbon paths. Thickness proportional to value, scaled like nodes.
  const laidLinks: LaidOutLink[] = [];
  for (const l of links) {
    const src = laidById.get(l.source);
    const tgt = laidById.get(l.target);
    if (!src || !tgt) continue;
    const v = Math.max(Number.isFinite(l.value) ? l.value : 0, 0);

    // Thickness: share of the source node's outflow mapped to its bar height.
    const srcShare = src.outValue > 0 ? v / src.outValue : 0;
    const tgtShare = tgt.inValue > 0 ? v / tgt.inValue : 0;
    const srcThick = Math.max(srcShare * src.nodeHeight, 1);
    const tgtThick = Math.max(tgtShare * tgt.nodeHeight, 1);
    const thickness = Math.max((srcThick + tgtThick) / 2, 1);

    const x0 = src.x + src.width;
    const x1 = tgt.x;
    const sy = src.outCursor + srcThick / 2;
    const ty = tgt.inCursor + tgtThick / 2;
    src.outCursor += srcThick;
    tgt.inCursor += tgtThick;

    const midX = (x0 + x1) / 2;
    const path = `M ${x0} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${x1} ${ty}`;

    laidLinks.push({
      ...l,
      path,
      thickness,
      color: colorForColumn(src.column).fill,
    });
  }

  const orphanCount = laidNodes.filter((n) => n.isOrphan).length;
  return { laidNodes, laidLinks, orphanCount };
}

export const GoldenThreadSankey: React.FC<GoldenThreadSankeyProps> = ({
  nodes,
  links,
  height = 360,
  onSelect,
}) => {
  const width = 720;
  const [hovered, setHovered] = useState<
    | { kind: 'node'; id: string; label: string; value: number; orphan: boolean }
    | { kind: 'link'; label: string; value: number }
    | null
  >(null);

  const { laidNodes, laidLinks, orphanCount } = useMemo(
    () => buildLayout(nodes ?? [], links ?? [], width, height),
    [nodes, links, height]
  );

  const isEmpty = !nodes || nodes.length === 0;

  if (isEmpty) {
    return (
      <div
        data-testid="golden-thread-sankey"
        data-empty="true"
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        style={{ height }}
      >
        <span>Brak danych — połącz inicjatywy z KPI i wartością, aby zobaczyć złotą nić.</span>
      </div>
    );
  }

  return (
    <div
      data-testid="golden-thread-sankey"
      data-orphan-count={orphanCount}
      className="relative rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Złota nić: ${nodes.length} węzłów, ${links?.length ?? 0} powiązań, ${orphanCount} sierot`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ribbons (links) — render first so nodes sit on top. */}
        <g data-testid="gt-links">
          {laidLinks.map((l, i) => (
            <path
              key={`${l.source}->${l.target}-${i}`}
              data-testid="gt-link"
              d={l.path}
              fill="none"
              stroke={l.color}
              strokeWidth={l.thickness}
              strokeOpacity={hovered && hovered.kind === 'link' ? 0.65 : 0.32}
              style={{ cursor: 'pointer', transition: 'stroke-opacity 120ms' }}
              onMouseEnter={() =>
                setHovered({
                  kind: 'link',
                  label: `${l.source} → ${l.target}`,
                  value: l.value,
                })
              }
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${l.source} → ${l.target}: ${l.value}`}</title>
            </path>
          ))}
        </g>

        {/* Nodes. */}
        <g data-testid="gt-nodes">
          {laidNodes.map((n) => {
            const base = colorForColumn(n.column);
            const orphanStroke =
              n.orphanKind === 'isolated' || n.orphanKind === 'in' ? ORPHAN_ROSE : ORPHAN_AMBER;
            const stroke = n.isOrphan ? orphanStroke : base.stroke;
            const value = Math.max(n.inValue, n.outValue);
            return (
              <g
                key={n.id}
                data-testid={n.isOrphan ? 'gt-orphan' : 'gt-node'}
                data-node-id={n.id}
                data-column={n.column}
                data-orphan={n.isOrphan ? 'true' : 'false'}
                tabIndex={0}
                role="button"
                aria-label={`${n.label}${n.isOrphan ? ' (sierota — zerwana nić)' : ''}: ${value}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect?.(n.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(n.id);
                  }
                }}
                onMouseEnter={() =>
                  setHovered({ kind: 'node', id: n.id, label: n.label, value, orphan: n.isOrphan })
                }
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.nodeHeight}
                  rx={3}
                  fill={base.fill}
                  fillOpacity={n.isOrphan ? 0.35 : 0.92}
                  stroke={stroke}
                  strokeWidth={n.isOrphan ? 2.5 : 1}
                  strokeDasharray={n.isOrphan ? '4 2' : undefined}
                />
                <text
                  x={n.column === 0 ? n.x + n.width + 6 : n.x - 6}
                  y={n.y + n.nodeHeight / 2}
                  textAnchor={n.column === 0 ? 'start' : 'end'}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="currentColor"
                  className="fill-slate-700 dark:fill-slate-200"
                  style={{ pointerEvents: 'none' }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover tooltip. */}
      {hovered && (
        <div
          data-testid="gt-tooltip"
          role="status"
          className="pointer-events-none absolute right-3 top-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          {hovered.kind === 'node' ? (
            <span>
              <strong>{hovered.label}</strong>
              {hovered.orphan && (
                <span className="ml-1 text-rose-600 dark:text-rose-400">· zerwana nić</span>
              )}
              <span className="ml-1 text-slate-500 dark:text-slate-400">{hovered.value}</span>
            </span>
          ) : (
            <span>
              <strong>{hovered.label}</strong>
              <span className="ml-1 text-slate-500 dark:text-slate-400">{hovered.value}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default GoldenThreadSankey;
