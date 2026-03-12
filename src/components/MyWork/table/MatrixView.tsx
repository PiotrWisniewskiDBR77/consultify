/**
 * MatrixView — 2x2 matrix (e.g., Impact vs Effort) from table data.
 * Nodes are plotted as cards in quadrants based on two number columns.
 */
import { GripVertical } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

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

function median(arr: number[]): number {
  if (arr.length === 0) return 3;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
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
  const quadrantRefs = useRef<(HTMLDivElement | null)[]>([]);

  const axisOptions = useMemo(
    () => columns.filter((c) => NUMERIC_TYPES.includes(c.type)),
    [columns]
  );

  const { midX, midY, minX, maxX, minY, maxY } = useMemo(() => {
    const xVals = nodes
      .map((n) => Number(n.data?.[xAxis.key]))
      .filter((v) => Number.isFinite(v));
    const yVals = nodes
      .map((n) => Number(n.data?.[yAxis.key]))
      .filter((v) => Number.isFinite(v));
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
        color: 'bg-emerald-500/10 border-emerald-500/20',
        xRange: [midX, maxX],
        yRange: [minY, midY],
      },
      {
        labelEn: 'Major Projects',
        labelPl: 'Duże projekty',
        color: 'bg-amber-500/10 border-amber-500/20',
        xRange: [midX, maxX],
        yRange: [midY, maxY],
      },
      {
        labelEn: 'Fill-ins',
        labelPl: 'Uzupełnienia',
        color: 'bg-slate-500/5 border-slate-500/10',
        xRange: [minX, midX],
        yRange: [minY, midY],
      },
      {
        labelEn: 'Thankless Tasks',
        labelPl: 'Niewdzięczne zadania',
        color: 'bg-red-500/10 border-red-500/20',
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                X:
              </span>
              <select
                value={xAxis.key}
                onChange={(e) => {
                  const col = axisOptions.find((c) => c.key === e.target.value);
                  if (col) onAxisChange('x', col);
                }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg bg-white/80 dark:bg-navy-900/80 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-300"
              >
                {axisOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.header}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Y:
              </span>
              <select
                value={yAxis.key}
                onChange={(e) => {
                  const col = axisOptions.find((c) => c.key === e.target.value);
                  if (col) onAxisChange('y', col);
                }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg bg-white/80 dark:bg-navy-900/80 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-300"
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {yAxis.header} / {xAxis.header}
          </span>
        )}
      </div>

      <div className="flex-1 flex">
        <div className="flex items-center justify-center w-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 -rotate-90 whitespace-nowrap">
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
                dropQuadrant === idx
                  ? 'ring-2 ring-violet-400 dark:ring-violet-500'
                  : ''
              }`}
              onDragOver={handleDragOver}
              onDragEnter={() => dragNodeId && setDropQuadrant(idx)}
              onDragLeave={() => setDropQuadrant(null)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(idx, e);
              }}
            >
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-2 flex-shrink-0">
                {isPl ? q.labelPl : q.labelEn}
                <span className="ml-1 text-slate-400">
                  ({nodesByQuadrant[idx].length})
                </span>
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
                    className={`absolute text-left px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-navy-950/80 border border-slate-200/40 dark:border-navy-700/40 hover:shadow-md transition-shadow ${
                      dragNodeId === node.id
                        ? 'opacity-40 scale-95 border-violet-400'
                        : ''
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
                        className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 dark:text-navy-600 cursor-grab"
                      />
                    )}
                    <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                      {node.data?.label || node.id}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-slate-400">
                        {xAxis.header}: {node.data?.[xAxis.key] ?? '—'}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {yAxis.header}: {node.data?.[yAxis.key] ?? '—'}
                      </span>
                    </div>
                  </button>
                ))}
                {nodesByQuadrant[idx].length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400">
                      {isPl ? 'Brak elementów' : 'No items'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatrixView;
