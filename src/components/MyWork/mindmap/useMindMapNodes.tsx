/**
 * useMindMapNodes — Extracted node CRUD, selection, field change, and tree traversal
 * for the Mind Map component.
 */
import { createElement, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

import i18n from '@/i18n';

import { MAX_MINDMAP_NODES, resolveDeleteAnchor, wouldCreateCycle } from './mindmapCanonHelpers';

// ── Clipboard ────────────────────────────────────────────────────────────────

interface SerializedNode {
  id: string;
  type?: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, any>;
  style?: Record<string, any>;
  animated?: boolean;
}

export interface MindMapClipboard {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  sourceMapId?: string;
}

let _clipboard: MindMapClipboard | null = null;

export function getMindMapClipboard(): MindMapClipboard | null {
  return _clipboard;
}

export function hasMindMapClipboard(): boolean {
  return !!_clipboard && _clipboard.nodes.length > 0;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getEdgeRole(edge: Edge): 'structural' | 'relation' {
  const role = (edge as any)?.data?.edgeRole;
  if (role === 'relation') return 'relation';
  return 'structural';
}

export function isStructuralEdge(edge: Edge): boolean {
  return getEdgeRole(edge) === 'structural';
}

export function isRelationEdge(edge: Edge): boolean {
  return getEdgeRole(edge) === 'relation';
}

// NOTE: only `.edge` is actually consumed (style.stroke on ReactFlow edges);
// bg/text/glow have no current renderer — kept as matching semantic tokens
// for whichever family the key represents (no tint-graduation available via
// var(), harmless since unread).
export const BRANCH_COLORS: Record<
  string,
  { bg: string; text: string; edge: string; glow: string }
> = {
  strengths: {
    bg: 'var(--c-success)',
    text: 'var(--c-success)',
    edge: 'var(--c-success)',
    glow: 'var(--c-success)',
  },
  weaknesses: {
    bg: 'var(--c-danger)',
    text: 'var(--c-danger)',
    edge: 'var(--c-danger)',
    glow: 'var(--c-danger)',
  },
  opportunities: {
    bg: 'var(--c-info)',
    text: 'var(--c-info)',
    edge: 'var(--c-info)',
    glow: 'var(--c-info)',
  },
  threats: {
    bg: 'var(--c-warning)',
    text: 'var(--c-warning)',
    edge: 'var(--c-warning)',
    glow: 'var(--c-warning)',
  },
  options: {
    bg: 'var(--c-tag-3)',
    text: 'var(--c-tag-3)',
    edge: 'var(--c-tag-3)',
    glow: 'var(--c-tag-3)',
  },
  uncategorized: {
    bg: 'var(--c-tag-8)',
    text: 'var(--c-tag-8)',
    edge: 'var(--c-tag-8)',
    glow: 'var(--c-tag-8)',
  },
};

export function branchColor(key: string, colorOverride?: string) {
  const base = BRANCH_COLORS[key] || BRANCH_COLORS.uncategorized;
  if (!colorOverride) return base;
  return { ...base, bg: `${colorOverride}20`, edge: colorOverride, glow: `${colorOverride}40` };
}

// ── Kadrowanie po dodaniu/usunięciu węzła ────────────────────────────────────
// Dopełnienie wokół kadrowanej grupy (rodzic + rodzeństwo + nowy węzeł).
const REVEAL_PADDING = 0.3;
// Gdy nie znamy bieżącego zoomu (brak `getViewport`), 1.0 = 100% jest twardym
// sufitem — nigdy 200% domyślnego `maxZoom` ReactFlow.
const REVEAL_FALLBACK_MAX_ZOOM = 1;
// ReactFlow zwraca `false` z `fitView`, dopóki KAŻDY kadrowany węzeł nie ma
// zmierzonych wymiarów. Świeżo wstawiony węzeł bywa niezmierzony jeszcze
// kilkaset ms — bez ponowień kadrowanie po cichu nie robiło NIC i nowy węzeł
// potrafił powstać poza ekranem.
const REVEAL_RETRIES = 6;
const REVEAL_RETRY_MS = 120;
const REVEAL_FIRST_TRY_MS = 150;

export interface UseMindMapNodesOpts {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  locked: boolean;
  isPolish: boolean;
  pushUndo: () => void;
  fitView: (opts?: any) => boolean | void;
  /**
   * Bieżący viewport. Używany WYŁĄCZNIE po to, żeby kadrowanie po dodaniu
   * węzła nigdy nie PRZYBLIŻAŁO (sufit `maxZoom` = aktualny zoom). Opcjonalne —
   * bez niego sufitem jest {@link REVEAL_FALLBACK_MAX_ZOOM}.
   */
  getViewport?: () => { x: number; y: number; zoom: number };
  remoteLockedNodeIds: Set<string>;
  autoLayout?: (nodes: Node[], edges: Edge[]) => Node[];
  partialLayoutSubtree?: (nodes: Node[], edges: Edge[], subtreeRootId: string) => Node[];
  confirmSubtreeDelete?: (childCount: number) => Promise<boolean>;
  /**
   * DP-3 (T7 Part A): emit graph CRUD ops to collaborators. Optional so
   * this hook keeps working with the flag off / callers that don't wire
   * collaboration (broadcast is itself a no-op while a remote patch is
   * being applied — see useIdeaCollab's applyingRemoteRef guard).
   */
  broadcastGraphPatch?: (operations: Array<{ op: string; data: any }>) => void;
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
    getViewport,
    remoteLockedNodeIds,
    autoLayout,
    partialLayoutSubtree,
    confirmSubtreeDelete,
    broadcastGraphPatch,
  } = opts;
  const broadcast = useCallback(
    (operations: Array<{ op: string; data: any }>) => broadcastGraphPatch?.(operations),
    [broadcastGraphPatch]
  );

  const editingNodeIdRef = useRef<string | null>(null);
  // The id of the most recently created/anchored node. A freshly created node is
  // marked selected, but a downstream re-render (graph capture / sync round-trip)
  // can drop the `selected` flag within a second — which left Enter (sibling),
  // chained Tabs and Delete with nothing to act on right after adding a node.
  // We fall back to this anchor so the keyboard grammar keeps working even when
  // the selection flag is transiently lost. See M06 live §2.2 (2026-06-20).
  const lastActiveNodeIdRef = useRef<string | null>(null);

  const ensureCreatedNodePersists = useCallback(
    (newNode: Node, newEdge: Edge) => {
      const reapply = () => {
        setNodes((prev: Node[]) => {
          if (prev.some((node) => node.id === newNode.id)) return prev;
          return [
            ...prev.map((node) => ({ ...node, selected: false })),
            { ...newNode, selected: true },
          ];
        });
        setEdges((prev: Edge[]) => {
          if (prev.some((edge) => edge.id === newEdge.id)) return prev;
          return [...prev, newEdge];
        });
      };
      window.setTimeout(reapply, 200);
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

  /**
   * Sufit zoomu dla kadrowania: NIGDY nie przybliżamy ponad to, co użytkownik
   * już widzi. Bez tego ReactFlow dociąga zoom do `maxZoom` instancji
   * (domyślnie 2.0), bo dopasowuje kadr do bardzo małego prostokąta.
   */
  const revealMaxZoom = useCallback((): number => {
    try {
      const zoom = getViewport?.().zoom;
      if (typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0) return zoom;
    } catch {
      /* viewport niedostępny w trakcie demontażu płótna */
    }
    return REVEAL_FALLBACK_MAX_ZOOM;
  }, [getViewport]);

  /**
   * Pokaż węzeł `nodeId` W KONTEKŚCIE — razem z rodzicem i całym rodzeństwem,
   * bez przybliżania.
   *
   * PRZED: `fitView({ nodes: [{ id: newId }], padding: 0.5 })` kadrował na
   * POJEDYNCZYM, świeżo utworzonym (pustym, małym) węźle. ReactFlow liczy zoom
   * jako „zmieść ten prostokąt w oknie" i obcina go dopiero o `maxZoom`
   * instancji — a mapa nie ustawia `maxZoom`, więc obowiązywało domyślne 2.0.
   * Płótno skakało z ~45% na 200%: gigantyczny tekst, nachodzące węzły,
   * zero kontekstu. Właściciel zgłosił to dwa razy („magiczne przybliżenia").
   *
   * Do tego kadrowanie i tak było zawodne: `fitView` zwraca `false`, dopóki
   * ReactFlow nie zmierzy węzła — świeżo dodany bywa niezmierzony przez
   * kilkaset ms, więc pojedyncza próba po 150 ms po cichu nie robiła NIC.
   */
  const revealNodeInContext = useCallback(
    (nodeId: string, parentId?: string | null) => {
      const ids = new Set<string>([nodeId]);
      if (parentId) {
        ids.add(parentId);
        for (const siblingId of findChildrenIds(parentId)) ids.add(siblingId);
      }
      const fitNodes = Array.from(ids).map((id) => ({ id }) as any);
      const maxZoom = revealMaxZoom();

      const attempt = (retriesLeft: number) => {
        let done = false;
        try {
          done =
            fitView({ nodes: fitNodes, padding: REVEAL_PADDING, duration: 300, maxZoom }) === true;
        } catch {
          // Płótno w trakcie demontażu — nie ponawiaj.
          done = true;
        }
        if (!done && retriesLeft > 0) {
          window.setTimeout(() => attempt(retriesLeft - 1), REVEAL_RETRY_MS);
        }
      };
      window.setTimeout(() => attempt(REVEAL_RETRIES), REVEAL_FIRST_TRY_MS);
    },
    [findChildrenIds, fitView, revealMaxZoom]
  );

  const getSubtreeNodeIds = useCallback(
    (nodeId: string): string[] => {
      const result: string[] = [nodeId];
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        const children = edges
          .filter((e) => e.source === current && isStructuralEdge(e))
          .map((e) => e.target);
        for (const child of children) {
          result.push(child);
          stack.push(child);
        }
      }
      return result;
    },
    [edges]
  );

  const getNodeById = useCallback(
    (nodeId?: string | null): Node | undefined =>
      nodeId ? nodes.find((n: any) => n?.id === nodeId && !isNodeLockedByPeer(n.id)) : undefined,
    [isNodeLockedByPeer, nodes]
  );

  const addChildNode = useCallback(
    // Krok B: `label` opcjonalny — gdy podany (Teresa/formularz przez szynę
    // `idea-workspace-quick-action`, pole `detail.label`), staje się od razu
    // treścią węzła zamiast wejścia w pusty tryb edycji (patrz `initialLabel` niżej).
    //
    // `notice` podmienia domyślny komunikat „Dodano gałąź" — używa go awaryjna
    // ścieżka `addSiblingNode` (węzeł bez rodzica), żeby użytkownik dostał
    // JEDEN komunikat wyjaśniający, a nie generyczny obok wyjaśnienia.
    (anchorNodeId?: string, label?: string, notice?: { key: string; duration?: number }) => {
      if (locked) return;
      if (nodes.length >= MAX_MINDMAP_NODES) {
        toast.error(i18n.t('mindmap.nodes.mapLimitReached', { limit: MAX_MINDMAP_NODES }), {
          id: 'mm-limit',
        });
        return;
      }
      const selected =
        getNodeById(anchorNodeId) ||
        getSelectedNode() ||
        getNodeById(lastActiveNodeIdRef.current) ||
        nodes.find((node) => node.id === 'branch-options') ||
        nodes.find((node) => node.id.startsWith('branch-'));
      if (!selected) {
        toast(i18n.t('mindmap.nodes.selectNode'), { id: 'mm-op-cue' });
        return;
      }
      pushUndo();

      const branchKey = selected.data?.branchKey || 'uncategorized';
      const isFirstChildFromStarterBranch =
        selected.id.startsWith('branch-') && findChildrenIds(selected.id).length === 0;
      const providedLabel = typeof label === 'string' ? label.trim() : '';
      const initialLabel = providedLabel
        ? providedLabel
        : isFirstChildFromStarterBranch
          ? i18n.t('mindmap.nodes.newIdea')
          : '';
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
          notes: '',
          context: '',
          goal: '',
          rationale: '',
          riskNote: '',
          tags: [],
          semanticType: '',
          status: 'idea',
          evidenceLinks: [],
          artifactLinks: [],
          aiExpansionHistory: [],
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

      // Only mark the node as "being edited" when it actually opens the inline
      // editor (empty label → _startEditing set). The first child of a starter
      // branch is created with a placeholder label ("New idea") and does NOT enter
      // edit mode; setting editingNodeIdRef for it spuriously made isEditing=true,
      // which then swallowed the very next Tab/Enter (keyboard grammar dead until
      // the user clicked elsewhere). See M06 live §2.2 (2026-06-20).
      editingNodeIdRef.current = initialLabel ? null : newId;
      lastActiveNodeIdRef.current = newId;

      const existingChildIds = findChildrenIds(selected.id);
      if (existingChildIds.length > 0) {
        const childNodes = nodes.filter((n: any) => existingChildIds.includes(n.id));
        const maxY = Math.max(...childNodes.map((n: any) => n.position?.y ?? 0));
        newNode.position = { x: selected.position.x + 220, y: maxY + 80 };
      }

      const updatedEdges: Edge[] = [...edges, newEdge];
      const updatedNodes: Node[] = [
        ...nodes.map((n) => ({ ...n, selected: false })),
        { ...newNode, selected: true, data: { ...newNode.data, _isNew: true } },
      ];

      const layoutedNodes = partialLayoutSubtree
        ? partialLayoutSubtree(updatedNodes, updatedEdges, selected.id)
        : updatedNodes;

      setNodes(layoutedNodes.map((n) => (n.id === newId ? { ...n, selected: true } : n)));
      setEdges(updatedEdges);
      ensureCreatedNodePersists({ ...newNode, selected: true }, newEdge);
      broadcast([
        { op: 'add_node', data: { ...newNode, selected: true } },
        { op: 'add_edge', data: newEdge },
      ]);

      toast.success(i18n.t(notice?.key ?? 'mindmap.nodes.childAdded'), {
        id: 'mm-op-cue',
        duration: notice?.duration ?? 1500,
      });

      revealNodeInContext(newId, selected.id);
    },
    [
      broadcast,
      edges,
      ensureCreatedNodePersists,
      revealNodeInContext,
      getNodeById,
      getSelectedNode,
      findChildrenIds,
      isPolish,
      locked,
      nodes,
      pushUndo,
      setEdges,
      setNodes,
    ]
  );

  const addSiblingNode = useCallback(
    (anchorNodeId?: string) => {
      if (locked) return;
      // MM-P1-01 (2026-08-10): reentrancy guard. Every "Add sibling" surface —
      // the registry-routed PPM item (`idea.node.mm_add_sibling` in
      // NodeContextMenu.tsx), FloatingNodeToolbar's "Add sibling" button, the
      // raw canvas Enter-key shortcut, the inline hover "+" quick action, and
      // the `mm_add_sibling` bus event (toolbar popover/command palette/Teresa)
      // — all call this exact function; it is already the single converged
      // mutation. But it used to have zero reentrancy protection: two calls
      // landing close together (e.g. a pointer click on the floating toolbar
      // racing the Enter-key shortcut — the toolbar button has no isEditing
      // check today, only the keyboard handler does) each unconditionally
      // created a brand-new blank node and flagged it `_startEditing`. Since
      // every mind-map node opens its own inline editor independently via a
      // per-node `useEffect` on `data._startEditing`
      // (IdeaRecommendationMap.tsx ~line 1144), not a single shared "one
      // editor" state, two such nodes meant two simultaneously open blank
      // editors. `editingNodeIdRef` already marks "a freshly-created/being-
      // edited node exists right now" (set below, by addChildNode, and by
      // startEditingSelected; cleared the moment that edit is committed or
      // cancelled — IdeaRecommendationMap.tsx's `idea-mindmap-node-edit`
      // handler). Rejecting a new insert while it is non-null closes the race
      // for every surface at once, and never blocks a legitimate NEXT insert:
      // the ref is already null again by the time a later, separate keypress
      // or click arrives, because it only stays set while the previous node's
      // editor is still open.
      if (editingNodeIdRef.current !== null) return;
      if (nodes.length >= MAX_MINDMAP_NODES) {
        toast.error(i18n.t('mindmap.nodes.mapLimitReached', { limit: MAX_MINDMAP_NODES }), {
          id: 'mm-limit',
        });
        return;
      }
      const selected =
        getNodeById(anchorNodeId) || getSelectedNode() || getNodeById(lastActiveNodeIdRef.current);
      if (!selected) {
        toast(i18n.t('mindmap.nodes.selectNode'), { id: 'mm-op-cue' });
        return;
      }
      const parentId = findParentId(selected.id);
      if (!parentId) {
        // PRZED: enigmatyczne „Nie można dodać rodzeństwa do korzenia" i koniec —
        // operacja po prostu nie działała. Trafia tu KAŻDY węzeł bez krawędzi
        // strukturalnej do rodzica: węzeł centralny, ale też karta/notatka
        // rzucona luzem na płótno (u właściciela: „Frame"), gdzie słowo
        // „korzeń" nic nie znaczy.
        //
        // Rodzeństwo bez rodzica nie istnieje, więc robimy rzecz sensowną i
        // oczywistą: dokładamy węzeł PODRZĘDNY do zaznaczonego, a wyjaśnienie
        // wchodzi ZAMIAST generycznego „Dodano gałąź" (ten sam kanał
        // `mm-op-cue`) — jeden komunikat, który mówi co się stało.
        addChildNode(selected.id, undefined, {
          key: 'mindmap.nodes.siblingFallbackToChild',
          duration: 3500,
        });
        return;
      }
      pushUndo();

      const branchKey = selected.data?.branchKey || 'uncategorized';
      const newId = `node-${uid()}`;
      const newNode: Node = {
        id: newId,
        type: 'idea',
        position: { x: selected.position.x, y: selected.position.y + 70 },
        data: {
          label: '',
          branchKey,
          sourceType: 'manual',
          priority: 50,
          notes: '',
          context: '',
          goal: '',
          rationale: '',
          riskNote: '',
          tags: [],
          semanticType: '',
          status: 'idea',
          evidenceLinks: [],
          artifactLinks: [],
          aiExpansionHistory: [],
          _startEditing: Date.now(),
        },
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
      lastActiveNodeIdRef.current = newId;

      const siblingIds = findChildrenIds(parentId);
      if (siblingIds.length > 0) {
        const siblingNodes = nodes.filter((n: any) => siblingIds.includes(n.id));
        const maxY = Math.max(...siblingNodes.map((n: any) => n.position?.y ?? 0));
        newNode.position = { x: selected.position.x, y: maxY + 80 };
      }

      const updatedEdges: Edge[] = [...edges, newEdge];
      const updatedNodes: Node[] = [
        ...nodes.map((n) => ({ ...n, selected: false })),
        { ...newNode, selected: true, data: { ...newNode.data, _isNew: true } },
      ];

      const layoutedNodes = partialLayoutSubtree
        ? partialLayoutSubtree(updatedNodes, updatedEdges, parentId)
        : updatedNodes;

      setNodes(layoutedNodes.map((n) => (n.id === newId ? { ...n, selected: true } : n)));
      setEdges(updatedEdges);
      ensureCreatedNodePersists({ ...newNode, selected: true }, newEdge);
      broadcast([
        { op: 'add_node', data: { ...newNode, selected: true } },
        { op: 'add_edge', data: newEdge },
      ]);

      toast.success(i18n.t('mindmap.nodes.siblingAdded'), {
        id: 'mm-op-cue',
        duration: 1500,
      });

      revealNodeInContext(newId, parentId);
    },
    [
      addChildNode,
      broadcast,
      edges,
      ensureCreatedNodePersists,
      findChildrenIds,
      findParentId,
      revealNodeInContext,
      getNodeById,
      getSelectedNode,
      isPolish,
      locked,
      nodes,
      pushUndo,
      setEdges,
      setNodes,
    ]
  );

  const deleteSelected = useCallback(
    async (opts?: { confirmed?: boolean }) => {
      if (locked) return;

      const selectedIds = nodes
        .filter((n: Node) => n.selected && n.id !== 'root' && !n.id.startsWith('branch-'))
        .map((n: Node) => n.id);
      if (selectedIds.length === 0) return;

      const removedIds = new Set<string>();
      for (const sid of selectedIds) {
        for (const tid of getSubtreeNodeIds(sid)) removedIds.add(tid);
      }

      const subtreeExtra = removedIds.size - selectedIds.length;
      if (subtreeExtra > 0 && !opts?.confirmed) {
        if (confirmSubtreeDelete) {
          const ok = await confirmSubtreeDelete(subtreeExtra);
          if (!ok) return;
        } else {
          // Fallback: inline toast confirm when dialog is unavailable
          toast(
            (t) => {
              // wynik i18n.t z pluralami jest w runtime stringiem — String() przypina typ
              const msg = String(
                i18n.t('mindmap.nodes.subtreeDeleteConfirm', {
                  count: subtreeExtra,
                  defaultValue_one: 'This will also delete {{count}} child node. Continue?',
                  defaultValue_other: 'This will also delete {{count}} child nodes. Continue?',
                } as any)
              );
              return createElement(
                'span',
                { className: 'flex items-center gap-2 text-sm' },
                msg,
                createElement(
                  'button',
                  {
                    className:
                      'ml-2 px-2 py-0.5 rounded bg-c-danger text-c-text text-xs font-medium hover:bg-c-danger',
                    onClick: () => {
                      toast.dismiss(t.id);
                      deleteSelected({ confirmed: true });
                    },
                  },
                  i18n.t('mindmap.nodes.actionDelete')
                ),
                createElement(
                  'button',
                  {
                    className:
                      'px-2 py-0.5 rounded bg-c-surface-raised dark:bg-c-surface text-xs font-medium hover:bg-c-surface-raised',
                    onClick: () => toast.dismiss(t.id),
                  },
                  i18n.t('mindmap.nodes.actionCancel')
                )
              ) as any;
            },
            { duration: 10000, id: 'mm-delete-confirm' }
          );
          return;
        }
      }

      const firstSelectedId = selectedIds[0];
      const parentEdge = edges.find((e) => e.target === firstSelectedId && isStructuralEdge(e));
      const parentId = parentEdge?.source ?? null;
      const siblingIds = parentId
        ? edges
            .filter((e) => e.source === parentId && isStructuralEdge(e))
            .map((e) => e.target)
            .filter((id) => !removedIds.has(id))
        : [];
      const rootId = nodes.find((n) => n.id === 'root')?.id ?? null;

      const anchor = resolveDeleteAnchor(firstSelectedId, parentId, siblingIds, rootId);

      pushUndo();

      const removedEdgeIds = edges
        .filter((e: Edge) => e.selected || removedIds.has(e.source) || removedIds.has(e.target))
        .map((e) => e.id);

      setNodes((prev: Node[]) =>
        prev
          .filter((n: Node) => !removedIds.has(n.id))
          .map((n) => ({ ...n, selected: n.id === anchor }))
      );
      setEdges((prev: Edge[]) =>
        prev.filter(
          (e: Edge) => !e.selected && !removedIds.has(e.source) && !removedIds.has(e.target)
        )
      );
      broadcast([
        ...Array.from(removedIds).map((id) => ({ op: 'remove_node', data: { id } })),
        ...removedEdgeIds.map((id) => ({ op: 'remove_edge', data: { id } })),
      ]);

      const deletedCount = removedIds.size;
      toast.success(
        // wynik i18n.t z pluralami jest w runtime stringiem — String() przypina typ
        String(
          i18n.t('mindmap.nodes.deletedCount', {
            count: deletedCount,
            defaultValue_one: 'Deleted {{count}} node',
            defaultValue_other: 'Deleted {{count}} nodes',
          } as any)
        ),
        { id: 'mm-op-cue', duration: 2000 }
      );

      if (anchor) {
        // Ta sama pułapka co przy dodawaniu: kadr na POJEDYNCZYM węźle-kotwicy
        // dociągał zoom do domyślnego `maxZoom` ReactFlow (2.0 = 200%). Po
        // skasowaniu węzła płótno skakało w zbliżenie. Sufit = bieżący zoom.
        setTimeout(() => {
          try {
            fitView({
              nodes: [{ id: anchor } as any],
              padding: 0.5,
              duration: 300,
              maxZoom: revealMaxZoom(),
            });
          } catch {
            /* */
          }
        }, 60);
      }
    },
    [
      broadcast,
      edges,
      fitView,
      revealMaxZoom,
      getSubtreeNodeIds,
      isPolish,
      locked,
      nodes,
      pushUndo,
      setEdges,
      setNodes,
    ]
  );

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
    broadcast([
      { op: 'add_node', data: newNode },
      { op: 'add_edge', data: newEdge },
    ]);
  }, [broadcast, findParentId, getSelectedNode, locked, pushUndo, setEdges, setNodes]);

  const focusSelectedNode = useCallback(() => {
    const selected = getSelectedNode();
    if (!selected) return;
    try {
      fitView({ nodes: [{ id: selected.id } as any], padding: 0.45, duration: 350 });
    } catch {
      /* ignore */
    }
  }, [fitView, getSelectedNode]);

  const isReparentable = useCallback(
    (nodeId: string): boolean => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return false;
      if (node.id === 'root' || node.id.startsWith('branch-')) return false;
      if (node.type === 'center' || node.type === 'branch') return false;
      if (node.data?.locked) return false;
      if (remoteLockedNodeIds.has(nodeId)) return false;
      return true;
    },
    [nodes, remoteLockedNodeIds]
  );

  const reparentNode = useCallback(
    (nodeId: string, newParentId: string): boolean => {
      if (locked) return false;
      if (!isReparentable(nodeId)) return false;
      if (nodeId === newParentId) return false;

      const currentParentId = findParentId(nodeId);
      if (!currentParentId) return false;
      if (currentParentId === newParentId) return false;

      const parentMap = new Map<string, string | null>();
      for (const e of edges) {
        if (isStructuralEdge(e)) parentMap.set(e.target, e.source);
      }
      if (wouldCreateCycle(nodeId, newParentId, parentMap)) {
        toast.error(i18n.t('mindmap.nodes.cannotMoveUnderOwnDescendant'), {
          id: 'mm-op-cue',
          duration: 2500,
        });
        return false;
      }

      const newParent = nodes.find((n) => n.id === newParentId);
      if (!newParent) return false;

      pushUndo();
      const oldEdgeId = edges.find((e) => e.target === nodeId && isStructuralEdge(e))?.id;
      const branchKey =
        nodes.find((n) => n.id === nodeId)?.data?.branchKey ||
        newParent.data?.branchKey ||
        'uncategorized';
      const colors = branchColor(branchKey);
      const newEdge: Edge = {
        id: `edge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        source: newParentId,
        target: nodeId,
        type: 'gradient',
        style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
        animated: true,
        data: { userCreated: true, edgeRole: 'structural' },
      } as any;
      setEdges((prev: Edge[]) => {
        const without = prev.filter((e) => !(e.target === nodeId && isStructuralEdge(e)));
        return [...without, newEdge];
      });
      broadcast([
        ...(oldEdgeId ? [{ op: 'remove_edge', data: { id: oldEdgeId } }] : []),
        { op: 'add_edge', data: newEdge },
      ]);

      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, _justMoved: true } } : n))
      );
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId && n.data?._justMoved
              ? { ...n, data: { ...n.data, _justMoved: false } }
              : n
          )
        );
      }, 2500);

      const parentLabel = newParent.data?.label || newParentId;
      toast.success(i18n.t('mindmap.nodes.movedUnder', { parentLabel }), {
        id: 'mm-op-cue',
        duration: 2000,
      });

      setTimeout(() => focusSelectedNode(), 30);
      return true;
    },
    [
      broadcast,
      edges,
      findParentId,
      focusSelectedNode,
      isPolish,
      isReparentable,
      locked,
      nodes,
      pushUndo,
      setEdges,
      setNodes,
    ]
  );

  const promoteNode = useCallback(
    (nodeId: string): boolean => {
      if (locked) return false;
      if (!isReparentable(nodeId)) return false;
      const parentId = findParentId(nodeId);
      if (!parentId) {
        toast(i18n.t('mindmap.nodes.alreadyAtTopLevel'));
        return false;
      }
      const grandParentId = findParentId(parentId);
      if (!grandParentId) {
        toast(i18n.t('mindmap.nodes.alreadyAtTopLevel'));
        return false;
      }
      return reparentNode(nodeId, grandParentId);
    },
    [findParentId, isPolish, isReparentable, locked, reparentNode]
  );

  const demoteNode = useCallback(
    (nodeId: string): boolean => {
      if (locked) return false;
      if (!isReparentable(nodeId)) return false;
      const parentId = findParentId(nodeId);
      if (!parentId) return false;
      const siblings = findChildrenIds(parentId);
      const idx = siblings.indexOf(nodeId);
      const previousSibling = idx > 0 ? siblings[idx - 1] : null;
      if (!previousSibling) {
        toast(i18n.t('mindmap.nodes.noSiblingToDemoteUnder'));
        return false;
      }
      return reparentNode(nodeId, previousSibling);
    },
    [findChildrenIds, findParentId, isPolish, isReparentable, locked, reparentNode]
  );

  const moveBetweenSiblings = useCallback(
    (nodeId: string, direction: 'left' | 'right') => {
      if (locked) return;
      if (!isReparentable(nodeId)) return;
      const parentId = findParentId(nodeId);
      if (!parentId) return;

      pushUndo();
      const siblingEdges = edges.filter((e) => e.source === parentId && isStructuralEdge(e));
      const siblingTargets = siblingEdges.map((e) => e.target);
      const idx = siblingTargets.indexOf(nodeId);
      if (idx < 0) return;

      const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblingTargets.length) return;

      const edgeA = siblingEdges[idx];
      const edgeB = siblingEdges[swapIdx];
      if (!edgeA || !edgeB) return;

      setEdges((prev: Edge[]) =>
        prev.map((e) => {
          if (e.id === edgeA.id) return { ...e, target: edgeB.target };
          if (e.id === edgeB.id) return { ...e, target: edgeA.target };
          return e;
        })
      );
      broadcast([
        { op: 'update_edge', data: { id: edgeA.id, target: edgeB.target } },
        { op: 'update_edge', data: { id: edgeB.id, target: edgeA.target } },
      ]);
    },
    [broadcast, edges, findParentId, isReparentable, locked, pushUndo, setEdges]
  );

  const clearDropTargets = useCallback(() => {
    setNodes((prev: Node[]) => {
      if (!prev.some((n) => n.data?._dropTarget)) return prev;
      return prev.map((n) =>
        n.data?._dropTarget ? { ...n, data: { ...n.data, _dropTarget: false } } : n
      );
    });
  }, [setNodes]);

  const reparentSelectedPromote = useCallback(() => {
    const selected = getSelectedNode();
    if (!selected) return;
    promoteNode(selected.id);
  }, [getSelectedNode, promoteNode]);

  const reparentSelectedDemote = useCallback(() => {
    const selected = getSelectedNode();
    if (!selected) return;
    demoteNode(selected.id);
  }, [getSelectedNode, demoteNode]);

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

  /**
   * Collapse/expand the tree to show only nodes up to `maxLevel` depth.
   * maxLevel=0 → root only; maxLevel=1 → root + direct children; Infinity → expand all.
   */
  const setFoldLevel = useCallback(
    (maxLevel: number, setCollapsedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>) => {
      const rootNode = nodes.find((n) => n.id === 'root') ?? nodes.find((n) => n.type === 'center');
      if (!rootNode) return new Set<string>();

      const depthMap = new Map<string, number>();
      const queue: Array<{ id: string; depth: number }> = [{ id: rootNode.id, depth: 0 }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        depthMap.set(id, depth);
        const children = edges
          .filter((e) => e.source === id && isStructuralEdge(e))
          .map((e) => e.target);
        for (const childId of children) {
          if (!visited.has(childId)) queue.push({ id: childId, depth: depth + 1 });
        }
      }

      const collapsed = new Set<string>();
      for (const [nodeId, depth] of depthMap) {
        const hasChildren = edges.some((e) => e.source === nodeId && isStructuralEdge(e));
        if (hasChildren && depth >= maxLevel) {
          collapsed.add(nodeId);
        }
      }

      setCollapsedNodeIds(collapsed);
      return collapsed;
    },
    [edges, nodes]
  );

  const addRootTopic = useCallback(() => {
    if (locked) return;
    const rootNode = nodes.find((node) => node.id === 'root');
    if (!rootNode) {
      toast.error(i18n.t('mindmap.nodes.mapRootMissing'));
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
        notes: '',
        context: '',
        goal: '',
        rationale: '',
        riskNote: '',
        tags: [],
        status: 'idea',
        evidenceLinks: [],
        artifactLinks: [],
        aiExpansionHistory: [],
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
    setNodes((prev: Node[]) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      { ...newNode, selected: true },
    ]);
    setEdges((prev: Edge[]) => [...prev, newEdge]);
    broadcast([
      { op: 'add_node', data: { ...newNode, selected: true } },
      { op: 'add_edge', data: newEdge },
    ]);
    setTimeout(() => {
      try {
        fitView({ padding: 0.3, duration: 300 });
      } catch {
        /* ignore */
      }
    }, 60);
  }, [broadcast, fitView, isPolish, locked, nodes, pushUndo, setEdges, setNodes]);

  // ── Copy / Cut / Paste ────────────────────────────────────────────────────

  const copySelected = useCallback(() => {
    const selected = nodes.filter(
      (n) => n.selected && n.id !== 'root' && !n.id.startsWith('branch-')
    );
    if (selected.length === 0) {
      toast(i18n.t('mindmap.nodes.selectNodesToCopy'));
      return;
    }

    const selectedIds = new Set(selected.map((n) => n.id));
    const internalEdges = edges.filter(
      (e) => isStructuralEdge(e) && selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    const serializedNodes: SerializedNode[] = selected.map((n) => ({
      id: n.id,
      type: n.type,
      data: { ...n.data, _startEditing: undefined },
      position: { x: n.position.x, y: n.position.y },
    }));

    const serializedEdges: SerializedEdge[] = internalEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      data: e.data ? { ...e.data } : undefined,
      style: e.style ? { ...(e.style as Record<string, any>) } : undefined,
      animated: e.animated,
    }));

    const clip: MindMapClipboard = { nodes: serializedNodes, edges: serializedEdges };
    _clipboard = clip;

    try {
      navigator.clipboard?.writeText(JSON.stringify(clip));
    } catch {
      /* system clipboard may be blocked */
    }

    toast.success(
      // wynik i18n.t z pluralami jest w runtime stringiem — String() przypina typ
      String(
        i18n.t('mindmap.nodes.copiedCount', {
          count: selected.length,
          defaultValue_one: 'Copied {{count}} node',
          defaultValue_other: 'Copied {{count}} nodes',
        } as any)
      ),
      { duration: 1200 }
    );
  }, [edges, isPolish, nodes]);

  const cutSelected = useCallback(() => {
    const selected = nodes.filter(
      (n) => n.selected && n.id !== 'root' && !n.id.startsWith('branch-')
    );
    if (selected.length === 0) {
      toast(i18n.t('mindmap.nodes.selectNodesToCut'));
      return;
    }
    if (locked) return;

    copySelected();
    pushUndo();

    const removedIds = new Set<string>();
    for (const n of selected) {
      for (const tid of getSubtreeNodeIds(n.id)) removedIds.add(tid);
    }
    const removedEdgeIds = edges
      .filter((e) => removedIds.has(e.source) || removedIds.has(e.target))
      .map((e) => e.id);
    setNodes((prev: Node[]) => prev.filter((n) => !removedIds.has(n.id)));
    setEdges((prev: Edge[]) =>
      prev.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
    );
    broadcast([
      ...Array.from(removedIds).map((id) => ({ op: 'remove_node', data: { id } })),
      ...removedEdgeIds.map((id) => ({ op: 'remove_edge', data: { id } })),
    ]);

    toast.success(
      // wynik i18n.t z pluralami jest w runtime stringiem — String() przypina typ
      String(
        i18n.t('mindmap.nodes.cutCount', {
          count: removedIds.size,
          defaultValue_one: 'Cut {{count}} node',
          defaultValue_other: 'Cut {{count}} nodes',
        } as any)
      ),
      { duration: 1200 }
    );
  }, [
    broadcast,
    copySelected,
    edges,
    getSubtreeNodeIds,
    isPolish,
    locked,
    nodes,
    pushUndo,
    setEdges,
    setNodes,
  ]);

  const pasteNodes = useCallback(
    (targetPosition?: { x: number; y: number }) => {
      if (locked) return;

      let clip = _clipboard;

      if (!clip || clip.nodes.length === 0) {
        try {
          const text = (window as any).__mindmapClipboardFallback;
          if (text) {
            const parsed = JSON.parse(text) as MindMapClipboard;
            if (parsed?.nodes?.length) clip = parsed;
          }
        } catch {
          /* ignore parse errors */
        }
      }

      if (!clip || clip.nodes.length === 0) {
        toast(i18n.t('mindmap.nodes.clipboardEmpty'));
        return;
      }

      pushUndo();

      const idMap = new Map<string, string>();
      for (const sn of clip.nodes) {
        idMap.set(sn.id, `node-${uid()}`);
      }

      const anchorNode = nodes.find(
        (n) => n.selected && n.id !== 'root' && !n.id.startsWith('branch-')
      );

      const basePos =
        targetPosition ??
        (anchorNode
          ? { x: anchorNode.position.x + 220, y: anchorNode.position.y }
          : { x: 0, y: 0 });

      const minX = Math.min(...clip.nodes.map((n) => n.position.x));
      const minY = Math.min(...clip.nodes.map((n) => n.position.y));

      const newNodes: Node[] = clip.nodes.map((sn) => ({
        id: idMap.get(sn.id)!,
        type: sn.type || 'idea',
        position: {
          x: basePos.x + (sn.position.x - minX),
          y: basePos.y + (sn.position.y - minY),
        },
        data: { ...sn.data, _startEditing: undefined },
        selected: true,
      }));

      const newEdges: Edge[] = clip.edges
        .filter((se) => idMap.has(se.source) && idMap.has(se.target))
        .map((se) => ({
          id: `edge-${uid()}`,
          source: idMap.get(se.source)!,
          target: idMap.get(se.target)!,
          type: se.type || 'gradient',
          style: se.style,
          animated: se.animated ?? true,
          data: se.data ? { ...se.data } : { edgeRole: 'structural' },
        }));

      const pastedChildTargets = new Set(clip.edges.map((e) => e.target));
      const topLevelOrigIds = clip.nodes
        .filter((n) => !pastedChildTargets.has(n.id))
        .map((n) => n.id);

      const parentId = anchorNode?.id ?? nodes.find((n) => n.id === 'root')?.id ?? 'root';

      for (const origId of topLevelOrigIds) {
        const newId = idMap.get(origId)!;
        const branchKey =
          clip.nodes.find((n) => n.id === origId)?.data?.branchKey || 'uncategorized';
        const colors = branchColor(branchKey);
        newEdges.push({
          id: `edge-${uid()}`,
          source: parentId,
          target: newId,
          type: 'gradient',
          style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
          animated: true,
          data: { userCreated: true, edgeRole: 'structural' },
        } as any);
      }

      setNodes((prev: Node[]) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes]);
      setEdges((prev: Edge[]) => [...prev, ...newEdges]);
      broadcast([
        ...newNodes.map((n) => ({ op: 'add_node', data: n })),
        ...newEdges.map((e) => ({ op: 'add_edge', data: e })),
      ]);

      toast.success(
        // wynik i18n.t z pluralami jest w runtime stringiem — String() przypina typ
        String(
          i18n.t('mindmap.nodes.pastedCount', {
            count: newNodes.length,
            defaultValue_one: 'Pasted {{count}} node',
            defaultValue_other: 'Pasted {{count}} nodes',
          } as any)
        ),
        { duration: 1200 }
      );

      setTimeout(() => {
        try {
          fitView({ padding: 0.3, duration: 300 });
        } catch {
          /* */
        }
      }, 60);
    },
    [broadcast, fitView, isPolish, locked, nodes, pushUndo, setEdges, setNodes]
  );

  return {
    editingNodeIdRef,
    isNodeLockedByPeer,
    getSelectedNode,
    getNodeById,
    selectedNodeIds,
    findParentId,
    findChildrenIds,
    getSubtreeNodeIds,
    addChildNode,
    addSiblingNode,
    deleteSelected,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteNodes,
    focusSelectedNode,
    reparentNode,
    promoteNode,
    demoteNode,
    moveBetweenSiblings,
    clearDropTargets,
    isReparentable,
    reparentSelectedPromote,
    reparentSelectedDemote,
    startEditingSelected,
    toggleCollapse,
    setFoldLevel,
    addRootTopic,
  };
}
