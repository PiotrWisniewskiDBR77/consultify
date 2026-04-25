import 'reactflow/dist/style.css';

import dagre from 'dagre';
import { AlertTriangle, GitBranch, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Background,
  type Connection,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';

import type { PortfolioInitiative } from '@/types';

import type { DependencyLink } from './types';

interface DependencyGraphCanvasProps {
  initiatives: PortfolioInitiative[];
  dependencies: DependencyLink[];
  criticalPathIds?: string[];
  onOpenInitiative: (id: string) => void;
  onCreateDependency?: (
    predecessorId: string,
    successorId: string,
    type?: 'FINISH_TO_START' | 'START_TO_START'
  ) => Promise<void>;
  onDeleteDependency?: (dependencyId: string) => Promise<void>;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 84;

const PRIORITY_RING: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#a855f7',
  LOW: '#64748b',
};

function layoutGraph(initiatives: PortfolioInitiative[], dependencies: DependencyLink[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, marginx: 24, marginy: 24 });

  initiatives.forEach((initiative) => {
    graph.setNode(initiative.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  dependencies.forEach((dependency) => {
    graph.setEdge(dependency.fromId, dependency.toId);
  });

  dagre.layout(graph);

  return initiatives.map((initiative) => {
    const pos = graph.node(initiative.id);
    return {
      id: initiative.id,
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
    };
  });
}

export const DependencyGraphCanvas: React.FC<DependencyGraphCanvasProps> = ({
  initiatives,
  dependencies,
  criticalPathIds = [],
  onOpenInitiative,
  onCreateDependency,
  onDeleteDependency,
}) => {
  const { t } = useTranslation();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [graphBusy, setGraphBusy] = useState(false);
  const criticalSet = useMemo(() => new Set(criticalPathIds), [criticalPathIds]);
  const dependencyKeys = useMemo(
    () => new Set(dependencies.map((dependency) => `${dependency.fromId}::${dependency.toId}`)),
    [dependencies]
  );

  const positionedNodes = useMemo(
    () => layoutGraph(initiatives, dependencies),
    [dependencies, initiatives]
  );

  const baseNodes = useMemo<Node[]>(
    () =>
      initiatives.map((initiative) => {
        const layout = positionedNodes.find((node) => node.id === initiative.id);
        const isCritical = criticalSet.has(initiative.id);
        const ringColor = PRIORITY_RING[initiative.priority] || PRIORITY_RING.MEDIUM;
        const ownerName = initiative.ownerBusiness
          ? `${initiative.ownerBusiness.firstName} ${initiative.ownerBusiness.lastName}`
          : initiative.ownerExecution
            ? `${initiative.ownerExecution.firstName} ${initiative.ownerExecution.lastName}`
            : t('initiatives.analysis.logic.graph.noOwner', 'No owner');

        return {
          id: initiative.id,
          position: layout?.position || { x: 0, y: 0 },
          className: 'bg-white dark:bg-navy-950',
          data: {
            label: (
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {initiative.name}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{ownerName}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                    {initiative.priority}
                  </span>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                    {initiative.status}
                  </span>
                  {isCritical && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      {t('initiatives.analysis.logic.graph.criticalPath', 'Critical path')}
                    </span>
                  )}
                </div>
              </div>
            ),
          },
          style: {
            width: NODE_WIDTH,
            minHeight: NODE_HEIGHT,
            borderRadius: 14,
            padding: '10px 12px',
            border: `1.5px solid ${isCritical ? '#f59e0b' : `${ringColor}80`}`,
            boxShadow: isCritical ? '0 0 0 1px rgba(245,158,11,0.22)' : 'none',
          },
        };
      }),
    [criticalSet, initiatives, positionedNodes, t]
  );

  const baseEdges = useMemo<Edge[]>(
    () =>
      dependencies.map((dependency) => {
        const edgeId = dependency.id || `${dependency.fromId}::${dependency.toId}`;
        const isCritical = criticalSet.has(dependency.fromId) && criticalSet.has(dependency.toId);
        const hasConflict = !!dependency.hasTimingConflict;

        return {
          id: edgeId,
          source: dependency.fromId,
          target: dependency.toId,
          label: dependency.type === 'FINISH_TO_START' ? 'FS' : dependency.type,
          animated: hasConflict,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: hasConflict ? '#ef4444' : isCritical ? '#f59e0b' : '#94a3b8',
          },
          style: {
            stroke: hasConflict ? '#ef4444' : isCritical ? '#f59e0b' : '#94a3b8',
            strokeWidth: isCritical ? 2.4 : 1.8,
          },
          labelStyle: {
            fill: hasConflict ? '#ef4444' : isCritical ? '#f59e0b' : '#94a3b8',
            fontSize: 10,
            fontWeight: 700,
          },
        };
      }),
    [criticalSet, dependencies]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes, setNodes]);

  useEffect(() => {
    setEdges(baseEdges);
  }, [baseEdges, setEdges]);

  const selectedEdge = useMemo(
    () =>
      dependencies.find(
        (dependency) =>
          (dependency.id || `${dependency.fromId}::${dependency.toId}`) === selectedEdgeId
      ) || null,
    [dependencies, selectedEdgeId]
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!onCreateDependency || !connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      if (dependencyKeys.has(`${connection.source}::${connection.target}`)) return;
      setGraphBusy(true);
      try {
        await onCreateDependency(connection.source, connection.target, 'FINISH_TO_START');
        setSelectedEdgeId(null);
      } finally {
        setGraphBusy(false);
      }
    },
    [dependencyKeys, onCreateDependency]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedEdge?.id || !onDeleteDependency) return;
    setGraphBusy(true);
    try {
      await onDeleteDependency(selectedEdge.id);
      setSelectedEdgeId(null);
    } finally {
      setGraphBusy(false);
    }
  }, [onDeleteDependency, selectedEdge]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onOpenInitiative(node.id);
    },
    [onOpenInitiative]
  );

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('initiatives.analysis.logic.graph.title', 'Dependency Graph')}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {t('initiatives.analysis.logic.graph.hint', 'Drag from predecessor to successor')}
          </span>
          {selectedEdge?.hasTimingConflict && (
            <span className="inline-flex items-center gap-1 text-red-500">
              <AlertTriangle size={12} />
              {t('initiatives.analysis.logic.graph.timingConflict', 'Timing conflict')}
            </span>
          )}
          {selectedEdge?.id && onDeleteDependency && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={graphBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={12} />
              {t('initiatives.analysis.logic.graph.removeEdge', 'Remove edge')}
            </button>
          )}
        </div>
      </div>
      <div className="h-[440px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={() => setSelectedEdgeId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background gap={20} color="#334155" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default DependencyGraphCanvas;
