/**
 * MatrixView — 2x2 matrix (e.g., Impact vs Effort) from table data.
 * Nodes are plotted as cards in quadrants based on two number columns.
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

interface MatrixViewProps {
  nodes: TableNode[];
  xAxis: ColumnDef;
  yAxis: ColumnDef;
  onNodeClick?: (nodeId: string) => void;
}

interface Quadrant {
  labelEn: string;
  labelPl: string;
  color: string;
  xRange: [number, number];
  yRange: [number, number];
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  nodes,
  xAxis,
  yAxis,
  onNodeClick,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const midX = 3;
  const midY = 3;

  const quadrants: Quadrant[] = [
    { labelEn: 'Quick Wins', labelPl: 'Szybkie wygrane', color: 'bg-emerald-500/10 border-emerald-500/20', xRange: [midX, 5], yRange: [0, midY] },
    { labelEn: 'Major Projects', labelPl: 'Duże projekty', color: 'bg-amber-500/10 border-amber-500/20', xRange: [midX, 5], yRange: [midY, 5] },
    { labelEn: 'Fill-ins', labelPl: 'Uzupełnienia', color: 'bg-slate-500/5 border-slate-500/10', xRange: [0, midX], yRange: [0, midY] },
    { labelEn: 'Thankless Tasks', labelPl: 'Niewdzięczne zadania', color: 'bg-red-500/10 border-red-500/20', xRange: [0, midX], yRange: [midY, 5] },
  ];

  const nodesByQuadrant = useMemo(() => {
    const result: Record<number, TableNode[]> = { 0: [], 1: [], 2: [], 3: [] };
    for (const node of nodes) {
      const x = Number(node.data?.[xAxis.key]) || 0;
      const y = Number(node.data?.[yAxis.key]) || 0;
      if (x >= midX && y < midY) result[0].push(node);
      else if (x >= midX && y >= midY) result[1].push(node);
      else if (x < midX && y < midY) result[2].push(node);
      else result[3].push(node);
    }
    return result;
  }, [nodes, xAxis.key, yAxis.key]);

  return (
    <div className="w-full h-full flex flex-col p-4">
      {/* Axis labels */}
      <div className="flex items-center justify-center mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {yAxis.header} →
        </span>
      </div>

      <div className="flex-1 flex">
        {/* Y axis label */}
        <div className="flex items-center justify-center w-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 -rotate-90 whitespace-nowrap">
            ← {xAxis.header}
          </span>
        </div>

        {/* Matrix grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2">
          {quadrants.map((q, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border p-3 ${q.color} flex flex-col overflow-auto`}
            >
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                {isPl ? q.labelPl : q.labelEn}
                <span className="ml-1 text-slate-400">({nodesByQuadrant[idx].length})</span>
              </div>
              <div className="flex-1 space-y-1">
                {nodesByQuadrant[idx].map((node) => (
                  <button
                    key={node.id}
                    onClick={() => onNodeClick?.(node.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-navy-950/80 border border-slate-200/40 dark:border-navy-700/40 hover:shadow-md transition-shadow"
                  >
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
                  <div className="text-[10px] text-slate-400 text-center py-4">
                    {isPl ? 'Brak elementów' : 'No items'}
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
