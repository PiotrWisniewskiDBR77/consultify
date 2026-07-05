/**
 * StudioCanvas - React Flow Canvas Component
 *
 * Main canvas component for Consultify Studio.
 * Handles diagram rendering, editing, and interactions.
 */

import 'reactflow/dist/style.css';

import {
  Camera,
  Download,
  Grid3X3,
  Lock,
  Maximize2,
  Redo,
  Undo,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Controls,
  Edge,
  EdgeChange,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  OnEdgesChange,
  OnNodesChange,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  XYPosition,
} from 'reactflow';

import { DecisionNode } from './nodes/DecisionNode';
import { MindmapNode } from './nodes/MindmapNode';
import { OrgUnitNode } from './nodes/OrgUnitNode';
// Import custom node types
import { ProcessStepNode } from './nodes/ProcessStepNode';
import { RACICell } from './nodes/RACICell';
import { StartEndNode } from './nodes/StartEndNode';
import { SwimLaneNode } from './nodes/SwimLaneNode';
import { TextNode } from './nodes/TextNode';

// Node type mapping
const nodeTypes = {
  processStep: ProcessStepNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
  textNode: TextNode,
  mindmapNode: MindmapNode,
  raciCell: RACICell,
  orgUnit: OrgUnitNode,
  swimlane: SwimLaneNode,
};

// Default edge style
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#64748b', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#64748b',
  },
};

export interface StudioCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
  onSelectionChange?: (params: { nodes: Node[]; edges: Edge[] }) => void;
  selectedNodeId?: string | null;
  isLocked?: boolean;
  showMiniMap?: boolean;
  showControls?: boolean;
  showGrid?: boolean;
  onExport?: () => void;
  onSnapshot?: () => void;
  className?: string;
}

const StudioCanvasInner: React.FC<StudioCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDoubleClick,
  onPaneClick,
  onSelectionChange,
  selectedNodeId,
  isLocked = false,
  showMiniMap = true,
  showControls = true,
  showGrid = true,
  onExport,
  onSnapshot,
  className = '',
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showGridState, setShowGridState] = useState(showGrid);
  const [isLockedState, setIsLockedState] = useState(isLocked);

  // Handle connection between nodes
  const handleConnect = useCallback(
    (params: Connection) => {
      if (isLockedState) return;
      onConnect(params);
    },
    [onConnect, isLockedState]
  );

  // Custom node change handler (respects lock state)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isLockedState) {
        // Only allow selection changes when locked
        const selectionChanges = changes.filter((c) => c.type === 'select');
        if (selectionChanges.length > 0) {
          onNodesChange(selectionChanges);
        }
        return;
      }
      onNodesChange(changes);
    },
    [onNodesChange, isLockedState]
  );

  // Custom edge change handler (respects lock state)
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isLockedState) {
        const selectionChanges = changes.filter((c) => c.type === 'select');
        if (selectionChanges.length > 0) {
          onEdgesChange(selectionChanges);
        }
        return;
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, isLockedState]
  );

  // Highlight selected node
  const styledNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
  }, [nodes, selectedNodeId]);

  // Minimap node color based on type
  const minimapNodeColor = useCallback((node: Node) => {
    const colors: Record<string, string> = {
      processStep: '#3b82f6',
      decision: '#f59e0b',
      startEnd: '#10b981',
      textNode: '#6366f1',
      mindmapNode: '#ec4899',
      raciCell: '#6366f1',
      orgUnit: '#3b82f6',
      swimlane: '#64748b',
    };
    return colors[node.type || 'processStep'] || '#64748b';
  }, []);

  return (
    <div ref={reactFlowWrapper} className={`h-full w-full relative ${className}`}>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        deleteKeyCode={isLockedState ? null : ['Backspace', 'Delete']}
        multiSelectionKeyCode={['Meta', 'Control']}
        selectionKeyCode={['Shift']}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        selectNodesOnDrag={!isLockedState}
        nodesDraggable={!isLockedState}
        nodesConnectable={!isLockedState}
        elementsSelectable={true}
        className="bg-c-bg"
      >
        {/* Background Grid */}
        {showGridState && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.05)"
          />
        )}

        {/* Controls Panel */}
        {showControls && (
          <Panel
            position="top-right"
            className="flex items-center gap-1 bg-c-surface-raised backdrop-blur-sm rounded-lg p-1 border border-c-border-subtle"
          >
            <button
              onClick={() => setShowGridState(!showGridState)}
              className={`p-2 rounded-md transition-colors ${
                showGridState
                  ? 'bg-c-accent-soft text-c-accent'
                  : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
              }`}
              title="Toggle Grid"
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setIsLockedState(!isLockedState)}
              className={`p-2 rounded-md transition-colors ${
                isLockedState
                  ? 'bg-c-warning/20 text-c-warning'
                  : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
              }`}
              title={isLockedState ? 'Unlock Canvas' : 'Lock Canvas'}
            >
              {isLockedState ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            <div className="w-px h-6 bg-c-border-subtle mx-1" />
            {onSnapshot && (
              <button
                onClick={onSnapshot}
                className="p-2 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
                title="Save Snapshot"
              >
                <Camera size={16} />
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="p-2 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
                title="Export"
              >
                <Download size={16} />
              </button>
            )}
          </Panel>
        )}

        {/* Lock Indicator */}
        {isLockedState && (
          <Panel
            position="top-center"
            className="bg-c-warning/20 text-c-warning px-3 py-1.5 rounded-lg text-xs font-medium border border-c-warning/30"
          >
            Canvas Locked - View Only
          </Panel>
        )}

        {/* Zoom Controls */}
        <Controls
          position="bottom-right"
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          className="!bg-c-surface-raised !backdrop-blur-sm !border-c-border-subtle !rounded-lg [&>button]:!bg-transparent [&>button]:!border-c-border-subtle [&>button]:!text-c-text-muted [&>button:hover]:!bg-c-surface [&>button:hover]:!text-c-text"
        />

        {/* MiniMap */}
        {showMiniMap && (
          <MiniMap
            position="bottom-left"
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-c-surface-raised !backdrop-blur-sm !border-c-border-subtle !rounded-lg"
          />
        )}
      </ReactFlow>
    </div>
  );
};

// Wrap with provider for standalone usage
export const StudioCanvas: React.FC<StudioCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <StudioCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default StudioCanvas;
