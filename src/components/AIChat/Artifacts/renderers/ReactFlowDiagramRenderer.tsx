/**
 * ReactFlowDiagramRenderer - React Flow diagram rendering
 *
 * Renders diagrams created from AI-generated nodes and edges.
 * Used for process flows, decision trees, mind maps, etc.
 */

import 'reactflow/dist/style.css';

import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';

import { diagramNodeTypes } from '@/components/shared/DiagramNodes';

interface DiagramData {
  diagramType: 'process_flow' | 'decision_tree' | 'mind_map' | 'org_chart';
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    label?: string;
    data?: Record<string, unknown>;
  }>;
}

interface ReactFlowDiagramRendererProps {
  diagramData: DiagramData;
  className?: string;
}

const DiagramTypeLabels: Record<string, string> = {
  process_flow: 'Process Flow',
  decision_tree: 'Decision Tree',
  mind_map: 'Mind Map',
  org_chart: 'Org Chart',
};

const InnerRenderer: React.FC<{ nodes: Node[]; edges: Edge[]; diagramType: string }> = ({
  nodes,
  edges,
  diagramType,
}) => {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!containerRef.current) return;

    const svgElement = containerRef.current.querySelector('svg.react-flow__renderer');
    if (!svgElement) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clone SVG and add white background
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `diagram-${diagramType}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [diagramType]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {DiagramTypeLabels[diagramType] || 'Diagram'}
          </span>
          <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 rounded">
            {nodes.length} nodes
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => zoomOut()}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700"
            title={t('diagram.zoomOut', 'Zoom out')}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => zoomIn()}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700"
            title={t('diagram.zoomIn', 'Zoom in')}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => fitView({ padding: 0.2 })}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700"
            title={t('diagram.fitView', 'Fit to view')}
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 ml-2"
            title={t('diagram.download', 'Download as PNG')}
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={diagramNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#94a3b8"
            className="opacity-30"
          />
          <Controls className="!bg-white dark:!bg-navy-800 !rounded-lg !shadow-lg !border-0" />
          <MiniMap
            className="!bg-white/80 dark:!bg-navy-800/80 !rounded-lg !shadow-lg"
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export const ReactFlowDiagramRenderer: React.FC<ReactFlowDiagramRendererProps> = ({
  diagramData,
  className = '',
}) => {
  // Convert diagram data to React Flow format
  const nodes: Node[] = useMemo(
    () =>
      diagramData.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
    [diagramData.nodes]
  );

  const edges: Edge[] = useMemo(
    () =>
      (diagramData.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type || 'smoothstep',
        label: e.label,
        style: { stroke: '#64748b', strokeWidth: 2 },
      })),
    [diagramData.edges]
  );

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        No diagram data
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className={`h-full ${className}`}>
        <InnerRenderer nodes={nodes} edges={edges} diagramType={diagramData.diagramType} />
      </div>
    </ReactFlowProvider>
  );
};

export default ReactFlowDiagramRenderer;
