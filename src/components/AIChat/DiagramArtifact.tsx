/**
 * DiagramArtifact - Inline diagram display in AI Chat
 *
 * Renders React Flow diagrams as artifacts within chat messages.
 * Can be expanded to full-screen for editing.
 */

import 'reactflow/dist/style.css';

import { Download, Expand, Maximize2, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowProvider,
} from 'reactflow';

import { diagramNodeTypes } from '@/components/shared/DiagramNodes';

interface DiagramArtifactProps {
  title?: string;
  nodes: Node[];
  edges: Edge[];
  diagramType?: 'process_flow' | 'decision_tree' | 'mind_map' | 'org_chart';
  className?: string;
  /** Allow expanding to fullscreen modal */
  expandable?: boolean;
  /** Callback when user clicks edit */
  onEdit?: () => void;
  /** Callback when user wants to export */
  onExport?: () => void;
}

// Mini preview (inline in chat)
const DiagramPreview: React.FC<{
  nodes: Node[];
  edges: Edge[];
  onExpand: () => void;
  title?: string;
}> = ({ nodes, edges, onExpand, title }) => {
  return (
    <div className="relative w-full h-[200px] rounded-lg overflow-hidden border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={diagramNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.1}
        maxZoom={1}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#cbd5e1"
          className="opacity-30"
        />
      </ReactFlow>

      {/* Overlay with expand button */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

      {/* Title bar */}
      {title && (
        <div className="absolute top-0 left-0 right-0 px-3 py-2 bg-gradient-to-b from-white/90 dark:from-navy-800/90 to-transparent">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
        </div>
      )}

      {/* Expand button */}
      <button
        onClick={onExpand}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-navy-800 rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        <Expand size={14} />
        <span>Open</span>
      </button>
    </div>
  );
};

// Full screen modal view
const DiagramModal: React.FC<{
  nodes: Node[];
  edges: Edge[];
  title?: string;
  onClose: () => void;
  onExport?: () => void;
}> = ({ nodes, edges, title, onClose, onExport }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[90vw] h-[85vh] bg-white dark:bg-navy-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-navy-700">
          <h3 className="font-semibold text-slate-800 dark:text-white">{title || 'Diagram'}</h3>
          <div className="flex items-center gap-2">
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="w-full h-full pt-14">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={diagramNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
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
    </div>
  );
};

export const DiagramArtifact: React.FC<DiagramArtifactProps> = ({
  title,
  nodes,
  edges,
  diagramType = 'process_flow',
  className = '',
  expandable = true,
  onEdit,
  onExport,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Add default styling to edges
  const styledEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        type: edge.type || 'smoothstep',
        style: { stroke: '#64748b', strokeWidth: 2, ...edge.style },
      })),
    [edges]
  );

  if (nodes.length === 0) {
    return null;
  }

  return (
    <ReactFlowProvider>
      <div className={`my-3 ${className}`}>
        <DiagramPreview nodes={nodes} edges={styledEdges} onExpand={handleExpand} title={title} />

        {isExpanded && (
          <DiagramModal
            nodes={nodes}
            edges={styledEdges}
            title={title}
            onClose={handleClose}
            onExport={onExport}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
};

export default DiagramArtifact;
