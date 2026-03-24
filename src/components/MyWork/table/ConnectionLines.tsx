/**
 * ConnectionLines — SVG overlay drawing flowing bezier curves between related rows.
 * Creates the "flowing colored lines" visual effect when a row is selected.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { TableEdge, TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface ConnectionLinesProps {
  selectedNodeId: string | null;
  edges: TableEdge[];
  allNodes: TableNode[];
  containerRef: React.RefObject<HTMLElement | null>;
}

interface LineData {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color1: string;
  color2: string;
  label?: string;
}

export const ConnectionLines: React.FC<ConnectionLinesProps> = ({
  selectedNodeId,
  edges,
  allNodes,
  containerRef,
}) => {
  const [lines, setLines] = useState<LineData[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const relevantEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [edges, selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId || relevantEdges.length === 0 || !containerRef.current) {
      setLines([]);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    const getRowCenter = (nodeId: string): { x: number; y: number } | null => {
      const row =
        container.querySelector(`tr[data-node-id="${nodeId}"]`) ||
        container.querySelector(`[data-node-id="${nodeId}"]`);
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
      };
    };

    const nextLines: LineData[] = [];
    for (const edge of relevantEdges) {
      const p1 = getRowCenter(edge.source);
      const p2 = getRowCenter(edge.target);
      if (!p1 || !p2) continue;

      const sourceNode = allNodes.find((n) => n.id === edge.source);
      const targetNode = allNodes.find((n) => n.id === edge.target);
      const color1 = sourceNode?.data?.color || ROW_ACCENT_COLORS[0];
      const color2 = targetNode?.data?.color || ROW_ACCENT_COLORS[3];

      nextLines.push({
        id: edge.id,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        color1,
        color2,
        label: edge.data?.kind ? String(edge.data.kind) : undefined,
      });
    }
    setLines(nextLines);
  }, [allNodes, containerRef, relevantEdges, selectedNodeId]);

  if (lines.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none z-[5]"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        {lines.map((line) => (
          <linearGradient
            key={`grad-${line.id}`}
            id={`grad-${line.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={line.color1} stopOpacity={0.6} />
            <stop offset="100%" stopColor={line.color2} stopOpacity={0.6} />
          </linearGradient>
        ))}
      </defs>
      {lines.map((line) => {
        const midX = (line.x1 + line.x2) / 2;
        const cpOffset = Math.abs(line.y2 - line.y1) * 0.4 + 30;
        const d = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;

        return (
          <g key={line.id}>
            <path
              d={d}
              fill="none"
              stroke={`url(#grad-${line.id})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              className="animate-pulse"
              style={{ animationDuration: '3s' }}
            />
            <circle cx={line.x1} cy={line.y1} r={4} fill={line.color1} opacity={0.8} />
            <circle cx={line.x2} cy={line.y2} r={4} fill={line.color2} opacity={0.8} />
            {line.label && (
              <text
                x={midX}
                y={(line.y1 + line.y2) / 2 - 8}
                textAnchor="middle"
                className="text-[8px] fill-slate-400"
                fontWeight="600"
              >
                {line.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default ConnectionLines;
