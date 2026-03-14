/**
 * useMindMapNodes — Extracted node CRUD, selection, field change, and tree traversal
 * for the Mind Map component.
 */
import { useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getEdgeRole(edge: Edge): 'structural' | 'relation' {
  const role = (edge as any)?.data?.edgeRole;
  if (role === 'relation') return 'relation';
  return 'structural';
}

function isStructuralEdge(edge: Edge) {
  return getEdgeRole(edge) === 'structural';
}

export const BRANCH_COLORS: Record<string, { bg: string; text: string; edge: string; glow: string }> = {
  strengths: { bg: '#dcfce7', text: '#166534', edge: '#22c55e', glow: '#bbf7d0' },
  weaknesses: { bg: '#fee2e2', text: '#991b1b', edge: '#ef4444', glow: '#fecaca' },
  opportunities: { bg: '#dbeafe', text: '#1e40af', edge: '#3b82f6', glow: '#bfdbfe' },
  threats: { bg: '#fef9c3', text: '#854d0e', edge: '#eab308', glow: '#fef08a' },
  options: { bg: '#f3e8ff', text: '#6b21a8', edge: '#a855f7', glow: '#e9d5ff' },
  uncategorized: { bg: '#f1f5f9', text: '#475569', edge: '#94a3b8', glow: '#e2e8f0' },
};

export function branchColor(key: string, colorOverride?: string) {
  const base = BRANCH_COLORS[key] || BRANCH_COLORS.uncategorized;
  if (!colorOverride) return base;
  return { ...base, bg: `${colorOverride}20`, edge: colorOverride, glow: `${colorOverride}40` };
}

export interface UseMindMapNodesOpts {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  locked: boolean;
  isPolish: boolean;
  pushUndo: () => void;
  fitView: (opts?: any) => void;
  remoteLockedNodeIds: Set<string>;
  autoLayout?: (nodes: Node[], edges: Edge[]) => Node[];
}

export function useMindMapNodes(opts: UseMindMapNodesOpts) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    locked,
    isPolish,
    pushUndo,
    fitView,
    remoteLockedNodeIds,
    autoLayout,
  } = opts;

  const editingNodeIdRef = useRef<string | null>(null);

  const ensureCreatedNodePersists = useCallback(
    (newNode: Node, newEdge: Edge) => {
      const reapply = () => {
        setNodes((prev: Node[]) => {
          if (prev.some((node) => node.id === newNode.id)) return prev;
          return [...prev.map((node) => ({ ...node, selected: false })), { ...newNode, selected: true }];
        });
        setEdges((prev: Edge[]) => {
          if (prev.some((edge) => edge.id === newEdge.id)) return prev;
          return [...prev, newEdge];
        });
      };
      window.setTimeout(reapply, 120);
      window.setTimeout(reapply, 600);
    },
    [setEdges, setNodes]
  );

  const isNodeLockedByPeer = useCallback(
    (nodeId?: string | null) => (nodeId ? remoteLockedNodeIds.has(String(nodeId)) : false),
    [remoteLockedNodeIds]
  );

  const getSelectedNode = useCallback(
    (): Node | undefined => nodes.find((n: any) => n?.selected && !isNodeLockedByPeer(n.id)),
    [isNodeLockedByPeer, nodes]
  );

  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes]
  );

  const findParentId = useCallback(
    (nodeId: string): string | undefined => {
      const parentEdge = edges.find((e) => e.target === nodeId && isStructuralEdge(e));
      return parentEdge?.source;
    },
    [edges]
  );

  const findChildrenIds = useCallback(
    (nodeId: string): string[] =>
      edges.filter((e) => e.source === nodeId && isStructuralEdge(e)).map((e) => e.target),
    [edges]
  );

  const getNodeById = useCallback(
    (nodeId?: string | null): Node | undefined =>
      nodeId ? nodes.find((n: any) => n?.id === nodeId && !isNodeLockedByPeer(n.id)) : undefined,
    [isNodeLockedByPeer, nodes]
  );

  const addChildNode = useCallback((anchorNodeId?: string) => {
    if (locked) return;
    const selected =
      getNodeById(anchorNodeId) ||
      getSelectedNode() ||
      nodes.find((node) => node.id === 'branch-options') ||
      nodes.find((node) => node.id.startsWith('branch-'));
    if (!selected) {
      toast(isPolish ? 'Zaznacz węzeł' : 'Select a node');
      return;
    }
    pushUndo();

    const branchKey = selected.data?.branchKey || 'uncategorized';
    const isFirstChildFromStarterBranch =
      selected.id.startsWith('branch-') && findChildrenIds(selected.id).length === 0;
    const initialLabel = isFirstChildFromStarterBranch ? (isPolish ? 'Nowy pomysł' : 'New idea') : '';
    const newId = `node-${uid()}`;
    const newNode: Node = {
      id: newId,
      type: 'idea',
      position: { x: selected.position.x + 220, y: selected.position.y },
      data: {
        label: initialLabel,
        branchKey,
        sourceType: 'manual',
        priority: 50,
        _startEditing: initialLabel ? undefined : Date.now(),
      },
    } as any;

    const colors = branchColor(branchKey);
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: selected.id,
      target: newId,
      type: 'gradient',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true, edgeRole: 'structural' },
    } as any;

    editingNodeIdRef.current = newId;

    setNodes((prev: Node[]) => {
      const nextNodes = [
        ...prev.map((n) => ({ ...n, selected: false })),
        { ...newNode, selected: true },
      ];
      const nextEdges = [...edges, newEdge];
      if (autoLayout) {
        const laid = autoLayout(nextNodes, nextEdges);
        return laid.map((n) => (n.id === newId ? { ...n, selected: true } : n));
      }
      return nextNodes;
    });
    setEdges((prev: Edge[]) => [...prev, newEdge]);
    ensureCreatedNodePersists({ ...newNode, selected: true }, newEdge);

    setTimeout(() => {
      try { fitView({ padding: 0.3, duration: 300 }); } catch { /* */ }
    }, 60);
  }, [
    autoLayout,
    edges,
    ensureCreatedNodePersists,
    fitView,
    getNodeById,
    getSelectedNode,
    findChildrenIds,
    isPolish,
    locked,
    pushUndo,
    setEdges,
    setNodes,
  ]);

  const addSiblingNode = useCallback((anchorNodeId?: string) => {
    if (locked) return;
    const selected = getNodeById(anchorNodeId) || getSelectedNode();
    if (!selected) {
      toast(isPolish ? 'Zaznacz węzeł' : 'Select a node');
      return;
    }
    const parentId = findParentId(selected.id);
    if (!parentId) {
      toast(isPolish ? 'Nie można dodać rodzeństwa do korzenia' : 'Cannot add sibling to root');
      return;
    }
    pushUndo();

    const branchKey = selected.data?.branchKey || 'uncategorized';
    const newId = `node-${uid()}`;
    const newNode: Node = {
      id: newId,
      type: 'idea',
      position: { x: selected.position.x, y: selected.position.y + 70 },
      data: { label: '', branchKey, sourceType: 'manual', priority: 50, _startEditing: Date.now() },
    } as any;

    const colors = branchColor(branchKey);
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: parentId,
      target: newId,
      type: 'gradient',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true, edgeRole: 'structural' },
    } as any;

    editingNodeIdRef.current = newId;

    setNodes((prev: Node[]) => {
      const nextNodes = [
        ...prev.map((n) => ({ ...n, selected: false })),
        { ...newNode, selected: true },
      ];
      const nextEdges = [...edges, newEdge];
      if (autoLayout) {
        const laid = autoLayout(nextNodes, nextEdges);
        return laid.map((n) => (n.id === newId ? { ...n, selected: true } : n));
      }
      return nextNodes;
    });
    setEdges((prev: Edge[]) => [...prev, newEdge]);

    setTimeout(() => {
      try { fitView({ padding: 0.3, duration: 300 }); } catch { /* */ }
    }, 60);
  }, [
    autoLayout,
    edges,
    findParentId,
    fitView,
    getNodeById,
    getSelectedNode,
    isPolish,
    locked,
    pushUndo,
    setEdges,
    setNodes,
  ]);

  const deleteSelected = useCallback(() => {
    if (locked) return;
    pushUndo();
    let removedIds: Set<string>;
    setNodes((prev: Node[]) => {
      removedIds = new Set(
        prev
          .filter((n: Node) => n.selected && n.id !== 'root' && !n.id.startsWith('branch-'))
          .map((n: Node) => n.id)
      );
      return prev.filter((n: Node) => !removedIds.has(n.id));
    });
    setEdges((prev: Edge[]) =>
      prev.filter(
        (e: Edge) => !e.selected && !removedIds!.has(e.source) && !removedIds!.has(e.target)
      )
    );
  }, [locked, pushUndo, setEdges, setNodes]);

  const duplicateSelected = useCallback(() => {
    if (locked) return;
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root' || selected.id.startsWith('branch-')) return;
    pushUndo();

    const parentId = findParentId(selected.id);
    if (!parentId) return;

    const newId = `node-${uid()}`;
    const newNode: Node = {
      ...selected,
      id: newId,
      position: { x: selected.position.x + 30, y: selected.position.y + 30 },
      selected: false,
      data: { ...selected.data, _startEditing: undefined },
    };

    const colors = branchColor(selected.data?.branchKey || 'uncategorized');
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: parentId,
      target: newId,
      type: 'gradient',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true, edgeRole: 'structural' },
    } as any;

    setNodes((prev: Node[]) => [...prev, newNode]);
    setEdges((prev: Edge[]) => [...prev, newEdge]);
  }, [findParentId, getSelectedNode, locked, pushUndo, setEdges, setNodes]);

  const focusSelectedNode = useCallback(() => {
    const selected = getSelectedNode();
    if (!selected) return;
    try {
      fitView({ nodes: [{ id: selected.id } as any], padding: 0.45, duration: 350 });
    } catch {
      /* ignore */
    }
  }, [fitView, getSelectedNode]);

  const reparentSelectedPromote = useCallback(() => {
    if (locked) return;
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root' || selected.id.startsWith('branch-')) return;
    const parentId = findParentId(selected.id);
    if (!parentId) return;
    const grandParentId = findParentId(parentId);
    if (!grandParentId) return;

    pushUndo();
    setEdges((prev: Edge[]) =>
      prev.map((edge) => (edge.target === selected.id ? { ...edge, source: grandParentId } : edge))
    );
    setTimeout(() => focusSelectedNode(), 30);
  }, [findParentId, focusSelectedNode, getSelectedNode, locked, pushUndo, setEdges]);

  const reparentSelectedDemote = useCallback(() => {
    if (locked) return;
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root' || selected.id.startsWith('branch-')) return;
    const parentId = findParentId(selected.id);
    if (!parentId) return;
    const siblings = findChildrenIds(parentId);
    const selectedIndex = siblings.indexOf(selected.id);
    if (selectedIndex <= 0) return;
    const previousSiblingId = siblings[selectedIndex - 1];
    if (!previousSiblingId) return;

    pushUndo();
    setEdges((prev: Edge[]) =>
      prev.map((edge) =>
        edge.target === selected.id ? { ...edge, source: previousSiblingId } : edge
      )
    );
    setTimeout(() => focusSelectedNode(), 30);
  }, [
    findChildrenIds,
    findParentId,
    focusSelectedNode,
    getSelectedNode,
    locked,
    pushUndo,
    setEdges,
  ]);

  const startEditingSelected = useCallback(() => {
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root' || selected.id.startsWith('branch-')) return;
    editingNodeIdRef.current = selected.id;
    setNodes((prev: Node[]) =>
      prev.map((n) =>
        n.id === selected.id ? { ...n, data: { ...n.data, _startEditing: Date.now() } } : n
      )
    );
  }, [getSelectedNode, setNodes]);

  const toggleCollapse = useCallback(
    (_nodeId: string, setCollapsedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>) => {
      setCollapsedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(_nodeId)) next.delete(_nodeId);
        else next.add(_nodeId);
        return next;
      });
    },
    []
  );

  const addRootTopic = useCallback(() => {
    if (locked) return;
    const rootNode = nodes.find((node) => node.id === 'root');
    if (!rootNode) {
      toast.error(isPolish ? 'Brak korzenia mapy' : 'Map root is missing');
      return;
    }
    pushUndo();
    const newId = `node-${uid()}`;
    const newNode: Node = {
      id: newId,
      type: 'idea',
      position: { x: rootNode.position.x + 220, y: rootNode.position.y + 120 },
      data: {
        label: '',
        branchKey: 'uncategorized',
        semanticType: 'topic',
        sourceType: 'manual',
        priority: 50,
        _startEditing: Date.now(),
      },
    } as any;
    const colors = branchColor('uncategorized');
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: 'root',
      target: newId,
      type: 'gradient',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true, edgeRole: 'structural' },
    } as any;
    editingNodeIdRef.current = newId;
    setNodes((prev: Node[]) => [...prev.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true }]);
    setEdges((prev: Edge[]) => [...prev, newEdge]);
    setTimeout(() => {
      try { fitView({ padding: 0.3, duration: 300 }); } catch { /* ignore */ }
    }, 60);
  }, [fitView, isPolish, locked, nodes, pushUndo, setEdges, setNodes]);

  return {
    editingNodeIdRef,
    isNodeLockedByPeer,
    getSelectedNode,
    getNodeById,
    selectedNodeIds,
    findParentId,
    findChildrenIds,
    addChildNode,
    addSiblingNode,
    deleteSelected,
    duplicateSelected,
    focusSelectedNode,
    reparentSelectedPromote,
    reparentSelectedDemote,
    startEditingSelected,
    toggleCollapse,
    addRootTopic,
  };
}
