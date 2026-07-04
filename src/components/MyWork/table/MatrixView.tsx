/**
 * MatrixView — cross-tabulation of table data along two axis columns.
 *
 * Two modes, chosen automatically from the selected axis field types:
 *  - Quadrant mode (both axes numeric/rating): nodes plotted as draggable cards
 *    in 4 quadrants split at the median of each axis (Impact vs Effort style).
 *  - Crosstab mode (either axis select/status/multiselect): a row×column grid
 *    of the two fields' options; each cell shows the record count at that
 *    intersection and can be clicked to open a popover listing the matching
 *    records (click a record to open it via onNodeClick).
 */
import { GripVertical, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { SELECT_COLORS } from './tableTypes';

interface MatrixViewProps {
  nodes: TableNode[];
  xAxis: ColumnDef;
  yAxis: ColumnDef;
  columns: ColumnDef[];
  locked?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onFieldChange?: (nodeId: string, field: string, value: any) => void;
  onAxisChange?: (axis: 'x' | 'y', col: ColumnDef) => void;
}

interface Quadrant {
  labelEn: string;
  labelPl: string;
  color: string;
  xRange: [number, number];
  yRange: [number, number];
}

const NUMERIC_TYPES = ['number', 'rating'];
const CATEGORICAL_TYPES = ['select', 'status', 'multiselect'];
const AXIS_TYPES = [...NUMERIC_TYPES, ...CATEGORICAL_TYPES];

function median(arr: number[]): number {
  if (arr.length === 0) return 3;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Raw cell value(s) for a categorical column, normalized to a string list (multiselect-safe). */
function categoricalValues(node: TableNode, col: ColumnDef): string[] {
  const raw = node.data?.[col.key];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw == null || raw === '') return [];
  return [String(raw)];
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  nodes,
  xAxis,
  yAxis,
  columns,
  locked = false,
  onNodeClick,
  onFieldChange,
  onAxisChange,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropQuadrant, setDropQuadrant] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<{ x: string; y: string } | null>(null);
  const quadrantRefs = useRef<(HTMLDivElement | null)[]>([]);

  const axisOptions = useMemo(
    () => columns.filter((c) => AXIS_TYPES.includes(c.type)),
    [columns]
  );

  const isCategoricalMode =
    CATEGORICAL_TYPES.includes(xAxis.type) || CATEGORICAL_TYPES.includes(yAxis.type);

  const { midX, midY, minX, maxX, minY, maxY } = useMemo(() => {
    const xVals = nodes.map((n) => Number(n.data?.[xAxis.key])).filter((v) => Number.isFinite(v));
    const yVals = nodes.map((n) => Number(n.data?.[yAxis.key])).filter((v) => Number.isFinite(v));
    const mx = median(xVals);
    const my = median(yVals);
    return {
      midX: mx,
      midY: my,
      minX: xVals.length ? Math.min(...xVals) : 0,
      maxX: xVals.length ? Math.max(...xVals) : 5,
      minY: yVals.length ? Math.min(...yVals) : 0,
      maxY: yVals.length ? Math.max(...yVals) : 5,
    };
  }, [nodes, xAxis.key, yAxis.key]);

  const quadrants: Quadrant[] = useMemo(
    () => [
      {
        labelEn: 'Quick Wins',
        labelPl: 'Szybkie wygrane',
        color:
          'bg-[color-mix(in_srgb,var(--c-success)_10%,transparent)] border-[color-mix(in_srgb,var(--c-success)_22%,transparent)]',
        xRange: [midX, maxX],
        yRange: [minY, midY],
      },
      {
        labelEn: 'Major Projects',
        labelPl: 'Duże projekty',
        color:
          'bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] border-[color-mix(in_srgb,var(--c-warning)_22%,transparent)]',
        xRange: [midX, maxX],
        yRange: [midY, maxY],
      },
      {
        labelEn: 'Fill-ins',
        labelPl: 'Uzupełnienia',
        color: 'bg-c-surface-raised border-c-border-subtle',
        xRange: [minX, midX],
        yRange: [minY, midY],
      },
      {
        labelEn: 'Thankless Tasks',
        labelPl: 'Niewdzięczne zadania',
        color:
          'bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--c-danger)_22%,transparent)]',
        xRange: [minX, midX],
        yRange: [midY, maxY],
      },
    ],
    [midX, midY, minX, maxX, minY, maxY]
  );

  const { nodesByQuadrant, positionsByNode } = useMemo(() => {
    const byQuadrant: Record<number, TableNode[]> = { 0: [], 1: [], 2: [], 3: [] };
    const positions: Record<string, { left: number; top: number }> = {};
    for (const node of nodes) {
      const x = Number(node.data?.[xAxis.key]) || 0;
      const y = Number(node.data?.[yAxis.key]) || 0;
      let idx = 0;
      if (x >= midX && y < midY) idx = 0;
      else if (x >= midX && y >= midY) idx = 1;
      else if (x < midX && y < midY) idx = 2;
      else idx = 3;
      byQuadrant[idx].push(node);
      const q = quadrants[idx]!;
      const spanX = Math.max(1e-6, q.xRange[1] - q.xRange[0]);
      const spanY = Math.max(1e-6, q.yRange[1] - q.yRange[0]);
      const normX = (x - q.xRange[0]) / spanX;
      const normY = (y - q.yRange[0]) / spanY;
      positions[node.id] = {
        left: Math.min(90, Math.max(2, normX * 90)),
        top: Math.min(90, Math.max(2, (1 - normY) * 90)),
      };
    }
    return { nodesByQuadrant: byQuadrant, positionsByNode: positions };
  }, [nodes, xAxis.key, yAxis.key, midX, midY, quadrants]);

  // ── Crosstab mode (categorical × categorical/numeric) ─────────────────────
  const EMPTY_BUCKET = '—';

  const crosstab = useMemo(() => {
    if (!isCategoricalMode) return null;

    const xIsCategorical = CATEGORICAL_TYPES.includes(xAxis.type);
    const yIsCategorical = CATEGORICAL_TYPES.includes(yAxis.type);

    const xBuckets: string[] = xIsCategorical
      ? [...(xAxis.options || [])]
      : (() => {
          const vals = nodes.map((n) => Number(n.data?.[xAxis.key])).filter(Number.isFinite);
          return vals.length ? Array.from(new Set(vals)).sort((a, b) => a - b).map(String) : [];
        })();
    const yBuckets: string[] = yIsCategorical
      ? [...(yAxis.options || [])]
      : (() => {
          const vals = nodes.map((n) => Number(n.data?.[yAxis.key])).filter(Number.isFinite);
          return vals.length ? Array.from(new Set(vals)).sort((a, b) => a - b).map(String) : [];
        })();

    const cellNodes: Record<string, Record<string, TableNode[]>> = {};
    const xSeen = new Set(xBuckets);
    const ySeen = new Set(yBuckets);
    let xHasEmpty = false;
    let yHasEmpty = false;

    for (const node of nodes) {
      const xVals = xIsCategorical
        ? categoricalValues(node, xAxis)
        : [String(node.data?.[xAxis.key] ?? '')];
      const yVals = yIsCategorical
        ? categoricalValues(node, yAxis)
        : [String(node.data?.[yAxis.key] ?? '')];

      const xKeys = xVals.length ? xVals : [EMPTY_BUCKET];
      const yKeys = yVals.length ? yVals : [EMPTY_BUCKET];

      for (const xk of xKeys) {
        if (xk === EMPTY_BUCKET) xHasEmpty = true;
        else if (!xSeen.has(xk)) {
          xSeen.add(xk);
          xBuckets.push(xk);
        }
        for (const yk of yKeys) {
          if (yk === EMPTY_BUCKET) yHasEmpty = true;
          else if (!ySeen.has(yk)) {
            ySeen.add(yk);
            yBuckets.push(yk);
          }
          cellNodes[xk] ??= {};
          cellNodes[xk][yk] ??= [];
          cellNodes[xk][yk]!.push(node);
        }
      }
    }

    const xAll = xHasEmpty ? [...xBuckets, EMPTY_BUCKET] : xBuckets;
    const yAll = yHasEmpty ? [...yBuckets, EMPTY_BUCKET] : yBuckets;

    let maxCount = 0;
    for (const xk of xAll) {
      for (const yk of yAll) {
        const c = cellNodes[xk]?.[yk]?.length ?? 0;
        if (c > maxCount) maxCount = c;
      }
    }

    return { xBuckets: xAll, yBuckets: yAll, cellNodes, maxCount };
  }, [isCategoricalMode, nodes, xAxis, yAxis]);

  const activeCellNodes = useMemo(() => {
    if (!crosstab || !activeCell) return [];
    return crosstab.cellNodes[activeCell.x]?.[activeCell.y] ?? [];
  }, [crosstab, activeCell]);

  const optionColor = useCallback((col: ColumnDef, value: string): string => {
    if (value === EMPTY_BUCKET) return 'var(--c-text-muted)';
    return (
      col.optionColors?.[value] ||
      SELECT_COLORS[(col.options || []).indexOf(value) % SELECT_COLORS.length] ||
      'var(--c-tag-2)'
    );
  }, []);

  const handleDragStart = useCallback(
    (nodeId: string) => {
      if (locked || !onFieldChange) return;
      setDragNodeId(nodeId);
    },
    [locked, onFieldChange]
  );

  const handleDrop = useCallback(
    (quadrantIdx: number, ev: React.DragEvent) => {
      if (!dragNodeId || !onFieldChange || locked) return;
      const el = quadrantRefs.current[quadrantIdx];
      if (!el) {
        setDragNodeId(null);
        setDropQuadrant(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (ev.clientX - rect.left) / Math.max(1, rect.width)));
      const relY = Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / Math.max(1, rect.height)));
      const q = quadrants[quadrantIdx]!;
      const spanX = Math.max(1e-6, q.xRange[1] - q.xRange[0]);
      const spanY = Math.max(1e-6, q.yRange[1] - q.yRange[0]);
      const newX = Math.round((q.xRange[0] + relX * spanX) * 10) / 10;
      const newY = Math.round((q.yRange[0] + relY * spanY) * 10) / 10;
      onFieldChange(dragNodeId, xAxis.key, newX);
      onFieldChange(dragNodeId, yAxis.key, newY);
      setDragNodeId(null);
      setDropQuadrant(null);
    },
    [dragNodeId, locked, onFieldChange, quadrants, xAxis.key, yAxis.key]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-4">
      <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
        {onAxisChange && axisOptions.length > 0 ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
                X:
              </span>
              <select
                value={xAxis.key}
                onChange={(e) => {
                  const col = axisOptions.find((c) => c.key === e.target.value);
                  if (col) onAxisChange('x', col);
                }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg bg-c-surface border border-c-border text-c-text-secondary"
              >
                {axisOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.header}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
                Y:
              </span>
              <select
                value={yAxis.key}
                onChange={(e) => {
                  const col = axisOptions.find((c) => c.key === e.target.value);
                  if (col) onAxisChange('y', col);
                }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg bg-c-surface border border-c-border text-c-text-secondary"
              >
                {axisOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.header}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
            {yAxis.header} / {xAxis.header}
          </span>
        )}
      </div>

      {isCategoricalMode && crosstab ? (
        crosstab.xBuckets.length === 0 || crosstab.yBuckets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-c-text-muted">
            {isPl ? 'Brak opcji do zestawienia' : 'No options to cross-tabulate'}
          </div>
        ) : (
          <div className="flex-1 flex min-h-[320px]">
            <div className="flex items-center justify-center w-6 flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted -rotate-90 whitespace-nowrap">
                ← {yAxis.header}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="border-collapse w-full" data-testid="matrix-crosstab">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-c-surface p-1.5 text-[10px] font-bold text-c-text-muted text-left min-w-[110px]">
                      {xAxis.header} →
                    </th>
                    {crosstab.xBuckets.map((xk) => (
                      <th
                        key={xk}
                        className="p-1.5 text-[10px] font-semibold text-c-text-secondary text-center min-w-[64px]"
                      >
                        <span
                          className="inline-block px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${optionColor(xAxis, xk)} 16%, transparent)`,
                          }}
                        >
                          {xk}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crosstab.yBuckets.map((yk) => (
                    <tr key={yk}>
                      <th className="sticky left-0 z-10 bg-c-surface p-1.5 text-[10px] font-semibold text-c-text-secondary text-left whitespace-nowrap">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${optionColor(yAxis, yk)} 16%, transparent)`,
                          }}
                        >
                          {yk}
                        </span>
                      </th>
                      {crosstab.xBuckets.map((xk) => {
                        const cellRecords = crosstab.cellNodes[xk]?.[yk] ?? [];
                        const count = cellRecords.length;
                        const intensity = crosstab.maxCount > 0 ? count / crosstab.maxCount : 0;
                        return (
                          <td key={xk} className="p-1 text-center align-middle">
                            <button
                              type="button"
                              disabled={count === 0}
                              onClick={() => setActiveCell({ x: xk, y: yk })}
                              className={`w-full h-9 rounded-lg text-xs font-bold transition-colors ${
                                count === 0
                                  ? 'text-c-text-muted cursor-default'
                                  : 'text-c-text hover:ring-2 hover:ring-c-focus cursor-pointer'
                              }`}
                              style={{
                                backgroundColor:
                                  count === 0
                                    ? 'transparent'
                                    : `color-mix(in srgb, var(--c-accent) ${Math.round(
                                        12 + intensity * 45
                                      )}%, transparent)`,
                              }}
                              title={
                                count > 0
                                  ? isPl
                                    ? `Pokaż ${count} rekordów`
                                    : `Show ${count} records`
                                  : undefined
                              }
                            >
                              {count > 0 ? count : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="flex-1 flex">
          <div className="flex items-center justify-center w-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted -rotate-90 whitespace-nowrap">
              ← {xAxis.header}
            </span>
          </div>

          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 min-h-[320px]">
            {quadrants.map((q, idx) => (
              <div
                key={idx}
                ref={(r) => {
                  quadrantRefs.current[idx] = r;
                }}
                className={`rounded-2xl border p-3 ${q.color} flex flex-col overflow-hidden relative ${
                  dropQuadrant === idx ? 'ring-2 ring-c-focus' : ''
                }`}
                onDragOver={handleDragOver}
                onDragEnter={() => dragNodeId && setDropQuadrant(idx)}
                onDragLeave={() => setDropQuadrant(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(idx, e);
                }}
              >
                <div className="text-[10px] font-bold text-c-text-secondary mb-2 flex-shrink-0">
                  {isPl ? q.labelPl : q.labelEn}
                  <span className="ml-1 text-c-text-muted">({nodesByQuadrant[idx].length})</span>
                </div>
                <div className="flex-1 min-h-[100px] relative">
                  {nodesByQuadrant[idx].map((node) => (
                    <button
                      key={node.id}
                      draggable={!locked && !!onFieldChange}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', node.id);
                        handleDragStart(node.id);
                      }}
                      onClick={() => onNodeClick?.(node.id)}
                      className={`absolute text-left px-2.5 py-1.5 rounded-xl bg-c-surface border border-c-border-subtle hover:shadow-md transition-shadow ${
                        dragNodeId === node.id ? 'opacity-40 scale-95 border-c-accent' : ''
                      }`}
                      style={{
                        left: `${positionsByNode[node.id]?.left ?? 5}%`,
                        top: `${positionsByNode[node.id]?.top ?? 5}%`,
                        minWidth: 100,
                        maxWidth: '85%',
                      }}
                    >
                      {!locked && onFieldChange && (
                        <GripVertical
                          size={10}
                          className="absolute left-1 top-1/2 -translate-y-1/2 text-c-text-muted cursor-grab"
                        />
                      )}
                      <div className="text-[11px] font-medium text-c-text truncate">
                        {node.data?.label || node.id}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-c-text-muted">
                          {xAxis.header}: {node.data?.[xAxis.key] ?? '—'}
                        </span>
                        <span className="text-[9px] text-c-text-muted">
                          {yAxis.header}: {node.data?.[yAxis.key] ?? '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                  {nodesByQuadrant[idx].length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-c-text-muted">
                        {isPl ? 'Brak elementów' : 'No items'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCell && (
        <div
          className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          onClick={() => setActiveCell(null)}
        >
          <div
            className="w-full max-w-sm max-h-[70vh] rounded-2xl border border-c-border bg-c-surface shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle flex-shrink-0">
              <div className="text-xs font-bold text-c-text truncate">
                {xAxis.header}: {activeCell.x} · {yAxis.header}: {activeCell.y}
                <span className="ml-1.5 text-c-text-muted font-normal">
                  ({activeCellNodes.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors flex-shrink-0"
                aria-label={isPl ? 'Zamknij' : 'Close'}
              >
                <X size={14} className="text-c-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-auto py-1">
              {activeCellNodes.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-c-text-muted">
                  {isPl ? 'Brak rekordów' : 'No records'}
                </div>
              ) : (
                activeCellNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      onNodeClick?.(node.id);
                      setActiveCell(null);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-c-text hover:bg-c-surface-raised transition-colors truncate"
                  >
                    {node.data?.label || node.id}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatrixView;
