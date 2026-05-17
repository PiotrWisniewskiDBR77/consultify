/**
 * DiscoveryCanvas - Interactive Miro-style canvas for Discovery
 *
 * Main canvas component using React Flow for node-based visualization.
 * Displays pain points, insights, opportunities, and recommendations.
 */

import 'reactflow/dist/style.css';

import { LayoutGrid, Maximize2, Minimize2, Plus, Save, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addEdge,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';

import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import {
  CANVAS_CATEGORIES,
  CanvasCategory,
  DiscoveryEdge,
  DiscoveryNode,
  DiscoveryNodePosition,
} from '@/types/discovery';

import { discoveryNodeTypes } from './nodes';

// Category header component
const CategoryHeader: React.FC<{ category: (typeof CANVAS_CATEGORIES)[0]; nodeCount: number }> = ({
  category,
  nodeCount,
}) => {
  const { t, i18n } = useTranslation('discovery');
  const isPolish = i18n.language === 'pl';

  const colorClasses: Record<string, string> = {
    red: 'border-rose-300 bg-rose-50/80 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    amber:
      'border-amber-300 bg-amber-50/80 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    green:
      'border-green-300 bg-green-50/80 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300',
    blue: 'border-blue-300 bg-blue-50/80 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  };

  return (
    <div
      className={`absolute rounded-lg border-2 border-dashed p-3 pointer-events-none ${colorClasses[category.color]}`}
      style={{
        left: category.position.x - 10,
        top: category.position.y - 40,
        width: category.size.width + 20,
        minHeight: category.size.height + 20,
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide">
          {isPolish ? category.titlePl : category.title}
        </h3>
        <span className="text-xs opacity-70">{nodeCount}</span>
      </div>
    </div>
  );
};

// Toolbar component
const CanvasToolbar: React.FC<{
  onAutoLayout: () => void;
  onSaveVersion: () => void;
  onFitView: () => void;
}> = ({ onAutoLayout, onSaveVersion, onFitView }) => {
  const { t } = useTranslation('discovery');
  const { zoomIn, zoomOut } = useReactFlow();

  return (
    <Panel
      position="top-right"
      className="flex items-center gap-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg p-1"
    >
      <button
        onClick={() => zoomIn()}
        className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
        title={t('discovery.canvas.zoomIn', 'Zoom In')}
      >
        <ZoomIn size={18} className="text-slate-600 dark:text-slate-300" />
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
        title={t('discovery.canvas.zoomOut', 'Zoom Out')}
      >
        <ZoomOut size={18} className="text-slate-600 dark:text-slate-300" />
      </button>
      <div className="w-px h-6 bg-slate-200 dark:bg-navy-600" />
      <button
        onClick={onFitView}
        className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
        title={t('discovery.canvas.fitView', 'Fit View')}
      >
        <Maximize2 size={18} className="text-slate-600 dark:text-slate-300" />
      </button>
      <button
        onClick={onAutoLayout}
        className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
        title={t('discovery.canvas.autoLayout', 'Auto Layout')}
      >
        <LayoutGrid size={18} className="text-slate-600 dark:text-slate-300" />
      </button>
      <div className="w-px h-6 bg-slate-200 dark:bg-navy-600" />
      <button
        onClick={onSaveVersion}
        className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
        title={t('discovery.version.save', 'Save Version')}
      >
        <Save size={18} className="text-slate-600 dark:text-slate-300" />
      </button>
    </Panel>
  );
};

// Empty state component
const EmptyState: React.FC = () => {
  const { t } = useTranslation('discovery');

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-navy-700 rounded-full flex items-center justify-center">
          <Plus size={32} className="text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {t(
            'discovery.canvas.emptyState',
            'Start the conversation and AI will automatically add findings to the board'
          )}
        </p>
      </div>
    </div>
  );
};

// Inner canvas component (uses React Flow hooks)
const DiscoveryCanvasInner: React.FC = () => {
  const { t } = useTranslation('discovery');
  const { fitView } = useReactFlow();

  // Get data from store
  const store = useDiscoveryStore();
  const {
    nodes,
    edges,
    addEdge: storeAddEdge,
    removeNode,
    moveNode,
    autoLayout,
    saveVersion,
  } = store;
  const getNodesInCategory =
    store.getNodesInCategory ||
    ((category: CanvasCategory) =>
      nodes.filter((node) => {
        switch (node.type) {
          case 'painPoint':
            return category === 'pains';
          case 'insight':
            return category === 'insights';
          case 'opportunity':
            return category === 'opportunities';
          case 'recommendation':
            return category === 'recommendations';
          default:
            return false;
        }
      }));

  // Convert store nodes to React Flow format
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        draggable: true,
        selectable: true,
      })),
    [nodes]
  );

  // Convert store edges to React Flow format
  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
        animated: edge.animated,
        label: edge.label,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })),
    [edges]
  );

  // Handle node changes (position, selection)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position);
        }
        if (change.type === 'remove') {
          removeNode(change.id);
        }
      });
    },
    [moveNode, removeNode]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        storeAddEdge({
          source: connection.source,
          target: connection.target,
          type: 'smoothstep',
          animated: true,
        });
      }
    },
    [storeAddEdge]
  );

  // Handle fit view
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 500 });
  }, [fitView]);

  // Handle save version
  const handleSaveVersion = useCallback(() => {
    const version = saveVersion();
    // Could show a toast here
    console.log('[DiscoveryCanvas] Saved version:', version);
  }, [saveVersion]);

  // Get node counts per category
  const nodeCounts = useMemo(
    () =>
      CANVAS_CATEGORIES.reduce(
        (acc, cat) => {
          acc[cat.id] = getNodesInCategory(cat.id).length;
          return acc;
        },
        {} as Record<CanvasCategory, number>
      ),
    [nodes, getNodesInCategory]
  );

  const isEmpty = nodes.length === 0;

  return (
    <div className="w-full h-full relative bg-slate-50 dark:bg-navy-900">
      {/* Category headers (absolute positioned) */}
      {CANVAS_CATEGORIES.map((category) => (
        <CategoryHeader key={category.id} category={category} nodeCount={nodeCounts[category.id]} />
      ))}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={discoveryNodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        className="touch-none"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#94a3b8"
          className="opacity-30"
        />
        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="!bg-transparent !shadow-none !border-0"
        />
        <MiniMap
          nodeColor={(n: any) => {
            const colors: Record<string, string> = {
              painPoint: '#f43f5e',
              insight: '#f59e0b',
              opportunity: '#22c55e',
              recommendation: '#3b82f6',
              tool: '#a855f7',
              assessment: '#3b82f6',
              quote: '#64748b',
              initiative: '#6366f1',
            };
            return colors[n.type || ''] || '#94a3b8';
          }}
          className="!bg-white/80 dark:!bg-navy-800/80 !rounded-lg !shadow-lg"
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <CanvasToolbar
          onAutoLayout={autoLayout}
          onSaveVersion={handleSaveVersion}
          onFitView={handleFitView}
        />
      </ReactFlow>

      {/* Empty state */}
      {isEmpty && <EmptyState />}
    </div>
  );
};

// Main export with provider
export const DiscoveryCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DiscoveryCanvasInner />
    </ReactFlowProvider>
  );
};

export default DiscoveryCanvas;
